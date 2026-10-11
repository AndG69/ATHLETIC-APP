/*
 * Maranello 2027 — App_HTML
 * File: js/modules/views/anagrafica-esercizi.js
 *
 * Vista Anagrafica Esercizi — rotta #/anagrafica-esercizi
 *
 * Elenca TUTTI gli esercizi dell'anagrafica, suddivisi per gruppo muscolare.
 * Ogni gruppo è una sezione che contiene i suoi esercizi; da qui si gestiscono
 * sia gli esercizi (aggiungi / rinomina / sposta di gruppo / tempo / elimina)
 * sia i gruppi stessi (aggiungi / rinomina / elimina).
 *
 * Cancellazioni (fonte: §HANDOFF, decisioni utente):
 *   - Elimina esercizio → rimosso dall'anagrafica E dalle sedute template.
 *   - Elimina gruppo → rimosso il gruppo, cancellati i suoi esercizi
 *     dall'anagrafica E dalle sedute template.
 *   Mai toccato lo storico (sessioni_palestra) né le sessioni già programmate
 *   (si allineano solo a una nuova generazione del piano).
 *
 * Fonte di verità e cascate: window.MaranelloAnagraficaEsercizi.
 *
 * Espone: window.MaranelloViews.AnagraficaEsercizi
 */

(function initAnagraficaEserciziView(global, document) {
  "use strict";

  var STORE = "programma_palestra";

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
          key === "disabled" || key === "placeholder" || key === "label"
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

  function t(key) {
    var I18n = global.I18n;
    return I18n && typeof I18n.t === "function" ? I18n.t(key) : key;
  }

  // ---------------------------------------------------------------------------
  // Render principale
  // ---------------------------------------------------------------------------

  function render(params, mount) {
    var Storage = global.MaranelloStorage;
    var A = global.MaranelloAnagraficaEsercizi;

    var container = el("div", { class: "anag-eserc-view" });
    mount.appendChild(container);

    container.appendChild(el("h2", { text: "\uD83D\uDCD2 Anagrafica esercizi" }));
    container.appendChild(el("p", {
      class: "anag-eserc-hint",
      text: "Tutti gli esercizi, divisi per gruppo muscolare. Da qui li aggiungi, rinomini, sposti di gruppo o elimini. Gli stessi esercizi si usano quando componi le schede.",
    }));

    var feedback = el("p", { class: "anag-eserc-feedback", "aria-live": "polite" });
    container.appendChild(feedback);

    var listaContainer = el("div", { class: "anag-eserc-gruppi" });
    container.appendChild(listaContainer);

    var addGruppoRow = el("div", { class: "anag-eserc-add-gruppo-row" });
    container.appendChild(addGruppoRow);

    var programma = null;

    if (!Storage || typeof Storage.get !== "function" || !A) {
      feedback.textContent = "Anagrafica non disponibile.";
      return;
    }

    function persist(msg) {
      return Storage.put(STORE, programma, { origine: "utente" })
        .then(function () { if (msg) feedback.textContent = msg; })
        .catch(function (err) {
          feedback.textContent = "Errore nel salvataggio.";
          if (global.console) global.console.error(err);
        });
    }

    function renderGruppo(gruppo) {
      var isAltro = String(gruppo).toLowerCase() === "altro";
      var box = el("section", { class: "anag-eserc-gruppo-box" });

      // Header gruppo: nome (rinominabile) + elimina.
      var header = el("div", { class: "anag-eserc-gruppo-header" });
      if (isAltro) {
        header.appendChild(el("h3", { class: "anag-eserc-gruppo-nome", text: gruppo }));
      } else {
        var inputNome = el("input", {
          type: "text", class: "anag-eserc-gruppo-input",
          value: gruppo, "aria-label": "Nome gruppo " + gruppo,
        });
        inputNome.addEventListener("change", function () {
          var nuovo = inputNome.value;
          if (String(nuovo).trim() === gruppo) return;
          var res = A.rinominaGruppo(programma, gruppo, nuovo);
          if (!res.ok) {
            feedback.textContent = res.motivo === "duplicato"
              ? "Esiste gi\u00E0 un gruppo con quel nome."
              : "Nome gruppo non valido.";
            renderLista();
            return;
          }
          persist("Gruppo rinominato in \u201C" + String(nuovo).trim() + "\u201D.").then(renderLista);
        });
        header.appendChild(inputNome);

        var btnDelG = el("button", {
          type: "button", class: "anag-eserc-gruppo-del",
          text: "\uD83D\uDDD1 Elimina gruppo", "aria-label": "Elimina gruppo " + gruppo,
        });
        btnDelG.addEventListener("click", function () {
          var count = (A.eserciziPerGruppo(programma).get(gruppo) || []).length;
          var msg = count > 0
            ? "Eliminare il gruppo \u201C" + gruppo + "\u201D e i suoi " + count +
              " esercizi? Verranno rimossi anche dalle schede. Lo storico non \u00E8 toccato."
            : "Eliminare il gruppo \u201C" + gruppo + "\u201D?";
          if (!global.confirm(msg)) return;
          var res = A.eliminaGruppo(programma, gruppo);
          if (!res.ok) {
            feedback.textContent = "Impossibile eliminare il gruppo.";
            return;
          }
          persist("Gruppo \u201C" + gruppo + "\u201D eliminato (" + res.eliminati + " esercizi).").then(renderLista);
        });
        header.appendChild(btnDelG);
      }
      box.appendChild(header);

      // Lista esercizi del gruppo.
      var esercizi = A.eserciziPerGruppo(programma).get(gruppo) || [];
      var listaEs = el("div", { class: "anag-eserc-lista" });
      if (esercizi.length === 0) {
        listaEs.appendChild(el("p", { class: "anag-eserc-vuoto", text: "Nessun esercizio in questo gruppo." }));
      }
      esercizi.forEach(function (e) {
        listaEs.appendChild(renderEsercizioRow(e, gruppo));
      });
      box.appendChild(listaEs);

      // Aggiungi esercizio al gruppo.
      var btnAddE = el("button", {
        type: "button", class: "anag-eserc-add-es",
        text: "\uFF0B Aggiungi esercizio",
      });
      btnAddE.addEventListener("click", function () {
        var nome = (global.prompt("Nome del nuovo esercizio (gruppo: " + gruppo + "):") || "").trim();
        if (!nome) return;
        var res = A.aggiungiEsercizio(programma, nome, gruppo, false);
        if (!res.ok) {
          feedback.textContent = res.motivo === "duplicato"
            ? "L'esercizio \u201C" + nome + "\u201D esiste gi\u00E0."
            : "Nome esercizio non valido.";
          return;
        }
        persist("Esercizio \u201C" + nome + "\u201D aggiunto.").then(renderLista);
      });
      box.appendChild(btnAddE);

      return box;
    }

    function renderEsercizioRow(esercizio, gruppoCorrente) {
      var row = el("div", { class: "anag-eserc-row" });

      // Nome (rinomina).
      var inputNome = el("input", {
        type: "text", class: "anag-eserc-nome-input",
        value: esercizio.nome, "aria-label": "Nome esercizio",
      });
      inputNome.addEventListener("change", function () {
        var nuovo = inputNome.value;
        if (String(nuovo).trim() === esercizio.nome) return;
        var res = A.rinominaEsercizio(programma, esercizio.nome, nuovo);
        if (!res.ok) {
          feedback.textContent = res.motivo === "duplicato"
            ? "Esiste gi\u00E0 un esercizio con quel nome."
            : "Nome esercizio non valido.";
          renderLista();
          return;
        }
        persist("Esercizio rinominato in \u201C" + String(nuovo).trim() + "\u201D.").then(renderLista);
      });

      // Gruppo (sposta).
      var selGruppo = el("select", { class: "anag-eserc-gruppo-sel", "aria-label": "Gruppo muscolare" });
      A.listaGruppi(programma).forEach(function (g) {
        var opt = el("option", { value: g, text: g });
        if (g === gruppoCorrente) opt.setAttribute("selected", "selected");
        selGruppo.appendChild(opt);
      });
      selGruppo.addEventListener("change", function () {
        var res = A.spostaEsercizio(programma, esercizio.nome, selGruppo.value);
        if (!res.ok) { feedback.textContent = "Impossibile spostare l'esercizio."; return; }
        persist("Esercizio spostato in \u201C" + selGruppo.value + "\u201D.").then(renderLista);
      });

      // Tempo (isometrico).
      var chkTempo = el("input", { type: "checkbox", class: "anag-eserc-tempo-chk", "aria-label": "Esercizio a tempo" });
      if (esercizio.tempo) chkTempo.checked = true;
      chkTempo.addEventListener("change", function () {
        A.impostaTempo(programma, esercizio.nome, chkTempo.checked);
        persist();
      });
      var tempoLabel = el("label", { class: "anag-eserc-tempo-label" }, [chkTempo, el("span", { text: "a tempo" })]);

      // Elimina esercizio.
      var btnDel = el("button", {
        type: "button", class: "anag-eserc-del",
        text: "\u2715", "aria-label": "Elimina esercizio " + esercizio.nome,
      });
      btnDel.addEventListener("click", function () {
        var usi = A.usiNelleSedute(programma, esercizio.nome);
        var msg = usi > 0
          ? "Eliminare \u201C" + esercizio.nome + "\u201D? \u00C8 usato in " + usi +
            " righe di schede, che verranno rimosse. Lo storico non \u00E8 toccato."
          : "Eliminare \u201C" + esercizio.nome + "\u201D?";
        if (!global.confirm(msg)) return;
        A.eliminaEsercizio(programma, esercizio.nome);
        persist("Esercizio \u201C" + esercizio.nome + "\u201D eliminato.").then(renderLista);
      });

      row.appendChild(inputNome);
      row.appendChild(el("div", { class: "anag-eserc-row-meta" }, [selGruppo, tempoLabel, btnDel]));
      return row;
    }

    function renderLista() {
      listaContainer.innerHTML = "";
      A.listaGruppi(programma).forEach(function (g) {
        listaContainer.appendChild(renderGruppo(g));
      });

      // Riga "aggiungi gruppo".
      addGruppoRow.innerHTML = "";
      var inputNuovo = el("input", {
        type: "text", class: "anag-eserc-nuovo-gruppo",
        placeholder: "Nuovo gruppo muscolare", "aria-label": "Nome nuovo gruppo",
      });
      var btnAddG = el("button", {
        type: "button", class: "anag-eserc-add-gruppo", text: "\uFF0B Aggiungi gruppo",
      });
      function addGruppo() {
        var nome = inputNuovo.value;
        var res = A.aggiungiGruppo(programma, nome);
        if (!res.ok) {
          feedback.textContent = res.motivo === "duplicato"
            ? "Il gruppo esiste gi\u00E0."
            : (res.motivo === "riservato" ? "\u201CAltro\u201D \u00E8 riservato." : "Nome gruppo non valido.");
          return;
        }
        inputNuovo.value = "";
        persist("Gruppo \u201C" + String(nome).trim() + "\u201D aggiunto.").then(renderLista);
      }
      btnAddG.addEventListener("click", addGruppo);
      inputNuovo.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") { ev.preventDefault(); addGruppo(); }
      });
      addGruppoRow.appendChild(inputNuovo);
      addGruppoRow.appendChild(btnAddG);
    }

    Storage.get(STORE, "main")
      .then(function (prog) {
        if (!prog) {
          prog = global.MaranelloProgrammaPalestraSeed || { id: "main", sedute: [] };
        }
        programma = prog;
        var changed = A.ensure(programma);
        var p = changed ? persist() : Promise.resolve();
        p.then(renderLista);
      })
      .catch(function (err) {
        feedback.textContent = "Errore nel caricamento dell'anagrafica.";
        if (global.console) global.console.error(err);
      });
  }

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  if (!global.MaranelloViews) {
    global.MaranelloViews = {};
  }
  global.MaranelloViews.AnagraficaEsercizi = render;
})(typeof window !== "undefined" ? window : globalThis, document);
