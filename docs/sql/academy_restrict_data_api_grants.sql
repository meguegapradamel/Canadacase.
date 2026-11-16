-- Supabase a des privilèges par défaut sur les nouveaux objets publics.
-- Retirer ces droits larges pour anon/authenticated, puis réaccorder le strict nécessaire.
revoke all privileges on table public.academy_profiles from anon, authenticated;
revoke all privileges on table public.academy_user_roles from anon, authenticated;
revoke all privileges on table public.academy_trainer_applications from anon, authenticated;

-- Profil apprenant : lecture, insertion limitée et modification limitée.
grant select on table public.academy_profiles to authenticated;
grant insert (user_id, display_name, preferred_ui_language, country_code, timezone, learning_goals)
  on table public.academy_profiles to authenticated;
grant update (display_name, preferred_ui_language, country_code, timezone, learning_goals, updated_at)
  on table public.academy_profiles to authenticated;

-- Rôles : lecture, auto-inscription apprenant (RLS), suppression réservée à l'administration (RLS).
grant select, insert, delete on table public.academy_user_roles to authenticated;

-- Candidatures : lecture/insertion, modification des seuls champs de dossier.
grant select, insert on table public.academy_trainer_applications to authenticated;
grant update (biography, experience_years, specialties, updated_at)
  on table public.academy_trainer_applications to authenticated;

-- Aucune permission n'est accordée à anon. service_role conserve ses privilèges serveur.
