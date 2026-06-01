/*
 * Maranello 2027 — App_HTML
 * File: js/modules/views/diario-corsa.js
 *
 * Vista "Diario corsa" (Task 12): lista cronologica delle sessioni di
 * corsa registrate in `sessioni_corsa`, con filtri per periodo (7g/30g
 * /tutto) e stato (tutti/Completa/Micro/Saltata), dettaglio espandibile
 * e azioni Modifica/Elimina.
 *
 * Ref: Req 22.4.c, 23.7
 */

(function initDiarioCorsaView(global, document) {
  "use strict";

  var STORE = "sessioni_corsa";

  // ---------------------------------------------------------------------------
  // DOM helper (stesso pattern di peso.js e oggi.js)
  // ---------------------------------------------------------------------------

  var ATTR_KEYS = {
    href: true,
    role: true,
    for: true,
    type: true,
    name: true,
    id: true,
    value: true,
    datetime: true,
    hidden: true,
  };

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
          key.indexOf("aria-") === 0 ||
          ATTR_KEYS[key]
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

  function formatDataShort(isoData) {
    if (!isoData) return "";
    try {
      var d = new Date(isoData);
      if (global.I18n && typeof global.I18n.formatDateShort === "function") {
        return global.I18n.formatDateShort(d);
      }
      return d.toLocaleDateString("it-IT");
    } catch (e) {
      return isoData;
    }
  }

  function setFeedback(node, message, stato) {
    if (!node) return;
    node.textContent = message || "";
    node.setAttribute("data-state", stato || "idle");
  }

  // ---------------------------------------------------------------------------
  // Routing interno: la vista decide cosa renderizzare sulla base del path
  // completo. Questo evita di dover cambiare il router per rotte
  // parametrizzate.
  // ---------------------------------------------------------------------------

  function routeCorsa(params, mount) {
    var path = (params && params.path) || [];
    // Path atteso: ["diario", "corsa", ...]
    var sub = path[2];
    if (sub === "nuova") {
      var FormCorsa =
        global.MaranelloViews && global.MaranelloViews.FormCorsa;
      if (typeof FormCorsa === "function") {
        return FormCorsa(params, mount);
      }
      renderFallback(mount);
      return;
    }
    if (sub === "modifica") {
      var FormCorsaEdit =
        global.MaranelloViews && global.MaranelloViews.FormCorsa;
      if (typeof FormCorsaEdit === "function") {
        return FormCorsaEdit(params, mount);
      }
      renderFallback(mount);
      return;
    }
    return renderList(params, mount);
  }

  function renderFallback(mount) {
    mount.appendChild(
      el("p", {
        class: "view-error",
        text: t("view.diario_corsa.load_error"),
      })
    );
  }

  // ---------------------------------------------------------------------------
  // Lista principale
  // ---------------------------------------------------------------------------

  function renderList(params, mount) {
    var Storage = global.MaranelloStorage;
    var Utils = global.MaranelloSessioniUtils;
    var Router = global.MaranelloRouter;

    var state = {
      records: [],
      filtroPeriodo: 0, // 0 = tutto (default)
      filtroStato: "", // "" = tutti
    };

    // --- Header ---
    var headerCta = el("a", {
      href: "#/diario/corsa/nuova",
      class: "diario-cta diario-cta-primary",
      "data-testid": "diario-corsa-nuova",
      text: "+ " + t("view.diario_corsa.nuova"),
    });

    var header = el(
      "header",
      { class: "diario-header" },
      [
        el("h2", {
          class: "view-title",
          text: t("view.diario_corsa.titolo"),
        }),
        headerCta,
      ]
    );
    mount.appendChild(header);

    // --- Feedback inline ---
    var feedbackEl = el("p", {
      class: "diario-feedback",
      "data-testid": "diario-corsa-feedback",
      "aria-live": "polite",
      "data-state": "idle",
    });
    mount.appendChild(feedbackEl);

    // --- Filtri ---
    var periodoSelect = el("select", {
      id: "diario-corsa-periodo",
      name: "periodo",
      class: "diario-filter-select",
      "data-testid": "diario-corsa-filtro-periodo",
    });
    [
      { v: "7", k: "view.diario_corsa.filtro_periodo_7" },
      { v: "30", k: "view.diario_corsa.filtro_periodo_30" },
      { v: "0", k: "view.diario_corsa.filtro_periodo_tutto" },
    ].forEach(function addOpt(opt) {
      periodoSelect.appendChild(
        el("option", { value: opt.v, text: t(opt.k) })
      );
    });
    periodoSelect.value = String(state.filtroPeriodo); // "0" = tutto

    var statoSelect = el("select", {
      id: "diario-corsa-stato",
      name: "stato",
      class: "diario-filter-select",
      "data-testid": "diario-corsa-filtro-stato",
    });
    [
      { v: "", k: "view.diario_corsa.filtro_stato_tutti" },
      { v: "Completa", k: "view.diario_corsa.filtro_stato_completa" },
      { v: "Micro", k: "view.diario_corsa.filtro_stato_micro" },
      { v: "Saltata", k: "view.diario_corsa.filtro_stato_saltata" },
    ].forEach(function addOpt(opt) {
      statoSelect.appendChild(
        el("option", { value: opt.v, text: t(opt.k) })
      );
    });
    statoSelect.value = state.filtroStato;

    var filtersBar = el("div", { class: "diario-filters" }, [
      el(
        "div",
        { class: "diario-filter-group" },
        [
          el("label", {
            for: "diario-corsa-periodo",
            text: t("view.diario_corsa.filtro_periodo_label"),
          }),
          periodoSelect,
        ]
      ),
      el(
        "div",
        { class: "diario-filter-group" },
        [
          el("label", {
            for: "diario-corsa-stato",
            text: t("view.diario_corsa.filtro_stato_label"),
          }),
          statoSelect,
        ]
      ),
    ]);
    mount.appendChild(filtersBar);

    periodoSelect.addEventListener("change", function onPeriodo() {
      state.filtroPeriodo = Number(periodoSelect.value);
      renderListBody();
    });
    statoSelect.addEventListener("change", function onStato() {
      state.filtroStato = statoSelect.value;
      renderListBody();
    });

    // --- Body lista ---
    var listBody = el("div", {
      class: "diario-list",
      "data-testid": "diario-corsa-list",
    });
    mount.appendChild(listBody);

    function renderListBody() {
      listBody.innerHTML = "";
      var filtered = state.records;
      if (Utils) {
        filtered = Utils.filtraPerPeriodo(filtered, state.filtroPeriodo);
        filtered = Utils.filtraPerStato(filtered, state.filtroStato);
      }
      // Ordina per data desc (fallback se Utils non disponibile).
      filtered = filtered.slice().sort(function cmp(a, b) {
        var ta = new Date(a.data || 0).getTime();
        var tb = new Date(b.data || 0).getTime();
        return tb - ta;
      });

      if (filtered.length === 0) {
        var empty = el("div", { class: "diario-empty" }, [
          el("p", { text: t("view.diario_corsa.vuoto") }),
          el("a", {
            href: "#/diario/corsa/nuova",
            class: "diario-cta diario-cta-primary",
            text: t("view.diario_corsa.primo_inserimento"),
          }),
        ]);
        listBody.appendChild(empty);
        return;
      }

      filtered.forEach(function addRow(rec) {
        listBody.appendChild(buildRow(rec));
      });
    }

    function buildRow(rec) {
      var Utils = global.MaranelloSessioniUtils;
      var tempoTotale = Utils ? Utils.sommaTempiKm(rec.tempiPerKm) : 0;

      // --- Riga 1: data, distanza, FC, RPE, badge stato ---
      // Il pulsante Analisi NON va dentro <summary> perché il browser
      // intercetterebbe il click per aprire/chiudere il <details>.
      var riga1 = el("div", { class: "diario-row-riga1" });
      riga1.appendChild(el("span", { class: "diario-row-data", text: formatDataShort(rec.data) }));
      if (rec.distanzaTotaleKm != null) {
        riga1.appendChild(el("span", { class: "diario-row-chip", text: formatKm(rec.distanzaTotaleKm) + " km" }));
      }
      if (rec.fcMedia != null) {
        riga1.appendChild(el("span", { class: "diario-row-chip", text: "FC " + rec.fcMedia + " bpm" }));
      }
      if (rec.rpeSessione != null) {
        riga1.appendChild(el("span", { class: "diario-row-chip", text: "RPE " + rec.rpeSessione }));
      }
      if (Array.isArray(rec.dolori) && rec.dolori.length > 0) {
        riga1.appendChild(el("span", { class: "diario-row-chip diario-row-chip-warn",
          text: t("view.diario_corsa.riga_dolori_n", { n: rec.dolori.length }) }));
      }
      riga1.appendChild(buildStatoBadge(rec.stato));

      // --- Riga 2: tempo totale + tempi per km ---
      var riga2 = el("div", { class: "diario-row-riga2" });
      if (tempoTotale > 0) {
        riga2.appendChild(el("span", { class: "diario-row-chip diario-row-chip-tempo", text: "Tot. " + formatHMS(tempoTotale) }));
      }
      if (Array.isArray(rec.tempiPerKm) && rec.tempiPerKm.length > 0) {
        rec.tempiPerKm.forEach(function addKmChip(sec, idx) {
          var tempoFmt = Utils ? Utils.formatTempoMinSec(sec) : String(sec);
          riga2.appendChild(el("span", { class: "diario-row-chip diario-row-chip-km",
            title: "Km " + (idx + 1), text: "Km" + (idx + 1) + " " + tempoFmt }));
        });
      }

      var summaryWrap = el("div", { class: "diario-row-summary-wrap" }, [riga1, riga2]);
      var dettaglio = buildDettaglio(rec);
      var actions = buildActions(rec);

      var details = el("details", {
        class: "diario-row",
        "data-testid": "diario-corsa-row",
        "data-record-id": rec.id || "",
      }, [
        el("summary", { class: "diario-row-summary", "data-testid": "diario-corsa-row-summary" }, [summaryWrap]),
        dettaglio,
        actions,
      ]);

      // --- Pulsante Analisi e box: FUORI dal <details> ---
      var btnAnalisi = el("button", {
        type: "button",
        class: "diario-analisi-btn",
        "data-testid": "diario-corsa-analisi",
        text: "Analisi",
      });

      var analisiBox = el("div", {
        class: "diario-analisi-box",
        "data-testid": "diario-corsa-analisi-box",
        hidden: "hidden",
      });

      btnAnalisi.addEventListener("click", function onAnalisi() {
        if (!analisiBox.hidden) {
          analisiBox.hidden = true;
          btnAnalisi.classList.remove("is-active");
          return;
        }
        if (!analisiBox.dataset.generata) {
          var Analisi = global.MaranelloAnalisiCorsa;
          analisiBox.innerHTML = "";
          if (Analisi) {
            var risultato = Analisi.genera(rec, state.records);
            analisiBox.appendChild(el("h4", { class: "diario-analisi-titolo", text: "Analisi sessione" }));
            analisiBox.appendChild(el("p", { class: "diario-analisi-testo", text: risultato.singola }));
            analisiBox.appendChild(el("h4", { class: "diario-analisi-titolo", text: "Confronto con le sessioni precedenti" }));
            analisiBox.appendChild(el("p", { class: "diario-analisi-testo", text: risultato.confronto }));
          } else {
            analisiBox.appendChild(el("p", { text: "Modulo di analisi non disponibile." }));
          }
          analisiBox.dataset.generata = "1";
        }
        analisiBox.hidden = false;
        btnAnalisi.classList.add("is-active");
      });

      // Barra con il solo pulsante Analisi, allineata a destra
      var analisiBar = el("div", { class: "diario-analisi-bar" }, [btnAnalisi]);

      // Wrapper esterno che contiene tutto
      var wrap = el("div", { class: "diario-row-outer" }, [details, analisiBar, analisiBox]);
      return wrap;
    }

    function buildStatoBadge(stato) {
      if (!stato) stato = "Completa";
      var cls = "diario-stato-badge";
      if (stato === "Micro") cls += " diario-stato-micro";
      else if (stato === "Saltata") cls += " diario-stato-saltata";
      else if (stato === "Completa") cls += " diario-stato-completa";
      return el("span", { class: cls, text: stato });
    }

    function buildDettaglio(rec) {
      var Utils = global.MaranelloSessioniUtils;
      var rows = [];
      function push(key, valueEl) {
        if (!valueEl) return;
        rows.push(el("dt", { text: t(key) }));
        rows.push(el("dd", {}, [valueEl]));
      }

      push(
        "view.diario_corsa.dettaglio_distanza",
        rec.distanzaTotaleKm != null
          ? document.createTextNode(formatKm(rec.distanzaTotaleKm) + " km")
          : document.createTextNode(t("common.nessun_dato"))
      );
      var tempoTotale = Utils ? Utils.sommaTempiKm(rec.tempiPerKm) : 0;
      push(
        "view.diario_corsa.dettaglio_tempo_totale",
        document.createTextNode(
          tempoTotale > 0 ? formatHMS(tempoTotale) : t("common.nessun_dato")
        )
      );
      if (Array.isArray(rec.tempiPerKm) && rec.tempiPerKm.length > 0) {
        var tempiStr = rec.tempiPerKm
          .map(function fmt(s) {
            return Utils ? Utils.formatTempoMinSec(s) : String(s);
          })
          .join(", ");
        push(
          "view.diario_corsa.dettaglio_tempi_km",
          document.createTextNode(tempiStr)
        );
      }
      if (rec.fcMedia != null) {
        push(
          "view.diario_corsa.dettaglio_fc_media",
          document.createTextNode(rec.fcMedia + " bpm")
        );
      }
      if (rec.fcPicco != null) {
        push(
          "view.diario_corsa.dettaglio_fc_picco",
          document.createTextNode(rec.fcPicco + " bpm")
        );
      }
      if (rec.rpeSessione != null) {
        push(
          "view.diario_corsa.dettaglio_rpe",
          document.createTextNode(String(rec.rpeSessione))
        );
      }
      // Sonno notte precedente: campo rimosso dal form; lo mostriamo solo
      // se presente per retrocompatibilita' con record storici.
      if (rec.sonnoNottePrec != null) {
        push(
          "view.diario_corsa.dettaglio_sonno",
          document.createTextNode(String(rec.sonnoNottePrec))
        );
      }
      // Risvegli notturni: campo rimosso dal form; mostrato solo per
      // retrocompatibilita' con record storici che lo contengono.
      if (rec.risvegliNotturni != null) {
        push(
          "view.diario_corsa.dettaglio_risvegli",
          document.createTextNode(String(rec.risvegliNotturni))
        );
      }
      if (rec.idratazioneLitri != null) {
        push(
          "view.diario_corsa.dettaglio_idratazione",
          document.createTextNode(
            String(rec.idratazioneLitri).replace(".", ",") + " L"
          )
        );
      }
      if (Array.isArray(rec.dolori) && rec.dolori.length > 0 && Utils) {
        push(
          "view.diario_corsa.dettaglio_dolori",
          document.createTextNode(Utils.formatDolori(rec.dolori))
        );
      }
      if (rec.schemaWalkRun) {
        var wr = rec.schemaWalkRun;
        push(
          "view.diario_corsa.dettaglio_walkrun",
          document.createTextNode(
            t("view.diario_corsa.dettaglio_walkrun_fmt", {
              camm: wr.cammMetri != null ? wr.cammMetri : "?",
              corsa: wr.corsaMetri != null ? wr.corsaMetri : "?",
              rip: wr.ripetizioni != null ? wr.ripetizioni : "?",
            })
          )
        );
      }
      if (rec.motivazioneSalto) {
        push(
          "view.diario_corsa.dettaglio_motivazione",
          document.createTextNode(String(rec.motivazioneSalto))
        );
      }
      if (rec.note) {
        push(
          "view.diario_corsa.dettaglio_note",
          document.createTextNode(String(rec.note))
        );
      }
      return el("dl", { class: "diario-row-meta" }, rows);
    }

    function buildActions(rec) {
      var editBtn = el("a", {
        href:
          "#/diario/corsa/modifica?id=" + encodeURIComponent(rec.id || ""),
        class: "diario-action diario-action-edit",
        "data-testid": "diario-corsa-modifica",
        text: t("view.diario_corsa.modifica"),
      });
      var delBtn = el("button", {
        type: "button",
        class: "diario-action diario-action-delete",
        "data-testid": "diario-corsa-elimina",
        text: t("view.diario_corsa.elimina"),
      });
      delBtn.addEventListener("click", function onDelete() {
        var dateText = formatDataShort(rec.data);
        var confirmText = t("view.diario_corsa.elimina_conferma", {
          data: dateText,
        });
        if (!global.confirm(confirmText)) return;
        if (
          !Storage ||
          typeof Storage.delete !== "function" ||
          !rec.id
        ) {
          setFeedback(
            feedbackEl,
            t("view.diario_corsa.errore_generico"),
            "error"
          );
          return;
        }
        Storage.delete(STORE, rec.id, { origine: "utente" })
          .then(function onDone() {
            state.records = state.records.filter(function keep(r) {
              return r.id !== rec.id;
            });
            setFeedback(
              feedbackEl,
              t("view.diario_corsa.eliminata_ok"),
              "success"
            );
            renderListBody();
            global.setTimeout(function clear() {
              if (feedbackEl.getAttribute("data-state") === "success") {
                setFeedback(feedbackEl, "", "idle");
              }
            }, 2500);
          })
          .catch(function onErr(err) {
            if (global.console && global.console.error) {
              global.console.error("[diario-corsa] errore elimina:", err);
            }
            setFeedback(
              feedbackEl,
              t("view.diario_corsa.errore_generico"),
              "error"
            );
          });
      });
      return el("div", { class: "diario-row-actions" }, [editBtn, delBtn]);
    }

    // --- Caricamento iniziale ---
    var ready = caricaRecords();

    function caricaRecords() {
      if (!Storage || typeof Storage.query !== "function") {
        state.records = [];
        renderListBody();
        return Promise.resolve();
      }
      return Storage.query(STORE, { index: "by_data" })
        .then(function onRows(rows) {
          state.records = Array.isArray(rows) ? rows : [];
          renderListBody();
        })
        .catch(function onErr(err) {
          if (global.console && global.console.error) {
            global.console.error("[diario-corsa] errore caricamento:", err);
          }
          state.records = [];
          renderListBody();
          setFeedback(feedbackEl, t("view.diario_corsa.load_error"), "error");
        });
    }

    return { state: state, ready: ready, _renderListBody: renderListBody };
  }

  // ---------------------------------------------------------------------------
  // Formattazione numeri / tempi
  // ---------------------------------------------------------------------------

  function formatKm(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "";
    return String(Math.round(value * 100) / 100).replace(".", ",");
  }

  function formatHMS(totalSeconds) {
    if (typeof totalSeconds !== "number" || totalSeconds <= 0) return "0:00";
    var s = Math.round(totalSeconds);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var r = s % 60;
    if (h > 0) {
      return (
        h +
        ":" +
        String(m).padStart(2, "0") +
        ":" +
        String(r).padStart(2, "0")
      );
    }
    return m + ":" + String(r).padStart(2, "0");
  }

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  if (!global.MaranelloViews) {
    global.MaranelloViews = {};
  }
  global.MaranelloViews.DiarioCorsa = {
    route: routeCorsa,
    list: renderList,
  };
})(typeof window !== "undefined" ? window : globalThis, document);
