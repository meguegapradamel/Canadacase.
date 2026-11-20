# CanadaCase Academy — revue d'architecture et trajectoire cible
Version 1.2 — 20 novembre 2026
Dépôt : `meguegapradamel/Canadacase.`
Projet Supabase : `qxaykieolvbzaxmfaack`

## 1. Décision d'architecture

Conserver CanadaCase comme une plateforme web unique, avec deux domaines fonctionnels isolés : Immigration et Academy. Academy évolue comme un **monolithe modulaire** : pages et modules JavaScript séparés par domaine, services métier centralisés côté Supabase, et fonctions serveur pour les opérations privilégiées.

Ne pas entreprendre une réécriture générale vers React, Next.js, mobile natif ou une architecture microservices. Le dépôt actuel est un frontend statique HTML/CSS/JavaScript ; une migration de technologie avant stabilisation ajouterait du risque sans résoudre les points prioritaires.

Principes structurants :
- une identité Supabase commune, des profils et autorisations métier séparés ;
- séparation stricte des données Immigration et Academy ;
- PostgreSQL/Supabase comme source de vérité ;
- logique sensible exécutée et contrôlée côté serveur ;
- RLS et privilèges minimaux pour chaque table exposée ;
- modules frontend indépendants, sans duplication des règles métier ;
- contenu pédagogique traçable (source, droits, version, statut de publication) ;
- fonctionnalités activées progressivement après tests par rôle.

## 2. Architecture constatée

| Couche | État observé | Orientation |
|---|---|---|
| Interface | Pages HTML et modules JS/CSS dédiés à Academy | Conserver, factoriser les utilitaires partagés |
| Authentification | Supabase Auth partagé avec CanadaCase | Conserver l'identité, séparer les rôles métier |
| Données | PostgreSQL, tables `academy_*` et `language_*` | Garder les schémas/domaines clairement délimités |
| Sécurité | RLS, RPC privées et Edge Functions | Centraliser les contrôles sensibles et auditer les grants |
| IA | Edge Function `language-coach` et secret Gemini attendu | API serveur unique, quotas et limites d'usage |
| Paiements | Modèle de commandes/droits et validation manuelle | Pas d'automatisation financière sans fournisseur validé |
| Publication | Wrangler + GitHub Actions présents | Séparer validation CI, prévisualisation et publication réelle |

Pages Academy repérées : `academy.html`, `academy-catalog.html`, `academy-dashboard.html`, `academy-bookings.html`, `academy-payments.html`, `academy-exams.html`, `academy-coach.html`.

Fonctions Edge repérées dans le dépôt : `admin-user-management`, `admin-send-update`, `grade-language-attempt`, `language-coach`, `manage-case-document`, `sync-language-audio`.

Cette liste décrit les fichiers du dépôt ; elle ne prouve pas que chaque parcours fonctionne en production.

## 3. Découpage fonctionnel recommandé

### A. Identité et autorisations
- `auth.users` demeure l'identité technique.
- `profiles` conserve les rôles historiques du portail immigration.
- Les rôles Academy restent dans les tables `academy_*`.
- Un même compte peut être candidat immigration et apprenant Academy.
- Un refus ou une suspension de candidature formateur ne doit pas désactiver le compte apprenant.
- Les rôles privilégiés, affectations de correcteurs et décisions d'approbation sont attribués côté serveur et journalisés.
- À terme, remplacer les contrôles dispersés de rôles par des fonctions de permission réutilisables, testées pour chaque action.

### B. Catalogue et gestion des contenus
- Domaines → programmes → cours → modules → leçons.
- Ressources, exercices, examens et pièces jointes sont des objets distincts liés par identifiants.
- Chaque contenu possède un statut explicite : brouillon, soumis, à corriger, approuvé, publié, archivé.
- La publication conserve l'auteur, le validateur, les dates et l'historique des versions.
- Les contenus officiels/historiques exigent une source vérifiable et des droits de diffusion établis.
- Les contenus originaux CanadaCase doivent être identifiés comme tels ; ne jamais les présenter comme des sujets officiels.
- La bibliothèque doit être alimentée progressivement avec des contenus contrôlés, pas par génération massive non relue.

### C. Moteur pédagogique commun
- Un service métier commun doit gérer les tentatives, réponses, corrections, progression et résultats.
- Les quiz à choix multiples sont corrigés côté serveur ; les clés restent dans le schéma privé.
- Les productions écrites/orales distinguent transcription, analyse IA, correction humaine et résultat final.
- Toute note IA est qualifiée d'indicative ; elle ne devient jamais automatiquement une certification officielle.
- Les examens blancs, exercices et leçons réutilisent les mêmes mécanismes de tentative et de progression lorsqu'ils partagent les mêmes règles.

### D. Coach IA et médias
- Le navigateur ne contacte jamais directement un fournisseur IA avec une clé secrète.
- Les appels IA passent par une Edge Function authentifiée.
- Vérifier l'identité, l'état du compte, les limites de taille et de durée, le type MIME, les quotas et les droits d'accès aux fichiers avant traitement.
- Prévoir une limite d'usage par utilisateur et un mécanisme de refus propre en cas de quota ou d'absence de clé.
- Les enregistrements audio sont stockés dans un bucket privé, avec chemin propriétaire, durée de conservation et suppression définis.
- La transcription automatique doit être présentée comme telle et peut contenir des erreurs ; elle ne permet pas d'évaluer fiablement la prononciation.

### E. Réservations, droits et finances
- La base contrôle les capacités, chevauchements, réservations et transitions.
- Les droits/forfaits sont consommés dans une transaction atomique ; les consommations et restitutions sont journalisées.
- Les commandes confirmées et les mouvements financiers sont immuables ou corrigés par écritures compensatoires, pas par modification silencieuse.
- Les paiements Mobile Money restent manuels tant qu'un compte marchand et une API contractuelle ne sont pas validés.
- Les remboursements, annulations et restitutions doivent être spécifiés ensemble avant activation commerciale.
- Les soldes affichés ne doivent pas être calculés à partir de valeurs modifiables par le navigateur.

### F. Certificats et attestations
- Numéro unique généré côté serveur.
- QR code contenant un identifiant de vérification non devinable ou un jeton signé, sans donnée personnelle dans l'URL.
- Page publique de vérification limitée aux informations nécessaires : authenticité, titulaire selon consentement, programme, date, statut.
- Révocation et réémission historisées.
- Certificats bilingues FR/EN, présentation institutionnelle premium, mais aucun certificat ne doit être assimilé à un diplôme ou à une accréditation externe sans reconnaissance correspondante.

## 4. Règles de sécurité non négociables

1. Aucune clé `service_role`, `sb_secret` ou clé fournisseur dans le frontend ou le dépôt.
2. RLS activé sur les tables publiques exposées ; accès `anon` fermé par défaut.
3. Les tables privées de clés de correction et de données sensibles n'ont aucun privilège direct pour `anon` ou `authenticated`.
4. Les RPC privilégiées utilisent `SECURITY DEFINER` uniquement si nécessaire, avec `search_path` vide, contrôles explicites et EXECUTE minimal ; les wrappers publics restent `SECURITY INVOKER`.
5. Les fonctions Edge vérifient le JWT et le rôle à partir de données fiables côté serveur.
6. Les transitions d'état sont validées en base, pas uniquement dans l'interface.
7. Toute action administrative ou financière est auditée.
8. Les fichiers sensibles sont privés ; les liens signés sont temporaires.
9. Les changements de RLS, rôles, paiements et suppression de données exigent des tests de non-régression.
10. MFA administrateur, confirmation d'e-mail, limitation d'abus et conservation des données doivent être vérifiés avant ouverture large.

## 5. Contrats entre modules

- **Frontend → Supabase** : lecture/écriture seulement selon grants et RLS ; aucune confiance dans les champs de rôle ou de prix transmis par le client.
- **Frontend → Edge Function** : JWT utilisateur, paramètres bornés, réponse structurée et erreurs explicites.
- **Edge Function → fournisseur IA** : secrets côté serveur, quotas, journalisation sans contenu sensible inutile.
- **RPC → tables privées** : contrôle d'identité, rôle, propriété, statut et transaction.
- **Paiement → droits** : confirmation serveur idempotente ; une même référence opérateur ne peut pas être créditée deux fois.
- **Examen → certificat** : le certificat dépend d'un résultat éligible vérifié côté serveur, jamais d'une valeur envoyée par le navigateur.

## 6. Trajectoire de consolidation

### Étape 1 — Fiabilisation et non-régression
- tests navigateur sur iPhone/Safari et desktop pour apprenant, formateur et administrateur ;
- tests HTTP authentifiés des RPC et Edge Functions ;
- contrôle des politiques RLS, grants, clés privées et buckets ;
- tests du refus de candidature formateur sans perte d'accès apprenant ;
- validation du portail immigration après chaque changement partagé.

### Étape 2 — Architecture du coach et des évaluations
- vérifier le flux micro → enregistrement → stockage privé → transcription → correction ;
- traiter explicitement les permissions du rôle administrateur ;
- unifier les états d'enregistrement et les erreurs de permission ;
- limiter les quotas et vérifier le comportement sans secret IA ;
- tester sur Safari iOS et navigateurs desktop.

### Étape 3 — Catalogue et bibliothèque
- établir un registre des contenus avec examen, compétence, niveau, type, source, licence, version et statut ;
- corriger les parcours de publication et de modération ;
- augmenter le volume seulement avec des contenus vérifiés et des corrigés contrôlés ;
- conserver les archives historiques séparées des simulations originales.

### Étape 4 — Administration et gouvernance
- permissions granulaires par fonction : utilisateurs, contenus, examens, formateurs, finance, certificats, support ;
- journal des actions, filtres, recherche et historique ;
- aucune auto-élévation et séparation des tâches financières.

### Étape 5 — Mise en service
- déploiement Cloudflare réellement réussi ;
- tests smoke sur URL publique et cache/version des assets ;
- sauvegarde, procédure de restauration et plan de retour arrière ;
- validation des conditions commerciales, confidentialité, rétention et support.

## 7. Critères de qualité avant livraison

Chaque fonctionnalité doit franchir ces quatre niveaux :
1. **Code** : syntaxe, tests unitaires/CI et revue des changements.
2. **Données** : contraintes, migrations, RLS, grants, transactions et tests négatifs.
3. **Parcours réel** : navigateur authentifié, iPhone/Safari et desktop, avec les rôles concernés.
4. **Production** : build Cloudflare réussi, URL vérifiée, logs sans erreur bloquante et procédure de retour arrière.

Un commit, un test SQL transactionnel ou un workflow CI réussi ne prouve pas à lui seul le fonctionnement en production.

## 8. Points explicitement non confirmés au 20 novembre 2026

- Déploiement Cloudflare sur la dernière version de `main`.
- Tests complets des parcours sur navigateur réel et iPhone.
- Configuration finale MFA administrateur et protections Auth.
- Parcours complet de remboursement/restauration des droits.
- Automatisation de paiements Mobile Money.
- Visioconférence intégrée et notifications opérationnelles.
- Suppression/rétention automatisée des enregistrements audio.
- Volume cible de 5 000 ressources pédagogiques : il s'agit d'un objectif de contenu, pas d'un volume actuellement disponible.

## 9. Décision de gouvernance

L'architecture existante est conservée et consolidée, pas reconstruite. Les changements doivent être additifs autant que possible, documentés, testés et réversibles. Les priorités immédiates sont la sécurité par rôle, la fiabilité du coach vocal, la qualité du catalogue et la non-régression du portail immigration. La mise en production reste conditionnée à une validation réelle de Cloudflare et des parcours utilisateurs.
