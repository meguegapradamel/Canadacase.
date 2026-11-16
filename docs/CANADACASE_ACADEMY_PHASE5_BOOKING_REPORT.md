# CanadaCase Academy — rapport Phase 5 : calendrier, séances et réservations

Date : 16 novembre 2026

## Statut
La phase 5 est installée sur le projet Supabase Free existant et ajoutée à la branche GitHub `academy/specification-v1`. La page `academy-bookings.html` et ses ressources sont dans la branche de travail. La PR #2 reste à examiner avant toute fusion. Aucun déploiement Cloudflare ni test navigateur réel n'est revendiqué.

## Fonctionnalités ajoutées
- Formateurs agréés : création de créneaux individuels, cours collectifs, ateliers et examens blancs.
- Association facultative à une formation publiée appartenant au formateur.
- Date/heure, durée, fuseau horaire IANA, capacité de 1 à 100 personnes.
- Apprenants : consultation des créneaux ouverts, réservation immédiate dans la limite des places, consultation de l'historique et annulation avant le début.
- Formateurs : liste des séances, places réservées, inscriptions, annulation d'une séance, clôture après l'horaire et enregistrement de la présence ou de l'absence après la fin.
- Une réservation conserve un instantané du titre, du type et des horaires pour que l'apprenant garde l'historique même si la séance est ensuite annulée.
- Navigation ajoutée depuis le profil Academy, le catalogue et le tableau de bord.
- Horaires stockés en `timestamptz`, avec le fuseau IANA du formateur ; l'affichage localise les dates pour l'utilisateur.

## Modèle de données
Deux tables :
- `academy_live_sessions` : créneaux publiés par un formateur, format, horaire, capacité, compteur de places et statut.
- `academy_bookings` : réservation nominative, statut et instantané des informations de séance.

Aucun enregistrement de démonstration n'a été conservé. Les créneaux sont publiés individuellement ; la répétition hebdomadaire automatique n'est pas encore incluse.

## Sécurité et intégrité
- RLS activé sur les deux tables.
- Aucun privilège Data API pour `anon`.
- Les apprenants lisent uniquement leurs réservations ; un formateur lit les réservations de ses propres séances ; l'administration conserve son accès.
- Seuls les comptes portant le rôle Academy `trainer` peuvent publier des créneaux.
- Le navigateur ne peut pas écrire le compteur de places ni modifier l'identité du formateur ou du réservataire.
- Un verrouillage de ligne sur la séance protège le contrôle de capacité lors de réservations concurrentes.
- Un verrou transactionnel par formateur et une vérification d'intervalles empêchent deux créneaux ouverts qui se chevauchent.
- Le compteur de places est incrémenté à la réservation et décrémenté à l'annulation.
- Le type, les horaires et le cours lié ne peuvent pas être déplacés après une réservation.
- Si le formateur annule une séance, toutes les réservations confirmées passent automatiquement à « annulée par le formateur » et les places sont libérées ; l’apprenant voit ce statut dans son historique.
- Les fonctions de garde sont dans le schéma privé, en `SECURITY DEFINER` avec `search_path` vide et exécution directe révoquée ; elles ne sont appelées que par les triggers.

## Vérifications effectuées
Tests transactionnels avec rôles temporaires attribués à des comptes existants, puis annulation complète de la transaction :
- Création d'un créneau par un formateur autorisé.
- Réservation par un apprenant.
- Compteur de places incrémenté puis décrémenté après annulation.
- Refus d'une seconde réservation lorsque la capacité est atteinte.
- Refus d'un créneau qui chevauche une autre séance du même formateur.
- Annulation par le formateur propagée aux réservations, avec libération automatique des places.
- Isolation RLS : un second apprenant ne voit pas la réservation ; le formateur concerné voit sa séance et sa réservation.
- Les tests n'ont laissé aucun rôle temporaire, créneau ou réservation en base.
- Les contrôles de santé Supabase n'ont retourné aucun avertissement.
- Les avertissements Security/Performance historiques restent présents sur des tables et fonctions préexistantes ; aucun nouveau signalement n'a été observé pour les deux tables de la phase 5.

## Limites non couvertes
- Pas de test navigateur réel avec des comptes formateur et apprenant.
- Pas de déploiement Cloudflare et pas de fusion de la PR.
- Pas de visioconférence intégrée ni de lien Zoom/Meet dans cette phase.
- Pas de paiement, commission, remboursement ou forfait ; aucun service payant n'a été activé.
- Pas de calendrier récurrent automatique ; les formateurs publient des créneaux ponctuels.
- Les règles commerciales détaillées d'annulation et de remboursement seront reliées à la phase paiements ultérieurement.
- Les notifications email/SMS/WhatsApp ne sont pas activées.

## Budget
- Projet Supabase Free existant.
- Aucun projet/branche Supabase payant.
- Aucun service externe payant activé.
- Coût supplémentaire engagé : 0.

## Migrations appliquées
- `academy_phase5_live_sessions_bookings_20261116`
- `academy_phase5_booking_snapshots_rls_20261116`
- `academy_phase5_booking_session_type_snapshot_20261116`
- `academy_phase5_reserved_seat_trigger_guard_fix_20261116`
- `academy_phase5_session_completion_workflow_20261116`
- `academy_phase5_propagate_trainer_cancellations_20261116`
- `academy_phase5_propagate_trainer_cancellations_20261116`

La validation GitHub Actions du commit 021a0005826d68f2fc075e6ba03f1d5f4fa6aa1b s'est terminée avec succès (run 43963905534). Les 20 étapes ont réussi, y compris le contrôle dédié au calendrier et aux réservations après le correctif d'annulation par le formateur. Le dry-run Wrangler reste un test à blanc et ne déploie pas le Worker.
