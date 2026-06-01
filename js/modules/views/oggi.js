/*
 * Maranello 2027 — App_HTML
 * File: js/modules/views/oggi.js
 *
 * View "Oggi" (home): sessione del giorno, Regola_dei_5_Minuti sempre
 * visibile, azioni primarie Inizia / Micro_Sessione / Salta, e timer
 * di sessione.
 *
 * Task 6.1  — lookup sessione del giorno da `piano_settimane`
 * Task 6.2  — banner Regola_dei_5_Minuti sempre visibile
 * Task 6.3  — pulsanti Inizia / Micro / Salta (Salta → selettore motivazione)
 * Task 6.4  — timer di sessione con visualizzazione MM:SS e stop
 *
 * Ref: Req 20.3, 20.7, 22.4.a, 22.5, 22.8
 *
 * Contratto router: funzione `(params, mount) => void`. Il mount viene
 * svuotato dal router a ogni cambio rotta, quindi non servono teardown
 * espliciti. Il timer eventualmente attivo viene fermato nella
 * `beforeunload` del documento e quando il modulo viene rimontato.
 */

(function initOggiView(global, document) {
  "use strict";

  var MOTIVAZIONI = ["lavoro", "famiglia", "salute", "stanchezza", "pigrizia", "altro"];
  var MICRO_DURATA_DEFAULT_MIN = 15;
  var REGOLA_5_MIN_SEC = 5 * 60;

  // ---------------------------------------------------------------------------
  // Helper DOM (stesso pattern di peso.js e app.js)
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
        } else if (
          key.indexOf("data-") === 0 ||
          key.indexOf("aria-") === 0
        ) {
          node.setAttribute(key, value);
        } else if (
          key === "href" ||
          key === "role" ||
          key === "for" ||
          key === "type" ||
          key === "name" ||
          key === "id" ||
          key === "value" ||
          key === "datetime"
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

  // ---------------------------------------------------------------------------
  // Formattazione tempi e numeri
  // ---------------------------------------------------------------------------

  function formatMMSS(totalSeconds) {
    var s = Math.max(0, Math.floor(totalSeconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
  }

  function formatZonaFC(sessione) {
    if (!sessione) return "";
    var zona = sessione.zonaFC || sessione.zona || "";
    var range = sessione.rangeBpm || sessione.fcRange;
    if (zona && range) return zona + " (" + range + " bpm)";
    return zona || (range ? range + " bpm" : "");
  }

  // ---------------------------------------------------------------------------
  // Carica la sessione del giorno da `piano_settimane`
  // ---------------------------------------------------------------------------

  function caricaSessioneDelGiorno() {
    var Storage = global.MaranelloStorage;
    var Utils = global.MaranelloOggiUtils;
    if (!Storage || !Utils) return Promise.resolve(null);

    var oggi = new Date();
    var isoSettimana = Utils.toIsoWeekId(oggi);
    var dataOggi = Utils.formatDateIso(oggi);

    return Storage.get("piano_settimane", isoSettimana)
      .then(function onSettimana(settimana) {
        return Utils.trovaSessioneDelGiorno(settimana, dataOggi);
      })
      .catch(function onErr() {
        return null;
      });
  }

  // ---------------------------------------------------------------------------
  // Render: empty state quando il piano non c'è ancora
  // ---------------------------------------------------------------------------

  function renderEmpty(container) {
    var Router = global.MaranelloRouter;
    var article = el("article", {
      class: "oggi-empty",
      "aria-labelledby": "oggi-empty-title",
      "data-testid": "oggi-empty",
    });
    article.appendChild(
      el("h2", {
        id: "oggi-empty-title",
        text: t("view.oggi.empty_title"),
      })
    );
    article.appendChild(el("p", { text: t("view.oggi.empty_desc") }));

    var linkCorsa = el("button", {
      type: "button",
      class: "oggi-btn oggi-btn-secondary",
      text: t("view.oggi.empty_cta_corsa"),
    });
    linkCorsa.addEventListener("click", function onClick() {
      if (Router && typeof Router.navigate === "function") {
        Router.navigate("#/diario/corsa");
      } else {
        global.location.hash = "#/diario/corsa";
      }
    });

    var linkPalestra = el("button", {
      type: "button",
      class: "oggi-btn oggi-btn-secondary",
      text: t("view.oggi.empty_cta_palestra"),
    });
    linkPalestra.addEventListener("click", function onClick() {
      if (Router && typeof Router.navigate === "function") {
        Router.navigate("#/diario/palestra");
      } else {
        global.location.hash = "#/diario/palestra";
      }
    });

    article.appendChild(
      el("div", { class: "oggi-actions" }, [linkCorsa, linkPalestra])
    );
    container.appendChild(article);
  }

  // ---------------------------------------------------------------------------
  // Render: card sessione programmata con 3 azioni (Task 6.1 + 6.3)
  // ---------------------------------------------------------------------------

  function renderSessioneCard(container, sessione, state, ui) {
    var article = el("article", {
      class: "oggi-session-card",
      "aria-labelledby": "oggi-session-title",
      "data-testid": "oggi-session-card",
    });

    article.appendChild(
      el("h2", {
        id: "oggi-session-title",
        class: "oggi-session-titolo",
        text: sessione.nomeSessione || sessione.nome || t("view.oggi.session_default"),
      })
    );

    var meta = el("dl", { class: "oggi-session-meta" }, [
      el("dt", { text: t("view.oggi.durata_label") }),
      el("dd", { text: (sessione.durataMinuti || sessione.durata || "—") + " min" }),
      el("dt", { text: t("view.oggi.zona_fc_label") }),
      el("dd", { text: formatZonaFC(sessione) || "—" }),
      el("dt", { text: t("view.oggi.rpe_label") }),
      el("dd", { text: sessione.rpeTarget != null ? String(sessione.rpeTarget) : "—" }),
    ]);
    article.appendChild(meta);

    var microText = sessione.microSessione
      ? (sessione.microSessione.descrizione ||
         (sessione.microSessione.durataMinuti + " min a RPE " +
          (sessione.microSessione.rpe || "≤ 5")))
      : t("view.oggi.micro_default");
    article.appendChild(
      el("p", {
        class: "oggi-micro",
        "data-testid": "oggi-micro-label",
        text: t("view.oggi.micro_label") + ": " + microText,
      })
    );

    // --- Azioni (Task 6.3) --------------------------------------------
    var btnInizia = el("button", {
      type: "button",
      class: "oggi-btn oggi-btn-primary",
      "data-testid": "oggi-btn-inizia",
      text: t("view.oggi.actions.inizia"),
    });
    var btnMicro = el("button", {
      type: "button",
      class: "oggi-btn oggi-btn-primary",
      "data-testid": "oggi-btn-micro",
      text: t("view.oggi.actions.micro"),
    });
    var btnSalta = el("button", {
      type: "button",
      class: "oggi-btn oggi-btn-secondary",
      "data-testid": "oggi-btn-salta",
      text: t("view.oggi.actions.salta"),
    });

    btnInizia.addEventListener("click", function onInizia() {
      avviaTimer(sessione, state, ui);
    });
    btnMicro.addEventListener("click", function onMicro() {
      registraMicroSessione(sessione, state, ui);
    });
    btnSalta.addEventListener("click", function onSalta() {
      apriSelectorSalta(sessione, state, ui);
    });

    var actions = el(
      "div",
      { class: "oggi-actions", "data-testid": "oggi-actions" },
      [btnInizia, btnMicro, btnSalta]
    );
    article.appendChild(actions);

    // Slot per il selector Salta (rivelato inline, non modal per mobile).
    var saltaSlot = el("div", {
      class: "oggi-salta-slot",
      "data-testid": "oggi-salta-slot",
      hidden: "hidden",
    });
    article.appendChild(saltaSlot);

    container.appendChild(article);

    // Memorizziamo i riferimenti per il timer.
    ui.sessionArticle = article;
    ui.saltaSlot = saltaSlot;
  }

  // ---------------------------------------------------------------------------
  // Feedback inline (success / error)
  // ---------------------------------------------------------------------------

  function setFeedback(feedbackEl, message, stato) {
    if (!feedbackEl) return;
    feedbackEl.textContent = message || "";
    feedbackEl.setAttribute("data-state", stato || "idle");
  }

  // ---------------------------------------------------------------------------
  // Task 6.3: selettore motivazione per "Salta"
  // ---------------------------------------------------------------------------

  function apriSelectorSalta(sessione, state, ui) {
    var slot = ui.saltaSlot;
    if (!slot) return;
    slot.innerHTML = "";
    slot.hidden = false;

    var box = el("div", {
      class: "oggi-salta-box",
      role: "group",
      "aria-labelledby": "oggi-salta-title",
    });

    box.appendChild(
      el("h3", {
        id: "oggi-salta-title",
        class: "oggi-salta-titolo",
        text: t("view.oggi.salta.prompt_title"),
      })
    );

    var select = el("select", {
      class: "oggi-salta-select",
      "data-testid": "oggi-salta-select",
      id: "oggi-salta-motivazione",
      name: "motivazione",
    });
    MOTIVAZIONI.forEach(function addOpt(mot) {
      var opt = el("option", {
        value: mot,
        text: t("view.oggi.salta.options." + mot),
      });
      select.appendChild(opt);
    });

    var motivField = el("div", { class: "oggi-salta-field" }, [
      el("label", {
        for: "oggi-salta-motivazione",
        text: t("view.oggi.salta.prompt_title"),
      }),
      select,
    ]);

    var note = el("textarea", {
      class: "oggi-salta-note",
      "data-testid": "oggi-salta-note",
      id: "oggi-salta-note",
      name: "note",
      rows: 2,
    });
    var noteField = el("div", { class: "oggi-salta-field" }, [
      el("label", {
        for: "oggi-salta-note",
        text: t("view.oggi.salta.note_label"),
      }),
      note,
    ]);

    var btnConferma = el("button", {
      type: "button",
      class: "oggi-btn oggi-btn-primary",
      "data-testid": "oggi-salta-conferma",
      text: t("view.oggi.salta.conferma"),
    });
    btnConferma.addEventListener("click", function onConferma() {
      confermaSalta(sessione, select.value, (note.value || "").trim(), state, ui);
    });

    box.appendChild(motivField);
    box.appendChild(noteField);
    box.appendChild(el("div", { class: "oggi-actions oggi-actions-inline" }, [btnConferma]));
    slot.appendChild(box);

    select.focus();
  }

  function confermaSalta(sessione, motivazione, nota, state, ui) {
    var Storage = global.MaranelloStorage;
    var Utils = global.MaranelloOggiUtils;
    var storeName = Utils && Utils.storePerTipoSessione(sessione.tipo);
    if (!Storage || !storeName) {
      setFeedback(ui.feedbackEl, t("view.oggi.salta.error"), "error");
      return;
    }

    var record = {
      data: sessione.data,
      settimanaId: sessione.settimanaId || null,
      stato: "Saltata",
      motivazioneSalto: motivazione,
      noteSoggetto: nota,
      durataMinuti: 0,
      rpeTargetProgrammato: sessione.rpeTarget || null,
    };

    Storage.put(storeName, record, { origine: "utente" })
      .then(function onSaved() {
        setFeedback(ui.feedbackEl, t("view.oggi.salta.saved"), "success");
        if (ui.saltaSlot) ui.saltaSlot.hidden = true;
      })
      .catch(function onErr(err) {
        if (global.console && global.console.error) {
          global.console.error("[oggi] errore registrazione salto:", err);
        }
        setFeedback(ui.feedbackEl, t("view.oggi.salta.error"), "error");
      });
  }

  // ---------------------------------------------------------------------------
  // Micro_Sessione (azione rapida, Req 20.1)
  // ---------------------------------------------------------------------------

  function registraMicroSessione(sessione, state, ui) {
    var Storage = global.MaranelloStorage;
    var Utils = global.MaranelloOggiUtils;
    var storeName = Utils && Utils.storePerTipoSessione(sessione.tipo);
    if (!Storage || !storeName) {
      setFeedback(ui.feedbackEl, t("view.oggi.micro.error"), "error");
      return;
    }

    var durata = MICRO_DURATA_DEFAULT_MIN;
    if (sessione.microSessione && sessione.microSessione.durataMinuti) {
      durata = sessione.microSessione.durataMinuti;
    }

    var record = {
      data: sessione.data,
      settimanaId: sessione.settimanaId || null,
      stato: "Micro",
      durataMinuti: durata,
      rpeTargetProgrammato: sessione.rpeTarget || null,
    };

    Storage.put(storeName, record, { origine: "utente" })
      .then(function onSaved() {
        setFeedback(ui.feedbackEl, t("view.oggi.micro.saved"), "success");
      })
      .catch(function onErr(err) {
        if (global.console && global.console.error) {
          global.console.error("[oggi] errore Micro_Sessione:", err);
        }
        setFeedback(ui.feedbackEl, t("view.oggi.micro.error"), "error");
      });
  }

  // ---------------------------------------------------------------------------
  // Timer di sessione (Task 6.4)
  // ---------------------------------------------------------------------------

  /**
   * Monta il timer nel posto della card sessione. Usa setInterval per
   * aggiornare ogni secondo; ferma l'interval allo stop e quando l'articolo
   * viene rimosso dal DOM (es. cambio rotta).
   */
  function avviaTimer(sessione, state, ui) {
    if (state.timer.running) return;
    state.timer.running = true;
    state.timer.startedAt = Date.now();
    state.timer.elapsed = 0;

    // Nascondi il selector Salta se aperto.
    if (ui.saltaSlot) ui.saltaSlot.hidden = true;

    var article = ui.sessionArticle;
    if (!article) return;
    article.innerHTML = "";
    article.setAttribute("data-state", "timer");

    article.appendChild(
      el("h2", {
        class: "oggi-session-titolo",
        text: t("view.oggi.timer.title"),
      })
    );

    var display = el("div", {
      class: "oggi-timer-display",
      "data-testid": "oggi-timer-display",
      role: "timer",
      "aria-live": "polite",
      text: "00:00",
    });
    article.appendChild(display);

    var fiveRuleText = el("p", {
      class: "oggi-timer-rule",
      "data-testid": "oggi-timer-rule",
      "aria-live": "polite",
      text: t("view.oggi.timer.five_rule_remaining", { s: REGOLA_5_MIN_SEC }),
    });
    article.appendChild(fiveRuleText);

    var btnMicro = el("button", {
      type: "button",
      class: "oggi-btn oggi-btn-primary",
      "data-testid": "oggi-timer-micro",
      text: t("view.oggi.timer.termina_micro"),
    });
    var btnCompleta = el("button", {
      type: "button",
      class: "oggi-btn oggi-btn-primary",
      "data-testid": "oggi-timer-completa",
      text: t("view.oggi.timer.termina_completa"),
    });
    var btnAnnulla = el("button", {
      type: "button",
      class: "oggi-btn oggi-btn-secondary",
      "data-testid": "oggi-timer-annulla",
      text: t("view.oggi.timer.annulla"),
    });

    btnMicro.addEventListener("click", function onMicro() {
      terminaTimer(sessione, state, ui, "Micro");
    });
    btnCompleta.addEventListener("click", function onCompleta() {
      terminaTimer(sessione, state, ui, "Completa");
    });
    btnAnnulla.addEventListener("click", function onAnnulla() {
      if (global.confirm(t("view.oggi.timer.annulla_conferma"))) {
        annullaTimer(state, ui);
      }
    });

    article.appendChild(
      el("div", { class: "oggi-actions" }, [btnMicro, btnCompleta, btnAnnulla])
    );

    // Tick iniziale per evitare lag percepito.
    tickTimer(display, fiveRuleText, state);
    state.timer.intervalId = global.setInterval(function onTick() {
      if (!article.isConnected) {
        // Cambio rotta: teardown del timer.
        annullaTimer(state, ui, /*silent*/ true);
        return;
      }
      tickTimer(display, fiveRuleText, state);
    }, 1000);
  }

  function tickTimer(displayEl, fiveRuleEl, state) {
    var elapsed = Math.floor((Date.now() - state.timer.startedAt) / 1000);
    state.timer.elapsed = elapsed;
    displayEl.textContent = formatMMSS(elapsed);

    if (elapsed < REGOLA_5_MIN_SEC) {
      fiveRuleEl.textContent = t("view.oggi.timer.five_rule_remaining", {
        s: REGOLA_5_MIN_SEC - elapsed,
      });
      fiveRuleEl.setAttribute("data-phase", "waiting");
    } else {
      fiveRuleEl.textContent = t("view.oggi.timer.five_rule_passed");
      fiveRuleEl.setAttribute("data-phase", "passed");
    }
  }

  function stopTimerInterval(state) {
    if (state.timer.intervalId) {
      global.clearInterval(state.timer.intervalId);
      state.timer.intervalId = null;
    }
    state.timer.running = false;
  }

  function terminaTimer(sessione, state, ui, stato) {
    var Storage = global.MaranelloStorage;
    var Utils = global.MaranelloOggiUtils;
    var storeName = Utils && Utils.storePerTipoSessione(sessione.tipo);
    var elapsedMin = Math.round(state.timer.elapsed / 60);
    stopTimerInterval(state);

    if (!Storage || !storeName) {
      setFeedback(ui.feedbackEl, t("view.oggi.session_error"), "error");
      return;
    }

    var record = {
      data: sessione.data,
      settimanaId: sessione.settimanaId || null,
      stato: stato,
      durataMinuti: elapsedMin,
      rpeTargetProgrammato: sessione.rpeTarget || null,
    };

    Storage.put(storeName, record, { origine: "utente" })
      .then(function onSaved() {
        var msg =
          stato === "Micro"
            ? t("view.oggi.micro.saved")
            : t("view.oggi.session_saved");
        setFeedback(ui.feedbackEl, msg, "success");
        // Rimpiazza la card con un riepilogo asciutto.
        var art = ui.sessionArticle;
        if (art) {
          art.innerHTML = "";
          art.setAttribute("data-state", "done");
          art.appendChild(
            el("h2", { class: "oggi-session-titolo", text: msg })
          );
          art.appendChild(
            el("p", {
              class: "oggi-session-summary",
              text: t("view.oggi.session_summary", {
                min: elapsedMin,
                stato: stato,
              }),
            })
          );
        }
      })
      .catch(function onErr(err) {
        if (global.console && global.console.error) {
          global.console.error("[oggi] errore fine sessione:", err);
        }
        setFeedback(ui.feedbackEl, t("view.oggi.session_error"), "error");
      });
  }

  function annullaTimer(state, ui, silent) {
    stopTimerInterval(state);
    if (!silent) {
      setFeedback(ui.feedbackEl, "", "idle");
    }
    // Ricostruiamo la card come all'inizio: sessione è in state.sessione.
    var art = ui.sessionArticle;
    if (art && art.isConnected) {
      art.innerHTML = "";
      art.removeAttribute("data-state");
      // Rigeneriamo il contenuto se abbiamo la sessione.
      if (state.sessione) {
        // Rimuoviamo l'articolo e lo rimpiazziamo con uno fresco per
        // preservare la stessa topologia del render iniziale.
        var parent = art.parentNode;
        if (parent) {
          parent.removeChild(art);
          renderSessioneCard(parent, state.sessione, state, ui);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Entry point
  // ---------------------------------------------------------------------------

  function renderOggiView(params, mount) {
    var state = {
      sessione: null,
      timer: { running: false, startedAt: 0, elapsed: 0, intervalId: null },
    };
    var ui = {
      sessionArticle: null,
      saltaSlot: null,
      feedbackEl: null,
    };

    var section = el("section", {
      class: "oggi-view",
      "aria-labelledby": "view-oggi-title",
    });

    // Header con data corrente e segnaposto fase (popolato se sessione presente).
    var I18n = global.I18n;
    var headerTimeIso = I18n ? I18n.formatDateIso(new Date()) : "";
    var headerTimeText = I18n ? I18n.formatDateShort(new Date()) : "";
    var faseBadge = el("span", {
      class: "oggi-fase",
      "data-testid": "oggi-fase",
      hidden: "hidden",
    });
    var header = el(
      "header",
      { class: "oggi-header" },
      [
        el("time", { datetime: headerTimeIso, text: headerTimeText }),
        faseBadge,
      ]
    );
    section.appendChild(header);

    // Titolo SR-only per screen reader.
    section.appendChild(
      el("h1", {
        id: "view-oggi-title",
        class: "visually-hidden",
        text: t("view.oggi.title"),
      })
    );

    // Feedback condiviso per salva / micro / salta.
    ui.feedbackEl = el("p", {
      class: "oggi-feedback",
      "data-testid": "oggi-feedback",
      "aria-live": "polite",
      "data-state": "idle",
    });
    section.appendChild(ui.feedbackEl);

    // Contenitore della sessione (card o empty state).
    var body = el("div", { class: "oggi-body" });
    section.appendChild(body);

    mount.appendChild(section);

    // Stato di caricamento provvisorio: nessun render finché non sappiamo.
    var loading = el("p", {
      class: "oggi-loading",
      text: t("common.loading"),
    });
    body.appendChild(loading);

    var ready = caricaSessioneDelGiorno().then(function onSessione(sessione) {
      if (loading.parentNode === body) body.removeChild(loading);
      state.sessione = sessione;
      if (!sessione) {
        renderEmpty(body);
        return;
      }
      if (sessione.fase) {
        faseBadge.textContent = sessione.fase;
        faseBadge.hidden = false;
      }
      renderSessioneCard(body, sessione, state, ui);
    });

    return { state: state, ui: ui, ready: ready };
  }

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  if (!global.MaranelloViews) {
    global.MaranelloViews = {};
  }
  global.MaranelloViews.Oggi = renderOggiView;
})(typeof window !== "undefined" ? window : globalThis, document);
