# CanadaCase — déploiement Netlify + Supabase

Portail web responsive de collecte et de suivi de dossiers d'immigration.

## Configuration actuelle

- Supabase URL : `https://qxaykieolvbzaxmfaack.supabase.co`
- Clé navigateur : clé `sb_publishable_*` dans `assets/config.js`
- Frontend : HTML/CSS/JavaScript statique
- Hébergement prévu : Netlify
- Base/Auth/Storage : Supabase

La clé publishable est destinée au navigateur. Ne jamais mettre une clé `sb_secret` ou `service_role` dans `assets/config.js`.

## Déploiement Netlify

Le fichier `netlify.toml` configure le dossier racine comme dossier publié et ajoute des en-têtes de sécurité de base.

Si le site est relié à Git, Netlify doit simplement publier la racine du dépôt. Aucun build command n'est nécessaire pour cette version statique.

## Supabase

1. Exécuter `supabase/schema.sql` dans Supabase > SQL Editor.
2. Exécuter `supabase/VERIFY.sql` pour contrôler les tables, RLS, politiques, bucket et fonctions.
3. Dans Authentication > URL Configuration, ajouter l'URL Netlify exacte du site dans Site URL et Redirect URLs.
4. Créer un compte candidat.
5. Passer son `profiles.role` à `admin` depuis Supabase Table Editor uniquement.
6. Tester avec au moins deux comptes : un candidat et un administrateur.

## Sécurité

Les documents sont stockés dans le bucket privé `case-documents`. L'accès est contrôlé par Supabase Auth + RLS.

Avant utilisation avec de vrais passeports, actes d'état civil ou relevés bancaires, auditer les politiques RLS, activer la confirmation e-mail, le MFA administrateur, les protections anti-abus et une politique de conservation/suppression des données.
