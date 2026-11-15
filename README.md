# CanadaCase

Plateforme web responsive avec deux parcours : **Voyage et immigration** et **Préparation TCF Canada / TEF Canada**.

## Architecture

- Frontend : HTML, CSS et JavaScript statiques (`index.html`, `assets/`).
- Authentification, base de données et stockage privé : Supabase.
- Fonctions serveur : Supabase Edge Functions.
- Clé navigateur : clé Supabase publishable dans `assets/config.js`.
- Le dépôt contient une configuration Netlify optionnelle (`netlify.toml`). Le site public utilisé par l'équipe est publié sur Cloudflare Workers. Le dépôt contient maintenant une configuration Wrangler pour préparer le déploiement automatisé ; la connexion du Worker au dépôt GitHub et la vérification de la mise en production restent à effectuer dans le tableau de bord Cloudflare.

**Ne jamais ajouter une clé Supabase `sb_secret` / `service_role` ni une clé OpenAI dans le frontend.**

## Parcours immigration

Le portail conserve les dossiers candidats, les documents, les suivis, l'impression des réponses et les fonctions de gestion des comptes administrateurs.

## Parcours TCF / TEF

Le module comprend :
- Les quatre compétences : compréhension orale, compréhension écrite, expression orale et expression écrite.
- Les niveaux CECRL A1 à C2.
- Des exercices originaux classés par examen, compétence et niveau.
- Des supports image et audio dans le bucket privé `language-media`.
- Des sessions chronométrées, QCM, corrigés non exposés au navigateur et résultats enregistrés.
- L'enregistrement de productions orales, leur transcription IA et une correction pédagogique.
- Un historique, une progression par compétence et un tableau de suivi pour les administrateurs/formateurs.

Les simulations sont des exercices pédagogiques originaux. Elles ne reproduisent pas les sujets officiels et ne délivrent aucun score officiel.

### Ajouter un exercice depuis l'espace administrateur

1. Choisir TCF Canada ou TEF Canada, la compétence et le niveau.
2. Saisir la consigne.
3. Ajouter éventuellement une image (JPG, PNG, WebP, 8 Mo maximum) et/ou un audio (MP3, M4A, WAV, OGG, WebM, 20 Mo maximum).
4. Pour une compréhension QCM, fournir un tableau JSON dans le champ Questions QCM :

```json
[
  {
    "question": "Quel est le sujet principal du document ?",
    "options": ["Le transport", "Le logement", "Le travail", "La santé"],
    "correct": 0,
    "explanation": "Le document traite principalement du transport."
  }
]
```

5. Publier l'exercice lorsqu'il est prêt. Les questions et les corrigés sont conservés séparément ; les candidats ne peuvent pas lire les réponses correctes.

Un examen blanc complet nécessite une banque suffisamment fournie : 39 questions par épreuve de compréhension TCF Canada, 40 pour le TEF Canada. Si la banque est incomplète, CanadaCase affiche une session d'entraînement partielle.

### Configuration IA obligatoire

Dans Supabase > Edge Functions > Secrets, ajouter :
- `OPENAI_API_KEY` : clé API OpenAI privée.

La clé API ne doit jamais être collée dans GitHub, dans `assets/config.js` ou dans une conversation. L'utilisation de l'API OpenAI est facturée séparément de l'abonnement ChatGPT. Sans ce secret, la correction et la transcription IA restent indisponibles, mais les autres fonctions du module peuvent être utilisées.

## Stockage et sécurité

- `case-documents` : documents liés à l'immigration.
- `language-media` : images et audios des exercices, bucket privé.
- `language-recordings` : enregistrements oraux temporaires, bucket privé et accès limité au propriétaire.
- RLS activé sur les tables d'exercices, questions, corrigés et tentatives.
- Les réponses correctes des QCM ne sont pas lisibles par les candidats ; le calcul des scores est effectué côté serveur.
- Les tentatives d'un candidat ne sont pas visibles par les autres candidats.

Avant l'utilisation à grande échelle, activer la protection contre les mots de passe compromis, le MFA administrateur, la confirmation d'e-mail, les protections anti-abus et une politique de conservation/suppression des données.

## Références officielles

- TCF Canada : https://www.france-education-international.fr/test/tcf-canada
- TEF Canada : https://www.lefrancaisdesaffaires.fr/candidat/test-evaluation-francais/tef-canada/presentation/


## Déploiement Cloudflare Workers

Le dépôt est préparé pour publier le site statique sur le Worker `canadacase` avec Wrangler :
- `wrangler.jsonc` déclare le nom du Worker et le dossier d'assets racine.
- `.assetsignore` exclut les fichiers de développement, les métadonnées et le dossier Supabase des assets publics.
- `package.json` épingle Wrangler 4.68.0 et fournit les commandes `npm run deploy` et `npm run preview`.

Pour relier le dépôt à un Worker Cloudflare existant : Workers & Pages > Worker `canadacase` > Settings > Builds > Connect. Sélectionner le dépôt `meguegapradamel/Canadacase.`, la branche de production `main`, le répertoire racine et la commande de déploiement `npm run deploy` (aucune commande de build n'est nécessaire). Le nom du Worker doit rester exactement `canadacase`.

La connexion Git Cloudflare doit être autorisée dans le compte Cloudflare. Une fois reliée, chaque commit sur `main` déclenchera la construction et le déploiement. Vérifier ensuite le statut du build et l'URL `https://canadacase.meguegap.workers.dev/`.
