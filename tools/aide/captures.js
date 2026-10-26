/* Captures du manuel du Planning (aide/*.png) : recrée les 2 plannings d'exemple (collecteur EU, villa) avec le vrai planning.js, thème clair du PC.
   Usage : node tools/aide/captures.js [dossier de sortie]   (Playwright requis ; défaut : aide/) */
const {chromium}=require(process.env.PLAYWRIGHT||'playwright');const fs=require('fs'),path=require('path');
const R=path.resolve(__dirname,'../..'),OUT=process.argv[2]||R+'/aide';
const pc=fs.readFileSync(R+'/pc.html','utf8');const css=pc.slice(pc.indexOf(':root{'),pc.indexOf('[hidden]{display:none!important}'));
const h=`<!doctype html><html data-theme="light"><meta charset=utf-8>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${css}[hidden]{display:none!important}*{box-sizing:border-box}html,body{height:100%;margin:0}body{background:var(--bg);color:var(--text);font:14px/1.45 var(--body);overflow:hidden}.bp-info,.bp-toasts,.bp-state{display:none!important}</style><body>
<script src="planning.js"></script><script>BGPlan.init({sites:()=>[{id:'s1',label:'2701 Route du Moulin'}],api:async()=>{throw new Error('off')},ensureFolder:async()=>{throw new Error('off')},online:()=>false,loadScript:async()=>{},company:()=>''});</script>`;
fs.writeFileSync(R+'/_cap.html',h);
const T=(id,name,o)=>Object.assign({id,name,parent:null,dur:0,deps:[],asg:[],act:[],pct:0},o);
const FS=(id,lag=0)=>({id,type:'FS',lag}),SS=(id,lag)=>({id,type:'SS',lag}),FF=(id,lag)=>({id,type:'FF',lag});
const gc={v:1,uid:'gc',siteId:'s1',name:'Collecteur EU route du Moulin',start:'2027-04-12',indice:'A',hol:{canton:'VD',extra:[]},vac:[],opts:{sat:false,hpd:8.5,structure:'lots',budget:'mix'},
 res:[{id:'r1',name:'Équipe canalisation',type:'team',unit:'pers.',rate:72,cap:4,color:'#3e8ed0'},{id:'r2',name:'Pelle 14 t',type:'machine',unit:'u.',rate:900,cap:1,color:'#e8a33d'},
  {id:'r3',name:'Tuyaux PP Ø 400',type:'supply',unit:'m',rate:95,cap:0,color:'#4caf7a'},{id:'r4',name:'Sous-traitant enrobés',type:'sub',unit:'forfait',rate:38000,cap:0,color:'#9b6fd6'}],
 tasks:[T('l1','Préparation',{lot:true}),T('a11','Installation de chantier',{parent:'l1',dur:2,asg:[{r:'r1',q:2}]}),T('a12','Signalisation et déviation',{parent:'l1',dur:1,deps:[FS('a11')],asg:[{r:'r1',q:2}]}),
  T('l2','Collecteur',{lot:true}),T('a21','Démolition enrobé',{parent:'l2',dur:2,deps:[FS('a12')],asg:[{r:'r1',q:2},{r:'r2',q:1}]}),
  T('a22','Fouille blindée tronçon 1 (60 m)',{parent:'l2',dur:5,deps:[FS('a21')],asg:[{r:'r1',q:2},{r:'r2',q:1}]}),
  T('a23','Pose collecteur tronçon 1',{parent:'l2',dur:4,deps:[SS('a22',2),FF('a22',1)],asg:[{r:'r1',q:2},{r:'r3',q:60}]}),
  T('a24','Remblayage tronçon 1',{parent:'l2',dur:3,deps:[SS('a23',2),FF('a23',1)],asg:[{r:'r1',q:1},{r:'r2',q:1}]}),
  T('a25','Fouille blindée tronçon 2 (60 m)',{parent:'l2',dur:5,deps:[FS('a22')],asg:[{r:'r1',q:2},{r:'r2',q:1}]}),
  T('a26','Pose collecteur tronçon 2',{parent:'l2',dur:4,deps:[SS('a25',2),FF('a25',1)],asg:[{r:'r1',q:2},{r:'r3',q:60}]}),
  T('a27','Remblayage tronçon 2',{parent:'l2',dur:3,deps:[SS('a26',2),FF('a26',1)],asg:[{r:'r1',q:1},{r:'r2',q:1}]}),
  T('a28','Inspection caméra',{parent:'l2',dur:1,deps:[FS('a24'),FS('a27')],bud:1200}),
  T('l3','Chaussée',{lot:true}),T('a31','Fondation en grave',{parent:'l3',dur:3,deps:[FS('a28')],asg:[{r:'r1',q:3},{r:'r2',q:1}]}),
  T('a32','Bordures',{parent:'l3',dur:3,deps:[SS('a31',1)],asg:[{r:'r1',q:2}]}),T('a33','Enrobé couche de base',{parent:'l3',dur:1,deps:[FS('a31'),FS('a32')],asg:[{r:'r4',q:0.6}]}),
  T('a34','Enrobé couche de roulement',{parent:'l3',dur:1,deps:[FS('a33',5)],asg:[{r:'r4',q:0.4}]}),T('a35','Marquage et repli',{parent:'l3',dur:1,deps:[FS('a34')],asg:[{r:'r1',q:2}]}),
  T('a36','Route rendue au trafic',{parent:'l3',ms:true,deps:[FS('a35')]})],baseline:null};
const vi={v:1,uid:'vi',siteId:'s1',name:'Villa – gros œuvre',start:'2027-03-01',indice:'A',hol:{canton:'VD',extra:[]},vac:[],opts:{sat:false,hpd:8.5,structure:'lots',budget:'mix'},
 res:[{id:'m1',name:'Équipe maçonnerie',type:'team',unit:'pers.',rate:72,cap:5,color:'#3e8ed0'},{id:'m2',name:'Grue',type:'machine',unit:'u.',rate:500,cap:1,color:'#e8a33d'},{id:'m3',name:'Béton C25/30',type:'supply',unit:'m³',rate:220,cap:0,color:'#4caf7a'}],
 tasks:[T('l1','Terrassement',{lot:true}),T('b11','Installation de chantier',{parent:'l1',dur:3,bud:8000}),T('b12','Fouille en pleine masse',{parent:'l1',dur:6,deps:[FS('b11')],bud:24000}),
  T('l2','Sous-sol',{lot:true}),T('b21','Béton maigre',{parent:'l2',dur:1,deps:[FS('b12')],asg:[{r:'m1',q:3},{r:'m3',q:8}]}),
  T('b22','Radier : coffrage et armature',{parent:'l2',dur:4,deps:[FS('b21')],asg:[{r:'m1',q:4},{r:'m2',q:1}]}),T('b23','Radier : bétonnage',{parent:'l2',dur:1,deps:[FS('b22')],asg:[{r:'m1',q:4},{r:'m3',q:45}]}),
  T('b24','Murs sous-sol',{parent:'l2',dur:10,deps:[FS('b23',2)],asg:[{r:'m1',q:4},{r:'m2',q:1},{r:'m3',q:38}]}),T('b25','Dalle sur sous-sol',{parent:'l2',dur:6,deps:[FS('b24')],asg:[{r:'m1',q:5},{r:'m2',q:1},{r:'m3',q:42}]}),
  T('l3','Rez et toiture',{lot:true}),T('b31','Murs rez-de-chaussée',{parent:'l3',dur:8,deps:[FS('b25',3)],asg:[{r:'m1',q:4},{r:'m2',q:1}]}),
  T('b32','Dalle toiture',{parent:'l3',dur:6,deps:[FS('b31')],asg:[{r:'m1',q:5},{r:'m2',q:1},{r:'m3',q:40}]}),T('b33','Isolation périphérique et remblayage',{parent:'l3',dur:4,deps:[FS('b25',5)],bud:16000}),
  T('b34','Gros œuvre terminé',{parent:'l3',ms:true,deps:[FS('b32'),FS('b33')]})],baseline:null};
(async()=>{const b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
const ctx=await b.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1.5});const p=await ctx.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
await p.clock.install({time:new Date('2026-10-17T09:00:00')});
await p.goto('file://'+R+'/_cap.html');await p.evaluate(()=>document.fonts.ready);
const put=async recs=>p.evaluate(async recs=>{await new Promise((res,rej)=>{const r=indexedDB.open('baugest-planning',1);r.onupgradeneeded=()=>r.result.createObjectStore('plans',{keyPath:'uid'});r.onsuccess=()=>{const t=r.result.transaction('plans','readwrite');for(const x of recs)t.objectStore('plans').put(x);t.oncomplete=()=>{r.result.close();res()};t.onerror=rej}})},recs);
const get=async uid=>p.evaluate(async uid=>new Promise(res=>{const r=indexedDB.open('baugest-planning',1);r.onsuccess=()=>{const q=r.result.transaction('plans').objectStore('plans').get(uid);q.onsuccess=()=>{r.result.close();res(q.result)}}}),uid);
const rec=pl=>({uid:pl.uid,siteId:'s1',name:pl.name,plan:pl,dirty:false,driveId:null,driveMod:null});
await put([rec(gc),rec(vi)]);
const shot=async(n,el)=>{await p.waitForTimeout(400);if(el)await (await p.$(el)).screenshot({path:OUT+'/'+n+'.png'});else await p.screenshot({path:OUT+'/'+n+'.png'});console.log('ok',n)};
const tab=async t=>{await p.click(`.bp-tabs [data-tab="${t}"]`);await p.waitForTimeout(300)};
await p.evaluate(()=>BGPlan.open('s1','gc'));await p.waitForTimeout(800);
await shot('gantt-gc');
await tab('set');await shot('reglages');
// fiche tâche : couleur choisie pour la capture seulement
await tab('gantt');await p.dblclick('.bp-chart .bar[data-id="a23"] rect.b');await p.waitForTimeout(400);
await p.click('#tkCol [data-c="#3fb0b0"]');await p.fill('#tkNote','Lit de pose et enrobage en gravier 3/16');await p.fill('#tkZone','Tronçon 1');
await p.addStyleTag({content:'.bp-scrim.capfull{align-items:flex-start!important;padding:0!important}.bp-scrim.capfull .bp-dlg{max-height:none!important}'});
await p.evaluate(()=>document.querySelector('.bp-scrim').classList.add('capfull'));
await p.setViewportSize({width:1280,height:1200});await shot('fiche-tache','.bp-dlg');await p.keyboard.press('Escape');await p.setViewportSize({width:1280,height:720});await p.waitForTimeout(300);
await p.evaluate(()=>{});
await p.evaluate(()=>BGPlan.close());await p.waitForTimeout(300);await p.evaluate(()=>BGPlan.open('s1','gc'));await p.waitForTimeout(600);
// fenêtre Style de 2 tâches (non appliquée)
await p.click('#bpRows .bp-row[data-id="a22"]');await p.click('#bpRows .bp-row[data-id="a25"]',{modifiers:['Control']});await p.click('[data-g="style"]');await p.waitForTimeout(300);
await p.click('#stCol [data-c="#9b6fd6"]');await p.selectOption('[data-st="pos"]','t');await p.selectOption('[data-st="txt"]','name');await p.selectOption('[data-st="b"]','1');await p.selectOption('[data-st="pat"]','h');
await shot('style','.bp-dlg');await p.keyboard.press('Escape');await p.waitForTimeout(200);await p.keyboard.press('Escape');await p.waitForTimeout(200);await p.evaluate(()=>BGPlan.close());await p.waitForTimeout(300);await p.evaluate(()=>BGPlan.open('s1','gc'));await p.waitForTimeout(600);
// ressources + lissage
await p.setViewportSize({width:1280,height:620});await tab('res');await p.click('tr[data-r="r2"]');await shot('ressources');
await p.click('.bp-card [data-a="level"]');await p.waitForTimeout(400);await shot('lissage','.bp-dlg');
await p.click('.bp-scrim >> text=Appliquer');await p.waitForTimeout(400);
await p.setViewportSize({width:1280,height:720});await tab('gantt');await shot('gantt-lisse');
await p.click('[data-a="undo"]');await p.waitForTimeout(300);
console.log('fin apres undo',await p.$eval('.bp-sum',e=>e.textContent));
// référence figée le 17.10.2026
await p.click('[data-a="baseline"]');await p.waitForTimeout(300);await p.click('.bp-scrim >> text=Figer la référence');await p.waitForTimeout(500);
await p.evaluate(()=>BGPlan.close());await p.waitForTimeout(500);
await p.setViewportSize({width:1280,height:620});
await p.evaluate(()=>BGPlan.open('s1','vi'));await p.waitForTimeout(800);await tab('gantt');await p.waitForTimeout(400);await shot('gantt-bat');
console.log('villa',await p.$eval('.bp-sum',e=>e.textContent));await tab('bud');console.log('villa bud',await p.$$eval('.bp-kpi',a=>a.slice(0,2).map(x=>x.innerText.replace(/\n/g,' ')).join(' | ')));
await p.evaluate(()=>BGPlan.close());await p.waitForTimeout(400);await p.setViewportSize({width:1280,height:720});
// situation au 22.04.2027
await p.clock.setSystemTime(new Date('2027-04-22T16:00:00'));
const r=await get('gc');const P=r.plan,tk=id=>P.tasks.find(t=>t.id===id);
Object.assign(tk('a11'),{pct:100,aStart:'2027-04-12',aEnd:'2027-04-13',act:[{d:'2027-04-13',r:'r1',q:34}]});
Object.assign(tk('a12'),{pct:100,aStart:'2027-04-14',aEnd:'2027-04-14',act:[{d:'2027-04-14',r:'r1',q:17}]});
Object.assign(tk('a21'),{dur:3,pct:100,aStart:'2027-04-15',aEnd:'2027-04-19',act:[{d:'2027-04-19',r:'r1',q:51},{d:'2027-04-19',r:'r2',q:3}]});
Object.assign(tk('a22'),{pct:40,aStart:'2027-04-20',act:[{d:'2027-04-22',r:'r1',q:51},{d:'2027-04-22',r:'r2',q:3}]});
Object.assign(tk('a23'),{pct:20,aStart:'2027-04-22',act:[{d:'2027-04-22',r:'r1',q:17},{d:'2027-04-22',r:'r3',q:12}]});
r.dirty=false;await put([r]);
await p.evaluate(()=>BGPlan.open('s1','gc'));await p.waitForTimeout(800);await tab('gantt');
await shot('gantt-suivi');
await tab('bud');await shot('budget');
console.log('kpi',await p.$$eval('.bp-kpi',a=>a.map(x=>x.innerText.replace(/\n/g,' ')).join(' | ')));
await p.click('[data-act="a22"]');await p.waitForTimeout(400);await shot('realise','.bp-dlg');await p.keyboard.press('Escape');
await p.evaluate(()=>{try{localStorage.setItem('baugest.planAn',JSON.stringify({kind:'team',per:'w',by:'lot',src:'plan',cmp:{real:true,base:true}}))}catch(e){}});
await p.setViewportSize({width:1280,height:1300});await tab('an');await shot('analyse','#bpMain .bp-card:nth-child(2)');await p.setViewportSize({width:1280,height:720});
await p.evaluate(()=>BGPlan.close());await p.waitForTimeout(400);
await b.close();fs.unlinkSync(R+'/_cap.html');})();
