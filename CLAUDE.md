# BauGest — résumé technique

État au 09.10.2026 · dernier commit `091997b` (PV chantier : bouton Notes) · 22 commits depuis le 04.10.2026.

## 1. En bref

- App de gestion de chantier (photos, documents manuscrits, plans PDF + métrés, PV de la DT, devis particuliers).
- Fusion de PhotoChantier (photos) et PlansChantier (plans PDF) — oct. 2026.
- PWA statique, sans serveur ni build : tout est dans 2 fichiers HTML avec JS/CSS inline.
- Stockage : Google Drive de Joel (OAuth côté navigateur) + cache local IndexedDB.
- Dépôt : `github.com/Bau-Gest/baugest` (public), branche `main`, publié par GitHub Pages.
- URL : `https://bau-gest.github.io/baugest/` (téléphone/tablette) · `…/baugest/pc.html` (PC).

## 2. Fichiers du dépôt

| Fichier | Taille | Rôle |
|---|---|---|
| `index.html` | ~718 Ko · 8 200 lignes · ~530 fonctions | App téléphone + tablette (un seul fichier) |
| `pc.html` | ~306 Ko · 4 300 lignes · ~280 fonctions | Webapp PC (complément, la tablette reste la référence) |
| `planning.js` | ~1 650 lignes | Module Planning partagé (tablette + PC) : Gantt, chemin critique, ressources, lissage, budget / valeur acquise, exports PDF A3 / Excel / MS Project XML. Chargé par `<script src>` dans les deux HTML |
| `aide-planning.html` + `aide/*.png` + `aide-planning.pdf` | — | Manuel du Planning (méthode + mode d'emploi), ouvert par le bouton ? du Planning ; PDF A4 généré depuis le HTML (Playwright `page.pdf`). Captures `aide/` faites avec le vrai module et 2 plannings d'exemple : à refaire si l'interface change |
| `sw.js` | 43 lignes | Service worker : cache `baugest-vNN`, share-target, clic sur notification |
| `manifest.webmanifest` | — | PWA téléphone/tablette, `share_target` (photos + PDF) |
| `pc.webmanifest` | — | PWA PC (`start_url ./pc.html`) |
| `icon*.png`, `icon.svg`, `apple-touch-icon.png` | — | Icône grue |
| `tools/transcription/prepare.py` | — | Rendu des traits JSON → PNG, découpe en segments, extraction des cases signature |
| `tools/transcription/make_pdf.py` | — | PDF « texte tapé » avec la mise en page BauGest (reportlab) |
| `tools/transcription/README.md` | — | Mode d'emploi du pipeline |
| `tools/recap/make_recap.py` | — | PDF « Récap PV DT » avant séance (reportlab), utilisé par la tâche Récap PV |
| `tools/soumission/soumission.py` | — | Soumission `.crbx` (SIA 451) ou Word BauBit → « <nom> – positions.json » ; utilisé par la tâche Soumission |

Copies dans le projet Claude « Bau-Gest » : `claude/baugest/*` (peuvent être en retard sur GitHub → GitHub fait foi). `claude/transcription/make_docx.js` et `render_baugest_doc.py` = anciennes versions (sortie .docx abandonnée). `claude/pwa/*` et `claude/planschantier_v1.html` = anciens PlansChantier.

## 3. Architecture

### Plateformes
- **Téléphone** : `isTabletScreen()` = petit côté d'écran < 600 px. Démarre toujours sur la caméra. Pas de plans (un PDF partagé est rangé dans Plans ou PV du chantier).
- **Tablette** (Lenovo Idea Tab Pro Gen 2, stylet) : bureau avec barre de rubriques à gauche (Photos, Plans, Documents, PV DT, Soumission, Planning, Devis). Écran de démarrage réglable (`S.home`). Écran toujours allumé tant que BauGest est au premier plan (Wake Lock `keepAwake`, 16.10.2026) ; s'éteint seulement par le bouton ou la coque, verrou repris au retour dans l'app ou au 1er toucher.
- **PC** (`pc.html`) : onglet Planning (même module que la tablette), infos du chantier et séances (`editSiteDlg` : onglet PV DT › bouton agenda, ou clic droit sur un dossier chantier ; réécrit le chantier dans le fichier de réglages avec `smod` = maintenant et renomme le dossier Drive si N°/nom changent), explorateur Drive, double vue optionnelle, annotation, impression, glisser-déposer Windows ↔ BauGest, filtres photos, devis, métrés, comparaison d'indices, recherche globale, rapport photo PDF, dépôt PV DT.

### Bibliothèques (CDN, mises en cache par `sw.js`)
- pdf.js 3.11.174 (cdnjs + cmaps/standard_fonts jsdelivr)
- pdf-lib 1.17.1
- Leaflet 1.9.4
- SheetJS xlsx 0.18.5 (index.html seulement, export Excel)
- Les PDF de documents manuscrits sont générés sans bibliothèque (fonctionne hors ligne).

### Services externes
- Google Drive API v3 (`drive` scope complet) + GIS OAuth.
- Google Calendar API v3 (scope `calendar.events`, ajouté le 10.10.2026) : la date de visite d'une fiche devis crée / déplace / supprime un événement dans l'agenda principal du compte connecté (`joel.magano.job@gmail.com`). Titre « Visite devis – Client – Localité », lieu = adresse, description = tél. client + entreprise, 1 h, rappel 1 h avant, couleur jaune (colorId 5). Id d'événement fixe `bgdv<hex de l'id fiche>` → pas de doublon entre appareils. Bloc `calSyncAll` dans les deux fichiers. **Séances de chantier** (tablette + PC, 11.10.2026) : un événement récurrent par chantier (`calSiteBody`, clé `se:<id chantier>` dans `baugest.cal`), titre « Séance de chantier – N° Nom », RRULE hebdo (intervalle 1–4), couleur bleue (colorId 9), rappel 1 h avant ; supprimé si la date de 1re séance est vidée ou le chantier supprimé. Les visites passées de plus de 24 h ne sont pas créées rétroactivement. Client ID intégré `691997779377-8p5c7u6o…` (`BUILTIN_CLIENT_ID`, même client tablette et PC). Origine/redirection autorisées : `https://bau-gest.github.io` / `…/baugest/`.
- swisstopo : WMTS `wmts.geo.admin.ch` (SWISSIMAGE), WMS `wms.geo.admin.ch` (parcelles), `api3.geo.admin.ch` (recherche ; suggestions d'adresses pendant la saisie dans les devis, fonction `addrSuggest`, dans les deux fichiers).
- OpenStreetMap (tuiles + Nominatim) pour la carte des photos.

### Stockage local (noms hérités de PhotoChantier — NE PAS RENOMMER)
- `localStorage['photochantier.v1']` : état/réglages principal (`S`).
- IndexedDB : `baugest-planning` (plannings, cache + modifs hors ligne), `photochantier` (file d'envoi photos), `photochantier-inbox` (fichiers reçus par partage, écrit par `sw.js`), `photochantier-docs` v2 (documents manuscrits), `baugest-plans` (cache des PDF de plans), `baugest-pvdt` (cache PV), `baugest-soum` (tableau de la soumission par chantier).
- Clés `baugest.*` : `plPaths`, `plView`, `pltree.<site>`, `pvPanel`, `pvann.<id>`, `pvdt.seen`, `pvdt.last`, `pvpts.<id>`, `calcPos`, `activeDevis`, `dmLayer`, `dmCad`, `pc.pqSite`, `cal` (événements agenda déjà envoyés par cet appareil : `{idFiche: contenu}`), `plan.<site>` (dernier planning ouvert), `planSplit` (double vue PC : `{on, w}`), `planVac` (vacances reprises dans les nouveaux plannings).

### Organisation du Google Drive
```
<Racine BauGest>/                         (ancien dossier PhotoChantier renommé)
├── Réglages PhotoChantier (ne pas supprimer).json   ← chantiers, mises en page, entreprises ; partagé tablette/PC
├── BauGest – journal des plans (ne pas supprimer).json  ← tâche « Plans BauGest »
├── <N° Nom du chantier>/
│   ├── Photos/                 (un seul dossier ; nom AAAA-MM-JJ_HHhMM_<chantier>_<étiquettes>.jpg)
│   ├── Documents/
│   │   ├── PV de séance/ · Rapports journaliers/ · Bons de régie/ · Constats/ · Notes/
│   │   │     (AAAA-MM-JJ_<Type>_<chantier>_<xxxx>.json + .pdf transcrit du même nom)
│   ├── Plans/
│   │   ├── <sous-dossiers libres créés par Joel>
│   │   ├── Mesures/            (« <plan> – mesures.json », un fichier par plan)
│   │   ├── Exports/            (PDF annotés, PNG, CSV, Excel ; aussi annotations PC)
│   │   └── Plans annulés/
│   ├── Planning/               (« <nom>.json » kind='planning' + copie MS Project « <nom>.xml » kind='planningxml' réécrite à chaque enregistrement ; créé au 1er enregistrement)
│   │   └── Exports/            (PDF A3, Excel, XML MS Project)
│   ├── Soumission/           (soumission rentrée .crbx / Word / PDF + « <nom> – positions.json » de la tâche Soumission)
│   │   └── Anciennes versions/
│   └── PV de chantier/         (PV DT + « <nom du PV> – récap[ AAAA-MM-JJ].pdf » à côté de chaque PV, tâche Récap PV)
│       ├── PV annulés/
│       └── Annotations/        (« <PV> - annotations BauGest.json » : traits + points cochés `done` {id: texte du point})
├── À classer/                  (photos sans chantier)
└── Devis particuliers/<fiche>/Photos/ (+ mémos PDF)
```
Dossiers créés automatiquement à la création d'un chantier (`siteFolderPaths`, `ensureSiteFolders`) ; pas de sous-dossiers de plans imposés. Nom du dossier chantier : `siteFolder()` = « N° Nom ».

## 3b. Formats de données

**Identification des fichiers BauGest** : chaque fichier écrit porte des `appProperties` Drive (les tâches et la galerie filtrent dessus) :
- commun : `pc:'1'`, `site:<siteId|none>`
- photo : `taken`, `tags` (séparés par `|`, 60 car. max), `lat`, `lon`, `imp:'1'` si importée ; texte lisible dans `description`
- `kind` : `plan` (+ `uid`), `planning` (+ `uid`), `planningxml` (+ `uid`, copie MS Project du planning), `export`, `soum` (soumission importée par la tablette), `mesures` (+ `plan`, `n`), `pvdt` (+ `pvn`, `pvdate`), `doc` (+ `dtype`, `title`), `settings`
- ⚠ Une **copie** Drive perd les `appProperties` → toujours déplacer/renommer.

**Réglages synchronisés** (`Réglages PhotoChantier (ne pas supprimer).json`, `appProperties.kind='settings'`) : champs `SYNC_FIELDS` = companies, tags, logoLib, docLay, docTitles, stamp, logoOn, logoPos, logoSize, logoBg, stampLines, quality, tagPrompt, tagDelay, structure, pvKeys + chantiers `S.sites` + devis `S.devis`/`S.ddel`. Fusion par horodatage par champ/chantier (`S.fmod`, `S.smod`, `S.sdel`, `S.remap`). Valeurs par défaut : objet `DEF` (index.html ~l.1870).

**Chantier** : `{id, number, name, lat, lon, radius (m, défaut 300), meet?, comp?, abbr?, …mise en page propre}` ; détection GPS = position dans le rayon.
`meet` = séances `{from:'AAAA-MM-JJ' (1re séance → jour de semaine), time:'HH:MM', every:1–4 semaines, dur:min, place?}` ; `comp` = id de notre entreprise (`S.companies`) ; `abbr` = abréviations DT séparées par virgules (aussi ajoutées à `pdKeys`).

**Document manuscrit** (`DOCS`, `DOC_ORDER = pv, journal, regie, constat, libre`) : page logique 1000 × 1414 unités (`PW`, `PH`), traits stylet en JSON. Cases signature : journal, regie, constat (`sign:true`).
**Éditeur manuscrit (13.10.2026)** : outil par défaut à chaque ouverture = stylo fin noir (`ED_SIZE` 1.7). Zoom 2 doigts interne aux pages (`ed.zoom` 1–3, barres non zoomées ; zoom navigateur bloqué par `touch-action`). Défilement au doigt manuel avec élan (`bindEdGestures`). Tablette (`ed.drawer`, classe `de-drawer`) : le doigt n'écrit jamais ; outils cachés, sortis en glissant le doigt depuis le bord gauche (ou geste « retour » Android, qui sort/rentre les outils au lieu de fermer l'éditeur → fermer avec ✕) ; refermés au contact du stylet ou d'un tap ; double tape au doigt = stylo ⇄ gomme. Téléphone : le doigt écrit toujours (pas de stylet).
**Visionneuse PV DT (13.10.2026)** : même présentation que l'éditeur (barre `de-top`, ligne d'état, tiroir d'outils `de-tools` à gauche : Marqueur, Stylo + 4 couleurs, Gomme, Annuler, Zoom −/+). Mêmes règles : seul le stylet écrit, outils sortis du bord gauche (ou « retour » Android), double tape = outil ⇄ gomme, défilement avec élan. Outil par défaut = marqueur jaune (`hl`), plus de mode « Lire ». Un PV s'ouvre en haut de la 1re page.

**Calculette flottante (15.10.2026, tablette seulement)** : bouton 🧮 dans la barre du haut + dans le tiroir d'outils de l'éditeur de documents, de la visionneuse PV DT et de la barre d'outils des plans (`[data-calc]`, cachés sur téléphone via `html.calc-ok`). Fenêtre `#calc` (z-index 60) déplaçable par sa barre de titre, position gardée dans `baugest.calcPos`. Touches + − × ÷ % ( ), C, ⌫, = et « Copier » (presse-papiers, sans séparateur). « a + b % » = a + a×b/100 ; « a × b % » = a×b/100. Se ferme toute seule quand on quitte l'éditeur / le plan / le PV. Bloc « Calculette flottante » (`calcEval`, `bindCalc`) ; absente de `pc.html`.

**Planning (17.10.2026, `planning.js`)** : `{v:1, uid, siteId, name, start, indice, hol:{canton, keys[], extra[{d,label}]}, vac[{from,to,label}], opts:{sat, hpd, structure:'flat'|'lots'|'tree', budget:'res'|'man'|'mix'}, res[{id,name,type:'team'|'machine'|'sub'|'supply',unit,rate,cap,color}], tasks[{id,name,parent,lot?,ms?,dur (j ouvrés),deps[{id,type:FS|SS|FF|SF,lag}],snet?,lvl (décalage du lissage),asg[{r,q}],bud?,pct,aStart?,aEnd?,act[{d,r,q|amt}],note?}], baseline:{at,end,tasks:{id:{start,finish,dur,cost}}}|null}`. Dates internes en n° de jour UTC ; calendrier = lu–ve (+ samedi en option) moins fériés du canton (table `CANTONS`, modifiable par planning) et vacances. Coûts : équipe = pers. × j × `hpd` h × CHF/h ; machine = u. × j × CHF/j ; sous-traitant / fourniture = quantité × PU. Réalisé saisi en h / j / quantités ou montant libre. Valeur acquise à la date d'état (PV/VA/CR, SPI, CPI, coût final). Lissage = ordonnancement en série (critiques d'abord), proposé puis appliqué par l'utilisateur. Le doigt fait défiler, la souris / le stylet déplacent et allongent les barres, tirent un lien depuis le rond au bout de la barre. PC seulement : double vue (planning à gauche, BauGest PC à droite, séparation réglable, gardée dans `baugest.planSplit` ; le clavier va au côté cliqué) et fenêtre séparée `pc.html#planning=<chantier>&plan=<uid>` (2e écran ; le planning se ferme dans la fenêtre principale). PC : ouvrir un fichier `planning`/`planningxml` dans l'explorateur ouvre le module (`openPlanFile`), un autre .xml MS Project propose l'import (`BGPlan.importXml`). Hôte : `BGPlan.init({sites, api, ensureFolder, online, loadScript, company, onToggle, split, onSplit, popout, onClose})` puis `BGPlan.open(idChantier, uidPlanning?)` ; `BGPlan.back()` pour le retour Android. Absent du téléphone.

**Mesures d'un plan** : `{v:1, plan:{key,name}, siteId, scales, confirmed, measures:[…], updatedAt}` ; lié à l'ID Drive du plan (renommer/déplacer garde le lien).

## 3c. Règles métier décidées par Joel (ne pas changer sans lui demander)

- Téléphone : démarre **toujours** sur la caméra ; sélecteur Document · Photo · Devis sous le déclencheur ; mode Document → photo dans un nouveau document, mode Devis → photo dans la fiche devis ouverte.
- Plans PDF : lecture **uniquement sur tablette et PC** ; sur téléphone, un PDF partagé est rangé (choix Plans / PV de chantier).
- Photos jamais dans la galerie du téléphone ; un seul dossier Photos par chantier.
- Documents transcrits : affichés d'abord en texte tapé (PDF), bascule vers le manuscrit ; non transcrits = manuscrit seul. Signatures jamais transcrites.
- Devis : GPS actif mais **ne relie jamais** la fiche à un chantier ; en-tête du mémo = entreprise choisie à la création ; notes tapées ou dictées (pas manuscrites).
- PV DT : récap avant séance stocké à côté du PV (jamais listé comme PV, bouton « Récap séance ») ; nom de fichier d'origine conservé ; PV corrigé → PV annulés ; détection chantier avec confirmation sur PC ; dossier présent dans tous les chantiers.
- Soumission : rubrique tablette seulement (PC = dépôt du fichier dans « Soumission » par l'explorateur, pas de consultation) ; une seule soumission par chantier, l'ancienne → « Anciennes versions » ; `.crbx` lu tout de suite par la tablette, Word / PDF par la tâche du vendredi ; montant = quantité × PU arrondi à 0.05 CHF (comme BauBit).
- Plans : nom « Sujet ind C AAAA-MM-JJ.pdf » ; un seul dossier Plans annulés par chantier ; jamais de suppression de plan.
- Tablette : droitier au stylet → outils à gauche ; thème sombre + bouton fort contraste.
- Bureau Documents (tablette) : seuls les types de documents ayant au moins 1 document dans le chantier sont affichés (pas de ligne vide) ; nouveau type via « Nouveau document ».
- PC = complément : ne jamais modifier le comportement tablette pour le PC.
- Planning : tablette + PC, un ou plusieurs plannings par chantier ; jours ouvrés, fériés du canton choisi (cochables) + vacances du bâtiment réglables ; structure des tâches et source du budget réglables par planning ; surcharge = alerte + proposition de lissage validée par Joel ; ressources propres à chaque chantier ; pas de modèles de planning fournis.
- Communication : français, simple et concis ; questions sous forme de choix cliquables ; proposer des idées concrètes, pas seulement des questions.

### Repères dans `index.html` (marqueurs `/* ---------- … ---------- */`)
Réglages & synchro (~1868–2130) · GPS/caméra/prise de vue (~2164–2515) · Drive + file d'envoi (~2515–2684) · Galerie/carte/visionneuse photo (~3144–3685) · Documents manuscrits + éditeur (~3771–4711) · Ergonomie v2 (~4059) · Plans : explorateur, glisser-déposer stylet, visionneuse, métrés (~5006–6266) · PV DT : lecture, liste, annotation, points à notre charge, notes reliées (~6266–6964) · Soumission : lecture .crbx, tableau filtrable, import (marqueur « Soumission du chantier ») · Devis : fiches, mémo PDF, entreprises, métré 2D/3D, orthophoto, effacement (~6964–8105) · Retour Android (~8105) · Démarrage (~8169).

`pc.html` reprend des blocs de la tablette « tels quels » (rendu des documents, calculs devis, orthophoto, lecture PV) → toute correction dans ces blocs doit être faite **dans les deux fichiers**.

## 4. Automatisations (tâches planifiées Claude, cloud Anthropic)

| Tâche | Horaire (Europe/Zurich) | Rôle |
|---|---|---|
| Transcription BauGest | lu–ve 11:53 et 17:53 | JSON manuscrit → PDF texte tapé à côté du JSON (un item par paragraphe, texte à la largeur de la page, sans ligne vide, aligné à gauche, pages manuscrites enchaînées sur les lignes libres — validé par Joel le 17.10.2026) ; signatures recopiées, jamais transcrites ; notification si ≥ 1 document |
| Plans BauGest | lu–ve 11:17 et 17:17 | Renomme les plans d'après le cartouche (« Sujet ind C AAAA-MM-JJ.pdf »), doublons/anciens indices → Plans annulés ; notification si changement |
| Récap PV BauGest | lu–ve 17:35 | Veille de séance (vendredi pour le lundi) : compare les 2 derniers PV DT du chantier + points cochés, PDF « <PV> – récap.pdf » à côté du PV + notification ; « PV manquant » si aucun nouveau PV |
| Soumission BauGest | vendredi 17:44 | Word / PDF du dossier « Soumission » → « <nom> – positions.json » à côté (tools/soumission), contrôle des totaux par CAN ; notification si ≥ 1 soumission |
| Rappel séance BauGest | tous les jours 06:52 | Jour de séance : notification avec le résumé et les liens directs vers le récap (Drive + BauGest tablette `?pvdt=<id>&site=<id>`) |

Les deux tournent sans l'ordinateur de Joel, mais dépendent des connexions Google Drive/GitHub du compte Claude. Dernier passage réussi : 09.10.2026.
Le prompt complet de chaque tâche est lisible avec `list_triggers` (ids `trig_01XjUE62rMyRVSSEq1JPZk37` transcription, `trig_01CwbzZRPB1U3bZNXRm3VBE8` plans, `trig_01XDouvMa1Gg46UiyyEWy9kU` récap PV, `trig_01VTEvcsYX7xHzW3Ayy1Hd1C` rappel séance, `trig_01SrjGNQAySVobeYiVkVhE2e` soumission — créée sans connecteur Google Drive : à ajouter dans claude.ai › Routines). Si un format de fichier ou un nom de dossier change dans l'app, **mettre à jour le prompt de la tâche concernée** (`update_trigger`). La tâche Transcription clone le dépôt et exécute `tools/transcription/*.py` : ne pas casser leur interface.

## 4b. Déploiement et comptes

- GitHub Pages : Settings → Pages → `main` / root. Publication 1–2 min après le push ; l'app se met à jour à la prochaine ouverture avec réseau (si `sw.js` a changé de version).
- Google Cloud : client OAuth `691997779377-8p5c7u6o…` (compte Google perso de Joel). Origine JS `https://bau-gest.github.io`, redirection `https://bau-gest.github.io/baugest/`. Toute nouvelle URL d'app doit y être ajoutée. **API Google Calendar à activer** dans ce projet (sinon la fiche affiche « Agenda : activer l'API Google Calendar »).
- Installation Android : Chrome → ⋮ → Installer l'application (pas « raccourci », sinon pas de partage vers BauGest).
- Anciennes apps encore en ligne : `joelmagano82-design.github.io/photochantier` et `/planschantier` (remplacées, ne plus modifier).
- Le dépôt est **public** : n'y mettre aucun jeton, mot de passe ni donnée client.

## 5. Méthode de travail (à respecter)

1. `git clone --depth 1 https://github.com/Bau-Gest/baugest` (push : `add_repo` avec `access: push`). Toujours `git pull --rebase` avant de pousser.
2. Modifier par remplacement de chaîne exacte (helper Python `rep(old,new)` qui échoue si l'ancre n'existe pas exactement 1 fois). Pas de réécriture complète des fichiers.
3. Vérifier la syntaxe : extraire les `<script>` (regex) → `node --check`.
4. Tester avec Playwright (viewport téléphone et tablette), Drive simulé, CDN redirigés vers `npm i pdfjs-dist@3.11.174 pdf-lib@1.17.1`.
5. Incrémenter `const C='baugest-vNN'` dans `sw.js` à chaque publication (sinon la tablette garde l'ancienne version).
6. Commit en français, trailers `Co-Authored-By` + `Claude-Session`, push sur `main`.
7. Questions de clarification : toujours en choix cliquables.

## 6. Bugs connus et limites

| # | Problème | Zone | Statut |
|---|---|---|---|
| 1 | Notification « nouveau PV » seulement si l'app est ouverte (pas de push serveur) | PV DT | Limite connue |
| 2 | Détection auto chantier/n°/date d'un PV impossible sur PDF scanné (pas de texte) → saisie manuelle | PV DT (PC) | Limite connue |
| 3 | Visionneuse PV : défilement sans élan | PV DT tablette | Corrigé le 13.10.2026 |
| 4 | `sw.js` ne pré-cache que `index.html` : `pc.html`/`pc.webmanifest` ne sont en cache qu'après une 1re visite en ligne | PWA PC | À corriger si usage hors ligne PC |
| 5 | Texte d'aide de l'URI de redirection affiche encore `tonnom.github.io/photochantier` (aperçu hors ligne) | Réglages Drive | Cosmétique |
| 6 | Outils vus dans la maquette ergonomie mais non implémentés : texte (tablette), comptage de points, zoom caméra | Ergonomie v2 | Non fait volontairement |
| 7 | Photos copiées (au lieu de déplacées) dans le Drive perdent leurs métadonnées (chantier, GPS, étiquettes) | Drive | Règle : toujours déplacer/renommer, jamais copier |
| 8 | Installation PWA en simple raccourci → pas de « Partager → BauGest » | Android | Installer via « Installer l'application » |
| 9 | Noms hérités `photochantier*` et fichier « Réglages PhotoChantier » : les renommer casse la synchro et les tâches planifiées | Global | À garder tel quel |
| 10 | Fichiers uniques de 300–700 Ko : risque de conflits si deux sessions modifient en parallèle | Dépôt | Toujours rebase avant push |
| 12 | Fériés par défaut des cantons (table `CANTONS` de `planning.js`) établis sans source officielle ; certains ne valent que dans une partie des communes | Planning | À vérifier par Joel, cochables par planning |
| 11 | Réglage « Structure des dossiers photos » (A/B/C/D) toujours affiché dans Paramètres mais ignoré : les photos vont toujours dans `<Chantier>/Photos` | Paramètres › Photos | À masquer ou retirer |

## 7. Pistes ouvertes (non commencées, à confirmer avec Joel)

- Pré-cache de `pc.html` dans `sw.js` (bug 4).
- Planning : lien des tâches aux positions de la soumission (`positions.json`) comme source de budget ; jalons du planning dans le récap de séance.
- Outils non faits de la maquette : texte sur plan (tablette), comptage de points, zoom caméra.
- Notifications PV quand l'app est fermée (nécessiterait un serveur push).
- OCR des PV scannés pour la détection automatique.

## 8. Démarrage d'une nouvelle session

1. Lire ce fichier, puis `git log --oneline -15` pour voir ce qui a changé depuis.
2. Repérer la zone à modifier avec les marqueurs `/* ---------- … ---------- */` (grep), ne lire que cette zone.
3. Vérifier si la même fonction existe dans `pc.html`.
4. Poser les questions (choix cliquables), coder, tester, version `sw.js` +1, commit, push.
5. Mettre à jour ce fichier (sections 3, 6, 7) à la fin de chaque évolution.
