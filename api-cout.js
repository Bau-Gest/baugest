/* BauGest — calculateur du coût des tâches planifiées avec une clé API Claude (Opus 5.5 / Sonnet 5.5).
   Module partagé tablette (Paramètres › Coût API Claude) + PC (⚙ Réglages). Réglages gardés sur l'appareil : localStorage['baugest.apiCost'].
   Prix officiels Anthropic, USD par million de tokens (pricing au 06.10.2026) ; écriture en cache = ×1,25 (cache 5 min), Batch = −50 %. */
(function(){
'use strict';
const KEY = 'baugest.apiCost', PRICE_DATE = '06.10.2026';
const MODELS = {
  opus:  {l:'Claude Opus 5.5',   id:'claude-opus-5-5',   inp:4, out:20, read:0.20},
  sonnet:{l:'Claude Sonnet 5.5', id:'claude-sonnet-5-5', inp:2, out:10, read:0.20}
};
const WRITE = 1.25, BATCH = 0.5;
/* tâches planifiées de BauGest (CLAUDE.md § 4) : exécutions par mois + tokens estimés par exécution (k = milliers) */
const WD = 21.7;   /* jours ouvrés par mois */
const DEF_ROWS = () => [
  {id:'tr', n:'Transcription (lu–ve 17:53)', runs:WD, inK:300, cache:70, outK:12},
  {id:'pl', n:'Plans (lu–ve 17:17)', runs:WD, inK:150, cache:70, outK:5},
  {id:'rp', n:'Récap PV (lu–ve 17:35)', runs:WD, inK:250, cache:70, outK:12},
  {id:'so', n:'Soumission (vendredi 17:44)', runs:4.35, inK:400, cache:70, outK:25},
  {id:'ml', n:'Mails (lu–ve 11:50 et 17:50)', runs:WD * 2, inK:150, cache:70, outK:8},
  {id:'rs', n:'Rappel séance (tous les jours 06:52)', runs:30.4, inK:60, cache:70, outK:3}
];
const DEF = () => ({rows:DEF_ROWS(), rate:0.80, sub:'', batch:false});
function load(){ let s = null; try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {} const d = DEF(); if (!s || !Array.isArray(s.rows)) return d; return Object.assign(d, s); }
function save(s){ try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[’'\s]/g, '')); return isFinite(n) ? n : 0; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const f2 = v => (+v).toLocaleString('de-CH', {minimumFractionDigits:2, maximumFractionDigits:2});
const f0 = v => (+v).toLocaleString('de-CH', {maximumFractionDigits:0});
/* coût en USD d'une exécution : entrée nouvelle écrite en cache (×1,25) + entrée relue en cache + sortie */
function runUsd(r, m, batch){
  const inT = num(r.inK) * 1000, c = Math.min(100, Math.max(0, num(r.cache))) / 100, outT = num(r.outK) * 1000;
  const usd = (inT * (1 - c) * m.inp * WRITE + inT * c * m.read + outT * m.out) / 1e6;
  return batch ? usd * BATCH : usd;
}
function calc(s){
  const out = {rows:[], tot:{}};
  for (const k in MODELS) out.tot[k] = 0;
  for (const r of s.rows) {
    const o = {r, m:{}};
    for (const k in MODELS) { const u = runUsd(r, MODELS[k], s.batch) * num(r.runs); o.m[k] = u; out.tot[k] += u; }
    out.rows.push(o);
  }
  return out;
}
/* résumé une ligne (Paramètres de la tablette) */
function summary(){
  const s = load(), c = calc(s), rate = num(s.rate) || 0.8;
  return `Estimation : Opus 5.5 ≈ ${f0(c.tot.opus * rate)} CHF/mois · Sonnet 5.5 ≈ ${f0(c.tot.sonnet * rate)} CHF/mois`;
}
const CSS = `
.bgac-scrim{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}
.bgac{background:var(--surface,var(--panel,#1c1f23));color:var(--text,#ecebe6);border:1px solid var(--line,#353a41);border-radius:14px;width:min(1080px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(0,0,0,.45);font:14px/1.45 var(--body,system-ui,sans-serif)}
.bgac h2{margin:0;font:700 18px var(--display,inherit);text-transform:uppercase;letter-spacing:.03em}
.bgac-h{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--line,#353a41)}
.bgac-b{overflow:auto;padding:12px 14px}
.bgac-f{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--line,#353a41)}
.bgac button{height:38px;padding:0 13px;border-radius:9px;border:1px solid var(--line,#353a41);background:var(--surface2,rgba(128,128,128,.12));color:inherit;font:inherit;cursor:pointer}
.bgac button.pri{background:var(--signal,#f2c230);color:var(--signal-ink,#1b1600);border-color:transparent;font-weight:700}
.bgac input{height:34px;border-radius:8px;border:1px solid var(--line,#353a41);background:var(--bg,rgba(0,0,0,.15));color:inherit;font:inherit;padding:0 8px;width:100%;box-sizing:border-box}
.bgac input.n{text-align:right;font-family:var(--mono,ui-monospace,monospace)}
.bgac table{border-collapse:collapse;width:100%;min-width:760px}
.bgac td input.n{width:84px}.bgac th.c{white-space:normal;text-align:right;line-height:1.2}
.bgac th{font:700 12px var(--body,inherit);text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#9da2a8);text-align:left;padding:6px 4px;border-bottom:1px solid var(--line,#353a41);white-space:nowrap}
.bgac td{padding:4px;border-bottom:1px solid rgba(128,128,128,.15);vertical-align:middle}
.bgac td.c,.bgac th.c{text-align:right;font-family:var(--mono,ui-monospace,monospace);white-space:nowrap}
.bgac tr.tot td{font-weight:700;border-top:2px solid var(--line,#353a41)}
.bgac .hint{color:var(--muted,#9da2a8);font-size:12.5px;margin:6px 0}
.bgac .kp{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin:12px 0}
.bgac .k{background:var(--surface2,rgba(128,128,128,.12));border-radius:10px;padding:10px 12px}
.bgac .k small{display:block;color:var(--muted,#9da2a8)}.bgac .k b{display:block;font:700 22px var(--mono,ui-monospace,monospace);margin:2px 0}
.bgac .k em{font-style:normal;font-size:12.5px;color:var(--muted,#9da2a8)}
.bgac .pos{color:#4caf7a}.bgac .neg{color:#e5484d}
.bgac .set{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:flex-end;margin:4px 0 10px}
.bgac .set label{display:flex;flex-direction:column;gap:3px;font-size:12.5px;color:var(--muted,#9da2a8)}
.bgac .set label.ck{flex-direction:row;align-items:center;gap:8px;color:inherit;font-size:14px}
.bgac .set label.ck input{width:18px;height:18px}
.bgac .x{width:38px;padding:0;display:inline-flex;align-items:center;justify-content:center}
.bgac .pr{font-size:12.5px;border:1px solid var(--line,#353a41);border-radius:10px;padding:8px 10px;margin:6px 0 10px}
.bgac .pr td,.bgac .pr th{border:0;padding:2px 8px 2px 0}
`;
function open(opts){
  if (!document.getElementById('bgacCss')) { const st = document.createElement('style'); st.id = 'bgacCss'; st.textContent = CSS; document.head.appendChild(st); }
  const s = load();
  const sc = document.createElement('div'); sc.className = 'bgac-scrim';
  const M = MODELS;
  sc.innerHTML = `<div class="bgac" role="dialog" aria-label="Coût API Claude">
    <div class="bgac-h"><h2 style="flex:1">Coût API Claude des tâches planifiées</h2><button class="x" data-x title="Fermer">✕</button></div>
    <div class="bgac-b">
      <p class="hint" style="margin-top:0">Combien coûteraient les tâches planifiées de BauGest (transcription, plans, récap PV, soumission, mails, rappel séance) si elles tournaient avec une clé API Claude, pour comparer avec l'abonnement. Les tokens par exécution sont des <b>estimations modifiables</b> : la consommation réelle se lit dans la console Anthropic après quelques jours avec une clé.</p>
      <table class="pr"><tr><th>Prix officiels (USD / million de tokens, au ${PRICE_DATE})</th><th class="c">Entrée</th><th class="c">Sortie</th><th class="c">Lecture cache</th><th class="c">Écriture cache</th></tr>
        ${Object.values(M).map(m => `<tr><td>${m.l}</td><td class="c">${f2(m.inp)}</td><td class="c">${f2(m.out)}</td><td class="c">${f2(m.read)}</td><td class="c">${f2(m.inp * WRITE)}</td></tr>`).join('')}
        <tr><td colspan="5" class="hint" style="padding-top:4px">Écriture en cache = entrée × 1,25 (cache 5 min). Batch (traitement différé, résultat en moins de 24 h) = −50 % sur tout.</td></tr></table>
      <div class="set">
        <label>Taux USD → CHF<input class="n" data-g="rate" value="${esc(s.rate)}" style="width:110px" title="À vérifier : taux du jour de votre banque"></label>
        <label>Mon abonnement Claude (CHF / mois)<input class="n" data-g="sub" value="${esc(s.sub)}" placeholder="ex. 100" style="width:190px"></label>
        <label class="ck"><input type="checkbox" data-g="batch" ${s.batch ? 'checked' : ''}>Tâches en Batch (−50 %)</label>
      </div>
      <div style="overflow:auto"><table><thead><tr><th>Tâche</th><th class="c">Exéc. / mois</th><th class="c" title="Milliers de tokens lus par exécution">Entrée k tok.</th><th class="c" title="Part de l'entrée relue en cache">Cache %</th><th class="c" title="Milliers de tokens écrits par exécution">Sortie k tok.</th><th class="c">Opus 5.5 CHF / mois</th><th class="c">Sonnet 5.5 CHF / mois</th><th></th></tr></thead><tbody data-rows></tbody></table></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button data-add>+ Ajouter une ligne</button><button data-reset>Valeurs d'origine</button></div>
      <div class="kp" data-kp></div>
      <p class="hint">Entrée = tout ce que la tâche lit (consignes, fichiers du Drive, images, résultats d'outils), relu à chaque étape ; la part « relue en cache » coûte 0,20 USD / million au lieu du prix d'entrée. Une tâche qui ne trouve rien à faire coûte beaucoup moins (baissez ses tokens). L'abonnement couvre aussi vos conversations avec Claude (comme celle-ci), non comptées ici.</p>
    </div>
    <div class="bgac-f"><button class="pri" data-x>Fermer</button></div></div>`;
  document.body.appendChild(sc);
  const rowsEl = sc.querySelector('[data-rows]'), kpEl = sc.querySelector('[data-kp]');
  const rowHtml = (r, i) => `<tr data-i="${i}"><td><input data-k="n" value="${esc(r.n)}"></td><td><input class="n" data-k="runs" value="${esc(+num(r.runs).toFixed(2))}"></td><td><input class="n" data-k="inK" value="${esc(r.inK)}"></td><td><input class="n" data-k="cache" value="${esc(r.cache)}"></td><td><input class="n" data-k="outK" value="${esc(r.outK)}"></td><td class="c" data-o></td><td class="c" data-s></td><td><button class="x" data-del title="Retirer cette ligne">✕</button></td></tr>`;
  const drawRows = () => { rowsEl.innerHTML = s.rows.map(rowHtml).join('') + `<tr class="tot"><td>Total</td><td colspan="4"></td><td class="c" data-to></td><td class="c" data-ts></td><td></td></tr>`; upd(); };
  const upd = () => {
    const c = calc(s), rate = num(s.rate) || 0, sub = num(s.sub);
    c.rows.forEach((o, i) => { const tr = rowsEl.querySelector(`tr[data-i="${i}"]`); if (!tr) return; tr.querySelector('[data-o]').textContent = f2(o.m.opus * rate); tr.querySelector('[data-s]').textContent = f2(o.m.sonnet * rate); });
    rowsEl.querySelector('[data-to]').textContent = f2(c.tot.opus * rate); rowsEl.querySelector('[data-ts]').textContent = f2(c.tot.sonnet * rate);
    const card = k => { const m = c.tot[k] * rate, d = sub - m;
      const cmp = sub > 0 ? `<em class="${d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? 'API moins chère de ' : 'API plus chère de '}${f0(Math.abs(d))} CHF / mois que l'abonnement</em>` : '<em>Saisissez votre abonnement pour comparer</em>';
      return `<div class="k"><small>${MODELS[k].l}${s.batch ? ' · Batch' : ''}</small><b>${f0(m)} CHF / mois</b><em>${f0(m * 12)} CHF / an · ${f2(c.tot[k])} USD / mois</em><br>${cmp}</div>`; };
    kpEl.innerHTML = card('opus') + card('sonnet') + (sub > 0 ? `<div class="k"><small>Abonnement saisi</small><b>${f0(sub)} CHF / mois</b><em>${f0(sub * 12)} CHF / an</em></div>` : '');
    save(s);
  };
  sc.addEventListener('input', e => {
    const g = e.target.dataset.g; if (g) { s[g] = g === 'batch' ? e.target.checked : e.target.value; upd(); return; }
    const k = e.target.dataset.k, tr = e.target.closest('tr[data-i]'); if (!k || !tr) return;
    s.rows[+tr.dataset.i][k] = k === 'n' ? e.target.value : e.target.value; upd();
  });
  sc.addEventListener('change', e => { if (e.target.dataset.g === 'batch') { s.batch = e.target.checked; upd(); } });
  const close = () => { sc.remove(); document.removeEventListener('keydown', key, true); try { if (opts && typeof opts.onClose === 'function') opts.onClose(); } catch (e) {} };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  document.addEventListener('keydown', key, true);
  sc.addEventListener('click', e => {
    if (e.target === sc || e.target.closest('[data-x]')) { close(); return; }
    if (e.target.closest('[data-add]')) { s.rows.push({id:'u' + Date.now().toString(36), n:'Autre tâche', runs:WD, inK:100, cache:70, outK:5}); drawRows(); return; }
    if (e.target.closest('[data-reset]')) { if (confirm('Remettre les tâches, le taux et les tokens aux valeurs d\'origine ?')) { Object.assign(s, DEF(), {sub:s.sub}); sc.querySelector('[data-g=rate]').value = s.rate; sc.querySelector('[data-g=batch]').checked = s.batch; drawRows(); } return; }
    const d = e.target.closest('[data-del]'); if (d) { s.rows.splice(+d.closest('tr').dataset.i, 1); drawRows(); }
  });
  drawRows();
  return sc;
}
window.BGApiCost = {open, summary, calc, load, MODELS, PRICE_DATE};
})();
