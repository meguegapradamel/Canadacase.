# CanadaCase Academy — phase 15 : durcissement des RPC et audit de sécurité

Date : 16 novembre 2026
Projet Supabase : `qxaykieolvbzaxmfaack`

## Modifications

Les quatre RPC Academy qui nécessitent un accès privilégié ont été déplacées dans le schéma privé :
- `academy_grade_lesson_quiz`
- `academy_review_trainer_application`
- `academy_save_lesson_quiz_question`
- `academy_submit_trainer_application`

Les fonctions publiques gardent les mêmes noms et signatures pour ne pas casser l'interface. Elles sont désormais `SECURITY INVOKER`, avec `search_path` vide, et délèguent au traitement privé `SECURITY DEFINER` qui conserve les contrôles d'identité, d'état actif, de propriété ou de rôle administrateur. Les droits EXECUTE anonymes sont révoqués ; les appels authentifiés restent autorisés.

Migration appliquée :
- `academy_phase15_move_security_definer_rpc_implementations_private_20261116`

## Vérifications

- Les quatre wrappers publics sont `SECURITY INVOKER`.
- Aucun de ces wrappers n'est exécutable par `anon`.
- Les implémentations privées gardent `search_path = ''`, refusent `anon` et sont appelables par le rôle authentifié via les wrappers.
- Un test de parcours a confirmé que le wrapper public appelle l'implémentation privée et que celle-ci refuse un quiz sans inscription active.
- RLS activé sur les 33 tables Academy du schéma public.
- Supabase Health Advisor : aucun avertissement.

## Durcissement complémentaire du portail immigration

Après la revue des trois anciennes fonctions administratives, leurs contrôles explicites `private.is_case_admin()` et leur `search_path` vide ont été vérifiés. Les implémentations ont été déplacées dans le schéma privé et des wrappers publics SECURITY INVOKER ont conservé les mêmes noms/signatures pour ne pas casser le portail :
- `admin_set_case_status`
- `admin_set_case_status_for_case`
- `admin_set_document_status`

Migration appliquée :
- `security_move_legacy_admin_rpc_implementations_private_20261116`

Un test avec un compte candidat a confirmé que les trois wrappers atteignent les contrôles d'administration privés et refusent l'accès non administrateur. Les appels anonymes sont révoqués.

## Alertes encore présentes

- La protection des mots de passe compromis reste désactivée dans Supabase Auth. Aucun outil connecté ne permet de modifier ce réglage Auth dans ce projet ; l'administrateur devra l'activer dans les paramètres Auth du tableau de bord Supabase.
- L'avis INFO « RLS activé sans policy » concerne notamment la table privée de clés de réponse, volontairement inaccessible par l'API, et plusieurs tables historiques immigration sans policy.
- Les avis Performance historiques signalent 26 clés étrangères non indexées, 8 groupes de policies permissives multiples et des index non encore utilisés. Ils concernent surtout le portail immigration préexistant et des index Academy encore peu sollicités. Aucune policy métier n'a été fusionnée ou supprimée à l'aveugle.
- Après ce durcissement, Security Advisor ne signale plus de fonction SECURITY DEFINER publique exécutable par `authenticated`. Health Advisor reste sans avertissement.

## Limites

- Pas de test d'intrusion externe ni de test navigateur authentifié réel.
- MFA administrateur et protection anti-abus restent à configurer dans Supabase Auth.
- Aucun service payant activé ; dépense supplémentaire : 0 FCFA.
