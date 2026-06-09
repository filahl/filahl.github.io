const CACHE_NAME = 'znamek-cache-v1'; // Při každé úpravě HTML zde změň verzi (např. na v2, v3...)

// Soubory, které se uloží pro offline použití
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Instalace Service Workera a stažení souborů do mezipaměti
self.addEventListener('install', event => {
  self.skipWaiting(); // Okamžitá instalace (nečeká na zavření tabů)
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Soubory uloženy do cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Aktivace a smazání staré mezipaměti
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Pokud se název cache neshoduje s aktuální verzí, smaže se
          if (cacheName !== CACHE_NAME) {
            console.log('Mažu starou cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Okamžité převzetí kontroly nad otevřenou stránkou
    })
  );
});

// Strategie: Cache First, Fallback to Network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Pokud je soubor v cache, vrátí ho. Pokud ne, stáhne ho z internetu.
        return response || fetch(event.request);
      }).catch(() => {
        // Zde by mohl být fallback pro offline režim, kdyby selhalo připojení
      })
  );
});
