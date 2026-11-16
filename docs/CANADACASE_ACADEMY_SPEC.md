# CanadaCase Academy — Cahier des charges fonctionnel et technique
Version : 1.0 — 16 novembre 2026
Statut : spécification initiale — conception validée, développement non commencé

## 1. Vision et objectifs

CanadaCase Academy est une plateforme internationale de formation en ligne intégrée à CanadaCase. Elle doit proposer un environnement pédagogique, commercial et communautaire complet, sans remplacer ni fragiliser le portail d'immigration existant.

Objectifs :
- proposer des formations en langues, préparation aux examens, comptabilité/finance, informatique/digital, management/entrepreneuriat, communication, études et carrière ;
- permettre aux apprenants de suivre des cours libres, des parcours structurés et des parcours personnalisés ;
- permettre aux formateurs de candidater, être vérifiés, enseigner et suivre leurs revenus ;
- gérer réservations, paiements, commissions, abonnements, forfaits, évaluations et attestations ;
- proposer un tuteur IA, une bibliothèque pédagogique, des cours vidéo, une communauté et un support ;
- fonctionner sur ordinateur, tablette et téléphone via web responsive et PWA, avec une architecture pouvant accueillir ultérieurement des applications natives.

## 2. Principes non négociables

1. Préserver les fonctions existantes de CanadaCase et ses dossiers d'immigration.
2. Réutiliser l'authentification existante ; un utilisateur peut cumuler plusieurs profils.
3. Séparer les rôles, permissions et données immigration/Academy.
4. Aucun rôle privilégié, statut de formateur agréé, paiement ou réussite ne peut être accordé sur simple déclaration du navigateur.
5. Toutes les opérations financières sensibles sont vérifiées côté serveur et journalisées.
6. Activer RLS sur toute table exposée ; appliquer le moindre privilège.
7. Ne jamais exposer la clé Supabase service_role/secret dans le client.
8. Distinguer les évaluations pédagogiques des résultats officiels d'examen.
9. N'utiliser que des contenus originaux, licenciés ou dont les droits de diffusion sont établis.
10. Les fonctionnalités sont annoncées comme livrées seulement après tests et vérification.

## 3. Identité de marque

- Nom : CanadaCase Academy.
- Positionnement : premium, inspirant, professionnel, rassurant, ambitieux et accessible.
- Slogan de travail : « Apprendre sans frontières. Construire son avenir. » / “Learn Beyond Borders. Build Your Future.”
- Palette : bleu nuit #102B46, or #D6AE63, blanc #FFFFFF.
- Logo : combiné premium, symbole original réunissant savoir, réussite et ouverture internationale ; déclinaisons horizontale, verticale et icône seule.
- Typographie : CanadaCase élégant et distinctif ; ACADEMY sobre et institutionnel.
- Style graphique : premium contemporain.
- Versions linguistiques du logo : française et anglaise, même symbole et proportions.
- Supports : numérique, institutionnel, publicitaire et commercial.
- Certificats : style premium institutionnel, versions française et anglaise séparées, QR de vérification, numéro unique, signature numérique, historique et statut.
- Le slogan, le logo et la disponibilité de marque/domaine restent à vérifier avant usage commercial définitif.

## 4. Publics, comptes et rôles

Une identité d'authentification commune doit permettre plusieurs profils :
- candidat CanadaCase ;
- apprenant externe ;
- formateur candidat / formateur vérifié ;
- administrateur ;
- entreprise/organisation ;
- partenaire institutionnel.

Un candidat CanadaCase peut également être apprenant. Un apprenant externe n'a pas besoin de dossier d'immigration. Les profils et permissions sont séparés de l'identité d'authentification.

Rôles administratifs proposés :
- super administrateur ;
- administrateur pédagogique ;
- responsable formateurs ;
- responsable financier ;
- administrateur technique/sécurité ;
- modérateur ;
- responsable commercial ;
- support client.

Les permissions sont attribuées par rôle, sans auto-élévation. Les actions sensibles sont auditées.

## 5. Inscription, authentification et sécurité des comptes

Méthodes prévues :
- e-mail et mot de passe ;
- Google ;
- Apple ;
- autres fournisseurs compatibles ajoutés après validation.

Fonctions :
- récupération et réinitialisation du mot de passe ;
- vérification de l'adresse e-mail ;
- authentification multifacteur, obligatoire pour les rôles administratifs ;
- gestion des sessions et appareils ;
- limitation des tentatives, détection d'anomalies et alertes ;
- association sécurisée d'identités externes au compte existant, avec prévention des doublons.

Inscription apprenant progressive :
1. création minimale du compte ;
2. profil et langue préférée ;
3. objectifs et domaine ;
4. positionnement recommandé et adaptable ;
5. recommandations et parcours.

Les contenus publics et contenus gratuits accessibles sans compte restent consultables selon leurs règles d'accès.

## 6. Accès et site public

La vitrine publique présente :
- mission et proposition de valeur ;
- catalogue de cours et domaines ;
- langues, examens, compétences et niveaux ;
- formateurs approuvés ;
- tarifs et formats ;
- cours individuels, collectifs, ateliers et examens blancs ;
- bibliothèque de démonstration ;
- avis clairement qualifiés ;
- tuteur IA et fonctionnalités ;
- témoignages authentiques, sans faux avis ;
- inscription/connexion et parcours par profil ;
- français et anglais au lancement.

Les visiteurs peuvent découvrir les contenus publics. Un compte est requis pour réserver, payer, suivre un cours, sauvegarder une progression ou accéder à un espace privé.

## 7. Catalogue et gouvernance pédagogique

Le catalogue est administrable sans modification du code pour les éléments métier :
- domaines ;
- langues ;
- examens ;
- compétences ;
- niveaux ;
- catégories et formats ;
- programmes, cours, modules et leçons.

Domaines initiaux envisagés : français et anglais (TEF, TCF, IELTS, CELPIP selon disponibilité), espagnol, allemand, comptabilité/finance, informatique/digital, gestion/entrepreneuriat, communication, études et carrière. Les exemples ne signifient pas que tous les cours sont déjà disponibles.

Un cours peut contenir :
- texte, vidéo, audio, PDF et documents autorisés ;
- chapitres et leçons ;
- exercices interactifs ;
- évaluations ;
- devoirs et pièces jointes ;
- correction automatique compatible et correction humaine ;
- progression et prérequis ;
- commentaires du formateur et aide IA.

Les cours créés par les formateurs passent par un workflow brouillon → soumission → contrôle → publication ou refus → versionnage.

## 8. Positionnement et parcours adaptatifs

Le test initial est personnalisé selon le domaine, l'examen, le niveau déclaré et les objectifs. Il est recommandé et peut être différé lorsque cela ne compromet pas les prérequis du cours.

Pour les langues, évaluer séparément compréhension écrite, compréhension orale, expression écrite et expression orale. Pour d'autres disciplines, définir des compétences spécifiques.

Les parcours comprennent :
- catalogue libre ;
- parcours structurés par modules ;
- parcours adaptatifs fondés sur les résultats et objectifs.

Les niveaux estimés par l'IA sont des estimations pédagogiques, jamais des résultats officiels TEF/TCF/IELTS/CELPIP.

## 9. Suivi pédagogique et évaluations

Suivre :
- progression globale et par compétence ;
- scores et tentatives ;
- devoirs, corrections et retours ;
- temps d'apprentissage et régularité ;
- objectifs, historique et jalons ;
- difficultés récurrentes et recommandations.

Les QCM et exercices déterministes peuvent être corrigés automatiquement. Les productions écrites/orales requièrent une grille de correction, une validation humaine selon le niveau de risque et une séparation visible entre note automatique, avis IA et note du formateur.

Les prévisions IA sont indicatives ; aucune décision disciplinaire ou de certification ne doit reposer uniquement sur elles.

## 10. Espace formateur et accréditation

Inscription formateur avec :
- identité et coordonnées ;
- biographie et présentation ;
- diplômes, certifications, expériences et références ;
- spécialités, langues, examens, compétences et niveaux ;
- entretien, test ou démonstration si requis.

Workflow : candidature → vérification → demande de complément / refus / approbation → activation → suivi → suspension/réactivation/renouvellement.

Niveaux internes d'accréditation :
1. Profil vérifié ;
2. Formateur agréé ;
3. Expert.

Ces niveaux sont des labels internes CanadaCase Academy et ne constituent pas des diplômes ou accréditations externes.

Espace formateur :
- profil et spécialités ;
- tarifs dans les fourchettes administratives ;
- calendrier, disponibilités et exceptions ;
- élèves et groupes ;
- réservations et visioconférences ;
- cours, devoirs, corrections et ressources ;
- suivi des progrès et rapports ;
- messagerie et notifications ;
- revenus, commissions, paiements et historique ;
- statistiques et recommandations IA.

Les formateurs non approuvés ne sont pas visibles comme formateurs agréés et ne peuvent pas vendre de cours.

## 11. Formats, réservations et calendrier

Formats :
- cours individuels ;
- cours collectifs avec capacité ;
- ateliers ouverts ;
- séances de conversation ;
- examens blancs encadrés ;
- forfaits et programmes intensifs.

Réservations hybrides : certains créneaux instantanés, d'autres soumis à acceptation du formateur. Calendrier avec fuseaux horaires, capacité, prévention des doubles réservations, rappels, présence, liste d'attente et historique.

Les règles de report, annulation et absence sont configurables par type de cours. L'administration fixe un minimum ; les formateurs peuvent offrir des conditions plus favorables, jamais moins favorables. Les conditions acceptées à la réservation restent applicables à cette réservation.

Retard : délai d'attente minimum défini par l'administration ; le retard apprenant ne prolonge pas automatiquement la séance ; retard formateur compensé ou récupéré selon les règles.

## 12. Visioconférence et enregistrements

Prévoir une salle intégrée et des liens externes choisis par le formateur parmi les fournisseurs autorisés. Les liens externes sont accessibles uniquement aux participants autorisés.

Le fournisseur vidéo n'est pas encore choisi. Comparer coûts, limites, qualité, disponibilité régionale, sécurité, accessibilité, enregistrement et intégration avant décision.

Enregistrement facultatif, uniquement avec consentement explicite de toutes les parties, indicateur visible, possibilité d'arrêter, accès restreint, journal de consentement et durée de conservation définie. Aucun enregistrement implicite.

## 13. Tarification, paiements, commissions et comptabilité

Les tarifs sont encadrés par des minima/maxima administrés par catégorie, durée, format et type de cours. Le formateur choisit dans la fourchette autorisée.

Modèle commercial hybride :
- abonnement mensuel/annuel ;
- achat individuel ;
- forfaits de séances ou examens ;
- cours individuels et collectifs ;
- ateliers et examens blancs payants ;
- essais gratuits configurables, sans prélèvement automatique sans consentement explicite.

Paiements :
A. Paiement via la plateforme : prestataire confirme le paiement par webhook sécurisé, calcul de commission et solde formateur.
B. Paiement direct : le formateur confirme réception ; justificatifs et contrôles administratifs possibles.

Commission variable définie par l'administration, taux figé au moment de la transaction. Pas de commission automatique sur paiement direct sauf frais explicitement définis plus tard.

Prévoir grand livre financier append-only, références uniques, idempotence des webhooks, rapprochement, remboursement, annulation, reversement, frais prestataire, devise, taux de change horodaté et historique. Le frontend ne peut jamais déclarer un paiement validé.

Devise de référence définie par l'administration ; conversion indicative vers la devise apprenant avec source et date. Le montant réellement débité est celui confirmé par le prestataire.

Prestataires de paiement à comparer pour les pays cibles, notamment cartes et Mobile Money lorsque disponibles. Aucun prestataire n'est présumé choisi.

## 14. Abonnements, forfaits et promotions

Abonnements mensuels/annuels, achats ponctuels et forfaits (exemples de 5/10/20 séances). Chaque forfait précise nombre et durée de séances, compétences, prix, expiration, annulation/remboursement et solde restant.

Les consommations sont enregistrées dans un registre ; prévenir double consommation et usage après expiration. Les exceptions sont autorisées et auditées.

Promotions créées par l'administration ou les formateurs sous validation et règles : code, période, limite, produits éligibles, seuil minimum et prix plancher. Possibilité de suspension en cas d'abus.

## 15. Examens blancs et contenus d'examen

Les exercices partiels peuvent être gratuits ; les simulations complètes sont payantes selon les règles du catalogue. Simulations avec minuterie, conditions réalistes, correction automatique des parties compatibles, évaluation humaine des productions orales/écrites et rapport détaillé.

Utiliser uniquement des questions originales ou sous licence. Ne pas présenter les contenus comme questions officielles confidentielles ni les scores comme résultats officiels.

## 16. IA et crédits

Tuteur IA personnalisé :
- explications ;
- exercices adaptés ;
- aide à la rédaction et correction ;
- simulation orale ;
- plan de révision ;
- aide au formateur pour préparer les cours.

Monétisation hybride : accès gratuit limité, accès étendu par abonnement ou crédits. Consommation selon complexité : explication faible, correction simple faible/moyenne, production écrite moyenne, simulation orale et analyse détaillée élevée, coaching variable.

À épuisement des crédits, conserver des fonctionnalités gratuites et proposer achat de crédits ou abonnement.

Protections : quotas journaliers/mensuels, détection d'anomalies, partage de comptes, limitation des bots, alertes, suspension proportionnée et procédure de contestation. Mesurer les coûts et marges avant mise en production. Fournisseur IA à sélectionner après comparaison.

## 17. Bibliothèque et cours vidéo

Bibliothèque intelligente : PDF, livres autorisés, fiches, vidéos, audios, podcasts et ressources interactives, catégorisés par domaine, langue, examen, compétence, niveau, source, droits et version. Recherche, recommandations, téléchargement hors ligne lorsque autorisé, contributions formateurs soumises à validation.

Cours vidéo : contenus enregistrés, lives et replays selon droits et consentements ; chapitres, progression, évaluations, statistiques et téléchargement contrôlé.

## 18. Communauté, avis, modération et litiges

Communauté : forums, groupes par domaine/langue/examen/niveau, défis, événements, échanges entre pairs et messagerie privée/de groupe, pièces jointes et messages vocaux.

Avis : utilisateurs inscrits autorisés à publier ; distinguer avis lié à une réservation vérifiée et avis d'utilisateur inscrit non vérifié. Note 1–5, commentaire, modification/suppression selon règles, signalement et modération. Ne jamais présenter un avis non vérifié comme expérience d'achat vérifiée.

Les formateurs peuvent répondre publiquement. Règles contre insultes, menaces, harcèlement, divulgation de données personnelles et représailles. Accès administratif aux conversations privées uniquement sur signalement ou motif justifié, limité et audité.

Litiges : référence, catégorie, preuves, historique, responsable, décision motivée et date de clôture. Contact direct facultatif ; possibilité de saisir l'administration immédiatement en cas de situation grave.

## 19. Certificats et attestations

Deux types :
- attestation de participation ;
- certificat de réussite après évaluation finale et seuil défini par programme.

Seuil initial à configurer par programme ; aucun seuil universel n'est imposé dans cette version.

Documents internes CanadaCase Academy, jamais présentés comme diplômes officiels ou résultats d'organismes d'examen externes.

Sécurité : numéro unique, QR, signature numérique vérifiable, historique, statut valide/révoqué/remplacé et page publique minimale sans exposition de données sensibles.

## 20. Profils entreprise et partenaires

Portail entreprise : organisations, employés, cohortes, budgets, facturation, formations collectives, progression et rapports autorisés. Les responsables RH ne voient que les données d'apprentissage autorisées, jamais les messages privés ni données personnelles non nécessaires.

Portail partenaire : contrats, inscriptions groupées, offres, commissions si autorisées, analyses et gestion de cohortes. Cloisonnement strict des données entre organisations.

## 21. Notifications, langues et accessibilité

Notifications dans l'application, e-mail, SMS ou WhatsApp selon préférences et services réellement intégrés. Historique, préférences, anti-doublons et canal spécifique pour alertes critiques.

Interface française et anglaise au lancement. Ajout ultérieur de langues par administration avec traduction assistée par IA et validation humaine. Distinguer langue de l'interface, de la formation et de communication.

Accessibilité : navigation clavier, lecteurs d'écran, contrastes, tailles de texte, sous-titres/transcriptions, alternatives aux médias et exercices adaptables.

## 22. Mineurs et protection

Plateforme ouverte à tous âges sous environnements adaptés : vérification d'âge proportionnée, consentement parental lorsque requis, tableau de bord parent, protection communautaire renforcée, vérification accrue des formateurs et restrictions de contact privé adulte-mineur. Les obligations exactes doivent être validées juridiquement dans les pays de lancement avant ouverture aux mineurs.

## 23. Mode hors connexion et PWA

PWA responsive au lancement. Mode hors connexion avancé pour parcours et exercices téléchargeables, travail hors ligne et synchronisation à la reconnexion.

Protéger les données locales, contrôler les droits et expirations, gérer les conflits et valider les résultats côté serveur. Paiements, visioconférence, chat temps réel et examens à intégrité stricte nécessitent Internet ; aucune garantie d'intégrité totale hors ligne.

Applications Android/iOS natives ultérieures, après stabilisation web/PWA, sur base technique partagée.

## 24. Gamification

XP, badges, objectifs et séries d'apprentissage. Récompenser les efforts pédagogiques réels. Les points et badges ne donnent jamais automatiquement droit à un certificat ou à la réussite.

## 25. Support client

FAQ, assistant IA, tickets, chat humain, réclamations, suivi et historique. L'IA ne prend pas seule les décisions financières, disciplinaires ou sensibles.

## 26. Données, conformité et continuité

Chiffrement en transit et au repos selon capacités des fournisseurs, permissions granulaires, consentements, export/correction/suppression selon obligations légales, journal d'audit, sauvegardes indépendantes, politique de conservation, réponse aux incidents et tests de restauration.

Architecture évolutive, CDN, suivi des performances, contrôle des coûts et capacité à gérer des pics. Les prévisions analytiques restent indicatives ; décisions sensibles avec contrôle humain.

## 27. Architecture cible et intégration CanadaCase

Socle actuel identifié :
- Supabase project : qxaykieolvbzaxmfaack ;
- dépôt GitHub : meguegapradamel/Canadacase. ;
- portail web existant en HTML/CSS/JavaScript ;
- authentification Supabase ;
- profils actuels avec rôles candidate, agent, admin ;
- table candidate_cases pour les dossiers ;
- modules language_courses, language_exercises, language_exercise_questions, language_attempts et tables associées pour TEF/TCF.

Cible :
- conserver le projet Supabase et l'authentification ;
- ajouter les profils Academy et permissions sans casser les rôles immigration ;
- isoler les données pédagogiques et financières ;
- conserver les tables immigration intactes ;
- intégrer l'Academy dans le portail avec navigation adaptée au rôle ;
- utiliser des Edge Functions ou services backend pour les opérations privilégiées, paiements, webhooks, crédits IA, émission de certificats et tâches sensibles ;
- utiliser Cloudflare pour la distribution et les fonctions adaptées, après validation des responsabilités de chaque service.

Aucune migration Academy n'est incluse dans cette spécification. Le schéma final doit être établi après audit complet des policies, fonctions, triggers, Storage, Edge Functions, secrets, vues et requêtes du frontend.

## 28. Modules de données envisagés

Noms indicatifs, à confirmer après modélisation :
- academy_memberships / academy_profiles ;
- academy_roles / academy_permissions ;
- trainer_applications / trainer_profiles / trainer_credentials / trainer_accreditations ;
- academy_domains / academy_languages / academy_exams / academy_skills / academy_levels ;
- academy_courses / course_modules / course_lessons / course_assets ;
- trainer_specialties / trainer_pricing_rules / trainer_availability ;
- lesson_bookings / lesson_sessions / group_classes / group_enrollments / attendance ;
- assessments / assessment_attempts / submissions / grading_rubrics / feedback ;
- learning_paths / learner_progress / learning_goals ;
- academy_orders / payment_transactions / payment_events / commission_rules / trainer_balances / payouts / refunds ;
- subscriptions / packages / entitlements / usage_ledger / promotions ;
- ai_credit_accounts / ai_credit_ledger / ai_usage_events ;
- academy_messages / conversations / reports / moderation_actions / disputes ;
- academy_reviews / review_responses ;
- academy_certificates / certificate_events / verification_logs ;
- library_resources / resource_versions / rights_records ;
- organizations / organization_members / partner_accounts ;
- notifications / notification_preferences ;
- support_tickets / support_messages ;
- consent_records / audit_events.

Ces noms sont une proposition logique, pas un schéma déjà créé. Les entités doivent être normalisées et contraintes par clés étrangères, contraintes uniques, index et RLS.

## 29. Roadmap de réalisation

Phase 0 — audit technique, inventaire des fonctions et sauvegarde/restauration vérifiée.
Phase 1 — comptes, profils Academy, rôles et permissions.
Phase 2 — candidatures formateurs et accréditations.
Phase 3 — catalogue, contenus, cours, bibliothèque et workflow de publication.
Phase 4 — espaces apprenant/formateur et suivi.
Phase 5 — calendrier, réservations, présence et visioconférence.
Phase 6 — paiements, grand livre, commissions, abonnements et forfaits.
Phase 7 — examens blancs, évaluations, certificats et vérification.
Phase 8 — IA, crédits, quotas et supervision.
Phase 9 — communauté, support, entreprises et partenaires.
Phase 10 — PWA/hors ligne, accessibilité, sécurité, charge, restauration et lancement.

Chaque phase doit avoir critères d'acceptation, tests RLS, tests fonctionnels, tests mobile, contrôle des coûts et plan de retour arrière.

## 30. Décisions et validations restant à obtenir par recherche ou conformité

- prestataire de paiement par pays, cartes et Mobile Money ;
- prestataire de visioconférence et politique de stockage/enregistrement ;
- fournisseur IA et budget par activité ;
- services e-mail, SMS et WhatsApp ;
- politique détaillée de remboursement et obligations fiscales ;
- juridictions de lancement, protection des données et protection des mineurs ;
- seuils de réussite par programme ;
- politique de conservation et de suppression des données ;
- validation juridique du slogan, du logo et de la marque ;
- exigences de licence pour ressources et contenus tiers.

## 31. Critères de qualité avant lancement

- Aucun accès non autorisé entre utilisateurs ou organisations.
- Aucun changement de rôle privilégié par le client.
- Aucun paiement validé sans preuve serveur.
- Webhooks idempotents et rapprochement financier vérifiable.
- Aucun double booking.
- Annulation/remboursement conformes aux conditions affichées.
- Certificats vérifiables et révocables.
- Historique d'audit sur les actions sensibles.
- Sauvegardes et restauration réellement testées.
- Parcours fonctionnels sur iOS, Android et ordinateur.
- Tests d'accessibilité et de sécurité.
- Aucune régression des parcours immigration et TEF/TCF existants.

---
Fin de la version 1.0. Ce document décrit la cible et les décisions de conception ; il ne signifie pas que les fonctionnalités sont déjà développées ou déployées.
