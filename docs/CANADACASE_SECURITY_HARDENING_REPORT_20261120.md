# CanadaCase — rapport de durcissement sécurité

Date : 20 novembre 2026  
Projet Supabase : `qxaykieolvbzaxmfaack`  
Dépôt : `meguegapradamel/Canadacase.`

## Réalisé

1. Audité les politiques RLS de dossiers, échéances, exigences documentaires, documents, messages, tâches et profils.
2. Renforcé les fonctions de contrôle d'accès Immigration pour exiger un compte actif et un agent actif affecté au dossier. Les profils candidats inactifs ne sont plus exposés aux agents par la fonction d'accès dédiée.
3. Renforcé la politique de lecture des documents du propriétaire pour exiger un compte actif.
4. Activé RLS sur `private.academy_mock_exam_answer_keys` et ajouté une politique explicite de refus pour `anon` et `authenticated`.
5. Ajouté `response_mode` à `academy_mock_exam_questions` pour ne pas avoir à exposer la grille de correction au navigateur pendant l'épreuve.
6. Ajouté un RPC qui restitue les grilles uniquement à un administrateur actif ou à un formateur actif affecté, pour une tentative soumise.
7. Adapté `assets/academy-exams.js` et actualisé le cache de `academy-exams.html`.
8. Enregistré les deux migrations appliquées dans le dépôt.

## Vérifications réalisées

- Migrations enregistrées dans l'historique Supabase : `20261120152845` et `20261120152915`.
- Fonctions de contrôle d'accès vérifiées en base : `SECURITY DEFINER`, `search_path = ''`.
- RPC de correction vérifié : wrapper public en `SECURITY INVOKER`, exécution limitée à `authenticated`, fonction privée protégée par contrôle de session, statut de tentative, rôle et affectation.
- Le code frontend ne demande plus `rubric` pendant l'épreuve et utilise le RPC pour la correction.

## Bloqueurs de livraison

- La révocation du privilège SELECT sur `rubric` et `explanation` doit attendre le déploiement vérifié du frontend modifié. Sinon, l'ancienne page pourrait échouer en sélectionnant encore ces colonnes.
- Le dernier workflow Cloudflare connu échouait car `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` manquaient dans les secrets GitHub Actions. Aucun nouveau déploiement ne peut être déclaré sans preuve.
- La protection contre les mots de passe compromis reste désactivée dans Supabase Auth.
- Les tests réels iPhone/Safari, le parcours complet candidat et le parcours de correction formateur restent à effectuer.

## Conclusion

Le durcissement DB initial et l'adaptation du code sont committés/appliqués. Le lot n'est pas déclaré entièrement livré en production tant que le workflow CI, le déploiement Cloudflare et les tests utilisateurs n'ont pas été confirmés. La version actuellement restaurée du site doit rester préservée.
