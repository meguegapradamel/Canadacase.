# CanadaCase Academy — Phase 17 : archives par année et session

Date : 20 novembre 2026

## Réalisé

- Ajout des métadonnées de session à `academy_mock_exams` : type d'examen (TCF Canada / TEF Canada), année, mois, libellé, date exacte, provenance, source et note de vérification.
- Ajout de contraintes de validation et d'un index partiel pour les examens publiés.
- Conservation de la table d'examens existante : les tentatives, réponses, corrections et certificats restent rattachés aux mêmes identifiants.
- Ajout dans l'interface candidat d'une bibliothèque regroupée par examen, année et session.
- Ajout de libellés distincts pour sujet historique vérifié, exemple officiel, entraînement original CanadaCase et provenance à vérifier.
- Ajout dans l'espace administrateur de la création d'un examen avec ses métadonnées et du reclassement d'un examen existant.
- Blocage côté interface et base de données de la qualification « sujet historique vérifié » sans source nommée et lien HTTPS.
- Ajout de contrôles automatiques dans le workflow de validation.

## Vérification de la base

La migration a été appliquée avec succès sur le projet Supabase `qxaykieolvbzaxmfaack`. Une requête `information_schema.columns` confirme la présence des neuf colonnes de classement et de provenance.

État de départ mesuré : 2 examens blancs publiés, aucun classé par année. Aucun faux sujet historique n'a été créé ni ajouté.

## Limites et suite

- La bibliothèque s'affichera par année/session au fur et à mesure que l'administration classe et publie les sujets.
- Les deux examens déjà présents restent visibles, dans le groupe « Autres examens / Sans année », jusqu'à leur reclassement.
- Aucun contenu historique n'est ajouté sans preuve de session et de provenance.
- La publication en production reste dépendante de la chaîne Cloudflare, qui était déjà bloquée par l'absence des secrets GitHub `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID`.
- La validation automatique du nouveau commit doit encore être vérifiée après exécution du workflow.
