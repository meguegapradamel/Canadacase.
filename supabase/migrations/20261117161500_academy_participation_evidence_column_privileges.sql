revoke select on table public.academy_participation_attestations from authenticated;
grant select (
  id,
  verification_code,
  learner_id,
  learner_name_snapshot,
  activity_type,
  activity_title,
  activity_date,
  duration_minutes,
  issued_at,
  revoked_at,
  revocation_reason,
  created_at
) on table public.academy_participation_attestations to authenticated;