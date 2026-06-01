/*
 * Maranello 2027 — App_HTML
 * File: js/modules/services/oggi-utils.js
 *
 * Helper puri per la vista Oggi (Task 6.1).
 *   - `toIsoWeekId(date)`       → "YYYY-Www" (ISO 8601 settimana)
 *   - `formatDateIso(date)`     → "YYYY-MM-DD"
 *   - `trovaSessioneDelGiorno(settimana, dataIso)` → sessione | null
 *   - `storePerTipoSessione(tipo)` → nome store IndexedDB per la persistenza
 *     di una sessione corsa/palestra/nuoto.
 *
 * Nessuna dipendenza DOM o IndexedDB: il modulo è testabile in isolamento
 * e importabile anche dal Sistema_Piano futuro (macrociclo, Task 15).
 *
 * Ref: Req 22.4.a, 22.8, 23.1
 */

(function initOggiUtils(global) {
  "use strict";

  /**
   * Calcola l'ID ISO 8601 della settimana per una data.
   * Formato "YYYY-Www", es. "2026-W19". Ref: Wikipedia ISO 8601 (§4.1.4.2).
   *
   * Algoritmo:
   *   1. Normalizza la data a UTC mezzogiorno per evitare ambiguità DST.
   *   2. Trasla al giovedì della stessa settimana ISO (1=Mon..7=Sun).
   *   3. L'anno ISO è l'anno del giovedì.
   *   4. Il numero di settimana è ⌈((giorno_giuliano - 1ᵒ_gennaio) / 7)⌉.
   */
  function toIsoWeekId(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    var d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    var dayNum = d.getUTCDay() || 7; // dom=0 → 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return d.getUTCFullYear() + "-W" + String(weekNum).padStart(2, "0");
  }

  /** YYYY-MM-DD locale per `sessione.data`. */
  function formatDateIso(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  /**
   * Cerca la sessione del giorno fra quelle programmate della settimana.
   * Il record `piano_settimane` ha la forma:
   *   { id: "YYYY-Www", sessioniProgrammate: [ { data: "YYYY-MM-DD", ... }, ... ] }
   * La prima sessione con data === `dataIso` viene restituita; null altrimenti.
   */
  function trovaSessioneDelGiorno(settimana, dataIso) {
    if (!settimana) return null;
    var sessioni = settimana.sessioniProgrammate;
    if (!Array.isArray(sessioni)) return null;
    for (var i = 0; i < sessioni.length; i++) {
      var s = sessioni[i];
      if (s && s.data === dataIso) return s;
    }
    return null;
  }

  /**
   * Mappa il tipo di sessione allo store IndexedDB coerente.
   * Ritorna null se il tipo non è riconosciuto: il chiamante può decidere
   * se trattarlo come errore oppure cadere su un default.
   */
  function storePerTipoSessione(tipo) {
    switch (tipo) {
      case "corsa":
        return "sessioni_corsa";
      case "palestra":
        return "sessioni_palestra";
      case "nuoto":
        return "sessioni_nuoto";
      default:
        return null;
    }
  }

  var api = {
    toIsoWeekId: toIsoWeekId,
    formatDateIso: formatDateIso,
    trovaSessioneDelGiorno: trovaSessioneDelGiorno,
    storePerTipoSessione: storePerTipoSessione,
  };

  global.MaranelloOggiUtils = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
