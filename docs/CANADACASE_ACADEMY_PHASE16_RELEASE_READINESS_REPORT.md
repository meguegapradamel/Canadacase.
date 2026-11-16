# CanadaCase Academy — phase 16 : préparation de mise en production

Date : 16 novembre 2026
Branche de livraison : `academy/specification-v1`
PR : #2 vers `main`

## État des validations

- PR #2 fusionnée le 16 novembre 2026 dans `main` : commit `4b87c0bb99d134fa1439e96ff9cb0ce1492335c2`.
- CI GitHub sur le commit de fusion [43975066951](https://github.com/meguegapradamel/Canadacase./actions/runs/43975066951) : succès, incluant les contrôles du catalogue payant, de l'activation des droits, des réservations, des paiements, des tableaux de bord, des examens, des migrations et des rapports.
- CI après le durcissement supplémentaire des RPC administratives [43975309833](https://github.com/meguegapradamel/Canadacase./actions/runs/43975309833) : succès.
- Validation complète de la dernière révision documentaire et des archives de migrations [43975397997](https://github.com/meguegapradamel/Canadacase./actions/runs/43975397997) : succès, dry-run Wrangler inclus.
- Supabase Security Advisor ne signale plus de fonction SECURITY DEFINER publique exécutable par `authenticated`. Le seul avertissement de sécurité restant est la protection des mots de passe compromis désactivée. Les alertes INFO RLS et les alertes Performance historiques sont documentées dans le rapport phase 15.
- Supabase Health Advisor : aucun avertissement.
- RLS activé sur toutes les 33 tables Academy publiques.
- Test transactionnel du forfait de séances : unité débitée, candidat sans droit refusé ; toutes les données temporaires ont été nettoyées et le contrôle de résidus retourne zéro.
- Les migrations appliquées des phases 13 et 15 sont archivées dans `supabase/migrations/`.

## Blocages avant une déclaration « en production »

- Le contrôle externe « Workers Builds: canadacase » a retourné un échec sur un commit antérieur de la branche de livraison. Aucun nouveau contrôle Cloudflare n'apparaît sur le commit de fusion. Le détail technique du build n'est pas disponible via la connexion GitHub/Supabase actuelle ; il faut ouvrir le build dans le tableau de bord Cloudflare et lire son journal.
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

Le code est fusionné dans `main` et le workflow GitHub est réussi. La mise en production n'est toutefois pas confirmée : il faut résoudre/valider le build Cloudflare signalé en échec et effectuer un test réel authentifié avant de déclarer le service pleinement opérationnel.
