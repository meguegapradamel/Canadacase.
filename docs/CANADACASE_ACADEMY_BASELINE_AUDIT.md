# Audit initial du socle CanadaCase pour CanadaCase Academy
Date : 16 novembre 2026
Périmètre : lecture seule — aucune modification de base de données ni du portail pendant cet audit.

## 1. Éléments confirmés

- Projet Supabase : `qxaykieolvbzaxmfaack`.
- Dépôt : `meguegapradamel/Canadacase.`.
- Portail actuel : HTML/CSS/JavaScript avec Supabase JS v2.
- `public.profiles` existe et possède actuellement une contrainte de rôle limitée à `candidate`, `agent`, `admin`.
- `public.candidate_cases` est la table active des dossiers d'immigration ; elle possède notamment `deleted_at`.
- Les modules linguistiques existants incluent `language_courses`, `language_exercises`, `language_exercise_questions`, `language_attempts`, `language_voice_submissions` et des tables connexes.
- Les politiques de ces modules contrôlent notamment la publication, la propriété des tentatives et l'accès administrateur.
- Les dossiers et les modules TEF/TCF sont déjà présents : ils ne doivent pas être recréés ni remplacés.

## 2. Conséquence sur la conception des rôles

Ne pas élargir directement et sans analyse la contrainte `profiles.role` : elle sert déjà au portail immigration et à ses politiques.

Orientation recommandée :
- conserver les rôles historiques `candidate`, `agent`, `admin` ;
- ajouter une couche Academy séparée de profils/adhésions et permissions ;
- permettre plusieurs appartenances Academy pour un même `auth.users.id` ;
- garder les privilèges dans des tables protégées et/ou `app_metadata` contrôlées côté serveur, jamais dans `user_metadata` modifiable par l'utilisateur ;
- faire vérifier chaque action sensible par une politique RLS ou un backend de confiance.

Cette architecture doit être testée contre toutes les fonctions et policies existantes avant migration.

## 3. Résultats des conseillers Supabase — état de référence

### Sécurité

- 9 tables signalées avec RLS activé mais aucune policy :
  - `case_history`
  - `case_notes`
  - `case_observations`
  - `cases`
  - `education_records`
  - `family_members`
  - `language_tests`
  - `notifications`
  - `work_experiences`

  Interprétation : l'absence de policy bloque généralement l'accès via RLS, mais les privilèges SQL/Data API et les usages backend doivent être vérifiés. Ne pas ajouter des policies génériques sans connaître le modèle de propriété.

- 3 fonctions `SECURITY DEFINER` dans le schéma public sont exécutables par `authenticated` :
  - `admin_set_case_status(target_user uuid, new_status text)`
  - `admin_set_case_status_for_case(target_case uuid, new_status text)`
  - `admin_set_document_status(target_document uuid, new_status text, note text)`

  Examen du code effectué : les trois fonctions appellent explicitement `private.is_case_admin()` avant toute modification, qualifient les objets par schéma et fixent `search_path TO ''`. Le contrôle administrateur est donc présent dans le corps des fonctions. Le droit EXECUTE reste accordé à `authenticated`, ce qui déclenche l'avertissement ; il faudra confirmer les contrôles de `private.is_case_admin()` et décider si les RPC doivent rester exposées ou être restreintes. Aucune modification n'a été faite.

- Protection des mots de passe compromis désactivée dans Supabase Auth. À examiner et activer après validation du parcours de connexion et de récupération.

Liens de remédiation Supabase :
- [RLS activé sans policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Fonctions SECURITY DEFINER accessibles aux utilisateurs connectés](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Protection contre les mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

### Performance

- 26 clés étrangères signalées sans index couvrant.
- 8 cas de policies permissives multiples pour un même rôle/action.
- Plusieurs index déclarés inutilisés au moment de l'analyse.

Ces éléments concernent le socle existant. Ils doivent être triés selon les requêtes réelles et le risque de régression ; ne pas supprimer automatiquement des index.

Liens :
- [Clés étrangères non indexées](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [Policies permissives multiples](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)

### Stockage Supabase

Buckets observés, tous privés : `case-documents`, `language-media`, `language-recordings`. Des policies existent déjà pour les documents immigration, médias linguistiques et enregistrements vocaux. Les futurs fichiers Academy devront utiliser un bucket privé ou des chemins cloisonnés avec policies dédiées ; ne pas réutiliser un bucket existant sans vérifier les règles de propriété, les limites de taille, les types MIME et la rétention.

### Santé du projet

- Aucun avertissement de santé signalé lors de cette lecture.

## 4. Décisions immédiates

1. Aucune table Academy n'a été créée pendant cet audit.
2. Aucune policy, fonction, trigger, bucket ou réglage Auth n'a été modifié.
3. La prochaine étape technique est un inventaire précis des policies, fonctions, triggers, Storage, Edge Functions, secrets/configuration et appels frontend concernés.
4. Avant tout changement de schéma : sauvegarde vérifiée, plan de retour arrière, migrations incrémentales, tests RLS multi-rôles et test de non-régression des dossiers immigration et modules TEF/TCF.
5. Les nouveaux modules Academy doivent être cloisonnés, avec RLS activé dès leur création.

## 5. Limites de cet audit

Cet audit est un état de référence ciblé. Il ne constitue pas un audit complet de sécurité, ne prouve pas qu'une vulnérabilité a été exploitée et ne valide pas encore les parcours de l'application dans un navigateur. Les résultats des conseillers peuvent évoluer avec les changements de schéma et de configuration.
