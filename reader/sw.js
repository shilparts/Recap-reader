// Keeps the reader usable offline. Project data lives in IndexedDB, never in this cache.
const CACHE='recap-reader-v2';
const FILES=['./','index.html','reader.css','boot.js','reader.js','reader-core.js','icon.svg','manifest.webmanifest','../handoff.js','../project-transfer.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// Network first so an update arrives when online; the cache answers when offline.
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match(e.request,{ignoreSearch:true})));});
