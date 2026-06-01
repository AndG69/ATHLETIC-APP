/*
 * Maranello 2027 — App_HTML
 * File: js/modules/views/dashboard.js
 *
 * Vista Dashboard KPI: panoramica sintetica dello stato del piano con
 * 4 sezioni (Corsa, Palestra, Peso, Composito) e pulsante "Aggiorna KPI".
 *
 * Contratto router: funzione (params, mount) che popola `mount`.
 *
 * Ref: Req 16.1, 16.2, 16.4, 22.4.f, 23.3, 23.4
 */

(function initDashboardView(global, document) {
  "use strict";

  var Storage = global.MaranelloStorage;
  var SessioniUtils = global.MaranelloSessioniUtils;
  var PesoStats = global.MaranelloPesoStats;

  var MS_GIORNO = 24 * 60 * 60 * 1000;
  var PESO_INIZIALE = 101;
  var PESO_TARGET = 95;

  // ---------------------------------------------------------------------------
  // Helper DOM (allineato a js/app.js e altre view)
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
          key === "href" || key === "role" || key === "type" ||
          key === "id" || key === "datetime"
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

  // ---------------------------------------------------------------------------
  // Calcoli KPI
  // ---------------------------------------------------------------------------

  /** Formatta secondi in mm:ss. */
  function formatTempo(sec) {
    if (SessioniUtils && typeof SessioniUtils.formatTempoMinSec === "function") {
      return SessioniUtils.formatTempoMinSec(sec);
    }
    if (typeof sec !== "number" || !Number.isFinite(sec)) return "\u2014";
    var m = Math.floor(sec / 60);
    var s = Math.round(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  /** Calcola volume settimanale corsa (ultimi 7 giorni). */
  function calcolaVolumeSettimanale(sessioni) {
    var now = new Date();
    var limite = new Date(now.getTime() - 7 * MS_GIORNO);
    var totale = 0;
    for (var i = 0; i < sessioni.length; i++) {
      var s = sessioni[i];
      if (!s || !s.data) continue;
      var d = new Date(s.data);
      if (d.getTime() >= limite.getTime() && d.getTime() <= now.getTime()) {
        if (typeof s.distanzaTotaleKm === "number" && Number.isFinite(s.distanzaTotaleKm)) {
          totale += s.distanzaTotaleKm;
        }
      }
    }
    return totale;
  }

  /** Calcola ritmo medio delle ultime 4 settimane. */
  function calcolaRitmoMedio(sessioni) {
    var now = new Date();
    var limite = new Date(now.getTime() - 28 * MS_GIORNO);
    var sommaTempi = 0;
    var contaTempi = 0;
    for (var i = 0; i < sessioni.length; i++) {
      var s = sessioni[i];
      if (!s || !s.data || !Array.isArray(s.tempiPerKm)) continue;
      var d = new Date(s.data);
      if (d.getTime() < limite.getTime() || d.getTime() > now.getTime()) continue;
      for (var j = 0; j < s.tempiPerKm.length; j++) {
        var t = s.tempiPerKm[j];
        if (typeof t === "number" && Number.isFinite(t) && t > 0) {
          sommaTempi += t;
          contaTempi++;
        }
      }
    }
    if (contaTempi === 0) return null;
    return sommaTempi / contaTempi;
  }

  /** Calcola volume totale ultima seduta palestra. */
  function calcolaVolumePalestra(sessione) {
    if (!sessione || !Array.isArray(sessione.gruppi)) return 0;
    var totale = 0;
    for (var i = 0; i < sessione.gruppi.length; i++) {
      var g = sessione.gruppi[i];
      if (!g || !Array.isArray(g.esercizi)) continue;
      for (var j = 0; j < g.esercizi.length; j++) {
        var es = g.esercizi[j];
        if (!es) continue;
        var serie = typeof es.serie === "number" ? es.serie : 1;
        var reps = Array.isArray(es.ripetizioni) ? es.ripetizioni : [];
        var maxRep = 0;
        for (var k = 0; k < reps.length; k++) {
          var r = reps[k];
          if (typeof r === "number" && r > maxRep) maxRep = r;
        }
        var carico = typeof es.carico === "number" ? es.carico : 0;
        totale += serie * maxRep * carico;
      }
    }
    return totale;
  }

  /** Trova progressione carichi confrontando ultima e penultima sessione. */
  function calcolaProgressioneCarichi(sessioniPalestra) {
    if (!Array.isArray(sessioniPalestra) || sessioniPalestra.length === 0) return [];
    // Ordina per data desc
    var ordinate = sessioniPalestra.slice().sort(function(a, b) {
      return new Date(b.data).getTime() - new Date(a.data).getTime();
    });
    var ultima = ordinate[0];
    if (!ultima || !Array.isArray(ultima.gruppi)) return [];

    // Mappa esercizi dell'ultima seduta
    var risultati = [];
    for (var i = 0; i < ultima.gruppi.length; i++) {
      var g = ultima.gruppi[i];
      if (!g || !Array.isArray(g.esercizi)) continue;
      for (var j = 0; j < g.esercizi.length; j++) {
        var es = g.esercizi[j];
        if (!es || !es.nome) continue;
        var caricoAttuale = typeof es.carico === "number" ? es.carico : 0;
        var delta = null;

        // Cerca lo stesso esercizio nelle sessioni precedenti
        for (var k = 1; k < ordinate.length; k++) {
          var prev = ordinate[k];
          if (!prev || !Array.isArray(prev.gruppi)) continue;
          var trovato = trovaEsercizio(prev.gruppi, es.nome);
          if (trovato !== null) {
            delta = caricoAttuale - trovato;
            break;
          }
        }
        risultati.push({ nome: es.nome, carico: caricoAttuale, delta: delta });
      }
    }
    return risultati;
  }

  function trovaEsercizio(gruppi, nome) {
    for (var i = 0; i < gruppi.length; i++) {
      var g = gruppi[i];
      if (!g || !Array.isArray(g.esercizi)) continue;
      for (var j = 0; j < g.esercizi.length; j++) {
        var es = g.esercizi[j];
        if (es && es.nome === nome && typeof es.carico === "number") {
          return es.carico;
        }
      }
    }
    return null;
  }

  /** Conta sessioni palestra del mese corrente con stato "Completa". */
  function contaSeduteMese(sessioniPalestra) {
    var now = new Date();
    var meseCorrente = now.getMonth();
    var annoCorrente = now.getFullYear();
    var conta = 0;
    for (var i = 0; i < sessioniPalestra.length; i++) {
      var s = sessioniPalestra[i];
      if (!s || !s.data || s.stato !== "Completa") continue;
      var d = new Date(s.data);
      if (d.getMonth() === meseCorrente && d.getFullYear() === annoCorrente) {
        conta++;
      }
    }
    return conta;
  }

  /** Calcola media mobile peso 7gg. */
  function calcolaMediaPeso(pesate) {
    if (!PesoStats) return null;
    var info = PesoStats.calcolaMediaMobile7gg(pesate, new Date());
    return info && info.media !== null ? info.media : null;
  }

  /** Calcola proiezione target peso. */
  function calcolaProiezionePeso(pesate) {
    if (!Array.isArray(pesate) || pesate.length < 2) return null;
    // Ordina per data asc
    var ordinate = pesate.slice().sort(function(a, b) {
      return new Date(a.data).getTime() - new Date(b.data).getTime();
    });
    var prima = ordinate[0];
    var ultima = ordinate[ordinate.length - 1];
    if (!prima || !ultima) return null;

    var pesoInizio = prima.pesoKg || prima.peso;
    var pesoFine = ultima.pesoKg || ultima.peso;
    if (typeof pesoInizio !== "number" || typeof pesoFine !== "number") return null;

    var giorniTrascorsi = (new Date(ultima.data).getTime() - new Date(prima.data).getTime()) / MS_GIORNO;
    if (giorniTrascorsi <= 0) return null;

    var deltaPerGiorno = (pesoFine - pesoInizio) / giorniTrascorsi;
    if (deltaPerGiorno >= 0) return null; // Non in calo

    var kgDaPerdere = pesoFine - PESO_TARGET;
    if (kgDaPerdere <= 0) return { raggiunto: true };

    var giorniNecessari = Math.ceil(kgDaPerdere / Math.abs(deltaPerGiorno));
    var dataTarget = new Date(new Date(ultima.data).getTime() + giorniNecessari * MS_GIORNO);
    return { data: dataTarget, giorni: giorniNecessari };
  }

  /** Calcola badge "Piano in salute". */
  function calcolaPianoInSalute(sessioni, sessioniPalestra, pesate, pianoSettimane) {
    // Aderenza ≥ 80% (sessioni completate/programmate ultimi 30gg)
    var now = new Date();
    var limite30 = new Date(now.getTime() - 30 * MS_GIORNO);

    var completate = 0;
    var tutte = sessioni.concat(sessioniPalestra);
    for (var i = 0; i < tutte.length; i++) {
      var s = tutte[i];
      if (!s || !s.data) continue;
      var d = new Date(s.data);
      if (d.getTime() >= limite30.getTime() && d.getTime() <= now.getTime()) {
        if (s.stato === "Completa") completate++;
      }
    }

    // Conta programmate dai piani
    var programmate = 0;
    if (Array.isArray(pianoSettimane)) {
      for (var j = 0; j < pianoSettimane.length; j++) {
        var piano = pianoSettimane[j];
        if (piano && Array.isArray(piano.sessioniProgrammate)) {
          programmate += piano.sessioniProgrammate.length;
        }
      }
    }
    // Fallback: se non ci sono piani, usa le sessioni totali come stima
    if (programmate === 0) programmate = completate || 1;

    var aderenza = completate / programmate;

    // Peso stabile o in calo
    var pesoOk = true;
    if (Array.isArray(pesate) && pesate.length >= 2) {
      var ordPesate = pesate.slice().sort(function(a, b) {
        return new Date(a.data).getTime() - new Date(b.data).getTime();
      });
      var pesoRecente = ordPesate[ordPesate.length - 1].pesoKg || ordPesate[ordPesate.length - 1].peso;
      var pesoPrecedente = ordPesate[Math.max(0, ordPesate.length - 4)].pesoKg || ordPesate[Math.max(0, ordPesate.length - 4)].peso;
      if (typeof pesoRecente === "number" && typeof pesoPrecedente === "number") {
        pesoOk = pesoRecente <= pesoPrecedente + 0.5;
      }
    }

    // Nessun dolore ricorrente (≥3 sessioni con dolore ≥4)
    var doloreOk = true;
    var contaDolore = 0;
    for (var k = 0; k < sessioni.length; k++) {
      var sc = sessioni[k];
      if (!sc || !sc.data) continue;
      var dc = new Date(sc.data);
      if (dc.getTime() < limite30.getTime()) continue;
      if (Array.isArray(sc.dolori)) {
        for (var l = 0; l < sc.dolori.length; l++) {
          if (sc.dolori[l] && sc.dolori[l].intensita >= 4) {
            contaDolore++;
            break;
          }
        }
      }
    }
    if (contaDolore >= 3) doloreOk = false;

    return aderenza >= 0.8 && pesoOk && doloreOk;
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  function renderDashboard(params, mount) {
    var container = el("div", { class: "dashboard-view", "data-testid": "dashboard-view" });

    // Titolo
    container.appendChild(
      el("h2", { class: "view-title", text: "Dashboard KPI" })
    );

    // Pulsante Aggiorna
    var btnAggiorna = el("button", {
      type: "button",
      class: "dashboard-btn-aggiorna",
      "data-testid": "dashboard-aggiorna",
      text: "\uD83D\uDD04 Aggiorna KPI",
    });
    container.appendChild(btnAggiorna);

    // Sezioni placeholder
    var sezioneCorsa = el("section", {
      class: "dashboard-card",
      "data-testid": "dashboard-corsa",
      "aria-labelledby": "dashboard-corsa-title",
    });
    sezioneCorsa.appendChild(el("h3", { id: "dashboard-corsa-title", class: "dashboard-card-title", text: "\uD83C\uDFC3 Corsa" }));
    var corsaBody = el("div", { class: "dashboard-card-body" });
    sezioneCorsa.appendChild(corsaBody);

    var sezionePalestra = el("section", {
      class: "dashboard-card",
      "data-testid": "dashboard-palestra",
      "aria-labelledby": "dashboard-palestra-title",
    });
    sezionePalestra.appendChild(el("h3", { id: "dashboard-palestra-title", class: "dashboard-card-title", text: "\uD83C\uDFCB Palestra" }));
    var palestraBody = el("div", { class: "dashboard-card-body" });
    sezionePalestra.appendChild(palestraBody);

    var sezionePeso = el("section", {
      class: "dashboard-card",
      "data-testid": "dashboard-peso",
      "aria-labelledby": "dashboard-peso-title",
    });
    sezionePeso.appendChild(el("h3", { id: "dashboard-peso-title", class: "dashboard-card-title", text: "\u2696\uFE0F Peso" }));
    var pesoBody = el("div", { class: "dashboard-card-body" });
    sezionePeso.appendChild(pesoBody);

    var sezioneComposito = el("section", {
      class: "dashboard-card",
      "data-testid": "dashboard-composito",
      "aria-labelledby": "dashboard-composito-title",
    });
    sezioneComposito.appendChild(el("h3", { id: "dashboard-composito-title", class: "dashboard-card-title", text: "\uD83D\uDCCA Composito" }));
    var compositoBody = el("div", { class: "dashboard-card-body" });
    sezioneComposito.appendChild(compositoBody);

    container.appendChild(sezioneCorsa);
    container.appendChild(sezionePalestra);
    container.appendChild(sezionePeso);
    container.appendChild(sezioneComposito);

    mount.appendChild(container);

    var refs = {
      corsaBody: corsaBody,
      palestraBody: palestraBody,
      pesoBody: pesoBody,
      compositoBody: compositoBody,
    };

    // Carica dati e renderizza
    aggiornaKPI(refs);

    btnAggiorna.addEventListener("click", function() {
      btnAggiorna.textContent = "\u23F3 Aggiornamento...";
      btnAggiorna.disabled = true;
      aggiornaKPI(refs);
      global.setTimeout(function() {
        btnAggiorna.textContent = "\uD83D\uDD04 Aggiorna KPI";
        btnAggiorna.disabled = false;
      }, 1000);
    });
  }

  function aggiornaKPI(refs) {
    // Query tutti gli store necessari
    var datiCorsa = [];
    var datiPalestra = [];
    var datiPeso = [];
    var datiPiano = [];
    var datiImpostazioni = null;

    var pCorsa = queryStore("sessioni_corsa").then(function(rows) { datiCorsa = rows; });
    var pPalestra = queryStore("sessioni_palestra").then(function(rows) { datiPalestra = rows; });
    var pPeso = queryStore("peso").then(function(rows) { datiPeso = rows; });
    var pPiano = queryStore("piano_settimane").then(function(rows) { datiPiano = rows; });
    var pImpostazioni = getImpostazioni().then(function(imp) { datiImpostazioni = imp; });

    Promise.all([pCorsa, pPalestra, pPeso, pPiano, pImpostazioni])
      .then(function() {
        if (global.console && global.console.log) {
          global.console.log("[dashboard] KPI aggiornati — corsa:", datiCorsa.length,
            "palestra:", datiPalestra.length, "peso:", datiPeso.length);
        }
        renderSezioneCorsa(refs.corsaBody, datiCorsa, datiImpostazioni);
        renderSezionePalestra(refs.palestraBody, datiPalestra);
        renderSezionePeso(refs.pesoBody, datiPeso);
        renderSezioneComposito(refs.compositoBody, datiCorsa, datiPalestra, datiPeso, datiPiano);
      })
      .catch(function(err) {
        if (global.console && global.console.error) {
          global.console.error("[dashboard] errore aggiornamento KPI:", err);
        }
        refs.corsaBody.textContent = "Errore nel caricamento dati.";
      });
  }

  function queryStore(store) {
    var S = global.MaranelloStorage;
    if (!S || typeof S.query !== "function") {
      return Promise.resolve([]);
    }
    return S.query(store).then(function(rows) {
      return Array.isArray(rows) ? rows : [];
    }).catch(function() { return []; });
  }

  function getImpostazioni() {
    var S = global.MaranelloStorage;
    if (!S || typeof S.get !== "function") {
      return Promise.resolve(null);
    }
    return S.get("impostazioni", "main").catch(function() { return null; });
  }

  // ---------------------------------------------------------------------------
  // Sezione Corsa
  // ---------------------------------------------------------------------------

  function renderSezioneCorsa(body, sessioni, impostazioni) {
    body.innerHTML = "";

    // Progressione walk-run
    var settimana = impostazioni && impostazioni.settimanaProgressione
      ? impostazioni.settimanaProgressione : null;
    var progressioneText = "\u2014";
    if (settimana !== null) {
      // Cerca schema walk-run dall'ultima sessione con schema
      var schema = null;
      for (var i = sessioni.length - 1; i >= 0; i--) {
        if (sessioni[i] && sessioni[i].schemaWalkRun) {
          schema = sessioni[i].schemaWalkRun;
          break;
        }
      }
      if (schema) {
        progressioneText = "Settimana " + settimana + "/16 \u2014 " +
          schema.corsaMetri + "m corsa / " + schema.cammMetri + "m camm";
      } else {
        progressioneText = "Settimana " + settimana + "/16";
      }
    }

    body.appendChild(buildKpiRow("Progressione walk-run", progressioneText));

    // Volume settimanale
    var volume = calcolaVolumeSettimanale(sessioni);
    var volumeText = volume > 0
      ? volume.toFixed(1).replace(".", ",") + " km"
      : "\u2014";
    body.appendChild(buildKpiRow("Volume settimanale (7gg)", volumeText));

    // Ritmo medio
    var ritmo = calcolaRitmoMedio(sessioni);
    var ritmoText = ritmo !== null
      ? formatTempo(ritmo) + "/km"
      : "\u2014";
    body.appendChild(buildKpiRow("Ritmo medio (4 sett.)", ritmoText));
  }

  // ---------------------------------------------------------------------------
  // Sezione Palestra
  // ---------------------------------------------------------------------------

  function renderSezionePalestra(body, sessioni) {
    body.innerHTML = "";

    if (!sessioni || sessioni.length === 0) {
      body.appendChild(el("p", { class: "dashboard-no-data", text: "Nessun dato" }));
      return;
    }

    // Ordina per data desc
    var ordinate = sessioni.slice().sort(function(a, b) {
      return new Date(b.data).getTime() - new Date(a.data).getTime();
    });
    var ultima = ordinate[0];

    // Volume totale ultima seduta
    var volume = calcolaVolumePalestra(ultima);
    var volumeText = volume > 0 ? volume.toLocaleString("it-IT") + " kg" : "\u2014";
    body.appendChild(buildKpiRow("Volume ultima seduta", volumeText));

    // Progressione carichi
    var progressione = calcolaProgressioneCarichi(sessioni);
    if (progressione.length > 0) {
      var progContainer = el("div", { class: "dashboard-progressione" });
      progContainer.appendChild(el("p", { class: "dashboard-kpi-label", text: "Progressione carichi:" }));
      var lista = el("ul", { class: "dashboard-carichi-list" });
      for (var i = 0; i < progressione.length; i++) {
        var p = progressione[i];
        var deltaStr = "";
        if (p.delta !== null && p.delta !== 0) {
          deltaStr = " (" + (p.delta > 0 ? "+" : "") + p.delta + " kg)";
        }
        lista.appendChild(el("li", { text: p.nome + ": " + p.carico + " kg" + deltaStr }));
      }
      progContainer.appendChild(lista);
      body.appendChild(progContainer);
    }

    // Sedute nel mese
    var seduteMese = contaSeduteMese(sessioni);
    body.appendChild(buildKpiRow("Sedute nel mese", String(seduteMese)));
  }

  // ---------------------------------------------------------------------------
  // Sezione Peso
  // ---------------------------------------------------------------------------

  function renderSezionePeso(body, pesate) {
    body.innerHTML = "";

    if (!pesate || pesate.length === 0) {
      body.appendChild(el("p", { class: "dashboard-no-data", text: "Nessun dato" }));
      return;
    }

    // Ordina per data asc per trovare la prima pesata
    var ordinate = pesate.slice().sort(function(a, b) {
      return new Date(a.data).getTime() - new Date(b.data).getTime();
    });
    var primaPesata = ordinate[0];
    var pesoIniziale = primaPesata.pesoKg || primaPesata.peso || PESO_INIZIALE;

    // Media mobile 7gg
    var media = calcolaMediaPeso(pesate);
    var mediaText = media !== null
      ? media.toFixed(1).replace(".", ",") + " kg"
      : "\u2014";
    body.appendChild(buildKpiRow("Media mobile 7gg", mediaText));

    // Delta dal peso iniziale: ultimo peso - prima pesata
    var ultimaPesata = ordinate[ordinate.length - 1];
    var pesoAttuale = ultimaPesata.pesoKg || ultimaPesata.peso;
    if (typeof pesoAttuale === "number" && typeof pesoIniziale === "number") {
      var delta = pesoAttuale - pesoIniziale;
      var deltaText = (delta >= 0 ? "+" : "") + delta.toFixed(1).replace(".", ",") + " kg";
      body.appendChild(buildKpiRow(
        "Delta (" + pesoIniziale.toFixed(1).replace(".", ",") + " → " + pesoAttuale.toFixed(1).replace(".", ",") + " kg)",
        deltaText
      ));
    } else {
      body.appendChild(buildKpiRow("Delta dal peso iniziale", "\u2014"));
    }

    // Proiezione target
    var proiezione = calcolaProiezionePeso(pesate);
    var proiezioneText = "\u2014";
    if (proiezione) {
      if (proiezione.raggiunto) {
        proiezioneText = "Target raggiunto! \u2705";
      } else if (proiezione.data) {
        var mesi = Math.round(proiezione.giorni / 30);
        proiezioneText = "~" + proiezione.giorni + " giorni (~" + mesi + " mesi)";
      }
    } else if (media !== null) {
      proiezioneText = "Trend non in calo";
    }
    body.appendChild(buildKpiRow("Proiezione target " + PESO_TARGET + " kg", proiezioneText));
  }

  // ---------------------------------------------------------------------------
  // Sezione Composito
  // ---------------------------------------------------------------------------

  function renderSezioneComposito(body, sessioni, sessioniPalestra, pesate, pianoSettimane) {
    body.innerHTML = "";

    var inSalute = calcolaPianoInSalute(sessioni, sessioniPalestra, pesate, pianoSettimane);
    var badgeClass = inSalute ? "dashboard-badge-verde" : "dashboard-badge-rosso";
    var badgeText = inSalute ? "\u2705 Piano in salute" : "\u274C Piano in difficolt\u00E0";

    var badge = el("span", { class: "dashboard-badge " + badgeClass, "data-testid": "dashboard-badge-salute", text: badgeText });
    body.appendChild(badge);

    // Dettagli criteri
    var dettagli = el("p", { class: "dashboard-composito-dettaglio" });
    dettagli.textContent = inSalute
      ? "Aderenza \u2265 80%, peso stabile/in calo, nessun dolore ricorrente."
      : "Uno o pi\u00F9 criteri non soddisfatti. Controlla le sezioni sopra.";
    body.appendChild(dettagli);
  }

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------

  function buildKpiRow(label, value) {
    return el("div", { class: "dashboard-kpi-row" }, [
      el("span", { class: "dashboard-kpi-label", text: label }),
      el("span", { class: "dashboard-kpi-value", text: value }),
    ]);
  }

  // ---------------------------------------------------------------------------
  // Esposizione globale
  // ---------------------------------------------------------------------------

  if (!global.MaranelloViews) {
    global.MaranelloViews = {};
  }
  global.MaranelloViews.Dashboard = renderDashboard;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { renderDashboard: renderDashboard };
  }
})(typeof window !== "undefined" ? window : globalThis, document);
