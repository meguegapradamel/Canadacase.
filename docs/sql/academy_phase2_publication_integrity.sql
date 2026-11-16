alter table public.academy_resources
  drop constraint if exists academy_resources_check1;
alter table public.academy_resources
  add constraint academy_resources_publish_rights_check
  check (
    not is_published
    or (
      rights_status <> 'permission_pending'
      and external_url is not null
      and (
        rights_status = 'original'
        or source_url is not null
        or nullif(btrim(license_note),'') is not null
      )
    )
  );

create or replace function public.academy_guard_course_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' then
    if not exists (
      select 1
      from public.academy_course_modules m
      join public.academy_lessons l on l.module_id = m.id
      where m.course_id = new.id
    ) then
      raise exception 'Un cours doit contenir au moins un module et une leçon avant publication.'
        using errcode = '23514';
    end if;
    if new.published_at is null then
      new.published_at := now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists academy_guard_course_publication on public.academy_courses;
create trigger academy_guard_course_publication
before insert or update of status on public.academy_courses
for each row execute function public.academy_guard_course_publication();

revoke all on function public.academy_guard_course_publication() from public, anon, authenticated;
