/*
 * Maranello 2027 — App_HTML
 * File: js/modules/views/settimana.js
 *
 * View "Settimana": mostra le sessioni della settimana corrente (o selezionata)
 * con editing inline e navigazione tra settimane.
 *
 * Rotta: #/settimana
 *
 * Espone: window.MaranelloViews.Settimana
 *
 * Ref: Task 3
 */

(function initSettimanaView(global, document) {
  "use strict";

  var STORE_PIANO = "piano_settimane";
  var STORE_CORSA = "sessioni_corsa";
  var STORE_PALESTRA = "sessioni_palestra";

  // ---------------------------------------------------------------------------
  // Helper DOM (allineato a peso.js / app.js)
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
          key === "min" || key === "max" || key === "step" ||
          key === "value" || key === "inputmode" || key === "autocomplete" ||
          key === "datetime" || key === "rows" || key === "placeholder"
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

  // ---------------------------------------------------------------------------
  // Date helpers
  // ---------------------------------------------------------------------------

  /** Ritorna la data locale come "YYYY-MM-DD". */
  function formatDateIso(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  /** Ritorna il lunedì della settimana ISO che contiene `date`. */
  function getLunediSettimana(date) {
    var d = new Date(date);
    var day = d.getDay(); // 0=dom
    var diff = (day === 0) ? -6 : 1 - day; // lunedì
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Ritorna la domenica della settimana ISO che contiene `date`. */
  function getDomenicaSettimana(date) {
    var lun = getLunediSettimana(date);
    var dom = new Date(lun);
    dom.setDate(dom.getDate() + 6);
    return dom;
  }

  /** Calcola l'ID ISO 8601 della settimana "YYYY-Www". */
  function toIsoWeekId(date) {
    var OggiUtils = global.MaranelloOggiUtils;
    if (OggiUtils && typeof OggiUtils.toIsoWeekId === "function") {
      return OggiUtils.toIsoWeekId(date);
    }
    // Fallback inline
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return d.getUTCFullYear() + "-W" + pad2(weekNum);
  }

  /** Nomi dei giorni della settimana (lun-dom). */
  var NOMI_GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  var NOMI_MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

  function formatDataBreve(date) {
    return NOMI_GIORNI[(date.getDay() + 6) % 7] + " " + date.getDate() + " " + NOMI_MESI[date.getMonth()];
  }

  function formatDataHeader(date) {
    return date.getDate() + " " + NOMI_MESI[date.getMonth()];
  }

  // ---------------------------------------------------------------------------
  // Rendering principale
  // ---------------------------------------------------------------------------

  function renderSettimanaView(params, mount) {
    var Storage = global.MaranelloStorage;

    // Stato della view
    var state = {
      dataRiferimento: new Date(), // giorno corrente
      settimana: null,             // record piano_settimane
      editingData: null,           // data in editing inline
    };

    // Contenitore principale
    var container = el("div", { class: "settimana-view" });
    mount.appendChild(container);

    // Titolo
    container.appendChild(
      el("h2", { class: "settimana-title", text: t("view.settimana.title") })
    );

    // Header settimana con navigazione
    var headerEl = el("div", { class: "settimana-header" });
    container.appendChild(headerEl);

    // Lista giorni
    var listaEl = el("div", { class: "settimana-lista" });
    container.appendChild(listaEl);

    // Pulsante genera piano
    var footerEl = el("div", { class: "settimana-footer" });
    var btnGenera = el("button", {
      type: "button",
      class: "settimana-btn-genera",
      "data-testid": "settimana-btn-genera",
      text: t("view.settimana.genera_piano"),
    });
    btnGenera.addEventListener("click", function onGenera() {
      apriGeneraPiano(mount);
    });
    footerEl.appendChild(btnGenera);

    // Pulsante esporta schede per mobile (visibile solo su desktop)
    var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (!isMobile) {
      var btnExportMobile = el("button", {
        type: "button",
        class: "settimana-btn-export-mobile",
        text: "📱 Esporta per mobile",
      });
      btnExportMobile.addEventListener("click", function () {
        var Sync = global.MaranelloSyncMobile;
        if (Sync && typeof Sync.esportaSchedePerMobile === "function") {
          Sync.esportaSchedePerMobile();
        }
      });
      footerEl.appendChild(btnExportMobile);
    }

    // Pulsante sincronizza schede (visibile solo su mobile)
    if (isMobile) {
      var btnSyncMobile = el("button", {
        type: "button",
        class: "settimana-btn-import-mobile",
        text: "🔄 Sincronizza schede",
      });
      btnSyncMobile.addEventListener("click", function () {
        var Sync = global.MaranelloSyncMobile;
        if (Sync && typeof Sync.sincronizzaDaServer === "function") {
          btnSyncMobile.textContent = "⏳ Sincronizzazione...";
          Sync.sincronizzaDaServer(function (ok, msg) {
            btnSyncMobile.textContent = "🔄 Sincronizza schede";
            alert(msg);
            if (ok) global.location.reload();
          });
        }
      });
      footerEl.appendChild(btnSyncMobile);
    }

    container.appendChild(footerEl);

    // Carica e renderizza
    caricaERenderi();

    // Ascolta l'evento globale emesso dai form corsa/palestra quando salvano
    // una sessione: aggiorna la settimana corrente rimuovendo la sessione
    // appena registrata da sessioniProgrammate.
    function onSessioneSalvata(ev) {
      var detail = ev && ev.detail;
      if (!detail || !detail.data || !detail.tipo) return;

      // Controlla se la data appartiene alla settimana visualizzata
      var weekIdSalvata = toIsoWeekId(new Date(detail.data + "T12:00:00"));
      var weekIdCorrente = toIsoWeekId(state.dataRiferimento);
      if (weekIdSalvata !== weekIdCorrente) return;

      // Rimuove solo la sessione dello stesso tipo e data da sessioniProgrammate
      if (state.settimana && Array.isArray(state.settimana.sessioniProgrammate)) {
        var dataIsoSalvata = detail.data;
        var tipoSalvato = detail.tipo;
        state.settimana.sessioniProgrammate = state.settimana.sessioniProgrammate.filter(
          function (s) { return !(s.data === dataIsoSalvata && s.tipo === tipoSalvato); }
        );
        if (Storage && typeof Storage.put === "function") {
          Storage.put(STORE_PIANO, state.settimana, { origine: "utente" })
            .catch(function () {});
        }
        renderListaGiorni(listaEl, state);
      }
    }

    global.addEventListener("maranello:sessione-salvata", onSessioneSalvata);

    // Cleanup: rimuove il listener quando il mount viene svuotato dal router
    var observer = new MutationObserver(function () {
      if (!container.isConnected) {
        global.removeEventListener("maranello:sessione-salvata", onSessioneSalvata);
        observer.disconnect();
      }
    });
    if (container.parentNode) {
      observer.observe(container.parentNode, { childList: true });
    }

    function caricaERenderi() {
      var weekId = toIsoWeekId(state.dataRiferimento);
      if (!Storage || typeof Storage.get !== "function") {
        renderHeader(headerEl, state, onNaviga);
        renderListaGiorni(listaEl, state);
        return;
      }
      Storage.get(STORE_PIANO, weekId)
        .then(function onLoaded(record) {
          state.settimana = record || null;
          renderHeader(headerEl, state, onNaviga);
          renderListaGiorni(listaEl, state);
        })
        .catch(function onErr() {
          state.settimana = null;
          renderHeader(headerEl, state, onNaviga);
          renderListaGiorni(listaEl, state);
        });
    }

    function onNaviga(delta) {
      // delta: -7 o +7 giorni
      state.dataRiferimento = new Date(
        state.dataRiferimento.getTime() + delta * 24 * 60 * 60 * 1000
      );
      state.editingData = null;
      caricaERenderi();
    }

    function renderHeader(headerEl, state, onNaviga) {
      headerEl.innerHTML = "";
      var lun = getLunediSettimana(state.dataRiferimento);
      var dom = getDomenicaSettimana(state.dataRiferimento);

      var btnPrev = el("button", {
        type: "button",
        class: "settimana-nav-btn",
        "aria-label": t("view.settimana.settimana_prec"),
        text: "‹",
      });
      btnPrev.addEventListener("click", function () { onNaviga(-7); });

      var btnNext = el("button", {
        type: "button",
        class: "settimana-nav-btn",
        "aria-label": t("view.settimana.settimana_succ"),
        text: "›",
      });
      btnNext.addEventListener("click", function () { onNaviga(+7); });

      var titolo = t("view.settimana.header_settimana", {
        lun: formatDataHeader(lun),
        dom: formatDataHeader(dom),
        anno: dom.getFullYear(),
      });

      headerEl.appendChild(btnPrev);
      headerEl.appendChild(el("span", { class: "settimana-header-titolo", text: titolo }));
      headerEl.appendChild(btnNext);
    }

    function renderListaGiorni(listaEl, state) {
      listaEl.innerHTML = "";
      var lun = getLunediSettimana(state.dataRiferimento);

      // Se non ci sono dati, mostra empty state
      if (!state.settimana || !Array.isArray(state.settimana.sessioniProgrammate) ||
          state.settimana.sessioniProgrammate.length === 0) {
        var emptySection = el("div", { class: "settimana-empty" }, [
          el("p", { class: "settimana-empty-desc", text: t("view.settimana.empty_desc") }),
        ]);
        listaEl.appendChild(emptySection);
        return;
      }

      // Renderizza 7 card (lun-dom)
      // I giorni passati senza sessione programmata vengono saltati.
      var oggiIso = formatDateIso(new Date());
      for (var i = 0; i < 7; i++) {
        var dataGiorno = new Date(lun);
        dataGiorno.setDate(lun.getDate() + i);
        var dataIso = formatDateIso(dataGiorno);

        // Cerca TUTTE le sessioni programmate per questo giorno
        var sessioniGiorno = [];
        var sessioniProg = state.settimana.sessioniProgrammate || [];
        for (var j = 0; j < sessioniProg.length; j++) {
          if (sessioniProg[j] && sessioniProg[j].data === dataIso) {
            sessioniGiorno.push(sessioniProg[j]);
          }
        }

        // Giorni passati senza sessione: non mostrare nulla
        if (sessioniGiorno.length === 0 && dataIso < oggiIso) continue;

        if (sessioniGiorno.length === 0) {
          var card = buildGiornoCard(dataGiorno, dataIso, null, state);
          listaEl.appendChild(card);
        } else {
          for (var k = 0; k < sessioniGiorno.length; k++) {
            var card = buildGiornoCard(dataGiorno, dataIso, sessioniGiorno[k], state);
            listaEl.appendChild(card);
          }
        }
      }
    }

    function buildGiornoCard(dataGiorno, dataIso, sessione, state) {
      var isOggi = formatDateIso(new Date()) === dataIso;
      var card = el("div", {
        class: "settimana-giorno-card" + (isOggi ? " settimana-giorno-oggi" : ""),
        "data-data": dataIso,
      });

      // Header giorno
      var headerGiorno = el("div", { class: "settimana-giorno-header" }, [
        el("span", { class: "settimana-giorno-nome", text: formatDataBreve(dataGiorno) }),
      ]);
      card.appendChild(headerGiorno);

      if (!sessione) {
        card.appendChild(el("p", { class: "settimana-giorno-vuoto", text: t("view.settimana.giorno_riposo") }));
        return card;
      }

      // Info sessione
      var infoEl = el("div", { class: "settimana-sessione-info" });

      // Nome sessione (con numero scheda per palestra)
      var nomeVisualizzato = sessione.nomeSessione || sessione.tipo;
      if (sessione.tipo === "palestra" && sessione.numeroCiclo) {
        nomeVisualizzato = "Scheda " + sessione.numeroCiclo + " — " + (sessione.nomeSeduta || nomeVisualizzato);
      }
      infoEl.appendChild(el("p", { class: "settimana-sessione-nome", text: nomeVisualizzato }));

      // Durata
      if (sessione.durataStimataMin) {
        infoEl.appendChild(el("p", {
          class: "settimana-sessione-durata",
          text: t("view.settimana.durata_min", { min: sessione.durataStimataMin }),
        }));
      }

      // Schema walk-run (corsa)
      if (sessione.tipo === "corsa" && sessione.schemaWalkRun) {
        var wr = sessione.schemaWalkRun;
        infoEl.appendChild(el("p", {
          class: "settimana-sessione-schema",
          text: t("view.settimana.schema_walkrun", {
            camm: wr.cammMetri,
            corsa: wr.corsaMetri,
            rip: wr.ripetizioni,
          }),
        }));
      }

      // Esercizi (palestra) con gruppo muscolare
      if (sessione.tipo === "palestra" && Array.isArray(sessione.esercizi)) {
        // Cerca i gruppi dall'anagrafica (programma_palestra) o dal catalogo
        var catalog = global.MaranelloEserciziCatalog;
        var eserciziConGruppo = sessione.esercizi.map(function (nome) {
          var gruppo = "";
          if (catalog && Array.isArray(catalog.esercizi)) {
            var found = catalog.esercizi.filter(function (e) { return e.nome === nome; })[0];
            if (found) gruppo = found.gruppo;
          }
          return gruppo ? nome + " (" + gruppo + ")" : nome;
        });
        var listaEs = el("ul", { class: "settimana-sessione-esercizi-lista" });
        eserciziConGruppo.forEach(function (testo) {
          listaEs.appendChild(el("li", { text: testo }));
        });
        infoEl.appendChild(listaEs);
      }

      // Badge stato
      var badgeClass = "settimana-badge settimana-badge-" + (sessione.stato || "programmata").toLowerCase();
      infoEl.appendChild(el("span", {
        class: badgeClass,
        text: sessione.stato || "Programmata",
      }));

      card.appendChild(infoEl);

      // Barra azioni: Registra (solo Programmata) + Elimina (sempre)
      var azioniEl = el("div", { class: "settimana-card-azioni" });

      if (sessione.stato === "Programmata") {
        var btnRegistra = el("button", {
          type: "button",
          class: "settimana-btn-modifica",
          text: t("view.settimana.registra_sessione"),
        });
        btnRegistra.addEventListener("click", function onRegistra() {
          apriFormSessione(sessione, dataIso, mount);
        });
        azioniEl.appendChild(btnRegistra);

        // Pulsante export scheda palestra (solo per sessioni palestra)
        if (sessione.tipo === "palestra") {
          var btnExport = el("button", {
            type: "button",
            class: "settimana-btn-export",
            text: "📥 Scarica scheda",
          });
          btnExport.addEventListener("click", function onExport() {
            var ExportScheda = global.MaranelloExportSchedaPalestra;
            if (ExportScheda && typeof ExportScheda.esportaSchedaPalestra === "function") {
              ExportScheda.esportaSchedaPalestra(sessione);
            } else if (global.console && global.console.warn) {
              global.console.warn("[settimana] MaranelloExportSchedaPalestra non disponibile");
            }
          });
          azioniEl.appendChild(btnExport);
        }
      }

      // Pulsante Sposta — riprogramma la sessione a un'altra data
      if (sessione.stato === "Programmata") {
        var btnSposta = el("button", {
          type: "button",
          class: "settimana-btn-sposta",
          text: "📅 Sposta",
        });
        btnSposta.addEventListener("click", function onSposta() {
          apriSpostaSessione(sessione, dataIso, card, state);
        });
        azioniEl.appendChild(btnSposta);
      }

      // Pulsante Elimina — rimuove la sessione dal piano (sempre disponibile)
      var btnElimina = el("button", {
        type: "button",
        class: "settimana-btn-elimina",
        "aria-label": t("view.settimana.elimina_sessione"),
        text: t("view.settimana.elimina_sessione"),
      });
      btnElimina.addEventListener("click", function onElimina() {
        if (!global.confirm(t("view.settimana.elimina_conferma"))) return;
        eliminaSessione(sessione, dataIso, state);
      });
      azioniEl.appendChild(btnElimina);

      card.appendChild(azioniEl);

      return card;
    }

    /**
     * Apre il form completo (corsa o palestra) come overlay sopra la view
     * settimana, pre-popolato con i dati della sessione programmata.
     * Al salvataggio: segna la sessione come Completa nel piano e torna.
     */
    function apriFormSessione(sessione, dataIso, mount) {
      var overlay = el("div", { class: "settimana-form-overlay" });
      mount.appendChild(overlay);

      var header = el("div", { class: "settimana-form-overlay-header" });
      var btnChiudi = el("button", {
        type: "button",
        class: "settimana-form-overlay-chiudi",
        "aria-label": t("common.annulla"),
        text: "✕ " + t("common.annulla"),
      });
      btnChiudi.addEventListener("click", function () {
        overlay.remove();
      });
      header.appendChild(btnChiudi);
      overlay.appendChild(header);

      var formMount = el("div", { class: "settimana-form-overlay-body" });
      overlay.appendChild(formMount);

      function onSaved(record) {
        // Rimuove la sessione appena registrata da sessioniProgrammate:
        // la settimana si svuota progressivamente man mano che si completano
        // le sessioni. Solo la settimana corrente viene aggiornata.
        if (state.settimana && Array.isArray(state.settimana.sessioniProgrammate)) {
          state.settimana.sessioniProgrammate = state.settimana.sessioniProgrammate.filter(
            function (s) { return !(s.data === dataIso && s.tipo === sessione.tipo); }
          );
          if (Storage && typeof Storage.put === "function") {
            Storage.put(STORE_PIANO, state.settimana, { origine: "utente" })
              .catch(function (err) {
                if (global.console && global.console.error) {
                  global.console.error("[settimana] errore aggiornamento piano:", err);
                }
              });
          }
        }
        overlay.remove();
        renderListaGiorni(listaEl, state);
      }

      if (sessione.tipo === "corsa") {
        var FormCorsa = global.MaranelloViews && global.MaranelloViews.FormCorsa;
        if (FormCorsa) {
          // Pre-popola la data e lo schema walk-run dalla sessione programmata
          var params = { query: {} };
          FormCorsa(params, formMount, {
            embedded: true,
            onSaved: onSaved,
            presetData: dataIso,
            presetWalkRun: sessione.schemaWalkRun || null,
          });
          // Pre-popola i campi dopo il render
          prepopolaFormCorsa(formMount, sessione, dataIso);
        }
      } else if (sessione.tipo === "palestra") {
        var FormPalestra = global.MaranelloViews && global.MaranelloViews.FormPalestra;
        if (FormPalestra) {
          // Legge l'anagrafica per avere i carichi completi della seduta
          var anagraficaPromise = Storage && typeof Storage.get === "function"
            ? Storage.get("programma_palestra", "main")
            : Promise.resolve(null);

          anagraficaPromise.then(function (programma) {
            // Trova la seduta corrispondente nell'anagrafica
            var sedutaCompleta = null;
            if (programma && Array.isArray(programma.sedute) && sessione.numeroCiclo) {
              sedutaCompleta = programma.sedute.filter(function (s) {
                return s.numeroCiclo === sessione.numeroCiclo;
              })[0] || null;
            }
            // Fallback al seed se non trovata
            if (!sedutaCompleta) {
              var seed = global.MaranelloProgrammaPalestraSeed;
              if (seed && Array.isArray(seed.sedute) && sessione.numeroCiclo) {
                sedutaCompleta = seed.sedute.filter(function (s) {
                  return s.numeroCiclo === sessione.numeroCiclo;
                })[0] || null;
              }
            }

            // Costruisce i preset con i carichi completi
            var presetGruppi = null;
            if (sedutaCompleta && Array.isArray(sedutaCompleta.esercizi)) {
              // Raggruppa per gruppo per il form palestra
              var gruppiMap = {};
              sedutaCompleta.esercizi.forEach(function (es) {
                var g = es.gruppo || "Altro";
                if (!gruppiMap[g]) gruppiMap[g] = [];
                gruppiMap[g].push({
                  nome: es.nome,
                  serie: es.serie || 4,
                  ripetizioni: Array.isArray(es.ripetizioni)
                    ? es.ripetizioni
                    : [es.ripetizioni || 12],
                  carico: es.carico || 0,
                  tempoSecondi: es.tempoSecondi || null,
                });
              });
              presetGruppi = Object.keys(gruppiMap).map(function (g) {
                return { gruppo: g, esercizi: gruppiMap[g] };
              });
            }

            var params2 = { query: {} };
            FormPalestra(params2, formMount, {
              embedded: true,
              onSaved: onSaved,
              presetData: dataIso,
              presetEsercizi: sessione.esercizi || [],
              presetGruppi: presetGruppi,
              numeroCiclo: sessione.numeroCiclo || null,
            });
            // Pre-popola data e carichi
            prepopolaFormPalestra(formMount, sessione, dataIso, presetGruppi);
          }).catch(function () {
            // Fallback senza anagrafica
            var params2 = { query: {} };
            FormPalestra(params2, formMount, {
              embedded: true,
              onSaved: onSaved,
              presetData: dataIso,
              presetEsercizi: sessione.esercizi || [],
              numeroCiclo: sessione.numeroCiclo || null,
            });
            prepopolaFormPalestra(formMount, sessione, dataIso, null);
          });
        }
      }
    }

    /** Pre-popola il form corsa con i dati della sessione programmata. */
    function prepopolaFormCorsa(formMount, sessione, dataIso) {
      // Data
      var dataInput = formMount.querySelector("[type='date']");
      if (dataInput) dataInput.value = dataIso;

      // Schema walk-run: se presente, attiva il toggle e pre-popola
      if (sessione.schemaWalkRun) {
        var wr = sessione.schemaWalkRun;
        var toggle = formMount.querySelector("[id$='-walkrun-toggle']");
        if (toggle) {
          toggle.checked = true;
          toggle.dispatchEvent(new Event("change"));
        }
        var cammInput = formMount.querySelector("[id$='-walkrun-camm']");
        var corsaInput = formMount.querySelector("[id$='-walkrun-corsa']");
        var ripInput = formMount.querySelector("[id$='-walkrun-rip']");
        if (cammInput) cammInput.value = String(wr.cammMetri);
        if (corsaInput) corsaInput.value = String(wr.corsaMetri);
        if (ripInput) ripInput.value = String(wr.ripetizioni);

        // Distanza stimata: (cammMetri + corsaMetri) / 1000 * ripetizioni
        var distanzaInput = formMount.querySelector("[id$='-distanza']");
        if (distanzaInput) {
          var distKm = ((wr.cammMetri + wr.corsaMetri) / 1000) * wr.ripetizioni;
          distanzaInput.value = String(Math.round(distKm * 10) / 10);
          distanzaInput.dispatchEvent(new Event("input"));
        }
      }
    }

    /** Pre-popola il form palestra con gli esercizi e carichi dalla seduta. */
    function prepopolaFormPalestra(formMount, sessione, dataIso, presetGruppi) {
      // Data
      var dataInput = formMount.querySelector("[type='date']");
      if (dataInput) dataInput.value = dataIso;

      // Se abbiamo i gruppi completi dall'anagrafica, pre-popola i campi
      // del form palestra (righe esercizio già create dal form con presetGruppi).
      if (!presetGruppi) return;

      // Il form palestra crea le righe esercizio in base a presetGruppi
      // passato nelle options. Qui dobbiamo solo assicurarci che i campi
      // serie/rip/carico siano compilati. Il form li legge da presetGruppi
      // se il form supporta l'opzione — altrimenti li compiliamo via DOM.
      var rows = formMount.querySelectorAll("[data-testid='form-palestra-esercizio-row']");
      if (rows.length === 0) return;

      // Appiattisce i presetGruppi in un array lineare di esercizi
      var eserciziFlat = [];
      presetGruppi.forEach(function (g) {
        (g.esercizi || []).forEach(function (es) {
          eserciziFlat.push(es);
        });
      });

      // Per ogni riga del form, cerca l'esercizio corrispondente e compila
      for (var i = 0; i < rows.length && i < eserciziFlat.length; i++) {
        var es = eserciziFlat[i];
        var row = rows[i];

        var serieInput = row.querySelector("[data-field='serie'], [id$='-serie']");
        if (serieInput) serieInput.value = String(es.serie || 4);

        var ripInput = row.querySelector("[data-field='rip'], [id$='-rip']");
        if (ripInput) {
          var ripStr = Array.isArray(es.ripetizioni)
            ? es.ripetizioni.join(",")
            : String(es.ripetizioni || 12);
          ripInput.value = ripStr;
        }

        var caricoInput = row.querySelector("[data-field='carico'], [id$='-carico']");
        if (caricoInput) caricoInput.value = String(es.carico || 0);

        var tempoInput = row.querySelector("[id$='-tempo']");
        if (tempoInput && es.tempoSecondi) {
          tempoInput.value = String(es.tempoSecondi);
        }
      }
    }

    /**
     * Mostra un date picker inline nella card per spostare la sessione.
     */
    function apriSpostaSessione(sessione, dataIso, card, state) {
      // Se c'è già un picker aperto, rimuovilo
      var existing = card.querySelector(".settimana-sposta-box");
      if (existing) { existing.remove(); return; }

      var box = el("div", { class: "settimana-sposta-box" });
      var inputData = el("input", {
        type: "date",
        class: "settimana-sposta-input",
        value: dataIso,
        min: formatDateIso(new Date()),
      });
      var btnConferma = el("button", {
        type: "button",
        class: "settimana-form-btn-salva",
        text: "Conferma",
      });
      var btnAnnulla = el("button", {
        type: "button",
        class: "settimana-form-btn-annulla",
        text: "Annulla",
      });

      btnAnnulla.addEventListener("click", function () { box.remove(); });
      btnConferma.addEventListener("click", function () {
        var nuovaData = inputData.value;
        if (!nuovaData || nuovaData === dataIso) { box.remove(); return; }
        spostaSessione(sessione, dataIso, nuovaData, state);
        box.remove();
      });

      box.appendChild(el("label", { text: "Nuova data:" }));
      box.appendChild(inputData);
      box.appendChild(el("div", { class: "settimana-form-actions" }, [btnConferma, btnAnnulla]));
      card.appendChild(box);
    }

    /**
     * Sposta una sessione da una data a un'altra nel piano.
     * Rimuove dalla settimana di origine, aggiunge alla settimana di destinazione.
     */
    function spostaSessione(sessione, vecchiaData, nuovaData, state) {
      if (!Storage || typeof Storage.put !== "function") return;

      var weekIdOrigine = toIsoWeekId(new Date(vecchiaData + "T12:00:00"));
      var weekIdDest = toIsoWeekId(new Date(nuovaData + "T12:00:00"));
      var sessioneSpostata = Object.assign({}, sessione, { data: nuovaData });

      if (weekIdOrigine === weekIdDest) {
        // Spostamento nella stessa settimana: modifica in-place
        if (state.settimana && Array.isArray(state.settimana.sessioniProgrammate)) {
          state.settimana.sessioniProgrammate = state.settimana.sessioniProgrammate.filter(
            function (s) { return s.data !== vecchiaData || s.tipo !== sessione.tipo; }
          );
          state.settimana.sessioniProgrammate.push(sessioneSpostata);
          Storage.put(STORE_PIANO, state.settimana, { origine: "utente" })
            .then(function () {
              renderListaGiorni(listaEl, state);
            })
            .catch(function (err) {
              if (global.console && global.console.error) {
                global.console.error("[settimana] errore spostamento:", err);
              }
            });
        }
        return;
      }

      // Spostamento tra settimane diverse
      // 1. Rimuove dalla settimana corrente
      if (state.settimana && Array.isArray(state.settimana.sessioniProgrammate)) {
        state.settimana.sessioniProgrammate = state.settimana.sessioniProgrammate.filter(
          function (s) { return s.data !== vecchiaData || s.tipo !== sessione.tipo; }
        );
      }

      // 2. Salva la settimana di origine, poi aggiunge alla destinazione
      Storage.put(STORE_PIANO, state.settimana, { origine: "utente" })
        .then(function () {
          return Storage.get(STORE_PIANO, weekIdDest);
        })
        .then(function (destRecord) {
          if (!destRecord) {
            destRecord = { id: weekIdDest, sessioniProgrammate: [] };
          }
          if (!Array.isArray(destRecord.sessioniProgrammate)) {
            destRecord.sessioniProgrammate = [];
          }
          destRecord.sessioniProgrammate.push(sessioneSpostata);
          return Storage.put(STORE_PIANO, destRecord, { origine: "utente" });
        })
        .then(function () {
          renderListaGiorni(listaEl, state);
        })
        .catch(function (err) {
          if (global.console && global.console.error) {
            global.console.error("[settimana] errore spostamento:", err);
          }
        });
    }

    function eliminaSessione(sessione, dataIso, state) {      if (!state.settimana || !Array.isArray(state.settimana.sessioniProgrammate)) return;

      // Rimuove solo la sessione specifica (stessa data e tipo)
      state.settimana.sessioniProgrammate = state.settimana.sessioniProgrammate.filter(
        function (s) { return !(s.data === dataIso && s.tipo === sessione.tipo); }
      );

      if (!Storage || typeof Storage.put !== "function") {
        // Fallback senza storage: aggiorna solo la UI
        renderListaGiorni(listaEl, state);
        return;
      }

      Storage.put(STORE_PIANO, state.settimana, { origine: "utente" })
        .then(function () {
          renderListaGiorni(listaEl, state);
        })
        .catch(function onErr(err) {
          if (global.console && global.console.error) {
            global.console.error("[settimana] errore eliminazione:", err);
          }
        });
    }

    function apriGeneraPiano(mount) {
      // Apre la view GeneraPiano come overlay/modal
      var GeneraPiano = global.MaranelloViews && global.MaranelloViews.GeneraPiano;
      if (GeneraPiano && typeof GeneraPiano.apriModal === "function") {
        GeneraPiano.apriModal(mount, function onChiuso() {
          caricaERenderi();
        });
      } else {
        // Fallback: naviga alla rotta genera-piano
        global.location.hash = "#/genera-piano";
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  if (!global.MaranelloViews) {
    global.MaranelloViews = {};
  }
  global.MaranelloViews.Settimana = renderSettimanaView;
})(typeof window !== "undefined" ? window : globalThis, document);
