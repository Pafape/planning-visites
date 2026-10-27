const C='pv-v3';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','index.html','manifest.webmanifest','icon-192.png','logo.png'])).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET')return;
 const u=new URL(r.url);
 if(u.origin===location.origin){
  e.respondWith(fetch(r).then(x=>{const cp=x.clone();caches.open(C).then(c=>c.put(r,cp));return x}).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))));
 }else if((u.hostname==='www.gstatic.com'&&u.pathname.startsWith('/firebasejs/'))||u.hostname==='cdnjs.cloudflare.com'){
  e.respondWith(caches.match(r).then(m=>m||fetch(r).then(x=>{if(x.ok){const cp=x.clone();caches.open(C).then(c=>c.put(r,cp))}return x})));
 }
});
// Notifications de rappel (envoyées par Firebase Cloud Messaging)
self.addEventListener('push',e=>{
 let j={};try{j=e.data.json()}catch(x){}
 const d=j.data||j.notification||j;
 e.waitUntil(self.registration.showNotification(d.title||'Planning de visites',{body:d.body||'',icon:'icon-192.png',badge:'icon-192.png',tag:d.tag,data:{t:d.t,id:d.id}}));
});
self.addEventListener('notificationclick',e=>{
 e.notification.close();
 const {t,id}=e.notification.data||{};
 e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
  if(cs[0]){cs[0].focus();cs[0].postMessage({nav:{t,id}});return}
  return clients.openWindow('./?'+(t==='cr'?'cr':'prev')+'='+encodeURIComponent(id));
 }));
});
