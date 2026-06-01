/*
 * Maranello 2027 — App_HTML
 * File: js/modules/services/peso-stats.js
 *
 * Helper di calcolo statistico per le pesate. È volutamente puro (nessuna
 * dipendenza da IndexedDB o DOM) per essere testabile in isolamento e
 * riutilizzabile da vista Peso, Dashboard e KPI.
 *
 * Ref: Req 18.1 (media mobile 7 giorni), 23.3 (aggregato al volo)
 *
 * Espone API su window.MaranelloPesoStats:
 *   - calcolaMediaMobile7gg(records, riferimento?) → { media, count, da, a }
 *   - parsePesoInput(raw) → number | null  (accetta "100,5" e "100.5")
 *   - formatKg(value, decimali=1) → stringa italiana con virgola, es. "100,5"
 *   - ordinaPerDataDesc(records) → array ordinato dal più recente
 */

(function initPesoStats(global) {
  "use strict";

  var GIORNI_FINESTRA = 7;
  var MS_GIORNO = 24 * 60 * 60 * 1000;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Converte una data ISO (datetime o YYYY-MM-DD) in oggetto Date.
   * Ritorna null per input non parsabili o NaN.
   */
  function toDate(value) {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value !== "string" || value.length === 0) return null;
    var d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /**
   * Accetta input utente italiano o tecnico: "100,5" e "100.5" sono
   * equivalenti. Ritorna un numero finito o null se non parsabile.
   */
  function parsePesoInput(raw) {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw !== "string") return null;
    var normalized = raw.trim().replace(/\s+/g, "").replace(",", ".");
    if (normalized.length === 0) return null;
    var n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Formatta un peso in stile italiano con la virgola. Protetto contro
   * NaN/undefined: ritorna stringa vuota.
   */
  function formatKg(value, decimali) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "";
    var d = typeof decimali === "number" ? decimali : 1;
    return value.toFixed(d).replace(".", ",");
  }

  /**
   * Ordina una copia dei record per `data` discendente (più recente prima).
   * Record senza data parsabile finiscono in coda.
   */
  function ordinaPerDataDesc(records) {
    if (!Array.isArray(records)) return [];
    return records.slice().sort(function byDateDesc(a, b) {
      var ta = toDate(a && a.data);
      var tb = toDate(b && b.data);
      if (ta && tb) return tb.getTime() - ta.getTime();
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      return 0;
    });
  }

  // ---------------------------------------------------------------------------
  // Media mobile 7 giorni
  // ---------------------------------------------------------------------------

  /**
   * Calcola la media mobile dei pesi su una finestra scorrevole di 7 giorni
   * a partire dal riferimento (default: ora). La finestra include record
   * con `data` in [riferimento - 7 giorni ; riferimento], estremi inclusi.
   *
   * @param {Array<{data: string, pesoKg: number}>} records
   * @param {Date|string} [riferimento]  default: ora corrente
   * @returns {{ media: number|null, count: number, da: string|null, a: string|null }}
   */
  function calcolaMediaMobile7gg(records, riferimento) {
    var ref = toDate(riferimento) || new Date();
    var limiteInferiore = new Date(ref.getTime() - GIORNI_FINESTRA * MS_GIORNO);

    if (!Array.isArray(records) || records.length === 0) {
      return {
        media: null,
        count: 0,
        da: limiteInferiore.toISOString(),
        a: ref.toISOString(),
      };
    }

    var somma = 0;
    var count = 0;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (!r || typeof r.pesoKg !== "number" || !Number.isFinite(r.pesoKg)) {
        continue;
      }
      var dt = toDate(r.data);
      if (!dt) continue;
      if (dt.getTime() < limiteInferiore.getTime()) continue;
      if (dt.getTime() > ref.getTime()) continue;
      somma += r.pesoKg;
      count += 1;
    }

    return {
      media: count > 0 ? somma / count : null,
      count: count,
      da: limiteInferiore.toISOString(),
      a: ref.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  var api = {
    calcolaMediaMobile7gg: calcolaMediaMobile7gg,
    parsePesoInput: parsePesoInput,
    formatKg: formatKg,
    ordinaPerDataDesc: ordinaPerDataDesc,
  };

  global.MaranelloPesoStats = api;

  // Esportazione compatibile con ambienti CommonJS/ESM se un eventuale
  // tooling dovesse richiederla in futuro.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
