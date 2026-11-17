# Registre des ressources — CanadaCase Academy

Mise à jour : 17 novembre 2026

## Règles de provenance et de droits

- **Exemple officiel** : ressource publiée par l'organisme certificateur. Conserver le lien source, l'intitulé, la version/date visible et la date de consultation. Un exemple officiel n'est pas automatiquement un sujet réellement administré lors d'une session antérieure.
- **Sujet historique** : cette mention exige une preuve vérifiable de l'année, de l'organisme et de l'authenticité du document.
- **Entraînement original** : contenu rédigé pour CanadaCase Academy. Ne jamais le présenter comme un ancien sujet officiel.
- Ne pas recopier ni héberger un document protégé sans licence ou autorisation. En cas de doute, publier uniquement un lien vers la page officielle.
- Les ressources dont les droits ne sont pas établis restent non publiées ou accessibles uniquement par lien externe selon leur statut.

## Références officielles publiées

Cinq URL distinctes sont publiées dans `academy_resources` avec le statut `link_only`. Les pages et documents restent hébergés par les organismes éditeurs ; CanadaCase ne les copie ni ne les redistribue.

| Programme | Ressource | Source |
|---|---|---|
| TEF Canada | Préparation et exemples des épreuves | https://www.lefrancaisdesaffaires.fr/candidat/test-evaluation-francais/tef-canada/preparation/ |
| TEF Canada | Déroulement et consignes de passation | https://www.lefrancaisdesaffaires.fr/candidat/test-evaluation-francais/tef-canada/passation/ |
| TCF | Exemples officiels d'épreuves | https://www.france-education-international.fr/test/exemples-epreuves-tcf |
| TCF Canada | Présentation, manuel candidat et épreuves | https://www.france-education-international.fr/test/tcf-canada |
| TEF | Livret officiel d'exemples de compréhension orale | https://www.lefrancaisdesaffaires.fr/wp-content/uploads/2024/10/tef-exemples-epreuves-co.pdf |

Consultation initiale : 17 novembre 2026. Les pages doivent être revérifiées avant toute nouvelle publication, car elles peuvent évoluer.

## Inventaire vérifié dans Supabase

Comptages relus directement dans la base le 17 novembre 2026 :

| Élément | Total publié |
|---|---:|
| Leçons dans `language_courses` | 55 |
| Exercices dans `language_exercises` | 94 |
| Questions QCM dans `language_exercise_questions` | 270 |
| Clés de correction dans `language_question_keys` | 270 |
| Liens officiels externes distincts | 5 |

Les 94 exercices se répartissent ainsi :

| Statut de provenance | Exercices | Questions |
|---|---:|---:|
| Entraînement original CanadaCase | 30 | 110 |
| Provenance non vérifiée | 64 | 160 |
| **Total** | **94** | **270** |

Les 30 exercices originaux sont associés à la source « CanadaCase Academy — contenu original », à la date de version du 17 novembre 2026 et au statut de droits `not_applicable`. Ils ne sont pas présentés comme des sujets officiels.

Les 64 exercices non vérifiés sont conservés sans être qualifiés de sujets historiques ou d'exemples officiels. Un identifiant ou un libellé interne tel que « CC26 » ne constitue pas une preuve d'authenticité. Leur statut ne sera modifié qu'après obtention d'une preuve de provenance.

## Contrôles qualité enregistrés

Dernier contrôle de la banque d'exercices :

- clés de correction manquantes : **0** ;
- index de bonne réponse hors limites : **0** ;
- nombre de choix invalide : **0** ;
- explications de correction manquantes : **0** ;
- anomalies de métadonnées sur les contenus originaux : **0**.

Les clés de correction ne sont pas exposées directement aux candidats. La correction est calculée côté serveur lors de la soumission de l'exercice ; le candidat reçoit ensuite son résultat et les explications prévues.

## Contenus originaux ajoutés le 17 novembre 2026

Deux lots récents ont ajouté huit exercices originaux de compréhension écrite, chacun composé de cinq QCM avec clé et explication :

- Lot 1 : prêt de vélos communal, commercialisation directe d'une coopérative agricole, accès hybride aux services publics et concertation autour de la transition énergétique.
- Lot 2 : horaires d'une bibliothèque, organisation flexible du travail, évaluation des effets d'une formation professionnelle et rénovation du patrimoine urbain.

Les niveaux couvrent B1, B2 et C1 et les contenus sont identifiés comme « ENTRAÎNEMENT ORIGINAL CANADACASE ». Ils ne sont pas des sujets officiels d'anciennes sessions.

Quatre fiches pédagogiques originales sont également recensées dans la banque de leçons : accord du participe passé, indicatif/subjonctif, connecteurs logiques et construction d'une réponse écrite.

## Objectif de bibliothèque — 5 000 ressources pédagogiques

La cible de 5 000 unités n'est **pas atteinte**. L'inventaire mesuré ci-dessus représente 149 unités internes publiées si l'on additionne les 55 leçons et les 94 exercices. Les 5 liens officiels externes sont comptabilisés séparément. Les 270 questions et leurs 270 clés ne sont pas ajoutées au nombre d'exercices.

Répartition cible de travail :

| Domaine | Cible |
|---|---:|
| TEF Canada | 1 000 |
| TCF Canada | 1 000 |
| Grammaire et conjugaison | 1 000 |
| Vocabulaire, écriture et expression orale | 1 000 |
| Examens blancs et simulations originales | 700 |
| Français pratique et préparation documentaire | 300 |
| **Total** | **5 000** |

La bibliothèque doit progresser par lots de contenus réellement distincts, pédagogiquement relus et corrigés. Les sujets historiques ne seront ajoutés comme tels que si leur provenance est démontrée. À défaut, les exercices seront clairement marqués comme créations originales CanadaCase.

## Performance et sécurité — attestations de participation

Un index B-tree `academy_participation_attestations_issued_by_idx` a été créé pour la clé étrangère `academy_participation_attestations.issued_by`, via la migration `20261117155758_index_academy_attestations_issued_by`, également présente dans le dépôt. Le contrôle advisor précédent ne signalait plus cette clé étrangère comme non indexée.

Les index signalés comme inutilisés ne sont pas supprimés automatiquement : une base encore peu utilisée peut ne pas avoir accumulé assez d'historique, et une suppression sans analyse de l'usage réel serait risquée.

## Limites connues

- Le registre ne prouve pas l'existence d'une archive publique exhaustive des sujets réellement administrés lors des sessions TEF/TCF antérieures.
- Les liens officiels ne signifient pas que CanadaCase détient un droit de reproduction ou d'hébergement.
- Les contenus non vérifiés ne doivent pas être annoncés comme officiels.
- Le total de 5 000 reste un objectif de développement, pas un volume actuellement disponible.
