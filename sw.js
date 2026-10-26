/*
 * Service Worker — Maranello 2027 PWA
 * Strategia: Cache-first per asset statici, network-first per dati.
 */

var CACHE_NAME = "maranello-v13";
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
  "./js/modules/services/anagrafica-esercizi.js",
  "./js/modules/components/info-popover.js",
  "./js/modules/services/analisi-corsa.js",
  "./js/modules/services/piano-corsa-generator.js",
  "./js/modules/services/piano-palestra-generator.js",
  "./js/modules/services/export-scheda-palestra.js",
  "./js/modules/services/sync-mobile.js",
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
  "./js/modules/views/anagrafica-esercizi.js",
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

// Vendor pesanti: cache-first (non cambiano quasi mai, evita download inutili).
var CACHE_FIRST = /\/assets\/vendor\//;

self.addEventListener("fetch", function (event) {
  var req = event.request;

  // Solo GET: le POST (es. /api/schede) passano direttamente alla rete.
  if (req.method !== "GET") return;

  var url = new URL(req.url);

  // Asset vendor pesanti → cache-first.
  if (CACHE_FIRST.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        return cached || fetch(req);
      })
    );
    return;
  }

  // HTML / JS / CSS / manifest → network-first: così gli aggiornamenti del
  // codice (es. il campo "Sequenza schede") vengono presi subito quando sei
  // online. Offline: fallback alla copia in cache.
  event.respondWith(
    fetch(req)
      .then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(req, copy);
          });
        }
        return resp;
      })
      .catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match("./index.html");
        });
      })
  );
});
