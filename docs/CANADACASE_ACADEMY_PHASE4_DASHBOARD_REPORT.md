# CanadaCase Academy — rapport Phase 4 : tableaux de bord et planification
Date : 16 novembre 2026

## Statut
Phase 4 ajoutée au projet Supabase Free existant et à la branche GitHub `academy/specification-v1`. La PR #2 reste ouverte, non fusionnée. Aucun déploiement Cloudflare ni test navigateur réel n'est revendiqué.

## 1. Tableau de bord apprenant
- Nombre de formations actives et terminées.
- Progression réelle par cours : le nombre de leçons terminées est comparé au nombre total de leçons du cours, et non uniquement aux leçons déjà ouvertes.
- Moyenne normalisée des tentatives de quiz et historique récent.
- Devoirs à remettre, en attente de correction, à reprendre ou corrigés.
- Objectifs personnels : type (général, examen, compétence, cours), échéance et temps hebdomadaire cible.
- Planning personnel : séance, révision, simulation ou leçon, dates/heures et rattachement facultatif à un objectif.
- Marquage des séances terminées, calcul du temps réel prévu à partir de la durée de séance et cumul hebdomadaire.
- Détection côté interface des chevauchements de séances lors de la création.

## 2. Tableau de bord formateur
- Nombre de cours créés et publiés.
- Nombre d'apprenants avec inscription active.
- Nombre de devoirs en attente de correction.
- Nombre de travaux corrigés.
- File des devoirs à traiter avec accès au catalogue et à l'espace de correction.
- Les statistiques reposent sur les inscriptions et travaux réellement enregistrés ; aucune donnée fictive n'est ajoutée.

## 3. Administration
- Vue de synthèse du catalogue, des inscriptions et des candidatures formateur en attente.
- Accès direct à la gestion du catalogue et à l'administration des formateurs.

## 4. Modèle de données et sécurité
Deux tables sont ajoutées :
- `academy_learning_goals` : objectifs personnels, dates cibles, rythme hebdomadaire et statut.
- `academy_study_events` : planning des séances, horaires, durée réelle et statut.

Les deux tables ont RLS activé. Les rôles `anon` n'ont aucun privilège. Les utilisateurs connectés ne lisent et ne modifient que leurs propres objectifs et séances ; l'administration garde son accès de contrôle. Une séance associée à un objectif doit pointer vers un objectif appartenant au même utilisateur. Les intervalles invalides et durées négatives sont rejetés par la base. Les index des clés étrangères de cette phase sont ajoutés.

## 5. Vérifications effectuées
- Migration Supabase appliquée avec succès.
- RLS activé et privilèges vérifiés : pas d'accès SELECT anonyme, accès authenticated accordé sous RLS.
- Test transactionnel avec deux comptes existants : le second compte ne voit ni l'objectif ni la séance du premier et son UPDATE affecte zéro ligne. Transaction annulée ; aucune donnée de test conservée.
- Conseiller Supabase Health : aucun avertissement.
- Conseiller Performance : les nouvelles clés étrangères ne figurent plus dans la liste des clés étrangères non indexées ; les 26 alertes restantes concernent les tables historiques du portail. Les alertes d'index inutilisés sont informatives et attendues sur les tables récemment créées.
- Conseiller Security : aucun nouveau signalement propre aux deux tables Phase 4. Les signalements existants comprennent 9 tables historiques sans politiques RLS, la table de clés privées des quiz (RLS sans policy volontaire), sept fonctions SECURITY DEFINER historiques/Phase 3 protégées par leurs contrôles, et la protection des mots de passe compromis Supabase Auth désactivée. Ce dernier réglage reste à activer dans le tableau de bord Auth.
- JavaScript des tableaux de bord et du profil Academy vérifié syntaxiquement ; CSS équilibré ; références de cache et liens de navigation contrôlés.
- Le workflow GitHub Actions est enrichi d'une étape dédiée aux tableaux de bord Academy. Le résultat de ce nouveau run doit être consulté avant de déclarer la CI réussie.

## 6. Limites
- Pas de test navigateur réel avec un compte apprenant et un compte formateur.
- Pas de déploiement Cloudflare ; les pages sont uniquement dans la branche de travail.
- Le calendrier est personnel à ce stade : ce n'est pas encore le calendrier de réservations formateur/apprenant, qui relève de la phase 5.
- Les séances complétées sont déclarées par l'apprenant ; ce temps n'est pas une mesure de présence certifiée.
- Les recommandations pédagogiques avancées, objectifs adaptatifs IA, certificats et gamification restent dans les phases suivantes.

## 7. Budget
- Projet Supabase Free existant.
- Aucun projet ou branche payant créé.
- Aucun service payant, IA, vidéo, paiement, SMS ou WhatsApp activé.
- Aucun coût supplémentaire engagé.

## 8. Migrations
- `academy_phase4_learning_goals_and_study_calendar_20261116`
- `academy_phase4_dashboard_foreign_key_indexes_20261116`

Le snapshot SQL est archivé dans `docs/sql/academy_phase4_goals_calendar_snapshot.sql`.
