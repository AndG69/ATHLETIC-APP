/*
 * Maranello 2027 — App_HTML
 * File: js/modules/components/info-popover.js
 *
 * Piccolo componente riutilizzabile per mostrare informazioni contestuali
 * (legenda, tip, help) vicino a un'etichetta di campo. Su mobile non
 * esistono veri "hover", quindi l'interazione primaria è:
 *
 *   - tap/click sul pulsante info → apre/chiude il popover
 *   - focus sul pulsante info (tastiera) → apre; blur → chiude (con delay)
 *   - hover con mouse su desktop → apre; uscita → chiude (con delay)
 *   - Escape → chiude
 *   - tap fuori → chiude
 *
 * Esposto come `window.MaranelloComponents.infoPopover({...})` → ritorna un
 * oggetto `{ node, toggle, open, close }`.
 *
 * Accessibilità (Req 24.3):
 *   - il bottone trigger ha `aria-expanded` e `aria-controls`
 *   - il popover ha `role="dialog"` con `aria-labelledby` se `title` è dato
 *   - focus ring sempre visibile
 *   - il contenuto può essere stringa o array di HTMLElement
 *
 * Nessuna dipendenza esterna. CSS: `.info-popover-*` in app.css.
 */

(function initInfoPopover(global, document) {
  "use strict";

  var idCounter = 0;

  function createButton(label) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "info-popover-trigger";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", label || "Mostra informazioni");
    btn.textContent = "\u2139"; // ℹ
    return btn;
  }

  /**
   * Costruisce un popover agganciato a un trigger.
   * @param {object} opts
   * @param {string} opts.title     — titolo del popover (anche screen-reader)
   * @param {string} [opts.ariaLabel] — aria-label del trigger
   * @param {HTMLElement|string|Array<HTMLElement|string>} opts.content — contenuto
   * @returns {{ node: HTMLElement, toggle: fn, open: fn, close: fn }}
   */
  function infoPopover(opts) {
    opts = opts || {};

    idCounter += 1;
    var idBody = "info-popover-body-" + idCounter;
    var idTitle = "info-popover-title-" + idCounter;

    var wrap = document.createElement("span");
    wrap.className = "info-popover";

    var trigger = createButton(opts.ariaLabel || opts.title);
    trigger.setAttribute("aria-controls", idBody);
    wrap.appendChild(trigger);

    var body = document.createElement("div");
    body.className = "info-popover-body";
    body.id = idBody;
    body.setAttribute("role", "dialog");
    body.setAttribute("aria-modal", "false");
    body.hidden = true;

    if (opts.title) {
      var titleEl = document.createElement("strong");
      titleEl.className = "info-popover-title";
      titleEl.id = idTitle;
      titleEl.textContent = opts.title;
      body.appendChild(titleEl);
      body.setAttribute("aria-labelledby", idTitle);
    }

    var content = opts.content;
    if (content != null) {
      if (Array.isArray(content)) {
        for (var i = 0; i < content.length; i++) {
          appendContent(body, content[i]);
        }
      } else {
        appendContent(body, content);
      }
    }

    wrap.appendChild(body);

    var state = { open: false, closeTimer: null, suppressFocusOpen: false };

    function open() {
      if (state.open) return;
      state.open = true;
      body.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      wrap.classList.add("is-open");
      clearCloseTimer();
    }
    function close() {
      if (!state.open) return;
      state.open = false;
      body.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      wrap.classList.remove("is-open");
      clearCloseTimer();
    }
    function toggle() {
      if (state.open) close(); else open();
    }
    function clearCloseTimer() {
      if (state.closeTimer != null) {
        global.clearTimeout(state.closeTimer);
        state.closeTimer = null;
      }
    }
    function scheduleClose() {
      clearCloseTimer();
      state.closeTimer = global.setTimeout(function onDelayed() {
        close();
      }, 150);
    }

    // Eventi -----------------------------------------------------------
    trigger.addEventListener("click", function onClick(ev) {
      ev.preventDefault();
      toggle();
    });

    // Hover (desktop): apri su mouseenter, chiudi su mouseleave con delay
    wrap.addEventListener("mouseenter", function onEnter() {
      // Non aprire se sei su un device che non ha hover reale (mobile
      // emette mouseenter dopo un click). Usiamo matchMedia hover.
      if (global.matchMedia && global.matchMedia("(hover: hover)").matches) {
        open();
      }
    });
    wrap.addEventListener("mouseleave", function onLeave() {
      if (global.matchMedia && global.matchMedia("(hover: hover)").matches) {
        scheduleClose();
      }
    });

    // Keyboard: focus del trigger o del body apre; blur chiude con delay.
    // Se stiamo riportando il focus dopo Escape, non vogliamo riaprire subito.
    trigger.addEventListener("focus", function onFocus() {
      if (state.suppressFocusOpen) return;
      open();
    });
    wrap.addEventListener("focusout", function onBlur(ev) {
      // Chiudi solo se il focus esce dal wrapper.
      var next = ev.relatedTarget;
      if (!next || !wrap.contains(next)) {
        scheduleClose();
      }
    });

    // Tap fuori → chiudi (listener condiviso, lazy).
    function onDocClick(ev) {
      if (!state.open) return;
      if (wrap.contains(ev.target)) return;
      close();
    }
    document.addEventListener("click", onDocClick);

    // Escape → chiudi e riporta il focus sul trigger senza riaprire.
    wrap.addEventListener("keydown", function onKey(ev) {
      if (ev.key === "Escape" && state.open) {
        ev.preventDefault();
        close();
        state.suppressFocusOpen = true;
        try {
          trigger.focus();
        } finally {
          state.suppressFocusOpen = false;
        }
      }
    });

    return {
      node: wrap,
      trigger: trigger,
      body: body,
      open: open,
      close: close,
      toggle: toggle,
    };
  }

  function appendContent(parent, child) {
    if (child == null) return;
    if (typeof child === "string") {
      // Supporta stringhe multi-paragrafo separate da \n\n.
      var parts = child.split(/\n\n+/);
      for (var i = 0; i < parts.length; i++) {
        var p = document.createElement("p");
        p.textContent = parts[i];
        parent.appendChild(p);
      }
      return;
    }
    if (child.nodeType) {
      parent.appendChild(child);
      return;
    }
  }

  // ---------------------------------------------------------------------------
  // Legenda RPE predefinita (Borg CR10) come helper dedicato
  // ---------------------------------------------------------------------------

  /**
   * Costruisce il contenuto della legenda RPE come blocco DOM con tabella.
   * Usa testi italiani statici (senza dipendenza da I18n per flessibilità).
   */
  function buildRpeLegendContent() {
    var intro = document.createElement("p");
    intro.className = "info-popover-intro";
    intro.textContent =
      "RPE (Rating of Perceived Exertion) \u2014 quanto hai faticato, " +
      "secondo te. Scala Borg CR10, numero intero da 1 a 10.";

    var table = document.createElement("table");
    table.className = "info-popover-table info-popover-rpe-table";
    var thead = document.createElement("thead");
    var thr = document.createElement("tr");
    ["RPE", "Come ti senti", "Prova della voce"].forEach(function addTh(text) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = text;
      thr.appendChild(th);
    });
    thead.appendChild(thr);
    table.appendChild(thead);

    var rows = [
      ["1\u20132", "Riposo / camminata lenta", "Puoi parlare all\u2019infinito"],
      ["3", "Molto leggero", "Canti tranquillamente"],
      ["4", "Leggero", "Conversazione lunga senza problemi"],
      ["5", "Moderato", "Parli a frasi complete"],
      ["6", "Moderato-intenso", "Parli a frasi brevi"],
      ["7", "Intenso", "Poche parole alla volta"],
      ["8", "Molto intenso", "Parole singole"],
      ["9", "Quasi massimo", "Non parli"],
      ["10", "Massimo", "Insostenibile oltre pochi secondi"],
    ];
    var tbody = document.createElement("tbody");
    rows.forEach(function addRow(cells) {
      var tr = document.createElement("tr");
      cells.forEach(function addCell(text, idx) {
        var cell = document.createElement(idx === 0 ? "th" : "td");
        if (idx === 0) cell.scope = "row";
        cell.textContent = text;
        tr.appendChild(cell);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    var tips = document.createElement("p");
    tips.className = "info-popover-tip";
    tips.textContent =
      "Suggerimenti per te: walk-run e corsa facile RPE 5\u20136, " +
      "palestra standard 5\u20136, corsa di qualit\u00E0 6\u20137. " +
      "Registralo entro 5\u201310 minuti dalla fine della sessione.";

    var frag = document.createDocumentFragment();
    frag.appendChild(intro);
    frag.appendChild(table);
    frag.appendChild(tips);
    return frag;
  }

  /**
   * Scorciatoia: popover preconfigurato per RPE (titolo + legenda Borg CR10).
   */
  function rpeLegendPopover() {
    return infoPopover({
      title: "Come compilare l\u2019RPE",
      ariaLabel: "Come compilare l\u2019RPE",
      content: buildRpeLegendContent(),
    });
  }

  // ---------------------------------------------------------------------------
  // Esposizione
  // ---------------------------------------------------------------------------

  if (!global.MaranelloComponents) {
    global.MaranelloComponents = {};
  }
  global.MaranelloComponents.infoPopover = infoPopover;
  global.MaranelloComponents.rpeLegendPopover = rpeLegendPopover;
  global.MaranelloComponents.buildRpeLegendContent = buildRpeLegendContent;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      infoPopover: infoPopover,
      rpeLegendPopover: rpeLegendPopover,
      buildRpeLegendContent: buildRpeLegendContent,
    };
  }
})(typeof window !== "undefined" ? window : globalThis, document);
