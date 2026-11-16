# CanadaCase Academy — rapport de tests transactionnels Phase 1
Date : 16 novembre 2026
Statut : tests SQL et RLS de base réussis en transaction annulée.

## Objectif
Valider la syntaxe de la migration fondatrice et quelques règles RLS/GRANT sans créer de branche Supabase payante, sans ajouter de table persistante et sans modifier le fonctionnement de CanadaCase.

## Méthode sans frais
- Connexion au projet Supabase existant, forfait Free.
- Création temporaire du schéma `academy_sandbox` et des trois tables proposées, dans une transaction SQL explicite.
- Les références de profils pointaient vers des comptes existants, mais les lignes de test Academy étaient synthétiques.
- Exécution des scénarios avec le rôle PostgreSQL `authenticated` et une identité simulée par les claims JWT.
- Exécution de `ROLLBACK` à la fin de chaque scénario.
- Vérification indépendante après les tests : le schéma `academy_sandbox` n'existe pas dans la base. Aucun objet de test n'a été conservé.

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
| Un candidat tente de modifier lui-même le statut de candidature | Refusé comme prévu |
| Annulation de la transaction et absence du schéma temporaire | Confirmé |

## Portée et limites
Ces tests valident le SQL de fondation et les scénarios RLS élémentaires dans le contexte du projet actuel, mais ils ne remplacent pas un environnement de test indépendant. Les lignes de test et le schéma ont été annulés.

Pas encore vérifiés :
- approbation/refus par une Edge Function ou RPC serveur (non développée) ;
- accès administrateur et journalisation des décisions ;
- configuration d'exposition Supabase Data API ;
- téléversement et isolation des documents de formateurs ;
- interface web et parcours complet dans un navigateur ;
- compatibilité complète avec toutes les fonctions existantes ;
- restauration de sauvegarde et tests de charge.

## Décision
La migration reste un brouillon. Ne pas l'appliquer en production à ce stade. La prochaine tranche doit ajouter les actions serveur sécurisées et les tests correspondants, toujours sans service payant et sans modification des tables historiques.
