# CanadaCase Academy — rapport Phase 6 : tarification et paiements Mobile Money

Date : 16 novembre 2026

## Statut
La fondation tarifaire et le parcours de paiement manuel contrôlé sont appliqués au projet Supabase Free existant. Les pages de gestion sont dans la branche GitHub `academy/specification-v1`, PR #2, toujours ouverte en brouillon. La mise en production Cloudflare et le test navigateur réel ne sont pas effectués.

## Décision de coût et fournisseurs
Aucun prestataire automatique n'a été activé car les offres consultées comportent des coûts ou des conditions commerciales à clarifier :
- Orange Money Web Payment : réservé aux marchands approuvés ; Orange demande de contacter l'opérateur pour les coûts. Les documents Y-Note consultés indiquent des frais d'accès de 20 000 FCFA (solution mutualisée) ou 40 000 FCFA (accès API direct), puis des commissions contractuelles.
- MTN MoMo : le tarif marchand affiché indique que le paiement marchand est gratuit pour le client, mais cela ne prouve pas que l'accès API marchand ni l'encaissement pour le commerçant soient sans frais.
- CamerPay : plan Starter annoncé gratuit jusqu'à 100 transactions/mois, mais commission par transaction (3 % sur l'offre Starter décrite sur la page tarifaire consultée).
- MooniePay : aucun frais de configuration ni abonnement mensuel annoncé, mais commission de 1,70 % par transaction réussie.
Ces options ne répondent donc pas à la condition « aucun coût ». Aucun compte marchand n'a été ouvert, aucun contrat accepté, aucune clé API saisie et aucune transaction réelle lancée.

Sources publiques consultées :
- Orange Money Web Payment : https://developer.orange.com/apis/om-webpay/faq
- Y-Note : https://www.y-note.cm/faq-paynote-api/
- Tarification Y-Note PDF : https://www.y-note.cm/wp-content/uploads/2024/07/conditions-particulieres-du-service-Orange-Money-de-paynote-comme-moyen-de-paiement_.pdf
- MTN Cameroon : https://mtn.cm/fr/tarifs-momo/
- CamerPay : https://camerpay.biz/solutions/e-commerce-cameroun
- MooniePay : https://pay.movemoonie.com/fr/pricing

## Fonctionnalités créées
- Administration : définir les fourchettes de prix par catégorie et le taux de commission variable.
- Formateurs : créer un brouillon d'offre, renseigner prix, type de produit, nombre de séances, durée et cycle, puis soumettre à l'approbation administrative. Un formateur ne peut pas publier sa propre offre.
- Administration : approuver, renvoyer pour correction ou suspendre une offre.
- Apprenants : consulter les offres publiées, créer une commande avec montant figé par la base, consulter le statut et soumettre une déclaration de paiement.
- Moyens configurables : Orange Money, MTN Mobile Money, virement bancaire et espèces. Orange Money et MTN MoMo sont créés mais désactivés par défaut ; l'administration doit saisir le numéro marchand, le nom du bénéficiaire et les instructions officielles avant de les activer.
- Paiement manuel : l'apprenant fournit son numéro expéditeur et la référence de transaction opérateur. Aucun code PIN ni mot de passe Mobile Money n'est demandé.
- Administration : vérifier le paiement sur le compte marchand puis approuver ou rejeter la déclaration. Une commande ne passe jamais à « payée » depuis le navigateur de l'apprenant.
- Journal financier : encaissement brut, commission de la plateforme et montant net dû au formateur, calculés depuis les taux et montants figés dans la commande.
- Droits d'accès : une confirmation de paiement crée un droit pour un examen blanc, un forfait ou un abonnement ; les forfaits conservent le nombre d'unités achetées et les abonnements une date d'expiration. Les renouvellements sont manuels.

## Tables ajoutées
- `academy_pricing_rules`
- `academy_payment_methods`
- `academy_offers`
- `academy_payment_orders`
- `academy_payment_submissions`
- `academy_financial_ledger`
- `academy_entitlements`

## Sécurité et contrôles
- RLS activé sur toutes les nouvelles tables ; aucun accès SELECT anonyme.
- Droits SQL minimaux : aucune mise à jour ou suppression directe des commandes, déclarations, journal financier ou droits d'accès pour les utilisateurs authentifiés.
- Les prix, commissions et montants des commandes sont recalculés/figés côté base, pas fournis par le navigateur.
- Une référence de transaction ne peut pas être réutilisée pour le même opérateur.
- Une seule déclaration de paiement en attente par commande.
- La fonction de validation admin est un wrapper SECURITY INVOKER ; l'implémentation privilégiée est dans le schéma privé, avec contrôle admin explicite et exécution directe révoquée.
- Les écritures financières et le droit d'accès sont créés dans la même transaction que la confirmation du paiement.
- Aucun reçu image n'est téléversé : l'upload de justificatif est différé jusqu'à la mise en place d'un stockage privé et de règles d'accès vérifiées.

## Tests transactionnels effectués
Tests effectués sur des rôles temporaires attribués à des comptes existants, puis rollback :
- Création d'une règle tarifaire et activation temporaire d'un moyen de paiement de test.
- Création d'une offre formateur, soumission, approbation admin.
- Création de commande : montant et commission pris depuis l'offre active.
- Déclaration Mobile Money et confirmation admin via RPC.
- Calcul de commission et montant net vérifiés.
- Création du droit forfait (5 unités) et du droit examen blanc vérifiée.
- Journal financier : trois lignes de ventilation attendues.
- Aucune donnée de test conservée.

## Limites
- Pas d'API automatique Orange Money ou MTN MoMo, car aucun contrat/fournisseur à coût nul n'a été vérifié.
- Les coordonnées marchandes Orange/MTN sont vides et les méthodes désactivées tant que l'administration ne les renseigne pas.
- Les droits d'accès sont enregistrés, mais leur consommation automatique dans les réservations, examens blancs et contenus de cours sera reliée dans une phase suivante.
- Les paiements récurrents sont des renouvellements manuels ; aucun prélèvement automatique.
- Aucun remboursement automatique, versement formateur ou réconciliation bancaire automatique.
- Pas de téléversement de reçu.
- Pas de test navigateur réel, fusion PR ou déploiement Cloudflare.

## Vérification automatisée et avis Supabase
- GitHub Actions run 43965079156 : succès, 24 étapes réussies, dont la validation de la page de paiements et des contrôles côté navigateur.
- Supabase Health Advisor : aucun avertissement.
- Aucun nouveau constat de sécurité ni d'optimisation RLS sur les nouvelles tables après correction des politiques.
- Les index des nouvelles tables apparaissent comme non utilisés car les tables sont vides ; c'est attendu avant l'exploitation.
- Des avertissements historiques restent sur des tables/fonctions préexistantes, notamment protection contre les mots de passe compromis désactivée ; ils ne sont pas introduits par cette phase.

## Budget
- Supabase Free existant.
- Aucune branche ou projet payant créé.
- Aucun prestataire payant activé.
- Aucun frais ou transaction réel engagé : 0 FCFA supplémentaire.

## Migrations appliquées
- `academy_phase6_pricing_mobile_money_manual_payments_20261116`
- `academy_phase6_policy_deduplication_20261116`
- `academy_phase6_entitlement_snapshots_20261116`
- `academy_phase6_subscription_rule_null_guard_20261116`
- `academy_phase6_security_wrapper_and_fk_indexes_20261116`
- `academy_phase6_least_privilege_grants_20261116`
- `academy_phase6_rls_initplan_optimization_20261116`
