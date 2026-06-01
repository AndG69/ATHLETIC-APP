/*
 * Maranello 2027 — App_HTML
 * File: js/router.js
 *
 * Router client-side hash-based per l'App_HTML (Req 22.4).
 * Usiamo l'hash (`location.hash`) per avere un routing che funzioni sia su
 * `file://` sia su server statico locale, senza dipendere da History API
 * né da URL riscritti lato server.
 *
 * Responsabilità:
 *   - mantenere la registry delle rotte supportate;
 *   - ascoltare l'evento `hashchange` e invocare l'handler corretto;
 *   - normalizzare hash mancanti/invalidi verso una rotta di default;
 *   - fornire API per navigazione programmatica e per conoscere la rotta
 *     corrente.
 *
 * Le rotte supportate dalla spec (Req 22.4 — schermate principali):
 *   #/oggi  #/settimana  #/diario/corsa  #/diario/palestra
 *   #/peso  #/dashboard  #/allerte       #/impostazioni
 *
 * In questa fase ogni rotta ha una "placeholder view" che rende un titolo
 * + una breve descrizione. Le view reali arriveranno nei task successivi
 * (Gruppo B e successivi).
 *
 * API esposta: window.MaranelloRouter
 */

(function initRouter(global, document) {
  "use strict";

  var registry = Object.create(null);
  var state = {
    mount: null,
    defaultRoute: "#/oggi",
    navLinks: [],
    onChange: null,
    started: false,
  };

  // --------------------------------------------------------------------
  // Normalizzazione e parsing
  // --------------------------------------------------------------------

  /**
   * Ritorna un hash normalizzato che inizi con "#/" e senza slash finale
   * (eccetto per "#/"). Se l'input è vuoto o non normalizzabile, ritorna
   * stringa vuota (il chiamante usa la default).
   *
   * La query string ("?a=1&b=2") viene rimossa dal valore normalizzato:
   * la registry delle rotte è indicizzata per path puro. I parametri
   * sono comunque estraibili via `parseQuery` o dal dispatch.
   */
  function normalizeHash(raw) {
    if (typeof raw !== "string" || raw.length === 0) return "";
    var h = raw;
    if (h.charAt(0) !== "#") h = "#" + h;
    if (h.charAt(1) !== "/") h = "#/" + h.slice(1);
    // Separa la query (se presente) prima di normalizzare lo slash.
    var qIdx = h.indexOf("?");
    if (qIdx >= 0) {
      h = h.slice(0, qIdx);
    }
    // Rimuove eventuale trailing slash, ma non "#/".
    if (h.length > 2 && h.charAt(h.length - 1) === "/") {
      h = h.slice(0, -1);
    }
    return h;
  }

  /**
   * Estrae la query string come oggetto { chiave: stringa }. Ritorna un
   * oggetto vuoto se l'hash non ha `?`.
   */
  function parseQuery(raw) {
    if (typeof raw !== "string") return {};
    var qIdx = raw.indexOf("?");
    if (qIdx < 0) return {};
    var qs = raw.slice(qIdx + 1);
    if (qs.length === 0) return {};
    var out = Object.create(null);
    qs.split("&").forEach(function parsePair(pair) {
      if (!pair) return;
      var eqIdx = pair.indexOf("=");
      var key;
      var value;
      if (eqIdx < 0) {
        key = pair;
        value = "";
      } else {
        key = pair.slice(0, eqIdx);
        value = pair.slice(eqIdx + 1);
      }
      try {
        key = decodeURIComponent(key);
        value = decodeURIComponent(value);
      } catch (e) {
        /* lascia raw */
      }
      if (key) out[key] = value;
    });
    return out;
  }

  function splitPath(hash) {
    // "#/diario/corsa" -> ["diario", "corsa"]
    if (!hash || hash === "#/") return [];
    return hash.slice(2).split("/").filter(Boolean);
  }

  // --------------------------------------------------------------------
  // Match e dispatch
  // --------------------------------------------------------------------

  function findHandler(hash) {
    return registry[hash] || null;
  }

  function dispatch() {
    if (!state.mount) return;
    var rawHash = global.location ? global.location.hash : "";
    var hash = normalizeHash(rawHash);
    if (!hash || !findHandler(hash)) {
      // Rotta vuota o sconosciuta → redirect alla default senza ciclare:
      // impostiamo l'hash solo se differisce da quello corrente.
      if (rawHash !== state.defaultRoute) {
        // Sostituiamo (non push) per evitare di riempire la cronologia
        // con il percorso errato.
        if (global.history && typeof global.history.replaceState === "function") {
          try {
            global.history.replaceState(null, "", state.defaultRoute);
          } catch (e) {
            global.location.hash = state.defaultRoute;
          }
        } else {
          global.location.hash = state.defaultRoute;
        }
      }
      hash = state.defaultRoute;
    }
    var handler = findHandler(hash);
    if (!handler) return; // difensivo: non dovrebbe accadere

    var params = {
      hash: hash,
      path: splitPath(hash),
      query: parseQuery(rawHash),
      rawHash: rawHash,
    };

    // Svuota il mount prima di re-renderizzare la view.
    state.mount.innerHTML = "";
    try {
      handler(params, state.mount);
    } catch (err) {
      if (global.console && global.console.error) {
        global.console.error("[router] errore nella view " + hash, err);
      }
      var errBox = document.createElement("div");
      errBox.className = "view-error";
      errBox.setAttribute("role", "alert");
      errBox.textContent =
        "Errore nel caricamento della vista. Riprova a navigare.";
      state.mount.appendChild(errBox);
    }

    updateActiveNav(hash);
    if (typeof state.onChange === "function") {
      try {
        state.onChange(params);
      } catch (e) {
        if (global.console && global.console.warn) {
          global.console.warn("[router] onChange ha sollevato", e);
        }
      }
    }
  }

  /**
   * Aggiorna lo stato visuale della bottom-nav: aggiunge aria-current="page"
   * al link che corrisponde alla rotta corrente e lo rimuove dagli altri.
   * La selezione è effettuata via attributo `data-route` sul link.
   */
  function updateActiveNav(currentHash) {
    var links = state.navLinks || [];
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var route = link.getAttribute("data-route");
      if (route === currentHash) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  }

  // --------------------------------------------------------------------
  // API pubblica
  // --------------------------------------------------------------------

  /**
   * Registra un handler per una rotta hash-based.
   * @param {string}   pattern  es. "#/oggi" — normalizzato internamente
   * @param {function} handler  function(params, mount)
   */
  function register(pattern, handler) {
    if (typeof handler !== "function") {
      throw new Error("[router] handler deve essere una funzione");
    }
    var hash = normalizeHash(pattern);
    if (!hash) {
      throw new Error("[router] pattern non valido: " + pattern);
    }
    registry[hash] = handler;
  }

  /**
   * Naviga programmaticamente verso una rotta. Se la rotta è già quella
   * corrente, forza comunque un re-render (utile per refresh view).
   *
   * Accetta opzionalmente una query: `navigate("#/diario/corsa/modifica", { id: "abc" })`.
   * Se `target` contiene già una query string, la si preserva.
   */
  function navigate(target, query) {
    var baseHash = normalizeHash(target);
    if (!baseHash) baseHash = state.defaultRoute;
    var qs = "";
    if (query && typeof query === "object") {
      var pairs = [];
      Object.keys(query).forEach(function appendPair(k) {
        var v = query[k];
        if (v === undefined || v === null) return;
        pairs.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
      });
      if (pairs.length > 0) qs = "?" + pairs.join("&");
    } else if (typeof target === "string") {
      var qIdx = target.indexOf("?");
      if (qIdx >= 0) qs = target.slice(qIdx);
    }
    var full = baseHash + qs;
    if (global.location && global.location.hash === full) {
      dispatch();
      return;
    }
    if (global.location) {
      global.location.hash = full;
    }
  }

  function currentRoute() {
    var rawHash = global.location ? global.location.hash : "";
    var hash = normalizeHash(rawHash) || state.defaultRoute;
    return {
      hash: hash,
      path: splitPath(hash),
      query: parseQuery(rawHash),
      rawHash: rawHash,
      params: {},
    };
  }

  /**
   * Avvia il router.
   * @param {object} options
   * @param {HTMLElement} options.mount        contenitore dove rendere le view
   * @param {string}      options.defaultRoute rotta default (es. "#/oggi")
   * @param {Array<HTMLElement>} [options.navLinks] link della bottom-nav
   *                                                da aggiornare con
   *                                                aria-current
   * @param {function}    [options.onChange]   callback invocato a ogni
   *                                           cambio rotta, con
   *                                           {hash, path}
   */
  function start(options) {
    options = options || {};
    if (!options.mount) {
      throw new Error("[router] start: manca options.mount");
    }
    state.mount = options.mount;
    state.defaultRoute = normalizeHash(options.defaultRoute) || "#/oggi";
    state.navLinks = Array.isArray(options.navLinks)
      ? options.navLinks.slice()
      : [];
    state.onChange = typeof options.onChange === "function"
      ? options.onChange
      : null;

    if (!state.started) {
      global.addEventListener("hashchange", dispatch);
      state.started = true;
    }
    dispatch();
  }

  /** Ferma il router (utile nei test). Lascia la registry intatta. */
  function stop() {
    if (state.started) {
      global.removeEventListener("hashchange", dispatch);
      state.started = false;
    }
  }

  global.MaranelloRouter = {
    start: start,
    stop: stop,
    register: register,
    navigate: navigate,
    currentRoute: currentRoute,
    // Esposti per i test / debug.
    _normalizeHash: normalizeHash,
    _splitPath: splitPath,
    _parseQuery: parseQuery,
  };
})(typeof window !== "undefined" ? window : globalThis, document);
