/* =====================================================================
   BauGest — Commandes de matériaux par chantier (formulaire au clavier) + fournisseurs + articles déjà commandés
   Module partagé par la tablette (index.html, rubrique « Commandes » du bureau) et le PC (pc.html, section « Commandes ») :
   BGCmd.init({...}) puis BGCmd.mount({head, info, list, scroll}, idChantier) ; affichage dans les éléments de l'hôte (classes et couleurs de l'hôte).
   Même formulaire sur PC et tablette : lignes Désignation (proposée d'après les articles déjà saisis) / Quantité / Unité (liste), pas de lien avec la soumission.
   Livraison = adresse du chantier (s.addr) + contremaître du chantier (s.fore {name, tel}), repris dans chaque commande.
   Drive :
   - <Chantier>/Commandes/<N°> – <fournisseur>.json (appProperties kind='commande', uid, site, n) + même nom .pdf (kind='cmdpdf', uid)
   - <Racine>/BauGest – fournisseurs (ne pas supprimer).json (kind='suppliers') : {v:1, list:[fournisseurs], items:[{k, t, u, n, m}]}
     fournisseur {id, name, addr, contact, tel, mail, note, fav, m, del?} ; article = désignation déjà commandée (k = clé sans accents, u = dernière unité, n = nb d'utilisations)
   Commande : {v:1, uid, siteId, n, no, sup, supSnap, st, created, m, dlv:{date, time, place, fore, tel, unload}, note, by, lines:[{id, t, q, u}], sentAt, pdfAt}
   ===================================================================== */
(function (root) {
'use strict';

const PDFLIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
const DRV = 'https://www.googleapis.com/drive/v3/files', UPL = 'https://www.googleapis.com/upload/drive/v3/files';
const SUP_NAME = 'BauGest – fournisseurs (ne pas supprimer).json', DIR = 'Commandes';
const ST = {b:'Brouillon', e:'Envoyée', c:'Confirmée', p:'Livrée en partie', l:'Livrée', x:'Annulée'}, ST_ORDER = ['b', 'e', 'c', 'p', 'l', 'x'];
const UNITS = ['pce', 'm', 'm²', 'm³', 'ml', 'kg', 't', 'l', 'sac', 'palette', 'rouleau', 'paquet', 'carton', 'boîte', 'barre', 'plaque', 'big bag', 'camion', 'gl', 'h', 'jour'];
const UNLOAD = ['', 'Camion-grue', 'Hayon', 'Basculant', 'Chariot élévateur', 'À la main'];

const pad2 = n => String(n).padStart(2, '0');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const qEsc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const clean = s => String(s || '').normalize('NFC').replace(/[\/\\:*?"<>|#%]+/g, '').replace(/\s+/g, ' ').trim();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const fmtQ = v => v == null || !isFinite(v) ? '' : String(Math.round(v * 1000) / 1000).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
const numIn = s => { const v = parseFloat(String(s || '').replace(/['’\s]/g, '').replace(',', '.')); return isFinite(v) ? v : null; };
const isoToday = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const chDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : ''; };
const chShort = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : ''; };
const wdName = iso => { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('fr-CH', {weekday:'long'}); };
const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem('baugest.' + k) || ''; localStorage.setItem('baugest.' + k, v); } catch (e) { return ''; } };

let H = null;
const U = {siteId:undefined, els:null, view:'list', orders:[], cur:null, supQ:'', supSel:null, dlgs:[], saveT:0, tok:0, info:''};
const MEM = {list:[], items:[], fileId:null, loaded:false, dirty:false, pushT:0};

/* ---------- petits outils ---------- */
function toast(msg, ms = 3200){
  let box = document.querySelector('.bc-toasts'); if (!box) { box = document.createElement('div'); box.className = 'bc-toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'bc-toast'; t.textContent = msg;
  box.appendChild(t); while (box.children.length > 3) box.firstElementChild.remove(); setTimeout(() => t.remove(), ms);
}
const btnCls = () => (H && H.cls && H.cls.btn) || 'btn';
function dlg({title, body = '', buttons = [{label:'OK', value:true, pri:true}], onOpen, width}){
  return new Promise(res => {
    const sc = document.createElement('div'); sc.className = 'bc-scrim';
    sc.innerHTML = `<div class="bc-dlg" role="dialog" aria-label="${esc(title)}" ${width ? `style="width:min(${width}px,100%)"` : ''}><h2>${esc(title)}</h2><div class="bc-db">${body}</div>`
      + `<div class="bc-df">${buttons.map((b, i) => `<button class="${btnCls()}${b.pri ? ' primary' : ''}${b.dang ? ' danger bc-dang' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    document.body.appendChild(sc);
    const box = sc.firstElementChild;
    const key = e => { if (e.key === 'Escape' && U.dlgs[U.dlgs.length - 1] === entry) { e.preventDefault(); e.stopPropagation(); done(null); } };
    const done = v => { const k = U.dlgs.indexOf(entry); if (k >= 0) U.dlgs.splice(k, 1); document.removeEventListener('keydown', key, true); sc.remove(); if (H.onNav) H.onNav(); res(v); };
    const fire = i => { const b = buttons[i]; if (b.check && !b.check(box)) return; done(b.value === undefined ? box : b.value); };
    const entry = {close:() => done(null)}; U.dlgs.push(entry); if (H.onNav) H.onNav();
    document.addEventListener('keydown', key, true);
    sc.addEventListener('pointerdown', e => { if (e.target === sc) sc.dataset.down = '1'; });
    sc.addEventListener('click', e => { if (e.target === sc && sc.dataset.down) done(null); delete sc.dataset.down; });
    box.querySelectorAll('.bc-df button').forEach(b => b.addEventListener('click', () => fire(+b.dataset.i)));
    if (onOpen) onOpen(box, done);
    const f = box.querySelector('[autofocus]'); if (f) f.focus();
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

/* ---------- stockage de l'appareil (IndexedDB baugest-cmd) ---------- */
const DB = (() => {
  let p;
  const open = () => p || (p = new Promise((res, rej) => { const r = indexedDB.open('baugest-cmd', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('orders', {keyPath:'uid'}); r.result.createObjectStore('kv', {keyPath:'k'}); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
  const tx = async (st, mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(st, mode), r = fn(t.objectStore(st)); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
  return {
    all:() => tx('orders', 'readonly', s => s.getAll()).catch(() => []),
    put:rec => tx('orders', 'readwrite', s => s.put(JSON.parse(JSON.stringify(rec)))).catch(() => null),
    del:k => tx('orders', 'readwrite', s => s.delete(k)).catch(() => null),
    get:k => tx('kv', 'readonly', s => s.get(k)).then(r => r ? r.v : null).catch(() => null),
    set:(k, v) => tx('kv', 'readwrite', s => s.put({k, v:JSON.parse(JSON.stringify(v))})).catch(() => null)
  };
})();
const online = () => { try { return !!(H.online && H.online()) && navigator.onLine !== false; } catch (e) { return false; } };
const site = id => (H.sites() || []).find(s => s.id === id) || null;

/* ---------- Drive ---------- */
async function getJson(id){
  let j = await H.api(`${DRV}/${encodeURIComponent(id)}?alt=media`);
  if (j && typeof j.json === 'function') j = await j.json();
  return j;
}
async function getBuf(id){
  const r = H.apiRaw ? await H.apiRaw(`${DRV}/${encodeURIComponent(id)}?alt=media`) : await H.api(`${DRV}/${encodeURIComponent(id)}?alt=media`);
  if (r && typeof r.arrayBuffer === 'function') return r.arrayBuffer();
  return new TextEncoder().encode(JSON.stringify(r)).buffer;
}
async function listQ(q, fields = 'files(id,name,createdTime,modifiedTime,appProperties)'){
  const out = []; let tok = '';
  do { const r = await H.api(DRV + '?' + new URLSearchParams({q, pageSize:'400', fields:'nextPageToken,' + fields, ...(tok ? {pageToken:tok} : {})})); out.push(...((r && r.files) || [])); tok = r && r.nextPageToken; } while (tok);
  return out;
}
function multipart(md, blob){
  const b = 'bc' + Math.random().toString(36).slice(2);
  return {type:'multipart/related; boundary=' + b, body:new Blob([`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`, JSON.stringify(md), `\r\n--${b}\r\nContent-Type: ${blob.type || 'application/octet-stream'}\r\n\r\n`, blob, `\r\n--${b}--`])};
}
function upload(blob, md, id){
  const mp = multipart(md, blob);
  return H.api(`${UPL}${id ? '/' + encodeURIComponent(id) : ''}?uploadType=multipart&fields=id,name,modifiedTime`, {method:id ? 'PATCH' : 'POST', headers:{'Content-Type':mp.type}, body:mp.body});
}
const trash = id => H.api(`${DRV}/${encodeURIComponent(id)}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({trashed:true})});
const cmdDir = s => H.ensureFolder([s.folder, DIR]);

/* ---------- mémoire commune (tous chantiers) : fournisseurs + articles déjà saisis ---------- */
const supLive = () => MEM.list.filter(x => !x.del);
const supById = id => MEM.list.find(x => x.id === id) || null;
const supSorted = () => supLive().slice().sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.name.localeCompare(b.name, 'fr'));
function mergeBy(a, b, key){
  const m = new Map(); for (const x of [...(a || []), ...(b || [])]) { if (!x || !x[key]) continue; const o = m.get(x[key]); if (!o || (x.m || 0) > (o.m || 0)) m.set(x[key], o ? Object.assign({}, x, {n:Math.max(x.n || 0, o.n || 0)}) : x); }
  return [...m.values()];
}
const memSig = () => MEM.list.map(x => x.id + ':' + (x.m || 0)).sort().join('|') + '#' + MEM.items.map(x => x.k + ':' + (x.m || 0)).sort().join('|');
const memLocal = () => DB.set('suppliers', {list:MEM.list, items:MEM.items, fileId:MEM.fileId, dirty:MEM.dirty});
async function memLoad(){
  const loc = await DB.get('suppliers');
  if (loc && !MEM.loaded) { MEM.list = loc.list || []; MEM.items = loc.items || []; MEM.fileId = loc.fileId || null; MEM.dirty = !!loc.dirty; }
  MEM.loaded = true;
  if (!online()) return;
  try {
    const fs = await listQ("trashed=false and appProperties has { key='kind' and value='suppliers' }", 'files(id,modifiedTime)');
    fs.sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
    if (fs[0]) {
      const j = await getJson(fs[0].id) || {}; MEM.fileId = fs[0].id;
      const before = memSig(); MEM.list = mergeBy(j.list, MEM.list, 'id'); MEM.items = mergeBy(j.items, MEM.items, 'k');
      const rem = {list:j.list || [], items:j.items || []}, sigR = rem.list.map(x => x.id + ':' + (x.m || 0)).sort().join('|') + '#' + rem.items.map(x => x.k + ':' + (x.m || 0)).sort().join('|');
      MEM.dirty = memSig() !== sigR || (MEM.dirty && before !== sigR);
    }
    await memLocal();
    if (MEM.dirty) await memPush();
  } catch (e) { U.info = 'Fournisseurs / articles : ' + e.message; }
}
async function memPush(){
  MEM.dirty = true; await memLocal();
  if (!online()) return;
  try {
    const blob = new Blob([JSON.stringify({v:1, updatedAt:new Date().toISOString(), list:MEM.list, items:MEM.items})], {type:'application/json'});
    if (MEM.fileId) await upload(blob, {}, MEM.fileId);
    else { const rootId = await H.ensureFolder([]); const r = await upload(blob, {name:SUP_NAME, parents:[rootId], mimeType:'application/json', appProperties:{pc:'1', site:'none', kind:'suppliers'}, description:'Fournisseurs et articles des commandes de matériaux (BauGest, tous chantiers)'}); MEM.fileId = r.id; }
    MEM.dirty = false; await memLocal();
  } catch (e) { /* gardé sur l'appareil, renvoyé plus tard */ }
}
const memPushLater = () => { clearTimeout(MEM.pushT); MEM.pushT = setTimeout(memPush, 2500); };
function supSave(s){ s.m = Date.now(); const i = MEM.list.findIndex(x => x.id === s.id); if (i >= 0) MEM.list[i] = s; else MEM.list.push(s); return memPush(); }
/* article saisi → gardé pour les propositions suivantes (désignation + dernière unité) */
function rememberItem(t, u){
  t = String(t || '').replace(/\s+/g, ' ').trim(); if (t.length < 2) return;
  const k = fold(t), it = MEM.items.find(x => x.k === k);
  if (it) { if (it.t === t && it.u === (u || it.u)) return; it.t = t; if (u) it.u = u; it.m = Date.now(); }
  else MEM.items.push({k, t, u:u || '', n:0, m:Date.now()});
  memLocal(); memPushLater(); refreshItemsList();
}
function countItems(o){ for (const l of o.lines) { const it = MEM.items.find(x => x.k === fold(l.t)); if (it) { it.n = (it.n || 0) + 1; it.m = Date.now(); } } memLocal(); memPushLater(); }
const itemOf = t => MEM.items.find(x => x.k === fold(t)) || null;
const itemsSorted = () => MEM.items.slice().sort((a, b) => (b.n || 0) - (a.n || 0) || a.t.localeCompare(b.t, 'fr'));
function refreshItemsList(){ const dl = document.getElementById('bcItems'); if (dl) dl.innerHTML = itemsSorted().map(x => `<option value="${esc(x.t)}">${esc(x.u || '')}</option>`).join(''); }

/* ---------- commandes du chantier ---------- */
const recName = o => `${o.no} – ${clean(o.supSnap && o.supSnap.name) || 'sans fournisseur'}`;
async function loadOrders(){
  const sid = U.siteId, tok = ++U.tok, s = site(sid);
  let recs = (await DB.all()).filter(r => r.siteId === sid);
  recs.forEach(r => { r.o = norm(r.o); });
  U.orders = recs; U.info = online() ? '' : 'Hors ligne ou non connecté à Google · commandes de cet appareil seulement';
  renderSoft();
  if (!online() || !s) return;
  try {
    const fs = await listQ(`trashed=false and appProperties has { key='kind' and value='commande' } and appProperties has { key='site' and value='${qEsc(sid)}' }`);
    const pdfs = await listQ(`trashed=false and appProperties has { key='kind' and value='cmdpdf' } and appProperties has { key='site' and value='${qEsc(sid)}' }`, 'files(id,appProperties)');
    if (tok !== U.tok) return;
    const seen = new Set();
    for (const f of fs) {
      const id = f.appProperties.uid || f.id; seen.add(id);
      let r = recs.find(x => x.uid === id);
      if (r && (r.dirty || r.driveMod === f.modifiedTime)) { r.driveId = f.id; continue; }
      try { const o = norm(await getJson(f.id)); o.uid = id; r = r || {uid:id, siteId:sid}; Object.assign(r, {o, driveId:f.id, driveMod:f.modifiedTime, dirty:false}); if (!recs.includes(r)) recs.push(r); await DB.put(r); } catch (e) {}
    }
    for (const r of recs.slice()) if (r.driveId && !seen.has(r.uid) && !r.dirty) { recs = recs.filter(x => x !== r); DB.del(r.uid); }
    for (const r of recs) { const p = pdfs.find(x => x.appProperties.uid === r.uid); r.pdfId = p ? p.id : null; }
    if (tok !== U.tok) return;
    U.orders = recs;
    for (const r of recs) if (r.dirty) push(r);
  } catch (e) { U.info = 'Drive illisible (' + e.message + ') · commandes de cet appareil seulement'; }
  renderSoft();
}
function norm(o){
  o = o || {};
  const d = o.dlv || {};
  return {v:1, uid:o.uid || uid(), siteId:o.siteId || U.siteId, n:+o.n || 1, no:o.no || '', sup:o.sup || null, supSnap:o.supSnap || null, st:ST[o.st] ? o.st : 'b',
    created:o.created || Date.now(), m:o.m || Date.now(),
    dlv:{date:d.date || '', time:d.time || '', place:d.place || '', fore:d.fore != null ? d.fore : (d.contact || ''), tel:d.tel || '', unload:d.unload || ''},
    note:o.note || '', by:o.by || '',
    lines:(o.lines || []).map(l => ({id:l.id || uid(), t:l.t || '', q:l.q == null ? null : +l.q, u:l.u || ''})),
    sentAt:o.sentAt || null, pdfAt:o.pdfAt || null};
}
async function push(rec){
  if (!rec || !online()) return;
  const s = site(rec.siteId); if (!s) return;
  if (rec._p) { rec._again = true; return rec._p; }
  rec._p = (async () => {
    try {
      const name = recName(rec.o) + '.json', blob = new Blob([JSON.stringify(rec.o)], {type:'application/json'});
      const desc = `Commande de matériaux ${rec.o.no} · ${(rec.o.supSnap && rec.o.supSnap.name) || 'sans fournisseur'} · ${ST[rec.o.st]}${rec.o.dlv.date ? ' · livraison ' + chDate(rec.o.dlv.date) : ''}`;
      let r;
      if (rec.driveId) { try { r = await upload(blob, {name, description:desc}, rec.driveId); } catch (e) { if (e.status !== 404) throw e; rec.driveId = null; } }
      if (!rec.driveId) r = await upload(blob, {name, parents:[await cmdDir(s)], mimeType:'application/json', description:desc, appProperties:{pc:'1', site:rec.siteId, kind:'commande', uid:rec.uid, n:String(rec.o.n)}});
      rec.driveId = r.id; rec.driveMod = r.modifiedTime; rec.dirty = false;
      if (rec.pdfId && rec.pdfName !== recName(rec.o)) { try { await H.api(`${DRV}/${encodeURIComponent(rec.pdfId)}`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:recName(rec.o) + '.pdf'})}); rec.pdfName = recName(rec.o); } catch (e) {} }
      await DB.put(strip(rec));
    } catch (e) { U.info = 'Commande gardée sur l’appareil : ' + e.message; setInfo(); }
  })();
  await rec._p; rec._p = null;
  if (rec._again) { rec._again = false; return push(rec); }
}
const strip = r => { const c = Object.assign({}, r); delete c._p; delete c._again; return c; };
function touch(rec){
  rec.o.m = Date.now(); rec.dirty = true; DB.put(strip(rec));
  clearTimeout(U.saveT); U.saveT = setTimeout(() => push(rec), 1500);
}
async function flush(){ clearTimeout(U.saveT); const r = U.cur; if (r && r.dirty) await push(r); }

/* ---------- interface : affichée dans la page hôte (bureau tablette / section PC) ---------- */
const ic = p => `<svg class="ic bc-ic" viewBox="0 0 24 24">${p}</svg>`;
const I = {x:ic('<path d="M18 6 6 18M6 6l12 12"/>'), plus:ic('<path d="M12 5v14M5 12h14"/>'), back:ic('<path d="M15 18l-6-6 6-6"/>'), del:ic('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
  pdf:ic('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6"/>'), truck:ic('<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-.1M17 19a2 2 0 1 0 0-.1"/>'),
  sup:ic('<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>'), list:ic('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>')};
const B = (label, attrs, kind = '') => `<button class="${btnCls()}${kind === 'pri' ? ' primary' : kind === 'dang' ? ' danger bc-dang' : ''}" ${attrs}>${label}</button>`;
function css(){ return `
.bc-ic{width:19px;height:19px}
.bc-dang{color:var(--bad,#ef5f58)}
.bc-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.bc-acts select{width:auto!important;max-width:230px;min-height:40px;background:var(--surface2,#262a30);border:1px solid var(--line,#353a41);color:var(--text,#ecebe6);border-radius:8px;padding:0 10px;font:15px var(--body,sans-serif)}
.bc-root *{box-sizing:border-box}
.bc-cols{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:14px;align-items:start}
.bc-card{background:var(--surface,#1c1f23);border:1px solid var(--line,#353a41);border-radius:12px;padding:12px 14px;margin-bottom:14px}
.bc-card h3{margin:0 0 10px;font:700 18px/1.1 var(--display,sans-serif);letter-spacing:.03em;color:var(--muted,#9da2a8);text-transform:uppercase}
.bc-card h3 .bc-ic{vertical-align:-3px;margin-right:6px}
.bc-kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}
.bc-kpi div{background:var(--surface,#1c1f23);border:1px solid var(--line,#353a41);border-radius:12px;padding:10px 12px}
.bc-kpi b{display:block;font:700 28px/1.1 var(--display,sans-serif)}
.bc-kpi span{color:var(--muted,#9da2a8);font-size:13px}
.bc-t{border-collapse:collapse;width:100%}
.bc-t th{font-weight:600;color:var(--muted,#9da2a8);font-size:12.5px;text-align:left;padding:6px 8px;border-bottom:1px solid var(--line,#353a41)}
.bc-t td{padding:9px 8px;border-bottom:1px solid var(--line,#353a41);font-size:15px;vertical-align:middle}
.bc-t tr[data-co]{cursor:pointer}
.bc-t tr[data-co]:hover td{background:var(--surface2,#262a30)}
.bc-n{text-align:right!important;white-space:nowrap;font-variant-numeric:tabular-nums}
.bc-mono{font-family:var(--mono,monospace);font-size:13px}
.bc-mut{color:var(--muted,#9da2a8)}
.bc-sm{font-size:13px}
.bc-warn{color:var(--warn,#f0a04b)}
.bc-st{display:inline-block;border-radius:6px;padding:2px 8px;font-size:12.5px;font-weight:600;white-space:nowrap;border:1px solid var(--line,#353a41)}
.bc-st.b{color:var(--muted,#9da2a8)}.bc-st.e{background:var(--signal-soft,#3b3219);border-color:var(--signal,#f2c230)}
.bc-st.c{color:#3b82d6;border-color:#3b82d6}.bc-st.p{color:var(--warn,#f0a04b);border-color:var(--warn,#f0a04b)}.bc-st.l{color:var(--ok,#48c985);border-color:var(--ok,#48c985)}.bc-st.x{color:var(--bad,#ef5f58);border-color:var(--bad,#ef5f58)}
.bc-empty{padding:26px;text-align:center;color:var(--muted,#9da2a8)}
.bc-fld{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;min-width:0}
.bc-fld label{font-size:13px;color:var(--muted,#9da2a8)}
.bc-root input:not([type=checkbox]),.bc-root select,.bc-root textarea,.bc-dlg input:not([type=checkbox]),.bc-dlg select,.bc-dlg textarea{background:var(--surface2,#262a30);border:1px solid var(--line,#353a41);color:var(--text,#ecebe6);border-radius:8px;padding:9px 10px;font:15px var(--body,sans-serif);min-width:0;max-width:100%;min-height:42px}
.bc-fld>input,.bc-fld>select,.bc-fld>textarea{width:100%}
.bc-row{display:flex;gap:10px;flex-wrap:wrap}.bc-row>.bc-fld{flex:1 1 160px}
.bc-lines td{padding:6px 4px}
.bc-lines td.nr{width:34px;color:var(--muted,#9da2a8);text-align:right;padding-right:8px}
.bc-lines input[data-f="t"]{width:100%}
.bc-lines input[data-f="q"]{width:100px;text-align:right}
.bc-lines select[data-f="u"]{width:118px}
.bc-lines td.x{width:52px}
.bc-tag{display:inline-block;background:var(--surface2,#262a30);border-radius:5px;padding:1px 7px;font-size:12px;color:var(--muted,#9da2a8);margin:2px 3px 0 0}
.bc-sup{display:flex;gap:12px;align-items:center;padding:10px 6px;border-bottom:1px solid var(--line,#353a41);cursor:pointer}
.bc-sup.on{background:var(--signal-soft,#3b3219)}
.bc-av{width:42px;height:42px;border-radius:10px;background:var(--surface2,#262a30);display:grid;place-items:center;font:700 17px var(--display,sans-serif);flex:none}
.bc-hint{background:var(--signal-soft,#3b3219);border:1px dashed var(--signal,#f2c230);border-radius:8px;padding:8px 10px;font-size:13.5px;margin:0 0 12px}
.bc-addr{background:var(--surface2,#262a30);border-radius:8px;padding:8px 10px;margin-bottom:10px}
.bc-addr b{display:block}
.bc-srch{display:flex;gap:8px;margin-bottom:8px}
.bc-srch input{flex:1}
.bc-scrim{position:fixed;inset:0;z-index:90;background:#000a;display:flex;align-items:center;justify-content:center;padding:16px}
.bc-dlg{background:var(--surface,#1c1f23);color:var(--text,#ecebe6);border:1px solid var(--line,#353a41);border-radius:14px;width:min(520px,100%);max-height:92vh;display:flex;flex-direction:column;font:15px/1.4 var(--body,sans-serif)}
.bc-dlg h2{margin:0;padding:14px 16px 6px;font:700 22px var(--display,sans-serif);text-transform:uppercase;letter-spacing:.02em}
.bc-db{padding:6px 16px;overflow:auto}
.bc-df{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;flex-wrap:wrap}
.bc-toasts{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:95;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none}
.bc-toast{background:#000d;color:#fff;padding:9px 14px;border-radius:8px;font:14px var(--body,sans-serif);max-width:90vw}
@media (max-width:980px){.bc-cols{grid-template-columns:minmax(0,1fr)}}
`; }
const active = () => { try { return !!(U.els && (!H.active || H.active())); } catch (e) { return false; } };
function bindEls(els){
  for (const el of [els.head, els.list]) {
    if (!el || el.dataset.bcBound) continue;
    el.dataset.bcBound = '1';
    el.addEventListener('click', e => { if (active()) onClick(e); });
    el.addEventListener('input', e => { if (active()) onInput(e); });
    el.addEventListener('change', e => { if (active()) onChange(e); });
    el.addEventListener('keydown', e => { if (active()) onKey(e); });
  }
}
function mount(els, siteId){
  if (!H) throw new Error('BGCmd.init() manquant');
  if (!document.getElementById('bcCss')) { const st = document.createElement('style'); st.id = 'bcCss'; st.textContent = css(); document.head.appendChild(st); }
  if (!document.getElementById('bcItems')) { const dl = document.createElement('datalist'); dl.id = 'bcItems'; document.body.appendChild(dl); }
  U.els = els; bindEls(els);
  if (!MEM.loaded) memLoad().then(() => { refreshItemsList(); if (U.view !== 'list') render(); });
  const sid = siteId && site(siteId) ? siteId : null;
  if (sid !== U.siteId) { flush(); U.siteId = sid; U.view = U.view === 'sup' ? 'sup' : 'list'; U.cur = null; U.info = ''; return loadSite(); }
  render();
}
function setInfo(){ const el = U.els && U.els.info; if (!el) return; const t = U.info; el.hidden = !t; el.textContent = t || ''; }
function renderSoft(){ if (!active()) return; if (U.view === 'edit') setInfo(); else render(); }
function render(){
  if (!active()) return;
  if (H.onNav) H.onNav();
  setInfo();
  if (U.view === 'edit' && U.cur) return renderEdit();
  if (U.view === 'sup') return renderSup();
  renderList();
}
function head(title, small, acts, backBtn){
  const s = site(U.siteId);
  U.els.head.innerHTML = `${backBtn ? B(I.back + '<span>' + esc(backBtn) + '</span>', 'data-ca="list"') : (H.logoHTML && s ? H.logoHTML(U.siteId) : '')}<div class="t"><small>${esc(small)}</small><h2>${esc(title)}</h2></div><div class="dk-acts bc-acts">${acts}</div>`;
}
const stBadge = st => `<span class="bc-st ${st}">${ST[st]}</span>`;
const late = o => o.dlv.date && o.dlv.date < isoToday() && /[ecp]/.test(o.st);
const objOf = o => o.lines.map(l => l.t).filter(Boolean).slice(0, 2).join(' · ').slice(0, 70) || '—';
const nLines = o => o.lines.filter(l => (l.t || '').trim()).length;
function renderList(){
  const s = site(U.siteId);
  if (!s) { head('Commandes', 'Commandes de matériaux', B(I.sup + '<span>Fournisseurs</span>', 'data-ca="sups"')); U.els.list.innerHTML = '<p class="bc-empty">Choisis un chantier pour voir et faire ses commandes.</p>'; return; }
  head(s.name || s.label, (s.number || 'Chantier') + ' · Commandes', B(I.sup + '<span>Fournisseurs</span>', 'data-ca="sups"') + B(I.plus + '<span>Nouvelle commande</span>', 'data-ca="new"', 'pri'));
  const os = U.orders.map(r => r.o).sort((a, b) => b.n - a.n), t = isoToday(), in7 = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); })();
  const soon = os.filter(o => /[ecp]/.test(o.st) && o.dlv.date && o.dlv.date >= t && o.dlv.date <= in7).sort((a, b) => (a.dlv.date + a.dlv.time).localeCompare(b.dlv.date + b.dlv.time));
  const rows = os.map(o => `<tr data-co="${esc(o.uid)}"><td class="bc-mono" style="white-space:nowrap">${esc(o.no)}</td><td>${esc((o.supSnap && o.supSnap.name) || '—')}</td><td>${esc(objOf(o))}</td>
    <td class="${late(o) ? 'bc-warn' : ''}" style="white-space:nowrap">${o.dlv.date ? esc(chShort(o.dlv.date) + (o.dlv.time ? ' · ' + o.dlv.time : '')) + (late(o) ? ' ⚠' : '') : '<span class="bc-mut">—</span>'}</td><td>${stBadge(o.st)}</td><td class="bc-n">${nLines(o)}</td></tr>`).join('');
  const miss = [!s.addr && 'l’adresse du chantier', !(s.fore && s.fore.name) && 'le contremaître'].filter(Boolean);
  U.els.list.innerHTML = `<div class="bc-root">${miss.length ? `<div class="bc-hint">À compléter dans la fiche du chantier : ${miss.join(' et ')} (repris dans chaque commande pour la livraison).${H.editSite ? ' ' + B('<span>Compléter la fiche du chantier</span>', 'data-ca="site"') : ''}</div>` : ''}
    <div class="bc-kpi"><div><b>${os.filter(o => o.st !== 'x').length}</b><span>commandes</span></div><div><b>${soon.length}</b><span>livraisons à venir (7 j)</span></div>
      <div><b class="${os.some(late) ? 'bc-warn' : ''}">${os.filter(late).length}</b><span>en retard de livraison</span></div></div>
    <div class="bc-cols"><div><div class="bc-card"><h3>${I.list}Commandes</h3>${os.length ? `<table class="bc-t"><tr><th>N°</th><th>Fournisseur</th><th>Objet</th><th>Livraison</th><th>État</th><th class="bc-n">Lignes</th></tr>${rows}</table>` : '<p class="bc-empty">Aucune commande pour ce chantier. « Nouvelle commande » pour commencer.</p>'}</div></div>
    <div><div class="bc-card"><h3>${I.truck}Prochaines livraisons</h3>${soon.length ? soon.map(o => `<div class="bc-sm" style="padding:3px 0">${esc(wdName(o.dlv.date).slice(0, 2))} ${esc(chShort(o.dlv.date))}${o.dlv.time ? ' ' + esc(o.dlv.time) : ''} · <b>${esc((o.supSnap && o.supSnap.name) || '—')}</b> — ${esc(o.no)}</div>`).join('') : '<div class="bc-mut bc-sm">Rien dans les 7 prochains jours.</div>'}</div>
    <div class="bc-card"><h3>Livraison sur ce chantier</h3><div class="bc-sm"><b>${esc(s.addr || 'Adresse à compléter')}</b></div><div class="bc-sm bc-mut">Contremaître : ${esc(s.fore && s.fore.name ? [s.fore.name, s.fore.tel].filter(Boolean).join(' · ') : 'à compléter')}</div></div></div></div></div>`;
}

/* ---------- formulaire de commande ---------- */
const unitSel = u => `<select data-f="u" aria-label="Unité">${(u && !UNITS.includes(u) ? [u, ...UNITS] : UNITS).map(x => `<option ${x === (u || 'pce') ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
function lineRow(l, i){
  return `<tr data-l="${esc(l.id)}"><td class="nr">${i + 1}</td><td><input data-f="t" list="bcItems" value="${esc(l.t)}" placeholder="Désignation (proposée d’après les articles déjà commandés)" autocomplete="off" enterkeyhint="next"></td>
    <td><input data-f="q" inputmode="decimal" value="${esc(l.q == null ? '' : String(l.q))}" placeholder="Qté" enterkeyhint="next"></td><td>${unitSel(l.u)}</td>
    <td class="x">${B(I.x, 'data-ca="ldel" title="Retirer la ligne" aria-label="Retirer la ligne"')}</td></tr>`;
}
const linesHTML = () => `<table class="bc-t bc-lines"><tr><th></th><th>Désignation</th><th class="bc-n">Quantité</th><th>Unité</th><th></th></tr>${U.cur.o.lines.map(lineRow).join('')}</table>`;
function supBlock(){
  const o = U.cur.o, s = o.sup && supById(o.sup), sn = o.supSnap;
  return `<div class="bc-fld"><label>Fournisseur (liste commune à tous les chantiers)</label><select data-k="sup"><option value="">— Choisir —</option>${supSorted().map(x => `<option value="${esc(x.id)}" ${x.id === o.sup ? 'selected' : ''}>${x.fav ? '★ ' : ''}${esc(x.name)}${x.addr ? ' – ' + esc(x.addr.split(',').pop().trim()) : ''}</option>`).join('')}
    ${o.sup && !s && sn ? `<option value="${esc(o.sup)}" selected>${esc(sn.name)} (supprimé de la liste)</option>` : ''}<option value="__new">+ Nouveau fournisseur…</option></select></div>
    ${sn ? `<div class="bc-sm bc-mut">${esc([sn.contact, sn.tel, sn.mail].filter(Boolean).join(' · ') || 'Contact à compléter dans la fiche du fournisseur')}</div>${s && s.note ? `<div class="bc-sm bc-warn" style="margin-top:4px">${esc(s.note)}</div>` : ''}` : ''}`;
}
function renderEdit(){
  const r = U.cur, o = r.o, ro = o.st !== 'b', s = site(U.siteId), d = o.dlv;
  head('Commande ' + o.no, s ? (s.number || 'Chantier') + ' · ' + (s.name || '') : '',
    `<select data-k="st" title="État de la commande">${ST_ORDER.map(k => `<option value="${k}" ${k === o.st ? 'selected' : ''}>${ST[k]}</option>`).join('')}</select>`
    + B(I.del + '<span>Supprimer</span>', 'data-ca="odel"', 'dang') + (r.pdfId ? B('<span>PDF enregistré</span>', 'data-ca="pdfopen"') : '') + B(I.pdf + '<span>Créer le PDF</span>', 'data-ca="pdf"', 'pri'), 'Commandes');
  U.els.list.innerHTML = `<div class="bc-root">${ro ? `<div class="bc-hint">Commande ${esc(ST[o.st].toLowerCase())}${o.sentAt ? ' le ' + new Date(o.sentAt).toLocaleDateString('fr-CH') : ''} : une modification demande de refaire le PDF et de le renvoyer.</div>` : ''}
    <div class="bc-cols"><div>
      <div class="bc-card"><h3>${I.list}Articles</h3><div id="bcLines">${linesHTML()}</div>
        <div class="bc-acts" style="margin-top:10px">${B(I.plus + '<span>Ligne</span>', 'data-ca="lnew"')}<span class="bc-sm bc-mut">Entrée = champ suivant · les articles saisis sont proposés la prochaine fois</span></div></div>
      <div class="bc-card"><h3>Remarques</h3><div class="bc-fld"><label>Imprimées sur le PDF</label><textarea rows="2" data-k="note">${esc(o.note)}</textarea></div>
        <div class="bc-fld"><label>Commandé par</label><input data-k="by" value="${esc(o.by)}" placeholder="Nom, fonction"></div></div></div>
    <div>
      <div class="bc-card"><h3>Fournisseur</h3><div id="bcSup">${supBlock()}</div></div>
      <div class="bc-card"><h3>${I.truck}Livraison</h3>
        <div class="bc-fld"><label>Adresse de livraison (adresse du chantier)</label><input data-d="place" value="${esc(d.place)}" placeholder="Adresse du chantier"></div>
        <div class="bc-row"><div class="bc-fld"><label>Date</label><input type="date" data-d="date" value="${esc(d.date)}"></div><div class="bc-fld"><label>Heure</label><input type="time" data-d="time" value="${esc(d.time)}"></div></div>
        <div class="bc-row"><div class="bc-fld"><label>Contremaître</label><input data-d="fore" value="${esc(d.fore)}" placeholder="Nom"></div><div class="bc-fld"><label>Téléphone</label><input type="tel" data-d="tel" value="${esc(d.tel)}" placeholder="079 …"></div></div>
        <div class="bc-fld"><label>Déchargement</label><select data-d="unload">${UNLOAD.map(x => `<option value="${esc(x)}" ${x === d.unload ? 'selected' : ''}>${esc(x || '—')}</option>`).join('')}</select></div></div></div></div></div>`;
}
const refreshLines = () => { const el = U.els.list.querySelector('#bcLines'); if (el) el.innerHTML = linesHTML(); };
function setSup(o, s){ o.sup = s ? s.id : null; o.supSnap = s ? {name:s.name, addr:s.addr || '', contact:s.contact || '', tel:s.tel || '', mail:s.mail || ''} : null; }
function addLine(focus){
  const o = U.cur.o, last = o.lines[o.lines.length - 1];
  if (last && !last.t.trim() && last.q == null) { if (focus) focusLine(last.id); return; }
  const l = {id:uid(), t:'', q:null, u:'pce'}; o.lines.push(l); touch(U.cur);
  const tb = U.els.list.querySelector('#bcLines table'); if (tb) tb.insertAdjacentHTML('beforeend', lineRow(l, o.lines.length - 1)); else refreshLines();
  if (focus) focusLine(l.id);
}
const focusLine = (id, f = 't') => { const el = U.els.list.querySelector(`tr[data-l="${id}"] [data-f="${f}"]`); if (el) el.focus(); };

async function newOrder(){
  const s = site(U.siteId); if (!s) return;
  const n = U.orders.reduce((a, r) => Math.max(a, r.o.n || 0), 0) + 1;
  const o = norm({siteId:U.siteId, n, no:`CMD-${clean(s.number) || 'CH'}-${pad2(n)}`, by:pref('cmdBy'),
    dlv:{date:'', time:'07:00', place:s.addr || '', fore:(s.fore && s.fore.name) || '', tel:(s.fore && s.fore.tel) || '', unload:''}, lines:[{t:'', q:null, u:'pce'}]});
  const rec = {uid:o.uid, siteId:U.siteId, o, driveId:null, dirty:true};
  U.orders.push(rec); await DB.put(rec);
  openOrder(rec);
  focusLine(o.lines[0].id);
}
function openOrder(rec){ U.cur = rec; U.view = 'edit'; render(); if (U.els.scroll) U.els.scroll.scrollTop = 0; }
async function delOrder(){
  const r = U.cur; if (!r) return;
  if (!(await confirmDlg('Supprimer la commande', `Supprimer la commande ${esc(r.o.no)} et son PDF ? (corbeille du Drive, récupérable 30 jours)`, 'Supprimer', true))) return;
  clearTimeout(U.saveT);
  try { for (const id of [r.driveId, r.pdfId]) if (id && online()) await trash(id); } catch (e) { toast('Drive : ' + e.message); }
  await DB.del(r.uid); U.orders = U.orders.filter(x => x !== r); U.cur = null; U.view = 'list'; render();
}
const newSupDlg = () => supEdit({id:uid(), name:'', addr:'', contact:'', tel:'', mail:'', note:'', fav:false}, true);
function supForm(s){
  return `<div class="bc-fld"><label>Nom</label><input id="bsName" value="${esc(s.name)}" autofocus></div>
    <div class="bc-fld"><label>Adresse</label><input id="bsAddr" value="${esc(s.addr)}" placeholder="Rue, NPA Localité"></div>
    <div class="bc-row"><div class="bc-fld"><label>Contact</label><input id="bsCont" value="${esc(s.contact)}"></div><div class="bc-fld"><label>Téléphone</label><input id="bsTel" type="tel" value="${esc(s.tel)}"></div></div>
    <div class="bc-fld"><label>Mail des commandes</label><input id="bsMail" type="email" value="${esc(s.mail)}"></div>
    <div class="bc-fld"><label>Note</label><input id="bsNote" value="${esc(s.note)}" placeholder="Délai, heure limite de commande…"></div>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="bsFav" ${s.fav ? 'checked' : ''}> Favori (proposé en premier)</label>`;
}
async function supEdit(s, isNew){
  const box = await dlg({title:isNew ? 'Nouveau fournisseur' : 'Fournisseur', width:560, body:`<div class="bc-root">${supForm(s)}</div>`, buttons:[{label:'Annuler', value:null}, {label:'Enregistrer', pri:true, check:b => { const ok = !!b.querySelector('#bsName').value.trim(); if (!ok) toast('Nom du fournisseur manquant'); return ok; }}]});
  if (!box) return null;
  const v = id => box.querySelector(id).value.trim();
  const n = Object.assign({}, s, {name:v('#bsName'), addr:v('#bsAddr'), contact:v('#bsCont'), tel:v('#bsTel'), mail:v('#bsMail'), note:v('#bsNote'), fav:box.querySelector('#bsFav').checked});
  await supSave(n);
  for (const r of U.orders) if (r.o.sup === n.id && r.o.st === 'b') { setSup(r.o, n); touch(r); }
  return n;
}

/* ---------- fournisseurs (écran) ---------- */
function renderSup(){
  head('Fournisseurs', 'Tous les chantiers', B(I.plus + '<span>Fournisseur</span>', 'data-ca="supnew"', 'pri'), 'Commandes');
  const sel = U.supSel && supById(U.supSel), hist = sel ? U.orders.map(r => r.o).filter(o => o.sup === sel.id).sort((a, b) => b.n - a.n) : [];
  U.els.list.innerHTML = `<div class="bc-root bc-cols"><div>
      <div class="bc-srch"><input type="search" data-k="supq" placeholder="Chercher un fournisseur…" value="${esc(U.supQ)}"></div>
      <div class="bc-card" style="padding:0 6px" id="bcSupList">${supListHTML()}</div></div>
    <div>${sel ? `<div class="bc-card"><h3>${esc(sel.name)}</h3>
      <div class="bc-sm">${esc(sel.addr || '')}</div><div class="bc-sm">${esc([sel.contact, sel.tel].filter(Boolean).join(' · '))}</div><div class="bc-sm">${esc(sel.mail || '')}</div>
      ${sel.note ? `<div class="bc-sm bc-warn" style="margin-top:6px">${esc(sel.note)}</div>` : ''}
      <div class="bc-acts" style="margin-top:12px">${B('<span>Modifier</span>', 'data-ca="supedit"')}${B(I.del + '<span>Supprimer</span>', 'data-ca="supdel"', 'dang')}</div></div>
      <div class="bc-card"><h3>Commandes de ce chantier</h3>${hist.length ? hist.map(o => `<div class="bc-sm" style="padding:3px 0"><span class="bc-mono">${esc(o.no)}</span> · ${stBadge(o.st)} ${o.dlv.date ? '· livraison ' + esc(chShort(o.dlv.date)) : ''}</div>`).join('') : '<div class="bc-sm bc-mut">Aucune commande à ce fournisseur sur ce chantier.</div>'}</div>`
      : '<p class="bc-empty">Choisis un fournisseur dans la liste.</p>'}</div></div>`;
}
function supListHTML(){
  const words = fold(U.supQ).split(/\s+/).filter(Boolean), list = supSorted().filter(s => !words.length || words.every(w => fold([s.name, s.addr, s.contact].join(' ')).includes(w)));
  return list.length ? list.map(s => `<div class="bc-sup ${s.id === U.supSel ? 'on' : ''}" data-csup="${esc(s.id)}"><div class="bc-av">${esc(s.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</div>
    <div style="flex:1;min-width:0"><b>${esc(s.name)}</b>${s.fav ? ' ★' : ''}<br><span class="bc-sm bc-mut">${esc([s.addr, s.contact, s.tel].filter(Boolean).join(' · '))}</span></div></div>`).join('')
    : `<p class="bc-empty">${supLive().length ? 'Aucun fournisseur trouvé.' : 'Aucun fournisseur. Ajoute-les ici ou directement depuis une commande.'}</p>`;
}

/* ---------- événements (délégués sur la tête et la liste de l'hôte) ---------- */
async function onClick(e){
  const b = e.target.closest('[data-ca],[data-co],[data-csup]'); if (!b) return;
  const a = b.dataset.ca, r = U.cur, o = r && r.o;
  if (b.dataset.co) { const rec = U.orders.find(x => x.uid === b.dataset.co); if (rec) openOrder(rec); return; }
  if (b.dataset.csup) { U.supSel = b.dataset.csup; renderSup(); return; }
  switch (a) {
    case 'list': await flush(); U.view = 'list'; U.cur = null; render(); break;
    case 'new': newOrder(); break;
    case 'sups': U.view = 'sup'; render(); break;
    case 'site': if (H.editSite && U.siteId) H.editSite(U.siteId); break;
    case 'lnew': addLine(true); break;
    case 'ldel': { const id = b.closest('[data-l]').dataset.l; o.lines = o.lines.filter(l => l.id !== id); if (!o.lines.length) o.lines.push({id:uid(), t:'', q:null, u:'pce'}); touch(r); refreshLines(); break; }
    case 'odel': delOrder(); break;
    case 'pdf': makeAndSave(); break;
    case 'pdfopen': openSavedPdf(); break;
    case 'supnew': { const s = await newSupDlg(); if (s) { U.supSel = s.id; renderSup(); } break; }
    case 'supedit': { const s = supById(U.supSel); if (s && await supEdit(Object.assign({}, s))) renderSup(); break; }
    case 'supdel': { const s = supById(U.supSel); if (!s || !(await confirmDlg('Supprimer le fournisseur', `Retirer « ${esc(s.name)} » de la liste ? Les commandes déjà faites gardent ses coordonnées.`, 'Supprimer', true))) return;
      s.del = Date.now(); await supSave(s); U.supSel = null; renderSup(); break; }
  }
}
function lineOf(t){ const row = t.closest('[data-l]'); return row && U.cur ? U.cur.o.lines.find(x => x.id === row.dataset.l) : null; }
function onInput(e){
  const t = e.target, k = t.dataset.k, r = U.cur;
  if (k === 'supq') { U.supQ = t.value; U.els.list.querySelector('#bcSupList').innerHTML = supListHTML(); return; }
  if (!r || U.view !== 'edit') return;
  if (k === 'note' || k === 'by') { r.o[k] = t.value; if (k === 'by') pref('cmdBy', t.value); touch(r); return; }
  if (t.dataset.d) { r.o.dlv[t.dataset.d] = t.value; touch(r); return; }
  const f = t.dataset.f, l = lineOf(t);
  if (!f || !l) return;
  if (f === 'q') l.q = numIn(t.value);
  else if (f === 't') {
    l.t = t.value;
    const it = itemOf(t.value); /* article choisi dans les propositions → son unité */
    if (it && it.u && it.t === t.value.trim()) { l.u = it.u; const sel = t.closest('tr').querySelector('[data-f="u"]'); if (sel) { if (![...sel.options].some(x => x.value === it.u)) sel.insertAdjacentHTML('afterbegin', `<option>${esc(it.u)}</option>`); sel.value = it.u; } }
  }
  touch(r);
}
async function onChange(e){
  const t = e.target, k = t.dataset.k, r = U.cur;
  if (!r || U.view !== 'edit') return;
  if (k === 'st') { const o = r.o; o.st = t.value; if (o.st === 'e' && !o.sentAt) o.sentAt = Date.now(); touch(r); renderEdit(); return; }
  if (k === 'sup') {
    if (t.value === '__new') { const s = await newSupDlg(); if (s) setSup(r.o, s); }
    else setSup(r.o, supById(t.value));
    touch(r); U.els.list.querySelector('#bcSup').innerHTML = supBlock(); return;
  }
  if (t.dataset.d === 'unload') { r.o.dlv.unload = t.value; touch(r); return; }
  const f = t.dataset.f, l = lineOf(t);
  if (!l) return;
  if (f === 'u') { l.u = t.value; touch(r); }
  if (f === 't' || f === 'u') rememberItem(l.t, l.u);
}
/* Entrée : désignation → quantité → unité → nouvelle ligne */
function onKey(e){
  if (e.key !== 'Enter' || U.view !== 'edit') return;
  const t = e.target, f = t.dataset.f, l = lineOf(t); if (!f || !l) return;
  e.preventDefault();
  if (f === 't') focusLine(l.id, 'q');
  else if (f === 'q') focusLine(l.id, 'u');
  else if (f === 'u') { const o = U.cur.o, i = o.lines.indexOf(l); if (i < o.lines.length - 1) focusLine(o.lines[i + 1].id); else addLine(true); }
}

/* ---------- PDF de la commande (A4, sans prix) ---------- */
const winAnsi = s => String(s ?? '').replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•…€œŒ]/g, c => ({'→':'>', '≥':'>=', '≤':'<=', '×':'x', '⌀':'Ø', '\t':' ', '\n':' ', '\r':''})[c] || '?');
async function logoPng(src){
  return new Promise(res => { const im = new Image(); im.onload = () => { try { const k = Math.min(1, 500 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/png')); } catch (e) { res(null); } };
    im.onerror = () => res(null); im.src = src; });
}
async function makePdf(o){
  await loadScript(PDFLIB_URL);
  const {PDFDocument, StandardFonts, rgb} = root.PDFLib, s = site(o.siteId) || {label:''}, co = (H.comp && H.comp(o.siteId)) || {};
  const doc = await PDFDocument.create(); doc.setTitle(winAnsi('Commande ' + o.no)); doc.setCreator('BauGest');
  const F = await doc.embedFont(StandardFonts.Helvetica), FB = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, Hh = 841.89, M = 42, K = rgb(.07, .07, .07), G = rgb(.4, .42, .45), Y = rgb(.949, .761, .188), LN = rgb(.82, .82, .82);
  let logo = null; if (co.logo) try { const png = await logoPng(co.logo); if (png) logo = await doc.embedPng(png); } catch (e) {}
  const wrap = (txt, f, sz, w) => { const out = []; for (const para of winAnsi(String(txt || '').replace(/\r/g, '')).split('\n')) { let line = ''; for (const wd of para.split(/\s+/)) { const t = line ? line + ' ' + wd : wd; if (f.widthOfTextAtSize(t, sz) <= w || !line) line = t; else { out.push(line); line = wd; } } out.push(line); } return out; };
  const pages = []; let pg, y;
  const T = (t, x, yy, o2 = {}) => pg.drawText(winAnsi(t), {x, y:yy, size:o2.s || 10, font:o2.b ? FB : F, color:o2.c || K});
  const TR = (t, x, yy, o2 = {}) => { const f = o2.b ? FB : F, sz = o2.s || 10; T(t, x - f.widthOfTextAtSize(winAnsi(t), sz), yy, o2); };
  const newPage = () => { pg = doc.addPage([W, Hh]); pages.push(pg); y = Hh - M; };
  newPage();
  let hTop = 0;
  if (logo) { const h = 46, w = Math.min(170, logo.width * h / logo.height), h2 = w * logo.height / logo.width; pg.drawImage(logo, {x:M, y:y - h2, width:w, height:h2}); hTop = h2; }
  let ry = y - 9; for (const [t, b] of [[co.name, 1], [co.addr], [[co.tel, co.email].filter(Boolean).join(' · ')]]) if (t) { TR(t, W - M, ry, {s:b ? 11 : 9, b, c:b ? K : G}); ry -= b ? 14 : 12; }
  y = Math.min(y - hTop, ry) - 8;
  pg.drawRectangle({x:M, y, width:W - 2 * M, height:2.2, color:Y}); y -= 28;
  T('Commande de matériaux N° ' + o.no, M, y, {s:17, b:1}); y -= 16;
  T(`Chantier ${s.label}`, M, y, {s:10.5}); TR('Date : ' + new Date().toLocaleDateString('fr-CH'), W - M, y, {s:10.5}); y -= 16;
  /* cadres fournisseur / livraison (adresse du chantier + contremaître) */
  const sn = o.supSnap || {}, d = o.dlv, bw = (W - 2 * M - 14) / 2;
  const box1 = [sn.name || '—', ...(sn.addr ? wrap(sn.addr, F, 9.5, bw - 16) : []), [sn.contact, sn.tel].filter(Boolean).join(' · '), sn.mail || ''].filter(Boolean);
  const when = d.date ? (wdName(d.date).replace(/^./, c => c.toUpperCase()) + ' ' + chDate(d.date) + (d.time ? ' · ' + d.time : '')) : 'Date à convenir';
  const box2 = [when, ...(d.place ? wrap(d.place, F, 9.5, bw - 16) : ['Adresse : chantier ' + s.label]), d.fore || d.tel ? 'Contremaître : ' + [d.fore, d.tel].filter(Boolean).join(' · ') : '', d.unload ? 'Déchargement : ' + d.unload : ''].filter(Boolean);
  const bh = 26 + Math.max(box1.length, box2.length) * 12.5;
  [[box1, 'FOURNISSEUR', M], [box2, 'LIVRAISON SUR LE CHANTIER', M + bw + 14]].forEach(([ls, tt, x]) => {
    pg.drawRectangle({x, y:y - bh, width:bw, height:bh, borderColor:LN, borderWidth:.8});
    T(tt, x + 8, y - 13, {s:7.5, b:1, c:G}); ls.forEach((l, i) => T(l, x + 8, y - 27 - i * 12.5, {s:9.5, b:i === 0}));
  });
  y -= bh + 20;
  const lines = o.lines.filter(l => (l.t || '').trim() || l.q != null);
  const cN = M + 4, cD = M + 30, cQ = W - M - 70, cU = W - M - 62, dW = cQ - cD - 60;
  const headRow = () => { pg.drawRectangle({x:M, y:y - 5, width:W - 2 * M, height:17, color:Y}); T('N°', cN, y, {s:9, b:1}); T('Désignation', cD, y, {s:9, b:1}); TR('Quantité', cQ, y, {s:9, b:1}); T('Unité', cU, y, {s:9, b:1}); y -= 20; };
  headRow();
  lines.forEach((l, i) => {
    const ls = wrap(l.t || '', F, 9.5, dW), h = ls.length * 11.5 + 6;
    if (y - h < M + 40) { newPage(); headRow(); }
    T(String(i + 1), cN, y, {s:9, c:G}); ls.forEach((t, j) => T(t, cD, y - j * 11.5, {s:9.5})); TR(fmtQ(l.q), cQ, y, {s:9.5, b:1}); T(l.u || '', cU, y, {s:9.5});
    y -= h; pg.drawLine({start:{x:M, y:y + 6}, end:{x:W - M, y:y + 6}, thickness:.5, color:LN}); y -= 4;
  });
  const nlr = o.note ? wrap(o.note, F, 9.5, W - 2 * M - 70) : [];
  if (y - (nlr.length * 12 + 110) < M + 20) newPage();
  y -= 10;
  if (nlr.length) { T('Remarques :', M, y, {s:9.5, b:1}); nlr.forEach((t, i) => T(t, M + 66, y - i * 12, {s:9.5})); y -= nlr.length * 12 + 6; }
  T('Merci de confirmer la commande et le délai de livraison par retour de mail.', M, y, {s:9.5}); y -= 52;
  pg.drawLine({start:{x:M, y}, end:{x:M + bw, y}, thickness:.7, color:G}); pg.drawLine({start:{x:M + bw + 14, y}, end:{x:W - M, y}, thickness:.7, color:G});
  T('Commandé par' + (o.by ? ' : ' + o.by : ''), M, y - 11, {s:8.5, c:G}); T('Confirmation du fournisseur (date, signature)', M + bw + 14, y - 11, {s:8.5, c:G});
  /* pied de page (jamais « BauGest ») */
  const today = new Date().toLocaleDateString('fr-CH');
  pages.forEach((p, i) => { const t = winAnsi(`${o.no} · Établi le ${today} · page ${i + 1} / ${pages.length}`); p.drawText(t, {x:W - M - F.widthOfTextAtSize(t, 7.5), y:24, size:7.5, font:F, color:G}); });
  return new Blob([await doc.save()], {type:'application/pdf'});
}
async function makeAndSave(){
  const r = U.cur; if (!r) return;
  const o = r.o;
  if (!o.lines.some(l => (l.t || '').trim())) { toast('Ajoute au moins un article'); return; }
  if (!o.sup) { if (!(await confirmDlg('Pas de fournisseur', 'Créer le PDF sans fournisseur ?', 'Créer quand même'))) return; }
  for (const l of o.lines) rememberItem(l.t, l.u);
  let blob;
  try { toast('Préparation du PDF…', 1500); blob = await makePdf(o); } catch (e) { toast('PDF : ' + e.message, 5000); return; }
  if (!o.pdfAt) countItems(o);
  o.pdfAt = Date.now(); touch(r);
  const name = recName(o) + '.pdf';
  let saved = '';
  if (online()) {
    try {
      const s = site(o.siteId);
      const res = r.pdfId ? await upload(blob, {name}, r.pdfId).catch(e => { if (e.status === 404) return null; throw e; }) : null;
      const fin = res || await upload(blob, {name, parents:[await cmdDir(s)], mimeType:'application/pdf', description:`Commande de matériaux ${o.no}`, appProperties:{pc:'1', site:o.siteId, kind:'cmdpdf', uid:o.uid}});
      r.pdfId = fin.id; r.pdfName = recName(o); await DB.put(strip(r)); saved = 'Enregistré dans « ' + (s ? s.folder : '') + ' / Commandes ».';
      if (U.view === 'edit' && U.cur === r) renderEdit();
    } catch (e) { saved = 'Pas enregistré sur le Drive : ' + e.message; }
  } else saved = 'Hors ligne : PDF pas enregistré sur le Drive (refais « Créer le PDF » avec du réseau).';
  await pdfDlg(blob, name, saved);
}
async function openSavedPdf(){
  const r = U.cur; if (!r || !r.pdfId) return;
  try { const buf = await getBuf(r.pdfId); await pdfDlg(new Blob([buf], {type:'application/pdf'}), recName(r.o) + '.pdf', 'PDF enregistré sur le Drive.'); } catch (e) { toast('PDF : ' + e.message); }
}
async function pdfDlg(blob, name, saved){
  const r = U.cur, o = r.o, file = new File([blob], name, {type:'application/pdf'});
  const canShare = !!(navigator.canShare && navigator.canShare({files:[file]})), url = URL.createObjectURL(blob);
  const btns = [{label:'Fermer', value:null}];
  if (H.split) btns.push({label:'Ouvrir dans un onglet', value:'tab'});
  btns.push({label:'Télécharger', value:'dl'});
  if (canShare) btns.push({label:'Partager / Mail', value:'share'});
  if (o.st === 'b') btns.push({label:'Marquer « Envoyée »', value:'sent', pri:true});
  const v = await dlg({title:'PDF de la commande ' + o.no, width:H.split ? 900 : 520, buttons:btns,
    body:`<p class="bc-sm">${esc(saved)}</p>${H.split ? `<iframe src="${url}" title="Aperçu" style="width:100%;height:62vh;border:1px solid var(--line,#353a41);border-radius:6px;background:#fff"></iframe>` : `<p>${esc(name)}</p>`}
      ${o.supSnap && o.supSnap.mail ? `<p class="bc-sm bc-mut">Mail du fournisseur : <b>${esc(o.supSnap.mail)}</b></p>` : ''}`});
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  if (v === 'tab') window.open(URL.createObjectURL(blob), '_blank');
  else if (v === 'dl') download(blob, name);
  else if (v === 'share') { try { await navigator.share({files:[file], title:'Commande ' + o.no, text:`Commande de matériaux ${o.no}${o.dlv.date ? ' – livraison ' + chDate(o.dlv.date) : ''}`}); if (o.st === 'b' && await confirmDlg('Commande envoyée ?', 'Marquer la commande comme « Envoyée » ?', 'Oui')) markSent(); } catch (e) {} }
  else if (v === 'sent') markSent();
}
function markSent(){ const r = U.cur; if (!r) return; r.o.st = 'e'; r.o.sentAt = Date.now(); touch(r); render(); toast('Commande ' + r.o.no + ' marquée envoyée'); }

/* ---------- chargement / retour ---------- */
async function loadSite(){
  U.tok++; U.orders = [];
  render();
  if (U.siteId) await loadOrders();
}
function back(){
  if (!active()) return false;
  if (U.dlgs.length) { U.dlgs[U.dlgs.length - 1].close(); return true; }
  if (U.view !== 'list') { flush(); U.view = 'list'; U.cur = null; render(); return true; }
  return false;
}
const depth = () => active() ? (U.view !== 'list' ? 1 : 0) + U.dlgs.length : 0;
function leave(){ flush(); U.dlgs.slice().forEach(d => d.close()); }
async function deliveries(from, to){
  return (await DB.all()).map(r => r.o).filter(o => o && /[ecp]/.test(o.st) && o.dlv && o.dlv.date >= from && o.dlv.date <= to);
}

root.BGCmd = {init:h => { H = h; }, mount, back, depth, leave, isActive:active, deliveries, makePdf, _U:U, _MEM:MEM};
})(typeof window !== 'undefined' ? window : this);
