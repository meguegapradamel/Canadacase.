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
