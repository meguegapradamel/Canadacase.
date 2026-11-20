# CanadaCase Academy — état réel de l'architecture
Date de vérification : 20 novembre 2026

Ce document décrit l'état constaté dans le dépôt GitHub `main` et dans le projet Supabase `qxaykieolvbzaxmfaack`. Il distingue les éléments présents dans le code ou la base des fonctions dont le fonctionnement en navigateur ou en production n'a pas encore été vérifié. La trajectoire d'évolution et les frontières fonctionnelles recommandées sont détaillées dans `docs/CANADACASE_ACADEMY_ARCHITECTURE_REVIEW_20261120.md` (version 1.2).

## 1. Architecture en place

- **Frontend** : application web statique HTML, CSS et JavaScript, organisée en pages et modules dédiés.
- **Identité** : authentification Supabase partagée avec le portail CanadaCase.
- **Données** : PostgreSQL Supabase, tables Academy préfixées `academy_` et tables historiques de préparation linguistique `language_*`.
- **Sécurité** : RLS activé sur les tables publiques contrôlées lors de l'audit ; les clés de correction des QCM résident dans le schéma privé.
- **Fonctions sensibles** : RPC et Edge Functions pour les opérations nécessitant un contrôle serveur.
- **Déploiement** : configuration Wrangler et workflows GitHub Actions présents. Un contrôle de validation réussi ne signifie pas que le Worker a été publié.

## 2. Modules présents

| Domaine | Pages / modules |
|---|---|
| Accueil Academy | `academy.html`, `assets/academy.js` |
| Catalogue et cours | `academy-catalog.html`, `assets/academy-catalog.js` |
| Progression | `academy-dashboard.html`, `assets/academy-dashboard.js` |
| Séances et réservations | `academy-bookings.html`, `assets/academy-bookings.js` |
| Paiements et tarifs | `academy-payments.html`, `assets/academy-payments.js` |
| Examens et certificats | `academy-exams.html`, `assets/academy-exams.js` |
| Coach IA | `academy-coach.html`, `assets/academy-coach.js` |

Les rôles apprenant et formateur sont séparés des rôles historiques du portail. Le refus d'une candidature formateur ne doit pas désactiver le compte apprenant.

## 3. Données vérifiées le 20 novembre 2026

Comptages SQL en lecture seule :

- `language_courses` : 55 lignes publiées.
- `language_exercises` : 98 lignes publiées.
- `academy_resources` : 5 ressources publiées (bibliothèque générale).
- `academy_mock_exams` : 2 examens publiés.
- `academy_mock_exam_questions` : 168 questions, soit 84 pour chaque examen complet.

Examens publiés :
- `TCFCA-FULL-01` : 84 questions, provenance `original`, type TCF Canada.
- `TEFCA-FULL-01` : 84 questions, provenance `original`, type TEF Canada.

Ces deux simulations ne sont pas des sujets historiques : leur année et leur date de session restent volontairement non renseignées. Aucun examen réel de 2025 ou 2026 n'est inventé.

## 4. Archives par année et session

La table `academy_mock_exams` possède les champs `exam_type`, `exam_year`, `session_month`, `session_label`, `session_date`, `provenance_type`, `source_name`, `source_url` et `provenance_note`.

La contrainte SQL interdit de déclarer un sujet `historical_verified` sans nom de source et URL HTTPS. La page Examens propose désormais des filtres par type d'examen et année. Les années proposées dépendent exclusivement des examens effectivement classés dans la base.

## 5. Limites connues et actions requises

1. **Déploiement Cloudflare** : le workflow de déploiement échoue à l'étape de vérification des identifiants, car les secrets GitHub `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` ne sont pas disponibles. La publication n'est donc pas confirmée.
2. **Tests réels** : les parcours doivent encore être vérifiés avec des comptes authentifiés candidat, formateur et administrateur sur navigateur desktop et iPhone.
3. **Paiements** : les déclarations et validations manuelles sont prévues ; aucun fournisseur Mobile Money automatique n'est activé.
4. **Contenus historiques** : aucune archive de sessions antérieures n'est à publier sans preuve documentaire fiable.
5. **Sécurité Auth et clés de correction** : l'advisor Supabase signale que la protection contre les mots de passe compromis est désactivée. Le réglage dépend de l'offre Supabase disponible. L'advisor signale aussi que `private.academy_mock_exam_answer_keys` a RLS désactivé ; la vérification SQL du 20 novembre constate toutefois zéro privilège direct `anon`/`authenticated` sur cette table privée (seul `postgres` détient des privilèges). Ce point reste une défense en profondeur à traiter après revue des accès RPC ; aucune activation automatique de RLS n'a été faite.
6. **Droits d'examen** : vérification du code SQL effectuée. `academy_start_mock_exam` contrôle les droits actifs, leur période de validité et les unités restantes, verrouille le droit sélectionné, crée la tentative et enregistre la consommation dans la même transaction. Les examens payants disposent donc d'un contrôle serveur de consommation. Il reste à tester le parcours complet avec un droit de test et à vérifier la procédure de remboursement/restauration en cas d'incident.
7. **Règle d'accès aux ressources** : correction appliquée le 20 novembre 2026 à `academy_resources_read`. Les contrôles d'offres et d'inscriptions comparent maintenant l'identifiant du cours concerné par la ressource (directement ou via sa leçon), et non l'identifiant de la ligne d'offre/inscription elle-même. Test transactionnel en contexte `authenticated` réussi : les 5 ressources générales publiées restent visibles ; aucune donnée n'a été modifiée pendant ce test.
8. **Visioconférence, notifications et hors ligne** : ces fonctions ne sont pas à considérer comme livrées tant qu'elles n'ont pas fait l'objet d'une implémentation et d'un test dédiés.

## 6. Ordre recommandé des prochaines phases

- **A — Fiabilisation** : tests d'intégration navigateur, contrôle des permissions et non-régression du portail immigration.
- **B — Bibliothèque historique** : import des sujets documentés, classement année/session/compétence, provenance et source.
- **C — Moteur pédagogique commun** : relier exercices, examens blancs, corrections, progression et Coach IA sans dupliquer les règles métier.
- **D — Accès payants** : tester le débit atomique des droits, puis définir et vérifier la procédure d'annulation/restauration en cas d'échec technique.
- **E — Lancement** : déploiement Cloudflare confirmé, contrôle mobile, sauvegarde et procédure de support.

## 7. Règle de livraison

Un fichier commité ou un contrôle CI réussi ne prouve pas à lui seul qu'une fonction marche en production. Chaque fonctionnalité doit être vérifiée à trois niveaux : code, données/permissions Supabase, puis parcours utilisateur réel. Toute fonction non testée en environnement réel reste explicitement marquée « à vérifier ».

## 8. Durcissement sécurité du 20 novembre 2026

Deux migrations ont été appliquées au projet Supabase de production :

- `20261120152845_canadacase_security_hardening_phase_1` : les fonctions RLS `is_case_admin`, `is_case_staff`, `can_access_case` et `can_access_candidate` vérifient désormais l'activité du compte connecté ; l'accès agent tient compte de l'état actif du profil agent et du candidat. La lecture des documents par leur propriétaire exige aussi un compte actif. La table privée des clés de réponses a RLS activé.
- `20261120152915_academy_mock_exam_review_access` : ajout de `response_mode` pour distinguer les tâches orales des tâches écrites sans exposer la grille ; création d'un RPC de récupération des grilles réservé à l'administrateur ou au formateur affecté, uniquement après soumission ; politique de refus explicite sur la table privée des clés.

Le frontend Academy Examens a été adapté : le candidat récupère désormais `response_mode` et non la grille ; l'écran de correction passe par le RPC autorisé. Le fichier JS est servi avec un nouveau paramètre de cache. Les migrations sont enregistrées dans `supabase/migrations/`.

### Points volontairement non activés

La restriction finale des privilèges de lecture sur les colonnes `rubric` et `explanation` de `academy_mock_exam_questions` est différée jusqu'à ce que le nouveau frontend soit effectivement déployé et vérifié. Cette précaution évite de casser la version actuellement servie si Cloudflare ne publie pas encore les derniers commits. Le déploiement Cloudflare reste bloqué tant que les secrets GitHub Actions `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` ne sont pas configurés.

La protection Auth contre les mots de passe compromis reste également à activer dans les paramètres Supabase Auth ; elle n'est pas modifiable par les migrations SQL utilisées ici.

Aucun test réel sur appareil mobile, aucun parcours complet de correction formateur et aucun déploiement de production n'est déclaré comme effectué à cette étape.


### Consolidation RLS Immigration — 20 novembre 2026

La migration `20261120153123_consolidate_immigration_rls_policies` regroupe les huit couples de politiques permissives qui faisaient l'objet d'une alerte de performance. Les accès ont été conservés par rôle : candidat, agent affecté et administrateur ; les écritures sur les affectations restent réservées à l'administrateur. Vérification après migration : 0 couple rôle/action dupliqué sur les tables publiques, 72 tables publiques avec RLS activé sur 72.

La table `private.academy_mock_exam_answer_keys` a RLS activé, une politique de refus explicite pour les rôles API et aucun privilège direct SELECT pour `anon` ou `authenticated`. Les questions actuelles sont réparties en 5 tâches orales et 163 tâches écrites selon `response_mode`.

Les avis Supabase après ces migrations ne signalent plus d'alerte de politiques multiples ni d'alerte de fonction SECURITY DEFINER publique. L'unique avertissement de sécurité restant est la protection contre les mots de passe compromis désactivée.
