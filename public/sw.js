const cacheName = 'zhuyin-rescue-v6';
const shell = ['./', './index.html', './style.css', './app.js', './core.js', './local.js', './audio.js', './scene.js', './modes.js',
  './cloud.js', './cloud-config.js', './manifest.webmanifest', './assets/icon-192.png', './assets/icon-512.png',
  './assets/icon-512-maskable.png', './assets/apple-touch-icon.png', './assets/reference.txt'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('zhuyin-rescue-') && key !== cacheName).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (event.request.method !== 'GET' || !shell.some(path => new URL(path,self.registration.scope).href === url)) return;
  event.respondWith(fetch(event.request).catch(async () =>
    (await (await caches.open(cacheName)).match(event.request)) || Response.error()
  ));
});
