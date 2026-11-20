-- Consolidate overlapping permissive Immigration RLS policies.
-- Applied to Supabase production as migration 20261120153123.
-- Read access remains candidate OR assigned staff/admin; writes remain assigned staff/admin,
-- except case_assignments writes which remain admin-only.

DROP POLICY IF EXISTS case_assignments_admin_manage ON public.case_assignments;
DROP POLICY IF EXISTS case_assignments_staff_read ON public.case_assignments;
CREATE POLICY case_assignments_select ON public.case_assignments FOR SELECT TO authenticated
USING (private.is_case_staff(case_id));
CREATE POLICY case_assignments_admin_insert ON public.case_assignments FOR INSERT TO authenticated
WITH CHECK (private.is_case_admin());
CREATE POLICY case_assignments_admin_update ON public.case_assignments FOR UPDATE TO authenticated
USING (private.is_case_admin()) WITH CHECK (private.is_case_admin());
CREATE POLICY case_assignments_admin_delete ON public.case_assignments FOR DELETE TO authenticated
USING (private.is_case_admin());

DROP POLICY IF EXISTS case_deadlines_staff_manage ON public.case_deadlines;
DROP POLICY IF EXISTS case_deadlines_case_read ON public.case_deadlines;
CREATE POLICY case_deadlines_select ON public.case_deadlines FOR SELECT TO authenticated
USING (private.can_access_case(case_id));
CREATE POLICY case_deadlines_staff_insert ON public.case_deadlines FOR INSERT TO authenticated
WITH CHECK (private.is_case_staff(case_id));
CREATE POLICY case_deadlines_staff_update ON public.case_deadlines FOR UPDATE TO authenticated
USING (private.is_case_staff(case_id)) WITH CHECK (private.is_case_staff(case_id));
CREATE POLICY case_deadlines_staff_delete ON public.case_deadlines FOR DELETE TO authenticated
USING (private.is_case_staff(case_id));

DROP POLICY IF EXISTS case_document_requirements_staff_manage ON public.case_document_requirements;
DROP POLICY IF EXISTS case_document_requirements_case_read ON public.case_document_requirements;
CREATE POLICY case_document_requirements_select ON public.case_document_requirements FOR SELECT TO authenticated
USING (private.can_access_case(case_id));
CREATE POLICY case_document_requirements_staff_insert ON public.case_document_requirements FOR INSERT TO authenticated
WITH CHECK (private.is_case_staff(case_id));
CREATE POLICY case_document_requirements_staff_update ON public.case_document_requirements FOR UPDATE TO authenticated
USING (private.is_case_staff(case_id)) WITH CHECK (private.is_case_staff(case_id));
CREATE POLICY case_document_requirements_staff_delete ON public.case_document_requirements FOR DELETE TO authenticated
USING (private.is_case_staff(case_id));

DROP POLICY IF EXISTS assigned_staff_reads_case_documents ON public.case_documents;
DROP POLICY IF EXISTS "document owner or admin read" ON public.case_documents;
DROP POLICY IF EXISTS assigned_staff_updates_case_documents ON public.case_documents;
DROP POLICY IF EXISTS "document admin update" ON public.case_documents;
CREATE POLICY case_documents_read ON public.case_documents FOR SELECT TO authenticated
USING (private.is_active_user() AND (private.is_case_staff(candidate_case_id) OR user_id = (SELECT auth.uid())));
CREATE POLICY case_documents_staff_update ON public.case_documents FOR UPDATE TO authenticated
USING (private.is_case_staff(candidate_case_id)) WITH CHECK (private.is_case_staff(candidate_case_id));

DROP POLICY IF EXISTS case_messages_candidate_send ON public.case_messages;
DROP POLICY IF EXISTS case_messages_staff_send ON public.case_messages;
CREATE POLICY case_messages_send ON public.case_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = (SELECT auth.uid())
  AND (
    private.is_case_staff(case_id)
    OR (visibility = 'candidate_visible' AND private.can_access_case(case_id))
  )
);

DROP POLICY IF EXISTS case_tasks_staff_manage ON public.case_tasks;
DROP POLICY IF EXISTS case_tasks_case_read ON public.case_tasks;
CREATE POLICY case_tasks_select ON public.case_tasks FOR SELECT TO authenticated
USING (private.can_access_case(case_id));
CREATE POLICY case_tasks_staff_insert ON public.case_tasks FOR INSERT TO authenticated
WITH CHECK (private.is_case_staff(case_id));
CREATE POLICY case_tasks_staff_update ON public.case_tasks FOR UPDATE TO authenticated
USING (private.is_case_staff(case_id)) WITH CHECK (private.is_case_staff(case_id));
CREATE POLICY case_tasks_staff_delete ON public.case_tasks FOR DELETE TO authenticated
USING (private.is_case_staff(case_id));

DROP POLICY IF EXISTS agent_reads_assigned_candidate_profiles ON public.profiles;
DROP POLICY IF EXISTS "profile self or admin read" ON public.profiles;
CREATE POLICY profiles_self_or_assigned_staff_read ON public.profiles FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) OR private.can_access_candidate(id));
