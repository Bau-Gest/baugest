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
  for (const t of p.tasks) { t.deps = t.deps || []; t.asg = t.asg || []; t.act = t.act || []; t.pct = +t.pct || 0; t.dur = Math.max(0, Math.round(+t.dur || 0)); t.lvl = Math.max(0, Math.round(+t.lvl || 0)); if (t.parent === undefined) t.parent = null; }
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
function taskBudget(plan, t, dur){
  const m = plan.opts.budget, res = t.asg.reduce((s, a) => s + asgCost(plan, a, dur), 0), man = +t.bud || 0;
  return m === 'res' ? res : m === 'man' ? man : res + man;
}
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
    const cur = taskBudget(plan, t, r.dur);
    const b = base && base.tasks[t.id];
    const bac = b ? b.cost : cur, bes = b ? cal.idx(b.start) : r.es, bdur = b ? b.dur : r.dur;
    const frac = bdur > 0 ? Math.min(1, Math.max(0, (sIdx - bes) / bdur)) : (sIdx > bes ? 1 : 0);
    const pv = bac * frac, ev = bac * Math.min(100, +t.pct || 0) / 100, ac = taskActual(plan, t, st);
    BAC += bac; PV += pv; EV += ev; AC += ac; CUR += cur;
    rows.push({id:t.id, bac, cur, pv, ev, ac});
  }
  const SPI = PV > 0 ? EV / PV : null, CPI = AC > 0 ? EV / AC : null, EAC = CPI ? BAC / CPI : AC + (BAC - EV);
  return {rows, BAC, PV, EV, AC, CUR, SV:EV - PV, CV:EV - AC, SPI, CPI, EAC, VAC:BAC - EAC};
}
function takeBaseline(plan, sch){
  const tasks = {};
  for (const o of sch.ol) { if (o.sum) continue; const r = sch.R.get(o.t.id); tasks[o.t.id] = {start:r.start, finish:r.finish, mx:r.mx, dur:r.dur, cost:taskBudget(plan, o.t, r.dur)}; }
  return {at:new Date().toISOString(), end:sch.end, tasks};
}

/* ---------- Ressources : charge journalière et lissage ---------- */
function loads(plan, sch){
  const L = new Map();
  for (const r of plan.res) if (RTYPES[r.type] && RTYPES[r.type].time) L.set(r.id, new Map());
  for (const o of sch.ol) {
    if (o.sum) continue;
    const t = o.t, s = sch.R.get(t.id); if (!s || s.dur <= 0 || s.done) continue;
    for (const a of t.asg) { const m = L.get(a.r); if (!m) continue; for (let i = s.es; i < s.ef; i++) m.set(i, (m.get(i) || 0) + (+a.q || 0)); }
  }
  return L;
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
  const leaves = sch0.ol.filter(o => !o.sum).map(o => o.t), ids = new Set(leaves.map(t => t.id));
  const preds = new Map(leaves.map(t => [t.id, t.deps.filter(d => ids.has(d.id) && d.id !== t.id)]));
  const done = new Map(), left = new Set(leaves.map(t => t.id));
  const demand = t => { const m = new Map(); for (const a of t.asg) if (cap.has(a.r)) m.set(a.r, (m.get(a.r) || 0) + (+a.q || 0)); return m; };
  const fits = (dm, es, dur) => { for (const [r, q] of dm) { const c = cap.get(r), p = prof.get(r); if (q > c + 1e-9) continue; for (let i = es; i < es + dur; i++) if ((p.get(i) || 0) + q > c + 1e-9) return false; } return true; };
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
    const dm = demand(t), movable = !t.aStart && !(+t.pct > 0) && !t.ms && !r0.done && dur > 0 && dm.size;
    if (r0.fixed) es = r0.es;
    else if (movable) { let k = 0; while (!fits(dm, es, dur) && k++ < 1500) es++; if (k > 1500) es = base; t.lvl = es - base; }
    if (!r0.done) for (const [r, q] of dm) { const p = prof.get(r); for (let i = es; i < es + dur; i++) p.set(i, (p.get(i) || 0) + q); }
    done.set(id, {es, ef:es + dur}); left.delete(id);
  }
  const sch = schedule(work, cal, statusDn), moves = [];
  for (const t of work.tasks) { const old = plan.tasks.find(x => x.id === t.id); if (old && (t.lvl || 0) !== (old.lvl || 0)) { const r = sch.R.get(t.id); moves.push({id:t.id, name:t.name, from:old.lvl || 0, to:t.lvl, start:r.start, finish:r.finish, tf:r.tf}); } }
  const before = schedule(plan, cal, statusDn);
  return {moves, endBefore:before.end, endAfter:sch.end, left:overloads(work, sch).length, delay:cal.idx(sch.end) - cal.idx(before.end)};
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
    rMap.set(val(el, 'UID'), r); p.res.push(r);
  }
  for (const el of all(prj, 'Assignment')) {
    const tk = byUid.get(val(el, 'TaskUID')), r = rMap.get(val(el, 'ResourceUID')); if (!tk || !r) continue;
    tk.t.asg.push({r:r.id, q:+val(el, 'Units') || 1});
  }
  const depth = Math.max(0, ...outline(p).map(o => o.lvl));
  p.opts.structure = depth === 0 ? 'flat' : depth === 1 ? 'lots' : 'tree';
  p.opts.budget = 'res';
  return normPlan(p);
}

const CORE = {dnOfIso, isoOfDn, chOfDn, shortOfDn, todayDn, easter, HOL, HOL_ORDER, CANTONS, cantonKeys, holidayList, makeCal, newPlan, normPlan, outline, schedule,
  asgCost, taskBudget, taskActual, actLine, evm, takeBaseline, loads, overloads, levelProposal, toMSPDI, fromMSPDI, RTYPES, LINK, uid, maxDepth, round05};
if (typeof module !== 'undefined' && module.exports) { module.exports = CORE; return; }

/* ---------- Interface ---------- */
let H = null;
const U = {siteId:null, recs:[], rec:null, plan:null, cal:null, sch:null, tab:'gantt', zoom:'week', sel:null, undo:[], redo:[], saveT:0, pushT:0,
  resSel:null, statusDn:null, full:null, openTok:0, showBase:true, tap:{id:null, t:0}, drag:null, dlgs:[], listTok:0, pushing:null};
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
  base:ic('<path d="M4 20h16M6 16h12M8 12h8M10 8h4"/>'), lvl:ic('<path d="M3 20h18M6 16V9M10 16V5M14 16v-6M18 16v-3"/>'),
  exp:ic('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'), print:ic('<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>'), today:ic('<path d="M12 2v20M5 7h14"/>'), cal:ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  imp:ic('<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/>'), split:ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>'),
  win:ic('<path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'), tbl:ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>'), money:ic('<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>')
};
const COLORS = ['#3e8ed0', '#e8a33d', '#4caf7a', '#9b6fd6', '#d65f8f', '#3fb0b0', '#c97a46', '#7d8a2e'];

function css(){ return `
#bgPlan{position:fixed;inset:0;z-index:70;display:flex;flex-direction:column;background:var(--asphalt,var(--bg,#131518));color:var(--text,#ecebe6);font:15px/1.35 var(--body,system-ui,sans-serif);-webkit-user-select:none;user-select:none}
#bgPlan[hidden]{display:none}
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
    <nav class="bp-tabs"><button data-tab="gantt">Gantt</button><button data-tab="res">Ressources</button><button data-tab="bud">Budget</button><button data-tab="set">Réglages</button></nav>
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
  U.rec = rec; U.plan = normPlan(rec.plan); U.undo = []; U.redo = []; U.sel = null; U.resSel = null;
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
  else renderSet();
}

/* ---------- Mise en page : modèle commun (fichier Drive à la racine, partagé tablette / PC) + mise en page propre à un planning (plan.lay) ---------- */
const COLDEF = {
  wbs:{l:'N°', w:46, pw:30}, name:{l:'Tâche', w:230, pw:196}, dur:{l:'Durée', w:62, pw:34, n:1}, start:{l:'Début', w:84, pw:46, n:1}, fin:{l:'Fin', w:84, pw:46, n:1},
  pred:{l:'Préd.', w:84, pw:62}, pct:{l:'%', w:44, pw:28, n:1}, tf:{l:'Marge', w:64, pw:34, n:1}, aStart:{l:'Début réel', w:90, pw:46, n:1}, aEnd:{l:'Fin réelle', w:90, pw:46, n:1},
  res:{l:'Ressources', w:170, pw:110}, cost:{l:'Budget CHF', w:96, pw:54, n:1}
};
const COL_ORDER = Object.keys(COLDEF);
const COLOR_LBL = {task:'Tâche', crit:'Chemin critique', done:'Terminée', sum:'Lot', ms:'Jalon', base:'Référence', late:'Retard (contour)', today:'Aujourd’hui'};
const DEF_LAY = {
  cols:COL_ORDER.slice(), scr:['wbs', 'name', 'dur', 'start', 'fin', 'pred', 'pct', 'tf'], pdfc:['wbs', 'name', 'dur', 'start', 'fin'],
  colors:{task:'#3e8ed0', crit:'#e5484d', done:'#4caf7a', sum:'#6b7178', ms:'#6b7178', base:'#8a8f96', late:'#ff9f43', today:'#f2c230'},
  crit:true, barText:'res',
  screen:{rh:32, font:13, zoom:'week', links:true, base:true, weekend:true},
  pdf:{size:'A3', orient:'land', title:'', subtitle:true, legend:true, cart:true, logo:'comp', logoSrc:'', range:'all', from:'', to:'', only:false, font:7.5, rh:13.5, links:true, base:true, zebra:true, note:''}
};
const clone = o => JSON.parse(JSON.stringify(o));
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
    if (!o.sum) m.set(o.t.id, taskBudget(p, o.t, s.R.get(o.t.id).dur));
    else m.set(o.t.id, p.tasks.filter(t => t.parent === o.t.id).reduce((a, t) => a + (m.get(t.id) || 0), 0)); }
  return m;
}
const resTxt = t => t.asg.map(a => { const re = U.plan.res.find(z => z.id === a.r); return re ? re.name + (a.q && a.q !== 1 ? ' ×' + fmtN(a.q, a.q % 1 ? 1 : 0) : '') : ''; }).filter(Boolean).join(', ');
function cellTxt(k, o, r, cm){
  const t = o.t;
  if (k === 'wbs') return o.wbs;
  if (k === 'name') return t.name;
  if (k === 'dur') return (t.ms && !o.sum ? 0 : r.dur) + ' j';
  if (k === 'start') return shortOfDn(r.start);
  if (k === 'fin') return shortOfDn(r.finish);
  if (k === 'pred') return o.sum ? '' : predTxt(t);
  if (k === 'pct') return o.sum ? '' : Math.round(t.pct) + '%';
  if (k === 'tf') return o.sum ? '' : r.tf + ' j';
  if (k === 'aStart') return t.aStart ? shortOfDn(dnOfIso(t.aStart)) : '';
  if (k === 'aEnd') return t.aEnd ? shortOfDn(dnOfIso(t.aEnd)) : '';
  if (k === 'res') return o.sum ? '' : resTxt(t);
  if (k === 'cost') return cm ? fmtN(cm.get(t.id) || 0) : '';
  return '';
}
const barLabel = (Ly, o) => { if (o.sum || Ly.barText === 'none') return ''; const rs = resTxt(o.t);
  return Ly.barText === 'name' ? o.t.name : Ly.barText === 'both' ? o.t.name + (rs ? ' · ' + rs : '') : rs; };
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
      <label class="bp-f"><span>Format</span>${sel('lySize', Ly.pdf.size, [['A3', 'A3'], ['A4', 'A4']])}</label>
      <label class="bp-f"><span>Orientation</span>${sel('lyOrient', Ly.pdf.orient, [['land', 'Paysage'], ['port', 'Portrait']])}</label>
      <label class="bp-f w"><span>Titre (vide = « Planning – nom du planning »)</span><input id="lyTitle" value="${esc(Ly.pdf.title)}" placeholder="Planning – ${esc(p.name)}"></label>
      <label class="bp-f"><span>Période</span>${sel('lyRange', Ly.pdf.range, [['all', 'Tout le chantier'], ['custom', 'Du … au …'], ['3w', '3 semaines dès aujourd’hui']])}</label>
      <label class="bp-f" data-rg><span>Du</span><input type="date" id="lyFrom" value="${esc(Ly.pdf.from)}"></label>
      <label class="bp-f" data-rg><span>Au</span><input type="date" id="lyTo" value="${esc(Ly.pdf.to)}"></label>
      <div data-rg2>${ck('lyOnly', Ly.pdf.only, 'Seulement les tâches de la période')}</div>
      <label class="bp-f"><span>Taille du texte</span>${sel('lyPFont', Ly.pdf.font, [[6.5, 'Petite'], [7.5, 'Normale'], [9, 'Grande'], [10.5, 'Très grande']])}</label>
      <label class="bp-f"><span>Hauteur des lignes</span>${sel('lyPRh', Ly.pdf.rh, [[11, 'Compacte'], [13.5, 'Normale'], [17, 'Grande']])}</label>
      ${ck('lySub', Ly.pdf.subtitle, 'Ligne d’infos sous le titre')}${ck('lyLeg', Ly.pdf.legend, 'Légende')}${ck('lyCart', Ly.pdf.cart, 'Cartouche')}
      ${ck('lyPLinks', Ly.pdf.links, 'Flèches des liens')}${ck('lyPBase', Ly.pdf.base, 'Référence')}${ck('lyZebra', Ly.pdf.zebra, 'Lignes alternées')}
      <label class="bp-f w"><span>Remarque en bas de page</span><input id="lyNote" value="${esc(Ly.pdf.note)}" placeholder="ex. Document provisoire – sous réserve des intempéries"></label>
      <label class="bp-f w"><span>Logo du cartouche</span>${sel('lyLogo', Ly.pdf.logo, [['comp', 'Logo de l’entreprise du chantier'], ['site', 'Logo du chantier'], ['pick', 'Logo choisi (ci-dessous)'], ['none', 'Pas de logo']])}</label>
      <div class="bp-f w" id="lyPick">${logoGrid(logoCur)}</div>
    </div>`,
    buttons:[{label:'Valeurs d’origine', value:'reset', left:true}, ...(own ? [{label:'Revenir au modèle commun', value:'common'}] : []), {label:'Aperçu PDF', value:'preview'}, {label:'Annuler', value:null}, {label:'Enregistrer', pri:true}],
    onOpen:b => {
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
            logo:v('lyLogo').value, logoSrc:v('lyLogo').value === 'pick' ? logoCur : '', range:v('lyRange').value, from:v('lyFrom').value, to:v('lyTo').value, only:v('lyOnly').checked,
            font:+v('lyPFont').value, rh:+v('lyPRh').value, links:v('lyPLinks').checked, base:v('lyPBase').checked, zebra:v('lyZebra').checked, note:v('lyNote').value.trim()}};
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
      if (c.k === 'name') v = `<span style="padding-left:${o.lvl * 16}px"></span><span class="bp-tw">${o.sum ? '▾' : t.ms ? '◆' : ''}</span><span class="nm">${esc(t.name)}</span>`;
      else v = esc(cellTxt(c.k, o, r, cm));
      return `<div class="bp-cell ${c.k === 'wbs' ? 'wbs' : c.k === 'name' ? '' : c.k === 'tf' ? 'num tf' : c.n ? 'num' : ''} ${c.k === 'name' ? 'nm-c' : ''}" style="width:${c.w}px">${v}</div>`;
    };
    return `<div class="bp-row ${o.sum ? 'sum' : ''} ${U.sel === t.id ? 'sel' : ''} ${r.late ? 'late' : ''} ${r.crit && !o.sum ? 'crit' : ''}" data-id="${esc(t.id)}" style="height:${RH}px" title="${esc(t.name)}${r.late ? ' — en retard' : ''}">${cols.map(cell).join('')}</div>`;
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
    const lbl = barLabel(Ly, o), cr = Ly.crit && r.crit;
    if (o.sum) {
      bars += `<g class="bar sum" data-id="${esc(t.id)}"><path class="b" d="M${bx} ${y + RH / 2 - 6}h${bw}v10l-5 -5h${-(bw - 10)}l-5 5z" fill="${t.col || CO.sum}"/></g>`;
    } else if (t.ms || r.dur === 0) {
      const cx = x(r.mx), cy = y + RH / 2;
      bars += `<g class="bar ${U.sel === t.id ? 'sel' : ''}" data-id="${esc(t.id)}"><path class="b" d="M${cx} ${cy - 8} l8 8 -8 8 -8 -8z" fill="${t.col || (r.done ? CO.done : cr ? CO.crit : CO.ms)}" ${t.col && cr ? `stroke="${CO.crit}" stroke-width="2"` : ''}/><circle class="lk" cx="${cx + 15}" cy="${cy}" r="5"/></g>`
        + `<text x="${cx + 24}" y="${cy + 4}">${esc(t.name)} · ${shortOfDn(r.start)}</text>`;
    } else {
      const col = t.col || (r.done ? CO.done : cr ? CO.crit : CO.task), pw = bw * Math.min(100, t.pct) / 100, bh = Math.max(6, RH - 16);
      bars += `<g class="bar ${U.sel === t.id ? 'sel' : ''}" data-id="${esc(t.id)}"><rect class="b" x="${bx}" y="${y + (RH - bh) / 2}" width="${bw}" height="${bh}" rx="3" fill="${col}" ${r.late ? `stroke="${CO.late}" stroke-width="2" stroke-dasharray="4 2"` : t.col && cr ? `stroke="${CO.crit}" stroke-width="2"` : ''}/>`
        + (pw > 0 ? `<rect x="${bx}" y="${y + RH / 2 - 2}" width="${pw}" height="4" fill="rgba(0,0,0,.45)" pointer-events="none"/>` : '')
        + `<rect class="rs" x="${bx + bw - 6}" y="${y + 5}" width="10" height="${RH - 12}"/><circle class="lk" cx="${bx + bw + 9}" cy="${y + RH / 2}" r="5"/></g>`
        + (lbl ? `<text class="mut" x="${bx + bw + 18}" y="${y + RH / 2 + 4}">${esc(lbl)}</text>` : '');
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
      <marker id="bpAhc" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" fill="${CO.crit}"/></marker></defs>
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
  const asgRow = a => `<div class="bp-li" data-asg><select data-k="r">${resOpts}</select><input data-k="q" class="n" type="number" step="any" min="0" value="${+a.q || 1}"><span class="bp-hint" data-u></span><span class="cost" data-c></span><button class="bp-ib" data-rm title="Retirer">${I.x}</button></div>`;
  const body = sum ? `
    <label class="bp-f"><span>Nom du lot</span><input id="tkName" value="${esc(t.name)}" ${isNew ? 'autofocus' : ''}></label>
    <p class="bp-hint">Lot : ses dates (${shortOfDn(r.start)} → ${shortOfDn(r.finish)}, ${r.dur} j) et son coût sont la somme de ses tâches.</p>
    ${colRow}
    <label class="bp-f"><span>Remarque</span><textarea id="tkNote" rows="2">${esc(t.note || '')}</textarea></label>` : `
    <div class="bp-form">
      <label class="bp-f w"><span>Nom</span><input id="tkName" value="${esc(t.name)}" ${isNew ? 'autofocus' : ''}></label>
      <label class="bp-f"><span>Type</span><select id="tkMs"><option value="0">Tâche</option><option value="1" ${t.ms ? 'selected' : ''}>Jalon (durée 0)</option></select></label>
      <label class="bp-f" id="tkDurF"><span>Durée (jours ouvrés)</span><input id="tkDur" type="number" min="0" step="1" value="${t.dur}"></label>
      <label class="bp-f"><span>Début au plus tôt (vide = dès que possible)</span><input id="tkSnet" type="date" value="${esc(t.snet || '')}"></label>
    </div>
    <h4>Prédécesseurs</h4><div class="bp-lst" id="tkDeps"></div>
    <div><button class="bp-btn" id="tkDepAdd">${I.plus}Lien</button> <span class="bp-hint">FS = commence à la fin · SS = commence avec · FF = finit avec · SF = finit au début. Décalage : ex. +3 j séchage.</span></div>
    <h4>Ressources ${p.res.length ? '' : '<span class="bp-hint">(aucune : crée-les dans l’onglet Ressources)</span>'}</h4><div class="bp-lst" id="tkAsg"></div>
    ${p.res.length ? `<div><button class="bp-btn" id="tkAsgAdd">${I.plus}Ressource</button> <span class="bp-hint">Équipe : nombre de personnes · Machine : nombre d’unités · Sous-traitant / fourniture : quantité totale.</span></div>` : ''}
    <div class="bp-form">
      ${budMode !== 'res' ? `<label class="bp-f"><span>Montant budgété${budMode === 'mix' ? ' en plus des ressources' : ''} (CHF)</span><input id="tkBud" type="number" step="any" value="${t.bud ?? ''}"></label>` : ''}
      <label class="bp-f"><span>Avancement : <b id="tkPctV">${Math.round(t.pct)}</b> %</span><input id="tkPct" type="range" min="0" max="100" step="5" value="${Math.round(t.pct)}"></label>
      <label class="bp-f"><span>Début réel</span><input id="tkAS" type="date" value="${esc(t.aStart || '')}"></label>
      <label class="bp-f"><span>Fin réelle</span><input id="tkAE" type="date" value="${esc(t.aEnd || '')}"></label>
      ${colRow}
      <label class="bp-f w"><span>Remarque</span><textarea id="tkNote" rows="2">${esc(t.note || '')}</textarea></label>
    </div>
    <p class="bp-hint" id="tkInfo"></p>`;
  const box = await dlg({title:sum ? 'Lot' : isNew ? 'Nouvelle tâche' : 'Tâche ' + wbsOf(id), width:sum ? 520 : 760, body,
    buttons:[{label:'Supprimer', value:'del', dang:true, left:true}, {label:'Annuler', value:null}, {label:'Enregistrer', pri:true}],
    onOpen:b => {
      const cb = b.querySelector('#tkCol'), cSet = v => { cb.dataset.v = v; cb.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x.dataset.c === v)); const ci = cb.querySelector('input'), cu = !!v && !cb.querySelector(`[data-c="${v}"]`); ci.parentElement.classList.toggle('on', cu); ci.parentElement.style.background = cu ? v : ''; };
      cSet(cb.dataset.v); cb.addEventListener('click', e => { const x = e.target.closest('[data-c]'); if (x) cSet(x.dataset.c); });
      cb.querySelector('input').addEventListener('input', e => cSet(e.target.value));
      if (sum) return;
      const deps = b.querySelector('#tkDeps'), asg = b.querySelector('#tkAsg');
      const addDep = d => { deps.insertAdjacentHTML('beforeend', depRow(d)); const row = deps.lastElementChild; if (d.id) row.querySelector('[data-k=id]').value = d.id; };
      const upd = () => {
        const ms = b.querySelector('#tkMs').value === '1', dur = ms ? 0 : Math.max(0, Math.round(+b.querySelector('#tkDur').value || 0));
        b.querySelector('#tkDurF').hidden = ms;
        let tot = 0;
        asg.querySelectorAll('[data-asg]').forEach(row => { const re = p.res.find(x => x.id === row.querySelector('[data-k=r]').value), q = +row.querySelector('[data-k=q]').value || 0;
          row.querySelector('[data-u]').textContent = unitOf(re); const c = asgCost(p, {r:re && re.id, q}, dur); tot += c; row.querySelector('[data-c]').textContent = fmtN(c) + ' CHF'; });
        const man = b.querySelector('#tkBud') ? +b.querySelector('#tkBud').value || 0 : 0;
        const bud = budMode === 'res' ? tot : budMode === 'man' ? man : tot + man;
        b.querySelector('#tkInfo').textContent = `Calcul actuel : ${shortOfDn(r.start)} → ${shortOfDn(r.finish)} · marge ${r.tf} j${r.crit ? ' · chemin critique' : ''} · budget ${fmtN(bud)} CHF`;
        b.querySelector('#tkPctV').textContent = b.querySelector('#tkPct').value;
      };
      const addAsg = a => { asg.insertAdjacentHTML('beforeend', asgRow(a)); const row = asg.lastElementChild; row.querySelector('[data-k=r]').value = a.r || (p.res[0] && p.res[0].id); upd(); };
      t.deps.forEach(addDep); t.asg.forEach(addAsg);
      b.querySelector('#tkDepAdd').onclick = () => addDep({type:'FS', lag:0});
      const aa = b.querySelector('#tkAsgAdd'); if (aa) aa.onclick = () => addAsg({q:1});
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
  const tc = box.querySelector('#tkCol').dataset.v; if (tc) t.col = tc; else delete t.col;
  if (!sum) {
    t.ms = box.querySelector('#tkMs').value === '1';
    t.dur = t.ms ? 0 : Math.max(0, Math.round(+box.querySelector('#tkDur').value || 0));
    t.snet = box.querySelector('#tkSnet').value || undefined; if (!t.snet) delete t.snet; else t.lvl = 0;
    const seen = new Set();
    t.deps = [...box.querySelectorAll('[data-dep]')].map(row => ({id:row.querySelector('[data-k=id]').value, type:row.querySelector('[data-k=type]').value, lag:Math.round(+row.querySelector('[data-k=lag]').value || 0)})).filter(d => d.id && !seen.has(d.id) && seen.add(d.id));
    t.asg = [...box.querySelectorAll('[data-asg]')].map(row => ({r:row.querySelector('[data-k=r]').value, q:+row.querySelector('[data-k=q]').value || 0})).filter(a => a.r && a.q > 0);
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
  const now = Date.now(), dbl = U.tap.id === id && now - U.tap.t < 450;
  U.tap = {id, t:now};
  if (U.sel === id && (dbl || (e && e.pointerType !== 'mouse'))) { editTask(id); return; }
  select(id);
}

/* ---------- Ressources ---------- */
function resStats(){
  const p = U.plan, s = U.sch, L = loads(p, s), ov = overloads(p, s, L), st = {};
  for (const r of p.res) st[r.id] = {cost:0, qty:0, max:0, over:0, tasks:[]};
  for (const o of s.ol) { if (o.sum) continue; const r = s.R.get(o.t.id);
    for (const a of o.t.asg) { const x = st[a.r]; if (!x) continue; x.cost += asgCost(p, a, r.dur); x.qty += (+a.q || 0) * (RTYPES[(p.res.find(z => z.id === a.r) || {}).type]?.time ? r.dur : 1); x.tasks.push({o, a, r}); } }
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
  return `<table class="bp-tbl"><thead><tr><th>Tâche</th><th class="n">Quantité</th><th class="n">Début</th><th class="n">Fin</th><th class="n">CHF</th></tr></thead><tbody>${x.tasks.map(({o, a, r}) =>
    `<tr data-goto="${esc(o.t.id)}" style="cursor:pointer"><td>${o.wbs} ${esc(o.t.name)}</td><td class="n">${fmtN(a.q, a.q % 1 ? 2 : 0)}</td><td class="n">${shortOfDn(r.start)}</td><td class="n">${shortOfDn(r.finish)}</td><td class="n">${fmtN(asgCost(U.plan, a, r.dur))}</td></tr>`).join('')}</tbody></table>`;
}
async function editRes(id){
  const p = U.plan, r = id ? p.res.find(x => x.id === id) : {id:uid(), name:'', type:'team', unit:'pers.', rate:0, cap:1, color:COLORS[p.res.length % COLORS.length]};
  const used = id && p.tasks.some(t => t.asg.some(a => a.r === id));
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
    mut(pp => { pp.res = pp.res.filter(x => x.id !== id); for (const t of pp.tasks) { t.asg = t.asg.filter(a => a.r !== id); t.act = t.act.filter(a => a.r !== id); } });
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

/* ---------- Budget ---------- */
function renderBud(){
  const p = U.plan, s = U.sch, main = $b('#bpMain'), E = evm(p, s), byId = new Map(E.rows.map(r => [r.id, r]));
  const agg = new Map();
  for (let i = s.ol.length - 1; i >= 0; i--) { const o = s.ol[i];
    if (!o.sum) { const r = byId.get(o.t.id); agg.set(o.t.id, {bac:r.bac, cur:r.cur, pv:r.pv, ev:r.ev, ac:r.ac}); }
    else { const a = {bac:0, cur:0, pv:0, ev:0, ac:0}; for (const t of p.tasks) if (t.parent === o.t.id) { const c = agg.get(t.id); if (c) for (const k in a) a[k] += c[k]; } agg.set(o.t.id, a); } }
  const k = (l, v, sub, cls = '') => `<div class="bp-kpi"><small>${l}</small><b class="${cls}">${v}</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
  const idx = v => v == null ? '–' : fmtR(v), col = v => v == null ? '' : v >= 1 ? 'bp-pos' : v < 0.95 ? 'bp-neg' : '';
  const sg = v => (v > 0 ? '+' : '') + fmtN(v);
  const rows = s.ol.map(o => { const a = agg.get(o.t.id), cv = a.ev - a.ac, pct = o.sum ? (a.bac ? a.ev / a.bac * 100 : 0) : o.t.pct;
    return `<tr class="${o.sum ? 'sum' : ''}"><td>${o.wbs}</td><td style="padding-left:${6 + o.lvl * 14}px">${esc(o.t.name)}</td><td class="n">${fmtN(a.bac)}</td>${p.baseline ? `<td class="n ${a.cur > a.bac + .5 ? 'bp-neg' : ''}">${fmtN(a.cur)}</td>` : ''}`
      + `<td class="n">${fmtN(pct)}%</td><td class="n">${fmtN(a.ev)}</td><td class="n">${fmtN(a.ac)}</td><td class="n ${cv < -.5 ? 'bp-neg' : cv > .5 ? 'bp-pos' : ''}">${a.ac || a.ev ? sg(cv) : ''}</td>`
      + `<td>${o.sum || o.t.ms ? '' : `<button class="bp-btn" data-act="${esc(o.t.id)}" style="height:34px">${I.money}Réalisé</button>`}</td></tr>`; }).join('');
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
  const row = e => `<div class="bp-li" data-e><input type="date" data-k="d" value="${esc(e.d || isoOfDn(todayDn()))}" style="flex:0 0 150px"><select data-k="r">${resOpts(e.r || (t.asg[0] && t.asg[0].r) || '')}</select><input data-k="q" class="n" type="number" step="any" min="0" value="${e.r ? +e.q || 0 : +e.amt || 0}"><span class="bp-hint" data-u style="width:36px"></span><span class="cost" data-c></span><button class="bp-ib" data-rm>${I.x}</button></div>`;
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
  const v = await dlg({title:'Exporter', width:480, body:`<div class="bp-menu">
    <button class="bp-btn" data-x="print">${I.print}<span>Imprimer<small>Directement sur l’imprimante, avec la mise en page du PDF</small></span></button>
    <button class="bp-btn" data-x="pdf">${I.exp}<span>PDF A3 paysage<small>Gantt imprimable avec cartouche</small></span></button>
    <button class="bp-btn" data-x="xlsx">${I.tbl}<span>Excel<small>Tâches, ressources, budget, réalisé, fériés</small></span></button>
    <button class="bp-btn" data-x="xml">${I.cal}<span>MS Project (XML)<small>À ouvrir dans Project : Fichier › Ouvrir › XML</small></span></button>
    <button class="bp-btn" data-x="layout">${I.edit}<span>Mise en page…<small>Colonnes, couleurs, format, cartouche, logo, période</small></span></button>
    <button class="bp-btn" data-x="import">${I.imp}<span>Importer MS Project (XML)<small>Crée un nouveau planning dans ce chantier</small></span></button>
  </div><p class="bp-hint">Le fichier est téléchargé et copié dans le Drive (Planning / Exports).</p>`,
    buttons:[{label:'Fermer', value:null}], onOpen:(b, done) => b.querySelectorAll('[data-x]').forEach(x => x.addEventListener('click', () => done(x.dataset.x)))});
  if (!v) return;
  if (v === 'import') return importXml();
  if (v === 'layout') return layDlg();
  if (v === 'print') return printPlan();
  try {
    toast('Préparation de l’export…', 1500);
    const stamp = isoOfDn(todayDn());
    const out = v === 'pdf' ? {blob:await makePdf(), name:`${fileBase()} – Gantt ${stamp}.pdf`}
      : v === 'xlsx' ? {blob:await makeXlsx(), name:`${fileBase()} – planning ${stamp}.xlsx`}
      : {blob:new Blob([toMSPDI(U.plan, U.sch)], {type:'application/xml'}), name:`${fileBase()} – MS Project ${stamp}.xml`};
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
  let [W, Hp] = Pp.size === 'A4' ? [841.89, 595.28] : [1190.55, 841.89]; if (Pp.orient === 'port') [W, Hp] = [Hp, W];
  const M = 22, RHp = +Pp.rh || 13.5, FS = +Pp.font || 7.5;
  /* colonnes : réduites si elles prennent plus de 55 % de la largeur */
  let cols = Ly.cols.filter(k => Ly.pdfc.includes(k)).map(k => ({k, l:COLDEF[k].l, w:COLDEF[k].pw * FS / 7.5, r:COLDEF[k].n}));
  let tw = cols.reduce((a, c) => a + c.w, 0); const maxTw = (W - 2 * M) * .55; if (tw > maxTw) { const k = maxTw / tw; cols.forEach(c => c.w *= k); tw = maxTw; }
  const cx0 = M + tw + 6, cw = W - M - cx0;
  const titleH = Pp.subtitle ? 44 : 30, top = Hp - M - titleH, tlH = 26, rowsTop = top - tlH;
  const foot = M + (Pp.cart ? 64 : Pp.legend || Pp.note ? 30 : 14), per = Math.max(1, Math.floor((rowsTop - foot) / RHp));
  const C = {txt:rgb(.1, .11, .13), mut:rgb(.42, .45, .48), line:rgb(.8, .8, .8), off:rgb(.93, .93, .93), zebra:rgb(.97, .97, .97),
    task:hex(Ly.colors.task), crit:hex(Ly.colors.crit), done:hex(Ly.colors.done), sum:hex(Ly.colors.sum), ms:hex(Ly.colors.ms), base:hex(Ly.colors.base), late:hex(Ly.colors.late), today:hex(Ly.colors.today)};
  const base = p.baseline && Pp.base ? p.baseline.tasks : null;
  /* période */
  let d0 = cal.start, d1 = s.end, rowsAll = s.ol;
  if (Pp.range === 'custom' && dnOfIso(Pp.from) != null && dnOfIso(Pp.to) != null && dnOfIso(Pp.to) >= dnOfIso(Pp.from)) { d0 = dnOfIso(Pp.from); d1 = dnOfIso(Pp.to); }
  else if (Pp.range === '3w') { d0 = todayDn(); while (wdOf(d0) !== 1) d0--; d1 = d0 + 20; }
  else { if (base) for (const k in base) { const b = base[k]; d0 = Math.min(d0, b.start); d1 = Math.max(d1, b.finish); } for (const r of s.R.values()) { d0 = Math.min(d0, r.start); d1 = Math.max(d1, r.finish); } d0 -= 2; d1 += 3; }
  if (Pp.range !== 'all' && Pp.only) rowsAll = s.ol.filter(o => { const r = s.R.get(o.t.id); return r.start <= d1 && r.finish >= d0; });
  const sc = cw / (d1 - d0 + 1), X = dn => cx0 + (Math.max(d0, Math.min(d1 + 1, dn)) - d0) * sc, inR = dn => dn >= d0 && dn <= d1 + 1;
  const text = (pg, t, x, y, o = {}) => { const f = o.b ? FB : F, sz = o.s || FS; let str = winAnsi(t); if (o.w) { while (str.length > 1 && f.widthOfTextAtSize(str, sz) > o.w) str = str.slice(0, -2) + '…'; }
    const tx = o.r ? x - f.widthOfTextAtSize(str, sz) : o.c ? x - f.widthOfTextAtSize(str, sz) / 2 : x; pg.drawText(str, {x:tx, y, size:sz, font:f, color:o.col || C.txt}); };
  const pages = Math.max(1, Math.ceil(rowsAll.length / per)), comp = H.company ? H.company(U.siteId) : '';
  /* logo du cartouche */
  let logo = null;
  if (Pp.cart && Pp.logo !== 'none') {
    const L = logoList(), src = Pp.logo === 'comp' ? L.comp : Pp.logo === 'site' ? L.site : Pp.logoSrc;
    if (src) try { const png = await logoPng(src); if (png) logo = await doc.embedPng(png); } catch (e) {}
  }
  for (let pi = 0; pi < pages; pi++) {
    const pg = doc.addPage([W, Hp]), rows = rowsAll.slice(pi * per, (pi + 1) * per), y0 = rowsTop;
    text(pg, Pp.title || 'Planning – ' + p.name, M, Hp - M - 16, {b:1, s:16, w:W - 2 * M});
    if (Pp.subtitle) text(pg, `${st ? st.label : ''}   ·   Début ${chOfDn(cal.start)}   ·   Fin ${chOfDn(s.end)}   ·   ${s.pEnd} jours ouvrés${p.baseline ? '   ·   Référence : fin ' + chOfDn(p.baseline.end) : ''}${Pp.range !== 'all' ? '   ·   Période ' + chOfDn(d0) + ' – ' + chOfDn(d1) : ''}`, M, Hp - M - 32, {s:9, col:C.mut, w:W - 2 * M});
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
      const tc = t.col ? hex(t.col) : null, cc = tc && Ly.crit && r.crit;
      if (o.sum) { const sco = tc || C.sum; pg.drawRectangle({x:bx, y:y + RHp / 2 - 1, width:bw, height:3.5, color:sco}); if (inR(r.start)) pg.drawSvgPath('M0 0 L4 0 L0 5 Z', {x:bx, y:y + RHp / 2 + 2.5, color:sco}); if (inR(r.finish + 1)) pg.drawSvgPath('M0 0 L-4 0 L0 5 Z', {x:bx + bw, y:y + RHp / 2 + 2.5, color:sco}); }
      else if (t.ms || r.dur === 0) { if (inR(r.mx)) { pg.drawSvgPath('M0 -4.5 L4.5 0 L0 4.5 L-4.5 0 Z', {x:X(r.mx), y:y + RHp / 2, color:tc || (r.done ? C.done : Ly.crit && r.crit ? C.crit : C.ms), borderColor:cc ? C.crit : undefined, borderWidth:cc ? 1 : 0}); text(pg, shortOfDn(r.start), X(r.mx) + 7, y + (RHp - 6.5) / 2 + 1, {s:6.5, col:C.mut}); } }
      else {
        pg.drawRectangle({x:bx, y:y + (RHp - bh) / 2, width:bw, height:bh, color:tc || (r.done ? C.done : Ly.crit && r.crit ? C.crit : C.task), borderColor:r.late ? C.late : cc ? C.crit : undefined, borderWidth:r.late || cc ? 1 : 0});
        if (t.pct > 0 && t.pct < 100) pg.drawRectangle({x:bx, y:y + RHp / 2 - 1, width:bw * t.pct / 100, height:2, color:rgb(0, 0, 0), opacity:.45});
        const lbl = barLabel(Ly, o);
        if (lbl && bx + bw + 4 < W - M - 30) text(pg, lbl, bx + bw + 3, y + (RHp - 6.5) / 2 + 1, {s:6.5, col:C.mut, w:W - M - (bx + bw + 3)});
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
    const ly = M + (Pp.cart ? 46 : 8);
    if (Pp.legend) {
      const leg = [...(Ly.crit ? [[C.crit, 'Chemin critique']] : []), [C.task, 'Tâche'], [C.done, 'Terminée'], ...(base ? [[C.base, 'Référence']] : []), [C.late, 'Retard'], [C.today, 'Aujourd’hui']];
      let lx = M; for (const [c, l] of leg) { pg.drawRectangle({x:lx, y:ly, width:12, height:6, color:c}); text(pg, l, lx + 16, ly, {s:7.5}); lx += 26 + F.widthOfTextAtSize(winAnsi(l), 7.5) + 12; }
      pg.drawSvgPath('M0 -4 L4 0 L0 4 L-4 0 Z', {x:lx + 4, y:ly + 3, color:C.ms}); text(pg, 'Jalon', lx + 12, ly, {s:7.5});
    }
    if (Pp.note) text(pg, Pp.note, M, ly + (Pp.legend ? -14 : 0), {s:8, b:1, col:C.mut, w:W - 2 * M - (Pp.cart ? 340 : 0)});
    if (Pp.cart) {
      const lw = logo ? 70 : 0, bwc = 330 + lw, bxc = W - M - bwc, byc = M, bhc = 56, tx0 = bxc + lw;
      pg.drawRectangle({x:bxc, y:byc, width:bwc, height:bhc, borderColor:C.txt, borderWidth:.8});
      if (logo) { const k = Math.min((lw - 10) / logo.width, (bhc - 10) / logo.height); pg.drawImage(logo, {x:bxc + (lw - logo.width * k) / 2, y:byc + (bhc - logo.height * k) / 2, width:logo.width * k, height:logo.height * k});
        pg.drawLine({start:{x:tx0, y:byc}, end:{x:tx0, y:byc + bhc}, thickness:.5, color:C.txt}); }
      pg.drawLine({start:{x:tx0, y:byc + 28}, end:{x:bxc + bwc, y:byc + 28}, thickness:.5, color:C.txt});
      pg.drawLine({start:{x:tx0 + 230, y:byc}, end:{x:tx0 + 230, y:byc + bhc}, thickness:.5, color:C.txt});
      if (comp) text(pg, comp, tx0 + 5, byc + 44, {b:1, s:9, w:220}); text(pg, st ? st.label : '', tx0 + 5, byc + 33, {s:8, w:220});
      text(pg, p.name, tx0 + 5, byc + 16, {b:1, s:9, w:220}); text(pg, 'Imprimé le ' + chOfDn(todayDn()), tx0 + 5, byc + 5, {s:7.5, col:C.mut});
      text(pg, 'Indice', tx0 + 236, byc + 44, {s:7, col:C.mut}); text(pg, p.indice || '–', tx0 + 236, byc + 32, {b:1, s:11});
      text(pg, 'Page', tx0 + 236, byc + 16, {s:7, col:C.mut}); text(pg, `${pi + 1} / ${pages}`, tx0 + 236, byc + 5, {b:1, s:9});
    } else text(pg, `${pi + 1} / ${pages}`, W - M, M, {s:7.5, r:1, col:C.mut});
  }
  return new Blob([await doc.save()], {type:'application/pdf'});
}
/* impression : le PDF de la mise en page. PC = PDF dans un cadre caché (qualité vectorielle) ;
   tablette = pages rendues en images (pdf.js) puis impression de la page (Android n'imprime pas un PDF dans un cadre) */
const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
async function printPlan(){
  if (!U.plan || U.printing) return;
  U.printing = true;
  try {
    toast('Préparation de l’impression…', 2000);
    const Ly = LAY(), blob = await makePdf(Ly);
    if (H.split) {
      const url = URL.createObjectURL(blob), fr = document.createElement('iframe');
      fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0';
      fr.src = url; document.body.appendChild(fr);
      await new Promise(r => { fr.onload = r; setTimeout(r, 4000); });
      await new Promise(r => setTimeout(r, 300));
      try { fr.contentWindow.focus(); fr.contentWindow.print(); }
      catch (e) { if (!window.open(url, '_blank')) download(blob, fileBase() + '.pdf'); }
      setTimeout(() => { fr.remove(); URL.revokeObjectURL(url); }, 120000);
      return;
    }
    if (!window.pdfjsLib) await loadScript(PDFJS_URL + 'pdf.min.js');
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_URL + 'pdf.worker.min.js';
    const pdf = await window.pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise, urls = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i), vp = pg.getViewport({scale:Math.min(3, 3600 / Math.max(pg.view[2], pg.view[3]))}), c = document.createElement('canvas');
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await pg.render({canvasContext:g, viewport:vp}).promise;
      urls.push(URL.createObjectURL(await new Promise(r => c.toBlob(r, 'image/png'))));
    }
    const box = document.createElement('div'); box.id = 'bpPrint';
    box.innerHTML = `<style>@media screen{#bpPrint{display:none}}
      @media print{@page{size:${Ly.pdf.size} ${Ly.pdf.orient === 'port' ? 'portrait' : 'landscape'};margin:0}
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
  for (const o of s.ol) { const t = o.t, r = s.R.get(t.id), e = ev.get(t.id);
    tasks.push([o.wbs, '  '.repeat(o.lvl) + t.name, o.sum ? 'Lot' : t.ms ? 'Jalon' : 'Tâche', r.dur, D(r.start), D(r.finish), o.sum ? '' : predTxt(t), o.sum ? '' : t.pct, o.sum ? '' : r.tf, !o.sum && r.crit ? 'oui' : '',
      t.aStart ? D(dnOfIso(t.aStart)) : '', t.aEnd ? D(dnOfIso(t.aEnd)) : '', t.asg.map(a => resName(a.r) + ' × ' + a.q).join(', '), e ? Math.round(e.cur) : '', e ? Math.round(e.ac) : '', t.note || '']); }
  const res = [['Ressource', 'Type', 'Unité', 'Tarif', 'Unité du tarif', 'Capacité / jour', 'Coût prévu CHF']];
  const {st} = resStats();
  for (const r of p.res) res.push([r.name, RTYPES[r.type].label, unitOf(r), +r.rate || 0, RTYPES[r.type].rateUnit, RTYPES[r.type].time ? +r.cap || 0 : '', Math.round(st[r.id].cost)]);
  const bud = [['Situation au', D(s.statusDn)], ['Budget (BAC)', Math.round(E.BAC)], ['Prévu à date (PV)', Math.round(E.PV)], ['Valeur acquise (VA)', Math.round(E.EV)], ['Coût réel (CR)', Math.round(E.AC)],
    ['Écart de coût (VA − CR)', Math.round(E.CV)], ['Écart de délai (VA − PV)', Math.round(E.SV)], ['SPI', E.SPI == null ? '' : +E.SPI.toFixed(2)], ['CPI', E.CPI == null ? '' : +E.CPI.toFixed(2)], ['Coût final estimé', Math.round(E.EAC)], ['Écart final estimé', Math.round(E.VAC)], [],
    ['N°', 'Tâche', 'Budget réf. CHF', 'Budget actuel CHF', 'Avancement %', 'Valeur acquise CHF', 'Réel CHF', 'Écart CHF']];
  for (const o of s.ol) { if (o.sum) continue; const e = ev.get(o.t.id); bud.push([o.wbs, o.t.name, Math.round(e.bac), Math.round(e.cur), o.t.pct, Math.round(e.ev), Math.round(e.ac), Math.round(e.ev - e.ac)]); }
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
      else if (k === 'print') printPlan();
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
      else if (k === 'today') scrollToday(); else if (k === 'cols') { U.full = !fullCols(); render(); } else if (k === 'base') { U.showBase = !U.showBase; render(); }
      return;
    }
    const z = e.target.closest('button[data-zoom]'); if (z) { U.zoom = z.dataset.zoom; render(); return; }
    const row = e.target.closest('#bpRows .bp-row[data-id]'); if (row) { tapRow(row.dataset.id, e.pointerType ? e : {pointerType:U.lastPt || 'mouse'}); return; }
    const sb = e.target.closest('#bpChart .bar'); if (sb && (sb.classList.contains('sum') || U.lastPt === 'touch')) { tapRow(sb.dataset.id, {pointerType:U.lastPt || 'mouse'}); return; }
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
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (!U.plan || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key, ctl = e.ctrlKey || e.metaKey;
    if (ctl && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (ctl && k.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (U.tab !== 'gantt') return;
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
