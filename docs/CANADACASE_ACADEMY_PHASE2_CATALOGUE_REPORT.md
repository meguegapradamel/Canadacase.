# CanadaCase Academy — rapport de réalisation Phase 2
Date : 16 novembre 2026

Statut : schéma du catalogue et de la bibliothèque installé, contrôles d'accès testés transactionnellement, interface ajoutée à la branche GitHub. Pas encore fusionné ni déployé.

## 1. Contenu de la phase
Six tables nouvelles :
- `academy_domains` : domaines de formation.
- `academy_programs` : programmes et examens rattachés à un domaine.
- `academy_courses` : cours génériques, statut de publication, langue et niveau.
- `academy_course_modules` : modules ordonnés d'un cours.
- `academy_lessons` : leçons textuelles, vidéo, audio, document, interactives, replay ou quiz.
- `academy_resources` : bibliothèque de ressources avec source, version et statut des droits.

Données initiales : 6 domaines et 2 programmes (TEF Canada, TCF Canada). Aucun cours fictif n'a été publié.

## 2. Réutilisation du contenu existant
Le portail possède déjà 51 leçons linguistiques et 70 exercices. La page Academy les affiche dans la section TEF/TCF sans les copier dans les nouvelles tables. Les tables historiques ne sont pas modifiées.

## 3. Fonctionnalités de l'interface
- Nouvelle page `academy-catalog.html`.
- Catalogue des cours génériques publiés.
- Consultation des modules et leçons.
- Formulaire de création de cours pour les formateurs agréés et les administrateurs.
- Formateur : création de brouillons, ajout de modules/leçons, soumission pour validation ; édition verrouillée pendant l'examen.
- Administrateur : création de domaines/programmes, publication, demande de corrections et archivage des cours.
- Bibliothèque : contributions de ressources via lien HTTPS, indication de la source, version et droits ; publication réservée à l'administration.
- Navigation depuis l'espace Academy, avec lien conservé sur mobile.

## 4. Sécurité et tests
Les six nouvelles tables ont RLS activé, quatre politiques par table, droits Data API accordés uniquement à `authenticated`, aucun droit SELECT à `anon`. Les rôles et les règles de propriétaire sont contrôlés par Postgres.

Tests transactionnels réussis puis annulés :
- Formateur agréé peut créer un brouillon de cours, un module, une leçon et une ressource.
- Un autre formateur ne voit pas ces brouillons.
- Le formateur ne peut pas publier lui-même son cours.
- La base refuse de publier un cours sans au moins un module et une leçon.
- Une ressource sous licence ou déclarée dans le domaine public ne peut pas être publiée sans source ou note justificative.
- L'apprenant voit le cours, les modules, les leçons et les ressources après publication.
- Le formateur ne peut plus modifier le cours après soumission ; il peut reprendre les modifications après que l'administration demande des corrections.
- Aucun accès anonyme aux nouvelles tables.
- Vérification finale : 0 cours, 0 module, 0 leçon et 0 ressource de test conservés ; les seules données initiales sont les 6 domaines et 2 programmes.

Contrôles de code : syntaxe JavaScript réussie après actualisation des clés de cache ; accolades CSS équilibrées ; liens de page et versions de cache vérifiés statiquement.

## 5. Conseillers Supabase
- Aucun avertissement de santé.
- Aucun avertissement RLS ou politique permissive multiple sur les nouvelles tables Academy.
- Les 8 avertissements de politiques permissives multiples concernent les tables historiques du portail.
- Les 26 clés étrangères signalées comme non indexées concernent les tables historiques ; les clés étrangères Academy de cette phase ont des index.
- Les alertes SECURITY DEFINER sont celles déjà identifiées en Phase 1 et les fonctions historiques, avec vérification d'autorisation dans leur code.
- Les index Academy non encore utilisés sont attendus tant que le catalogue est peu peuplé.

## 6. Limites actuelles
- Pas de test navigateur réel ni de test HTTP avec une session authentifiée.
- Pas de fusion de la PR ni de déploiement Cloudflare.
- Les ressources sont actuellement ajoutées par URL HTTPS. L'envoi de fichiers et le stockage privé sont volontairement différés jusqu'à la mise en place et au test de leurs politiques Storage.
- Pas encore de suivi des inscriptions, de progression, de devoirs ou d'évaluation : ces fonctions relèvent des phases suivantes.

## 7. Budget
- Utilisation du projet Supabase Free existant.
- Aucune branche ou projet Supabase payant créé.
- Aucun stockage payant, fournisseur vidéo, IA, SMS, WhatsApp ou paiement activé.
- Aucun coût supplémentaire engagé.

## 8. Décision de livraison
Phase 2 : base de données et interface initiale réalisées dans la branche `academy/specification-v1`. La PR reste en brouillon et non fusionnée jusqu'aux tests navigateur et à la non-régression du portail CanadaCase existant.
