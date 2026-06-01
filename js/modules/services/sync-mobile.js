/*
 * Maranello 2027 — App_HTML
 * File: js/modules/services/sync-mobile.js
 *
 * Sincronizzazione PC → Mobile per le sessioni palestra programmate.
 *
 * - PC: pulsante "Esporta per mobile" → invia le schede al server locale
 * - Mobile: pulsante "Sincronizza" o automatico all'apertura → scarica le schede dal server
 *
 * L'app mobile mostra le schede con campi editabili per annotare variazioni
 * durante l'allenamento.
 *
 * Espone: window.MaranelloSyncMobile
 */

(function initSyncMobile(global, document) {
  "use strict";

  var Storage = global.MaranelloStorage;

  // L'URL del file schede.json su GitHub Pages
  var SCHEDE_URL = "https://andg69.github.io/ATHLETIC-APP/schede.json";

  // Per il PC: salva il file localmente e fa git push
  function getApiBase() {
    if (global.location.hostname === "localhost" || global.location.hostname === "127.0.0.1") {
      return global.location.origin;
    }
    return null;
  }

  /**
   * PC: Esporta le sessioni palestra programmate al server.
   * Il server le rende disponibili per il mobile.
   */
  function esportaSchedePerMobile() {
    if (!Storage || typeof Storage.query !== "function") {
      alert("Storage non disponibile");
      return;
    }

    Promise.all([
      Storage.query("piano_settimane"),
      Storage.get("programma_palestra", "main"),
    ]).then(function (results) {
      var tutteSettimane = results[0] || [];
      var programma = results[1];

      // Raccoglie TUTTE le sessioni programmate (palestra + corsa)
      var sessioniProgrammate = [];
      tutteSettimane.forEach(function (settimana) {
        if (!settimana || !Array.isArray(settimana.sessioniProgrammate)) return;
        settimana.sessioniProgrammate.forEach(function (s) {
          if (s.stato !== "Programmata") return;

          if (s.tipo === "palestra") {
            var sessioneCompleta = {
              data: s.data,
              tipo: "palestra",
              numeroCiclo: s.numeroCiclo,
              nomeSeduta: s.nomeSeduta,
              serie: s.serie || 4,
              repsRange: s.repsRange || "6-12",
              stato: "Programmata",
              esercizi: [],
            };

            // Arricchisce con i dati completi dall'anagrafica
            if (programma && Array.isArray(programma.sedute) && s.numeroCiclo) {
              var seduta = programma.sedute.filter(function (sd) {
                return sd.numeroCiclo === s.numeroCiclo;
              })[0];
              if (seduta && Array.isArray(seduta.esercizi)) {
                sessioneCompleta.esercizi = seduta.esercizi.map(function (es) {
                  return {
                    nome: es.nome,
                    gruppo: es.gruppo || "",
                    serie: es.serie || 4,
                    ripetizioni: es.ripetizioni || 12,
                    carico: es.carico || 0,
                    tempoSecondi: es.tempoSecondi || null,
                  };
                });
              }
            }

            sessioniProgrammate.push(sessioneCompleta);
          } else {
            // Corsa o altro tipo: esporta così com'è
            sessioniProgrammate.push({
              data: s.data,
              tipo: s.tipo,
              nomeSessione: s.nomeSessione || null,
              settimanaProgressione: s.settimanaProgressione || null,
              schemaWalkRun: s.schemaWalkRun || null,
              durataStimataMin: s.durataStimataMin || null,
              zonaFC: s.zonaFC || null,
              rpeTarget: s.rpeTarget || null,
              stato: "Programmata",
            });
          }
        });
      });

      if (sessioniProgrammate.length === 0) {
        alert("Nessuna sessione programmata da esportare.");
        return;
      }

      // Ordina per data
      sessioniProgrammate.sort(function (a, b) {
        return a.data < b.data ? -1 : a.data > b.data ? 1 : 0;
      });

      var payload = {
        versione: "1.0",
        sessioni: sessioniProgrammate,
      };

      // Invia al server locale che salva il file e fa git push
      var apiBase = getApiBase();
      if (!apiBase) {
        alert("Esporta disponibile solo dal PC (localhost).");
        return;
      }

      fetch(apiBase + "/api/schede", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (resp) { return resp.json(); })
        .then(function (data) {
          if (data.ok) {
            alert("Esportate " + data.count + " schede. Push su GitHub in corso...");
          } else {
            alert("Errore: " + (data.error || "sconosciuto"));
          }
        })
        .catch(function (err) {
          console.error("[sync-mobile] errore export:", err);
          alert("Errore di connessione al server locale.");
        });
    });
  }

  /**
   * Mobile: Scarica le schede dal server e le salva in IndexedDB locale.
   * Chiamata automaticamente all'apertura o con pulsante "Sincronizza".
   */
  function sincronizzaDaServer(callback) {
    // Scarica il file schede.json da GitHub Pages (HTTPS, no mixed content)
    fetch(SCHEDE_URL + "?t=" + Date.now())
      .then(function (resp) {
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        return resp.json();
      })
      .then(function (resp) { return resp.json(); })
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.sessioni) || payload.sessioni.length === 0) {
          if (typeof callback === "function") callback(false, "Nessuna scheda disponibile sul server.");
          return;
        }

        if (!Storage || typeof Storage.put !== "function") {
          if (typeof callback === "function") callback(false, "Storage non disponibile.");
          return;
        }

        var sessioni = payload.sessioni;

        // Raggruppa per settimana ISO
        var perSettimana = {};
        sessioni.forEach(function (s) {
          var d = new Date(s.data + "T12:00:00Z");
          var weekId = toIsoWeekId(d);
          if (!perSettimana[weekId]) perSettimana[weekId] = [];

          if (s.tipo === "palestra") {
            perSettimana[weekId].push({
              data: s.data,
              tipo: "palestra",
              numeroCiclo: s.numeroCiclo,
              nomeSeduta: s.nomeSeduta,
              esercizi: (s.esercizi || []).map(function (es) { return es.nome; }),
              serie: s.serie || 4,
              repsRange: s.repsRange || "6-12",
              stato: "Programmata",
              _eserciziCompleti: s.esercizi || [],
            });
          } else {
            perSettimana[weekId].push({
              data: s.data,
              tipo: s.tipo,
              nomeSessione: s.nomeSessione || null,
              settimanaProgressione: s.settimanaProgressione || null,
              schemaWalkRun: s.schemaWalkRun || null,
              durataStimataMin: s.durataStimataMin || null,
              zonaFC: s.zonaFC || null,
              rpeTarget: s.rpeTarget || null,
              stato: "Programmata",
            });
          }
        });

        // Salva in piano_settimane (sovrascrive tutte le sessioni programmate)
        var promises = Object.keys(perSettimana).map(function (weekId) {
          return Storage.get("piano_settimane", weekId)
            .then(function (existing) {
              if (!existing) {
                existing = { id: weekId, sessioniProgrammate: [] };
              }
              if (!Array.isArray(existing.sessioniProgrammate)) {
                existing.sessioniProgrammate = [];
              }
              // Rimuove tutte le vecchie sessioni programmate
              existing.sessioniProgrammate = existing.sessioniProgrammate.filter(function (s) {
                return s.stato && s.stato !== "Programmata";
              });
              // Aggiunge le nuove
              existing.sessioniProgrammate = existing.sessioniProgrammate.concat(perSettimana[weekId]);
              return Storage.put("piano_settimane", existing, { skipLog: true });
            });
        });

        Promise.all(promises).then(function () {
          if (typeof callback === "function") {
            callback(true, "Sincronizzate " + sessioni.length + " schede.");
          }
        });
      })
      .catch(function (err) {
        console.error("[sync-mobile] errore sync:", err);
        if (typeof callback === "function") callback(false, "Errore di connessione.");
      });
  }

  function toIsoWeekId(date) {
    var OggiUtils = global.MaranelloOggiUtils;
    if (OggiUtils && typeof OggiUtils.toIsoWeekId === "function") {
      return OggiUtils.toIsoWeekId(date);
    }
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return d.getUTCFullYear() + "-W" + String(weekNum).padStart(2, "0");
  }

  // Esposizione globale
  global.MaranelloSyncMobile = {
    esportaSchedePerMobile: esportaSchedePerMobile,
    sincronizzaDaServer: sincronizzaDaServer,
  };
})(typeof window !== "undefined" ? window : globalThis, document);
