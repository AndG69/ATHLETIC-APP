/*
 * Service Worker — Maranello 2027 PWA
 * Strategia: Cache-first per asset statici, network-first per dati.
 */

var CACHE_NAME = "maranello-v2";
var ASSETS = [
  "./index.html",
  "./css/tokens.css",
  "./css/app.css",
  "./js/version.js",
  "./js/i18n/it.js",
  "./js/services/storage.js",
  "./js/router.js",
  "./js/modules/services/peso-stats.js",
  "./js/modules/services/oggi-utils.js",
  "./js/modules/services/sessioni-utils.js",
  "./js/data/esercizi-catalog.js",
  "./js/data/programma-palestra-seed.js",
  "./js/modules/components/info-popover.js",
  "./js/modules/services/analisi-corsa.js",
  "./js/modules/services/piano-corsa-generator.js",
  "./js/modules/services/piano-palestra-generator.js",
  "./js/modules/services/export-scheda-palestra.js",
  "./js/modules/views/peso.js",
  "./js/modules/views/oggi.js",
  "./js/modules/views/form-corsa.js",
  "./js/modules/views/diario-corsa.js",
  "./js/modules/views/form-palestra.js",
  "./js/modules/views/diario-palestra.js",
  "./js/modules/views/settimana.js",
  "./js/modules/views/genera-piano.js",
  "./js/modules/views/impostazioni.js",
  "./js/modules/views/anagrafica-palestra.js",
  "./js/modules/views/dashboard.js",
  "./js/app.js",
  "./assets/vendor/idb.js",
  "./assets/vendor/xlsx.full.min.js",
  "./assets/vendor/chart.umd.js",
  "./manifest.json"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
             .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      return cached || fetch(event.request);
    })
  );
});
