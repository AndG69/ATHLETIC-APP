/*
 * Maranello 2027 — App_HTML
 * File: js/modules/views/diario-palestra.js
 *
 * Vista "Diario palestra" (Task 13): lista cronologica delle sessioni di
 * palestra registrate in `sessioni_palestra`, raggruppate per ISO week,
 * con dettaglio tabellare degli esercizi (gruppo / nome / serie /
 * ripetizioni / carico) e azioni Modifica/Elimina.
 *
 * Ref: Req 6.1, 22.4.d, 23.7
 */

(function initDiarioPalestraView(global, document) {
  "use strict";

  var STORE = "sessioni_palestra";
  var MS_GIORNO = 24 * 60 * 60 * 1000;

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
    scope: true,
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

  function formatDateDm(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    var d = String(date.getUTCDate()).padStart(2, "0");
    var m = String(date.getUTCMonth() + 1).padStart(2, "0");
    return d + "/" + m;
  }

  function setFeedback(node, message, stato) {
    if (!node) return;
    node.textContent = message || "";
    node.setAttribute("data-state", stato || "idle");
  }

  // ---------------------------------------------------------------------------
  // Router interno
  // ---------------------------------------------------------------------------

  function routePalestra(params, mount) {
    var path = (params && params.path) || [];
    var sub = path[2];
    if (sub === "nuova" || sub === "modifica") {
      var FormPalestra =
        global.MaranelloViews && global.MaranelloViews.FormPalestra;
      if (typeof FormPalestra === "function") {
        return FormPalestra(params, mount);
      }
      mount.appendChild(
        el("p", {
          class: "view-error",
          text: t("view.diario_palestra.load_error"),
        })
      );
      return;
    }
    return renderList(params, mount);
  }

  // ---------------------------------------------------------------------------
  // Lista
  // ---------------------------------------------------------------------------

  function renderList(params, mount) {
    var Storage = global.MaranelloStorage;
    var Utils = global.MaranelloSessioniUtils;
    var OggiUtils = global.MaranelloOggiUtils;

    var state = {
      records: [],
      filtroPeriodo: 0, // 0 = tutto (default, come diario corsa)
      filtroStato: "",
    };

    // --- Header ---
    var headerCta = el("a", {
      href: "#/diario/palestra/nuova",
      class: "diario-cta diario-cta-primary",
      "data-testid": "diario-palestra-nuova",
      text: "+ " + t("view.diario_palestra.nuova"),
    });
    mount.appendChild(
      el("header", { class: "diario-header" }, [
        el("h2", {
          class: "view-title",
          text: t("view.diario_palestra.titolo"),
        }),
        headerCta,
      ])
    );

    var feedbackEl = el("p", {
      class: "diario-feedback",
      "data-testid": "diario-palestra-feedback",
      "aria-live": "polite",
      "data-state": "idle",
    });
    mount.appendChild(feedbackEl);

    // --- Filtri ---
    var periodoSelect = el("select", {
      id: "diario-palestra-periodo",
      name: "periodo",
      class: "diario-filter-select",
      "data-testid": "diario-palestra-filtro-periodo",
    });
    [
      { v: "7", k: "view.diario_palestra.filtro_periodo_7" },
      { v: "30", k: "view.diario_palestra.filtro_periodo_30" },
      { v: "0", k: "view.diario_palestra.filtro_periodo_tutto" },
    ].forEach(function addOpt(opt) {
      periodoSelect.appendChild(
        el("option", { value: opt.v, text: t(opt.k) })
      );
    });
    periodoSelect.value = String(state.filtroPeriodo);

    var statoSelect = el("select", {
      id: "diario-palestra-stato",
      name: "stato",
      class: "diario-filter-select",
      "data-testid": "diario-palestra-filtro-stato",
    });
    [
      { v: "", k: "view.diario_palestra.filtro_stato_tutti" },
      { v: "Completa", k: "view.diario_palestra.filtro_stato_completa" },
      { v: "Micro", k: "view.diario_palestra.filtro_stato_micro" },
      { v: "Saltata", k: "view.diario_palestra.filtro_stato_saltata" },
    ].forEach(function addOpt(opt) {
      statoSelect.appendChild(
        el("option", { value: opt.v, text: t(opt.k) })
      );
    });
    statoSelect.value = state.filtroStato;

    var filtersBar = el("div", { class: "diario-filters" }, [
      el("div", { class: "diario-filter-group" }, [
        el("label", {
          for: "diario-palestra-periodo",
          text: t("view.diario_palestra.filtro_periodo_label"),
        }),
        periodoSelect,
      ]),
      el("div", { class: "diario-filter-group" }, [
        el("label", {
          for: "diario-palestra-stato",
          text: t("view.diario_palestra.filtro_stato_label"),
        }),
        statoSelect,
      ]),
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

    // --- Body ---
    var listBody = el("div", {
      class: "diario-list",
      "data-testid": "diario-palestra-list",
    });
    mount.appendChild(listBody);

    function renderListBody() {
      listBody.innerHTML = "";
      var filtered = state.records;
      if (Utils) {
        filtered = Utils.filtraPerPeriodo(filtered, state.filtroPeriodo);
        filtered = Utils.filtraPerStato(filtered, state.filtroStato);
      }
      if (filtered.length === 0) {
        var empty = el("div", { class: "diario-empty" }, [
          el("p", { text: t("view.diario_palestra.vuoto") }),
          el("a", {
            href: "#/diario/palestra/nuova",
            class: "diario-cta diario-cta-primary",
            text: t("view.diario_palestra.primo_inserimento"),
          }),
        ]);
        listBody.appendChild(empty);
        return;
      }

      var gruppi = null;
      if (Utils && OggiUtils) {
        gruppi = Utils.raggruppaPerSettimana(filtered, OggiUtils.toIsoWeekId);
      }
      if (!gruppi || gruppi.size === 0) {
        // Fallback: raggruppamento manuale per settimana — se non possiamo
        // calcolare l'ISO week, mostriamo un'unica lista piatta.
        var flatWrapper = el(
          "div",
          { class: "diario-settimana-gruppo" },
          filtered.map(buildRow)
        );
        listBody.appendChild(flatWrapper);
        return;
      }

      gruppi.forEach(function renderSettimana(records, weekId) {
        var bounds = Utils.settimanaIsoBounds(weekId);
        var da = bounds ? formatDateDm(bounds.inizio) : "";
        var a = bounds ? formatDateDm(bounds.fine) : "";
        var settimanaHeader = el(
          "header",
          { class: "diario-settimana-header" },
          [
            el("h3", {
              class: "diario-settimana-titolo",
              text: t("view.diario_palestra.settimana_header", {
                id: weekId,
                da: da,
                a: a,
              }),
            }),
            el("span", {
              class: "diario-settimana-count",
              text: t("view.diario_palestra.settimana_conteggio", {
                n: records.length,
              }),
            }),
          ]
        );
        var children = [settimanaHeader];
        records.forEach(function addR(r) {
          children.push(buildRow(r));
        });
        var wrap = el(
          "div",
          {
            class: "diario-settimana-gruppo",
            "data-testid": "diario-palestra-settimana",
            "data-settimana-id": weekId,
          },
          children
        );
        listBody.appendChild(wrap);
      });
    }

    function buildStatoBadge(stato) {
      if (!stato) stato = "Completa";
      var cls = "diario-stato-badge";
      if (stato === "Micro") cls += " diario-stato-micro";
      else if (stato === "Saltata") cls += " diario-stato-saltata";
      else cls += " diario-stato-completa";
      return el("span", { class: cls, text: stato });
    }

    function buildRow(rec) {
      var gruppiN = Array.isArray(rec.gruppi) ? rec.gruppi.length : 0;
      var eserciziN = Utils ? Utils.contaEsercizi(rec.gruppi) : 0;

      var summaryChildren = [
        el("span", {
          class: "diario-row-data",
          text: formatDataShort(rec.data),
        }),
        el("span", {
          class: "diario-row-chip",
          text: t("view.diario_palestra.riga_gruppi_n", { n: gruppiN }),
        }),
        el("span", {
          class: "diario-row-chip",
          text: t("view.diario_palestra.riga_esercizi_n", { n: eserciziN }),
        }),
      ];
      if (rec.rpeSeduta != null) {
        summaryChildren.push(
          el("span", {
            class: "diario-row-chip",
            text: t("view.diario_palestra.riga_rpe", {
              rpe: rec.rpeSeduta,
            }),
          })
        );
      }
      summaryChildren.push(buildStatoBadge(rec.stato));

      var summary = el("summary", {
        class: "diario-row-summary",
        "data-testid": "diario-palestra-row-summary",
      });
      summaryChildren.forEach(function push(c) {
        summary.appendChild(c);
      });

      var tabella = buildTabellaEsercizi(rec);
      var extra = buildExtraDettagli(rec);
      var actions = buildActions(rec);

      return el(
        "details",
        {
          class: "diario-row",
          "data-testid": "diario-palestra-row",
          "data-record-id": rec.id || "",
        },
        [summary, tabella, extra, actions]
      );
    }

    function buildTabellaEsercizi(rec) {
      if (!Array.isArray(rec.gruppi) || rec.gruppi.length === 0) {
        return el("p", {
          class: "diario-row-empty",
          text: t("common.nessun_dato"),
        });
      }
      var rows = [];
      rec.gruppi.forEach(function add(g) {
        if (!g || !Array.isArray(g.esercizi)) return;
        g.esercizi.forEach(function addEx(ex) {
          var ripStr = "";
          if (Array.isArray(ex.ripetizioni)) {
            ripStr = ex.ripetizioni.join(",");
          } else if (ex.ripetizioni != null) {
            ripStr = String(ex.ripetizioni);
          }
          rows.push(
            el("tr", {}, [
              el("td", { text: g.gruppo || "" }),
              el("td", { text: ex.nome || "" }),
              el("td", { text: ex.serie != null ? String(ex.serie) : "" }),
              el("td", { text: ripStr }),
              el("td", {
                text: ex.tempoSecondi != null
                  ? ex.tempoSecondi + " sec"
                  : ex.carico != null
                    ? String(ex.carico).replace(".", ",") + " kg"
                    : "",
              }),
            ])
          );
        });
      });

      return el(
        "table",
        {
          class: "diario-esercizi-table",
          "data-testid": "diario-palestra-table",
        },
        [
          el("thead", {}, [
            el("tr", {}, [
              el("th", {
                scope: "col",
                text: t("view.diario_palestra.tabella_gruppo"),
              }),
              el("th", {
                scope: "col",
                text: t("view.diario_palestra.tabella_esercizio"),
              }),
              el("th", {
                scope: "col",
                text: t("view.diario_palestra.tabella_serie"),
              }),
              el("th", {
                scope: "col",
                text: t("view.diario_palestra.tabella_ripetizioni"),
              }),
              el("th", {
                scope: "col",
                text: "Carico / Tempo",
              }),
            ]),
          ]),
          el("tbody", {}, rows),
        ]
      );
    }

    function buildExtraDettagli(rec) {
      var rows = [];
      function push(key, text) {
        if (text === undefined || text === null || text === "") return;
        rows.push(el("dt", { text: t(key) }));
        rows.push(el("dd", { text: text }));
      }
      if (rec.tapisMinuti != null || rec.tapisPendenzaMax != null) {
        push(
          "view.diario_palestra.dettaglio_tapis",
          t("view.diario_palestra.dettaglio_tapis_fmt", {
            min: rec.tapisMinuti != null ? rec.tapisMinuti : 0,
            pend:
              rec.tapisPendenzaMax != null ? rec.tapisPendenzaMax : 0,
          })
        );
      }
      if (rec.rpeSeduta != null) {
        push(
          "view.diario_palestra.dettaglio_rpe",
          String(rec.rpeSeduta)
        );
      }
      if (Array.isArray(rec.dolori) && rec.dolori.length > 0 && Utils) {
        push(
          "view.diario_palestra.dettaglio_dolori",
          Utils.formatDolori(rec.dolori)
        );
      }
      if (rec.motivazioneSalto) {
        push(
          "view.diario_palestra.dettaglio_motivazione",
          String(rec.motivazioneSalto)
        );
      }
      if (rec.note) {
        push("view.diario_palestra.dettaglio_note", String(rec.note));
      }
      if (rows.length === 0) return null;
      return el("dl", { class: "diario-row-meta" }, rows);
    }

    function buildActions(rec) {
      var editBtn = el("a", {
        href:
          "#/diario/palestra/modifica?id=" +
          encodeURIComponent(rec.id || ""),
        class: "diario-action diario-action-edit",
        "data-testid": "diario-palestra-modifica",
        text: t("view.diario_palestra.modifica"),
      });
      var delBtn = el("button", {
        type: "button",
        class: "diario-action diario-action-delete",
        "data-testid": "diario-palestra-elimina",
        text: t("view.diario_palestra.elimina"),
      });
      delBtn.addEventListener("click", function onDelete() {
        var dateText = formatDataShort(rec.data);
        var confirmText = t("view.diario_palestra.elimina_conferma", {
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
            t("view.diario_palestra.errore_generico"),
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
              t("view.diario_palestra.eliminata_ok"),
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
              global.console.error("[diario-palestra] errore elimina:", err);
            }
            setFeedback(
              feedbackEl,
              t("view.diario_palestra.errore_generico"),
              "error"
            );
          });
      });
      return el("div", { class: "diario-row-actions" }, [editBtn, delBtn]);
    }

    // --- Caricamento ---
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
            global.console.error("[diario-palestra] errore caricamento:", err);
          }
          state.records = [];
          renderListBody();
          setFeedback(
            feedbackEl,
            t("view.diario_palestra.load_error"),
            "error"
          );
        });
    }

    return { state: state, ready: ready, _renderListBody: renderListBody };
  }

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  if (!global.MaranelloViews) {
    global.MaranelloViews = {};
  }
  global.MaranelloViews.DiarioPalestra = {
    route: routePalestra,
    list: renderList,
  };
})(typeof window !== "undefined" ? window : globalThis, document);
