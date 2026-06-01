/*
 * Maranello 2027 — App_HTML
 * File: js/data/esercizi-catalog.js
 *
 * Catalogo statico di esercizi palestra usato dal form di inserimento
 * sessione (Task 8). È un seed minimale ispirato al file storico
 * `Palestra_new.xlsx` del Soggetto; ogni voce ha { nome, gruppo }.
 *
 * L'utente può comunque inserire un esercizio "Altro…" con nome libero
 * direttamente nel form, quindi questo catalogo NON è esaustivo e non
 * vincolante. Fornisce solo scelte rapide per il data entry di ogni
 * giorno (Req 6.1, 6.2).
 *
 * Note sui gruppi:
 *   - I gruppi sono scelti per essere facilmente comprensibili
 *     dall'utente e riflettono la suddivisione della sua scheda corrente:
 *     Pettorali, Dorso, Spalle, Braccia, Gambe e Glutei, Core.
 *   - L'abbreviazione "Altro" come gruppo è disponibile come opzione
 *     residuale per esercizi non classificabili.
 *
 * Espone:
 *   window.MaranelloEserciziCatalog = {
 *     esercizi: Array<{nome, gruppo}>,
 *     gruppi:   Array<string>,                  // ordinati + stabile
 *     perGruppo: Map<string, Array<{nome}>>     // helper
 *   }
 */

(function initEserciziCatalog(global) {
  "use strict";

  // Seed basato sulla scheda del Soggetto (Palestra_new.xlsx).
  // Gruppi e nomi allineati esattamente al foglio "Piano" dell'Excel.
  var ESERCIZI = [
    // Addominali
    { nome: "Addominal Machine", gruppo: "Addominali" },
    { nome: "Plank", gruppo: "Addominali" },
    { nome: "Plank laterale", gruppo: "Addominali" },
    { nome: "Crunch", gruppo: "Addominali" },
    { nome: "Alzate Gambe", gruppo: "Addominali" },

    // Bicipiti
    { nome: "Curl Manubri", gruppo: "Bicipiti" },
    { nome: "Curl a Martello", gruppo: "Bicipiti" },
    { nome: "Panca Scott", gruppo: "Bicipiti" },
    { nome: "Curl Cavo basso (ercolina)", gruppo: "Bicipiti" },
    { nome: "Curl concentrato al cavo", gruppo: "Bicipiti" },

    // Tricipiti
    { nome: "French press cavo alto", gruppo: "Tricipiti" },
    { nome: "Panca presa stretta bilancere", gruppo: "Tricipiti" },
    { nome: "Push down Ercolina", gruppo: "Tricipiti" },
    { nome: "Push down inverso", gruppo: "Tricipiti" },
    { nome: "Seated row 2", gruppo: "Tricipiti" },

    // Dorsali
    { nome: "Lat Machine presa larga", gruppo: "Dorsali" },
    { nome: "Lat Machine triangolo", gruppo: "Dorsali" },
    { nome: "Lat Machine presa inversa", gruppo: "Dorsali" },
    { nome: "Pull down lat machine", gruppo: "Dorsali" },
    { nome: "Pulley triangolo", gruppo: "Dorsali" },
    { nome: "Seated Row", gruppo: "Dorsali" },
    { nome: "Incline Level Row", gruppo: "Dorsali" },
    { nome: "Trazioni assistite", gruppo: "Dorsali" },
    { nome: "Rear Delt", gruppo: "Dorsali" },

    // Pettorali
    { nome: "Chest Press", gruppo: "Pettorali" },
    { nome: "Panca Inclinata bilancere", gruppo: "Pettorali" },
    { nome: "Panca Piana bilancere", gruppo: "Pettorali" },
    { nome: "Croci Manubri panca piana", gruppo: "Pettorali" },
    { nome: "Incline press", gruppo: "Pettorali" },
    { nome: "Pec Fly", gruppo: "Pettorali" },
    { nome: "Supine press - presa stretta", gruppo: "Pettorali" },
    { nome: "Supine press - presa larga", gruppo: "Pettorali" },
    { nome: "Pull Over con manubrio", gruppo: "Pettorali" },
    { nome: "Trazioni assistite - Dip", gruppo: "Pettorali" },

    // Spalle
    { nome: "Shoulder press", gruppo: "Spalle" },
    { nome: "Shoulder Press 2", gruppo: "Spalle" },
    { nome: "Alzate laterali - Macchinario", gruppo: "Spalle" },
    { nome: "Alzate posteriori pronospinate", gruppo: "Spalle" },
    { nome: "Decline Press 2", gruppo: "Spalle" },

    // Gambe
    { nome: "Leg Press", gruppo: "Gambe" },
    { nome: "Leg Extension", gruppo: "Gambe" },
    { nome: "Leg Curl sdraiato", gruppo: "Gambe" },
    { nome: "Squat corpo libero", gruppo: "Gambe" },
    { nome: "Machine Abductor", gruppo: "Gambe" },
    { nome: "Machine Adductor", gruppo: "Gambe" },
    { nome: "Calf in piedi", gruppo: "Gambe" },

    // Glutei
    { nome: "Gluteus Machine", gruppo: "Glutei" },

    // Lombari
    { nome: "Iperestensioni", gruppo: "Lombari" },
  ];

  // Estrae l'elenco gruppi nell'ordine di prima apparizione + "Altro".
  function buildGruppi(lista) {
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < lista.length; i++) {
      var g = lista[i].gruppo;
      if (!seen[g]) {
        seen[g] = true;
        out.push(g);
      }
    }
    if (!seen["Altro"]) out.push("Altro");
    return out;
  }

  function buildPerGruppo(lista) {
    var map = new Map();
    lista.forEach(function add(e) {
      if (!map.has(e.gruppo)) map.set(e.gruppo, []);
      map.get(e.gruppo).push({ nome: e.nome });
    });
    // Il gruppo "Altro" è sempre presente anche se vuoto.
    if (!map.has("Altro")) map.set("Altro", []);
    return map;
  }

  var catalog = {
    esercizi: ESERCIZI.slice(),
    gruppi: buildGruppi(ESERCIZI),
    perGruppo: buildPerGruppo(ESERCIZI),
  };

  global.MaranelloEserciziCatalog = catalog;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = catalog;
  }
})(typeof window !== "undefined" ? window : globalThis);
