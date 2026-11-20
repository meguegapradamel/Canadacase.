-- CanadaCase Academy: classement des examens blancs par année et session.
-- Les colonnes sont ajoutées à la table existante pour préserver les tentatives et certificats.
alter table public.academy_mock_exams
  add column if not exists exam_type text,
  add column if not exists exam_year smallint,
  add column if not exists session_month smallint,
  add column if not exists session_label text,
  add column if not exists session_date date,
  add column if not exists provenance_type text not null default 'original',
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists provenance_note text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'academy_mock_exams_exam_type_check') then
    alter table public.academy_mock_exams add constraint academy_mock_exams_exam_type_check
      check (exam_type is null or exam_type in ('TCF Canada','TEF Canada'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'academy_mock_exams_exam_year_check') then
    alter table public.academy_mock_exams add constraint academy_mock_exams_exam_year_check
      check (exam_year is null or exam_year between 2000 and 2200);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'academy_mock_exams_session_month_check') then
    alter table public.academy_mock_exams add constraint academy_mock_exams_session_month_check
      check (session_month is null or session_month between 1 and 12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'academy_mock_exams_provenance_check') then
    alter table public.academy_mock_exams add constraint academy_mock_exams_provenance_check
      check (provenance_type in ('historical_verified','official_example','original','unverified'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'academy_mock_exams_source_url_check') then
    alter table public.academy_mock_exams add constraint academy_mock_exams_source_url_check
      check (source_url is null or source_url ~ '^https://');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'academy_mock_exams_historical_evidence_check') then
    alter table public.academy_mock_exams add constraint academy_mock_exams_historical_evidence_check
      check (provenance_type <> 'historical_verified' or (nullif(btrim(source_name),'') is not null and source_url is not null));
  end if;
end $$;

create index if not exists academy_mock_exams_archive_idx
  on public.academy_mock_exams (exam_type, exam_year desc, session_month desc, created_at desc)
  where status = 'published';

comment on column public.academy_mock_exams.exam_year is 'Année de session affichée dans les archives, pas année de création du contenu.';
comment on column public.academy_mock_exams.provenance_type is 'historical_verified exige une source et un lien vérifiables; original désigne un contenu CanadaCase.';
