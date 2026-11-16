# CanadaCase Academy — rapport Phase 7 : droits d’accès, réservations et formations payantes

Date : 16 novembre 2026

## Statut
La phase 7 est appliquée au projet Supabase Free existant et documentée dans la branche GitHub `academy/specification-v1`, PR #2. Les règles de consommation sont contrôlées par la base de données et non par le navigateur. Le test navigateur réel, la fusion de la PR et le déploiement Cloudflare ne sont pas effectués.

## Modifications réalisées

### Droits créés après validation du paiement
- Les offres de type `course` et `live_session` créent désormais un droit dédié après validation administrative.
- Un accès cours ou séance à l'unité comporte une unité.
- Un forfait conserve le nombre de séances acheté.
- Un abonnement utilise un droit sans compteur d'unités, limité par sa date d'expiration lorsqu'une durée est définie.
- Les examens blancs conservent leur droit dédié d'une unité.

### Réservations
- Une séance sans offre payante reste gratuite.
- Une offre en brouillon ou en attente de validation ne bloque pas les réservations gratuites.
- Une séance associée à une offre active ou suspendue exige un droit valide.
- Le droit est verrouillé en base avant la réservation, ce qui évite qu'une même unité soit utilisée simultanément par deux réservations.
- Une séance individuelle achetée à l'unité consomme son droit ; un forfait débite une unité ; un abonnement valide ne débite pas d'unité.
- Les séances de type examen blanc peuvent utiliser un droit d'examen blanc du formateur, ou un droit séance/forfait/abonnement correspondant.
- Une annulation autorisée avant le début restitue l'unité consommée. La restauration est inscrite dans le journal des consommations.

### Formations payantes
- L'inscription à une formation gratuite reste immédiate.
- Une formation associée à une offre payante active ou suspendue exige un droit de cours correspondant ou un abonnement actif du formateur.
- Le droit de cours à l'unité est consommé à l'inscription ; l'inscription existante conserve ensuite l'accès.
- Les modules, leçons et ressources d'un cours payant sont protégés par les politiques RLS : accès réservé à l'apprenant inscrit, au formateur propriétaire et à l'administration.
- Les contrôles d'accès des quiz et devoirs restent basés sur l'inscription.

### Journal et sécurité
- Nouvelle table : `academy_entitlement_consumptions`.
- RLS activé ; chaque apprenant ne lit que ses propres mouvements, l'administration peut auditer l'ensemble.
- Aucun droit d'insertion, de mise à jour ou de suppression directe n'est accordé au navigateur sur ce journal.
- Les consommations et restitutions sont exécutées dans les triggers privés, avec verrouillage de ligne.
- Les nouvelles fonctions sont dans le schéma privé, `SECURITY DEFINER`, `search_path` vide et exécution directe révoquée.

## Tests transactionnels effectués
Les scénarios ont été exécutés avec des comptes existants et des rôles temporaires, dans des transactions annulées :

1. Réservation d'une séance payante sans droit : refusée.
2. Réservation avec un droit séance valide : acceptée et unité débitée.
3. Annulation autorisée avant le début : unité restituée et journal marqué comme restauré.
4. Inscription à une formation payante sans droit : refusée.
5. Déclaration de paiement et validation par l'administration : création du droit cours confirmée.
6. Inscription après paiement : acceptée, unité du droit cours débitée et mouvement journalisé.
7. Les transactions de test ont été annulées ; aucun compte, rôle temporaire, cours, offre, paiement, réservation ou droit de test n'est conservé.

## Migrations appliquées
- `academy_phase7_entitlement_enforcement_20261116`
- `academy_phase7_paid_content_access_guards_20261116`
- `academy_phase7_subscription_course_access_20261116`

## Interface
- La page de réservation affiche désormais les droits payants actifs et le nombre d'unités restantes.
- Le texte explique la distinction entre créneaux gratuits et séances payantes.
- Le navigateur affiche les droits issus de Supabase ; il ne peut pas les créer ou les débiter lui-même.
- GitHub Actions run 43967152564 : 24/24 étapes réussies, y compris la syntaxe JavaScript, les contrôles de réservation/capacité et les vérifications de paiement. Le dry-run Cloudflare vérifie la préparation des assets mais ne réalise pas de déploiement.

## Avis Supabase après migration
- Health Advisor : aucun avertissement.
- Aucun nouveau signalement Security sur les tables et fonctions ajoutées à la phase 7.
- Les alertes Security qui subsistent concernent des fonctions SECURITY DEFINER publiques et des tables historiques antérieures à cette phase, ainsi que la protection des mots de passe compromis désactivée.
- Les alertes Performance restantes concernent principalement des clés étrangères historiques non indexées et des index non encore utilisés ; les nouvelles tables sont encore vides hors tests transactionnels annulés.

## Limites restantes
- Les tentatives d'examen blanc autonomes ne débitent pas encore de droit ; les séances planifiées de type examen blanc utilisent le système de réservation.
- L'annulation d'une inscription à un cours ne restitue pas automatiquement le droit.
- Pas de remboursement automatique, de paiement automatique, de versement formateur ou de renouvellement récurrent.
- Les moyens Orange Money et MTN MoMo restent désactivés tant que l'administration n'a pas configuré et vérifié les coordonnées marchandes.
- Aucun test navigateur réel, aucune fusion de PR et aucun déploiement Cloudflare.

## Budget
- Projet Supabase Free existant.
- Dépense supplémentaire : 0.
- Aucun fournisseur ou service payant activé.
