/*
 * Maranello 2027 — App_HTML
 * File: js/modules/views/anagrafica-palestra.js
 *
 * Vista Anagrafica Palestra — rotta #/anagrafica-palestra
 *
 * Mostra le 8 sedute con i loro esercizi. Permette di modificare ogni
 * seduta (nome, esercizi, serie, ripetizioni, carico) e di ripristinare
 * il programma di default.
 *
 * Espone: window.MaranelloViews.AnagraficaPalestra
 */

(function initAnagraficaPalestraView(global, document) {
  "use strict";

  var STORE = "programma_palestra";

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
          key === "disabled" || key === "multiple" || key === "min" ||
          key === "max" || key === "step" || key === "placeholder"
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
  // Rendering lista sedute (sola lettura)
  // ---------------------------------------------------------------------------

  function renderSedutaCard(seduta, onModifica) {
    var card = el("div", { class: "anagrafica-seduta-card" });

    var header = el("div", { class: "anagrafica-seduta-header" }, [
      el("h3", { class: "anagrafica-seduta-nome", text: seduta.nome }),
      el("button", {
        type: "button",
        class: "anagrafica-btn-modifica",
        text: "✏️ Modifica",
        "aria-label": "Modifica " + seduta.nome,
      }),
    ]);
    header.querySelector("button").addEventListener("click", function () {
      onModifica(seduta);
    });
    card.appendChild(header);

    var table = el("table", { class: "anagrafica-esercizi-table" });
    var thead = el("thead", {}, [
      el("tr", {}, [
        el("th", { text: "Esercizio" }),
        el("th", { text: "Serie" }),
        el("th", { text: "Rip." }),
        el("th", { text: "Carico / Tempo" }),
      ]),
    ]);
    table.appendChild(thead);

    var tbody = el("tbody");
    (seduta.esercizi || []).forEach(function (es) {
      var caricoTesto = es.tempoSecondi
        ? es.tempoSecondi + " sec"
        : (es.carico || 0) + " kg";
      tbody.appendChild(el("tr", {}, [
        el("td", { text: es.nome }),
        el("td", { text: String(es.serie || 4) }),
        el("td", { text: String(es.ripetizioni || 0) }),
        el("td", { text: caricoTesto }),
      ]));
    });
    table.appendChild(tbody);
    card.appendChild(table);

    return card;
  }

  // ---------------------------------------------------------------------------
  // Form di modifica seduta (inline)
  // ---------------------------------------------------------------------------

  function renderFormModifica(seduta, onSalva, onAnnulla) {
    var form = el("form", { class: "anagrafica-form-modifica", novalidate: "novalidate" });

    // Nome seduta
    var inputNome = el("input", {
      type: "text",
      class: "anagrafica-input-nome",
      value: seduta.nome,
      "aria-label": "Nome seduta",
      placeholder: "Nome seduta",
    });
    form.appendChild(el("div", { class: "anagrafica-field" }, [
      el("label", { text: "Nome seduta" }),
      inputNome,
    ]));

    // Lista esercizi
    var eserciziContainer = el("div", { class: "anagrafica-esercizi-container" });
    form.appendChild(el("h4", { text: "Esercizi" }));
    form.appendChild(eserciziContainer);

    // Stato locale degli esercizi (copia profonda)
    var eserciziLocali = (seduta.esercizi || []).map(function (es) {
      return Object.assign({}, es);
    });

    function renderEserciziRows() {
      eserciziContainer.innerHTML = "";
      eserciziLocali.forEach(function (es, idx) {
        var row = el("div", { class: "anagrafica-esercizio-row" });

        // Nome esercizio (select dal catalogo + opzione libera)
        var catalog = global.MaranelloEserciziCatalog;
        var selectNome = el("select", {
          class: "anagrafica-select-esercizio",
          "aria-label": "Esercizio " + (idx + 1),
        });
        var opzioneLibera = el("option", { value: "__altro__", text: "Altro…" });
        selectNome.appendChild(opzioneLibera);
        if (catalog && Array.isArray(catalog.esercizi)) {
          catalog.esercizi.forEach(function (catalogEs) {
            var opt = el("option", { value: catalogEs.nome, text: catalogEs.nome });
            if (catalogEs.nome === es.nome) opt.setAttribute("selected", "selected");
            selectNome.appendChild(opt);
          });
        }
        // Se il nome non è nel catalogo, seleziona "Altro"
        var nomiCatalog = catalog ? catalog.esercizi.map(function (e) { return e.nome; }) : [];
        if (nomiCatalog.indexOf(es.nome) === -1) {
          opzioneLibera.setAttribute("selected", "selected");
        }

        var inputNomeLibero = el("input", {
          type: "text",
          class: "anagrafica-input-nome-libero",
          value: nomiCatalog.indexOf(es.nome) === -1 ? es.nome : "",
          placeholder: "Nome esercizio",
          style: nomiCatalog.indexOf(es.nome) === -1 ? "" : "display:none",
        });

        selectNome.addEventListener("change", function () {
          if (selectNome.value === "__altro__") {
            inputNomeLibero.style.display = "";
            eserciziLocali[idx].nome = inputNomeLibero.value;
          } else {
            inputNomeLibero.style.display = "none";
            eserciziLocali[idx].nome = selectNome.value;
            // Aggiorna gruppo dal catalogo
            if (catalog) {
              var found = catalog.esercizi.filter(function (e) { return e.nome === selectNome.value; })[0];
              if (found) eserciziLocali[idx].gruppo = found.gruppo;
            }
          }
        });
        inputNomeLibero.addEventListener("input", function () {
          eserciziLocali[idx].nome = inputNomeLibero.value;
        });

        // Serie
        var inputSerie = el("input", {
          type: "number", min: "1", max: "20",
          class: "anagrafica-input-serie",
          value: String(es.serie || 4),
          "aria-label": "Serie",
        });
        inputSerie.addEventListener("input", function () {
          eserciziLocali[idx].serie = parseInt(inputSerie.value, 10) || 4;
        });

        // Ripetizioni
        var inputRip = el("input", {
          type: "number", min: "1", max: "100",
          class: "anagrafica-input-rip",
          value: String(es.ripetizioni || 0),
          "aria-label": "Ripetizioni",
        });
        inputRip.addEventListener("input", function () {
          eserciziLocali[idx].ripetizioni = parseInt(inputRip.value, 10) || 0;
        });

        // Carico / Tempo
        var isPlank = !!es.tempoSecondi;
        var inputCarico = el("input", {
          type: "number", min: "0", step: "0.1",
          class: "anagrafica-input-carico",
          value: isPlank ? String(es.tempoSecondi) : String(es.carico || 0),
          "aria-label": isPlank ? "Tempo (sec)" : "Carico (kg)",
          placeholder: isPlank ? "sec" : "kg",
        });
        var labelCarico = el("span", {
          class: "anagrafica-label-carico",
          text: isPlank ? "sec" : "kg",
        });
        inputCarico.addEventListener("input", function () {
          var val = parseFloat(inputCarico.value) || 0;
          if (eserciziLocali[idx].tempoSecondi !== null && eserciziLocali[idx].tempoSecondi !== undefined) {
            eserciziLocali[idx].tempoSecondi = val;
          } else {
            eserciziLocali[idx].carico = val;
          }
        });

        // Pulsante rimuovi
        var btnRimuovi = el("button", {
          type: "button",
          class: "anagrafica-btn-rimuovi",
          text: "✕",
          "aria-label": "Rimuovi esercizio",
        });
        (function captureIdx(i) {
          btnRimuovi.addEventListener("click", function () {
            eserciziLocali.splice(i, 1);
            renderEserciziRows();
          });
        })(idx);

        row.appendChild(selectNome);
        row.appendChild(inputNomeLibero);
        row.appendChild(el("span", { text: " S:" }));
        row.appendChild(inputSerie);
        row.appendChild(el("span", { text: " R:" }));
        row.appendChild(inputRip);
        row.appendChild(el("span", { text: " " }));
        row.appendChild(inputCarico);
        row.appendChild(labelCarico);
        row.appendChild(btnRimuovi);
        eserciziContainer.appendChild(row);
      });
    }

    renderEserciziRows();

    // Pulsante aggiungi esercizio
    var btnAggiungi = el("button", {
      type: "button",
      class: "anagrafica-btn-aggiungi",
      text: "+ Aggiungi esercizio",
    });
    btnAggiungi.addEventListener("click", function () {
      eserciziLocali.push({
        nome: "",
        gruppo: "Altro",
        serie: 4,
        ripetizioni: 12,
        carico: 0,
        tempoSecondi: null,
      });
      renderEserciziRows();
    });
    form.appendChild(btnAggiungi);

    // Feedback
    var feedbackEl = el("p", { class: "anagrafica-feedback", "aria-live": "polite" });
    form.appendChild(feedbackEl);

    // Pulsanti salva / annulla
    var btnSalva = el("button", {
      type: "submit",
      class: "anagrafica-btn-salva",
      text: "💾 Salva",
    });
    var btnAnnullaForm = el("button", {
      type: "button",
      class: "anagrafica-btn-annulla",
      text: "Annulla",
    });
    btnAnnullaForm.addEventListener("click", onAnnulla);

    form.appendChild(el("div", { class: "anagrafica-form-actions" }, [btnSalva, btnAnnullaForm]));

    form.addEventListener("submit", function onSubmit(ev) {
      ev.preventDefault();
      var nomeSeduta = inputNome.value.trim();
      if (!nomeSeduta) {
        feedbackEl.textContent = "Il nome della seduta è obbligatorio.";
        return;
      }
      var eserciziValidi = eserciziLocali.filter(function (es) { return es.nome && es.nome.trim(); });
      if (eserciziValidi.length === 0) {
        feedbackEl.textContent = "Aggiungi almeno un esercizio.";
        return;
      }
      onSalva({
        numeroCiclo: seduta.numeroCiclo,
        nome: nomeSeduta,
        esercizi: eserciziValidi,
      });
    });

    return form;
  }

  // ---------------------------------------------------------------------------
  // Render principale della vista
  // ---------------------------------------------------------------------------

  function render(params, mount) {
    var Storage = global.MaranelloStorage;
    var container = el("div", { class: "anagrafica-palestra-view" });
    mount.appendChild(container);

    container.appendChild(el("h2", { text: "📋 Schede Palestra" }));

    var feedbackGlobale = el("p", { class: "anagrafica-feedback-globale", "aria-live": "polite" });
    container.appendChild(feedbackGlobale);

    // Pulsante ripristina default
    var btnRipristina = el("button", {
      type: "button",
      class: "anagrafica-btn-ripristina",
      text: "🔄 Ripristina default",
    });
    btnRipristina.addEventListener("click", function () {
      if (!global.confirm("Ripristinare il programma di default? Tutte le modifiche saranno perse.")) return;
      var seed = global.MaranelloProgrammaPalestraSeed;
      if (!seed || !Storage) {
        feedbackGlobale.textContent = "Seed non disponibile.";
        return;
      }
      Storage.put(STORE, seed, { origine: "utente" })
        .then(function () {
          feedbackGlobale.textContent = "Programma ripristinato.";
          renderLista(seed.sedute);
        })
        .catch(function (err) {
          feedbackGlobale.textContent = "Errore nel ripristino.";
          if (global.console) global.console.error(err);
        });
    });
    container.appendChild(btnRipristina);

    var listaContainer = el("div", { class: "anagrafica-lista-container" });
    container.appendChild(listaContainer);

    var programmaCorrente = null;

    function renderLista(sedute) {
      listaContainer.innerHTML = "";
      (sedute || []).forEach(function (seduta) {
        var wrapper = el("div", { class: "anagrafica-seduta-wrapper" });
        listaContainer.appendChild(wrapper);

        var card = renderSedutaCard(seduta, function onModifica(sed) {
          // Sostituisce la card con il form di modifica
          wrapper.innerHTML = "";
          var form = renderFormModifica(sed, function onSalva(sedutaAggiornata) {
            // Aggiorna il programma corrente
            var idx = programmaCorrente.sedute.findIndex(function (s) {
              return s.numeroCiclo === sedutaAggiornata.numeroCiclo;
            });
            if (idx >= 0) {
              programmaCorrente.sedute[idx] = sedutaAggiornata;
            }
            Storage.put(STORE, programmaCorrente, { origine: "utente" })
              .then(function () {
                feedbackGlobale.textContent = "Seduta salvata.";
                // Ri-renderizza la card aggiornata
                wrapper.innerHTML = "";
                var nuovaCard = renderSedutaCard(sedutaAggiornata, function onMod2(s) {
                  // ricorsione: apri di nuovo il form
                  wrapper.innerHTML = "";
                  var f2 = renderFormModifica(s, arguments.callee, function () {
                    wrapper.innerHTML = "";
                    wrapper.appendChild(renderSedutaCard(s, arguments.callee));
                  });
                  wrapper.appendChild(f2);
                });
                wrapper.appendChild(nuovaCard);
              })
              .catch(function (err) {
                feedbackGlobale.textContent = "Errore nel salvataggio.";
                if (global.console) global.console.error(err);
              });
          }, function onAnnulla() {
            wrapper.innerHTML = "";
            wrapper.appendChild(renderSedutaCard(sed, function onMod3(s) {
              wrapper.innerHTML = "";
              var f3 = renderFormModifica(s, function onSalva3(sa) {
                var idx3 = programmaCorrente.sedute.findIndex(function (x) { return x.numeroCiclo === sa.numeroCiclo; });
                if (idx3 >= 0) programmaCorrente.sedute[idx3] = sa;
                Storage.put(STORE, programmaCorrente, { origine: "utente" })
                  .then(function () {
                    feedbackGlobale.textContent = "Seduta salvata.";
                    wrapper.innerHTML = "";
                    wrapper.appendChild(renderSedutaCard(sa, onMod3));
                  })
                  .catch(function (err) {
                    feedbackGlobale.textContent = "Errore nel salvataggio.";
                    if (global.console) global.console.error(err);
                  });
              }, function () {
                wrapper.innerHTML = "";
                wrapper.appendChild(renderSedutaCard(s, onMod3));
              });
              wrapper.appendChild(f3);
            }));
          });
          wrapper.appendChild(form);
        });
        wrapper.appendChild(card);
      });
    }

    // Carica il programma da IndexedDB
    if (!Storage || typeof Storage.get !== "function") {
      feedbackGlobale.textContent = "Storage non disponibile.";
      return;
    }

    Storage.get(STORE, "main")
      .then(function (programma) {
        if (!programma) {
          // Usa il seed come fallback
          programma = global.MaranelloProgrammaPalestraSeed || { id: "main", sedute: [] };
        }
        programmaCorrente = programma;
        renderLista(programma.sedute);
      })
      .catch(function (err) {
        feedbackGlobale.textContent = "Errore nel caricamento del programma.";
        if (global.console) global.console.error(err);
      });
  }

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  if (!global.MaranelloViews) {
    global.MaranelloViews = {};
  }
  global.MaranelloViews.AnagraficaPalestra = render;
})(typeof window !== "undefined" ? window : globalThis, document);
