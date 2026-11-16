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
- Les privilèges Data API ont été explicitement définis sur les nouvelles tables et RPC : accès `authenticated` minimal, aucun accès `anon`. Les appels HTTP depuis un navigateur réel restent à valider.

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
- La fondation additive Phase 1 est installée. Aucune table historique, fonction historique ou donnée métier existante n'a été modifiée. L'interface initiale est dans la branche GitHub ; son fonctionnement réel dans un navigateur reste à valider. Les privilèges Data API sont configurés mais le test HTTP réel n'a pas pu être effectué depuis l'environnement courant.

## Budget et environnement
L'organisation Supabase est sur le forfait Free. Une branche de développement avait été chiffrée à 0,01344 USD/heure ; elle n'a pas été créée. Aucun coût supplémentaire n'a été engagé. Les tests ont utilisé des transactions annulées sur les tables installées ; ils ne remplacent pas un staging indépendant. La politique budget zéro interdit tout service ou dépassement payant.

## Tests obligatoires avant la première mise en production
- [x] Apprenant A ne lit pas le profil Academy de B (test transactionnel).
- [x] Apprenant ne peut pas s'attribuer le rôle formateur (test transactionnel).
- [x] Candidat formateur ne peut ni changer le statut de sa candidature ni s'approuver (tests SQL/RPC).
- [x] Administrateur actif peut approuver/suspendre/réactiver via la RPC ; les transitions et le journal ont été testés transactionnellement.
- [ ] Parcours complet depuis le navigateur réel et test HTTP authentifié.
- Les fonctions historiques de dossiers et documents continuent de fonctionner.
- Les parcours TEF/TCF, cours, exercices et tentatives restent accessibles.
- [x] Les nouvelles tables n'accordent aucun accès à `anon` et sont protégées par RLS ; les droits `authenticated` sont limités.
- [x] Supabase Advisors relancés après migration et consolidation.


## Phase 2 — catalogue et bibliothèque (16 novembre 2026)

Six tables supplémentaires ont été créées avec RLS : `academy_domains`, `academy_programs`, `academy_courses`, `academy_course_modules`, `academy_lessons` et `academy_resources`. Chacune a quatre politiques RLS adaptées à son rôle. Aucun accès `anon` n'est accordé ; `authenticated` dispose des droits SQL nécessaires, mais les lignes sont filtrées par RLS. Les formateurs peuvent gérer leurs brouillons ; une fois soumis, le cours est verrouillé jusqu'à une demande de correction. Seule l'administration peut publier cours et ressources.

Les tests transactionnels ont vérifié création de brouillons, isolation entre formateurs, interdiction de publication autonome, visibilité après publication et verrouillage pendant la revue. Tous les tests ont été annulés. Aucun cours, module, leçon ou ressource de test n'est conservé.

Supabase Advisors après Phase 2 : aucun avertissement de santé ; aucune alerte de politiques multiples sur les tables Academy ; les alertes restantes concernent les tables historiques et les fonctions SECURITY DEFINER déjà auditées en Phase 1. Les index Academy non encore sollicités ne sont pas supprimés prématurément.

La bibliothèque Phase 2 n'accepte que des liens HTTPS et des métadonnées de droits. Aucun bucket de fichiers n'a été créé ; l'upload attend une politique Storage privée et testée. Le test navigateur réel, les tests HTTP authentifiés et le déploiement restent à faire.


### Intégrité de publication Phase 2
- Un trigger PostgreSQL `SECURITY INVOKER` empêche de publier un cours sans au moins un module et une leçon ; la base complète `published_at` si nécessaire.
- Une contrainte empêche de publier une ressource sous licence ou du domaine public sans URL de source ou note justificative.
- Tests transactionnels : publication d'un cours vide refusée ; publication après ajout d'un module et d'une leçon acceptée ; ressource sous licence sans justificatif refusée puis acceptée après ajout d'une note. Tous les tests sont annulés.
