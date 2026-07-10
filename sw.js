const CACHE_NAME='mafia-rev15-logic-locked';
const APP_FILES=['/manifest.json','/icon.svg','/background.svg','/rev15-core.js','/rev15-day.js','/rev15-night.js','/rev15-boot.js'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

async function injectRev15(response){
  const html=await response.text();
  const scripts='<script src="/rev15-core.js?v=15"></script><script src="/rev15-day.js?v=15"></script><script src="/rev15-night.js?v=15"></script><script src="/rev15-boot.js?v=15"></script>';
  const body=html.includes('</body>')?html.replace('</body>',scripts+'</body>'):html+scripts;
  return new Response(body,{status:response.status,statusText:response.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(request,{cache:'no-store'});
        if(fresh.ok)return injectRev15(fresh);
      }catch(e){}
      const cached=await caches.match('/index.html');
      if(cached)return injectRev15(cached);
      return new Response('App unavailable offline until opened once online.',{status:503,headers:{'Content-Type':'text/plain'}});
    })());
    return;
  }
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(request,{cache:'no-store'});
      if(fresh.ok){const cache=await caches.open(CACHE_NAME);cache.put(request,fresh.clone());return fresh;}
    }catch(e){}
    return (await caches.match(request))||new Response('',{status:504});
  })());
});
