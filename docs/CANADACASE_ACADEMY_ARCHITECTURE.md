# CanadaCase Academy — Architecture cible et stratégie de livraison
Version 1.0 — 16 novembre 2026
Statut : conception technique initiale — aucune fonctionnalité Academy n'est encore activée en production.

## 1. Architecture retenue

- Conserver l'application CanadaCase actuelle, son URL, son authentification Supabase et ses dossiers d'immigration.
- Ajouter Academy comme un domaine fonctionnel séparé, dans la même identité d'authentification.
- Ne pas étendre la contrainte actuelle de `profiles.role` (candidate, agent, admin) pour y mettre tous les rôles Academy.
- Stocker les profils et autorisations Academy dans des tables dédiées préfixées `academy_`.
- Utiliser des Edge Functions pour les actions sensibles : approbation des formateurs, attribution des rôles privilégiés, paiements, commissions, remboursements, certificats, modération et actions administratives.
- Le navigateur n'est jamais source d'autorité pour un rôle, un paiement, un solde, une note officielle ou une certification.
- Utiliser la clé publique côté navigateur uniquement ; la clé service_role/secret reste côté serveur.

## 2. Identité et rôles

L'identité reste `auth.users.id`, reliée à `public.profiles.id`.
Un même compte peut cumuler :
- candidat CanadaCase (rôle historique conservé dans `profiles`) ;
- apprenant Academy ;
- formateur après validation ;
- membre d'une organisation ;
- partenaire institutionnel.

Les rôles Academy sont attribués séparément. Un utilisateur peut s'inscrire lui-même comme apprenant. Il ne peut jamais s'attribuer un rôle formateur, administrateur, partenaire ou responsable d'entreprise.

Les administrateurs existants sont reconnus à partir du rôle administrateur déjà validé dans `public.profiles`. Les sous-rôles administratifs Academy seront attribués ultérieurement par un flux serveur audité.

## 3. Première tranche de données

### `academy_profiles`
Profil d'apprentissage complémentaire : nom d'affichage, langue de l'interface, pays, fuseau horaire, objectifs. Une ligne maximum par compte.

### `academy_user_roles`
Table d'affectation multi-rôles. L'insertion autonome est limitée au rôle `learner`. Les rôles formateur, organisation et partenaire nécessitent une validation administrative côté serveur.

### `academy_trainer_applications`
Candidature formateur et workflow de validation. L'utilisateur peut créer et modifier les champs de sa candidature tant qu'elle est en brouillon ou que des compléments sont demandés. Il ne peut pas modifier son statut, sa date de décision ou l'identité du décideur.

Les documents d'identité et diplômes seront stockés dans un bucket privé dédié, avec accès contrôlé et liens temporaires. Ils ne seront jamais stockés dans des colonnes publiques ou des URL permanentes.

## 4. Sécurité et accès

- RLS activé sur chaque table Academy.
- Privilèges SQL limités au strict nécessaire, y compris des droits par colonne.
- Les politiques vérifient l'identité propriétaire et l'état actif du compte.
- Les droits administratifs reposent sur le rôle administrateur existant, jamais sur `user_metadata`.
- Les décisions privilégiées sont exécutées côté serveur et journalisées.
- Aucune politique permissive générique ne sera ajoutée aux tables historiques.
- Aucune modification de `profiles.role`, des politiques immigration, des buckets existants ou des fonctions historiques n'est requise pour la première tranche.

## 5. Exposition API Supabase

Depuis le changement Supabase annoncé en avril 2026 et appliqué aux projets existants à partir du 30 octobre 2026, une nouvelle table publique n'est plus automatiquement exposée à la Data API.
Avant toute intégration front-end :
1. vérifier la configuration Data API du projet ;
2. exposer explicitement uniquement les tables nécessaires ;
3. conserver RLS activé ;
4. vérifier les GRANT et les politiques avec les rôles `anon` et `authenticated` ;
5. tester avec deux comptes distincts pour prouver l'isolation.

Si la configuration Data API ne peut pas être vérifiée, ne pas connecter les tables au navigateur ; utiliser temporairement des Edge Functions autorisées.

## 6. Stratégie de déploiement

1. Conserver la branche GitHub `academy/specification-v1` comme espace de travail.
2. Pour le contrôle initial sans frais, exécuter uniquement des tests transactionnels éphémères dans un schéma isolé, avec ROLLBACK systématique et vérification de son absence après test. Cette méthode valide la syntaxe et quelques règles RLS, mais ne remplace pas un environnement indépendant.
3. N'appliquer la migration fondatrice persistante qu'après obtention d'un environnement de test gratuit réellement isolé ; ne jamais transformer le projet de production en environnement de développement.
4. Exécuter les tests RLS avec au minimum un apprenant A, un apprenant B et un administrateur.
5. Vérifier les politiques avec Supabase Advisors.
6. Revoir les différences de schéma et les droits avant de proposer une migration production.
7. Intégrer les écrans Academy par étapes derrière un accès/feature flag.
8. Déployer puis tester le portail immigration, TEF/TCF et Academy.
9. Ne fusionner et ne déclarer la livraison qu'après validation.

## 7. Ordre de construction

- Phase 0 : audit, spécification, architecture et environnement de test.
- Phase 1 : profils, rôles apprenant et candidatures formateurs.
- Phase 2 : catalogue administrable et ressources.
- Phase 3 : cours, leçons, exercices, devoirs et évaluations.
- Phase 4 : parcours et tableaux de bord apprenant/formateur.
- Phase 5 : calendrier, réservations et visioconférence.
- Phase 6 : paiements, commissions, abonnements et forfaits.
- Phase 7 : IA, examens blancs et certificats.
- Phase 8 : communauté, support, partenaires et entreprises.
- Phase 9 : PWA/hors ligne, accessibilité, sécurité et lancement.

## 8. Validation gratuite et limites actuelles

Le premier dry-run SQL a été exécuté dans une transaction annulée sur le projet existant. La syntaxe des trois tables, index, politiques et GRANT a été acceptée. Les tests ont confirmé l'isolation des profils, l'inscription apprenant, la création d'une candidature en brouillon et le refus de l'auto-attribution du rôle formateur ou de la modification autonome du statut. Le schéma temporaire et les données de test ont été annulés puis leur absence a été vérifiée.

Ce contrôle transactionnel n'est pas un environnement de staging indépendant. La fondation de données est installée, mais l'interface, l'accès navigateur/Data API, les tests de bout en bout et les parcours de documents formateurs restent à réaliser. Aucune table historique ni donnée métier existante n'a été modifiée.

## 9. Conditions bloquantes avant production

- Environnement de développement ou de test isolé.
- Confirmation des coûts éventuels avant création d'une branche Supabase payante.
- Validation des fournisseurs de paiement, visioconférence, SMS/WhatsApp et IA.
- Vérification juridique des mineurs, données personnelles, remboursements et contrats.
- Tests de sécurité/RLS et restauration de sauvegarde.
- Configuration Data API vérifiée.
- Aucune clé secrète dans le dépôt GitHub ni dans le navigateur.

## 10. Critères d'acceptation de la phase 1

État : fondation SQL et contrôle d'accès initial installés et testés ; interface et intégration navigateur non réalisées.

- Un candidat CanadaCase existant se connecte avec son compte habituel.
- Il peut activer un profil apprenant sans créer un nouveau compte.
- Un utilisateur A ne peut ni lire ni modifier le profil Academy de B.
- Un utilisateur ne peut pas s'attribuer le rôle formateur ou administrateur.
- Un candidat formateur peut déposer une candidature, mais ne peut pas s'approuver.
- Seul un administrateur autorisé peut décider d'une candidature via une action serveur.
- Les fonctions existantes immigration et TEF/TCF restent opérationnelles.
