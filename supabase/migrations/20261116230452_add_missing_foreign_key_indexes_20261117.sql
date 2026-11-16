-- Add covering indexes for foreign keys identified by Supabase Performance Advisor.
-- Safe and idempotent: no table data or access policies are changed.
create index if not exists idx_admin_action_log_admin_id on public.admin_action_log (admin_id);
create index if not exists idx_admin_action_log_target_user on public.admin_action_log (target_user);
create index if not exists idx_audit_logs_actor_user_id on public.audit_logs (actor_user_id);
create index if not exists idx_case_assignments_assigned_by on public.case_assignments (assigned_by);
create index if not exists idx_case_deadlines_created_by on public.case_deadlines (created_by);
create index if not exists idx_case_doc_req_related_doc on public.case_document_requirements (related_document_id);
create index if not exists idx_case_documents_user_id on public.case_documents (user_id);
create index if not exists idx_case_documents_verified_by on public.case_documents (verified_by);
create index if not exists idx_case_history_actor_id on public.case_history (actor_id);
create index if not exists idx_case_history_case_id on public.case_history (case_id);
create index if not exists idx_case_internal_notes_author on public.case_internal_notes (author_id);
create index if not exists idx_case_messages_sender_id on public.case_messages (sender_id);
create index if not exists idx_case_notes_author_id on public.case_notes (author_id);
create index if not exists idx_case_notes_case_id on public.case_notes (case_id);
create index if not exists idx_case_observations_case_id on public.case_observations (case_id);
create index if not exists idx_case_observations_user_id on public.case_observations (user_id);
create index if not exists idx_case_sections_stage_section on public.case_sections (process_stage, section_number);
create index if not exists idx_case_sections_updated_by on public.case_sections (updated_by);
create index if not exists idx_case_tasks_assigned_to on public.case_tasks (assigned_to);
create index if not exists idx_case_tasks_created_by on public.case_tasks (created_by);
create index if not exists idx_case_updates_user_id on public.case_updates (user_id);
create index if not exists idx_education_records_case_id on public.education_records (case_id);
create index if not exists idx_family_members_case_id on public.family_members (case_id);
create index if not exists idx_notifications_case_id on public.notifications (case_id);
create index if not exists idx_notifications_user_id on public.notifications (user_id);
create index if not exists idx_work_experiences_case_id on public.work_experiences (case_id);
