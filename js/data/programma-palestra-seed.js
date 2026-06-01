/*
 * Maranello 2027 — App_HTML
 * File: js/data/programma-palestra-seed.js
 *
 * Dati di default per il programma palestra del Soggetto (8 sedute).
 * I nomi degli esercizi corrispondono ESATTAMENTE al catalogo in
 * js/data/esercizi-catalog.js.
 *
 * Nota: Plank e Plank laterale usano tempoSecondi: 30 invece di carico.
 *
 * Espone:
 *   window.MaranelloProgrammaPalestraSeed
 *   module.exports (per i test vitest)
 */

(function initProgrammaPalestraSeed(global) {
  "use strict";

  var PROGRAMMA_PALESTRA_DEFAULT = {
    id: "main",
    sedute: [
      {
        numeroCiclo: 1,
        nome: "Seduta 1",
        esercizi: [
          { nome: "Addominal Machine", gruppo: "Addominali", serie: 4, ripetizioni: 12, carico: 36, tempoSecondi: null },
          { nome: "Curl Manubri", gruppo: "Bicipiti", serie: 4, ripetizioni: 12, carico: 8, tempoSecondi: null },
          { nome: "Lat Machine presa larga", gruppo: "Dorsali", serie: 4, ripetizioni: 12, carico: 39, tempoSecondi: null },
          { nome: "Leg Extension", gruppo: "Gambe", serie: 4, ripetizioni: 10, carico: 29, tempoSecondi: null },
          { nome: "Gluteus Machine", gruppo: "Glutei", serie: 4, ripetizioni: 10, carico: 23, tempoSecondi: null },
          { nome: "Supine press - presa stretta", gruppo: "Pettorali", serie: 4, ripetizioni: 12, carico: 25, tempoSecondi: null },
        ],
      },
      {
        numeroCiclo: 2,
        nome: "Seduta 2",
        esercizi: [
          { nome: "Alzate laterali - Macchinario", gruppo: "Spalle", serie: 4, ripetizioni: 12, carico: 32, tempoSecondi: null },
          { nome: "French press cavo alto", gruppo: "Tricipiti", serie: 4, ripetizioni: 12, carico: 11.3, tempoSecondi: null },
          { nome: "Plank", gruppo: "Addominali", serie: 4, ripetizioni: 1, carico: 0, tempoSecondi: 30 },
          { nome: "Curl a Martello", gruppo: "Bicipiti", serie: 4, ripetizioni: 12, carico: 6, tempoSecondi: null },
          { nome: "Lat Machine triangolo", gruppo: "Dorsali", serie: 4, ripetizioni: 12, carico: 25, tempoSecondi: null },
          { nome: "Squat corpo libero", gruppo: "Gambe", serie: 4, ripetizioni: 6, carico: 0, tempoSecondi: null },
        ],
      },
      {
        numeroCiclo: 3,
        nome: "Seduta 3",
        esercizi: [
          { nome: "Croci Manubri panca piana", gruppo: "Pettorali", serie: 4, ripetizioni: 10, carico: 8, tempoSecondi: null },
          { nome: "Alzate posteriori pronospinate", gruppo: "Spalle", serie: 4, ripetizioni: 10, carico: 5, tempoSecondi: null },
          { nome: "Panca presa stretta bilancere", gruppo: "Tricipiti", serie: 4, ripetizioni: 8, carico: 5, tempoSecondi: null },
          { nome: "Plank laterale", gruppo: "Addominali", serie: 4, ripetizioni: 1, carico: 0, tempoSecondi: 30 },
          { nome: "Panca Scott", gruppo: "Bicipiti", serie: 4, ripetizioni: 6, carico: 7.5, tempoSecondi: null },
          { nome: "Lat Machine presa inversa", gruppo: "Dorsali", serie: 4, ripetizioni: 10, carico: 32, tempoSecondi: null },
        ],
      },
      {
        numeroCiclo: 4,
        nome: "Seduta 4",
        esercizi: [
          { nome: "Machine Abductor", gruppo: "Gambe", serie: 4, ripetizioni: 12, carico: 36, tempoSecondi: null },
          { nome: "Shoulder press", gruppo: "Spalle", serie: 4, ripetizioni: 10, carico: 14, tempoSecondi: null },
          { nome: "Push down Ercolina", gruppo: "Tricipiti", serie: 4, ripetizioni: 12, carico: 15.8, tempoSecondi: null },
          { nome: "Crunch", gruppo: "Addominali", serie: 4, ripetizioni: 12, carico: 36, tempoSecondi: null },
          { nome: "Curl Cavo basso (ercolina)", gruppo: "Bicipiti", serie: 4, ripetizioni: 12, carico: 15.8, tempoSecondi: null },
          { nome: "Pull down lat machine", gruppo: "Dorsali", serie: 4, ripetizioni: 12, carico: 18, tempoSecondi: null },
        ],
      },
      {
        numeroCiclo: 5,
        nome: "Seduta 5",
        esercizi: [
          { nome: "Machine Adductor", gruppo: "Gambe", serie: 4, ripetizioni: 12, carico: 29, tempoSecondi: null },
          { nome: "Panca Inclinata bilancere", gruppo: "Pettorali", serie: 4, ripetizioni: 10, carico: 10, tempoSecondi: null },
          { nome: "Push down inverso", gruppo: "Tricipiti", serie: 4, ripetizioni: 10, carico: 13.5, tempoSecondi: null },
          { nome: "Alzate Gambe", gruppo: "Addominali", serie: 4, ripetizioni: 6, carico: 0, tempoSecondi: null },
          { nome: "Curl concentrato al cavo", gruppo: "Bicipiti", serie: 4, ripetizioni: 12, carico: 6.8, tempoSecondi: null },
          { nome: "Pulley triangolo", gruppo: "Dorsali", serie: 4, ripetizioni: 12, carico: 32, tempoSecondi: null },
        ],
      },
      {
        numeroCiclo: 6,
        nome: "Seduta 6",
        esercizi: [
          { nome: "Leg Curl sdraiato", gruppo: "Gambe", serie: 4, ripetizioni: 12, carico: 23, tempoSecondi: null },
          { nome: "Panca Piana bilancere", gruppo: "Pettorali", serie: 4, ripetizioni: 12, carico: 10, tempoSecondi: null },
          { nome: "Iperestensioni", gruppo: "Lombari", serie: 4, ripetizioni: 10, carico: 0, tempoSecondi: null },
          { nome: "Trazioni assistite", gruppo: "Dorsali", serie: 4, ripetizioni: 6, carico: 47.6, tempoSecondi: null },
          { nome: "Calf in piedi", gruppo: "Gambe", serie: 4, ripetizioni: 12, carico: 20, tempoSecondi: null },
          { nome: "Pull Over con manubrio", gruppo: "Pettorali", serie: 4, ripetizioni: 12, carico: 14, tempoSecondi: null },
        ],
      },
      {
        numeroCiclo: 7,
        nome: "Seduta 7",
        esercizi: [
          { nome: "Incline Level Row", gruppo: "Dorsali", serie: 4, ripetizioni: 12, carico: 10, tempoSecondi: null },
          { nome: "Chest Press", gruppo: "Pettorali", serie: 4, ripetizioni: 12, carico: 23, tempoSecondi: null },
          { nome: "Seated row 2", gruppo: "Tricipiti", serie: 4, ripetizioni: 12, carico: 10, tempoSecondi: null },
          { nome: "Supine press - presa larga", gruppo: "Pettorali", serie: 4, ripetizioni: 12, carico: 20, tempoSecondi: null },
          { nome: "Seated Row", gruppo: "Dorsali", serie: 4, ripetizioni: 12, carico: 23, tempoSecondi: null },
          { nome: "Incline press", gruppo: "Pettorali", serie: 4, ripetizioni: 12, carico: 29, tempoSecondi: null },
        ],
      },
      {
        numeroCiclo: 8,
        nome: "Seduta 8",
        esercizi: [
          { nome: "Shoulder press", gruppo: "Spalle", serie: 4, ripetizioni: 12, carico: 18, tempoSecondi: null },
          { nome: "Rear Delt", gruppo: "Dorsali", serie: 4, ripetizioni: 12, carico: 39, tempoSecondi: null },
          { nome: "Trazioni assistite - Dip", gruppo: "Pettorali", serie: 4, ripetizioni: 6, carico: 61.2, tempoSecondi: null },
          { nome: "Shoulder Press 2", gruppo: "Spalle", serie: 4, ripetizioni: 12, carico: 10, tempoSecondi: null },
          { nome: "Decline Press 2", gruppo: "Spalle", serie: 4, ripetizioni: 12, carico: 0, tempoSecondi: null },
          { nome: "Pec Fly", gruppo: "Pettorali", serie: 4, ripetizioni: 12, carico: 45, tempoSecondi: null },
          { nome: "Leg Press", gruppo: "Gambe", serie: 4, ripetizioni: 12, carico: 0, tempoSecondi: null },
        ],
      },
    ],
  };

  global.MaranelloProgrammaPalestraSeed = PROGRAMMA_PALESTRA_DEFAULT;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PROGRAMMA_PALESTRA_DEFAULT;
  }
})(typeof window !== "undefined" ? window : globalThis);
