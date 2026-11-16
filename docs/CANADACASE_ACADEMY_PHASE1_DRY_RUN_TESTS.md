# CanadaCase Academy — rapport de tests transactionnels Phase 1
Date : 16 novembre 2026
Statut : fondation Phase 1 installée ; tests SQL et RLS réussis en transaction annulée sur le schéma installé.

## Objectif
Valider la syntaxe de la migration fondatrice et quelques règles RLS/GRANT sans créer de branche Supabase payante, sans ajouter de table persistante et sans modifier le fonctionnement de CanadaCase.

## Méthode sans frais
- Connexion au projet Supabase existant, forfait Free.
- Migration `academy_phase1_foundation_20261116` appliquée : trois tables Academy, index, politiques RLS, privilèges SQL et deux RPC sécurisées.
- Dry-run initial puis tests de workflow exécutés dans des transactions SQL explicites avec `ROLLBACK`.
- Les références de profils pointaient vers des comptes existants, mais les lignes de test Academy étaient synthétiques.
- Exécution des scénarios avec le rôle PostgreSQL `authenticated` et une identité simulée par les claims JWT.
- Exécution de `ROLLBACK` à la fin de chaque scénario.
- Vérification indépendante après les tests : les tables Academy ne contiennent aucune ligne de test ; le schéma temporaire `academy_sandbox` n'existe pas. Aucun objet de test n'a été conservé.

Aucune branche, aucun projet, aucun abonnement ni aucune ressource facturée n'a été créé.

## Résultats vérifiés

| Scénario | Résultat |
|---|---|
| Syntaxe DDL des trois tables, index, politiques RLS et GRANT | Réussi |
| Un apprenant lit son profil Academy | Réussi : 1 ligne visible |
| Un apprenant ne lit pas le profil d'un autre candidat | Réussi : 0 ligne visible |
| Un apprenant modifie son propre profil | Réussi |
| Un apprenant s'attribue le rôle formateur | Refusé comme prévu |
| Un apprenant s'inscrit avec le rôle learner | Réussi |
| Un candidat crée une candidature au statut draft | Réussi |
| Un candidat soumet sa candidature via la fonction contrôlée | Réussi : passage à submitted et date enregistrée |
| Un candidat tente d'approuver lui-même sa candidature | Refusé comme prévu |
| Un administrateur actif approuve la candidature via la RPC sécurisée | Réussi |
| L'approbation attribue le rôle trainer | Réussi |
| La décision est inscrite dans admin_action_log | Réussi |
| Un candidat tente de modifier directement le statut de candidature | Refusé comme prévu |
| Soumission via RPC contrôlée après vérification des champs | Réussi |
| Appel de la RPC de décision par un candidat | Refusé comme prévu |
| Approbation par un administrateur actif via RPC sécurisée | Réussi |
| Attribution automatique du rôle trainer après approbation | Réussi |
| Journalisation dans admin_action_log | Réussi
| Annulation de la transaction et absence du schéma temporaire | Confirmé |

## Portée et limites
La fondation de données est désormais installée dans le projet Supabase existant. Les scénarios RLS et RPC ont été testés avec des identités simulées dans des transactions annulées, sur les tables réellement installées. Cette méthode valide le SQL et le contrôle d'accès testé, mais ne remplace pas un environnement de staging indépendant. Les lignes de test ont été annulées.

Pas encore vérifiés :
- refus/suspension, réexamen, révocation du rôle et cas de candidatures multiples ;
- appel des RPC depuis le navigateur et configuration d'exposition Data API ;
- accès administrateur et journalisation des décisions ;
- configuration d'exposition Supabase Data API ;
- téléversement et isolation des documents de formateurs ;
- interface web et parcours complet dans un navigateur ;
- compatibilité complète avec toutes les fonctions existantes ;
- restauration de sauvegarde et tests de charge.

## Décision
La fondation de données et les deux RPC contrôlées sont installées. Ne pas activer encore de parcours navigateur : vérifier l'exposition Data API et construire l'interface Academy derrière une entrée séparée. Les tables historiques CanadaCase n'ont pas été modifiées.
