/*
 * Maranello 2027 — App_HTML
 * File: js/modules/services/analisi-corsa.js
 *
 * Motore di analisi locale per le sessioni di corsa.
 * Genera testo in italiano basato su regole deterministiche sui dati
 * della sessione e sul confronto con le sessioni precedenti.
 *
 * Nessuna dipendenza esterna. Nessuna chiamata di rete.
 * Esposto su window.MaranelloAnalisiCorsa.
 */

(function initAnalisiCorsa(global) {
  "use strict";

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function formatMinSec(seconds) {
    if (!seconds || seconds <= 0) return "—";
    var m = Math.floor(seconds / 60);
    var s = Math.round(seconds % 60);
    return m + "'" + String(s).padStart(2, "0") + "\"";
  }

  function media(arr) {
    if (!arr || arr.length === 0) return null;
    return arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
  }

  function deviazione(arr) {
    var m = media(arr);
    if (m === null) return null;
    var variance = arr.reduce(function (acc, v) {
      return acc + Math.pow(v - m, 2);
    }, 0) / arr.length;
    return Math.sqrt(variance);
  }

  // Ritmo medio in sec/km dalla distanza e dal tempo totale
  function ritmoMedio(distanzaKm, tempiPerKm) {
    if (!Array.isArray(tempiPerKm) || tempiPerKm.length === 0) return null;
    var totale = tempiPerKm.reduce(function (a, b) { return a + b; }, 0);
    if (!distanzaKm || distanzaKm <= 0) return totale / tempiPerKm.length;
    return totale / distanzaKm;
  }

  // Tendenza dei tempi: positiva = accelerazione, negativa = rallentamento
  function tendenzaTempi(tempiPerKm) {
    if (!Array.isArray(tempiPerKm) || tempiPerKm.length < 2) return 0;
    var n = tempiPerKm.length;
    var primaMetà = tempiPerKm.slice(0, Math.floor(n / 2));
    var secondaMetà = tempiPerKm.slice(Math.ceil(n / 2));
    var mediaPrima = media(primaMetà);
    var mediaSeconda = media(secondaMetà);
    if (mediaPrima === null || mediaSeconda === null) return 0;
    return mediaPrima - mediaSeconda; // positivo = seconda metà più veloce
  }

  // ---------------------------------------------------------------------------
  // Analisi singola sessione
  // ---------------------------------------------------------------------------

  function analizzaSessione(rec) {
    var frasi = [];
    var tempi = Array.isArray(rec.tempiPerKm) ? rec.tempiPerKm : [];
    var distanza = rec.distanzaTotaleKm || 0;
    var rpe = rec.rpeSessione;
    var fc = rec.fcMedia;

    // --- Distanza ---
    if (distanza > 0) {
      frasi.push("Sessione di " + String(distanza).replace(".", ",") + " km.");
    }

    // --- Ritmo ---
    if (tempi.length > 0) {
      var ritmo = ritmoMedio(distanza, tempi);
      if (ritmo !== null) {
        frasi.push("Ritmo medio: " + formatMinSec(ritmo) + "/km.");
      }

      // Regolarità
      var dev = deviazione(tempi);
      if (dev !== null) {
        if (dev < 10) {
          frasi.push("Passo molto regolare tra i km (" + formatMinSec(dev) + " di variazione media): ottima costanza.");
        } else if (dev < 25) {
          frasi.push("Passo abbastanza regolare (" + formatMinSec(dev) + " di variazione media).");
        } else {
          frasi.push("Passo irregolare (" + formatMinSec(dev) + " di variazione media): normale nelle sessioni walk-run o su percorsi variabili.");
        }
      }

      // Tendenza
      var tend = tendenzaTempi(tempi);
      if (tempi.length >= 3) {
        if (tend > 15) {
          frasi.push("Buona progressione: hai accelerato nella seconda parte della sessione.");
        } else if (tend < -15) {
          frasi.push("Leggero rallentamento nella seconda parte: normale, soprattutto nelle prime settimane.");
        } else {
          frasi.push("Andatura sostanzialmente costante dall'inizio alla fine.");
        }
      }

      // Km più veloce e più lento
      if (tempi.length >= 2) {
        var minT = Math.min.apply(null, tempi);
        var maxT = Math.max.apply(null, tempi);
        var idxMin = tempi.indexOf(minT);
        var idxMax = tempi.indexOf(maxT);
        frasi.push(
          "Km più veloce: Km" + (idxMin + 1) + " (" + formatMinSec(minT) + "). " +
          "Km più lento: Km" + (idxMax + 1) + " (" + formatMinSec(maxT) + ")."
        );
      }
    }

    // --- FC ---
    if (fc != null) {
      if (fc < 115) {
        frasi.push("FC media " + fc + " bpm: zona di recupero attivo (Z1). Sessione molto leggera.");
      } else if (fc < 131) {
        frasi.push("FC media " + fc + " bpm: zona aerobica base (Z2). Intensità corretta per questa fase.");
      } else if (fc < 139) {
        frasi.push("FC media " + fc + " bpm: zona fondo medio (Z3). Leggermente sopra il target per questa fase, ma accettabile.");
      } else {
        frasi.push("FC media " + fc + " bpm: zona intensa (Z3+). Attenzione: supera il cap consigliato per questa fase di allenamento.");
      }
    }

    // --- RPE ---
    if (rpe != null) {
      if (rpe <= 4) {
        frasi.push("RPE " + rpe + ": sessione percepita come molto leggera. Ottimo per il recupero.");
      } else if (rpe <= 6) {
        frasi.push("RPE " + rpe + ": fatica nella norma per questa tipologia di sessione.");
      } else if (rpe <= 7) {
        frasi.push("RPE " + rpe + ": sessione impegnativa. Monitora come ti senti nelle prossime 24 ore.");
      } else {
        frasi.push("RPE " + rpe + ": sessione molto faticosa. Considera una giornata di recupero domani.");
      }
    }

    // --- Schema walk-run ---
    if (rec.schemaWalkRun) {
      var wr = rec.schemaWalkRun;
      var percCorsa = wr.corsaMetri && wr.cammMetri
        ? Math.round(wr.corsaMetri / (wr.corsaMetri + wr.cammMetri) * 100)
        : null;
      if (percCorsa !== null) {
        frasi.push(
          "Schema walk-run: " + wr.corsaMetri + "m corsa / " + wr.cammMetri + "m camminata per km (" + percCorsa + "% corsa)."
        );
      }
    }

    return frasi.join(" ");
  }

  // ---------------------------------------------------------------------------
  // Analisi comparativa con sessioni precedenti
  // ---------------------------------------------------------------------------

  function analizzaConfronto(rec, precedenti) {
    if (!Array.isArray(precedenti) || precedenti.length === 0) {
      return "Prima sessione registrata: non ci sono dati precedenti con cui confrontare. Questa diventa il tuo punto di partenza.";
    }

    var frasi = [];
    var tempi = Array.isArray(rec.tempiPerKm) ? rec.tempiPerKm : [];
    var distanza = rec.distanzaTotaleKm || 0;

    // Filtra solo sessioni complete con dati utili
    var precedentiValide = precedenti.filter(function (p) {
      return p.stato !== "Saltata" &&
        Array.isArray(p.tempiPerKm) && p.tempiPerKm.length > 0;
    });

    if (precedentiValide.length === 0) {
      return "Nessuna sessione precedente con dati di tempo disponibili per il confronto.";
    }

    frasi.push("Confronto con le " + precedentiValide.length + " sessioni precedenti:");

    // Ritmo medio attuale vs media precedenti
    var ritmoAttuale = ritmoMedio(distanza, tempi);
    var ritmiPrecedenti = precedentiValide.map(function (p) {
      return ritmoMedio(p.distanzaTotaleKm || 0, p.tempiPerKm);
    }).filter(function (r) { return r !== null; });

    if (ritmoAttuale !== null && ritmiPrecedenti.length > 0) {
      var ritmoMedPrec = media(ritmiPrecedenti);
      var delta = ritmoMedPrec - ritmoAttuale; // positivo = più veloce ora
      if (Math.abs(delta) < 5) {
        frasi.push("Ritmo in linea con la media precedente (" + formatMinSec(ritmoMedPrec) + "/km).");
      } else if (delta > 0) {
        frasi.push(
          "Ritmo migliorato di " + formatMinSec(Math.abs(delta)) + "/km rispetto alla media precedente (" + formatMinSec(ritmoMedPrec) + "/km). Buon segnale di progressione."
        );
      } else {
        frasi.push(
          "Ritmo di " + formatMinSec(Math.abs(delta)) + "/km più lento rispetto alla media precedente (" + formatMinSec(ritmoMedPrec) + "/km). Può dipendere da stanchezza, meteo o percorso."
        );
      }
    }

    // Distanza
    var distanzePrecedenti = precedentiValide
      .map(function (p) { return p.distanzaTotaleKm || 0; })
      .filter(function (d) { return d > 0; });
    if (distanza > 0 && distanzePrecedenti.length > 0) {
      var distMediaPrec = media(distanzePrecedenti);
      var deltaD = distanza - distMediaPrec;
      if (Math.abs(deltaD) > 0.3) {
        if (deltaD > 0) {
          frasi.push("Distanza superiore alla media precedente (" + String(Math.round(distMediaPrec * 10) / 10).replace(".", ",") + " km): volume in crescita.");
        } else {
          frasi.push("Distanza inferiore alla media precedente (" + String(Math.round(distMediaPrec * 10) / 10).replace(".", ",") + " km).");
        }
      } else {
        frasi.push("Distanza in linea con la media precedente.");
      }
    }

    // RPE
    var rpeAttuale = rec.rpeSessione;
    var rpiPrecedenti = precedentiValide
      .map(function (p) { return p.rpeSessione; })
      .filter(function (r) { return r != null; });
    if (rpeAttuale != null && rpiPrecedenti.length > 0) {
      var rpeMedPrec = media(rpiPrecedenti);
      var deltaRpe = rpeAttuale - rpeMedPrec;
      if (Math.abs(deltaRpe) < 0.5) {
        frasi.push("Fatica percepita (RPE " + rpeAttuale + ") in linea con la media precedente.");
      } else if (deltaRpe < 0) {
        frasi.push("Fatica percepita inferiore alla media (RPE " + rpeAttuale + " vs media " + Math.round(rpeMedPrec * 10) / 10 + "): stai migliorando l'adattamento.");
      } else {
        frasi.push("Fatica percepita superiore alla media (RPE " + rpeAttuale + " vs media " + Math.round(rpeMedPrec * 10) / 10 + ").");
      }
    }

    // Trend ultimi 3 ritmi
    if (ritmiPrecedenti.length >= 2 && ritmoAttuale !== null) {
      var ultimi3 = ritmiPrecedenti.slice(-2).concat([ritmoAttuale]);
      var tendTrend = ultimi3[0] - ultimi3[ultimi3.length - 1];
      if (tendTrend > 10) {
        frasi.push("Trend positivo nelle ultime sessioni: il ritmo sta migliorando progressivamente.");
      } else if (tendTrend < -10) {
        frasi.push("Trend in leggero peggioramento nelle ultime sessioni: normale in fasi di carico, monitora il recupero.");
      }
    }

    return frasi.join(" ");
  }

  // ---------------------------------------------------------------------------
  // Entry point principale
  // ---------------------------------------------------------------------------

  /**
   * Genera l'analisi completa per una sessione.
   * @param {object} rec - record sessione corrente
   * @param {Array}  tutteLeSessioni - tutte le sessioni (inclusa quella corrente)
   * @returns {{ singola: string, confronto: string }}
   */
  function genera(rec, tutteLeSessioni) {
    // Precedenti = sessioni con data < rec.data, ordinate per data
    var dataRec = rec.data ? new Date(rec.data).getTime() : 0;
    var precedenti = (tutteLeSessioni || [])
      .filter(function (p) {
        return p.id !== rec.id &&
          p.data &&
          new Date(p.data).getTime() < dataRec;
      })
      .sort(function (a, b) {
        return new Date(a.data).getTime() - new Date(b.data).getTime();
      });

    return {
      singola: analizzaSessione(rec),
      confronto: analizzaConfronto(rec, precedenti),
    };
  }

  // ---------------------------------------------------------------------------
  // Esposizione
  // ---------------------------------------------------------------------------

  global.MaranelloAnalisiCorsa = {
    genera: genera,
    analizzaSessione: analizzaSessione,
    analizzaConfronto: analizzaConfronto,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = global.MaranelloAnalisiCorsa;
  }
})(typeof window !== "undefined" ? window : globalThis);
