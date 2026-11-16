# CanadaCase Academy — Phase 9 : premières simulations complètes TEF Canada et TCF Canada

Date : 16 novembre 2026  
Branche : `academy/specification-v1`  
Projet Supabase : projet Free existant

## Statut

Deux examens blancs complets ont été créés et publiés dans le catalogue Academy du projet Supabase existant. Ils sont accessibles aux comptes authentifiés et configurés en accès gratuit. Les examens sont enregistrés dans la base, mais la page publique du site n'a pas été déployée par cette opération.

## Banque créée

### TCF Canada — Série 01
- 84 questions au total.
- 39 QCM de compréhension orale.
- 39 QCM de compréhension écrite.
- 3 tâches d'expression écrite.
- 3 tâches d'expression orale.
- Durée globale : 167 minutes (2 h 47).
- Ordre : compréhension orale, compréhension écrite, expression écrite, expression orale.

### TEF Canada — Série 01
- 84 questions au total.
- 40 QCM de compréhension écrite.
- 40 QCM de compréhension orale.
- 2 tâches d'expression écrite.
- 2 tâches d'expression orale.
- Durée globale : 175 minutes (2 h 55).
- Ordre : compréhension écrite, compréhension orale, expression écrite, expression orale.

Les QCM proviennent de la bibliothèque d'exercices déjà publiée de CanadaCase Academy, couvrant les niveaux A1 à C2. Au total, 151 QCM proviennent de la bibliothèque existante et sept questions originales de compréhension écrite TCF remplacent des items dont le document source était incomplet. Les dix sujets de production écrite et orale sont originaux. Une annonce de colocation complète a également été ajoutée dans le contexte des cinq questions TEF correspondantes.

## Chronométrage et écoute

- Un chronomètre global de session est affiché dans la page d'examen.
- Le serveur demeure l'autorité pour l'heure de démarrage et la limite de soumission ; l'horloge du navigateur est indicative.
- Les scripts de compréhension orale sont lus par la synthèse vocale native du navigateur lorsqu'elle est disponible.
- Un bouton permet d'afficher le script si la synthèse vocale n'est pas prise en charge.
- La synthèse vocale n'est pas un enregistrement officiel du test, et peut être rejouée. Les scripts ne sont pas des fichiers audio officiels.
- Les tâches orales sont, dans cette première version, des exercices de préparation à transcrire dans la zone de réponse. L'apprenant peut utiliser la dictée vocale de son clavier. Aucun enregistrement audio du candidat n'est téléversé ni noté automatiquement.
- Le chronométrage global n'applique pas encore de sous-compteurs distincts à chaque épreuve.

## Correction et résultats

- 158 QCM avec quatre choix et clé de réponse privée, corrigés côté serveur.
- 10 tâches ouvertes avec grilles de critères et correction humaine obligatoire.
- Une copie avec au moins une tâche ouverte reste en attente jusqu'à validation par un correcteur.
- Les certificats de réussite sont ceux de CanadaCase Academy ; ils ne sont pas délivrés par les organismes officiels et ne constituent pas une attestation TEF/TCF.
- Le pourcentage brut affiché est indicatif. Il n'est pas converti en score officiel TEF/TCF ni en niveau NCLC/CLB.

## Contrôles de base de données

Résultat de la vérification :
- TCF : 84 questions, 78 QCM, 6 tâches ouvertes, 39 scripts de compréhension orale, 84 positions uniques, aucune clé QCM hors limites, 6 grilles ouvertes.
- TEF : 84 questions, 80 QCM, 4 tâches ouvertes, 40 scripts de compréhension orale, 84 positions uniques, aucune clé QCM hors limites, 4 grilles ouvertes.
- Les deux examens sont au statut `published` et `requires_entitlement=false`.
- Tests transactionnels d'un démarrage et d'une soumission complète pour chacun des deux examens, avec 84 réponses générées et `ROLLBACK`. Aucune tentative de test n'est conservée. Les cinq questions TCF C1 sans document source complet ont été remplacées par un texte original complet et cinq nouvelles questions ; le contexte de l'annonce de colocation TEF a été rétabli. Deux clés de correction repérées lors de la revue ont été corrigées avant la validation finale.
- Les tests transactionnels confirment le parcours de soumission avec tâches ouvertes en attente de correction.

## Références officielles de format

Les formats et durées sont alignés sur les pages officielles suivantes, consultées le 16 novembre 2026 :
- TCF Canada — France Éducation international : https://www.france-education-international.fr/test/tcf-canada
- TEF Canada — Le français des affaires / CCI Paris Île-de-France : https://www.lefrancaisdesaffaires.fr/candidat/test-evaluation-francais/tef-canada/presentation/

Les questions, textes et situations de cette banque sont des exercices originaux ou issus de la bibliothèque pédagogique CanadaCase existante. Aucun sujet confidentiel ou contenu officiel d'examen n'est reproduit.

## Budget et limites

- Dépense supplémentaire : 0 FCFA.
- Pas d'API IA, de service audio payant ou de stockage additionnel activé.
- Pas de véritable enregistrement de réponse orale.
- Pas de sous-compteurs de section.
- Pas de test sur navigateur mobile réel ni de test multi-appareils.
- Pas de déploiement Cloudflare, pas de fusion de PR.

## Fichiers de l'interface

- `academy-exams.html`
- `assets/academy-exams.js`
- `assets/academy-exams.css`

La page examens est en `noindex,nofollow` car elle contient l'espace d'examen authentifié. Les contrôles CI vérifient le chronomètre, les commandes de synthèse vocale, le formulaire de vérification des certificats et la navigation.
