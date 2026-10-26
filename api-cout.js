/* BauGest — coût des tâches planifiées avec une clé API Claude, calculé sur leur CONSOMMATION RÉELLE.
   Source : fichier Drive « BauGest – consommation des tâches (ne pas supprimer).json » à la racine BauGest, tenu à jour par la session « Conso BauGest »
   (relève les tokens de chaque exécution : entrée, écritures en cache 1 h / 5 min, lectures en cache, sortie, coût mesuré, modèle utilisé).
   Format : {v:1, updatedAt, triggers:{id:{n, cron}}, runs:[{s, t, n, at, end, st, m, in, cw, cw1, cr, out, usd}]}.
   Module partagé tablette (Paramètres › Coût API Claude) + PC (⚙ Réglages). Réglages (taux, abonnement) : localStorage['baugest.apiCost'] ; dernière relève : ['baugest.apiCostData']. */
(function(){
'use strict';
const KEY = 'baugest.apiCost', DKEY = 'baugest.apiCostData', LEDGER = 'BauGest – consommation des tâches (ne pas supprimer).json', PRICE_DATE = '26.10.2026';
/* USD par million de tokens. Écriture en cache : ×1,25 (5 min) ou ×2 (1 h, utilisé par les tâches planifiées).
   Lecture en cache Sonnet 5.5 = 0,10 : vérifié sur les coûts mesurés des exécutions (costUSD, tarif public). */
const MODELS = {
  opus:  {l:'Claude Opus 5.5',   id:'claude-opus-5-5',   inp:4, out:20, read:0.20},
  sonnet:{l:'Claude Sonnet 5.5', id:'claude-sonnet-5-5', inp:2, out:10, read:0.10}
};
const keyOf = m => /opus/i.test(m || '') ? 'opus' : /sonnet/i.test(m || '') ? 'sonnet' : '';
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[’'\s]/g, '')); return isFinite(n) ? n : 0; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const f2 = v => (+v).toLocaleString('de-CH', {minimumFractionDigits:2, maximumFractionDigits:2});
const f0 = v => (+v).toLocaleString('de-CH', {maximumFractionDigits:0});
const fk = v => v >= 1e6 ? (v / 1e6).toLocaleString('de-CH', {maximumFractionDigits:2}) + ' M' : v >= 1e3 ? f0(v / 1e3) + ' k' : f0(v);
const dch = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('de-CH', {day:'2-digit', month:'2-digit', year:'2-digit'}); };
function loadSet(){ let s = null; try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {} return {rate:s && s.rate != null ? s.rate : 0.80, sub:s && s.sub != null ? s.sub : ''}; }
function saveSet(s){ try { localStorage.setItem(KEY, JSON.stringify({rate:s.rate, sub:s.sub})); } catch (e) {} }
function cached(){ try { return JSON.parse(localStorage.getItem(DKEY) || 'null'); } catch (e) { return null; } }
/* coût USD d'une exécution si elle avait tourné sur le modèle M (mêmes tokens) */
function runUsd(r, M){
  const cw = num(r.cw), cw1 = r.cw1 == null ? cw : Math.min(cw, num(r.cw1));
  return (num(r.in) * M.inp + cw1 * M.inp * 2 + (cw - cw1) * M.inp * 1.25 + num(r.cr) * M.read + num(r.out) * M.out) / 1e6;
}
/* exécutions par mois d'après la planification cron (« CRON_TZ=… m h jdm mois jds ») */
function cronPerMonth(cron){
  const f = String(cron || '').replace(/^CRON_TZ=\S+\s+/, '').trim().split(/\s+/); if (f.length < 5) return 0;
  const cnt = (v, lo, hi) => { if (v === '*') return hi - lo + 1; let n = 0; for (const part of v.split(',')) { const [a, st] = part.split('/'), stp = +st || 1; let x0, x1; if (a === '*') { x0 = lo; x1 = hi; } else if (a.includes('-')) [x0, x1] = a.split('-').map(Number); else { x0 = x1 = +a; } for (let x = x0; x <= x1; x += stp) n++; } return n; };
  const perDay = cnt(f[0], 0, 59) * cnt(f[1], 0, 23);
  if (f[2] !== '*') return perDay * cnt(f[2], 1, 31) * (f[3] === '*' ? 1 : cnt(f[3], 1, 12) / 12);
  const dow = f[4] === '*' ? 7 : Math.min(7, new Set(f[4].split(',').flatMap(p => { if (p.includes('-')) { const [a, b] = p.split('-').map(Number); return Array.from({length:b - a + 1}, (_, i) => (a + i) % 7); } return [+p % 7]; })).size);
  return perDay * dow * 30.44 / 7;
}
/* analyse : par tâche, moyenne mesurée par exécution × exécutions par mois (planification) */
function analyse(D){
  const runs = (D && Array.isArray(D.runs) ? D.runs : []).filter(r => r && r.s);
  const T = new Map();
  for (const r of runs) {
    const id = r.t || r.n; if (!T.has(id)) T.set(id, {id, n:r.n || id, runs:new Map(), models:new Set()});
    const x = T.get(id), e = x.runs.get(r.s) || {at:r.at, usd:0, opus:0, sonnet:0, in:0, cw:0, cr:0, out:0};
    e.usd += num(r.usd); e.opus += runUsd(r, MODELS.opus); e.sonnet += runUsd(r, MODELS.sonnet);
    e.in += num(r.in); e.cw += num(r.cw); e.cr += num(r.cr); e.out += num(r.out); x.runs.set(r.s, e); if (keyOf(r.m)) x.models.add(keyOf(r.m));
  }
  const rows = [], tot = {opus:0, sonnet:0, cur:0};
  for (const x of T.values()) {
    const list = [...x.runs.values()], k = list.length; if (!k) continue;
    const avg = f => list.reduce((a, e) => a + e[f], 0) / k, trig = D.triggers && D.triggers[x.id], pm = trig ? cronPerMonth(trig.cron) : 0;
    if (D.triggers && !trig) continue; /* tâche supprimée : plus comptée */
    const row = {n:(trig && trig.n) || x.n, k, pm, cron:trig ? trig.cron : '', models:[...x.models], last:list.map(e => e.at).sort().pop(),
      avg:{usd:avg('usd'), opus:avg('opus'), sonnet:avg('sonnet'), in:avg('in'), cw:avg('cw'), cr:avg('cr'), out:avg('out')}};
    row.mo = {opus:row.avg.opus * pm, sonnet:row.avg.sonnet * pm, cur:row.avg.usd * pm};
    tot.opus += row.mo.opus; tot.sonnet += row.mo.sonnet; tot.cur += row.mo.cur; rows.push(row);
  }
  rows.sort((a, b) => b.mo.cur - a.mo.cur);
  const ats = runs.map(r => r.at).filter(Boolean).sort();
  return {rows, tot, n:new Set(runs.map(r => r.s)).size, from:ats[0], to:ats[ats.length - 1], updatedAt:D && D.updatedAt};
}
/* lecture du fichier de relève sur le Drive (api / root fournis par l'hôte) */
async function fetchLedger(o){
  if (!o || !o.api) throw new Error('Drive non disponible');
  const DRV = 'https://www.googleapis.com/drive/v3/files', root = typeof o.root === 'function' ? o.root() : o.root;
  const q = `name='${LEDGER.replace(/'/g, "\\'")}' and trashed=false` + (root ? ` and '${root}' in parents` : '');
  const r = await o.api(DRV + '?' + new URLSearchParams({q, orderBy:'createdTime desc', pageSize:'1', fields:'files(id,createdTime)'}));
  const f = r && r.files && r.files[0]; if (!f) return null;
  let j = await o.api(DRV + '/' + f.id + '?alt=media');
  if (j && typeof j.json === 'function') j = await j.json();
  try { localStorage.setItem(DKEY, JSON.stringify(j)); } catch (e) {}
  return j;
}
function summary(){
  const D = cached(); if (!D) return 'Pas encore de relève de consommation : ouvrir le calculateur (connexion Drive nécessaire).';
  const a = analyse(D), rate = num(loadSet().rate) || 0.8;
  if (!a.rows.length) return 'Relève vide pour l’instant.';
  return `Consommation réelle (${a.n} exécutions) : tout en Opus 5.5 ≈ ${f0(a.tot.opus * rate)} CHF/mois · tout en Sonnet 5.5 ≈ ${f0(a.tot.sonnet * rate)} CHF/mois`;
}
const CSS = `
.bgac-scrim{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}
.bgac{background:var(--surface,var(--panel,#1c1f23));color:var(--text,#ecebe6);border:1px solid var(--line,#353a41);border-radius:14px;width:min(1120px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.45);font:14px/1.45 var(--body,system-ui,sans-serif)}
.bgac h2{margin:0;font:700 18px var(--display,inherit);text-transform:uppercase;letter-spacing:.03em}
.bgac h3{margin:14px 0 6px;font:700 14px var(--body,inherit);text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#9da2a8)}
.bgac-h{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line,#353a41)}
.bgac-b{overflow:auto;padding:12px 14px}
.bgac-f{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--line,#353a41)}
.bgac button{height:38px;padding:0 13px;border-radius:9px;border:1px solid var(--line,#353a41);background:var(--surface2,rgba(128,128,128,.12));color:inherit;font:inherit;cursor:pointer}
.bgac button.pri{background:var(--signal,#f2c230);color:var(--signal-ink,#1b1600);border-color:transparent;font-weight:700}
.bgac input{height:34px;border-radius:8px;border:1px solid var(--line,#353a41);background:var(--bg,rgba(0,0,0,.15));color:inherit;font:inherit;padding:0 8px;box-sizing:border-box;text-align:right;font-family:var(--mono,ui-monospace,monospace)}
.bgac table{border-collapse:collapse;width:100%;min-width:980px}.bgac tbody td:first-child{min-width:200px}
.bgac th{font:700 12px var(--body,inherit);text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#9da2a8);text-align:left;padding:6px 6px;border-bottom:1px solid var(--line,#353a41);line-height:1.2}
.bgac td{padding:6px;border-bottom:1px solid rgba(128,128,128,.15);vertical-align:top}
.bgac td.c,.bgac th.c{text-align:right;font-family:var(--mono,ui-monospace,monospace);white-space:nowrap}
.bgac tr.tot td{font-weight:700;border-top:2px solid var(--line,#353a41)}
.bgac .hint{color:var(--muted,#9da2a8);font-size:12.5px;margin:6px 0}
.bgac .sm{color:var(--muted,#9da2a8);font-size:12px;display:block}
.bgac .kp{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin:12px 0}
.bgac .k{background:var(--surface2,rgba(128,128,128,.12));border-radius:10px;padding:10px 12px}
.bgac .k small{display:block;color:var(--muted,#9da2a8)}.bgac .k b{display:block;font:700 22px var(--mono,ui-monospace,monospace);margin:2px 0}
.bgac .k em{font-style:normal;font-size:12.5px;color:var(--muted,#9da2a8)}
.bgac .pos{color:#4caf7a}.bgac .neg{color:#e5484d}
.bgac .set{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:flex-end;margin:4px 0 6px}
.bgac .set label{display:flex;flex-direction:column;gap:3px;font-size:12.5px;color:var(--muted,#9da2a8)}
.bgac .x{width:38px;padding:0;display:inline-flex;align-items:center;justify-content:center}
.bgac .pr td,.bgac .pr th{border:0;padding:2px 10px 2px 0}.bgac .pr{min-width:0;width:auto;font-size:12.5px}
.bgac .tag{display:inline-block;font-size:11px;padding:1px 6px;border-radius:6px;background:var(--surface2,rgba(128,128,128,.18));margin-left:4px;white-space:nowrap}
`;
function open(o){
  o = o || {};
  if (!document.getElementById('bgacCss')) { const st = document.createElement('style'); st.id = 'bgacCss'; st.textContent = CSS; document.head.appendChild(st); }
  const set = loadSet(); let D = cached(), state = D ? 'cache' : 'load', err = '';
  const sc = document.createElement('div'); sc.className = 'bgac-scrim';
  sc.innerHTML = `<div class="bgac" role="dialog" aria-label="Coût API Claude">
    <div class="bgac-h"><h2 style="flex:1">Coût API Claude des tâches planifiées</h2><button data-reload title="Relire la relève sur le Drive">Actualiser</button><button class="x" data-x title="Fermer">✕</button></div>
    <div class="bgac-b">
      <p class="hint" style="margin-top:0">Calculé sur la <b>consommation réelle</b> des tâches planifiées de BauGest (tokens de chaque exécution, relevés automatiquement), aux prix officiels de l'API Claude. Aucune saisie : seuls le taux de change et votre abonnement servent à la comparaison.</p>
      <div class="set">
        <label>Taux USD → CHF<input data-g="rate" value="${esc(set.rate)}" style="width:110px" title="Taux de votre banque"></label>
        <label>Mon abonnement Claude (CHF / mois)<input data-g="sub" value="${esc(set.sub)}" placeholder="ex. 100" style="width:190px"></label>
      </div>
      <div data-out></div>
      <table class="pr"><tr><th>Prix officiels API (USD / million de tokens, au ${PRICE_DATE})</th><th class="c">Entrée</th><th class="c">Sortie</th><th class="c">Lecture cache</th><th class="c">Écriture cache 1 h</th></tr>
        ${Object.values(MODELS).map(m => `<tr><td>${m.l}</td><td class="c">${f2(m.inp)}</td><td class="c">${f2(m.out)}</td><td class="c">${f2(m.read)}</td><td class="c">${f2(m.inp * 2)}</td></tr>`).join('')}</table>
      <p class="hint">Les tâches relisent surtout leur contexte en cache (lecture cache) ; les écritures en cache de 1 h coûtent 2 × le prix d'entrée. Une exécution sur le modèle utilisé = coût mesuré ; sur l'autre modèle = mêmes tokens à ses prix. Projection par mois = moyenne mesurée par exécution × nombre d'exécutions prévu par la planification de chaque tâche. L'abonnement couvre aussi vos conversations avec Claude, non comptées ici.</p>
    </div>
    <div class="bgac-f"><button class="pri" data-x>Fermer</button></div></div>`;
  document.body.appendChild(sc);
  const out = sc.querySelector('[data-out]');
  const draw = () => {
    const rate = num(set.rate) || 0, sub = num(set.sub);
    if (!D) { out.innerHTML = state === 'load' ? '<p class="hint">Lecture de la relève sur le Drive…</p>'
      : `<p class="hint">${err ? 'Relève illisible : ' + esc(err) + '. ' : ''}Pas encore de relève de consommation sur le Drive (fichier « ${esc(LEDGER)} »). Elle est faite automatiquement deux fois par jour par la session « Conso BauGest ».</p>`; return; }
    const a = analyse(D);
    if (!a.rows.length) { out.innerHTML = '<p class="hint">La relève ne contient encore aucune exécution.</p>'; return; }
    const card = (lab, usd) => { const m = usd * rate, d = sub - m;
      return `<div class="k"><small>${lab}</small><b>${f0(m)} CHF / mois</b><em>${f0(m * 12)} CHF / an · ${f2(usd)} USD / mois</em><br>${sub > 0 ? `<em class="${d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? 'API moins chère de ' : 'API plus chère de '}${f0(Math.abs(d))} CHF / mois que l'abonnement</em>` : '<em>Saisissez votre abonnement pour comparer</em>'}</div>`; };
    const mlab = r => r.models.map(k => `<span class="tag">${k === 'opus' ? 'Opus 5.5' : 'Sonnet 5.5'}</span>`).join('');
    out.innerHTML = `<p class="hint">Relève : <b>${a.n}</b> exécutions mesurées du ${dch(a.from)} au ${dch(a.to)}${a.updatedAt ? ' · mise à jour le ' + dch(a.updatedAt) : ''}${state === 'cache' ? ' · <i>copie gardée sur l’appareil</i>' : ''}.</p>
      <div class="kp">${card('Modèles actuels des tâches', a.tot.cur)}${card('Tout en Claude Opus 5.5', a.tot.opus)}${card('Tout en Claude Sonnet 5.5', a.tot.sonnet)}
        ${sub > 0 ? `<div class="k"><small>Abonnement saisi</small><b>${f0(sub)} CHF / mois</b><em>${f0(sub * 12)} CHF / an</em></div>` : ''}</div>
      <h3>Par tâche (moyenne mesurée par exécution)</h3>
      <div style="overflow:auto"><table><thead><tr><th>Tâche</th><th class="c">Exéc. mesurées</th><th class="c">Tokens / exécution<br>lus en cache · écrits · sortie</th><th class="c">Coût mesuré / exéc. (USD)</th><th class="c">Exéc. prévues / mois</th><th class="c">Actuel CHF / mois</th><th class="c">Opus 5.5 CHF / mois</th><th class="c">Sonnet 5.5 CHF / mois</th></tr></thead><tbody>
      ${a.rows.map(r => `<tr><td>${esc(r.n)}${mlab(r)}<span class="sm">dernière : ${dch(r.last)}</span></td><td class="c">${r.k}</td><td class="c">${fk(r.avg.cr)} · ${fk(r.avg.cw + r.avg.in)} · ${fk(r.avg.out)}</td><td class="c">${f2(r.avg.usd)}</td><td class="c">${r.pm ? (+r.pm.toFixed(1)).toLocaleString('de-CH') : '–'}</td><td class="c">${f2(r.mo.cur * rate)}</td><td class="c">${f2(r.mo.opus * rate)}</td><td class="c">${f2(r.mo.sonnet * rate)}</td></tr>`).join('')}
      <tr class="tot"><td>Total</td><td class="c">${a.n}</td><td></td><td></td><td></td><td class="c">${f2(a.tot.cur * rate)}</td><td class="c">${f2(a.tot.opus * rate)}</td><td class="c">${f2(a.tot.sonnet * rate)}</td></tr></tbody></table></div>
      ${a.n < 20 ? '<p class="hint">Peu d’exécutions mesurées pour l’instant : la projection deviendra plus fiable avec les jours (une exécution qui ne trouve rien à faire coûte moins).</p>' : ''}`;
  };
  const reload = async () => {
    if (!o.api) { if (!D) state = 'none'; draw(); return; }
    state = D ? 'cache' : 'load'; draw();
    try { const j = await fetchLedger(o); if (j) { D = j; state = 'live'; } else if (!D) state = 'none'; err = ''; }
    catch (e) { err = (e && e.message) || String(e); if (!D) state = 'none'; }
    draw();
  };
  sc.addEventListener('input', e => { const g = e.target.dataset.g; if (!g) return; set[g] = e.target.value; saveSet(set); draw(); });
  const close = () => { sc.remove(); document.removeEventListener('keydown', key, true); try { if (typeof o.onClose === 'function') o.onClose(); } catch (e) {} };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  document.addEventListener('keydown', key, true);
  sc.addEventListener('click', e => { if (e.target === sc || e.target.closest('[data-x]')) close(); else if (e.target.closest('[data-reload]')) reload(); });
  draw(); reload();
  return sc;
}
window.BGApiCost = {open, summary, analyse, runUsd, cronPerMonth, fetchLedger, MODELS, LEDGER, PRICE_DATE};
})();
