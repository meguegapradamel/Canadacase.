# CanadaCase Academy — phase 13 : activation des formations et droits de séances

Date : 16 novembre 2026
Branche : `academy/specification-v1`
Projet Supabase : `qxaykieolvbzaxmfaack`

## Réalisations

- Le catalogue lit les droits actifs du candidat et distingue un droit de cours correspondant d'un abonnement formateur valide.
- Après confirmation administrative du paiement, le candidat peut activer son inscription depuis le catalogue ; le trigger serveur consomme le droit de cours correspondant. Sans droit, l'inscription payante est refusée côté PostgreSQL.
- Les formateurs peuvent maintenant préparer des offres tarifaires pour un cours publié ou une séance future ouverte, en plus des examens blancs, forfaits, abonnements et autres prestations.
- La base valide le lien cours/formateur ou séance/formateur et impose la règle de prix active définie par l'administration.
- Les pages de paiement et de catalogue affichent les chemins d'accès nécessaires après paiement.

## Réservations et forfaits

- La logique de consommation côté base tient maintenant compte des offres de séance, examens blancs, forfaits et abonnements du formateur.
- Les droits sont verrouillés avant débit ; un forfait perd une unité à chaque réservation et un abonnement sans compteur ne perd pas d'unité.
- Les offres suspendues restent visibles aux utilisateurs authentifiés afin d'indiquer qu'un achat n'est plus disponible, sans autoriser la création d'une nouvelle commande.
- Migrations appliquées :
  - `academy_phase13_session_package_entitlement_enforcement_20261116`
  - `academy_phase13_allow_learners_to_see_suspended_booking_offers_20261116`

## Test transactionnel de réservation

Un scénario contrôlé a été exécuté avec des comptes existants et des rôles temporaires :
1. Création d'un créneau de groupe par un formateur temporairement autorisé.
2. Création et activation d'une offre de forfait après validation simulée par l'administration.
3. Création d'une commande et d'un droit de deux séances.
4. Première réservation : unité débitée et mouvement de consommation créé.
5. Deuxième candidat sans droit : réservation refusée par le trigger.
6. Suppression de toutes les données temporaires, des rôles et de la règle de test.

Contrôle final : zéro créneau, offre, rôle, réservation, droit, consommation ou règle de tarification de test restante.

## Limites

- Aucun formateur réel n'a encore le rôle Academy actif ; les formulaires sont prêts mais ne peuvent être validés par un vrai compte formateur tant qu'une candidature n'est pas approuvée.
- Aucune offre, commande, séance ou réservation réelle n'existe actuellement.
- Les paiements restent manuels ; Orange Money et MTN MoMo restent désactivés tant que les coordonnées marchandes ne sont pas configurées et vérifiées.
- Aucun test navigateur authentifié réel ni test iPhone/Safari n'a été effectué.
- Dépense supplémentaire : 0 FCFA.
