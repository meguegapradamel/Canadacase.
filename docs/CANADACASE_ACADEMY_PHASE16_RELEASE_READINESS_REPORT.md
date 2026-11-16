# CanadaCase / CanadaCase Academy — audit et état de préparation

Date de vérification : 17 novembre 2026  
Dépôt : `meguegapradamel/Canadacase.`  
Branche principale : `main`  
Projet Supabase : `qxaykieolvbzaxmfaack` (eu-west-1, ACTIVE_HEALTHY)

## État vérifié

- La PR #2 est fusionnée dans `main` (commit de fusion : `4b87c0bb99d134fa1439e96ff9cb0ce1492335c2`).
- Le dernier workflow GitHub observé est réussi : [run 43975465269](https://github.com/meguegapradamel/Canadacase./actions/runs/43975465269), commit `5349601e2f3e78140c09094880ea1dd5edebca4f`.
- Supabase est `ACTIVE_HEALTHY`; Health Advisor ne signale aucun problème.
- Les migrations Academy jusqu'à la phase 15 sont présentes dans l'historique Supabase.
- Les fonctions Edge observées sont actives : `admin-user-management`, `language-coach`, `grade-language-attempt`, `admin-send-update`, `sync-language-audio`, `manage-case-document`.
- Les migrations de sécurité ont déplacé les implémentations SECURITY DEFINER sensibles dans le schéma privé. L'Advisor ne signale plus de fonction SECURITY DEFINER publique exécutable par authenticated.

## Corrections réalisées pendant l'audit

### Index des clés étrangères

Supabase Performance Advisor signalait 26 clés étrangères sans index couvrant. La migration `20261116230452_add_missing_foreign_key_indexes_20261117` a été appliquée avec 26 index idempotents, sans modifier les données ni les règles RLS. Le fichier SQL correspondant est archivé dans `supabase/migrations/`.

### État de la documentation

Ce rapport remplace les anciennes mentions erronées indiquant que la PR #2 n'était pas fusionnée. La fusion et le dernier CI réussi ont été vérifiés directement dans GitHub.

## Points encore ouverts — à ne pas présenter comme corrigés

### 1. Déploiement Cloudflare non confirmé — BLOQUANT

- Le workflow GitHub exécute un dry-run Wrangler ; il ne publie pas le Worker.
- Le dernier build Cloudflare connu avait échoué sur un commit antérieur. Aucun build Cloudflare réussi et aucun contrôle externe post-fusion n'ont été confirmés.
- Le journal détaillé Cloudflare n'est pas accessible par les connexions GitHub/Supabase disponibles ici.
- Tant que le journal n'est pas lu, qu'un build réel n'est pas réussi et que l'URL n'est pas vérifiée, la production reste **non confirmée**.

Action requise : Cloudflare Dashboard → Workers & Pages → Worker `canadacase` → Builds → ouvrir le dernier échec et récupérer le journal. Ne jamais partager de mot de passe ni de jeton API.

### 2. Protection des mots de passe compromis — ACTION ADMIN

Supabase Security Advisor signale toujours `auth_leaked_password_protection`. La fonction doit être activée dans les paramètres Auth du projet. Aucun outil connecté ne permet de modifier ce réglage Auth ici.

Documentation : https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### 3. Politiques RLS permissives qui se chevauchent — AMÉLIORATION

Performance Advisor détecte 8 groupes de politiques permissives qui se chevauchent sur `case_assignments`, `case_deadlines`, `case_document_requirements`, `case_documents`, `case_messages`, `case_tasks` et `profiles`. Les définitions montrent des combinaisons admin/staff/candidat intentionnelles. Aucune fusion automatique n'a été faite, car une simplification non testée pourrait modifier les autorisations. À traiter avec tests de non-régression par rôle.

### 4. Tables RLS sans politique — INFO, actuellement restreintes

Advisor signale 10 tables : `private.academy_lesson_answer_keys` et neuf tables du portail immigration (`case_history`, `case_notes`, `case_observations`, `cases`, `education_records`, `family_members`, `language_tests`, `notifications`, `work_experiences`). Contrôle des privilèges effectué : pour les tables publiques listées, les privilèges de table visibles sont accordés à `postgres` et `service_role`, pas à `anon` ni `authenticated`. L'absence de politique empêche donc l'accès client direct ; ne pas ajouter de politique permissive sans besoin fonctionnel explicite.

### 5. Index non utilisés — INFO

Performance Advisor signale 76 index sans utilisation observée. Cela ne prouve pas qu'ils sont inutiles : la base est récente et plusieurs index sont prévus pour des parcours peu fréquents. Aucun index n'a été supprimé. Réévaluer après trafic réel et mesures.

### 6. Formateurs et corrections d'examens — PRÉREQUIS OPÉRATIONNEL

Lors du précédent contrôle, aucun rôle formateur actif ni affectation de correcteur n'était présent. Le système de candidature/validation et d'affectation existe, mais il faut approuver au moins un formateur et lui attribuer les examens pour tester la correction réelle.

### 7. Paiements Orange Money / MTN MoMo — MANUELS, PAS DE PASSERELLE

Les moyens Orange Money et MTN MoMo sont prévus dans le modèle mais restent désactivés tant que les coordonnées marchandes officielles ne sont pas configurées. Le flux actuel est une déclaration manuelle de paiement, vérifiée par l'administration. Aucun paiement automatique, reversement automatique ou API marchande n'est opérationnel.

### 8. IA pédagogique — COÛT EXTERNE POTENTIEL

Le dépôt documente `OPENAI_API_KEY` pour les fonctions de transcription/correction IA. L'API OpenAI est facturée séparément. Pour respecter le budget zéro, ne pas ajouter cette clé ni activer d'appel payant sans décision distincte. Les fonctions dépendantes restent indisponibles sans ce secret.

### 9. Tests utilisateurs réels — NON EFFECTUÉS

Les contrôles CI et tests transactionnels ne remplacent pas les tests authentifiés dans un navigateur. Il reste à tester les parcours candidat, administrateur et formateur sur ordinateur et iPhone/Safari, notamment inscription, confirmation d'e-mail, connexion, création/suppression de dossier, téléversement de documents, examens, réservations, paiements manuels et droits d'accès.

## Budget

- Aucune ressource payante ajoutée par cet audit.
- Aucune API payante activée.
- Dépense supplémentaire engagée : 0 FCFA.

## Conclusion

Le code principal est fusionné et le dernier CI GitHub est réussi. Les 26 index de clés étrangères manquants ont été ajoutés. La base Supabase est saine au niveau Health Advisor. Le projet n'est cependant pas prêt à être déclaré pleinement en production tant que Cloudflare n'a pas fourni un build réussi, que la protection des mots de passe compromis n'est pas activée et que les parcours réels par rôle n'ont pas été testés.
