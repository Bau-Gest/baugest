const C='baugest-v4';
const A=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim();});
function inboxDB(){return new Promise((res,rej)=>{const r=indexedDB.open('photochantier-inbox',1);r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
async function receiveShare(req){
  const home=self.registration.scope;
  try{
    const fd=await req.formData();
    const files=[...fd.getAll('photos'),...fd.getAll('plans')].filter(f=>f&&typeof f!=='string'&&f.size);
    if(files.length){
      const db=await inboxDB(),now=Date.now();
      await new Promise((res,rej)=>{const t=db.transaction('files','readwrite'),s=t.objectStore('files');
        files.forEach((f,i)=>s.put({id:now.toString(36)+'-'+i+'-'+Math.random().toString(36).slice(2,6),blob:f,name:f.name||(/pdf/i.test(f.type||'')?'plan.pdf':'photo.jpg'),type:f.type||'',lastModified:f.lastModified||now,received:now}));
        t.oncomplete=res;t.onerror=()=>rej(t.error);});
      db.close();
    }
    return Response.redirect(home+'?share='+files.length,303);
  }catch(err){return Response.redirect(home+'?share=err',303);}
}
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.origin===location.origin&&u.pathname.endsWith('/share-target')){
    e.respondWith(e.request.method==='POST'?receiveShare(e.request):Response.redirect(self.registration.scope,303));
    return;
  }
  if(e.request.method==='GET'&&(u.origin==='https://cdnjs.cloudflare.com'||(u.origin==='https://cdn.jsdelivr.net'&&u.pathname.startsWith('/npm/pdfjs-dist@')))){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{if(res.ok||res.type==='opaque'){const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp));}return res;})));
    return;
  }
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r;})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'))));
});
