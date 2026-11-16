# CanadaCase Academy — rapport de validation Phase 1
Date : 16 novembre 2026

Statut : fondation SQL installée sur le projet Supabase existant ; tests SQL, RLS, RPC et privilèges réussis en transactions annulées.

## Périmètre installé
- `academy_profiles` : profil apprenant.
- `academy_user_roles` : rôles Academy séparés des rôles historiques.
- `academy_trainer_applications` : candidature et statut formateur.
- RLS activé sur les trois tables, 9 politiques consolidées (3 par table).
- RPC `academy_submit_trainer_application` et `academy_review_trainer_application`.
- Index de recherche et d'intégrité.
- Privilèges Data API minimaux : aucun droit `anon`, droits `authenticated` limités, `service_role` réservé au serveur.

## Migrations installées
- `academy_phase1_foundation_20261116`
- `academy_trainer_review_state_transitions_20261116`
- `academy_rls_policy_consolidation_20261116`
- `academy_review_decision_null_guard_20261116`
- `academy_restrict_data_api_grants_20261116`

## Méthode de test sans frais
- Utilisation du projet Supabase CanadaCase existant, forfait Free.
- Aucun projet ou branche Supabase supplémentaire créé.
- Les tests ont inséré des lignes synthétiques en utilisant des identités de comptes existants, puis ont exécuté les scénarios sous le rôle PostgreSQL `authenticated` avec des claims JWT simulés.
- Chaque scénario s'est terminé par `ROLLBACK`.
- Vérification finale : zéro ligne de test dans les trois tables Academy ; le schéma temporaire `academy_sandbox` n'existe pas.
- Les tests transactionnels ne remplacent pas un environnement de staging indépendant.

## Résultats vérifiés

| Contrôle | Résultat |
|---|---|
| Syntaxe des tables, index, politiques, privilèges et RPC | Réussi |
| RLS activé sur les trois tables | Réussi |
| Un candidat voit son profil mais pas celui d'un autre | Réussi |
| Rôle `anon` sans accès aux tables Academy | Réussi |
| `authenticated` sans UPDATE global | Réussi |
| Modification du propriétaire `user_id` interdite au candidat | Réussi |
| Modification du statut de candidature directement par le candidat | Refusée |
| Auto-inscription au rôle `learner` | Réussie |
| Auto-attribution du rôle `trainer` | Refusée |
| Création et soumission d'une candidature | Réussies |
| Auto-approbation par un candidat | Refusée |
| Approbation par un administrateur actif | Réussie |
| Attribution du rôle `trainer` après approbation | Réussie |
| Transition incohérente depuis le statut approuvé | Refusée |
| Suspension et retrait du rôle formateur | Réussis |
| Réapprobation et rétablissement du rôle formateur | Réussis |
| Décisions enregistrées dans `admin_action_log` | Réussi |
| Décision administrative nulle | Refusée |
| Absence de lignes de test après rollback | Confirmée |

## Contrôles Supabase Advisors après correction
- 9 tables historiques avec RLS mais sans politique : alertes préexistantes, hors périmètre Academy.
- 5 fonctions SECURITY DEFINER exécutables par les utilisateurs authentifiés : 3 fonctions historiques et 2 RPC Academy intentionnelles. Les deux RPC Academy vérifient l'identité et les autorisations, ont un `search_path` vide et refusent l'exécution par `anon`.
- 26 clés étrangères sans index couvrant, toutes sur des tables historiques après indexation des nouvelles clés Academy.
- 32 index non utilisés signalés, dont les nouveaux index Academy encore peu sollicités.
- 8 cas de politiques permissives multiples, tous sur des tables historiques ; aucun sur les tables Academy.
- Aucun avertissement de santé.

## Ce qui reste à vérifier
- Appels REST/RPC depuis un navigateur authentifié réel.
- Parcours candidat et administrateur de bout en bout.
- Téléversement privé et contrôle des pièces justificatives des formateurs.
- Tests de non-régression du portail immigration et TEF/TCF.
- Accessibilité, mobile, sécurité complémentaire et restauration.

## État de livraison
L'interface initiale `academy.html` et `assets/academy.js` a été ajoutée à la branche GitHub. Les fichiers `assets/academy.js` et `assets/app.js` passent le contrôle syntaxique JavaScript. Le navigateur réel n'a pas été testé et aucun déploiement Cloudflare n'a été effectué. Les modifications de code restent dans la PR ouverte.

Aucun coût supplémentaire n'a été engagé. Les tables historiques et les données métier existantes n'ont pas été modifiées.
