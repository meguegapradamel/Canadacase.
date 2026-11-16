# CanadaCase Academy — phase 16 : préparation de mise en production

Date : 16 novembre 2026
Branche de livraison : `academy/specification-v1`
PR : #2 vers `main`

## État des validations

- CI GitHub [43974346749](https://github.com/meguegapradamel/Canadacase./actions/runs/43974346749) : succès, incluant les contrôles du catalogue payant, de l'activation des droits, des réservations, des paiements, des tableaux de bord et des examens.
- Supabase Health Advisor : aucun avertissement.
- RLS activé sur toutes les 33 tables Academy publiques.
- Test transactionnel du forfait de séances : unité débitée, candidat sans droit refusé ; toutes les données temporaires ont été nettoyées et le contrôle de résidus retourne zéro.
- Les migrations appliquées des phases 13 et 15 sont archivées dans `supabase/migrations/`.

## Blocages avant une déclaration « en production »

- Le contrôle externe « Workers Builds: canadacase » a retourné un échec pour un build Cloudflare de production. Le détail technique du build n'est pas disponible via la connexion GitHub/Supabase actuelle ; il faut ouvrir le build dans le tableau de bord Cloudflare et lire son journal.
- Le dry-run Wrangler de GitHub Actions est un test à blanc, pas un déploiement.
- La PR #2 n'est pas fusionnée.
- Aucun test navigateur réel authentifié sur iPhone/Safari et ordinateur n'a été réalisé.
- La protection contre les mots de passe compromis reste désactivée dans Supabase Auth.
- Orange Money et MTN MoMo sont encore désactivés en attendant la configuration des coordonnées marchandes officielles.

## Plan de sortie

1. Lire et corriger l'erreur exacte du build Cloudflare.
2. Obtenir un build de production réussi.
3. Faire une validation fonctionnelle avec un vrai candidat, un formateur approuvé et un administrateur.
4. Fusionner la PR #2 vers `main` uniquement après ces validations.
5. Confirmer l'URL Worker en production et tester les pages principales sur téléphone et ordinateur.

## Budget

- Aucune ressource payante ajoutée.
- Aucune passerelle de paiement ou API payante activée.
- Dépense supplémentaire engagée : 0 FCFA.

## Conclusion

La branche est prête pour la revue finale du code, mais la mise en production ne peut pas être déclarée terminée tant que le build Cloudflare signalé en échec n'est pas corrigé et qu'un test réel authentifié n'a pas été effectué.
