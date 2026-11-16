-- CanadaCase Academy Phase 2: catalogue pédagogique et bibliothèque.
-- Additif : aucune table historique CanadaCase n'est modifiée.
-- Aucun bucket payant ou fournisseur externe n'est créé dans cette phase.

create table public.academy_domains (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_]{2,60}$'),
  name_fr text not null check (length(trim(name_fr)) between 2 and 120),
  name_en text not null check (length(trim(name_en)) between 2 and 120),
  description_fr text,
  description_en text,
  icon text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academy_programs (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.academy_domains(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z0-9_]{2,80}$'),
  name_fr text not null check (length(trim(name_fr)) between 2 and 160),
  name_en text not null check (length(trim(name_en)) between 2 and 160),
  description_fr text,
  description_en text,
  program_type text not null default 'professional_training'
    check (program_type in ('exam_preparation','professional_training','skills','career')),
  language_code text not null default 'fr' check (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  exam_code text,
  level_code text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academy_courses (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.academy_programs(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 3 and 180),
  summary text,
  description text,
  language_code text not null default 'fr' check (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  level_code text,
  course_format text not null default 'self_paced'
    check (course_format in ('self_paced','cohort','workshop','hybrid')),
  estimated_minutes integer not null default 60 check (estimated_minutes between 1 and 100000),
  status text not null default 'draft'
    check (status in ('draft','submitted_for_review','needs_changes','published','archived')),
  is_featured boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academy_course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 180),
  description text,
  position integer not null default 100,
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, position)
);

create table public.academy_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.academy_course_modules(id) on delete cascade,
  title text not null check (length(trim(title)) between 2 and 180),
  lesson_type text not null default 'text'
    check (lesson_type in ('text','video','audio','document','interactive','live_replay','quiz')),
  content text,
  media_url text,
  transcript text,
  objectives text,
  estimated_minutes integer not null default 10 check (estimated_minutes between 0 and 10000),
  position integer not null default 100,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(module_id, position),
  check (media_url is null or media_url ~ '^https://')
);

create table public.academy_resources (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid references public.academy_domains(id) on delete restrict,
  program_id uuid references public.academy_programs(id) on delete restrict,
  course_id uuid references public.academy_courses(id) on delete cascade,
  lesson_id uuid references public.academy_lessons(id) on delete cascade,
  title text not null check (length(trim(title)) between 3 and 180),
  summary text,
  resource_type text not null
    check (resource_type in ('pdf','document','video','audio','image','link','worksheet','book','podcast')),
  external_url text,
  source_name text,
  source_url text,
  rights_status text not null default 'permission_pending'
    check (rights_status in ('original','licensed','public_domain','permission_pending')),
  license_note text,
  version_label text,
  language_code text not null default 'fr' check (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  level_code text,
  is_published boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (domain_id is not null or program_id is not null or course_id is not null or lesson_id is not null),
  check (external_url is null or external_url ~ '^https://'),
  check (source_url is null or source_url ~ '^https://'),
  check (not is_published or (rights_status <> 'permission_pending' and external_url is not null))
);

create index academy_programs_domain_idx on public.academy_programs(domain_id, sort_order);
create index academy_courses_program_status_idx on public.academy_courses(program_id, status, created_at desc);
create index academy_courses_owner_status_idx on public.academy_courses(created_by, status);
create index academy_modules_course_position_idx on public.academy_course_modules(course_id, position);
create index academy_lessons_module_position_idx on public.academy_lessons(module_id, position);
create index academy_resources_domain_published_idx on public.academy_resources(domain_id, is_published, created_at desc);
create index academy_resources_program_published_idx on public.academy_resources(program_id, is_published, created_at desc);
create index academy_resources_course_idx on public.academy_resources(course_id);
create index academy_resources_lesson_idx on public.academy_resources(lesson_id);
create index academy_resources_owner_idx on public.academy_resources(created_by, is_published);

alter table public.academy_domains enable row level security;
alter table public.academy_programs enable row level security;
alter table public.academy_courses enable row level security;
alter table public.academy_course_modules enable row level security;
alter table public.academy_lessons enable row level security;
alter table public.academy_resources enable row level security;

-- Domaines et programmes : visibles aux comptes actifs ; administration réservée aux administrateurs.
create policy academy_domains_read_active on public.academy_domains
for select to authenticated using (
  (select private.is_active_user()) and (is_active or (select private.is_case_admin()))
);
create policy academy_domains_admin_insert on public.academy_domains
for insert to authenticated with check ((select private.is_active_user()) and (select private.is_case_admin()));
create policy academy_domains_admin_update on public.academy_domains
for update to authenticated using ((select private.is_active_user()) and (select private.is_case_admin()))
with check ((select private.is_active_user()) and (select private.is_case_admin()));
create policy academy_domains_admin_delete on public.academy_domains
for delete to authenticated using ((select private.is_active_user()) and (select private.is_case_admin()));

create policy academy_programs_read_active on public.academy_programs
for select to authenticated using (
  (select private.is_active_user()) and (
    exists (select 1 from public.academy_domains d where d.id = domain_id and d.is_active)
    or (select private.is_case_admin())
  )
);
create policy academy_programs_admin_insert on public.academy_programs
for insert to authenticated with check ((select private.is_active_user()) and (select private.is_case_admin()));
create policy academy_programs_admin_update on public.academy_programs
for update to authenticated using ((select private.is_active_user()) and (select private.is_case_admin()))
with check ((select private.is_active_user()) and (select private.is_case_admin()));
create policy academy_programs_admin_delete on public.academy_programs
for delete to authenticated using ((select private.is_active_user()) and (select private.is_case_admin()));

-- Un formateur validé peut créer et modifier ses propres brouillons ; seul l'admin publie.
create policy academy_courses_read on public.academy_courses
for select to authenticated using (
  (select private.is_active_user()) and (
    status = 'published'
    or (created_by = (select auth.uid()) and exists (
      select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer'
    ))
    or (select private.is_case_admin())
  )
);
create policy academy_courses_trainer_insert on public.academy_courses
for insert to authenticated with check (
  (select private.is_active_user()) and created_by = (select auth.uid())
  and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
  and status = 'draft'
);
create policy academy_courses_admin_insert on public.academy_courses
for insert to authenticated with check (
  (select private.is_active_user()) and (select private.is_case_admin())
);
create policy academy_courses_trainer_update on public.academy_courses
for update to authenticated using (
  (select private.is_active_user()) and created_by = (select auth.uid())
  and status in ('draft','needs_changes','submitted_for_review')
  and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
) with check (
  (select private.is_active_user()) and created_by = (select auth.uid())
  and status in ('draft','needs_changes','submitted_for_review')
  and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
);
create policy academy_courses_admin_update on public.academy_courses
for update to authenticated using ((select private.is_active_user()) and (select private.is_case_admin()))
with check ((select private.is_active_user()) and (select private.is_case_admin()));
create policy academy_courses_trainer_delete on public.academy_courses
for delete to authenticated using (
  (select private.is_active_user()) and created_by = (select auth.uid()) and status = 'draft'
  and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
);
create policy academy_courses_admin_delete on public.academy_courses
for delete to authenticated using ((select private.is_active_user()) and (select private.is_case_admin()));

-- Modules : héritent des droits du cours parent.
create policy academy_modules_read on public.academy_course_modules
for select to authenticated using (
  (select private.is_active_user()) and exists (
    select 1 from public.academy_courses c where c.id = course_id
    and (c.status = 'published' or c.created_by = (select auth.uid()) or (select private.is_case_admin()))
  )
);
create policy academy_modules_trainer_insert on public.academy_course_modules
for insert to authenticated with check (
  (select private.is_active_user()) and exists (
    select 1 from public.academy_courses c where c.id = course_id and c.created_by = (select auth.uid())
      and c.status in ('draft','needs_changes')
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
  )
);
create policy academy_modules_admin_insert on public.academy_course_modules
for insert to authenticated with check (
  (select private.is_active_user()) and (select private.is_case_admin())
);
create policy academy_modules_trainer_update on public.academy_course_modules
for update to authenticated using (
  (select private.is_active_user()) and exists (
    select 1 from public.academy_courses c where c.id = course_id and c.created_by = (select auth.uid())
      and c.status in ('draft','needs_changes')
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
  )
) with check (
  (select private.is_active_user()) and exists (
    select 1 from public.academy_courses c where c.id = course_id and c.created_by = (select auth.uid())
      and c.status in ('draft','needs_changes')
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
  )
);
create policy academy_modules_admin_update on public.academy_course_modules
for update to authenticated using ((select private.is_active_user()) and (select private.is_case_admin()))
with check ((select private.is_active_user()) and (select private.is_case_admin()));
create policy academy_modules_trainer_delete on public.academy_course_modules
for delete to authenticated using (
  (select private.is_active_user()) and exists (
    select 1 from public.academy_courses c where c.id = course_id and c.created_by = (select auth.uid())
      and c.status in ('draft','needs_changes')
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
  )
);
create policy academy_modules_admin_delete on public.academy_course_modules
for delete to authenticated using ((select private.is_active_user()) and (select private.is_case_admin()));

-- Leçons : les droits suivent le module et son cours parent.
create policy academy_lessons_read on public.academy_lessons
for select to authenticated using (
  (select private.is_active_user()) and exists (
    select 1 from public.academy_course_modules m
    join public.academy_courses c on c.id = m.course_id
    where m.id = module_id and (
      c.status = 'published' or c.created_by = (select auth.uid()) or (select private.is_case_admin())
    )
  )
);
create policy academy_lessons_trainer_insert on public.academy_lessons
for insert to authenticated with check (
  (select private.is_active_user()) and exists (
    select 1 from public.academy_course_modules m
    join public.academy_courses c on c.id = m.course_id
    where m.id = module_id and c.created_by = (select auth.uid())
      and c.status in ('draft','needs_changes')
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
  )
);
create policy academy_lessons_admin_insert on public.academy_lessons
for insert to authenticated with check (
  (select private.is_active_user()) and (select private.is_case_admin())
);
create policy academy_lessons_trainer_update on public.academy_lessons
for update to authenticated using (
  (select private.is_active_user()) and exists (
    select 1 from public.academy_course_modules m
    join public.academy_courses c on c.id = m.course_id
    where m.id = module_id and c.created_by = (select auth.uid())
      and c.status in ('draft','needs_changes')
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
  )
) with check (
  (select private.is_active_user()) and exists (
    select 1 from public.academy_course_modules m
    join public.academy_courses c on c.id = m.course_id
    where m.id = module_id and c.created_by = (select auth.uid())
      and c.status in ('draft','needs_changes')
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
  )
);
create policy academy_lessons_admin_update on public.academy_lessons
for update to authenticated using ((select private.is_active_user()) and (select private.is_case_admin()))
with check ((select private.is_active_user()) and (select private.is_case_admin()));
create policy academy_lessons_trainer_delete on public.academy_lessons
for delete to authenticated using (
  (select private.is_active_user()) and exists (
    select 1 from public.academy_course_modules m
    join public.academy_courses c on c.id = m.course_id
    where m.id = module_id and c.created_by = (select auth.uid())
      and c.status in ('draft','needs_changes')
      and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
  )
);
create policy academy_lessons_admin_delete on public.academy_lessons
for delete to authenticated using ((select private.is_active_user()) and (select private.is_case_admin()));

-- Bibliothèque : ressources publiées visibles aux comptes actifs ; contributions formateurs non publiées privées.
create policy academy_resources_read on public.academy_resources
for select to authenticated using (
  (select private.is_active_user()) and (
    is_published
    or created_by = (select auth.uid())
    or (select private.is_case_admin())
  )
);
create policy academy_resources_trainer_insert on public.academy_resources
for insert to authenticated with check (
  (select private.is_active_user()) and created_by = (select auth.uid()) and not is_published
  and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
);
create policy academy_resources_admin_insert on public.academy_resources
for insert to authenticated with check ((select private.is_active_user()) and (select private.is_case_admin()));
create policy academy_resources_trainer_update on public.academy_resources
for update to authenticated using (
  (select private.is_active_user()) and created_by = (select auth.uid()) and not is_published
  and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
) with check (
  (select private.is_active_user()) and created_by = (select auth.uid()) and not is_published
  and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
);
create policy academy_resources_admin_update on public.academy_resources
for update to authenticated using ((select private.is_active_user()) and (select private.is_case_admin()))
with check ((select private.is_active_user()) and (select private.is_case_admin()));
create policy academy_resources_trainer_delete on public.academy_resources
for delete to authenticated using (
  (select private.is_active_user()) and created_by = (select auth.uid()) and not is_published
  and exists (select 1 from public.academy_user_roles r where r.user_id = (select auth.uid()) and r.role_code = 'trainer')
);
create policy academy_resources_admin_delete on public.academy_resources
for delete to authenticated using ((select private.is_active_user()) and (select private.is_case_admin()));

-- Les tables publiques ne sont pas accessibles à anon. Les comptes authentifiés sont limités par RLS.
revoke all privileges on table public.academy_domains, public.academy_programs, public.academy_courses,
  public.academy_course_modules, public.academy_lessons, public.academy_resources from anon, authenticated;
grant select, insert, update, delete on table public.academy_domains, public.academy_programs,
  public.academy_courses, public.academy_course_modules, public.academy_lessons, public.academy_resources
  to authenticated;

-- Domaines initiaux ; catalogue bilingue et extensible par l'administration.
insert into public.academy_domains(code,name_fr,name_en,description_fr,description_en,icon,sort_order)
values
 ('LANGUAGES_EXAMS','Langues et examens','Languages and exams','Préparation linguistique et examens internationaux.','Language learning and international exam preparation.','languages',10),
 ('ACCOUNTING_FINANCE','Comptabilité et finance','Accounting and finance','Comptabilité, gestion financière et analyse.','Accounting, financial management and analysis.','calculator',20),
 ('IT_DIGITAL','Informatique et numérique','IT and digital skills','Développement, outils numériques et compétences informatiques.','Software development, digital tools and IT skills.','code',30),
 ('MANAGEMENT_BUSINESS','Gestion et entrepreneuriat','Management and entrepreneurship','Management, organisation et création d’entreprise.','Management, organization and entrepreneurship.','briefcase',40),
 ('COMMUNICATION','Communication','Communication','Communication professionnelle et expression.','Professional communication and expression.','messages-square',50),
 ('STUDIES_CAREER','Études et carrière','Studies and career','Orientation, études et développement professionnel.','Career guidance, studies and professional development.','graduation-cap',60)
on conflict (code) do nothing;

insert into public.academy_programs(domain_id,code,name_fr,name_en,description_fr,description_en,program_type,language_code,exam_code,level_code,sort_order)
select d.id,v.code,v.name_fr,v.name_en,v.description_fr,v.description_en,'exam_preparation','fr',v.exam_code,'Tous niveaux',v.sort_order
from public.academy_domains d
cross join (values
 ('TEF_CANADA','TEF Canada','TEF Canada','Préparation aux quatre compétences du TEF Canada.','Preparation for the four TEF Canada skills.','TEF_CANADA',10),
 ('TCF_CANADA','TCF Canada','TCF Canada','Préparation aux épreuves du TCF Canada.','Preparation for TCF Canada tests.','TCF_CANADA',20)
) as v(code,name_fr,name_en,description_fr,description_en,exam_code,sort_order)
where d.code='LANGUAGES_EXAMS'
on conflict (code) do nothing;
