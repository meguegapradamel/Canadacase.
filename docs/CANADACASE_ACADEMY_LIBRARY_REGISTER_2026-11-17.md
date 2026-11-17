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

Cinq liens officiels distincts sont maintenant enregistrés dans `academy_resources` et associés aux programmes TEF Canada ou TCF Canada. Ils sont volontairement **non publiés** et portent le statut `permission_pending` : il s'agit d'entrées de référence, pas de documents redistribuables ni de questions d'examen.

## Banque d'entraînement originale créée

Seize exercices originaux de compréhension écrite ont été ajoutés à `language_exercises` au total :
- TEF Canada : annonce de mobilité urbaine ; note interne sur le travail hybride.
- TCF Canada : article sur les ateliers de réparation ; information sur le bilan de compétences.

Les quatre premiers exercices contiennent trois QCM chacun ; quatre autres en contiennent quatre chacun ; les huit derniers en contiennent également quatre chacun. Chaque question dispose d’une clé de correction et d’une explication pédagogique. Total ajouté à ce stade : **16 exercices originaux et 60 questions corrigées** (12 + 16 + 32). Ces contenus sont explicitement marqués « ENTRAÎNEMENT ORIGINAL CANADACASE » dans leur consigne et ne sont pas des sujets officiels.

## Objectif de bibliothèque — 5 000 ressources pédagogiques

État mesuré dans Supabase après la dernière insertion : **86 exercices**, **230 questions**, **230 clés de correction** et **5 liens officiels distincts non publiés**. Parmi les 86 exercices publiés, **16 portent explicitement le marqueur d’entraînement original CanadaCase** ; les **70 autres n’ont pas de provenance explicite dans leur consigne** et doivent être vérifiés. Ils ne sont pas présentés comme des sujets officiels historiques. Une provenance structurée est désormais enregistrée dans `language_exercises` (`provenance_type`, `source_name`, `source_url`, `source_date`, `rights_status`) : les seize contenus marqués sont classés `original`, les autres `unverified` jusqu’à vérification. La banque comprend des exercices antérieurs au lot ajouté ; les chiffres ci-dessous sont des totaux de tables, pas un décompte de sujets officiels historiques.

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
