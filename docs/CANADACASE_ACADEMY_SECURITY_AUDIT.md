# CanadaCase Academy — audit sécurité et risques de départ
Date : 16 novembre 2026
Projet Supabase : CanadaCase (`qxaykieolvbzaxmfaack`)
Statut : fondation Academy Phase 1 installée ; contrôles RLS/RPC transactionnels réussis. Aucun changement aux tables historiques.

## État technique
- Projet : `ACTIVE_HEALTHY`.
- PostgreSQL : 17.11.
- Tables Academy : `academy_profiles`, `academy_user_roles`, `academy_trainer_applications` créées par migration `academy_phase1_foundation_20261116`.
- `profiles.role` est limité par contrainte à `candidate`, `agent`, `admin`.
- Les tables historiques de dossiers et les tables de préparation linguistique sont déjà présentes.
- Les nouvelles tables publiques devront être explicitement exposées à la Data API selon le changement Supabase d'octobre 2026 ; cette configuration n'a pas encore été vérifiée.

## Résultats Supabase Advisors

### Sécurité
1. 9 tables ont RLS activé sans aucune politique : les lignes sont alors inaccessibles par les rôles API concernés tant qu'aucune politique n'est ajoutée. Il ne faut pas leur ajouter une politique permissive sans vérifier l'usage métier et les données.
2. Après l'installation de la fondation Academy, 5 fonctions SECURITY DEFINER exposées aux utilisateurs authentifiés déclenchent un avertissement :
   - `public.admin_set_case_status(uuid,text)`
   - `public.admin_set_case_status_for_case(uuid,text)`
   - `public.admin_set_document_status(uuid,text,text)`
   - `public.academy_submit_trainer_application(uuid)`
   - `public.academy_review_trainer_application(uuid,text,text)`
3. Le code des trois fonctions historiques vérifié contient un contrôle `private.is_case_admin()` avant toute opération, un `search_path` vide et une journalisation des actions. La fonction privée vérifie `auth.uid()`, `profiles.role='admin'` et le compte actif. L'accès `anon` est refusé ; l'exécution authentifiée est autorisée pour permettre aux administrateurs connectés d'utiliser ces actions. Aucune modification n'est recommandée sans tests fonctionnels et de non-régression.
4. Les droits par défaut de Supabase sur les nouveaux objets publics accordaient des privilèges trop larges à `anon` et `authenticated`. Une migration corrective a révoqué ces privilèges sur les trois tables Academy, puis réaccordé les seuls droits nécessaires. Vérification SQL : `anon` ne peut lire aucune table Academy ; `authenticated` ne dispose pas d'UPDATE global ni de droit de modifier `user_id` ou `status`. Le rôle serveur `service_role` conserve ses privilèges serveur.
5. Les deux RPC Academy sont intentionnellement SECURITY DEFINER pour exécuter des transitions protégées malgré les privilèges restreints du navigateur. Elles ont un `search_path` vide, révoquent EXECUTE pour `public` et `anon`, et n'accordent EXECUTE qu'à `authenticated`. La soumission vérifie l'identité propriétaire, le compte actif, l'état de candidature et les champs requis. La décision vérifie `private.is_case_admin()`, interdit l'auto-examen, limite les transitions, attribue le rôle formateur uniquement après approbation et écrit dans `admin_action_log`. Tests transactionnels : candidat refusé, administrateur actif autorisé.
6. La protection Auth contre les mots de passe compromis est désactivée. À activer dans les paramètres Auth après évaluation des contraintes du plan et tests de connexion/réinitialisation.

### Performance après fondation Academy
- 26 clés étrangères sans index couvrant signalées ; les deux nouvelles clés étrangères `reviewed_by` et `granted_by` Academy sont indexées.
- 32 index non utilisés signalés, dont certains nouveaux index Academy encore non sollicités faute de données.
- 8 cas de politiques permissives multiples signalés, tous sur des tables historiques ; aucun sur les trois tables Academy après consolidation.
- Aucun avertissement de santé.
Ces éléments sont des avertissements de performance, pas une preuve de fuite de données. Ne pas supprimer ni ajouter en masse des index/politiques : vérifier les requêtes, volumes et usages avant toute correction.

### Santé
- Aucun avertissement de santé retourné au moment du contrôle.

## Mesures de protection retenues pour Academy
- Ne pas modifier `profiles.role`.
- Préfixer les nouvelles tables `academy_`.
- RLS activé sur les trois tables Academy avec 9 politiques consolidées (3 par table). Les droits par défaut `anon`/`authenticated` ont été révoqués puis réaccordés au minimum : aucun accès `anon`, pas d'UPDATE global pour `authenticated`, mises à jour limitées aux colonnes prévues.
- Le rôle apprenant peut être demandé par l'utilisateur ; les rôles formateur/entreprise/partenaire sont attribués par un flux serveur validé.
- La soumission et les décisions de candidature passent par des RPC contrôlées ; le navigateur ne peut pas attribuer lui-même le rôle formateur. Les paiements, remboursements, commissions et certificats ne sont jamais modifiables depuis le navigateur.
- Pas de clé service_role/secret dans GitHub ou le navigateur.
- La fondation additive Phase 1 est installée. Aucune table historique, fonction historique ou donnée métier existante n'a été modifiée. L'interface et l'exposition Data API restent bloquées jusqu'aux vérifications dédiées.

## Budget et environnement
L'organisation Supabase est sur le forfait Free. Une branche de développement avait été chiffrée à 0,01344 USD/heure ; elle n'a pas été créée. Aucun coût supplémentaire n'a été engagé. Les tests ont utilisé des transactions annulées sur les tables installées ; ils ne remplacent pas un staging indépendant. La politique budget zéro interdit tout service ou dépassement payant.

## Tests obligatoires avant la première mise en production
- Apprenant A ne lit/modifie aucune donnée privée de B.
- Apprenant ne peut pas s'attribuer le rôle formateur, admin, partenaire ou organisation.
- Candidat formateur ne peut ni changer le statut de sa candidature ni s'approuver.
- Administrateur actif peut examiner et traiter les candidatures via la RPC sécurisée ; l'approbation et le journal ont été testés transactionnellement.
- Les fonctions historiques de dossiers et documents continuent de fonctionner.
- Les parcours TEF/TCF, cours, exercices et tentatives restent accessibles.
- Les nouvelles tables sont exposées uniquement si nécessaire et protégées par RLS.
- Supabase Advisors sont relancés après migration.
