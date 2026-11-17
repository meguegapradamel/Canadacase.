# Registre des ressources — CanadaCase Academy

Mise à jour : 17 novembre 2026

## Règle de provenance

- **Sujet officiel / exemple officiel** : document publié par l'organisme certificateur. Conserver le lien source, l'intitulé exact, la version/date visible et la date de consultation. Un exemple officiel n'est pas automatiquement un sujet réellement administré lors d'une session antérieure.
- **Sujet historique** : ne porter cette mention que si l'année, l'organisme, l'authenticité et la provenance du document sont vérifiables.
- **Entraînement original** : contenu rédigé pour CanadaCase Academy. Ne jamais le présenter comme un ancien sujet officiel.
- Ne pas recopier ni héberger un PDF protégé sans licence ou autorisation. En cas de doute, publier uniquement un lien vers la page officielle.
- Les ressources avec droits non vérifiés restent non publiées (`permission_pending`).

## Sources officielles repérées

| Programme | Ressource | Source officielle | Utilisation prévue |
|---|---|---|---|
| TEF Canada | Préparation et exemples des épreuves | https://www.lefrancaisdesaffaires.fr/candidat/test-evaluation-francais/tef-canada/preparation/ | Lien externe et repère de format ; pas une autorisation de redistribution |
| TEF Canada | Déroulement et consignes de passation | https://www.lefrancaisdesaffaires.fr/candidat/test-evaluation-francais/tef-canada/passation/ | Vérifier les durées et consignes |
| TCF | Exemples officiels d'épreuves | https://www.france-education-international.fr/test/exemples-epreuves-tcf | Exemples officiels et liens PDF de préparation |
| TCF Canada | Présentation, manuel candidat et épreuves | https://www.france-education-international.fr/test/tcf-canada | Vérifier le format et les documents candidats |
| TEF | Livret officiel d’exemples de compréhension orale | https://www.lefrancaisdesaffaires.fr/wp-content/uploads/2024/10/tef-exemples-epreuves-co.pdf | Exemple officiel ; ce n’est pas un test complet et la difficulté réelle peut différer |
| TCF | Page officielle d’exemples et de sujets | https://www.france-education-international.fr/test/exemples-epreuves-tcf | Référence officielle pour les cinq types d’épreuves présentés |

Consultation initiale : 17 novembre 2026. Les pages officielles doivent être revérifiées avant chaque nouvelle publication, car elles peuvent évoluer.

## État du registre dans Supabase

Cinq liens officiels distincts sont maintenant enregistrés et publiés dans `academy_resources` sous le statut `link_only`. Les candidats sont redirigés vers les pages ou fichiers hébergés par les organismes éditeurs ; CanadaCase ne copie ni n’héberge les documents. Ce statut autorise l’affichage du lien externe, pas la reproduction du contenu.

## Banque d'entraînement originale créée

Vingt-six exercices originaux ont été identifiés ou ajoutés à `language_exercises` au total :
- TEF Canada : annonce de mobilité urbaine ; note interne sur le travail hybride.
- TCF Canada : article sur les ateliers de réparation ; information sur le bilan de compétences.

Les quatre premiers exercices contiennent trois QCM chacun ; quatre autres en contiennent quatre chacun ; les huit derniers en contiennent également quatre chacun. Chaque question dispose d’une clé de correction et d’une explication pédagogique. Le registre comprend 16 exercices originaux précédemment ajoutés, six anciens exercices explicitement marqués comme originaux et reclassés, puis quatre nouveaux exercices de compréhension écrite. Les quatre derniers contiennent cinq QCM chacun. Total mesuré pour les 26 exercices originaux : **90 questions corrigées**. Ces contenus sont explicitement marqués « ENTRAÎNEMENT ORIGINAL CANADACASE » dans leur consigne et ne sont pas des sujets officiels.


## Audit de qualité — exercices à provenance non vérifiée (17 novembre 2026)

Contrôle direct de la table `language_exercises` : **64 exercices** portent `provenance_type = unverified`. Ils restent publiés pour préserver les ressources existantes, mais ne sont pas qualifiés de sujets historiques ou d'exemples officiels. Le marqueur « CC26 » dans une consigne ou un nom de fichier n'est pas une preuve d'authenticité officielle. Les six anciens exercices qui portaient explicitement la mention « Exercice original CanadaCase » ont été reclassés comme originaux ; les 64 autres restent non vérifiés.

Contrôle des éléments objectifs associés aux 64 exercices non vérifiés : **160 questions QCM**, aucune clé manquante, aucun index de bonne réponse hors limites, aucun nombre de choix invalide et aucune explication vide. **32 tâches d'expression écrite/orale** ne sont pas associées à un QCM, ce qui est cohérent avec leur format de production. Le lot comprend 12 exercices audio et 3 avec image.

Mesure de prudence appliquée dans le catalogue : les exercices non vérifiés sont explicitement signalés « Source non vérifiée — statut officiel non établi ». Le texte précise qu'ils ne doivent pas être considérés comme des sujets officiels ou des anciennes sessions authentifiées. Les contenus sont conservés pour ne pas perdre le travail pédagogique ; leur statut ne sera reclassé qu'après preuve de provenance.

## Objectif de bibliothèque — 5 000 ressources pédagogiques

État mesuré dans Supabase après le dernier lot : **55 leçons publiées**, **90 exercices**, **250 questions**, **250 clés de correction** et **5 liens officiels distincts publiés en accès externe uniquement**. Parmi les 90 exercices publiés, **26 sont classés originaux** (90 questions) et **64 restent non vérifiés** (160 questions). Aucun de ces 64 exercices n'est présenté comme un sujet officiel historique. Une provenance structurée est enregistrée dans `language_exercises` (`provenance_type`, `source_name`, `source_url`, `source_date`, `rights_status`). Les 26 exercices originaux portent maintenant les métadonnées de source et de droits attendues. La banque comprend des exercices antérieurs au lot ajouté ; les chiffres ci-dessous sont des totaux de tables, pas un décompte de sujets officiels historiques. Quatre fiches pédagogiques originales ont aussi été ajoutées à `language_courses` : accord du participe passé, indicatif/subjonctif, connecteurs logiques et construction d’une réponse écrite.

Cible de travail, non atteinte à ce jour :

| Domaine | Cible |
|---|---:|
| TEF Canada | 1 000 |
| TCF Canada | 1 000 |
| Grammaire et conjugaison | 1 000 |
| Vocabulaire, écriture et expression orale | 1 000 |
| Examens blancs et simulations originales | 700 |
| Français pratique et préparation documentaire | 300 |
| **Total** | **5 000** |

Le nombre de ressources doit être calculé sur des unités pédagogiques réellement distinctes et corrigées, sans compter plusieurs fois une même question, les simples liens externes ou les certificats. Les documents officiels sont comptés séparément des créations originales.


## Lot d'entraînement original ajouté — 17 novembre 2026

Ajout de **4 exercices originaux de compréhension écrite** (2 TEF Canada, 2 TCF Canada), niveaux B1, B2 et C1, chacun avec 5 questions à choix multiples, une clé de correction et une explication par réponse. Les textes portent sur le prêt de vélos communal, la commercialisation directe d'une coopérative agricole, l'accès hybride aux services publics et la concertation autour de la transition énergétique. Ces contenus sont explicitement identifiés comme entraînement original CanadaCase ; ils ne sont pas présentés comme des sujets officiels.

Le contrôle de qualité après insertion confirme : 250 questions, 250 clés, 0 clé manquante, 0 index de réponse invalide, 0 nombre de choix invalide, 0 explication vide et 0 anomalie de métadonnées sur les 26 exercices classés originaux.

## Réconciliation des contenus originaux historiques

Six anciens exercices portaient déjà dans leur consigne la mention explicite « Exercice original CanadaCase ». Ils ont été reclassés comme originaux, avec la source « CanadaCase Academy — contenu original », la date de version du 17 novembre 2026 et le statut de droits « not_applicable ». Les 16 exercices originaux déjà identifiés ont aussi reçu les métadonnées de source manquantes. Les 64 autres exercices restent non vérifiés : leur origine ne peut pas être démontrée par les informations disponibles et ils ne sont pas promus en sujets officiels.


## Contrôle de performance — attestations de participation

L'advisor Supabase a signalé une clé étrangère non indexée sur `academy_participation_attestations.issued_by`. Un index B-tree `academy_participation_attestations_issued_by_idx` a été créé via migration distante `20261117155758_index_academy_attestations_issued_by` et ajouté au dépôt. Le contrôle advisor devra être relancé pour confirmer la disparition de ce signalement. Les alertes d'index inutilisés ne sont pas traitées par suppression automatique : elles peuvent simplement refléter une base encore peu utilisée et leur retrait sans historique d'usage serait risqué.
