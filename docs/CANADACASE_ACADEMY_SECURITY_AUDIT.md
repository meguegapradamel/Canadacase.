# CanadaCase Academy — audit sécurité et risques de départ
Date : 16 novembre 2026
Projet Supabase : CanadaCase (`qxaykieolvbzaxmfaack`)
Statut : observations vérifiées par lecture du schéma, des fonctions et des Supabase Advisors. Aucun correctif de production appliqué dans cet audit.

## État technique
- Projet : `ACTIVE_HEALTHY`.
- PostgreSQL : 17.11.
- Tables Academy préexistantes : aucune table `academy_*` au moment du contrôle.
- `profiles.role` est limité par contrainte à `candidate`, `agent`, `admin`.
- Les tables historiques de dossiers et les tables de préparation linguistique sont déjà présentes.
- Les nouvelles tables publiques devront être explicitement exposées à la Data API selon le changement Supabase d'octobre 2026 ; cette configuration n'a pas encore été vérifiée.

## Résultats Supabase Advisors

### Sécurité
1. 9 tables ont RLS activé sans aucune politique : les lignes sont alors inaccessibles par les rôles API concernés tant qu'aucune politique n'est ajoutée. Il ne faut pas leur ajouter une politique permissive sans vérifier l'usage métier et les données.
2. 3 fonctions SECURITY DEFINER exposées aux utilisateurs authentifiés déclenchent un avertissement :
   - `public.admin_set_case_status(uuid,text)`
   - `public.admin_set_case_status_for_case(uuid,text)`
   - `public.admin_set_document_status(uuid,text,text)`
3. Le code de ces trois fonctions vérifié contient un contrôle `private.is_case_admin()` avant toute opération, un `search_path` vide et une journalisation des actions. La fonction privée vérifie `auth.uid()`, `profiles.role='admin'` et le compte actif. L'accès `anon` est refusé ; l'exécution authentifiée est autorisée pour permettre aux administrateurs connectés d'utiliser ces actions. Aucune modification n'est recommandée sans tests fonctionnels et de non-régression.
4. La protection Auth contre les mots de passe compromis est désactivée. À activer dans les paramètres Auth après évaluation des contraintes du plan et tests de connexion/réinitialisation.

### Performance
- 26 clés étrangères sans index couvrant signalées.
- 29 index non utilisés signalés.
- 8 cas de politiques permissives multiples signalés.
Ces éléments sont des avertissements de performance, pas une preuve de fuite de données. Ne pas supprimer ni ajouter en masse des index/politiques : vérifier les requêtes, volumes et usages avant toute correction.

### Santé
- Aucun avertissement de santé retourné au moment du contrôle.

## Mesures de protection retenues pour Academy
- Ne pas modifier `profiles.role`.
- Préfixer les nouvelles tables `academy_`.
- RLS obligatoire, privilèges par colonne lorsque possible.
- Le rôle apprenant peut être demandé par l'utilisateur ; les rôles formateur/entreprise/partenaire sont attribués par un flux serveur validé.
- Les décisions de candidature, paiements, remboursements, commissions et certificats ne sont jamais modifiables depuis le navigateur.
- Pas de clé service_role/secret dans GitHub ou le navigateur.
- Pas de migration Academy en production tant qu'un environnement isolé et les tests RLS ne sont pas disponibles.

## Blocage environnement
La création d'une branche Supabase de développement a retourné une demande de confirmation de coût récurrent. Aucune branche n'a été créée et aucune dépense n'a été engagée. Il faut communiquer le coût exact et obtenir l'accord explicite avant de poursuivre dans cette voie.

## Tests obligatoires avant la première mise en production
- Apprenant A ne lit/modifie aucune donnée privée de B.
- Apprenant ne peut pas s'attribuer le rôle formateur, admin, partenaire ou organisation.
- Candidat formateur ne peut ni changer le statut de sa candidature ni s'approuver.
- Administrateur peut examiner et traiter les candidatures via un endpoint serveur authentifié.
- Les fonctions historiques de dossiers et documents continuent de fonctionner.
- Les parcours TEF/TCF, cours, exercices et tentatives restent accessibles.
- Les nouvelles tables sont exposées uniquement si nécessaire et protégées par RLS.
- Supabase Advisors sont relancés après migration.
