/*
 * Maranello 2027 — App_HTML
 * File: js/modules/services/piano-palestra-generator.js
 *
 * Generatore del piano mensile palestra (Task 2).
 * Produce un array di sessioni programmate per il mese richiesto,
 * seguendo il ciclo di 6 sedute.
 *
 * Espone:
 *   window.MaranelloPianoGymGenerator
 *   module.exports (per i test vitest)
 *
 * Ref: Req 15.x, ciclo palestra soggetto
 */

(function initPianoGymGenerator(global) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Ciclo palestra: 6 sedute, poi ricomincia.
  // I nomi degli esercizi corrispondono ESATTAMENTE al catalogo
  // in js/data/esercizi-catalog.js per permettere il lookup dei carichi.
  // ---------------------------------------------------------------------------

  var CICLO_PALESTRA = [
    {
      numeroCiclo: 1,
      nome: "Seduta A",
      esercizi: [
        "Panca Piana bilancere",
        "Seated Row",
        "Squat corpo libero",
        "Leg Press",
        "Curl Manubri",
        "French press cavo alto",
      ],
    },
    {
      numeroCiclo: 2,
      nome: "Seduta B",
      esercizi: [
        "Chest Press",
        "Lat Machine presa larga",
        "Leg Press",
        "Leg Curl sdraiato",
        "Curl a Martello",
        "Push down Ercolina",
      ],
    },
    {
      numeroCiclo: 3,
      nome: "Seduta C",
      esercizi: [
        "Croci Manubri panca piana",
        "Alzate posteriori pronospinate",
        "Panca presa stretta bilancere",
        "Plank laterale",
        "Panca Scott",
        "Lat Machine presa inversa",
      ],
    },
    {
      numeroCiclo: 4,
      nome: "Seduta D",
      esercizi: [
        "Shoulder press",
        "Trazioni assistite",
        "Leg Extension",
        "Leg Curl sdraiato",
        "Curl a Martello",
        "Push down inverso",
      ],
    },
    {
      numeroCiclo: 5,
      nome: "Seduta E",
      esercizi: [
        "Incline press",
        "Incline Level Row",
        "Leg Press",
        "Leg Curl sdraiato",
        "Curl Cavo basso (ercolina)",
        "Panca presa stretta bilancere",
      ],
    },
    {
      numeroCiclo: 6,
      nome: "Seduta F",
      esercizi: [
        "Alzate laterali - Macchinario",
        "Pull Over con manubrio",
        "Squat corpo libero",
        "Leg Extension",
        "Panca Scott",
        "French press cavo alto",
      ],
    },
  ];

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  /**
   * Genera il piano mensile palestra.
   *
   * Cadenza: seduta → 2 giorni di riposo → seduta → 2 giorni di riposo → ...
   * Mai nel weekend (sabato=6, domenica=0).
   * La distanza minima tra due sedute è 3 giorni di calendario
   * (es. lunedì → giovedì, martedì → venerdì, mercoledì → lunedì settimana dopo).
   *
   * @param {number} anno  - Anno (es. 2026)
   * @param {number} mese  - Mese 1-12
   * @param {object} ultimaSessione - { data: 'YYYY-MM-DD', numeroCiclo: 3 }
   * @param {object} opzioni - (non usato, mantenuto per compatibilità API)
   * @param {Array}  programma - (opzionale) array di sedute dal programma personalizzato.
   *                             Se non fornito, usa CICLO_PALESTRA come fallback.
   * @returns {Array} Array di sessioni programmate
   */
  function generaPianoPalestraMensile(anno, mese, ultimaSessione, opzioni, programma) {
    ultimaSessione = ultimaSessione || { data: null, numeroCiclo: 0 };
    var ultimoNumeroCiclo = ultimaSessione.numeroCiclo || 0;

    // Usa il programma passato oppure il CICLO_PALESTRA hardcoded come fallback
    var ciclo = (Array.isArray(programma) && programma.length > 0) ? programma : CICLO_PALESTRA;
    var cicloLen = ciclo.length;

    var mese0 = mese - 1;
    var giorniNelMese = new Date(anno, mese0 + 1, 0).getDate();

    // Prossima seduta del ciclo (dopo l'ultima)
    var prossimoCicloIdx = ultimoNumeroCiclo % cicloLen; // 0-based index del prossimo

    var sessioni = [];
    var ultimaDataPalestra = ultimaSessione.data
      ? parseDataIso(ultimaSessione.data)
      : null;

    for (var giorno = 1; giorno <= giorniNelMese; giorno++) {
      var dataGiorno = new Date(anno, mese0, giorno);
      var dayOfWeek = dataGiorno.getDay(); // 0=dom, 1=lun, ..., 6=sab

      // MAI nel weekend (sabato=6, domenica=0): ci sono già le sessioni di corsa
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // Rispetta la cadenza: seduta → 2 giorni feriali di riposo → seduta.
      // Sabato e domenica non contano come giorni di riposo (sono giorni di corsa).
      // Quindi si contano solo i giorni lun-ven tra le due sedute.
      if (ultimaDataPalestra !== null) {
        var giorniFerialiRiposo = 0;
        var cursore = new Date(ultimaDataPalestra.getFullYear(), ultimaDataPalestra.getMonth(), ultimaDataPalestra.getDate() + 1);
        while (cursore < dataGiorno) {
          var dowCursore = cursore.getDay();
          if (dowCursore !== 0 && dowCursore !== 6) {
            giorniFerialiRiposo++;
          }
          cursore.setDate(cursore.getDate() + 1);
        }
        if (giorniFerialiRiposo < 2) continue;
      }

      var seduta = ciclo[prossimoCicloIdx];
      var dataIso = anno + "-" + pad2(mese) + "-" + pad2(giorno);

      // Costruisce la lista esercizi: se la seduta ha oggetti esercizio completi,
      // usa i nomi; altrimenti usa direttamente l'array (compatibilità con CICLO_PALESTRA).
      var eserciziSeduta = seduta.esercizi || [];
      var eserciziNomi = eserciziSeduta.map(function (es) {
        return typeof es === "string" ? es : es.nome;
      });

      sessioni.push({
        data: dataIso,
        tipo: "palestra",
        numeroCiclo: seduta.numeroCiclo,
        nomeSeduta: seduta.nome,
        esercizi: eserciziNomi,
        serie: 4,
        repsRange: "6-12",
        stato: "Programmata",
      });

      // Avanza al prossimo ciclo
      prossimoCicloIdx = (prossimoCicloIdx + 1) % cicloLen;
      ultimaDataPalestra = dataGiorno;
    }

    return sessioni;
  }

  /**
   * Variante esplicita che accetta il programma come parametro obbligatorio.
   * Alias semantico di generaPianoPalestraMensile con programma esplicito.
   *
   * @param {number} anno
   * @param {number} mese
   * @param {object} ultimaSessione
   * @param {Array}  programma - array di sedute dal programma personalizzato
   * @returns {Array}
   */
  function generaPianoPalestraMensileConProgramma(anno, mese, ultimaSessione, programma) {
    return generaPianoPalestraMensile(anno, mese, ultimaSessione, null, programma);
  }

  /**
   * Parsa una stringa "YYYY-MM-DD" in un oggetto Date locale.
   */
  function parseDataIso(dataIso) {
    if (!dataIso || typeof dataIso !== "string") return null;
    var parts = dataIso.split("-");
    if (parts.length !== 3) return null;
    var anno = parseInt(parts[0], 10);
    var mese0 = parseInt(parts[1], 10) - 1;
    var giorno = parseInt(parts[2], 10);
    var d = new Date(anno, mese0, giorno);
    return isNaN(d.getTime()) ? null : d;
  }

  // ---------------------------------------------------------------------------
  // Esposizione
  // ---------------------------------------------------------------------------

  var api = {
    generaPianoPalestraMensile: generaPianoPalestraMensile,
    generaPianoPalestraMensileConProgramma: generaPianoPalestraMensileConProgramma,
    CICLO_PALESTRA: CICLO_PALESTRA,
  };

  global.MaranelloPianoGymGenerator = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
