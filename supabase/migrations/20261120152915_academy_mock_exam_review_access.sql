-- Academy mock exam review access phase.
-- Applied to Supabase production as migration 20261120152915.

CREATE OR REPLACE FUNCTION private.academy_admin_save_exam_question(
  p_exam_id uuid, p_prompt text, p_question_type text, p_options jsonb,
  p_points numeric, p_position integer, p_correct_option integer,
  p_expected_answer text, p_rubric jsonb, p_explanation text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_rubric jsonb := COALESCE(p_rubric, '{}'::jsonb);
BEGIN
  IF NOT private.is_active_user() OR NOT private.is_case_admin() THEN
    RAISE EXCEPTION 'Accès administrateur requis.' USING errcode='42501';
  END IF;
  IF p_prompt IS NULL OR length(trim(p_prompt)) NOT BETWEEN 3 AND 5000
     OR p_question_type NOT IN ('mcq','short_answer')
     OR p_points <= 0 OR p_points > 100 OR p_position < 1
     OR jsonb_typeof(COALESCE(p_options,'[]'::jsonb)) <> 'array'
     OR jsonb_typeof(v_rubric) <> 'object' THEN
    RAISE EXCEPTION 'Paramètres de question invalides.' USING errcode='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.academy_mock_exams WHERE id=p_exam_id AND status='draft') THEN
    RAISE EXCEPTION 'L’examen doit être en brouillon.' USING errcode='55000';
  END IF;
  IF p_question_type='mcq'
     AND (jsonb_array_length(COALESCE(p_options,'[]'::jsonb)) NOT BETWEEN 2 AND 8
       OR p_correct_option IS NULL OR p_correct_option < 0
       OR p_correct_option >= jsonb_array_length(COALESCE(p_options,'[]'::jsonb))) THEN
    RAISE EXCEPTION 'Options ou réponse correcte invalides.' USING errcode='22023';
  END IF;
  IF p_question_type='short_answer'
     AND (p_expected_answer IS NULL OR length(trim(p_expected_answer)) < 3) THEN
    RAISE EXCEPTION 'Une réponse de référence est nécessaire pour la grille.' USING errcode='22023';
  END IF;
  INSERT INTO public.academy_mock_exam_questions(
    exam_id,prompt,question_type,options,points,position,rubric,explanation,response_mode
  )
  VALUES(
    p_exam_id,trim(p_prompt),p_question_type,COALESCE(p_options,'[]'::jsonb),
    p_points,p_position,v_rubric,nullif(trim(COALESCE(p_explanation,'')),''),
    CASE WHEN COALESCE(v_rubric->>'oral_task','false')='true' THEN 'oral' ELSE 'written' END
  ) RETURNING id INTO v_id;
  INSERT INTO private.academy_mock_exam_answer_keys(question_id,correct_option,expected_answer)
  VALUES(
    v_id,
    CASE WHEN p_question_type='mcq' THEN p_correct_option ELSE NULL END,
    CASE WHEN p_question_type='short_answer' THEN trim(p_expected_answer) ELSE NULL END
  );
  RETURN v_id;
END;
$function$;

DROP POLICY IF EXISTS "deny API access to mock exam answer keys" ON private.academy_mock_exam_answer_keys;
CREATE POLICY "deny API access to mock exam answer keys"
ON private.academy_mock_exam_answer_keys
FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON FUNCTION private.academy_admin_get_mock_exam_review_questions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.academy_admin_get_mock_exam_review_questions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION private.academy_admin_get_mock_exam_review_questions(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.academy_admin_get_mock_exam_review_questions(p_attempt_id uuid)
RETURNS TABLE(question_id uuid, prompt text, points numeric, question_type text, rubric jsonb)
LANGUAGE sql SECURITY INVOKER SET search_path TO ''
AS $function$
  SELECT * FROM private.academy_admin_get_mock_exam_review_questions(p_attempt_id);
$function$;

REVOKE ALL ON FUNCTION public.academy_admin_get_mock_exam_review_questions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.academy_admin_get_mock_exam_review_questions(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.academy_admin_get_mock_exam_review_questions(uuid) TO authenticated;
