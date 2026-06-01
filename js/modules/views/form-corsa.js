/*
 * Maranello 2027 — App_HTML
 * File: js/modules/views/form-corsa.js
 *
 * Form post-sessione di corsa (Task 7).
 *   7.1 → campi obbligatori minimi (data, distanza, tempi per km, FC media,
 *         RPE, sonno) + campi opzionali (FC picco, dolori, risvegli,
 *         idratazione, note, schema walk-run)
 *   7.2 → salvataggio in `sessioni_corsa` con stato Completa|Micro e log
 *         modifica trasparente (gestito da MaranelloStorage.put)
 *
 * Contratto router: funzione `(params, mount, options?) => handle`.
 *   - `params.query.id`: se presente, la vista entra in modalità modifica
 *     e precarica il record.
 *   - `options.onSaved(record)`: callback opzionale invocata dopo il
 *     salvataggio (usata dal diario se il form è embedded).
 *
 * Lingua UI italiana (Req 17.3, 24.2). Range di validazione:
 *   - RPE ∈ [1, 10]
 *   - FC ∈ [40, 220] bpm
 *   - dolore ∈ [0, 10]
 *   - sonno ∈ [1, 5]
 *
 * Ref: Req 10.1, 10.3, 22.4.c, 22.5, 23.7
 */

(function initFormCorsaView(global, document) {
  "use strict";

  var STORE = "sessioni_corsa";

  // ---------------------------------------------------------------------------
  // DOM helper condiviso (stesso pattern di peso.js / oggi.js)
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

  /** Compone data ISO UTC a partire da YYYY-MM-DD (ore fisse 08:00 UTC). */
  function componiDataIso(dataLocalYmd) {
    if (!dataLocalYmd) return new Date().toISOString();
    return new Date(dataLocalYmd + "T08:00:00Z").toISOString();
  }

  /** Estrae la sola parte YYYY-MM-DD da una data ISO esistente (per edit). */
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

  // ---------------------------------------------------------------------------
  // Build field helpers
  // ---------------------------------------------------------------------------

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
    return el(
      "div",
      { class: "form-field" },
      children
    );
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

  function buildStatoRadio(name, value) {
    var radioCompleta = el("input", {
      id: name + "-completa",
      name: name,
      type: "radio",
      value: "Completa",
    });
    var radioMicro = el("input", {
      id: name + "-micro",
      name: name,
      type: "radio",
      value: "Micro",
    });
    if (value === "Micro") {
      radioMicro.checked = true;
    } else {
      radioCompleta.checked = true;
    }
    var group = el(
      "fieldset",
      { class: "form-field form-radio-group" },
      [
        el("legend", { text: t("view.form_corsa.stato_label") }),
        el("label", { class: "form-radio", for: name + "-completa" }, [
          radioCompleta,
          el("span", { text: t("view.form_corsa.stato_completa") }),
        ]),
        el("label", { class: "form-radio", for: name + "-micro" }, [
          radioMicro,
          el("span", { text: t("view.form_corsa.stato_micro") }),
        ]),
      ]
    );
    return {
      node: group,
      completa: radioCompleta,
      micro: radioMicro,
      getValue: function getValue() {
        return radioMicro.checked ? "Micro" : "Completa";
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Sezione "Tempi per km" dinamica
  // ---------------------------------------------------------------------------

  function buildTempiBlock(distanzaInput, valoriIniziali) {
    var Utils = global.MaranelloSessioniUtils;
    var container = el("div", { class: "form-tempi-list" });
    var hint = el("small", {
      class: "form-field-hint",
      text: t("view.form_corsa.tempi_hint"),
    });

    var wrapper = el("div", { class: "form-field form-field-full" }, [
      el("label", { text: t("view.form_corsa.tempi_label") }),
      container,
      hint,
    ]);

    function countFromDistanza() {
      if (!distanzaInput) return 0;
      var n = Utils ? Utils.parseNumero(distanzaInput.value) : Number(distanzaInput.value);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return Math.max(1, Math.ceil(n));
    }

    function render() {
      var target = countFromDistanza();
      // Salvataggio dei valori correnti per preservarli al re-render.
      var existing = Array.from(container.querySelectorAll("input")).map(
        function pick(inp) {
          return inp.value;
        }
      );
      container.innerHTML = "";
      for (var i = 0; i < target; i++) {
        var label = t("view.form_corsa.tempi_km", { n: i + 1 });
        var preset =
          existing[i] ||
          (valoriIniziali && valoriIniziali[i] != null
            ? Utils.formatTempoMinSec(valoriIniziali[i])
            : "");
        var row = el("div", { class: "form-tempi-row" }, [
          el("span", { class: "form-tempi-label", text: label }),
          el("input", {
            type: "text",
            inputmode: "text",
            class: "form-tempi-input",
            "data-tempo-index": String(i),
            placeholder: "mm:ss",
            value: preset,
            autocomplete: "off",
          }),
        ]);
        container.appendChild(row);
      }
      // Uso singolo: i valori iniziali servono solo al primo render.
      valoriIniziali = null;
    }

    if (distanzaInput) {
      distanzaInput.addEventListener("input", render);
      distanzaInput.addEventListener("change", render);
    }
    render();

    function readValori() {
      var inputs = Array.from(container.querySelectorAll("input"));
      var out = [];
      for (var i = 0; i < inputs.length; i++) {
        var s = Utils ? Utils.parseTempoMinSec(inputs[i].value) : null;
        out.push(s);
      }
      return out;
    }

    return { node: wrapper, readValori: readValori, rerender: render };
  }

  // ---------------------------------------------------------------------------
  // Sezione "Altri dati" (collapse)
  // ---------------------------------------------------------------------------

  function buildDetails(summaryText, childrenArray) {
    var details = el("details", { class: "form-details" });
    var summary = el("summary", { text: summaryText });
    details.appendChild(summary);
    var body = el("div", { class: "form-details-body" });
    childrenArray.forEach(function push(c) {
      if (c) body.appendChild(c);
    });
    details.appendChild(body);
    return details;
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  function renderFormCorsa(params, mount, options) {
    options = options || {};
    var Storage = global.MaranelloStorage;
    var Utils = global.MaranelloSessioniUtils;
    var Router = global.MaranelloRouter;

    var recordId =
      (params && params.query && params.query.id) || options.recordId || null;
    var isEdit = !!recordId;

    // Titolo pagina.
    mount.appendChild(
      el("h2", {
        class: "view-title",
        text: isEdit
          ? t("view.form_corsa.titolo_modifica")
          : t("view.form_corsa.titolo"),
      })
    );

    // Link indietro (se NON embedded).
    if (!options.embedded) {
      var backLink = el("a", {
        href: "#/diario/corsa",
        class: "form-back-link",
        text: "\u2190 " + t("view.form_corsa.indietro"),
      });
      mount.appendChild(backLink);
    }

    // Feedback.
    var feedbackEl = el("p", {
      class: "form-feedback",
      "data-testid": "form-corsa-feedback",
      "aria-live": "polite",
      "data-state": "idle",
    });

    // Form shell.
    var form = el("form", {
      class: "form-card",
      "data-testid": "form-corsa",
      novalidate: "novalidate",
    });

    // --- Campi obbligatori principali ---
    var dataField = buildDateField({
      id: "form-corsa-data",
      label: t("view.form_corsa.data_label"),
      required: true,
    });

    var distanzaInput = el("input", {
      id: "form-corsa-distanza",
      name: "distanza",
      type: "number",
      step: "0.01",
      min: "0",
      inputmode: "decimal",
      autocomplete: "off",
    });
    distanzaInput.required = true;
    var distanzaField = el(
      "div",
      { class: "form-field" },
      [
        el("label", {
          for: "form-corsa-distanza",
          text: t("view.form_corsa.distanza_label"),
        }),
        distanzaInput,
        el("small", {
          class: "form-field-hint",
          text: t("view.form_corsa.distanza_hint"),
        }),
      ]
    );

    var tempiBlock = buildTempiBlock(distanzaInput, null);

    var fcMediaField = buildNumeroField({
      id: "form-corsa-fc-media",
      label: t("view.form_corsa.fc_media_label"),
      min: 40,
      max: 220,
      step: "1",
    });

    var rpeLegendCorsa =
      global.MaranelloComponents &&
      typeof global.MaranelloComponents.rpeLegendPopover === "function"
        ? global.MaranelloComponents.rpeLegendPopover()
        : null;

    var rpeField = buildNumeroField({
      id: "form-corsa-rpe",
      label: t("view.form_corsa.rpe_label"),
      min: 1,
      max: 10,
      step: "1",
      required: true,
      labelExtra: rpeLegendCorsa ? rpeLegendCorsa.node : null,
    });
    rpeField.input.required = true;

    // Sonno notte precedente rimosso dal form su richiesta utente.
    // In edit mode il valore eventualmente esistente in `editOriginale`
    // viene preservato al submit (schema sessioni_corsa invariato).

    var statoRadio = buildStatoRadio("form-corsa-stato", "Completa");

    // --- Campi opzionali (collapsible) ---
    var fcPiccoField = buildNumeroField({
      id: "form-corsa-fc-picco",
      label: t("view.form_corsa.fc_picco_label"),
      min: 40,
      max: 220,
      step: "1",
    });

    var doloriSedeField = buildTextField({
      id: "form-corsa-dolori-sede",
      label: t("view.form_corsa.dolori_sede_label"),
      placeholder: "ginocchio dx, polpaccio sx",
    });
    var doloriIntField = buildTextField({
      id: "form-corsa-dolori-int",
      label: t("view.form_corsa.dolori_intensita_label"),
      placeholder: "3, 2",
      hint: t("view.form_corsa.dolori_hint"),
    });

    var risvegliField = { input: { value: "" } }; // rimosso dal form
    var idratazioneField = buildNumeroField({
      id: "form-corsa-idratazione",
      label: t("view.form_corsa.idratazione_label"),
      min: 0,
      max: 10,
      step: "0.1",
      inputmode: "decimal",
    });

    // Walk-run toggle + fields
    var walkrunCheck = el("input", {
      id: "form-corsa-walkrun-toggle",
      name: "walkrunToggle",
      type: "checkbox",
    });
    var walkrunCheckLabel = el(
      "label",
      { class: "form-checkbox", for: "form-corsa-walkrun-toggle" },
      [walkrunCheck, el("span", { text: t("view.form_corsa.walkrun_toggle") })]
    );
    var walkrunCammField = buildNumeroField({
      id: "form-corsa-walkrun-camm",
      label: t("view.form_corsa.walkrun_camm"),
      min: 0,
      max: 1000,
      step: "1",
    });
    var walkrunCorsaField = buildNumeroField({
      id: "form-corsa-walkrun-corsa",
      label: t("view.form_corsa.walkrun_corsa"),
      min: 0,
      max: 1000,
      step: "1",
    });
    var walkrunRipField = buildNumeroField({
      id: "form-corsa-walkrun-rip",
      label: t("view.form_corsa.walkrun_rip"),
      min: 1,
      max: 30,
      step: "1",
    });
    var walkrunBox = el(
      "div",
      { class: "form-walkrun-grid", hidden: "hidden" },
      [walkrunCammField.node, walkrunCorsaField.node, walkrunRipField.node]
    );
    walkrunCheck.addEventListener("change", function onToggle() {
      if (walkrunCheck.checked) {
        walkrunBox.removeAttribute("hidden");
      } else {
        walkrunBox.setAttribute("hidden", "hidden");
      }
    });

    var noteField = buildTextarea({
      id: "form-corsa-note",
      label: t("view.form_corsa.note_label"),
      rows: 3,
    });

    var altriDati = buildDetails(t("view.form_corsa.altri_dati"), [
      fcPiccoField.node,
      doloriSedeField.node,
      doloriIntField.node,
      idratazioneField.node,
      walkrunCheckLabel,
      walkrunBox,
      noteField.node,
    ]);

    // --- Submit ---
    var submitBtn = el("button", {
      type: "submit",
      class: "form-submit",
      "data-testid": "form-corsa-submit",
      text: isEdit
        ? t("view.form_corsa.submit_modifica")
        : t("view.form_corsa.submit"),
    });
    var submitField = el("div", { class: "form-actions" }, [submitBtn]);

    // --- Compose ---
    form.appendChild(feedbackEl);
    form.appendChild(
      el("div", { class: "form-grid" }, [
        dataField.node,
        distanzaField,
        tempiBlock.node,
        fcMediaField.node,
        rpeField.node,
        statoRadio.node,
      ])
    );
    form.appendChild(altriDati);
    form.appendChild(submitField);

    mount.appendChild(form);

    // -----------------------------------------------------------------
    // Submit handler
    // -----------------------------------------------------------------

    form.addEventListener("submit", function onSubmit(ev) {
      ev.preventDefault();
      if (!Storage || !Utils) {
        setFeedback(feedbackEl, t("view.form_corsa.error"), "error");
        return;
      }

      // --- Distanza ---
      var distanzaKm = Utils.parseNumero(distanzaInput.value);
      if (distanzaKm == null || distanzaKm <= 0) {
        setFeedback(
          feedbackEl,
          t("view.form_corsa.error_distanza"),
          "error"
        );
        distanzaInput.focus();
        return;
      }

      // --- Tempi ---
      var tempiRaw = tempiBlock.readValori();
      var tempiPuliti = tempiRaw.filter(function keep(v) {
        return typeof v === "number" && v > 0;
      });
      if (tempiPuliti.length === 0) {
        setFeedback(
          feedbackEl,
          t("view.form_corsa.error_tempi"),
          "error"
        );
        return;
      }

      // --- RPE ---
      var rpe = Utils.parseNumero(rpeField.input.value);
      if (rpe == null || rpe < 1 || rpe > 10 || !Number.isInteger(rpe)) {
        setFeedback(feedbackEl, t("view.form_corsa.error_rpe"), "error");
        rpeField.input.focus();
        return;
      }

      // --- FC (opzionale ma validato se presente) ---
      var fcMedia = fcMediaField.input.value
        ? Utils.parseNumero(fcMediaField.input.value)
        : null;
      if (
        fcMedia != null &&
        (fcMedia < 40 || fcMedia > 220 || !Number.isFinite(fcMedia))
      ) {
        setFeedback(feedbackEl, t("view.form_corsa.error_fc"), "error");
        fcMediaField.input.focus();
        return;
      }
      var fcPicco = fcPiccoField.input.value
        ? Utils.parseNumero(fcPiccoField.input.value)
        : null;
      if (
        fcPicco != null &&
        (fcPicco < 40 || fcPicco > 220 || !Number.isFinite(fcPicco))
      ) {
        setFeedback(feedbackEl, t("view.form_corsa.error_fc"), "error");
        fcPiccoField.input.focus();
        return;
      }

      // --- Sonno (rimosso dal form su richiesta utente) ---
      // In nuovi record il valore e' sempre null.
      // In edit mode preserviamo il valore eventualmente gia' presente
      // nel record originale (caricato in editOriginale), per non perdere
      // dati storici.
      var sonno =
        isEdit &&
        editOriginale &&
        editOriginale.sonnoNottePrec != null
          ? editOriginale.sonnoNottePrec
          : null;

      // --- Walk-run (opzionale) ---
      var schemaWalkRun = null;
      if (walkrunCheck.checked) {
        var camm = Utils.parseNumero(walkrunCammField.input.value);
        var corsa = Utils.parseNumero(walkrunCorsaField.input.value);
        var rip = Utils.parseNumero(walkrunRipField.input.value);
        if (
          camm == null ||
          corsa == null ||
          rip == null ||
          camm < 0 ||
          corsa < 0 ||
          rip < 1
        ) {
          setFeedback(
            feedbackEl,
            t("view.form_corsa.error_walkrun"),
            "error"
          );
          return;
        }
        schemaWalkRun = {
          cammMetri: Math.round(camm),
          corsaMetri: Math.round(corsa),
          ripetizioni: Math.round(rip),
        };
      }

      // --- Dolori (opzionale) ---
      var dolori = Utils.parseDolori(
        doloriSedeField.input.value,
        doloriIntField.input.value
      );

      // --- Altri opzionali ---
      var risvegli = null; // campo rimosso dal form
      var idratazione = idratazioneField.input.value
        ? Utils.parseNumero(idratazioneField.input.value)
        : null;

      // --- Data e settimanaId ---
      var dataIso = componiDataIso(dataField.input.value);
      var weekId = null;
      if (global.MaranelloOggiUtils) {
        weekId = global.MaranelloOggiUtils.toIsoWeekId(new Date(dataIso));
      }

      // --- Record ---
      var record = {
        data: dataIso,
        settimanaId: weekId || null,
        stato: statoRadio.getValue(),
        schemaWalkRun: schemaWalkRun,
        distanzaTotaleKm: Math.round(distanzaKm * 100) / 100,
        tempiPerKm: tempiPuliti,
        fcMedia: fcMedia != null ? Math.round(fcMedia) : null,
        fcPicco: fcPicco != null ? Math.round(fcPicco) : null,
        rpeSessione: rpe,
        dolori: dolori,
        sonnoNottePrec: sonno != null ? sonno : null,
        risvegliNotturni:
          isEdit && editOriginale && editOriginale.risvegliNotturni != null
            ? editOriginale.risvegliNotturni
            : null,
        idratazioneLitri:
          idratazione != null ? Math.round(idratazione * 10) / 10 : null,
        note: (noteField.input.value || "").trim(),
      };
      if (isEdit) {
        record.id = recordId;
      }

      submitBtn.disabled = true;
      setFeedback(feedbackEl, t("common.loading"), "pending");

      Storage.put(STORE, record, { origine: "utente" })
        .then(function onSaved(saved) {
          var msg = isEdit
            ? t("view.form_corsa.saved_updated")
            : t("view.form_corsa.saved_ok");
          setFeedback(feedbackEl, msg, "success");
          submitBtn.disabled = false;

          // Emette evento globale per aggiornare la vista Settimana
          try {
            var dataStr = dataField.input.value; // YYYY-MM-DD
            global.dispatchEvent(new CustomEvent("maranello:sessione-salvata", {
              detail: { data: dataStr, tipo: "corsa" }
            }));
          } catch (e) { /* ignore */ }

          if (typeof options.onSaved === "function") {
            try {
              options.onSaved(saved);
            } catch (err) {
              /* ignore */
            }
          }
          if (isEdit) {
            // Dopo un edit riuscito torniamo al diario.
            if (Router && typeof Router.navigate === "function") {
              global.setTimeout(function nav() {
                Router.navigate("#/diario/corsa");
              }, 500);
            }
          } else {
            // Nuovo inserimento: reset dei campi variabili ma mantieni
            // data odierna e stato Completa di default.
            distanzaInput.value = "";
            tempiBlock.rerender();
            fcMediaField.input.value = "";
            rpeField.input.value = "";
            fcPiccoField.input.value = "";
            doloriSedeField.input.value = "";
            doloriIntField.input.value = "";
            idratazioneField.input.value = "";
            walkrunCheck.checked = false;
            walkrunBox.setAttribute("hidden", "hidden");
            walkrunCammField.input.value = "";
            walkrunCorsaField.input.value = "";
            walkrunRipField.input.value = "";
            noteField.input.value = "";
            distanzaInput.focus();
            global.setTimeout(function clear() {
              if (feedbackEl.getAttribute("data-state") === "success") {
                setFeedback(feedbackEl, "", "idle");
              }
            }, 2500);
          }
        })
        .catch(function onErr(err) {
          if (global.console && global.console.error) {
            global.console.error("[form-corsa] errore salvataggio:", err);
          }
          setFeedback(feedbackEl, t("view.form_corsa.error"), "error");
          submitBtn.disabled = false;
        });
    });

    // -----------------------------------------------------------------
    // Precaricamento record esistente (edit)
    // -----------------------------------------------------------------

    // In edit mode conserviamo il record originale per poter preservare
    // campi che non sono piu' nel form (es. sonnoNottePrec rimosso).
    var editOriginale = null;

    var readyPromise = Promise.resolve();
    if (isEdit && Storage && typeof Storage.get === "function") {
      readyPromise = Storage.get(STORE, recordId)
        .then(function onRead(rec) {
          if (!rec) {
            setFeedback(
              feedbackEl,
              t("view.form_corsa.load_error"),
              "error"
            );
            return;
          }
          editOriginale = rec;
          dataField.input.value = estraiYmd(rec.data);
          distanzaInput.value =
            rec.distanzaTotaleKm != null ? String(rec.distanzaTotaleKm) : "";
          // Ricostruiamo i tempiPerKm: il costruttore ha già calcolato il
          // numero di righe dalla distanza appena assegnata; forziamo un
          // re-render e riempiamo i campi.
          tempiBlock.rerender();
          var tempiInputs = form.querySelectorAll(".form-tempi-input");
          if (Array.isArray(rec.tempiPerKm)) {
            for (var i = 0; i < tempiInputs.length; i++) {
              var v = rec.tempiPerKm[i];
              tempiInputs[i].value =
                typeof v === "number" ? Utils.formatTempoMinSec(v) : "";
            }
          }
          fcMediaField.input.value =
            rec.fcMedia != null ? String(rec.fcMedia) : "";
          fcPiccoField.input.value =
            rec.fcPicco != null ? String(rec.fcPicco) : "";
          rpeField.input.value =
            rec.rpeSessione != null ? String(rec.rpeSessione) : "";
          // Sonno e risvegli rimossi dal form; valori originali preservati
          // in editOriginale e copiati nel record aggiornato al submit.
          idratazioneField.input.value =
            rec.idratazioneLitri != null
              ? String(rec.idratazioneLitri)
              : "";
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
          if (rec.schemaWalkRun) {
            walkrunCheck.checked = true;
            walkrunBox.removeAttribute("hidden");
            walkrunCammField.input.value =
              rec.schemaWalkRun.cammMetri != null
                ? String(rec.schemaWalkRun.cammMetri)
                : "";
            walkrunCorsaField.input.value =
              rec.schemaWalkRun.corsaMetri != null
                ? String(rec.schemaWalkRun.corsaMetri)
                : "";
            walkrunRipField.input.value =
              rec.schemaWalkRun.ripetizioni != null
                ? String(rec.schemaWalkRun.ripetizioni)
                : "";
          }
          if (rec.stato === "Micro") {
            statoRadio.micro.checked = true;
          } else {
            statoRadio.completa.checked = true;
          }
          noteField.input.value = rec.note || "";
        })
        .catch(function onErr(err) {
          if (global.console && global.console.error) {
            global.console.error("[form-corsa] errore lettura record:", err);
          }
          setFeedback(feedbackEl, t("view.form_corsa.load_error"), "error");
        });
    }

    return {
      form: form,
      feedbackEl: feedbackEl,
      ready: readyPromise,
      recordId: recordId,
    };
  }

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  if (!global.MaranelloViews) {
    global.MaranelloViews = {};
  }
  global.MaranelloViews.FormCorsa = renderFormCorsa;
})(typeof window !== "undefined" ? window : globalThis, document);
