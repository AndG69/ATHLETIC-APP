/*
 * Maranello 2027 — App_HTML
 * File: js/modules/views/impostazioni.js
 *
 * View "Impostazioni": scheda parametri reale (Task 5).
 * Sostituisce il placeholder in app.js.
 *
 * Sezioni:
 *   1. Profilo soggetto
 *   2. Piano corsa
 *   3. Piano palestra
 *   4. Obiettivo
 *   5. Database
 *
 * Rotta: #/impostazioni
 *
 * Espone: window.MaranelloViews.Impostazioni
 *
 * Ref: Task 5
 */

(function initImpostazioniView(global, document) {
  "use strict";

  var STORE = "impostazioni";
  var KEY = "main";

  // Cadenza di default: 14 giorni (lun→dom × 2)
  // Sett 1: P-P-R-C-R-P-P  |  Sett 2: R-C-R-P-P-R-C
  var DEFAULT_CADENZA = ["P","P","R","C","R","P","P","R","C","R","P","P","R","C"];

  // Valori di default (profilo soggetto)
  var DEFAULT_IMPOSTAZIONI = {
    id: KEY,
    peso: 101,
    eta: 56,
    giorniPalestra: [1, 3],
    giorniCorsa: [6, 0],
    settimanaProgressione: 2,
    ultimaSedutaPalestra: { data: "2026-05-07", numeroCiclo: 4 },
    cadenza: DEFAULT_CADENZA,
    targetDistanza: "5km",
    dataGara: "",
    versioneApp: typeof global.APP_VERSION !== "undefined" ? global.APP_VERSION : "0.0.0",
  };

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
          key === "value" || key === "min" || key === "max" ||
          key === "step" || key === "inputmode" || key === "autocomplete" ||
          key === "placeholder" || key === "rows" || key === "disabled"
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

  function setFeedback(node, message, stato) {
    if (!node) return;
    node.textContent = message || "";
    node.setAttribute("data-state", stato || "idle");
  }

  // ---------------------------------------------------------------------------
  // Rendering principale
  // ---------------------------------------------------------------------------

  function renderImpostazioniView(params, mount) {
    var Storage = global.MaranelloStorage;

    mount.appendChild(el("h2", {
      class: "impostazioni-title",
      text: t("view.impostazioni.title"),
    }));

    var container = el("div", { class: "impostazioni-container" });
    mount.appendChild(container);

    // Carica impostazioni esistenti o usa i default
    var loadPromise = Storage && typeof Storage.get === "function"
      ? Storage.get(STORE, KEY)
      : Promise.resolve(null);

    loadPromise
      .then(function onLoaded(saved) {
        var impostazioni = mergeDefaults(saved, DEFAULT_IMPOSTAZIONI);
        renderSezioni(container, impostazioni, Storage);
      })
      .catch(function onErr() {
        renderSezioni(container, Object.assign({}, DEFAULT_IMPOSTAZIONI), Storage);
      });
  }

  function mergeDefaults(saved, defaults) {
    if (!saved) return Object.assign({}, defaults);
    var merged = Object.assign({}, defaults, saved);
    // Assicura che gli array siano array
    if (!Array.isArray(merged.giorniPalestra)) merged.giorniPalestra = defaults.giorniPalestra;
    if (!Array.isArray(merged.giorniCorsa)) merged.giorniCorsa = defaults.giorniCorsa;
    if (!Array.isArray(merged.cadenza) || merged.cadenza.length !== 14) merged.cadenza = defaults.cadenza;
    if (!merged.ultimaSedutaPalestra) merged.ultimaSedutaPalestra = defaults.ultimaSedutaPalestra;
    return merged;
  }

  function renderSezioni(container, impostazioni, Storage) {
    container.innerHTML = "";

    // 1. Profilo soggetto
    container.appendChild(buildSezioneProfiloSoggetto(impostazioni, Storage));

    // 2. Piano corsa
    container.appendChild(buildSezionePianoCorsa(impostazioni, Storage));

    // 3. Piano palestra
    container.appendChild(buildSezionePianoPalestra(impostazioni, Storage));

    // 3b. Cadenza bisettimanale
    container.appendChild(buildSezioneCadenza(impostazioni, Storage));

    // 4. Obiettivo
    container.appendChild(buildSezioneObiettivo(impostazioni, Storage));

    // 5. Database
    container.appendChild(buildSezioneDatabase(impostazioni, Storage));
  }

  // ---------------------------------------------------------------------------
  // Sezione 1: Profilo soggetto
  // ---------------------------------------------------------------------------

  function buildSezioneProfiloSoggetto(impostazioni, Storage) {
    var section = el("section", { class: "impostazioni-sezione" });
    section.appendChild(el("h3", { text: t("view.impostazioni.profilo.titolo") }));

    var feedback = el("p", { class: "impostazioni-feedback", "aria-live": "polite" });

    // Peso
    var pesoInput = el("input", {
      type: "number",
      id: "imp-peso",
      name: "peso",
      min: "40",
      max: "250",
      step: "0.1",
      value: String(impostazioni.peso || 101),
    });

    // Età
    var etaInput = el("input", {
      type: "number",
      id: "imp-eta",
      name: "eta",
      min: "18",
      max: "100",
      value: String(impostazioni.eta || 56),
    });

    // Giorni palestra
    var giorniPalestraSelect = el("select", {
      id: "imp-giorni-palestra",
      name: "giorniPalestra",
    });
    var opzioniGiorniPalestra = [
      { value: "1,3", label: t("view.impostazioni.profilo.lun_mer") },
      { value: "1,4", label: t("view.impostazioni.profilo.lun_gio") },
    ];
    var currentGiorniPalestra = (impostazioni.giorniPalestra || [1, 3]).join(",");
    opzioniGiorniPalestra.forEach(function (opt) {
      var option = el("option", { value: opt.value, text: opt.label });
      if (opt.value === currentGiorniPalestra) option.setAttribute("selected", "selected");
      giorniPalestraSelect.appendChild(option);
    });

    var form = el("form", { class: "impostazioni-form", novalidate: "novalidate" }, [
      el("div", { class: "impostazioni-field" }, [
        el("label", { for: "imp-peso", text: t("view.impostazioni.profilo.peso_label") }),
        pesoInput,
      ]),
      el("div", { class: "impostazioni-field" }, [
        el("label", { for: "imp-eta", text: t("view.impostazioni.profilo.eta_label") }),
        etaInput,
      ]),
      el("div", { class: "impostazioni-field" }, [
        el("label", { for: "imp-giorni-palestra", text: t("view.impostazioni.profilo.giorni_palestra_label") }),
        giorniPalestraSelect,
      ]),
      feedback,
      el("div", { class: "impostazioni-actions" }, [
        el("button", { type: "submit", class: "impostazioni-btn-salva", text: t("common.salva") }),
      ]),
    ]);

    form.addEventListener("submit", function onSubmit(ev) {
      ev.preventDefault();
      var peso = parseFloat(pesoInput.value);
      var eta = parseInt(etaInput.value, 10);
      var giorniPalestraVal = giorniPalestraSelect.value.split(",").map(Number);

      if (!isFinite(peso) || peso < 40 || peso > 250) {
        setFeedback(feedback, t("view.impostazioni.errore_peso"), "error");
        return;
      }
      if (!isFinite(eta) || eta < 18 || eta > 100) {
        setFeedback(feedback, t("view.impostazioni.errore_eta"), "error");
        return;
      }

      impostazioni.peso = peso;
      impostazioni.eta = eta;
      impostazioni.giorniPalestra = giorniPalestraVal;

      salvaImpostazioni(impostazioni, Storage, feedback);
    });

    section.appendChild(form);
    return section;
  }

  // ---------------------------------------------------------------------------
  // Sezione 2: Piano corsa
  // ---------------------------------------------------------------------------

  function buildSezionePianoCorsa(impostazioni, Storage) {
    var section = el("section", { class: "impostazioni-sezione" });
    section.appendChild(el("h3", { text: t("view.impostazioni.corsa.titolo") }));

    var feedback = el("p", { class: "impostazioni-feedback", "aria-live": "polite" });

    var settimanaInput = el("input", {
      type: "number",
      id: "imp-settimana",
      name: "settimanaProgressione",
      min: "1",
      max: "16",
      value: String(impostazioni.settimanaProgressione || 5),
    });

    var form = el("form", { class: "impostazioni-form", novalidate: "novalidate" }, [
      el("div", { class: "impostazioni-field" }, [
        el("label", { for: "imp-settimana", text: t("view.impostazioni.corsa.settimana_label") }),
        settimanaInput,
        el("small", { text: t("view.impostazioni.corsa.settimana_hint") }),
      ]),
      feedback,
      el("div", { class: "impostazioni-actions" }, [
        el("button", { type: "submit", class: "impostazioni-btn-salva", text: t("common.salva") }),
      ]),
    ]);

    form.addEventListener("submit", function onSubmit(ev) {
      ev.preventDefault();
      var settimana = parseInt(settimanaInput.value, 10);
      if (!isFinite(settimana) || settimana < 1 || settimana > 16) {
        setFeedback(feedback, t("view.impostazioni.errore_settimana"), "error");
        return;
      }
      impostazioni.settimanaProgressione = settimana;
      salvaImpostazioni(impostazioni, Storage, feedback);
    });

    section.appendChild(form);
    return section;
  }

  // ---------------------------------------------------------------------------
  // Sezione 3: Piano palestra
  // ---------------------------------------------------------------------------

  function buildSezionePianoPalestra(impostazioni, Storage) {
    var section = el("section", { class: "impostazioni-sezione" });
    section.appendChild(el("h3", { text: t("view.impostazioni.palestra.titolo") }));

    var feedback = el("p", { class: "impostazioni-feedback", "aria-live": "polite" });

    var ultimaSeduta = impostazioni.ultimaSedutaPalestra || { data: "2026-05-07", numeroCiclo: 4 };

    var dataInput = el("input", {
      type: "date",
      id: "imp-ultima-seduta-data",
      name: "ultimaSedutaData",
      value: ultimaSeduta.data || "",
    });

    var cicloInput = el("input", {
      type: "number",
      id: "imp-ultima-seduta-ciclo",
      name: "ultimaSedutaCiclo",
      min: "1",
      max: "8",
      value: String(ultimaSeduta.numeroCiclo || 3),
    });

    var form = el("form", { class: "impostazioni-form", novalidate: "novalidate" }, [
      el("div", { class: "impostazioni-field" }, [
        el("label", { for: "imp-ultima-seduta-data", text: t("view.impostazioni.palestra.ultima_data_label") }),
        dataInput,
      ]),
      el("div", { class: "impostazioni-field" }, [
        el("label", { for: "imp-ultima-seduta-ciclo", text: t("view.impostazioni.palestra.ultima_ciclo_label") }),
        cicloInput,
        el("small", { text: t("view.impostazioni.palestra.ciclo_hint") }),
      ]),
      feedback,
      el("div", { class: "impostazioni-actions" }, [
        el("button", { type: "submit", class: "impostazioni-btn-salva", text: t("common.salva") }),
      ]),
    ]);

    form.addEventListener("submit", function onSubmit(ev) {
      ev.preventDefault();
      var data = dataInput.value;
      var ciclo = parseInt(cicloInput.value, 10);

      if (!data) {
        setFeedback(feedback, t("view.impostazioni.errore_data"), "error");
        return;
      }
      if (!isFinite(ciclo) || ciclo < 1 || ciclo > 8) {
        setFeedback(feedback, t("view.impostazioni.errore_ciclo"), "error");
        return;
      }

      impostazioni.ultimaSedutaPalestra = { data: data, numeroCiclo: ciclo };
      salvaImpostazioni(impostazioni, Storage, feedback);
    });

    section.appendChild(form);
    return section;
  }

  // ---------------------------------------------------------------------------
  // Sezione 3b: Cadenza bisettimanale
  // ---------------------------------------------------------------------------

  function buildSezioneCadenza(impostazioni, Storage) {
    var section = el("section", { class: "impostazioni-sezione" });
    section.appendChild(el("h3", { text: t("view.impostazioni.cadenza.titolo") }));

    var feedback = el("p", { class: "impostazioni-feedback", "aria-live": "polite" });

    var cadenzaArray = impostazioni.cadenza || DEFAULT_CADENZA;
    var cadenzaStr = cadenzaArray.join("-");

    var cadenzaInput = el("input", {
      type: "text",
      id: "imp-cadenza",
      name: "cadenza",
      value: cadenzaStr,
      placeholder: "P-P-R-C-R-P-P-R-C-R-P-P-R-C",
    });

    var form = el("form", { class: "impostazioni-form", novalidate: "novalidate" }, [
      el("div", { class: "impostazioni-field" }, [
        el("label", { for: "imp-cadenza", text: t("view.impostazioni.cadenza.label") }),
        cadenzaInput,
        el("small", { text: t("view.impostazioni.cadenza.hint") }),
      ]),
      feedback,
      el("div", { class: "impostazioni-actions" }, [
        el("button", { type: "submit", class: "impostazioni-btn-salva", text: t("common.salva") }),
      ]),
    ]);

    form.addEventListener("submit", function onSubmit(ev) {
      ev.preventDefault();
      var raw = cadenzaInput.value.trim().toUpperCase();
      var parti = raw.split("-");
      if (parti.length !== 14) {
        setFeedback(feedback, t("view.impostazioni.cadenza.errore"), "error");
        return;
      }
      for (var i = 0; i < parti.length; i++) {
        var v = parti[i].trim();
        if (v !== "P" && v !== "C" && v !== "R") {
          setFeedback(feedback, t("view.impostazioni.cadenza.errore"), "error");
          return;
        }
        parti[i] = v;
      }
      impostazioni.cadenza = parti;
      salvaImpostazioni(impostazioni, Storage, feedback);
    });

    section.appendChild(form);
    return section;
  }

  // ---------------------------------------------------------------------------
  // Sezione 4: Obiettivo
  // ---------------------------------------------------------------------------

  function buildSezioneObiettivo(impostazioni, Storage) {
    var section = el("section", { class: "impostazioni-sezione" });
    section.appendChild(el("h3", { text: t("view.impostazioni.obiettivo.titolo") }));

    var feedback = el("p", { class: "impostazioni-feedback", "aria-live": "polite" });

    var targetSelect = el("select", {
      id: "imp-target-distanza",
      name: "targetDistanza",
    });
    var opzioniTarget = [
      { value: "5km", label: "5 km" },
      { value: "10km", label: "10 km" },
    ];
    opzioniTarget.forEach(function (opt) {
      var option = el("option", { value: opt.value, text: opt.label });
      if (opt.value === (impostazioni.targetDistanza || "5km")) {
        option.setAttribute("selected", "selected");
      }
      targetSelect.appendChild(option);
    });

    var dataGaraInput = el("input", {
      type: "date",
      id: "imp-data-gara",
      name: "dataGara",
      value: impostazioni.dataGara || "",
    });

    var form = el("form", { class: "impostazioni-form", novalidate: "novalidate" }, [
      el("div", { class: "impostazioni-field" }, [
        el("label", { for: "imp-target-distanza", text: t("view.impostazioni.obiettivo.target_label") }),
        targetSelect,
      ]),
      el("div", { class: "impostazioni-field" }, [
        el("label", { for: "imp-data-gara", text: t("view.impostazioni.obiettivo.data_gara_label") }),
        dataGaraInput,
        el("small", { text: t("view.impostazioni.obiettivo.data_gara_hint") }),
      ]),
      feedback,
      el("div", { class: "impostazioni-actions" }, [
        el("button", { type: "submit", class: "impostazioni-btn-salva", text: t("common.salva") }),
      ]),
    ]);

    form.addEventListener("submit", function onSubmit(ev) {
      ev.preventDefault();
      impostazioni.targetDistanza = targetSelect.value;
      impostazioni.dataGara = dataGaraInput.value || "";
      salvaImpostazioni(impostazioni, Storage, feedback);
    });

    section.appendChild(form);
    return section;
  }

  // ---------------------------------------------------------------------------
  // Sezione 5: Database
  // ---------------------------------------------------------------------------

  function buildSezioneDatabase(impostazioni, Storage) {
    var section = el("section", { class: "impostazioni-sezione" });
    section.appendChild(el("h3", { text: t("view.impostazioni.database.titolo") }));

    // Stato DB
    var dbState = global.__appDbState || { text: t("db.status.pending"), state: "pending" };
    var statusBadge = el("span", {
      class: "app-db-status",
      "data-testid": "settings-db-status",
      "data-state": dbState.state,
      text: dbState.text,
    });

    // Versione app
    var versionBadge = el("span", {
      class: "app-version-badge",
      "data-testid": "settings-version-badge",
      text: "v" + (global.APP_VERSION || "0.0.0"),
    });

    var meta = el("dl", { class: "impostazioni-meta" }, [
      el("dt", { text: t("view.impostazioni.stato_db") }),
      el("dd", {}, [statusBadge]),
      el("dt", { text: t("view.impostazioni.versione") }),
      el("dd", {}, [versionBadge]),
    ]);
    section.appendChild(meta);

    // Pulsante esporta backup
    var feedbackExport = el("p", { class: "impostazioni-feedback", "aria-live": "polite" });
    var btnExport = el("button", {
      type: "button",
      class: "impostazioni-btn-export",
      "data-testid": "impostazioni-btn-export",
      text: t("view.impostazioni.database.esporta_label"),
    });
    btnExport.addEventListener("click", function onExport() {
      esportaBackup(Storage, feedbackExport);
    });

    // Pulsante importa backup
    var btnImport = el("button", {
      type: "button",
      class: "impostazioni-btn-export",
      "data-testid": "impostazioni-btn-import",
      text: "📂 Importa backup JSON",
    });
    var inputFile = el("input", {
      type: "file",
      id: "impostazioni-import-file",
      "data-testid": "impostazioni-import-file",
    });
    inputFile.accept = ".json";
    inputFile.style.display = "none";

    btnImport.addEventListener("click", function () {
      inputFile.click();
    });
    inputFile.addEventListener("change", function () {
      if (!inputFile.files || inputFile.files.length === 0) return;
      var file = inputFile.files[0];
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var backup = JSON.parse(ev.target.result);
          importaBackup(Storage, backup, feedbackExport);
        } catch (err) {
          feedbackExport.textContent = "Errore: file JSON non valido.";
          feedbackExport.setAttribute("data-state", "error");
        }
      };
      reader.readAsText(file);
    });

    section.appendChild(el("div", { class: "impostazioni-actions" }, [btnExport, btnImport]));
    section.appendChild(inputFile);
    section.appendChild(feedbackExport);

    return section;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function salvaImpostazioni(impostazioni, Storage, feedbackEl) {
    if (!Storage || typeof Storage.put !== "function") {
      setFeedback(feedbackEl, t("view.impostazioni.errore_storage"), "error");
      return;
    }
    impostazioni.id = KEY;
    impostazioni._updatedAt = new Date().toISOString();

    Storage.put(STORE, impostazioni, { origine: "utente" })
      .then(function onSaved() {
        setFeedback(feedbackEl, t("view.impostazioni.salvato_ok"), "success");
        global.setTimeout(function () {
          if (feedbackEl.getAttribute("data-state") === "success") {
            setFeedback(feedbackEl, "", "idle");
          }
        }, 2500);
      })
      .catch(function onErr(err) {
        if (global.console && global.console.error) {
          global.console.error("[impostazioni] errore salvataggio:", err);
        }
        setFeedback(feedbackEl, t("view.impostazioni.errore_salvataggio"), "error");
      });
  }

  function esportaBackup(Storage, feedbackEl) {
    if (!Storage) {
      setFeedback(feedbackEl, t("view.impostazioni.errore_storage"), "error");
      return;
    }

    var stores = [
      "impostazioni", "piano_settimane", "sessioni_corsa",
      "sessioni_palestra", "peso", "allerte",
    ];

    var backup = { exportedAt: new Date().toISOString(), data: {} };
    var promises = stores.map(function (storeName) {
      return Storage.query(storeName)
        .then(function (rows) {
          backup.data[storeName] = rows;
        })
        .catch(function () {
          backup.data[storeName] = [];
        });
    });

    Promise.all(promises)
      .then(function () {
        var json = JSON.stringify(backup, null, 2);
        var blob = new Blob([json], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "maranello-backup-" + new Date().toISOString().slice(0, 10) + ".json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setFeedback(feedbackEl, t("view.impostazioni.database.esportato_ok"), "success");
      })
      .catch(function (err) {
        if (global.console && global.console.error) {
          global.console.error("[impostazioni] errore export:", err);
        }
        setFeedback(feedbackEl, t("view.impostazioni.errore_salvataggio"), "error");
      });
  }

  function importaBackup(Storage, backup, feedbackEl) {
    if (!Storage) {
      setFeedback(feedbackEl, t("view.impostazioni.errore_storage"), "error");
      return;
    }
    if (!backup || !backup.data) {
      setFeedback(feedbackEl, "File non valido: manca la sezione 'data'.", "error");
      return;
    }

    setFeedback(feedbackEl, "Importazione in corso...", "pending");

    var stores = Object.keys(backup.data);
    var promises = stores.map(function (storeName) {
      var rows = backup.data[storeName];
      if (!Array.isArray(rows)) return Promise.resolve();
      var rowPromises = rows.map(function (row) {
        if (!row) return Promise.resolve();
        return Storage.put(storeName, row, { origine: "import" }).catch(function () {});
      });
      return Promise.all(rowPromises);
    });

    Promise.all(promises)
      .then(function () {
        setFeedback(feedbackEl, "Backup importato con successo! Ricarica la pagina.", "success");
      })
      .catch(function (err) {
        if (global.console && global.console.error) {
          global.console.error("[impostazioni] errore import:", err);
        }
        setFeedback(feedbackEl, "Errore nell'importazione.", "error");
      });
  }

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  if (!global.MaranelloViews) {
    global.MaranelloViews = {};
  }
  global.MaranelloViews.Impostazioni = renderImpostazioniView;
})(typeof window !== "undefined" ? window : globalThis, document);
