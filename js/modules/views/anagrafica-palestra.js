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
  // Gestione gruppi muscolari
  //
  // I gruppi vivono nel campo `gruppi` (array di stringhe) dell'oggetto
  // programma_palestra "main". "Altro" è sempre disponibile come catch-all e
  // non è modificabile né eliminabile.
  // ---------------------------------------------------------------------------

  var GRUPPI_DEFAULT = [
    "Addominali", "Bicipiti", "Dorsali", "Gambe", "Glutei",
    "Lombari", "Pettorali", "Spalle", "Tricipiti",
  ];

  /**
   * Ritorna l'elenco ordinato dei gruppi disponibili: quelli definiti
   * dall'utente (o i default), più eventuali gruppi già usati dagli esercizi,
   * con "Altro" sempre in coda.
   */
  function getGruppiEffettivi(programma) {
    var out = [];
    var seen = Object.create(null);
    function add(g) {
      if (!g) return;
      var k = String(g).toLowerCase();
      if (k === "altro" || seen[k]) return;
      seen[k] = true;
      out.push(g);
    }
    if (programma && Array.isArray(programma.gruppi) && programma.gruppi.length) {
      programma.gruppi.forEach(add);
    } else {
      GRUPPI_DEFAULT.forEach(add);
    }
    // Include i gruppi già usati dagli esercizi, così non spariscono mai.
    if (programma && Array.isArray(programma.sedute)) {
      programma.sedute.forEach(function (s) {
        (s.esercizi || []).forEach(function (e) {
          if (e && e.gruppo) add(e.gruppo);
        });
      });
    }
    out.push("Altro");
    return out;
  }

  /** Inizializza programma.gruppi se assente (senza "Altro"). */
  function ensureGruppi(programma) {
    if (!programma) return [];
    if (!Array.isArray(programma.gruppi) || programma.gruppi.length === 0) {
      programma.gruppi = getGruppiEffettivi(programma).filter(function (g) {
        return g !== "Altro";
      });
    }
    return programma.gruppi;
  }

  // ---------------------------------------------------------------------------
  // Rendering lista sedute (sola lettura)
  // ---------------------------------------------------------------------------

  function renderSedutaCard(seduta, onModifica, onElimina) {
    var card = el("div", { class: "anagrafica-seduta-card" });

    var btnModifica = el("button", {
      type: "button",
      class: "anagrafica-btn-modifica",
      text: "✏️ Modifica",
      "aria-label": "Modifica " + seduta.nome,
    });
    btnModifica.addEventListener("click", function () {
      onModifica(seduta);
    });

    var btnElimina = el("button", {
      type: "button",
      class: "anagrafica-btn-elimina-seduta",
      text: "🗑️ Elimina",
      "aria-label": "Elimina " + seduta.nome,
    });
    btnElimina.onclick = function () {
      if (typeof onElimina === "function") onElimina(seduta);
    };

    var header = el("div", { class: "anagrafica-seduta-header" }, [
      el("h3", { class: "anagrafica-seduta-nome", text: seduta.nome }),
      btnModifica,
      btnElimina,
    ]);
    card.appendChild(header);

    var table = el("table", { class: "anagrafica-esercizi-table" });
    var thead = el("thead", {}, [
      el("tr", {}, [
        el("th", { text: "Gruppo" }),
        el("th", { text: "Esercizio" }),
        el("th", { text: "Serie" }),
        el("th", { text: "Rip." }),
        el("th", { text: "Peso" }),
      ]),
    ]);
    table.appendChild(thead);

    var tbody = el("tbody");
    (seduta.esercizi || []).forEach(function (es) {
      var caricoTesto = es.tempoSecondi
        ? es.tempoSecondi + " sec"
        : (es.carico || 0) + " kg";
      tbody.appendChild(el("tr", {}, [
        el("td", { text: es.gruppo || "Altro" }),
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

  function renderFormModifica(seduta, onSalva, onAnnulla, programmaCorrente) {
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

    // --- Helper gruppi muscolari (dinamici + creazione inline) ---
    var NUOVO_GRUPPO_SENTINEL = "__nuovo_gruppo__";

    /** Riempie un <select> con i gruppi correnti + l'opzione "Nuovo gruppo…". */
    function fillGruppoSelect(selectEl, selezionato) {
      selectEl.innerHTML = "";
      getGruppiEffettivi(programmaCorrente).forEach(function (g) {
        var opt = el("option", { value: g, text: g });
        if (g === selezionato) opt.setAttribute("selected", "selected");
        selectEl.appendChild(opt);
      });
      selectEl.appendChild(
        el("option", { value: NUOVO_GRUPPO_SENTINEL, text: "➕ Nuovo gruppo…" })
      );
    }

    /**
     * Chiede il nome di un nuovo gruppo, lo aggiunge a programmaCorrente.gruppi
     * e persiste. Ritorna il nome (o quello esistente) oppure null se annullato.
     */
    function creaNuovoGruppoInline() {
      var nome = (global.prompt("Nome del nuovo gruppo muscolare:") || "").trim();
      if (!nome) return null;
      if (nome.toLowerCase() === "altro") return "Altro";
      ensureGruppi(programmaCorrente);
      var esistente = programmaCorrente.gruppi.filter(function (g) {
        return g.toLowerCase() === nome.toLowerCase();
      })[0];
      if (esistente) return esistente;
      programmaCorrente.gruppi.push(nome);
      var S = global.MaranelloStorage;
      if (S && typeof S.put === "function") {
        S.put(STORE, programmaCorrente, { origine: "utente" });
      }
      return nome;
    }

    // Datalist con i nomi esercizio noti (catalogo + programma) per i
    // suggerimenti durante la digitazione del nome esercizio.
    var datalistId = "anagrafica-esercizi-suggeriti";
    function buildDatalist() {
      var catalog = global.MaranelloEserciziCatalog;
      var nomi = [];
      var seen = Object.create(null);
      function add(n) {
        if (!n) return;
        var k = n.toLowerCase();
        if (seen[k]) return;
        seen[k] = true;
        nomi.push(n);
      }
      if (catalog && Array.isArray(catalog.esercizi)) {
        catalog.esercizi.forEach(function (e) { add(e.nome); });
      }
      if (programmaCorrente && Array.isArray(programmaCorrente.sedute)) {
        programmaCorrente.sedute.forEach(function (s) {
          (s.esercizi || []).forEach(function (e) { add(e && e.nome); });
        });
      }
      nomi.sort(function (a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; });
      var dl = el("datalist", { id: datalistId });
      nomi.forEach(function (n) { dl.appendChild(el("option", { value: n })); });
      return dl;
    }

    function renderEserciziRows() {
      eserciziContainer.innerHTML = "";
      eserciziContainer.appendChild(buildDatalist());
      eserciziLocali.forEach(function (es, idx) {
        var row = el("div", { class: "anagrafica-esercizio-row" });

        // Nome esercizio: testo libero con suggerimenti (datalist).
        var inputNome = el("input", {
          type: "text",
          class: "anagrafica-input-esercizio",
          value: es.nome || "",
          placeholder: "Esercizio",
          "aria-label": "Esercizio " + (idx + 1),
          autocomplete: "off",
        });
        inputNome.setAttribute("list", datalistId);
        inputNome.addEventListener("input", function () {
          eserciziLocali[idx].nome = inputNome.value;
        });

        // Select gruppo muscolare: SEMPRE visibile e autoritativo.
        // Opzioni dinamiche (gruppi definiti dall'utente) + "➕ Nuovo gruppo…".
        var selectGruppo = el("select", {
          class: "anagrafica-select-gruppo",
          "aria-label": "Gruppo muscolare",
        });
        fillGruppoSelect(selectGruppo, es.gruppo || "Altro");
        selectGruppo.addEventListener("change", function () {
          if (selectGruppo.value === NUOVO_GRUPPO_SENTINEL) {
            var nuovo = creaNuovoGruppoInline();
            if (nuovo) eserciziLocali[idx].gruppo = nuovo;
            renderEserciziRows();
            return;
          }
          eserciziLocali[idx].gruppo = selectGruppo.value;
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

        var mainWrap = el("div", { class: "anagrafica-esercizio-main" }, [
          selectGruppo,
          inputNome,
        ]);
        var numsWrap = el("div", { class: "anagrafica-esercizio-nums" }, [
          el("label", { class: "anagrafica-num-field" }, [
            el("span", { text: "Serie" }), inputSerie,
          ]),
          el("label", { class: "anagrafica-num-field" }, [
            el("span", { text: "Rip." }), inputRip,
          ]),
          el("label", { class: "anagrafica-num-field" }, [
            el("span", { text: isPlank ? "Tempo" : "Peso" }), inputCarico,
          ]),
          btnRimuovi,
        ]);
        row.appendChild(mainWrap);
        row.appendChild(numsWrap);
        eserciziContainer.appendChild(row);
      });
    }

    renderEserciziRows();

    // Pulsante aggiungi esercizio (riga vuota da compilare)
    var btnAggiungi = el("button", {
      type: "button",
      class: "anagrafica-btn-aggiungi",
      text: "+ Aggiungi esercizio",
    });
    btnAggiungi.addEventListener("click", function () {
      var gruppiEff = getGruppiEffettivi(programmaCorrente);
      var gruppoDefault = gruppiEff.length > 1 ? gruppiEff[0] : "Altro";
      eserciziLocali.push({
        nome: "",
        gruppo: gruppoDefault,
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
          programmaCorrente = seed;
          feedbackGlobale.textContent = "Programma ripristinato.";
          renderGruppiSection();
          renderLista(seed.sedute);
        })
        .catch(function (err) {
          feedbackGlobale.textContent = "Errore nel ripristino.";
          if (global.console) global.console.error(err);
        });
    });
    container.appendChild(btnRipristina);

    // --- Sezione gestione gruppi muscolari (aperta di default) ---
    var gruppiBox = el("details", { class: "anagrafica-gruppi", open: "open" });
    container.appendChild(gruppiBox);

    function persistGruppi(msg) {
      return Storage.put(STORE, programmaCorrente, { origine: "utente" })
        .then(function () { if (msg) feedbackGlobale.textContent = msg; })
        .catch(function (err) {
          feedbackGlobale.textContent = "Errore nel salvataggio dei gruppi.";
          if (global.console) global.console.error(err);
        });
    }

    function aggiungiGruppo(nome) {
      nome = (nome || "").trim();
      if (!nome) return;
      ensureGruppi(programmaCorrente);
      var dup = nome.toLowerCase() === "altro" || programmaCorrente.gruppi.some(function (g) {
        return g.toLowerCase() === nome.toLowerCase();
      });
      if (dup) { feedbackGlobale.textContent = "Il gruppo \"" + nome + "\" esiste già."; return; }
      programmaCorrente.gruppi.push(nome);
      persistGruppi("Gruppo \"" + nome + "\" aggiunto.").then(function () {
        renderGruppiSection();
        renderLista(programmaCorrente.sedute);
      });
    }

    function rinominaGruppo(vecchio, nuovo) {
      nuovo = (nuovo || "").trim();
      if (!nuovo || nuovo === vecchio) { renderGruppiSection(); return; }
      ensureGruppi(programmaCorrente);
      if (nuovo.toLowerCase() === "altro") {
        feedbackGlobale.textContent = "Nome non valido.";
        renderGruppiSection(); return;
      }
      var dup = programmaCorrente.gruppi.some(function (g) {
        return g.toLowerCase() === nuovo.toLowerCase() && g.toLowerCase() !== vecchio.toLowerCase();
      });
      if (dup) {
        feedbackGlobale.textContent = "Esiste già un gruppo \"" + nuovo + "\".";
        renderGruppiSection(); return;
      }
      programmaCorrente.gruppi = programmaCorrente.gruppi.map(function (g) {
        return g === vecchio ? nuovo : g;
      });
      (programmaCorrente.sedute || []).forEach(function (s) {
        (s.esercizi || []).forEach(function (e) {
          if (e && e.gruppo === vecchio) e.gruppo = nuovo;
        });
      });
      persistGruppi("Gruppo rinominato in \"" + nuovo + "\".").then(function () {
        renderGruppiSection();
        renderLista(programmaCorrente.sedute);
      });
    }

    function eliminaGruppo(nome) {
      ensureGruppi(programmaCorrente);
      var count = 0;
      (programmaCorrente.sedute || []).forEach(function (s) {
        (s.esercizi || []).forEach(function (e) {
          if (e && e.gruppo === nome) count++;
        });
      });
      var msg = count > 0
        ? "Eliminare il gruppo \"" + nome + "\"? " + count + " esercizi verranno spostati in \"Altro\"."
        : "Eliminare il gruppo \"" + nome + "\"?";
      if (!global.confirm(msg)) return;
      programmaCorrente.gruppi = programmaCorrente.gruppi.filter(function (g) { return g !== nome; });
      (programmaCorrente.sedute || []).forEach(function (s) {
        (s.esercizi || []).forEach(function (e) {
          if (e && e.gruppo === nome) e.gruppo = "Altro";
        });
      });
      persistGruppi("Gruppo \"" + nome + "\" eliminato.").then(function () {
        renderGruppiSection();
        renderLista(programmaCorrente.sedute);
      });
    }

    function renderGruppiSection() {
      gruppiBox.innerHTML = "";
      gruppiBox.appendChild(el("summary", { text: "🏷️ Gestione gruppi muscolari" }));
      if (!programmaCorrente) return;
      ensureGruppi(programmaCorrente);

      gruppiBox.appendChild(el("p", {
        class: "anagrafica-gruppi-hint",
        text: "Aggiungi, rinomina o elimina i gruppi muscolari. \u201CAltro\u201D \u00E8 sempre disponibile.",
      }));

      var lista = el("div", { class: "anagrafica-gruppi-lista" });
      programmaCorrente.gruppi.forEach(function (g) {
        var input = el("input", {
          type: "text", class: "anagrafica-gruppo-input",
          value: g, "aria-label": "Nome gruppo " + g,
        });
        input.addEventListener("change", function () { rinominaGruppo(g, input.value); });
        var btnDel = el("button", {
          type: "button", class: "anagrafica-gruppo-del",
          text: "\uD83D\uDDD1", "aria-label": "Elimina gruppo " + g,
        });
        btnDel.addEventListener("click", function () { eliminaGruppo(g); });
        lista.appendChild(el("div", { class: "anagrafica-gruppo-row" }, [input, btnDel]));
      });
      gruppiBox.appendChild(lista);

      var nuovoInput = el("input", {
        type: "text", class: "anagrafica-gruppo-nuovo",
        placeholder: "Nuovo gruppo", "aria-label": "Nome nuovo gruppo",
      });
      var btnAdd = el("button", {
        type: "button", class: "anagrafica-gruppo-add", text: "\uFF0B Aggiungi gruppo",
      });
      btnAdd.addEventListener("click", function () {
        aggiungiGruppo(nuovoInput.value);
        nuovoInput.value = "";
      });
      gruppiBox.appendChild(el("div", { class: "anagrafica-gruppo-add-row" }, [nuovoInput, btnAdd]));
    }

    var listaContainer = el("div", { class: "anagrafica-lista-container" });
    container.appendChild(listaContainer);

    var programmaCorrente = null;

    function renderLista(sedute) {
      listaContainer.innerHTML = "";
      (sedute || []).forEach(function (seduta) {
        var wrapper = el("div", { class: "anagrafica-seduta-wrapper" });
        listaContainer.appendChild(wrapper);

        function mostraCard(sed) {
          wrapper.innerHTML = "";
          var card = renderSedutaCard(sed, function onModifica(s) {
            wrapper.innerHTML = "";
            var form = renderFormModifica(s, function onSalva(sedutaAggiornata) {
              var idx = programmaCorrente.sedute.findIndex(function (x) {
                return x.numeroCiclo === sedutaAggiornata.numeroCiclo;
              });
              if (idx >= 0) {
                programmaCorrente.sedute[idx] = sedutaAggiornata;
              }
              Storage.put(STORE, programmaCorrente, { origine: "utente" })
                .then(function () {
                  feedbackGlobale.textContent = "Seduta salvata.";
                  mostraCard(sedutaAggiornata);
                })
                .catch(function (err) {
                  feedbackGlobale.textContent = "Errore nel salvataggio.";
                  if (global.console) global.console.error(err);
                });
            }, function onAnnulla() {
              mostraCard(s);
            }, programmaCorrente);
            wrapper.appendChild(form);
          }, function onElimina(s) {
            console.log("[anagrafica] elimina premuto per:", s.nome, s.numeroCiclo);
            if (!global.confirm("Eliminare " + s.nome + "? L'operazione non è reversibile.")) return;
            programmaCorrente.sedute = programmaCorrente.sedute.filter(function (x) {
              return x.numeroCiclo !== s.numeroCiclo;
            });
            Storage.put(STORE, programmaCorrente, { origine: "utente" })
              .then(function () {
                feedbackGlobale.textContent = s.nome + " eliminata.";
                renderLista(programmaCorrente.sedute);
              })
              .catch(function (err) {
                feedbackGlobale.textContent = "Errore nell'eliminazione.";
                if (global.console) global.console.error(err);
              });
          });
          wrapper.appendChild(card);
        }

        mostraCard(seduta);
      });
    }

    // Carica il programma da IndexedDB
    if (!Storage || typeof Storage.get !== "function") {
      feedbackGlobale.textContent = "Storage non disponibile.";
      return;
    }

    // Pulsante aggiungi nuova seduta
    var btnAggiungi = el("button", {
      type: "button",
      class: "anagrafica-btn-aggiungi",
      text: "➕ Aggiungi seduta",
    });
    btnAggiungi.addEventListener("click", function () {
      if (!programmaCorrente) return;
      // Calcola il prossimo numeroCiclo
      var maxCiclo = 0;
      (programmaCorrente.sedute || []).forEach(function (s) {
        if (s.numeroCiclo > maxCiclo) maxCiclo = s.numeroCiclo;
      });
      var nuovoNumeroCiclo = maxCiclo + 1;
      var nuovaSeduta = {
        numeroCiclo: nuovoNumeroCiclo,
        nome: "Seduta " + nuovoNumeroCiclo,
        esercizi: [],
      };
      programmaCorrente.sedute.push(nuovaSeduta);
      Storage.put(STORE, programmaCorrente, { origine: "utente" })
        .then(function () {
          feedbackGlobale.textContent = "Seduta " + nuovoNumeroCiclo + " aggiunta. Modifica gli esercizi.";
          renderLista(programmaCorrente.sedute);
        })
        .catch(function (err) {
          feedbackGlobale.textContent = "Errore nell'aggiunta.";
          if (global.console) global.console.error(err);
        });
    });
    container.appendChild(btnAggiungi);

    Storage.get(STORE, "main")
      .then(function (programma) {
        if (!programma) {
          // Usa il seed come fallback
          programma = global.MaranelloProgrammaPalestraSeed || { id: "main", sedute: [] };
        }
        programmaCorrente = programma;
        renderGruppiSection();
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
