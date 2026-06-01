/*
 * Maranello 2027 — App_HTML
 * File: js/modules/services/sessioni-utils.js
 *
 * Helper puri per i form post-sessione (corsa / palestra) e per i diari
 * (Task 7, 8, 12, 13). Questo modulo è il posto unico in cui:
 *   - si parsano numeri in formato italiano ("12,5" e "12.5" equivalenti);
 *   - si parsano tempi in formato mm:ss o m'ss";
 *   - si serializzano / parsano coppie dolore (sede + intensità);
 *   - si raggruppano sessioni per ISO week o si filtrano per periodo / stato.
 *
 * Nessuna dipendenza DOM o IndexedDB: il modulo è testabile in isolamento
 * (vedi tests/unit/sessioni-utils.test.js).
 *
 * Espone API su `window.MaranelloSessioniUtils` e come default export
 * CommonJS per i test.
 *
 * Ref: Req 10.1, 10.2, 10.3, 22.4.c, 22.4.d, 22.5
 */

(function initSessioniUtils(global) {
  "use strict";

  var MS_GIORNO = 24 * 60 * 60 * 1000;

  // ---------------------------------------------------------------------------
  // Numeri
  // ---------------------------------------------------------------------------

  /**
   * Converte un input utente in numero finito.
   * Accetta "12,5", "12.5", 12.5. Ritorna null se non parsabile o vuoto.
   */
  function parseNumero(raw) {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw !== "string") return null;
    var normalized = raw.trim().replace(/\s+/g, "").replace(",", ".");
    if (normalized.length === 0) return null;
    var n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Formatta un numero in stile italiano (virgola decimale). Mantiene i
   * decimali richiesti (default: tutti quelli significativi fino a 2).
   */
  function formatNumero(value, decimali) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "";
    var d = typeof decimali === "number" ? decimali : undefined;
    var str = d === undefined ? String(value) : value.toFixed(d);
    return str.replace(".", ",");
  }

  // ---------------------------------------------------------------------------
  // Tempi mm:ss / m'ss"
  // ---------------------------------------------------------------------------

  /**
   * Converte una stringa "m:ss", "mm:ss" o "m'ss\"" in secondi totali.
   * Ritorna null per input non parsabili o vuoti.
   *
   * Esempi validi:
   *   "5:30"    → 330
   *   "5'30\""  → 330
   *   "12:00"   → 720
   *   "0:45"    → 45
   */
  function parseTempoMinSec(raw) {
    if (typeof raw !== "string") {
      if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
        return Math.round(raw);
      }
      return null;
    }
    var s = raw.trim();
    if (s.length === 0) return null;

    // Normalizziamo "5'30\"" in "5:30".
    s = s.replace(/['\u2019]/g, ":").replace(/[\"\u201D]/g, "");

    var parts = s.split(":");
    if (parts.length !== 2) return null;
    var minuti = Number(parts[0]);
    var secondi = Number(parts[1]);
    if (!Number.isFinite(minuti) || !Number.isFinite(secondi)) return null;
    if (minuti < 0 || secondi < 0 || secondi >= 60) return null;
    return Math.round(minuti * 60 + secondi);
  }

  /** Inverso di parseTempoMinSec. 330 → "5:30". */
  function formatTempoMinSec(totalSeconds) {
    if (typeof totalSeconds !== "number" || !Number.isFinite(totalSeconds)) {
      return "";
    }
    var s = Math.max(0, Math.round(totalSeconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  }

  // ---------------------------------------------------------------------------
  // Dolori
  // ---------------------------------------------------------------------------

  /**
   * Combina una lista CSV di sedi anatomiche e una lista CSV di intensità
   * in un array di oggetti {sede, intensita}. Le due liste devono avere
   * lo stesso numero di elementi non vuoti; in caso di disallineamento si
   * troncano alla lunghezza minore. Ritorna [] per input vuoti.
   *
   * Esempi:
   *   parseDolori("ginocchio dx, polpaccio sx", "3, 2")
   *     → [{sede:"ginocchio dx", intensita:3}, {sede:"polpaccio sx", intensita:2}]
   *   parseDolori("", "") → []
   */
  function parseDolori(sediRaw, intensitaRaw) {
    var sedi = splitCsv(sediRaw);
    var intensita = splitCsv(intensitaRaw);
    var n = Math.min(sedi.length, intensita.length);
    var out = [];
    for (var i = 0; i < n; i++) {
      var num = parseNumero(intensita[i]);
      if (num == null) continue;
      // Clamp nel range [0,10]: intensità fuori range vengono scartate.
      if (num < 0 || num > 10) continue;
      out.push({ sede: sedi[i], intensita: num });
    }
    return out;
  }

  /** Format human: "ginocchio dx (3/10), polpaccio sx (2/10)". */
  function formatDolori(dolori) {
    if (!Array.isArray(dolori) || dolori.length === 0) return "";
    return dolori
      .filter(function keep(d) {
        return d && typeof d.sede === "string" && d.sede.length > 0;
      })
      .map(function toStr(d) {
        return d.sede + " (" + d.intensita + "/10)";
      })
      .join(", ");
  }

  /** Split CSV con trim, scartando elementi vuoti. */
  function splitCsv(raw) {
    if (typeof raw !== "string") return [];
    return raw
      .split(",")
      .map(function tr(s) {
        return s.trim();
      })
      .filter(function notEmpty(s) {
        return s.length > 0;
      });
  }

  // ---------------------------------------------------------------------------
  // Ripetizioni palestra
  // ---------------------------------------------------------------------------

  /**
   * Parsing del campo ripetizioni di palestra. Accetta:
   *   - Una singola stringa "10" → [10, 10, ..., 10] (lunghezza = serie)
   *   - CSV "10,10,9,8" → [10, 10, 9, 8] (troncato o paddato a `serie`)
   *   - numero puro 10 → come singola stringa
   *
   * I valori non finiti o negativi vengono sostituiti da 0.
   * Ritorna sempre un array di lunghezza `serie`.
   */
  function parseRipetizioni(raw, serie) {
    var len = typeof serie === "number" && serie > 0 ? Math.round(serie) : 1;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return repeatArray(Math.max(0, Math.round(raw)), len);
    }
    if (typeof raw !== "string") {
      return repeatArray(0, len);
    }
    var parts = splitCsv(raw);
    if (parts.length === 0) return repeatArray(0, len);
    if (parts.length === 1) {
      var n = parseNumero(parts[0]);
      return repeatArray(n == null || n < 0 ? 0 : Math.round(n), len);
    }
    var arr = [];
    for (var i = 0; i < parts.length; i++) {
      var v = parseNumero(parts[i]);
      arr.push(v == null || v < 0 ? 0 : Math.round(v));
    }
    // Pad con l'ultimo valore se mancano elementi, tronca se abbondano.
    while (arr.length < len) arr.push(arr[arr.length - 1]);
    if (arr.length > len) arr = arr.slice(0, len);
    return arr;
  }

  function repeatArray(value, n) {
    var arr = new Array(n);
    for (var i = 0; i < n; i++) arr[i] = value;
    return arr;
  }

  // ---------------------------------------------------------------------------
  // Raggruppamento e filtri
  // ---------------------------------------------------------------------------

  /**
   * Raggruppa un array di record (ciascuno con campo `data` ISO) per ISO
   * week id usando `toIsoWeekId` fornito dal chiamante (tipicamente
   * `window.MaranelloOggiUtils.toIsoWeekId`). Ritorna una Map
   * <string, Array<record>> in ordine cronologico decrescente di settimana
   * e, all'interno di ciascuna, record ordinati per data discendente.
   */
  function raggruppaPerSettimana(records, toIsoWeekId) {
    if (!Array.isArray(records) || typeof toIsoWeekId !== "function") {
      return new Map();
    }
    var map = new Map();
    records.forEach(function add(rec) {
      if (!rec || !rec.data) return;
      var dt = toDate(rec.data);
      if (!dt) return;
      // Se il record ha già un `settimanaId` popolato lo preferiamo,
      // altrimenti lo calcoliamo dalla data: questo rende il raggruppamento
      // coerente anche per sessioni saltate/micro salvate senza piano.
      var weekId = rec.settimanaId || toIsoWeekId(dt);
      if (!weekId) return;
      if (!map.has(weekId)) map.set(weekId, []);
      map.get(weekId).push(rec);
    });
    // Ordina record interni per data desc.
    map.forEach(function sortBucket(arr) {
      arr.sort(function cmp(a, b) {
        var ta = toDate(a.data);
        var tb = toDate(b.data);
        if (ta && tb) return tb.getTime() - ta.getTime();
        return 0;
      });
    });
    // Ordina la map stessa in ordine settimana desc (chiavi alfabeticamente
    // in ISO "YYYY-Www" l'ordinamento lessicale coincide con quello
    // temporale, con l'eccezione delle settimane a cavallo di gennaio;
    // qui basta l'ordine lessicale reverse).
    var keys = Array.from(map.keys()).sort().reverse();
    var sorted = new Map();
    keys.forEach(function push(k) {
      sorted.set(k, map.get(k));
    });
    return sorted;
  }

  /**
   * Filtra un array di record tenendo solo quelli con `data` negli ultimi
   * `giorni` giorni rispetto a `riferimento` (default: ora). Se `giorni`
   * è 0, null o negativo, ritorna l'array originale.
   */
  function filtraPerPeriodo(records, giorni, riferimento) {
    if (!Array.isArray(records)) return [];
    if (typeof giorni !== "number" || !Number.isFinite(giorni) || giorni <= 0) {
      return records.slice();
    }
    var ref = toDate(riferimento) || new Date();
    var limite = new Date(ref.getTime() - giorni * MS_GIORNO);
    return records.filter(function inRange(rec) {
      if (!rec) return false;
      var dt = toDate(rec.data);
      if (!dt) return false;
      return dt.getTime() >= limite.getTime() && dt.getTime() <= ref.getTime();
    });
  }

  /**
   * Filtra per stato esatto ("Completa", "Micro", "Saltata", "Programmata").
   * Se `stato` è null, undefined o stringa vuota, ritorna una copia non
   * filtrata.
   */
  function filtraPerStato(records, stato) {
    if (!Array.isArray(records)) return [];
    if (!stato) return records.slice();
    return records.filter(function match(rec) {
      return rec && rec.stato === stato;
    });
  }

  // ---------------------------------------------------------------------------
  // Aggregati semplici per la vista diario
  // ---------------------------------------------------------------------------

  /** Somma i tempiPerKm (array di secondi) di un record corsa. */
  function sommaTempiKm(tempiPerKm) {
    if (!Array.isArray(tempiPerKm)) return 0;
    var tot = 0;
    for (var i = 0; i < tempiPerKm.length; i++) {
      var v = tempiPerKm[i];
      if (typeof v === "number" && Number.isFinite(v) && v > 0) tot += v;
    }
    return tot;
  }

  /** Conta esercizi totali in una sessione palestra. */
  function contaEsercizi(gruppi) {
    if (!Array.isArray(gruppi)) return 0;
    var n = 0;
    for (var i = 0; i < gruppi.length; i++) {
      var g = gruppi[i];
      if (g && Array.isArray(g.esercizi)) n += g.esercizi.length;
    }
    return n;
  }

  // ---------------------------------------------------------------------------
  // Date helpers interni
  // ---------------------------------------------------------------------------

  function toDate(value) {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value !== "string" || value.length === 0) return null;
    var d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** Ricava gli estremi di una settimana ISO "YYYY-Www" come {inizio, fine} Date. */
  function settimanaIsoBounds(weekId) {
    if (typeof weekId !== "string") return null;
    var m = /^(\d{4})-W(\d{2})$/.exec(weekId);
    if (!m) return null;
    var year = Number(m[1]);
    var week = Number(m[2]);
    // ISO: il lunedì della settimana 1 contiene il primo giovedì dell'anno.
    var jan4 = new Date(Date.UTC(year, 0, 4));
    var day = jan4.getUTCDay() || 7;
    var mondayW1 = new Date(jan4.getTime() - (day - 1) * MS_GIORNO);
    var inizio = new Date(mondayW1.getTime() + (week - 1) * 7 * MS_GIORNO);
    var fine = new Date(inizio.getTime() + 6 * MS_GIORNO);
    return { inizio: inizio, fine: fine };
  }

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  var api = {
    parseNumero: parseNumero,
    formatNumero: formatNumero,
    parseTempoMinSec: parseTempoMinSec,
    formatTempoMinSec: formatTempoMinSec,
    parseDolori: parseDolori,
    formatDolori: formatDolori,
    parseRipetizioni: parseRipetizioni,
    raggruppaPerSettimana: raggruppaPerSettimana,
    filtraPerPeriodo: filtraPerPeriodo,
    filtraPerStato: filtraPerStato,
    sommaTempiKm: sommaTempiKm,
    contaEsercizi: contaEsercizi,
    settimanaIsoBounds: settimanaIsoBounds,
  };

  global.MaranelloSessioniUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
