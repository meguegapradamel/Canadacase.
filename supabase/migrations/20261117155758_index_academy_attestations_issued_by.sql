-- Cover the issuer foreign key for academy participation attestations.
create index if not exists academy_participation_attestations_issued_by_idx
  on public.academy_participation_attestations (issued_by);
