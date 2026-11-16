# CanadaCase Academy — Phase 8 : examens blancs et certificats vérifiables

Date : 16 novembre 2026  
Branche : `academy/specification-v1`  
Projet Supabase : projet Free existant

## Statut

Fondation de la phase 8 appliquée au schéma Supabase et interface initiale ajoutée à la branche GitHub. Les tests SQL transactionnels et les contrôles de sécurité/performance ont été exécutés. Aucun test navigateur réel, aucune fusion de PR et aucun déploiement Cloudflare ne sont confirmés.

## Fonctionnalités

### Examens blancs autonomes
- Création d'un examen par l'administration : code unique, durée, seuil de réussite, nombre maximal de tentatives, accès libre ou accès conditionné par un droit d'examen.
- Questions QCM et réponses rédigées, barème par question, ordre, explications et grilles de critères.
- Les clés de réponses QCM et les réponses de référence restent dans le schéma privé et ne sont pas exposées au navigateur.
- Début d'examen contrôlé côté base ; une tentative ne peut être ouverte que pour un examen publié.
- Verrouillage de l'examen pendant le démarrage et numérotation atomique des tentatives pour limiter les dépassements du nombre autorisé.
- Les examens payants consomment un droit `mock_exam` dans la même transaction que la création de la tentative. Le mouvement est relié à l'identifiant de tentative dans `academy_entitlement_consumptions`.
- Durée maximale contrôlée côté serveur à la soumission. Les questions/réponses sont conservées pour audit.

### Correction
- QCM corrigés automatiquement côté serveur, sans transmettre les clés de réponses.
- Les réponses rédigées sont marquées `awaiting_review` et présentent la grille de critères au correcteur.
- L'administration attribue les notes par réponse et un retour pédagogique ; les notes ne peuvent dépasser le barème.
- Le résultat final est recalculé côté serveur. Le candidat ne peut ni s'attribuer une note, ni modifier une correction.
- La correction générative par IA n'est pas activée : aucun fournisseur de modèle gratuit, illimité et fiable n'a été validé. Le dispositif actuel est une correction automatique des QCM et une correction humaine assistée par grilles, explicitement identifiée comme telle.

### Certificats
- Un certificat est généré automatiquement lorsqu'une tentative est entièrement corrigée et que le seuil de réussite est atteint.
- Code de vérification unique, nom et titre figés au moment de l'émission, score, pourcentage et date d'émission.
- RPC publique de vérification ne renvoyant que les informations nécessaires à l'authentification du certificat.
- Les certificats peuvent être révoqués par une action administrative à ajouter dans une prochaine tranche ; la colonne de révocation est déjà prévue.
- Les certificats actuels attestent la réussite d'un examen blanc CanadaCase Academy ; ils ne sont pas des diplômes officiels ni des attestations émises par TEF Canada ou TCF Canada.

## Tables et RPC

Tables :
- `academy_mock_exams`
- `academy_mock_exam_questions`
- `private.academy_mock_exam_answer_keys`
- `academy_mock_exam_attempts`
- `academy_mock_exam_responses`
- `academy_certificates`

Évolution de `academy_entitlement_consumptions` : ajout de `attempt_id` et du type de consommation `mock_exam`, avec contrainte de source exclusive et index FK.

RPC :
- `academy_start_mock_exam`
- `academy_submit_mock_exam`
- `academy_admin_save_exam_question`
- `academy_admin_grade_mock_exam`
- `academy_verify_certificate`

Les implémentations sensibles sont dans le schéma privé avec `SECURITY DEFINER`, `search_path` vide, vérification d'identité/administrateur et privilèges d'exécution limités. Les fonctions exposées sont des wrappers `SECURITY INVOKER`. Les tables publiques sont protégées par RLS ; aucun accès `anon` n'est accordé aux tentatives, réponses, examens privés ou certificats. La vérification de certificat est la seule fonction publique anonyme et renvoie un objet limité.

## Migrations appliquées

- `academy_phase8_exams_certificates_foundation_20261116`
- `academy_phase8_manual_review_certificates_20261116`
- `academy_phase8_review_scoring_fix_20261116`
- `academy_phase8_review_alias_fix_20261116`
- `academy_phase8_exam_authoring_rpc_20261116`
- `academy_phase8_exam_entitlement_consumption_20261116`
- `academy_phase8_advisor_tuning_20261116`

## Tests

Tests SQL transactionnels avec `ROLLBACK` :
- Tentative libre démarrée et soumise.
- QCM corrigé automatiquement.
- Réponse rédigée mise en attente.
- Correction administrateur avec note et retour.
- Certificat créé à la réussite et code vérifié par la RPC publique.
- Examen payant : droit `mock_exam` consommé et journal lié à la tentative.
- Aucun droit d'accès direct aux clés de réponses.
- Les données de test, rôles temporaires, offres, commandes, droits et certificats ont été annulés.

Contrôles Supabase après ajustements :
- Health Advisor : aucun avertissement.
- Security Advisor : aucun nouveau signalement sur les objets de la phase 8. Les alertes restantes concernent des fonctions historiques préexistantes, des tables historiques et la protection contre les mots de passe compromis désactivée.
- Performance Advisor : les nouvelles clés étrangères de la phase 8 ont des index. Les avertissements d'index non utilisés sont attendus sur des tables neuves sans données ; les clés étrangères non indexées restantes sont historiques. Les avertissements de politiques multiples restantes concernent des tables préexistantes.

## Interface

- Nouvelle page `academy-exams.html`.
- Nouveau script `assets/academy-exams.js`.
- Nouvelle feuille de style `assets/academy-exams.css`.
- Lien ajouté dans la navigation Academy.
- Interface apprenant : liste des examens, démarrage, réponses, résultats et certificats.
- Interface administrateur : création d'examens, ajout de questions, publication et correction des copies rédigées.
- Vérification publique d'un certificat par son code.

## Limites restantes

- Pas encore de chronomètre visuel côté navigateur ; la durée reste vérifiée par le serveur.
- Pas de véritable correction générative par IA ; l'intégration est différée pour respecter le budget zéro.
- Pas de bouton d'administration pour révoquer un certificat, même si le champ et la réponse de vérification prennent déjà en charge le statut révoqué.
- Pas encore de certificat de fin de formation.
- Les contenus d'examen ne sont pas préchargés : l'administration doit créer et valider les sujets avant publication.
- Pas de test navigateur authentifié réel, pas de test multi-appareils, pas de fusion de PR et pas de déploiement.

## Budget et sécurité

- Dépense supplémentaire : 0 FCFA.
- Aucun fournisseur IA, SMS, stockage payant ou passerelle de paiement activé.
- Aucun secret `service_role` ajouté au navigateur ou au dépôt.
- Orange Money et MTN MoMo restent soumis à la configuration marchande préalable déjà documentée.
