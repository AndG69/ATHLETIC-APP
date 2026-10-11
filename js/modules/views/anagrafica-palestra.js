/*
 * Maranello 2027 — App_HTML
 * File: js/modules/views/anagrafica-palestra.js
 *
 * Vista Schede Palestra — rotta #/anagrafica-palestra
 *
 * Mostra le sedute (schede template) con i loro esercizi. Permette di
 * modificare ogni seduta (nome, esercizi, serie, ripetizioni, carico) e di
 * ripristinare il programma di default.
 *
 * Gli esercizi si inseriscono SCEGLIENDOLI dall'anagrafica esercizi (rotta
 * #/anagrafica-esercizi), con possibilità di crearne di nuovi al volo. Il
 * gruppo muscolare è risolto per nome dall'anagrafica (sola lettura qui); la
 * gestione dei gruppi vive nella vista Anagrafica esercizi, non più qui.
 *
 * Il carico di una nuova riga viene pre-compilato con l'ultima esecuzione
 * nota di quell'esercizio (dal diario sessioni_palestra); da lì in poi il
 * carry-over per-seduta mantiene i valori aggiornati.
 *
 * Espone: window.MaranelloViews.AnagraficaPalestra
 */

(function initAnagraficaPalestraView(global, document) {
  "use strict";

  var STORE = "programma_palestra";
  var NUOVO_SENTINEL = "__nuovo_esercizio__";
  var VUOTO_SENTINEL = "";

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
          key === "max" || key === "step" || key === "placeholder" ||
          key === "label"
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

  function keyNome(s) { return String(s == null ? "" : s).trim().toLowerCase(); }

  function anagrafica() { return global.MaranelloAnagraficaEsercizi; }

  /** Gruppo risolto per nome dall'anagrafica (fallback alla copia sulla riga). */
  function gruppoDi(programma, es) {
    var A = anagrafica();
    if (A && typeof A.gruppoDi === "function") {
      var g = A.gruppoDi(programma, es.nome);
      if (g) return g;
    }
    return es.gruppo || "Altro";
  }

  function isTempoEs(programma, nome) {
    var A = anagrafica();
    if (A && typeof A.isTempo === "function") return A.isTempo(programma, nome);
    return false;
  }

  // ---------------------------------------------------------------------------
  // Rendering lista sedute (sola lettura)
  // ---------------------------------------------------------------------------

  function renderSedutaCard(seduta, programma, onModifica, onElimina) {
    var card = el("div", { class: "anagrafica-seduta-card" });

    var btnModifica = el("button", {
      type: "button",
      class: "anagrafica-btn-modifica",
      text: "\u270F\uFE0F Modifica",
      "aria-label": "Modifica " + seduta.nome,
    });
    btnModifica.addEventListener("click", function () { onModifica(seduta); });

    var btnElimina = el("button", {
      type: "button",
      class: "anagrafica-btn-elimina-seduta",
      text: "\uD83D\uDDD1\uFE0F Elimina",
      "aria-label": "Elimina " + seduta.nome,
    });
    btnElimina.onclick = function () {
      if (typeof onElimina === "function") onElimina(seduta);
    };

    var header = el("div", { class: "anagrafica-seduta-header" }, [
      el("h3", { class: "anagrafica-seduta-nome", text: seduta.nome }),
      el("span", {
        class: "anagrafica-seduta-numero",
        text: "Scheda " + seduta.numeroCiclo,
        "aria-label": "Numero scheda " + seduta.numeroCiclo,
      }),
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
        el("td", { text: gruppoDi(programma, es) }),
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

  function renderFormModifica(seduta, onSalva, onAnnulla, programma, ultimoCaricoPerNome, onAnagraficaChange) {
    var A = anagrafica();
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

    /** Costruisce il <select> picker con optgroup per gruppo muscolare. */
    function buildPicker(selectedNome) {
      var sel = el("select", {
        class: "anagrafica-select-esercizio",
        "aria-label": "Esercizio",
      });
      var ph = el("option", { value: VUOTO_SENTINEL, text: "\u2014 scegli esercizio \u2014" });
      if (!selectedNome) ph.setAttribute("selected", "selected");
      sel.appendChild(ph);

      var found = false;
      if (A) {
        var perGruppo = A.eserciziPerGruppo(programma);
        A.listaGruppi(programma).forEach(function (g) {
          var arr = perGruppo.get(g) || [];
          if (!arr.length) return;
          var og = el("optgroup", { label: g });
          arr.forEach(function (e) {
            var o = el("option", { value: e.nome, text: e.nome });
            if (selectedNome && keyNome(e.nome) === keyNome(selectedNome)) {
              o.setAttribute("selected", "selected");
              found = true;
            }
            og.appendChild(o);
          });
          sel.appendChild(og);
        });
      }
      // Esercizio non in anagrafica (difensivo): opzione ad hoc.
      if (selectedNome && !found) {
        var oAd = el("option", { value: selectedNome, text: selectedNome });
        oAd.setAttribute("selected", "selected");
        sel.appendChild(oAd);
      }
      sel.appendChild(el("option", { value: NUOVO_SENTINEL, text: "\u2795 nuovo esercizio\u2026" }));
      return sel;
    }

    /** Crea un nuovo esercizio nell'anagrafica (prompt nome + gruppo). */
    function creaNuovoEsercizioInline() {
      if (!A) return null;
      var nome = (global.prompt("Nome del nuovo esercizio:") || "").trim();
      if (!nome) return null;
      var gruppiDisponibili = A.listaGruppi(programma).join(", ");
      var gruppo = (global.prompt(
        "Gruppo muscolare per \u201C" + nome + "\u201D?\nDisponibili: " + gruppiDisponibili,
        "Altro"
      ) || "").trim() || "Altro";
      var res = A.aggiungiEsercizio(programma, nome, gruppo, false);
      if (!res.ok && res.motivo !== "duplicato") return null;
      if (typeof onAnagraficaChange === "function") onAnagraficaChange();
      return A.trovaEsercizio(programma, nome) || { nome: nome, gruppo: gruppo, tempo: false };
    }

    function applicaSelezione(idx, nome) {
      var tempo = isTempoEs(programma, nome);
      eserciziLocali[idx].nome = nome;
      eserciziLocali[idx].gruppo = gruppoDi(programma, { nome: nome });
      if (tempo) {
        eserciziLocali[idx].tempoSecondi =
          eserciziLocali[idx].tempoSecondi != null ? eserciziLocali[idx].tempoSecondi : 30;
      } else {
        eserciziLocali[idx].tempoSecondi = null;
        if (!eserciziLocali[idx].carico) {
          var last = ultimoCaricoPerNome && ultimoCaricoPerNome[keyNome(nome)];
          eserciziLocali[idx].carico = typeof last === "number" ? last : (eserciziLocali[idx].carico || 0);
        }
      }
    }

    function renderEserciziRows() {
      eserciziContainer.innerHTML = "";
      eserciziLocali.forEach(function (es, idx) {
        var row = el("div", { class: "anagrafica-esercizio-row" });

        // Picker esercizio (dall'anagrafica).
        var selectEs = buildPicker(es.nome || "");
        selectEs.addEventListener("change", function () {
          var val = selectEs.value;
          if (val === NUOVO_SENTINEL) {
            var creato = creaNuovoEsercizioInline();
            if (creato) applicaSelezione(idx, creato.nome);
            renderEserciziRows();
            return;
          }
          if (val === VUOTO_SENTINEL) {
            eserciziLocali[idx].nome = "";
            renderEserciziRows();
            return;
          }
          applicaSelezione(idx, val);
          renderEserciziRows();
        });

        // Gruppo (sola lettura, risolto per nome).
        var gruppoTxt = es.nome ? gruppoDi(programma, es) : "\u2014";
        var gruppoBadge = el("span", { class: "anagrafica-gruppo-badge", text: gruppoTxt });

        var isTempo = !!es.tempoSecondi || (es.nome && isTempoEs(programma, es.nome));

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
        var inputCarico = el("input", {
          type: "number", min: "0", step: "0.1",
          class: "anagrafica-input-carico",
          value: isTempo ? String(es.tempoSecondi || 0) : String(es.carico || 0),
          "aria-label": isTempo ? "Tempo (sec)" : "Carico (kg)",
          placeholder: isTempo ? "sec" : "kg",
        });
        inputCarico.addEventListener("input", function () {
          var val = parseFloat(inputCarico.value) || 0;
          if (isTempo) {
            eserciziLocali[idx].tempoSecondi = val;
          } else {
            eserciziLocali[idx].carico = val;
          }
        });

        // Pulsante rimuovi
        var btnRimuovi = el("button", {
          type: "button",
          class: "anagrafica-btn-rimuovi",
          text: "\u2715",
          "aria-label": "Rimuovi esercizio",
        });
        (function captureIdx(i) {
          btnRimuovi.addEventListener("click", function () {
            eserciziLocali.splice(i, 1);
            renderEserciziRows();
          });
        })(idx);

        var mainWrap = el("div", { class: "anagrafica-esercizio-main" }, [
          selectEs,
          gruppoBadge,
        ]);
        var numsWrap = el("div", { class: "anagrafica-esercizio-nums" }, [
          el("label", { class: "anagrafica-num-field" }, [
            el("span", { text: "Serie" }), inputSerie,
          ]),
          el("label", { class: "anagrafica-num-field" }, [
            el("span", { text: "Rip." }), inputRip,
          ]),
          el("label", { class: "anagrafica-num-field" }, [
            el("span", { text: isTempo ? "Tempo" : "Peso" }), inputCarico,
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
      eserciziLocali.push({
        nome: "",
        gruppo: "",
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
      text: "\uD83D\uDCBE Salva",
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
        feedbackEl.textContent = "Il nome della seduta \u00E8 obbligatorio.";
        return;
      }
      var eserciziValidi = eserciziLocali
        .filter(function (es) { return es.nome && es.nome.trim(); })
        .map(function (es) {
          return {
            nome: es.nome.trim(),
            gruppo: gruppoDi(programma, es),
            serie: es.serie || 4,
            ripetizioni: es.ripetizioni || 0,
            carico: es.carico || 0,
            tempoSecondi: es.tempoSecondi != null ? es.tempoSecondi : null,
          };
        });
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
  // Costruzione mappa "ultimo carico per nome" dal diario sessioni_palestra
  // ---------------------------------------------------------------------------

  function costruisciUltimoCarico(sessioni) {
    var map = Object.create(null);
    if (!Array.isArray(sessioni)) return map;
    var ordinate = sessioni.slice().sort(function (a, b) {
      var da = a && a.data ? a.data : "";
      var db = b && b.data ? b.data : "";
      return da < db ? -1 : da > db ? 1 : 0; // ascendente: le più recenti sovrascrivono
    });
    ordinate.forEach(function (sess) {
      (sess.gruppi || []).forEach(function (g) {
        (g.esercizi || []).forEach(function (es) {
          if (es && es.nome && typeof es.carico === "number" && es.carico > 0) {
            map[keyNome(es.nome)] = es.carico;
          }
        });
      });
    });
    return map;
  }

  // ---------------------------------------------------------------------------
  // Render principale della vista
  // ---------------------------------------------------------------------------

  function render(params, mount) {
    var Storage = global.MaranelloStorage;
    var A = anagrafica();
    var container = el("div", { class: "anagrafica-palestra-view" });
    mount.appendChild(container);

    container.appendChild(el("h2", { text: "\uD83D\uDCCB Schede Palestra" }));

    container.appendChild(el("p", {
      class: "anagrafica-hint",
      text: "Gli esercizi si scelgono dall\u2019Anagrafica esercizi. Per gestire gruppi ed esercizi vai in \u201CEsercizi\u201D.",
    }));

    var feedbackGlobale = el("p", { class: "anagrafica-feedback-globale", "aria-live": "polite" });
    container.appendChild(feedbackGlobale);

    // Pulsante ripristina default
    var btnRipristina = el("button", {
      type: "button",
      class: "anagrafica-btn-ripristina",
      text: "\uD83D\uDD04 Ripristina default",
    });
    btnRipristina.addEventListener("click", function () {
      if (!global.confirm("Ripristinare il programma di default? Tutte le modifiche saranno perse.")) return;
      var seed = global.MaranelloProgrammaPalestraSeed;
      if (!seed || !Storage) {
        feedbackGlobale.textContent = "Seed non disponibile.";
        return;
      }
      // Clona il seed per non mutarlo e ri-semina l'anagrafica.
      var fresh = JSON.parse(JSON.stringify(seed));
      if (A) A.ensure(fresh);
      Storage.put(STORE, fresh, { origine: "utente" })
        .then(function () {
          programmaCorrente = fresh;
          feedbackGlobale.textContent = "Programma ripristinato.";
          renderLista(fresh.sedute);
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
    var ultimoCaricoPerNome = Object.create(null);

    function salvaAnagrafica(msg) {
      return Storage.put(STORE, programmaCorrente, { origine: "utente" })
        .then(function () { if (msg) feedbackGlobale.textContent = msg; })
        .catch(function (err) {
          feedbackGlobale.textContent = "Errore nel salvataggio.";
          if (global.console) global.console.error(err);
        });
    }

    function renderLista(sedute) {
      listaContainer.innerHTML = "";
      (sedute || []).forEach(function (seduta) {
        var wrapper = el("div", { class: "anagrafica-seduta-wrapper" });
        listaContainer.appendChild(wrapper);

        function mostraCard(sed) {
          wrapper.innerHTML = "";
          var card = renderSedutaCard(sed, programmaCorrente, function onModifica(s) {
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
            }, programmaCorrente, ultimoCaricoPerNome, function onAnagraficaChange() {
              // Persistenza immediata quando viene creato un nuovo esercizio
              // nell'anagrafica dal picker.
              salvaAnagrafica();
            });
            wrapper.appendChild(form);
          }, function onElimina(s) {
            if (!global.confirm("Eliminare " + s.nome + "? L'operazione non \u00E8 reversibile.")) return;
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

    if (!Storage || typeof Storage.get !== "function") {
      feedbackGlobale.textContent = "Storage non disponibile.";
      return;
    }

    // Pulsante aggiungi nuova seduta
    var btnAggiungi = el("button", {
      type: "button",
      class: "anagrafica-btn-aggiungi",
      text: "\u2795 Aggiungi seduta",
    });
    btnAggiungi.addEventListener("click", function () {
      if (!programmaCorrente) return;
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

    // Carica programma + diario (per il pre-fill dei carichi).
    Promise.all([
      Storage.get(STORE, "main"),
      Storage.query ? Storage.query("sessioni_palestra").catch(function () { return []; }) : Promise.resolve([]),
    ])
      .then(function (res) {
        var programma = res[0];
        if (!programma) {
          programma = global.MaranelloProgrammaPalestraSeed || { id: "main", sedute: [] };
        }
        programmaCorrente = programma;
        ultimoCaricoPerNome = costruisciUltimoCarico(res[1]);

        var changed = A ? A.ensure(programmaCorrente) : false;
        var p = changed ? salvaAnagrafica() : Promise.resolve();
        p.then(function () { renderLista(programmaCorrente.sedute); });
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
