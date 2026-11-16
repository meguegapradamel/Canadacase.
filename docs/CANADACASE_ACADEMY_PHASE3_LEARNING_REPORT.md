# CanadaCase Academy — rapport Phase 3 : apprentissage, quiz et devoirs
Date : 16 novembre 2026

## Statut
Phase 3 installée dans le projet Supabase Free existant et intégrée à la branche GitHub `academy/specification-v1`. La PR #2 reste ouverte, non fusionnée. Aucun déploiement Cloudflare ni test navigateur réel n'est revendiqué.

## 1. Fonctions livrées
- Inscription gratuite d'un apprenant à un cours publié.
- Espace de cours avec modules, leçons et état de progression.
- Marquage d'une leçon comme terminée et conservation de la progression.
- Quiz QCM à 2–8 choix par question, avec correction exécutée côté serveur.
- Création de questions par le formateur propriétaire du cours en brouillon ou par l'administration.
- Devoirs de type réponse écrite ou lien HTTPS, avec échéance facultative et barème.
- Publication/dépublication des devoirs par le formateur propriétaire ou l'administration.
- Dépôt et reprise d'un devoir après demande de correction.
- Correction humaine par le formateur propriétaire : note, commentaire, validation ou demande de reprise.
- Affichage du résultat du quiz, de la note et des commentaires du formateur à l'apprenant.

## 2. Tables créées
- `academy_enrollments` : inscriptions aux cours.
- `academy_lesson_progress` : suivi des leçons.
- `academy_assignments` : devoirs.
- `academy_submissions` : réponses des apprenants et corrections.
- `academy_lesson_questions` : énoncés et choix des quiz.
- `private.academy_lesson_answer_keys` : réponses correctes et explications, dans le schéma privé.
- `academy_quiz_attempts` : résultats des tentatives.

## 3. Sécurité
- RLS activé sur les six tables publiques de cette phase.
- Aucun accès SELECT anonyme aux six tables.
- L'apprenant ne voit que ses inscriptions, sa progression, ses tentatives et ses devoirs ; le formateur voit les éléments liés à ses propres cours ; l'administration conserve ses droits de contrôle.
- La clé des bonnes réponses n'est pas lisible par le navigateur ni par le rôle authenticated.
- La correction QCM est exécutée par une fonction serveur contrôlée ; le navigateur ne peut ni écrire ni modifier directement les résultats des tentatives.
- Un apprenant ne peut pas s'attribuer une note ou se corriger lui-même.
- Le formateur peut noter, commenter ou demander une reprise ; l'apprenant peut ensuite redéposer une réponse.
- Les notes sont bornées par le barème du devoir.
- Les réponses de type URL doivent être en HTTPS.
- Les rôles, la propriété du cours et l'état de publication sont contrôlés côté base.

## 4. Tests transactionnels effectués
Résultats : tous les tests listés ci-dessous ont réussi. Les tests ont été exécutés dans des transactions terminées par `ROLLBACK`, sans conserver de compte, cours, inscription, question, devoir, réponse ou note de test.
- Création d'un quiz par un formateur et stockage de la clé correcte dans le schéma privé.
- Lecture directe de la clé de réponse refusée au rôle authenticated.
- Inscription d'un apprenant à un cours publié.
- Visibilité d'un devoir publié pour l'apprenant inscrit.
- Dépôt d'une réponse écrite.
- Tentative d'auto-correction par l'apprenant refusée.
- Correction par le formateur propriétaire acceptée.
- Demande de reprise, redépôt par l'apprenant, puis note finale acceptée.
- Correction automatique du quiz côté serveur.
- Tentatives de quiz non modifiables directement par le rôle authenticated.
- Indexation des nouvelles clés étrangères contrôlée.
- Comptages après tests : 0 inscription, 0 progression, 0 devoir, 0 soumission, 0 question et 0 tentative de quiz conservés.

## 5. Contrôle Supabase après phase 3
- Conseiller de santé : aucun avertissement.
- Les nouvelles clés étrangères Academy sont indexées ; les 26 alertes de clés étrangères non indexées restantes concernent les tables historiques du portail.
- Les alertes de politiques permissives multiples concernent les tables historiques.
- Les alertes SECURITY DEFINER incluent deux fonctions Academy nécessaires : l'une protège les clés et enregistre les questions, l'autre corrige les quiz sans révéler les clés. Leur exécution est réservée à authenticated, avec contrôles d'identité active, d'inscription, de propriétaire du cours et/ou d'administration. Les autres fonctions signalées sont les fonctions historiques déjà auditées.
- L'alerte RLS sans politique sur `private.academy_lesson_answer_keys` est attendue : schéma privé, aucun privilège de lecture pour authenticated ou anon, lecture réservée à la fonction de correction contrôlée.
- Les index non encore utilisés sont attendus au début du projet ; aucun index n'a été supprimé sur cette seule base.

## 6. Limites restantes
- Les dépôts de fichiers/audio ne sont pas activés : les réponses sont texte ou URL HTTPS. Le stockage privé sera ajouté après définition et tests de ses politiques.
- Pas encore de lecteur vidéo hébergé par la plateforme, de classe en direct, ni de correction vocale IA.
- Pas de test navigateur réel, de test HTTP authentifié via le site public, ni de déploiement Cloudflare.
- Les fonctions de progression sont en place, mais les tableaux de bord analytiques avancés et les certificats seront développés dans les phases ultérieures.

## 7. Budget
- Utilisation exclusive du projet Supabase Free existant et des fichiers statiques du dépôt GitHub.
- Aucun projet ou branche Supabase payant créé.
- Aucun service payant, stockage externe, vidéo, IA, paiement, SMS ou WhatsApp activé.
- Aucun coût supplémentaire engagé par cette phase.

## 8. Migrations Supabase
- `academy_phase3_learning_progress_assignments_quizzes_20261116`
- `academy_phase3_learning_security_guards_20261116`
- `academy_phase3_submission_revision_workflow_20261116`
- `academy_phase3_permissions_and_fk_indexes_20261116`
- `academy_phase3_submission_status_constraints_fix_v2_20261116`
- `academy_phase3_lock_quiz_authoring_after_publish_20261116`

La PR reste en brouillon jusqu'à la vérification sur navigateur et au contrôle de non-régression du portail CanadaCase.
