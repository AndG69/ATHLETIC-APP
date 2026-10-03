/*
 * Maranello 2027 — App_HTML
 * File: js/modules/views/genera-piano.js
 *
 * View/componente modale per la generazione del piano mensile (Task 4).
 * Si apre dalla vista Settimana o dal menu Impostazioni.
 *
 * Espone: window.MaranelloViews.GeneraPiano
 *
 * Ref: Task 4
 */

(function initGeneraPianoView(global, document) {
  "use strict";

  var STORE_PIANO = "piano_settimane";

  // ---------------------------------------------------------------------------
  // Helper DOM
  // ---------------------------------------------------------------------------

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function applyProp(key) {
        var value = props[key];
        if (value === undefined || value === null) return;
        if (key === "class") {
          node.className = value;
        } else if (key === "text") {
          node.textContent = value;
        } else if (key === "html") {
          node.innerHTML = value;
        } else if (key.indexOf("data-") === 0 || key.indexOf("aria-") === 0) {
          node.setAttribute(key, value);
        } else if (
          key === "href" || key === "role" || key === "for" ||
          key === "type" || key === "name" || key === "id" ||
          key === "value" || key === "checked" || key === "selected" ||
          key === "disabled" || key === "multiple"
        ) {
          node.setAttribute(key, value);
        } else {
          node[key] = value;
        }
      });
    }
    if (Array.isArray(children)) {
      children.forEach(function appendChild(child) {
        if (child == null) return;
        node.appendChild(
          typeof child === "string" ? document.createTextNode(child) : child
        );
      });
    }
    return node;
  }

  function t(key, params) {
    var I18n = global.I18n;
    return I18n && typeof I18n.t === "function" ? I18n.t(key, params) : key;
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  /**
   * Ricava anno e mese (1-12) da una data ISO "YYYY-MM-DD".
   * Il mese di generazione è derivato automaticamente dalla data di partenza:
   * non esiste più un selettore mese separato. In caso di data non valida usa
   * i fallback forniti.
   */
  function annoMeseDaData(dataIso, fallbackAnno, fallbackMese) {
    if (dataIso && typeof dataIso === "string" && dataIso.length >= 10) {
      var parti = dataIso.split("-");
      var a = parseInt(parti[0], 10);
      var m = parseInt(parti[1], 10);
      if (!isNaN(a) && !isNaN(m) && m >= 1 && m <= 12) {
        return { anno: a, mese: m };
      }
    }
    return { anno: fallbackAnno, mese: fallbackMese };
  }

  // ---------------------------------------------------------------------------
  // Logica di generazione e salvataggio
  // ---------------------------------------------------------------------------

  /**
   * Calcola tutti i weekId ISO ("YYYY-Www") che contengono almeno un giorno
   * del mese specificato.
   */
  function weekIdDelMese(anno, mese) {
    var mese0 = mese - 1;
    var giorniNelMese = new Date(anno, mese0 + 1, 0).getDate();
    var weekIds = {};
    for (var g = 1; g <= giorniNelMese; g++) {
      var d = new Date(anno, mese0, g);
      weekIds[toIsoWeekId(d)] = true;
    }
    return Object.keys(weekIds);
  }

  /**
   * Cancella le sessioni programmate del mese da piano_settimane,
   * preservando le sessioni già registrate nel diario (stato != "Programmata").
   * Usata prima di rigenerare un mese per evitare merge con dati vecchi.
   */
  function cancellaSettimaneDelMese(anno, mese, Storage) {
    var weekIds = weekIdDelMese(anno, mese);
    var promises = weekIds.map(function (weekId) {
      return Storage.get(STORE_PIANO, weekId)
        .then(function (existing) {
          if (!existing || !Array.isArray(existing.sessioniProgrammate)) {
            return Promise.resolve();
          }
          // Rimuove TUTTE le sessioni programmate — la rigenerazione le ricrea da zero
          existing.sessioniProgrammate = existing.sessioniProgrammate.filter(function (s) {
            return s.stato && s.stato !== "Programmata";
          });
          return Storage.put(STORE_PIANO, existing, { origine: "sistema_piano", skipLog: true });
        })
        .catch(function () { return Promise.resolve(); });
    });
    return Promise.all(promises);
  }

  /**
   * Raggruppa le sessioni per settimana ISO e le salva in piano_settimane.
   * Ogni record ha id = "YYYY-Www" e sessioniProgrammate = [...].
   *
   * Prima di salvare, controlla sessioni_corsa e sessioni_palestra per
   * evitare di aggiungere sessioni programmate per date già registrate
   * nel diario.
   */
  function salvaSessioniComePiano(sessioni, Storage) {
    if (!sessioni || sessioni.length === 0) return Promise.resolve([]);

    // Raccoglie tutte le date delle sessioni da salvare
    var dateCorsa = sessioni
      .filter(function (s) { return s.tipo === "corsa"; })
      .map(function (s) { return s.data; });
    var datePalestra = sessioni
      .filter(function (s) { return s.tipo === "palestra"; })
      .map(function (s) { return s.data; });

    // Legge le sessioni già registrate nel diario per quelle date
    var dateGiaRegistratePromise = Promise.all([
      dateCorsa.length > 0
        ? Storage.query("sessioni_corsa").catch(function () { return []; })
        : Promise.resolve([]),
      datePalestra.length > 0
        ? Storage.query("sessioni_palestra").catch(function () { return []; })
        : Promise.resolve([]),
    ]).then(function (results) {
      var registrateCorsa = results[0] || [];
      var registratePalestra = results[1] || [];

      // Costruisce un Set di date già registrate (formato YYYY-MM-DD)
      var dateOccupate = {};
      registrateCorsa.forEach(function (rec) {
        if (rec && rec.data) {
          var d = rec.data.slice(0, 10); // prende solo YYYY-MM-DD
          dateOccupate[d + "_corsa"] = true;
        }
      });
      registratePalestra.forEach(function (rec) {
        if (rec && rec.data) {
          var d = rec.data.slice(0, 10);
          dateOccupate[d + "_palestra"] = true;
        }
      });
      return dateOccupate;
    });

    return dateGiaRegistratePromise.then(function (dateOccupate) {
      // Filtra le sessioni escludendo quelle già registrate nel diario
      var sessioniFiltrate = sessioni.filter(function (s) {
        var chiave = s.data + "_" + s.tipo;
        return !dateOccupate[chiave];
      });

      // Lookup carichi precedenti per le sessioni palestra
      var sessioniPalestra = sessioniFiltrate.filter(function (s) {
        return s.tipo === "palestra";
      });

      var carichiLookupPromise;
      if (sessioniPalestra.length > 0) {
        carichiLookupPromise = Storage.query("sessioni_palestra")
          .catch(function () { return []; })
          .then(function (tutteSessioniPalestra) {
            var GymGen = global.MaranelloPianoGymGenerator;

            sessioniPalestra.forEach(function (sessione) {
              // Usa gli esercizi canonici dal CICLO_PALESTRA per il lookup
              var eserciziCanonical = sessione.esercizi || [];
              if (GymGen && sessione.numeroCiclo) {
                var sedutaRef = GymGen.CICLO_PALESTRA.filter(function (s) {
                  return s.numeroCiclo === sessione.numeroCiclo;
                })[0];
                if (sedutaRef) eserciziCanonical = sedutaRef.esercizi;
              }

              // Trova la sessione del diario con il maggior numero di esercizi
              // in comune con la seduta (score matching)
              var migliore = null;
              var miglioreScore = 0;

              tutteSessioniPalestra.forEach(function (rec) {
                if (!rec || !rec.data || !rec.gruppi) return;
                var nomiRecord = [];
                rec.gruppi.forEach(function (g) {
                  if (g && Array.isArray(g.esercizi)) {
                    g.esercizi.forEach(function (e) {
                      if (e && e.nome) nomiRecord.push(e.nome);
                    });
                  }
                });
                var score = eserciziCanonical.filter(function (nome) {
                  return nomiRecord.indexOf(nome) >= 0;
                }).length;
                if (score > miglioreScore) {
                  miglioreScore = score;
                  migliore = rec;
                }
              });

              if (!migliore || miglioreScore === 0) return;

              var eserciziPrecedenti = [];
              migliore.gruppi.forEach(function (gruppo) {
                if (gruppo && Array.isArray(gruppo.esercizi)) {
                  gruppo.esercizi.forEach(function (es) {
                    if (es && es.nome) {
                      eserciziPrecedenti.push({
                        nome: es.nome,
                        serie: es.serie || 0,
                        ripetizioni: es.ripetizioni || [],
                        carico: es.carico || 0,
                      });
                    }
                  });
                }
              });

              sessione.carichiPrecedenti = {
                data: migliore.data ? migliore.data.slice(0, 10) : null,
                esercizi: eserciziPrecedenti,
              };
            });
            return sessioniFiltrate;
          });
      } else {
        carichiLookupPromise = Promise.resolve(sessioniFiltrate);
      }

      return carichiLookupPromise.then(function (sessioniConCarichi) {
        sessioniFiltrate = sessioniConCarichi;

        // Raccoglie le settimane ISO coinvolte (sia dalle nuove sessioni
        // sia da quelle già presenti nel piano che potrebbero contenere
        // sessioni da pulire)
        var weekIdCoinvolti = {};
        sessioni.forEach(function (s) {
          var data = new Date(s.data + "T12:00:00Z");
          weekIdCoinvolti[toIsoWeekId(data)] = true;
        });

        // Raggruppa le sessioni filtrate per settimana ISO
        var gruppi = {};
        sessioniFiltrate.forEach(function (sessione) {
          var data = new Date(sessione.data + "T12:00:00Z");
          var weekId = toIsoWeekId(data);
          if (!gruppi[weekId]) {
            gruppi[weekId] = {
              id: weekId,
              sessioniProgrammate: [],
              dataInizio: null,
              dataFine: null,
            };
          }
          gruppi[weekId].sessioniProgrammate.push(sessione);
        });

        // Calcola dataInizio e dataFine per ogni settimana
        Object.keys(gruppi).forEach(function (weekId) {
          var gruppo = gruppi[weekId];
          var sessGruppo = gruppo.sessioniProgrammate;
          var date = sessGruppo.map(function (s) { return s.data; }).sort();
          gruppo.dataInizio = date[0];
          gruppo.dataFine = date[date.length - 1];
        });

        // Per ogni settimana coinvolta, aggiorna il record in piano_settimane:
        // - rimuove le sessioni già registrate nel diario
        // - aggiunge le nuove sessioni non ancora presenti
        var tutteLeSettimane = Object.keys(weekIdCoinvolti);
        var promises = tutteLeSettimane.map(function (weekId) {
          var nuoveSessioni = gruppi[weekId]
            ? gruppi[weekId].sessioniProgrammate
            : [];

          return Storage.get(STORE_PIANO, weekId)
            .then(function onExisting(existing) {
              if (existing && Array.isArray(existing.sessioniProgrammate)) {
                // Rimuove dal piano le sessioni già registrate nel diario
                existing.sessioniProgrammate = existing.sessioniProgrammate.filter(function (s) {
                  var chiave = s.data + "_" + s.tipo;
                  return !dateOccupate[chiave];
                });
                // Rimuove le sessioni programmate per le stesse date+tipo delle nuove
                // (sovrascrittura completa, non merge)
                var chiaveNuove = nuoveSessioni.map(function (s) {
                  return s.data + "_" + s.tipo;
                });
                existing.sessioniProgrammate = existing.sessioniProgrammate.filter(function (s) {
                  return chiaveNuove.indexOf(s.data + "_" + s.tipo) === -1;
                });
                existing.sessioniProgrammate = existing.sessioniProgrammate.concat(nuoveSessioni);
                return Storage.put(STORE_PIANO, existing, { origine: "sistema_piano" });
              }
              // Record non esiste ancora: crea solo se ci sono sessioni nuove
              if (nuoveSessioni.length > 0) {
                return Storage.put(STORE_PIANO, gruppi[weekId], { origine: "sistema_piano" });
              }
              return Promise.resolve();
            });
        });

        return Promise.all(promises);
      });
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
    return d.getUTCFullYear() + "-W" + pad2(weekNum);
  }

  // ---------------------------------------------------------------------------
  // Rendering del modal
  // ---------------------------------------------------------------------------

  function apriModal(parentMount, onChiuso) {
    var Storage = global.MaranelloStorage;

    // Overlay
    var overlay = el("div", {
      class: "genera-piano-overlay",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "genera-piano-titolo",
    });

    var modal = el("div", { class: "genera-piano-modal" });
    overlay.appendChild(modal);
    parentMount.appendChild(overlay);

    // Titolo
    modal.appendChild(el("h2", {
      id: "genera-piano-titolo",
      class: "genera-piano-titolo",
      text: t("view.genera_piano.titolo"),
    }));

    // Pulsante chiudi
    var btnChiudi = el("button", {
      type: "button",
      class: "genera-piano-chiudi",
      "aria-label": t("common.annulla"),
      text: "✕",
    });
    btnChiudi.addEventListener("click", function () {
      overlay.remove();
      if (typeof onChiuso === "function") onChiuso();
    });
    modal.appendChild(btnChiudi);

    // Leggi impostazioni per i default
    var impostazioniPromise = Storage && typeof Storage.get === "function"
      ? Storage.get("impostazioni", "main")
      : Promise.resolve(null);

    impostazioniPromise.then(function (impostazioni) {
      renderForm(modal, overlay, impostazioni, Storage, onChiuso);
    }).catch(function () {
      renderForm(modal, overlay, null, Storage, onChiuso);
    });
  }

  function renderForm(modal, overlay, impostazioni, Storage, onChiuso) {
    var now = new Date();
    // Default: mese successivo
    var defaultAnno = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
    var defaultMese = (now.getMonth() + 1) % 12 + 1; // mese successivo (1-12)

    var settimanaCorrente = (impostazioni && impostazioni.settimanaProgressione) || 5;
    var sessioniCorsaAlLivello = (impostazioni && typeof impostazioni.sessioniCorsaAlLivello === "number")
      ? impostazioni.sessioniCorsaAlLivello : 0;
    var ultimaSeduta = (impostazioni && impostazioni.ultimaSedutaPalestra) ||
      { data: "2026-05-07", numeroCiclo: 4 };
    var giorniCorsa = (impostazioni && impostazioni.giorniCorsa) || [6, 0];
    var giorniPalestra = (impostazioni && impostazioni.giorniPalestra) || [1, 3];
    var cadenza = (impostazioni && Array.isArray(impostazioni.cadenza) && impostazioni.cadenza.length >= 1)
      ? impostazioni.cadenza
      : ["P","P","R","C","R","P","P","R","C","R","P","P","R","C"];

    // Form
    var form = el("form", { class: "genera-piano-form", novalidate: "novalidate" });

    // Data di partenza: genera sessioni solo da questa data in poi.
    // Mese e anno del piano sono ricavati automaticamente da questa data
    // (non esiste più un selettore mese separato): il piano copre dalla data
    // scelta fino alla fine del suo mese.
    var oggiIsoDefault = now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());
    var inputDataPartenza = el("input", {
      type: "date",
      name: "dataPartenza",
      value: oggiIsoDefault,
      class: "genera-piano-input-data",
    });
    form.appendChild(el("div", { class: "genera-piano-field" }, [
      el("label", { text: "Genera a partire dal:" }),
      inputDataPartenza,
      el("p", {
        class: "genera-piano-hint",
        text: "Il piano copre dalla data scelta fino alla fine del relativo mese.",
      }),
    ]));

    // La progressione della corsa (settimana ISO dell'anno) è calcolata
    // automaticamente dalle date: non serve più selezionare un livello.
    form.appendChild(el("p", {
      class: "genera-piano-hint",
      text: "La progressione della corsa (settimana dell\u2019anno) \u00E8 calcolata automaticamente dalle date delle sessioni.",
    }));

    // Scheda palestra di partenza: se scelta, il ciclo riparte da quella scheda
    // invece di continuare dopo l'ultima registrata.
    var selectSchedaPartenza = el("select", {
      name: "schedaPartenza",
      class: "genera-piano-select",
      "aria-label": "Scheda palestra di partenza",
    });
    selectSchedaPartenza.appendChild(el("option", {
      value: "",
      text: "Automatico (dopo l\u2019ultima registrata)",
    }));
    form.appendChild(el("div", { class: "genera-piano-field" }, [
      el("label", { text: "Scheda palestra di partenza:" }),
      selectSchedaPartenza,
    ]));

    // Popola le opzioni con le sedute del programma (async), fallback al ciclo base.
    (function popolaSchedePartenza() {
      function aggiungi(sedute) {
        (sedute || []).forEach(function (s) {
          if (!s || typeof s.numeroCiclo === "undefined" || s.numeroCiclo === null) return;
          selectSchedaPartenza.appendChild(el("option", {
            value: String(s.numeroCiclo),
            text: "Scheda " + s.numeroCiclo + (s.nome ? " \u2014 " + s.nome : ""),
          }));
        });
      }
      function fallback() {
        var GymGen = global.MaranelloPianoGymGenerator;
        if (GymGen && Array.isArray(GymGen.CICLO_PALESTRA)) aggiungi(GymGen.CICLO_PALESTRA);
      }
      if (Storage && typeof Storage.get === "function") {
        Storage.get("programma_palestra", "main")
          .then(function (prog) {
            if (prog && Array.isArray(prog.sedute) && prog.sedute.length) {
              aggiungi(prog.sedute);
            } else {
              fallback();
            }
          })
          .catch(fallback);
      } else {
        fallback();
      }
    })();

    // Tipo piano
    var checkCorsa = el("input", { type: "checkbox", name: "corsa", id: "gp-check-corsa" });
    checkCorsa.checked = true;
    var checkPalestra = el("input", { type: "checkbox", name: "palestra", id: "gp-check-palestra" });
    checkPalestra.checked = true;

    form.appendChild(el("fieldset", { class: "genera-piano-field" }, [
      el("legend", { text: t("view.genera_piano.tipo_label") }),
      el("label", { for: "gp-check-corsa", class: "genera-piano-check-label" }, [
        checkCorsa,
        el("span", { text: t("view.genera_piano.tipo_corsa") }),
      ]),
      el("label", { for: "gp-check-palestra", class: "genera-piano-check-label" }, [
        checkPalestra,
        el("span", { text: t("view.genera_piano.tipo_palestra") }),
      ]),
    ]));


    // Area anteprima
    var anteprimaEl = el("div", {
      class: "genera-piano-anteprima",
      "data-testid": "genera-piano-anteprima",
    });
    form.appendChild(anteprimaEl);

    // Pulsante anteprima
    var btnAnteprima = el("button", {
      type: "button",
      class: "genera-piano-btn-anteprima",
      text: t("view.genera_piano.btn_anteprima"),
    });
    btnAnteprima.addEventListener("click", function () {
      var dataPartenzaPreview = inputDataPartenza.value || oggiIsoDefault;
      var amPrev = annoMeseDaData(dataPartenzaPreview, defaultAnno, defaultMese);
      var anno = amPrev.anno;
      var mese = amPrev.mese;
      var includiCorsa = checkCorsa.checked;
      var includiPalestra = checkPalestra.checked;
      var schedaPartenzaPreview = selectSchedaPartenza.value ? parseInt(selectSchedaPartenza.value, 10) : null;
      renderAnteprima(anteprimaEl, anno, mese, includiCorsa, includiPalestra,
        settimanaCorrente, ultimaSeduta, giorniCorsa, giorniPalestra, null, cadenza, sessioniCorsaAlLivello, dataPartenzaPreview, schedaPartenzaPreview);
    });
    form.appendChild(btnAnteprima);

    // Pulsanti azioni
    var feedbackEl = el("p", {
      class: "genera-piano-feedback",
      "aria-live": "polite",
    });

    var btnConferma = el("button", {
      type: "submit",
      class: "genera-piano-btn-conferma",
      text: t("view.genera_piano.btn_conferma"),
    });

    form.appendChild(feedbackEl);
    form.appendChild(el("div", { class: "genera-piano-actions" }, [btnConferma]));

    form.addEventListener("submit", function onSubmit(ev) {
      ev.preventDefault();
      // Legge i parametri dal form
      var dataPartenza = inputDataPartenza.value || oggiIsoDefault;
      var amSubmit = annoMeseDaData(dataPartenza, defaultAnno, defaultMese);
      var anno = amSubmit.anno;
      var mese = amSubmit.mese;
      var includiCorsa = checkCorsa.checked;
      var includiPalestra = checkPalestra.checked;
      var schedaPartenza = selectSchedaPartenza.value ? parseInt(selectSchedaPartenza.value, 10) : null;

      if (!includiCorsa && !includiPalestra) {
        feedbackEl.textContent = t("view.genera_piano.errore_nessun_tipo");
        return;
      }

      if (!Storage || typeof Storage.put !== "function") {
        feedbackEl.textContent = t("view.genera_piano.errore_storage");
        return;
      }

      btnConferma.disabled = true;
      feedbackEl.textContent = t("common.loading");

      // Legge il programma palestra personalizzato da IndexedDB (se disponibile)
      var programmaPalestraPromise = (Storage && typeof Storage.get === "function")
        ? Storage.get("programma_palestra", "main").catch(function () { return null; })
        : Promise.resolve(null);

      // Prima cancella le sessioni programmate del mese (sovrascrittura pulita),
      // poi salva il nuovo piano.
      programmaPalestraPromise
        .then(function (programmaPalestra) {
          var programmaSedute = (programmaPalestra && Array.isArray(programmaPalestra.sedute))
            ? programmaPalestra.sedute
            : null;
          var sessioni = generaSessioni(anno, mese, includiCorsa, includiPalestra,
            settimanaCorrente, ultimaSeduta, giorniCorsa, giorniPalestra, programmaSedute, cadenza, sessioniCorsaAlLivello, dataPartenza, schedaPartenza);
          return cancellaSettimaneDelMese(anno, mese, Storage)
            .then(function () {
              return salvaSessioniComePiano(sessioni, Storage);
            })
            .then(function () {
              feedbackEl.textContent = t("view.genera_piano.salvato_ok", { n: sessioni.length });
              global.setTimeout(function () {
                overlay.remove();
                if (typeof onChiuso === "function") onChiuso();
              }, 1500);
            });
        })
        .catch(function (err) {
          if (global.console && global.console.error) {
            global.console.error("[genera-piano] errore:", err);
          }
          feedbackEl.textContent = t("view.genera_piano.errore_salvataggio");
          btnConferma.disabled = false;
        });
    });

    modal.appendChild(form);
  }

  function generaSessioni(anno, mese, includiCorsa, includiPalestra,
    settimanaCorrente, ultimaSeduta, giorniCorsa, giorniPalestra, programmaSedute, cadenza, sessioniCorsaAlLivello, dataPartenza, schedaPartenza) {
    var sessioni = [];

    var CorsaGen = global.MaranelloPianoCorsaGenerator;
    var GymGen = global.MaranelloPianoGymGenerator;

    // Default cadenza: Sett 1: P-P-R-C-R-P-P | Sett 2: R-C-R-P-P-R-C
    var DEFAULT_CADENZA = ["P","P","R","C","R","P","P","R","C","R","P","P","R","C"];
    var cadenzaEffettiva = (Array.isArray(cadenza) && cadenza.length >= 1) ? cadenza : DEFAULT_CADENZA;

    var mese0 = mese - 1;
    var giorniNelMese = new Date(anno, mese0 + 1, 0).getDate();

    // Cadenza ciclica pura: i valori (P/C/R) si ripetono in sequenza a partire
    // dal primo giorno effettivamente generato, indipendentemente dal giorno
    // della settimana e con lunghezza libera (non più fissa a 14).
    var lunghezzaCadenza = cadenzaEffettiva.length || 1;

    // Programma sedute palestra (per lookup esercizi)
    var ciclo = null;
    if (GymGen) {
      ciclo = (Array.isArray(programmaSedute) && programmaSedute.length > 0)
        ? programmaSedute
        : GymGen.CICLO_PALESTRA;
    }
    var numSedute = ciclo ? ciclo.length : 8;

    // Prossima seduta palestra (0-based index).
    // Di default riparte dopo l'ultima seduta registrata.
    var ultimoNumeroCiclo = (ultimaSeduta && ultimaSeduta.numeroCiclo) || 0;
    var prossimoCicloIdx = ultimoNumeroCiclo % numSedute;

    // Override: se l'utente ha scelto una scheda di partenza, il ciclo parte
    // esattamente da quella scheda (per numeroCiclo).
    if (schedaPartenza != null && ciclo) {
      var idxStart = -1;
      for (var ci = 0; ci < ciclo.length; ci++) {
        if (ciclo[ci] && ciclo[ci].numeroCiclo === schedaPartenza) { idxStart = ci; break; }
      }
      if (idxStart === -1) {
        idxStart = Math.max(0, Math.min(numSedute - 1, schedaPartenza - 1));
      }
      prossimoCicloIdx = idxStart;
    }

    // Data di partenza: usa dataPartenza se fornita, altrimenti oggi
    var oggiIso;
    if (dataPartenza && typeof dataPartenza === "string" && dataPartenza.length === 10) {
      oggiIso = dataPartenza;
    } else {
      var oggi = new Date();
      oggiIso = oggi.getFullYear() + "-" + pad2(oggi.getMonth() + 1) + "-" + pad2(oggi.getDate());
    }
    var oggiParts = oggiIso.split("-");
    var oggiAnno = parseInt(oggiParts[0], 10);
    var oggiMese = parseInt(oggiParts[1], 10);

    var meseInCorsoOPassato =
      anno < oggiAnno ||
      (anno === oggiAnno && mese < oggiMese) ||
      (anno === oggiAnno && mese === oggiMese);

    var giornoInizioPattern = null;
    for (var giorno = 1; giorno <= giorniNelMese; giorno++) {
      var dataIsoCheck = anno + "-" + pad2(mese) + "-" + pad2(giorno);

      // Salta i giorni passati: non genera sessioni e non consuma indici
      if (meseInCorsoOPassato && dataIsoCheck < oggiIso) continue;

      // Il pattern parte dal primo giorno generato e si ripete ciclicamente.
      if (giornoInizioPattern === null) giornoInizioPattern = giorno;
      var posCiclo = (giorno - giornoInizioPattern) % lunghezzaCadenza;
      var tipo = cadenzaEffettiva[posCiclo]; // "P", "C" o "R"

      if (tipo === "P" && includiPalestra && ciclo) {
        // Genera sessione palestra
        var seduta = ciclo[prossimoCicloIdx];
        var dataIso = anno + "-" + pad2(mese) + "-" + pad2(giorno);

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
        prossimoCicloIdx = (prossimoCicloIdx + 1) % numSedute;

      } else if (tipo === "C" && includiCorsa) {
        // Il tipo di corsa (camminata / corsa / distanza in metri) è manuale.
        // La progressione riflette la settimana ISO dell'anno della sessione,
        // calcolata automaticamente dalla data.
        var settimanaProgressioneCorsa = getIsoWeekNumberLocal(new Date(anno, mese0, giorno));

        var dataIsoCorsa = anno + "-" + pad2(mese) + "-" + pad2(giorno);
        var nomeSessione = "Corsa sett. " + settimanaProgressioneCorsa;

        sessioni.push({
          data: dataIsoCorsa,
          tipo: "corsa",
          settimanaProgressione: settimanaProgressioneCorsa,
          schemaWalkRun: {
            cammMetri: null,
            corsaMetri: null,
            distanzaMetri: null,
          },
          durataStimataMin: null,
          zonaFC: "Z2",
          rpeTarget: 6,
          nomeSessione: nomeSessione,
          stato: "Programmata",
        });
      }
      // "R" = niente (riposo)
    }

    // Ordina per data
    sessioni.sort(function (a, b) {
      return a.data < b.data ? -1 : a.data > b.data ? 1 : 0;
    });

    return sessioni;
  }

  /**
   * Calcola la differenza in settimane ISO tra due date (locale).
   * Positivo se dataB è dopo dataA.
   */
  function deltaSettimaneIsoLocal(dataA, dataB) {
    var wA = getIsoWeekNumberLocal(dataA);
    var wB = getIsoWeekNumberLocal(dataB);
    var yA = dataA.getFullYear();
    var yB = dataB.getFullYear();

    if (yA === yB) {
      return wB - wA;
    }
    var delta = 0;
    if (yB > yA) {
      delta += getIsoWeeksInYearLocal(yA) - wA;
      for (var y = yA + 1; y < yB; y++) {
        delta += getIsoWeeksInYearLocal(y);
      }
      delta += wB;
    } else {
      delta -= getIsoWeeksInYearLocal(yB) - wB;
      for (var y2 = yB + 1; y2 < yA; y2++) {
        delta -= getIsoWeeksInYearLocal(y2);
      }
      delta -= wA;
    }
    return delta;
  }

  function getIsoWeekNumberLocal(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  }

  function getIsoWeeksInYearLocal(year) {
    var dec28 = new Date(Date.UTC(year, 11, 28));
    return getIsoWeekNumberLocal(dec28);
  }

  function renderAnteprima(anteprimaEl, anno, mese, includiCorsa, includiPalestra,
    settimanaCorrente, ultimaSeduta, giorniCorsa, giorniPalestra, programmaSedute, cadenza, sessioniCorsaAlLivello, dataPartenza, schedaPartenza) {
    anteprimaEl.innerHTML = "";

    var sessioni = generaSessioni(anno, mese, includiCorsa, includiPalestra,
      settimanaCorrente, ultimaSeduta, giorniCorsa, giorniPalestra, programmaSedute, cadenza, sessioniCorsaAlLivello, dataPartenza, schedaPartenza);

    if (sessioni.length === 0) {
      anteprimaEl.appendChild(el("p", { text: t("view.genera_piano.anteprima_vuota") }));
      return;
    }

    anteprimaEl.appendChild(el("p", {
      class: "genera-piano-anteprima-count",
      text: t("view.genera_piano.anteprima_count", { n: sessioni.length }),
    }));

    var lista = el("ul", { class: "genera-piano-anteprima-lista" });
    sessioni.forEach(function (s) {
      var testo = s.data + " — " + (s.nomeSessione || s.tipo);
      if (s.durataStimataMin) testo += " (" + s.durataStimataMin + " min)";
      lista.appendChild(el("li", { text: testo }));
    });
    anteprimaEl.appendChild(lista);
  }

  // ---------------------------------------------------------------------------
  // View standalone (rotta #/genera-piano)
  // ---------------------------------------------------------------------------

  function renderGeneraPianoView(params, mount) {
    var container = el("div", { class: "genera-piano-view" });
    mount.appendChild(container);
    container.appendChild(el("h2", { text: t("view.genera_piano.titolo") }));

    // Usa il modal inline nella view
    apriModal(mount, function onChiuso() {
      // Torna alla settimana
      if (global.location) global.location.hash = "#/settimana";
    });
  }

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  if (!global.MaranelloViews) {
    global.MaranelloViews = {};
  }
  global.MaranelloViews.GeneraPiano = {
    render: renderGeneraPianoView,
    apriModal: apriModal,
  };
})(typeof window !== "undefined" ? window : globalThis, document);
