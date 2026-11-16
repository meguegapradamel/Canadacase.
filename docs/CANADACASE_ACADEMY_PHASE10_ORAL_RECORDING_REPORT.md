# CanadaCase Academy — Phase 10 : enregistrement des réponses orales

Date : 16 novembre 2026

## Objectif

Permettre à un candidat d'enregistrer sa réponse orale pendant une simulation TEF/TCF, de la réécouter, puis de joindre l'audio à sa copie pour une correction humaine.

## Infrastructure réutilisée

- Bucket Supabase existant : `language-recordings`.
- Bucket privé (non public), taille maximale configurée : 25 Mio.
- Formats autorisés dans le bucket : audio/webm, audio/mp4, audio/mpeg, audio/wav, audio/ogg, audio/aac.
- Aucun nouveau bucket, service externe, fournisseur audio, API payante ou migration SQL n'a été créé.
- Les politiques existantes autorisent l'utilisateur actif à déposer/lire/supprimer ses propres fichiers ; l'administrateur actif peut lire les enregistrements. Aucun accès public n'est ajouté.

## Fonctionnalités ajoutées

- Utilisation de `MediaRecorder` et de `getUserMedia` lorsque le navigateur les prend en charge.
- Commandes « Enregistrer ma réponse » et « Arrêter » sur les tâches marquées `oral_task`.
- Réécoute locale du fichier après l'enregistrement.
- Envoi vers un chemin cloisonné par utilisateur, tentative et question : `user_id/mock-exams/attempt_id/question_id/...`.
- Limite côté interface de 24 Mio par fichier, inférieure à la limite de 25 Mio du bucket.
- Métadonnées audio (`audio_path`, type MIME et taille) ajoutées à la réponse JSON de la question. La fonction de soumission existante conserve l'objet de réponse complet.
- L'interface bloque la soumission tant qu'un microphone est actif ou qu'un envoi audio est en cours.
- L'administration obtient un lien signé privé de cinq minutes pour écouter l'enregistrement depuis l'écran de correction.
- Les réponses textuelles/dictées restent disponibles si le navigateur ou l'appareil ne permet pas l'enregistrement audio.

## Sécurité et limites

- Le bucket demeure privé. Les fichiers ne sont pas publiés sur le web.
- Le candidat ne peut déposer que dans son propre dossier Storage selon les politiques déjà présentes.
- La lecture de correction utilise les droits administrateur existants ; les formateurs non administrateurs ne disposent pas encore de cette lecture ni de la validation des notes via le moteur d'examens.
- La correction de l'expression orale reste humaine. Il n'y a pas d'analyse automatique de prononciation, de transcription automatique ni de correction IA payante.
- Si un candidat abandonne une tentative après l'envoi d'un fichier sans soumettre sa copie, le fichier peut rester orphelin dans le bucket ; un nettoyage périodique n'est pas inclus.
- La disponibilité de `MediaRecorder` et des formats dépend du navigateur. La dictée du clavier reste une solution de repli.
- Le fonctionnement du microphone et de l'écoute audio n'a pas encore été testé dans un navigateur réel authentifié, notamment sur iPhone/Safari.

## Vérifications effectuées

- Audit SQL des buckets et politiques Storage : bucket privé, 25 Mio, règles d'accès propriétaire/administrateur confirmées.
- Audit de la fonction `academy_submit_mock_exam` : la réponse manuelle complète est enregistrée dans la colonne JSONB `response`, ce qui permet d'y conserver le chemin audio sans modifier le schéma.
- Workflow GitHub Actions `Validate CanadaCase` : run [43970724865](https://github.com/meguegapradamel/Canadacase./actions/runs/43970724865), terminé avec succès.
- Étapes réussies : contrôle de syntaxe JavaScript, contrôles de l'interface des examens, présence de MediaRecorder/getUserMedia, bucket language-recordings, createSignedUrl, audio_path et styles responsive ; les autres contrôles du dépôt et le dry-run Wrangler ont également réussi.
- Le dry-run Wrangler n'est pas un déploiement de production.

## Budget et mise en service

- Dépense supplémentaire : 0 FCFA.
- Pas de nouveau service ni de nouvelle infrastructure payante.
- Modifications conservées sur la branche `academy/specification-v1` et dans la PR #2, qui reste ouverte en brouillon.
- Aucune fusion de PR et aucun déploiement Cloudflare ne sont déclarés.
