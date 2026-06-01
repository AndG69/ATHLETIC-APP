/*
 * Maranello 2027 — App_HTML
 * File: js/modules/views/form-palestra.js
 *
 * Form post-sessione palestra (Task 8).
 *   8.1 → selezione esercizi dal catalogo + libera, serie/reps, carico,
 *         minuti tapis, pendenza max, RPE seduta
 *   8.2 → persistenza in `sessioni_palestra` con struttura:
 *           gruppi: [ { gruppo, esercizi: [ { nome, serie, ripetizioni, carico } ] } ]
 *
 * Contratto router: funzione `(params, mount, options?) => handle`.
 * `params.query.id`: edit mode. `options.onSaved(record)`: callback opzionale.
 *
 * Ref: Req 6.1, 10.2, 22.4.d
 */

(function initFormPalestraView(global, document) {
  "use strict";

  var STORE = "sessioni_palestra";

  // ---------------------------------------------------------------------------
  // DOM helper
  // ---------------------------------------------------------------------------

  var ATTR_KEYS = {
    href: true,
    role: true,
    for: true,
    type: true,
    name: true,
    id: true,
    min: true,
    max: true,
    step: true,
    value: true,
    inputmode: true,
    autocomplete: true,
    datetime: true,
    placeholder: true,
    rows: true,
    cols: true,
    maxlength: true,
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

  function todayIsoLocalDate() {
    var d = new Date();
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }

  function componiDataIso(dataLocalYmd) {
    if (!dataLocalYmd) return new Date().toISOString();
    return new Date(dataLocalYmd + "T08:00:00Z").toISOString();
  }

  function estraiYmd(isoDate) {
    if (!isoDate) return todayIsoLocalDate();
    var d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return todayIsoLocalDate();
    return (
      d.getUTCFullYear() +
      "-" +
      String(d.getUTCMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getUTCDate()).padStart(2, "0")
    );
  }

  function setFeedback(node, message, stato) {
    if (!node) return;
    node.textContent = message || "";
    node.setAttribute("data-state", stato || "idle");
  }

  function buildField(id, labelText, controlNode, hintText, labelExtra) {
    var label = el("label", { for: id, text: labelText });
    if (labelExtra) {
      label.appendChild(labelExtra);
    }
    var children = [label, controlNode];
    if (hintText) {
      children.push(
        el("small", { class: "form-field-hint", text: hintText })
      );
    }
    return el("div", { class: "form-field" }, children);
  }

  function buildNumeroField(opts) {
    var input = el("input", {
      id: opts.id,
      name: opts.name || opts.id,
      type: "number",
      inputmode: opts.inputmode || "numeric",
      step: opts.step || "1",
      min: opts.min != null ? String(opts.min) : null,
      max: opts.max != null ? String(opts.max) : null,
      autocomplete: "off",
    });
    if (opts.required) input.required = true;
    if (opts.value != null) input.value = String(opts.value);
    return {
      input: input,
      node: buildField(opts.id, opts.label, input, opts.hint, opts.labelExtra),
    };
  }

  function buildTextField(opts) {
    var input = el("input", {
      id: opts.id,
      name: opts.name || opts.id,
      type: "text",
      autocomplete: "off",
      placeholder: opts.placeholder || null,
    });
    if (opts.value != null) input.value = String(opts.value);
    return {
      input: input,
      node: buildField(opts.id, opts.label, input, opts.hint),
    };
  }

  function buildDateField(opts) {
    var input = el("input", {
      id: opts.id,
      name: opts.name || opts.id,
      type: "date",
      value: opts.value || todayIsoLocalDate(),
    });
    if (opts.required) input.required = true;
    return {
      input: input,
      node: buildField(opts.id, opts.label, input),
    };
  }

  function buildTextarea(opts) {
    var input = el("textarea", {
      id: opts.id,
      name: opts.name || opts.id,
      rows: String(opts.rows || 2),
      autocomplete: "off",
    });
    if (opts.value != null) input.value = String(opts.value);
    return {
      input: input,
      node: buildField(opts.id, opts.label, input),
    };
  }

  // ---------------------------------------------------------------------------
  // Riga esercizio
  // ---------------------------------------------------------------------------

  var nextRowId = 0;

  function buildEsercizioRow(onRemove, catalog, preset) {
    var rowId = ++nextRowId;
    var ridPrefix = "form-palestra-r" + rowId;

    var gruppi = (catalog && Array.isArray(catalog.gruppi)) ? catalog.gruppi : [];
    var perGruppo = catalog && catalog.perGruppo ? catalog.perGruppo : null;

    // Select gruppo.
    var gruppoSelect = el("select", {
      id: ridPrefix + "-gruppo",
      name: "gruppo",
      class: "form-esercizio-gruppo",
      "data-field": "gruppo",
    });
    gruppi.forEach(function addOpt(g) {
      gruppoSelect.appendChild(el("option", { value: g, text: g }));
    });
    if (gruppi.length === 0) {
      // Fallback: almeno "Altro" disponibile.
      gruppoSelect.appendChild(el("option", { value: "Altro", text: "Altro" }));
    }

    // Select esercizio (cambia quando cambia gruppo).
    var nomeSelect = el("select", {
      id: ridPrefix + "-nome-select",
      name: "nome_select",
      class: "form-esercizio-nome",
      "data-field": "nome_select",
    });
    var nomeAltroInput = el("input", {
      id: ridPrefix + "-nome-altro",
      name: "nome_altro",
      type: "text",
      placeholder: t("view.form_palestra.esercizio_altro_placeholder"),
      class: "form-esercizio-nome-altro",
      "data-field": "nome_altro",
      hidden: "hidden",
      autocomplete: "off",
    });

    function populateNomeSelect(gruppoNome) {
      nomeSelect.innerHTML = "";
      var lista =
        perGruppo && perGruppo.get(gruppoNome)
          ? perGruppo.get(gruppoNome)
          : [];
      lista.forEach(function add(e) {
        nomeSelect.appendChild(el("option", { value: e.nome, text: e.nome }));
      });
      // "Altro" sempre disponibile in coda.
      nomeSelect.appendChild(
        el("option", {
          value: "__altro__",
          text: t("view.form_palestra.esercizio_altro"),
        })
      );
    }

    function syncAltroVisibility() {
      if (nomeSelect.value === "__altro__") {
        nomeAltroInput.removeAttribute("hidden");
      } else {
        nomeAltroInput.setAttribute("hidden", "hidden");
      }
    }

    // Serie.
    var serieField = buildNumeroField({
      id: ridPrefix + "-serie",
      label: t("view.form_palestra.esercizio_serie_label"),
      min: 1,
      max: 20,
      step: "1",
      value: 4,
    });

    // Ripetizioni (testo, accetta "10" o "10,10,9,8").
    var ripField = buildTextField({
      id: ridPrefix + "-rip",
      label: t("view.form_palestra.esercizio_rip_label"),
      placeholder: "10,10,9,8",
      hint: t("view.form_palestra.esercizio_rip_hint"),
    });

    // Carico (step 0.1 per supportare valori in kg con un decimale,
    // es. 11.3 kg da macchinari in libre).
    var caricoField = buildNumeroField({
      id: ridPrefix + "-carico",
      label: t("view.form_palestra.esercizio_carico_label"),
      min: 0,
      max: 500,
      step: "0.1",
      inputmode: "decimal",
    });

    // Tempo (secondi) — visibile solo per esercizi isometrici (es. Plank).
    // In futuro potrà coesistere con il carico (es. Plank con peso).
    var tempoField = buildNumeroField({
      id: ridPrefix + "-tempo",
      label: "Tempo (sec)",
      min: 1,
      max: 600,
      step: "1",
      inputmode: "numeric",
    });
    tempoField.node.style.display = "none"; // nascosto di default

    // Esercizi isometrici: mostrano il campo Tempo invece del solo Carico.
    var ISOMETRICI = { "Plank": true, "Plank laterale": true };

    function syncIsometrico() {
      var nome = nomeSelect.value === "__altro__"
        ? nomeAltroInput.value.trim()
        : nomeSelect.value;
      var isIso = !!ISOMETRICI[nome];
      tempoField.node.style.display = isIso ? "" : "none";
      var caricoLabel = caricoField.node.querySelector("label");
      if (caricoLabel) {
        caricoLabel.textContent = isIso
          ? t("view.form_palestra.esercizio_carico_label") + " (opz.)"
          : t("view.form_palestra.esercizio_carico_label");
      }
    }

    gruppoSelect.addEventListener("change", function onGruppo() {
      populateNomeSelect(gruppoSelect.value);
      syncAltroVisibility();
      syncIsometrico();
    });
    nomeSelect.addEventListener("change", function onNome() {
      syncAltroVisibility();
      syncIsometrico();
    });
    nomeAltroInput.addEventListener("input", syncIsometrico);

    // Inizializzazione.
    if (gruppi.length > 0) {
      gruppoSelect.value = gruppi[0];
    }
    populateNomeSelect(gruppoSelect.value);
    syncIsometrico();

    // Remove button.
    var removeBtn = el("button", {
      type: "button",
      class: "form-esercizio-remove",
      "data-testid": "form-palestra-rimuovi-esercizio",
      text: t("view.form_palestra.esercizio_rimuovi"),
      "aria-label": t("view.form_palestra.esercizio_rimuovi"),
    });
    removeBtn.addEventListener("click", function onClick() {
      if (typeof onRemove === "function") onRemove(row);
    });

    var row = el(
      "div",
      {
        class: "form-esercizio-row",
        "data-testid": "form-palestra-esercizio-row",
        "data-row-id": String(rowId),
      },
      [
        buildField(
          ridPrefix + "-gruppo",
          t("view.form_palestra.esercizio_gruppo_label"),
          gruppoSelect
        ),
        buildField(
          ridPrefix + "-nome-select",
          t("view.form_palestra.esercizio_nome_label"),
          el("div", { class: "form-esercizio-nome-wrap" }, [
            nomeSelect,
            nomeAltroInput,
          ])
        ),
        serieField.node,
        ripField.node,
        caricoField.node,
        tempoField.node,
        el("div", { class: "form-esercizio-remove-wrap" }, [removeBtn]),
      ]
    );

    // Preset (edit mode).
    if (preset) {
      if (preset.gruppo) {
        // Se il gruppo non è nel catalogo lo aggiungiamo come opzione ad hoc.
        var found = false;
        for (var i = 0; i < gruppoSelect.options.length; i++) {
          if (gruppoSelect.options[i].value === preset.gruppo) {
            found = true;
            break;
          }
        }
        if (!found) {
          gruppoSelect.appendChild(
            el("option", { value: preset.gruppo, text: preset.gruppo })
          );
        }
        gruppoSelect.value = preset.gruppo;
        populateNomeSelect(preset.gruppo);
      }
      if (preset.nome) {
        var foundNome = false;
        for (var j = 0; j < nomeSelect.options.length; j++) {
          if (nomeSelect.options[j].value === preset.nome) {
            foundNome = true;
            break;
          }
        }
        if (foundNome) {
          nomeSelect.value = preset.nome;
        } else {
          nomeSelect.value = "__altro__";
          nomeAltroInput.value = preset.nome;
        }
        syncAltroVisibility();
      }
      if (preset.serie != null) {
        serieField.input.value = String(preset.serie);
      }
      if (Array.isArray(preset.ripetizioni)) {
        ripField.input.value = preset.ripetizioni.join(",");
      } else if (preset.ripetizioni != null) {
        ripField.input.value = String(preset.ripetizioni);
      }
      if (preset.carico != null) {
        caricoField.input.value = String(preset.carico);
      }
      if (preset.tempoSecondi != null) {
        tempoField.input.value = String(preset.tempoSecondi);
      }
      syncIsometrico();
    }

    function readValues() {
      var nome;
      if (nomeSelect.value === "__altro__") {
        nome = (nomeAltroInput.value || "").trim();
      } else {
        nome = nomeSelect.value;
      }
      return {
        gruppo: gruppoSelect.value,
        nome: nome,
        serieRaw: serieField.input.value,
        ripetizioniRaw: ripField.input.value,
        caricoRaw: caricoField.input.value,
        tempoSecondiRaw: tempoField.input.value,
      };
    }

    return {
      node: row,
      readValues: readValues,
      // Esposti per test / debug.
      _gruppoSelect: gruppoSelect,
      _nomeSelect: nomeSelect,
      _nomeAltroInput: nomeAltroInput,
      _serieInput: serieField.input,
      _ripInput: ripField.input,
      _caricoInput: caricoField.input,
    };
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  function renderFormPalestra(params, mount, options) {
    options = options || {};
    var Storage = global.MaranelloStorage;
    var Utils = global.MaranelloSessioniUtils;
    var Router = global.MaranelloRouter;
    var catalog = global.MaranelloEserciziCatalog;

    var recordId =
      (params && params.query && params.query.id) || options.recordId || null;
    var isEdit = !!recordId;

    mount.appendChild(
      el("h2", {
        class: "view-title",
        text: isEdit
          ? t("view.form_palestra.titolo_modifica")
          : t("view.form_palestra.titolo"),
      })
    );

    if (!options.embedded) {
      mount.appendChild(
        el("a", {
          href: "#/diario/palestra",
          class: "form-back-link",
          text: "\u2190 " + t("view.form_palestra.indietro"),
        })
      );
    }

    var feedbackEl = el("p", {
      class: "form-feedback",
      "data-testid": "form-palestra-feedback",
      "aria-live": "polite",
      "data-state": "idle",
    });

    var form = el("form", {
      class: "form-card",
      "data-testid": "form-palestra",
      novalidate: "novalidate",
    });

    // --- Campi principali ---
    var dataField = buildDateField({
      id: "form-palestra-data",
      label: t("view.form_palestra.data_label"),
      required: true,
    });

    var radioCompleta = el("input", {
      id: "form-palestra-stato-completa",
      name: "statoPalestra",
      type: "radio",
      value: "Completa",
    });
    radioCompleta.checked = true;
    var radioMicro = el("input", {
      id: "form-palestra-stato-micro",
      name: "statoPalestra",
      type: "radio",
      value: "Micro",
    });
    var statoGroup = el(
      "fieldset",
      { class: "form-field form-radio-group" },
      [
        el("legend", { text: t("view.form_palestra.stato_label") }),
        el(
          "label",
          {
            class: "form-radio",
            for: "form-palestra-stato-completa",
          },
          [
            radioCompleta,
            el("span", { text: t("view.form_palestra.stato_completa") }),
          ]
        ),
        el(
          "label",
          { class: "form-radio", for: "form-palestra-stato-micro" },
          [
            radioMicro,
            el("span", { text: t("view.form_palestra.stato_micro") }),
          ]
        ),
      ]
    );

    // --- Lista esercizi ---
    var eserciziListEl = el("div", {
      class: "form-esercizi-list",
      "data-testid": "form-palestra-esercizi-list",
    });
    var esercizi = [];

    function addRow(preset) {
      var rowObj = buildEsercizioRow(
        function onRemove(rowNode) {
          eserciziListEl.removeChild(rowNode);
          var idx = esercizi.findIndex(function find(r) {
            return r.node === rowNode;
          });
          if (idx >= 0) esercizi.splice(idx, 1);
        },
        catalog,
        preset
      );
      esercizi.push(rowObj);
      eserciziListEl.appendChild(rowObj.node);
      return rowObj;
    }

    var addEsercizioBtn = el("button", {
      type: "button",
      class: "form-add-row",
      "data-testid": "form-palestra-aggiungi-esercizio",
      text: "+ " + t("view.form_palestra.esercizio_aggiungi"),
    });
    addEsercizioBtn.addEventListener("click", function onAdd() {
      addRow();
    });

    var eserciziSection = el(
      "section",
      { class: "form-section" },
      [
        el("h3", {
          class: "form-section-titolo",
          text: t("view.form_palestra.esercizi_titolo"),
        }),
        eserciziListEl,
        addEsercizioBtn,
      ]
    );

    // Di default, se non in edit, aggiungiamo una riga.
    // Se presetGruppi è fornito (dall'overlay Settimana), crea le righe pre-compilate.
    if (!isEdit) {
      if (options.presetGruppi && Array.isArray(options.presetGruppi)) {
        options.presetGruppi.forEach(function (g) {
          (g.esercizi || []).forEach(function (es) {
            addRow({
              gruppo: g.gruppo,
              nome: es.nome,
              serie: es.serie || 4,
              ripetizioni: Array.isArray(es.ripetizioni) ? es.ripetizioni : [es.ripetizioni || 12],
              carico: es.carico || 0,
              tempoSecondi: es.tempoSecondi || null,
            });
          });
        });
        if (esercizi.length === 0) addRow();
      } else {
        addRow();
      }
    }

    // --- Tapis ---
    var tapisMinutiField = buildNumeroField({
      id: "form-palestra-tapis-min",
      label: t("view.form_palestra.tapis_minuti_label"),
      min: 0,
      max: 120,
      step: "1",
    });
    var tapisPendField = buildNumeroField({
      id: "form-palestra-tapis-pend",
      label: t("view.form_palestra.tapis_pendenza_label"),
      min: 0,
      max: 30,
      step: "1",
    });
    var tapisSection = el("section", { class: "form-section" }, [
      el("h3", {
        class: "form-section-titolo",
        text: t("view.form_palestra.tapis_titolo"),
      }),
      el("div", { class: "form-grid" }, [
        tapisMinutiField.node,
        tapisPendField.node,
      ]),
    ]);

    // --- RPE + dolori + note ---
    var rpeLegendPalestra =
      global.MaranelloComponents &&
      typeof global.MaranelloComponents.rpeLegendPopover === "function"
        ? global.MaranelloComponents.rpeLegendPopover()
        : null;

    var rpeField = buildNumeroField({
      id: "form-palestra-rpe",
      label: t("view.form_palestra.rpe_label"),
      min: 1,
      max: 10,
      step: "1",
      required: true,
      labelExtra: rpeLegendPalestra ? rpeLegendPalestra.node : null,
    });
    rpeField.input.required = true;

    var doloriSedeField = buildTextField({
      id: "form-palestra-dolori-sede",
      label: t("view.form_palestra.dolori_sede_label"),
      placeholder: "spalla dx, lombari",
    });
    var doloriIntField = buildTextField({
      id: "form-palestra-dolori-int",
      label: t("view.form_palestra.dolori_intensita_label"),
      placeholder: "2, 1",
    });

    var noteField = buildTextarea({
      id: "form-palestra-note",
      label: t("view.form_palestra.note_label"),
      rows: 3,
    });

    var altriCampi = el("section", { class: "form-section" }, [
      el("div", { class: "form-grid" }, [
        rpeField.node,
        doloriSedeField.node,
        doloriIntField.node,
      ]),
      noteField.node,
    ]);

    // --- Submit ---
    var submitBtn = el("button", {
      type: "submit",
      class: "form-submit",
      "data-testid": "form-palestra-submit",
      text: isEdit
        ? t("view.form_palestra.submit_modifica")
        : t("view.form_palestra.submit"),
    });
    var submitField = el("div", { class: "form-actions" }, [submitBtn]);

    form.appendChild(feedbackEl);
    form.appendChild(
      el("div", { class: "form-grid" }, [dataField.node, statoGroup])
    );
    form.appendChild(eserciziSection);
    form.appendChild(tapisSection);
    form.appendChild(altriCampi);
    form.appendChild(submitField);

    mount.appendChild(form);

    // -----------------------------------------------------------------
    // Serializzazione gruppi / esercizi
    // -----------------------------------------------------------------

    function buildGruppiPayload() {
      if (!Utils) return { gruppi: [], errors: ["utils-missing"] };
      var perGruppoMap = new Map();
      var errors = [];
      for (var i = 0; i < esercizi.length; i++) {
        var r = esercizi[i].readValues();
        if (!r.nome || r.nome.length === 0) {
          errors.push("nome-vuoto");
          continue;
        }
        var serie = Utils.parseNumero(r.serieRaw);
        if (
          serie == null ||
          !Number.isFinite(serie) ||
          serie < 1 ||
          serie > 20 ||
          !Number.isInteger(serie)
        ) {
          errors.push("serie-invalide");
          continue;
        }
        var ripetizioni = Utils.parseRipetizioni(r.ripetizioniRaw, serie);
        var carico =
          r.caricoRaw === "" || r.caricoRaw == null
            ? 0
            : Utils.parseNumero(r.caricoRaw);
        if (carico == null || carico < 0) carico = 0;

        // Tempo (secondi) per esercizi isometrici (es. Plank).
        var tempoSecondi = null;
        if (r.tempoSecondiRaw && r.tempoSecondiRaw !== "") {
          var t2 = Utils.parseNumero(r.tempoSecondiRaw);
          if (t2 != null && t2 > 0) tempoSecondi = Math.round(t2);
        }

        var gruppoKey = r.gruppo || "Altro";
        if (!perGruppoMap.has(gruppoKey)) perGruppoMap.set(gruppoKey, []);
        perGruppoMap.get(gruppoKey).push({
          nome: r.nome,
          serie: Math.round(serie),
          ripetizioni: ripetizioni,
          carico: Math.round(carico * 10) / 10,
          tempoSecondi: tempoSecondi,
        });
      }
      var gruppi = [];
      perGruppoMap.forEach(function accum(arr, key) {
        gruppi.push({ gruppo: key, esercizi: arr });
      });
      return { gruppi: gruppi, errors: errors };
    }

    // -----------------------------------------------------------------
    // Submit handler
    // -----------------------------------------------------------------

    form.addEventListener("submit", function onSubmit(ev) {
      ev.preventDefault();
      if (!Storage || !Utils) {
        setFeedback(feedbackEl, t("view.form_palestra.error"), "error");
        return;
      }

      if (esercizi.length === 0) {
        setFeedback(
          feedbackEl,
          t("view.form_palestra.error_no_esercizi"),
          "error"
        );
        return;
      }

      var payload = buildGruppiPayload();
      if (payload.errors.indexOf("nome-vuoto") >= 0) {
        setFeedback(
          feedbackEl,
          t("view.form_palestra.error_esercizio_nome"),
          "error"
        );
        return;
      }
      if (payload.errors.indexOf("serie-invalide") >= 0) {
        setFeedback(
          feedbackEl,
          t("view.form_palestra.error_serie"),
          "error"
        );
        return;
      }
      if (payload.gruppi.length === 0) {
        setFeedback(
          feedbackEl,
          t("view.form_palestra.error_no_esercizi"),
          "error"
        );
        return;
      }

      var rpe = Utils.parseNumero(rpeField.input.value);
      if (rpe == null || rpe < 1 || rpe > 10 || !Number.isInteger(rpe)) {
        setFeedback(feedbackEl, t("view.form_palestra.error_rpe"), "error");
        rpeField.input.focus();
        return;
      }

      var tapisMin =
        tapisMinutiField.input.value !== ""
          ? Utils.parseNumero(tapisMinutiField.input.value)
          : null;
      var tapisPend =
        tapisPendField.input.value !== ""
          ? Utils.parseNumero(tapisPendField.input.value)
          : null;

      var dolori = Utils.parseDolori(
        doloriSedeField.input.value,
        doloriIntField.input.value
      );

      var dataIso = componiDataIso(dataField.input.value);
      var weekId = null;
      if (global.MaranelloOggiUtils) {
        weekId = global.MaranelloOggiUtils.toIsoWeekId(new Date(dataIso));
      }

      var record = {
        data: dataIso,
        settimanaId: weekId || null,
        stato: radioMicro.checked ? "Micro" : "Completa",
        gruppi: payload.gruppi,
        tapisMinuti: tapisMin != null ? Math.round(tapisMin) : null,
        tapisPendenzaMax: tapisPend != null ? Math.round(tapisPend) : null,
        rpeSeduta: rpe,
        dolori: dolori,
        note: (noteField.input.value || "").trim(),
        // Salva il numeroCiclo se passato dalle opzioni (es. dall'overlay Settimana)
        // per permettere il lookup dei carichi precedenti nella generazione del piano.
        numeroCiclo: options.numeroCiclo || null,
      };
      if (isEdit) record.id = recordId;

      submitBtn.disabled = true;
      setFeedback(feedbackEl, t("common.loading"), "pending");

      Storage.put(STORE, record, { origine: "utente" })
        .then(function onSaved(saved) {
          var msg = isEdit
            ? t("view.form_palestra.saved_updated")
            : t("view.form_palestra.saved_ok");
          setFeedback(feedbackEl, msg, "success");
          submitBtn.disabled = false;

          // Emette evento globale per aggiornare la vista Settimana
          try {
            var dataStr = dataField.input.value; // YYYY-MM-DD
            global.dispatchEvent(new CustomEvent("maranello:sessione-salvata", {
              detail: { data: dataStr, tipo: "palestra" }
            }));
          } catch (e) { /* ignore */ }

          // Aggiorna automaticamente ultimaSedutaPalestra nelle impostazioni
          if (record.numeroCiclo && Storage && typeof Storage.get === "function") {
            Storage.get("impostazioni", "main")
              .then(function (impostazioni) {
                if (!impostazioni) return;
                var dataYmd = dataField.input.value; // YYYY-MM-DD
                impostazioni.ultimaSedutaPalestra = {
                  data: dataYmd,
                  numeroCiclo: record.numeroCiclo,
                };
                return Storage.put("impostazioni", impostazioni, { origine: "sistema_adattamento" });
              })
              .catch(function () { /* silenzioso */ });
          }

          // Aggiorna automaticamente l'anagrafica palestra con i nuovi carichi
          // se la sessione ha un numeroCiclo (= sappiamo quale seduta è).
          if (record.numeroCiclo && Storage && typeof Storage.get === "function") {
            Storage.get("programma_palestra", "main")
              .then(function (programma) {
                if (!programma || !Array.isArray(programma.sedute)) return;
                var sedutaIdx = -1;
                for (var si = 0; si < programma.sedute.length; si++) {
                  if (programma.sedute[si].numeroCiclo === record.numeroCiclo) {
                    sedutaIdx = si;
                    break;
                  }
                }
                if (sedutaIdx < 0) return;
                // Aggiorna i carichi/ripetizioni nell'anagrafica
                var eserciziAggiornati = [];
                (record.gruppi || []).forEach(function (g) {
                  (g.esercizi || []).forEach(function (es) {
                    eserciziAggiornati.push({
                      nome: es.nome,
                      gruppo: g.gruppo,
                      serie: es.serie || 4,
                      ripetizioni: Array.isArray(es.ripetizioni) && es.ripetizioni.length > 0
                        ? es.ripetizioni[0] // prende il primo valore come riferimento
                        : 12,
                      carico: es.carico || 0,
                      tempoSecondi: es.tempoSecondi || null,
                    });
                  });
                });
                if (eserciziAggiornati.length > 0) {
                  programma.sedute[sedutaIdx].esercizi = eserciziAggiornati;
                  return Storage.put("programma_palestra", programma, { origine: "sistema_adattamento" });
                }
              })
              .catch(function () { /* silenzioso */ });
          }

          if (typeof options.onSaved === "function") {
            try {
              options.onSaved(saved);
            } catch (e) {
              /* ignore */
            }
          }
          if (isEdit) {
            if (Router && typeof Router.navigate === "function") {
              global.setTimeout(function nav() {
                Router.navigate("#/diario/palestra");
              }, 500);
            }
          } else {
            // Reset variabili, mantieni data odierna e stato Completa.
            esercizi.slice().forEach(function remove(r) {
              eserciziListEl.removeChild(r.node);
            });
            esercizi.length = 0;
            addRow();
            tapisMinutiField.input.value = "";
            tapisPendField.input.value = "";
            rpeField.input.value = "";
            doloriSedeField.input.value = "";
            doloriIntField.input.value = "";
            noteField.input.value = "";
            global.setTimeout(function clear() {
              if (feedbackEl.getAttribute("data-state") === "success") {
                setFeedback(feedbackEl, "", "idle");
              }
            }, 2500);
          }
        })
        .catch(function onErr(err) {
          if (global.console && global.console.error) {
            global.console.error("[form-palestra] errore salvataggio:", err);
          }
          setFeedback(feedbackEl, t("view.form_palestra.error"), "error");
          submitBtn.disabled = false;
        });
    });

    // -----------------------------------------------------------------
    // Precaricamento record esistente
    // -----------------------------------------------------------------

    var readyPromise = Promise.resolve();
    if (isEdit && Storage && typeof Storage.get === "function") {
      readyPromise = Storage.get(STORE, recordId)
        .then(function onRead(rec) {
          if (!rec) {
            setFeedback(
              feedbackEl,
              t("view.form_palestra.load_error"),
              "error"
            );
            addRow();
            return;
          }
          dataField.input.value = estraiYmd(rec.data);
          if (rec.stato === "Micro") {
            radioMicro.checked = true;
          } else {
            radioCompleta.checked = true;
          }
          // Righe esercizi.
          if (Array.isArray(rec.gruppi)) {
            rec.gruppi.forEach(function addGruppo(g) {
              if (!g || !Array.isArray(g.esercizi)) return;
              g.esercizi.forEach(function addE(es) {
                addRow({
                  gruppo: g.gruppo,
                  nome: es.nome,
                  serie: es.serie,
                  ripetizioni: es.ripetizioni,
                  carico: es.carico,
                });
              });
            });
          }
          if (esercizi.length === 0) addRow();

          if (rec.tapisMinuti != null) {
            tapisMinutiField.input.value = String(rec.tapisMinuti);
          }
          if (rec.tapisPendenzaMax != null) {
            tapisPendField.input.value = String(rec.tapisPendenzaMax);
          }
          rpeField.input.value =
            rec.rpeSeduta != null ? String(rec.rpeSeduta) : "";
          if (Array.isArray(rec.dolori) && rec.dolori.length > 0) {
            doloriSedeField.input.value = rec.dolori
              .map(function s(d) {
                return d && d.sede ? d.sede : "";
              })
              .join(", ");
            doloriIntField.input.value = rec.dolori
              .map(function i(d) {
                return d && d.intensita != null ? String(d.intensita) : "";
              })
              .join(", ");
          }
          noteField.input.value = rec.note || "";
        })
        .catch(function onErr(err) {
          if (global.console && global.console.error) {
            global.console.error("[form-palestra] errore lettura record:", err);
          }
          setFeedback(
            feedbackEl,
            t("view.form_palestra.load_error"),
            "error"
          );
          if (esercizi.length === 0) addRow();
        });
    }

    return {
      form: form,
      feedbackEl: feedbackEl,
      ready: readyPromise,
      recordId: recordId,
      _addRow: addRow,
      _esercizi: esercizi,
    };
  }

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  if (!global.MaranelloViews) {
    global.MaranelloViews = {};
  }
  global.MaranelloViews.FormPalestra = renderFormPalestra;
})(typeof window !== "undefined" ? window : globalThis, document);
