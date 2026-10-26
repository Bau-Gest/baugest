# BauGest — résumé technique

État au 26.10.2026 · Planning : périodes de présence des ressources (semaines ou dates fixes, plusieurs par ressource) dans les tâches et les lots ; couleur auto des nouvelles ressources toujours différente ; onglet Analyse (courbe main-d'œuvre / machines / montants, écran + PDF + impression + Excel) ; ressources propres aux lots par périodes (effectif qui varie) ; remarques en bas de page en nombre libre (Mise en page) ; logo de l'entreprise en haut à gauche des impressions (taille réglable), impression d'une partie (dates, lots, zones, sélection), sélection multiple + style des barres, couleur de barre par tâche, impression avec aperçu PDF (PC), formats A4–A0, ajuster à la page.

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
| `pc.html` | ~415 Ko · 5 300 lignes | Webapp PC (complément, la tablette reste la référence) ; depuis le 22.10.2026 avec accueil personnalisable + Courrier (blocs « Courrier » et « Accueil PC personnalisable » en fin de script) |
| `pc-nouveau.html` | — | Ancienne adresse de la préversion : renvoie vers `pc.html` |
| `planning.js` | ~2 210 lignes | Module Planning partagé (tablette + PC) : Gantt, chemin critique, ressources (tâches + ressources propres aux lots par périodes), lissage, budget / valeur acquise, analyse des ressources (onglet Analyse), sélection multiple, couleur et style des barres par tâche, zones, impression (A4–A0, ajuster à la page, partie du planning par dates / lots / zones / sélection, logo en haut à gauche de taille réglable), exports PDF / Excel / MS Project XML. Chargé par `<script src>` dans les deux HTML |
| `aide-planning.html` + `aide/*.png` + `aide-planning.pdf` | — | Manuel du Planning (méthode + mode d'emploi), ouvert par le bouton ? du Planning ; PDF A4 généré depuis le HTML (Playwright `page.pdf`). Captures `aide/` faites avec le vrai module et 2 plannings d'exemple : à refaire si l'interface change (`node tools/aide/captures.js`, variables `PLAYWRIGHT` / `CHROMIUM` si besoin ; 12 captures dont `style.png` et `analyse.png` (26.10.2026) ; argument = dossier de sortie). Manuel : 32 pages, partie « 7. Analyse des ressources », partie « Ressources d'un lot (effectif qui varie) », parties « Sélection multiple et style des barres », « Imprimer », « Imprimer une partie du planning », Mise en page (place et hauteur du logo) |
| `sw.js` | 43 lignes | Service worker : cache `baugest-vNN`, share-target, clic sur notification |
| `manifest.webmanifest` | — | PWA téléphone/tablette, `share_target` (photos + PDF) |
| `pc.webmanifest` | — | PWA PC (`start_url ./pc.html`) |
| `icon*.png`, `icon.svg`, `apple-touch-icon.png` | — | Icône grue |
| `tools/aide/captures.js` | — | Refait les captures `aide/*.png` du manuel du Planning (2 plannings d'exemple recréés — collecteur EU et villa —, vrai `planning.js`, thème clair du PC, horloge simulée 17.10.2026 puis 22.04.2027) ; sert aussi de base aux tests du module (données `gc` / `vi` réutilisables) |
| `tools/transcription/prepare.py` | — | Rendu des traits JSON → PNG, découpe en segments, extraction des cases signature |
| `tools/transcription/make_pdf.py` | — | PDF « texte tapé » avec la mise en page BauGest (reportlab) |
| `tools/transcription/README.md` | — | Mode d'emploi du pipeline |
| `tools/recap/make_recap.py` | — | PDF « Récap PV DT » avant séance (reportlab), utilisé par la tâche Récap PV |
| `tools/soumission/soumission.py` | — | Soumission `.crbx` (SIA 451) ou Word BauBit → « <nom> – positions.json » ; utilisé par la tâche Soumission |

Copies dans le projet Claude « Bau-Gest » : `claude/baugest/*` (peuvent être en retard sur GitHub → GitHub fait foi). `claude/transcription/make_docx.js` et `render_baugest_doc.py` = anciennes versions (sortie .docx abandonnée). `claude/pwa/*` et `claude/planschantier_v1.html` = anciens PlansChantier.

## 3. Architecture

### Plateformes
- **Téléphone** : `isTabletScreen()` = petit côté d'écran < 600 px. Démarre toujours sur la caméra. Pas de plans (un PDF partagé est rangé dans Plans ou PV du chantier).
- **Tablette** (Lenovo Idea Tab Pro Gen 2, stylet) : bureau avec barre de rubriques à gauche (Photos, Plans, Documents, PV DT, Soumission, Planning, Devis, À faire). Écran de démarrage réglable (`S.home`) : par défaut **Accueil** (`'auto'`) ; le logo BauGest en haut de la barre ramène toujours à l'accueil. Écran toujours allumé tant que BauGest est au premier plan (Wake Lock `keepAwake`, 16.10.2026) ; s'éteint seulement par le bouton ou la coque, verrou repris au retour dans l'app ou au 1er toucher.
- **Aiguillage (19.10.2026)** : script en tête de `index.html` → un PC de bureau (Windows, ou Linux/Mac sans écran tactile) est renvoyé vers `pc.html` ; Android/iPhone/iPad et tablette Android en « site pour ordinateur » (Linux + tactile) restent sur `index.html`. `?tablette=1` garde la version tablette sur l'appareil (`localStorage['baugest.forceTab']`), `?tablette=0` annule. Pas d'aiguillage au retour Google (`#access_token`), au partage (`?share`) ni avec `?pvdt`.
- **Code PIN PC (22.10.2026)** : `pc.html` s'ouvre sur un écran « Code PIN » (bloc « Code PIN d'ouverture (PC) » juste après `<body>`), code demandé une fois par onglet (`sessionStorage['baugest.pinOk']`) ; seul le SHA-256 du code est dans le fichier (dépôt public), pour le changer remplacer `PIN_HASH`. Écran sans logo ni nom ; titre de l'onglet « Code PIN » jusqu'au bon code, puis « BauGest PC ». Simple verrou côté navigateur, la vraie protection reste le compte Google.
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
- IndexedDB `baugest-todo` (tâches À faire par chantier).
- Clés `baugest.*` : `todo.notif`, `plPaths`, `plView`, `pltree.<site>`, `pvPanel`, `pvann.<id>`, `pvdt.seen`, `pvdt.last`, `pvpts.<id>`, `calcPos`, `activeDevis`, `dmLayer`, `dmCad`, `pc.pqSite`, `cal` (événements agenda déjà envoyés par cet appareil : `{idFiche: contenu}`), `plan.<site>` (dernier planning ouvert), `planSplit` (double vue PC : `{on, w}`), `planVac` (vacances reprises dans les nouveaux plannings), `planLay` (modèle commun de mise en page des plannings : `{lay, mod, id, pend}`), `planAn` (réglages de l'onglet Analyse : `{kind, per, by, src, cmp}`).

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
│   ├── À faire (ne pas supprimer).json   (tâches du chantier, kind='todo')
│   ├── À faire – texte tapé.json         (textes tapés des tâches, écrit par la tâche Transcription)
│   └── PV de chantier/         (PV DT + « <nom du PV> – récap[ AAAA-MM-JJ].pdf » à côté de chaque PV, tâche Récap PV)
│       ├── PV annulés/
│       └── Annotations/        (« <PV> - annotations BauGest.json » : traits + points cochés `done` {id: texte du point})
├── À classer/                  (photos sans chantier)
└── Devis particuliers/<fiche>/Photos/ (+ mémos PDF)
    └── Croquis/ (« <photo> – croquis.json » : traits modifiables d'un croquis, kind='croquis')
```
Dossiers créés automatiquement à la création d'un chantier (`siteFolderPaths`, `ensureSiteFolders`) ; pas de sous-dossiers de plans imposés. Nom du dossier chantier : `siteFolder()` = « N° Nom ».

## 3b. Formats de données

**Identification des fichiers BauGest** : chaque fichier écrit porte des `appProperties` Drive (les tâches et la galerie filtrent dessus) :
- commun : `pc:'1'`, `site:<siteId|none>`
- photo : `taken`, `tags` (séparés par `|`, 60 car. max), `lat`, `lon`, `imp:'1'` si importée ; texte lisible dans `description`
- `kind` : `todo` (+ `n` = nb de tâches ouvertes), `plan` (+ `uid`), `planning` (+ `uid`), `planlay` (modèle de mise en page des plannings, à la racine), `planningxml` (+ `uid`, copie MS Project du planning), `export`, `soum` (soumission importée par la tablette), `mesures` (+ `plan`, `n`), `croquis` (JSON des traits, + `sk`), `pvdt` (+ `pvn`, `pvdate`), `doc` (+ `dtype`, `title`), `settings`
- croquis de devis : le JPG (photo de la fiche, étiquette « Croquis ») et son JSON portent tous deux `sk` = n° du croquis
- ⚠ Une **copie** Drive perd les `appProperties` → toujours déplacer/renommer.

**Réglages synchronisés** (`Réglages PhotoChantier (ne pas supprimer).json`, `appProperties.kind='settings'`) : champs `SYNC_FIELDS` = companies, tags, logoLib, docLay, docTitles, stamp, logoOn, logoPos, logoSize, logoBg, stampLines, quality, tagPrompt, tagDelay, structure, pvKeys + chantiers `S.sites` + devis `S.devis`/`S.ddel`. Fusion par horodatage par champ/chantier (`S.fmod`, `S.smod`, `S.sdel`, `S.remap`). Valeurs par défaut : objet `DEF` (index.html ~l.1870).

**Chantier** : `{id, number, name, lat, lon, radius (m, défaut 300), meet?, comp?, abbr?, …mise en page propre}` ; détection GPS = position dans le rayon.
`meet` = séances `{from:'AAAA-MM-JJ' (1re séance → jour de semaine), time:'HH:MM', every:1–4 semaines, dur:min, place?}` ; `comp` = id de notre entreprise (`S.companies`) ; `abbr` = abréviations DT séparées par virgules (aussi ajoutées à `pdKeys`).

**Document manuscrit** (`DOCS`, `DOC_ORDER = pv, journal, regie, constat, libre`) : page logique 1000 × 1414 unités (`PW`, `PH`), traits stylet en JSON. Cases signature : journal, regie, constat (`sign:true`).
**Éditeur manuscrit (13.10.2026)** : outil par défaut à chaque ouverture = stylo fin noir (`ED_SIZE` 1.7). Zoom 2 doigts interne aux pages (`ed.zoom` 1–3, barres non zoomées ; zoom navigateur bloqué par `touch-action`). Défilement au doigt manuel avec élan (`bindEdGestures`). Tablette (`ed.drawer`, classe `de-drawer`) : le doigt n'écrit jamais ; outils cachés, sortis en glissant le doigt depuis le bord gauche (ou geste « retour » Android, qui sort/rentre les outils au lieu de fermer l'éditeur → fermer avec ✕) ; refermés au contact du stylet ou d'un tap ; double tape au doigt = stylo ⇄ gomme. Téléphone : le doigt écrit toujours (pas de stylet).
**Visionneuse PV DT (13.10.2026)** : même présentation que l'éditeur (barre `de-top`, ligne d'état, tiroir d'outils `de-tools` à gauche : Marqueur, Stylo + 4 couleurs, Gomme, Annuler, Zoom −/+). Mêmes règles : seul le stylet écrit, outils sortis du bord gauche (ou « retour » Android), double tape = outil ⇄ gomme, défilement avec élan. Outil par défaut = marqueur jaune (`hl`), plus de mode « Lire ». Un PV s'ouvre en haut de la 1re page.

**Calculette flottante (15.10.2026, tablette seulement)** : bouton 🧮 dans la barre du haut + dans le tiroir d'outils de l'éditeur de documents, de la visionneuse PV DT et de la barre d'outils des plans (`[data-calc]`, cachés sur téléphone via `html.calc-ok`). Fenêtre `#calc` (z-index 60) déplaçable par sa barre de titre, position gardée dans `baugest.calcPos`. Touches + − × ÷ % ( ), C, ⌫, = et « Copier » (presse-papiers, sans séparateur). « a + b % » = a + a×b/100 ; « a × b % » = a×b/100. Se ferme toute seule quand on quitte l'éditeur / le plan / le PV. Bloc « Calculette flottante » (`calcEval`, `bindCalc`) ; absente de `pc.html`.

**Planning (17.10.2026, `planning.js`)**
- Format : `{v:1, uid, siteId, name, start, indice, hol:{canton, keys[], extra[{d,label}]}, vac[{from,to,label}], opts:{sat, hpd, structure:'flat'|'lots'|'tree', budget:'res'|'man'|'mix'}, res[{id,name,type:'team'|'machine'|'sub'|'supply',unit,rate,cap,color}], tasks[{id,name,parent,lot?,ms?,dur (j ouvrés),deps[{id,type:FS|SS|FF|SF,lag}],snet?,lvl (décalage du lissage),asg[{r,q,w0?,w1?,d0?,d1?}] (période de présence, voir plus bas),bud?,pct,aStart?,aEnd?,act[{d,r,q|amt}],note?,zone? (secteur / bâtiment ; celle du lot vaut pour ses tâches, `zoneOf`),col?,st?:{pos:'l'|'t'|'b'|'i' (défaut à droite), txt:'name'|'res'|'both'|'nd'|'dates'|'dur'|'none', b:1 (gras), tc:'#rrggbb' (couleur du texte), h:'s'|'l' (barre fine / épaisse), pat:'h' (hachuré)}, lres? (lots seulement)}], baseline:{at,end,tasks:{id:{start,finish,dur,cost}}, lots?:{id:{start,dur,cost}}}|null, lay?}`. Dates internes en n° de jour UTC.
- Calcul : calendrier lu–ve (+ samedi en option) moins fériés du canton (table `CANTONS`, modifiable par planning) et vacances. Coûts : équipe = pers. × j × `hpd` h × CHF/h ; machine = u. × j × CHF/j ; sous-traitant / fourniture = quantité × PU. Réalisé saisi en h / j / quantités ou montant libre. Valeur acquise à la date d'état (PV/VA/CR, SPI, CPI, coût final). Lissage = ordonnancement en série (critiques d'abord), proposé puis appliqué par l'utilisateur.
- **Ressources d'un lot (26.10.2026)** : `t.lres = [{r, q, w0, w1}]` sur un lot, **en plus** des ressources des tâches (choix de Joel). Périodes en semaines calendaires comptées depuis le début du lot (`w0` ≥ 1, `w1` = 0 → jusqu'à la fin du lot) : suivent le lot s'il se décale, la période « à fin » s'allonge avec lui ; effectif qui varie = plusieurs lignes pour la même ressource. `lotSpan(cal, R, a)` → `{es, ef, dur}` bornés au lot, `lotSpans`, `lotCost`, `lotBudget` (0 si budget 'man'). Repris dans : charge (`loads` → `addLotLoads`, lot terminé exclu), surcharges, lissage (charge du lot pré-remplie et fixe dans `levelProposal`), `costMap` (lot = tâches + ses ressources), `evm` (ligne `lot:true`, avancement = moyenne des tâches pondérée par la durée, réf. `baseline.lots`), onglet Ressources (lignes « lot, sem. … »), Budget (bouton Réalisé sur le lot), colonne / texte « Ressources » (`resTxt` : mini–maxi), Excel. Fiche du lot : bloc « Ressources du lot » (`#tkLres`, `lresRow`, dates et coût de chaque période affichés). Import MS Project : affectation d'un récapitulatif → `lres` sur tout le lot ; **pas exporté** dans le XML MS Project.
- **Périodes de présence (26.10.2026)** : chaque ligne `t.asg` (tâche) ou `t.lres` (lot) = ressource + quantité + période : rien = toute la durée ; `w0`/`w1` = semaines comptées depuis le début (suivent la tâche / le lot) ; `d0`/`d1` = dates fixes ISO (vide = début / fin). Plusieurs lignes pour la même ressource = plusieurs périodes. `perMode(a)` ('' | 'w' | 'd'), `asgSpan(cal, R, a)` → `{es, ef, dur, out}` toujours borné à la tâche / au lot (`out` = dates en partie dehors, non comptées, alerte orange dans la fiche) ; `lotSpan` = alias, `taskSpans(cal, R, t)`. `taskBudget(plan, t, dur, cal, R)` compte chaque ligne sur sa période (appelé avec cal + R par `evm`, `takeBaseline`, `costMap`, fiche). Repris dans `loads`, `levelProposal` (demande = décalages depuis le début de la tâche : une période en dates fixes suit la tâche pendant le lissage), `resAnalysis`, `resStats` / `taskList` (« lot, 12.04.27 → 30.04.27 », `perTxt`), `resTxt` (une ressource par nom, mini–maxi), Excel (`asgX`). Fiches : lignes `perRow` / `perRead` / `perUpd` / `perNext` / `perPrefill` (passage en « Dates » → dates de la tâche / du lot proposées ; + Ressource → même ressource, période suivante). Export MS Project : quantité sur toute la tâche (périodes non exportées).
- **Couleur d'une nouvelle ressource (26.10.2026)** : `resColor(plan, exceptId)` (cœur) = couleur la plus éloignée (distance « redmean ») des couleurs des ressources, des `t.col` et du rouge `#e5484d` (surcharges) ; d'abord la palette `RES_PAL` (16 couleurs, 1re dont l'écart > 140), sinon teinte HSL calculée si nettement meilleure. Utilisée par `editRes` (nouvelle ressource) et l'import MS Project ; reste modifiable.
- **Analyse des ressources (26.10.2026)** : onglet « Analyse » (`renderAn`, après Budget), comme une courbe prévisionnelle de main-d'œuvre d'entreprise. Calcul `resAnalysis(plan, sch, {per:'d'|'w'|'m', by:'zone'|'lot'|'res'|'type'})` (cœur, exporté) → périodes entières `{k, a, b, nd}` (nd = jours ouvrés) et `S[plan|base|real][team|machine|chf][groupe]` = personnes-jours / unités-jours / CHF. Prévu = ressources des tâches + `lres` des lots (+ `t.bud` selon la source du budget, groupe « Montants sans ressource » pour res / type) ; référence = mêmes ressources aux dates de `baseline.tasks` / `baseline.lots`, CHF ramenés au coût figé ; réel = `t.act` (heures ÷ `hpd`, jours machine, montants) à leur date, coupé après la date d'état (`anView` : `cut`). Effectif affiché = jours ÷ nd (moyenne des jours ouvrés, choix de Joel). Lot = lot de 1er niveau (« Hors lot »), zone = `zoneOf` (« Sans zone » en dernier). Écran : Contenu (main-d'œuvre / machines / montants), Période, Couleurs par, Barres (prévu / réel / référence), Comparer (lignes : réel rouge, référence gris pointillé), KPI (pic, moyenne, hommes-jours, réel), barres empilées SVG (`anSvg`, + courbe cumulée pour CHF) et tableau aligné (`anTable` : mois / n° de semaine, total EFF, une ligne par couleur, comparaisons + écarts, cumuls). Réglages gardés dans `localStorage['baugest.planAn']` (`anState`). Sorties (`anOut`) : PDF A4–A0 (`makeAnPdf` : titre, bandeau jaune, logo de la mise en page, graphique, tableau, une page par contenu coché, découpé en plusieurs pages si colonnes < 13 pt), Imprimer (`printPlan(lay, build)` → même aperçu PC / impression tablette), Excel (`anSheets` : une feuille par contenu, aussi ajoutée à l'export Excel du planning).
- Gantt : le doigt fait défiler, la souris / le stylet déplacent et allongent les barres, tirent un lien depuis le rond au bout de la barre. Liste des tâches fixe à gauche au défilement horizontal (22.10.2026). Onglets : Gantt, Ressources, Budget, Analyse, Réglages. Barre d'outils du Gantt : Tâche, Jalon, Lot · niveau, ordre, lier, modifier, supprimer · **Sélection** (cases) · **Style** · « N tâches » ✕ · Jour / Semaine / Mois, Auj., tableau complet, Réf.
- **Couleur de barre par tâche (22.10.2026)** : `t.col` ('#rrggbb', absent = Auto) choisi dans la fiche de la tâche / du jalon / du lot (`#tkCol` : Auto, 10 pastilles `COLORS` + rouge + gris, pastille arc-en-ciel = couleur libre). Remplace la couleur auto (tâche, critique, terminée, lot, jalon) à l'écran et dans le PDF ; tâche colorée critique = contour rouge (le contour orange pointillé du retard reste prioritaire).
- **Sélection multiple et style (22.10.2026)** : `U.msel` (Set d'ids, `U.sel` = tâche active) ; PC : Ctrl+clic ajoute / enlève, Maj+clic = plage depuis `U.sel`, Ctrl+A = tout ; tablette : bouton Sélection (`U.selMode`, cases `.bp-ck` devant les tâches, toucher une ligne / barre coche) ; « N tâches » + ✕ dans la barre, Échap désélectionne avant de fermer ; Suppr / poubelle supprime toutes les tâches cochées (confirmation). Bouton **Style** → `styleDlg(ids)` : couleur (`t.col`), position et contenu du texte, gras, couleur du texte, hauteur, hachuré (`t.st`) ; valeur commune affichée, « inchangé » si différente (`*`), « Tout par défaut » efface `col` + `st`. Rendu identique écran (`renderGantt` : `txt()`, motif SVG `#bpHatch`, `inkOn` = encre lisible dans la barre) et PDF (`makePdf` : `ptxt()`, hachures en lignes) ; libellé `barLabel(Ly, o, r)` = `st.txt` sinon `Ly.barText` (lots : seulement si `st.txt`).
- **Impression (22.10.2026)** : bouton Imprimer de la barre du haut → `printDlg` (format A4/A3/A2/A1/A0 de la table `PAPER`, orientation, case « Ajuster à la page » ; proposés d'après la mise en page) → `printPlan(lay)`. Même choix en tête du menu Exporter (`exportMenu`, champs `fmtFields` / `fmtRead`), valable pour Imprimer et PDF (nom « … – Gantt A1 AAAA-MM-JJ.pdf »).
  - PC (`H.split`) : fenêtre « Aperçu avant impression » (`printPreview`) = PDF vectoriel dans la visionneuse PDF du navigateur (iframe visible), impression par son bouton 🖨 ou Ctrl+P dans l'aperçu ; boutons Ouvrir dans un onglet, Télécharger ; Échap ferme. Ne pas revenir à un iframe caché + `contentWindow.print()` : Chrome/Edge imprimaient la page BauGest au lieu du planning.
  - Tablette : pages du PDF rendues en PNG par pdf.js (6000 px max sur le grand côté) dans `#bpPrint` + `window.print()` ; `@page` en mm (`mmOf`, les noms A2/A1/A0 ne sont pas reconnus par CSS).
  - **Partie du planning (23.10.2026)** : `pickFields` / `pickBind` / `fmtRead` dans Imprimer et Exporter → période (mise en page, tout, du … au …, N semaines dès ce lundi, un mois → `pdf.range='custom'` + `from`/`to`, `only`) et tâches (`pdf.filter = {k:'lots'|'zones'|'sel', ids}` ; sélection proposée d'office si ≥ 2 cochées). `makePdf` filtre avant la période (lots parents gardés comme titres, période « tout » recalculée sur les lignes gardées), sous-titre « Zone : … / Lot : … / Sélection : N tâche(s) » ; erreur « aucune tâche… » si vide. Champ Zone dans la fiche (`#tkZone`, liste `zonesOf`) et dans Style pour plusieurs tâches ; colonne `zone` dans `COLDEF`. Choix non mémorisé (impression seulement).
  - **Logo en haut à gauche (23.10.2026)** : dans `makePdf`, logo chargé avant l'en-tête (`lPos`, `lTop`, `lCart`) ; en haut : hauteur `pdf.logoH` mm → `lH`, largeur limitée à 40 % (`lW`, `lH2`), `titleH` agrandi si besoin, titre et sous-titre à `tX` ; cartouche : seulement si `logoPos` 'cart' ou 'both'. Réglé dans Mise en page (`#lyLogoPos`, curseur `#lyLogoH` 8–60 mm) ; avec « Ajuster à la page », le logo est réduit comme le reste.
  - « Ajuster à la page » (`pdf.fit`) : si les lignes dépassent 1 page, `makePdf` se rappelle avec `pdf._k` = facteur d'agrandissement, dessine sur une page agrandie aux mêmes proportions puis `scaleContent(1/k)` + `setSize` → 1 seule page ; `blob.fitPct` → message « réduit à N % » (`fitNote`).
- Mise en page (`layDlg`, 21.10.2026) : colonnes écran/PDF + ordre (`COLDEF`), couleurs, texte des barres, hauteur de ligne / police / zoom, PDF (format A4–A0, orientation, ajuster à la page, titre, période, légende, cartouche, logo via `H.logos` — `pdf.logoPos` 'tl' (en haut à gauche, défaut depuis le 23.10.2026) | 'cart' | 'both', `pdf.logoH` = hauteur en haut en mm (8–60, défaut 15 ; largeur max 40 % de la page ; en-tête agrandi, titre et sous-titre décalés à droite) —, remarques en bas de page (26.10.2026 : `pdf.notes[]` en nombre libre, « + Ajouter une remarque » / ✕ dans `#lyNotes` ; ancien champ `pdf.note` encore lu par `noteList` ; dans `makePdf` une ligne par remarque sous la légende, `legY` / `foot` agrandis selon le nombre)) ; modèle commun dans `<Racine>/BauGest – mise en page des plannings (ne pas supprimer).json` (kind='planlay', cache `baugest.planLay`) ou propre au planning (`plan.lay`).
- PC seulement : double vue (planning à gauche, BauGest PC à droite, séparation réglable, gardée dans `baugest.planSplit` ; le clavier va au côté cliqué) et fenêtre séparée `pc.html#planning=<chantier>&plan=<uid>` (2e écran ; le planning se ferme dans la fenêtre principale). Ouvrir un fichier `planning`/`planningxml` dans l'explorateur ouvre le module (`openPlanFile`), un autre .xml MS Project propose l'import (`BGPlan.importXml`).
- Hôte : `BGPlan.init({sites, api, ensureFolder, online, loadScript, company, logos, onToggle, split, onSplit, popout, onClose})` puis `BGPlan.open(idChantier, uidPlanning?)` ; `BGPlan.back()` pour le retour Android ; `BGPlan.milestones(from, to)` pour l'accueil tablette. Absent du téléphone.
- Manuel : bouton ? → `aide-planning.html` (+ PDF) ; à mettre à jour à chaque évolution visible (texte, captures via `tools/aide/captures.js`, PDF).

**À faire (19.10.2026)** : `{v:1, siteId, site, updatedAt, tasks:[{id, c (création ms), m (modif ms), ink:[traits stylet, largeur 1000, une ligne = 100 unités, plusieurs lignes possibles (listes de matériel) ; le bloc ajoute une ligne libre dès qu'on écrit sur la dernière, bouton + Ligne], iv (version de l'écriture), tx?:{v:iv, t:texte transcrit, lignes séparées par \n}, t?:texte tapé (point de PV), pri:'r'|'o'|'g', due:ms|null, rep:0|7|14|'m', ln?:{t:'photo'|'plan'|'pv', id Drive, key?, name, th? (miniature 640 px)}, done:ms|null, del:ms|null, src?:{pv, pt}, repOf?}]}`. Fusion par tâche (m le plus récent ; `tx` repris si `tx.v == iv`) ; supprimées gardées 90 j. Tablette : rubrique « À faire » (bloc d'écriture au stylet, le doigt fait défiler, double tape au doigt = stylo ⇄ gomme comme l'éditeur, pastille Stylo/Gomme en haut à droite du bloc, Annuler rétablit aussi un trait gommé ; main posée ignorée : pendant que le stylet écrit ou survole l'écran (+0,8 s) et pour toute grande surface de contact, les touchers ne font ni défilement, ni clic, ni double tape (`bindTdPalm`) ; zoom à 2 doigts bloqué dans les zones À faire ; priorité, rappel = boutons rapides + calendrier, répétition, lien photo / plan / PV), bouton ☑ + compteur rouge (tâches en retard ou du jour) dans toutes les barres du haut → panneau à droite tous chantiers ; « → À faire » sur chaque point à notre charge d'un PV DT. Téléphone : ☑ dans la barre caméra, consultation + case à cocher. PC : bouton ☑ dans la barre du haut, consultation + case à cocher. Rappel = notification BauGest (seulement si l'app est ouverte) + bandeau rouge à l'ouverture ; IndexedDB `baugest-todo`, clé `baugest.todo.notif`. Tâche répétée cochée → copie dans l'historique, la tâche revient à la prochaine échéance.

**Accueil tablette (20.10.2026)** : mode `'home'` du bureau (`desk.mode`, classe `#desk.hm-mode`), bloc « Accueil (tablette) » (`loadHome`, `renderHome`, `hmClick`). Écran de démarrage de la tablette (`S.home` `'auto'` ; migration unique `S.homeV` : `plans`/`docs` → `auto`) ; logo BauGest de la barre = bouton `data-rail="home"` ; « retour » Android depuis une autre rubrique du bureau → accueil (`hmBackHome`). Contenu : date + semaine + chantier GPS ; « Aujourd'hui » = rappels (en retard / du jour), visites devis du jour (`S.devis[].visit`), séances du jour (`s.meet`), PV DT non lus des 14 derniers jours (Drive `kind='pvdt'`, `baugest.pvdt.seen`, récaps exclus) ; « Cette semaine » = 7 jours (week-end masqué s'il est vide) avec séances, visites, jalons des plannings **gardés sur l'appareil** (`BGPlan.milestones(from, to)` dans `planning.js`) et 3 tâches max par jour ; « À faire par chantier » = une colonne par chantier avec ≥ 1 tâche ouverte (chantier GPS d'abord), case à cocher directe, toucher une tâche → rubrique À faire du chantier sur cette tâche. Rafraîchi chaque minute et à chaque modification de tâche. Absent du téléphone et du PC.

**Mémos de devis (20.10.2026)** : chaque mémo enregistré de la fiche a un bouton 🗑 (liste « Mémos enregistrés ») + bouton « Effacer » dans la visionneuse du mémo ; confirmation ; Drive → corbeille (récupérable 30 j), en attente → retiré de la file d'envoi (`dzAskDelMemo`, `dzDelMemo`). PC : même bouton 🗑 dans la liste des mémos de la fiche.

**Croquis de devis (20.10.2026, tablette seulement)** : bouton « Croquis » dans la carte Photos de la fiche (page blanche quadrillée, image importée ou photo de la fiche) + « Dessiner dessus / Retoucher le croquis » dans la visionneuse photo. Éditeur `#sketch` (bloc « Devis : croquis ») : stylo, trait droit (accroché à l'horizontale/verticale ±4°), texte, gomme, 4 couleurs, 3 épaisseurs, annuler/rétablir, carreaux, tout effacer ; stylet ou souris dessinent, 1 doigt déplace, 2 doigts zooment, double tape au doigt = outil ⇄ gomme, main posée ignorée. Enregistré comme photo de la fiche (JPG 2000 px, sans tampon) → repris dans le mémo PDF. JSON `{v:1, uid, devis, w, h, grid, bg (dataURL du fond ou ''), strokes:[{c,w,p:[[x,y,pression]]} | {t:'txt',c,z,x,y,s,bw}], mod}` gardé dans `meta.skJson` de l'élément de file d'envoi puis envoyé dans `Croquis/`. Retouche : JPG remplacé sur place (`meta.fid`, PATCH media), JSON aussi (`meta.skFid`). Supprimer la photo laisse le JSON dans Croquis/.

**Zoom aux doigts (20.10.2026)** : zoom du navigateur bloqué partout (viewport `user-scalable=no` + `*{touch-action:pan-x pan-y}` en tête du CSS, les zones à zoom propre gardent `none` + `blockPageZoom` : 2 doigts / gestes iOS annulés en capture) → menus, listes, fiches jamais zoomés. Zoom seulement dans ce qu'on ouvre, par le zoom propre à chaque visionneuse : photo, plan, PV DT, éditeur de document, croquis, cartes ; document transcrit et mémo de devis = `bindPageZoom` (1–4×, remis à 1× à chaque ouverture). Bloc « Zoom aux doigts » avant « Démarrage ».

**Accueil PC + Courrier (21.10.2026, dans `pc.html` depuis le 22.10.2026)** : onglet « Accueil » (écran de démarrage du PC), grille de 12 colonnes, blocs `drop` (Déposer et trier), `today` (aujourd'hui + 7 jours : rappels, séances, visites, PV DT 7 j, jalons), `quick` (tuiles d'actions réglables), `mails` (filtre chantier / importants), `sites` (tuiles chantiers : à faire, retards, mails 7 j, séance, Photos / PV / Planning / Mémoire / infos). Bouton « Modifier l'accueil » : glisser l'en-tête = déplacer, coin = taille, ⚙ = réglage, ✕ = retirer, + Ajouter un bloc. Disposition `{lay:[{id,t,w,h,o}], at}` dans `localStorage['baugest.pcHome']` + « BauGest – accueil PC (ne pas supprimer).json » à la racine (`kind='pchome'`, le plus récent gagne).
Courrier : on dépose sur l'accueil des mails Outlook `.msg` (lecteur CFB/MAPI maison, mails joints relus) ou `.eml` (MIME) et des fichiers. Pièces jointes typées (PDF lu par pdf.js : PV DT avec n°/date, plan si grand format / échelle / indice, sinon document ; images < 25 ko ou inline = ignorées) ; chantier deviné (n°, nom, abréviations DT, expéditeur déjà classé : `baugest.mailFrom` + recherche Drive `from`) ; doublon = même `mid` (hash Message-ID/sujet/expéditeur/date). Rangement : PV → `PV de chantier` (kind pvdt, remplace même n°), plan → `Plans` (kind plan + uid), photo → `Photos` (taken = date du mail, étiquette Mail), autre → `<Chantier>/Courrier/Documents reçus` (kind `mailatt`), mail d'origine → `<Chantier>/Courrier/AAAA-MM-JJ HHhMM – Expéditeur – Sujet.msg|.eml` (kind `mailsrc`) + `.json` (kind `mail`, appProperties `mid, from, mdate, na`, `td='1'` quand les actions sont dans À faire ; contenu `{v:1, kind, mid, siteId, site, subject, from{name,email}, to, cc, date, body (60 000 car.), atts[{name,type,fid}], src{fid,name}, droppedAt}` ; description = extrait). Sans chantier → `À classer/Courrier`.
Résumés (tâche « Mails BauGest ») : `<nom du mail> – résumé.json` à côté `{v:1, at, imp:'h'|'n'|'l', t, pts[], actions[{t, due:'AAAA-MM-JJ'|null, pri}], dl[]}` + description du `.json` du mail réécrite « #résumé imp=h act=2\n<résumé> » ; `Courrier – mémoire.json` par chantier `{v:1, siteId, site, updatedAt, synth, open[], events[{d, from, t, mail}]}` (nouvelle version créée, l'ancienne mise à la corbeille). Le connecteur Drive des tâches ne sait pas écrire d'appProperties ni réécrire un fichier → **c'est BauGest PC qui ajoute les actions aux À faire** (`mlSyncTodos`, tâche `t` + `src:{mail, n}`) puis met `td='1'`.
Tablette : rubrique « Mails » (rail + `dkModes`, `desk.mode='mails'`, bloc « Courrier : rubrique Mails de la tablette » : `loadMails`, `renderMails`, `openMailT`, feuille `#sheetMail`) = lecture seule par chantier : mémoire (où on en est, points ouverts, chronologie), liste des mails (importants en rouge), fiche du mail (résumé, actions, délais, pièces jointes : PV / plan ouverts dans BauGest via `tdOpenLink`, autres sur Drive, texte complet). Pas sur le téléphone.

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
- Planning : impression PC = aperçu PDF (vectoriel) avant impression ; tablette = impression directe ; format au choix A4 à A0 + « Ajuster à la page » ; impression d'une partie : dates (du … au …, semaines, mois) et tâches (lots, zones, sélection) ; logo de l'entreprise en haut à gauche des impressions, taille réglable (Mise en page) ; couleur et style des barres libres par tâche (texte gauche / droite / dessus / dessous / dans la barre, contenu, gras, couleur du texte, hauteur, hachuré), appliqués à plusieurs tâches sélectionnées d'un coup, repris à l'écran, dans le PDF et à l'impression.
- Planning : tablette + PC, un ou plusieurs plannings par chantier ; jours ouvrés, fériés du canton choisi (cochables) + vacances du bâtiment réglables ; structure des tâches et source du budget réglables par planning ; surcharge = alerte + proposition de lissage validée par Joel ; ressources propres à chaque chantier ; ressources affectables aussi à un lot, en plus de ses tâches ; dans les tâches comme dans les lots, chaque ressource a une ou plusieurs périodes de présence (toute la durée, semaines qui suivent la tâche / le lot, ou dates fixes) ; partie hors de la tâche / du lot non comptée + alerte orange ; pas de modèles de planning fournis ; analyse finale des ressources (onglet Analyse) : main-d'œuvre, machines et montants par jour / semaine / mois, couleurs par zone, lot, ressource ou type, prévu / réel / référence, effectif = moyenne des jours ouvrés, à l'écran, en PDF, à l'impression et dans Excel.
- Communication : français, simple et concis ; questions sous forme de choix cliquables ; proposer des idées concrètes, pas seulement des questions.

### Repères dans `index.html` (marqueurs `/* ---------- … ---------- */`)
Réglages & synchro (~1868–2130) · GPS/caméra/prise de vue (~2164–2515) · Drive + file d'envoi (~2515–2684) · Galerie/carte/visionneuse photo (~3144–3685) · Documents manuscrits + éditeur (~3771–4711) · Ergonomie v2 (~4059) · Plans : explorateur, glisser-déposer stylet, visionneuse, métrés (~5006–6266) · PV DT : lecture, liste, annotation, points à notre charge, notes reliées (~6266–6964) · Soumission : lecture .crbx, tableau filtrable, import (marqueur « Soumission du chantier ») · Devis : fiches, mémo PDF, entreprises, métré 2D/3D, orthophoto, effacement, croquis (~7895–9370) · Retour Android (~8105) · Démarrage (~8169).

`pc.html` reprend des blocs de la tablette « tels quels » (rendu des documents, calculs devis, orthophoto, lecture PV) → toute correction dans ces blocs doit être faite **dans les deux fichiers**.

## 4. Automatisations (tâches planifiées Claude, cloud Anthropic)

| Tâche | Horaire (Europe/Zurich) | Rôle |
|---|---|---|
| Transcription BauGest | lu–ve 17:53 (11:53 retiré le 19.10.2026) | JSON manuscrit → PDF texte tapé à côté du JSON (un item par paragraphe, texte à la largeur de la page, sans ligne vide, aligné à gauche, pages manuscrites enchaînées sur les lignes libres — validé par Joel le 17.10.2026) ; signatures recopiées, jamais transcrites ; tâches À faire → « À faire – texte tapé.json » (`todo.py`) ; notification si ≥ 1 document |
| Plans BauGest | lu–ve 17:17 (11:17 retiré le 19.10.2026) | Renomme les plans d'après le cartouche (« Sujet ind C AAAA-MM-JJ.pdf »), doublons/anciens indices → Plans annulés ; notification si changement |
| Récap PV BauGest | lu–ve 17:35 | Veille de séance (vendredi pour le lundi) : compare les 2 derniers PV DT du chantier + points cochés, PDF « <PV> – récap.pdf » à côté du PV + notification ; « PV manquant » si aucun nouveau PV |
| Soumission BauGest | vendredi 17:44 | Word / PDF du dossier « Soumission » → « <nom> – positions.json » à côté (tools/soumission), contrôle des totaux par CAN ; notification si ≥ 1 soumission |
| Mails BauGest | lu–ve 11:50 et 17:50 | Mails classés par BauGest PC (`<Chantier>/Courrier/*.json` sans « – résumé.json ») → résumé, actions, délais, importance + mémoire du chantier ; notification si mail important (voir 3b « Accueil PC + Courrier ») |
| Rappel séance BauGest | tous les jours 06:52 | Jour de séance : notification avec le résumé et les liens directs vers le récap (Drive + BauGest tablette `?pvdt=<id>&site=<id>`) |

Les deux tournent sans l'ordinateur de Joel, mais dépendent des connexions Google Drive/GitHub du compte Claude. Dernier passage réussi : 09.10.2026.
Le prompt complet de chaque tâche est lisible avec `list_triggers` (ids `trig_01XjUE62rMyRVSSEq1JPZk37` transcription, `trig_01CwbzZRPB1U3bZNXRm3VBE8` plans, `trig_01XDouvMa1Gg46UiyyEWy9kU` récap PV, `trig_01VTEvcsYX7xHzW3Ayy1Hd1C` rappel séance, `trig_019PiTMiYsTCVz7GKh5fZNrS` mails, `trig_01SrjGNQAySVobeYiVkVhE2e` soumission — créée sans connecteur Google Drive : à ajouter dans claude.ai › Routines). Si un format de fichier ou un nom de dossier change dans l'app, **mettre à jour le prompt de la tâche concernée** (`update_trigger`). La tâche Transcription clone le dépôt et exécute `tools/transcription/*.py` : ne pas casser leur interface.

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
4. Tester avec Playwright (viewport téléphone et tablette), Drive simulé, CDN redirigés vers `npm i pdfjs-dist@3.11.174 pdf-lib@1.17.1`. Planning : page de test minimale (`<script src=planning.js>` + `BGPlan.init` hors ligne, `split:true` pour simuler le PC), plannings injectés dans IndexedDB `baugest-planning` (voir `tools/aide/captures.js`).
5. Incrémenter `const C='baugest-vNN'` dans `sw.js` à chaque publication (sinon la tablette garde l'ancienne version) — **après** le `git pull --rebase` : d'autres sessions publient aussi, un `sed` sur l'ancien numéro ne fait alors rien (arrivé le 22.10.2026).
6. Commit en français, trailers `Co-Authored-By` + `Claude-Session`, push sur `main`.
7. Questions de clarification : toujours en choix cliquables.

## 6. Bugs connus et limites

| # | Problème | Zone | Statut |
|---|---|---|---|
| 1 | Notification « nouveau PV » seulement si l'app est ouverte (pas de push serveur) | PV DT | Limite connue |
| 2 | Détection auto chantier/n°/date d'un PV impossible sur PDF scanné (pas de texte) → saisie manuelle | PV DT (PC) | Limite connue |
| 3 | Visionneuse PV : défilement sans élan | PV DT tablette | Corrigé le 13.10.2026 |
| 4 | `sw.js` ne pré-cachait que `index.html` (hors ligne, `pc.html` pouvait s'ouvrir en version tablette) | PWA PC | Corrigé le 19.10.2026 : `pc.html` + `pc.webmanifest` pré-cachés, repli hors ligne vers `pc.html` |
| 5 | Texte d'aide de l'URI de redirection affiche encore `tonnom.github.io/photochantier` (aperçu hors ligne) | Réglages Drive | Cosmétique |
| 6 | Outils vus dans la maquette ergonomie mais non implémentés : texte (tablette), comptage de points, zoom caméra | Ergonomie v2 | Non fait volontairement |
| 7 | Photos copiées (au lieu de déplacées) dans le Drive perdent leurs métadonnées (chantier, GPS, étiquettes) | Drive | Règle : toujours déplacer/renommer, jamais copier |
| 8 | Installation PWA en simple raccourci → pas de « Partager → BauGest » | Android | Installer via « Installer l'application » |
| 9 | Noms hérités `photochantier*` et fichier « Réglages PhotoChantier » : les renommer casse la synchro et les tâches planifiées | Global | À garder tel quel |
| 10 | Fichiers uniques de 300–700 Ko : risque de conflits si deux sessions modifient en parallèle | Dépôt | Toujours rebase avant push |
| 12 | Fériés par défaut des cantons (table `CANTONS` de `planning.js`) établis sans source officielle ; certains ne valent que dans une partie des communes | Planning | À vérifier par Joel, cochables par planning |
| 13 | Impression A2 / A1 / A0 : le navigateur ne propose ces formats que si l'imprimante choisie les gère (traceur) ; sinon il réduit. « Ajuster à la page » sous ~50 % = texte très petit. Tablette : impression en images (pas vectorielle) | Planning | Limite connue |
| 11 | Réglage « Structure des dossiers photos » (A/B/C/D) toujours affiché dans Paramètres mais ignoré : les photos vont toujours dans `<Chantier>/Photos` | Paramètres › Photos | À masquer ou retirer |

## 7. Pistes ouvertes (non commencées, à confirmer avec Joel)

- À faire : rappel quand l'app est fermée (serveur push ou tâche planifiée du matin).
- Courrier : test avec de vrais mails Outlook (glisser direct depuis Outlook vers Chrome / Edge) ; fichiers winmail.dat (TNEF) non lus ; images jointes de moins de 25 ko ignorées.
- Accueil : l'icône BauGest de l'écran d'accueil Android reprend l'app là où elle était (pas de retour à l'accueil BauGest) ; `launch_handler` du manifeste écarté car il risque de casser « Partager → BauGest ». Jalons : seulement les plannings déjà ouverts sur la tablette.
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
