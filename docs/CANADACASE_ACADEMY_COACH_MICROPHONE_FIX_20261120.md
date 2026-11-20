# CanadaCase Academy — Correctif du microphone du Coach oral

Date : 20 novembre 2026

## Modifications livrées dans le dépôt

- Le contrôle du Coach oral passe d'un appui maintenu à une commande tactile : un appui démarre, un second arrête.
- Les événements Pointer Events et la capture du pointeur ont été retirés de ce contrôle afin d'éviter que le relâchement tactile coupe immédiatement l'accès micro sur certains WebViews mobiles.
- Le libellé du bouton, son attribut accessible `aria-pressed` et les messages d'aide suivent le nouveau comportement.
- Sur iOS/Safari, si l'utilisateur annule pendant que la demande d'autorisation du microphone est encore ouverte, le flux audio est arrêté dès que l'autorisation revient ; aucun enregistrement fantôme n'est lancé.
- L'interface d'administration Academy contient déjà un accès direct au même Coach oral. La fonction Edge vérifie que le profil est actif sans exclure le rôle administrateur.
- Les indications d'utilisation sont alignées dans les pages du Coach et de l'Academy. Les versions de cache des ressources ont été actualisées.
- Le workflow de validation comporte désormais des contrôles de non-régression pour le mode tactile, l'annulation d'une autorisation en attente et l'accès administrateur.

## Vérifications

- Workflow « Validate CanadaCase » : run [44752657336](https://github.com/meguegapradamel/Canadacase./actions/runs/44752657336), terminé avec succès sur le commit `4374efc885b94e2f6da97a51c471349ce983245d`.
- La syntaxe JavaScript et les assertions du Coach oral passent dans CI.
- L'accès administratif au Coach est confirmé dans le code de rendu de l'espace Academy et couvert par un contrôle CI.
- Aucun test physique du microphone sur iPhone/Safari n'a été effectué dans cette session. Le comportement matériel et la fenêtre réelle d'autorisation restent à confirmer sur l'appareil.

## Mise en production — blocage externe

Le workflow « Deploy CanadaCase to Cloudflare Workers » ne peut pas déployer tant que les deux secrets GitHub Actions suivants ne sont pas configurés dans le dépôt :

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Le run de déploiement a échoué à l'étape de vérification des identifiants et a ignoré l'étape `wrangler deploy`. Aucun déploiement Cloudflare n'est donc déclaré.

## Critères de clôture

1. Configurer les deux secrets Cloudflare dans GitHub Actions sans communiquer le jeton dans une conversation.
2. Relancer le workflow de déploiement et vérifier sa réussite.
3. Ouvrir le Coach avec un compte administrateur actif et un compte apprenant sur iPhone/Safari et ordinateur.
4. Tester autorisation, démarrage, arrêt, transcription, envoi au Coach, lecture vocale et historique.
5. Confirmer que le reste des fonctions du portail demeure accessible après le correctif.

**État :** correctif intégré au dépôt et validé par CI ; mise en production et test matériel en attente.
