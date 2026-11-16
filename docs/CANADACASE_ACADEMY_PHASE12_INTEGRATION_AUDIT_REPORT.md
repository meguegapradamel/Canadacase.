# CanadaCase Academy — rapport Phase 12 : audit d’intégration et parcours payant du catalogue

Date : 16 novembre 2026
Branche : `academy/specification-v1`
Projet Supabase : CanadaCase (`qxaykieolvbzaxmfaack`)

## Statut

Audit de l’intégration effectué sur le code GitHub et la base Supabase existante. Un défaut d’interface a été corrigé : le catalogue ne présentait plus systématiquement une formation comme gratuite lorsqu’une offre payante active lui était liée. La navigation du catalogue contenait également un lien d’examens dupliqué.

Aucune migration SQL n’a été appliquée pendant cette phase. Aucune donnée métier existante n’a été modifiée ou supprimée.

## Inventaire vérifié

- 71 tables dans le schéma public, dont 33 tables Academy.
- Bibliothèque linguistique historique : 51 cours publiés, 70 exercices et 170 questions d’exercice.
- Examens blancs Academy : 2 examens publiés et 168 questions enregistrées.
- Les 51 cours et 70 exercices historiques sont conservés dans les tables `language_courses` et `language_exercises`; les nouvelles tables `academy_courses` et `academy_lessons` restent vides tant qu’un formateur ou un administrateur n’a pas créé de nouvelles formations.
- Aucun compte ne détient actuellement de rôle Academy `trainer`, aucune candidature formateur n’est enregistrée et aucune offre, commande, réservation ou inscription de nouvelle formation n’est présente dans les tables Academy correspondantes.
- Des tentatives et soumissions linguistiques historiques existent déjà ; elles ont été laissées intactes.

L’absence d’offres et de réservations réelles signifie que les écrans de paiement et de réservation ne peuvent pas encore être validés avec un vrai achat ou une vraie séance sans créer des comptes et transactions de test.

## Correctifs de l’interface

### Catalogue et paiement des formations

- Le catalogue charge maintenant les offres de formation actives visibles à l’apprenant, conformément à la politique RLS de `academy_offers`.
- Une formation avec une offre payante active affiche « Voir l’offre et payer » et conduit à la page des tarifs et paiements.
- Une formation sans offre payante active conserve l’inscription directe, sans prétendre à tort que toutes les formations sont gratuites.
- Le contrôle serveur existant reste la protection finale : une inscription à une formation payante sans droit valide est refusée par le trigger PostgreSQL.
- La page de catalogue ne comporte plus deux liens identiques vers les examens et certificats.
- Version de cache du script catalogue portée à `20261116-07`.

### Tests automatisés ajoutés

Le workflow GitHub Actions vérifie désormais :
- la syntaxe JavaScript du catalogue ;
- la présence de la lecture des offres payantes actives ;
- le routage vers la page de paiement ;
- l’absence du libellé erroné « S’inscrire gratuitement » ;
- l’unicité du lien de navigation vers les examens ;
- la version de cache du script.

## Contrôles de sécurité et intégration

- Les politiques RLS de `academy_offers` permettent à un utilisateur actif de lire les offres actives, au formateur de lire ses propres offres et à l’administration de gérer les offres.
- Les commandes sont créées avec le seul identifiant d’offre ; les triggers serveur fixent l’acheteur, le montant, la commission et les données de référence.
- La déclaration de paiement ne confirme pas elle-même la commande. Seule la RPC administrative contrôlée confirme le paiement et crée les écritures du journal et le droit d’accès.
- Les triggers de réservation et d’inscription vérifient et consomment les droits payants côté base, et non uniquement dans le navigateur.
- Les RPC sensibles vérifiées conservent des contrôles d’identité et d’autorisation. Les fonctions SECURITY DEFINER signalées par Supabase ne sont pas modifiées à l’aveugle : les wrappers de quiz et de candidature sont protégés par des contrôles explicites, `search_path` vide et exécution refusée à `anon`.

## Avis Supabase relevés pendant l’audit

- Health Advisor : aucun avertissement.
- Security Advisor : avertissements historiques sur les tables RLS sans policy (dont la table privée de clés de réponses, volontairement inaccessible via l’API), sept fonctions SECURITY DEFINER accessibles à `authenticated` avec contrôles internes, et protection contre les mots de passe compromis désactivée.
- Performance Advisor : 26 clés étrangères historiques sans index couvrant et groupes de politiques permissives multiples sur des tables préexistantes.
- Ces avertissements ne sont pas des preuves automatiques de fuite. Ils nécessitent un audit séparé par table/fonction ; aucune politique permissive ou modification de privilège n’a été ajoutée pendant cette phase.

## Limites non levées

- Aucun test navigateur authentifié réel ni test iPhone/Safari n’a été effectué.
- Aucun compte formateur réel n’est encore approuvé/actif ; le flux de correction formateur attend une affectation administrative.
- Les paiements Orange Money et MTN MoMo sont manuels et restent désactivés tant que les coordonnées marchandes ne sont pas renseignées et vérifiées.
- Aucun paiement réel, remboursement, versement formateur ou renouvellement automatique n’a été exécuté.
- Le dry-run Wrangler n’est pas un déploiement Cloudflare.
- La PR #2 reste ouverte et non fusionnée.

## Budget

- Aucune migration ou branche Supabase supplémentaire créée.
- Aucun service payant, API payante, passerelle de paiement ou cron activé.
- Dépense supplémentaire engagée : 0 FCFA.

## Conclusion

Le défaut de présentation des formations payantes et le lien de navigation dupliqué sont corrigés dans la branche de travail. La validation GitHub Actions du commit contenant le nouveau contrôle doit être confirmée avant de considérer le contrôle CI de cette phase comme réussi. La mise en production reste bloquée par les validations navigateur réelles, la revue/fusion de la PR et le déploiement explicite.
