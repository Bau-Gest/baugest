/* BauGest — soumission rentrée : lecture des Word BauBit dans l'app + demandes de lecture à la tâche « Soumission BauGest ».
   Module partagé tablette (rubrique Soumission) + PC (clic droit sur le fichier dans le dossier « Soumission »).
   - parseDocx(buf, nom) : même logique que tools/soumission/soumission.py (parse_docx) → JSON des positions (format lu par la rubrique Soumission).
   - PDF / .doc / Excel (ou Word non lisible) : l'app dépose « <nom> – demande de lecture.json » à côté du fichier ; la tâche (vendredi 18:30)
     écrit « <nom> – positions.json » (ou « <nom> – positions (1-3).json », « (2-3) »… si le JSON est gros, à recoller dans l'ordre) puis met la demande à la corbeille. */
(function(){
'use strict';
const SRC = /\.(crbx|e1s|01s|docx?|pdf|xlsx?)$/i, TASKABLE = /\.(docx?|pdf|xlsx?)$/i;
const POS = /^(.*?)\s+[–-]\s+positions\.json$/i, PART = /^(.*?)\s+[–-]\s+positions \((\d+)-(\d+)\)\.json$/i, REQ = /^(.*?)\s+[–-]\s+demande de lecture\.json$/i;
const base = n => String(n).replace(/\.[a-z0-9]{1,5}$/i, '').trim();
const posName = n => base(n) + ' – positions.json', reqName = n => base(n) + ' – demande de lecture.json';
const CAN_TITRES = {'102':'Mesures environnementales', '111':'Travaux en régie', '112':'Essais', '113':'Installations de chantier', '116':'Coupes de bois et défrichements',
  '117':'Démolitions et démontages', '125':'Guidage temporaire du trafic', '151':'Constructions de réseaux enterrés', '161':'Epuisement des eaux', '162':'Enceintes de fouilles',
  '181':'Aménagements extérieurs', '211':'Fouilles et terrassements', '221':'Couches de fondation pour surfaces de circulation', '222':'Bordures, pavages, dallages et escaliers',
  '223':'Chaussées et revêtements', '237':'Canalisations et évacuation des eaux', '241':'Constructions en béton coulé sur place', '281':'Dispositifs routiers de retenue',
  '282':'Signalisation: Signaux routiers', '286':'Marquages', '315':'Construction préfabriquée en béton et en maçonnerie'};
/* fichier d'une archive zip (docx) */
async function unzip(buf, want){
  const v = new DataView(buf), u8 = new Uint8Array(buf);
  let e = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('ce n’est pas un fichier Word (.docx)');
  const n = v.getUint16(e + 10, true); let p = v.getUint32(e + 16, true), en = null;
  for (let k = 0; k < n && v.getUint32(p, true) === 0x02014b50; k++) {
    const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
    if (name === want) en = {meth:v.getUint16(p + 10, true), size:v.getUint32(p + 20, true), off:v.getUint32(p + 42, true)};
    p += 46 + nl + xl + cl;
  }
  if (!en) throw new Error('document Word sans contenu (' + want + ')');
  const start = en.off + 30 + v.getUint16(en.off + 26, true) + v.getUint16(en.off + 28, true), data = u8.subarray(start, start + en.size);
  if (en.meth === 0) return data;
  if (en.meth !== 8 || typeof DecompressionStream === 'undefined') throw new Error('compression non prise en charge par cet appareil');
  return new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
}
function joinLines(lines){
  let o = '';
  for (let l of lines) { l = String(l).trim(); if (!l) continue; if (!o) o = l; else if (o.endsWith('-') && !o.endsWith(' -') && /^\p{Ll}/u.test(l)) o = o.slice(0, -1) + l; else o += ' ' + l; }
  return o.replace(/\s+/g, ' ').trim();
}
const NUM = /^-?[\d' ]+(?:\.\d+)?$/;
const num = s => { s = String(s || '').replace(/['’ ]/g, '').trim(); return s && NUM.test(s) ? parseFloat(s) : null; };
const unent = s => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function cellText(xml){
  const paras = [];
  for (const m of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g)) {
    const p = m[0].replace(/<w:br\/>|<w:cr\/>/g, '<w:t>\n</w:t>');
    paras.push([...p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map(x => x[1]).join(''));
  }
  return unent(joinLines(paras.flatMap(pa => pa.split('\n'))));
}
function finish(doc){
  const tot = {};
  for (const p of doc.pos) if (p.m != null) tot[p.can] = (tot[p.can] || 0) + p.m;
  for (const c of doc.cans) if (c.total == null) c.total = Math.round((tot[c.can] || 0) * 100) / 100;
  if (doc.total == null && doc.cans.length) doc.total = Math.round(doc.cans.reduce((s, c) => s + (c.total || 0), 0) * 100) / 100;
  return doc;
}
/* Word imprimé par BauBit (tableaux Pos. | Cd. | Description | Un. | Quantité | Prix | Montant) */
async function parseDocx(buf, name){
  const x = new TextDecoder('utf-8').decode(await unzip(buf, 'word/document.xml'));
  const doc = {v:1, src:{name, fmt:'docx'}, projet:'', entreprise:'', total:null, cans:[], pos:[]};
  const rows = [...x.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map(r => [...r[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map(c => cellText(c[0])));
  let pending = [], cur = null, inPos = false;
  const canTot = /^Total\s+(\d{3})\s+[A-Z]\/\d{4}\s+(.*)$/;
  for (const c of rows) {
    if (!c.length) continue;
    const c0 = c[0].trim();
    if (c0 === 'Pos.' && c.length >= 7) { inPos = true; continue; }
    if (c0 === 'Total brut' && c.length >= 3 && doc.total == null) { doc.total = num(c[c.length - 1]); continue; }
    const m = canTot.exec(c0);
    if (m) {
      const can = m[1];
      doc.cans.push({can, titre:m[2].trim() || CAN_TITRES[can] || '', total:num(c[c.length - 1])});
      for (const p of pending) p.can = can;
      doc.pos.push(...pending); pending = []; cur = null; inPos = false; continue;
    }
    if (!inPos || c0.startsWith('Total')) continue;
    if (c.length >= 7 && c0) {
      cur = {can:'', p:c0, t:c[2].trim()};
      const u = c[3].trim();
      if (u) Object.assign(cur, {u, q:num(c[4]), pu:num(c[5]), m:num(c[6]), _parts:0}); else cur.h = 1;
      pending.push(cur);
    } else if (c.length >= 7 && !c0 && cur && 'u' in cur) {
      const q = num(c[4]), pu = num(c[5]), mt = num(c[6]);
      if (q == null && pu == null && mt == null) continue;
      if (cur._parts === 0) { cur.q = 0; cur.m = 0; }
      cur._parts++;
      cur.q = Math.round(((cur.q || 0) + (q || 0)) * 1000) / 1000;
      cur.m = Math.round(((cur.m || 0) + (mt || 0)) * 100) / 100;
      if (pu != null) cur.pu = pu;
    } else if (c.length === 5 && cur && 'u' in cur) {
      const q = num(c[2]), mt = num(c[4]);
      if (q != null) cur.q = q;
      if (mt != null) cur.m = mt;
    }
  }
  for (const p of doc.pos) delete p._parts;
  const paras = [...x.slice(0, 200000).matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(p => cellText(p[0]));
  for (const t of paras) if (t.startsWith('Projet ')) { doc.projet = t; break; }
  for (const t of paras) if (/^(.*?(?:SA|Sàrl|AG|GmbH)\b.*?)$/.test(t) && t.length < 80 && (t.includes('Cons.') || t.includes('SA'))) doc.entreprise = t;
  finish(doc);
  if (!doc.pos.some(p => !p.h)) throw new Error('aucune position trouvée : ce Word n’a pas la mise en page BauBit');
  return doc;
}
/* contrôle : somme des positions par CAN = « Total CAN » du fichier */
function check(doc){
  const out = [];
  for (const c of doc.cans) {
    const s = Math.round(doc.pos.filter(p => p.can === c.can && p.m != null).reduce((a, p) => a + p.m, 0) * 100) / 100;
    if (c.total != null && Math.abs(s - c.total) >= 0.05) out.push({can:c.can, titre:c.titre, total:c.total, somme:s});
  }
  return out;
}
/* demande de lecture déposée à côté du fichier (lue par la tâche du vendredi 18:30) */
const request = (file, site, by) => ({v:1, kind:'soum-demande', src:{id:file.id || '', name:file.name}, siteId:site ? site.id : '', site:site ? site.label || site.name || '' : '', at:new Date().toISOString(), by:by || ''});
/* positions en plusieurs morceaux : tous présents → texte recollé dans l'ordre, sinon null */
function partsOf(files, srcName){
  const b = base(srcName), ps = files.map(f => ({f, m:PART.exec(f.name)})).filter(x => x.m && x.m[1].trim() === b);
  if (!ps.length) return null;
  const n = +ps[0].m[3], by = new Map(ps.filter(x => +x.m[3] === n).map(x => [+x.m[2], x.f]));
  for (let i = 1; i <= n; i++) if (!by.has(i)) return null;
  return Array.from({length:n}, (_, i) => by.get(i + 1));
}
/* fin de la prochaine fenêtre de la tâche (vendredi 18:30, heure de Zurich) — pour l'affichage */
function nextRun(now = new Date()){
  const d = new Date(now), day = d.getDay(), add = (5 - day + 7) % 7;
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + add, 18, 30);
  if (r <= now) r.setDate(r.getDate() + 7);
  return r;
}
window.BGSoum = {SRC, TASKABLE, POS, PART, REQ, base, posName, reqName, parseDocx, check, request, partsOf, nextRun, joinLines};
})();
