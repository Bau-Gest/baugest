/* =====================================================================
   BauGest — Planning (diagramme de Gantt, chemin critique, ressources, budget)
   Module partagé par la tablette (index.html) et le PC (pc.html).
   Les deux pages appellent BGPlan.init({...}) puis BGPlan.open(idChantier).
   Fichiers Drive : <Chantier>/Planning/<nom>.json (appProperties kind='planning', uid, site)
   ===================================================================== */
(function (root) {
'use strict';

/* ---------- Calendrier : dates en numéros de jour (UTC) ---------- */
const DAY = 864e5;
const pad2 = n => String(n).padStart(2, '0');
const dnOfIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY) : null; };
const isoOfDn = dn => { const d = new Date(dn * DAY); return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()); };
const chOfDn = dn => { const d = new Date(dn * DAY); return pad2(d.getUTCDate()) + '.' + pad2(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear(); };
const shortOfDn = dn => { const d = new Date(dn * DAY); return pad2(d.getUTCDate()) + '.' + pad2(d.getUTCMonth() + 1) + '.' + String(d.getUTCFullYear()).slice(2); };
const wdOf = dn => new Date(dn * DAY).getUTCDay();
const md = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY);
const todayDn = () => { const d = new Date(); return md(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
function easter(y){
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return md(y, mo, da);
}
const nthWd = (y, m, wd, n) => { let d = md(y, m, 1); while (wdOf(d) !== wd) d++; return d + 7 * (n - 1); };
const HOL = {
  ny:   ['Nouvel An', y => md(y, 1, 1)],
  b2:   ['Saint-Berchtold', y => md(y, 1, 2)],
  epi:  ['Épiphanie', y => md(y, 1, 6)],
  mar1: ['Instauration de la République (NE)', y => md(y, 3, 1)],
  sjo:  ['Saint-Joseph', y => md(y, 3, 19)],
  naf:  ['Näfelser Fahrt', y => nthWd(y, 4, 4, 1)],
  vs:   ['Vendredi saint', y => easter(y) - 2],
  pa:   ['Lundi de Pâques', y => easter(y) + 1],
  may1: ['Fête du travail', y => md(y, 5, 1)],
  asc:  ['Ascension', y => easter(y) + 39],
  pe:   ['Lundi de Pentecôte', y => easter(y) + 50],
  fd:   ['Fête-Dieu', y => easter(y) + 60],
  jun23:['Commémoration du plébiscite (JU)', y => md(y, 6, 23)],
  sp:   ['Saint-Pierre et Paul', y => md(y, 6, 29)],
  aug1: ['Fête nationale', y => md(y, 8, 1)],
  ass:  ['Assomption', y => md(y, 8, 15)],
  jg:   ['Jeûne genevois', y => nthWd(y, 9, 0, 1) + 4],
  jf:   ['Lundi du Jeûne fédéral', y => nthWd(y, 9, 0, 3) + 1],
  nk:   ['Saint-Nicolas de Flüe', y => md(y, 9, 25)],
  tous: ['Toussaint', y => md(y, 11, 1)],
  imm:  ['Immaculée Conception', y => md(y, 12, 8)],
  xmas: ['Noël', y => md(y, 12, 25)],
  ste:  ['Saint-Étienne', y => md(y, 12, 26)],
  rest: ['Restauration de la République (GE)', y => md(y, 12, 31)]
};
const HOL_ORDER = Object.keys(HOL);
/* Jours fériés par défaut par canton (cantonaux + usuels du bâtiment). Liste modifiable dans chaque planning :
   certains fériés ne valent que dans une partie des communes (catholiques / protestantes). */
const CANTONS = {
  AG:['Argovie','ny b2 vs pa asc pe aug1 xmas ste'], AI:['Appenzell Rh.-Int.','ny vs pa asc pe fd aug1 ass tous imm xmas ste'],
  AR:['Appenzell Rh.-Ext.','ny vs pa asc pe aug1 xmas ste'], BE:['Berne','ny b2 vs pa asc pe aug1 xmas ste'],
  BL:['Bâle-Campagne','ny vs pa may1 asc pe aug1 xmas ste'], BS:['Bâle-Ville','ny vs pa may1 asc pe aug1 xmas ste'],
  FR:['Fribourg','ny vs pa asc pe fd aug1 ass tous imm xmas'], GE:['Genève','ny vs pa asc pe aug1 jg xmas rest'],
  GL:['Glaris','ny naf vs pa asc pe aug1 tous xmas ste'], GR:['Grisons','ny vs pa asc pe aug1 xmas ste'],
  JU:['Jura','ny b2 vs pa may1 asc pe fd jun23 aug1 ass tous xmas'], LU:['Lucerne','ny b2 vs pa asc pe fd aug1 ass tous imm xmas ste'],
  NE:['Neuchâtel','ny mar1 vs pa asc pe aug1 jf xmas'], NW:['Nidwald','ny sjo vs pa asc pe fd aug1 ass tous imm xmas ste'],
  OW:['Obwald','ny vs pa asc pe fd aug1 ass nk tous imm xmas ste'], SG:['Saint-Gall','ny vs pa asc pe aug1 tous xmas ste'],
  SH:['Schaffhouse','ny b2 vs pa may1 asc pe aug1 xmas ste'], SO:['Soleure','ny vs pa asc pe fd aug1 ass tous xmas ste'],
  SZ:['Schwyz','ny epi sjo vs pa asc pe fd aug1 ass tous imm xmas ste'], TG:['Thurgovie','ny b2 vs pa may1 asc pe aug1 xmas ste'],
  TI:['Tessin','ny epi sjo pa may1 asc pe fd sp aug1 ass tous imm xmas ste'], UR:['Uri','ny epi sjo vs pa asc pe fd aug1 ass tous imm xmas ste'],
  VD:['Vaud','ny b2 vs pa asc pe aug1 jf xmas'], VS:['Valais','ny sjo asc fd aug1 ass tous imm xmas'],
  ZG:['Zoug','ny vs pa asc pe fd aug1 ass tous imm xmas ste'], ZH:['Zurich','ny b2 vs pa may1 asc pe aug1 xmas ste']
};
const cantonKeys = c => (CANTONS[c] ? CANTONS[c][1] : CANTONS.VD[1]).split(' ');
function holidayList(plan, y0, y1){
  const out = [], keys = new Set((plan.hol && plan.hol.keys) || cantonKeys(plan.hol && plan.hol.canton));
  for (let y = y0; y <= y1; y++) for (const k of HOL_ORDER) if (keys.has(k)) out.push({dn:HOL[k][1](y), key:k, label:HOL[k][0]});
  for (const x of (plan.hol && plan.hol.extra) || []) { const dn = dnOfIso(x.d); if (dn != null) out.push({dn, key:'extra', label:x.label || 'Jour chômé'}); }
  return out.sort((a, b) => a.dn - b.dn);
}
/* Jours ouvrés : index 0 = 1er jour ouvré à partir du début du planning */
function makeCal(plan){
  const start0 = dnOfIso(plan.start) ?? todayDn();
  const y0 = new Date(start0 * DAY).getUTCFullYear();
  const off = new Map();
  for (const h of holidayList(plan, y0 - 1, y0 + 15)) off.set(h.dn, h.label);
  for (const v of plan.vac || []) { const a = dnOfIso(v.from), b = dnOfIso(v.to); if (a == null || b == null) continue; for (let d = a; d <= b && d - a < 400; d++) if (!off.has(d)) off.set(d, v.label || 'Vacances'); }
  const sat = !!(plan.opts && plan.opts.sat);
  const isWork = dn => { const w = wdOf(dn); return w !== 0 && (sat || w !== 6) && !off.has(dn); };
  let s = start0, g = 0; while (!isWork(s) && g++ < 400) s++;
  const days = [s];
  const ext = i => { let d = days[days.length - 1], guard = 0; while (days.length <= i && guard++ < 1e6) { d++; if (isWork(d)) days.push(d); } };
  const cal = {
    start:s, isWork, off,
    dnOf(i){ i = Math.round(i); if (i < 0) { let d = s, k = 0; while (k > i) { d--; if (isWork(d)) k--; } return d; } ext(i); return days[i]; },
    /* index du 1er jour ouvré >= dn */
    idx(dn){
      if (dn <= s) { let k = 0, d = s; while (d > dn) { d--; if (isWork(d)) k--; } return k; }
      ext(Math.max(days.length, 8)); while (days[days.length - 1] < dn) ext(days.length + 64);
      let lo = 0, hi = days.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (days[m] < dn) lo = m + 1; else hi = m; } return lo;
    }
  };
  return cal;
}

/* ---------- Modèle ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const RTYPES = {
  team:   {label:'Équipe', unit:'pers.', rateUnit:'CHF/h', time:true},
  machine:{label:'Machine / matériel', unit:'u.', rateUnit:'CHF/j', time:true},
  sub:    {label:'Sous-traitant', unit:'forfait', rateUnit:'CHF/u.', time:false},
  supply: {label:'Fourniture', unit:'m³', rateUnit:'CHF/u.', time:false}
};
const LINK = {FS:'Fin → Début', SS:'Début → Début', FF:'Fin → Fin', SF:'Début → Fin'};
/* couleur d'une nouvelle ressource : la plus éloignée des couleurs déjà prises (ressources, barres colorées à la main, rouge des surcharges) ;
   d'abord la palette (16 couleurs nettes), puis un teint calculé si la palette est épuisée */
const RES_PAL = ['#3e8ed0', '#e8a33d', '#4caf7a', '#9b6fd6', '#d65f8f', '#3fb0b0', '#c97a46', '#7d8a2e', '#2f5fa8', '#f2c230', '#1f8a5b', '#6b4bb3', '#a8326e', '#5aa6e0', '#8c5a2b', '#9fc23a'];
function resColor(plan, exceptId){
  const rgbOf = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const dist = (a, b) => { const r = (a[0] + b[0]) / 2, d = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; return Math.sqrt((2 + r / 256) * d[0] * d[0] + 4 * d[1] * d[1] + (2 + (255 - r) / 256) * d[2] * d[2]); };
  const used = [...(plan.res || []).filter(r => r.id !== exceptId).map(r => r.color), ...(plan.tasks || []).map(t => t.col), '#e5484d'].map(rgbOf).filter(Boolean);
  const score = h => { const c = rgbOf(h); return used.length ? Math.min(...used.map(u => dist(c, u))) : 1e9; };
  const hex = (h, sat, l) => { const f = n => { const k = (n + h / 30) % 12, a = sat * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); };
  const free = RES_PAL.find(h => score(h) > 140); if (free) return free;
  let best = RES_PAL[0], bs = -1, gb = null, gs = -1;
  for (const h of RES_PAL) { const v = score(h); if (v > bs) { bs = v; best = h; } }
  for (let hu = 0; hu < 360; hu += 6) for (const [sat, l] of [[.55, .5], [.5, .66], [.55, .36]]) { const h = hex(hu, sat, l), v = score(h); if (v > gs) { gs = v; gb = h; } }
  return gs > bs * 1.25 ? gb : best;
}
function newPlan(siteId, name, opts){
  const t = isoOfDn(todayDn());
  return Object.assign({v:1, uid:uid(), siteId:siteId || 'none', name:name || 'Planning général', start:t, indice:'A',
    hol:{canton:'VD', keys:cantonKeys('VD'), extra:[]}, vac:[],
    opts:{sat:false, hpd:8.5, structure:'lots', budget:'mix', currency:'CHF'},
    res:[], tasks:[], baseline:null, status:null, updatedAt:new Date().toISOString()}, opts || {});
}
function normPlan(p){
  p.hol = p.hol || {canton:'VD'}; if (!Array.isArray(p.hol.keys)) p.hol.keys = cantonKeys(p.hol.canton); p.hol.extra = p.hol.extra || [];
  p.vac = p.vac || []; p.res = p.res || []; p.tasks = p.tasks || [];
  p.opts = Object.assign({sat:false, hpd:8.5, structure:'lots', budget:'mix', currency:'CHF'}, p.opts || {});
  for (const t of p.tasks) { t.deps = t.deps || []; t.asg = t.asg || []; t.act = t.act || []; t.pct = +t.pct || 0; t.dur = Math.max(0, Math.round(+t.dur || 0)); t.lvl = Math.max(0, Math.round(+t.lvl || 0)); if (t.parent === undefined) t.parent = null; if (t.lres && !Array.isArray(t.lres)) delete t.lres; }
  return p;
}
const maxDepth = p => ({flat:1, lots:2, tree:9})[p.opts.structure] || 2;

/* ordre d'affichage (arborescence) + numéros 1, 1.2, 1.2.3 */
function outline(plan){
  const kids = new Map(); for (const t of plan.tasks) { const k = t.parent || ''; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(t); }
  const out = [];
  const walk = (pid, lvl, pre) => (kids.get(pid) || []).forEach((t, i) => { const wbs = pre ? pre + '.' + (i + 1) : String(i + 1); const ch = kids.get(t.id) || []; out.push({t, lvl, wbs, sum:ch.length > 0 || !!t.lot}); walk(t.id, lvl + 1, wbs); });
  walk('', 0, '');
  return out;
}

/* ---------- Chemin critique ---------- */
function schedule(plan, cal, statusDn){
  cal = cal || makeCal(plan);
  const ol = outline(plan), byId = new Map(plan.tasks.map(t => [t.id, t])), sumIds = new Set(ol.filter(o => o.sum).map(o => o.t.id));
  const leaves = ol.filter(o => !o.sum).map(o => o.t);
  const R = new Map(), errs = [];
  const st = statusDn ?? todayDn(), sIdx = cal.idx(st + 1);
  /* dépendances valides (entre tâches non récapitulatives) */
  const preds = new Map(leaves.map(t => [t.id, []])), succs = new Map(leaves.map(t => [t.id, []]));
  for (const t of leaves) for (const d of t.deps) {
    if (!preds.has(d.id) || d.id === t.id) continue;
    const l = {p:d.id, s:t.id, type:LINK[d.type] ? d.type : 'FS', lag:Math.round(+d.lag || 0)};
    preds.get(t.id).push(l); succs.get(d.id).push(l);
  }
  /* tri topologique */
  const indeg = new Map(leaves.map(t => [t.id, preds.get(t.id).length])), order = [], q = leaves.filter(t => !indeg.get(t.id)).map(t => t.id);
  while (q.length) { const id = q.shift(); order.push(id); for (const l of succs.get(id)) { indeg.set(l.s, indeg.get(l.s) - 1); if (!indeg.get(l.s)) q.push(l.s); } }
  if (order.length < leaves.length) {
    const cyc = leaves.filter(t => !order.includes(t.id));
    errs.push('Boucle de liens entre : ' + cyc.map(t => t.name).join(', '));
    for (const t of cyc) { for (const l of preds.get(t.id)) succs.set(l.p, succs.get(l.p).filter(x => x !== l)); preds.set(t.id, []); order.push(t.id); }
  }
  const durOf = t => t.ms ? 0 : Math.max(0, Math.round(+t.dur || 0));
  /* passe avant */
  for (const id of order) {
    const t = byId.get(id); let dur = durOf(t), es = 0, fixed = false;
    if (t.snet) es = Math.max(es, cal.idx(dnOfIso(t.snet)));
    for (const l of preds.get(id)) {
      const p = R.get(l.p); if (!p) continue;
      const v = l.type === 'FS' ? p.ef + l.lag : l.type === 'SS' ? p.es + l.lag : l.type === 'FF' ? p.ef + l.lag - dur : p.es + l.lag - dur;
      if (v > es) es = v;
    }
    es += t.lvl || 0;
    if (t.aStart && dnOfIso(t.aStart) != null) { es = cal.idx(dnOfIso(t.aStart)); fixed = true; }
    let ef = es + dur;
    if (t.aEnd && dnOfIso(t.aEnd) != null) { const e = cal.idx(dnOfIso(t.aEnd)) + (t.ms ? 0 : 1); if (e >= es) { ef = e; dur = ef - es; } }
    R.set(id, {es, ef, dur, fixed});
  }
  let pEnd = 0; for (const r of R.values()) pEnd = Math.max(pEnd, r.ef);
  /* passe arrière */
  for (let i = order.length - 1; i >= 0; i--) {
    const id = order[i], r = R.get(id); let lf = pEnd;
    for (const l of succs.get(id)) {
      const s = R.get(l.s); if (!s) continue;
      const v = l.type === 'FS' ? s.ls - l.lag : l.type === 'SS' ? s.ls - l.lag + r.dur : l.type === 'FF' ? s.lf - l.lag : s.lf - l.lag + r.dur;
      if (v < lf) lf = v;
    }
    r.lf = lf; r.ls = lf - r.dur; r.tf = r.ls - r.es;
  }
  for (const t of leaves) {
    const r = R.get(t.id), done = (+t.pct || 0) >= 100 || !!t.aEnd;
    r.crit = r.tf <= 0; r.done = done;
    r.late = !done && ((sIdx > r.es && !t.aStart && !t.ms) || (sIdx >= r.ef && r.dur > 0) || (t.ms && sIdx > r.es));
    /* jalon (durée 0) : affiché en fin du jour ouvré précédent, comme MS Project ; mx = position sur l'échelle (jour + 1) */
    if (r.dur === 0 && r.es > 0) { r.start = r.finish = cal.dnOf(r.es - 1); r.mx = r.start + 1; }
    else { r.start = cal.dnOf(r.es); r.finish = r.dur > 0 ? cal.dnOf(r.ef - 1) : r.start; r.mx = r.start; }
  }
  /* tâches récapitulatives (lots) */
  for (let i = ol.length - 1; i >= 0; i--) {
    const o = ol[i]; if (!o.sum) continue;
    const ch = plan.tasks.filter(t => t.parent === o.t.id).map(t => R.get(t.id)).filter(Boolean);
    if (!ch.length) { R.set(o.t.id, {es:0, ef:0, dur:0, tf:0, sum:true, start:cal.start, finish:cal.start}); continue; }
    const es = Math.min(...ch.map(c => c.es)), ef = Math.max(...ch.map(c => c.ef));
    R.set(o.t.id, {es, ef, dur:ef - es, tf:Math.min(...ch.map(c => c.tf)), sum:true, crit:false, late:ch.some(c => c.late), done:ch.every(c => c.done),
      start:cal.dnOf(es), finish:ef > es ? cal.dnOf(ef - 1) : cal.dnOf(es)});
  }
  const links = []; for (const ls of preds.values()) links.push(...ls);
  return {R, ol, cal, pEnd, end:pEnd > 0 ? cal.dnOf(pEnd - 1) : cal.start, links, errs, sIdx, statusDn:st, sumIds};
}

/* ---------- Coûts ---------- */
const round05 = v => Math.round(v * 20) / 20;
function asgCost(plan, a, dur){
  const r = plan.res.find(x => x.id === a.r); if (!r) return 0;
  const q = +a.q || 0, rate = +r.rate || 0;
  if (r.type === 'team') return q * dur * (+plan.opts.hpd || 8.5) * rate;
  if (r.type === 'machine') return q * dur * rate;
  return q * rate;
}
/* budget d'une tâche ; avec cal + R (calcul de la tâche), chaque ressource ne compte que sur sa période de présence */
function taskBudget(plan, t, dur, cal, R){
  const m = plan.opts.budget, res = t.asg.reduce((s, a) => s + asgCost(plan, a, cal && R ? asgSpan(cal, R, a).dur : dur), 0), man = +t.bud || 0;
  return m === 'res' ? res : m === 'man' ? man : res + man;
}
/* période de présence d'une ressource dans une tâche (t.asg) ou un lot (t.lres, en plus de ses tâches) ; plusieurs lignes pour la même ressource = plusieurs périodes :
   - rien : toute la durée ; - semaines w0..w1 comptées depuis le début (1 = 1re semaine, w1 = 0 : jusqu'à la fin ; suivent la tâche / le lot s'il se décale) ;
   - dates fixes d0..d1 (ISO, d1 vide = jusqu'à la fin). Toujours bornée à la tâche / au lot ; out = une partie des dates saisies est en dehors (non comptée, alerte dans la fiche) */
const perMode = a => a && (a.d0 || a.d1) ? 'd' : a && (+a.w0 > 1 || +a.w1 > 0) ? 'w' : '';
function asgSpan(cal, R, a){
  let es = R.es, ef = R.ef, out = false;
  const m = perMode(a);
  if (m === 'd') {
    const a0 = dnOfIso(a.d0), a1 = dnOfIso(a.d1), last = R.ef > R.es ? cal.dnOf(R.ef - 1) : R.start;
    if (a0 != null) { es = cal.idx(a0); if (a0 < R.start) out = true; }
    if (a1 != null) { ef = cal.idx(a1 + 1); if (a1 > last) out = true; }
    if (a0 != null && (a0 > last || (a1 != null && a1 < R.start))) out = true;
  } else if (m === 'w') {
    const w0 = Math.max(1, Math.round(+a.w0 || 1)), w1 = Math.round(+a.w1 || 0);
    es = cal.idx(R.start + 7 * (w0 - 1)); if (w1 >= w0) ef = cal.idx(R.start + 7 * w1);
  }
  es = Math.min(Math.max(es, R.es), R.ef); ef = Math.max(es, Math.min(ef, R.ef));
  return {es, ef, dur:ef - es, out};
}
const lotSpan = asgSpan;
const taskSpans = (cal, R, t) => t.asg.filter(a => a && a.r).map(a => Object.assign({a}, asgSpan(cal, R, a)));
function lotSpans(plan, sch, t){
  const R = sch.R.get(t.id); if (!R || !R.sum || !Array.isArray(t.lres) || !t.lres.length) return [];
  return t.lres.filter(a => a && a.r && +a.q > 0).map(a => Object.assign({a}, lotSpan(sch.cal, R, a)));
}
const lotCost = (plan, sch, t) => lotSpans(plan, sch, t).reduce((s, x) => s + asgCost(plan, x.a, x.dur), 0);
const lotBudget = (plan, sch, t) => plan.opts.budget === 'man' ? 0 : lotCost(plan, sch, t);
function actLine(plan, e){
  if (!e.r) return +e.amt || 0;
  const r = plan.res.find(x => x.id === e.r); if (!r) return +e.amt || 0;
  return (+e.q || 0) * (+r.rate || 0);
}
const taskActual = (plan, t, untilDn) => (t.act || []).filter(e => untilDn == null || !e.d || dnOfIso(e.d) <= untilDn).reduce((s, e) => s + actLine(plan, e), 0);
/* valeur acquise à la date d'état (réf. = planning de référence s'il existe, sinon planning actuel) */
function evm(plan, sch){
  const st = sch.statusDn, cal = sch.cal, sIdx = cal.idx(st + 1), base = plan.baseline;
  const rows = [];
  let BAC = 0, PV = 0, EV = 0, AC = 0, CUR = 0;
  for (const o of sch.ol) {
    if (o.sum) continue;
    const t = o.t, r = sch.R.get(t.id);
    const cur = taskBudget(plan, t, r.dur, cal, r);
    const b = base && base.tasks[t.id];
    const bac = b ? b.cost : cur, bes = b ? cal.idx(b.start) : r.es, bdur = b ? b.dur : r.dur;
    const frac = bdur > 0 ? Math.min(1, Math.max(0, (sIdx - bes) / bdur)) : (sIdx > bes ? 1 : 0);
    const pv = bac * frac, ev = bac * Math.min(100, +t.pct || 0) / 100, ac = taskActual(plan, t, st);
    BAC += bac; PV += pv; EV += ev; AC += ac; CUR += cur;
    rows.push({id:t.id, bac, cur, pv, ev, ac});
  }
  /* lots avec ressources propres : avancement = moyenne de leurs tâches pondérée par la durée */
  sch.ol.forEach((o, i) => {
    const t = o.t; if (!o.sum || !((t.lres || []).length || (t.act || []).length)) return;
    const r = sch.R.get(t.id), cur = lotBudget(plan, sch, t), b = base && base.lots && base.lots[t.id];
    let wd = 0, wp = 0; for (let j = i + 1; j < sch.ol.length && sch.ol[j].lvl > o.lvl; j++) if (!sch.ol[j].sum) { const d = Math.max(1, sch.R.get(sch.ol[j].t.id).dur); wd += d; wp += d * Math.min(100, +sch.ol[j].t.pct || 0); }
    const pct = wd ? wp / wd : 0, bac = b ? b.cost : cur, bes = b ? cal.idx(b.start) : r.es, bdur = b ? b.dur : r.dur;
    const frac = bdur > 0 ? Math.min(1, Math.max(0, (sIdx - bes) / bdur)) : (sIdx > bes ? 1 : 0);
    const pv = bac * frac, ev = bac * pct / 100, ac = taskActual(plan, t, st);
    BAC += bac; PV += pv; EV += ev; AC += ac; CUR += cur;
    rows.push({id:t.id, bac, cur, pv, ev, ac, pct, lot:true});
  });
  const SPI = PV > 0 ? EV / PV : null, CPI = AC > 0 ? EV / AC : null, EAC = CPI ? BAC / CPI : AC + (BAC - EV);
  return {rows, BAC, PV, EV, AC, CUR, SV:EV - PV, CV:EV - AC, SPI, CPI, EAC, VAC:BAC - EAC};
}
function takeBaseline(plan, sch){
  const tasks = {};
  for (const o of sch.ol) { if (o.sum) continue; const r = sch.R.get(o.t.id); tasks[o.t.id] = {start:r.start, finish:r.finish, mx:r.mx, dur:r.dur, cost:taskBudget(plan, o.t, r.dur, sch.cal, r)}; }
  const lots = {}; for (const o of sch.ol) if (o.sum && (o.t.lres || []).length) { const r = sch.R.get(o.t.id); lots[o.t.id] = {start:r.start, dur:r.dur, cost:lotBudget(plan, sch, o.t)}; }
  return {at:new Date().toISOString(), end:sch.end, tasks, lots};
}

/* ---------- Ressources : charge journalière et lissage ---------- */
function loads(plan, sch){
  const L = new Map();
  for (const r of plan.res) if (RTYPES[r.type] && RTYPES[r.type].time) L.set(r.id, new Map());
  for (const o of sch.ol) {
    if (o.sum) continue;
    const t = o.t, s = sch.R.get(t.id); if (!s || s.dur <= 0 || s.done) continue;
    for (const x of taskSpans(sch.cal, s, t)) { const m = L.get(x.a.r); if (!m) continue; for (let i = x.es; i < x.ef; i++) m.set(i, (m.get(i) || 0) + (+x.a.q || 0)); }
  }
  addLotLoads(plan, sch, L);
  return L;
}
function addLotLoads(plan, sch, L){
  for (const o of sch.ol) { if (!o.sum) continue; const s = sch.R.get(o.t.id); if (!s || s.done) continue;
    for (const x of lotSpans(plan, sch, o.t)) { const m = L.get(x.a.r); if (!m) continue; for (let i = x.es; i < x.ef; i++) m.set(i, (m.get(i) || 0) + (+x.a.q || 0)); } }
}
function overloads(plan, sch, L){
  L = L || loads(plan, sch); const out = [];
  for (const r of plan.res) { const m = L.get(r.id); if (!m) continue; const cap = +r.cap || 0; if (cap <= 0) continue;
    for (const [i, v] of m) if (v > cap + 1e-9) out.push({r:r.id, i, v, cap}); }
  return out.sort((a, b) => a.i - b.i);
}
/* Proposition de lissage (ordonnancement en série) : les tâches sont placées dans l'ordre des liens, les critiques d'abord ;
   une tâche non commencée est repoussée au premier jour où ses ressources tiennent dans la capacité. Le décalage est gardé dans t.lvl. */
function levelProposal(plan, statusDn){
  const work = JSON.parse(JSON.stringify(plan)); normPlan(work);
  for (const t of work.tasks) t.lvl = 0;
  const cal = makeCal(work), sch0 = schedule(work, cal, statusDn), byId = new Map(work.tasks.map(t => [t.id, t]));
  const cap = new Map(work.res.filter(r => RTYPES[r.type] && RTYPES[r.type].time && +r.cap > 0).map(r => [r.id, +r.cap]));
  const prof = new Map([...cap.keys()].map(k => [k, new Map()]));
  addLotLoads(work, sch0, prof);
  const leaves = sch0.ol.filter(o => !o.sum).map(o => o.t), ids = new Set(leaves.map(t => t.id));
  const preds = new Map(leaves.map(t => [t.id, t.deps.filter(d => ids.has(d.id) && d.id !== t.id)]));
  const done = new Map(), left = new Set(leaves.map(t => t.id));
  /* demande de la tâche : périodes de présence en décalage depuis son début (une période en dates fixes suit la tâche pendant le lissage) */
  const demand = t => { const R = sch0.R.get(t.id); return taskSpans(cal, R, t).filter(x => cap.has(x.a.r) && x.dur > 0).map(x => ({r:x.a.r, q:+x.a.q || 0, o0:x.es - R.es, o1:x.ef - R.es})); };
  const fits = (dm, es) => { for (const d of dm) { const c = cap.get(d.r), p = prof.get(d.r); if (d.q > c + 1e-9) continue; for (let i = es + d.o0; i < es + d.o1; i++) if ((p.get(i) || 0) + d.q > c + 1e-9) return false; } return true; };
  let guard = 0;
  while (left.size && guard++ < 5000) {
    let ready = [...left].filter(id => preds.get(id).every(d => done.has(d.id) || !left.has(d.id)));
    if (!ready.length) ready = [...left];
    ready.sort((a, b) => (sch0.R.get(a).tf - sch0.R.get(b).tf) || (sch0.R.get(a).es - sch0.R.get(b).es));
    const id = ready[0], t = byId.get(id), r0 = sch0.R.get(id), dur = r0.dur;
    let base = 0;
    if (t.snet) base = Math.max(base, cal.idx(dnOfIso(t.snet)));
    for (const d of preds.get(id)) { const p = done.get(d.id); if (!p) continue; const lag = Math.round(+d.lag || 0), ty = LINK[d.type] ? d.type : 'FS';
      const v = ty === 'FS' ? p.ef + lag : ty === 'SS' ? p.es + lag : ty === 'FF' ? p.ef + lag - dur : p.es + lag - dur; if (v > base) base = v; }
    let es = base;
    const dm = demand(t), movable = !t.aStart && !(+t.pct > 0) && !t.ms && !r0.done && dur > 0 && dm.length;
    if (r0.fixed) es = r0.es;
    else if (movable) { let k = 0; while (!fits(dm, es) && k++ < 1500) es++; if (k > 1500) es = base; t.lvl = es - base; }
    if (!r0.done) for (const d of dm) { const p = prof.get(d.r); for (let i = es + d.o0; i < es + d.o1; i++) p.set(i, (p.get(i) || 0) + d.q); }
    done.set(id, {es, ef:es + dur}); left.delete(id);
  }
  const sch = schedule(work, cal, statusDn), moves = [];
  for (const t of work.tasks) { const old = plan.tasks.find(x => x.id === t.id); if (old && (t.lvl || 0) !== (old.lvl || 0)) { const r = sch.R.get(t.id); moves.push({id:t.id, name:t.name, from:old.lvl || 0, to:t.lvl, start:r.start, finish:r.finish, tf:r.tf}); } }
  const before = schedule(plan, cal, statusDn);
  return {moves, endBefore:before.end, endAfter:sch.end, left:overloads(work, sch).length, delay:cal.idx(sch.end) - cal.idx(before.end)};
}

/* ---------- Analyse des ressources : effectif main-d'œuvre, machines et montants par jour / semaine / mois ----------
   o = {per:'d'|'w'|'m', by:'zone'|'lot'|'res'|'type'} → {pers:[{k, a, b, nd}], groups:[{k, l, c?}], S:{plan, base, real}} ;
   S[src] = {team:{groupe:[personnes-jours par période]}, machine:{…unités-jours}, chf:{…CHF}} ; effectif = jours ÷ nd (moyenne des jours ouvrés de la période).
   Prévu = ressources des tâches + des lots (+ montants saisis selon la source du budget) ; référence = mêmes ressources aux dates de la référence, CHF ramenés au budget de référence ;
   réel = saisies du réalisé (heures ÷ h/jour, jours machine, montants) à leur date. */
function resAnalysis(plan, sch, o){
  const cal = sch.cal, hpd = +plan.opts.hpd || 8.5, byId = new Map(plan.tasks.map(t => [t.id, t])), resOf = id => plan.res.find(r => r.id === id);
  const kRes = plan.opts.budget === 'man' ? 0 : 1, kMan = plan.opts.budget === 'res' ? 0 : 1;
  const top = t => { let x = t, g = 0; while (x.parent && byId.get(x.parent) && g++ < 30) x = byId.get(x.parent); return x; };
  const zone = t => { let x = t, g = 0; while (x && g++ < 30) { if (x.zone) return x.zone; x = x.parent ? byId.get(x.parent) : null; } return ''; };
  const G = new Map();
  const grp = (t, r) => {
    let g;
    if (o.by === 'res') g = r ? {k:'r:' + r.id, l:r.name, c:r.color, o:plan.res.indexOf(r)} : {k:'~', l:'Montants sans ressource', o:1e6};
    else if (o.by === 'type') g = r ? {k:'t:' + r.type, l:(RTYPES[r.type] || RTYPES.team).label, o:Object.keys(RTYPES).indexOf(r.type)} : {k:'~', l:'Montants sans ressource', o:1e6};
    else if (o.by === 'zone') { const z = zone(t); g = {k:'z:' + z, l:z || 'Sans zone', z:z}; }
    else { const x = top(t); g = x === t && !sch.sumIds.has(t.id) ? {k:'l:', l:'Hors lot', o:1e6} : {k:'l:' + x.id, l:x.name, c:x.col, o:plan.tasks.indexOf(x)}; }
    if (!G.has(g.k)) G.set(g.k, g);
    return g.k;
  };
  const pts = {plan:[], base:[], real:[]};   /* [jour ouvré, groupe, type, quantité par jour, CHF] */
  const spread = (src, k, ty, es, dur, qd, chf) => { const n = Math.max(1, dur); for (let i = es; i < es + n; i++) pts[src].push([i, k, ty, dur > 0 ? qd : 0, chf / n]); };
  const leafPts = (src, t, es, dur) => {
    const Rl = {es, ef:es + dur, start:cal.dnOf(es)};
    for (const a of t.asg) { const r = resOf(a.r); if (!r) continue; const sp = asgSpan(cal, Rl, a); spread(src, grp(t, r), r.type, sp.es, sp.dur, RTYPES[r.type] && RTYPES[r.type].time ? +a.q || 0 : 0, asgCost(plan, a, sp.dur) * kRes); }
    if (kMan && +t.bud) spread(src, grp(t, null), 'man', es, dur, 0, +t.bud);
  };
  const lotPts = (src, t, R) => {
    for (const a of t.lres || []) { if (!a || !a.r || !(+a.q > 0)) continue; const r = resOf(a.r); if (!r) continue; const sp = lotSpan(cal, R, a);
      spread(src, grp(t, r), r.type, sp.es, sp.dur, RTYPES[r.type] && RTYPES[r.type].time ? +a.q : 0, asgCost(plan, a, sp.dur) * kRes); }
  };
  const B = plan.baseline;
  for (const ol of sch.ol) {
    const t = ol.t, R = sch.R.get(t.id); if (!R) continue;
    if (!ol.sum) leafPts('plan', t, R.es, R.dur); else lotPts('plan', t, R);
    const b = B && (ol.sum ? B.lots && B.lots[t.id] : B.tasks && B.tasks[t.id]);
    if (b) {
      const st0 = pts.base.length, es = cal.idx(b.start), dur = Math.max(0, Math.round(+b.dur || 0)), bc = +b.cost || 0;
      if (!ol.sum) leafPts('base', t, es, dur); else lotPts('base', t, {es, ef:es + dur, start:b.start});
      let sum = 0; for (let j = st0; j < pts.base.length; j++) sum += pts.base[j][4];
      if (sum > 0) for (let j = st0; j < pts.base.length; j++) pts.base[j][4] *= bc / sum;
      else if (bc > 0) spread('base', grp(t, null), 'man', es, dur, 0, bc);
    }
    for (const e of t.act || []) {
      const d = dnOfIso(e.d); if (d == null) continue;
      const r = e.r ? resOf(e.r) : null, qd = !r ? 0 : r.type === 'team' ? (+e.q || 0) / hpd : r.type === 'machine' ? +e.q || 0 : 0;
      pts.real.push([cal.idx(d), grp(t, r), r ? r.type : 'man', qd, actLine(plan, e)]);
    }
  }
  const groups = [...G.values()].sort((a, b) => o.by === 'zone' ? (!a.z) - (!b.z) || a.l.localeCompare(b.l, 'fr', {numeric:true}) : (a.o ?? 0) - (b.o ?? 0));
  let i0 = Infinity, i1 = -Infinity;
  for (const src in pts) for (const q of pts[src]) { if (q[0] < i0) i0 = q[0]; if (q[0] > i1) i1 = q[0]; }
  if (!isFinite(i0)) return {pers:[], groups, S:null};
  /* périodes entières de la 1re à la dernière ; nd = jours ouvrés de la période */
  const per = o.per || 'w', keyOf = dn => { if (per === 'd') return dn; if (per === 'w') return dn - (wdOf(dn) + 6) % 7; const d = new Date(dn * DAY); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / DAY; };
  const lastK = keyOf(cal.dnOf(i1)), endDn = per === 'd' ? lastK : per === 'w' ? lastK + 6 : (() => { const d = new Date(lastK * DAY); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0) / DAY; })();
  const pers = [], pIdx = new Map(), iIdx = new Map();
  for (let i = cal.idx(keyOf(cal.dnOf(i0))), g = 0; g < 40000; i++, g++) {
    const dn = cal.dnOf(i); if (dn > endDn) break;
    const k = keyOf(dn); let pi = pIdx.get(k);
    if (pi == null) { pi = pers.length; pIdx.set(k, pi); pers.push({k, a:dn, b:dn, nd:0}); }
    pers[pi].b = dn; pers[pi].nd++; iIdx.set(i, pi);
  }
  const S = {};
  for (const src in pts) {
    const out = {team:{}, machine:{}, chf:{}};
    for (const [i, k, ty, qd, chf] of pts[src]) {
      const pi = iIdx.get(i); if (pi == null) continue;
      const put = (m, v) => { if (v) (m[k] = m[k] || new Array(pers.length).fill(0))[pi] += v; };
      if (ty === 'team') put(out.team, qd); else if (ty === 'machine') put(out.machine, qd);
      put(out.chf, chf);
    }
    S[src] = out;
  }
  return {pers, groups, S, hpd};
}

/* ---------- MS Project (XML MSPDI) ---------- */
const MSP_TYPE = {FF:0, FS:1, SF:2, SS:3}, MSP_BACK = ['FF', 'FS', 'SF', 'SS'];
const xesc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'}[c]));
function toMSPDI(plan, sch){
  const ol = sch.ol, uidOf = new Map(ol.map((o, i) => [o.t.id, i + 1])), resUid = new Map(plan.res.map((r, i) => [r.id, i + 1]));
  const hrs = d => `PT${d * 8}H0M0S`, dt = (dn, end) => isoOfDn(dn) + (end ? 'T17:00:00' : 'T08:00:00');
  const y0 = new Date(sch.cal.start * DAY).getUTCFullYear();
  const offDays = [...sch.cal.off.keys()].filter(d => d >= sch.cal.start - 7 && d <= sch.cal.dnOf(sch.pEnd + 260)).sort((a, b) => a - b);
  const wd = [1, 2, 3, 4, 5, 6, 7].map(n => {
    const working = n >= 2 && n <= 6 || (n === 7 && plan.opts.sat);
    return `<WeekDay><DayType>${n}</DayType><DayWorking>${working ? 1 : 0}</DayWorking>${working ? '<WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>12:00:00</ToTime></WorkingTime><WorkingTime><FromTime>13:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes>' : ''}</WeekDay>`;
  }).join('') + offDays.map(d => `<WeekDay><DayType>0</DayType><DayWorking>0</DayWorking><TimePeriod><FromDate>${isoOfDn(d)}T00:00:00</FromDate><ToDate>${isoOfDn(d)}T23:59:00</ToDate></TimePeriod></WeekDay>`).join('');
  const tasks = ol.map((o, i) => {
    const t = o.t, r = sch.R.get(t.id), u = i + 1, ms = !!t.ms && !o.sum;
    const links = o.sum ? '' : t.deps.filter(d => uidOf.has(d.id)).map(d => `<PredecessorLink><PredecessorUID>${uidOf.get(d.id)}</PredecessorUID><Type>${MSP_TYPE[d.type] ?? 1}</Type><CrossProject>0</CrossProject><LinkLag>${Math.round(+d.lag || 0) * 4800}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`).join('');
    return `<Task><UID>${u}</UID><ID>${u}</ID><Name>${xesc(t.name)}</Name><Type>1</Type><IsNull>0</IsNull><WBS>${o.wbs}</WBS><OutlineNumber>${o.wbs}</OutlineNumber><OutlineLevel>${o.lvl + 1}</OutlineLevel>`
      + `<Start>${dt(r.start, ms)}</Start><Finish>${dt(r.finish, !ms)}</Finish><Duration>${hrs(r.dur)}</Duration><DurationFormat>7</DurationFormat>`
      + `<Milestone>${ms ? 1 : 0}</Milestone><Summary>${o.sum ? 1 : 0}</Summary><Critical>${r.crit ? 1 : 0}</Critical><TotalSlack>${Math.max(0, r.tf || 0) * 4800}</TotalSlack><PercentComplete>${Math.round(+t.pct || 0)}</PercentComplete>`
      + (t.aStart && !o.sum ? `<ActualStart>${t.aStart}T08:00:00</ActualStart>` : '') + (t.aEnd && !o.sum ? `<ActualFinish>${t.aEnd}T17:00:00</ActualFinish>` : '')
      + (t.snet && !o.sum ? `<ConstraintType>4</ConstraintType><ConstraintDate>${t.snet}T08:00:00</ConstraintDate>` : '<ConstraintType>0</ConstraintType>')
      + (t.lvl && !o.sum ? `<LevelingDelay>${t.lvl * 4800}</LevelingDelay><LevelingDelayFormat>7</LevelingDelayFormat>` : '')
      + (t.note ? `<Notes>${xesc(t.note)}</Notes>` : '') + links + '</Task>';
  }).join('');
  const res = plan.res.map(r => `<Resource><UID>${resUid.get(r.id)}</UID><ID>${resUid.get(r.id)}</ID><Name>${xesc(r.name)}</Name><Type>${RTYPES[r.type] && RTYPES[r.type].time ? 1 : 0}</Type>`
    + (r.type === 'supply' || r.type === 'sub' ? `<MaterialLabel>${xesc(r.unit || '')}</MaterialLabel>` : '')
    + `<MaxUnits>${(+r.cap || 1).toFixed(2)}</MaxUnits><StandardRate>${r.type === 'machine' ? ((+r.rate || 0) / 8).toFixed(2) : (+r.rate || 0).toFixed(2)}</StandardRate><StandardRateFormat>${r.type === 'machine' ? 3 : 2}</StandardRateFormat></Resource>`).join('');
  let au = 0;
  const asg = ol.filter(o => !o.sum).flatMap(o => o.t.asg.filter(a => resUid.has(a.r)).map(a => `<Assignment><UID>${++au}</UID><TaskUID>${uidOf.get(o.t.id)}</TaskUID><ResourceUID>${resUid.get(a.r)}</ResourceUID><Units>${(+a.q || 0).toFixed(2)}</Units></Assignment>`)).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Project xmlns="http://schemas.microsoft.com/project">`
    + `<SaveVersion>14</SaveVersion><Name>${xesc(plan.name)}</Name><Title>${xesc(plan.name)}</Title><ScheduleFromStart>1</ScheduleFromStart>`
    + `<StartDate>${dt(sch.cal.start)}</StartDate><FinishDate>${dt(sch.end, true)}</FinishDate><CurrencyCode>CHF</CurrencyCode><CalendarUID>1</CalendarUID><DefaultStartTime>08:00:00</DefaultStartTime><DefaultFinishTime>17:00:00</DefaultFinishTime>`
    + `<MinutesPerDay>480</MinutesPerDay><MinutesPerWeek>${plan.opts.sat ? 2880 : 2400}</MinutesPerWeek><DaysPerMonth>20</DaysPerMonth><DurationFormat>7</DurationFormat>`
    + `<Calendars><Calendar><UID>1</UID><Name>BauGest ${xesc((plan.hol && plan.hol.canton) || '')} ${y0}</Name><IsBaseCalendar>1</IsBaseCalendar><WeekDays>${wd}</WeekDays></Calendar></Calendars>`
    + `<Tasks>${tasks}</Tasks><Resources>${res}</Resources><Assignments>${asg}</Assignments></Project>`;
}
function fromMSPDI(xml, siteId){
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('fichier XML illisible');
  const kid = (el, n) => { for (const c of el.children) if (c.localName === n) return c; return null; };
  const val = (el, n) => { const c = kid(el, n); return c ? c.textContent.trim() : ''; };
  const all = (el, n) => [...el.getElementsByTagNameNS('*', n)];
  const prj = doc.documentElement; if (!prj || prj.localName !== 'Project') throw new Error('ce n’est pas un fichier MS Project (XML)');
  const mpd = +val(prj, 'MinutesPerDay') || 480;
  const durDays = s => { const m = /PT(\d+(?:\.\d+)?)H(\d+(?:\.\d+)?)M/.exec(s || ''); return m ? Math.round((+m[1] * 60 + +m[2]) / mpd) : 0; };
  const p = newPlan(siteId, val(prj, 'Title') || val(prj, 'Name') || 'Planning importé');
  const sd = val(prj, 'StartDate'); if (sd) p.start = sd.slice(0, 10);
  const tEls = all(prj, 'Task').filter(t => val(t, 'IsNull') !== '1' && +val(t, 'OutlineLevel') > 0);
  const byUid = new Map(), stack = [];
  for (const el of tEls) {
    const lvl = +val(el, 'OutlineLevel') || 1, t = {id:uid(), name:val(el, 'Name') || 'Tâche', parent:null, dur:durDays(val(el, 'Duration')), ms:val(el, 'Milestone') === '1',
      deps:[], asg:[], act:[], pct:+val(el, 'PercentComplete') || 0, lvl:0};
    while (stack.length >= lvl) stack.pop();
    t.parent = stack.length ? stack[stack.length - 1].id : null; stack.push(t);
    if (val(el, 'ConstraintType') === '4' && val(el, 'ConstraintDate')) t.snet = val(el, 'ConstraintDate').slice(0, 10);
    if (val(el, 'ActualStart')) t.aStart = val(el, 'ActualStart').slice(0, 10);
    if (val(el, 'ActualFinish')) t.aEnd = val(el, 'ActualFinish').slice(0, 10);
    if (val(el, 'Notes')) t.note = val(el, 'Notes');
    if (+val(el, 'LevelingDelay') > 0) t.lvl = Math.round(+val(el, 'LevelingDelay') / (mpd * 10));
    if (val(el, 'Summary') === '1') t.lot = true;
    byUid.set(val(el, 'UID'), {t, el}); p.tasks.push(t);
  }
  for (const {t, el} of byUid.values()) for (const l of [...el.children].filter(c => c.localName === 'PredecessorLink')) {
    const pr = byUid.get(val(l, 'PredecessorUID')); if (!pr) continue;
    const lagU = +val(l, 'LinkLag') || 0, fmt = val(l, 'LagFormat');
    t.deps.push({id:pr.t.id, type:MSP_BACK[+val(l, 'Type')] || 'FS', lag:fmt === '19' || fmt === '20' ? 0 : Math.round(lagU / (mpd * 10))});
  }
  const rMap = new Map();
  for (const el of all(prj, 'Resource')) {
    const name = val(el, 'Name'); if (!name) continue;
    const work = val(el, 'Type') !== '0', r = {id:uid(), name, type:work ? 'team' : 'supply', unit:work ? 'pers.' : (val(el, 'MaterialLabel') || 'u.'), rate:+val(el, 'StandardRate') || 0, cap:+val(el, 'MaxUnits') || 1, color:''};
    r.color = resColor(p);
    rMap.set(val(el, 'UID'), r); p.res.push(r);
  }
  for (const el of all(prj, 'Assignment')) {
    const tk = byUid.get(val(el, 'TaskUID')), r = rMap.get(val(el, 'ResourceUID')); if (!tk || !r) continue;
    if (tk.t.lot) (tk.t.lres = tk.t.lres || []).push({r:r.id, q:+val(el, 'Units') || 1, w0:1, w1:0}); else tk.t.asg.push({r:r.id, q:+val(el, 'Units') || 1});
  }
  const depth = Math.max(0, ...outline(p).map(o => o.lvl));
  p.opts.structure = depth === 0 ? 'flat' : depth === 1 ? 'lots' : 'tree';
  p.opts.budget = 'res';
  return normPlan(p);
}

const CORE = {dnOfIso, isoOfDn, chOfDn, shortOfDn, todayDn, easter, HOL, HOL_ORDER, CANTONS, cantonKeys, holidayList, makeCal, newPlan, normPlan, outline, schedule,
  resColor, asgCost, taskBudget, asgSpan, taskSpans, perMode, lotSpan, lotSpans, lotCost, lotBudget, taskActual, actLine, evm, takeBaseline, loads, overloads, levelProposal, resAnalysis, toMSPDI, fromMSPDI, RTYPES, LINK, uid, maxDepth, round05};
if (typeof module !== 'undefined' && module.exports) { module.exports = CORE; return; }

/* ---------- Interface ---------- */
let H = null;
const U = {siteId:null, recs:[], rec:null, plan:null, cal:null, sch:null, tab:'gantt', zoom:'week', sel:null, undo:[], redo:[], saveT:0, pushT:0,
  resSel:null, statusDn:null, full:null, openTok:0, showBase:true, tap:{id:null, t:0}, msel:new Set(), selMode:false, drag:null, dlgs:[], listTok:0, pushing:null};
const PDFLIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const DRV = 'https://www.googleapis.com/drive/v3/files', UPL = 'https://www.googleapis.com/upload/drive/v3/files';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const qEsc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const cleanName = s => String(s || '').normalize('NFC').replace(/[\/\\:*?"<>|#%]+/g, '').trim() || 'Planning';
const fmtN = (v, d = 0) => v == null || !isFinite(v) ? '–' : (+v).toLocaleString('de-CH', {minimumFractionDigits:d, maximumFractionDigits:d});
const fmtR = v => v == null || !isFinite(v) ? '–' : (+v).toFixed(2);
const $b = s => document.querySelector('#bgPlan ' + s);
const $$b = s => [...document.querySelectorAll('#bgPlan ' + s)];
const ic = p => `<svg class="bp-ic" viewBox="0 0 24 24">${p}</svg>`;
const I = {
  x:ic('<path d="M18 6 6 18M6 6l12 12"/>'), plus:ic('<path d="M12 5v14M5 12h14"/>'), dia:ic('<path d="M12 3l9 9-9 9-9-9z"/>'),
  lot:ic('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  ind:ic('<path d="M4 6h16M10 12h10M10 18h10M3 10l4 2-4 2"/>'), out:ic('<path d="M4 6h16M10 12h10M10 18h10M7 10l-4 2 4 2"/>'),
  up:ic('<path d="M12 19V5M5 12l7-7 7 7"/>'), dn:ic('<path d="M12 5v14M19 12l-7 7-7-7"/>'),
  link:ic('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  del:ic('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>'), edit:ic('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  undo:ic('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'), redo:ic('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
  chk:ic('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/>'),
  copy:ic('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'),
  paste:ic('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11h6M9 15h4"/>'), pal:ic('<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.9 1.5-1.7 0-1.3-1-1.6-1-2.8 0-1 .8-1.5 1.8-1.5H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>'),
  base:ic('<path d="M4 20h16M6 16h12M8 12h8M10 8h4"/>'), lvl:ic('<path d="M3 20h18M6 16V9M10 16V5M14 16v-6M18 16v-3"/>'),
  exp:ic('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'), print:ic('<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>'), today:ic('<path d="M12 2v20M5 7h14"/>'), cal:ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  imp:ic('<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/>'), split:ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>'),
  win:ic('<path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'), tbl:ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>'), money:ic('<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')
};
const COLORS = ['#3e8ed0', '#e8a33d', '#4caf7a', '#9b6fd6', '#d65f8f', '#3fb0b0', '#c97a46', '#7d8a2e'];

function css(){ return `
#bgPlan{position:fixed;inset:0;z-index:70;display:flex;flex-direction:column;background:var(--asphalt,var(--bg,#131518));color:var(--text,#ecebe6);font:15px/1.35 var(--body,system-ui,sans-serif);-webkit-user-select:none;user-select:none}
#bgPlan[hidden]{display:none}
.bp-scrim [hidden],#bgPlan [hidden]{display:none!important}
#bgPlan.bp-split{right:auto;width:var(--bp-w,55%);border-right:2px solid var(--line,#353a41)}
.bp-splitter{display:none;position:absolute;top:0;bottom:0;right:-6px;width:10px;cursor:col-resize;z-index:5}
#bgPlan.bp-split .bp-splitter{display:block}
.bp-splitter:hover,.bp-splitter.on{background:var(--signal,#f2c230);opacity:.5}
:is(#bgPlan,.bp-scrim) *{box-sizing:border-box}
:is(#bgPlan,.bp-scrim) .bp-ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}
:where(#bgPlan,.bp-scrim) button{font:inherit;color:inherit;cursor:pointer}
#bgPlan input,#bgPlan select,#bgPlan textarea,.bp-scrim input,.bp-scrim select,.bp-scrim textarea{font:inherit;color:var(--text,#ecebe6);background:var(--surface2,#262a30);border:1px solid var(--line,#353a41);border-radius:8px;height:38px;padding:0 9px;min-width:0;-webkit-user-select:text;user-select:text}
#bgPlan textarea,.bp-scrim textarea{height:auto;padding:8px 9px;resize:vertical}
#bgPlan input[type=checkbox],#bgPlan input[type=radio],.bp-scrim input[type=checkbox],.bp-scrim input[type=radio]{width:20px;height:20px;accent-color:var(--signal,#f2c230)}
#bgPlan input[type=range],.bp-scrim input[type=range]{height:30px;padding:0;background:none;border:0}
.bp-top{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface,#1c1f23);border-bottom:1px solid var(--line,#353a41);flex-wrap:wrap}
.bp-ttl{display:flex;flex-direction:column;line-height:1.1;margin-right:4px}
.bp-ttl b{font:700 20px var(--display,sans-serif);text-transform:uppercase;letter-spacing:.04em}
.bp-ttl b i{font-style:normal;color:var(--signal,#f2c230)}
.bp-btn,.bp-ib{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:40px;min-width:40px;padding:0 12px;border-radius:9px;border:1px solid var(--line,#353a41);background:var(--surface2,#262a30);white-space:nowrap}
.bp-ib{padding:0}
.bp-btn.pri{background:var(--signal,#f2c230);color:var(--signal-ink,#1b1600);border-color:var(--signal,#f2c230);font-weight:700}
.bp-btn.dang{color:#ff8a8a;border-color:#7a3434}
.bp-btn:disabled,.bp-ib:disabled{opacity:.4;cursor:default}
.bp-btn.on,.bp-ib.on{background:var(--signal-soft,#3b3219);border-color:var(--signal,#f2c230)}
.bp-tabs{display:flex;gap:3px;padding:3px;border-radius:10px;background:var(--surface2,#262a30)}
.bp-tabs button{height:34px;padding:0 13px;border:0;border-radius:7px;background:none;color:var(--muted,#9da2a8);font:700 14px var(--display,sans-serif);text-transform:uppercase;letter-spacing:.05em}
.bp-tabs button.on{background:var(--signal,#f2c230);color:var(--signal-ink,#1b1600)}
.bp-grow{flex:1}
.bp-state{font-size:12.5px;color:var(--muted,#9da2a8);max-width:220px;text-align:right}
.bp-state.err{color:#ff8a8a}
.bp-info{padding:7px 12px;background:var(--signal-soft,#3b3219);font-size:14px}
.bp-info.err{background:#4a2020;color:#ffd6d6}
#bpMain{flex:1;min-height:0;display:flex;flex-direction:column}
.bp-bar{display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--line,#353a41);flex-wrap:wrap}
.bp-sep{width:1px;height:28px;background:var(--line,#353a41);margin:0 3px}
.bp-seg{display:inline-flex;border:1px solid var(--line,#353a41);border-radius:9px;overflow:hidden}
.bp-seg button{height:38px;padding:0 11px;border:0;background:var(--surface2,#262a30)}
.bp-seg button.on{background:var(--signal,#f2c230);color:var(--signal-ink,#1b1600);font-weight:700}
.bp-sum{font-size:13.5px;color:var(--muted,#9da2a8);margin-left:auto}
.bp-sum b{color:var(--text,#ecebe6)}
.bp-gwrap{flex:1;min-height:0;overflow:auto;position:relative;-webkit-overflow-scrolling:touch}
/* lignes en flex (pas de grille) : un élément collant d'une grille reste prisonnier de sa case → le tableau des tâches partait avec le défilement horizontal */
.bp-grid{position:relative}
.bp-hrow{display:flex;position:sticky;top:0;z-index:4}
.bp-brow{display:flex}
.bp-c00{flex:none;position:sticky;left:0;z-index:2;background:var(--surface,#1c1f23);border-bottom:1px solid var(--line,#353a41);border-right:2px solid var(--line,#353a41);display:flex;align-items:flex-end}
.bp-c01{flex:none;background:var(--surface,#1c1f23);border-bottom:1px solid var(--line,#353a41)}
.bp-c10{flex:none;position:sticky;left:0;z-index:2;background:var(--asphalt,var(--bg,#131518));border-right:2px solid var(--line,#353a41)}
.bp-hc,.bp-cell{padding:0 6px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;flex:none}
.bp-hc{font:700 12px var(--body,sans-serif);text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#9da2a8);padding-bottom:6px}
.bp-row{display:flex;align-items:center;border-bottom:1px solid rgba(128,128,128,.14);cursor:default}
.bp-row.sel{background:var(--signal-soft,#3b3219)}
.bp-row.sum .bp-cell{font-weight:700}
.bp-row .num{text-align:right;font-family:var(--mono,monospace);font-size:.92em}
.bp-row .wbs{font-family:var(--mono,monospace);font-size:12px;color:var(--muted,#9da2a8)}
.bp-row.late .nm::after{content:" ⚠";color:#ff9f43}
.bp-row.crit .tf{color:#ff7b7b;font-weight:700}
.bp-tw{display:inline-block;width:14px;color:var(--muted,#9da2a8)}
.bp-add{display:flex;align-items:center;gap:6px;color:var(--muted,#9da2a8);padding:0 10px;border:0;background:none;width:100%}
.bp-chart{display:block}
.bp-chart text{font:var(--bp-cfs,12px) var(--body,sans-serif);fill:var(--text,#ecebe6)}
.bp-chart text.sm{font-size:calc(var(--bp-cfs,12px) - 1px)}.bp-chart text.bd{font-weight:700}
.bp-ck{display:inline-block;width:18px;height:18px;margin-right:6px;border:2px solid var(--muted,#9da2a8);border-radius:4px;vertical-align:-3px;flex:none}.bp-row.msel .bp-ck{background:var(--signal,#f2c230);border-color:var(--signal,#f2c230);box-shadow:inset 0 0 0 2px var(--surface,#1c1f23)}
.bp-row.msel{background:var(--signal-soft,#3b3219)}
.bp-msn{font-size:13.5px;font-weight:600;white-space:nowrap}
.bp-chart .mut{fill:var(--muted,#9da2a8)}
.bp-chart .bar{cursor:grab;touch-action:pan-y}
.bp-chart .bar .rs,.bp-chart .bar .lk{touch-action:none}
.bp-swl{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.bp-swl .bp-btn{height:32px}
.bp-sw{width:32px;height:32px;border-radius:7px;border:2px solid var(--line,#353a41);padding:0;cursor:pointer;position:relative;overflow:hidden}
.bp-sw.on,.bp-swl .bp-btn.on{outline:3px solid var(--signal,#f2c230);outline-offset:1px}
.bp-swc{background:conic-gradient(#e5484d,#f2c230,#4caf7a,#3e8ed0,#9b6fd6,#e5484d)}.bp-swc input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
.bp-chart .bar.sel rect.b,.bp-chart .bar.sel path.b{stroke:var(--signal,#f2c230);stroke-width:2.5}
.bp-chart .rs{cursor:ew-resize;fill:transparent}
.bp-chart .lk{cursor:crosshair;fill:var(--surface,#1c1f23);stroke:var(--signal,#f2c230);stroke-width:2;opacity:0}
.bp-chart .bar:hover .lk,.bp-chart .bar.sel .lk{opacity:1}
.bp-chart .arr{fill:none;stroke:var(--muted,#9da2a8);stroke-width:1.3}
.bp-empty{padding:40px 20px;text-align:center;color:var(--muted,#9da2a8)}
.bp-empty .bp-btn{margin-top:14px}
.bp-pane{flex:1;min-height:0;overflow:auto;padding:12px;-webkit-overflow-scrolling:touch}
.bp-card{background:var(--surface,#1c1f23);border:1px solid var(--line,#353a41);border-radius:12px;padding:12px;margin-bottom:12px}
.bp-card h3{margin:0 0 10px;font:700 16px var(--display,sans-serif);text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:8px}
.bp-card h3 .bp-btn{margin-left:auto}
.bp-tbl{width:100%;border-collapse:collapse;font-size:14px}
.bp-tbl th{text-align:left;font:700 12px var(--body,sans-serif);text-transform:uppercase;letter-spacing:.05em;color:var(--muted,#9da2a8);padding:6px;border-bottom:1px solid var(--line,#353a41);white-space:nowrap}
.bp-tbl td{padding:6px;border-bottom:1px solid rgba(128,128,128,.14);vertical-align:middle}
.bp-tbl td.n,.bp-tbl th.n{text-align:right;font-family:var(--mono,monospace);white-space:nowrap}
.bp-tbl tr.sum td{font-weight:700;background:rgba(128,128,128,.07)}
.bp-tbl tr.tot td{font-weight:700;border-top:2px solid var(--line,#353a41)}
.bp-tbl tr.on td{background:var(--signal-soft,#3b3219)}
.bp-tbl tr[data-r]{cursor:pointer}
.bp-neg{color:#ff7b7b}.bp-pos{color:#6fd39a}
.bp-anctl{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:flex-end}.bp-anctl>div>small{display:block;font-size:12px;color:var(--muted,#9da2a8);margin-bottom:3px}.bp-anout{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
.bp-anwrap{overflow:auto;max-width:100%;padding-bottom:4px}.bp-anhrs{width:auto;min-width:420px}.bp-anhrs td,.bp-anhrs th{padding:4px 10px;white-space:nowrap}.bp-anhrs .n{text-align:right;font-family:var(--mono,monospace)}.bp-anwrap .bp-chart{margin-bottom:6px}
.bp-antbl{table-layout:fixed;font-size:12px}.bp-antbl th,.bp-antbl td{padding:4px 2px;border-left:1px solid rgba(128,128,128,.14)}.bp-antbl th.mo{text-align:center;background:var(--surface2,#262a30)}
.bp-antbl .c{text-align:center;font-family:var(--mono,monospace);white-space:nowrap;overflow:hidden}.bp-antbl .big{font-size:14px;font-weight:700}.bp-antbl tr.cmp td{color:var(--muted,#9da2a8)}
.bp-antbl .lab{position:sticky;left:0;z-index:1;background:var(--surface,#1c1f23);text-align:left;padding-left:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bp-anleg{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:8px;font-size:13px}
.bp-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.bp-kpi{background:var(--surface2,#262a30);border-radius:10px;padding:9px 11px}
.bp-kpi small{display:block;font-size:12px;color:var(--muted,#9da2a8)}
.bp-kpi b{font:700 20px var(--mono,monospace)}
.bp-kpi em{display:block;font-style:normal;font-size:12px;color:var(--muted,#9da2a8)}
.bp-cols{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:12px}
@media (max-width:1000px){.bp-cols{grid-template-columns:1fr}}
.bp-dot{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;margin-right:6px}
.bp-form{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px 14px}
.bp-f{display:flex;flex-direction:column;gap:4px}
.bp-f>span{font-size:12.5px;color:var(--muted,#9da2a8)}
.bp-f.w{grid-column:1/-1}
.bp-chk{display:flex;align-items:center;gap:8px;min-height:34px}
.bp-hols{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:2px 14px}
.bp-hols label{display:flex;align-items:center;gap:8px;min-height:34px}
.bp-hols small{color:var(--muted,#9da2a8);margin-left:auto;font-family:var(--mono,monospace)}
.bp-lst{display:flex;flex-direction:column;gap:6px}
.bp-li{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.bp-li>input,.bp-li>select{flex:1 1 110px}
.bp-li>.n{flex:0 0 86px;text-align:right}
.bp-per{padding:4px 0 6px;border-bottom:1px solid rgba(128,128,128,.15)}.bp-li [data-d].warn{color:#e8a33d;font-weight:600}
.bp-li>.cost{flex:0 0 100px;text-align:right;font-family:var(--mono,monospace);font-size:13px;color:var(--muted,#9da2a8)}
.bp-scrim{font:15px/1.35 var(--body,system-ui,sans-serif);color:var(--text,#ecebe6);position:fixed;inset:0;z-index:75;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px}
.bp-dlg{width:min(720px,100%);max-height:calc(100% - 10px);display:flex;flex-direction:column;background:var(--surface,#1c1f23);color:var(--text,#ecebe6);border:1px solid var(--line,#353a41);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.5)}
.bp-dlg h2{margin:0;padding:13px 16px;font:700 19px var(--display,sans-serif);text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid var(--line,#353a41)}
.bp-db{padding:14px 16px;overflow:auto;display:flex;flex-direction:column;gap:12px}
.bp-db h4{margin:4px 0 0;font:700 13px var(--body,sans-serif);text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#9da2a8)}
.bp-db p{margin:0}
.bp-df{display:flex;gap:8px;justify-content:flex-end;padding:11px 16px;border-top:1px solid var(--line,#353a41);flex-wrap:wrap}
.bp-df .l{margin-right:auto}
.bp-toasts{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:80;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;max-width:90vw}
.bp-toast{background:#111;color:#fff;padding:10px 16px;border-radius:10px;font:14.5px/1.35 var(--body,system-ui,sans-serif);box-shadow:0 6px 20px rgba(0,0,0,.4)}
#bgPlan.bp-n1 .bp-ttl{display:none}#bgPlan.bp-n1 .bp-top [data-a] span{display:none}#bgPlan.bp-n1 .bp-top select{max-width:190px!important}#bgPlan.bp-n1 .bp-state{max-width:130px}
#bgPlan.bp-n2 .bp-state,#bgPlan.bp-n2 .bp-sum{display:none}#bgPlan.bp-n2 .bp-top select{max-width:150px!important}#bgPlan.bp-n2 .bp-bar .bp-btn span{display:none}
.bp-hint{font-size:13px;color:var(--muted,#9da2a8)}
#lyCols td{padding:2px 6px}#lyCols .bp-ib{height:30px;min-width:30px}
.bp-menu{display:grid;gap:8px}
.bp-menu .bp-btn{justify-content:flex-start;height:52px}
.bp-menu .bp-btn small{display:block;color:var(--muted,#9da2a8);font-size:12px;font-weight:400}
.bp-menu .bp-btn span{text-align:left;line-height:1.2}
`; }

/* ---------- petits outils ---------- */
function toast(msg, ms = 3200){
  let box = document.querySelector('.bp-toasts'); if (!box) { box = document.createElement('div'); box.className = 'bp-toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'bp-toast'; t.textContent = msg;
  box.appendChild(t); while (box.children.length > 3) box.firstElementChild.remove(); setTimeout(() => t.remove(), ms);
}
function dlg({title, body = '', buttons = [{label:'OK', value:true, pri:true}], onOpen, width}){
  return new Promise(res => {
    const sc = document.createElement('div'); sc.className = 'bp-scrim';
    sc.innerHTML = `<div class="bp-dlg" role="dialog" aria-label="${esc(title)}" ${width ? `style="width:min(${width}px,100%)"` : ''}><h2>${esc(title)}</h2><div class="bp-db">${body}</div>`
      + `<div class="bp-df">${buttons.map((b, i) => `<button class="bp-btn ${b.pri ? 'pri' : ''} ${b.dang ? 'dang' : ''} ${b.left ? 'l' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    document.body.appendChild(sc);
    const box = sc.firstElementChild;
    const done = v => { const k = U.dlgs.indexOf(entry); if (k >= 0) U.dlgs.splice(k, 1); sc.remove(); res(v); };
    const key = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); }
      else if (e.key === 'Enter' && !/TEXTAREA|BUTTON|SELECT/.test(e.target.tagName)) { const p = buttons.findIndex(b => b.pri); if (p >= 0) { e.preventDefault(); e.stopPropagation(); fire(p); } }
    };
    const fire = i => { const b = buttons[i]; if (b.check && !b.check(box)) return; done(b.value === undefined ? box : b.value); };
    const entry = {close:() => done(null), key}; U.dlgs.push(entry);
    sc.addEventListener('pointerdown', e => { if (e.target === sc) sc.dataset.down = '1'; });
    sc.addEventListener('click', e => { if (e.target === sc && sc.dataset.down) done(null); delete sc.dataset.down; });
    box.querySelectorAll('.bp-df button').forEach(b => b.addEventListener('click', () => fire(+b.dataset.i)));
    if (onOpen) onOpen(box, done);
    const f = box.querySelector('[autofocus]'); if (f) { f.focus(); if (f.select) f.select(); }
  });
}
const confirmDlg = (title, text, label = 'OK', dang) => dlg({title, body:`<p>${text}</p>`, buttons:[{label:'Annuler', value:false}, {label, value:true, pri:!dang, dang}]});
function download(blob, name){
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
const scriptsP = {};
function loadScript(src){
  if (H && H.loadScript) return H.loadScript(src);
  return scriptsP[src] || (scriptsP[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete scriptsP[src]; rej(new Error('bibliothèque non chargée, vérifie le réseau')); }; document.head.appendChild(s); }));
}
function pickFile(accept){
  return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.onchange = () => res(i.files[0] || null); i.click(); });
}

/* ---------- stockage : appareil (IndexedDB) + Google Drive ---------- */
const PDB = (() => {
  let p;
  const open = () => p || (p = new Promise((res, rej) => { const r = indexedDB.open('baugest-planning', 1); r.onupgradeneeded = () => r.result.createObjectStore('plans', {keyPath:'uid'}); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('plans', mode), r = fn(t.objectStore('plans')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
  return {all:() => tx('readonly', s => s.getAll()), put:rec => tx('readwrite', s => s.put(JSON.parse(JSON.stringify(rec)))), del:k => tx('readwrite', s => s.delete(k))};
})();
const site = id => (H.sites() || []).find(s => s.id === id) || null;
const online = () => { try { return !!(H.online && H.online()) && navigator.onLine !== false; } catch (e) { return false; } };
async function listRecs(siteId){
  const tok = ++U.listTok;
  let recs = (await PDB.all().catch(() => [])).filter(r => r.siteId === siteId);
  let info = '';
  if (online()) {
    try {
      const q = `trashed=false and (appProperties has { key='kind' and value='planning' } or appProperties has { key='kind' and value='planningxml' }) and appProperties has { key='site' and value='${qEsc(siteId)}' }`;
      const r = await H.api(DRV + '?' + new URLSearchParams({q, pageSize:'400', fields:'files(id,name,modifiedTime,appProperties)'}));
      const all = (r && r.files) || [], seen = new Set(), xmlOf = new Map();
      for (const f of all) if (f.appProperties.kind === 'planningxml') xmlOf.set(f.appProperties.uid, f.id);
      const files = all.filter(f => f.appProperties.kind === 'planning');
      for (const f of files) {
        const id = (f.appProperties && f.appProperties.uid) || f.id; seen.add(id);
        let rec = recs.find(x => x.uid === id);
        if (!rec) { rec = {uid:id, siteId, name:f.name.replace(/\.json$/i, ''), plan:null, dirty:false, driveId:f.id, driveMod:f.modifiedTime}; recs.push(rec); }
        else { rec.driveId = f.id; if (!rec.dirty && (!rec.driveMod || f.modifiedTime > rec.driveMod)) { rec.stale = true; rec.name = f.name.replace(/\.json$/i, ''); } }
        rec.xmlId = xmlOf.get(id) || null;
      }
      for (const rec of recs.slice()) if (rec.driveId && !seen.has(rec.uid) && !rec.dirty) { recs = recs.filter(x => x !== rec); PDB.del(rec.uid).catch(() => {}); }
    } catch (e) { info = 'Drive illisible (' + e.message + ') · plannings de cet appareil seulement'; }
  } else info = 'Hors ligne ou non connecté à Google · plannings de cet appareil seulement';
  if (tok !== U.listTok) return null;
  recs.sort((a, b) => a.name.localeCompare(b.name, 'fr', {numeric:true}));
  return {recs, info};
}
async function loadRec(rec){
  if (rec.plan && !rec.stale) return rec;
  if (!rec.driveId || !online()) { if (rec.plan) return rec; throw new Error('planning disponible seulement sur le Drive : connecte-toi'); }
  let j = await H.api(`${DRV}/${encodeURIComponent(rec.driveId)}?alt=media`);
  if (j && typeof j.json === 'function') j = await j.json();
  const m = await H.api(`${DRV}/${encodeURIComponent(rec.driveId)}?fields=modifiedTime`);
  rec.plan = normPlan(j); rec.plan.uid = rec.uid; rec.name = rec.plan.name; rec.stale = false; rec.dirty = false; rec.driveMod = m.modifiedTime;
  await PDB.put(rec);
  return rec;
}
function multipart(md, blob){
  const b = 'bp' + Math.random().toString(36).slice(2);
  return {type:'multipart/related; boundary=' + b, body:new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`, JSON.stringify(md), `\r\n--${b}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`, blob, `\r\n--${b}--`])};
}
async function driveUpload(blob, md, id){
  const mp = multipart(md, blob);
  return H.api(`${UPL}${id ? '/' + encodeURIComponent(id) : ''}?uploadType=multipart&fields=id,name,modifiedTime`, {method:id ? 'PATCH' : 'POST', headers:{'Content-Type':mp.type}, body:mp.body});
}
async function pushRec(rec){
  if (!rec || !rec.dirty || !online()) return;
  if (U.pushing) { await U.pushing.catch(() => {}); if (!rec.dirty) return; }
  U.pushing = (async () => {
    const s = site(rec.siteId); if (!s) throw new Error('chantier introuvable');
    const stamp = rec.plan.updatedAt;
    const blob = new Blob([JSON.stringify(rec.plan)], {type:'application/json'});
    const md = {name:cleanName(rec.plan.name) + '.json', mimeType:'application/json', description:'Planning BauGest – ' + s.label,
      appProperties:{pc:'1', site:rec.siteId, kind:'planning', uid:rec.uid}};
    let f = null;
    if (rec.driveId) { try { f = await driveUpload(blob, md, rec.driveId); } catch (e) { if (e.status !== 404) throw e; rec.driveId = null; } }
    if (!f) { const parent = await H.ensureFolder([s.folder, 'Planning']); f = await driveUpload(blob, Object.assign({parents:[parent]}, md)); }
    rec.driveId = f.id; rec.driveMod = f.modifiedTime;
    /* copie MS Project (.xml) à jour à côté, à ouvrir directement dans Project */
    try {
      const p2 = normPlan(JSON.parse(JSON.stringify(rec.plan))), xblob = new Blob([toMSPDI(p2, schedule(p2, makeCal(p2)))], {type:'application/xml'});
      const xmd = {name:cleanName(rec.plan.name) + '.xml', mimeType:'application/xml', description:'Planning BauGest au format MS Project – ' + s.label,
        appProperties:{pc:'1', site:rec.siteId, kind:'planningxml', uid:rec.uid}};
      let xf = null;
      if (rec.xmlId) { try { xf = await driveUpload(xblob, xmd, rec.xmlId); } catch (e) { if (e.status !== 404) throw e; } }
      if (!xf) { const parent = await H.ensureFolder([s.folder, 'Planning']); xf = await driveUpload(xblob, Object.assign({parents:[parent]}, xmd)); }
      rec.xmlId = xf.id;
    } catch (e) { console.warn('planning xml', e); }
    if (rec.plan.updatedAt === stamp) rec.dirty = false;
    await PDB.put(rec);
  })();
  try { await U.pushing; setState(rec.dirty ? 'Enregistrement…' : 'Enregistré sur le Drive'); }
  catch (e) { setState('Enregistré sur l’appareil · Drive : ' + e.message, true); }
  finally { U.pushing = null; }
}
async function exportToDrive(blob, name){
  if (!online() || !U.rec) return false;
  try {
    const s = site(U.rec.siteId), parent = await H.ensureFolder([s.folder, 'Planning', 'Exports']);
    await driveUpload(blob, {name, parents:[parent], appProperties:{pc:'1', site:U.rec.siteId, kind:'export'}});
    return true;
  } catch (e) { return false; }
}
function setState(t, err){ const el = $b('#bpState'); if (el) { el.textContent = t || ''; el.classList.toggle('err', !!err); } }
function save(){
  if (!U.rec) return;
  U.plan.updatedAt = new Date().toISOString(); U.rec.plan = U.plan; U.rec.name = U.plan.name; U.rec.dirty = true;
  setState('Modifié…');
  clearTimeout(U.saveT); U.saveT = setTimeout(() => PDB.put(U.rec).catch(() => {}), 300);
  clearTimeout(U.pushT); U.pushT = setTimeout(() => pushRec(U.rec), online() ? 2500 : 0);
  if (!online()) setState('Enregistré sur l’appareil (Drive hors ligne)');
}
async function flush(){
  clearTimeout(U.saveT); clearTimeout(U.pushT);
  if (U.rec && U.rec.dirty) { await PDB.put(U.rec).catch(() => {}); await pushRec(U.rec); }
}

/* ---------- modifications avec annuler / rétablir ---------- */
function mut(fn){
  const before = JSON.stringify(U.plan);
  const r = fn(U.plan);
  if (r === false) return false;
  U.undo.push(before); if (U.undo.length > 80) U.undo.shift(); U.redo = [];
  commit(); return true;
}
function commit(){ normPlan(U.plan); U.cal = makeCal(U.plan); U.sch = schedule(U.plan, U.cal, U.statusDn); save(); render(); }
function undo(){ if (!U.undo.length) return; U.redo.push(JSON.stringify(U.plan)); U.plan = JSON.parse(U.undo.pop()); commit(); }
function redo(){ if (!U.redo.length) return; U.undo.push(JSON.stringify(U.plan)); U.plan = JSON.parse(U.redo.pop()); commit(); }
const T = id => U.plan.tasks.find(t => t.id === id);
const kids = id => U.plan.tasks.filter(t => (t.parent || null) === (id || null));
const depthOf = t => { let d = 0, p = t; while (p && p.parent && d < 20) { p = T(p.parent); d++; } return d; };
/* presse-papiers des ressources (tâche ou lot → autre tâche / lot) : lignes + début de l’origine (n° de jour ouvré) ; les dates fixes gardent leur écart en jours ouvrés depuis le début */
let RES_CLIP = null;
function resClipSet(rows, start, from){
  RES_CLIP = {rows:rows.map(a => ({...a})), start, from, names:Object.fromEntries(rows.map(a => [a.r, (U.plan.res.find(x => x.id === a.r) || {}).name]))};
}
function resClipRows(start){
  if (!RES_CLIP) return {rows:[], miss:0};
  const mv = d => { const v = dnOfIso(d); return v == null ? d : isoOfDn(U.cal.dnOf(start + U.cal.idx(v) - RES_CLIP.start)); };
  let miss = 0;
  const rows = RES_CLIP.rows.map(a => { const re = U.plan.res.find(x => x.id === a.r) || U.plan.res.find(x => x.name === RES_CLIP.names[a.r]); if (!re) { miss++; return null; }
    const n = {...a, r:re.id}; if (n.d0) n.d0 = mv(n.d0); if (n.d1) n.d1 = mv(n.d1); return n; }).filter(Boolean);
  return {rows, miss};
}
const resPasteAsk = n => dlg({title:'Coller les ressources', body:`<p>${n > 1 ? 'Certaines tâches ont' : 'Il y a'} déjà des ressources. Ajouter les ${RES_CLIP.rows.length} ligne(s) copiée(s) (de « ${esc(RES_CLIP.from)} ») ou remplacer les ressources existantes ?</p>`,
  buttons:[{label:'Annuler', value:null}, {label:'Remplacer', value:'rep'}, {label:'Ajouter', value:'add', pri:true}]});
const resMissTxt = m => m ? ` · ${m} ressource(s) absente(s) de ce planning, pas collée(s)` : '';
/* barre du Gantt : copier les ressources de la tâche / du lot actif, coller sur la sélection */
function resCopySel(){
  const t = U.sel && T(U.sel); if (!t) return;
  const rows = (isSum(t.id) ? t.lres || [] : t.asg).filter(a => a.r && +a.q > 0);
  if (!rows.length) { toast('Aucune ressource à copier dans « ' + t.name + ' »'); return; }
  resClipSet(rows, U.sch.R.get(t.id).es, t.name); toast(`${rows.length} ligne(s) de ressources copiée(s) : sélectionne une ou plusieurs tâches puis Coller`); render();
}
async function resPasteSel(){
  if (!RES_CLIP) return;
  const ts = selIds().map(T).filter(t => t && (isSum(t.id) || !t.ms));
  if (!ts.length) { toast('Pas de tâche ni de lot sélectionné (les jalons n’ont pas de ressources)'); return; }
  const cur = t => isSum(t.id) ? t.lres || [] : t.asg, full = ts.filter(t => cur(t).length).length;
  const mode = full ? await resPasteAsk(full) : 'add'; if (!mode) return;
  const before = JSON.stringify(U.plan); let miss = 0;
  for (const t of ts) { const c = resClipRows(U.sch.R.get(t.id).es); miss = Math.max(miss, c.miss); const l = (mode === 'rep' ? [] : cur(t)).concat(c.rows);
    if (isSum(t.id)) { if (l.length) t.lres = l; else delete t.lres; } else t.asg = l; }
  U.undo.push(before); U.redo = []; commit();
  toast(`Ressources collées sur ${ts.length} ${ts.length > 1 ? 'tâches / lots' : ts[0].name}${resMissTxt(miss)}`);
}
const isSum = id => { const x = T(id); return !!(x && x.lot) || U.plan.tasks.some(t => t.parent === id); };
const descendants = id => { const out = new Set(), st = [id]; while (st.length) { const x = st.pop(); for (const t of U.plan.tasks) if (t.parent === x && !out.has(t.id)) { out.add(t.id); st.push(t.id); } } return out; };
const wbsOf = id => { const o = U.sch.ol.find(x => x.t.id === id); return o ? o.wbs : '?'; };
const predTxt = t => t.deps.map(d => wbsOf(d.id) + (d.type !== 'FS' || d.lag ? d.type : '') + (d.lag ? (d.lag > 0 ? '+' : '') + d.lag : '')).join(' ; ');

/* ---------- ouverture ---------- */
function build(){
  if (document.getElementById('bgPlan')) return;
  const st = document.createElement('style'); st.id = 'bpCss'; st.textContent = css(); document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'bgPlan'; el.hidden = true;
  el.innerHTML = `<header class="bp-top">
    <button class="bp-ib" data-a="close" title="Fermer le planning" aria-label="Fermer">${I.x}</button>
    <div class="bp-ttl"><b>Plan<i>ning</i></b></div>
    <select id="bpSite" title="Chantier" style="max-width:240px"></select>
    <select id="bpPlan" title="Planning du chantier" style="max-width:220px"></select>
    <button class="bp-btn" data-a="new" title="Nouveau planning">${I.plus}<span>Nouveau</span></button>
    <nav class="bp-tabs"><button data-tab="gantt">Gantt</button><button data-tab="res">Ressources</button><button data-tab="bud">Budget</button><button data-tab="an">Analyse</button><button data-tab="set">Réglages</button></nav>
    <span class="bp-grow"></span>
    <span class="bp-state" id="bpState"></span>
    <button class="bp-ib" data-a="undo" title="Annuler (Ctrl+Z)">${I.undo}</button>
    <button class="bp-ib" data-a="redo" title="Rétablir (Ctrl+Y)">${I.redo}</button>
    <button class="bp-btn" data-a="baseline" title="Figer le planning de référence (dates et budget initiaux)">${I.base}<span>Référence</span></button>
    <button class="bp-btn" data-a="level" title="Surcharges des ressources : proposition de décalage">${I.lvl}<span>Lisser</span></button>
    <button class="bp-btn" data-a="print" title="Imprimer le planning (mise en page du PDF : format, colonnes, période, cartouche)">${I.print}<span>Imprimer</span></button>
    <button class="bp-btn" data-a="export" title="PDF A3, Excel, MS Project">${I.exp}<span>Exporter</span></button>
    <button class="bp-ib" data-a="help" title="Manuel du planning" style="font-weight:800;font-size:18px">?</button>
    ${H.split ? `<button class="bp-ib" data-a="split" title="Double vue : planning à gauche, explorateur et fichiers du chantier à droite">${I.split}</button>` : ''}
    ${H.popout ? `<button class="bp-ib" data-a="popout" title="Ouvrir le planning dans une fenêtre séparée (2e écran)">${I.win}</button>` : ''}
  </header>
  <div class="bp-info" id="bpInfo" hidden></div>
  <main id="bpMain"></main><div class="bp-splitter" title="Glisser pour régler la largeur"></div>`;
  document.body.appendChild(el);
  bind(el);
  const fit = () => { const w = el.clientWidth; if (!w) return; const n1 = w < 1500, n2 = w < 1000, was = U.narrow;
    el.classList.toggle('bp-n1', n1); el.classList.toggle('bp-n2', n2); U.narrow = n2; if (was !== undefined && was !== n2 && U.plan && U.tab === 'gantt') render(); };
  if (window.ResizeObserver) new ResizeObserver(fit).observe(el); else addEventListener('resize', fit);
}
/* double vue (PC) : le planning à gauche, la page hôte à droite (largeur réglable, gardée dans baugest.planSplit) */
const splitPref = () => { try { return JSON.parse(localStorage.getItem('baugest.planSplit') || '{}'); } catch (e) { return {}; } };
function setSplit(on, w){
  const el = document.getElementById('bgPlan'); if (!el || !H.split) return;
  const pref = splitPref(); w = Math.max(30, Math.min(80, w || pref.w || 55));
  U.split = !!on;
  el.classList.toggle('bp-split', U.split);
  document.documentElement.style.setProperty('--bp-w', w + '%');
  document.body.classList.toggle('bp-split', U.split && !el.hidden);
  try { localStorage.setItem('baugest.planSplit', JSON.stringify({on:U.split, w})); } catch (e) {}
  const b = $b('[data-a="split"]'); if (b) b.classList.toggle('on', U.split);
  if (H.onSplit) H.onSplit(U.split);
  if (U.plan) render();
}
async function open(siteId, planUid){
  if (!H) throw new Error('BGPlan.init() manquant');
  U.openTok++;
  build();
  const sites = H.sites() || [];
  U.siteId = siteId && sites.some(s => s.id === siteId) ? siteId : (U.siteId && sites.some(s => s.id === U.siteId) ? U.siteId : (sites[0] && sites[0].id) || null);
  U.statusDn = todayDn();
  $b('#bpSite').innerHTML = sites.length ? sites.map(s => `<option value="${esc(s.id)}">${esc(s.label)}</option>`).join('') : '<option value="">Aucun chantier</option>';
  if (U.siteId) $b('#bpSite').value = U.siteId;
  document.getElementById('bgPlan').hidden = false;
  if (H.split) setSplit(!!splitPref().on);
  if (H.onToggle) H.onToggle(true);
  await loadSite(planUid);
  loadCommonLay();
}
async function close(){
  const tok = U.openTok;
  await flush();
  if (tok !== U.openTok) return;
  const el = document.getElementById('bgPlan'); if (el) el.hidden = true;
  U.dlgs.slice().forEach(d => d.close());
  document.body.classList.remove('bp-split');
  if (H.onSplit && U.split) H.onSplit(false);
  if (H.onToggle) H.onToggle(false);
  if (H.onClose) H.onClose();
}
/* manuel : aide-planning.html (même dossier que l'app), PDF à côté */
function help(){
  const sc = document.createElement('div'); sc.className = 'bp-scrim'; sc.style.padding = '0';
  sc.innerHTML = `<div class="bp-dlg" style="width:100%;height:100%;max-width:980px;max-height:none;border-radius:0">
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line,#353a41)">
      <button class="bp-ib" data-x title="Fermer">${I.x}</button><b style="flex:1;font:700 18px var(--display,sans-serif);text-transform:uppercase">Manuel du planning</b>
      <a class="bp-btn" href="aide-planning.pdf" download="Manuel Planning BauGest.pdf" style="text-decoration:none;color:inherit">${I.exp}PDF</a></div>
    <iframe src="aide-planning.html" title="Manuel du planning" style="flex:1;border:0;width:100%;background:#fff"></iframe></div>`;
  document.body.appendChild(sc);
  const done = () => { const k = U.dlgs.indexOf(entry); if (k >= 0) U.dlgs.splice(k, 1); sc.remove(); };
  const entry = {close:done, key:e => { if (e.key === 'Escape') { e.preventDefault(); done(); } }};
  U.dlgs.push(entry);
  sc.querySelector('[data-x]').addEventListener('click', done);
}
async function popout(){
  const sid = U.siteId, uidp = U.rec && U.rec.uid;
  await close();
  H.popout(sid, uidp);
}
function back(){
  const el = document.getElementById('bgPlan'); if (!el || el.hidden) return false;
  if (U.dlgs.length) { U.dlgs[U.dlgs.length - 1].close(); return true; }
  close(); return true;
}
async function loadSite(pref){
  U.rec = null; U.plan = null; U.undo = []; U.redo = []; U.sel = null;
  const main = $b('#bpMain');
  if (!U.siteId) { main.innerHTML = '<div class="bp-empty">Crée d’abord un chantier dans BauGest pour faire son planning.</div>'; $b('#bpPlan').innerHTML = ''; return; }
  main.innerHTML = '<div class="bp-empty">Chargement des plannings…</div>';
  const r = await listRecs(U.siteId); if (!r) return;
  U.recs = r.recs; info(r.info);
  const last = (() => { try { return localStorage.getItem('baugest.plan.' + U.siteId); } catch (e) { return null; } })();
  const rec = U.recs.find(x => x.uid === pref) || U.recs.find(x => x.uid === last) || U.recs[0];
  fillPlanSel(rec && rec.uid);
  if (rec) await openRec(rec); else { render(); }
}
function fillPlanSel(uidSel){
  $b('#bpPlan').innerHTML = U.recs.length ? U.recs.map(r => `<option value="${esc(r.uid)}">${esc(r.name)}</option>`).join('') : '<option value="">—</option>';
  if (uidSel) $b('#bpPlan').value = uidSel;
}
function info(t, err){ const el = $b('#bpInfo'); el.hidden = !t; el.textContent = t || ''; el.classList.toggle('err', !!err); }
async function openRec(rec){
  await flush();
  try { await loadRec(rec); }
  catch (e) { U.rec = null; U.plan = null; info('Ouverture impossible : ' + e.message, true); render(); return; }
  U.rec = rec; U.plan = normPlan(rec.plan); U.undo = []; U.redo = []; U.sel = null; U.msel.clear(); U.selMode = false; U.resSel = null;
  try { localStorage.setItem('baugest.plan.' + U.siteId, rec.uid); } catch (e) {}
  U.cal = makeCal(U.plan); U.sch = schedule(U.plan, U.cal, U.statusDn);
  { const Ly = LAY(); U.zoom = Ly.screen.zoom; U.showBase = Ly.screen.base; }
  setState(rec.dirty ? (online() ? 'Envoi au Drive…' : 'Enregistré sur l’appareil') : rec.driveId ? 'Enregistré sur le Drive' : '');
  if (!rec.dirty && rec.driveId && !rec.xmlId && online()) rec.dirty = true;   /* planning d'avant la copie .xml : la créer */
  if (rec.dirty) pushRec(rec);
  render();
  if (U.tab === 'gantt') setTimeout(scrollToday, 30);
}
function defaultVac(){ try { return JSON.parse(localStorage.getItem('baugest.planVac') || '[]'); } catch (e) { return []; } }
async function newPlanDlg(){
  if (!U.siteId) return;
  const s = site(U.siteId), last = U.plan;
  const box = await dlg({title:'Nouveau planning', width:520, body:`
    <label class="bp-f"><span>Nom du planning</span><input id="npName" value="${esc(U.recs.length ? 'Planning ' + (U.recs.length + 1) : 'Planning général')}" autofocus></label>
    <label class="bp-f"><span>Début des travaux</span><input id="npStart" type="date" value="${isoOfDn(todayDn())}"></label>
    <label class="bp-f"><span>Canton (jours fériés)</span><select id="npCanton">${Object.entries(CANTONS).map(([k, v]) => `<option value="${k}" ${(last ? last.hol.canton : 'VD') === k ? 'selected' : ''}>${k} – ${esc(v[0])}</option>`).join('')}</select></label>
    <p class="bp-hint">Chantier : ${esc(s ? s.label : '')}. Structure, budget et vacances se règlent ensuite dans l’onglet Réglages.</p>`,
    buttons:[{label:'Annuler', value:null}, {label:'Créer', pri:true, check:b => !!b.querySelector('#npName').value.trim()}]});
  if (!box) return;
  const c = box.querySelector('#npCanton').value;
  const p = newPlan(U.siteId, box.querySelector('#npName').value.trim(), {start:box.querySelector('#npStart').value || isoOfDn(todayDn()), hol:{canton:c, keys:cantonKeys(c), extra:[]}, vac:defaultVac()});
  if (last) Object.assign(p.opts, {structure:last.opts.structure, budget:last.opts.budget, hpd:last.opts.hpd, sat:last.opts.sat});
  await addRec(p);
}
async function addRec(p){
  p.siteId = U.siteId; normPlan(p);
  const rec = {uid:p.uid, siteId:U.siteId, name:p.name, plan:p, dirty:true, driveId:null, driveMod:null};
  await PDB.put(rec); U.recs.push(rec); U.recs.sort((a, b) => a.name.localeCompare(b.name, 'fr', {numeric:true}));
  fillPlanSel(rec.uid); await openRec(rec); U.tab = 'gantt'; render();
}

/* ---------- rendu ---------- */
function render(){
  if (!document.getElementById('bgPlan')) return;
  $$b('.bp-tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === U.tab));
  const has = !!U.plan;
  ['undo', 'redo', 'baseline', 'level', 'export', 'print'].forEach(a => { const b = $b(`[data-a="${a}"]`); if (b) b.disabled = !has || (a === 'undo' && !U.undo.length) || (a === 'redo' && !U.redo.length); });
  const bb = $b('[data-a="baseline"]'); if (bb) bb.classList.toggle('on', !!(U.plan && U.plan.baseline));
  const main = $b('#bpMain');
  if (!has) {
    main.innerHTML = `<div class="bp-empty"><p>Aucun planning pour ce chantier.</p><button class="bp-btn pri" data-a="new">${I.plus}Créer un planning</button> <button class="bp-btn" data-a="import">${I.imp}Importer MS Project (XML)</button></div>`;
    return;
  }
  if (U.sch.errs.length) info(U.sch.errs.join(' · '), true);
  if (U.tab === 'gantt') renderGantt();
  else if (U.tab === 'res') renderRes();
  else if (U.tab === 'bud') renderBud();
  else if (U.tab === 'an') renderAn();
  else renderSet();
}

/* ---------- Mise en page : modèle commun (fichier Drive à la racine, partagé tablette / PC) + mise en page propre à un planning (plan.lay) ---------- */
const COLDEF = {
  wbs:{l:'N°', w:46, pw:30}, name:{l:'Tâche', w:230, pw:196}, dur:{l:'Durée', w:62, pw:34, n:1}, start:{l:'Début', w:84, pw:46, n:1}, fin:{l:'Fin', w:84, pw:46, n:1},
  pred:{l:'Préd.', w:84, pw:62}, pct:{l:'%', w:44, pw:28, n:1}, tf:{l:'Marge', w:64, pw:34, n:1}, aStart:{l:'Début réel', w:90, pw:46, n:1}, aEnd:{l:'Fin réelle', w:90, pw:46, n:1},
  res:{l:'Ressources', w:170, pw:110}, cost:{l:'Budget CHF', w:96, pw:54, n:1}, zone:{l:'Zone', w:110, pw:60}
};
const COL_ORDER = Object.keys(COLDEF);
const COLOR_LBL = {task:'Tâche', crit:'Chemin critique', done:'Terminée', sum:'Lot', ms:'Jalon', base:'Référence', late:'Retard (contour)', today:'Aujourd’hui'};
const DEF_LAY = {
  cols:COL_ORDER.slice(), scr:['wbs', 'name', 'dur', 'start', 'fin', 'pred', 'pct', 'tf'], pdfc:['wbs', 'name', 'dur', 'start', 'fin'],
  colors:{task:'#3e8ed0', crit:'#e5484d', done:'#4caf7a', sum:'#6b7178', ms:'#6b7178', base:'#8a8f96', late:'#ff9f43', today:'#f2c230'},
  crit:true, barText:'res',
  screen:{rh:32, font:13, zoom:'week', links:true, base:true, weekend:true},
  pdf:{size:'A3', orient:'land', title:'', subtitle:true, legend:true, cart:true, logo:'comp', logoSrc:'', logoPos:'tl', logoH:15, range:'all', from:'', to:'', only:false, fit:false, font:7.5, rh:13.5, links:true, base:true, zebra:true, note:'', notes:[]}
};
const clone = o => JSON.parse(JSON.stringify(o));
/* remarques en bas de page : liste notes[] (ancien champ note = 1 seule remarque) */
const noteList = P => (Array.isArray(P.notes) && P.notes.length ? P.notes : [P.note || '']).map(x => String(x || '').trim()).filter(Boolean);
const noteRow = v => `<div class="bp-nrow" style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input data-note value="${esc(v)}" placeholder="ex. Document provisoire – sous réserve des intempéries" style="flex:1"><button type="button" class="bp-ib" data-delnote title="Retirer cette remarque">${I.x}</button></div>`;
function mergeLay(a, b){
  const o = clone(a);
  if (b) for (const k in b) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && o[k] && typeof o[k] === 'object') Object.assign(o[k], b[k]);
    else if (b[k] !== undefined) o[k] = clone(b[k]);
  }
  o.cols = (Array.isArray(o.cols) ? o.cols : []).filter(k => COLDEF[k]); for (const k of COL_ORDER) if (!o.cols.includes(k)) o.cols.push(k);
  for (const k of ['scr', 'pdfc']) { o[k] = (Array.isArray(o[k]) ? o[k] : []).filter(c => COLDEF[c]); if (!o[k].includes('name')) o[k].push('name'); }
  return o;
}
const LAYK = 'baugest.planLay', LAY_NAME = 'BauGest – mise en page des plannings (ne pas supprimer).json';
const layLocal = () => { try { return JSON.parse(localStorage.getItem(LAYK) || 'null') || {}; } catch (e) { return {}; } };
const layStore = o => { try { localStorage.setItem(LAYK, JSON.stringify(o)); } catch (e) {} };
U.common = layLocal().lay || null;
const LAY = () => mergeLay(DEF_LAY, (U.plan && U.plan.lay) || U.common);
async function pushCommonLay(){
  const loc = layLocal(); if (!loc.lay || !online()) return false;
  const blob = new Blob([JSON.stringify({v:1, lay:loc.lay})], {type:'application/json'});
  const md = {name:LAY_NAME, mimeType:'application/json', appProperties:{pc:'1', site:'none', kind:'planlay'}};
  let f = null;
  if (loc.id) { try { f = await driveUpload(blob, md, loc.id); } catch (e) { if (e.status !== 404) throw e; } }
  if (!f) { const parent = await H.ensureFolder([]); f = await driveUpload(blob, Object.assign({parents:[parent]}, md)); }
  layStore({lay:loc.lay, mod:f.modifiedTime, id:f.id, pend:false});
  return true;
}
async function loadCommonLay(){
  if (!online()) return;
  try {
    const loc = layLocal();
    if (loc.pend) { await pushCommonLay(); return; }
    const r = await H.api(DRV + '?' + new URLSearchParams({q:"trashed=false and appProperties has { key='kind' and value='planlay' }", orderBy:'modifiedTime desc', pageSize:'1', fields:'files(id,modifiedTime)'}));
    const f = r && r.files && r.files[0]; if (!f || (loc.id === f.id && loc.mod && loc.mod >= f.modifiedTime)) return;
    let j = await H.api(`${DRV}/${encodeURIComponent(f.id)}?alt=media`); if (j && typeof j.json === 'function') j = await j.json();
    U.common = (j && j.lay) || null; layStore({lay:U.common, mod:f.modifiedTime, id:f.id, pend:false});
    if (U.plan && !U.plan.lay) render();
  } catch (e) { console.warn('mise en page', e); }
}
async function saveCommonLay(lay){
  U.common = lay; const loc = layLocal();
  layStore({lay, mod:new Date().toISOString(), id:loc.id || null, pend:true});
  try { if (await pushCommonLay()) return; } catch (e) { toast('Modèle commun : Drive ' + e.message); return; }
  toast('Modèle commun enregistré sur cet appareil ; envoi au Drive au retour du réseau');
}
/* coût budgété par tâche et par lot (colonne « Budget CHF ») */
function costMap(){
  const p = U.plan, s = U.sch, m = new Map();
  for (let i = s.ol.length - 1; i >= 0; i--) { const o = s.ol[i];
    if (!o.sum) m.set(o.t.id, taskBudget(p, o.t, s.R.get(o.t.id).dur, s.cal, s.R.get(o.t.id)));
    else m.set(o.t.id, p.tasks.filter(t => t.parent === o.t.id).reduce((a, t) => a + (m.get(t.id) || 0), 0) + lotBudget(p, s, o.t)); }
  return m;
}
/* texte d'une période de présence : « sem. 2 à fin », « 12.04.27 → 30.04.27 » ou '' (toute la durée) */
const perTxt = a => { const m = perMode(a); return m === 'w' ? `sem. ${Math.max(1, +a.w0 || 1)} à ${+a.w1 ? a.w1 : 'fin'}` : m === 'd' ? `${a.d0 ? shortOfDn(dnOfIso(a.d0)) : 'début'} → ${a.d1 ? shortOfDn(dnOfIso(a.d1)) : 'fin'}` : ''; };
const resTxt = t => {
  const q1 = v => fmtN(v, v % 1 ? 1 : 0), out = [];
  /* une ressource par nom ; effectif mini–maxi sur ses périodes (tâche et lot) */
  const g = new Map(); for (const a of [...t.asg, ...(t.lres || [])]) { if (!a.r || !(+a.q > 0)) continue; const x = g.get(a.r) || [Infinity, 0]; g.set(a.r, [Math.min(x[0], +a.q), Math.max(x[1], +a.q)]); }
  for (const [rid, [lo, hi]] of g) { const re = U.plan.res.find(z => z.id === rid); if (re) out.push(re.name + (lo !== hi ? ' ×' + q1(lo) + '–' + q1(hi) : hi !== 1 ? ' ×' + q1(hi) : '')); }
  return out.filter(Boolean).join(', ');
};
/* zone d'une tâche (secteur, bâtiment…) : la sienne, sinon celle du lot parent */
function zoneOf(t, p){ p = p || U.plan; let x = t, g = 0; while (x && g++ < 30) { if (x.zone) return x.zone; x = x.parent ? p.tasks.find(y => y.id === x.parent) : null; } return ''; }
const zonesOf = p => [...new Set(p.tasks.map(t => (t.zone || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr', {numeric:true}));
function cellTxt(k, o, r, cm){
  const t = o.t;
  if (k === 'wbs') return o.wbs;
  if (k === 'zone') return t.zone || (o.sum ? '' : zoneOf(t));
  if (k === 'name') return t.name;
  if (k === 'dur') return (t.ms && !o.sum ? 0 : r.dur) + ' j';
  if (k === 'start') return shortOfDn(r.start);
  if (k === 'fin') return shortOfDn(r.finish);
  if (k === 'pred') return o.sum ? '' : predTxt(t);
  if (k === 'pct') return o.sum ? '' : Math.round(t.pct) + '%';
  if (k === 'tf') return o.sum ? '' : r.tf + ' j';
  if (k === 'aStart') return t.aStart ? shortOfDn(dnOfIso(t.aStart)) : '';
  if (k === 'aEnd') return t.aEnd ? shortOfDn(dnOfIso(t.aEnd)) : '';
  if (k === 'res') return resTxt(t);
  if (k === 'cost') return cm ? fmtN(cm.get(t.id) || 0) : '';
  return '';
}
/* texte à côté d'une barre : réglage de la tâche (t.st.txt) sinon de la mise en page ; lots : seulement si réglé sur le lot */
const barLabel = (Ly, o, r) => { const k = (o.t.st && o.t.st.txt) || (o.sum ? 'none' : Ly.barText); if (k === 'none') return ''; const rs = resTxt(o.t);
  r = r || (U.sch && U.sch.R.get(o.t.id));
  if (k === 'dates') return r ? `${shortOfDn(r.start)} → ${shortOfDn(r.finish)}` : '';
  if (k === 'dur') return r ? `${r.dur} j` : '';
  if (k === 'nd') return r ? `${o.t.name} · ${shortOfDn(r.start)} → ${shortOfDn(r.finish)}` : o.t.name;
  return k === 'name' ? o.t.name : k === 'both' ? o.t.name + (rs ? ' · ' + rs : '') : rs; };
/* encre lisible sur une couleur de barre */
const inkOn = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); if (!m) return '#ffffff'; const n = parseInt(m[1], 16), l = (.299 * (n >> 16 & 255) + .587 * (n >> 8 & 255) + .114 * (n & 255)) / 255; return l > .62 ? '#1b1d21' : '#ffffff'; };
function logoList(){ const L = H.logos ? (H.logos(U.siteId) || {}) : {}; return {comp:L.comp || '', site:L.site || '', lib:[...new Set((L.lib || []).filter(Boolean))]}; }
async function logoPng(src){
  return new Promise(res => { const im = new Image(); im.onload = () => { try { const k = Math.min(1, 400 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      res(c.toDataURL('image/png')); } catch (e) { res(null); } }; im.onerror = () => res(null); im.src = src; });
}
async function layDlg(){
  const p = U.plan; if (!p) return;
  const own = !!p.lay, Ly = LAY(), logos = logoList();
  const ck = (id, on, l) => `<label class="bp-chk"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}>${l}</label>`;
  const sel = (id, v, opts) => `<select id="${id}">${opts.map(([k, l]) => `<option value="${k}" ${String(v) === String(k) ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const colRow = k => `<tr data-col="${k}"><td>${COLDEF[k].l}</td><td style="text-align:center"><input type="checkbox" data-cs ${Ly.scr.includes(k) ? 'checked' : ''} ${k === 'name' ? 'disabled' : ''}></td><td style="text-align:center"><input type="checkbox" data-cp ${Ly.pdfc.includes(k) ? 'checked' : ''} ${k === 'name' ? 'disabled' : ''}></td><td><button class="bp-ib" data-mv="-1" title="Monter">${I.up}</button> <button class="bp-ib" data-mv="1" title="Descendre">${I.dn}</button></td></tr>`;
  const logoGrid = cur => `<div id="lyLogos" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">${logos.lib.map(src => `<button class="bp-btn ${cur === src ? 'on' : ''}" data-logo="${esc(src)}" style="height:56px;width:90px;padding:4px;background:#fff"><img src="${esc(src)}" alt="" style="max-width:100%;max-height:100%"></button>`).join('')}
    <button class="bp-btn" id="lyLogoFile" style="height:56px">${I.imp}Image…</button></div>`;
  let logoCur = Ly.pdf.logoSrc || '';
  const box = await dlg({title:'Mise en page des plannings', width:860, body:`
    <label class="bp-f"><span>S’applique à</span><select id="lyScope"><option value="common">Modèle commun : tous les plannings sans mise en page propre (tablette et PC)</option><option value="plan" ${own ? 'selected' : ''}>Ce planning seulement : « ${esc(p.name)} »</option></select></label>
    <h4>Colonnes du tableau</h4>
    <table class="bp-tbl" id="lyCols"><thead><tr><th>Colonne</th><th style="text-align:center">Écran</th><th style="text-align:center">PDF</th><th>Ordre</th></tr></thead><tbody>${Ly.cols.map(colRow).join('')}</tbody></table>
    <p class="bp-hint">Sur l’écran, le bouton Tableau réduit garde seulement N°, Tâche et Durée.</p>
    <h4>Barres et couleurs</h4>
    <div class="bp-form">${Object.keys(COLOR_LBL).map(k => `<label class="bp-f"><span>${COLOR_LBL[k]}</span><input type="color" data-color="${k}" value="${esc(Ly.colors[k])}" style="padding:2px;height:38px"></label>`).join('')}
      <label class="bp-f"><span>Texte à côté des barres</span>${sel('lyBarText', Ly.barText, [['res', 'Ressources'], ['name', 'Nom de la tâche'], ['both', 'Nom + ressources'], ['none', 'Rien']])}</label>
      ${ck('lyCrit', Ly.crit, 'Chemin critique dans sa couleur')}</div>
    <h4>Écran</h4>
    <div class="bp-form">
      <label class="bp-f"><span>Hauteur des lignes</span>${sel('lyRh', Ly.screen.rh, [[24, 'Compacte'], [32, 'Normale'], [40, 'Grande']])}</label>
      <label class="bp-f"><span>Taille du texte</span>${sel('lyFont', Ly.screen.font, [[12, 'Petite'], [13, 'Normale'], [15, 'Grande'], [17, 'Très grande']])}</label>
      <label class="bp-f"><span>Zoom à l’ouverture</span>${sel('lyZoom', Ly.screen.zoom, [['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois']])}</label>
      ${ck('lyLinks', Ly.screen.links, 'Flèches des liens')}${ck('lyBase', Ly.screen.base, 'Référence (barres grises)')}${ck('lyWe', Ly.screen.weekend, 'Week-ends et fériés grisés')}</div>
    <h4>PDF imprimé</h4>
    <div class="bp-form">
      <label class="bp-f"><span>Format</span>${sel('lySize', Ly.pdf.size, [['A4', 'A4'], ['A3', 'A3'], ['A2', 'A2 (grand format)'], ['A1', 'A1 (grand format)'], ['A0', 'A0 (grand format)']])}</label>
      <label class="bp-f"><span>Orientation</span>${sel('lyOrient', Ly.pdf.orient, [['land', 'Paysage'], ['port', 'Portrait']])}</label>
      <label class="bp-f w"><span>Titre (vide = « Planning – nom du planning »)</span><input id="lyTitle" value="${esc(Ly.pdf.title)}" placeholder="Planning – ${esc(p.name)}"></label>
      <label class="bp-f"><span>Période</span>${sel('lyRange', Ly.pdf.range, [['all', 'Tout le chantier'], ['custom', 'Du … au …'], ['3w', '3 semaines dès aujourd’hui']])}</label>
      <label class="bp-f" data-rg><span>Du</span><input type="date" id="lyFrom" value="${esc(Ly.pdf.from)}"></label>
      <label class="bp-f" data-rg><span>Au</span><input type="date" id="lyTo" value="${esc(Ly.pdf.to)}"></label>
      <div data-rg2>${ck('lyOnly', Ly.pdf.only, 'Seulement les tâches de la période')}</div>
      <label class="bp-f"><span>Taille du texte</span>${sel('lyPFont', Ly.pdf.font, [[6.5, 'Petite'], [7.5, 'Normale'], [9, 'Grande'], [10.5, 'Très grande']])}</label>
      <label class="bp-f"><span>Hauteur des lignes</span>${sel('lyPRh', Ly.pdf.rh, [[11, 'Compacte'], [13.5, 'Normale'], [17, 'Grande']])}</label>
      ${ck('lySub', Ly.pdf.subtitle, 'Ligne d’infos sous le titre')}${ck('lyLeg', Ly.pdf.legend, 'Légende')}${ck('lyCart', Ly.pdf.cart, 'Cartouche')}
      ${ck('lyPLinks', Ly.pdf.links, 'Flèches des liens')}${ck('lyPBase', Ly.pdf.base, 'Référence')}${ck('lyZebra', Ly.pdf.zebra, 'Lignes alternées')}${ck('lyFit', Ly.pdf.fit, 'Ajuster à la page (tout sur 1 page)')}
      <div class="bp-f w"><span>Remarques en bas de page (une par ligne du PDF)</span><div id="lyNotes">${(noteList(Ly.pdf).length ? noteList(Ly.pdf) : ['']).map(noteRow).join('')}</div><button type="button" class="bp-btn" id="lyAddNote">+ Ajouter une remarque</button></div>
      <label class="bp-f"><span>Logo</span>${sel('lyLogo', Ly.pdf.logo, [['comp', 'Logo de l’entreprise du chantier'], ['site', 'Logo du chantier'], ['pick', 'Logo choisi (ci-dessous)'], ['none', 'Pas de logo']])}</label>
      <label class="bp-f"><span>Place du logo</span>${sel('lyLogoPos', Ly.pdf.logoPos || 'tl', [['tl', 'En haut à gauche'], ['cart', 'Dans le cartouche'], ['both', 'En haut à gauche + cartouche']])}</label>
      <label class="bp-f"><span>Hauteur du logo en haut : <b id="lyLogoHV">${+Ly.pdf.logoH || 15}</b> mm</span><input id="lyLogoH" type="range" min="8" max="60" step="1" value="${+Ly.pdf.logoH || 15}"></label>
      <div class="bp-f w" id="lyPick">${logoGrid(logoCur)}</div>
    </div>`,
    buttons:[{label:'Valeurs d’origine', value:'reset', left:true}, ...(own ? [{label:'Revenir au modèle commun', value:'common'}] : []), {label:'Aperçu PDF', value:'preview'}, {label:'Annuler', value:null}, {label:'Enregistrer', pri:true}],
    onOpen:b => {
      b.querySelector('#lyAddNote').addEventListener('click', () => { const w = b.querySelector('#lyNotes'); w.insertAdjacentHTML('beforeend', noteRow('')); w.lastElementChild.querySelector('input').focus(); });
      b.querySelector('#lyNotes').addEventListener('click', e => { const d = e.target.closest('[data-delnote]'); if (!d) return; const r = d.closest('.bp-nrow'), w = b.querySelector('#lyNotes');
        if (w.children.length > 1) r.remove(); else r.querySelector('input').value = ''; });
      b.querySelector('#lyLogoH').addEventListener('input', e => { b.querySelector('#lyLogoHV').textContent = e.target.value; });
      const upd = () => { const rg = b.querySelector('#lyRange').value; b.querySelectorAll('[data-rg]').forEach(e => e.hidden = rg !== 'custom'); b.querySelector('[data-rg2]').hidden = rg === 'all';
        b.querySelector('#lyPick').hidden = b.querySelector('#lyLogo').value !== 'pick'; };
      b.addEventListener('change', upd); upd();
      b.querySelector('#lyCols').addEventListener('click', e => { const m = e.target.closest('[data-mv]'); if (!m) return; const tr = m.closest('tr'), sib = +m.dataset.mv < 0 ? tr.previousElementSibling : tr.nextElementSibling; if (!sib) return; if (+m.dataset.mv < 0) sib.before(tr); else sib.after(tr); });
      b.querySelector('#lyPick').addEventListener('click', async e => {
        const lb = e.target.closest('[data-logo]');
        if (lb) { logoCur = lb.dataset.logo; b.querySelectorAll('[data-logo]').forEach(x => x.classList.toggle('on', x === lb)); return; }
        if (e.target.closest('#lyLogoFile')) { const f = await pickFile('image/*'); if (!f) return; const src = await logoPng(URL.createObjectURL(f)); if (!src) { toast('Image illisible'); return; }
          logos.lib.unshift(src); logoCur = src; b.querySelector('#lyPick').innerHTML = logoGrid(logoCur); }
      });
      b.readLay = () => {
        const v = id => b.querySelector('#' + id), rows = [...b.querySelectorAll('#lyCols tr[data-col]')];
        const o = {cols:rows.map(r => r.dataset.col), scr:rows.filter(r => r.querySelector('[data-cs]').checked).map(r => r.dataset.col), pdfc:rows.filter(r => r.querySelector('[data-cp]').checked).map(r => r.dataset.col),
          colors:{}, crit:v('lyCrit').checked, barText:v('lyBarText').value,
          screen:{rh:+v('lyRh').value, font:+v('lyFont').value, zoom:v('lyZoom').value, links:v('lyLinks').checked, base:v('lyBase').checked, weekend:v('lyWe').checked},
          pdf:{size:v('lySize').value, orient:v('lyOrient').value, title:v('lyTitle').value.trim(), subtitle:v('lySub').checked, legend:v('lyLeg').checked, cart:v('lyCart').checked,
            logo:v('lyLogo').value, logoSrc:v('lyLogo').value === 'pick' ? logoCur : '', logoPos:v('lyLogoPos').value, logoH:+v('lyLogoH').value || 15, range:v('lyRange').value, from:v('lyFrom').value, to:v('lyTo').value, only:v('lyOnly').checked,
            font:+v('lyPFont').value, rh:+v('lyPRh').value, links:v('lyPLinks').checked, base:v('lyPBase').checked, zebra:v('lyZebra').checked, fit:v('lyFit').checked, note:'', notes:[...b.querySelectorAll('#lyNotes [data-note]')].map(x => x.value.trim()).filter(Boolean)}};
        b.querySelectorAll('[data-color]').forEach(c => o.colors[c.dataset.color] = c.value);
        return mergeLay(DEF_LAY, o);
      };
      /* l'aperçu ne ferme pas la fenêtre */
      const pv = [...b.querySelectorAll('.bp-df button')].find(x => x.textContent === 'Aperçu PDF');
      if (pv) { const nb = pv.cloneNode(true); pv.replaceWith(nb); nb.addEventListener('click', async () => {
        try { toast('Préparation de l’aperçu…', 1500); const blob = await makePdf(b.readLay()), url = URL.createObjectURL(blob);
          if (!window.open(url, '_blank')) download(blob, fileBase() + ' – aperçu.pdf'); } catch (e) { toast('Aperçu impossible : ' + e.message, 5000); } }); }
    }});
  if (!box) return;
  if (box === 'common') { mut(pp => { delete pp.lay; }); toast('Ce planning suit maintenant le modèle commun'); afterLay(); return; }
  if (box === 'reset') {
    if (!await confirmDlg('Valeurs d’origine', own ? 'Remettre la mise en page de ce planning aux valeurs d’origine ?' : 'Remettre le modèle commun (tous les plannings) aux valeurs d’origine ?', 'Remettre')) return;
    if (own) mut(pp => { pp.lay = clone(DEF_LAY); }); else { await saveCommonLay(clone(DEF_LAY)); render(); }
    afterLay(); return;
  }
  const lay = box.readLay(), scope = box.querySelector('#lyScope').value;
  if (scope === 'plan') mut(pp => { pp.lay = lay; });
  else { await saveCommonLay(lay); if (own) mut(pp => { delete pp.lay; }); else render(); }
  afterLay();
  toast(scope === 'plan' ? 'Mise en page enregistrée pour ce planning' : 'Modèle commun enregistré');
}
function afterLay(){ const Ly = LAY(); U.zoom = Ly.screen.zoom; U.showBase = Ly.screen.base; render(); }

/* ---------- Gantt ---------- */
const ZOOM = {day:26, week:9, month:3.2};
let RH = 32; const HEADH = 46;
/* colonnes de l'écran : mise en page (tableau complet) ou N° / Tâche / Durée (tableau réduit) */
const gCols = Ly => { const keys = fullCols() ? Ly.cols.filter(k => Ly.scr.includes(k)) : ['wbs', 'name', 'dur'];
  return keys.map(k => ({k, l:COLDEF[k].l, w:Math.round(COLDEF[k].w * Ly.screen.font / 13), n:COLDEF[k].n})); };
function isoWeek(dn){ const d = new Date(dn * DAY), day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3); const y = d.getUTCFullYear(), f = new Date(Date.UTC(y, 0, 4)); return 1 + Math.round(((d - f) / DAY - 3 + ((f.getUTCDay() + 6) % 7)) / 7); }
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
function range(){
  const s = U.sch, b = U.plan.baseline;
  let d0 = s.cal.start, d1 = s.end;
  if (b && U.showBase) for (const k in b.tasks) { const x = b.tasks[k]; const a = dnOfIso(x.start) ?? x.start, e = dnOfIso(x.finish) ?? x.finish; if (a < d0) d0 = a; if (e > d1) d1 = e; }
  for (const r of s.R.values()) { if (r.start < d0) d0 = r.start; if (r.finish > d1) d1 = r.finish; }
  const pad = U.zoom === 'month' ? 30 : U.zoom === 'week' ? 14 : 5;
  d0 -= pad; d1 += pad * 2;
  if (U.zoom !== 'day') { while (wdOf(d0) !== 1) d0--; }
  return {d0, d1};
}
function renderGantt(){
  const Ly = LAY(), CO = Ly.colors; RH = Ly.screen.rh;
  const main = $b('#bpMain'), p = U.plan, s = U.sch, cols = gCols(Ly), tw = cols.reduce((a, c) => a + c.w, 0), cm = cols.some(c => c.k === 'cost') ? costMap() : null;
  const dw = ZOOM[U.zoom], {d0, d1} = range(), cw = Math.ceil((d1 - d0 + 1) * dw), rows = s.ol;
  const nRows = rows.length + 1, bh = nRows * RH;
  const x = dn => (dn - d0) * dw;
  const sel = U.sel && T(U.sel);
  for (const id of U.msel) if (!T(id)) U.msel.delete(id);
  const nSel = U.msel.size;
  const canLot = maxDepth(p) > 1;
  const bar = `<div class="bp-bar">
    <button class="bp-btn" data-g="addT" title="Nouvelle tâche (après la sélection)">${I.plus}<span>Tâche</span></button>
    <button class="bp-btn" data-g="addM" title="Nouveau jalon">${I.dia}<span>Jalon</span></button>
    ${canLot ? `<button class="bp-btn" data-g="addL" title="Nouveau lot (groupe de tâches)">${I.lot}<span>Lot</span></button>` : ''}
    <span class="bp-sep"></span>
    ${canLot ? `<button class="bp-ib" data-g="out" title="Remonter d’un niveau (Maj+Tab)" ${sel ? '' : 'disabled'}>${I.out}</button><button class="bp-ib" data-g="ind" title="Mettre dans le lot au-dessus (Tab)" ${sel ? '' : 'disabled'}>${I.ind}</button>` : ''}
    <button class="bp-ib" data-g="up" title="Monter" ${sel ? '' : 'disabled'}>${I.up}</button><button class="bp-ib" data-g="down" title="Descendre" ${sel ? '' : 'disabled'}>${I.dn}</button>
    <button class="bp-ib" data-g="link" title="Lier à la tâche au-dessus (fin → début)" ${sel ? '' : 'disabled'}>${I.link}</button>
    <button class="bp-ib" data-g="edit" title="Modifier (double clic)" ${sel ? '' : 'disabled'}>${I.edit}</button>
    <button class="bp-ib" data-g="del" title="Supprimer (Suppr)" ${sel ? '' : 'disabled'}>${I.del}</button>
    <span class="bp-sep"></span>
    <button class="bp-ib ${U.selMode ? 'on' : ''}" data-g="selm" title="Sélection multiple : cases à cocher (PC : Ctrl+clic, Maj+clic, Ctrl+A)">${I.chk}</button>
    <button class="bp-btn" data-g="style" title="Couleur, texte et style des barres sélectionnées" ${sel || nSel ? '' : 'disabled'}>${I.pal}<span>Style</span></button>
    <button class="bp-ib" data-g="rcopy" title="Copier les ressources de la tâche / du lot" ${sel && !sel.ms ? '' : 'disabled'}>${I.copy}</button>
    <button class="bp-ib" data-g="rpaste" title="${RES_CLIP ? `Coller les ressources de « ${esc(RES_CLIP.from)} » sur la sélection` : 'Coller les ressources (copier d’abord une tâche ou un lot)'}" ${RES_CLIP && (sel || nSel) ? '' : 'disabled'}>${I.paste}</button>
    ${nSel > 1 ? `<span class="bp-msn">${nSel} tâches</span><button class="bp-ib" data-g="unsel" title="Tout désélectionner (Échap)">${I.x}</button>` : ''}
    <span class="bp-sep"></span>
    <span class="bp-seg">${[['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois']].map(([k, l]) => `<button data-zoom="${k}" class="${U.zoom === k ? 'on' : ''}">${l}</button>`).join('')}</span>
    <button class="bp-btn" data-g="today" title="Aller à aujourd’hui">${I.today}<span>Auj.</span></button>
    <button class="bp-ib ${fullCols() ? 'on' : ''}" data-g="cols" title="Tableau complet / réduit">${I.tbl}</button>
    ${p.baseline ? `<button class="bp-btn ${U.showBase ? 'on' : ''}" data-g="base" title="Afficher le planning de référence (barres grises)">Réf.</button>` : ''}
    <span class="bp-sum">Fin : <b>${chOfDn(s.end)}</b> · ${s.pEnd} j ouvrés${p.baseline ? ` · réf. ${chOfDn(dnOfIso(p.baseline.end) ?? p.baseline.end)} (${deltaTxt(s.end, dnOfIso(p.baseline.end) ?? p.baseline.end)})` : ''}${Ly.crit ? ` · <span style="color:${CO.crit}">■</span> critique` : ''}</span>
  </div>`;
  /* tableau */
  const head = cols.map(c => `<div class="bp-hc" style="width:${c.w}px;${c.n ? 'text-align:right' : ''}">${c.l}</div>`).join('');
  const body = rows.map(o => {
    const t = o.t, r = s.R.get(t.id);
    const cell = c => {
      let v = '';
      if (c.k === 'name') v = `${U.selMode ? '<span class="bp-ck"></span>' : ''}<span style="padding-left:${o.lvl * 16}px"></span><span class="bp-tw">${o.sum ? '▾' : t.ms ? '◆' : ''}</span><span class="nm">${esc(t.name)}</span>`;
      else v = esc(cellTxt(c.k, o, r, cm));
      return `<div class="bp-cell ${c.k === 'wbs' ? 'wbs' : c.k === 'name' ? '' : c.k === 'tf' ? 'num tf' : c.n ? 'num' : ''} ${c.k === 'name' ? 'nm-c' : ''}" style="width:${c.w}px">${v}</div>`;
    };
    return `<div class="bp-row ${o.sum ? 'sum' : ''} ${U.sel === t.id || U.msel.has(t.id) ? 'sel' : ''} ${U.msel.has(t.id) ? 'msel' : ''} ${r.late ? 'late' : ''} ${r.crit && !o.sum ? 'crit' : ''}" data-id="${esc(t.id)}" style="height:${RH}px" title="${esc(t.name)}${r.late ? ' — en retard' : ''}">${cols.map(cell).join('')}</div>`;
  }).join('') + `<div class="bp-row" style="height:${RH}px"><button class="bp-add" data-g="addT">${I.plus}Ajouter une tâche</button></div>`;
  /* échelle de temps */
  let th = '', bg = '';
  for (let d = d0; d <= d1; d++) {
    const dt = new Date(d * DAY), dd = dt.getUTCDate();
    if (dd === 1 || d === d0) { const w = Math.min(x(d1 + 1), x(d - dd + 1 + new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate())) - x(d);
      th += `<line x1="${x(d)}" y1="0" x2="${x(d)}" y2="${HEADH}" stroke="var(--line,#353a41)"/>`;
      if (w > (U.zoom === 'month' ? 40 : 76)) th += `<text x="${x(d) + 5}" y="17">${MONTHS[dt.getUTCMonth()]} ${U.zoom === 'month' && w < 60 ? String(dt.getUTCFullYear()).slice(2) : dt.getUTCFullYear()}</text>`; }
    if (U.zoom === 'day') { th += `<text class="mut" x="${x(d) + dw / 2}" y="${HEADH - 8}" text-anchor="middle">${dd}</text>`; if (wdOf(d) === 1) th += `<line x1="${x(d)}" y1="24" x2="${x(d)}" y2="${HEADH}" stroke="var(--line,#353a41)"/>`; }
    else if (U.zoom === 'week' && wdOf(d) === 1) th += `<line x1="${x(d)}" y1="24" x2="${x(d)}" y2="${HEADH}" stroke="var(--line,#353a41)"/><text class="mut" x="${x(d) + 3.5 * dw}" y="${HEADH - 8}" text-anchor="middle">S${isoWeek(d)}</text>`;
    else if (U.zoom === 'month' && wdOf(d) === 1 && isoWeek(d) % 2 === 0) th += `<text class="mut" x="${x(d) + 3.5 * dw}" y="${HEADH - 8}" text-anchor="middle" style="font-size:10px">${isoWeek(d)}</text>`;
    if (Ly.screen.weekend && !s.cal.isWork(d) && dw >= 3) bg += `<rect x="${x(d)}" y="0" width="${dw}" height="${bh}" fill="rgba(128,128,128,${s.cal.off.has(d) ? .2 : .1})"><title>${esc(s.cal.off.get(d) || (wdOf(d) === 0 ? 'Dimanche' : 'Samedi'))}</title></rect>`;
    else if (U.zoom !== 'day' && wdOf(d) === 1 && (s.cal.isWork(d) || !Ly.screen.weekend)) bg += `<line x1="${x(d)}" y1="0" x2="${x(d)}" y2="${bh}" stroke="rgba(128,128,128,.13)"/>`;
  }
  /* barres */
  const rowOf = new Map(rows.map((o, i) => [o.t.id, i]));
  let bars = '', arrows = '';
  const base = p.baseline && U.showBase ? p.baseline.tasks : null;
  rows.forEach((o, i) => {
    const t = o.t, r = s.R.get(t.id), y = i * RH;
    if (U.sel === t.id) bars += `<rect x="0" y="${y}" width="${cw}" height="${RH}" fill="var(--signal-soft,#3b3219)" opacity=".55"/>`;
    const bx = x(r.start), bw = Math.max(dw * .6, x(r.finish + 1) - bx);
    if (base && base[t.id]) { const b = base[t.id], a = dnOfIso(b.start) ?? b.start, e = dnOfIso(b.finish) ?? b.finish; bars += b.dur > 0 ? `<rect x="${x(a)}" y="${y + RH - 8}" width="${Math.max(2, x(e + 1) - x(a))}" height="4" rx="1" fill="${CO.base}"/>` : `<path d="M${x(b.mx ?? a)} ${y + RH - 10} l4 4 -4 4 -4 -4z" fill="${CO.base}"/>`; }
    const lbl = barLabel(Ly, o, r), cr = Ly.crit && r.crit, st = t.st || {}, on = U.sel === t.id || U.msel.has(t.id);
    const tcls = `${st.tc ? '' : 'mut'} ${st.b ? 'bd' : ''}`, tfill = st.tc ? ` style="fill:${esc(st.tc)}"` : '';
    /* texte de la barre : à droite (défaut), gauche, dessus, dessous, dans la barre */
    const txt = (str, x0, x1, ym, top, bot, fill, inside) => {
      if (!str) return '';
      const pos = st.pos || 'r';
      if (pos === 'i' && inside) { const n = Math.floor((x1 - x0 - 8) / (Ly.screen.font * .55)); if (n < 2) return ''; const v = str.length > n ? str.slice(0, n - 1) + '…' : str;
        return `<text class="${st.b ? 'bd' : ''}" x="${x0 + 4}" y="${ym + 4}" style="fill:${esc(st.tc || fill)}" pointer-events="none">${esc(v)}</text>`; }
      if (pos === 'l') return `<text class="${tcls}" x="${x0 - 8}" y="${ym + 4}" text-anchor="end"${tfill}>${esc(str)}</text>`;
      if (pos === 't') return `<text class="${tcls} sm" x="${x0}" y="${top - 3}"${tfill}>${esc(str)}</text>`;
      if (pos === 'b') return `<text class="${tcls} sm" x="${x0}" y="${bot + Ly.screen.font - 1}"${tfill}>${esc(str)}</text>`;
      return `<text class="${tcls}" x="${x1 + 18}" y="${ym + 4}"${tfill}>${esc(str)}</text>`;
    };
    const vert = st.pos === 't' || st.pos === 'b';
    if (o.sum) {
      const sy = vert ? (st.pos === 't' ? y + RH - 14 : y + 6) : y + RH / 2 - 6;
      bars += `<g class="bar sum" data-id="${esc(t.id)}"><path class="b" d="M${bx} ${sy}h${bw}v10l-5 -5h${-(bw - 10)}l-5 5z" fill="${t.col || CO.sum}"/></g>` + txt(lbl, bx, bx + bw, sy + 5, sy, sy + 10, '#fff', false);
    } else if (t.ms || r.dur === 0) {
      const cx = x(r.mx), cy = vert ? (st.pos === 't' ? y + RH - 11 : y + 11) : y + RH / 2;
      const mt = st.txt ? lbl : `${t.name} · ${shortOfDn(r.start)}`;
      bars += `<g class="bar ${on ? 'sel' : ''}" data-id="${esc(t.id)}"><path class="b" d="M${cx} ${cy - 8} l8 8 -8 8 -8 -8z" fill="${t.col || (r.done ? CO.done : cr ? CO.crit : CO.ms)}" ${t.col && cr ? `stroke="${CO.crit}" stroke-width="2"` : ''}/><circle class="lk" cx="${cx + 15}" cy="${cy}" r="5"/></g>`
        + (st.pos && st.pos !== 'i' ? txt(mt, st.pos === 'l' ? cx - 8 : cx - 8, cx + 6, cy, cy - 8, cy + 8, '', false) : `<text class="${st.b ? 'bd' : ''}" x="${cx + 24}" y="${cy + 4}"${tfill}>${esc(mt)}</text>`);
    } else {
      const col = t.col || (r.done ? CO.done : cr ? CO.crit : CO.task), pw = bw * Math.min(100, t.pct) / 100;
      let bh = Math.max(6, RH - 16); if (st.h === 's') bh = Math.max(4, Math.round(bh * .5)); else if (st.h === 'l') bh = RH - 8;
      if (vert) bh = Math.min(bh, Math.round(RH * .42));
      const by = vert ? (st.pos === 't' ? y + RH - bh - 4 : y + 4) : y + (RH - bh) / 2, ym = by + bh / 2;
      bars += `<g class="bar ${on ? 'sel' : ''}" data-id="${esc(t.id)}"><rect class="b" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="${col}" ${r.late ? `stroke="${CO.late}" stroke-width="2" stroke-dasharray="4 2"` : t.col && cr ? `stroke="${CO.crit}" stroke-width="2"` : ''}/>`
        + (st.pat === 'h' ? `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3" fill="url(#bpHatch)" pointer-events="none"/>` : '')
        + (pw > 0 ? `<rect x="${bx}" y="${ym - 2}" width="${pw}" height="4" fill="rgba(0,0,0,.45)" pointer-events="none"/>` : '')
        + `<rect class="rs" x="${bx + bw - 6}" y="${by - 3}" width="10" height="${bh + 6}"/><circle class="lk" cx="${bx + bw + 9}" cy="${ym}" r="5"/></g>`
        + txt(lbl, bx, bx + bw, ym, by, by + bh, inkOn(col), true);
    }
  });
  if (Ly.screen.links) for (const l of s.links) {
    const ip = rowOf.get(l.p), is = rowOf.get(l.s); if (ip == null || is == null) continue;
    const rp = s.R.get(l.p), rs = s.R.get(l.s);
    const pStart = rp.dur > 0 ? x(rp.start) : x(rp.mx), pEnd = rp.dur > 0 ? x(rp.finish + 1) : x(rp.mx), sStart = rs.dur > 0 ? x(rs.start) : x(rs.mx), sEnd = rs.dur > 0 ? x(rs.finish + 1) : x(rs.mx);
    const y1 = ip * RH + RH / 2, y2 = is * RH + RH / 2;
    const fromEnd = l.type === 'FS' || l.type === 'FF', toStart = l.type === 'FS' || l.type === 'SS';
    const x1 = fromEnd ? pEnd : pStart, x2 = toStart ? sStart - (rs.dur > 0 ? 0 : 8) : sEnd + (rs.dur > 0 ? 0 : 8);
    const o1 = fromEnd ? 1 : -1, o2 = toStart ? -1 : 1, a = x1 + 7 * o1, b = x2 + 7 * o2;
    let d;
    if (toStart && fromEnd && x2 - 7 >= a) d = `M${x1} ${y1}H${x2 - 7 > x1 + 7 ? x2 - 7 : a}V${y2}H${x2}`;
    else { const ym = y2 > y1 ? is * RH + 2 : is * RH + RH - 2; d = `M${x1} ${y1}H${a}V${ym}H${b}V${y2}H${x2}`; }
    const ac = Ly.crit && rp.crit && rs.crit;
    arrows += `<path class="arr" d="${d}" style="stroke:${ac ? CO.crit : 'var(--muted,#9da2a8)'}" marker-end="url(#bpAh${ac ? 'c' : ''})"/>`;
  }
  const tdn = todayDn(), today = tdn >= d0 && tdn <= d1 ? `<line x1="${x(tdn) + dw / 2}" y1="0" x2="${x(tdn) + dw / 2}" y2="${bh}" stroke="${CO.today}" stroke-width="2" stroke-dasharray="5 4"/>` : '';
  const wrapOld = $b('.bp-gwrap'), sl = wrapOld ? wrapOld.scrollLeft : null, stp = wrapOld ? wrapOld.scrollTop : null, oldZoom = wrapOld && wrapOld.dataset.z;
  main.innerHTML = bar + `<div class="bp-gwrap" data-z="${U.zoom}" style="font-size:${Ly.screen.font}px;--bp-cfs:${Ly.screen.font - 1}px"><div class="bp-grid" style="width:${tw + cw}px">
    <div class="bp-hrow" style="height:${HEADH}px"><div class="bp-c00" style="width:${tw}px">${head}</div>
    <div class="bp-c01" style="width:${cw}px"><svg class="bp-chart" width="${cw}" height="${HEADH}">${th}</svg></div></div>
    <div class="bp-brow"><div class="bp-c10" id="bpRows" style="width:${tw}px">${body}</div>
    <div style="flex:none"><svg class="bp-chart" id="bpChart" width="${cw}" height="${bh}"><defs>
      <marker id="bpAh" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--muted,#9da2a8)"/></marker>
      <marker id="bpAhc" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="${CO.crit}"/></marker>
      <pattern id="bpHatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)"><rect width="3" height="7" fill="rgba(255,255,255,.55)"/></pattern></defs>
      ${bg}${today}<g>${arrows}</g>${bars}</svg></div></div>
  </div></div>`;
  const wrap = $b('.bp-gwrap');
  U.gx = {d0, dw, x};
  if (sl != null && oldZoom === U.zoom) { wrap.scrollLeft = sl; wrap.scrollTop = stp; } else if (sl != null) { wrap.scrollTop = stp; scrollToday(); }
}
const fullCols = () => U.full === null ? !U.narrow : U.full;
function deltaTxt(a, b){ if (a == null || b == null) return ''; const d = U.cal.idx(a) - U.cal.idx(b); return d === 0 ? 'à l’heure' : d > 0 ? '+' + d + ' j' : d + ' j'; }
function scrollToday(){
  const w = $b('.bp-gwrap'); if (!w || !U.gx) return;
  const cols = gCols(LAY()), tw = cols.reduce((a, c) => a + c.w, 0);
  const sel = U.sel && U.sch.R.get(U.sel), tdn = todayDn();
  const target = sel ? sel.start : (tdn >= U.sch.cal.start - 7 && tdn <= U.sch.end ? tdn - 7 : U.sch.cal.start - 3);
  w.scrollLeft = Math.max(0, U.gx.x(target) - 20);
  void tw;
}

/* sélection, édition des tâches */
function select(id){ U.sel = id; render(); }
function insertTask(kind){
  const p = U.plan, s = U.sel && T(U.sel);
  const t = {id:uid(), name:kind === 'M' ? 'Jalon' : kind === 'L' ? 'Nouveau lot' : 'Nouvelle tâche', dur:kind === 'M' || kind === 'L' ? 0 : 5, ms:kind === 'M', parent:null, deps:[], asg:[], act:[], pct:0, lvl:0};
  if (kind === 'L') t.lot = true;
  mut(() => {
    const leaves = U.sch.ol.filter(o => !o.sum).map(o => o.t);
    if (s) {
      if (kind === 'L') t.parent = maxDepth(p) > 2 ? (s.parent || null) : null;
      else if (isSum(s.id) && depthOf(s) + 1 < maxDepth(p)) t.parent = s.id;
      else t.parent = s.parent || null;
      if (kind !== 'L' && !isSum(s.id)) t.deps = [{id:s.id, type:'FS', lag:0}];
      if (t.parent === s.id) p.tasks.push(t);
      else { let anc = s, g = 0; while (anc && (anc.parent || null) !== t.parent && g++ < 20) anc = T(anc.parent); p.tasks.splice(p.tasks.indexOf(anc || s) + 1, 0, t); }
    } else {
      const last = leaves[leaves.length - 1];
      if (kind !== 'L' && last) t.deps = [{id:last.id, type:'FS', lag:0}];
      p.tasks.push(t);
    }
    U.sel = t.id;
  });
  editTask(t.id, true);
}
function move(dir){
  const s = U.sel && T(U.sel); if (!s) return;
  mut(p => {
    const sib = kids(s.parent), i = sib.indexOf(s), j = i + dir; if (j < 0 || j >= sib.length) return false;
    const ia = p.tasks.indexOf(s), ib = p.tasks.indexOf(sib[j]);
    p.tasks[ia] = sib[j]; p.tasks[ib] = s;
  });
}
function indent(dir){
  const s = U.sel && T(U.sel); if (!s) return;
  const p = U.plan;
  if (dir > 0) {
    const sib = kids(s.parent), i = sib.indexOf(s); if (i <= 0) { toast('Pas de tâche au-dessus au même niveau'); return; }
    const np = sib[i - 1], sub = Math.max(0, ...[...descendants(s.id)].map(id => depthOf(T(id)) - depthOf(s)));
    if (depthOf(np) + 1 + sub >= maxDepth(p)) { toast(maxDepth(p) === 1 ? 'Structure « liste simple » : change-la dans Réglages' : 'Profondeur maximale atteinte (Réglages › Structure)'); return; }
    const lost = np.deps.length || np.asg.length || p.tasks.some(t => t.deps.some(d => d.id === np.id));
    mut(() => { s.parent = np.id; np.lot = true; np.deps = []; np.asg = []; np.ms = false; for (const t of p.tasks) t.deps = t.deps.filter(d => d.id !== np.id); });
    if (lost) toast(`« ${np.name} » devient un lot : ses liens et ressources sont retirés`, 4500);
  } else {
    if (!s.parent) return;
    const par = T(s.parent);
    mut(() => {
      const sib = kids(s.parent), i = sib.indexOf(s);
      for (const x of sib.slice(i + 1)) x.parent = s.id;
      if (sib.length > i + 1) { s.deps = []; s.asg = []; s.lot = true; s.ms = false; }
      s.parent = par.parent || null;
      p.tasks.splice(p.tasks.indexOf(s), 1); p.tasks.splice(p.tasks.indexOf(par) + 1, 0, s);
    });
  }
}
function linkPrev(){
  const s = U.sel && T(U.sel); if (!s || isSum(s.id)) return;
  const ol = U.sch.ol.filter(o => !o.sum), i = ol.findIndex(o => o.t.id === s.id);
  if (i <= 0) { toast('Pas de tâche au-dessus'); return; }
  const prev = ol[i - 1].t;
  if (s.deps.some(d => d.id === prev.id)) { toast('Déjà liée'); return; }
  tryLink(prev.id, s.id, 'FS', 0);
}
function tryLink(pid, sid, type, lag){
  const s = T(sid); if (!s || pid === sid) return false;
  const before = JSON.stringify(U.plan);
  s.deps.push({id:pid, type, lag});
  const test = schedule(U.plan, U.cal, U.statusDn);
  if (test.errs.length) { U.plan = JSON.parse(before); toast('Lien refusé : il créerait une boucle'); return false; }
  U.undo.push(before); U.redo = []; commit(); return true;
}
async function delTask(){
  if (U.msel.size > 1) {
    const ids = [...U.msel].filter(id => T(id)), gone = new Set(ids); for (const id of ids) for (const d of descendants(id)) gone.add(d);
    if (!await confirmDlg('Supprimer', `Supprimer les ${ids.length} tâches sélectionnées${gone.size > ids.length ? ` (et ${gone.size - ids.length} tâche(s) de leurs lots)` : ''} ?`, 'Supprimer', true)) return;
    mut(p => { p.tasks = p.tasks.filter(t => !gone.has(t.id)); for (const t of p.tasks) t.deps = t.deps.filter(x => !gone.has(x.id)); });
    U.msel.clear(); U.sel = null; render(); toast(`${gone.size} tâche(s) supprimée(s)`); return;
  }
  const s = U.sel && T(U.sel); if (!s) return;
  const d = descendants(s.id);
  if (d.size && !await confirmDlg('Supprimer le lot', `Supprimer « ${esc(s.name)} » et ses ${d.size} tâche(s) ?`, 'Supprimer', true)) return;
  const gone = new Set([s.id, ...d]);
  const ol = U.sch.ol, i = ol.findIndex(o => o.t.id === s.id);
  mut(p => { p.tasks = p.tasks.filter(t => !gone.has(t.id)); for (const t of p.tasks) t.deps = t.deps.filter(x => !gone.has(x.id)); });
  const nx = ol.slice(i + 1).find(o => !gone.has(o.t.id)) || ol.slice(0, i).reverse().find(o => !gone.has(o.t.id));
  U.sel = nx ? nx.t.id : null; render();
}
const unitOf = r => r ? (r.type === 'team' ? 'pers.' : r.type === 'machine' ? (r.unit || 'u.') : (r.unit || 'u.')) : '';
async function editTask(id, isNew){
  const p = U.plan, t = T(id); if (!t) return;
  const sum = isSum(id), r = U.sch.R.get(id), budMode = p.opts.budget;
  const leafOpts = except => U.sch.ol.filter(o => !o.sum && o.t.id !== id && !except.has(o.t.id)).map(o => `<option value="${esc(o.t.id)}">${o.wbs} ${esc(o.t.name)}</option>`).join('');
  const resOpts = p.res.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
  const depRow = d => `<div class="bp-li" data-dep><select data-k="id">${leafOpts(new Set())}</select><select data-k="type" style="flex:0 0 140px">${Object.entries(LINK).map(([k, v]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${k} · ${v}</option>`).join('')}</select><input data-k="lag" class="n" type="number" step="1" value="${+d.lag || 0}" title="Décalage en jours ouvrés (négatif = avance)"><span class="bp-hint">j</span><button class="bp-ib" data-rm title="Retirer">${I.x}</button></div>`;
  const colRow = `<div class="bp-f w"><span>Couleur de la barre</span><div class="bp-swl" id="tkCol" data-v="${esc(t.col || '')}"><button type="button" class="bp-btn" data-c="">Auto</button>${COLORS.concat(['#e5484d', '#6b7178']).map(c => `<button type="button" class="bp-sw" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}<label class="bp-sw bp-swc" title="Autre couleur"><input type="color" value="${esc(t.col || '#3e8ed0')}"></label></div></div>`;
  /* ligne ressource + période de présence (toute la durée / semaines / dates) ; plusieurs lignes pour la même ressource = plusieurs périodes */
  const perRow = a => { const m = perMode(a), w = 'style="width:58px;text-align:right"', sel = v => m === v ? 'selected' : '';
    return `<div class="bp-li bp-per" data-per><select data-k="r" style="flex:1 1 150px">${resOpts}</select><input data-k="q" type="number" step="any" min="0" value="${+a.q || 1}" title="Quantité (personnes, unités…)" style="flex:0 0 64px;text-align:right"><span class="bp-hint" data-u></span>`
      + `<select data-k="m" style="flex:0 0 150px" title="Période de présence"><option value="">Toute la durée</option><option value="w" ${sel('w')}>Semaines</option><option value="d" ${sel('d')}>Dates</option></select>`
      + `<span data-pw style="display:inline-flex;gap:4px;align-items:center"><span class="bp-hint">sem.</span><input data-k="w0" type="number" min="1" step="1" value="${Math.max(1, Math.round(+a.w0 || 1))}" title="De la semaine n° (1 = 1re semaine)" ${w}><span class="bp-hint">à</span><input data-k="w1" type="number" min="1" step="1" value="${+a.w1 || ''}" placeholder="fin" title="À la semaine n° (vide = jusqu’à la fin)" ${w}></span>`
      + `<span data-pd style="display:inline-flex;gap:4px;align-items:center"><input data-k="d0" type="date" value="${esc(a.d0 || '')}" title="Du (vide = dès le début)" style="width:150px"><span class="bp-hint">→</span><input data-k="d1" type="date" value="${esc(a.d1 || '')}" title="Au (vide = jusqu’à la fin)" style="width:150px"></span>`
      + `<span class="bp-hint" data-d style="flex:1 1 170px;font-size:12px"></span><span class="cost" data-c></span><button class="bp-ib" data-rm title="Retirer">${I.x}</button></div>`; };
  const perRead = row => { const g = k => row.querySelector(`[data-k=${k}]`).value, m = g('m'), a = {r:g('r'), q:+g('q') || 0};
    if (m === 'w') { const w0 = Math.max(1, Math.round(+g('w0') || 1)), w1 = Math.round(+g('w1') || 0); a.w0 = w0; a.w1 = w1 ? Math.max(w0, w1) : 0; if (w0 === 1 && !a.w1) delete a.w0, delete a.w1; }
    else if (m === 'd') { if (g('d0')) a.d0 = g('d0'); if (g('d1')) a.d1 = g('d1'); if (a.d0 && a.d1 && a.d1 < a.d0) [a.d0, a.d1] = [a.d1, a.d0]; }
    return a; };
  /* coûts, dates comptées et alerte (période en partie hors de la tâche / du lot) ; R = calcul de la tâche ou du lot */
  const perUpd = (wrap, R, scope) => { let tot = 0;
    wrap.querySelectorAll('[data-per]').forEach(row => { const a = perRead(row), m = row.querySelector('[data-k=m]').value, re = p.res.find(x => x.id === a.r), sp = asgSpan(U.cal, R, a), c = asgCost(p, a, sp.dur), dd = row.querySelector('[data-d]');
      tot += c; row.querySelector('[data-pw]').hidden = m !== 'w'; row.querySelector('[data-pd]').hidden = m !== 'd'; row.querySelector('[data-u]').textContent = unitOf(re);
      const per = sp.dur ? `${shortOfDn(U.cal.dnOf(sp.es))} → ${shortOfDn(U.cal.dnOf(sp.ef - 1))} · ${sp.dur} j` : '';
      dd.textContent = R.ef <= R.es ? '' : sp.out ? (sp.dur ? `⚠ en partie hors ${scope} · compté ${per}` : `⚠ hors des dates ${scope} : pas compté`) : m ? per || `hors des dates ${scope}` : '';
      dd.classList.toggle('warn', !!sp.out || (!!m && !sp.dur && R.ef > R.es)); row.querySelector('[data-c]').textContent = fmtN(c) + ' CHF'; });
    return tot; };
  const perPrefill = (wrap, getR) => wrap.addEventListener('change', e => { const m = e.target.closest('[data-k=m]'); if (!m) return; const row = m.closest('[data-per]'), R = getR();
    if (m.value === 'd' && !row.querySelector('[data-k=d0]').value && !row.querySelector('[data-k=d1]').value && R.ef > R.es) { row.querySelector('[data-k=d0]').value = isoOfDn(U.cal.dnOf(R.es)); row.querySelector('[data-k=d1]').value = isoOfDn(U.cal.dnOf(R.ef - 1)); } }, true);
  /* nouvelle ligne : même ressource que la précédente, période qui suit la sienne */
  const perNext = wrap => { const last = wrap.lastElementChild; if (!last) return {q:1}; const a = perRead(last), m = last.querySelector('[data-k=m]').value, n = {r:a.r, q:1};
    if (m === 'w') { n.w0 = a.w1 ? a.w1 + 1 : 1; n.w1 = 0; } else if (m === 'd') { const d1 = dnOfIso(a.d1); if (d1 != null) n.d0 = isoOfDn(d1 + 1); else n.d0 = ''; n.d1 = ''; if (!n.d0) n.d0 = a.d0 || ''; }
    return n; };
  /* copier / coller dans la fiche (lignes non encore enregistrées comprises) */
  const perClip = (b, wrap, add, start, upd) => {
    const bc = b.querySelector('[data-rcp]'), bp = b.querySelector('[data-rps]'); if (!bc) return;
    bc.onclick = () => { const rows = [...wrap.querySelectorAll('[data-per]')].map(perRead).filter(a => a.r && a.q > 0);
      if (!rows.length) { toast('Aucune ressource à copier'); return; }
      resClipSet(rows, start(), b.querySelector('#tkName').value.trim() || t.name); bp.disabled = false; toast(`${rows.length} ligne(s) copiée(s) : ouvre une autre tâche ou un autre lot puis Coller`); };
    bp.onclick = async () => { if (!RES_CLIP) return; const mode = wrap.children.length ? await resPasteAsk(1) : 'add'; if (!mode) return;
      if (mode === 'rep') wrap.innerHTML = ''; const c = resClipRows(start()); c.rows.forEach(add); upd();
      toast(`${c.rows.length} ligne(s) collée(s) de « ${RES_CLIP.from} »${resMissTxt(c.miss)}`); };
  };
  const lotWk = sum && r.dur > 0 ? Math.ceil((r.finish - r.start + 1) / 7) : 0;
  const body = sum ? `
    <label class="bp-f"><span>Nom du lot</span><input id="tkName" value="${esc(t.name)}" ${isNew ? 'autofocus' : ''}></label>
    <p class="bp-hint">Lot : ses dates (${shortOfDn(r.start)} → ${shortOfDn(r.finish)}, ${r.dur} j${lotWk ? ', ' + lotWk + ' semaine' + (lotWk > 1 ? 's' : '') : ''}) sont celles de ses tâches ; son coût = ses tâches + ses ressources ci-dessous.</p>
    <h4>Ressources du lot <span class="bp-hint">(en plus de celles des tâches : chef d’équipe, grue, installations…)</span></h4>
    ${p.res.length ? `<div class="bp-lst" id="tkLres"></div>
    <div><button class="bp-btn" id="tkLresAdd">${I.plus}Ressource</button> <button class="bp-btn" data-rcp title="Copier ces ressources (pour les coller dans une autre tâche ou un autre lot)">${I.copy}Copier</button> <button class="bp-btn" data-rps title="Coller les ressources copiées" ${RES_CLIP ? '' : 'disabled'}>${I.paste}Coller</button> <span class="bp-hint">Période : toute la durée du lot, semaines du lot (suivent le lot s’il se décale ; « à » vide = jusqu’à la fin) ou dates fixes (du … au …). Plusieurs lignes pour la même ressource = effectif qui varie ou plusieurs périodes de présence (ex. grue du 12.04 au 30.04 puis du 01.06 au 19.06).</span></div>
    <p class="bp-hint" id="tkLInfo"></p>` : '<p class="bp-hint">Aucune ressource : crée-les dans l’onglet Ressources.</p>'}
    <label class="bp-f"><span>Zone (secteur, bâtiment… ; reprise par ses tâches)</span><input id="tkZone" list="tkZones" value="${esc(t.zone || '')}"><datalist id="tkZones">${zonesOf(p).map(z => `<option value="${esc(z)}">`).join('')}</datalist></label>
    ${colRow}
    <label class="bp-f"><span>Remarque</span><textarea id="tkNote" rows="2">${esc(t.note || '')}</textarea></label>` : `
    <div class="bp-form">
      <label class="bp-f w"><span>Nom</span><input id="tkName" value="${esc(t.name)}" ${isNew ? 'autofocus' : ''}></label>
      <label class="bp-f"><span>Type</span><select id="tkMs"><option value="0">Tâche</option><option value="1" ${t.ms ? 'selected' : ''}>Jalon (durée 0)</option></select></label>
      <label class="bp-f" id="tkDurF"><span>Durée (jours ouvrés)</span><input id="tkDur" type="number" min="0" step="1" value="${t.dur}"></label>
      <label class="bp-f"><span>Début au plus tôt (vide = dès que possible)</span><input id="tkSnet" type="date" value="${esc(t.snet || '')}"></label>
      <label class="bp-f"><span>Zone (secteur, bâtiment… ; vide = celle du lot)</span><input id="tkZone" list="tkZones" value="${esc(t.zone || '')}"><datalist id="tkZones">${zonesOf(p).map(z => `<option value="${esc(z)}">`).join('')}</datalist></label>
    </div>
    <h4>Prédécesseurs</h4><div class="bp-lst" id="tkDeps"></div>
    <div><button class="bp-btn" id="tkDepAdd">${I.plus}Lien</button> <span class="bp-hint">FS = commence à la fin · SS = commence avec · FF = finit avec · SF = finit au début. Décalage : ex. +3 j séchage.</span></div>
    <h4>Ressources ${p.res.length ? '' : '<span class="bp-hint">(aucune : crée-les dans l’onglet Ressources)</span>'}</h4><div class="bp-lst" id="tkAsg"></div>
    ${p.res.length ? `<div><button class="bp-btn" id="tkAsgAdd">${I.plus}Ressource</button> <button class="bp-btn" data-rcp title="Copier ces ressources (pour les coller dans une autre tâche ou un autre lot)">${I.copy}Copier</button> <button class="bp-btn" data-rps title="Coller les ressources copiées" ${RES_CLIP ? '' : 'disabled'}>${I.paste}Coller</button> <span class="bp-hint">Équipe : nombre de personnes · Machine : nombre d’unités · Sous-traitant / fourniture : quantité totale. Période : toute la tâche, semaines de la tâche ou dates fixes ; plusieurs lignes pour la même ressource = plusieurs périodes de présence.</span></div>` : ''}
    <div class="bp-form">
      ${budMode !== 'res' ? `<label class="bp-f"><span>Montant budgété${budMode === 'mix' ? ' en plus des ressources' : ''} (CHF)</span><input id="tkBud" type="number" step="any" value="${t.bud ?? ''}"></label>` : ''}
      <label class="bp-f"><span>Avancement : <b id="tkPctV">${Math.round(t.pct)}</b> %</span><input id="tkPct" type="range" min="0" max="100" step="5" value="${Math.round(t.pct)}"></label>
      <label class="bp-f"><span>Début réel</span><input id="tkAS" type="date" value="${esc(t.aStart || '')}"></label>
      <label class="bp-f"><span>Fin réelle</span><input id="tkAE" type="date" value="${esc(t.aEnd || '')}"></label>
      ${colRow}
      <label class="bp-f w"><span>Remarque</span><textarea id="tkNote" rows="2">${esc(t.note || '')}</textarea></label>
    </div>
    <p class="bp-hint" id="tkInfo"></p>`;
  const box = await dlg({title:sum ? 'Lot' : isNew ? 'Nouvelle tâche' : 'Tâche ' + wbsOf(id), width:sum ? (p.res.length ? 900 : 520) : 760, body,
    buttons:[{label:'Supprimer', value:'del', dang:true, left:true}, {label:'Annuler', value:null}, {label:'Enregistrer', pri:true}],
    onOpen:b => {
      const cb = b.querySelector('#tkCol'), cSet = v => { cb.dataset.v = v; cb.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x.dataset.c === v)); const ci = cb.querySelector('input'), cu = !!v && !cb.querySelector(`[data-c="${v}"]`); ci.parentElement.classList.toggle('on', cu); ci.parentElement.style.background = cu ? v : ''; };
      cSet(cb.dataset.v); cb.addEventListener('click', e => { const x = e.target.closest('[data-c]'); if (x) cSet(x.dataset.c); });
      cb.querySelector('input').addEventListener('input', e => cSet(e.target.value));
      if (sum) {
        const lw = b.querySelector('#tkLres'); if (!lw) return;
        const updL = () => { const tot = perUpd(lw, r, 'du lot');
          b.querySelector('#tkLInfo').textContent = lw.children.length ? `Coût des ressources du lot : ${fmtN(tot)} CHF${budMode === 'man' ? ' (pas compté dans le budget : source = montants saisis, voir Réglages)' : ''}` : ''; };
        const addL = a => { lw.insertAdjacentHTML('beforeend', perRow(a)); lw.lastElementChild.querySelector('[data-k=r]').value = a.r || (p.res[0] && p.res[0].id); updL(); };
        (t.lres || []).forEach(addL);
        b.querySelector('#tkLresAdd').onclick = () => addL(perNext(lw));
        perPrefill(lw, () => r); perClip(b, lw, addL, () => r.es, updL);
        b.addEventListener('click', e => { const x = e.target.closest('[data-rm]'); if (x) { x.parentElement.remove(); updL(); } });
        b.addEventListener('input', updL); b.addEventListener('change', updL);
        return;
      }
      const deps = b.querySelector('#tkDeps'), asg = b.querySelector('#tkAsg');
      const addDep = d => { deps.insertAdjacentHTML('beforeend', depRow(d)); const row = deps.lastElementChild; if (d.id) row.querySelector('[data-k=id]').value = d.id; };
      const upd = () => {
        const ms = b.querySelector('#tkMs').value === '1', dur = ms ? 0 : Math.max(0, Math.round(+b.querySelector('#tkDur').value || 0));
        b.querySelector('#tkDurF').hidden = ms;
        const tot = perUpd(asg, Rt(), 'de la tâche');
        const man = b.querySelector('#tkBud') ? +b.querySelector('#tkBud').value || 0 : 0;
        const bud = budMode === 'res' ? tot : budMode === 'man' ? man : tot + man;
        b.querySelector('#tkInfo').textContent = `Calcul actuel : ${shortOfDn(r.start)} → ${shortOfDn(r.finish)} · marge ${r.tf} j${r.crit ? ' · chemin critique' : ''} · budget ${fmtN(bud)} CHF`;
        b.querySelector('#tkPctV').textContent = b.querySelector('#tkPct').value;
      };
      /* calcul de la tâche avec la durée saisie dans la fiche (pour les périodes) */
      const Rt = () => { const ms = b.querySelector('#tkMs').value === '1', d = ms ? 0 : Math.max(0, Math.round(+b.querySelector('#tkDur').value || 0)); return {es:r.es, ef:r.es + d, start:U.cal.dnOf(r.es)}; };
      const addAsg = a => { asg.insertAdjacentHTML('beforeend', perRow(a)); const row = asg.lastElementChild; row.querySelector('[data-k=r]').value = a.r || (p.res[0] && p.res[0].id); upd(); };
      perPrefill(asg, Rt); perClip(b, asg, addAsg, () => r.es, upd);
      t.deps.forEach(addDep); t.asg.forEach(addAsg);
      b.querySelector('#tkDepAdd').onclick = () => addDep({type:'FS', lag:0});
      const aa = b.querySelector('#tkAsgAdd'); if (aa) aa.onclick = () => addAsg(asg.children.length ? perNext(asg) : {q:1});
      b.addEventListener('click', e => { const x = e.target.closest('[data-rm]'); if (x) { x.parentElement.remove(); upd(); } });
      b.addEventListener('input', upd); b.addEventListener('change', upd);
      b.querySelector('#tkPct').addEventListener('input', () => { if (+b.querySelector('#tkPct').value === 100 && !b.querySelector('#tkAE').value) b.querySelector('#tkAE').value = isoOfDn(Math.min(todayDn(), r.finish)); if (+b.querySelector('#tkPct').value > 0 && !b.querySelector('#tkAS').value) b.querySelector('#tkAS').value = isoOfDn(Math.min(todayDn(), r.start)); });
      upd();
    }});
  if (box === 'del') { U.sel = id; delTask(); return; }
  if (!box) return;
  const before = JSON.stringify(U.plan);
  t.name = box.querySelector('#tkName').value.trim() || t.name;
  t.note = box.querySelector('#tkNote').value.trim();
  { const z = box.querySelector('#tkZone').value.trim(); if (z) t.zone = z; else delete t.zone; }
  const tc = box.querySelector('#tkCol').dataset.v; if (tc) t.col = tc; else delete t.col;
  if (sum && box.querySelector('#tkLres')) {
    const l = [...box.querySelectorAll('#tkLres [data-per]')].map(perRead).filter(a => a.r && a.q > 0);
    if (l.length) t.lres = l; else delete t.lres;
  }
  if (!sum) {
    t.ms = box.querySelector('#tkMs').value === '1';
    t.dur = t.ms ? 0 : Math.max(0, Math.round(+box.querySelector('#tkDur').value || 0));
    t.snet = box.querySelector('#tkSnet').value || undefined; if (!t.snet) delete t.snet; else t.lvl = 0;
    const seen = new Set();
    t.deps = [...box.querySelectorAll('[data-dep]')].map(row => ({id:row.querySelector('[data-k=id]').value, type:row.querySelector('[data-k=type]').value, lag:Math.round(+row.querySelector('[data-k=lag]').value || 0)})).filter(d => d.id && !seen.has(d.id) && seen.add(d.id));
    t.asg = [...box.querySelectorAll('#tkAsg [data-per]')].map(perRead).filter(a => a.r && a.q > 0);
    if (box.querySelector('#tkBud')) { const v = box.querySelector('#tkBud').value; if (v === '') delete t.bud; else t.bud = +v; }
    t.pct = +box.querySelector('#tkPct').value || 0;
    t.aStart = box.querySelector('#tkAS').value || undefined; if (!t.aStart) delete t.aStart;
    t.aEnd = box.querySelector('#tkAE').value || undefined; if (!t.aEnd) delete t.aEnd;
    if (t.aEnd && t.pct < 100) t.pct = 100;
    const test = schedule(U.plan, U.cal, U.statusDn);
    if (test.errs.length) { U.plan = JSON.parse(before); toast('Liens refusés : ils créeraient une boucle'); render(); return; }
  }
  U.undo.push(before); U.redo = []; commit();
}

/* style des barres (une ou plusieurs tâches) : t.col + t.st = {pos, txt, b, tc, h, pat} ; valeur commune affichée, « inchangé » si elles diffèrent */
const ST_F = {
  pos:['Position du texte', [['', 'À droite (défaut)'], ['l', 'À gauche'], ['t', 'Au-dessus'], ['b', 'En dessous'], ['i', 'Dans la barre']]],
  txt:['Texte affiché', [['', 'Comme la mise en page'], ['name', 'Nom de la tâche'], ['res', 'Ressources'], ['both', 'Nom + ressources'], ['nd', 'Nom + dates'], ['dates', 'Dates'], ['dur', 'Durée'], ['none', 'Rien']]],
  b:['Texte', [['', 'Normal'], ['1', 'Gras']]],
  h:['Hauteur de la barre', [['', 'Normale'], ['s', 'Fine'], ['l', 'Épaisse']]],
  pat:['Remplissage', [['', 'Plein'], ['h', 'Hachuré']]]};
const TXT_COLS = ['#1b1d21', '#6b7178', '#e5484d', '#3e8ed0', '#4caf7a', '#e8a33d', '#9b6fd6', '#ffffff'];
async function styleDlg(ids){
  ids = ids.filter(id => T(id)); if (!ids.length) return;
  const ts = ids.map(T), MIX = '*';
  const com = f => { const v = ts.map(f); return v.every(x => x === v[0]) ? v[0] : MIX; };
  const vCol = com(t => t.col || ''), vTc = com(t => (t.st && t.st.tc) || ''), vZn = com(t => t.zone || ''), vs = {};
  for (const k in ST_F) vs[k] = com(t => String((t.st && t.st[k]) || ''));
  const sw = (id, v, cols, auto) => `<div class="bp-swl" id="${id}" data-v="${esc(v)}">${v === MIX ? '<button type="button" class="bp-btn" data-c="*">Inchangé</button>' : ''}<button type="button" class="bp-btn" data-c="">${auto}</button>${cols.map(c => `<button type="button" class="bp-sw" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')}<label class="bp-sw bp-swc" title="Autre couleur"><input type="color" value="${esc(v && v !== MIX ? v : '#3e8ed0')}"></label></div>`;
  const selF = k => `<label class="bp-f"><span>${ST_F[k][0]}</span><select data-st="${k}">${vs[k] === MIX ? '<option value="*" selected>— inchangé (différent) —</option>' : ''}${ST_F[k][1].map(([v, l]) => `<option value="${v}" ${vs[k] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
  const body = `<p class="bp-hint">${ids.length > 1 ? `${ids.length} tâches sélectionnées. ` : ''}Ces réglages s’affichent à l’écran, dans le PDF et à l’impression. « Inchangé » garde la valeur propre à chaque tâche.</p>
    <div class="bp-f w"><span>Couleur de la barre</span>${sw('stCol', vCol, COLORS.concat(['#e5484d', '#6b7178']), 'Auto')}</div>
    <div class="bp-form">${selF('pos')}${selF('txt')}${selF('b')}${selF('h')}${selF('pat')}</div>
    <div class="bp-f w"><span>Couleur du texte</span>${sw('stTc', vTc, TXT_COLS, 'Auto')}</div>
    <label class="bp-f"><span>Zone (impression par zone)</span><input id="stZone" list="stZones" value="${esc(vZn === MIX ? '' : vZn)}" placeholder="${vZn === MIX ? '— inchangé (différent) —' : 'aucune'}"><datalist id="stZones">${zonesOf(U.plan).map(z => `<option value="${esc(z)}">`).join('')}</datalist></label>`;
  const b = await dlg({title:ids.length > 1 ? 'Style de ' + ids.length + ' tâches' : 'Style · ' + T(ids[0]).name, width:620, body,
    buttons:[{label:'Tout par défaut', value:'reset', left:true}, {label:'Annuler', value:null}, {label:'Appliquer', pri:true}],
    onOpen:bx => bx.querySelectorAll('.bp-swl').forEach(cb => {
      const cSet = v => { cb.dataset.v = v; cb.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x.dataset.c === v)); const ci = cb.querySelector('input'), cu = !!v && v !== MIX && !cb.querySelector(`[data-c="${v}"]`); ci.parentElement.classList.toggle('on', cu); ci.parentElement.style.background = cu ? v : ''; };
      cSet(cb.dataset.v); cb.addEventListener('click', e => { const x = e.target.closest('[data-c]'); if (x) cSet(x.dataset.c); });
      cb.querySelector('input').addEventListener('input', e => cSet(e.target.value));
    })});
  if (!b) return;
  mut(() => {
    for (const t of ts) {
      const zn = b !== 'reset' && b.querySelector('#stZone').value.trim();
      if (b !== 'reset' && (zn || vZn !== MIX)) { if (zn) t.zone = zn; else delete t.zone; }
      if (b === 'reset') { delete t.col; delete t.st; continue; }
      const st = Object.assign({}, t.st || {}), c = b.querySelector('#stCol').dataset.v, tc = b.querySelector('#stTc').dataset.v;
      if (c !== MIX) { if (c) t.col = c; else delete t.col; }
      if (tc !== MIX) st.tc = tc;
      b.querySelectorAll('[data-st]').forEach(x => { if (x.value !== MIX) st[x.dataset.st] = x.value; });
      for (const k in st) if (!st[k]) delete st[k];
      if (st.b) st.b = 1;
      if (Object.keys(st).length) t.st = st; else delete t.st;
    }
  });
  toast(b === 'reset' ? 'Style remis par défaut' : ids.length > 1 ? `Style appliqué à ${ids.length} tâches` : 'Style appliqué');
}

/* glisser les barres : souris et stylet (le doigt fait défiler) */
function chartDown(e){
  const g = e.target.closest('.bar'); if (!g) return;
  const id = g.dataset.id, t = T(id); if (!t) return;
  if (e.pointerType === 'touch') return;
  if (g.classList.contains('sum')) { return; }
  const mode = e.target.classList.contains('lk') ? 'link' : e.target.classList.contains('rs') ? 'resize' : 'move';
  U.drag = {id, mode, x0:e.clientX, y0:e.clientY, moved:false, g, pid:e.pointerId};
  try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
  e.preventDefault();
}
function chartMove(e){
  const d = U.drag; if (!d || e.pointerId !== d.pid) return;
  const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
  if (!d.moved && Math.hypot(dx, dy) < 4) return;
  d.moved = true;
  if (d.mode === 'move') d.g.setAttribute('transform', `translate(${Math.round(dx / U.gx.dw) * U.gx.dw} 0)`);
  else if (d.mode === 'resize') { const b = d.g.querySelector('rect.b'); if (!d.w0) d.w0 = +b.getAttribute('width'); b.setAttribute('width', Math.max(U.gx.dw, d.w0 + Math.round(dx / U.gx.dw) * U.gx.dw)); }
  else {
    const svg = $b('#bpChart'), rc = svg.getBoundingClientRect(), r = U.sch.R.get(d.id), x1 = (r.dur > 0 ? U.gx.x(r.finish + 1) : U.gx.x(r.mx)), y1 = U.sch.ol.findIndex(o => o.t.id === d.id) * RH + RH / 2;
    let ln = svg.querySelector('#bpLinkLn'); if (!ln) { ln = document.createElementNS('http://www.w3.org/2000/svg', 'line'); ln.id = 'bpLinkLn'; ln.setAttribute('stroke', '#f2c230'); ln.setAttribute('stroke-width', '2'); ln.setAttribute('stroke-dasharray', '4 3'); svg.appendChild(ln); }
    ln.setAttribute('x1', x1); ln.setAttribute('y1', y1); ln.setAttribute('x2', e.clientX - rc.left); ln.setAttribute('y2', e.clientY - rc.top);
  }
}
function chartUp(e){
  const d = U.drag; if (!d || e.pointerId !== d.pid) return; U.drag = null;
  const t = T(d.id), r = U.sch.R.get(d.id);
  if (!d.moved) { tapRow(d.id, e); return; }
  const days = Math.round((e.clientX - d.x0) / U.gx.dw);
  if (d.mode === 'link') {
    const el = document.elementFromPoint(e.clientX, e.clientY), g = el && el.closest && el.closest('#bpChart .bar'), row = el && el.closest && el.closest('#bpRows .bp-row[data-id]');
    const tid = (g && g.dataset.id) || (row && row.dataset.id);
    if (tid && tid !== d.id && !isSum(tid)) { if (!T(tid).deps.some(x => x.id === d.id)) tryLink(d.id, tid, 'FS', 0); else render(); } else render();
    return;
  }
  if (!days) { render(); return; }
  if (d.mode === 'move') {
    if (t.aStart) { toast('Tâche commencée : change la date de début réel dans la fiche'); render(); return; }
    const nd = U.cal.dnOf(U.cal.idx((r.dur > 0 ? r.start : r.mx) + days));
    mut(() => { t.snet = isoOfDn(nd); t.lvl = 0; });
    const r2 = U.sch.R.get(d.id); if (r2.start > nd) toast('Début limité par les liens : ' + chOfDn(r2.start));
  } else {
    const nf = r.finish + days, nd = Math.max(1, U.cal.idx(nf) + (U.cal.isWork(nf) ? 1 : 0) - r.es);
    mut(() => { t.dur = nd; t.ms = false; });
  }
}
function tapRow(id, e){
  const add = e && (e.ctrlKey || e.metaKey), rng = e && e.shiftKey && U.sel && U.sel !== id;
  if (U.selMode || add) {
    if (!U.msel.size && U.sel && U.sel !== id && add) U.msel.add(U.sel);
    if (U.msel.has(id)) { U.msel.delete(id); if (U.sel === id) U.sel = [...U.msel].pop() || null; } else { U.msel.add(id); U.sel = id; }
    render(); return;
  }
  if (rng) { const ol = U.sch.ol, a = ol.findIndex(o => o.t.id === U.sel), b = ol.findIndex(o => o.t.id === id);
    U.msel = new Set(ol.slice(Math.min(a, b), Math.max(a, b) + 1).map(o => o.t.id)); U.sel = id; render(); return; }
  if (U.msel.size) { U.msel.clear(); U.sel = id; render(); return; }
  const now = Date.now(), dbl = U.tap.id === id && now - U.tap.t < 450;
  U.tap = {id, t:now};
  if (U.sel === id && (dbl || (e && e.pointerType !== 'mouse'))) { editTask(id); return; }
  select(id);
}

/* ---------- Ressources ---------- */
function resStats(){
  const p = U.plan, s = U.sch, L = loads(p, s), ov = overloads(p, s, L), st = {};
  for (const r of p.res) st[r.id] = {cost:0, qty:0, max:0, over:0, tasks:[]};
  for (const o of s.ol) { const R = s.R.get(o.t.id); if (!R) continue;
    for (const x of o.sum ? lotSpans(p, s, o.t) : taskSpans(s.cal, R, o.t)) { const y = st[x.a.r]; if (!y) continue; y.cost += asgCost(p, x.a, x.dur); y.qty += (+x.a.q || 0) * (RTYPES[(p.res.find(z => z.id === x.a.r) || {}).type]?.time ? x.dur : 1);
      y.tasks.push({o, a:x.a, r:x.dur || !perMode(x.a) ? {start:x.dur ? s.cal.dnOf(x.es) : R.start, finish:x.dur ? s.cal.dnOf(x.ef - 1) : R.finish, dur:x.dur} : {start:null, finish:null, dur:0}, lot:o.sum}); } }
  for (const [rid, m] of L) { for (const v of m.values()) st[rid].max = Math.max(st[rid].max, v); }
  for (const o of ov) st[o.r].over++;
  return {L, ov, st};
}
function renderRes(){
  const p = U.plan, main = $b('#bpMain'), {L, ov, st} = resStats();
  if (!U.resSel || !p.res.find(r => r.id === U.resSel)) U.resSel = p.res[0] && p.res[0].id;
  const qtyTxt = (r, x) => r.type === 'team' ? fmtN(x.qty * (+p.opts.hpd || 8.5)) + ' h' : r.type === 'machine' ? fmtN(x.qty) + ' j' : fmtN(x.qty, 2) + ' ' + esc(r.unit || '');
  const rows = p.res.map(r => { const x = st[r.id], ty = RTYPES[r.type] || RTYPES.team;
    return `<tr data-r="${esc(r.id)}" class="${U.resSel === r.id ? 'on' : ''}"><td><span class="bp-dot" style="background:${esc(r.color || '#888')}"></span>${esc(r.name)}</td><td>${ty.label}</td>`
      + `<td class="n">${ty.time ? fmtN(r.cap, r.cap % 1 ? 1 : 0) + ' ' + unitOf(r) : '–'}</td><td class="n">${fmtN(r.rate, 2)} ${ty.rateUnit}</td><td class="n">${qtyTxt(r, x)}</td><td class="n">${fmtN(x.cost)}</td>`
      + `<td class="n ${x.over ? 'bp-neg' : ''}">${ty.time ? (x.over ? x.over + ' j' : 'ok') : ''}</td><td><button class="bp-ib" data-redit="${esc(r.id)}" title="Modifier">${I.edit}</button></td></tr>`; }).join('');
  const tot = p.res.reduce((a, r) => a + st[r.id].cost, 0);
  const sel = p.res.find(r => r.id === U.resSel);
  const lvlOn = p.tasks.some(t => t.lvl > 0);
  main.innerHTML = `<div class="bp-pane"><div class="bp-cols">
    <div class="bp-card"><h3>Ressources du chantier <button class="bp-btn" data-rnew>${I.plus}Ressource</button></h3>
      ${p.res.length ? `<div style="overflow:auto"><table class="bp-tbl"><thead><tr><th>Nom</th><th>Type</th><th class="n">Capacité</th><th class="n">Tarif</th><th class="n">Prévu</th><th class="n">Coût CHF</th><th class="n">Surcharge</th><th></th></tr></thead><tbody>${rows}
        <tr class="tot"><td colspan="5">Total ressources</td><td class="n">${fmtN(tot)}</td><td colspan="2"></td></tr></tbody></table></div>`
        : '<p class="bp-hint">Ajoute tes équipes (CHF/h par personne), machines (CHF/jour), sous-traitants et fournitures (CHF par unité), puis affecte-les aux tâches (fiche de la tâche).</p>'}
      <p class="bp-hint">Équipe : coût = personnes × jours × ${fmtN(p.opts.hpd, 1)} h × tarif · Machine : unités × jours × tarif · Sous-traitant / fourniture : quantité × prix unitaire.</p>
    </div>
    <div class="bp-card"><h3>Charge ${sel ? '· ' + esc(sel.name) : ''}</h3>${sel ? histo(sel, L.get(sel.id), st[sel.id]) : '<p class="bp-hint">Sélectionne une ressource.</p>'}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="bp-btn ${ov.length ? 'pri' : ''}" data-a="level">${I.lvl}Proposer un lissage${ov.length ? ' (' + new Set(ov.map(o => o.r + o.i)).size + ' j en surcharge)' : ''}</button>${lvlOn ? `<button class="bp-btn" data-unlvl>Retirer le lissage</button>` : ''}</div>
    </div></div></div>`;
}
function histo(r, m, x){
  const p = U.plan, s = U.sch;
  if (!RTYPES[r.type].time) {
    return `<p class="bp-hint">${RTYPES[r.type].label} : pas de capacité journalière, seulement des quantités et des coûts.</p>` + taskList(x);
  }
  const end = Math.max(s.pEnd, 1), cap = +r.cap || 0;
  const wk = end > 70, n = wk ? Math.ceil(end / 5) : end;
  const val = k => { if (!wk) return (m && m.get(k)) || 0; let mx = 0; for (let i = k * 5; i < k * 5 + 5; i++) mx = Math.max(mx, (m && m.get(i)) || 0); return mx; };
  let mx = cap; for (let k = 0; k < n; k++) mx = Math.max(mx, val(k)); mx = Math.max(mx, 1);
  const W = Math.max(320, Math.min(1400, n * (wk ? 14 : 12))), Hh = 170, bw = W / n, y = v => Hh - 22 - (v / mx) * (Hh - 40);
  let bars = '';
  for (let k = 0; k < n; k++) { const v = val(k); if (!v) continue; const d0 = s.cal.dnOf(wk ? k * 5 : k);
    bars += `<rect x="${k * bw + 1}" y="${y(v)}" width="${Math.max(1, bw - 2)}" height="${Hh - 22 - y(v)}" fill="${v > cap + 1e-9 ? '#e5484d' : r.color || '#3e8ed0'}"><title>${wk ? 'Semaine du ' : ''}${chOfDn(d0)} : ${fmtN(v, v % 1 ? 1 : 0)} ${unitOf(r)}${wk ? ' (max/jour)' : ''}${v > cap ? ' > capacité ' + cap : ''}</title></rect>`; }
  let ticks = ''; const step = Math.max(1, Math.ceil(n / 8));
  for (let k = 0; k < n; k += step) ticks += `<text x="${k * bw + 2}" y="${Hh - 6}" class="mut" style="font-size:11px">${shortOfDn(s.cal.dnOf(wk ? k * 5 : k)).slice(0, 5)}</text>`;
  const svg = `<div style="overflow:auto"><svg class="bp-chart" width="${W}" height="${Hh}">${bars}${cap ? `<line x1="0" x2="${W}" y1="${y(cap)}" y2="${y(cap)}" stroke="var(--signal,#f2c230)" stroke-width="2" stroke-dasharray="6 4"/><text x="4" y="${y(cap) - 5}" style="font-size:11px">capacité ${fmtN(cap, cap % 1 ? 1 : 0)} ${unitOf(r)}</text>` : ''}${ticks}</svg></div>`;
  const per = []; let cur = null;
  if (m) for (let i = 0; i <= end; i++) { const v = m.get(i) || 0; if (v > cap + 1e-9) { if (cur && cur.b === i - 1) { cur.b = i; cur.v = Math.max(cur.v, v); } else per.push(cur = {a:i, b:i, v}); } }
  return svg + `<p class="bp-hint">${wk ? 'Une barre = une semaine (charge maximale du jour). ' : 'Une barre = un jour ouvré. '}${per.length ? '<b class="bp-neg">Surcharge</b> : ' + per.slice(0, 8).map(q => `${shortOfDn(s.cal.dnOf(q.a))}${q.b > q.a ? '–' + shortOfDn(s.cal.dnOf(q.b)) : ''} (${fmtN(q.v, q.v % 1 ? 1 : 0)}/${fmtN(cap, cap % 1 ? 1 : 0)})`).join(', ') + (per.length > 8 ? '…' : '') : 'Aucune surcharge.'}</p>` + taskList(x);
}
function taskList(x){
  if (!x.tasks.length) return '<p class="bp-hint">Affectée à aucune tâche.</p>';
  return `<table class="bp-tbl"><thead><tr><th>Tâche</th><th class="n">Quantité</th><th class="n">Début</th><th class="n">Fin</th><th class="n">CHF</th></tr></thead><tbody>${x.tasks.map(({o, a, r, lot}) =>
    `<tr data-goto="${esc(o.t.id)}" style="cursor:pointer"><td>${o.wbs} ${esc(o.t.name)}${lot || perMode(a) ? ` <span class="bp-hint">(${[lot ? 'lot' : '', perTxt(a)].filter(Boolean).join(', ')})</span>` : ''}</td><td class="n">${fmtN(a.q, a.q % 1 ? 2 : 0)}</td><td class="n">${r.start == null ? '–' : shortOfDn(r.start)}</td><td class="n">${r.finish == null ? 'hors dates' : shortOfDn(r.finish)}</td><td class="n">${fmtN(asgCost(U.plan, a, r.dur))}</td></tr>`).join('')}</tbody></table>`;
}
async function editRes(id){
  const p = U.plan, r = id ? p.res.find(x => x.id === id) : {id:uid(), name:'', type:'team', unit:'pers.', rate:0, cap:1, color:resColor(p)};
  const used = id && p.tasks.some(t => t.asg.some(a => a.r === id) || (t.lres || []).some(a => a.r === id));
  const box = await dlg({title:id ? 'Ressource' : 'Nouvelle ressource', width:560, body:`<div class="bp-form">
    <label class="bp-f w"><span>Nom</span><input id="reName" value="${esc(r.name)}" placeholder="ex. Équipe maçonnerie, Pelle 14 t, Béton C25/30" autofocus></label>
    <label class="bp-f"><span>Type</span><select id="reType">${Object.entries(RTYPES).map(([k, v]) => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
    <label class="bp-f" id="reUnitF"><span>Unité</span><input id="reUnit" value="${esc(r.unit || '')}" placeholder="m³, t, forfait…"></label>
    <label class="bp-f"><span id="reRateL">Tarif</span><input id="reRate" type="number" step="any" min="0" value="${+r.rate || 0}"></label>
    <label class="bp-f" id="reCapF"><span id="reCapL">Capacité</span><input id="reCap" type="number" step="any" min="0" value="${+r.cap || 0}"></label>
    <label class="bp-f"><span>Couleur</span><input id="reCol" type="color" value="${esc(r.color || '#3e8ed0')}" style="padding:2px;height:38px"></label>
  </div><p class="bp-hint" id="reHint"></p>`,
    buttons:[...(id ? [{label:'Supprimer', value:'del', dang:true, left:true}] : []), {label:'Annuler', value:null}, {label:'Enregistrer', pri:true, check:b => !!b.querySelector('#reName').value.trim()}],
    onOpen:b => {
      const upd = () => { const ty = b.querySelector('#reType').value, d = RTYPES[ty];
        b.querySelector('#reUnitF').hidden = ty === 'team';
        b.querySelector('#reCapF').hidden = !d.time;
        b.querySelector('#reRateL').textContent = ty === 'team' ? 'Tarif par personne (CHF/h)' : ty === 'machine' ? 'Tarif par unité (CHF/jour)' : 'Prix unitaire (CHF par ' + (b.querySelector('#reUnit').value || 'unité') + ')';
        b.querySelector('#reCapL').textContent = ty === 'team' ? 'Personnes disponibles par jour' : 'Unités disponibles par jour';
        b.querySelector('#reHint').textContent = d.time ? 'La capacité sert à repérer les surcharges (barres rouges) et au lissage.' : 'Pas de capacité : seulement la quantité et le coût par tâche.'; };
      b.querySelector('#reType').addEventListener('change', () => { const ty = b.querySelector('#reType').value, u = b.querySelector('#reUnit'); if (!u.value || ['pers.', 'u.', 'forfait', 'm³'].includes(u.value)) u.value = RTYPES[ty].unit; upd(); });
      b.querySelector('#reUnit').addEventListener('input', upd); upd();
    }});
  if (!box) return;
  if (box === 'del') {
    if (used && !await confirmDlg('Supprimer la ressource', `« ${esc(r.name)} » est affectée à des tâches : elle en sera retirée.`, 'Supprimer', true)) return;
    mut(pp => { pp.res = pp.res.filter(x => x.id !== id); for (const t of pp.tasks) { t.asg = t.asg.filter(a => a.r !== id); if (t.lres) { t.lres = t.lres.filter(a => a.r !== id); if (!t.lres.length) delete t.lres; } t.act = t.act.filter(a => a.r !== id); } });
    return;
  }
  mut(pp => {
    const ty = box.querySelector('#reType').value;
    Object.assign(r, {name:box.querySelector('#reName').value.trim(), type:ty, unit:ty === 'team' ? 'pers.' : box.querySelector('#reUnit').value.trim() || RTYPES[ty].unit,
      rate:+box.querySelector('#reRate').value || 0, cap:RTYPES[ty].time ? +box.querySelector('#reCap').value || 0 : 0, color:box.querySelector('#reCol').value});
    if (!id) pp.res.push(r);
  });
  U.resSel = r.id; render();
}
async function levelDlg(){
  const p = U.plan;
  const ov = overloads(p, U.sch);
  if (!ov.length) { toast('Aucune surcharge : rien à lisser'); return; }
  const pr = levelProposal(p, U.statusDn);
  if (!pr.moves.length) { await dlg({title:'Lissage', body:'<p>Surcharge impossible à résoudre en décalant des tâches : elle vient de tâches déjà commencées ou d’une seule tâche qui demande plus que la capacité. Augmente la capacité ou modifie les affectations.</p>'}); return; }
  const box = await dlg({title:'Proposition de lissage', width:760, body:`
    <p>${pr.moves.length} tâche(s) à décaler pour supprimer les surcharges${pr.left ? ` (il restera ${pr.left} jour(s) de surcharge sur des tâches non déplaçables)` : ''}.
    Fin du projet : <b>${chOfDn(pr.endBefore)}</b> → <b>${chOfDn(pr.endAfter)}</b> ${pr.delay > 0 ? `<span class="bp-neg">(+${pr.delay} j)</span>` : '<span class="bp-pos">(inchangée)</span>'}.</p>
    <table class="bp-tbl"><thead><tr><th></th><th>Tâche</th><th class="n">Décalage</th><th class="n">Nouveau début</th><th class="n">Nouvelle fin</th><th class="n">Marge restante</th></tr></thead><tbody>
    ${pr.moves.map(m => `<tr><td><input type="checkbox" data-mv="${esc(m.id)}" checked></td><td>${wbsOf(m.id)} ${esc(m.name)}</td><td class="n">+${m.to - m.from} j</td><td class="n">${shortOfDn(m.start)}</td><td class="n">${shortOfDn(m.finish)}</td><td class="n ${m.tf <= 0 ? 'bp-neg' : ''}">${m.tf} j</td></tr>`).join('')}</tbody></table>
    <p class="bp-hint">Les tâches non critiques (avec marge) sont décalées en premier. Tu peux décocher une ligne ; « Retirer le lissage » (onglet Ressources) annule tous les décalages.</p>`,
    buttons:[{label:'Annuler', value:null}, {label:'Appliquer', pri:true}]});
  if (!box) return;
  const ok = new Set([...box.querySelectorAll('[data-mv]:checked')].map(c => c.dataset.mv));
  mut(pp => { for (const m of pr.moves) if (ok.has(m.id)) { const t = pp.tasks.find(x => x.id === m.id); if (t) t.lvl = m.to; } });
  const left = overloads(U.plan, U.sch).length;
  toast(left ? `Lissage appliqué · ${left} jour(s) de surcharge restent` : 'Lissage appliqué · plus de surcharge');
}

/* ---------- Analyse des ressources (onglet Analyse) : courbe de main-d'œuvre, machines, montants ; écran, PDF, impression, Excel ---------- */
const AN_KIND = {team:{l:'Main-d’œuvre', u:'pers.', t:'Courbe main-d’œuvre', e:'EFF'}, machine:{l:'Machines', u:'u.', t:'Courbe des machines', e:'Unités'}, chf:{l:'Montants', u:'CHF', t:'Montants', e:'CHF'}};
const AN_PER = {d:'Jour', w:'Semaine', m:'Mois'}, AN_BY = {zone:'Zone / bâtiment', lot:'Lot', res:'Ressource', type:'Type'}, AN_SRC = {plan:'Prévu', real:'Réel', base:'Référence'};
const AN_CMP = {plan:'#3e8ed0', real:'#e5484d', base:'#8a8f96'};
function anState(){
  if (!U.an) { let s = {}; try { s = JSON.parse(localStorage.getItem('baugest.planAn') || '{}') || {}; } catch (e) {} U.an = Object.assign({kind:'team', per:'w', by:'', src:'plan', cmp:{real:true, base:true}}, s); }
  if (!AN_BY[U.an.by]) U.an.by = zonesOf(U.plan).length ? 'zone' : 'lot';
  if (!AN_KIND[U.an.kind]) U.an.kind = 'team'; if (!AN_PER[U.an.per]) U.an.per = 'w'; if (!AN_SRC[U.an.src]) U.an.src = 'plan'; U.an.cmp = U.an.cmp || {};
  return U.an;
}
const anSave = () => { try { localStorage.setItem('baugest.planAn', JSON.stringify(U.an)); } catch (e) {} };
/* valeurs d'un contenu : effectif = jours ÷ jours ouvrés de la période, montants tels quels */
function anView(A, kind, src){
  const n = A.pers.length, val = (s, k) => { const a = A.S[s] && A.S[s][kind][k]; return a ? a.map((v, i) => kind === 'chf' ? v : v / A.pers[i].nd) : null; };
  const tot = s => { const t = new Array(n).fill(0); let any = false; for (const g of A.groups) { const a = val(s, g.k); if (a) { any = true; a.forEach((v, i) => t[i] += v); } } return any ? t : null; };
  const groups = A.groups.map((g, i) => ({...g, c:/^#[0-9a-f]{6}$/i.test(g.c || '') ? g.c : COLORS[i % COLORS.length], v:val(src, g.k)})).filter(g => g.v && g.v.some(x => Math.abs(x) > 1e-9));
  const days = s => { let d = 0; const m = A.S[s] && A.S[s][kind]; if (m) for (const k in m) for (const v of m[k]) d += v; return d; };
  /* réel : seulement jusqu'à la date d'état (au-delà rien n'est encore saisi) */
  const cut = A.pers.filter(P => P.a <= U.sch.statusDn).length, real = tot('real');
  return {n, groups, tot:{plan:tot('plan'), base:tot('base'), real:real && real.map((v, i) => i < cut ? v : null)}, cur:src === 'real' && real ? real.map((v, i) => i < cut ? v : 0) : tot(src), days};
}
const anCum = a => { let c = 0; return a ? a.map(v => v == null ? null : c += v) : null; };
const anFmt = (kind, v, short) => { if (!v || Math.abs(v) < 1e-9) return ''; if (kind === 'chf') return short ? (Math.abs(v) >= 1e6 ? fmtN(v / 1e6, 1) + 'M' : Math.abs(v) >= 1e3 ? fmtN(v / 1e3, Math.abs(v) >= 1e5 ? 0 : 1) + 'k' : fmtN(v)) : fmtN(v);
  return Math.abs(v) < 9.95 && Math.abs(v - Math.round(v)) > .05 ? fmtN(v, 1) : fmtN(Math.round(v)); };
const anNice = v => { if (v <= 0) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; };
/* libellés des périodes : en-tête du dessus (mois / année) et numéro (semaine, jour, mois) */
function anLabels(A, per){
  const top = [], lab = A.pers.map(P => { const d = new Date((per === 'w' ? P.a : P.k) * DAY); return per === 'w' ? String(isoWeek(P.k)) : per === 'd' ? String(d.getUTCDate()) : MONTHS[d.getUTCMonth()]; });
  A.pers.forEach((P, i) => { const d = new Date(P.a * DAY), k = per === 'm' ? String(d.getUTCFullYear()) : MONTHS[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(2);
    if (top.length && top[top.length - 1].l === k) top[top.length - 1].n++; else top.push({l:k, n:1}); });
  return {top, lab, name:per === 'w' ? 'Sem.' : per === 'd' ? 'Jour' : 'Mois'};
}
const anCmpList = (o, V) => Object.keys(AN_SRC).filter(s => s !== o.src && o.cmp[s] && V.tot[s]).map(s => ({s, l:AN_SRC[s], v:V.tot[s], c:AN_CMP[s]}));
const anSub = o => `${AN_SRC[o.src]} · par ${AN_PER[o.per].toLowerCase()} · couleurs : ${AN_BY[o.by].toLowerCase()}`;
function anSvg(V, o, cw, lw, cum){
  const n = V.n, Hh = cum ? 200 : 280, tp = 22, bt = 8, W = lw + n * cw, cmp = anCmpList(o, V), K = AN_KIND[o.kind];
  const ser = cum ? [{l:AN_SRC[o.src], v:anCum(V.cur), c:AN_CMP[o.src]}, ...cmp.map(c => ({...c, v:anCum(c.v)}))] : null;
  let mx = 0; for (const a of cum ? ser.map(x => x.v) : [V.cur, ...cmp.map(c => c.v)]) if (a) for (const v of a) mx = Math.max(mx, v);
  const top = anNice(mx * 1.08), y = v => Hh - bt - v / top * (Hh - tp - bt);
  let g = '';
  for (let k = 0; k <= 5; k++) { const v = top * k / 5, yy = y(v); g += `<line x1="${lw}" x2="${W}" y1="${yy}" y2="${yy}" stroke="var(--line,#353a41)" stroke-width="${k ? .6 : 1.2}"/><text x="${lw - 6}" y="${yy + 4}" text-anchor="end" class="mut sm">${o.kind === 'chf' ? anFmt('chf', v, 1) || '0' : fmtN(v, v % 1 ? 1 : 0)}</text>`; }
  g += `<text x="4" y="13" class="mut sm">${cum ? 'Cumul CHF' : K.u + (o.kind === 'chf' ? '' : ' (moyenne / jour)')}</text>`;
  if (cum) {
    const used = [];
    for (const x of ser) { if (!x.v) continue; const ok = x.v.map((v, i) => [i, v]).filter(q => q[1] != null), last = ok.length ? ok[ok.length - 1] : [0, 0];
      let ly = y(last[1]) - 6; while (used.some(u => Math.abs(u - ly) < 13)) ly += 13; used.push(ly);
      g += `<polyline points="${lw},${y(0)} ${ok.map(([i, v]) => `${lw + i * cw + cw},${y(v)}`).join(' ')}" fill="none" stroke="${x.c}" stroke-width="2.4"/><text x="${lw + last[0] * cw + cw - 4}" y="${ly}" text-anchor="end" class="sm bd" style="fill:${x.c}">${esc(x.l)} ${anFmt('chf', last[1], 1) || '0'}</text>`; }
    return `<svg class="bp-chart" width="${W}" height="${Hh}" style="display:block">${g}</svg>`;
  }
  const bw = Math.max(3, cw * .72);
  for (let i = 0; i < n; i++) {
    const x0 = lw + i * cw + (cw - bw) / 2, many = V.groups.filter(gr => gr.v[i] > 1e-9).length > 1; let acc = 0;
    for (const gr of V.groups) { const v = gr.v[i]; if (!(v > 1e-9)) continue; const y1 = y(acc + v), h = y(acc) - y1; acc += v;
      g += `<rect x="${x0}" y="${y1}" width="${bw}" height="${Math.max(.5, h)}" fill="${gr.c}"><title>${esc(gr.l)} : ${anFmt(o.kind, v)} ${K.u}</title></rect>`;
      if (many && h >= 13 && bw >= 18) g += `<text x="${x0 + bw / 2}" y="${y1 + h / 2 + 4}" text-anchor="middle" class="sm bd" style="fill:${inkOn(gr.c)}">${anFmt(o.kind, v, 1)}</text>`; }
    if (acc > 1e-9 && cw >= 16) g += `<text x="${x0 + bw / 2}" y="${y(acc) - 4}" text-anchor="middle" class="sm bd">${anFmt(o.kind, acc, 1)}</text>`;
  }
  for (const c of cmp) { const p = c.v.map((v, i) => v == null ? '' : `${lw + i * cw + cw / 2},${y(v)}`).join(' ');
    g += `<polyline points="${p}" fill="none" stroke="${c.c}" stroke-width="2" ${c.s === 'base' ? 'stroke-dasharray="6 4"' : ''}/>` + c.v.map((v, i) => v == null ? '' : `<circle cx="${lw + i * cw + cw / 2}" cy="${y(v)}" r="2.6" fill="${c.c}"><title>${c.l} : ${anFmt(o.kind, v)} ${K.u}</title></circle>`).join(''); }
  return `<svg class="bp-chart" width="${W}" height="${Hh}" style="display:block">${g}</svg>`;
}
function anTable(A, V, o, cw, lw){
  const L = anLabels(A, o.per), K = AN_KIND[o.kind], cmp = anCmpList(o, V), n = V.n;
  const cells = (a, cls = '') => a.map(v => `<td class="c ${cls}">${anFmt(o.kind, v, o.kind === 'chf' && cw < 60)}</td>`).join('');
  let r = `<colgroup><col style="width:${lw}px">${'<col>'.repeat(n)}</colgroup><thead><tr><th class="lab"></th>${L.top.map(t => `<th colspan="${t.n}" class="mo">${t.l}</th>`).join('')}</tr>`
    + `<tr><th class="lab">${L.name}</th>${L.lab.map((l, i) => `<th class="c" title="${chOfDn(A.pers[i].a)} → ${chOfDn(A.pers[i].b)} · ${A.pers[i].nd} j ouvrés">${l}</th>`).join('')}</tr></thead><tbody>`;
  r += `<tr class="tot"><td class="lab">${K.e} ${o.kind === 'chf' ? '' : '(' + K.u + ')'} · ${AN_SRC[o.src]}</td>${cells(V.cur || new Array(n).fill(0), 'big')}</tr>`;
  for (const g of V.groups) r += `<tr><td class="lab"><span class="bp-dot" style="background:${g.c}"></span>${esc(g.l)}</td>${cells(g.v)}</tr>`;
  for (const c of cmp) {
    r += `<tr class="cmp"><td class="lab"><span class="bp-dot" style="background:${c.c}"></span>${c.l}</td>${cells(c.v)}</tr>`;
    if (V.cur) r += `<tr class="cmp"><td class="lab">Écart ${AN_SRC[o.src].toLowerCase()} − ${c.l.toLowerCase()}</td>${V.cur.map((v, i) => { const d = c.v[i] == null ? 0 : v - c.v[i]; return `<td class="c">${Math.abs(d) < 1e-9 ? '' : (d > 0 ? '+' : '−') + anFmt(o.kind, Math.abs(d), o.kind === 'chf' && cw < 60)}</td>`; }).join('')}</tr>`;
  }
  if (o.kind === 'chf') { r += `<tr class="sum"><td class="lab">Cumul ${AN_SRC[o.src].toLowerCase()}</td>${cells(anCum(V.cur || new Array(n).fill(0)))}</tr>`;
    for (const c of cmp) r += `<tr class="cmp"><td class="lab">Cumul ${c.l.toLowerCase()}</td>${cells(anCum(c.v))}</tr>`; }
  return `<table class="bp-tbl bp-antbl" style="width:${lw + n * cw}px">${r}</tbody></table>`;
}
function anKpis(A, V, o){
  const K = AN_KIND[o.kind], k = (l, v, sub, cls = '') => `<div class="bp-kpi"><small>${l}</small><b class="${cls}">${v}</b>${sub ? `<em>${sub}</em>` : ''}</div>`, L = anLabels(A, o.per);
  const cur = V.cur || [], pi = cur.reduce((b, v, i) => v > (cur[b] || 0) ? i : b, 0), on = cur.filter(v => v > 1e-9);
  const pl = i => `${AN_PER[o.per].toLowerCase()} ${o.per === 'm' ? L.lab[i] + ' ' + new Date(A.pers[i].a * DAY).getUTCFullYear() : L.lab[i] + (o.per === 'd' ? '.' + (new Date(A.pers[i].a * DAY).getUTCMonth() + 1) : '')} (${chOfDn(A.pers[i].a)})`;
  const sum = s => (V.tot[s] || []).reduce((a, v) => a + (v || 0), 0);
  if (o.kind === 'chf') return k('Total ' + AN_SRC[o.src].toLowerCase(), fmtN(sum(o.src)) + ' CHF', '') + (V.tot.base ? k('Référence', fmtN(sum('base')) + ' CHF', '') : '') + (V.tot.real ? k('Réel saisi', fmtN(sum('real')) + ' CHF', '') : '')
    + (cur.length ? k('Période la plus chargée', fmtN(cur[pi]) + ' CHF', pl(pi)) : '');
  const d = V.days(o.src);
  return k('Pic', anFmt(o.kind, cur[pi] || 0) + ' ' + K.u, cur.length ? pl(pi) : '') + k('Moyenne', on.length ? anFmt(o.kind, on.reduce((a, v) => a + v, 0) / on.length) + ' ' + K.u : '–', 'sur ' + {d:'les jours actifs', w:'les semaines actives', m:'les mois actifs'}[o.per])
    + k(o.kind === 'team' ? 'Hommes-jours' : 'Jours machine', fmtN(d, 1), o.kind === 'team' ? fmtN(d * A.hpd) + ' h (' + fmtN(A.hpd, 1) + ' h/j)' : '')
    + (o.src !== 'real' && V.tot.real ? k('Réel saisi', fmtN(V.days('real'), 1) + (o.kind === 'team' ? ' h·j' : ' j'), 'heures ÷ ' + fmtN(A.hpd, 1) + ' h/j') : '');
}
/* récap des heures de main-d'œuvre par mois (toujours par mois) : prévu, réel (jusqu'à la date d'état), référence, écart, cumuls */
function anHours(o){
  const A = resAnalysis(U.plan, U.sch, {...o, per:'m'}); if (!A.pers.length) return null;
  const h = s => { const m = A.S[s] && A.S[s].team; if (!m || !Object.keys(m).length) return null; const t = new Array(A.pers.length).fill(0); for (const k in m) m[k].forEach((v, i) => t[i] += v * A.hpd); return t; };
  const plan = h('plan'), base = h('base'), r0 = h('real'), real = r0 && r0.map((v, i) => A.pers[i].a <= U.sch.statusDn ? v : null);
  if (!plan && !base && !real) return null;
  const sum = a => a ? a.reduce((x, v) => x + (v || 0), 0) : 0;
  const rows = A.pers.map((P, i) => { const d = new Date(P.a * DAY); return {l:MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(), a:P.a, b:P.b, nd:P.nd, plan:plan ? plan[i] : 0, base:base ? base[i] : null, real:real ? real[i] : null}; });
  return {rows, hpd:A.hpd, has:{base:!!base, real:!!real}, tot:{plan:sum(plan), base:sum(base), real:sum(real)}, cum:{plan:anCum(plan || rows.map(() => 0)), real:anCum(real)}};
}
const anH = v => v == null ? '' : Math.abs(v) < .5 ? '0' : fmtN(Math.round(v));
const anHd = v => Math.abs(v) < .5 ? '' : (v > 0 ? '+' : '−') + fmtN(Math.round(Math.abs(v)));
function anHoursHTML(H){
  const hd = `<tr><th>Mois</th><th class="n">J. ouvrés</th><th class="n">Prévu (h)</th>${H.has.real ? '<th class="n">Réel (h)</th><th class="n">Écart réel − prévu</th>' : ''}${H.has.base ? '<th class="n">Référence (h)</th>' : ''}<th class="n">Cumul prévu</th>${H.has.real ? '<th class="n">Cumul réel</th>' : ''}</tr>`;
  const row = (r, i) => `<tr><td title="${chOfDn(r.a)} → ${chOfDn(r.b)}">${r.l}</td><td class="n">${r.nd}</td><td class="n">${anH(r.plan)}</td>${H.has.real ? `<td class="n">${anH(r.real)}</td><td class="n ${r.real != null && r.real - r.plan > .5 ? 'bp-neg' : ''}">${r.real == null ? '' : anHd(Math.round(r.real) - Math.round(r.plan))}</td>` : ''}${H.has.base ? `<td class="n">${anH(r.base)}</td>` : ''}<td class="n">${anH(H.cum.plan[i])}</td>${H.has.real ? `<td class="n">${anH(H.cum.real[i])}</td>` : ''}</tr>`;
  const tot = `<tr class="sum"><td>Total</td><td class="n">${H.rows.reduce((a, r) => a + r.nd, 0)}</td><td class="n">${anH(H.tot.plan)}</td>${H.has.real ? `<td class="n">${anH(H.tot.real)}</td><td class="n"></td>` : ''}${H.has.base ? `<td class="n">${anH(H.tot.base)}</td>` : ''}<td class="n"></td>${H.has.real ? '<td class="n"></td>' : ''}</tr>`;
  return `<div class="bp-card"><h3>Heures travaillées par mois</h3><p class="bp-hint">Main-d’œuvre (équipes) des tâches et des lots, en heures (${fmtN(H.hpd, 1)} h/j).${H.has.real ? ' Réel = heures saisies jusqu’à la date d’état.' : ''}</p>
    <div class="bp-anwrap"><table class="bp-tbl bp-anhrs"><thead>${hd}</thead><tbody>${H.rows.map(row).join('')}${tot}</tbody></table></div></div>`;
}
/* récap par machine sur tout le chantier : jours machine prévus / réels (jusqu'à la date d'état) / référence, période prévue, coûts */
function anMach(o){
  const ms = U.plan.res.filter(r => r.type === 'machine'); if (!ms.length) return null;
  const A = resAnalysis(U.plan, U.sch, {...o, by:'res', per:'d'}); if (!A.pers.length) return null;
  const sd = U.sch.statusDn, sum = (src, m, k, cut) => { const a = A.S[src] && A.S[src][m][k]; let t = 0; if (a) a.forEach((v, i) => { if (!cut || A.pers[i].a <= sd) t += v; }); return t; };
  const rows = ms.map(r => { const k = 'r:' + r.id, a = A.S.plan.machine[k]; let i0 = -1, i1 = -1; if (a) a.forEach((v, i) => { if (v > 1e-9) { if (i0 < 0) i0 = i; i1 = i; } });
    return {l:r.name, c:r.color, unit:r.unit || 'u.', rate:+r.rate || 0, from:i0 < 0 ? null : A.pers[i0].a, to:i1 < 0 ? null : A.pers[i1].a, plan:sum('plan', 'machine', k), real:sum('real', 'machine', k, 1), base:sum('base', 'machine', k), cPlan:sum('plan', 'chf', k), cReal:sum('real', 'chf', k, 1)}; })
    .filter(r => r.plan > 1e-9 || r.real > 1e-9 || r.base > 1e-9);
  if (!rows.length) return null;
  const T = f => rows.reduce((a, r) => a + r[f], 0), has = {real:T('real') > 1e-9, base:!!U.plan.baseline && T('base') > 1e-9, chf:T('cPlan') > .5 || T('cReal') > .5};
  return {rows, has, tot:{l:'Total', plan:T('plan'), real:T('real'), base:T('base'), cPlan:T('cPlan'), cReal:T('cReal')}};
}
const anJ = v => Math.abs(v) < .05 ? '' : fmtN(v, Math.abs(v - Math.round(v)) > .05 ? 1 : 0);
function anMachHTML(Mc){
  const h = Mc.has, row = (r, t) => `<tr class="${t ? 'sum' : ''}"><td>${t ? 'Total' : `<span class="bp-dot" style="background:${esc(r.c || '#888')}"></span>${esc(r.l)}`}</td><td>${t || r.from == null ? '' : `${chOfDn(r.from)} → ${chOfDn(r.to)}`}</td><td class="n">${!t && r.rate ? fmtN(r.rate) : ''}</td><td class="n">${anJ(r.plan)}</td>`
    + (h.real ? `<td class="n">${anJ(r.real)}</td><td class="n ${r.real - r.plan > .05 ? 'bp-neg' : ''}">${h.real && (t || r.real > 1e-9) ? (Math.abs(r.real - r.plan) < .05 ? '' : (r.real > r.plan ? '+' : '−') + anJ(Math.abs(r.real - r.plan))) : ''}</td>` : '')
    + (h.base ? `<td class="n">${anJ(r.base)}</td>` : '') + (h.chf ? `<td class="n">${r.cPlan > .5 ? fmtN(r.cPlan) : ''}</td>${h.real ? `<td class="n">${r.cReal > .5 ? fmtN(r.cReal) : ''}</td>` : ''}` : '') + '</tr>';
  return `<div class="bp-card"><h3>Récapitulatif par machine</h3><p class="bp-hint">Total de chaque machine sur tout le chantier, en jours machine (unités × jours ouvrés), ressources des tâches et des lots.${h.real ? ' Réel = jours saisis jusqu’à la date d’état.' : ''}</p>
    <div class="bp-anwrap"><table class="bp-tbl bp-anhrs"><thead><tr><th>Machine</th><th>Période prévue</th><th class="n">Prix / jour (CHF)</th><th class="n">Prévu (j)</th>${h.real ? '<th class="n">Réel (j)</th><th class="n">Écart réel − prévu</th>' : ''}${h.base ? '<th class="n">Référence (j)</th>' : ''}${h.chf ? `<th class="n">Coût prévu (CHF)</th>${h.real ? '<th class="n">Coût réel (CHF)</th>' : ''}` : ''}</tr></thead>
    <tbody>${Mc.rows.map(r => row(r)).join('')}${row(Mc.tot, 1)}</tbody></table></div></div>`;
}
function renderAn(){
  const p = U.plan, o = anState(), main = $b('#bpMain'), A = resAnalysis(p, U.sch, o), K = AN_KIND[o.kind];
  const seg = (k, map, cur) => `<div class="bp-seg">${Object.entries(map).map(([v, l]) => `<button data-an="${k}" data-v="${v}" class="${cur === v ? 'on' : ''}">${typeof l === 'string' ? l : l.l}</button>`).join('')}</div>`;
  const ck = (s, l) => `<label class="bp-chk"><input type="checkbox" data-ancmp="${s}" ${o.cmp[s] ? 'checked' : ''} ${s === o.src ? 'disabled' : ''}>${l}</label>`;
  const V = A.pers.length ? anView(A, o.kind, o.src) : null, cw = o.per === 'm' ? 64 : o.kind === 'chf' ? 46 : 34, lw = 190;
  const empty = !V || (!V.cur && !V.tot.base && !V.tot.real);
  main.innerHTML = `<div class="bp-pane">
    <div class="bp-card bp-anctl">
      <div><small>Contenu</small>${seg('kind', AN_KIND, o.kind)}</div><div><small>Période</small>${seg('per', AN_PER, o.per)}</div>
      <div><small>Couleurs par</small>${seg('by', AN_BY, o.by)}</div><div><small>Barres</small>${seg('src', AN_SRC, o.src)}</div>
      <div><small>Comparer (lignes)</small><div style="display:flex;gap:10px;align-items:center;height:38px">${ck('plan', 'Prévu')}${ck('real', 'Réel')}${ck('base', 'Référence' + (p.baseline ? '' : ' (aucune)'))}</div></div>
      <div class="bp-anout"><button class="bp-btn" data-anx="print">${I.print}Imprimer</button><button class="bp-btn" data-anx="pdf">${I.exp}PDF</button><button class="bp-btn" data-anx="xlsx">${I.tbl}Excel</button></div>
    </div>
    <div class="bp-card"><h3>${K.t} · ${esc(p.name)}</h3><p class="bp-hint">${anSub(o)}. ${o.kind === 'chf' ? 'Montants = budget (source réglée dans Réglages) réparti sur les jours ouvrés des tâches et des lots.' : 'Effectif = moyenne des jours ouvrés de la période (ressources des tâches + des lots).'}</p>
      ${empty ? `<p class="bp-hint">Rien à afficher : ${o.kind === 'team' ? 'aucune équipe' : o.kind === 'machine' ? 'aucune machine' : 'aucun montant'} affecté${o.src === 'real' ? ' ni réalisé saisi' : ''}.</p>` : `
      <div class="bp-kpis" style="margin-bottom:10px">${anKpis(A, V, o)}</div>
      <div class="bp-anwrap">${anSvg(V, o, cw, lw)}${o.kind === 'chf' ? anSvg(V, o, cw, lw, true) : ''}${anTable(A, V, o, cw, lw)}</div>
      <div class="bp-anleg">${V.groups.map(g => `<span><span class="bp-dot" style="background:${g.c}"></span>${esc(g.l)}</span>`).join('')}${anCmpList(o, V).map(c => `<span><span class="bp-dot" style="background:${c.c};height:3px;vertical-align:3px"></span>${c.l} (ligne)</span>`).join('')}</div>`}
    </div>${o.kind === 'team' && !empty ? (H => H ? anHoursHTML(H) : '')(anHours(o)) : ''}${o.kind === 'machine' && !empty ? (Mc => Mc ? anMachHTML(Mc) : '')(anMach(o)) : ''}</div>`;
  const ctl = main.querySelector('.bp-anctl');
  ctl.addEventListener('click', e => {
    const b = e.target.closest('[data-an]'); if (b) { o[b.dataset.an] = b.dataset.v; anSave(); renderAn(); return; }
    const x = e.target.closest('[data-anx]'); if (x) anOut(x.dataset.anx);
  });
  ctl.addEventListener('change', e => { const c = e.target.closest('[data-ancmp]'); if (c) { o.cmp[c.dataset.ancmp] = c.checked; anSave(); renderAn(); } });
}
/* sorties : PDF / impression (A4–A0, une page par contenu coché) et Excel */
async function anOut(what){
  const o = anState(), P0 = LAY().pdf;
  if (what === 'xlsx') {
    try { toast('Préparation de l’Excel…', 1500); await loadScript(XLSX_URL); const X = window.XLSX, wb = X.utils.book_new(); anSheets(wb, X, o);
      if (!wb.SheetNames.length) { toast('Rien à exporter'); return; }
      const blob = new Blob([X.write(wb, {bookType:'xlsx', type:'array'})], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), name = `${fileBase()} – analyse ressources ${isoOfDn(todayDn())}.xlsx`;
      download(blob, name); toast(await exportToDrive(blob, name) ? 'Exporté : téléchargé + Drive › Planning › Exports' : 'Exporté (téléchargé)');
    } catch (e) { toast('Export impossible : ' + ((e && e.message) || e), 5000); }
    return;
  }
  const r = await dlg({title:what === 'print' ? 'Imprimer l’analyse' : 'PDF de l’analyse', width:520, body:`<div class="bp-form">
      <label class="bp-f"><span>Format</span><select id="anSize">${Object.keys(PAPER).map(k => `<option ${k === (P0.size === 'A4' ? 'A4' : 'A3') ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label class="bp-f"><span>Orientation</span><select id="anOr"><option value="land">Paysage</option><option value="port">Portrait</option></select></label>
      <div class="bp-f w"><span>Pages (une par contenu)</span>${Object.entries(AN_KIND).map(([k, v]) => `<label class="bp-chk"><input type="checkbox" data-ank="${k}" ${k === o.kind ? 'checked' : ''}>${v.l}</label>`).join(' ')}</div>
    </div><p class="bp-hint">${anSub(o)} — réglages de l’onglet Analyse. Logo et cartouche : ceux de la mise en page du planning.</p>`,
    buttons:[{label:'Annuler', value:null}, {label:what === 'print' ? 'Imprimer' : 'Créer le PDF', pri:true, check:b => !!b.querySelector('[data-ank]:checked')}]});
  if (!r) return;
  const opt = {size:r.querySelector('#anSize').value, orient:r.querySelector('#anOr').value, kinds:[...r.querySelectorAll('[data-ank]:checked')].map(x => x.dataset.ank)};
  if (what === 'print') return printPlan({pdf:{size:opt.size, orient:opt.orient}}, () => makeAnPdf(opt));
  try { toast('Préparation du PDF…', 1500); const blob = await makeAnPdf(opt), name = `${fileBase()} – analyse ressources ${opt.size} ${isoOfDn(todayDn())}.pdf`;
    download(blob, name); toast(await exportToDrive(blob, name) ? 'Exporté : téléchargé + Drive › Planning › Exports' : 'Exporté (téléchargé)');
  } catch (e) { console.error('analyse pdf', e); toast('PDF impossible : ' + ((e && e.message) || e), 5000); }
}
function anSheets(wb, X, o){
  const D = dn => new Date(Date.UTC(1970, 0, 1) + dn * DAY + 12 * 36e5), A = resAnalysis(U.plan, U.sch, o); if (!A.pers.length) return;
  const L = anLabels(A, o.per), r1 = v => Math.round(v * 10) / 10;
  for (const kind of Object.keys(AN_KIND)) {
    const V = anView(A, kind, 'plan'); if (!V.tot.plan && !V.tot.base && !V.tot.real) continue;
    const K = AN_KIND[kind], f0 = kind === 'chf' ? Math.round : r1, f = v => v == null ? '' : f0(v), cols = V.groups;
    const head = [L.name, 'Du', 'Au', 'Jours ouvrés', ...cols.map(g => g.l + (kind === 'chf' ? ' CHF' : ' (' + K.u + ')')), 'Total prévu', ...(V.tot.base ? ['Référence'] : []), ...(V.tot.real ? ['Réel'] : [])];
    if (kind === 'chf') head.push('Cumul prévu', ...(V.tot.base ? ['Cumul référence'] : []), ...(V.tot.real ? ['Cumul réel'] : []));
    const rows = [[`${K.t} · ${U.plan.name} · par ${AN_PER[o.per].toLowerCase()} · ${kind === 'chf' ? 'CHF' : 'effectif = moyenne des jours ouvrés (' + K.u + ')'}`], [], head];
    const cp = anCum(V.tot.plan), cb = anCum(V.tot.base), cr = anCum(V.tot.real);
    A.pers.forEach((P, i) => rows.push([o.per === 'w' ? 'S' + L.lab[i] : L.lab[i], D(P.a), D(P.b), P.nd, ...cols.map(g => f(g.v[i])), f(V.tot.plan ? V.tot.plan[i] : 0), ...(V.tot.base ? [f(V.tot.base[i])] : []), ...(V.tot.real ? [f(V.tot.real[i])] : []),
      ...(kind === 'chf' ? [f(cp ? cp[i] : 0), ...(cb ? [f(cb[i])] : []), ...(cr ? [f(cr[i])] : [])] : [])]));
    if (kind !== 'chf') { rows.push([], ['Total ' + (kind === 'team' ? 'hommes-jours' : 'jours machine'), '', '', '', ...cols.map(g => r1(g.v.reduce((a, v, i) => a + v * A.pers[i].nd, 0))), r1(V.days('plan')), ...(V.tot.base ? [r1(V.days('base'))] : []), ...(V.tot.real ? [r1(V.days('real'))] : [])]); }
    const ws = X.utils.aoa_to_sheet(rows, {cellDates:true, dateNF:'dd\\.mm\\.yyyy'}); ws['!cols'] = head.map((h, i) => ({wch:i === 0 ? 10 : i < 3 ? 11 : Math.min(28, Math.max(10, String(h).length + 2))}));
    X.utils.book_append_sheet(wb, ws, kind === 'team' ? 'Analyse main-d’œuvre' : kind === 'machine' ? 'Analyse machines' : 'Analyse CHF');
  }
  const Mc = anMach(o);
  if (Mc) { const h = Mc.has, r1 = v => Math.round(v * 10) / 10;
    const head = ['Machine', 'Unité', 'Prévu du', 'Prévu au', 'Prix / jour (CHF)', 'Prévu (j machine)', ...(h.real ? ['Réel (j)', 'Écart réel − prévu (j)'] : []), ...(h.base ? ['Référence (j)'] : []), ...(h.chf ? ['Coût prévu (CHF)', ...(h.real ? ['Coût réel (CHF)'] : [])] : [])];
    const line = (r, t) => [t ? 'Total' : r.l, t ? '' : r.unit, t || r.from == null ? '' : D(r.from), t || r.from == null ? '' : D(r.to), t ? '' : r.rate, r1(r.plan), ...(h.real ? [r1(r.real), r1(r.real - r.plan)] : []), ...(h.base ? [r1(r.base)] : []), ...(h.chf ? [Math.round(r.cPlan), ...(h.real ? [Math.round(r.cReal)] : [])] : [])];
    const ws = X.utils.aoa_to_sheet([[`Récapitulatif par machine · ${U.plan.name} · jours machine sur tout le chantier (tâches et lots)`], [], head, ...Mc.rows.map(r => line(r)), [], line(Mc.tot, 1)], {cellDates:true, dateNF:'dd\\.mm\\.yyyy'});
    ws['!cols'] = head.map((x, i) => ({wch:i === 0 ? 24 : Math.max(10, x.length + 2)})); X.utils.book_append_sheet(wb, ws, 'Récap machines'); }
  const H = anHours(o); if (!H) return;
  const head = ['Mois', 'Du', 'Au', 'Jours ouvrés', 'Prévu (h)', ...(H.has.real ? ['Réel (h)', 'Écart réel − prévu (h)'] : []), ...(H.has.base ? ['Référence (h)'] : []), 'Cumul prévu (h)', ...(H.has.real ? ['Cumul réel (h)'] : [])];
  const rh = v => v == null ? '' : Math.round(v);
  const rows = [[`Heures travaillées par mois · ${U.plan.name} · main-d’œuvre des tâches et des lots (${fmtN(H.hpd, 1)} h/j)`], [], head,
    ...H.rows.map((r, i) => [r.l, D(r.a), D(r.b), r.nd, rh(r.plan), ...(H.has.real ? [rh(r.real), r.real == null ? '' : Math.round(r.real) - Math.round(r.plan)] : []), ...(H.has.base ? [rh(r.base)] : []), rh(H.cum.plan[i]), ...(H.has.real ? [rh(H.cum.real[i])] : [])]),
    [], ['Total', '', '', H.rows.reduce((a, r) => a + r.nd, 0), rh(H.tot.plan), ...(H.has.real ? [rh(H.tot.real), ''] : []), ...(H.has.base ? [rh(H.tot.base)] : [])]];
  const ws = X.utils.aoa_to_sheet(rows, {cellDates:true, dateNF:'dd\\.mm\\.yyyy'}); ws['!cols'] = head.map((h, i) => ({wch:i === 0 ? 14 : i < 3 ? 11 : Math.max(10, h.length + 2)}));
  X.utils.book_append_sheet(wb, ws, 'Heures par mois');
}
async function makeAnPdf(opt){
  await loadScript(PDFLIB_URL);
  const {PDFDocument, StandardFonts, rgb} = window.PDFLib, p = U.plan, o = anState(), st = site(U.siteId), Pp = LAY().pdf;
  const hex = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const n = m ? parseInt(m[1], 16) : 0x888888; return rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
  const doc = await PDFDocument.create(); doc.setTitle(winAnsi(p.name + ' – analyse des ressources')); doc.setCreator('BauGest');
  const F = await doc.embedFont(StandardFonts.Helvetica), FB = await doc.embedFont(StandardFonts.HelveticaBold);
  let [W, Hp] = PAPER[opt.size] || PAPER.A3; if (opt.orient === 'port') [W, Hp] = [Hp, W];
  const k0 = W / PAPER.A3[0] > 1 ? Math.min(2, W / PAPER.A3[0]) : Math.max(.75, W / PAPER.A3[0]), M = 22;
  const C = {txt:rgb(.1, .11, .13), mut:rgb(.42, .45, .48), line:rgb(.8, .8, .8), band:hex('#f2c230'), zebra:rgb(.96, .96, .96), white:rgb(1, 1, 1)};
  const text = (pg, t, x, y, o2 = {}) => { const f = o2.b ? FB : F, sz = o2.s || 8; let str = winAnsi(t); if (o2.w) { while (str.length > 1 && f.widthOfTextAtSize(str, sz) > o2.w) str = str.slice(0, -2) + '…'; }
    const w = f.widthOfTextAtSize(str, sz); pg.drawText(str, {x:o2.c ? x - w / 2 : o2.r ? x - w : x, y, size:sz, font:f, color:o2.col || C.txt}); };
  let logo = null;
  if (Pp.logo !== 'none') { const L = logoList(), src = Pp.logo === 'comp' ? L.comp : Pp.logo === 'site' ? L.site : Pp.logoSrc; if (src) try { const png = await logoPng(src); if (png) logo = await doc.embedPng(png); } catch (e) {} }
  const A = resAnalysis(p, U.sch, o); if (!A.pers.length) throw new Error('aucune ressource à analyser');
  const Lb = anLabels(A, o.per), lw = 150 * k0, minCw = 13 * k0, pages = [];
  for (const kind of opt.kinds) {
    const V = anView(A, kind, o.src); if (!V.cur && !V.tot.base && !V.tot.real) continue;
    const per = Math.max(1, Math.floor((W - 2 * M - lw) / minCw));
    for (let a = 0; a < V.n; a += per) pages.push({kind, V, a, b:Math.min(V.n, a + per)});
  }
  if (!pages.length) throw new Error('rien à imprimer pour les contenus choisis');
  const H = opt.kinds.includes('team') ? anHours(o) : null, Mc = opt.kinds.includes('machine') ? anMach(o) : null, nPg = pages.length + (H ? 1 : 0) + (Mc ? 1 : 0);
  let pgNo = pages.length;
  /* page de récapitulatif : titre, tableau centré (en-tête jaune, lignes zébrées, total), note en bas */
  const recapPage = (title, sub, cols, rows, tot, note) => {
    const pg = doc.addPage([W, Hp]), lH = logo ? Math.max(20, (+Pp.logoH || 15) * 72 / 25.4 * Math.min(1.4, k0)) : 0, lWd = logo ? Math.min(W * .25, logo.width * lH / logo.height) : 0, lH2 = logo ? lWd * logo.height / logo.width : 0;
    if (logo) pg.drawImage(logo, {x:M, y:Hp - M - lH2, width:lWd, height:lH2});
    const tTop = Hp - M - 12 * k0;
    text(pg, title, W / 2, tTop, {s:12 * k0, b:1, c:1});
    text(pg, [st ? st.label : '', p.name, sub].filter(Boolean).join(' · '), W / 2, tTop - 14 * k0, {s:8.5 * k0, c:1, col:C.mut});
    const tw = Math.min(W - 2 * M, cols.reduce((a, c) => a + (c.w || 1), 0) * 90 * k0), uw = tw / cols.reduce((a, c) => a + (c.w || 1), 0), x0 = (W - tw) / 2;
    const top = Math.min(tTop - 34 * k0, Hp - M - lH2 - 10 * k0), n = rows.length + 2, rh = Math.max(8, Math.min(18 * k0, (top - M - 20 * k0) / n)), fs = Math.min(9 * k0, rh * .6);
    let y = top;
    const line = (r, i, hd) => { y -= rh; if (hd) pg.drawRectangle({x:x0, y, width:tw, height:rh, color:C.band}); else if (r._t) pg.drawRectangle({x:x0, y, width:tw, height:rh, color:rgb(1, .97, .82)}); else if (i % 2) pg.drawRectangle({x:x0, y, width:tw, height:rh, color:C.zebra});
      let x = x0; for (const c of cols) { const w = (c.w || 1) * uw, t = hd ? c.l : r._t && c.noTot ? '' : c.f(r, i); if (t) text(pg, t, c.left ? x + 4 : x + w - 4, y + rh * .3, {s:fs, b:hd || r._t || c.b, r:!c.left, w:w - 6}); x += w; }
      pg.drawLine({start:{x:x0, y}, end:{x:x0 + tw, y}, thickness:.4, color:C.line}); };
    line(null, 0, 1); rows.forEach((r, i) => line(r, i)); line({...tot, _t:1}, 0);
    pg.drawRectangle({x:x0, y, width:tw, height:top - y, borderColor:C.txt, borderWidth:.7});
    let xx = x0; for (const c of cols) { pg.drawLine({start:{x:xx, y}, end:{x:xx, y:top}, thickness:.3, color:C.line}); xx += (c.w || 1) * uw; }
    if (note) text(pg, note, M, M, {s:7 * k0, col:C.mut, w:W * .62});
    text(pg, `Imprimé le ${chOfDn(todayDn())} · page ${++pgNo} / ${nPg}`, W - M, M, {s:7 * k0, r:1, col:C.mut});
  };
  pages.forEach((pgD, pi) => {
    const {kind, V, a, b} = pgD, K = AN_KIND[kind], n = b - a, cw = (W - 2 * M - lw) / n, fs = Math.max(5, Math.min(8.5 * k0, cw * .42)), cmp = anCmpList({...o, kind}, V).map(c => ({...c, v:c.v.slice(a, b)}));
    const cur = (V.cur || new Array(V.n).fill(0)).slice(a, b), grs = V.groups.map(g => ({...g, v:g.v.slice(a, b)})), pg = doc.addPage([W, Hp]);
    /* en-tête : logo, titre, bandeau */
    const lH = logo ? Math.max(20, (+Pp.logoH || 15) * 72 / 25.4 * Math.min(1.4, k0)) : 0, lWd = logo ? Math.min(W * .25, logo.width * lH / logo.height) : 0, lH2 = logo ? lWd * logo.height / logo.width : 0;
    if (logo) pg.drawImage(logo, {x:M, y:Hp - M - lH2, width:lWd, height:lH2});
    const tTop = Hp - M - 12 * k0;
    text(pg, (K.t + (kind === 'chf' ? ' (CHF)' : '')).toUpperCase(), W / 2, tTop, {s:12 * k0, b:1, c:1});
    text(pg, [st ? st.label : '', p.name, anSub(o)].filter(Boolean).join(' · '), W / 2, tTop - 14 * k0, {s:8.5 * k0, c:1, col:C.mut});
    const bandY = Math.min(tTop - 34 * k0, Hp - M - lH2 - 8 * k0) , bandH = 17 * k0;
    pg.drawRectangle({x:M, y:bandY, width:W - 2 * M, height:bandH, color:C.band, borderColor:C.txt, borderWidth:.6});
    text(pg, `${K.t.toUpperCase()} – ${AN_SRC[o.src].toUpperCase()}${pages.filter(x => x.kind === kind).length > 1 ? ` (${chOfDn(A.pers[a].a)} – ${chOfDn(A.pers[b - 1].b)})` : ''}`, W / 2, bandY + 5 * k0, {s:10.5 * k0, b:1, c:1});
    /* tableau (en bas) : mois, période, total, groupes, comparaisons, cumuls */
    const rows = [{l:`${K.e}${kind === 'chf' ? '' : ' (' + K.u + ')'} · ${AN_SRC[o.src]}`, v:cur, b:1, big:1}, ...grs.map(g => ({l:g.l, v:g.v, c:g.c}))];
    for (const c of cmp) rows.push({l:c.l, v:c.v, c:c.c, m:1});
    if (kind === 'chf') { const cc = anCum(V.cur || new Array(V.n).fill(0)).slice(a, b); rows.push({l:'Cumul ' + AN_SRC[o.src].toLowerCase(), v:cc, b:1}); for (const c of anCmpList({...o, kind}, V)) rows.push({l:'Cumul ' + c.l.toLowerCase(), v:anCum(c.v).slice(a, b), m:1}); }
    const foot = M + 14 * k0, rh = Math.max(9, Math.min(15 * k0, (Hp * .36) / (rows.length + 2))), tblH = (rows.length + 2) * rh + rh * .4, tY = foot + 4;   /* bas du tableau */
    let y = tY + tblH;
    const X = i => M + lw + i * cw, short = kind === 'chf' && cw < 44;
    const hdr = (yy, fill) => pg.drawRectangle({x:M, y:yy, width:W - 2 * M, height:rh, color:fill});
    /* ligne des mois */
    y -= rh; hdr(y, C.band);
    let acc = 0; for (const t of Lb.top) { const s0 = Math.max(acc, a), s1 = Math.min(acc + t.n, b); if (s1 > s0) { pg.drawLine({start:{x:X(s0 - a), y}, end:{x:X(s0 - a), y:y + rh}, thickness:.5, color:C.txt}); if ((s1 - s0) * cw > 26) text(pg, t.l, (X(s0 - a) + X(s1 - a)) / 2, y + rh * .3, {s:Math.min(7.5 * k0, rh * .62), b:1, c:1, w:(s1 - s0) * cw - 2}); } acc += t.n; }
    y -= rh; hdr(y, C.zebra); text(pg, Lb.name, M + 3, y + rh * .3, {s:Math.min(7.5 * k0, rh * .62), b:1});
    for (let i = 0; i < n; i++) text(pg, Lb.lab[a + i], X(i) + cw / 2, y + rh * .3, {s:Math.min(fs, rh * .6), c:1, w:cw - 1});
    for (const rw of rows) {
      const h = rw.big ? rh * 1.4 : rh; y -= h;
      if (rw.c) pg.drawRectangle({x:M, y, width:6, height:h, color:hex(rw.c)});
      if (rw.big) pg.drawRectangle({x:M, y, width:W - 2 * M, height:h, color:rgb(1, .97, .82)});
      text(pg, rw.l, M + (rw.c ? 9 : 3), y + h * .3, {s:Math.min(7.5 * k0, rh * .62), b:rw.b, w:lw - 12, col:rw.m ? C.mut : C.txt});
      for (let i = 0; i < n; i++) { const s = anFmt(kind, rw.v[i], short); if (s) text(pg, s, X(i) + cw / 2, y + h * .3, {s:Math.min(rw.big ? fs * 1.25 : fs, h * .62), b:rw.b, c:1, w:cw - 1, col:rw.m ? C.mut : C.txt}); }
      pg.drawLine({start:{x:M, y}, end:{x:W - M, y}, thickness:.4, color:C.line});
    }
    pg.drawRectangle({x:M, y, width:W - 2 * M, height:tY + tblH - y, borderColor:C.txt, borderWidth:.7});
    for (let i = 0; i <= n; i++) pg.drawLine({start:{x:X(i), y}, end:{x:X(i), y:tY + tblH - rh}, thickness:.3, color:C.line});
    /* graphique : barres empilées (+ courbe cumulée pour les montants) */
    const gTop = bandY - 10 * k0, legH = 12 * k0, gBot = tY + tblH + legH + 6, gH = gTop - gBot;
    const charts = kind === 'chf' ? [{y0:gBot + gH * .4 + 8, h:gH * .6 - 8, cum:0}, {y0:gBot, h:gH * .4 - 8, cum:1}] : [{y0:gBot, h:gH, cum:0}];
    for (const ch of charts) {
      const ser = ch.cum ? [{l:AN_SRC[o.src], v:anCum(V.cur || []).slice(a, b), c:AN_CMP[o.src]}, ...anCmpList({...o, kind}, V).map(c => ({...c, v:anCum(c.v).slice(a, b)}))] : null;
      let mx = 0; for (const arr of ch.cum ? ser.map(x => x.v) : [cur, ...cmp.map(c => c.v)]) for (const v of arr || []) mx = Math.max(mx, v);
      const top = anNice(mx * 1.08), Y = v => ch.y0 + v / top * (ch.h - 10);
      for (let kk = 0; kk <= 5; kk++) { const v = top * kk / 5; pg.drawLine({start:{x:X(0), y:Y(v)}, end:{x:X(n), y:Y(v)}, thickness:kk ? .3 : .8, color:C.line}); text(pg, kind === 'chf' ? anFmt('chf', v, 1) || '0' : fmtN(v, v % 1 ? 1 : 0), X(0) - 4, Y(v) - 2.5, {s:6.5 * k0, r:1, col:C.mut}); }
      text(pg, ch.cum ? 'Cumul CHF' : K.u + (kind === 'chf' ? ' par ' + AN_PER[o.per].toLowerCase() : ' (moyenne / jour)'), M, ch.y0 + ch.h - 8, {s:7 * k0, b:1, col:C.mut, w:lw - 30});
      if (ch.cum) { for (const s of ser) { if (!s.v || !s.v.length) continue; let px = X(0), py = Y(0), lv = 0, lx = X(n); s.v.forEach((v, i) => { if (v == null) return; lv = v; lx = X(i + 1); const nx = X(i + 1), ny = Y(v); pg.drawLine({start:{x:px, y:py}, end:{x:nx, y:ny}, thickness:1.6, color:hex(s.c)}); px = nx; py = ny; }); text(pg, s.l + ' ' + (anFmt('chf', lv, 1) || '0'), lx - 2, py + 4, {s:7 * k0, b:1, r:1, col:hex(s.c)}); } continue; }
      const bw = Math.max(2, cw * .72);
      for (let i = 0; i < n; i++) { const x0 = X(i) + (cw - bw) / 2, many = grs.filter(g => g.v[i] > 1e-9).length > 1; let accv = 0;
        for (const g of grs) { const v = g.v[i]; if (!(v > 1e-9)) continue; const y1 = Y(accv), h = Y(accv + v) - y1; accv += v; pg.drawRectangle({x:x0, y:y1, width:bw, height:h, color:hex(g.c)});
          if (many && h >= fs + 3 && bw >= 12) text(pg, anFmt(kind, v, 1), x0 + bw / 2, y1 + h / 2 - fs * .35, {s:fs * .95, b:1, c:1, col:inkOn(g.c) === '#ffffff' ? C.white : C.txt}); }
        if (accv > 1e-9) text(pg, anFmt(kind, accv, 1), x0 + bw / 2, Y(accv) + 2, {s:fs, b:1, c:1}); }
      for (const c of cmp) { let px = null, py = null; c.v.forEach((v, i) => { if (v == null) return; const nx = X(i) + cw / 2, ny = Y(v); if (px != null) pg.drawLine({start:{x:px, y:py}, end:{x:nx, y:ny}, thickness:1.4, color:hex(c.c), dashArray:c.s === 'base' ? [4, 3] : undefined}); pg.drawCircle({x:nx, y:ny, size:1.6, color:hex(c.c)}); px = nx; py = ny; }); }
    }
    /* légende + pied */
    let lx = M; const ly = tY + tblH + 4;
    for (const g of grs) { pg.drawRectangle({x:lx, y:ly, width:10, height:6, color:hex(g.c)}); text(pg, g.l, lx + 13, ly, {s:7 * k0}); lx += 22 + F.widthOfTextAtSize(winAnsi(g.l), 7 * k0) + 8; }
    for (const c of cmp) { pg.drawLine({start:{x:lx, y:ly + 3}, end:{x:lx + 12, y:ly + 3}, thickness:1.6, color:hex(c.c)}); text(pg, c.l + ' (ligne)', lx + 15, ly, {s:7 * k0}); lx += 26 + F.widthOfTextAtSize(winAnsi(c.l + ' (ligne)'), 7 * k0) + 8; }
    text(pg, kind === 'chf' ? 'Montants = budget réparti sur les jours ouvrés des tâches et des lots ; réel = saisies du réalisé à leur date.' : 'Effectif = moyenne des jours ouvrés de la période ; comprend les ressources des tâches et des lots ; réel = heures saisies ÷ ' + fmtN(A.hpd, 1) + ' h/j.', M, M, {s:7 * k0, col:C.mut, w:W * .62});
    text(pg, `Imprimé le ${chOfDn(todayDn())} · page ${pi + 1} / ${nPg}`, W - M, M, {s:7 * k0, r:1, col:C.mut});
  });
  /* page « Heures travaillées par mois » (avec la main-d'œuvre) */
  if (H) {
    const cols = [{l:'Mois', w:1.6, f:r => r.l, left:1}, {l:'J. ouvrés', f:r => String(r.nd)}, {l:'Prévu (h)', f:r => anH(r.plan), b:1}];
    if (H.has.real) cols.push({l:'Réel (h)', f:r => anH(r.real), b:1}, {l:'Écart réel - prévu', noTot:1, f:r => r.real == null ? '' : anHd(Math.round(r.real) - Math.round(r.plan)).replace('−', '-')});
    if (H.has.base) cols.push({l:'Référence (h)', f:r => anH(r.base)});
    cols.push({l:'Cumul prévu', noTot:1, f:(r, i) => anH(H.cum.plan[i])}); if (H.has.real) cols.push({l:'Cumul réel', noTot:1, f:(r, i) => anH(H.cum.real[i])});
    recapPage('HEURES TRAVAILLÉES PAR MOIS', `main-d’œuvre des tâches et des lots (${fmtN(H.hpd, 1)} h/j)`, cols, H.rows,
      {l:'Total', nd:H.rows.reduce((a, r) => a + r.nd, 0), plan:H.tot.plan, real:H.has.real ? H.tot.real : null, base:H.tot.base}, H.has.real ? 'Réel = heures saisies dans le réalisé jusqu’à la date d’état.' : '');
  }
  /* page « Récapitulatif par machine » (avec les machines) */
  if (Mc) {
    const h = Mc.has, cols = [{l:'Machine', w:2, f:r => r.l, left:1}, {l:'Période prévue', w:1.7, noTot:1, f:r => r.from == null ? '' : `${chOfDn(r.from)} - ${chOfDn(r.to)}`}, {l:'Prix / jour (CHF)', w:1.1, noTot:1, f:r => r.rate ? fmtN(r.rate) : ''}, {l:'Prévu (j)', f:r => anJ(r.plan), b:1}];
    if (h.real) cols.push({l:'Réel (j)', f:r => anJ(r.real), b:1}, {l:'Écart réel - prévu', f:r => r.real > 1e-9 || r._t ? (Math.abs(r.real - r.plan) < .05 ? '' : (r.real > r.plan ? '+' : '-') + anJ(Math.abs(r.real - r.plan))) : ''});
    if (h.base) cols.push({l:'Référence (j)', f:r => anJ(r.base)});
    if (h.chf) { cols.push({l:'Coût prévu (CHF)', w:1.2, f:r => r.cPlan > .5 ? fmtN(r.cPlan) : ''}); if (h.real) cols.push({l:'Coût réel (CHF)', w:1.2, f:r => r.cReal > .5 ? fmtN(r.cReal) : ''}); }
    recapPage('RÉCAPITULATIF PAR MACHINE', 'jours machine sur tout le chantier (unités × jours ouvrés, tâches et lots)', cols, Mc.rows, Mc.tot, h.real ? 'Réel = jours machine saisis dans le réalisé jusqu’à la date d’état.' : '');
  }
  return new Blob([await doc.save()], {type:'application/pdf'});
}

/* ---------- Budget ---------- */
function renderBud(){
  const p = U.plan, s = U.sch, main = $b('#bpMain'), E = evm(p, s), byId = new Map(E.rows.map(r => [r.id, r]));
  const agg = new Map();
  for (let i = s.ol.length - 1; i >= 0; i--) { const o = s.ol[i];
    if (!o.sum) { const r = byId.get(o.t.id); agg.set(o.t.id, {bac:r.bac, cur:r.cur, pv:r.pv, ev:r.ev, ac:r.ac}); }
    else { const a = {bac:0, cur:0, pv:0, ev:0, ac:0}, own = byId.get(o.t.id); for (const t of p.tasks) if (t.parent === o.t.id) { const c = agg.get(t.id); if (c) for (const k in a) a[k] += c[k]; } if (own) for (const k in a) a[k] += own[k]; agg.set(o.t.id, a); } }
  const k = (l, v, sub, cls = '') => `<div class="bp-kpi"><small>${l}</small><b class="${cls}">${v}</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
  const idx = v => v == null ? '–' : fmtR(v), col = v => v == null ? '' : v >= 1 ? 'bp-pos' : v < 0.95 ? 'bp-neg' : '';
  const sg = v => (v > 0 ? '+' : '') + fmtN(v);
  const rows = s.ol.map(o => { const a = agg.get(o.t.id), cv = a.ev - a.ac, pct = o.sum ? (a.bac ? a.ev / a.bac * 100 : 0) : o.t.pct;
    return `<tr class="${o.sum ? 'sum' : ''}"><td>${o.wbs}</td><td style="padding-left:${6 + o.lvl * 14}px">${esc(o.t.name)}</td><td class="n">${fmtN(a.bac)}</td>${p.baseline ? `<td class="n ${a.cur > a.bac + .5 ? 'bp-neg' : ''}">${fmtN(a.cur)}</td>` : ''}`
      + `<td class="n">${fmtN(pct)}%</td><td class="n">${fmtN(a.ev)}</td><td class="n">${fmtN(a.ac)}</td><td class="n ${cv < -.5 ? 'bp-neg' : cv > .5 ? 'bp-pos' : ''}">${a.ac || a.ev ? sg(cv) : ''}</td>`
      + `<td>${(o.sum && !(o.t.lres || []).length && !(o.t.act || []).length) || (!o.sum && o.t.ms) ? '' : `<button class="bp-btn" data-act="${esc(o.t.id)}" style="height:34px">${I.money}Réalisé</button>`}</td></tr>`; }).join('');
  main.innerHTML = `<div class="bp-pane">
    <div class="bp-card"><h3>Situation au <input type="date" id="bdStatus" value="${isoOfDn(s.statusDn)}" style="height:34px;margin-left:6px"></h3>
      <div class="bp-kpis">
        ${k('Budget ' + (p.baseline ? 'de référence' : 'actuel'), fmtN(E.BAC) + ' CHF', p.baseline ? 'figé le ' + chOfDn(dnOfIso(p.baseline.at.slice(0, 10))) + (Math.abs(E.CUR - E.BAC) > .5 ? ' · actuel ' + fmtN(E.CUR) : '') : 'fige une référence pour suivre les écarts')}
        ${k('Prévu à date (PV)', fmtN(E.PV) + ' CHF', 'travaux qui devraient être faits')}
        ${k('Valeur acquise (VA)', fmtN(E.EV) + ' CHF', 'budget × avancement')}
        ${k('Coût réel (CR)', fmtN(E.AC) + ' CHF', 'heures et jours saisis')}
        ${k('Écart de coût', sg(E.CV) + ' CHF', 'VA − CR', E.CV < -.5 ? 'bp-neg' : E.CV > .5 ? 'bp-pos' : '')}
        ${k('Écart de délai', sg(E.SV) + ' CHF', 'VA − PV', E.SV < -.5 ? 'bp-neg' : E.SV > .5 ? 'bp-pos' : '')}
        ${k('Indice délai (SPI)', idx(E.SPI), E.SPI == null ? '' : E.SPI >= 1 ? 'en avance / à l’heure' : 'en retard', col(E.SPI))}
        ${k('Indice coût (CPI)', idx(E.CPI), E.CPI == null ? 'pas encore de coût réel' : E.CPI >= 1 ? 'sous le budget' : 'dépassement', col(E.CPI))}
        ${k('Coût final estimé', fmtN(E.EAC) + ' CHF', 'budget ÷ CPI')}
        ${k('Écart final estimé', sg(E.VAC) + ' CHF', 'budget − coût final', E.VAC < -.5 ? 'bp-neg' : E.VAC > .5 ? 'bp-pos' : '')}
      </div>
      <p class="bp-hint">Source du budget : ${({res:'ressources (durée × tarifs)', man:'montants saisis par tâche', mix:'ressources + montants saisis'})[p.opts.budget]} — à changer dans Réglages. Le réalisé se saisit en heures (équipes), jours (machines) ou quantités.</p>
    </div>
    <div class="bp-card"><h3>Budget et réel par tâche</h3><div style="overflow:auto"><table class="bp-tbl"><thead><tr><th>N°</th><th>Tâche</th><th class="n">Budget${p.baseline ? ' réf.' : ''}</th>${p.baseline ? '<th class="n">Budget actuel</th>' : ''}<th class="n">Av.</th><th class="n">Valeur acquise</th><th class="n">Réel</th><th class="n">Écart</th><th></th></tr></thead>
      <tbody>${rows}<tr class="tot"><td></td><td>Total</td><td class="n">${fmtN(E.BAC)}</td>${p.baseline ? `<td class="n">${fmtN(E.CUR)}</td>` : ''}<td class="n">${E.BAC ? fmtN(E.EV / E.BAC * 100) : 0}%</td><td class="n">${fmtN(E.EV)}</td><td class="n">${fmtN(E.AC)}</td><td class="n ${E.CV < -.5 ? 'bp-neg' : E.CV > .5 ? 'bp-pos' : ''}">${sg(E.CV)}</td><td></td></tr></tbody></table></div>
      <p class="bp-hint">Écart = valeur acquise − réel : négatif (rouge) = plus cher que prévu pour l’avancement atteint.</p></div>
  </div>`;
}
async function actDlg(id){
  const p = U.plan, t = T(id); if (!t) return;
  const resOpts = sel => `<option value="">Montant libre (CHF)</option>` + p.res.map(r => `<option value="${esc(r.id)}" ${sel === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
  const qUnit = r => !r ? 'CHF' : r.type === 'team' ? 'h' : r.type === 'machine' ? 'j' : (r.unit || 'u.');
  const row = e => `<div class="bp-li" data-e><input type="date" data-k="d" value="${esc(e.d || isoOfDn(todayDn()))}" style="flex:0 0 150px"><select data-k="r">${resOpts(e.r || ((t.asg[0] || (t.lres || [])[0] || {}).r) || '')}</select><input data-k="q" class="n" type="number" step="any" min="0" value="${e.r ? +e.q || 0 : +e.amt || 0}"><span class="bp-hint" data-u style="width:36px"></span><span class="cost" data-c></span><button class="bp-ib" data-rm>${I.x}</button></div>`;
  const box = await dlg({title:'Réalisé · ' + wbsOf(id) + ' ' + t.name, width:760, body:`
    <p class="bp-hint">Heures des équipes, jours des machines, quantités des sous-traitants et fournitures, ou montant libre (facture…). Montant = quantité × tarif de la ressource.</p>
    <div class="bp-lst" id="acList"></div><div><button class="bp-btn" id="acAdd">${I.plus}Ligne</button></div>
    <div class="bp-form"><label class="bp-f"><span>Avancement : <b id="acPctV">${Math.round(t.pct)}</b> %</span><input id="acPct" type="range" min="0" max="100" step="5" value="${Math.round(t.pct)}"></label></div>
    <p><b>Total réel : <span id="acTot"></span> CHF</b></p>`,
    buttons:[{label:'Annuler', value:null}, {label:'Enregistrer', pri:true}],
    onOpen:b => {
      const list = b.querySelector('#acList');
      const upd = () => { let tot = 0; list.querySelectorAll('[data-e]').forEach(r => { const re = p.res.find(x => x.id === r.querySelector('[data-k=r]').value), q = +r.querySelector('[data-k=q]').value || 0;
        r.querySelector('[data-u]').textContent = qUnit(re); const c = re ? q * (+re.rate || 0) : q; tot += c; r.querySelector('[data-c]').textContent = fmtN(c) + ' CHF'; });
        b.querySelector('#acTot').textContent = fmtN(tot); b.querySelector('#acPctV').textContent = b.querySelector('#acPct').value; };
      (t.act.length ? t.act : [{}]).forEach(e => list.insertAdjacentHTML('beforeend', row(e)));
      b.querySelector('#acAdd').onclick = () => { list.insertAdjacentHTML('beforeend', row({})); upd(); };
      b.addEventListener('click', e => { const x = e.target.closest('[data-rm]'); if (x) { x.parentElement.remove(); upd(); } });
      b.addEventListener('input', upd); b.addEventListener('change', upd); upd();
    }});
  if (!box) return;
  mut(() => {
    t.act = [...box.querySelectorAll('[data-e]')].map(r => { const rid = r.querySelector('[data-k=r]').value, q = +r.querySelector('[data-k=q]').value || 0, d = r.querySelector('[data-k=d]').value;
      return rid ? {id:uid(), d, r:rid, q} : {id:uid(), d, r:'', amt:q}; }).filter(e => (e.q || e.amt) > 0);
    t.pct = +box.querySelector('#acPct').value || 0;
    if (t.pct > 0 && !t.aStart) { const ds = t.act.map(e => e.d).filter(Boolean).sort(); t.aStart = ds[0] || isoOfDn(Math.min(todayDn(), U.sch.R.get(t.id).start)); }
    if (t.pct >= 100 && !t.aEnd) { const ds = t.act.map(e => e.d).filter(Boolean).sort(); t.aEnd = ds[ds.length - 1] || isoOfDn(todayDn()); }
  });
}

/* ---------- Réglages ---------- */
function renderSet(){
  const p = U.plan, s = U.sch, main = $b('#bpMain');
  const y0 = new Date(s.cal.start * DAY).getUTCFullYear(), endY = Math.max(new Date(s.end * DAY).getUTCFullYear(), y0);
  const next = k => { for (let y = y0; y <= y0 + 2; y++) { const d = HOL[k][1](y); if (d >= s.cal.start) return d; } return HOL[k][1](y0); };
  const keys = new Set(p.hol.keys);
  const hols = holidayList(p, y0, endY + 1).filter(h => h.dn >= s.cal.start && h.dn <= Math.max(s.end, s.cal.start + 365) && wdOf(h.dn) !== 0 && (p.opts.sat || wdOf(h.dn) !== 6));
  main.innerHTML = `<div class="bp-pane">
    <div class="bp-card"><h3>Planning</h3><div class="bp-form">
      <label class="bp-f"><span>Nom</span><input data-o="name" value="${esc(p.name)}"></label>
      <label class="bp-f"><span>Indice</span><input data-o="indice" value="${esc(p.indice || '')}" maxlength="6"></label>
      <label class="bp-f"><span>Début des travaux</span><input data-o="start" type="date" value="${esc(p.start)}"></label>
      <label class="bp-f"><span>Heures par jour (équipes)</span><input data-o="hpd" type="number" step="0.25" min="1" max="12" value="${p.opts.hpd}"></label>
      <label class="bp-f"><span>Structure des tâches</span><select data-o="structure"><option value="flat">Liste simple</option><option value="lots">Lots › tâches (2 niveaux)</option><option value="tree">Arborescence libre</option></select></label>
      <label class="bp-f"><span>Source du budget</span><select data-o="budget"><option value="res">Ressources (durée × tarifs)</option><option value="man">Montant saisi par tâche</option><option value="mix">Ressources + montant saisi</option></select></label>
      <label class="bp-chk"><input type="checkbox" data-o="sat" ${p.opts.sat ? 'checked' : ''}>Samedi travaillé</label>
    </div></div>
    <div class="bp-card"><h3>Jours fériés · <select data-o="canton" style="height:34px">${Object.entries(CANTONS).map(([k, v]) => `<option value="${k}" ${p.hol.canton === k ? 'selected' : ''}>${k} – ${esc(v[0])}</option>`).join('')}</select></h3>
      <p class="bp-hint">Fériés par défaut du canton ; coche / décoche selon ta commune et la convention de ton entreprise.</p>
      <div class="bp-hols">${HOL_ORDER.map(k => `<label><input type="checkbox" data-hol="${k}" ${keys.has(k) ? 'checked' : ''}>${esc(HOL[k][0])}<small>${shortOfDn(next(k))}</small></label>`).join('')}</div>
      <h4 style="margin:12px 0 6px">Autres jours chômés</h4><div class="bp-lst">${p.hol.extra.map((x, i) => `<div class="bp-li"><input type="date" data-ex="${i}" data-k="d" value="${esc(x.d)}" style="flex:0 0 160px"><input data-ex="${i}" data-k="label" value="${esc(x.label || '')}" placeholder="ex. Fête locale"><button class="bp-ib" data-exrm="${i}">${I.x}</button></div>`).join('')}</div>
      <div style="margin-top:6px"><button class="bp-btn" data-exadd>${I.plus}Jour chômé</button></div>
    </div>
    <div class="bp-card"><h3>Vacances du bâtiment</h3>
      <div class="bp-lst">${p.vac.map((v, i) => `<div class="bp-li"><input type="date" data-va="${i}" data-k="from" value="${esc(v.from)}" style="flex:0 0 160px"><span>au</span><input type="date" data-va="${i}" data-k="to" value="${esc(v.to)}" style="flex:0 0 160px"><input data-va="${i}" data-k="label" value="${esc(v.label || '')}" placeholder="ex. Vacances d’été"><button class="bp-ib" data-varm="${i}">${I.x}</button></div>`).join('') || '<p class="bp-hint">Aucune période.</p>'}</div>
      <div style="margin-top:6px"><button class="bp-btn" data-vaadd>${I.plus}Période</button> <span class="bp-hint">Reprises automatiquement dans les nouveaux plannings.</span></div>
    </div>
    <div class="bp-card"><h3>Jours non travaillés du planning (${chOfDn(s.cal.start)} → ${chOfDn(Math.max(s.end, s.cal.start + 365))})</h3>
      <div class="bp-hols">${hols.map(h => `<label>${esc(h.label)}<small>${chOfDn(h.dn)}</small></label>`).join('') || '<p class="bp-hint">Aucun.</p>'}</div>
      ${p.vac.length ? `<p class="bp-hint">+ vacances : ${p.vac.map(v => `${esc(v.label || 'vacances')} ${v.from ? chOfDn(dnOfIso(v.from)) : '?'} – ${v.to ? chOfDn(dnOfIso(v.to)) : '?'}`).join(' · ')}</p>` : ''}
    </div>
    <div class="bp-card"><h3>Mise en page <button class="bp-btn" data-a="layout">${I.edit}Modifier la mise en page…</button></h3>
      <p class="bp-hint">${p.lay ? 'Ce planning a sa <b>propre mise en page</b>.' : 'Ce planning suit le <b>modèle commun</b> (le même pour tous les plannings, sur la tablette et le PC).'} Colonnes du tableau, couleurs des barres, affichage à l’écran, PDF imprimé (format, cartouche, logo, période, légende).</p></div>
    <div class="bp-card"><h3>Fichier</h3>
      <p class="bp-hint">Enregistré sur l’appareil et dans le Drive : « ${esc(site(U.siteId) ? site(U.siteId).folder : '')} / Planning / ${esc(cleanName(p.name))}.json », avec une copie MS Project à jour « ${esc(cleanName(p.name))}.xml » (à ouvrir dans Project : Fichier › Ouvrir). Exports dans « Planning / Exports ».</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="bp-btn" data-dup>Dupliquer ce planning</button><button class="bp-btn" data-a="import">${I.imp}Importer MS Project (XML)</button><button class="bp-btn dang" data-delplan>${I.del}Supprimer ce planning</button></div>
    </div>
  </div>`;
  main.querySelector('[data-o=structure]').value = p.opts.structure;
  main.querySelector('[data-o=budget]').value = p.opts.budget;
}
function setChange(e){
  const el = e.target, p = U.plan; if (!p) return;
  if (el.dataset.o) {
    const k = el.dataset.o, v = el.type === 'checkbox' ? el.checked : el.value;
    if (k === 'canton') { mut(pp => { pp.hol.canton = v; pp.hol.keys = cantonKeys(v); }); toast('Fériés du canton ' + v + ' appliqués'); return; }
    if (k === 'structure') {
      const need = Math.max(1, ...U.sch.ol.map(o => o.lvl + 1)), mx = ({flat:1, lots:2, tree:9})[v];
      if (need > mx) { toast(`Le planning a ${need} niveaux : remonte d’abord les tâches (bouton ←)`); el.value = p.opts.structure; return; }
    }
    mut(pp => { if (k === 'name') { pp.name = String(v).trim() || pp.name; } else if (k === 'indice' || k === 'start') pp[k] = v || pp[k]; else if (k === 'hpd') pp.opts.hpd = Math.max(1, +v || 8.5); else pp.opts[k] = v; });
    if (k === 'name') { const o = $b(`#bpPlan option[value="${U.rec.uid}"]`); if (o) o.textContent = p.name; }
    return;
  }
  if (el.dataset.hol) { mut(pp => { const s = new Set(pp.hol.keys); if (el.checked) s.add(el.dataset.hol); else s.delete(el.dataset.hol); pp.hol.keys = HOL_ORDER.filter(k => s.has(k)); }); return; }
  if (el.dataset.ex != null) { mut(pp => { pp.hol.extra[+el.dataset.ex][el.dataset.k] = el.value; }); return; }
  if (el.dataset.va != null) { mut(pp => { pp.vac[+el.dataset.va][el.dataset.k] = el.value; }); saveVac(); return; }
  if (el.id === 'bdStatus') { U.statusDn = dnOfIso(el.value) ?? todayDn(); U.sch = schedule(p, U.cal, U.statusDn); render(); }
}
function saveVac(){ try { localStorage.setItem('baugest.planVac', JSON.stringify(U.plan.vac.filter(v => v.from && v.to))); } catch (e) {} }

/* ---------- Référence ---------- */
async function baselineDlg(){
  const p = U.plan;
  if (!p.baseline) {
    if (!await confirmDlg('Planning de référence', 'Figer maintenant les dates et le budget de toutes les tâches ? Ils servent de comparaison (barres grises, écarts de délai et de coût, valeur acquise).', 'Figer la référence')) return;
    mut(pp => { pp.baseline = takeBaseline(pp, U.sch); }); U.showBase = true; render(); toast('Référence figée'); return;
  }
  const v = await dlg({title:'Planning de référence', body:`<p>Référence figée le ${chOfDn(dnOfIso(p.baseline.at.slice(0, 10)))} · fin prévue ${chOfDn(dnOfIso(p.baseline.end) ?? p.baseline.end)}.</p><p class="bp-hint">La remplacer efface la comparaison avec l’ancienne.</p>`,
    buttons:[{label:'Supprimer', value:'del', dang:true, left:true}, {label:'Annuler', value:null}, {label:'Remplacer par le planning actuel', value:'new', pri:true}]});
  if (v === 'new') { mut(pp => { pp.baseline = takeBaseline(pp, U.sch); }); toast('Référence mise à jour'); }
  else if (v === 'del') mut(pp => { pp.baseline = null; });
}

/* ---------- Exports ---------- */
const fileBase = () => { const s = site(U.siteId); return cleanName((s ? s.label + ' – ' : '') + U.plan.name); };
async function exportMenu(){
  const L0 = LAY().pdf;
  const r = await dlg({title:'Exporter', width:560, body:`${fmtFields(L0)}${pickFields(L0)}<div style="height:10px"></div>
    <div class="bp-menu">
    <button class="bp-btn" data-x="print">${I.print}<span>Imprimer<small>Directement sur l’imprimante, avec la mise en page du PDF</small></span></button>
    <button class="bp-btn" data-x="pdf">${I.exp}<span>PDF<small>Gantt imprimable avec cartouche, au format choisi ci-dessus</small></span></button>
    <button class="bp-btn" data-x="xlsx">${I.tbl}<span>Excel<small>Tâches, ressources, budget, réalisé, fériés, analyse des ressources</small></span></button>
    <button class="bp-btn" data-x="xml">${I.cal}<span>MS Project (XML)<small>À ouvrir dans Project : Fichier › Ouvrir › XML</small></span></button>
    <button class="bp-btn" data-x="layout">${I.edit}<span>Mise en page…<small>Colonnes, couleurs, format, cartouche, logo, période</small></span></button>
    <button class="bp-btn" data-x="import">${I.imp}<span>Importer MS Project (XML)<small>Crée un nouveau planning dans ce chantier</small></span></button>
  </div><p class="bp-hint">Le fichier est téléchargé et copié dans le Drive (Planning / Exports).</p>`,
    buttons:[{label:'Fermer', value:null}], onOpen:(b, done) => pickBind(b) || b.querySelectorAll('[data-x]').forEach(x => x.addEventListener('click', () => done({x:x.dataset.x, lo:fmtRead(b, LAY())})))});
  if (!r) return;
  const v = r.x, lo = r.lo;
  if (v === 'import') return importXml();
  if (v === 'layout') return layDlg();
  if (v === 'print') return printPlan(lo);
  try {
    toast('Préparation de l’export…', 1500);
    const stamp = isoOfDn(todayDn());
    const out = v === 'pdf' ? {blob:await makePdf(lo), name:`${fileBase()} – Gantt ${lo.pdf.size} ${stamp}.pdf`}
      : v === 'xlsx' ? {blob:await makeXlsx(), name:`${fileBase()} – planning ${stamp}.xlsx`}
      : {blob:new Blob([toMSPDI(U.plan, U.sch)], {type:'application/xml'}), name:`${fileBase()} – MS Project ${stamp}.xml`};
    if (v === 'pdf') fitNote(out.blob);
    download(out.blob, out.name);
    const up = await exportToDrive(out.blob, out.name);
    toast(up ? 'Exporté : téléchargé + Drive › Planning › Exports' : 'Exporté (téléchargé)');
  } catch (e) { console.error('export', e); toast('Export impossible : ' + ((e && e.message) || e), 5000); }
}
async function importXml(){
  const f = await pickFile('.xml,application/xml,text/xml'); if (!f) return;
  try {
    const p = fromMSPDI(await f.text(), U.siteId);
    if (!p.tasks.length) throw new Error('aucune tâche trouvée');
    await addRec(p);
    toast(`Importé : ${p.tasks.length} tâches, ${p.res.length} ressources. Vérifie le canton dans Réglages.`, 5000);
  } catch (e) { toast('Import impossible : ' + e.message, 5000); }
}
const winAnsi = s => String(s ?? '').replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•…€œŒ]/g, c => ({'→':'>', '≥':'>=', '≤':'<=', '×':'x', '◆':'*', '⚠':'!', '\t':' ', '\n':' '})[c] || '?');
async function makePdf(layOv){
  await loadScript(PDFLIB_URL);
  const {PDFDocument, StandardFonts, rgb} = window.PDFLib;
  const p = U.plan, s = U.sch, cal = s.cal, st = site(U.siteId), Ly = layOv || LAY(), Pp = Ly.pdf, cm = costMap();
  const hex = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); const n = m ? parseInt(m[1], 16) : 0x888888; return rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
  const doc = await PDFDocument.create(); doc.setTitle(winAnsi(p.name)); doc.setCreator('BauGest');
  const F = await doc.embedFont(StandardFonts.Helvetica), FB = await doc.embedFont(StandardFonts.HelveticaBold);
  let [W, Hp] = PAPER[Pp.size] || PAPER.A3; if (Pp.orient === 'port') [W, Hp] = [Hp, W];
  const W0 = W, H0 = Hp, kf = Pp._k > 1 ? Pp._k : 1; W *= kf; Hp *= kf;   /* ajuster à la page : dessin sur une page agrandie (même proportions), réduite à la fin */
  const M = 22, RHp = +Pp.rh || 13.5, FS = +Pp.font || 7.5;
  /* colonnes : réduites si elles prennent plus de 55 % de la largeur */
  let cols = Ly.cols.filter(k => Ly.pdfc.includes(k)).map(k => ({k, l:COLDEF[k].l, w:COLDEF[k].pw * FS / 7.5, r:COLDEF[k].n}));
  let tw = cols.reduce((a, c) => a + c.w, 0); const maxTw = (W - 2 * M) * .55; if (tw > maxTw) { const k = maxTw / tw; cols.forEach(c => c.w *= k); tw = maxTw; }
  const cx0 = M + tw + 6, cw = W - M - cx0;
  /* logo : en haut à gauche (hauteur logoH mm) et / ou dans le cartouche */
  let logo = null;
  const lPos = Pp.logoPos || 'tl', lTop = lPos !== 'cart', lCart = Pp.cart && lPos !== 'tl';
  if (Pp.logo !== 'none' && (lTop || lCart)) {
    const L = logoList(), src = Pp.logo === 'comp' ? L.comp : Pp.logo === 'site' ? L.site : Pp.logoSrc;
    if (src) try { const png = await logoPng(src); if (png) logo = await doc.embedPng(png); } catch (e) {}
  }
  const lH = logo && lTop ? Math.max(14, (+Pp.logoH || 15) * 72 / 25.4) : 0, lW = lH ? Math.min(W * .4, logo.width * lH / logo.height) : 0, lH2 = lW && logo.width * lH / logo.height > lW ? lW * logo.height / logo.width : lH, tX = M + (lW ? lW + 12 : 0);
  const titleH = Math.max(Pp.subtitle ? 44 : 30, lH2 + 8), top = Hp - M - titleH, tlH = 26, rowsTop = top - tlH;
  const notes = noteList(Pp), legY = Math.max(M + (Pp.cart ? 46 : 8), M + 2 + (notes.length ? (Pp.legend ? 14 : 0) + (notes.length - 1) * 11 : 0));
  const foot = Pp.cart ? Math.max(M + 64, legY + 18) : Pp.legend || notes.length ? legY + 22 : M + 14, per = Math.max(1, Math.floor((rowsTop - foot) / RHp));
  const C = {txt:rgb(.1, .11, .13), mut:rgb(.42, .45, .48), line:rgb(.8, .8, .8), off:rgb(.93, .93, .93), zebra:rgb(.97, .97, .97),
    task:hex(Ly.colors.task), crit:hex(Ly.colors.crit), done:hex(Ly.colors.done), sum:hex(Ly.colors.sum), ms:hex(Ly.colors.ms), base:hex(Ly.colors.base), late:hex(Ly.colors.late), today:hex(Ly.colors.today)};
  const base = p.baseline && Pp.base ? p.baseline.tasks : null;
  /* période */
  let d0 = cal.start, d1 = s.end, rowsAll = s.ol, ftxt = '';
  const Fl = Pp.filter;
  if (Fl && Fl.k && Fl.ids && Fl.ids.length) {
    const set = new Set(Fl.ids), byId = new Map(p.tasks.map(t => [t.id, t])), anc = t => { const a = []; let x = t, g = 0; while (x && g++ < 30) { a.push(x); x = x.parent ? byId.get(x.parent) : null; } return a; };
    const kept = new Set(s.ol.filter(o => Fl.k === 'zones' ? !o.sum && set.has(zoneOf(o.t, p)) : anc(o.t).some(x => set.has(x.id))).map(o => o.t.id));
    for (const id of [...kept]) for (const x of anc(byId.get(id)).slice(1)) kept.add(x.id);
    rowsAll = s.ol.filter(o => kept.has(o.t.id));
    if (!rowsAll.length) throw new Error('aucune tâche dans cette sélection');
    ftxt = Fl.k === 'zones' ? (Fl.ids.length > 1 ? 'Zones : ' : 'Zone : ') + Fl.ids.join(', ') : Fl.k === 'lots' ? (Fl.ids.length > 1 ? 'Lots : ' : 'Lot : ') + Fl.ids.map(id => (byId.get(id) || {}).name).filter(Boolean).join(', ') : 'Sélection : ' + rowsAll.filter(o => !o.sum).length + ' tâche(s)';
  }
  if (Pp.range === 'custom' && dnOfIso(Pp.from) != null && dnOfIso(Pp.to) != null && dnOfIso(Pp.to) >= dnOfIso(Pp.from)) { d0 = dnOfIso(Pp.from); d1 = dnOfIso(Pp.to); }
  else if (Pp.range === '3w') { d0 = todayDn(); while (wdOf(d0) !== 1) d0--; d1 = d0 + 20; }
  else { if (base) for (const k in base) { const b = base[k]; d0 = Math.min(d0, b.start); d1 = Math.max(d1, b.finish); } if (ftxt) { d0 = Infinity; d1 = -Infinity; } for (const o of rowsAll) { const r = s.R.get(o.t.id); d0 = Math.min(d0, r.start); d1 = Math.max(d1, r.finish); } d0 -= 2; d1 += 3; }
  if (Pp.range !== 'all' && Pp.only) rowsAll = rowsAll.filter(o => { const r = s.R.get(o.t.id); return r.start <= d1 && r.finish >= d0; });
  if (!rowsAll.length) throw new Error('aucune tâche dans cette période');
  const sc = cw / (d1 - d0 + 1), X = dn => cx0 + (Math.max(d0, Math.min(d1 + 1, dn)) - d0) * sc, inR = dn => dn >= d0 && dn <= d1 + 1;
  const text = (pg, t, x, y, o = {}) => { const f = o.b ? FB : F, sz = o.s || FS; let str = winAnsi(t); if (o.w) { while (str.length > 1 && f.widthOfTextAtSize(str, sz) > o.w) str = str.slice(0, -2) + '…'; }
    const tx = o.r ? x - f.widthOfTextAtSize(str, sz) : o.c ? x - f.widthOfTextAtSize(str, sz) / 2 : x; pg.drawText(str, {x:tx, y, size:sz, font:f, color:o.col || C.txt}); };
  if (Pp.fit && kf === 1 && rowsAll.length > per) { const k = (rowsAll.length * RHp + Hp - (rowsTop - foot) + 1) / Hp; return makePdf({...Ly, pdf:{...Pp, _k:k}}); }
  const pages = Math.max(1, Math.ceil(rowsAll.length / per)), comp = H.company ? H.company(U.siteId) : '';

  for (let pi = 0; pi < pages; pi++) {
    const pg = doc.addPage([W, Hp]), rows = rowsAll.slice(pi * per, (pi + 1) * per), y0 = rowsTop;
    if (lW) pg.drawImage(logo, {x:M, y:Hp - M - lH2, width:lW, height:lH2});
    text(pg, Pp.title || 'Planning – ' + p.name, tX, Hp - M - 16, {b:1, s:16, w:W - M - tX});
    if (Pp.subtitle) text(pg, `${st ? st.label : ''}   ·   Début ${chOfDn(cal.start)}   ·   Fin ${chOfDn(s.end)}   ·   ${s.pEnd} jours ouvrés${p.baseline ? '   ·   Référence : fin ' + chOfDn(p.baseline.end) : ''}${Pp.range !== 'all' ? '   ·   Période ' + chOfDn(d0) + ' – ' + chOfDn(d1) : ''}${ftxt ? '   ·   ' + ftxt : ''}`, tX, Hp - M - 32, {s:9, col:C.mut, w:W - M - tX});
    let hx = M; for (const c of cols) { text(pg, c.l, c.r ? hx + c.w - 3 : hx + 2, rowsTop + 8, {b:1, s:FS, r:c.r, col:C.mut, w:c.w - 3}); hx += c.w; }
    pg.drawLine({start:{x:M, y:rowsTop}, end:{x:W - M, y:rowsTop}, thickness:.8, color:C.txt});
    const nRows = rows.length, yb = y0 - nRows * RHp;
    if (sc >= 1.6) for (let d = d0; d <= d1; d++) if (!cal.isWork(d)) pg.drawRectangle({x:X(d), y:yb, width:sc, height:nRows * RHp, color:C.off});
    for (let d = d0; d <= d1; d++) {
      const dt = new Date(d * DAY);
      if (dt.getUTCDate() === 1 || d === d0) { pg.drawLine({start:{x:X(d), y:top}, end:{x:X(d), y:rowsTop}, thickness:.5, color:C.line}); const lab = MONTHS[dt.getUTCMonth()] + ' ' + String(dt.getUTCFullYear()).slice(2); if (sc * 28 > F.widthOfTextAtSize(lab, 7.5) + 6 || d1 - d0 < 40) text(pg, lab, X(d) + 3, top - 10, {s:7.5, b:1}); }
      if (sc >= 12) text(pg, String(dt.getUTCDate()), X(d) + sc / 2, rowsTop + 3, {s:6.5, c:1, col:C.mut});
      if (wdOf(d) === 1) { pg.drawLine({start:{x:X(d), y:rowsTop + 12}, end:{x:X(d), y:yb}, thickness:.25, color:C.line}); if (sc * 7 >= 13 && sc < 12) text(pg, String(isoWeek(d)), X(d) + sc * 3.5, rowsTop + 3, {s:6.5, c:1, col:C.mut}); }
    }
    pg.drawLine({start:{x:M, y:top}, end:{x:W - M, y:top}, thickness:.5, color:C.line});
    const tdn = todayDn(); if (tdn >= d0 && tdn <= d1) pg.drawLine({start:{x:X(tdn) + sc / 2, y:rowsTop}, end:{x:X(tdn) + sc / 2, y:yb}, thickness:1, color:C.today, dashArray:[3, 2]});
    const rowY = new Map();
    rows.forEach((o, i) => {
      const t = o.t, r = s.R.get(t.id), y = y0 - (i + 1) * RHp; rowY.set(t.id, y + RHp / 2);
      if (Pp.zebra && i % 2) pg.drawRectangle({x:M, y, width:tw, height:RHp, color:C.zebra});
      let x = M;
      cols.forEach(c => { const ind = c.k === 'name' ? o.lvl * 8 : 0; text(pg, cellTxt(c.k, o, r, cm), c.r ? x + c.w - 3 : x + 2 + ind, y + (RHp - FS) / 2 + 1, {s:FS, b:o.sum, r:c.r, w:c.w - 4 - ind, col:r.late && c.k === 'name' ? C.late : C.txt}); x += c.w; });
      const vis = r.start <= d1 && r.finish >= d0, bx = X(r.start), bw = Math.max(1.5, X(r.finish + 1) - bx), bh = Math.max(3, RHp - 6);
      if (base && base[t.id]) { const b = base[t.id]; if (b.dur > 0 && b.start <= d1 && b.finish >= d0) pg.drawRectangle({x:X(b.start), y:y + 1.2, width:Math.max(1, X(b.finish + 1) - X(b.start)), height:2.2, color:C.base}); }
      if (!vis) return;
      const tc = t.col ? hex(t.col) : null, cc = tc && Ly.crit && r.crit, st = t.st || {}, vert = st.pos === 't' || st.pos === 'b';
      const LS = 6.5, lcol = st.tc ? hex(st.tc) : C.mut, lim = W - M;
      /* texte de la barre (même règles qu'à l'écran) */
      const ptxt = (str, x0, x1, ym, top, bot, ink, inside) => {
        if (!str) return; const pos = st.pos || 'r', o2 = {s:LS, b:st.b, col:lcol};
        if (pos === 'i' && inside) { if (x1 - x0 > 10) text(pg, str, x0 + 2, ym - LS / 2 + 1, {...o2, col:st.tc ? lcol : ink, w:x1 - x0 - 4}); return; }
        if (pos === 'l') { if (x0 - 4 > cx0) text(pg, str, x0 - 4, ym - LS / 2 + 1, {...o2, r:1, w:x0 - 4 - cx0}); return; }
        if (pos === 't') { text(pg, str, x0, top + 1, {...o2, s:LS - .5, w:lim - x0}); return; }
        if (pos === 'b') { text(pg, str, x0, bot - LS + .5, {...o2, s:LS - .5, w:lim - x0}); return; }
        if (x1 + 4 < lim - 30) text(pg, str, x1 + 3, ym - LS / 2 + 1, {...o2, w:lim - (x1 + 3)});
      };
      const lbl = barLabel(Ly, o, r);
      if (o.sum) { const sco = tc || C.sum, sy = vert ? (st.pos === 't' ? y + 2.5 : y + RHp - 6) : y + RHp / 2 - 1;
        pg.drawRectangle({x:bx, y:sy, width:bw, height:3.5, color:sco}); if (inR(r.start)) pg.drawSvgPath('M0 0 L4 0 L0 5 Z', {x:bx, y:sy + 3.5, color:sco}); if (inR(r.finish + 1)) pg.drawSvgPath('M0 0 L-4 0 L0 5 Z', {x:bx + bw, y:sy + 3.5, color:sco});
        ptxt(lbl, bx, bx + bw, sy + 2, sy + 3.5, sy - 2, rgb(1, 1, 1), false); }
      else if (t.ms || r.dur === 0) { if (inR(r.mx)) { const my = vert ? (st.pos === 't' ? y + 5 : y + RHp - 5) : y + RHp / 2;
        pg.drawSvgPath('M0 -4.5 L4.5 0 L0 4.5 L-4.5 0 Z', {x:X(r.mx), y:my, color:tc || (r.done ? C.done : Ly.crit && r.crit ? C.crit : C.ms), borderColor:cc ? C.crit : undefined, borderWidth:cc ? 1 : 0});
        if (st.txt || (st.pos && st.pos !== 'i')) ptxt(st.txt ? lbl : shortOfDn(r.start), X(r.mx) - 5, X(r.mx) + 4, my, my + 4.5, my - 4.5, C.txt, false);
        else text(pg, shortOfDn(r.start), X(r.mx) + 7, y + (RHp - LS) / 2 + 1, {s:LS, col:lcol, b:st.b}); } }
      else {
        let bh = Math.max(3, RHp - 6); if (st.h === 's') bh = Math.max(1.5, bh * .5); else if (st.h === 'l') bh = RHp - 2.5;
        if (vert) bh = Math.min(bh, RHp * .35);
        const by = vert ? (st.pos === 't' ? y + 1 : y + RHp - bh - 1) : y + (RHp - bh) / 2, ym = by + bh / 2, fill = tc || (r.done ? C.done : Ly.crit && r.crit ? C.crit : C.task);
        pg.drawRectangle({x:bx, y:by, width:bw, height:bh, color:fill, borderColor:r.late ? C.late : cc ? C.crit : undefined, borderWidth:r.late || cc ? 1 : 0});
        if (st.pat === 'h') { const g = 3.2; for (let k = -bh; k < bw; k += g) { const xa = Math.max(0, k), xb = Math.min(bw, k + bh); if (xb > xa) pg.drawLine({start:{x:bx + xa, y:by + xa - k}, end:{x:bx + xb, y:by + xb - k}, thickness:.9, color:rgb(1, 1, 1), opacity:.6}); } }
        if (t.pct > 0 && t.pct < 100) pg.drawRectangle({x:bx, y:ym - 1, width:bw * t.pct / 100, height:2, color:rgb(0, 0, 0), opacity:.45});
        const ink = inkOn(t.col || (r.done ? Ly.colors.done : Ly.crit && r.crit ? Ly.colors.crit : Ly.colors.task)) === '#ffffff' ? rgb(1, 1, 1) : C.txt;
        ptxt(lbl, bx, bx + bw, ym, by + bh, by, ink, true);
      }
    });
    if (Pp.links) for (const l of s.links) {
      const ya = rowY.get(l.p), yz = rowY.get(l.s); if (ya == null || yz == null) continue;
      const rp = s.R.get(l.p), rs = s.R.get(l.s), fromEnd = l.type === 'FS' || l.type === 'FF', toStart = l.type === 'FS' || l.type === 'SS';
      const a1 = rp.dur > 0 ? (fromEnd ? rp.finish + 1 : rp.start) : rp.mx, a2 = rs.dur > 0 ? (toStart ? rs.start : rs.finish + 1) : rs.mx;
      if (!inR(a1) || !inR(a2)) continue;
      const x1 = X(a1), x2 = X(a2), col = Ly.crit && rp.crit && rs.crit ? C.crit : C.mut, xm = fromEnd ? x1 + 3 : x1 - 3;
      const seg = (a, b) => pg.drawLine({start:a, end:b, thickness:.5, color:col});
      seg({x:x1, y:ya}, {x:xm, y:ya}); seg({x:xm, y:ya}, {x:xm, y:yz}); seg({x:xm, y:yz}, {x:x2 + (toStart ? -1.5 : 1.5), y:yz});
      pg.drawSvgPath(toStart ? 'M0 0 L-3 -1.8 L-3 1.8 Z' : 'M0 0 L3 -1.8 L3 1.8 Z', {x:x2, y:yz, color:col});
    }
    pg.drawLine({start:{x:cx0 - 3, y:top}, end:{x:cx0 - 3, y:yb}, thickness:.5, color:C.line});
    /* légende, remarque, cartouche */
    const ly = legY;
    if (Pp.legend) {
      const leg = [...(Ly.crit ? [[C.crit, 'Chemin critique']] : []), [C.task, 'Tâche'], [C.done, 'Terminée'], ...(base ? [[C.base, 'Référence']] : []), [C.late, 'Retard'], [C.today, 'Aujourd’hui']];
      let lx = M; for (const [c, l] of leg) { pg.drawRectangle({x:lx, y:ly, width:12, height:6, color:c}); text(pg, l, lx + 16, ly, {s:7.5}); lx += 26 + F.widthOfTextAtSize(winAnsi(l), 7.5) + 12; }
      pg.drawSvgPath('M0 -4 L4 0 L0 4 L-4 0 Z', {x:lx + 4, y:ly + 3, color:C.ms}); text(pg, 'Jalon', lx + 12, ly, {s:7.5});
    }
    notes.forEach((nt, i) => text(pg, nt, M, ly - (Pp.legend ? 14 : 0) - i * 11, {s:8, b:1, col:C.mut, w:W - 2 * M - (Pp.cart ? (logo && lCart ? 410 : 340) : 0)}));
    if (Pp.cart) {
      const lw = logo && lCart ? 70 : 0, bwc = 330 + lw, bxc = W - M - bwc, byc = M, bhc = 56, tx0 = bxc + lw;
      pg.drawRectangle({x:bxc, y:byc, width:bwc, height:bhc, borderColor:C.txt, borderWidth:.8});
      if (lw) { const k = Math.min((lw - 10) / logo.width, (bhc - 10) / logo.height); pg.drawImage(logo, {x:bxc + (lw - logo.width * k) / 2, y:byc + (bhc - logo.height * k) / 2, width:logo.width * k, height:logo.height * k});
        pg.drawLine({start:{x:tx0, y:byc}, end:{x:tx0, y:byc + bhc}, thickness:.5, color:C.txt}); }
      pg.drawLine({start:{x:tx0, y:byc + 28}, end:{x:bxc + bwc, y:byc + 28}, thickness:.5, color:C.txt});
      pg.drawLine({start:{x:tx0 + 230, y:byc}, end:{x:tx0 + 230, y:byc + bhc}, thickness:.5, color:C.txt});
      if (comp) text(pg, comp, tx0 + 5, byc + 44, {b:1, s:9, w:220}); text(pg, st ? st.label : '', tx0 + 5, byc + 33, {s:8, w:220});
      text(pg, p.name, tx0 + 5, byc + 16, {b:1, s:9, w:220}); text(pg, 'Imprimé le ' + chOfDn(todayDn()), tx0 + 5, byc + 5, {s:7.5, col:C.mut});
      text(pg, 'Indice', tx0 + 236, byc + 44, {s:7, col:C.mut}); text(pg, p.indice || '–', tx0 + 236, byc + 32, {b:1, s:11});
      text(pg, 'Page', tx0 + 236, byc + 16, {s:7, col:C.mut}); text(pg, `${pi + 1} / ${pages}`, tx0 + 236, byc + 5, {b:1, s:9});
    } else text(pg, `${pi + 1} / ${pages}`, W - M, M, {s:7.5, r:1, col:C.mut});
  }
  if (kf > 1) for (const pg of doc.getPages()) { pg.scaleContent(1 / kf, 1 / kf); pg.setSize(W0, H0); }
  const blob = new Blob([await doc.save()], {type:'application/pdf'}); blob.fitPct = Math.round(100 / kf);
  return blob;
}
/* impression : le PDF de la mise en page. PC = PDF dans un cadre caché (qualité vectorielle) ;
   tablette = pages rendues en images (pdf.js) puis impression de la page (Android n'imprime pas un PDF dans un cadre) */
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
/* PC : aperçu = le PDF vectoriel dans la visionneuse PDF du navigateur (Chrome / Edge), imprimé avec son bouton 🖨 */
function printPreview(blob){
  const url = URL.createObjectURL(blob), sc = document.createElement('div'); sc.className = 'bp-scrim'; sc.style.padding = '0';
  sc.innerHTML = `<div class="bp-dlg" style="width:100%;height:100%;max-width:none;max-height:none;border-radius:0">
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line,#353a41)">
      <button class="bp-ib" data-x title="Fermer">${I.x}</button><b style="font:700 18px var(--display,sans-serif);text-transform:uppercase">Aperçu avant impression</b>
      <span class="bp-hint" style="flex:1">Imprimer avec l’icône imprimante en haut à droite de l’aperçu (ou Ctrl+P après un clic dans l’aperçu).</span>
      <button class="bp-btn" data-tab>Ouvrir dans un onglet</button><button class="bp-btn" data-dl>${I.exp}Télécharger</button></div>
    <iframe src="${url}" title="Aperçu du planning" style="flex:1;border:0;width:100%;background:#525659"></iframe></div>`;
  document.body.appendChild(sc);
  const done = () => { const k = U.dlgs.indexOf(entry); if (k >= 0) U.dlgs.splice(k, 1); sc.remove(); setTimeout(() => URL.revokeObjectURL(url), 600000); };
  const entry = {close:done, key:e => { if (e.key === 'Escape') { e.preventDefault(); done(); } }};
  U.dlgs.push(entry);
  sc.querySelector('[data-x]').addEventListener('click', done);
  sc.querySelector('[data-tab]').addEventListener('click', () => { if (!window.open(url, '_blank')) toast('Fenêtre bloquée : autorise les fenêtres pop-up pour ce site', 4000); });
  sc.querySelector('[data-dl]').addEventListener('click', () => download(blob, fileBase() + '.pdf'));
}
const PAPER = {A4:[841.89, 595.28], A3:[1190.55, 841.89], A2:[1683.78, 1190.55], A1:[2383.94, 1683.78], A0:[3370.39, 2383.94]};
const fmtFields = P0 => `<div class="bp-form"><label class="bp-f"><span>Format du papier</span><select id="exSize">${Object.keys(PAPER).map(k => `<option value="${k}" ${P0.size === k ? 'selected' : ''}>${k}${k === 'A2' || k === 'A1' || k === 'A0' ? ' – grand format' : ''}</option>`).join('')}</select></label>
    <label class="bp-f"><span>Orientation</span><select id="exOr"><option value="land">Paysage</option><option value="port" ${P0.orient === 'port' ? 'selected' : ''}>Portrait</option></select></label>
    <label class="bp-f w" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="exFit" ${P0.fit ? 'checked' : ''}><span style="font-size:14.5px;color:inherit">Ajuster à la page : tout le planning sur 1 page (réduit si besoin)</span></label></div>`;
/* quoi imprimer : période (mise en page, tout, du … au …, N semaines dès ce lundi, un mois) et tâches (toutes, lots, zones, sélection) */
const selIds = () => U.msel.size ? [...U.msel] : U.sel ? [U.sel] : [];
const pickFields = P0 => {
  const p = U.plan, lots = U.sch.ol.filter(o => o.sum), zones = zonesOf(p), ns = selIds().length, td = isoOfDn(todayDn());
  const rgL = P0.range === 'custom' ? `du ${chOfDn(dnOfIso(P0.from))} au ${chOfDn(dnOfIso(P0.to))}` : P0.range === '3w' ? '3 semaines' : 'tout';
  const ck = (name, v, l, on) => `<label class="bp-hol"><input type="checkbox" data-${name} value="${esc(v)}" ${on ? 'checked' : ''}><span>${esc(l)}</span></label>`;
  return `<h4>Période</h4><div class="bp-form">
    <label class="bp-f"><span>Dates</span><select id="exRg"><option value="lay">Comme la mise en page (${rgL})</option><option value="all">Tout le chantier</option><option value="custom">Du … au …</option><option value="w">Semaines dès ce lundi</option><option value="m">Un mois</option></select></label>
    <label class="bp-f" data-rg="custom"><span>Du</span><input type="date" id="exFrom" value="${esc(P0.from || td)}"></label>
    <label class="bp-f" data-rg="custom"><span>Au</span><input type="date" id="exTo" value="${esc(P0.to || isoOfDn(todayDn() + 27))}"></label>
    <label class="bp-f" data-rg="w"><span>Nombre de semaines</span><select id="exW">${[1, 2, 3, 4, 6, 8].map(n => `<option value="${n}" ${n === 3 ? 'selected' : ''}>${n} semaine${n > 1 ? 's' : ''}</option>`).join('')}</select></label>
    <label class="bp-f" data-rg="m"><span>Mois</span><input type="month" id="exM" value="${td.slice(0, 7)}"></label>
    <label class="bp-f w" data-rg="custom w m" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="exOnly" checked><span style="font-size:14.5px;color:inherit">Seulement les tâches de la période</span></label></div>
    <h4>Tâches</h4><div class="bp-form"><label class="bp-f"><span>Imprimer</span><select id="exTk"><option value="all">Toutes les tâches</option>${lots.length ? '<option value="lots">Lots choisis</option>' : ''}${zones.length ? '<option value="zones">Zones choisies</option>' : ''}${ns ? `<option value="sel" ${ns > 1 ? 'selected' : ''}>Tâches sélectionnées (${ns})</option>` : ''}</select></label></div>
    ${lots.length ? `<div class="bp-hols" data-tk="lots">${lots.map(o => ck('lot', o.t.id, o.wbs + ' ' + o.t.name, false)).join('')}</div>` : ''}
    ${zones.length ? `<div class="bp-hols" data-tk="zones">${zones.map(z => ck('zn', z, z, false)).join('')}</div>` : '<p class="bp-hint" data-tk="all">Zones : à saisir dans la fiche des tâches (ou Style pour plusieurs tâches) pour imprimer par zone.</p>'}`;
};
const pickBind = b => { const up = () => { const rg = b.querySelector('#exRg').value, tk = b.querySelector('#exTk').value;
  b.querySelectorAll('[data-rg]').forEach(x => x.hidden = !x.dataset.rg.split(' ').includes(rg)); b.querySelectorAll('[data-tk]').forEach(x => x.hidden = x.dataset.tk !== tk); };
  b.querySelector('#exRg').addEventListener('change', up); b.querySelector('#exTk').addEventListener('change', up); up(); };
const fmtRead = (b, Lx) => {
  const P = {...Lx.pdf, size:b.querySelector('#exSize').value, orient:b.querySelector('#exOr').value, fit:b.querySelector('#exFit').checked};
  const rg = b.querySelector('#exRg'), tk = b.querySelector('#exTk');
  if (rg) {
    const v = rg.value, only = b.querySelector('#exOnly').checked;
    if (v === 'all') Object.assign(P, {range:'all'});
    else if (v === 'custom') Object.assign(P, {range:'custom', from:b.querySelector('#exFrom').value, to:b.querySelector('#exTo').value, only});
    else if (v === 'w') { let d = todayDn(); while (wdOf(d) !== 1) d--; Object.assign(P, {range:'custom', from:isoOfDn(d), to:isoOfDn(d + 7 * +b.querySelector('#exW').value - 1), only}); }
    else if (v === 'm') { const m = b.querySelector('#exM').value || isoOfDn(todayDn()).slice(0, 7), [y, mo] = m.split('-').map(Number); Object.assign(P, {range:'custom', from:`${m}-01`, to:isoOfDn(Date.UTC(y, mo, 0) / DAY), only}); }
    const k = tk.value, ids = k === 'lots' ? [...b.querySelectorAll('[data-lot]:checked')].map(x => x.value) : k === 'zones' ? [...b.querySelectorAll('[data-zn]:checked')].map(x => x.value) : k === 'sel' ? selIds() : [];
    P.filter = k !== 'all' && ids.length ? {k, ids} : null;
  }
  return {...Lx, pdf:P};
};
const fitNote = blob => { if (blob.fitPct && blob.fitPct < 100) toast(`Ajusté à la page : réduit à ${blob.fitPct} %`, 3500); };
/* bouton Imprimer : format choisi pour cette impression (défaut = mise en page) ; A2 / A1 / A0 pour les plannings longs (traceur) */
const mmOf = P => { const [a, b] = (PAPER[P.size] || PAPER.A3).map(v => Math.round(v * 25.4 / 72)); return P.orient === 'port' ? [b, a] : [a, b]; };
async function printDlg(){
  if (!U.plan) return;
  const Lx = LAY(), b = await dlg({title:'Imprimer', width:560, body:fmtFields(Lx.pdf) + `<p class="bp-hint">A2 / A1 / A0 : plus de jours sur une page, pour les plannings longs (traceur ou imprimerie). Le format par défaut se règle dans Mise en page.</p>` + pickFields(Lx.pdf),
    buttons:[{label:'Annuler', value:null}, {label:'Imprimer', pri:true, check:bx => { const k = bx.querySelector('#exTk').value; if ((k === 'lots' || k === 'zones') && !bx.querySelector(k === 'lots' ? '[data-lot]:checked' : '[data-zn]:checked')) { toast(k === 'lots' ? 'Coche au moins un lot' : 'Coche au moins une zone'); return false; } return true; }}],
    onOpen:pickBind});
  if (!b) return;
  printPlan(fmtRead(b, Lx));
}
async function printPlan(layOv, build){
  if (!U.plan || U.printing) return;
  U.printing = true;
  try {
    toast('Préparation de l’impression…', 2000);
    const Ly = layOv || LAY(), blob = build ? await build() : await makePdf(Ly); if (!build) fitNote(blob);
    if (H.split) { printPreview(blob); return; }
    if (!window.pdfjsLib) await loadScript(PDFJS_URL + 'pdf.min.js');
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_URL + 'pdf.worker.min.js';
    const pdf = await window.pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise, urls = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i), vp = pg.getViewport({scale:Math.min(3, 6000 / Math.max(pg.view[2], pg.view[3]))}), c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await pg.render({canvasContext:g, viewport:vp}).promise;
      urls.push(URL.createObjectURL(await new Promise(r => c.toBlob(r, 'image/png'))));
    }
    const box = document.createElement('div'); box.id = 'bpPrint';
    box.innerHTML = `<style>@media screen{#bpPrint{display:none}}
      @media print{@page{size:${mmOf(Ly.pdf).join('mm ')}mm;margin:0}
      body>*:not(#bpPrint){display:none!important}html,body{margin:0!important;padding:0!important;background:#fff!important;height:auto!important;overflow:visible!important}
      #bpPrint{display:block}#bpPrint img{display:block;width:100%;height:auto;break-after:page;page-break-after:always}#bpPrint img:last-of-type{break-after:auto;page-break-after:auto}}</style>`
      + urls.map(u => `<img src="${u}" alt="">`).join('');
    document.body.appendChild(box);
    await Promise.all([...box.querySelectorAll('img')].map(im => im.decode ? im.decode().catch(() => {}) : null));
    const clean = () => { if (!box.isConnected) return; box.remove(); urls.forEach(u => URL.revokeObjectURL(u)); };
    addEventListener('afterprint', () => setTimeout(clean, 60000), {once:true});
    window.print();
    setTimeout(clean, 300000);
  } catch (e) { toast('Impression impossible : ' + ((e && e.message) || e), 5000); }
  finally { U.printing = false; }
}
async function makeXlsx(){
  await loadScript(XLSX_URL);
  const X = window.XLSX, p = U.plan, s = U.sch, E = evm(p, s), ev = new Map(E.rows.map(r => [r.id, r]));
  const D = dn => new Date(Date.UTC(1970, 0, 1) + dn * DAY + 12 * 36e5);
  const resName = id => (p.res.find(r => r.id === id) || {}).name || '';
  const tasks = [['N°', 'Tâche', 'Type', 'Durée (j ouvrés)', 'Début', 'Fin', 'Prédécesseurs', 'Avancement %', 'Marge (j)', 'Critique', 'Début réel', 'Fin réelle', 'Ressources', 'Budget CHF', 'Réel CHF', 'Remarque']];
  const asgX = l => (l || []).map(a => resName(a.r) + ' × ' + a.q + (perMode(a) ? ' (' + perTxt(a) + ')' : '')).join(', ');
  for (const o of s.ol) { const t = o.t, r = s.R.get(t.id), e = o.sum ? null : ev.get(t.id);
    tasks.push([o.wbs, '  '.repeat(o.lvl) + t.name, o.sum ? 'Lot' : t.ms ? 'Jalon' : 'Tâche', r.dur, D(r.start), D(r.finish), o.sum ? '' : predTxt(t), o.sum ? '' : t.pct, o.sum ? '' : r.tf, !o.sum && r.crit ? 'oui' : '',
      t.aStart ? D(dnOfIso(t.aStart)) : '', t.aEnd ? D(dnOfIso(t.aEnd)) : '', asgX(o.sum ? t.lres : t.asg), e ? Math.round(e.cur) : '', e ? Math.round(e.ac) : '', t.note || '']); }
  const res = [['Ressource', 'Type', 'Unité', 'Tarif', 'Unité du tarif', 'Capacité / jour', 'Coût prévu CHF']];
  const {st} = resStats();
  for (const r of p.res) res.push([r.name, RTYPES[r.type].label, unitOf(r), +r.rate || 0, RTYPES[r.type].rateUnit, RTYPES[r.type].time ? +r.cap || 0 : '', Math.round(st[r.id].cost)]);
  const bud = [['Situation au', D(s.statusDn)], ['Budget (BAC)', Math.round(E.BAC)], ['Prévu à date (PV)', Math.round(E.PV)], ['Valeur acquise (VA)', Math.round(E.EV)], ['Coût réel (CR)', Math.round(E.AC)],
    ['Écart de coût (VA − CR)', Math.round(E.CV)], ['Écart de délai (VA − PV)', Math.round(E.SV)], ['SPI', E.SPI == null ? '' : +E.SPI.toFixed(2)], ['CPI', E.CPI == null ? '' : +E.CPI.toFixed(2)], ['Coût final estimé', Math.round(E.EAC)], ['Écart final estimé', Math.round(E.VAC)], [],
    ['N°', 'Tâche', 'Budget réf. CHF', 'Budget actuel CHF', 'Avancement %', 'Valeur acquise CHF', 'Réel CHF', 'Écart CHF']];
  for (const o of s.ol) { const e = ev.get(o.t.id); if (!e) continue; bud.push([o.wbs, o.t.name + (e.lot ? ' (ressources du lot)' : ''), Math.round(e.bac), Math.round(e.cur), e.lot ? Math.round(e.pct) : o.t.pct, Math.round(e.ev), Math.round(e.ac), Math.round(e.ev - e.ac)]); }
  const act = [['Date', 'N°', 'Tâche', 'Ressource', 'Quantité', 'Unité', 'Montant CHF']];
  for (const o of s.ol) for (const e of o.t.act || []) { const r = p.res.find(z => z.id === e.r); act.push([e.d ? D(dnOfIso(e.d)) : '', o.wbs, o.t.name, r ? r.name : 'Montant libre', r ? +e.q : '', r ? (r.type === 'team' ? 'h' : r.type === 'machine' ? 'j' : r.unit) : '', Math.round(actLine(p, e) * 100) / 100]); }
  const y0 = new Date(s.cal.start * DAY).getUTCFullYear(), y1 = new Date(s.end * DAY).getUTCFullYear();
  const off = [['Date', 'Jour non travaillé']];
  for (const [dn, l] of [...s.cal.off.entries()].sort((a, b) => a[0] - b[0])) if (dn >= s.cal.start && new Date(dn * DAY).getUTCFullYear() <= Math.max(y1, y0 + 1) && wdOf(dn) !== 0) off.push([D(dn), l]);
  const wb = X.utils.book_new(), add = (rows, name, widths) => { const ws = X.utils.aoa_to_sheet(rows, {cellDates:true, dateNF:'dd\\.mm\\.yyyy'}); ws['!cols'] = widths.map(w => ({wch:w})); X.utils.book_append_sheet(wb, ws, name); };
  add(tasks, 'Tâches', [8, 40, 7, 9, 11, 11, 18, 8, 8, 8, 11, 11, 30, 12, 12, 30]);
  add(res, 'Ressources', [30, 18, 8, 10, 10, 12, 14]);
  add(bud, 'Budget', [26, 36, 14, 14, 12, 14, 12, 12]);
  add(act, 'Réalisé', [11, 8, 36, 26, 10, 7, 12]);
  add(off, 'Fériés et vacances', [11, 36]);
  anSheets(wb, X, anState());
  const out = X.write(wb, {bookType:'xlsx', type:'array', cellDates:true});
  return new Blob([out], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

/* ---------- événements ---------- */
function bind(el){
  el.addEventListener('click', async e => {
    const a = e.target.closest('[data-a]');
    if (a && !a.disabled) {
      const k = a.dataset.a;
      if (k === 'close') close();
      else if (k === 'split') setSplit(!U.split);
      else if (k === 'help') help();
      else if (k === 'layout') layDlg();
      else if (k === 'popout') popout();
      else if (k === 'new') newPlanDlg();
      else if (k === 'undo') undo();
      else if (k === 'redo') redo();
      else if (k === 'baseline') baselineDlg();
      else if (k === 'level') levelDlg();
      else if (k === 'export') exportMenu();
      else if (k === 'print') printDlg();
      else if (k === 'import') importXml();
      return;
    }
    const tab = e.target.closest('[data-tab]'); if (tab) { U.tab = tab.dataset.tab; render(); if (U.tab === 'gantt') setTimeout(scrollToday, 30); return; }
    if (!U.plan) return;
    const g = e.target.closest('[data-g]');
    if (g && !g.disabled) {
      const k = g.dataset.g;
      if (k === 'addT') insertTask('T'); else if (k === 'addM') insertTask('M'); else if (k === 'addL') insertTask('L');
      else if (k === 'ind') indent(1); else if (k === 'out') indent(-1); else if (k === 'up') move(-1); else if (k === 'down') move(1);
      else if (k === 'link') linkPrev(); else if (k === 'del') delTask(); else if (k === 'edit') editTask(U.sel);
      else if (k === 'selm') { U.selMode = !U.selMode; if (U.selMode && U.sel && !U.msel.size) U.msel.add(U.sel); if (!U.selMode) U.msel.clear(); render(); }
      else if (k === 'unsel') { U.msel.clear(); U.selMode = false; render(); }
      else if (k === 'rcopy') resCopySel(); else if (k === 'rpaste') resPasteSel();
      else if (k === 'style') styleDlg(U.msel.size ? [...U.msel] : [U.sel]);
      else if (k === 'today') scrollToday(); else if (k === 'cols') { U.full = !fullCols(); render(); } else if (k === 'base') { U.showBase = !U.showBase; render(); }
      return;
    }
    const z = e.target.closest('button[data-zoom]'); if (z) { U.zoom = z.dataset.zoom; render(); return; }
    const kf = {pointerType:e.pointerType || U.lastPt || 'mouse', ctrlKey:e.ctrlKey, metaKey:e.metaKey, shiftKey:e.shiftKey};
    const row = e.target.closest('#bpRows .bp-row[data-id]'); if (row) { tapRow(row.dataset.id, kf); return; }
    const sb = e.target.closest('#bpChart .bar'); if (sb && (sb.classList.contains('sum') || U.lastPt === 'touch')) { tapRow(sb.dataset.id, {...kf, pointerType:U.lastPt || 'mouse'}); return; }
    const rr = e.target.closest('[data-redit]'); if (rr) { editRes(rr.dataset.redit); return; }
    if (e.target.closest('[data-rnew]')) { editRes(null); return; }
    const tr = e.target.closest('tr[data-r]'); if (tr) { U.resSel = tr.dataset.r; render(); return; }
    const gt = e.target.closest('[data-goto]'); if (gt) { U.sel = gt.dataset.goto; U.tab = 'gantt'; render(); setTimeout(scrollToday, 30); return; }
    if (e.target.closest('[data-unlvl]')) { mut(p => { if (!p.tasks.some(t => t.lvl)) return false; for (const t of p.tasks) t.lvl = 0; }); toast('Décalages du lissage retirés'); return; }
    const ac = e.target.closest('[data-act]'); if (ac) { actDlg(ac.dataset.act); return; }
    if (e.target.closest('[data-exadd]')) { mut(p => { p.hol.extra.push({d:isoOfDn(todayDn()), label:''}); }); return; }
    const exr = e.target.closest('[data-exrm]'); if (exr) { mut(p => { p.hol.extra.splice(+exr.dataset.exrm, 1); }); return; }
    if (e.target.closest('[data-vaadd]')) { const y = new Date().getFullYear(); mut(p => { p.vac.push({from:`${y}-07-20`, to:`${y}-08-07`, label:'Vacances d’été'}); }); saveVac(); return; }
    const var_ = e.target.closest('[data-varm]'); if (var_) { mut(p => { p.vac.splice(+var_.dataset.varm, 1); }); saveVac(); return; }
    if (e.target.closest('[data-dup]')) { const c = JSON.parse(JSON.stringify(U.plan)); c.uid = uid(); c.name = U.plan.name + ' (copie)'; c.baseline = null; await addRec(c); toast('Planning dupliqué'); return; }
    if (e.target.closest('[data-delplan]')) {
      if (!await confirmDlg('Supprimer le planning', `Supprimer « ${esc(U.plan.name)} » ? Le fichier part dans la corbeille du Drive (récupérable 30 jours).`, 'Supprimer', true)) return;
      const rec = U.rec;
      try { for (const id of [rec.driveId, rec.xmlId]) if (id && online()) await H.api(`${DRV}/${encodeURIComponent(id)}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({trashed:true})}); }
      catch (err) { toast('Drive : ' + err.message); return; }
      await PDB.del(rec.uid).catch(() => {});
      U.recs = U.recs.filter(r => r !== rec); U.rec = null; U.plan = null;
      fillPlanSel(U.recs[0] && U.recs[0].uid); if (U.recs[0]) openRec(U.recs[0]); else render();
    }
  });
  el.addEventListener('pointerdown', e => { U.lastPt = e.pointerType; if (e.target.closest('#bpChart')) chartDown(e); }, true);
  document.addEventListener('pointerdown', e => { U.inPlan = !!(e.target.closest && e.target.closest('#bgPlan,.bp-scrim')); }, true);
  const spl = el.querySelector('.bp-splitter');
  spl.addEventListener('pointerdown', e => {
    e.preventDefault(); spl.setPointerCapture(e.pointerId); spl.classList.add('on');
    const mv = ev => { const w = ev.clientX / innerWidth * 100; document.documentElement.style.setProperty('--bp-w', Math.max(30, Math.min(80, w)) + '%'); };
    const up = ev => { spl.removeEventListener('pointermove', mv); spl.removeEventListener('pointerup', up); spl.classList.remove('on'); setSplit(true, ev.clientX / innerWidth * 100); };
    spl.addEventListener('pointermove', mv); spl.addEventListener('pointerup', up);
  });
  el.addEventListener('pointermove', e => { if (U.drag) chartMove(e); });
  el.addEventListener('pointerup', e => { if (U.drag) chartUp(e); });
  el.addEventListener('pointercancel', () => { if (U.drag) { U.drag = null; render(); } });
  el.addEventListener('change', e => {
    if (e.target.id === 'bpSite') { flush(); U.siteId = e.target.value; loadSite(); return; }
    if (e.target.id === 'bpPlan') { const r = U.recs.find(x => x.uid === e.target.value); if (r) openRec(r); return; }
    setChange(e);
  });
  /* clavier : capté avant la page hôte (l'explorateur du PC ne doit pas recevoir Suppr, flèches…) */
  addEventListener('keydown', e => {
    const root = document.getElementById('bgPlan');
    if (U.dlgs.length) { U.dlgs[U.dlgs.length - 1].key(e); e.stopPropagation(); return; }
    if (!root || root.hidden) return;
    if (U.split && !U.inPlan) return;
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); if (U.msel.size || U.selMode) { U.msel.clear(); U.selMode = false; render(); return; } close(); return; }
    if (!U.plan || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key, ctl = e.ctrlKey || e.metaKey;
    if (ctl && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (ctl && k.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (U.tab !== 'gantt') return;
    if (ctl && k.toLowerCase() === 'a') { e.preventDefault(); U.msel = new Set(U.sch.ol.map(o => o.t.id)); render(); return; }
    const ol = U.sch.ol, i = ol.findIndex(o => o.t.id === U.sel);
    if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); const j = Math.max(0, Math.min(ol.length - 1, i + (k === 'ArrowDown' ? 1 : -1))); if (ol[j]) select(ol[j].t.id); }
    else if (k === 'Enter' && U.sel) { e.preventDefault(); editTask(U.sel); }
    else if (k === 'Delete' && U.sel) { e.preventDefault(); delTask(); }
    else if (k === 'Tab' && U.sel && maxDepth(U.plan) > 1) { e.preventDefault(); indent(e.shiftKey ? -1 : 1); }
    else if (k === 'Insert') { e.preventDefault(); insertTask('T'); }
  }, true);
  addEventListener('online', () => { if (U.rec && U.rec.dirty) pushRec(U.rec); });
  addEventListener('pagehide', () => { if (U.rec && U.rec.dirty) PDB.put(U.rec).catch(() => {}); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && U.rec && U.rec.dirty) flush(); });
}

root.BGPlan = Object.assign(CORE, {
  init(host){ H = host; },
  open, close, back,
  async importXml(xml, siteId){ await open(siteId); const p = fromMSPDI(xml, U.siteId); if (!p.tasks.length) throw new Error('aucune tâche trouvée'); await addRec(p); toast(`Importé : ${p.tasks.length} tâches. Vérifie le canton dans Réglages.`, 5000); },
  isOpen:() => { const el = document.getElementById('bgPlan'); return !!el && !el.hidden; },
  /* jalons non terminés entre deux dates (AAAA-MM-JJ, fin exclue), plannings gardés sur cet appareil : accueil de la tablette */
  async milestones(from, to){
    const d0 = dnOfIso(from), d1 = dnOfIso(to), out = [];
    for (const rec of await PDB.all().catch(() => [])) {
      if (!rec || !rec.plan || !Array.isArray(rec.plan.tasks) || !rec.plan.tasks.some(t => t.ms)) continue;
      try {
        const p = normPlan(JSON.parse(JSON.stringify(rec.plan))), sch = schedule(p, makeCal(p));
        for (const t of p.tasks) {
          if (!t.ms || +t.pct >= 100 || t.aEnd) continue;
          const r = sch.R.get(t.id); if (!r || r.sum || r.start < d0 || r.start >= d1) continue;
          out.push({siteId:rec.siteId || p.siteId, plan:rec.name || p.name, uid:rec.uid, name:t.name, iso:isoOfDn(r.start)});
        }
      } catch (e) {}
    }
    return out;
  }
});
})(typeof window !== 'undefined' ? window : globalThis);
