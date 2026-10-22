# Hojo — assistant personnel Nutrition / Sport / Maison

**Nom de l'app : Hojo** (補助, « aide, assistance » en japonais ; choix de l'utilisateur, logo avec le mot « Hojo » dans `Design/`). Seul le NOM AFFICHÉ a changé (`name` dans `app.json`, textes de l'app, nom du fichier de sauvegarde `hojo-sauvegarde-…json`). **Volontairement inchangés**, car les renommer casserait des données ou créerait une autre application : le slug et le schéma `assistant-personnel`, le projet EAS `@thems1897/assistant-personnel`, l'identifiant Android `com.thems1897.assistantpersonnel`, la base SQLite `assistant-personnel.db` et `BACKUP_APP_ID` (les anciennes sauvegardes restent restaurables). Le changement d'étiquette sous l'icône exige un nouveau build. Planche de marque : `Design/Logo et nom Hojo.png` (logo + mot, icônes sombre / claire / sauge, monogramme H, couleurs) ; l'accueil affiche le logo horizontal détouré (`mobile/assets/images/brand/wordmark-light.png` et `-dark.png`, la version sombre a le vert foncé éclairci, choisie selon le thème). **L'icône de l'app est la version SOMBRE de la planche** (fond vert `#28614D`, personnage crème, feuille sauge), générée par [make-app-icons.py](mobile/scripts/make-app-icons.py) (Python + Pillow + numpy ; remplace l'ancien script PowerShell) à partir du logo haute définition `Design/Logo app transparent.png`, recoloré (la planche est trop petite pour être agrandie à 1024 px). Le splash garde le logo vert sur fond crème ; la couleur des notifications est `#28614D`. Visible après un NOUVEAU build. Un titre de store possible : « Hojo: Nutrition & Fitness » (une autre appli agricole japonaise s'appelle déjà HOJO sur le Play Store).

## Vision

Application mobile qui sert d'assistant personnel au quotidien sur trois domaines :
nutrition, séances de sport, tâches récurrentes de la maison.

L'utilisateur importe ses propres plans (nutrition, sport, ou les deux). L'application les
transforme en guide au jour le jour et accompagne l'utilisateur pendant l'action (mode
"séance en direct" pour le sport). Si l'utilisateur n'a pas de plan, l'app peut l'aider à
en obtenir un via un questionnaire.

Cahier des charges initial : [cahier-des-charges-assistant-personnel.md](cahier-des-charges-assistant-personnel.md)

## Contraintes non négociables

- iOS et Android
- Rappels/notifications qui arrivent même quand l'app est fermée
- Données stockées uniquement sur l'appareil, propres à chaque personne (pas de compte,
  pas de sync cloud, pas de partage entre appareils)
- Utilisable hors ligne

## Décisions actées

### Stack technique
- **React Native + Expo** (managed workflow), build cloud via **EAS Build** (iOS + Android)
  et itération via **EAS Update** (OTA sans repasser par les stores à chaque petit
  changement)
- Environnement de dev : Windows côté utilisateur, Mac disponible en complément si besoin
  de debug natif local
- Raison du choix face à Flutter : l'utilisateur délègue l'intégralité du code à Claude sur
  plusieurs sessions ; TypeScript/JavaScript offre une plus grande fiabilité de génération
  de code que Dart, réduisant le risque d'erreurs silencieuses non relues par l'utilisateur

### Stockage local
- SQLite via `expo-sqlite` (ou ORM léger type Drizzle si la complexité du schéma le justifie)

### Notifications
- Notifications **locales programmées** (`expo-notifications`), pas de serveur / push
  distant nécessaire
- Point d'attention : iOS limite à ~64 notifications locales en attente simultanément →
  prévoir une logique de réapprovisionnement glissant (reprogrammer les prochains jours
  plutôt que tout programmer d'un coup)

### Génération de plan sans LLM intégré à l'app
- Pas d'appel API LLM depuis l'app (évite la question RGPD / stockage de données de santé
  chez un tiers)
- À la place : questionnaire dans l'app → génère un **prompt texte** que l'utilisateur
  copie/colle dans un LLM externe de son choix (ChatGPT, Claude, etc.)
- Le prompt demande au LLM de répondre dans un **format structuré défini par l'app**
  (probablement JSON, à affiner en Étape 2) pour un ré-import direct et fiable dans l'app

### Import de plans existants
- Formats à couvrir à terme : texte libre / PDF / photo, fichier structuré (tableur), saisie
  manuelle dans l'app, et JSON généré par le prompt (voir ci-dessus)

### Domaines fonctionnels
- **Nutrition** : plan importé → écran "Aujourd'hui" (repas du jour, coche fait/pas fait) →
  rappels aux heures de repas
- **Sport** : plan importé → mode "séance en direct" (exercice courant, chrono de repos,
  passage au suivant) → rappels d'entraînement
- **Tâches maison** : liste de tâches à récurrence simple (pas de rotation entre personnes,
  pas de logique complexe) → coche + rappel

### Multi-utilisateur
- Un seul utilisateur par installation. Pas de profils multiples, pas de sync entre
  appareils. Chaque membre du foyer aurait sa propre installation indépendante si besoin.

## Découpage en étapes (chaque étape produit quelque chose de testable sur téléphone)

1. **Étape 0 — Squelette** : projet Expo + config EAS Build, app minimale installée sur
   iOS et Android réels. Valide toute la chaîne de build/installation.
2. **Étape 1 — Nutrition, cœur** : import d'un plan (JSON), écran "Aujourd'hui", coche des
   repas, rappels locaux aux heures de repas, stockage local.
3. **Étape 2 — Génération de plan** : questionnaire → génère le prompt à copier/coller →
   écran d'import qui valide le JSON retourné par le LLM externe.
4. **Étape 3 — Sport** : même ossature d'import/génération appliquée au sport + mode
   "séance en direct".
5. **Étape 4 — Tâches maison** : liste à récurrence simple, coche, rappels. **Portée réduite
   par l'utilisateur : uniquement les POUBELLES**, avec un rappel la veille au soir (ex :
   "Sortir les sacs bleus"). Pas de gestionnaire de tâches générique.
6. **Étape 5 — Robustesse** : gestion des erreurs d'import, édition manuelle des plans
   importés, réglages des rappels.

Ordre de priorité confirmé par l'utilisateur : **Nutrition en premier**.

## Setup technique (Étape 0 — terminée)

- Projet Expo créé dans [mobile/](mobile) — nom affiché "Hojo" (avant : "Assistant Personnel"), slug
  `assistant-personnel`
- **SDK Expo 57** (le projet avait été rétrogradé en 54 pour l'Expo Go de l'époque, puis remonté
  quand l'Expo Go du téléphone est passé en 57 : `npx expo install expo@^57` puis
  `npx expo install --fix`). Changements d'API absorbés : `ThemeProvider`/`DefaultTheme`/
  `DarkTheme` s'importent de `expo-router` (plus de `@react-navigation/native`), `Label`/`Icon`
  des NativeTabs deviennent `NativeTabs.Trigger.Label`/`.Icon` (et `androidSrc` → `src`),
  `StyleSheet.absoluteFillObject` supprimé, et la règle de lint du React Compiler interdit
  `setState` synchrone dans un `useEffect` (états initiaux paresseux ou valeurs dérivées à la
  place). `eas-cli` n'est plus une dépendance du projet : installer en global (`npm install -g eas-cli`, commande `eas`)
- Test en direct fonctionnel via **Expo Go + tunnel** (`npx expo start --tunnel`,
  nécessite `@expo/ngrok` en devDependency) — utilisé car le réseau LAN direct est
  perturbé par le VPN (NordVPN) actif sur la machine de dev
- Projet EAS lié : `@thems1897/assistant-personnel` (compte Expo `thems1897`),
  `eas.json` configuré avec profils `development`/`preview`/`production`
- **Build EAS réel (iOS/Android) volontairement différé** : pas de compte Apple
  Developer payant pour l'instant → on reste sur Expo Go pour itérer, on déclenchera
  un vrai build quand une fonctionnalité l'exigera (probablement les rappels en
  arrière-plan, à tester en conditions réelles avant la fin du projet)

## Étape 1 — Nutrition, cœur (en cours)

- Import de plan via fichier `.json` téléchargé (schéma validé par `zod` dans
  [nutrition-schema.ts](mobile/src/lib/nutrition-schema.ts)) — collage manuel de texte
  disponible en repli. Le fichier est indispensable dès qu'un plan 14 jours avec macros
  dépasse la limite de copier-coller d'une conversation LLM.
- **Modèle de plan = cycle de N jours (7 ou 14), pas une semaine récurrente** : le champ
  `day` est le numéro du jour DANS LE CYCLE (1..N), jamais un nom de jour de semaine (un
  premier modèle "jour de semaine récurrent" ne pouvait pas représenter un cycle de 14
  jours — deux mardis différents se confondaient, bug réel rencontré et corrigé).

### Modèle de données structuré (foods / recettes / courses)
Le plan n'est plus une liste de repas en texte libre : c'est une structure reliée,
vérifiable automatiquement.
- `foods` : base d'aliments du plan, chacun avec 5 valeurs numériques pour 100g (kcal,
  protéines, glucides, lipides, fibres), une catégorie, et un mode de vente
  (`weight` ou `unit` + grammes/unité)
- `singles` : plats cuisinés et mangés en une fois (ingrédients + macros déclarées par
  portion)
- `batches` : plats cuisinés en série (`portions` >= 2, `cookDay`) — les ingrédients
  représentent le lot ENTIER, les macros déclarées sont PAR PORTION
- `days[].meals[]` référencent une recette par `ref` (+ `portionIndex` pour un batch), ou
  n'ont pas de `ref` du tout pour un repas hors-cycle (resto, repas libre — `freeNote`)
- `courses` : liste de courses groupée par semaine, avec indicateurs garde-manger /
  congélation

### Module d'invariants ([nutrition-invariants.ts](mobile/src/lib/nutrition-invariants.ts))
Après validation structurelle (`zod`), une deuxième passe vérifie la cohérence
arithmétique et métier du plan et **bloque l'import** si une règle est violée (message
précis affiché à l'utilisateur, import rejeté proprement) :
- macros d'une recette = ingrédients × table `foods` (tolérance 3%)
- totaux d'un jour = somme exacte des repas de ce jour
- tout ingrédient/référence cité existe bien (`foods`, `batches`/`singles`)
- portions d'un batch : numérotées 1..N sans trou ni doublon, portion 1 mangée le jour
  `cookDay`
- liste de courses : couvre exactement les besoins du cycle (ni sous-achat, ni achat
  fantôme), unités entières pour les aliments vendus à l'unité, pas de doublon
  garde-manger entre semaines
- plausibilité physique par catégorie d'aliment (bornes min/max **par portion**, pas sur
  la ligne brute d'un batch — piège réel rencontré et corrigé : 1750g de poulet pour 7
  portions est normal, la vérification doit diviser par le nombre de portions avant de
  juger)
  Bornes basses volontairement larges (protéine ≥ 10g, matière grasse ≥ 2g, seuil mesurable 2g) :
  des premières bornes plus serrées (30g / 3g) rejetaient à tort des plans corrects — whey à
  15-18g, filet d'huile à 2,5g — parce que la catégorie `proteine` couvre aussi les poudres. Le
  but est d'attraper les erreurs grossières (3g de poulet, 900g de beurre), pas de juger la
  diététique ; les bornes hautes, elles, n'ont pas bougé
- `meta.baseDayKcal` incohérent avec la moyenne réelle → avertissement (pas un rejet)

Testé par une suite dédiée (30 assertions) : un plan complet valide à 0 violation, une
violation ciblée par catégorie d'invariant, et surtout un **test de permutation** (25
mélanges aléatoires de l'ordre des jours) qui a réellement révélé le bug de plausibilité
ci-dessus avant qu'il ne parte en production — la démarche de test a payé, pas juste une
formalité.

- Stockage local SQLite (`expo-sqlite`) : [db.ts](mobile/src/lib/db.ts), tables
  `nutrition_foods`, `nutrition_recipes` (batches+singles unifiés), `nutrition_days`,
  `nutrition_meals`, `nutrition_course_items`. Versionné par `PRAGMA user_version` — un
  changement de structure recrée la base à vide plutôt que de migrer (pas de garantie de
  préservation des données à ce stade du projet)
- Écran "Aujourd'hui" : jour du cycle calculé depuis la date d'ancrage, carte résumé
  (calories + macros du jour), macros affichées par repas, nom du plat résolu depuis la
  recette référencée
- Import du plan (aujourd'hui dans Réglages › Nutrition) : prompt générique à copier, ou questionnaire détaillé
  ([questionnaire.tsx](mobile/src/app/questionnaire.tsx)) couvrant profil, santé/sécurité,
  objectif/activité, régime, organisation, repas & flexibilité — génère un prompt en
  langage naturel (pas un dump de champs) via
  [nutrition-prompt.ts](mobile/src/lib/nutrition-prompt.ts), avec un exemple JSON complet
  et vérifié arithmétiquement embarqué dans le prompt
- Sécurité : seuil calorique minimal (1200/1500 kcal selon sexe), régime spécial mineurs
  (aucune restriction, objectif perte de poids neutralisé), grossesse/allaitement,
  conditions médicales déclarées — bloque l'import si violé (voir aussi le module
  d'invariants ci-dessus)
- Rappels : notifications programmées par **dates précises sur une fenêtre glissante de 14
  jours**, réapprovisionnée à chaque démarrage de l'app
  ([notifications.ts](mobile/src/lib/notifications.ts))
- Testé sur téléphone réel (Android, Expo Go) : import, écran "Aujourd'hui", questionnaire
  fonctionnels ; un vrai plan 14 jours généré par LLM externe importé avec succès

### Limitation assumée par la refonte structurée
Les collations "conditionnelles" (ex: *"0g si repos, 150g si entraînement"*) ne sont plus
représentables : le modèle exige des quantités numériques fixes, vérifiées
arithmétiquement. Le prompt demande désormais des collations dimensionnées pour une
activité modérée fixe plutôt que variable. Résoudre ça proprement demande la fonctionnalité
"Activités du jour" ci-dessous plutôt qu'un bricolage dans le format du plan.

### Idée notée pour une étape future (probablement liée au Sport / Étape 3)
Onglet "Activités du jour" au-dessus des repas du jour, avec un sélecteur simple
repos / léger / intense pour les jours où les séances de sport ne sont pas fixes. Nécessite
que le plan déclare des variantes de repas par niveau d'activité (ex: plusieurs `days`
alternatifs, ou des recettes de collation dédiées par niveau) plutôt que des quantités
conditionnelles en texte libre.

### Limitations connues restantes
1. Pas de vraie migration de données entre versions du schéma (voir ci-dessus)

## Étape 3 — Sport

Même ossature que la nutrition (import fichier/collage, questionnaire → prompt, rappels),
volontairement SANS le niveau de rigueur du module d'invariants nutrition (pas de base
d'exercices reliée, pas de vérification arithmétique) — à enrichir plus tard si le besoin
s'en fait sentir, comme la nutrition a évolué progressivement. **Pas de cycle 14 jours pour
le sport** (seulement pertinent pour la nutrition) : les mécanismes sont différents, voir
ci-dessous.

### Deux modes de programme ([sport-schema.ts](mobile/src/lib/sport-schema.ts))
- **Fixe** (`mode: "fixe"`) : une séance précise par jour de semaine RÉEL (`weekday`,
  lundi..dimanche — pas un cycle abstrait comme la nutrition, un vrai jour calendaire).
  Toujours exactement 7 jours. "Aujourd'hui" = la séance dont `weekday` correspond au jour
  réel actuel.
- **Continu** (`mode: "continu"`) : un enchaînement ordonné de séances (`sequence[]`, ex.
  Push → Pull → Legs → Repos) qui n'a PAS de jour attitré. La progression avance uniquement
  quand la séance précédente est marquée faite, peu importe le jour réel où ça arrive —
  c'est le comportement explicitement demandé : faire Push un jeudi puis Pull le dimanche
  suivant doit recommander Legs ensuite, pas se caler sur le calendrier.
- La progression du mode continu est stockée dans `sport_progress` (`current_index`,
  avance en `(index + 1) % nombre_de_séances` à chaque séance terminée — testé y compris
  sur le scénario exact ci-dessus)
- Garde-fous partagés aux deux modes : une séance non-repos sans exercice (ou l'inverse)
  est rejetée ; l'absence totale de repos dans le programme déclenche un avertissement (pas
  un rejet)
- Sécurité : mineurs (pas de charge maximale, encadrement recommandé), blessures/limitations
  déclarées reprises dans le prompt, échauffement + progression graduelle exigés
- Stockage : [sport-db.ts](mobile/src/lib/sport-db.ts), tables `sport_plan` (mode +
  heure de rappel), `sport_sessions` (positionnées soit par `weekday` soit par index de
  séquence), `sport_exercises`, `sport_progress`
- Écran "Sport" ([sport.tsx](mobile/src/app/(tabs)/sport.tsx)) : aperçu de la
  séance du jour (fixe) ou de la prochaine séance recommandée (continu), bouton "Démarrer
  la séance" (l'import du programme est dans Réglages › Sport)
- Questionnaire dédié ([sport-questionnaire.tsx](mobile/src/app/sport-questionnaire.tsx)) :
  choix du mode en premier (avec description), profil, niveau, objectif, jours/semaine,
  lieu, équipement
- **Mode "séance en direct"** ([live-session.tsx](mobile/src/app/live-session.tsx)) :
  exercice courant, série en cours, chrono de repos (compte à rebours), passage automatique
  à la série/l'exercice suivant, écran de fin de séance — fait avancer la progression du
  mode continu à la fin (no-op en mode fixe)

### Rappels : uniquement en mode fixe
Le mode fixe utilise un vrai trigger **hebdomadaire récurrent** (`WEEKLY`, un jour de
semaine réel connu à l'avance) — plus simple que la fenêtre glissante de la nutrition, pas
besoin de réapprovisionnement. Le mode continu n'a **aucun rappel automatique** : l'app ne
peut pas savoir à quelle date réelle tombera la prochaine séance recommandée (ça dépend de
quand l'utilisateur coche la précédente comme faite) — limitation assumée et expliquée à
l'utilisateur dans le questionnaire.

### Budget de notifications (limite iOS des 64)
iOS ne garde que **64 notifications locales en attente** et jette silencieusement le
surplus — donc des rappels perdus sans le moindre signal d'erreur. Le calcul montrait que
c'était atteint en usage normal : fenêtre de 14 jours × 5 repas/jour = 70 notifications.
Deux garde-fous dans [notifications.ts](mobile/src/lib/notifications.ts) :
- **Fenêtre ramenée de 14 à 7 jours** — elle est de toute façon réapprovisionnée à chaque
  ouverture de l'app, donc 7 jours suffisent et bornent le volume à ~35 rappels
- **Plafond global de 60** (`MAX_PENDING_NOTIFICATIONS`), filet de sécurité pour les plans
  anormalement denses. Le **sport est programmé en premier** : ses triggers hebdomadaires se
  répètent indéfiniment (7 max), alors que les repas sont datés et reprogrammés à chaque
  démarrage — en cas de troncature, mieux vaut sacrifier les repas les plus lointains qu'un
  rappel récurrent. Les repas sont posés du plus proche au plus lointain
- Testé (19 assertions) : plan dense, plan pathologique à 10 repas/jour qui force le
  plafond, plan léger non tronqué, ordre chronologique, aucun rappel dans le passé

### Réconciliation des notifications multi-domaines
Limitation connue depuis l'Étape 1 : `cancelAllScheduledNotificationsAsync()` efface TOUT,
donc reprogrammer un domaine effaçait les rappels de l'autre. Corrigé maintenant que le
sport existe vraiment : [notifications.ts](mobile/src/lib/notifications.ts) expose
`rescheduleAllNotifications(nutritionPlan, sportPlan)`, seul point d'entrée qui annule puis
reprogramme les DEUX domaines ensemble. Plus jamais appeler un "reschedule" partiel.

### Restructuration technique
`db.ts` a été scindé en [database.ts](mobile/src/lib/database.ts) (connexion SQLite
partagée + orchestration du versionnage de schéma) + `nutrition-db.ts` + `sport-db.ts`,
pour que chaque domaine reste lisible indépendamment (la Maison suivra le même modèle).

### Suivi de charge et historique de progression
Pendant une série en mode "séance en direct" ([live-session.tsx](mobile/src/app/live-session.tsx)) :
saisie du poids utilisé, pré-rempli avec le poids de la même série la dernière fois que cet
exercice a été fait, plus une ligne d'historique (poids max par séance, les dernières dates).
- Indexé par **nom d'exercice** (pas par séance du plan) : si "Squat" revient dans plusieurs
  séances, l'historique reste continu entre elles
- Table `sport_exercise_logs` dans [sport-db.ts](mobile/src/lib/sport-db.ts) — c'est la
  SEULE table sport à ne jamais être vidée, ni par un réimport de plan ni par un changement
  de version de schéma (`database.ts` l'exclut explicitement de la liste des tables
  réinitialisées) : contrairement au reste qui n'est qu'une copie locale du JSON importé,
  c'est une donnée que l'utilisateur construit dans la durée et qu'on ne peut pas
  reconstituer en réimportant un plan
- "Dernière fois" ignore volontairement les entrées du jour même (si on relance la séance en
  cours de route, on ne veut pas se comparer à soi-même quelques minutes plus tôt)

### Chrono de repos : timestamp, pas compteur
Le compte à rebours de repos ([live-session.tsx](mobile/src/app/live-session.tsx)) calcule
`fin - Date.now()` depuis un **timestamp de fin** au lieu de décrémenter un compteur chaque
seconde. Un compteur décrémenté se fige dès que l'app passe en arrière-plan (JS suspendu sur
iOS, throttlé sur Android) : le repos ne durait alors que le temps passé à regarder l'écran
— bug réel, sur la fonctionnalité centrale du mode séance en direct. En complément :
- **vibration** à la fin du repos (`Vibration` de React Native, pas de dépendance ajoutée)
- **notification programmée** à l'heure de fin, annulée si le repos est écourté ou si on
  quitte la séance — c'est elle qui donne le signal quand le téléphone est verrouillé, la
  vibration seule ne partant pas si le JS est suspendu

### Séances terminées
Table `sport_session_completions` (date → nom de séance) dans
[sport-db.ts](mobile/src/lib/sport-db.ts). `completeCurrentSession()` enregistre la séance du
jour dans les **deux** modes (avant d'avancer le curseur en mode continu, pour enregistrer
celle qu'on vient de faire et non la suivante). L'onglet Sport affiche alors une pastille
"Séance faite aujourd'hui" et le bouton passe en secondaire "Refaire la séance", au lieu de
reproposer indéfiniment "Démarrer la séance". Comme `sport_exercise_logs`, cette table est
**exclue de la réinitialisation** de `database.ts` : c'est un historique construit dans la
durée, pas une copie du plan importé.

### Reprise, pause et navigation dans la séance en direct
Avant, quitter l'écran perdait la progression (relancer repartait de zéro, en gardant
seulement l'historique des poids). Maintenant :
- table `sport_session_progress` (une seule ligne : date, séance, exercice, série) dans
  [sport-db.ts](mobile/src/lib/sport-db.ts), créée sans changer `SCHEMA_VERSION` donc sans
  réimport. À chaque série validée on sauvegarde la position **suivante** (quitter pendant le
  repos reprend à la série à faire, pas à celle déjà faite). Une progression d'un autre jour ou
  d'une autre séance est ignorée ; `completeCurrentSession()` l'efface
- "Quitter" ouvre un choix : mettre en pause (reprise possible), terminer la séance (marquée
  faite) ou annuler
- boutons "Exercice précédent" / "Passer l'exercice" (passer le dernier termine la séance)
- l'onglet "Aujourd'hui" affiche une carte de la séance du jour (fixe) ou de la prochaine
  séance recommandée (continu) avec Démarrer / Reprendre / Refaire, comme l'onglet Sport

### Limitations connues (Sport)
1. Pas de base d'exercices reliée ni de vérification arithmétique (contrairement à la
   nutrition) — les noms d'exercices sont du texte libre, aucune cohérence vérifiée
2. Mode continu : aucun rappel automatique (voir ci-dessus) — assumé, pas un oubli
3. La feature "Activités du jour" (repos/léger/intense, notée à l'Étape 1) n'est pas
   implémentée : les séances sont fixes, pas d'ajustement dynamique
4. Mode séance en direct : on peut changer d'exercice (précédent / passer) mais pas annuler
   une série déjà validée (son poids reste enregistré)
5. ~~L'écran ne reste pas allumé~~ : réglé par `expo-keep-awake` (voir « Build groupé »), actif seulement dans un build qui le contient

### Expo Go et notifications
Depuis le SDK 53, Expo Go (Android) ne supporte plus `expo-notifications` ; en SDK 57 le simple
import plante l'app au lancement. [notifications.ts](mobile/src/lib/notifications.ts) ne charge donc
le module (`require`) que hors Expo Go (`NOTIFICATIONS_AVAILABLE`) ; dans Expo Go l'app démarre
mais **tous les rappels sont désactivés** (repas, sport, fin de repos), et l'alerte d'import le
dit. Pour tester les rappels il faut un **development build** (EAS Build Android : gratuit, ne
nécessite pas de compte Apple Developer) — à faire avant de considérer les rappels validés. Préparé : `expo-dev-client`
installé, `android.package` = `com.thems1897.assistantpersonnel` (identifiant définitif de l'app
Android), profil EAS `development` (`developmentClient`, distribution interne = APK).

## Progression sport (graphiques)
Directement sur l'**onglet Sport** (choix de l'utilisateur : au premier plan, pas dans un sous-menu,
  présentation épurée), dans [sport.tsx](mobile/src/app/(tabs)/sport.tsx). Ordre : séance du jour,
  série de semaines, progression, puis une ligne discrète "Programme : … — gérer ›".
- **Série de semaines** (le "tracker d'activité") : nombre de semaines consécutives avec au moins une
  séance TERMINÉE ou activité saisie à la main, avec une icône de flamme (🔥) devant le nombre, le
  **record**, et une ligne sur la semaine en cours : **le nombre de séances** ("Cette semaine :
  2 séances"), et non un simple "fait" qui aurait laissé croire qu'une seule séance par semaine
  suffit (choix explicite de l'utilisateur) ; à zéro : "Aucune séance cette semaine : fais-en une
  avant dimanche pour garder ta série" (série en jeu) ou "Fais une séance pour lancer ta série".
  La semaine en cours ne casse pas la série tant qu'elle n'est pas finie. **L'icône est provisoire** : une seule constante à changer,
  `STREAK_ICON` dans [icons.ts](mobile/src/constants/icons.ts), quand le design en aura choisi une.
  Dessous, l'histogramme des séances par semaine (12 semaines, du lundi au dimanche)
- **Activités saisies à la main** (course, vélo, marche, natation, musculation, yoga, sport collectif
  ou "Autre" ; durée facultative ; aujourd'hui / hier / avant-hier). **Le nom est toujours un champ
  libre** : choisir un type le remplit, et on peut le préciser ou le remplacer ("Sport collectif" →
  "Football") ; "Autre" le vide. **Une activité déjà enregistrée se corrige** en la touchant dans
  Réglages › Statistiques (même écran avec le paramètre `id`, titre "Modifier l'activité" : nom et
  durée modifiables, la date ne change pas ; une activité supprimée entre-temps affiche "Activité
  introuvable") : écran modal
  [add-activity.tsx](mobile/src/app/add-activity.tsx), accessible par "＋ Ajouter une autre activité"
  dans la carte série de l'onglet Sport ET dans la carte sport de l'onglet Aujourd'hui, (la
  liste et la suppression des activités sont dans Réglages › Statistiques, plus sur cet écran :
  l'avoir seulement là n'était "ni intuitif ni esthétique"). Elles comptent **autant
  qu'une séance du programme** dans la série et l'histogramme (`getAllActivityDates` = séances
  terminées + activités ; deux séances le même jour comptent deux fois) et marchent sans programme
  importé. Table `sport_activities` ([sport-db.ts](mobile/src/lib/sport-db.ts)), exclue de la
  réinitialisation et **incluse dans la sauvegarde** (champ `sportActivities` avec défaut vide : une
  sauvegarde faite avant cet ajout reste restaurable). Saisie validée dans
  [sport-activity.ts](mobile/src/lib/sport-activity.ts) (durée entière de 1 à 1440 min, refus
  explicite d'une durée mal saisie)
- **Échauffement et étirements ignorés** : un exercice nommé "Échauffement", "warm-up", "Retour au
  calme", "cool-down", "Étirements" ou "stretching" (accents et casse indifférents) n'a pas de
  progression de charge à suivre. `isAuxiliaryExercise` ([sport-stats.ts](mobile/src/lib/sport-stats.ts))
  le reconnaît à son NOM : il n'apparaît plus dans les exercices du graphique, et l'écran de séance
  ne demande plus de poids pour lui (ses données déjà saisies restent en base, rien n'est supprimé).
  Les prompts de génération demandent maintenant aux assistants IA de nommer ces exercices en
  commençant par "Échauffement" ou "Étirements", pour qu'ils soient reconnus
- **Progression par exercice** : **uniquement le graphique** (choix explicite : aucun texte en
  surplus — plus de titre ni de "Dernière / Record / Évolution"). Les exercices sont une rangée
  défilante au-dessus de la courbe ; la valeur d'un point (charge + date) n'apparaît qu'**en le
  maintenant sous le doigt**, dans une bulle placée au-dessus du point (ou en dessous s'il est trop
  haut, et jamais hors du graphique — `placeTooltip` dans
  [chart-utils.ts](mobile/src/lib/chart-utils.ts)) qui reste 0,7 s après avoir levé le doigt pour
  qu'un simple appui soit lisible. La mesure (**charge max / charge moyenne / nombre de séries**) et
  la période (30 jours / 90 jours / tout) sont derrière un petit bouton "⋯" à droite de la rangée
- **Répétitions** : en séance en direct, deux champs côte à côte, **Poids (kg)** et **Répétitions**,
  pré-remplis avec la même série la dernière fois (répétitions à défaut : bas de la fourchette du
  programme, `parseTargetReps` : "8-12" → 8 ; rien pour "AMRAP" ou "30s"). Poids vide = 0 = **exercice au
  poids du corps** (tractions, pompes) ; une série sans poids NI répétitions n'est pas enregistrée
  ([set-entry.ts](mobile/src/lib/set-entry.ts), testé). Colonne `reps` de `sport_exercise_logs` (NULL =
  inconnues : anciennes données), ajoutée par `ALTER TABLE` sans vider l'historique, incluse dans la
  sauvegarde (une sauvegarde plus ancienne se restaure avec répétitions inconnues). Dans le graphique,
  deux mesures de plus : **Volume** (Σ charge × répétitions de chaque série, en kg ; au poids du corps
  les répétitions comptent telles quelles) et **Répétitions** (total du jour) ; un jour sans
  répétitions saisies n'a pas de point plutôt qu'un faux zéro, et un exercice **uniquement au poids du
  corps** suit les répétitions par défaut (`isBodyweightSeries`)
- séance **refaite le même jour** : la dernière charge saisie par série fait foi (sinon les séries
  seraient comptées en double) — `buildExerciseSeries` dans
  [sport-stats.ts](mobile/src/lib/sport-stats.ts), qui contient aussi tous les calculs (testés :
  53 assertions sur les semaines, séries, doublons, records, formats, dans 2 fuseaux ; 2317 sur
  l'arrondi des graduations)
- graphiques en **simples Views**, sans bibliothèque de dessin (donc sans nouveau build) :
  [line-chart.tsx](mobile/src/components/line-chart.tsx) (chaque segment est une fine vue pivotée ;
  géométrie vérifiée visuellement) et [bar-chart.tsx](mobile/src/components/bar-chart.tsx). Les
  graduations de l'axe sont arrondies (`niceAxis` : 35 / 45 / 55 plutôt que 46,3), entières pour
  les séries
- les écrans empilés (courses) ont maintenant un en-tête aux couleurs de l'app

## Statistiques
Rubrique Réglages › Statistiques ([statistics.tsx](mobile/src/app/preferences/statistics.tsx)) : le
seul endroit où l'on retrouve **tout** ce qui a été fait (avant, une activité ajoutée à la main ne se
voyait que dans le compteur de séances). Contenu :
- vue d'ensemble : total / séances du programme / autres activités, et le nombre du mois en cours.
  **Les trois tuiles sont des filtres** de l'historique (choix de l'utilisateur) : la tuile choisie
  passe en couleur d'accent, retoucher la tuile active annule le filtre, changer de filtre repart du
  début de la liste. Les chiffres des tuiles restent les totaux (ils ne bougent pas quand on filtre),
  alors que "Ce mois-ci" suit le filtre ; la répartition "Autres activités" est masquée quand on
  filtre sur le programme ; un filtre sans résultat affiche un message dédié
  (`filterHistory` dans [sport-history.ts](mobile/src/lib/sport-history.ts), testé)
- "Autres activités" : répartition par nom (nombre de fois et temps total ; "Vélo" et "vélo" sont la
  même activité)
- **historique complet**, du plus récent au plus ancien, groupé par mois, avec la pastille
  "Programme" ou "Autre", la durée, et la **suppression** (avec confirmation) des activités saisies à
  la main ; 40 entrées à la fois puis "Voir plus"
- logique pure et testée dans [sport-history.ts](mobile/src/lib/sport-history.ts) (ordre stable à date
  égale : séance du programme d'abord, puis activités de la dernière saisie à la première)
- une séance du programme terminée ne se supprime pas depuis cet écran (seules les activités
  saisies à la main : une séance du programme alimente aussi la progression du mode continu)

## Sauvegarde et restauration
Rubrique Réglages › Sauvegarde ([backup.tsx](mobile/src/app/preferences/backup.tsx),
[backup.ts](mobile/src/lib/backup.ts)). Tout est stocké sur le téléphone : une réinstallation
(déjà arrivée : changement de SDK, APK de développement) efface tout.
- **Export** : l'utilisateur choisit un dossier (`Directory.pickDirectoryAsync`, **sans module natif
  supplémentaire**), l'app y écrit `assistant-personnel-sauvegarde-AAAA-MM-JJ.json`
- **Contenu** : historique de charges, séances terminées, activités saisies à la main, position du
  mode continu, articles de
  courses perso, calendrier des poubelles, réglages (thème, heures, début de cycle), heures
  personnalisées des repas, et **les plans eux-mêmes** : leur texte d'origine est gardé à l'import
  (table `plan_sources`) puis réimporté par le chemin normal à la restauration. L'ancrage
  EFFECTIF du cycle est sauvegardé (sinon la position dans le cycle serait perdue au réimport)
- **Non inclus, volontairement** : repas cochés et articles du plan cochés (leurs identifiants sont
  recréés à chaque import de plan) et la séance en cours. Un plan importé AVANT cette version n'a
  pas son texte d'origine : l'écran le signale et demande de le réimporter une fois
- **Restauration** : choix du fichier, validation (`zod` ; refus clairs d'un JSON illisible, d'un
  fichier d'un autre type, d'une sauvegarde abîmée ou d'une version plus récente), aperçu du
  contenu et **confirmation avant de remplacer** les données actuelles. Tout ce qui est écrit
  directement l'est dans **une transaction** (un échec n'en laisse pas la moitié, testé). Un plan
  absent de la sauvegarde n'efface pas le plan actuel ; un plan illisible produit un avertissement
  et le reste est restauré
- testé de bout en bout (56 assertions, base SQLite réelle) : export, effacement total, restauration,
  comparaison de tout l'état, re-sauvegarde identique, restauration répétée, échec en cours de route
- **non testé sur téléphone** : le sélecteur de dossier et l'écriture du fichier (API native)

## Poubelles (Étape 4 — Maison, portée réduite)
Seule fonctionnalité "Maison" voulue par l'utilisateur : le calendrier des poubelles, avec un
rappel **la veille au soir**. Quatre types fixes (identifiants stables 1-4, définis dans
[waste.ts](mobile/src/lib/waste.ts)) : **déchets communs (gris), sacs PMC (bleus), sacs jardin
(verts), cartons** (ajoutés après coup : `initWasteSchema` fait un `INSERT OR IGNORE` par type, donc
un nouveau type arrive dans une base existante sans toucher aux réglages déjà saisis). Pour chacun, dans Réglages ([waste-settings.tsx](mobile/src/components/waste-settings.tsx)) :
jour de ramassage (ou "Aucun" = type non suivi), fréquence **chaque semaine ou 1 semaine sur 2**,
et pour le "1 sur 2" le choix du **prochain vrai ramassage** (deux dates proposées : la plus proche
et la suivante), qui cale la parité. Une heure de rappel commune, 19:00 par défaut.
- logique pure et testée dans [waste.ts](mobile/src/lib/waste.ts) : `isCollectionDay` calcule la
  parité des semaines depuis la date d'ancrage (valable aussi AVANT l'ancrage ; sans ancrage elle
  retombe sur "chaque semaine" : mieux vaut un rappel de trop qu'un ramassage raté), `addDays`
  calendaire donc insensible au changement d'heure
- rappels : **datés** (pas hebdomadaires : "une semaine sur deux" n'existe pas comme déclencheur
  récurrent) sur 14 jours, reprogrammés à chaque ouverture, **un seul rappel par soir** qui regroupe
  tous les sacs ("Ce soir, sortir les sacs PMC bleus et les sacs jardin verts."), canal Android
  "home". Intégrés à `rescheduleAllNotifications` : programmés après le sport et AVANT les repas
  dans le budget de 60 (peu nombreux, et plus gênants à rater qu'un repas lointain)
- l'onglet "Aujourd'hui" affiche une carte "Ce soir, sortir …" quand un ramassage a lieu demain
- table `waste_bins` ([waste-db.ts](mobile/src/lib/waste-db.ts)) créée avec les types sans jour,
  **exclue de la réinitialisation** de `database.ts` (calendrier saisi à la main)
- testé : 52 assertions sur la logique (alternance exacte de 14 jours sur 2 ans, passages
  de mois/année/heure, fuseau Europe/Paris, regroupement, soirs déjà passés) + 11 sur l'intégration
  aux notifications (rappel sans plan nutrition, regroupement, plan dense à 10 repas/jour)

## Structure des onglets (refonte d'après la planche d'ambiance)
Quatre onglets : **Aujourd'hui · Nutrition · Sport · Réglages** (l'onglet "Plan" est devenu
"Nutrition", "Paramètres" est devenu "Réglages"). Demandé par l'utilisateur pour se rapprocher de la planche d'ambiance.
- **Barre d'onglets flottante maison** ([app-tabs.tsx](mobile/src/components/app-tabs.tsx)), avec les
  **illustrations en couleur** comme icônes (logo = Aujourd'hui, assiette = Nutrition, haltère =
  Sport ; Réglages a un rouage plein Ionicons). **Pas de pastille sur l'onglet actif** : son
  illustration est en couleur et son libellé en gras ; les autres sont grisées et atténuées
  (`filter: grayscale`, RN 0.86). Faite avec les composants "headless" d'`expo-router/ui`
  (`Tabs` / `TabList asChild` / `TabTrigger asChild`) et **non avec la barre native** : celle-ci
  applique une teinte unie aux icônes (une illustration deviendrait une silhouette ; `renderingMode`
  n'existe que sur iOS) et ne peut pas flotter. Le prix : plus de comportement natif de la barre.
  Retour arrière possible vers `NativeTabs` si elle pose problème. Comme la barre flotte par-dessus
  le contenu, `BottomTabInset` ([theme.ts](mobile/src/constants/theme.ts)) vaut 112 : chaque écran
  d'onglet réserve cet espace en bas. `TabList asChild` impose son propre style : la barre le
  remplace en passant son `style` après `{...props}`
- **Aujourd'hui, minimal** ([index.tsx](mobile/src/app/(tabs)/index.tsx)) : salutation selon l'heure
  ("Bonjour," / "Bon après-midi," / "Bonsoir,", `greetingForHour`), titre, date, et en haut à droite
  une **haltère** (Ionicons `barbell`, alignée sur le haut du titre) qui ouvre l'onglet Sport. Puis
  l'**anneau de calories, sans fond** (taille calculée d'après l'écran, 280 px au plus, collé sous
  l'en-tête) et une **tuile séparée avec les trois barres** (protéines, glucides, lipides — pas de
  fibres ici), qui tombe vers le milieu de l'écran. Les chiffres s'affichent par un appui sur
  l'anneau ; **ce choix est mémorisé** (`today_show_details` dans `app_settings`). Dessous, des
  **tuiles qui n'apparaissent que si elles servent** : Poubelles (illustration + "Sortir les sacs PMC
  bleus" si un ramassage a lieu demain, "Aujourd'hui : …" s'il a lieu aujourd'hui seulement → Réglages
  › Poubelles) et Courses (panier, le **premier jour de chaque semaine du cycle**, jours 1 et 8, car
  les courses du plan sont groupées par semaine → liste de courses). Plus de carte sport (la tuile
  "You're on track" de la planche a d'abord été remplacée par la séance conseillée, puis retirée à la
  demande de l'utilisateur). Le **paysage de montagne** (`footer`) est en position absolue, sur
  **toute la largeur et dans ses proportions d'origine** (`aspectRatio` 900/328), son bas passant
  sous la barre d'onglets
- **Nutrition** ([nutrition.tsx](mobile/src/app/(tabs)/nutrition.tsx)) : les repas du jour, avec à
  hauteur du titre, en haut à droite, un **sélecteur de date** (puce "📅 Aujourd'hui ⌄" flanquée de
  flèches jour précédent / suivant) qui ouvre un **calendrier**
  ([date-picker-modal.tsx](mobile/src/components/date-picker-modal.tsx), grille du mois, lundi en
  premier, jours hors de ±90 jours grisés, raccourci "Aujourd'hui" ; logique dans
  [calendar.ts](mobile/src/lib/calendar.ts), testée). Chaque repas est une **grande carte comme sur la
  planche** : image ronde générique, créneau seul en serif ("Collation 2" → "Collation" ; **ni nom du
  plat ni heure** : l'heure se règle dans Réglages › Notifications), macros sur une ligne ("420 kcal ·
  22P · 56G · 14L", police 10), case à cocher (jours passés et aujourd'hui seulement). Un appui ouvre
  un **pop-up** (croix en haut à droite) : créneau, **nom du plat**, macros, ingrédients et **étapes de
  préparation**. En bas, à la place du "Add Meal" de la planche : bouton plein **Liste de courses** et
  bouton discret **Gérer le plan**. Les repas cochés ici alimentent l'anneau de Aujourd'hui
  - **Images des repas** : les cinq assiettes de la planche, découpées en ronds de 160 px
    (`mobile/assets/images/meals/`, script [crop-meals.ps1](mobile/scripts/crop-meals.ps1)), un peu
    douces car la planche est en basse résolution. Choisies par famille de créneau
    (`mealSlotKind` dans [meal-slots.ts](mobile/src/lib/meal-slots.ts), accents et casse indifférents,
    créneau inconnu → image du déjeuner ; testé, 24 assertions). Des images propres à chaque recette
    ont été jugées inutiles pour l'instant
  - **Étapes de préparation** : champ `steps` (liste de phrases) **facultatif** sur `singles` et
    `batches` (colonne `steps` ajoutée par `ALTER TABLE` si absente, sans vider la base) ; les prompts
    de génération le demandent (pour un batch, la dernière étape = partage en portions et
    conservation). Un plan importé avant n'a pas d'étapes tant qu'il n'est pas régénéré puis réimporté

## Liste de courses
Écran [courses.tsx](mobile/src/app/courses.tsx) (pile de navigation, pas un onglet), ouvert par une
carte "Liste de courses" dans l'onglet Nutrition. Les `courses` du plan, importées et vérifiées
depuis le début mais jamais affichées, sont enfin visibles :
- sélecteur de semaine (si le plan en a plusieurs), ouvert d'office sur la semaine du cycle en
  cours ; articles **groupés par rayon** dans l'ordre d'un parcours de supermarché (fruits et
  légumes, viandes/poissons/œufs, laitiers, féculents, matières grasses, épicerie), le
  **garde-manger à part en dernier** ("à vérifier" plutôt qu'à acheter), pastille "À congeler"
- quantités lisibles : "500 g", "1,5 kg", "6 unités" (jamais "1.2000000000000002")
- cases à cocher **persistantes** (table `nutrition_course_checks`, par identifiant d'article, donc
  indépendantes d'une semaine à l'autre même pour le même aliment), compteur "x / N articles" et
  "Tout décocher" pour refaire les mêmes courses au cycle suivant. Un réimport de plan remet les
  cases à zéro (les identifiants d'articles changent) ; la table est dans `ALL_TABLES`
- **articles ajoutés à la main** (ex : "Lessive", hors plan nutrition) : champ "Ajouter un article"
  (nom + quantité facultative en texte libre) en haut de l'écran, section "Mes ajouts" cochable,
  suppression unitaire (✕) ou "Supprimer les articles cochés". Table `shopping_custom_items`
  ([shopping-db.ts](mobile/src/lib/shopping-db.ts)) **exclue de la réinitialisation** de
  `database.ts` : liste perso de l'utilisateur, un réimport de plan ne doit pas l'effacer. L'écran
  fonctionne sans plan nutrition. Saisie nettoyée par `parseCustomItemInput` (espaces compactés,
  nom obligatoire, longueurs plafonnées) ; doublons autorisés ; requêtes paramétrées (testé avec une
  saisie type injection SQL)
- logique pure et testée dans [nutrition-courses.ts](mobile/src/lib/nutrition-courses.ts), accès
  base dans [nutrition-db.ts](mobile/src/lib/nutrition-db.ts) (33 assertions)

## Navigation entre les jours
**Déplacée dans l'onglet Nutrition** (voir "Structure des onglets") : flèches jour précédent /
suivant et calendrier, de -90 à +90 jours (`MAX_DAYS_BACK` / `MAX_DAYS_AHEAD` dans
[nutrition.tsx](mobile/src/app/(tabs)/nutrition.tsx) ; c'était ±14 jours avant le calendrier). La
puce affiche "Aujourd'hui" / "Demain" / "Hier" / "mer. 14 oct.", puis la date complète ("Mercredi 14
octobre") et la semaine du cycle s'affichent sous le titre. Les règles ci-dessous restent vraies :
- **Passé** : on peut cocher / décocher des repas (oublis de saisie), les jauges se recalculent
  pour ce jour-là
- **Futur** : consultation seulement — pas de case à cocher (les jauges ne concernent que Aujourd'hui)
- le jour du cycle se calcule depuis la date consultée (`getCycleDayForDate` accepte une date) ;
  les cases cochées sont lues et écrites pour la date consultée, pas pour aujourd'hui
- **passage à minuit** : [use-today.ts](mobile/src/hooks/use-today.ts) renvoie la date du jour et la met
  à jour à minuit pile (minuterie) et au retour de l'app au premier plan (les minuteries ne tournent
  pas écran verrouillé). L'écran revient alors sur le nouvel "aujourd'hui" (un décalage de +1
  afficherait sinon le surlendemain). Testé avec un faux temps (23:59, minuit, 3 jours de veille)
- helpers `addDays`, `formatLongDate`, `formatShortDay` dans [date.ts](mobile/src/lib/date.ts) :
  `addDays` raisonne en jours calendaires (pas en 24 h), donc ne saute ni ne répète un jour au
  changement d'heure — testé (27 assertions, dont 60 jours consécutifs, années bissextiles, fuseau
  Europe/Paris)

## Jauges "consommé / prévu"
L'onglet "Aujourd'hui" montre la progression de la journée quand on coche des repas (dans
Nutrition). Choix de l'utilisateur : **anneau circulaire pour les calories** (donnée principale,
avec le pourcentage au centre, sans fond) et **trois barres arrondies pour les macros** (protéines,
glucides, lipides, chacune de sa couleur) dans leur propre tuile, toujours visibles. Par défaut
**aucun chiffre** (écran épuré) ; un appui sur l'anneau affiche "kcal consommées / prévues" et les
grammes des macros, et ce choix survit au redémarrage.
- [circular-gauge.tsx](mobile/src/components/circular-gauge.tsx) : anneau **SVG à bouts arrondis** dans un
  build qui contient `react-native-svg`, sinon **en simples Views** (voir « Build groupé »). Version
  vues : un cercle dont seuls les
  bords haut/droit sont colorés dessine un arc de 180° ; deux d'entre eux, masqués chacun à une
  moitié et pivotés, remplissent 0-50 % puis 50-100 %. Angles vérifiés visuellement (page HTML
  équivalente, de 0 à 100 %). Limites de la version vues : bouts d'arc plats et un filet à peine
  visible à la jonction des deux moitiés
- [gauge.tsx](mobile/src/components/gauge.tsx) : barre arrondie animée (Views). Les deux passent
  en couleur d'avertissement (`warn`) au-delà de 110 % de la cible ; remplissage plafonné à 100 %
- calcul dans [nutrition-progress.ts](mobile/src/lib/nutrition-progress.ts) : somme des macros des
  repas cochés ÷ totaux du jour. Les **repas libres** (sans macros) ne comptent pas, plutôt que
  d'être estimés ; une note le rappelle dans la vue détaillée quand il y en a un

## Réglages (ex-Paramètres)
Onglet [settings.tsx](mobile/src/app/(tabs)/settings.tsx), destiné à accueillir à terme le
réglage de toutes les fonctionnalités. Il est organisé en **sous-menus** : l'onglet n'est plus
qu'une liste de rubriques (**titre seul**, à la demande de l'utilisateur : le résumé d'une ligne
sous chaque titre a été retiré, et avec lui ses requêtes à chaque retour sur l'écran) ouvrant chacune son écran dans [preferences/](mobile/src/app/preferences) (pile de
navigation avec en-tête aux couleurs de l'app, [_layout.tsx](mobile/src/app/preferences/_layout.tsx)) :
**Apparence**, **Notifications** (autorisation + heures des rappels de repas et de sport),
**Nutrition** (import / remplacement du plan + cycle du plan), **Poubelles**, **Sport** (import /
remplacement du programme), **Statistiques**, **Sauvegarde**.
Ajouter un réglage = ajouter une rubrique (un fichier dans `preferences/`, une entrée dans la
liste et dans le `_layout`), sans alourdir un écran unique. Enveloppe commune
[preference-screen.tsx](mobile/src/components/preference-screen.tsx), libellés partagés dans
[preference-labels.ts](mobile/src/lib/preference-labels.ts) (pas d'export depuis un fichier de
route), reprogrammation des rappels factorisée dans `rescheduleIfPermitted()`
([notifications.ts](mobile/src/lib/notifications.ts)). Les heures des **poubelles** restent dans
leur rubrique (avec leurs jours), pas dans Notifications.

**L'import du programme sport a déménagé de l'onglet Sport vers Réglages › Sport** (choix de
l'utilisateur : l'onglet Sport est appelé à devenir plus riche que "lancer une séance", il ne doit
pas porter l'import). L'onglet Sport garde la séance du jour, la série et les graphiques (Démarrer /
Reprendre / Refaire) et un lien "Gérer le programme" ; sans programme, un bouton "Importer un
programme" y mène. **Même chose pour le plan nutrition** : son import (prompt, questionnaire, fichier
`.json`, collage, invariants) est dans Réglages › Nutrition ; l'ancien onglet Plan est
devenu l'onglet **Nutrition** (menu du jour, liste de courses, lien discret "gérer" vers cette
rubrique). Sans plan, un bouton "Importer un plan" y mène.

Contenu des rubriques :
- **Thème** automatique / clair / sombre : `Appearance.setColorScheme` (RN 0.86 : `'unspecified'`
  pour "suivre le système", plus `null`), appliqué dès le démarrage dans `_layout.tsx` avant le
  premier rendu. Tout le code lisant `useColorScheme` suit sans modification
- **Notifications** : état de la permission (autorisée / pas encore / refusée / indisponible
  dans Expo Go), bouton pour l'autoriser, ou pour ouvrir les réglages système quand elle a été
  refusée définitivement (le téléphone ne redemande plus) — règle l'ancienne limitation
  "aucun moyen de la redemander"
- **Cycle du plan** : "Le cycle commence un…" (lundi..dimanche) et, pour un cycle de 14 jours,
  "Cette semaine, tu en es à la semaine 1 / 2". Par défaut le jour 1 est le jour d'import, ce qui
  décalait les jours de courses / batch cooking prévus par le plan (et les rappels avec). Une
  première version demandait "aujourd'hui, c'est le jour N" : jugée peu intuitive par
  l'utilisateur, remplacée par le jour de la semaine. `setCycleStart(weekday, week)` dans
  [nutrition-db.ts](mobile/src/lib/nutrition-db.ts) ancre le cycle sur le DERNIER ce jour de
  semaine passé ou d'aujourd'hui (moins 7 jours en semaine 2), stocké dans `app_settings`
  (`nutrition_cycle_start_date`) et lu par `getActivePlanMeta()` : tout le code (écran du jour,
  rappels) en profite sans modification. Survit à un réimport ; "Rétablir" supprime le réglage.
  L'écran "Aujourd'hui" n'affiche plus "jour N/14" mais "semaine X sur 2" (rien pour un cycle de
  7 jours : le jour de la semaine suffit). Testé (256 assertions) : 7 jours de départ x 29 jours
  autour d'aujourd'hui, semaines 1 et 2 d'un cycle de 14, bouclage, réimport
- **Heures des rappels** : une heure par créneau de repas, plus l'heure de la séance de sport
  (mode fixe seulement). Enregistrer reprogramme tous les rappels si la permission est
  accordée ; "Rétablir les heures du plan" supprime les personnalisations

Stockage ([settings-db.ts](mobile/src/lib/settings-db.ts), [nutrition-db.ts](mobile/src/lib/nutrition-db.ts)) :
table `app_settings` (clé/valeur : thème, heure du sport) et `nutrition_slot_times` (nom de
créneau → heure). Les heures sont stockées **par nom de créneau, à part des repas importés** et
appliquées par-dessus n'importe quel plan : un réimport efface les repas mais pas ces choix.
Les deux tables sont **exclues de la réinitialisation** de `database.ts`. Un créneau dont le
plan donne des heures différentes selon les jours est signalé ; régler son heure l'uniformise.
Les repas du jour sont retriés par heure effective après application (l'ordre SQL ne la voit pas).

## Système de design

Refonte visuelle inspirée d'une app HTML de référence fournie par l'utilisateur
(tracker nutrition/sport perso, palette verte type "nature/santé"), appliquée à
fonctionnalités inchangées — priorité choisie explicitement par l'utilisateur
("le design d'abord") plutôt que le détail des exercices ou les deux en même temps.
- **Palette** ([theme.ts](mobile/src/constants/theme.ts)) : couleurs sémantiques
  (`background`, `backgroundElement`, `backgroundSelected`, `text`, `textSecondary`,
  `textFaint`, `line`, `lineSoft`, `accent`, `accentWash`, `accentLine`,
  `accentOnColor`, `warn`, `warnWash`, `warnLine`), déclinées light/dark. `accent` =
  **bleu-vert** (`#1F6B70` clair / `#5DB5BD` sombre, voir la section suivante ; c'était un vert
  `#2E6A57` avant l'adoption de la planche d'ambiance), remplace l'ancien noir/blanc `theme.text`
  utilisé pour les éléments actifs (cases cochées, chips sélectionnées, boutons
  primaires)
- **Typographie** ([themed-text.tsx](mobile/src/components/themed-text.tsx)) :
  `title`/`subtitle` passent en serif (`Fonts.serif`), deux nouveaux types `data`
  (mono, `tabular-nums`, pour tout affichage numérique : calories, macros, séries,
  poids, chrono) et `eyebrow` (petit, majuscules, espacé, pour les labels de macros et
  la pastille `Tier`)
- Nouveau composant `Tier` ([form-fields.tsx](mobile/src/components/form-fields.tsx)) :
  pastille arrondie à 3 tons (`accent`/`warn`/`neutral`), utilisée pour "Jour de repos"
  dans l'onglet Sport
- Boutons primaires (import, génération de prompt, démarrer une séance, valider une
  série) uniformisés en `type="accent"` + texte `themeColor="accentOnColor"` ; les
  boutons secondaires (copier le prompt générique, personnaliser via questionnaire)
  restent `type="backgroundElement"` pour marquer la hiérarchie
- Une fois un plan/programme importé, les sections d'import/génération se replient
  automatiquement (état `showImport`, initialisé à `!planActif` au premier montage) et
  sont remplacées par un lien discret "Remplacer le plan/programme" — évite d'encombrer
  l'écran une fois l'essentiel fait

### Identité visuelle issue du dossier `Design/` (planche d'ambiance, logo, illustrations, montagne)
L'utilisateur a généré des visuels avec une IA d'images (les prompts sont dans l'historique) et les a
déposés dans `Design/`. Appliqué **sans nouveau build** :
- **Palette bleu-vert** relevée sur la planche (anneau #1B6566, bouton #236B71, barres #2D7987 /
  #66A793 / #EAB132, fond #ECF2F5), choisie par l'utilisateur plutôt que le vert du logo (#346B58) :
  les deux ne sont donc pas identiques, c'est voulu. Tous les couples texte/fond (4,5:1) et
  barre/piste (3:1) ont été **vérifiés au contraste WCAG** en clair et en sombre, ce qui a obligé à
  assombrir quelques teintes par rapport à la planche (texte discret, ambre d'avertissement, et
  barres glucides / lipides / fibres en mode clair : #66A793 et #EAB132 sont illisibles sur une
  piste pâle). Détails et justification en commentaire de [theme.ts](mobile/src/constants/theme.ts)
- **Une couleur par macro** (jetons `macroProtein`, `macroCarbs`, `macroFat`, `macroFiber`) pour les
  barres de l'onglet Aujourd'hui ; `Gauge` accepte un `color`. Anneau de calories plus épais (16)
- **Illustrations en toutes petites icônes** (choix de l'utilisateur : pas en grands visuels de page
  vide) : assiette, haltère + gourde, panier, poubelles, liste cochée, **découpées de la planche**
  (fond damier incrusté retiré par remplissage depuis les bords, frange claire supprimée, sortie en
  PNG transparent 256 px dans `mobile/assets/images/icons/`). [section-icon.tsx](mobile/src/components/section-icon.tsx) :
  `SectionIcon` (illustration seule) et `IconBadge` (emplacement rond, **sans fond** depuis que l'utilisateur
  a demandé de retirer la pastille — en mode sombre, les illustrations vert foncé y sont moins
  lisibles ; les
  rubriques sans illustration — Apparence, Notifications, Sauvegarde — ont une icône au trait
  Ionicons via `@expo/vector-icons`, JS seulement). Utilisées : lignes de la liste des Réglages,
  titres de l'onglet Sport, tuiles poubelles et courses de Aujourd'hui, **barre d'onglets**,
  titres de cartes (`FieldGroup icon=…`)
- **Montagne** ([mountain-image.tsx](mobile/src/components/mountain-image.tsx)), deux variantes
  recadrées de `montagne.png` avec un **alpha progressif cuit dans le PNG** (pour se poser sans bord
  sur n'importe quel fond), atténuées à 28 % en mode sombre : `banner` (fondue en haut et en bas,
  carte "Petits pas. Grands résultats." en bas de Réglages) et `footer` (fondue en haut seulement,
  bas plein : paysage en bas de l'onglet Aujourd'hui, au-dessus de la barre d'onglets)
- **Non repris de la planche** : les photos de repas (les plans n'en ont pas), les chiffres dans
  l'anneau (contraire au choix "épuré"), la flamme dans l'anneau (réservée à la série de semaines).
  La barre d'onglets flottante, d'abord écartée, a été reprise ensuite à la demande de l'utilisateur
- Le détail de l'icône, du splash, de l'anneau SVG et du maintien de l'écran allumé est dans
  « Build groupé » ci-dessous

## Build groupé (fait et validé sur téléphone)
Build de développement Android installé et testé par l'utilisateur : anneau SVG à bouts arrondis, écran
allumé en séance et nouvelle icône fonctionnent. Tout ce qui exigeait un **nouveau build natif** a été préparé en une fois ; le code reste compatible
avec l'ancien APK de développement (rien ne plante tant que le nouveau build n'est pas installé) :
- **`expo-keep-awake`** : l'écran reste allumé pendant la séance en direct
  ([use-session-keep-awake.ts](mobile/src/hooks/use-session-keep-awake.ts)). Le module est chargé par un
  `require` protégé : sans lui (ancien APK), l'écran peut s'éteindre, rien ne plante
- **`react-native-svg`** : anneau de calories à **bouts arrondis**
  ([circular-gauge.tsx](mobile/src/components/circular-gauge.tsx), cercle SVG animé sur `strokeDashoffset`,
  départ à midi). Même principe de repli : `require` protégé + barrière d'erreur ; dans l'ancien APK,
  l'ancien anneau en simples vues (bouts plats) s'affiche à la place. Vérifié sur téléphone après installation
- **Mises à jour de correctif** (expo, expo-router, expo-constants, expo-linking, expo-notifications,
  @expo/ui) faites : `expo-doctor` 21/21
- **Icône et écran de démarrage** générés par make-app-icons (aujourd'hui [make-app-icons.py](mobile/scripts/make-app-icons.py), voir « Hojo » en tête de fichier ; ce qui suit décrit la VERSION D'ORIGINE, icône verte sur crème) à partir
  de `Design/Logo app*.png` : le logo tel que dessiné (vert `#346C57` sur fond crème `#F2F3EE`) — c'est le
  vert du LOGO, pas le bleu-vert de la palette de l'app (choix de l'utilisateur de garder l'identité
  verte pour l'icône). Icône iOS/vignette = logo plein ; Android adaptatif = logo transparent (dans la zone
  sûre) sur fond uni crème ; **monochrome** Android 13 = silhouette blanche ; splash = logo 200 px sur
  crème. `SPLASH_BACKGROUND` ([theme.ts](mobile/src/constants/theme.ts)) doit rester égal à la couleur de
  fond d'`app.json`. Couleur des notifications = vert du logo. Le splash prolongé
  ([animated-icon.tsx](mobile/src/components/animated-icon.tsx)) reprend le même visuel (200 px, pas de saut
  au relais). Supprimés : tous les restes du modèle Expo (logos, `expo.icon` iOS, assets d'exemple, version
  animée de l'icône)
- Commande (Windows) : `eas.cmd build --profile development --platform android` après `eas.cmd login`
  (`eas` seul échoue : PowerShell bloque les scripts `.ps1`). Piège rencontré : au premier lancement du
  nouveau build, l'app est restée sur « connecting to dev servers » parce que Metro n'avait pas encore
  compilé le bundle (cache vide, plusieurs minutes) ; relancer `npx expo start --tunnel --dev-client
  --clear`, **préchauffer** le bundle (`curl` sur `entry.bundle?platform=android&dev=true&lazy=true`,
  11 Mo) puis rouvrir l'app

## Build autonome et mises à jour à distance (préparé, à lancer par l'utilisateur)
Pour utiliser l'app au quotidien sans l'ordinateur (le build de développement dépend de Metro) :
- profil EAS **`preview`** = APK autonome (code embarqué), installé **par-dessus** l'APK de développement :
  même identifiant (`com.thems1897.assistantpersonnel`) et même clé de signature gérée par EAS, donc les
  données SQLite sont conservées (faire quand même une sauvegarde avant)
- **`expo-updates`** installé : `runtimeVersion` = politique `appVersion` (**à incrémenter dans `app.json`
  à chaque changement NATIF**, sinon une mise à jour incompatible pourrait être servie à un ancien build),
  `updates.url` = projet EAS, canaux `development` / `preview` / `production` dans `eas.json`
- un changement **JavaScript seulement** se publie sans build : `eas.cmd update --channel preview
  --message "…"` ; le téléphone le récupère au lancement suivant. Un nouveau module natif exige un build
- `expo-haptics` installé, utilisé par la passe d'interactions
- **Heatmap musculaire** : réalisée, voir la section « Muscles et heatmap »
- chantiers prévus dans cet ordre : ce build → langue FR/EN → répétitions + répertoire d'exercices +
  heatmap musculaire → Health Connect (Android, sans serveur ; Garmin via l'app Garmin Connect, à vérifier)
  → passe d'interactions. Liste d'amis : écartée en temps réel (incompatible avec « aucune donnée
  hors de l'appareil »), seulement carte de progression partageable ou code ami importé à la main

## Langue français / anglais
Réglages › Langue : **Automatique** (langue du téléphone : français ou anglais par défaut), **Français**,
**English**. Choix stocké dans `app_settings` (`language_preference`), donc **inclus dans la sauvegarde**
(la restauration l'applique tout de suite) ; appliqué avant le premier rendu dans `_layout.tsx`.
- **Principe « gettext » : le texte FRANÇAIS sert de clé** ([i18n/index.ts](mobile/src/i18n/index.ts)).
  `t("Réglages")` rend le texte tel quel en français et sa traduction en anglais ; un texte sans
  entrée s'affiche en français (jamais de trou). `tp(n, un, plusieurs)` pour les pluriels (français :
  0 et 1 au singulier ; anglais : seulement 1), `{param}` pour les variables, `msg()` pour marquer un
  texte de **constante** à traduire plus tard avec `t(valeur)` (listes de choix, libellés de
  poubelles…). Les composants de formulaire (`FieldGroup`, `TextField`, `ChipSingleSelect`, `Tier`,
  `ToggleField`…) traduisent eux-mêmes leurs `title` / `label` / `placeholder` / libellés d'options :
  un écran peut donc leur passer le texte français brut
- **Dictionnaire** : [i18n/en/](mobile/src/i18n/en) (`ui.ts` écrans, `prompts.ts` questionnaires et
  prompts, `lib-*.ts` messages d'erreur / rappels / poubelles, `date.ts` jours et mois). **Pour ajouter un
  texte** : l'écrire en français dans `t(...)` (ou en attribut `label=` etc.), lancer `npm test` — le test
  `tests/i18n.test.ts` **liste tous les textes sans traduction** (avec `I18N_DUMP=fichier.json` il écrit la
  liste complète) et vérifie que les `{paramètres}` sont les mêmes dans les deux langues
- **Changer de langue remonte toute la navigation** (`<AppStack key={langue}>` dans `_layout.tsx`) :
  tous les textes se relisent sans que chaque écran s'abonne ; l'écran de langue demande à y revenir
  (`requestReturnToLanguageScreen`), sinon on retomberait sur le premier onglet. Les rappels déjà
  programmés sont reprogrammés dans la nouvelle langue
- **Les identifiants ne se traduisent jamais** : noms de jours (`lundi`…, stockés en base, dans les
  sauvegardes et le JSON des plans), catégories d'aliments, clés JSON. Pour l'AFFICHAGE d'un jour :
  `weekdayName()` ([date.ts](mobile/src/lib/date.ts)). Dates : `formatLongDate` ("Mercredi 14 octobre" /
  "Wednesday, October 14"), `formatShortDay`, `formatMonthYear` ; décimale `,` ou `.` (`decimalSeparator`)
- **Prompts de génération** : les phrases sont traduites comme le reste, l'exemple JSON
  (`exampleJson()`) a ses noms et étapes dans la langue de l'app, et le prompt DEMANDE que le contenu du
  plan (noms de repas, étapes, noms d'exercices) soit écrit dans cette langue, avec les identifiants et
  clés JSON inchangés. Un plan déjà importé garde sa langue d'origine (c'est du contenu, pas de
  l'interface) ; les créneaux usuels ("Petit-déjeuner", "Collation 2"…) sont traduits à l'affichage, et
  `mealSlotKind` reconnaît les mots anglais (breakfast, lunch, dinner, snack…)
- **Non traduit volontairement** : le nom de l'app ("Hojo"), les noms propres de
  langues dans l'écran de langue ("Français" / "English"), les textes saisis par la personne
- **Limites** : la mise en page n'a pas été vérifiée en anglais sur téléphone (textes plus longs ou
  plus courts) ; les tests forcent le français (`freshDatabase` appelle `setLanguage('fr')`) pour que les
  messages vérifiés ne dépendent pas de la machine

## Muscles et heatmap
Onglet Sport › carte **Muscles** ([muscle-heatmap-card.tsx](mobile/src/components/muscle-heatmap-card.tsx)) : une
silhouette de face et de dos ([muscle-map.tsx](mobile/src/components/muscle-map.tsx)) dont chaque groupe est
coloré selon son intensité (neutre → couleur d'accent, opacité de 0,22 à 1, dans les deux thèmes). Cinq vues :
**7 jours** et **30 jours** (séries réellement faites, d'après les charges saisies), **Séance** (séance du jour
ou prochaine séance), **Programme** (toutes les séances), **Exercice** (un exercice à choisir). Sous la
silhouette : les 5 muscles les plus sollicités avec leur nombre de séries, et la liste des exercices non reconnus
(qui ne comptent pas). Pendant une séance, le lien « Muscles travaillés » ouvre une fenêtre pour l'exercice en cours
([exercise-muscles-modal.tsx](mobile/src/components/exercise-muscles-modal.tsx)).
- **Répertoire d'exercices** ([exercise-catalog.ts](mobile/src/lib/exercise-catalog.ts)) : ~90 exercices, chacun avec
  son identifiant stable, son nom français et anglais, ses muscles **principaux** et **secondaires** et des
  appellations alternatives. 15 groupes : pectoraux, épaules, biceps, triceps, avant-bras, abdominaux, obliques,
  trapèzes, dos (grand dorsal, rhomboïdes), lombaires, fessiers, quadriceps, ischio-jambiers, adducteurs, mollets.
  Les variantes d'équipement (barre, haltères, poulie, machine) n'ont pas d'entrée à part : elles se rattachent à
  l'exercice de base
- **Reconnaissance d'un nom libre** (`matchExercise`) : mots sans accents, ponctuation, pluriel ni mots vides ;
  l'appellation la PLUS LONGUE dont tous les mots figurent dans le nom l'emporte ("développé couché incliné
  haltères" → développé incliné, pas développé couché), à égalité celle qui laisse le moins de mots inexpliqués.
  Trois tests gardent le répertoire cohérent : aucune appellation partagée par deux exercices, **chaque
  appellation se reconnaît elle-même** (détecte les égalités ambiguës dès qu'on ajoute un alias), et une
  cinquantaine de noms réels français / anglais. **Pour ajouter un exercice** : une ligne dans `ENTRIES`, puis `npm test`
- **Identifiant du programme** : le champ `exerciseId` (facultatif) de chaque exercice du programme. Les prompts
  donnent la liste « identifiant — nom » (dans la langue de l'app) à l'assistant IA et lui demandent de ne
  renseigner le champ que si l'exercice y figure, sans l'inventer. `resolveExercise(nom, id)` : identifiant valide
  d'abord, sinon reconnaissance du nom. Colonne `exercise_id` de `sport_exercises` ajoutée par `ALTER TABLE` ;
  pour les charges saisies (qui n'ont que le nom), on reprend l'identifiant de l'exercice du programme du même nom
- **Calcul** ([muscle-load.ts](mobile/src/lib/muscle-load.ts)) : une série compte 1 pour un muscle principal et 0,5
  pour un secondaire. 7 / 30 jours et Programme : intensité = séries par semaine ÷ 12 (seuil « zone pleine »,
  `FULL_WEEKLY_SETS`, fourchette courante 10-20), plafonnée à 1. Séance : **relative** (le muscle le plus
  sollicité est plein), car une séance seule ne peut pas remplir une semaine. Exercice : principaux à 1,
  secondaires à 0,45. En mode continu, « Programme » représente un cycle complet, pas une semaine
- **Images** : [Design/Heatmap muscles.png](Design/Heatmap%20muscles.png) (1312x1199, face + dos, gris sur fond blanc)
  découpée par [make-muscle-masks.py](mobile/scripts/make-muscle-masks.py) (Python + Pillow, à relancer si la planche
  change). Chaque zone grise séparée par un trait blanc est une composante ; elle est rattachée à un groupe, et les
  composantes qui dessinaient plusieurs muscles d'un bloc sont **coupées par tranches de hauteur** (bras : biceps /
  avant-bras / main ; jambe de face : quadriceps / mollet / pied, coupe à y=895 ; dos : tête / trapèzes, coupe à
  y=140 ; jambe de dos : ischio / mollet / pied). Sortie : un PNG blanc sur fond transparent par groupe et par
  vue (580x1180, ~480 Ko au total), `base.png` (silhouette entière, tête, mains et pieds compris), et la table
  générée [muscle-masks.ts](mobile/src/constants/muscle-masks.ts). Les masques sont teintés à l'exécution
  (`tintColor`), les traits blancs de la planche restent transparents : ça marche sur fond clair et sombre
- **Ajouts pour le programme « Genoux solides »** : `spanish_squat`, `nordic_curl` (sorti de `leg_curl`, dont l'alias
  « nordic curl » est retiré), `copenhagen_plank`, `external_rotation`, `plyometric_drills` (sauts, pogo, bonds latéraux, snap-downs).
  Collision corrigée : l'alias seul « épaule » faisait reconnaître comme épaulé tout nom contenant « épaule » (« Rotation externe
  d'épaule » comptait pour un épaulé) ; `power_clean` s'appelle maintenant « Épaulé (power clean) ». `step_up` reconnaît aussi
  « step-down / descente de marche ». Un exercice composé (superset, bloc) ne porte qu'UN identifiant : seul le principal compte dans la heatmap
- **Limites** : la coupe quadriceps / mollet est une ligne droite (visible au genou) ; pas de détail par chef
  musculaire (biceps long / court, vaste interne / externe) car la planche ne les sépare pas ; les noms
  d'exercices que le répertoire ne connaît pas n'apparaissent pas (ils sont listés sous la silhouette) ; les
  séries comptent pour les charges saisies (une série validée sans poids ni répétitions n'est pas enregistrée)

## Santé : Health Connect (Android) et Garmin
Réglages › Santé ([health.tsx](mobile/src/app/preferences/health.tsx)). **Health Connect** (la couche Google
Santé d'Android) lit, **sur le téléphone et sans serveur** (donc compatible avec « aucune donnée hors de
l'appareil »), ce que la montre et les autres applis y écrivent. **Garmin** n'a pas d'accès direct : son API
est réservée aux entreprises partenaires et exige un serveur ; on passe donc par l'app Garmin Connect, qui
sait écrire dans Health Connect (l'utilisateur active le partage dans les réglages de Garmin Connect).
- **Ce qui est importé** : séances d'exercice (`ExerciseSession`), pas (`Steps`) et calories actives
  (`ActiveCaloriesBurned`), en **lecture seule** (permissions `READ_*` déclarées dans `app.json`)
- **Activités** : rangées dans `sport_activities` (colonnes `source` = `health_connect`, `external_id`,
  `calories`, ajoutées par `ALTER TABLE` ; **index unique** sur `external_id` : on ne les importe jamais deux
  fois, resynchroniser est sans risque). Elles **comptent dans la série de semaines, l'histogramme et les
  statistiques** comme une activité saisie à la main, avec la pastille « Importé », et ne se modifient ni ne se
  suppriment une par une (elles reviendraient à la synchronisation suivante) ; « Supprimer les données
  importées » les efface toutes. Durée minimale 5 minutes. Nom : celui de la catégorie (Course à pied, Vélo,
  Natation, Musculation…), sinon le titre donné par la montre, sinon « Autre activité ». **Dédoublonnage** : une
  séance de **musculation** importée un jour où une séance du programme a déjà été terminée dans l'app est
  ignorée (c'est la même séance vue par la montre)
- **Pas et calories** : table `health_daily` ([health-db.ts](mobile/src/lib/health-db.ts), exclue de la
  réinitialisation, hors sauvegarde car reconstruite à la synchronisation), 14 derniers jours, calculés jour
  par jour sur la journée locale (`aggregateRecord`). Affichés sur **Aujourd'hui** (deux petites tuiles « pas »
  et « kcal actives ») seulement si Health Connect est connecté
- **Synchronisation** ([health-sync.ts](mobile/src/lib/health-sync.ts)) : à la connexion, sur le bouton
  « Synchroniser maintenant », et automatiquement quand Aujourd'hui reprend le focus ou que l'app revient au
  premier plan (au plus toutes les 20 minutes). Relit 30 jours d'activités (Health Connect ne donne que les 30
  jours précédant l'autorisation). Une erreur de lecture n'interrompt jamais l'app (synchro automatique
  silencieuse). **La logique ne dépend que de l'interface `HealthSource`** ([health-connect.ts](mobile/src/lib/health-connect.ts)),
  remplacée par un faux dans les tests (16 tests : dédoublonnage, calories, jours, throttle, sauvegarde, migration)
- **Module natif** : `react-native-health-connect` 4.x (plugin Expo inclus ; l'ancien `expo-health-connect` est
  obsolète) + `expo-build-properties` (`minSdkVersion` 26, exigé par Health Connect). Chargé par un `require`
  protégé : sans lui (Expo Go, ancien APK, iOS) l'écran affiche « cette version ne contient pas Health Connect »
  et rien ne plante. Le plugin ajoute à `AndroidManifest` le filtre « politique de confidentialité » et
  l'alias d'activité qu'exige Android 14. **Version de l'app passée à 1.1.0** (`runtimeVersion` = version) : un
  nouveau BUILD est nécessaire, les mises à jour à distance de ce code ne vont qu'aux builds 1.1.0
- **Non testé sur téléphone** (rien ne peut l'être sans le build) : demande d'autorisation, lecture réelle,
  écran de réglages de Health Connect. Les formats de dates et les noms de champs ont été vérifiés dans le code et
  les types de la bibliothèque. **iOS** : Apple Santé n'est pas géré (compte développeur payant requis)

## Édition à la main du programme sport
Réglages › Sport › « Modifier le programme » (ou « Créer un programme à la main » sans programme) ouvre
[sport-editor.tsx](mobile/src/app/sport-editor.tsx), un écran modal. **Sport seulement pour l'instant** : le plan
nutrition, lui, doit rester arithmétiquement cohérent (macros = aliments × table `foods`, courses, portions de
batch), donc l'éditer à la main demande un chantier à part.
- on choisit le mode à la création (fixe : 7 jours de repos à remplir ; continu : liste de séances à ordonner), le mode
  ne se change pas ensuite. Séances repliables, exercices (nom, séries, répétitions, repos) à ajouter / monter /
  descendre / supprimer, séances du flux continu aussi
- logique pure dans [sport-draft.ts](mobile/src/lib/sport-draft.ts) : le brouillon garde les nombres en TEXTE,
  `draftToPlan` les valide avec des messages précis (« Séance 2, exercice 1 : … ») puis repasse par `parseSportPlan`
  (mêmes règles qu'un import). Enregistrer écrit aussi le texte d'origine (`plan_sources`, donc la sauvegarde suit)
  et reprogramme les rappels
- `saveEditedSportPlan` ([sport-db.ts](mobile/src/lib/sport-db.ts)) : contrairement à un import, **garde la position du
  flux continu** (ramenée dans la nouvelle liste) et aligne l'heure de rappel des Réglages sur celle de l'éditeur ;
  l'historique des charges, indexé par nom d'exercice, n'est jamais touché (renommer un exercice le sépare de son
  historique : l'écran le dit). Changer le nom efface `exerciseId` (le nom est reconnu de nouveau)
- testé : `tests/sport-editor.test.ts` (5 tests : aller-retour, fixe, erreurs de saisie, position conservée, heure)

## Accueil de première utilisation
Écran plein écran [onboarding.tsx](mobile/src/app/onboarding.tsx), ouvert par `_layout.tsx` au lancement quand
`shouldShowOnboarding()` ([onboarding.ts](mobile/src/lib/onboarding.ts)) est vrai : accueil pas encore terminé (clé
`onboarding_done` dans `app_settings`) ET aucun plan nutrition ni programme sport en base (quelqu'un qui a déjà des
données ne le voit jamais). Contenu : choix de la langue, puis trois cartes — **Nutrition** (questionnaire → prompt à
coller dans une IA, ou import d'un plan existant), **Sport** (questionnaire, import, ou création à la main) et
**Poubelles** (jours de ramassage) — qui ouvrent les écrans existants (aucune logique dupliquée). Au retour, une carte
affiche « Prêt » si ce qu'elle propose est en place. Le bouton du bas est « Passer pour l'instant » tant que rien n'est
fait, « Commencer » ensuite ; les deux marquent l'accueil comme terminé. Changer de langue remonte la navigation, ce qui
rouvre l'accueil tant qu'il n'est pas terminé. Le plan nutrition reste non éditable à la main (choix de l'utilisateur).
Testé : `tests/onboarding.test.ts`. Pas d'accueil à rejouer depuis les Réglages pour l'instant.

## Sommeil (anneau sur Aujourd'hui) et préparation iOS
**Anneau de sommeil** : en haut à droite de l'onglet Aujourd'hui (Android), il remplace l'haltère. Anneau bleu → mauve
([sleep-ring.tsx](mobile/src/components/sleep-ring.tsx), SVG à dégradé, repli en vues), score au centre ; un appui ouvre
[sleep-modal.tsx](mobile/src/components/sleep-modal.tsx) (durée, profond, paradoxal, léger, éveillé, au lit ; sans nuit :
explication et lien vers Réglages › Santé). **Health Connect ne fournit pas de « score de sommeil »** (celui de Google /
Fitbit / Garmin reste dans leur appli) : Hojo calcule le sien et le dit à l'écran. Logique pure et testée dans
[sleep.ts](mobile/src/lib/sleep.ts) : nuits regroupées par **jour de réveil** (morceaux additionnés, enregistrements de
moins de 90 min ignorés), score 0-100 = durée (50 pts, plein à 7 h 30 de sommeil effectif, légèrement réduit au-delà de
10 h) + phases (30 pts : profond idéal 13-23 %, paradoxal 20-25 %) + continuité (20 pts : sommeil ÷ temps au lit, plein
à 90 %) ; phases et continuité comptent à proportion de la durée (une nuit de 4 h ne peut pas être « bonne ») ; sans
phases (montre qui ne les détaille pas) score = durée seule, plafonné à 90. Table `health_sleep`
([health-db.ts](mobile/src/lib/health-db.ts), 14 jours relus à chaque synchronisation, effacée avec « Supprimer les
données importées », hors sauvegarde). **Permission `READ_SLEEP` à part** : refuser ou ne pas l'avoir (connecté avant
cette version) ne bloque rien (erreur de lecture avalée) ; Réglages › Santé propose « Autoriser la lecture du sommeil ».
Changement NATIF (manifeste) : **version 1.2.0**, nouveau build requis.
**iOS (préparé, jamais construit ni testé : pas de compte Apple Developer payant ni de Mac)** :
- `app.json` : bloc `ios` (`bundleIdentifier` = identifiant Android, `supportsTablet` false,
  `ITSAppUsesNonExemptEncryption` false) ; l'export iOS (`npx expo export --platform ios`) compile
- `eas.json` : profil `development-simulator` (simulateur iOS) ; l'APK `preview` reste Android. Un build iPhone réel
  exige un compte Apple Developer (99 $/an) : `eas.cmd build --platform ios --profile preview`
- code déjà compatible : notifications (canaux Android seulement, déclencheur hebdomadaire et daté OK, plafond des 64
  géré), sauvegarde (`Directory.pickDirectoryAsync` existe côté iOS), import de fichier, haptique, écran allumé, icône
  sans transparence. **Non géré sur iPhone** : Health Connect (écran Santé : « n'existe que sur Android »,
  `HealthStatus` `unsupported_platform`), donc pas de pas, de calories ni de sommeil ; l'haltère reste en haut à droite
  d'Aujourd'hui. Apple Santé (HealthKit) se brancherait en implémentant `HealthSource` ([health-connect.ts](mobile/src/lib/health-connect.ts))
  avec un module natif iOS + l'entitlement HealthKit, sans toucher au reste
- **Rien de tout cela n'a été vu sur un iPhone** : mise en page (encoche, barre d'accueil), barre d'onglets flottante,
  rappels, sélecteur de dossier restent à vérifier au premier vrai build iOS

## Version web (test de faisabilité pour les iPhone, non terminée)
Idée : une PWA à ouvrir dans Safari (« Ajouter à l'écran d'accueil ») pour l'entourage sur iPhone, sans App Store ni
compte Apple payant. **Résultat du test : l'app démarre dans un navigateur et sa base SQLite persiste après rechargement**
(onboarding puis « Aujourd'hui » affichés, choix mémorisé), mais seulement avec les correctifs ci-dessous, **jamais essayée sur
Safari / iPhone** (testée dans le navigateur intégré de Claude, Chromium).
- `npx expo export --platform web` : `app.json` `web.output` = `single` (le rendu statique exécute l'app dans Node, où
  `Appearance.setColorScheme` n'existe pas) ; [metro.config.js](mobile/metro.config.js) ajoute l'extension `wasm`
- **expo-sqlite sur le web est fragile** (API synchrone via un worker, `SharedArrayBuffer`). Trois correctifs :
  1. [index.web.js](mobile/index.web.js) (point d'entrée web, `package.json` `main` = `index` : `index.js` pour le natif,
     `index.web.js` pour le web) ouvre d'abord la base en asynchrone pour que le worker soit démarré, puis charge l'app
  2. le même fichier retire `Atomics.pause` : avec lui, l'attente synchrone abandonne après un million de tours (Chrome récent),
     trop peu pour créer les tables ; Safari ne l'a pas (boucle d'un milliard de tours)
  3. **bug de la bibliothèque** : la longueur du résultat était écrite sur UN octet, donc tout résultat de plus de 255 octets
     était tronqué (JSON illisible). Corrigé par [patches/expo-sqlite+57.0.4.patch](mobile/patches/expo-sqlite+57.0.4.patch)
     (`patch-package`, script `postinstall`) ; **à revérifier à chaque mise à jour d'expo-sqlite** (le correctif doit encore
     s'appliquer, ou le bug être corrigé en amont)
- l'hébergement doit envoyer `Cross-Origin-Opener-Policy: same-origin` et `Cross-Origin-Embedder-Policy: require-corp`
  (`SharedArrayBuffer` en dépend) : Netlify ou Cloudflare Pages (fichier `_headers`), pas GitHub Pages. Serveur local de test :
  script `serve.mjs` du bloc-notes de session (à refaire si besoin)
- **Netlify** (choix de l'utilisateur) : `npm run build:web` (= `expo export --platform web --output-dir dist` puis
  [finish-web.mjs](mobile/scripts/finish-web.mjs), qui ajoute à `dist/index.html` le manifeste, l'icône Apple, la barre d'état
  et `viewport-fit=cover`). `public/` est copié dans `dist/` : `_headers` (COOP / COEP), `_redirects` (repli SPA),
  `manifest.webmanifest`, icônes 192 / 512 / 180 px (tirées de l'icône sombre). [netlify.toml](mobile/netlify.toml) : commande de
  build, dossier `dist`, Node 22. Deux façons de publier : glisser-déposer le dossier `dist` sur Netlify (les en-têtes viennent
  de `dist/_headers`), ou relier le dépôt (netlify.toml fait le reste). La barre d'onglets web est maintenant la même barre
  flottante que sur mobile (`app-tabs.web.tsx` supprimé) ; l'haltère reste en haut à droite d'Aujourd'hui (pas de sommeil)
- **Reste à faire pour une vraie version web** : vérification sur un vrai iPhone (OPFS, `SharedArrayBuffer`, performances), rappels
  (une page web ne peut pas programmer de notification locale : piste = export d'un fichier calendrier `.ics` avec alertes,
  non fait), pas de vibrations ni de Health Connect sur le web
- le natif n'est pas touché (export Android, 140 tests et lint repassés après ces changements)

## Dépôt Git et publication
Dépôt Git **à la racine** (`App Nutrisport/`, branche `main`, `.gitignore` : `backup-sdk54/`, et celui de `mobile/` pour `node_modules`, `dist`, `.expo`). Le dossier `mobile/` avait un dépôt vide (aucun commit) hérité de la création du projet : supprimé, remplacé par celui-ci. Premier commit local ; **pas encore envoyé sur GitHub** (nécessite le compte de l'utilisateur). [netlify.toml](netlify.toml) est à la racine (`base = "mobile"`).
**Deux circuits de publication, indépendants et jamais automatiques côté Android** : (1) Android : `eas.cmd update --channel preview --platform android --message "…"` pour du JavaScript seul, `eas.cmd build` pour un changement natif (nom, icône, permission, module) ; (2) web : Netlify relié au dépôt GitHub reconstruit le site à chaque envoi (`git push`) ; sans dépôt relié, `npm.cmd run build:web` puis glisser `mobile/dist` sur Netlify. Les deux se font à chaque changement de code visible par les deux ; les fonctions propres à Android (Health Connect, sommeil, rappels) n'existent pas sur le web. Une mise à jour ne touche jamais aux données des personnes.

## Supersets, tempo, RIR, alternative et séances facultatives (programme « Hybrid Athlete »)
Ajoutés pour le programme `Documents/Programme Hybrid Athlete – 12 cycles.docx` (converti en
`Documents/programme-hybrid-athlete.json`, copie de référence dans [tests/data/](mobile/tests/data)) et tout programme du même style.
- **Format** ([sport-schema.ts](mobile/src/lib/sport-schema.ts)), champs facultatifs d'un exercice : `superset` (même valeur sur des
  exercices CONSÉCUTIFS ; non consécutifs = refus à l'import), `tempo`, `rir`, `alternative`. D'une séance (mode continu seulement) :
  `optional: true` = séance facultative, HORS de l'enchaînement (refus : en mode fixe, sur un repos, ou si toutes le sont). Colonnes
  `superset_group`, `tempo`, `rir`, `alternative` (`sport_exercises`) et `is_optional` (`sport_sessions`) ajoutées par `ALTER TABLE`
- **Séance en direct** : déroulé dans [session-flow.ts](mobile/src/lib/session-flow.ts) (pur, testé) — superset = séries alternées
  (5a s1, 5b s1, repos, 5a s2…), pas de repos à l'intérieur d'un tour, repos du groupe (le plus long indiqué) en fin de tour ; un
  exercice du groupe qui a moins de séries est sauté. L'écran affiche « Superset 5 · exercice 1/2 », le tempo, le RIR et
  l'alternative ; « reps » n'est ajouté qu'aux répétitions purement numériques (« 8 min », « 10 par côté » restent tels quels)
- **Facultatives** : enchaînement = séances non facultatives seulement (curseur modulo leur nombre ; l'éditeur ramène la position dans
  cette liste). Onglet Sport : carte « Séances facultatives » avec « Démarrer › » (`/live-session?position=N`) ; finir une facultative
  l'enregistre comme faite ce jour-là (`completeOptionalSession`, `INSERT OR IGNORE` : ne remplace pas une séance de l'enchaînement
  du même jour) SANS faire avancer l'enchaînement
- **Éditeur** : « Options : superset, tempo, RIR, alternative » repliable par exercice, « Séance facultative » par séance (continu)
- **Prompts** : décrivent ces champs (exemple de superset dans le mode continu)
- `isAuxiliaryExercise` reconnaît aussi « Mobilité » / « mobility » / « Respiration » / « breathing » (pas de charge à saisir)
- répertoire : `tibialis_raise` (rattaché aux « mollets » faute de zone devant le tibia), alias « marche de valise / suitcase carry »
  (`farmers_walk`), « squat cosaque » (`lateral_lunge`), « pronation supination » (`wrist_curl`)
- avertissement « aucune séance de repos » du mode continu reformulé (un enchaînement sans repos est normal : il attend que tu sois prêt)
- **non converti** dans le JSON (pas de champ pour) : la progression sur 12 cycles (phases, décharges), les tableaux de règles et de
  douleur — résumés dans les notes des échauffements ; le cardio (zone 2, fractionné) reste à saisir comme « autre activité »
- testé : `tests/supersets.test.ts` (8 tests) + vérifié dans le navigateur (import du programme, carte des facultatives, alternance
  5a → 5b → repos 1:00 → 5a série 2, séance facultative lancée par sa position)

## Interactions et retour tactile (Étape E)
Passe « moins plat », **JS seulement** (`expo-haptics` et Reanimated sont déjà dans le build 1.1.0 : une mise à jour OTA suffit).
- [haptics.ts](mobile/src/lib/haptics.ts) : `hapticSelection / Light / Success / Warning`, `expo-haptics` chargé par `require`
  protégé (sans le module, rien ne plante). Réglable dans Réglages › Apparence › « Retour tactile » (clé `haptics_enabled`,
  défaut activé, mémorisé en cache ; `reloadHapticsPreference()` après une restauration de sauvegarde)
- [pressable-feedback.tsx](mobile/src/components/pressable-feedback.tsx) : `PressableFeedback` remplace `Pressable` pour boutons,
  tuiles, cartes et puces (légère réduction à l'appui, rebond au relâchement, `haptic` en option). **Pas** pour les fonds de
  fenêtres (nutrition, calendrier, muscles), la barre d'onglets et les points du graphique. Respecte « réduire les animations »
- [reveal.tsx](mobile/src/components/reveal.tsx) : apparition en cascade des repas (`revealDelay` plafonné à 8 rangs)
- [animated-checkbox.tsx](mobile/src/components/animated-checkbox.tsx) : coche de repas qui apparaît en fondu (sobre, sans rebond, choix de l'utilisateur) + choc léger
- barre d'onglets : rebond de l'illustration + clic de sélection au changement d'onglet ; graphique : clic en touchant un point ;
  séance en direct : vibration de réussite à la validation d'une série ; Aujourd'hui : tirer pour actualiser (synchro Health Connect)
- testé : `revealDelay`, réglage haptique (125 tests)

## Tests automatiques
Dossier [mobile/tests/](mobile/tests), **149 tests** (`npm test` dans `mobile/`, moins d'une seconde ;
`npm run test:types` vérifie le typage des tests). **Aucune dépendance de test** : Node 24 exécute le
TypeScript directement (`node --test`), un chargeur ([loader.mjs](mobile/tests/loader.mjs)) résout
l'alias `@/…` et remplace les modules natifs par des bouchons ([stubs/](mobile/tests/stubs)) :
- `expo-sqlite` → **un vrai SQLite en mémoire** (`node:sqlite`, même API synchrone) : les tests
  exercent les vraies requêtes de `nutrition-db`, `sport-db`, `waste-db`, `backup`, pas des doubles ;
  `freshDatabase()` ([helpers.ts](mobile/tests/helpers.ts)) repart d'une base vide avec tous les schémas
- `react-native`, `expo-constants` → bouchons minimaux ; `expo-notifications` → faux module
  enregistreur injecté via `globalThis.require` (le module le charge avec `require`)
- contenu : dates / calendrier / créneaux de repas ; plan nutrition (schéma, **chaque invariant
  violé à tour de rôle**, 25 mélanges de l'ordre des jours, garde-fou calorique) ; base nutrition
  (import, réimport, cases cochées, heures, cycle, courses, articles perso dont saisie type injection
  SQL) ; notifications (7 jours, plafond de 60, sport avant repas, poubelles groupées) ; sport (modes
  fixe et continu, reprise, séries de semaines, graphiques, historique, activités) ; poubelles
  (alternance sur 2 ans) ; sauvegarde (aller-retour après effacement total, restauration répétée,
  échec en cours de route sans écriture partielle)
- vérifiés dans 5 fuseaux (`TZ=Europe/Paris`, `America/Los_Angeles`, `Pacific/Auckland`, `UTC`, local)
- le **plan de référence** ([fixtures.ts](mobile/tests/fixtures.ts)) est volontairement au-dessus du
  seuil de 1200 kcal : une première version à 1159 kcal a été refusée par le garde-fou (le test a
  prouvé qu'il fonctionne). **À chaque modification d'un module de `src/lib`, lancer `npm test`**
- `tsconfig.json` exclut `tests/` (qui a son propre `tests/tsconfig.json`, types Node)

## Statut

Étape 0 terminée. Étape 1 avancée : modèle de plan structuré (foods/recettes/courses,
cycle 7/14 jours), module d'invariants testé (30 assertions dont permutations), import,
écran "Aujourd'hui" avec macros, questionnaire de génération de prompt, garde-fous de
sécurité, rappels sur fenêtre glissante — tous testés sur téléphone réel. Rappels restent à
confirmer en conditions réelles prolongées (déclenchement à l'heure prévue, app fermée,
plusieurs jours). Système de design retravaillé (palette, typographie, boutons) sur tous
les écrans, à valider visuellement sur téléphone réel.

Trois bugs corrigés depuis (testés, 33 assertions) : chrono de repos qui se figeait en
arrière-plan, dépassement silencieux de la limite iOS des 64 notifications, absence de suivi
des séances faites en mode fixe. `SCHEMA_VERSION` passe à 7 → la base locale est recréée à
vide au prochain lancement (plans à réimporter ; l'historique des charges et des séances,
lui, est préservé).
