/*
 * Maranello 2027 — App_HTML
 * File: js/services/storage.js
 *
 * Layer di persistenza IndexedDB per il piano Maranello_2027.
 *
 * Strategia libreria:
 *   1) Percorso primario: se `window.idb` (Jake Archibald's idb library, 8.x)
 *      è stato caricato localmente (file reale in /assets/vendor/idb.js),
 *      useremo quel wrapper.
 *   2) Percorso fallback: in sua assenza (es. placeholder non ancora
 *      sostituito) usiamo un wrapper IndexedDB vanilla interno a questo
 *      modulo. Il wrapper implementa solo la piccola superficie che ci
 *      serve (openDB, transaction, get/put/delete, cursor per query).
 *
 * Il fallback garantisce coerenza con Req 22.2 e Property 23 (nessuna
 * CDN a runtime, zero richieste esterne) e permette lo sviluppo
 * out-of-the-box senza passaggi di installazione.
 *
 * API esposta su window.MaranelloStorage e come oggetto ritornato
 * dall'IIFE (il file è caricato via <script> classico, non come modulo ES).
 *
 * Ref: Req 22.3, 23.1, 23.7, 24.5, 24.6; Design "Modello dati (schema IndexedDB)".
 */

(function initStorageModule(global) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Costanti di schema
  // ---------------------------------------------------------------------------

  var DB_NAME = "MaranelloPlan_v1";
  var DB_VERSION = 2;

  var STORES = Object.freeze({
    IMPOSTAZIONI: "impostazioni",
    PIANO_SETTIMANE: "piano_settimane",
    SESSIONI_CORSA: "sessioni_corsa",
    SESSIONI_PALESTRA: "sessioni_palestra",
    SESSIONI_NUOTO: "sessioni_nuoto",
    PESO: "peso",
    PROPOSTE: "proposte",
    ALLERTE: "allerte",
    KPI_SETTIMANALI: "kpi_settimanali",
    LOG_MODIFICHE: "log_modifiche",
    PROGRAMMA_PALESTRA: "programma_palestra",
  });

  /**
   * Specifica di ogni object store: keyPath, indici e hint di autoincrement.
   * Questa mappa è la fonte di verità per lo schema v1 e per la definizione
   * degli indici disponibili in `query()`.
   */
  var STORE_SPECS = {
    impostazioni: {
      keyPath: "id",
      autoIncrement: false,
      indices: [],
    },
    piano_settimane: {
      keyPath: "id",
      autoIncrement: false,
      indices: [
        { name: "by_fase", keyPath: "fase", options: { unique: false } },
        { name: "by_numSettimana", keyPath: "numSettimana", options: { unique: false } },
        { name: "by_dataInizio", keyPath: "dataInizio", options: { unique: false } },
      ],
    },
    sessioni_corsa: {
      keyPath: "id",
      autoIncrement: false,
      indices: [
        { name: "by_data", keyPath: "data", options: { unique: false } },
        { name: "by_stato", keyPath: "stato", options: { unique: false } },
        { name: "by_settimana", keyPath: "settimanaId", options: { unique: false } },
      ],
    },
    sessioni_palestra: {
      keyPath: "id",
      autoIncrement: false,
      indices: [
        { name: "by_data", keyPath: "data", options: { unique: false } },
        { name: "by_stato", keyPath: "stato", options: { unique: false } },
        { name: "by_settimana", keyPath: "settimanaId", options: { unique: false } },
      ],
    },
    sessioni_nuoto: {
      keyPath: "id",
      autoIncrement: false,
      indices: [
        { name: "by_data", keyPath: "data", options: { unique: false } },
      ],
    },
    peso: {
      keyPath: "id",
      autoIncrement: false,
      indices: [
        { name: "by_data", keyPath: "data", options: { unique: false } },
      ],
    },
    proposte: {
      keyPath: "id",
      autoIncrement: false,
      indices: [
        { name: "by_dataProposta", keyPath: "dataProposta", options: { unique: false } },
        { name: "by_decisione", keyPath: "decisione", options: { unique: false } },
      ],
    },
    allerte: {
      keyPath: "id",
      autoIncrement: false,
      indices: [
        { name: "by_dataAttivazione", keyPath: "dataAttivazione", options: { unique: false } },
        { name: "by_livello", keyPath: "livello", options: { unique: false } },
        // Indice 'by_attiva': le allerte attive hanno dataSblocco non valorizzato.
        // IndexedDB non indicizza naturalmente i valori null, quindi usiamo
        // il campo derivato `_attiva` ("1" attiva, "0" sbloccata) gestito al put.
        { name: "by_attiva", keyPath: "_attiva", options: { unique: false } },
      ],
    },
    kpi_settimanali: {
      keyPath: "id",
      autoIncrement: false,
      indices: [],
    },
    log_modifiche: {
      keyPath: "id",
      autoIncrement: false,
      indices: [
        { name: "by_timestamp", keyPath: "timestamp", options: { unique: false } },
        { name: "by_entita", keyPath: "entita", options: { unique: false } },
      ],
    },
    programma_palestra: {
      keyPath: "id",
      autoIncrement: false,
      indices: [],
    },
  };

  // ---------------------------------------------------------------------------
  // Migrazioni versionate
  //
  // Ogni entry è una funzione migration(db, oldVersion, transaction) invocata
  // in onupgradeneeded per passare da versione (index+1-1) a (index+1).
  // Aggiungendo una voce all'array si incrementa implicitamente DB_VERSION.
  //
  // Preservazione dati: IndexedDB mantiene gli store esistenti a meno che
  // la migrazione non li cancelli esplicitamente. Le migrazioni v2+ dovranno
  // usare `transaction.objectStore(...)` per modifiche in-place.
  // ---------------------------------------------------------------------------

  var MIGRATIONS = [
    // v0 -> v1: schema iniziale con tutti gli store e indici.
    function migrateV1(db /*, oldVersion, transaction */) {
      Object.keys(STORE_SPECS).forEach(function createStore(storeName) {
        if (db.objectStoreNames.contains(storeName)) return;
        var spec = STORE_SPECS[storeName];
        var store = db.createObjectStore(storeName, {
          keyPath: spec.keyPath,
          autoIncrement: !!spec.autoIncrement,
        });
        (spec.indices || []).forEach(function createIndex(idx) {
          store.createIndex(idx.name, idx.keyPath, idx.options || {});
        });
      });
    },
    // v1 -> v2: aggiunge lo store programma_palestra (introdotto dopo il deploy iniziale).
    function migrateV2(db /*, oldVersion, transaction */) {
      if (!db.objectStoreNames.contains("programma_palestra")) {
        db.createObjectStore("programma_palestra", {
          keyPath: "id",
          autoIncrement: false,
        });
      }
    },
  ];

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /** Semplice UUID v4. Usa crypto.randomUUID() se disponibile. */
  function generateUuid() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }
    // Fallback RFC-4122-ish (non crittograficamente sicuro, sufficiente per
    // l'uso locale di un'app mono-utente).
    var template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
    return template.replace(/[xy]/g, function replaceChar(c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /** Timestamp ISO 8601. */
  function nowIso() {
    return new Date().toISOString();
  }

  /** True se stiamo usando la libreria reale `idb`. */
  function hasRealIdbLibrary() {
    return !!(global.idb && typeof global.idb.openDB === "function");
  }

  // ---------------------------------------------------------------------------
  // Fallback wrapper vanilla su IndexedDB
  //
  // Espone una piccola API asincrona basata su Promise. È volutamente minimale:
  // openDB, e poi su ogni istanza i metodi get / put / delete / getAllFromIndex
  // / getAll / clear / transaction.
  // ---------------------------------------------------------------------------

  function promisifyRequest(request) {
    return new Promise(function executor(resolve, reject) {
      request.oncomplete = request.onsuccess = function onOk() {
        resolve(request.result);
      };
      request.onabort = request.onerror = function onErr() {
        reject(request.error);
      };
    });
  }

  function openDbFallback(name, version, upgrade) {
    return new Promise(function executor(resolve, reject) {
      var indexedDBImpl = global.indexedDB || global.mozIndexedDB || global.webkitIndexedDB;
      if (!indexedDBImpl) {
        reject(new Error("IndexedDB non disponibile in questo ambiente."));
        return;
      }
      var req = indexedDBImpl.open(name, version);
      req.onupgradeneeded = function onUpgrade(event) {
        try {
          upgrade(req.result, event.oldVersion, event.newVersion, req.transaction);
        } catch (err) {
          reject(err);
        }
      };
      req.onsuccess = function onOk() {
        resolve(wrapDb(req.result));
      };
      req.onerror = function onErr() {
        reject(req.error);
      };
      req.onblocked = function onBlocked() {
        // Il DB è aperto in un'altra tab con versione precedente: segnaliamo
        // l'anomalia senza killare l'app.
        if (global.console && global.console.warn) {
          global.console.warn(
            "[storage] apertura DB bloccata: chiudi altre schede dell'app."
          );
        }
      };
    });
  }

  /** Avvolge un IDBDatabase con un'API basata su Promise. */
  function wrapDb(rawDb) {
    return {
      _raw: rawDb,
      close: function close() {
        rawDb.close();
      },
      get: function get(storeName, key) {
        var tx = rawDb.transaction(storeName, "readonly");
        var store = tx.objectStore(storeName);
        return promisifyRequest(store.get(key));
      },
      put: function put(storeName, value) {
        var tx = rawDb.transaction(storeName, "readwrite");
        var store = tx.objectStore(storeName);
        store.put(value);
        return promisifyRequest(tx).then(function done() {
          return value[store.keyPath];
        });
      },
      delete: function del(storeName, key) {
        var tx = rawDb.transaction(storeName, "readwrite");
        var store = tx.objectStore(storeName);
        store.delete(key);
        return promisifyRequest(tx);
      },
      getAll: function getAll(storeName) {
        var tx = rawDb.transaction(storeName, "readonly");
        var store = tx.objectStore(storeName);
        return promisifyRequest(store.getAll());
      },
      getAllFromIndex: function getAllFromIndex(storeName, indexName, range) {
        var tx = rawDb.transaction(storeName, "readonly");
        var index = tx.objectStore(storeName).index(indexName);
        return promisifyRequest(range ? index.getAll(range) : index.getAll());
      },
      clear: function clearStore(storeName) {
        var tx = rawDb.transaction(storeName, "readwrite");
        var store = tx.objectStore(storeName);
        store.clear();
        return promisifyRequest(tx);
      },
      /**
       * Apre una transazione multi-store `readwrite` e consegna al callback
       * gli object store nell'ordine dei nomi forniti. Il callback può usarli
       * in modo sincrono ed eventualmente ritornare una Promise; la
       * transazione è committata alla fine.
       */
      tx: function tx(storeNames, mode, callback) {
        var transaction = rawDb.transaction(storeNames, mode);
        var stores = {};
        (Array.isArray(storeNames) ? storeNames : [storeNames]).forEach(
          function collect(name) {
            stores[name] = transaction.objectStore(name);
          }
        );
        var callbackResult;
        try {
          callbackResult = callback(stores, transaction);
        } catch (err) {
          try {
            transaction.abort();
          } catch (e) {
            /* noop */
          }
          return Promise.reject(err);
        }
        return promisifyRequest(transaction).then(function completed() {
          return callbackResult;
        });
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Scelta del backend (idb reale vs fallback)
  // ---------------------------------------------------------------------------

  function openDbWithBackend() {
    if (hasRealIdbLibrary()) {
      // window.idb.openDB(name, version, { upgrade, blocked, blocking })
      return global.idb
        .openDB(DB_NAME, DB_VERSION, {
          upgrade: function upgrade(db, oldVersion, newVersion, transaction) {
            runMigrations(db, oldVersion, newVersion, transaction);
          },
        })
        .then(function adapt(realDb) {
          // Adattatore minimale così il resto del codice può trattare entrambi
          // i backend con gli stessi metodi async.
          return {
            _raw: realDb,
            close: function close() {
              realDb.close();
            },
            get: function get(storeName, key) {
              return realDb.get(storeName, key);
            },
            put: function put(storeName, value) {
              return realDb.put(storeName, value);
            },
            delete: function del(storeName, key) {
              return realDb.delete(storeName, key);
            },
            getAll: function getAll(storeName) {
              return realDb.getAll(storeName);
            },
            getAllFromIndex: function getAllFromIndex(storeName, indexName, range) {
              return realDb.getAllFromIndex(storeName, indexName, range);
            },
            clear: function clearStore(storeName) {
              return realDb.clear(storeName);
            },
            tx: function tx(storeNames, mode, callback) {
              var transaction = realDb.transaction(storeNames, mode);
              var stores = {};
              (Array.isArray(storeNames) ? storeNames : [storeNames]).forEach(
                function collect(name) {
                  stores[name] = transaction.objectStore(name);
                }
              );
              var callbackResult;
              try {
                callbackResult = callback(stores, transaction);
              } catch (err) {
                try { transaction.abort(); } catch (e) { /* noop */ }
                return Promise.reject(err);
              }
              return transaction.done.then(function done() {
                return callbackResult;
              });
            },
          };
        });
    }
    return openDbFallback(DB_NAME, DB_VERSION, runMigrations);
  }

  /**
   * Esegue in sequenza tutte le migrazioni necessarie da `oldVersion+1` a
   * `newVersion`. Le migrazioni di indice 0 portano da v0 a v1, l'indice 1
   * da v1 a v2 e così via. IndexedDB preserva i dati: la migrazione può
   * arricchire lo schema senza perdita.
   */
  function runMigrations(db, oldVersion, newVersion, transaction) {
    var from = oldVersion || 0;
    var to = typeof newVersion === "number" ? newVersion : DB_VERSION;
    for (var v = from; v < to; v++) {
      var migration = MIGRATIONS[v];
      if (typeof migration === "function") {
        migration(db, v, transaction);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // API pubblica
  // ---------------------------------------------------------------------------

  var _dbPromise = null;

  function ensureDb() {
    if (!_dbPromise) {
      _dbPromise = openDbWithBackend();
    }
    return _dbPromise;
  }

  /**
   * Prepara il record prima della scrittura: arricchisce con `_updatedAt`,
   * assegna un id uuid se mancante, e normalizza campi derivati (es.
   * `_attiva` per lo store allerte).
   */
  function prepareRecordForPut(storeName, record) {
    var spec = STORE_SPECS[storeName];
    if (!spec) {
      throw new Error("Store sconosciuto: " + storeName);
    }
    var enriched = Object.assign({}, record);
    // Autogenerazione id uuid per gli store a keyPath uuid (esclusi quelli
    // con chiave semantica come impostazioni, piano_settimane, kpi_settimanali).
    var semanticKeyStores = {
      impostazioni: true,
      piano_settimane: true,
      kpi_settimanali: true,
      programma_palestra: true,
    };
    if (!semanticKeyStores[storeName] && !enriched[spec.keyPath]) {
      enriched[spec.keyPath] = generateUuid();
    }
    // Timestamp di update automatico (non sovrascrive se già presente).
    if (!enriched._updatedAt) {
      enriched._updatedAt = nowIso();
    }
    // Campo derivato per l'indice by_attiva dello store allerte.
    if (storeName === STORES.ALLERTE) {
      enriched._attiva = enriched.dataSblocco ? "0" : "1";
    }
    return enriched;
  }

  /**
   * Scrive una entry nello store `log_modifiche`. È un "alias" interno sicuro
   * che NON ri-invoca `put()` pubblico (per evitare ricorsione infinita e per
   * evitare di loggare il logger).
   */
  function appendLogEntry(db, entry) {
    return db.put(STORES.LOG_MODIFICHE, entry);
  }

  /**
   * Costruisce l'entry di log coerente con lo schema dello store.
   */
  function buildLogEntry(entita, entitaId, azione, delta, origine) {
    return {
      id: generateUuid(),
      timestamp: nowIso(),
      entita: String(entita),
      entitaId: entitaId == null ? "" : String(entitaId),
      azione: azione, // "creata" | "modificata" | "eliminata"
      delta: typeof delta === "string" ? delta : JSON.stringify(delta || {}),
      origine: origine || "utente",
    };
  }

  var MaranelloStorage = {
    DB_NAME: DB_NAME,
    DB_VERSION: DB_VERSION,
    STORES: STORES,

    /** Inizializza (o riusa) la connessione al DB. */
    init: function init() {
      return ensureDb().then(function done() {
        return MaranelloStorage;
      });
    },

    /** Chiude la connessione corrente. Utile in test. */
    close: function close() {
      if (!_dbPromise) return Promise.resolve();
      return _dbPromise.then(function closeIt(db) {
        db.close();
        _dbPromise = null;
      });
    },

    generateUuid: generateUuid,

    /**
     * Lettura diretta per chiave primaria.
     * Ritorna il record o `null` se non trovato.
     */
    get: function get(storeName, key) {
      return ensureDb().then(function doGet(db) {
        return db.get(storeName, key).then(function normalize(value) {
          return value === undefined ? null : value;
        });
      });
    },

    /**
     * Scrittura (upsert). Aggiunge `_updatedAt` se mancante, assegna un uuid se
     * lo store lo richiede, ed emette un log_modifiche coerente.
     *
     * options:
     *   - origine: "utente" (default) | "sistema_adattamento" | "sistema_allerta" | "sistema_piano"
     *   - skipLog: true per saltare il log (uso interno / bulk import).
     */
    put: function put(storeName, record, options) {
      options = options || {};
      return ensureDb().then(function doPut(db) {
        var prepared = prepareRecordForPut(storeName, record);
        var spec = STORE_SPECS[storeName];
        var key = prepared[spec.keyPath];
        // Il meta-store log_modifiche non è oggetto di log (evita ricorsione).
        if (storeName === STORES.LOG_MODIFICHE || options.skipLog) {
          return db.put(storeName, prepared).then(function onOk() {
            return prepared;
          });
        }
        // Per determinare azione creata|modificata: facciamo un get preventivo.
        return db.get(storeName, key).then(function onRead(existing) {
          var azione = existing ? "modificata" : "creata";
          var delta = existing
            ? { before: existing, after: prepared }
            : { after: prepared };
          var logEntry = buildLogEntry(
            storeName,
            key,
            azione,
            delta,
            options.origine || "utente"
          );
          // Best-effort: scriviamo record e log in una singola transazione
          // multi-store. Se qualcosa va storto, la transazione è annullata.
          return db
            .tx([storeName, STORES.LOG_MODIFICHE], "readwrite", function writer(stores) {
              stores[storeName].put(prepared);
              stores[STORES.LOG_MODIFICHE].put(logEntry);
            })
            .then(function ok() {
              return prepared;
            });
        });
      });
    },

    /**
     * Cancellazione per chiave primaria + log `eliminata`.
     */
    delete: function del(storeName, key, options) {
      options = options || {};
      return ensureDb().then(function doDelete(db) {
        if (storeName === STORES.LOG_MODIFICHE || options.skipLog) {
          return db.delete(storeName, key);
        }
        return db.get(storeName, key).then(function onRead(existing) {
          if (!existing) {
            // Niente da cancellare, niente da loggare.
            return undefined;
          }
          var logEntry = buildLogEntry(
            storeName,
            key,
            "eliminata",
            { before: existing },
            options.origine || "utente"
          );
          return db.tx(
            [storeName, STORES.LOG_MODIFICHE],
            "readwrite",
            function writer(stores) {
              stores[storeName].delete(key);
              stores[STORES.LOG_MODIFICHE].put(logEntry);
            }
          );
        });
      });
    },

    /**
     * Query generica:
     *   { index?: "by_data", range?: IDBKeyRange, limit?: N }
     * Senza parametri, ritorna tutti i record dello store.
     */
    query: function query(storeName, criteria) {
      criteria = criteria || {};
      return ensureDb().then(function doQuery(db) {
        var promise;
        if (criteria.index) {
          promise = db.getAllFromIndex(storeName, criteria.index, criteria.range);
        } else {
          promise = db.getAll(storeName);
        }
        return promise.then(function applyLimit(rows) {
          if (!Array.isArray(rows)) return [];
          if (typeof criteria.limit === "number" && criteria.limit >= 0) {
            return rows.slice(0, criteria.limit);
          }
          return rows;
        });
      });
    },

    /**
     * Svuota uno store. Operazione distruttiva: il chiamante deve aver già
     * richiesto conferma all'utente. Genera un singolo record in log_modifiche
     * con entitaId="*" e delta={count: N}.
     */
    clear: function clear(storeName, options) {
      options = options || {};
      return ensureDb().then(function doClear(db) {
        if (storeName === STORES.LOG_MODIFICHE || options.skipLog) {
          return db.clear(storeName);
        }
        return db.getAll(storeName).then(function onCount(rows) {
          var count = Array.isArray(rows) ? rows.length : 0;
          var logEntry = buildLogEntry(
            storeName,
            "*",
            "eliminata",
            { count: count },
            options.origine || "utente"
          );
          return db.tx(
            [storeName, STORES.LOG_MODIFICHE],
            "readwrite",
            function writer(stores) {
              stores[storeName].clear();
              stores[STORES.LOG_MODIFICHE].put(logEntry);
            }
          );
        });
      });
    },

    /**
     * API esplicita per casi in cui il log è triggerato indirettamente
     * (es. cambio impostazione via UI multipla, aggregato di più scritture).
     */
    logModifica: function logModifica(entita, entitaId, azione, delta, origine) {
      return ensureDb().then(function doLog(db) {
        var entry = buildLogEntry(entita, entitaId, azione, delta, origine);
        return appendLogEntry(db, entry);
      });
    },
  };

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  global.MaranelloStorage = MaranelloStorage;

  // ---------------------------------------------------------------------------
  // Dev smoke test (facoltativo). Si attiva solo se l'utente chiama
  // window.__DEV_STORAGE_SMOKE__() dalla console. Non viene eseguito in automatico.
  // ---------------------------------------------------------------------------

  global.__DEV_STORAGE_SMOKE__ = function devSmoke() {
    var log = function log(msg, obj) {
      if (global.console && global.console.log) {
        if (obj !== undefined) global.console.log("[smoke]", msg, obj);
        else global.console.log("[smoke]", msg);
      }
    };
    return MaranelloStorage.init()
      .then(function onInit() {
        log("DB pronto (" + DB_NAME + " v" + DB_VERSION + ")");
        var sample = {
          id: "main",
          targetDistanza: "5km",
          dataGara: "2027-03-15",
          pesoTarget: 95,
          pesoTargetOttimale: 93,
          giorniPesata: ["Mon", "Thu"],
          versioneApp: global.APP_VERSION || "0.0.0",
          bootstrapEseguito: false,
          linguaUI: "it",
        };
        return MaranelloStorage.put(STORES.IMPOSTAZIONI, sample, {
          origine: "utente",
        });
      })
      .then(function onPut(saved) {
        log("impostazioni salvate", saved);
        return MaranelloStorage.get(STORES.IMPOSTAZIONI, "main");
      })
      .then(function onGet(readBack) {
        log("impostazioni rilette", readBack);
        return MaranelloStorage.query(STORES.LOG_MODIFICHE, {
          index: "by_timestamp",
        });
      })
      .then(function onLog(entries) {
        log("log_modifiche totali", entries.length);
        log("ultimo log", entries[entries.length - 1]);
        return { ok: true, count: entries.length };
      })
      .catch(function onErr(err) {
        if (global.console && global.console.error) {
          global.console.error("[smoke] errore", err);
        }
        throw err;
      });
  };
})(typeof window !== "undefined" ? window : globalThis);
