# 5. Guide pédagogique et protocole de recherche

EnergyLab est un **environnement d'apprentissage** pour l'enseignement des sciences appliquées : électricité
domestique, mesure, gestion de l'énergie, systèmes embarqués, algorithmique et intelligence artificielle. Il
combine un objet réel (le kit et ses quatre prises), un **jumeau numérique** (la maison virtuelle), une
programmation **par blocs** exécutée sur le kit, des **missions** guidées et des **outils d'évaluation** pour
la recherche en éducation.

## 5.1 Public et intentions

- **Public** : lycée technique et professionnel, BTS/DUT, licence (électrotechnique, énergétique, génie
  électrique, informatique industrielle), formation des enseignants. Les niveaux 1 à 3 conviennent dès la
  fin du collège avec un fort guidage.
- **Intentions** :
  1. passer de la loi physique à la **mesure réelle** (U, I, P, S, Q, cos φ, énergie, coût) ;
  2. comprendre la **commande** d'une installation (relais, paramètres, protections) ;
  3. développer la **pensée algorithmique** sans barrière syntaxique (blocs) ;
  4. raisonner en **ingénieur** : objectifs contradictoires (coût, puissance, confort), indicateurs,
     comparaison de solutions ;
  5. démystifier l'**IA** : apprentissage supervisé, prévision, détection d'anomalies, et leurs limites ;
  6. adopter des **comportements sobres** fondés sur des données.

## 5.2 Compétences visées

| Domaine | Compétences | Missions |
|---|---|---|
| Mesurer | relever et interpréter U, I, P, S, Q, FP, E ; distinguer puissance et énergie ; calculer un coût | 1, 2, 3, 5 |
| Analyser | classer des charges (résistive, inductive, électronique) ; évaluer un gisement d'économie | 3, 4, 5 |
| Commander | piloter un actionneur ; paramétrer un relais et un capteur (période, lissage, seuils) ; protéger | 6, 7, 8 |
| Programmer | séquence, boucle, condition, événement, variable ; tester par simulation ; déboguer | 9, 10 |
| Optimiser | délestage, déplacement de charge (heures creuses), régulation à hystérésis, indicateurs | 11, 12, 13, 15 |
| IA | entraîner un classifieur (k-NN), lire une prévision (Holt), détecter une anomalie (score z) | 14 (+ onglet IA) |
| Concevoir | solution multi-objectifs, démarche expérimentale, argumentation | 16 |
| Sécurité | rôle du différentiel, protections logicielles et matérielles, verrouillage/réarmement | 1, 7 |

## 5.3 Progression : 16 missions en 6 niveaux

Les missions sont dans l'onglet **Missions**. Chaque étape est **validée automatiquement** (mesure du kit,
réponse numérique, QCM) ou par observation écrite. Les badges récompensent chaque niveau.

| N° | Niveau | Mission | Durée | Ce que l'apprenant fait et découvre |
|---|---|---|---|---|
| 1 | 1 Découvrir | Prise en main du kit | 10 min | allume une prise, lit U et P, rôle du différentiel |
| 2 | 1 | Puissance, énergie et coût | 20 min | E = P × t ; coût de 10 utilisations d'une bouilloire |
| 3 | 2 Comprendre | Puissance apparente et facteur de puissance | 25 min | S = U × I, cos φ = P / S sur un appareil électronique |
| 4 | 2 | Résistif, moteur ou électronique ? | 25 min | campagne de mesures, classement des charges |
| 5 | 2 | Les consommations cachées (veille) | 20 min | énergie et coût annuels d'une veille |
| 6 | 3 Commander | Commander les relais et régler leurs paramètres | 20 min | délai entre commutations, commande retardée |
| 7 | 3 | Déclencher une protection en toute sécurité | 15 min | puissance max, verrouillage, réarmement |
| 8 | 3 | Régler les paramètres des capteurs | 15 min | période d'échantillonnage, lissage (filtre) |
| 9 | 4 Programmer | Mon premier programme | 20 min | boucle, attente, minuterie ; pseudo-code et bytecode |
| 10 | 4 | Programmer une alerte | 20 min | événement conditionnel ; éviter les alertes répétées |
| 11 | 5 Optimiser | Délestage | 30 min | priorités, puissance souscrite, compromis confort |
| 12 | 5 | Comparer des algorithmes dans l'arène | 30 min | indicateurs, heures creuses, effet rebond |
| 13 | 5 | Tueur de veille et éclairage intelligent | 25 min | logique combinatoire, capteurs de présence et de lumière |
| 14 | 5 | Entraîner une intelligence artificielle | 30 min | k-NN : exemples, voisins, confusions |
| 15 | 5 | Le thermostat à hystérésis | 25 min | régulation tout-ou-rien, commutations / confort |
| 16 | 6 Défi | Le meilleur gestionnaire d'énergie | 45 min | battre la référence : −15 % de coût sans perte de confort |

**Proposition de séquence** (6 séances de 2 h, groupes de 2 à 4 apprenants par kit) :

| Séance | Contenu |
|---|---|
| S0 (30 min) | pré-test, consignes de sécurité, création des codes apprenants |
| S1 | missions 1 à 3 |
| S2 | missions 4 à 6 |
| S3 | missions 7 à 10 |
| S4 | missions 11 à 13 |
| S5 | missions 14 à 16 |
| S6 (45 min) | présentation des solutions du défi, post-test, SUS, questionnaire de motivation |

Sans kit (ou en complément), toutes les missions sont réalisables en **mode démonstration** : le jumeau
numérique simule les appareils, la température, la lumière et la présence.

### Déroulement type d'une séance

1. **Situation-problème** (5 min) : facture trop élevée, disjoncteur qui saute, eau froide le soir…
2. **Mission** en autonomie (60–80 min), l'enseignant circule ; les indices s'affichent selon le guidage.
3. **Mise en commun** (15 min) : résultats de mesures, captures de l'arène, erreurs fréquentes.
4. **Synthèse** (10 min) : loi ou méthode retenue, lien avec la vie quotidienne.

## 5.4 Guidage (étayage) réglable

*Réglages* > *Pédagogie* > **Guidage des missions** :

| Mode | Comportement |
|---|---|
| **Fort** | indices affichés automatiquement, étape par étape |
| **Adaptatif** (défaut) | indices proposés après des erreurs ou un temps de blocage |
| **Faible** | exploration libre, indices uniquement sur demande |

Le mode est enregistré dans chaque trace (colonne `condition`) : c'est une **variable indépendante** toute
prête pour comparer deux conditions d'apprentissage.

## 5.5 Instruments d'évaluation intégrés

Onglet **Évaluation** (les réponses sont enregistrées sur le kit et dans le navigateur) :

- **Pré-test et post-test** : 14 questions à choix multiple identiques (énergie et puissance, unités,
  facture, facteur de puissance, puissance apparente, veille, délestage, heures creuses, hystérésis, relais,
  k plus proches voisins, différentiel, tore). Les options sont présentées dans le même ordre aux deux
  passations.
- **SUS** (*System Usability Scale*, Brooke 1996) : 10 affirmations, score de 0 à 100 (≥ 68 : au-dessus de
  la moyenne).
- **Motivation** : 8 affirmations sur une échelle de 1 à 7 (intérêt/plaisir, compétence perçue, utilité,
  pression/tension) inspirées de l'*Intrinsic Motivation Inventory* ; score moyen hors pression, items
  inversés recodés.
- **Traces d'apprentissage** (*learning analytics*) : pages consultées, commandes, programmes simulés et
  envoyés (taille, empreinte), exemples ouverts, étapes de missions validées, erreurs, indices, arène, IA.

L'**espace enseignant-chercheur** calcule directement : moyennes pré/post, **gain normalisé de Hake**
g = (post − pré) / (max − pré), **test t de Student apparié** (avec p bilatéral), taille d'effet
**d de Cohen** (dz pour les données appariées), comparaison de deux groupes ou conditions par **test t de
Welch**, score SUS moyen.

## 5.6 Protocole de recherche proposé

**Question** : l'environnement EnergyLab (kit réel + jumeau numérique + programmation par blocs + missions)
améliore-t-il les apprentissages en gestion de l'énergie et la motivation, par rapport à un enseignement
habituel ? Le niveau de guidage modifie-t-il l'effet ?

**Plan quasi expérimental** pré-test / post-test avec groupe témoin :

| | Groupe expérimental | Groupe témoin |
|---|---|---|
| S0 | pré-test (dans l'application) | pré-test (même questionnaire, version papier ou application) |
| S1–S5 | missions EnergyLab | TP habituels sur les mêmes notions |
| S6 | post-test, SUS, motivation | post-test, motivation |

Variante : deux groupes expérimentaux qui diffèrent seulement par le **guidage** (fort vs faible).

**Variables** :

- indépendantes : groupe (expérimental / témoin), guidage (fort / adaptatif / faible) ;
- dépendantes : score au post-test, gain normalisé, SUS, motivation ;
- de processus : nombre de programmes simulés/envoyés, erreurs de compilation, indices consultés, temps par
  mission, utilisation de l'arène et de l'IA (fichier `events.csv`).

**Analyses** (α = 0,05) :

1. équivalence initiale des groupes : test t de Welch sur les pré-tests ;
2. progression intra-groupe : test t apparié pré/post, dz de Cohen, gain de Hake ;
3. effet du dispositif : test t de Welch sur les gains (ou ANCOVA du post-test avec le pré-test en
   covariable, dans R ou JASP) ;
4. vérification des conditions : normalité des différences (Shapiro-Wilk) ; sinon test de Wilcoxon /
   Mann-Whitney ;
5. analyses de processus : corrélation entre traces (nombre de simulations, indices) et gain.

**Repères d'interprétation** : d = 0,2 petit, 0,5 moyen, 0,8 grand effet ; gain de Hake < 0,3 faible,
0,3–0,7 moyen, > 0,7 élevé.

**Validité et biais** : même enseignant si possible, même durée, mêmes notions ; groupes classes entières
(préciser l'absence de randomisation individuelle) ; effet de nouveauté (prévoir une séance de prise en main) ;
tests identiques pré/post (effet test-retest à discuter).

**Éthique** : information des participants et de l'établissement, consentement (des parents pour les
mineurs), **codes apprenants anonymes** (ex. E07) au lieu des noms, droit de retrait, conservation limitée
des données, conformité à la réglementation sur les données personnelles en vigueur (par exemple la loi 09-08
au Maroc ou le RGPD en Europe). Les données restent sur le kit (aucun envoi sur Internet) jusqu'à leur
téléchargement par l'enseignant.

## 5.7 Récupérer et analyser les données

*Données* > *Fichiers du kit* > dossier `research` :

- `results.csv` : `horodatage, apprenant, groupe, condition, instrument (pretest, posttest, sus, imi), score,
  max, duree_s, reponses` ;
- `events.csv` : `horodatage, apprenant, groupe, condition, appareil, type, detail`.

Exemple d'analyse en R :

```r
r <- read.csv("results.csv")
pre  <- subset(r, instrument == "pretest")[, c("apprenant", "groupe", "score")]
post <- subset(r, instrument == "posttest")[, c("apprenant", "score")]
d <- merge(pre, post, by = "apprenant", suffixes = c(".pre", ".post"))
d$gain <- (d$score.post - d$score.pre) / (14 - d$score.pre)
t.test(d$score.post, d$score.pre, paired = TRUE)          # progression
t.test(gain ~ groupe, data = d)                            # Welch : comparaison des groupes
```

Exemple en Python :

```python
import pandas as pd
from scipy import stats
r = pd.read_csv("results.csv")
w = r.pivot_table(index=["apprenant", "groupe"], columns="instrument", values="score", aggfunc="last").reset_index()
w["gain"] = (w.posttest - w.pretest) / (14 - w.pretest)
print(stats.ttest_rel(w.posttest, w.pretest))
print(stats.ttest_ind(*[g.gain.dropna() for _, g in w.groupby("groupe")], equal_var=False))
```

Les journaux de mesures (`/log/AAAAMMJJ.csv`, une ligne par minute) permettent aussi des activités de
**science des données** : profil de charge journalier, part de chaque prise, effet d'un algorithme.

## 5.8 Conseils pratiques

- Préparez les **codes apprenants** et les **groupes** à l'avance ; demandez de les saisir à l'ouverture.
- Réglez les **permissions** selon la séance (par exemple, interdire l'envoi de programmes en S1).
- Utilisez des appareils **variés** et sûrs : lampe halogène et LED, chargeur, ventilateur, bouilloire
  (surveillée), sèche-cheveux en position tiède.
- Le **mode démonstration** permet de préparer et de rattraper une séance à la maison.
- Faites **comparer** les mesures du kit et celles du jumeau numérique : c'est l'occasion de discuter des
  limites d'un modèle (seuil de démarrage du capteur, appareils réels qui ne suivent pas le modèle…).
