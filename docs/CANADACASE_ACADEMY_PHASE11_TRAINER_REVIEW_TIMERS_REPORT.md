# CanadaCase Academy — Phase 11 : correction par les formateurs, chronométrage par compétence et entretien des audios

Date : 16 novembre 2026

## 1. Affectation sécurisée des correcteurs

Trois migrations Supabase appliquées : `academy_phase11_trainer_exam_review_and_audio_cleanup_20261116`, `academy_phase11_require_active_admin_for_stale_audio_cleanup_20261116` et `academy_phase11_index_reviewer_assignment_audit_fk_20261116`.

- Nouvelle table `academy_mock_exam_reviewers` : affectation explicite d'un formateur à un examen, état actif/inactif, administrateur ayant effectué l'affectation et horodatage.
- Seuls les administrateurs actifs peuvent créer, modifier ou retirer une affectation.
- Le compte affecté doit être actif et posséder le rôle Academy `trainer` dans `academy_user_roles`.
- Les formateurs ne voient que les affectations qui leur appartiennent.
- Les politiques RLS des tentatives et réponses autorisent la lecture des copies uniquement au candidat, à l'administration ou au formateur actif affecté à l'examen.
- La fonction de correction serveur autorise désormais l'administrateur ou le formateur expressément affecté ; le barème, la note maximale, la correction complète et la création éventuelle du certificat restent contrôlés côté serveur.
- Le lecteur audio Storage autorise le formateur affecté à écouter les enregistrements des copies de son examen, sans rendre le bucket public.
- L'espace Examens affiche une file de correction pour les formateurs et un formulaire d'affectation/retrait pour l'administration.

**État des comptes :** l'audit n'a trouvé aucun compte ayant actuellement le rôle Academy `trainer`. Le formulaire d'affectation est prêt, mais la liste restera vide jusqu'à l'approbation d'une candidature et à l'attribution du rôle formateur. Aucun rôle n'a été attribué à un vrai compte pendant cette opération.

## 2. Chronométrage par compétence TEF/TCF

Les simulations longues affichent désormais les compétences l'une après l'autre. Chaque section possède son propre compte à rebours ; à la fin du temps, les réponses de cette section sont conservées et verrouillées, puis l'épreuve suivante commence. Le candidat peut aussi terminer une section avant la fin de son temps.

| Simulation | Compétence | Durée |
|---|---|---:|
| TCF Canada | Compréhension orale | 35 min |
| TCF Canada | Compréhension écrite | 60 min |
| TCF Canada | Expression écrite | 60 min |
| TCF Canada | Expression orale | 12 min |
| TEF Canada | Compréhension écrite | 60 min |
| TEF Canada | Compréhension orale | 40 min |
| TEF Canada | Expression écrite | 60 min |
| TEF Canada | Expression orale | 15 min |

- Les groupes sont reconstruits à partir des intitulés des questions publiées.
- Les réponses déjà saisies sont conservées lorsqu'une section se verrouille.
- Un enregistrement en cours est arrêté à la fin de sa section ; l'avancement attend la fin de son envoi.
- Le chronomètre global et la limite générale de tentative côté serveur sont conservés.

**Limite technique importante :** les nouveaux chronomètres par compétence et le verrouillage de section sont gérés dans l'interface du navigateur. Le serveur continue de faire respecter la durée globale, mais ne vérifie pas encore indépendamment chaque échéance de section. Cette simulation n'est donc pas un examen surveillé inviolable.

## 3. Nettoyage des enregistrements abandonnés

- Ajout d'une fonction réservée à l'administration qui identifie les fichiers audio liés aux tentatives `in_progress` ou `expired` commencées depuis plus de 30 jours.
- Bouton de nettoyage manuel dans l'espace d'administration.
- Politique Storage de suppression limitée à ces fichiers d'examen et à un administrateur actif.
- Les copies soumises, en attente de correction ou déjà corrigées sont exclues du nettoyage.
- Aucun cron, service tiers ou service payant n'a été activé ; le nettoyage est déclenché manuellement par l'administration.

## 4. Vérifications transactionnelles

- Test transactionnel avec un compte candidat temporairement doté du rôle formateur, une affectation d'examen, une tentative fictive et une réponse ouverte.
- Sous le rôle PostgreSQL `authenticated`, le formateur affecté a pu voir la tentative et sa réponse, puis appeler la fonction de correction.
- La correction a produit un résultat cohérent avec le barème de la question de test.
- Un utilisateur non affecté n'a pas pu lire la tentative ni appeler la fonction de correction ; un formateur affecté a pu lire la tentative et sa réponse et corriger la copie.
- Test Storage transactionnel : le formateur affecté a pu lire le fichier audio lié à sa copie ; un autre compte n'a pas pu le lire.
- Test du nettoyage : la fonction administrative a retrouvé un fichier fictif lié à une tentative expirée depuis plus de 30 jours.
- Toutes les données de test, les métadonnées Storage fictives et l'attribution temporaire du rôle ont été annulées par `ROLLBACK`.
- Le test n'a pas créé de vrai compte formateur et aucun compte existant n'a été modifié durablement.

## 5. Budget et limites de mise en service

- Dépense supplémentaire : 0 FCFA.
- Réutilisation du bucket privé existant `language-recordings` ; aucune nouvelle infrastructure.
- Les fonctions de correction restent humaines ; aucune transcription ou notation automatique de prononciation n'est ajoutée.
- Le microphone iPhone/Safari et le lecteur audio doivent encore être testés dans un navigateur réel avec un compte connecté.
- GitHub Actions : workflow [43971719352](https://github.com/meguegapradamel/Canadacase./actions/runs/43971719352) terminé avec succès ; vérification de syntaxe JS, marqueurs des affectations formateurs, chronomètres par compétence, nettoyage audio, navigation et dry-run Wrangler.
- Supabase Advisors après indexation : aucun avertissement Health ; aucun nouveau problème Security lié à cette phase. Les alertes Security restantes concernent des tables/fonctions historiques et la protection des mots de passe compromis désactivée. Les alertes Performance restantes sont historiques (26 clés étrangères non indexées, 8 groupes de politiques permissives) ; l'index de la nouvelle clé étrangère `assigned_by` a été ajouté. L'index ajouté est signalé comme inutilisé pour l'instant, ce qui est normal avant le premier usage.
- Aucun déploiement Cloudflare ni aucune fusion de PR ne sont déclarés.

## Fichiers

- `assets/academy-exams.js` : affectations, file formateur, lecture audio et chronométrage par section.
- `assets/academy-exams.css` : styles des sections minutées et de la correction.
- `academy-exams.html` : actualisation du cache des ressources.
- `.github/workflows/validate.yml` : contrôles CI des rôles, de l'entretien des audios et des durées TEF/TCF.

La PR #2 reste ouverte en brouillon.
