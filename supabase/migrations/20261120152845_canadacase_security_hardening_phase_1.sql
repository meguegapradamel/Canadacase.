-- CanadaCase security hardening phase 1.
-- Applied to Supabase production as migration 20261120152845.

ALTER TABLE public.academy_mock_exam_questions
  ADD COLUMN IF NOT EXISTS response_mode text NOT NULL DEFAULT 'written';

UPDATE public.academy_mock_exam_questions
SET response_mode = CASE
  WHEN COALESCE(rubric->>'oral_task','false') = 'true' THEN 'oral'
  ELSE 'written'
END
WHERE response_mode IS DISTINCT FROM CASE
  WHEN COALESCE(rubric->>'oral_task','false') = 'true' THEN 'oral'
  ELSE 'written'
END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.academy_mock_exam_questions'::regclass
      AND conname = 'academy_mock_exam_questions_response_mode_check'
  ) THEN
    ALTER TABLE public.academy_mock_exam_questions
      ADD CONSTRAINT academy_mock_exam_questions_response_mode_check
      CHECK (response_mode IN ('written','oral'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.is_case_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT private.is_active_user()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
        AND COALESCE(p.is_active, true)
    );
$function$;

CREATE OR REPLACE FUNCTION private.is_case_staff(p_case_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT private.is_active_user()
    AND (
      private.is_case_admin()
      OR EXISTS (
        SELECT 1
        FROM public.case_assignments ca
        JOIN public.profiles p ON p.id = ca.agent_id
        WHERE ca.case_id = p_case_id
          AND ca.agent_id = (SELECT auth.uid())
          AND p.role = 'agent'
          AND COALESCE(p.is_active, true)
      )
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_access_case(p_case_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT private.is_active_user()
    AND (
      EXISTS (
        SELECT 1 FROM public.candidate_cases cc
        WHERE cc.id = p_case_id AND cc.user_id = (SELECT auth.uid())
      )
      OR private.is_case_staff(p_case_id)
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_access_candidate(p_candidate_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT private.is_active_user()
    AND (
      private.is_case_admin()
      OR EXISTS (
        SELECT 1
        FROM public.candidate_cases cc
        JOIN public.case_assignments ca ON ca.case_id = cc.id
        JOIN public.profiles agent_profile ON agent_profile.id = ca.agent_id
        JOIN public.profiles candidate_profile ON candidate_profile.id = cc.user_id
        WHERE cc.user_id = p_candidate_id
          AND ca.agent_id = (SELECT auth.uid())
          AND agent_profile.role = 'agent'
          AND COALESCE(agent_profile.is_active, true)
          AND COALESCE(candidate_profile.is_active, true)
      )
    );
$function$;

DROP POLICY IF EXISTS "document owner or admin read" ON public.case_documents;
CREATE POLICY "document owner or admin read"
ON public.case_documents FOR SELECT TO authenticated
USING (
  private.is_active_user()
  AND (user_id = (SELECT auth.uid()) OR private.is_case_admin())
);

ALTER TABLE private.academy_mock_exam_answer_keys ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.academy_admin_get_mock_exam_review_questions(p_attempt_id uuid)
RETURNS TABLE(question_id uuid, prompt text, points numeric, question_type text, rubric jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE v_exam_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_active_user() THEN
    RAISE EXCEPTION 'Session active requise.' USING errcode = '42501';
  END IF;

  SELECT a.exam_id INTO v_exam_id
  FROM public.academy_mock_exam_attempts a
  WHERE a.id = p_attempt_id AND a.status IN ('awaiting_review','graded');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Copie soumise introuvable.' USING errcode = '55000';
  END IF;

  IF NOT private.is_case_admin()
     AND NOT EXISTS (
       SELECT 1
       FROM public.academy_mock_exam_reviewers r
       JOIN public.academy_user_roles ur
         ON ur.user_id = r.trainer_id AND ur.role_code = 'trainer'
       WHERE r.trainer_id = (SELECT auth.uid())
         AND r.exam_id = v_exam_id AND r.active
     ) THEN
    RAISE EXCEPTION 'Accès réservé à l’administrateur ou au formateur affecté.'
      USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT q.id, q.prompt, q.points, q.question_type, q.rubric
  FROM public.academy_mock_exam_questions q
  WHERE q.exam_id = v_exam_id ORDER BY q.position;
END;
$function$;

CREATE OR REPLACE FUNCTION public.academy_admin_get_mock_exam_review_questions(p_attempt_id uuid)
RETURNS TABLE(question_id uuid, prompt text, points numeric, question_type text, rubric jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT * FROM private.academy_admin_get_mock_exam_review_questions(p_attempt_id);
$function$;

REVOKE ALL ON FUNCTION public.academy_admin_get_mock_exam_review_questions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.academy_admin_get_mock_exam_review_questions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.academy_admin_get_mock_exam_review_questions(uuid) TO authenticated;
