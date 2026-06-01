/*
 * Maranello 2027 — App_HTML
 * File: js/modules/views/peso.js
 *
 * View "Peso": form di inserimento pesata (Req 18.1, 22.4.e) + card media
 * mobile 7 giorni (Req 23.3) + lista delle ultime pesate con azione di
 * cancellazione.
 *
 * Design minimalista (Req 22.5): massimo 5 campi obbligatori
 *   1. Peso (kg)                 — required
 *   2. Data                      — required, default oggi
 *   3. Ora del giorno (mattina/sera) — required, default "mattina"
 *   4. A digiuno?                — opzione checkbox, default true
 *   5. Note (opzionale)          — non conteggiato fra gli obbligatori
 *
 * Persistenza: `window.MaranelloStorage` store `peso` (keyPath `id`
 * uuid, indice `by_data`). I record hanno la forma:
 *   {
 *     id:             <uuid generato dallo storage>,
 *     data:           "2026-05-14T07:00:00.000Z",  // ISO datetime
 *     pesoKg:         100.5,
 *     oraDelGiorno:   "mattina" | "sera",
 *     aDigiuno:       true|false,
 *     note:           "...",
 *     _updatedAt:     <iso>   // aggiunto dallo storage
 *   }
 *
 * Contratto router: funzione (params, mount) che popola `mount`.
 *
 * Ref: Req 18.1, 22.4.e, 22.5, 22.9, 23.3, 24.3
 */

(function initPesoView(global, document) {
  "use strict";

  var STORE = "peso";

  // ---------------------------------------------------------------------------
  // Helper DOM condiviso (allineato a js/app.js)
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
        } else if (
          key.indexOf("data-") === 0 ||
          key.indexOf("aria-") === 0
        ) {
          node.setAttribute(key, value);
        } else if (
          key === "href" ||
          key === "role" ||
          key === "for" ||
          key === "type" ||
          key === "name" ||
          key === "id" ||
          key === "min" ||
          key === "max" ||
          key === "step" ||
          key === "value" ||
          key === "inputmode" ||
          key === "autocomplete" ||
          key === "datetime"
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

  /** YYYY-MM-DD per l'attributo value di <input type="date">. */
  function todayIsoLocalDate() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + dd;
  }

  /**
   * Compone una data ISO datetime a partire dalla data (YYYY-MM-DD) e
   * dall'ora del giorno. Usiamo UTC con ore fisse per disambiguare
   * cronologicamente le pesate mattina/sera dello stesso giorno senza
   * dipendere dal fuso orario locale.
   */
  function componiDataIso(dataLocalYmd, oraDelGiorno) {
    var ora = oraDelGiorno === "sera" ? "20:00:00" : "07:00:00";
    return new Date(dataLocalYmd + "T" + ora + "Z").toISOString();
  }

  // ---------------------------------------------------------------------------
  // Componenti UI
  // ---------------------------------------------------------------------------

  function buildFeedback() {
    // Container aria-live per feedback di salvataggio o errore.
    return el("p", {
      class: "peso-form-feedback",
      "data-testid": "peso-feedback",
      "aria-live": "polite",
      "data-state": "idle",
    });
  }

  function buildForm(onSubmit) {
    var form = el("form", {
      class: "peso-form",
      novalidate: "novalidate",
      "data-testid": "peso-form",
    });

    // --- Peso -----------------------------------------------------------
    var pesoInput = el("input", {
      id: "peso-input-peso",
      name: "peso",
      type: "number",
      step: "0.1",
      min: "40",
      max: "250",
      inputmode: "decimal",
      autocomplete: "off",
      required: true,
    });
    pesoInput.required = true;
    var pesoField = el("div", { class: "peso-form-field" }, [
      el("label", { for: "peso-input-peso", text: t("view.peso.form.peso_label") }),
      pesoInput,
      el("small", {
        class: "peso-form-hint",
        text: t("view.peso.form.peso_hint"),
      }),
    ]);

    // --- Data -----------------------------------------------------------
    var dataInput = el("input", {
      id: "peso-input-data",
      name: "data",
      type: "date",
      value: todayIsoLocalDate(),
      required: true,
    });
    dataInput.required = true;
    var dataField = el("div", { class: "peso-form-field" }, [
      el("label", { for: "peso-input-data", text: t("view.peso.form.data_label") }),
      dataInput,
    ]);

    // --- Ora del giorno (radio) ----------------------------------------
    var radioMattina = el("input", {
      id: "peso-input-ora-mattina",
      name: "oraDelGiorno",
      type: "radio",
      value: "mattina",
    });
    radioMattina.checked = true;
    var radioSera = el("input", {
      id: "peso-input-ora-sera",
      name: "oraDelGiorno",
      type: "radio",
      value: "sera",
    });
    var oraField = el(
      "fieldset",
      { class: "peso-form-field peso-form-ora" },
      [
        el("legend", { text: t("view.peso.form.ora_label") }),
        el("label", { class: "peso-form-radio", for: "peso-input-ora-mattina" }, [
          radioMattina,
          el("span", { text: t("view.peso.form.ora_mattina") }),
        ]),
        el("label", { class: "peso-form-radio", for: "peso-input-ora-sera" }, [
          radioSera,
          el("span", { text: t("view.peso.form.ora_sera") }),
        ]),
      ]
    );

    // --- Digiuno --------------------------------------------------------
    var digiunoInput = el("input", {
      id: "peso-input-digiuno",
      name: "aDigiuno",
      type: "checkbox",
    });
    digiunoInput.checked = true;
    var digiunoField = el("div", { class: "peso-form-field peso-form-check" }, [
      el("label", { class: "peso-form-checkbox", for: "peso-input-digiuno" }, [
        digiunoInput,
        el("span", { text: t("view.peso.form.digiuno_label") }),
      ]),
    ]);

    // --- Note (opzionale) ----------------------------------------------
    var noteInput = el("textarea", {
      id: "peso-input-note",
      name: "note",
      rows: 2,
      autocomplete: "off",
    });
    noteInput.setAttribute("rows", "2");
    var noteField = el("div", { class: "peso-form-field peso-form-field-full" }, [
      el("label", { for: "peso-input-note", text: t("view.peso.form.note_label") }),
      noteInput,
    ]);

    // --- Submit ---------------------------------------------------------
    var submitBtn = el("button", {
      type: "submit",
      class: "peso-form-submit",
      "data-testid": "peso-submit",
      text: t("view.peso.form.submit"),
    });
    var submitField = el("div", { class: "peso-form-actions" }, [submitBtn]);

    form.appendChild(pesoField);
    form.appendChild(dataField);
    form.appendChild(oraField);
    form.appendChild(digiunoField);
    form.appendChild(noteField);
    form.appendChild(submitField);

    form.addEventListener("submit", function onSubmitForm(ev) {
      ev.preventDefault();
      var raw = {
        peso: pesoInput.value,
        data: dataInput.value,
        oraDelGiorno: radioSera.checked ? "sera" : "mattina",
        aDigiuno: !!digiunoInput.checked,
        note: (noteInput.value || "").trim(),
      };
      onSubmit(raw, {
        form: form,
        pesoInput: pesoInput,
        submitBtn: submitBtn,
      });
    });

    return { form: form, pesoInput: pesoInput, submitBtn: submitBtn };
  }

  function buildMediaCard(state) {
    var mediaCard = el("section", {
      class: "peso-media-card",
      "data-testid": "peso-media-card",
      "aria-labelledby": "peso-media-titolo",
    });
    mediaCard.appendChild(
      el("h3", {
        id: "peso-media-titolo",
        class: "peso-media-titolo",
        text: t("view.peso.media_titolo"),
      })
    );

    var valueEl = el("p", {
      class: "peso-media-valore",
      "data-testid": "peso-media-valore",
    });
    var detailEl = el("p", {
      class: "peso-media-dettaglio",
      "data-testid": "peso-media-dettaglio",
    });
    mediaCard.appendChild(valueEl);
    mediaCard.appendChild(detailEl);

    renderMedia(state, valueEl, detailEl);
    return { node: mediaCard, valueEl: valueEl, detailEl: detailEl };
  }

  function renderMedia(state, valueEl, detailEl) {
    var Stats = global.MaranelloPesoStats;
    if (!Stats) {
      valueEl.textContent = "—";
      detailEl.textContent = "";
      return;
    }
    var info = Stats.calcolaMediaMobile7gg(state.records, new Date());
    if (info.count === 0 || info.media === null) {
      valueEl.textContent = "—";
      detailEl.textContent = t("view.peso.media_nessun_dato");
      return;
    }
    valueEl.textContent = t("view.peso.media_valore", {
      valore: Stats.formatKg(info.media),
    });
    detailEl.textContent = t("view.peso.media_dettaglio", { n: info.count });
  }

  function buildUltimeList(state, onDelete) {
    var section = el("section", {
      class: "peso-ultime",
      "aria-labelledby": "peso-ultime-titolo",
    });
    section.appendChild(
      el("h3", {
        id: "peso-ultime-titolo",
        class: "peso-ultime-titolo",
        text: t("view.peso.ultime_titolo"),
      })
    );
    var listEl = el("ul", {
      class: "peso-ultime-list",
      "data-testid": "peso-ultime-list",
    });
    section.appendChild(listEl);

    renderUltime(state, listEl, onDelete);
    return { node: section, listEl: listEl };
  }

  function renderUltime(state, listEl, onDelete) {
    var Stats = global.MaranelloPesoStats;
    listEl.innerHTML = "";
    if (!state.records || state.records.length === 0) {
      var emptyItem = el("li", {
        class: "peso-ultime-empty",
        text: t("view.peso.ultime_nessuna"),
      });
      listEl.appendChild(emptyItem);
      return;
    }
    var ordinate = Stats
      ? Stats.ordinaPerDataDesc(state.records)
      : state.records;
    var max = Math.min(10, ordinate.length);
    for (var i = 0; i < max; i++) {
      var rec = ordinate[i];
      listEl.appendChild(buildUltimeRow(rec, onDelete));
    }
  }

  function buildUltimeRow(rec, onDelete) {
    var Stats = global.MaranelloPesoStats;
    var peso = Stats ? Stats.formatKg(rec.pesoKg) : String(rec.pesoKg);
    var oraLabel =
      rec.oraDelGiorno === "sera"
        ? t("view.peso.form.ora_sera")
        : t("view.peso.form.ora_mattina");
    var digiunoLabel = rec.aDigiuno
      ? t("view.peso.digiuno_si")
      : t("view.peso.digiuno_no");

    var dateText = formatDataShort(rec.data);
    var pesoText = peso + " kg";

    var btnElimina = el("button", {
      type: "button",
      class: "peso-ultime-elimina",
      "data-testid": "peso-elimina",
      text: t("view.peso.ultime_elimina"),
    });
    btnElimina.addEventListener("click", function onClick() {
      var msg = t("view.peso.ultime_elimina_conferma", { data: dateText });
      if (global.confirm(msg)) {
        onDelete(rec);
      }
    });

    var row = el("li", { class: "peso-ultime-row" }, [
      el("span", { class: "peso-ultime-data", text: dateText }),
      el("span", { class: "peso-ultime-ora", text: oraLabel }),
      el("span", { class: "peso-ultime-peso", text: pesoText }),
      el("span", { class: "peso-ultime-digiuno", text: digiunoLabel }),
      btnElimina,
    ]);
    return row;
  }

  // ---------------------------------------------------------------------------
  // Main entry
  // ---------------------------------------------------------------------------

  function renderPesoView(params, mount) {
    var Storage = global.MaranelloStorage;
    var state = { records: [] };

    // Titolo della vista (mantenuto per accessibilità).
    mount.appendChild(
      el("h2", { class: "view-peso-title", text: t("view.peso.title") })
    );

    // Feedback inline.
    var feedbackEl = buildFeedback();

    // Form.
    var onSubmit = function onSubmitHandler(raw, refs) {
      handleSubmit(raw, refs, state, ui, feedbackEl);
    };
    var formRefs = buildForm(onSubmit);

    var formCard = el("section", {
      class: "peso-form-card",
      "aria-labelledby": "view-peso-form-title",
    });
    formCard.appendChild(
      el("h3", {
        id: "view-peso-form-title",
        class: "peso-form-titolo",
        text: t("view.peso.form.titolo"),
      })
    );
    formCard.appendChild(feedbackEl);
    formCard.appendChild(formRefs.form);
    mount.appendChild(formCard);

    // Media mobile card.
    var mediaRefs = buildMediaCard(state);
    mount.appendChild(mediaRefs.node);

    // Ultime pesate.
    var onDelete = function onDeleteHandler(rec) {
      handleDelete(rec, state, ui, feedbackEl);
    };
    var ultimeRefs = buildUltimeList(state, onDelete);
    mount.appendChild(ultimeRefs.node);

    var ui = {
      mediaRefs: mediaRefs,
      ultimeRefs: ultimeRefs,
      onDelete: onDelete,
    };

    // Carica i record esistenti.
    caricaRecords(state).then(function onLoaded() {
      renderMedia(state, mediaRefs.valueEl, mediaRefs.detailEl);
      renderUltime(state, ultimeRefs.listEl, onDelete);
    });

    // Restituiamo un handle minimo (utile per eventuali test).
    return { state: state, ui: ui };

    // -------- funzioni locali -----------
    function caricaRecords(st) {
      if (!Storage || typeof Storage.query !== "function") {
        return Promise.resolve();
      }
      return Storage.query(STORE, { index: "by_data" })
        .then(function onRows(rows) {
          st.records = Array.isArray(rows) ? rows : [];
        })
        .catch(function onErr() {
          st.records = [];
        });
    }
  }

  function handleSubmit(raw, refs, state, ui, feedbackEl) {
    var Storage = global.MaranelloStorage;
    var Stats = global.MaranelloPesoStats;

    var pesoKg = Stats ? Stats.parsePesoInput(raw.peso) : Number(raw.peso);
    if (pesoKg == null || !Number.isFinite(pesoKg) || pesoKg < 40 || pesoKg > 250) {
      setFeedback(feedbackEl, t("view.peso.form.error_peso"), "error");
      refs.pesoInput.focus();
      return;
    }
    if (!raw.data) {
      setFeedback(feedbackEl, t("view.peso.form.error_data"), "error");
      return;
    }

    var record = {
      data: componiDataIso(raw.data, raw.oraDelGiorno),
      pesoKg: Math.round(pesoKg * 10) / 10,
      oraDelGiorno: raw.oraDelGiorno,
      aDigiuno: !!raw.aDigiuno,
      note: raw.note || "",
    };

    refs.submitBtn.disabled = true;
    setFeedback(feedbackEl, t("common.loading"), "pending");

    if (!Storage || typeof Storage.put !== "function") {
      setFeedback(feedbackEl, t("view.peso.form.error"), "error");
      refs.submitBtn.disabled = false;
      return;
    }

    Storage.put(STORE, record, { origine: "utente" })
      .then(function onSaved(saved) {
        state.records = state.records.concat([saved]);
        renderMedia(
          state,
          ui.mediaRefs.valueEl,
          ui.mediaRefs.detailEl
        );
        renderUltime(state, ui.ultimeRefs.listEl, ui.onDelete);
        // Reset del solo campo peso e delle note; data / ora / digiuno restano.
        refs.pesoInput.value = "";
        setFeedback(feedbackEl, t("view.peso.form.saved_ok"), "success");
        refs.submitBtn.disabled = false;
        // Autoclear del messaggio dopo 2.5s.
        global.setTimeout(function clearFeedback() {
          if (feedbackEl.getAttribute("data-state") === "success") {
            setFeedback(feedbackEl, "", "idle");
          }
        }, 2500);
      })
      .catch(function onErr(err) {
        if (global.console && global.console.error) {
          global.console.error("[peso] errore salvataggio:", err);
        }
        setFeedback(feedbackEl, t("view.peso.form.error"), "error");
        refs.submitBtn.disabled = false;
      });
  }

  function handleDelete(rec, state, ui, feedbackEl) {
    var Storage = global.MaranelloStorage;
    if (!Storage || typeof Storage.delete !== "function" || !rec || !rec.id) {
      return;
    }
    Storage.delete(STORE, rec.id, { origine: "utente" })
      .then(function onDone() {
        state.records = state.records.filter(function keep(r) {
          return r.id !== rec.id;
        });
        renderMedia(state, ui.mediaRefs.valueEl, ui.mediaRefs.detailEl);
        renderUltime(state, ui.ultimeRefs.listEl, ui.onDelete);
      })
      .catch(function onErr(err) {
        if (global.console && global.console.error) {
          global.console.error("[peso] errore eliminazione:", err);
        }
        setFeedback(feedbackEl, t("view.peso.form.error"), "error");
      });
  }

  function setFeedback(node, message, stato) {
    if (!node) return;
    node.textContent = message || "";
    node.setAttribute("data-state", stato || "idle");
  }

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  if (!global.MaranelloViews) {
    global.MaranelloViews = {};
  }
  global.MaranelloViews.Peso = renderPesoView;
})(typeof window !== "undefined" ? window : globalThis, document);
