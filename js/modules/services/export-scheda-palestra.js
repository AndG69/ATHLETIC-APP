/*
 * Maranello 2027 — App_HTML
 * File: js/modules/services/export-scheda-palestra.js
 *
 * Servizio di export scheda palestra in formato XLSX (SheetJS).
 * Genera un file .xlsx con la scheda della sessione programmata,
 * usando i dati dell'anagrafica (programma_palestra in IndexedDB)
 * come fonte di verità per esercizi, serie, ripetizioni e carico.
 *
 * Espone:
 *   window.MaranelloExportSchedaPalestra
 *   module.exports (per i test vitest)
 *
 * Dipende da: window.XLSX (SheetJS, caricato da assets/vendor/xlsx.full.min.js)
 */

(function initExportSchedaPalestra(global) {
  "use strict";

  /**
   * Formatta una data ISO "YYYY-MM-DD" in formato leggibile "DD/MM/YYYY".
   */
  function formatDataLeggibile(dataIso) {
    if (!dataIso || typeof dataIso !== "string") return dataIso || "";
    var parts = dataIso.split("-");
    if (parts.length !== 3) return dataIso;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  /**
   * Genera e scarica un file .xlsx con la scheda palestra della sessione.
   * Legge gli esercizi dall'anagrafica (programma_palestra) e cerca la data
   * dell'ultima volta che quella seduta è stata eseguita nel diario.
   *
   * @param {object} sessione - Sessione programmata (deve avere numeroCiclo e data)
   */
  function esportaSchedaPalestra(sessione) {
    if (!sessione) {
      if (global.console && global.console.warn) {
        global.console.warn("[export-scheda-palestra] sessione non fornita");
      }
      return;
    }

    var XLSX = global.XLSX;
    if (!XLSX) {
      if (global.console && global.console.error) {
        global.console.error("[export-scheda-palestra] SheetJS (window.XLSX) non disponibile");
      }
      return;
    }

    var Storage = global.MaranelloStorage;
    if (!Storage || typeof Storage.get !== "function") {
      if (global.console && global.console.error) {
        global.console.error("[export-scheda-palestra] MaranelloStorage non disponibile");
      }
      return;
    }

    var numeroCiclo = sessione.numeroCiclo;

    // 1. Leggi l'anagrafica (programma_palestra) per ottenere esercizi/serie/rip/carico
    var anagraficaPromise = Storage.get("programma_palestra", "main")
      .then(function (programma) {
        if (programma && Array.isArray(programma.sedute)) {
          var seduta = programma.sedute.filter(function (s) {
            return s.numeroCiclo === numeroCiclo;
          })[0];
          if (seduta && Array.isArray(seduta.esercizi)) {
            return seduta;
          }
        }
        return null;
      })
      .catch(function () { return null; });

    // 2. Cerca l'ultima data in cui questa seduta (numeroCiclo) è stata eseguita
    var ultimaSedutaPromise = Storage.query("sessioni_palestra")
      .then(function (tutteSessioni) {
        if (!Array.isArray(tutteSessioni) || tutteSessioni.length === 0) return null;

        // Filtra le sessioni che corrispondono a questo numeroCiclo
        var sessioni = tutteSessioni.filter(function (rec) {
          return rec && rec.numeroCiclo === numeroCiclo && rec.data;
        });

        if (sessioni.length === 0) return null;

        // Ordina per data decrescente e prendi la più recente
        sessioni.sort(function (a, b) {
          return a.data > b.data ? -1 : a.data < b.data ? 1 : 0;
        });

        return sessioni[0].data ? sessioni[0].data.slice(0, 10) : null;
      })
      .catch(function () { return null; });

    // 3. Quando entrambe le promise sono risolte, genera l'Excel
    Promise.all([anagraficaPromise, ultimaSedutaPromise]).then(function (results) {
      var sedutaAnagrafica = results[0];
      var dataUltimaSeduta = results[1];

      if (!sedutaAnagrafica) {
        if (global.console && global.console.warn) {
          global.console.warn("[export-scheda-palestra] seduta non trovata in anagrafica per numeroCiclo=" + numeroCiclo);
        }
        return;
      }

      _generaExcel(sessione, sedutaAnagrafica, dataUltimaSeduta, XLSX);
    });
  }

  /**
   * Genera effettivamente il file Excel con i dati dall'anagrafica.
   */
  function _generaExcel(sessione, sedutaAnagrafica, dataUltimaSeduta, XLSX) {
    var numeroCiclo = sessione.numeroCiclo || "";
    var data = sessione.data || "";
    var dataLeggibile = formatDataLeggibile(data);
    var esercizi = sedutaAnagrafica.esercizi || [];

    // ---------------------------------------------------------------------------
    // Costruzione righe del foglio
    // ---------------------------------------------------------------------------

    var righe = [];

    // Riga 1: titolo "Scheda Seduta X — DD/MM/YYYY"
    righe.push(["Scheda Seduta " + numeroCiclo + " — " + dataLeggibile, "", "", "", "", ""]);

    // Riga 2: ultima seduta (se disponibile)
    if (dataUltimaSeduta) {
      righe.push(["Ultima seduta: " + formatDataLeggibile(dataUltimaSeduta), "", "", "", "", ""]);
    }

    // Riga intestazioni
    righe.push(["Esercizio", "Gruppo", "Serie", "Ripetizioni", "Carico (kg)", "Note"]);

    // Righe esercizi dall'anagrafica
    esercizi.forEach(function (es) {
      var nome = typeof es === "string" ? es : es.nome;
      var gruppo = es.gruppo || "";
      var serie = es.serie != null ? es.serie : 4;
      var ripetizioni = es.ripetizioni != null ? es.ripetizioni : "";
      var carico = es.carico != null ? es.carico : "";

      righe.push([nome, gruppo, serie, ripetizioni, carico, ""]);
    });

    // Riga vuota separatrice
    righe.push(["", "", "", "", "", ""]);

    // Ultima riga: note fisse
    righe.push(["RPE target: 6 | Tapis: 20 min piramide 0\u219215%\u21920%", "", "", "", "", ""]);

    // ---------------------------------------------------------------------------
    // Creazione workbook SheetJS
    // ---------------------------------------------------------------------------

    var ws = XLSX.utils.aoa_to_sheet(righe);

    // Larghezze colonne adeguate ai contenuti
    ws["!cols"] = [
      { wch: 35 }, // Esercizio
      { wch: 14 }, // Gruppo
      { wch: 6 },  // Serie
      { wch: 12 }, // Ripetizioni
      { wch: 10 }, // Carico (kg)
      { wch: 20 }, // Note
    ];

    // Merge: riga titolo (riga 0)
    var merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

    // Merge: riga "Ultima seduta" se presente (riga 1)
    if (dataUltimaSeduta) {
      merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: 5 } });
    }

    // Merge: riga vuota separatrice e riga note finali
    var ultimaRigaIdx = righe.length - 1;
    merges.push({ s: { r: ultimaRigaIdx - 1, c: 0 }, e: { r: ultimaRigaIdx - 1, c: 5 } });
    merges.push({ s: { r: ultimaRigaIdx, c: 0 }, e: { r: ultimaRigaIdx, c: 5 } });

    ws["!merges"] = merges;

    var nomeFoglio = "Seduta " + numeroCiclo;
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, nomeFoglio);

    // ---------------------------------------------------------------------------
    // Download
    // ---------------------------------------------------------------------------

    var nomeFile = "scheda_palestra_seduta_" + numeroCiclo + "_" + (data || "export") + ".xlsx";
    XLSX.writeFile(wb, nomeFile);
  }

  // ---------------------------------------------------------------------------
  // Esposizione
  // ---------------------------------------------------------------------------

  var api = {
    esportaSchedaPalestra: esportaSchedaPalestra,
  };

  global.MaranelloExportSchedaPalestra = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
