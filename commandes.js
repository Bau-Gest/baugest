/* =====================================================================
   BauGest — Commandes de matériaux par chantier + liste des fournisseurs (tous chantiers)
   Module partagé par la tablette (index.html, rubrique « Commandes » du bureau, comme Soumission) et le PC (pc.html, section « Commandes ») :
   BGCmd.init({...}) puis BGCmd.mount({head, info, list, scroll}, idChantier) ; l'affichage reprend les classes et couleurs de la page hôte.
   Positions proposées = soumission du chantier (« <Chantier>/Soumission » : « – positions.json », Word BauBit, .crbx lu par la tablette).
   Drive :
   - <Chantier>/Commandes/<N°> – <fournisseur>.json (appProperties kind='commande', uid, site, n) + même nom .pdf (kind='cmdpdf', uid)
   - <Chantier>/Commandes/Soumission – positions pour les commandes.json (kind='cmdsoum', src) : copie d'une soumission .crbx lue par la tablette, pour le PC
   - <Racine>/BauGest – fournisseurs (ne pas supprimer).json (kind='suppliers') : {v:1, list:[{id, name, addr, contact, tel, mail, tags, note, fav, m, del?}]}
   Commande : {v:1, uid, siteId, n, no, free (commande libre : soumission masquée), sup, supSnap, st, created, m, dlv:{date, time, place, contact, unload}, note, by,
     lines:[{id, can, p, t, q, u, sq}], ink:{n (nb de lignes), s:[{w, p:[[x, y]]}]} (écriture au stylet, largeur 1000, ligne = 100), sentAt, pdfAt}
   ===================================================================== */
(function (root) {
'use strict';

const PDFLIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
const DRV = 'https://www.googleapis.com/drive/v3/files', UPL = 'https://www.googleapis.com/upload/drive/v3/files';
const SUP_NAME = 'BauGest – fournisseurs (ne pas supprimer).json', SOUMC_NAME = 'Soumission – positions pour les commandes.json', DIR = 'Commandes';
const FOURN = /fourni|livr|mat[ée]ri|achat|approvision|stock/i;
const ST = {b:'Brouillon', e:'Envoyée', c:'Confirmée', p:'Livrée en partie', l:'Livrée', x:'Annulée'}, ST_ORDER = ['b', 'e', 'c', 'p', 'l', 'x'];
const UNLOAD = ['', 'Camion-grue', 'Hayon', 'Basculant', 'Chariot élévateur', 'À la main'];
const SRC = /\.(crbx|e1s|01s|docx)$/i, S451 = /\.(crbx|e1s|01s)$/i, POS = /^(.*?)\s+[–-]\s+positions\.json$/i;

const pad2 = n => String(n).padStart(2, '0');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const qEsc = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const clean = s => String(s || '').normalize('NFC').replace(/[\/\\:*?"<>|#%]+/g, '').replace(/\s+/g, ' ').trim();
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fmtQ = v => v == null || !isFinite(v) ? '' : String(Math.round(v * 1000) / 1000).replace(/\B(?=(\d{3})+(?!\d))/g, '’');
const numIn = s => { const v = parseFloat(String(s || '').replace(/['’\s]/g, '').replace(',', '.')); return isFinite(v) ? v : null; };
const isoToday = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const chDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1]}` : ''; };
const chShort = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : ''; };
const wdName = iso => { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('fr-CH', {weekday:'long'}); };
const posKey = l => (l.can || '') + '|' + (l.p || '');
const pref = (k, v) => { try { if (v === undefined) return localStorage.getItem('baugest.' + k) || ''; localStorage.setItem('baugest.' + k, v); } catch (e) { return ''; } };

let H = null;
const U = {siteId:undefined, els:null, showSoum:false, inkTool:'pen', inkUndo:[], view:'list', orders:[], cur:null, soum:null, soumInfo:'', soumBusy:false, q:'', mode:'f', rest:false, supQ:'', supSel:null, dlgs:[], saveT:0, tok:0, info:''};
const SUP = {list:[], fileId:null, loaded:false, dirty:false};

/* ---------- petits outils ---------- */
function toast(msg, ms = 3200){
  let box = document.querySelector('.bc-toasts'); if (!box) { box = document.createElement('div'); box.className = 'bc-toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'bc-toast'; t.textContent = msg;
  box.appendChild(t); while (box.children.length > 3) box.firstElementChild.remove(); setTimeout(() => t.remove(), ms);
}
function dlg({title, body = '', buttons = [{label:'OK', value:true, pri:true}], onOpen, width}){
  return new Promise(res => {
    const sc = document.createElement('div'); sc.className = 'bc-scrim';
    sc.innerHTML = `<div class="bc-dlg" role="dialog" aria-label="${esc(title)}" ${width ? `style="width:min(${width}px,100%)"` : ''}><h2>${esc(title)}</h2><div class="bc-db">${body}</div>`
      + `<div class="bc-df">${buttons.map((b, i) => `<button class="${(H && H.cls && H.cls.btn) || 'btn'}${b.pri ? ' primary' : ''}${b.dang ? ' danger bc-dang' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    document.body.appendChild(sc);
    const box = sc.firstElementChild;
    const done = v => { const k = U.dlgs.indexOf(entry); if (k >= 0) U.dlgs.splice(k, 1); sc.remove(); if (H.onNav) H.onNav(); res(v); };
    const fire = i => { const b = buttons[i]; if (b.check && !b.check(box)) return; done(b.value === undefined ? box : b.value); };
    const entry = {close:() => done(null)}; U.dlgs.push(entry); if (H.onNav) H.onNav();
    sc.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); } });
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

/* ---------- fournisseurs (liste commune à tous les chantiers) ---------- */
const supLive = () => SUP.list.filter(x => !x.del);
const supById = id => SUP.list.find(x => x.id === id) || null;
const supSorted = () => supLive().slice().sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || a.name.localeCompare(b.name, 'fr'));
const supTags = s => String(s.tags || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
function supMerge(a, b){
  const m = new Map(); for (const x of [...(a || []), ...(b || [])]) { if (!x || !x.id) continue; const o = m.get(x.id); if (!o || (x.m || 0) > (o.m || 0)) m.set(x.id, x); }
  return [...m.values()];
}
async function supLoad(){
  const loc = await DB.get('suppliers');
  if (loc && !SUP.loaded) { SUP.list = loc.list || []; SUP.fileId = loc.fileId || null; SUP.dirty = !!loc.dirty; }
  SUP.loaded = true;
  if (!online()) return;
  try {
    const fs = await listQ("trashed=false and appProperties has { key='kind' and value='suppliers' }", 'files(id,modifiedTime)');
    fs.sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
    if (fs[0]) {
      const j = await getJson(fs[0].id), rem = (j && j.list) || [], sig = l => l.map(x => x.id + ':' + (x.m || 0)).sort().join('|');
      SUP.fileId = fs[0].id; SUP.list = supMerge(rem, SUP.list); SUP.dirty = sig(SUP.list) !== sig(rem);
    }
    await DB.set('suppliers', {list:SUP.list, fileId:SUP.fileId, dirty:SUP.dirty});
    if (SUP.dirty) await supPush();
  } catch (e) { U.info = 'Fournisseurs : ' + e.message; }
}
async function supPush(){
  await DB.set('suppliers', {list:SUP.list, fileId:SUP.fileId, dirty:true});
  if (!online()) return;
  try {
    const blob = new Blob([JSON.stringify({v:1, updatedAt:new Date().toISOString(), list:SUP.list})], {type:'application/json'});
    if (SUP.fileId) await upload(blob, {}, SUP.fileId);
    else { const rootId = await H.ensureFolder([]); const r = await upload(blob, {name:SUP_NAME, parents:[rootId], mimeType:'application/json', appProperties:{pc:'1', site:'none', kind:'suppliers'}, description:'Liste des fournisseurs des commandes de matériaux (BauGest, tous chantiers)'}); SUP.fileId = r.id; }
    SUP.dirty = false; await DB.set('suppliers', {list:SUP.list, fileId:SUP.fileId, dirty:false});
  } catch (e) { toast('Fournisseurs gardés sur l’appareil : ' + e.message); }
}
function supSave(s){ s.m = Date.now(); const i = SUP.list.findIndex(x => x.id === s.id); if (i >= 0) SUP.list[i] = s; else SUP.list.push(s); SUP.dirty = true; return supPush(); }
/* fournisseurs proposés pour les lignes de la commande (mots-clés ↔ désignations) */
function supSuggest(o){
  const txt = fold(o.lines.map(l => l.t).join(' ')); if (!txt.trim()) return [];
  return supLive().map(s => ({s, k:supTags(s).filter(t => t.length > 2 && txt.includes(fold(t))).length})).filter(x => x.k).sort((a, b) => b.k - a.k || (b.s.fav ? 1 : 0) - (a.s.fav ? 1 : 0)).slice(0, 3).map(x => x.s);
}

/* ---------- commandes du chantier ---------- */
const recName = o => `${o.no} – ${clean(o.supSnap && o.supSnap.name) || 'sans fournisseur'}`;
async function loadOrders(){
  const sid = U.siteId, tok = ++U.tok, s = site(sid);
  let recs = (await DB.all()).filter(r => r.siteId === sid);
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
  return {v:1, uid:o.uid || uid(), siteId:o.siteId || U.siteId, n:+o.n || 1, no:o.no || '', sup:o.sup || null, supSnap:o.supSnap || null, st:ST[o.st] ? o.st : 'b',
    created:o.created || Date.now(), m:o.m || Date.now(), dlv:Object.assign({date:'', time:'', place:'', contact:'', unload:''}, o.dlv || {}), note:o.note || '', by:o.by || '',
    free:!!o.free, ink:{n:Math.max(3, +(o.ink && o.ink.n) || 3), s:((o.ink && o.ink.s) || []).filter(x => x && Array.isArray(x.p) && x.p.length)},
    lines:(o.lines || []).map(l => ({id:l.id || uid(), can:l.can || '', p:l.p || '', t:l.t || '', q:l.q == null ? null : +l.q, u:l.u || '', sq:l.sq == null ? null : +l.sq})),
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
    } catch (e) { U.info = 'Commande gardée sur l’appareil : ' + e.message; renderSoft(); }
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

/* quantités déjà commandées par position (commandes non annulées), sans la commande en cours si demandé */
function orderedMap(exceptUid){
  const m = new Map();
  for (const r of U.orders) { if (r.o.st === 'x' || r.uid === exceptUid) continue; for (const l of r.o.lines) if (l.p && l.q != null) m.set(posKey(l), (m.get(posKey(l)) || 0) + l.q); }
  return m;
}

/* ---------- soumission du chantier ---------- */
async function loadSoum(){
  const sid = U.siteId, s = site(sid), tok = U.tok;
  U.soum = null; U.soumInfo = ''; U.soumBusy = true;
  const c = await DB.get('soum:' + sid);
  if (c) U.soum = c.data;
  else if (H.soumCache) { try { U.soum = await H.soumCache(sid); } catch (e) {} }
  if (!online() || !s) { U.soumBusy = false; if (!U.soum) U.soumInfo = 'Soumission pas encore lue sur cet appareil (hors ligne).'; renderSoft(); return; }
  try {
    const dir = await H.ensureFolder([s.folder, 'Soumission']);
    const fs = await listQ(`'${qEsc(dir)}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`);
    const byNew = (a, b) => String(b.createdTime).localeCompare(String(a.createdTime));
    const base = n => String(n).replace(/\.[a-z0-9]{1,5}$/i, '').trim();
    const srcs = fs.filter(f => /\.(crbx|e1s|01s|docx?|pdf|xlsx?)$/i.test(f.name)).sort(byNew);
    let pick = null, parts = null, kind = '';
    for (const j of fs.filter(f => POS.test(f.name)).sort(byNew)) if (srcs.some(f => base(f.name) === POS.exec(j.name)[1].trim())) { pick = j; kind = 'json'; break; }
    if (!pick && root.BGSoum) for (const f of srcs) { const ps = root.BGSoum.partsOf(fs, f.name); if (ps) { parts = ps; pick = ps[0]; kind = 'json'; break; } }
    if (!pick) { pick = srcs.find(f => SRC.test(f.name)) || null; kind = pick ? (S451.test(pick.name) ? '451' : 'docx') : ''; }
    const mod = pick ? (parts ? parts.map(x => x.modifiedTime).join('|') : pick.modifiedTime) : '';
    let data = null;
    if (!pick) U.soumInfo = srcs.length ? 'Soumission pas encore lue : ouvre la rubrique Soumission (ou demande la lecture par Claude).' : 'Pas de soumission dans le dossier « Soumission » du chantier : lignes hors soumission seulement.';
    else if (c && c.id === pick.id && c.mod === mod) data = c.data;
    else if (kind === 'json') data = JSON.parse(parts ? (await Promise.all(parts.map(getBuf))).map(b => new TextDecoder().decode(b)).join('') : new TextDecoder().decode(await getBuf(pick.id)));
    else if (kind === 'docx') data = await root.BGSoum.parseDocx(await getBuf(pick.id), pick.name);
    else if (H.parse451) {
      data = await H.parse451(await getBuf(pick.id), pick.name);
      /* copie lisible par le PC (qui ne lit pas les .crbx) */
      try {
        const cd = await cmdDir(s), old = await listQ(`'${qEsc(cd)}' in parents and trashed=false and appProperties has { key='kind' and value='cmdsoum' }`, 'files(id)');
        const blob = new Blob([JSON.stringify(data)], {type:'application/json'});
        await upload(blob, old[0] ? {appProperties:{src:pick.id}} : {name:SOUMC_NAME, parents:[cd], mimeType:'application/json', description:`Positions de « ${pick.name} » pour les commandes de matériaux (BauGest)`, appProperties:{pc:'1', site:sid, kind:'cmdsoum', src:pick.id}}, old[0] && old[0].id);
      } catch (e) {}
    } else {
      const cp = await listQ(`trashed=false and appProperties has { key='kind' and value='cmdsoum' } and appProperties has { key='site' and value='${qEsc(sid)}' }`);
      const f = cp.find(x => x.appProperties.src === pick.id);
      if (f) data = await getJson(f.id);
      else U.soumInfo = `Soumission « ${pick.name} » (.crbx) : ouvre une fois les Commandes de ce chantier sur la tablette pour la rendre lisible ici.`;
    }
    if (tok !== U.tok) return;
    if (data) { U.soum = data; await DB.set('soum:' + sid, {id:pick.id, mod, name:pick.name, data}); }
    else if (pick && !U.soumInfo) U.soumInfo = 'Soumission illisible.';
  } catch (e) { if (tok === U.tok) U.soumInfo = 'Lecture de la soumission impossible : ' + e.message + (U.soum ? ' · version gardée sur l’appareil' : ''); }
  if (tok !== U.tok) return;
  U.soumBusy = false; renderSoft();
}
const soumPos = () => ((U.soum && U.soum.pos) || []).filter(p => !p.h);
const canTitle = can => { const c = ((U.soum && U.soum.cans) || []).find(x => x.can === can); return c ? c.titre || '' : ''; };

/* ---------- interface : affichée dans la page hôte (bureau tablette / section PC), classes et couleurs de l'hôte ---------- */
const ic = p => `<svg class="ic bc-ic" viewBox="0 0 24 24">${p}</svg>`;
const I = {x:ic('<path d="M18 6 6 18M6 6l12 12"/>'), plus:ic('<path d="M12 5v14M5 12h14"/>'), back:ic('<path d="M15 18l-6-6 6-6"/>'), del:ic('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
  pdf:ic('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6"/>'), ok:ic('<path d="m5 12 5 5 9-10"/>'), truck:ic('<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 1 0 0-.1M17 19a2 2 0 1 0 0-.1"/>'),
  pen:ic('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'), erase:ic('<path d="m7 21-4-4L14 6l7 7-8 8zM10 10l7 7M7 21h14"/>'), undo:ic('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  sup:ic('<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>'), list:ic('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>')};
const B = (label, attrs, kind = '') => `<button class="${(H.cls && H.cls.btn) || 'btn'}${kind === 'pri' ? ' primary' : kind === 'dang' ? ' danger bc-dang' : kind === 'on' ? ' on bc-on' : ''}" ${attrs}>${label}</button>`;
function css(){ return `
.bc-ic{width:19px;height:19px}
.bc-dang{color:var(--bad,#ef5f58)}
.bc-acts select{width:auto!important;max-width:230px;min-height:40px;background:var(--surface2,#262a30);border:1px solid var(--line,#353a41);color:var(--text,#ecebe6);border-radius:8px;padding:0 10px;font:15px var(--body,sans-serif)}
.bc-root{display:block}
.bc-root *{box-sizing:border-box}
.bc-cols{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:start}
.bc-cols.l{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)}
.bc-card{background:var(--surface,#1c1f23);border:1px solid var(--line,#353a41);border-radius:12px;padding:12px 14px;margin-bottom:14px}
.bc-card h3{margin:0 0 10px;font:700 18px/1.1 var(--display,sans-serif);letter-spacing:.03em;color:var(--muted,#9da2a8);text-transform:uppercase}
.bc-card h3 .bc-ic{vertical-align:-3px;margin-right:6px}
.bc-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
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
.bc-bar{height:6px;background:var(--surface2,#262a30);border-radius:3px;overflow:hidden;margin-top:4px;width:110px;margin-left:auto}
.bc-bar i{display:block;height:100%;background:var(--ok,#48c985)}
.bc-empty{padding:26px;text-align:center;color:var(--muted,#9da2a8)}
.bc-srch{display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center}
.bc-srch input[type=search]{flex:1;min-width:150px}
.bc-pill{border:1px solid var(--line,#353a41);border-radius:18px;padding:7px 13px;font:600 13.5px var(--body,sans-serif);color:var(--muted,#9da2a8);background:transparent;cursor:pointer}
.bc-pill.on{border-color:var(--signal,#f2c230);color:var(--text,#ecebe6);background:var(--signal-soft,#3b3219)}
.bc-can{font:700 15px var(--display,sans-serif);color:var(--text,#ecebe6);padding:12px 4px 4px;letter-spacing:.04em;text-transform:uppercase;border-bottom:2px solid var(--signal,#f2c230)}
.bc-pos{display:flex;gap:10px;align-items:flex-start;padding:9px 4px;border-bottom:1px solid var(--line,#353a41)}
.bc-pos .p{font-family:var(--mono,monospace);font-size:12.5px;color:var(--muted,#9da2a8);width:64px;flex:none;padding-top:2px}
.bc-pos .t{flex:1;min-width:0}
.bc-pos .q{text-align:right;font-size:13px;white-space:nowrap;padding-top:2px}
.bc-add{width:40px;height:40px;border-radius:10px;background:var(--signal,#f2c230);color:var(--signal-ink,#1b1600);border:0;display:grid;place-items:center;flex:none;cursor:pointer}
.bc-add.on{background:var(--surface2,#262a30);color:var(--ok,#48c985);border:1px solid var(--ok,#48c985)}
.bc-fld{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;min-width:0}
.bc-fld label{font-size:13px;color:var(--muted,#9da2a8)}
.bc-root input:not([type=checkbox]),.bc-root select,.bc-root textarea,.bc-dlg input:not([type=checkbox]),.bc-dlg select,.bc-dlg textarea{background:var(--surface2,#262a30);border:1px solid var(--line,#353a41);color:var(--text,#ecebe6);border-radius:8px;padding:9px 10px;font:15px var(--body,sans-serif);min-width:0;max-width:100%}
.bc-fld>input,.bc-fld>select,.bc-fld>textarea{width:100%}
.bc-row{display:flex;gap:10px}.bc-row>.bc-fld{flex:1}
.bc-lines input{width:100%;padding:7px 8px!important}
.bc-lines input.q{width:92px;text-align:right}
.bc-lines input.u{width:66px}
.bc-tag{display:inline-block;background:var(--surface2,#262a30);border-radius:5px;padding:1px 7px;font-size:12px;color:var(--muted,#9da2a8);margin:2px 3px 0 0}
.bc-sup{display:flex;gap:12px;align-items:center;padding:10px 6px;border-bottom:1px solid var(--line,#353a41);cursor:pointer}
.bc-sup.on{background:var(--signal-soft,#3b3219)}
.bc-av{width:42px;height:42px;border-radius:10px;background:var(--surface2,#262a30);display:grid;place-items:center;font:700 17px var(--display,sans-serif);flex:none}
.bc-hint{background:var(--signal-soft,#3b3219);border:1px dashed var(--signal,#f2c230);border-radius:8px;padding:8px 10px;font-size:13.5px;margin:0 0 12px}
.bc-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.bc-ink{position:relative;border:1px solid var(--line,#353a41);border-radius:8px;background:var(--surface2,#262a30);touch-action:pan-y;-webkit-user-select:none;user-select:none}
.bc-ink svg{display:block;width:100%;height:auto}
.bc-ink line{stroke:var(--line,#353a41);stroke-width:1.5}
.bc-ink path{fill:none;stroke:var(--text,#ecebe6);stroke-linecap:round;stroke-linejoin:round}
.bc-ink.er{cursor:cell}
.bc-inkbar .bc-on{background:var(--signal-soft,#3b3219);border-color:var(--signal,#f2c230);color:var(--text,#ecebe6)}
.bc-inkbar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center}
.bc-scrim{position:fixed;inset:0;z-index:90;background:#000a;display:flex;align-items:center;justify-content:center;padding:16px}
.bc-dlg{background:var(--surface,#1c1f23);color:var(--text,#ecebe6);border:1px solid var(--line,#353a41);border-radius:14px;width:min(520px,100%);max-height:92vh;display:flex;flex-direction:column;font:15px/1.4 var(--body,sans-serif)}
.bc-dlg h2{margin:0;padding:14px 16px 6px;font:700 22px var(--display,sans-serif);text-transform:uppercase;letter-spacing:.02em}
.bc-db{padding:6px 16px;overflow:auto}
.bc-df{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;flex-wrap:wrap}
.bc-choice{display:grid;gap:10px}
.bc-choice button{display:block;text-align:left;width:100%;padding:12px 14px;border-radius:12px;border:1px solid var(--line,#353a41);background:var(--surface2,#262a30);color:var(--text,#ecebe6);font:15px var(--body,sans-serif);cursor:pointer}
.bc-choice button b{display:block;font-size:16px;margin-bottom:2px}
.bc-choice button small{color:var(--muted,#9da2a8)}
.bc-toasts{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:95;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none}
.bc-toast{background:#000d;color:#fff;padding:9px 14px;border-radius:8px;font:14px var(--body,sans-serif);max-width:90vw}
@media (max-width:980px){.bc-cols,.bc-cols.l{grid-template-columns:minmax(0,1fr)}.bc-kpi{grid-template-columns:repeat(2,1fr)}}
`; }
const active = () => { try { return !!(U.els && (!H.active || H.active())); } catch (e) { return false; } };
function bindEls(els){
  for (const el of [els.head, els.list]) {
    if (!el || el.dataset.bcBound) continue;
    el.dataset.bcBound = '1';
    el.addEventListener('click', e => { if (active()) onClick(e); });
    el.addEventListener('input', e => { if (active()) onInput(e); });
    el.addEventListener('change', e => { if (active()) onChange(e); });
    el.addEventListener('pointerdown', e => { if (active()) inkDown(e); });
  }
}
function mount(els, siteId){
  if (!H) throw new Error('BGCmd.init() manquant');
  if (!document.getElementById('bcCss')) { const st = document.createElement('style'); st.id = 'bcCss'; st.textContent = css(); document.head.appendChild(st); }
  U.els = els; bindEls(els);
  if (!SUP.loaded) supLoad().then(() => { if (U.view !== 'list') render(); });
  const sid = siteId && site(siteId) ? siteId : null;
  if (sid !== U.siteId) { flush(); U.siteId = sid; U.view = 'list'; U.cur = null; U.info = ''; return loadSite(); }
  render();
}
function setInfo(){ const el = U.els.info; if (!el) return; const t = U.info; el.hidden = !t; el.textContent = t || ''; }
function renderSoft(){ if (!active()) return; if (U.view === 'edit') { refreshPos(); setInfo(); } else render(); }
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
  return s;
}
const stBadge = st => `<span class="bc-st ${st}">${ST[st]}</span>`;
const late = o => o.dlv.date && o.dlv.date < isoToday() && /[ecp]/.test(o.st);
/* part commandée des fournitures, par CAN (montants de la soumission si connus, sinon quantités) */
function coverage(){
  const om = orderedMap(), by = new Map();
  for (const p of soumPos()) {
    if (!FOURN.test(p.t) || !(p.q > 0)) continue;
    const w = p.m > 0 ? p.m : p.q, got = Math.min(1, (om.get(posKey(p)) || 0) / p.q);
    const c = by.get(p.can) || {can:p.can, w:0, g:0}; c.w += w; c.g += w * got; by.set(p.can, c);
  }
  const rows = [...by.values()].sort((a, b) => a.can.localeCompare(b.can)), W = rows.reduce((a, c) => a + c.w, 0), G = rows.reduce((a, c) => a + c.g, 0);
  return {rows, pct:W ? Math.round(G / W * 100) : null};
}
const objOf = o => o.lines.map(l => l.t).filter(Boolean).slice(0, 2).join(' · ').slice(0, 70) || (o.ink.s.length ? '✎ liste écrite au stylet' : '—');
function renderList(){
  const s = site(U.siteId);
  if (!s) { head('Commandes', 'Commandes de matériaux', B('Fournisseurs', 'data-ca="sups"')); U.els.list.innerHTML = '<p class="bc-empty">Choisis un chantier pour voir et faire ses commandes.</p>'; return; }
  head(s.name || s.label, (s.number || 'Chantier') + ' · Commandes', B(I.sup + '<span>Fournisseurs</span>', 'data-ca="sups"') + B(I.plus + '<span>Nouvelle commande</span>', 'data-ca="new"', 'pri'));
  const os = U.orders.map(r => r.o).sort((a, b) => b.n - a.n), t = isoToday(), in7 = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); })();
  const soon = os.filter(o => /[ecp]/.test(o.st) && o.dlv.date && o.dlv.date >= t && o.dlv.date <= in7).sort((a, b) => (a.dlv.date + a.dlv.time).localeCompare(b.dlv.date + b.dlv.time));
  const cv = coverage();
  const rows = os.map(o => `<tr data-co="${esc(o.uid)}"><td class="bc-mono" style="white-space:nowrap">${esc(o.no)}${o.free ? ' <span class="bc-tag">libre</span>' : ''}</td><td>${esc((o.supSnap && o.supSnap.name) || '—')}</td><td>${esc(objOf(o))}</td>
    <td class="${late(o) ? 'bc-warn' : ''}" style="white-space:nowrap">${o.dlv.date ? esc(chShort(o.dlv.date) + (o.dlv.time ? ' · ' + o.dlv.time : '')) + (late(o) ? ' ⚠' : '') : '<span class="bc-mut">—</span>'}</td><td>${stBadge(o.st)}</td><td class="bc-n">${o.lines.length + (o.ink.s.length ? ' + ✎' : '')}</td></tr>`).join('');
  U.els.list.innerHTML = `<div class="bc-root"><div class="bc-kpi"><div><b>${os.filter(o => o.st !== 'x').length}</b><span>commandes</span></div><div><b>${soon.length}</b><span>livraisons à venir (7 j)</span></div>
      <div><b class="${os.some(late) ? 'bc-warn' : ''}">${os.filter(late).length}</b><span>en retard de livraison</span></div><div><b>${cv.pct == null ? '–' : cv.pct + ' %'}</b><span>des fournitures de la soumission commandées</span></div></div>
    <div class="bc-cols l"><div><div class="bc-card"><h3>${I.list}Commandes</h3>${os.length ? `<table class="bc-t"><tr><th>N°</th><th>Fournisseur</th><th>Objet</th><th>Livraison</th><th>État</th><th class="bc-n">Lignes</th></tr>${rows}</table>` : '<p class="bc-empty">Aucune commande pour ce chantier. « Nouvelle commande » pour commencer.</p>'}</div></div>
    <div><div class="bc-card"><h3>Fournitures de la soumission</h3>${U.soumBusy && !U.soum ? '<div class="bc-mut bc-sm">Lecture de la soumission…</div>' : cv.rows.length
      ? `<div class="bc-sm bc-mut" style="margin-bottom:6px">Part commandée, par CAN</div><table class="bc-t">${cv.rows.map(c => { const p = Math.round(c.g / c.w * 100); return `<tr><td>${esc(c.can + ' ' + canTitle(c.can))}</td><td class="bc-n">${p} %<div class="bc-bar"><i style="width:${p}%"></i></div></td></tr>`; }).join('')}</table>`
      : `<div class="bc-mut bc-sm">${esc(U.soumInfo || 'Aucune position de fourniture reconnue dans la soumission.')}</div>`}</div>
    <div class="bc-card"><h3>${I.truck}Prochaines livraisons</h3>${soon.length ? soon.map(o => `<div class="bc-sm" style="padding:3px 0">${esc(wdName(o.dlv.date).slice(0, 2))} ${esc(chShort(o.dlv.date))}${o.dlv.time ? ' ' + esc(o.dlv.time) : ''} · <b>${esc((o.supSnap && o.supSnap.name) || '—')}</b> — ${esc(o.no)}</div>`).join('') : '<div class="bc-mut bc-sm">Rien dans les 7 prochains jours.</div>'}</div></div></div></div>`;
}

/* ---------- édition d'une commande ---------- */
function posRows(){
  const o = U.cur.o, om = orderedMap(o.uid), inO = new Map(o.lines.filter(l => l.p).map(l => [posKey(l), l]));
  const words = fold(U.q).split(/\s+/).filter(Boolean);
  let list = soumPos().filter(p => (U.mode === 'all' || FOURN.test(p.t)) && (!words.length || words.every(w => fold(p.can + '.' + p.p + ' ' + p.t + ' ' + p.u).includes(w))));
  if (U.rest) list = list.filter(p => !(p.q > 0) || (om.get(posKey(p)) || 0) < p.q);
  const n = list.length; list = list.slice(0, 300);
  let can = null, h = '';
  for (const p of list) {
    if (p.can !== can) { can = p.can; h += `<div class="bc-can">${esc(can)} · ${esc(canTitle(can))}</div>`; }
    const done = om.get(posKey(p)) || 0, on = inO.has(posKey(p)), rest = p.q > 0 ? Math.max(0, p.q - done) : null;
    h += `<div class="bc-pos"><span class="p">${esc(p.p)}</span><span class="t">${esc(p.t)}<br><span class="bc-sm bc-mut">Soumission ${p.q != null ? esc(fmtQ(p.q) + ' ' + p.u) : esc(p.u || '—')} · déjà commandé ${esc(fmtQ(done) || '0')}${done && p.q > 0 && done >= p.q ? ' ✓' : ''}</span></span>
      <span class="q">${rest != null ? esc(fmtQ(rest) + ' ' + p.u) + '<br><span class="bc-sm bc-mut">restant</span>' : ''}</span>
      <button class="bc-add ${on ? 'on' : ''}" data-cpos="${esc(posKey(p))}" title="${on ? 'Retirer de la commande' : 'Ajouter à la commande'}">${on ? I.ok : I.plus}</button></div>`;
  }
  if (!n) h = `<p class="bc-empty">${U.soum ? (U.mode === 'f' ? 'Aucune fourniture trouvée. Essaie « Tout ».' : 'Aucune position trouvée.') : esc(U.soumInfo || (U.soumBusy ? 'Lecture de la soumission…' : 'Pas de soumission.'))}</p>`;
  else if (n > 300) h += `<div class="bc-mut bc-sm" style="padding:8px">… ${n - 300} autres positions : précise la recherche.</div>`;
  return h;
}
function linesHTML(){
  const o = U.cur.o;
  if (!o.lines.length) return `<div class="bc-mut bc-sm">${o.free ? 'Tape tes lignes (+ Ligne) ou écris la liste au stylet ci-dessous.' : 'Aucune ligne. Touche + sur une position de la soumission, ou « + Ligne » pour écrire librement.'}</div>`;
  return `<table class="bc-t bc-lines"><tr><th>Pos.</th><th>Désignation</th><th class="bc-n">Qté</th><th>Un.</th><th></th></tr>${o.lines.map(l => `<tr data-l="${esc(l.id)}">
    <td class="bc-mono bc-mut" style="white-space:nowrap">${esc(l.p || '—')}</td><td><input data-f="t" value="${esc(l.t)}" placeholder="Désignation (texte libre)"></td>
    <td class="bc-n"><input class="q" data-f="q" inputmode="decimal" value="${esc(l.q == null ? '' : String(l.q))}"></td><td><input class="u" data-f="u" value="${esc(l.u)}" placeholder="pce"></td>
    <td>${B(I.x, 'data-ca="ldel" title="Retirer la ligne" aria-label="Retirer la ligne"')}</td></tr>`).join('')}</table>`;
}
function supBlock(){
  const o = U.cur.o, s = o.sup && supById(o.sup), sn = o.supSnap, sug = s ? [] : supSuggest(o);
  return `<div class="bc-fld"><label>Fournisseur (liste commune à tous les chantiers)</label><select data-k="sup"><option value="">— Choisir —</option>${supSorted().map(x => `<option value="${esc(x.id)}" ${x.id === o.sup ? 'selected' : ''}>${x.fav ? '★ ' : ''}${esc(x.name)}${x.addr ? ' – ' + esc(x.addr.split(',').pop().trim()) : ''}</option>`).join('')}
    ${o.sup && !s && sn ? `<option value="${esc(o.sup)}" selected>${esc(sn.name)} (supprimé de la liste)</option>` : ''}<option value="__new">+ Nouveau fournisseur…</option></select></div>
    ${sn ? `<div class="bc-sm bc-mut">${esc([sn.contact, sn.tel, sn.mail].filter(Boolean).join(' · ') || 'Contact à compléter dans la fiche du fournisseur')}</div>${s && supTags(s).length ? `<div class="bc-sm" style="margin-top:4px">Habituel pour : ${supTags(s).map(t => `<span class="bc-tag">${esc(t)}</span>`).join('')}</div>` : ''}${s && s.note ? `<div class="bc-sm bc-warn" style="margin-top:4px">${esc(s.note)}</div>` : ''}` : ''}
    ${sug.length ? `<div class="bc-sm" style="margin-top:6px">Proposé : ${sug.map(x => `<button class="bc-pill" data-csug="${esc(x.id)}">${x.fav ? '★ ' : ''}${esc(x.name)}</button>`).join(' ')}</div>` : ''}`;
}
/* ---------- écriture au stylet (liste libre) : traits en unités, largeur 1000, une ligne = 100 ---------- */
const INK_W = 1000, INK_LH = 100, INK_MAX = 40;
const inkPath = st => st.p.length === 1 ? `M${st.p[0][0]} ${st.p[0][1]}h.1` : 'M' + st.p.map(q => q[0] + ' ' + q[1]).join('L');
function inkSvg(){
  const k = U.cur.o.ink, h = k.n * INK_LH;
  let g = ''; for (let i = 1; i <= k.n; i++) g += `<line x1="20" y1="${i * INK_LH - 14}" x2="${INK_W - 20}" y2="${i * INK_LH - 14}"/>`;
  return `<svg viewBox="0 0 ${INK_W} ${h}" preserveAspectRatio="none" style="aspect-ratio:${INK_W}/${h}">${g}${k.s.map(st => `<path d="${inkPath(st)}" stroke-width="${st.w || 3.2}"/>`).join('')}<path class="bc-live" d="" stroke-width="3.2"/></svg>`;
}
function inkHTML(){
  return `<div class="bc-inkbar">${B(I.pen + '<span>Stylo</span>', 'data-ca="inkpen"', U.inkTool === 'pen' ? 'on' : '')}${B(I.erase + '<span>Gomme</span>', 'data-ca="inkerase"', U.inkTool === 'erase' ? 'on' : '')}${B(I.undo + '<span>Annuler</span>', 'data-ca="inkundo"')}${B(I.plus + '<span>Ligne</span>', 'data-ca="inkline"')}<span class="bc-grow" style="flex:1"></span>${B('Tout effacer', 'data-ca="inkclear"', 'dang')}</div>
    <div class="bc-ink ${U.inkTool === 'erase' ? 'er' : ''}" id="bcInk">${inkSvg()}</div>
    <div class="bc-sm bc-mut" style="margin-top:6px">Stylet ou souris : écrire · doigt : faire défiler. Imprimé tel quel dans le PDF.</div>`;
}
const refreshInk = () => { const el = U.els.list.querySelector('#bcInk'); if (el) { el.innerHTML = inkSvg(); el.classList.toggle('er', U.inkTool === 'erase'); }
  U.els.list.querySelectorAll('[data-ca="inkpen"],[data-ca="inkerase"]').forEach(b => { const on = (b.dataset.ca === 'inkpen') === (U.inkTool === 'pen'); b.classList.toggle('on', on); b.classList.toggle('bc-on', on); }); };
function inkPt(e, svg){ const r = svg.getBoundingClientRect(), k = U.cur.o.ink; return [Math.round((e.clientX - r.left) / r.width * INK_W * 10) / 10, Math.round((e.clientY - r.top) / r.height * k.n * INK_LH * 10) / 10]; }
function inkDown(e){
  const box = e.target.closest('#bcInk'); if (!box || !U.cur || e.pointerType === 'touch') return;
  const svg = box.querySelector('svg'), r = U.cur, k = r.o.ink; e.preventDefault();
  const before = JSON.stringify(k.s);
  try { box.setPointerCapture(e.pointerId); } catch (x) {}
  if (U.inkTool === 'erase') {
    const hit = pt => { const n0 = k.s.length; k.s = k.s.filter(st => !st.p.some(q => Math.hypot(q[0] - pt[0], q[1] - pt[1]) < 22)); return k.s.length !== n0; };
    let any = hit(inkPt(e, svg)); if (any) refreshInk();
    const mv = ev => { if (hit(inkPt(ev, box.querySelector('svg')))) { any = true; refreshInk(); } };
    const up = () => { box.removeEventListener('pointermove', mv); box.removeEventListener('pointerup', up); box.removeEventListener('pointercancel', up); if (any) { U.inkUndo.push(before); touch(r); } };
    box.addEventListener('pointermove', mv); box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
    return;
  }
  const st = {w:3.2, p:[inkPt(e, svg)]}, live = svg.querySelector('.bc-live');
  const mv = ev => { for (const c of (ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev])) { const q = inkPt(c, svg), l = st.p[st.p.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) >= 2) st.p.push(q); } live.setAttribute('d', inkPath(st)); };
  const up = () => {
    box.removeEventListener('pointermove', mv); box.removeEventListener('pointerup', up); box.removeEventListener('pointercancel', up);
    U.inkUndo.push(before); k.s.push(st);
    const maxY = Math.max(...st.p.map(q => q[1])); if (maxY > (k.n - 1) * INK_LH && k.n < INK_MAX) k.n++;   // on écrit sur la dernière ligne → une ligne de plus
    touch(r); refreshInk();
  };
  box.addEventListener('pointermove', mv); box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
}

function renderEdit(){
  const r = U.cur, o = r.o, ro = o.st !== 'b', s = site(U.siteId), showSoum = !o.free || U.showSoum;
  head('Commande ' + o.no, (s ? (s.number || 'Chantier') + ' · ' + (s.name || '') : '') + (o.free ? ' · commande libre' : ''),
    `<select data-k="st" title="État de la commande">${ST_ORDER.map(k => `<option value="${k}" ${k === o.st ? 'selected' : ''}>${ST[k]}</option>`).join('')}</select>`
    + B(I.del + '<span>Supprimer</span>', 'data-ca="odel"', 'dang') + (r.pdfId ? B('<span>PDF enregistré</span>', 'data-ca="pdfopen"') : '') + B(I.pdf + '<span>Créer le PDF</span>', 'data-ca="pdf"', 'pri'), 'Commandes');
  const d = o.dlv;
  const soumCard = `<div class="bc-card"><h3>Positions de la soumission</h3>
      <div class="bc-srch"><input type="search" data-k="q" placeholder="Chercher : tube, Ø, DN, béton, n° de position…" value="${esc(U.q)}">
        <button class="bc-pill ${U.mode === 'f' ? 'on' : ''}" data-cmode="f">Fournitures</button><button class="bc-pill ${U.mode === 'all' ? 'on' : ''}" data-cmode="all">Tout</button>
        <button class="bc-pill ${U.rest ? 'on' : ''}" data-ca="rest">Pas encore tout commandé</button>${o.free ? `<button class="bc-pill" data-ca="soumhide">Masquer</button>` : ''}</div>
      ${U.soumInfo && U.soum ? `<div class="bc-sm bc-warn">${esc(U.soumInfo)}</div>` : ''}
      <div id="bcPos">${posRows()}</div></div>`;
  const linesCard = `<div class="bc-card"><h3>Lignes (<span id="bcNl">${o.lines.length}</span>)</h3><div id="bcLines">${linesHTML()}</div>
      <div class="bc-acts" style="margin-top:10px">${B(I.plus + '<span>Ligne</span>', 'data-ca="lnew"')}${o.free && !U.showSoum ? B(I.list + '<span>Ajouter depuis la soumission</span>', 'data-ca="soumshow"') : ''}</div></div>`;
  const inkCard = `<div class="bc-card"><h3>${I.pen}Liste écrite au stylet</h3>${inkHTML()}</div>`;
  const right = `${ro ? `<div class="bc-hint">Commande ${esc(ST[o.st].toLowerCase())}${o.sentAt ? ' le ' + new Date(o.sentAt).toLocaleDateString('fr-CH') : ''} : une modification demande de refaire le PDF et de le renvoyer.</div>` : ''}
      <div class="bc-card"><h3>Fournisseur</h3><div id="bcSup">${supBlock()}</div></div>
      <div class="bc-card"><h3>${I.truck}Livraison</h3>
        <div class="bc-row"><div class="bc-fld"><label>Date</label><input type="date" data-d="date" value="${esc(d.date)}"></div><div class="bc-fld"><label>Heure</label><input type="time" data-d="time" value="${esc(d.time)}"></div></div>
        <div class="bc-fld"><label>Lieu de livraison</label><input data-d="place" value="${esc(d.place)}" placeholder="Adresse du chantier, accès…"></div>
        <div class="bc-row"><div class="bc-fld"><label>Contact sur place</label><input data-d="contact" value="${esc(d.contact)}" placeholder="Nom · téléphone"></div>
          <div class="bc-fld"><label>Déchargement</label><select data-d="unload">${UNLOAD.map(x => `<option value="${esc(x)}" ${x === d.unload ? 'selected' : ''}>${esc(x || '—')}</option>`).join('')}</select></div></div></div>
      <div class="bc-card"><h3>Remarques</h3><div class="bc-fld"><label>Imprimées sur le PDF</label><textarea rows="2" data-k="note">${esc(o.note)}</textarea></div>
        <div class="bc-fld"><label>Commandé par</label><input data-k="by" value="${esc(o.by)}" placeholder="Nom, fonction"></div></div>`;
  U.els.list.innerHTML = showSoum
    ? `<div class="bc-root bc-cols"><div>${soumCard}</div><div>${linesCard}${inkCard}${right}</div></div>`
    : `<div class="bc-root bc-cols"><div>${linesCard}${inkCard}</div><div>${right}</div></div>`;
}
const refreshPos = () => { const el = U.els && U.els.list.querySelector('#bcPos'); if (el) el.innerHTML = posRows(); };
const refreshLines = () => { const L = U.els.list, el = L.querySelector('#bcLines'); if (el) el.innerHTML = linesHTML(); const n = L.querySelector('#bcNl'); if (n) n.textContent = U.cur.o.lines.length; const s = L.querySelector('#bcSup'); if (s && !U.cur.o.sup) s.innerHTML = supBlock(); };
function setSup(o, s){ o.sup = s ? s.id : null; o.supSnap = s ? {name:s.name, addr:s.addr || '', contact:s.contact || '', tel:s.tel || '', mail:s.mail || ''} : null; }

async function newOrder(){
  const s = site(U.siteId); if (!s) return;
  const hasSoum = soumPos().length > 0;
  const kind = await dlg({title:'Nouvelle commande', width:520, buttons:[{label:'Annuler', value:null}], body:`<div class="bc-choice">
    <button data-k="soum" ${hasSoum ? '' : 'disabled style="opacity:.5"'}><b>Depuis la soumission</b><small>${hasSoum ? 'Choisir les positions (fournitures) de la soumission du chantier ; lignes libres possibles en plus.' : esc(U.soumInfo || 'Pas de soumission lue pour ce chantier.')}</small></button>
    <button data-k="free"><b>Commande libre</b><small>Sans la soumission : lignes tapées (clavier ou dictée) et / ou liste écrite au stylet.</small></button></div>`,
    onOpen:(box, done) => box.querySelectorAll('.bc-choice button').forEach(b => b.addEventListener('click', () => { if (!b.disabled) done(b.dataset.k); }))});
  if (!kind) return;
  const n = U.orders.reduce((a, r) => Math.max(a, r.o.n || 0), 0) + 1, last = U.orders.map(r => r.o).sort((a, b) => b.created - a.created)[0];
  const o = norm({siteId:U.siteId, n, no:`CMD-${clean(s.number) || 'CH'}-${pad2(n)}`, by:pref('cmdBy'), free:kind === 'free',
    dlv:{date:'', time:'07:00', place:last ? last.dlv.place : (s.addr || ''), contact:last ? last.dlv.contact : '', unload:''}});
  if (o.free) o.lines.push({id:uid(), can:'', p:'', t:'', q:null, u:'', sq:null});
  const rec = {uid:o.uid, siteId:U.siteId, o, driveId:null, dirty:true};
  U.orders.push(rec); await DB.put(rec);
  openOrder(rec);
}
function openOrder(rec){ U.cur = rec; U.view = 'edit'; U.q = ''; U.showSoum = false; U.inkUndo = []; U.inkTool = 'pen'; render(); if (U.els.scroll) U.els.scroll.scrollTop = 0; }
async function delOrder(){
  const r = U.cur; if (!r) return;
  if (!(await confirmDlg('Supprimer la commande', `Supprimer la commande ${esc(r.o.no)} et son PDF ? (corbeille du Drive, récupérable 30 jours)`, 'Supprimer', true))) return;
  clearTimeout(U.saveT);
  try { for (const id of [r.driveId, r.pdfId]) if (id && online()) await trash(id); } catch (e) { toast('Drive : ' + e.message); }
  await DB.del(r.uid); U.orders = U.orders.filter(x => x !== r); U.cur = null; U.view = 'list'; render();
}
const newSupDlg = pre => supEdit(Object.assign({id:uid(), name:'', addr:'', contact:'', tel:'', mail:'', tags:'', note:'', fav:false}, pre || {}), true);
function supForm(s){
  return `<div class="bc-fld"><label>Nom</label><input id="bsName" value="${esc(s.name)}" autofocus></div>
    <div class="bc-fld"><label>Adresse</label><input id="bsAddr" value="${esc(s.addr)}" placeholder="Rue, NPA Localité"></div>
    <div class="bc-row"><div class="bc-fld"><label>Contact</label><input id="bsCont" value="${esc(s.contact)}"></div><div class="bc-fld"><label>Téléphone</label><input id="bsTel" type="tel" value="${esc(s.tel)}"></div></div>
    <div class="bc-fld"><label>Mail des commandes</label><input id="bsMail" type="email" value="${esc(s.mail)}"></div>
    <div class="bc-fld"><label>Matériaux (mots-clés séparés par des virgules → fournisseur proposé automatiquement)</label><input id="bsTags" value="${esc(s.tags)}" placeholder="tube, PP, armature, grave…"></div>
    <div class="bc-fld"><label>Note</label><input id="bsNote" value="${esc(s.note)}" placeholder="Délai, heure limite de commande…"></div>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="bsFav" ${s.fav ? 'checked' : ''}> Favori (proposé en premier)</label>`;
}
async function supEdit(s, isNew){
  const box = await dlg({title:isNew ? 'Nouveau fournisseur' : 'Fournisseur', width:560, body:`<div class="bc-root">${supForm(s)}</div>`, buttons:[{label:'Annuler', value:null}, {label:'Enregistrer', pri:true, check:b => { const ok = !!b.querySelector('#bsName').value.trim(); if (!ok) toast('Nom du fournisseur manquant'); return ok; }}]});
  if (!box) return null;
  const v = id => box.querySelector(id).value.trim();
  const n = Object.assign({}, s, {name:v('#bsName'), addr:v('#bsAddr'), contact:v('#bsCont'), tel:v('#bsTel'), mail:v('#bsMail'), tags:v('#bsTags'), note:v('#bsNote'), fav:box.querySelector('#bsFav').checked});
  await supSave(n);
  for (const r of U.orders) if (r.o.sup === n.id && r.o.st === 'b') { setSup(r.o, n); touch(r); }
  return n;
}

/* ---------- fournisseurs (écran) ---------- */
function renderSup(){
  head('Fournisseurs', 'Tous les chantiers', B(I.plus + '<span>Fournisseur</span>', 'data-ca="supnew"', 'pri'), 'Commandes');
  const words = fold(U.supQ).split(/\s+/).filter(Boolean), list = supSorted().filter(s => !words.length || words.every(w => fold([s.name, s.addr, s.contact, s.tags].join(' ')).includes(w)));
  const sel = U.supSel && supById(U.supSel), hist = sel ? histOf(sel.id) : [];
  U.els.list.innerHTML = `<div class="bc-root bc-cols"><div>
      <div class="bc-srch"><input type="search" data-k="supq" placeholder="Chercher un fournisseur ou un matériau…" value="${esc(U.supQ)}"></div>
      <div class="bc-card" style="padding:0 6px" id="bcSupList">${supListHTML(list)}</div></div>
    <div>${sel ? `<div class="bc-card"><h3>${esc(sel.name)}</h3>
      <div class="bc-sm">${esc(sel.addr || '')}</div><div class="bc-sm">${esc([sel.contact, sel.tel].filter(Boolean).join(' · '))}</div><div class="bc-sm">${esc(sel.mail || '')}</div>
      ${sel.note ? `<div class="bc-sm bc-warn" style="margin-top:6px">${esc(sel.note)}</div>` : ''}<div style="margin-top:6px">${supTags(sel).map(t => `<span class="bc-tag">${esc(t)}</span>`).join('')}</div>
      <div class="bc-acts" style="margin-top:12px">${B('<span>Modifier</span>', 'data-ca="supedit"')}${B(I.del + '<span>Supprimer</span>', 'data-ca="supdel"', 'dang')}</div></div>
      <div class="bc-card"><h3>Commandes de ce chantier</h3>${hist.length ? hist.map(o => `<div class="bc-sm" style="padding:3px 0"><span class="bc-mono">${esc(o.no)}</span> · ${stBadge(o.st)} ${o.dlv.date ? '· livraison ' + esc(chShort(o.dlv.date)) : ''}</div>`).join('') : '<div class="bc-sm bc-mut">Aucune commande à ce fournisseur sur ce chantier.</div>'}</div>`
      : '<p class="bc-empty">Choisis un fournisseur dans la liste.</p>'}</div></div>`;
}
function supListHTML(list){
  return list.length ? list.map(s => `<div class="bc-sup ${s.id === U.supSel ? 'on' : ''}" data-csup="${esc(s.id)}"><div class="bc-av">${esc(s.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</div>
    <div style="flex:1;min-width:0"><b>${esc(s.name)}</b>${s.fav ? ' ★' : ''}<br><span class="bc-sm bc-mut">${esc([s.addr, s.contact, s.tel].filter(Boolean).join(' · '))}</span><br>${supTags(s).map(t => `<span class="bc-tag">${esc(t)}</span>`).join('')}</div></div>`).join('')
    : `<p class="bc-empty">${supLive().length ? 'Aucun fournisseur trouvé.' : 'Aucun fournisseur. Ajoute-les ici ou directement depuis une commande.'}</p>`;
}
const histOf = id => U.orders.map(r => r.o).filter(o => o.sup === id).sort((a, b) => b.n - a.n);

/* ---------- événements (délégués sur la tête et la liste de l'hôte) ---------- */
async function onClick(e){
  const b = e.target.closest('[data-ca],[data-co],[data-cpos],[data-cmode],[data-csug],[data-csup]'); if (!b) return;
  const a = b.dataset.ca, r = U.cur, o = r && r.o, L = U.els.list;
  if (b.dataset.co) { const rec = U.orders.find(x => x.uid === b.dataset.co); if (rec) openOrder(rec); return; }
  if (b.dataset.csup) { U.supSel = b.dataset.csup; renderSup(); return; }
  if (b.dataset.cmode) { U.mode = b.dataset.cmode; L.querySelectorAll('[data-cmode]').forEach(x => x.classList.toggle('on', x.dataset.cmode === U.mode)); refreshPos(); return; }
  if (b.dataset.csug) { const s = supById(b.dataset.csug); if (s) { setSup(o, s); touch(r); L.querySelector('#bcSup').innerHTML = supBlock(); } return; }
  if (b.dataset.cpos) {
    const k = b.dataset.cpos, i = o.lines.findIndex(l => l.p && posKey(l) === k);
    if (i >= 0) o.lines.splice(i, 1);
    else { const p = soumPos().find(x => posKey(x) === k); if (!p) return; const done = orderedMap(o.uid).get(k) || 0;
      o.lines = o.lines.filter(l => l.p || l.t || l.q != null);   // ligne libre vide de départ retirée
      o.lines.push({id:uid(), can:p.can, p:p.p, t:p.t, u:p.u || '', sq:p.q == null ? null : p.q, q:p.q > 0 ? Math.max(0, Math.round((p.q - done) * 1000) / 1000) : (p.q == null ? 1 : p.q)}); }
    touch(r); refreshPos(); refreshLines(); return;
  }
  switch (a) {
    case 'list': await flush(); U.view = 'list'; U.cur = null; render(); break;
    case 'new': newOrder(); break;
    case 'sups': U.view = 'sup'; render(); break;
    case 'rest': U.rest = !U.rest; b.classList.toggle('on', U.rest); refreshPos(); break;
    case 'soumshow': U.showSoum = true; renderEdit(); break;
    case 'soumhide': U.showSoum = false; renderEdit(); break;
    case 'lnew': o.lines.push({id:uid(), can:'', p:'', t:'', q:null, u:'', sq:null}); touch(r); refreshLines(); { const ins = L.querySelector('#bcLines tr:last-child input[data-f="t"]'); if (ins) ins.focus(); } break;
    case 'ldel': { const id = b.closest('[data-l]').dataset.l; o.lines = o.lines.filter(l => l.id !== id); touch(r); refreshLines(); refreshPos(); break; }
    case 'inkpen': U.inkTool = 'pen'; refreshInk(); break;
    case 'inkerase': U.inkTool = 'erase'; refreshInk(); break;
    case 'inkundo': if (U.inkUndo.length) { o.ink.s = JSON.parse(U.inkUndo.pop()); touch(r); refreshInk(); } break;
    case 'inkline': if (o.ink.n < INK_MAX) { o.ink.n++; touch(r); refreshInk(); } break;
    case 'inkclear': if (o.ink.s.length && await confirmDlg('Tout effacer', 'Effacer toute la liste écrite au stylet ?', 'Effacer', true)) { U.inkUndo.push(JSON.stringify(o.ink.s)); o.ink.s = []; o.ink.n = 3; touch(r); refreshInk(); } break;
    case 'odel': delOrder(); break;
    case 'pdf': makeAndSave(); break;
    case 'pdfopen': openSavedPdf(); break;
    case 'supnew': { const s = await newSupDlg(); if (s) { U.supSel = s.id; renderSup(); } break; }
    case 'supedit': { const s = supById(U.supSel); if (s && await supEdit(Object.assign({}, s))) renderSup(); break; }
    case 'supdel': { const s = supById(U.supSel); if (!s || !(await confirmDlg('Supprimer le fournisseur', `Retirer « ${esc(s.name)} » de la liste ? Les commandes déjà faites gardent ses coordonnées.`, 'Supprimer', true))) return;
      s.del = Date.now(); await supSave(s); U.supSel = null; renderSup(); break; }
  }
}
function onInput(e){
  const t = e.target, k = t.dataset.k, r = U.cur;
  if (k === 'q') { U.q = t.value; refreshPos(); return; }
  if (k === 'supq') { U.supQ = t.value; const words = fold(U.supQ).split(/\s+/).filter(Boolean); U.els.list.querySelector('#bcSupList').innerHTML = supListHTML(supSorted().filter(s => !words.length || words.every(w => fold([s.name, s.addr, s.contact, s.tags].join(' ')).includes(w)))); return; }
  if (!r || U.view !== 'edit') return;
  if (k === 'note' || k === 'by') { r.o[k] = t.value; if (k === 'by') pref('cmdBy', t.value); touch(r); return; }
  if (t.dataset.d) { r.o.dlv[t.dataset.d] = t.value; touch(r); return; }
  const f = t.dataset.f, row = t.closest('[data-l]');
  if (f && row) { const l = r.o.lines.find(x => x.id === row.dataset.l); if (!l) return; if (f === 'q') l.q = numIn(t.value); else l[f] = t.value; touch(r); if (f === 'q') refreshPosLater(); }
}
let posT = 0; const refreshPosLater = () => { clearTimeout(posT); posT = setTimeout(refreshPos, 600); };
async function onChange(e){
  const t = e.target, k = t.dataset.k, r = U.cur;
  if (!r || U.view !== 'edit') return;
  if (k === 'st') { const o = r.o; o.st = t.value; if (o.st === 'e' && !o.sentAt) o.sentAt = Date.now(); touch(r); renderEdit(); return; }
  if (k === 'sup') {
    if (t.value === '__new') { const s = await newSupDlg(); if (s) setSup(r.o, s); }
    else setSup(r.o, supById(t.value));
    touch(r); U.els.list.querySelector('#bcSup').innerHTML = supBlock(); return;
  }
  if (t.dataset.d === 'unload') { r.o.dlv.unload = t.value; touch(r); }
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
  const {PDFDocument, StandardFonts, rgb, LineCapStyle} = root.PDFLib, s = site(o.siteId) || {label:''}, co = (H.comp && H.comp(o.siteId)) || {};
  const doc = await PDFDocument.create(); doc.setTitle(winAnsi('Commande ' + o.no)); doc.setCreator('BauGest');
  const F = await doc.embedFont(StandardFonts.Helvetica), FB = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, Hh = 841.89, M = 42, K = rgb(.07, .07, .07), G = rgb(.4, .42, .45), Y = rgb(.949, .761, .188), LN = rgb(.82, .82, .82), INK = rgb(.11, .15, .2);
  let logo = null; if (co.logo) try { const png = await logoPng(co.logo); if (png) logo = await doc.embedPng(png); } catch (e) {}
  const wrap = (txt, f, sz, w) => { const out = []; for (const para of winAnsi(String(txt || '').replace(/\r/g, '')).split('\n')) { let line = ''; for (const wd of para.split(/\s+/)) { const t = line ? line + ' ' + wd : wd; if (f.widthOfTextAtSize(t, sz) <= w || !line) line = t; else { out.push(line); line = wd; } } out.push(line); } return out; };
  const pages = []; let pg, y;
  const T = (t, x, yy, o2 = {}) => pg.drawText(winAnsi(t), {x, y:yy, size:o2.s || 10, font:o2.b ? FB : F, color:o2.c || K});
  const TR = (t, x, yy, o2 = {}) => { const f = o2.b ? FB : F, sz = o2.s || 10; T(t, x - f.widthOfTextAtSize(winAnsi(t), sz), yy, o2); };
  const newPage = () => { pg = doc.addPage([W, Hh]); pages.push(pg); y = Hh - M; };
  newPage();
  /* en-tête : logo à gauche, entreprise à droite */
  let hTop = 0;
  if (logo) { const h = 46, w = Math.min(170, logo.width * h / logo.height), h2 = w * logo.height / logo.width; pg.drawImage(logo, {x:M, y:y - h2, width:w, height:h2}); hTop = h2; }
  let ry = y - 9; for (const [t, b] of [[co.name, 1], [co.addr], [[co.tel, co.email].filter(Boolean).join(' · ')]]) if (t) { TR(t, W - M, ry, {s:b ? 11 : 9, b, c:b ? K : G}); ry -= b ? 14 : 12; }
  y = Math.min(y - hTop, ry) - 8;
  pg.drawRectangle({x:M, y, width:W - 2 * M, height:2.2, color:Y}); y -= 28;
  T('Commande de matériaux N° ' + o.no, M, y, {s:17, b:1}); y -= 16;
  T(`Chantier ${s.label}`, M, y, {s:10.5}); TR('Date : ' + new Date().toLocaleDateString('fr-CH'), W - M, y, {s:10.5}); y -= 16;
  /* cadres fournisseur / livraison */
  const sn = o.supSnap || {}, d = o.dlv, bw = (W - 2 * M - 14) / 2;
  const box1 = [sn.name || '—', ...(sn.addr ? wrap(sn.addr, F, 9.5, bw - 16) : []), [sn.contact, sn.tel].filter(Boolean).join(' · '), sn.mail || ''].filter(Boolean);
  const when = d.date ? (wdName(d.date).replace(/^./, c => c.toUpperCase()) + ' ' + chDate(d.date) + (d.time ? ' · ' + d.time : '')) : 'Date à convenir';
  const box2 = [when, ...(d.place ? wrap(d.place, F, 9.5, bw - 16) : []), d.contact ? 'Contact : ' + d.contact : '', d.unload ? 'Déchargement : ' + d.unload : ''].filter(Boolean);
  const bh = 26 + Math.max(box1.length, box2.length) * 12.5;
  [[box1, 'FOURNISSEUR', M], [box2, 'LIVRAISON', M + bw + 14]].forEach(([ls, tt, x]) => {
    pg.drawRectangle({x, y:y - bh, width:bw, height:bh, borderColor:LN, borderWidth:.8});
    T(tt, x + 8, y - 13, {s:7.5, b:1, c:G}); ls.forEach((l, i) => T(l, x + 8, y - 27 - i * 12.5, {s:9.5, b:i === 0}));
  });
  y -= bh + 20;
  /* tableau des lignes tapées */
  const lines = o.lines.filter(l => (l.t || '').trim() || l.q != null);
  if (lines.length) {
    const cP = M, cD = M + 62, cQ = W - M - 58, cU = W - M - 50, dW = cQ - cD - 60;
    const headRow = () => { pg.drawRectangle({x:M, y:y - 5, width:W - 2 * M, height:17, color:Y}); T('Pos.', cP + 4, y, {s:9, b:1}); T('Désignation', cD, y, {s:9, b:1}); TR('Quantité', cQ, y, {s:9, b:1}); T('Unité', cU, y, {s:9, b:1}); y -= 20; };
    headRow();
    for (const l of lines) {
      const ls = wrap(l.t || '', F, 9.5, dW), h = ls.length * 11.5 + 6;
      if (y - h < M + 40) { newPage(); headRow(); }
      T(l.p || '—', cP + 4, y, {s:9, c:G}); ls.forEach((t, i) => T(t, cD, y - i * 11.5, {s:9.5})); TR(fmtQ(l.q), cQ, y, {s:9.5, b:1}); T(l.u || '', cU, y, {s:9.5});
      y -= h; pg.drawLine({start:{x:M, y:y + 6}, end:{x:W - M, y:y + 6}, thickness:.5, color:LN}); y -= 4;
    }
    y -= 6;
  }
  /* liste écrite au stylet : imprimée telle quelle (traits vectoriels) */
  const st = o.ink.s;
  if (st.length) {
    const maxY = Math.max(...st.flatMap(x => x.p.map(q => q[1]))), nl = Math.min(o.ink.n, Math.ceil((maxY + 10) / INK_LH)), hU = nl * INK_LH;
    let k = (W - 2 * M) / INK_W; const avail = Hh - 2 * M - 40;
    if (hU * k > avail) k = avail / hU;
    if (y - 16 - hU * k < M + 30) newPage();
    T(lines.length ? 'Liste manuscrite :' : 'Liste du matériel :', M, y, {s:9.5, b:1}); y -= 8;
    const top = y, wPt = INK_W * k;
    pg.drawRectangle({x:M, y:top - hU * k, width:wPt, height:hU * k, borderColor:LN, borderWidth:.6});
    for (let i = 1; i < nl; i++) pg.drawLine({start:{x:M + 4, y:top - (i * INK_LH - 14) * k}, end:{x:M + wPt - 4, y:top - (i * INK_LH - 14) * k}, thickness:.3, color:LN});
    for (const x of st) pg.drawSvgPath(inkPath(x), {x:M, y:top, scale:k, borderColor:INK, borderWidth:(x.w || 3.2), borderLineCap:LineCapStyle ? LineCapStyle.Round : undefined});
    y = top - hU * k - 14;
  }
  /* remarques + signatures */
  const nlr = o.note ? wrap(o.note, F, 9.5, W - 2 * M - 70) : [];
  if (y - (nlr.length * 12 + 110) < M + 20) newPage();
  y -= 6;
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
  if (!o.lines.some(l => (l.t || '').trim() || l.q != null) && !o.ink.s.length) { toast('Ajoute au moins une ligne ou écris la liste au stylet'); return; }
  if (!o.sup) { if (!(await confirmDlg('Pas de fournisseur', 'Créer le PDF sans fournisseur ?', 'Créer quand même'))) return; }
  let blob;
  try { toast('Préparation du PDF…', 1500); blob = await makePdf(o); } catch (e) { toast('PDF : ' + e.message, 5000); return; }
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
  U.tok++; U.orders = []; U.soum = null; U.soumInfo = '';
  render();
  if (!U.siteId) return;
  await Promise.all([loadOrders(), loadSoum()]);
}
/* retour Android / Échap : fenêtre ouverte → la ferme ; commande ou fournisseurs → liste des commandes */
function back(){
  if (!active()) return false;
  if (U.dlgs.length) { U.dlgs[U.dlgs.length - 1].close(); return true; }
  if (U.view !== 'list') { flush(); U.view = 'list'; U.cur = null; render(); return true; }
  return false;
}
const depth = () => active() ? (U.view !== 'list' ? 1 : 0) + U.dlgs.length : 0;
/* l'hôte quitte la rubrique : enregistrer */
function leave(){ flush(); U.dlgs.slice().forEach(d => d.close()); }
/* livraisons prévues (accueil) : commandes gardées sur l'appareil */
async function deliveries(from, to){
  return (await DB.all()).map(r => r.o).filter(o => o && /[ecp]/.test(o.st) && o.dlv && o.dlv.date >= from && o.dlv.date <= to);
}

root.BGCmd = {init:h => { H = h; }, mount, back, depth, leave, isActive:active, deliveries, makePdf, _U:U, _SUP:SUP};
})(typeof window !== 'undefined' ? window : this);
