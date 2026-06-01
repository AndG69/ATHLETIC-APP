/*
 * Maranello 2027 — App_HTML
 * File: js/app.js
 *
 * Entry point dell'applicazione. Costruisce lo shell (header, main, bottom
 * nav, footer), registra le rotte (Req 22.4) nel router hash-based e avvia
 * il layer di persistenza IndexedDB (Task 2).
 *
 * Dipendenze globali previste (già caricate da index.html in quest'ordine):
 *   1) window.APP_VERSION       (js/version.js)
 *   2) window.I18n               (js/i18n/it.js)
 *   3) window.MaranelloStorage   (js/services/storage.js)
 *   4) window.MaranelloRouter    (js/router.js)
 *
 * Nota transitoria (Req 24.6): il badge della versione è mostrato sia nel
 * footer sia nella view Impostazioni. La collocazione definitiva è
 * Impostazioni; teniamo anche il footer in questa fase per continuità con
 * lo shell precedente (Task 1.3).
 */

(function bootstrapApp(global, document) {
  "use strict";

  var I18n = global.I18n;
  var Router = global.MaranelloRouter;
  var Storage = global.MaranelloStorage;

  // Elementi di shell condivisi. I riferimenti "live" permettono alle view
  // (Impostazioni in particolare) di leggere lo stato DB in tempo reale.
  var dbState = { text: "", state: "pending" };
  var dbStatusListeners = [];

  // ----------------------------------------------------------------
  // DOM builders helpers
  // ----------------------------------------------------------------

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
        } else if (key === "href" || key === "role" || key === "datetime") {
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
    return I18n && typeof I18n.t === "function" ? I18n.t(key, params) : key;
  }

  // ----------------------------------------------------------------
  // Gestione stato DB (badge) — pubblicato ai listener (view Impostazioni)
  // ----------------------------------------------------------------

  function setDbStatus(stateKey) {
    var text;
    switch (stateKey) {
      case "ready":
        text = t("db.status.ready");
        break;
      case "error":
        text = t("db.status.error");
        break;
      default:
        text = t("db.status.pending");
        stateKey = "pending";
    }
    dbState = { text: text, state: stateKey };
    // Aggiorna il badge del footer (se presente).
    var footerBadge = document.querySelector(
      "[data-testid='app-db-status']"
    );
    if (footerBadge) {
      footerBadge.textContent = text;
      footerBadge.setAttribute("data-state", stateKey);
    }
    // Notifica tutti i listener (es. view Impostazioni aperta).
    dbStatusListeners.forEach(function notify(fn) {
      try {
        fn(dbState);
      } catch (err) {
        if (global.console && global.console.warn) {
          global.console.warn("[app] listener DB status ha sollevato", err);
        }
      }
    });
  }

  function subscribeDbStatus(listener) {
    if (typeof listener !== "function") return function noop() {};
    dbStatusListeners.push(listener);
    // Invio immediato dello stato corrente per sincronizzare la view.
    try {
      listener(dbState);
    } catch (e) {
      /* ignore */
    }
    return function unsubscribe() {
      var idx = dbStatusListeners.indexOf(listener);
      if (idx >= 0) dbStatusListeners.splice(idx, 1);
    };
  }

  // ----------------------------------------------------------------
  // Shell rendering
  // ----------------------------------------------------------------

  // Elenco rotte ordinate come appariranno nella bottom-nav.
  var NAV_ITEMS = [
    { hash: "#/settimana", labelKey: "nav.settimana", icon: "\uD83D\uDCC5" },
    { hash: "#/diario/corsa", labelKey: "nav.diario_corsa", icon: "\uD83C\uDFC3" },
    {
      hash: "#/diario/palestra",
      labelKey: "nav.diario_palestra",
      icon: "\uD83C\uDFCB",
    },
    { hash: "#/peso", labelKey: "nav.peso", icon: "\u2696" },
    { hash: "#/dashboard", labelKey: "nav.dashboard", icon: "\uD83D\uDCCA" },
    { hash: "#/anagrafica-palestra", labelKey: "nav.schede", icon: "\uD83D\uDCCB" },
    {
      hash: "#/impostazioni",
      labelKey: "nav.impostazioni",
      icon: "\u2699",
      ariaLabelKey: "nav.impostazioni.aria",
    },
  ];

  // Rotte ulteriori non presenti nella bottom-nav ma registrate (Req 22.4).
  var EXTRA_ROUTES = ["#/allerte"];

  /** Costruisce il layout completo e ritorna riferimenti utili. */
  function renderShell(root) {
    root.innerHTML = "";

    var now = new Date();
    var header = el("header", { class: "shell-header", role: "banner" }, [
      el("h1", { text: t("app.title") }),
      el("time", {
        class: "shell-date",
        datetime: I18n.formatDateIso(now),
        text: I18n.formatDateShort(now),
      }),
    ]);

    var main = el("main", {
      id: "view-mount",
      class: "shell-main",
      role: "main",
    });

    var navLinks = NAV_ITEMS.map(function buildLink(item) {
      var link = el(
        "a",
        {
          href: item.hash,
          "data-route": item.hash,
          "aria-label": item.ariaLabelKey ? t(item.ariaLabelKey) : null,
        },
        [
          el("span", {
            class: "shell-nav-icon",
            "aria-hidden": "true",
            text: item.icon,
          }),
          el("span", { class: "shell-nav-label", text: t(item.labelKey) }),
        ]
      );
      return link;
    });

    var nav = el(
      "nav",
      {
        class: "shell-nav",
        role: "navigation",
        "aria-label": t("nav.aria_label"),
      },
      navLinks
    );

    var footer = el(
      "footer",
      { class: "shell-footer", role: "contentinfo" },
      [
        buildDbStatusBadge(),
        el("span", { class: "app-footer-sep", text: t("common.separator") }),
        buildVersionBadge(),
      ]
    );

    root.appendChild(header);
    root.appendChild(main);
    root.appendChild(nav);
    root.appendChild(footer);

    return { main: main, navLinks: navLinks };
  }

  function buildDbStatusBadge() {
    return el("span", {
      class: "app-db-status",
      "data-testid": "app-db-status",
      "data-state": dbState.state,
      text: dbState.text,
    });
  }

  function buildVersionBadge() {
    // La stringa "Versione {v}" viene spezzata: il prefisso diventa testo,
    // il numero di versione va nel badge monospazio.
    var template = t("footer.version", { v: "" });
    var prefix = template.replace(/\{v\}$/, "").replace(/\s+$/, "") + " ";
    var badge = el("span", {
      class: "app-version-badge",
      "data-testid": "app-version-badge",
      text: "v" + (global.APP_VERSION || "0.0.0"),
    });
    var wrap = el("span", { class: "app-version-wrap" });
    wrap.appendChild(document.createTextNode(prefix));
    wrap.appendChild(badge);
    return wrap;
  }

  // ----------------------------------------------------------------
  // View placeholder (reali nei task successivi)
  // ----------------------------------------------------------------

  /**
   * Crea una view placeholder generica con titolo + descrizione. Le view
   * reali (Oggi, Settimana, ecc.) sostituiranno questi handler nei task
   * del Gruppo B.
   */
  function makePlaceholderView(titleKey, descriptionKey) {
    return function render(params, mount) {
      var card = el("section", {
        class: "view-placeholder",
        "aria-labelledby": "view-title",
      });
      card.appendChild(
        el("h2", { id: "view-title", text: t(titleKey) })
      );
      card.appendChild(el("p", { text: t(descriptionKey) }));
      mount.appendChild(card);
    };
  }

  /**
   * View Impostazioni: oltre al placeholder, mostra lo stato del DB e il
   * badge della versione (Req 24.6). Si iscrive ai cambi di stato DB per
   * aggiornarsi in tempo reale.
   */
  function renderImpostazioniView(params, mount) {
    var card = el("section", {
      class: "view-placeholder",
      "aria-labelledby": "view-title",
    });
    card.appendChild(
      el("h2", { id: "view-title", text: t("view.impostazioni.title") })
    );
    card.appendChild(el("p", { text: t("view.impostazioni.placeholder") }));

    var statusBadge = el("span", {
      class: "app-db-status",
      "data-testid": "settings-db-status",
      "data-state": dbState.state,
      text: dbState.text,
    });
    var versionBadge = el("span", {
      class: "app-version-badge",
      "data-testid": "settings-version-badge",
      text: "v" + (global.APP_VERSION || "0.0.0"),
    });

    var meta = el("dl", { class: "view-meta" }, [
      el("dt", { text: t("view.impostazioni.stato_db") }),
      el("dd", {}, [statusBadge]),
      el("dt", { text: t("view.impostazioni.versione") }),
      el("dd", {}, [versionBadge]),
    ]);
    card.appendChild(meta);
    mount.appendChild(card);

    // Sottoscrizione allo stato DB finché la view è montata. Siccome il
    // router ripulisce il mount a ogni cambio rotta, usiamo un
    // MutationObserver sul parent per disiscrivere quando il badge esce
    // dal DOM.
    var unsubscribe = subscribeDbStatus(function onChange(next) {
      if (!statusBadge.isConnected) {
        unsubscribe();
        return;
      }
      statusBadge.textContent = next.text;
      statusBadge.setAttribute("data-state", next.state);
    });
  }

  // ----------------------------------------------------------------
  // Registrazione rotte
  // ----------------------------------------------------------------

  function registerRoutes() {
    Router.register(
      "#/oggi",
      (global.MaranelloViews && global.MaranelloViews.Oggi) ||
        makePlaceholderView("view.oggi.title", "view.oggi.placeholder")
    );
    Router.register(
      "#/settimana",
      (global.MaranelloViews && global.MaranelloViews.Settimana) ||
        makePlaceholderView("view.settimana.title", "view.settimana.placeholder")
    );

    // Diario corsa (Task 12): lista + form nuova + form modifica.
    // Il router corrente fa match esatto sul path; le tre rotte sono
    // registrate separatamente e delegano al dispatcher interno della
    // view, che a sua volta sceglie se mostrare la lista o il form.
    var DiarioCorsa = global.MaranelloViews && global.MaranelloViews.DiarioCorsa;
    if (DiarioCorsa && typeof DiarioCorsa.route === "function") {
      Router.register("#/diario/corsa", DiarioCorsa.route);
      Router.register("#/diario/corsa/nuova", DiarioCorsa.route);
      Router.register("#/diario/corsa/modifica", DiarioCorsa.route);
    } else {
      Router.register(
        "#/diario/corsa",
        makePlaceholderView(
          "view.diario_corsa.title",
          "view.diario_corsa.placeholder"
        )
      );
    }

    // Diario palestra (Task 13): stessa strategia.
    var DiarioPalestra =
      global.MaranelloViews && global.MaranelloViews.DiarioPalestra;
    if (DiarioPalestra && typeof DiarioPalestra.route === "function") {
      Router.register("#/diario/palestra", DiarioPalestra.route);
      Router.register("#/diario/palestra/nuova", DiarioPalestra.route);
      Router.register("#/diario/palestra/modifica", DiarioPalestra.route);
    } else {
      Router.register(
        "#/diario/palestra",
        makePlaceholderView(
          "view.diario_palestra.title",
          "view.diario_palestra.placeholder"
        )
      );
    }

    Router.register(
      "#/peso",
      (global.MaranelloViews && global.MaranelloViews.Peso) ||
        makePlaceholderView("view.peso.title", "view.peso.placeholder")
    );
    Router.register(
      "#/dashboard",
      (global.MaranelloViews && global.MaranelloViews.Dashboard) ||
        makePlaceholderView(
          "view.dashboard.title",
          "view.dashboard.placeholder"
        )
    );
    Router.register(
      "#/allerte",
      makePlaceholderView("view.allerte.title", "view.allerte.placeholder")
    );
    Router.register(
      "#/genera-piano",
      (global.MaranelloViews && global.MaranelloViews.GeneraPiano &&
        global.MaranelloViews.GeneraPiano.render) ||
        makePlaceholderView("view.genera_piano.titolo", "view.genera_piano.titolo")
    );
    Router.register(
      "#/anagrafica-palestra",
      (global.MaranelloViews && global.MaranelloViews.AnagraficaPalestra) ||
        makePlaceholderView("nav.schede", "nav.schede")
    );
    Router.register(
      "#/impostazioni",
      (global.MaranelloViews && global.MaranelloViews.Impostazioni) ||
        renderImpostazioniView
    );
  }

  // ----------------------------------------------------------------
  // Storage bootstrap
  // ----------------------------------------------------------------

  function initStorage() {
    if (!Storage || typeof Storage.init !== "function") {
      setDbStatus("error");
      return;
    }
    setDbStatus("pending");
    Storage.init()
      .then(function onReady() {
        setDbStatus("ready");
        // Seed programma_palestra al primo avvio se non esiste ancora.
        return seedProgrammaPalestra();
      })
      .catch(function onErr(err) {
        setDbStatus("error");
        if (global.console && global.console.error) {
          global.console.error("[app] apertura DB fallita:", err);
        }
      });
  }

  /**
   * Controlla se il record "main" in programma_palestra esiste già.
   * Se no, lo popola con i dati del seed.
   */
  function seedProgrammaPalestra() {
    var seed = global.MaranelloProgrammaPalestraSeed;
    if (!seed || !Storage || typeof Storage.get !== "function") return Promise.resolve();
    return Storage.get("programma_palestra", "main")
      .then(function onCheck(existing) {
        if (existing) return; // già presente, niente da fare
        return Storage.put("programma_palestra", seed, { origine: "sistema_piano", skipLog: true });
      })
      .catch(function onErr(err) {
        if (global.console && global.console.warn) {
          global.console.warn("[app] seed programma_palestra fallito:", err);
        }
      });
  }

  // ----------------------------------------------------------------
  // Start
  // ----------------------------------------------------------------

  function start() {
    var root = document.getElementById("app");
    if (!root) return;

    // Fallback di emergenza: se i moduli richiesti non sono caricati,
    // mostriamo un messaggio leggibile e interrompiamo il boot.
    if (!I18n || !Router) {
      root.innerHTML = "";
      root.appendChild(
        el("p", {
          class: "app-loading",
          text: "Errore: moduli di base non caricati.",
        })
      );
      return;
    }

    // Inizializza lo stato DB prima di costruire lo shell, così il badge
    // nasce già con l'etichetta italiana corretta.
    setDbStatus("pending");

    var shell = renderShell(root);
    registerRoutes();

    Router.start({
      mount: shell.main,
      defaultRoute: "#/settimana",
      navLinks: shell.navLinks,
    });

    initStorage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})(typeof window !== "undefined" ? window : globalThis, document);
