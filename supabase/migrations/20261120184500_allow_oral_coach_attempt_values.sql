-- The oral coach stores an estimated level before the CEFR level can be established.
-- Conversation libre is also a valid oral-coach session type.
alter table public.language_attempts drop constraint if exists language_attempts_exam_check;
alter table public.language_attempts
  add constraint language_attempts_exam_check
  check (exam in ('TCF Canada','TEF Canada','Conversation libre'));

alter table public.language_attempts drop constraint if exists language_attempts_level_check;
alter table public.language_attempts
  add constraint language_attempts_level_check
  check (level in ('A1','A2','B1','B2','C1','C2','À estimer'));
