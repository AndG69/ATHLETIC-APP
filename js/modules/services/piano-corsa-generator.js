/*
 * Maranello 2027 — App_HTML
 * File: js/modules/services/piano-corsa-generator.js
 *
 * Generatore del piano mensile corsa (Task 1).
 * Produce un array di sessioni programmate per il mese richiesto,
 * seguendo la progressione walk-run a 16 settimane.
 *
 * Espone:
 *   window.MaranelloPianoCorsaGenerator
 *   module.exports (per i test vitest)
 *
 * Ref: Req 15.x, progressione walk-run soggetto
 */

(function initPianoCorsaGenerator(global) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Progressione walk-run 16 settimane
  // Sett 1: 900m camm + 100m corsa × 5 rip
  // Sett 2: 800m camm + 200m corsa × 5 rip
  // ...
  // Sett 10: 0m camm + 1000m corsa × 5 rip (5 km continui)
  // Sett 11-16: consolidamento/progressione distanza
  // ---------------------------------------------------------------------------

  var PROGRESSIONE = (function buildProgressione() {
    var prog = [];
    for (var s = 1; s <= 16; s++) {
      var cammMetri, corsaMetri, ripetizioni;
      if (s <= 10) {
        cammMetri = (10 - s) * 100;   // 900, 800, ..., 0
        corsaMetri = s * 100;          // 100, 200, ..., 1000
        ripetizioni = 5;
      } else {
        // Sett 11-16: consolidamento — 5 km continui + progressione distanza
        // Sett 11: 5 km (1000m × 5), Sett 12: 6 km (1200m × 5), ecc.
        cammMetri = 0;
        corsaMetri = 1000 + (s - 10) * 200; // 1200, 1400, ..., 2200
        ripetizioni = 5;
      }
      prog.push({
        settimana: s,
        cammMetri: cammMetri,
        corsaMetri: corsaMetri,
        ripetizioni: ripetizioni,
      });
    }
    return prog;
  })();

  /**
   * Calcola la durata stimata in minuti per uno schema walk-run.
   * Passo camminata: 10 min/km; passo corsa: 6 min/km.
   */
  function calcolaDurataStimata(schema) {
    var durataPerRip =
      (schema.cammMetri / 1000) * 10 + (schema.corsaMetri / 1000) * 6;
    return Math.round(durataPerRip * schema.ripetizioni);
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  /**
   * Ritorna il numero di settimana ISO (1-53) per una data.
   */
  function getIsoWeekNumber(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  /**
   * Ritorna il numero di settimane ISO in un anno (52 o 53).
   */
  function getIsoWeeksInYear(year) {
    var dec28 = new Date(Date.UTC(year, 11, 28));
    return getIsoWeekNumber(dec28);
  }

  /**
   * Calcola la differenza in settimane ISO tra due date.
   * Positivo se dataB è dopo dataA.
   */
  function deltaSettimaneIso(dataA, dataB) {
    var wA = getIsoWeekNumber(dataA);
    var wB = getIsoWeekNumber(dataB);
    var yA = dataA.getFullYear();
    var yB = dataB.getFullYear();

    if (yA === yB) {
      return wB - wA;
    }
    // Anno diverso: somma le settimane degli anni intermedi
    var delta = 0;
    if (yB > yA) {
      // Settimane rimanenti nell'anno A
      delta += getIsoWeeksInYear(yA) - wA;
      // Anni interi intermedi
      for (var y = yA + 1; y < yB; y++) {
        delta += getIsoWeeksInYear(y);
      }
      // Settimane nell'anno B
      delta += wB;
    } else {
      // dataB è prima di dataA (delta negativo)
      delta -= getIsoWeeksInYear(yB) - wB;
      for (var y2 = yB + 1; y2 < yA; y2++) {
        delta -= getIsoWeeksInYear(y2);
      }
      delta -= wA;
    }
    return delta;
  }

  /**
   * Genera il piano mensile corsa.
   *
   * @param {number} anno  - Anno (es. 2026)
   * @param {number} mese  - Mese 1-12
   * @param {number} settimanaCorrente - Settimana progressione corrente (1-16)
   *   Si applica alla settimana ISO che contiene `dataRiferimento`.
   * @param {object} opzioni - {
   *   giorniCorsa: [6, 0],       // sab=6, dom=0
   *   dataRiferimento: Date      // default: oggi
   * }
   * @returns {Array} Array di sessioni programmate
   */
  function generaPianoMensileCorsa(anno, mese, settimanaCorrente, opzioni) {
    opzioni = opzioni || {};
    var giorniCorsa = opzioni.giorniCorsa || [6, 0]; // sabato e domenica

    // Data di riferimento: la settimana ISO di questa data ha settimanaCorrente.
    // Default: oggi.
    var dataRif = opzioni.dataRiferimento instanceof Date
      ? opzioni.dataRiferimento
      : new Date();

    var mese0 = mese - 1; // mese 0-based per Date
    var giorniNelMese = new Date(anno, mese0 + 1, 0).getDate();

    var sessioni = [];

    // Per ogni giorno del mese, verifichiamo se è un giorno di corsa
    for (var giorno = 1; giorno <= giorniNelMese; giorno++) {
      var dataGiorno = new Date(anno, mese0, giorno);
      var dayOfWeek = dataGiorno.getDay();

      if (giorniCorsa.indexOf(dayOfWeek) === -1) continue;

      // Calcola la settimana di progressione per questo giorno.
      // La progressione avanza ogni 2 settimane ISO: ogni coppia di settimane
      // (sab+dom della sett N e sab+dom della sett N+1) usa lo stesso schema,
      // poi si avanza di 1 livello.
      //
      // Esempio con dataRif=9 mag (sett ISO 19), settimanaCorrente=2:
      //   sett ISO 19 (9-10 mag)  → delta=0  → coppia 0 → sett 2
      //   sett ISO 20 (16-17 mag) → delta=1  → coppia 1 → sett 3
      //   sett ISO 21 (23-24 mag) → delta=2  → coppia 1 → sett 3
      //   sett ISO 22 (30-31 mag) → delta=3  → coppia 2 → sett 4
      //
      // Formula: coppia = ceil(delta / 2) per delta > 0
      //                   floor(delta / 2) per delta < 0 (settimane passate)
      var deltaSettimane = deltaSettimaneIso(dataRif, dataGiorno);
      var deltaProgressione;
      if (deltaSettimane > 0) {
        deltaProgressione = Math.ceil(deltaSettimane / 2);
      } else if (deltaSettimane < 0) {
        deltaProgressione = -Math.ceil(-deltaSettimane / 2);
      } else {
        deltaProgressione = 0;
      }
      var settimanaProgressione = settimanaCorrente + deltaProgressione;

      // Clamp tra 1 e 16
      settimanaProgressione = Math.max(1, Math.min(16, settimanaProgressione));

      var schema = PROGRESSIONE[settimanaProgressione - 1];
      var durataStimataMin = calcolaDurataStimata(schema);

      var dataIso = anno + "-" + pad2(mese) + "-" + pad2(giorno);
      var nomeSessione = "Corsa sett. " + settimanaProgressione + " — " +
        schema.corsaMetri + "m corsa / " + schema.cammMetri + "m camm × " +
        schema.ripetizioni;

      sessioni.push({
        data: dataIso,
        tipo: "corsa",
        settimanaProgressione: settimanaProgressione,
        schemaWalkRun: {
          cammMetri: schema.cammMetri,
          corsaMetri: schema.corsaMetri,
          ripetizioni: schema.ripetizioni,
        },
        durataStimataMin: durataStimataMin,
        zonaFC: "Z2",
        rpeTarget: 6,
        nomeSessione: nomeSessione,
        stato: "Programmata",
      });
    }

    return sessioni;
  }

  // ---------------------------------------------------------------------------
  // Esposizione
  // ---------------------------------------------------------------------------

  var api = {
    generaPianoMensileCorsa: generaPianoMensileCorsa,
    PROGRESSIONE: PROGRESSIONE,
    calcolaDurataStimata: calcolaDurataStimata,
  };

  global.MaranelloPianoCorsaGenerator = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
