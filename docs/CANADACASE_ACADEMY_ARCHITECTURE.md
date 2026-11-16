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

Depuis le 30 octobre 2026, les nouvelles tables publiques ne reçoivent plus automatiquement les droits d'accès Data API. Les GRANT sont donc explicites dans les migrations.
- Les trois tables Academy ont RLS activé.
- Les droits par défaut de `anon` et `authenticated` ont été révoqués puis remplacés par des privilèges minimaux.
- Aucun accès table n'est accordé à `anon`.
- Les RPC sont exécutables par `authenticated` uniquement ; les contrôles d'identité et de rôle sont dans les fonctions.
- Les privilèges SQL ont été vérifiés. Les appels REST/RPC depuis un navigateur authentifié réel restent à tester.

## 6. Stratégie de déploiement

1. Conserver la branche GitHub `academy/specification-v1` comme espace de travail.
2. La fondation Phase 1 est installée sur le projet Supabase Free existant ; aucune branche de développement payante n'a été créée.
3. Les tests SQL/RLS/RPC ont été exécutés dans des transactions annulées sur les tables installées. Cette méthode réduit le risque mais ne remplace pas un staging indépendant.
4. Les fichiers de l'interface initiale sont dans la branche GitHub ; exécuter les tests navigateur authentifiés avant de fusionner.
5. Vérifier la non-régression du portail immigration et TEF/TCF.
6. Déployer uniquement après revue de la PR et validation du parcours réel.
7. Ne pas activer de services payants ; conserver les modules payants désactivés tant qu'une alternative gratuite fiable n'existe pas.

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

## 8. Phase 2 — catalogue et bibliothèque

La Phase 2 est installée dans le projet Supabase Free existant : six tables `academy_domains`, `academy_programs`, `academy_courses`, `academy_course_modules`, `academy_lessons` et `academy_resources`. Six domaines initiaux et deux programmes TEF Canada/TCF Canada sont créés. Les 51 leçons et 70 exercices linguistiques existants sont réutilisés sans duplication.

L'interface `academy-catalog.html` permet de parcourir le catalogue, consulter les modules/leçons, proposer des cours et contribuer à la bibliothèque par liens HTTPS. Les formateurs agréés peuvent créer des brouillons et les soumettre ; seule l'administration peut publier. Les droits des ressources sont identifiés avant publication. Le téléversement de fichiers est différé : aucun bucket Storage n'est créé avant les règles d'accès et de rétention dédiées.

Les six tables ont RLS et des privilèges Data API explicites : aucun accès `anon`, accès `authenticated` filtré par les politiques. Les tests transactionnels ont validé la création de brouillons, l'isolation entre formateurs, la publication réservée à l'administration et la visibilité des cours/ressources publiés. Les tests ont été annulés et aucune ligne de test n'est conservée.

Limites : le navigateur réel, les appels HTTP authentifiés, la non-régression et le déploiement Cloudflare restent à effectuer. La PR est ouverte en brouillon, non fusionnée.

## 9. Validation gratuite et limites actuelles

La fondation Phase 1 est installée : trois tables Academy, 9 politiques RLS, index, droits SQL minimaux et deux RPC contrôlées. Des tests transactionnels ont confirmé l'isolation entre deux candidats, le rôle apprenant, la soumission, le refus de l'auto-attribution et de l'auto-approbation, l'approbation administrative, les transitions, la suspension/réactivation et la journalisation. Les tests ont été annulés ; aucune ligne de test n'est conservée.

Les privilèges Data API ont été vérifiés en SQL : aucun accès anon, pas d'UPDATE global pour authenticated, colonnes sensibles protégées. Les fichiers `academy.html`, `assets/academy.js` et les liens de navigation sont ajoutés à la branche. Les contrôles syntaxiques JavaScript sont réussis.

Limites restantes : pas de test navigateur réel, pas de test HTTP avec session authentifiée, pas de déploiement Cloudflare, pas de test complet de non-régression. Le projet n'a pas d'environnement de staging indépendant gratuit disponible pour l'instant.

## 10. Conditions bloquantes avant la mise en service de l'interface

- Test navigateur authentifié réel sur un compte candidat et un compte administrateur.
- Vérification de l'accès Data API depuis le navigateur et des erreurs de permissions.
- Test de non-régression du portail immigration, des dossiers, des documents et des modules TEF/TCF.
- Validation du stockage privé des diplômes et pièces des formateurs avant collecte de documents.
- Vérification juridique des mineurs, données personnelles, remboursements et contrats avant activation des modules concernés.
- Aucun fournisseur payant ne doit être activé sans alternative gratuite ou accord budgétaire explicite.
- Aucune clé secrète dans le dépôt GitHub ni dans le navigateur.

## 11. Critères d'acceptation de la phase 1

État : fondation SQL, contrôle d'accès et interface initiale réalisés ; tests de navigateur et intégration HTTP restent à faire.

- Un candidat CanadaCase existant se connecte avec son compte habituel.
- Il peut activer un profil apprenant sans créer un nouveau compte.
- Un utilisateur A ne peut ni lire ni modifier le profil Academy de B.
- Un utilisateur ne peut pas s'attribuer le rôle formateur ou administrateur.
- Un candidat formateur peut déposer une candidature, mais ne peut pas s'approuver.
- Seul un administrateur autorisé peut décider d'une candidature via une action serveur.
- Les fonctions existantes immigration et TEF/TCF restent opérationnelles.


## Phase 3 — apprentissage et évaluation

La phase 3 ajoute les inscriptions aux cours, le suivi des leçons, les quiz à correction serveur, les devoirs écrits ou par URL HTTPS et les corrections humaines. Les tables sont `academy_enrollments`, `academy_lesson_progress`, `academy_assignments`, `academy_submissions`, `academy_lesson_questions`, `academy_quiz_attempts` et la table privée `private.academy_lesson_answer_keys`.

La correction QCM ne révèle pas les bonnes réponses au navigateur : les clés résident dans le schéma privé et la fonction RPC de correction vérifie l'identité active, l'inscription, le statut publié et le type de leçon. Le rôle authenticated ne peut pas lire la table privée ni écrire directement les tentatives de quiz. Le formateur propriétaire corrige les devoirs ; l'apprenant ne peut pas s'attribuer de note. La demande de reprise autorise un nouveau dépôt et efface l'ancien état de correction.

L'interface du catalogue comporte l'inscription gratuite, le suivi de progression, les quiz, la création/publication des devoirs et la correction. Les dépôts de fichiers/audio sont différés jusqu'à la mise en place d'un stockage privé et de politiques testées.

Tests transactionnels avec `ROLLBACK` réussis ; aucune donnée de test persistée. Le test navigateur réel, les appels HTTP authentifiés et le déploiement restent à faire. Le rapport détaillé est dans `docs/CANADACASE_ACADEMY_PHASE3_LEARNING_REPORT.md`.


## Phase 4 — tableaux de bord et planification

La page `academy-dashboard.html` présente des vues distinctes apprenant, formateur et administrateur. Le tableau apprenant agrège inscriptions, progression par leçon, tentatives de quiz, devoirs, objectifs et planning. Le tableau formateur agrège ses cours, inscriptions et corrections en attente. L'administration dispose d'une synthèse et de liens vers ses outils de gestion.

Les objectifs et séances personnelles sont stockés dans `academy_learning_goals` et `academy_study_events`. Les séances peuvent être associées à un objectif, sont limitées à leur propriétaire, et leurs intervalles sont contrôlés en base. Le planning ne remplace pas encore le calendrier de réservation des cours en direct (phase 5). Le temps d'étude déclaré par l'apprenant est indicatif et ne constitue pas une preuve de présence.

## 11. Phase 5 — calendrier et réservations

La phase 5 ajoute `academy_live_sessions` et `academy_bookings`. Les formateurs agréés publient des créneaux ponctuels individuels, collectifs, ateliers et examens blancs. Les apprenants réservent une place immédiatement, sous réserve de disponibilité. Le calendrier conserve le fuseau IANA du formateur et les horaires sont stockés en `timestamptz`.

La base, et non le navigateur, fait respecter la capacité, l'absence de chevauchement pour un même formateur, l'identité du réservataire, l'autorisation du formateur et les transitions de réservation. Le verrouillage de la ligne de séance sérialise les réservations d'un même créneau ; un verrou transactionnel par formateur protège la publication de créneaux concurrents. Le compteur de places est maintenu par trigger.

Les réservations conservent un instantané des informations de séance pour préserver l'historique même après annulation. Un formateur peut annuler une séance, la clôturer après son horaire et enregistrer présence/absence après la fin. Les deux tables sont protégées par RLS ; aucun accès `anon` n'est accordé et les fonctions de trigger résident dans le schéma privé avec exécution directe révoquée.

Limites : les créneaux sont ponctuels, sans répétition automatique. La visioconférence, les paiements, les remboursements, les notifications et les politiques commerciales complètes sont différés. La page est dans la branche de travail ; aucun test navigateur réel, déploiement Cloudflare ou fusion n'est revendiqué. Rapport : `docs/CANADACASE_ACADEMY_PHASE5_BOOKING_REPORT.md`.
