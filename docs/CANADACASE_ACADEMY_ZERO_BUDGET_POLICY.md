# CanadaCase Academy — politique budget zéro
Date : 16 novembre 2026
Décision de gouvernance : aucun coût supplémentaire autorisé.

## Engagement
Le développement doit rester à 0 FCFA de dépenses nouvelles. Aucun abonnement, achat de crédits, branche payante, dépassement de quota facturé, service premium ou mise à niveau n'est autorisé.

## Services et pratiques
- GitHub : utiliser les fonctionnalités gratuites disponibles sur le compte actuel ; éviter les actions nécessitant un plan payant.
- Supabase : conserver le projet actuel et son forfait actuel ; aucune branche de développement payante ne sera créée. Ne pas supposer que les quotas gratuits sont illimités.
- Développement local : privilégier SQL, migrations et tests locaux avec outils gratuits déjà disponibles. Supabase CLI/Docker ne seront proposés que si l'installation et l'utilisation n'impliquent aucun achat ou frais indirect obligatoire.
- Cloudflare : utiliser uniquement les fonctionnalités comprises dans le forfait gratuit existant et surveiller les quotas ; ne pas activer Workers Paid, services payants ou facturation à l'usage.
- IA, visioconférence, SMS/WhatsApp, e-mail transactionnel, paiements : aucune intégration facturée. Commencer par les solutions gratuites déjà disponibles ou laisser le module désactivé. Les paiements eux-mêmes peuvent entraîner des frais de prestataire : ils doivent être affichés et validés avant toute mise en service.
- Domaine : conserver le domaine/sous-domaine déjà disponible ; aucun achat de domaine.
- Stockage, bande passante, sauvegarde et journaux : rester dans les quotas gratuits existants ; ne pas promettre une capacité illimitée.

## Règle de décision
Avant d'utiliser un service externe ou une fonction susceptible d'être facturée :
1. identifier le plan et les limites actuels ;
2. vérifier les coûts récurrents, à l'usage, frais de transaction et risques de dépassement ;
3. ne rien activer si un coût est possible ou incertain ;
4. rechercher une alternative gratuite ;
5. si aucune alternative gratuite fiable n'existe, reporter ou désactiver la fonctionnalité plutôt que facturer.

## Limites et transparence
« Gratuit » signifie sans dépense nouvelle pour le propriétaire du projet, dans les limites des forfaits déjà disponibles. Cela ne garantit pas que les fournisseurs conserveront éternellement leurs offres gratuites. Le projet devra être adapté si leurs conditions changent.

## Priorité d'architecture
Les modules sont conçus de manière modulaire et désactivable. Les fonctions qui dépendent d'un prestataire payant (visioconférence intégrée, SMS, crédits IA, stockage volumineux, paiement avec frais) ne doivent pas bloquer le cœur gratuit de l'Academy.
