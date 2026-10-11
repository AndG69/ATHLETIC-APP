/*
 * Maranello 2027 — App_HTML
 * File: js/modules/services/anagrafica-esercizi.js
 *
 * Servizio condiviso per l'ANAGRAFICA ESERCIZI.
 *
 * L'anagrafica esercizi è la fonte di verità per l'identità degli esercizi
 * (nome + gruppo muscolare + flag "tempo" per gli isometrici). Vive nel campo
 * `esercizi` del documento `programma_palestra` "main", accanto a `gruppi`
 * (elenco/ordine dei gruppi muscolari) e `sedute` (le schede template).
 *
 * Modello:
 *   programma.gruppi    : string[]                      // ordine gruppi (senza "Altro")
 *   programma.esercizi  : [{ nome, gruppo, tempo }]     // anagrafica (identità)
 *   programma.sedute[]  : { numeroCiclo, nome, esercizi:[{nome,gruppo,serie,
 *                           ripetizioni,carico,tempoSecondi}] }  // schede template
 *
 * Il campo `gruppo` sulle righe seduta è una copia denormalizzata risolta per
 * nome dall'anagrafica: le mutazioni qui sotto propagano a cascata su di esse.
 * Serie/ripetizioni/carico/tempoSecondi restano invece per-seduta (ultima
 * esecuzione), gestiti altrove.
 *
 * Tutte le funzioni di mutazione operano in-place sull'oggetto `programma`
 * passato e NON persistono: il chiamante salva con MaranelloStorage.put.
 *
 * Espone: window.MaranelloAnagraficaEsercizi  (+ module.exports per i test)
 */

(function initAnagraficaEsercizi(global) {
  "use strict";

  var GRUPPI_DEFAULT = [
    "Addominali", "Bicipiti", "Dorsali", "Gambe", "Glutei",
    "Lombari", "Pettorali", "Spalle", "Tricipiti",
  ];

  // Esercizi isometrici noti: usano un tempo (secondi) invece del carico.
  var ISOMETRICI_DEFAULT = { "Plank": true, "Plank laterale": true };

  function norm(s) { return String(s == null ? "" : s).trim(); }
  function key(s) { return norm(s).toLowerCase(); }
  function isAltro(g) { return key(g) === "altro"; }

  function getCatalog() { return global.MaranelloEserciziCatalog || null; }

  // ---------------------------------------------------------------------------
  // Lettura
  // ---------------------------------------------------------------------------

  /** Elenco ordinato dei gruppi: definiti dall'utente (o default) + quelli usati
   *  da anagrafica/sedute, con "Altro" sempre in coda. */
  function listaGruppi(programma) {
    var out = [];
    var seen = Object.create(null);
    function add(g) {
      g = norm(g);
      if (!g) return;
      var k = key(g);
      if (k === "altro" || seen[k]) return;
      seen[k] = true;
      out.push(g);
    }
    if (programma && Array.isArray(programma.gruppi) && programma.gruppi.length) {
      programma.gruppi.forEach(add);
    } else {
      GRUPPI_DEFAULT.forEach(add);
    }
    if (programma && Array.isArray(programma.esercizi)) {
      programma.esercizi.forEach(function (e) { if (e && e.gruppo) add(e.gruppo); });
    }
    if (programma && Array.isArray(programma.sedute)) {
      programma.sedute.forEach(function (s) {
        (s.esercizi || []).forEach(function (e) { if (e && e.gruppo) add(e.gruppo); });
      });
    }
    out.push("Altro");
    return out;
  }

  /** Copia dell'elenco esercizi anagrafica. */
  function listaEsercizi(programma) {
    if (programma && Array.isArray(programma.esercizi)) return programma.esercizi.slice();
    return [];
  }

  /** Trova l'oggetto esercizio anagrafica per nome (case-insensitive). */
  function trovaEsercizio(programma, nome) {
    var k = key(nome);
    var arr = (programma && programma.esercizi) || [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && key(arr[i].nome) === k) return arr[i];
    }
    return null;
  }

  /** Risolve il gruppo di un esercizio per nome: anagrafica → sedute → catalogo → "Altro". */
  function gruppoDi(programma, nome) {
    var e = trovaEsercizio(programma, nome);
    if (e && e.gruppo) return e.gruppo;
    if (programma && Array.isArray(programma.sedute)) {
      for (var i = 0; i < programma.sedute.length; i++) {
        var es = programma.sedute[i].esercizi || [];
        for (var j = 0; j < es.length; j++) {
          if (es[j] && key(es[j].nome) === key(nome) && es[j].gruppo) return es[j].gruppo;
        }
      }
    }
    var cat = getCatalog();
    if (cat && Array.isArray(cat.esercizi)) {
      for (var c = 0; c < cat.esercizi.length; c++) {
        if (key(cat.esercizi[c].nome) === key(nome)) return cat.esercizi[c].gruppo;
      }
    }
    return "Altro";
  }

  /** True se l'esercizio è a tempo (isometrico). */
  function isTempo(programma, nome) {
    var e = trovaEsercizio(programma, nome);
    if (e && typeof e.tempo === "boolean") return e.tempo;
    return !!ISOMETRICI_DEFAULT[norm(nome)];
  }

  /** Map<gruppo, Array<esercizio>> con tutti i gruppi (anche vuoti), esercizi
   *  ordinati per nome dentro ciascun gruppo. */
  function eserciziPerGruppo(programma) {
    var gruppi = listaGruppi(programma);
    var map = new Map();
    gruppi.forEach(function (g) { map.set(g, []); });
    listaEsercizi(programma).forEach(function (e) {
      if (!e || !e.nome) return;
      var g = norm(e.gruppo) || "Altro";
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(e);
    });
    map.forEach(function (arr) {
      arr.sort(function (a, b) { return key(a.nome) < key(b.nome) ? -1 : 1; });
    });
    return map;
  }

  function gruppoEsiste(programma, g) {
    return (programma.gruppi || []).some(function (x) { return key(x) === key(g); });
  }

  function assicuraGruppo(programma, g) {
    g = norm(g);
    if (!g || isAltro(g)) return;
    if (!Array.isArray(programma.gruppi)) programma.gruppi = [];
    if (!gruppoEsiste(programma, g)) programma.gruppi.push(g);
  }

  // ---------------------------------------------------------------------------
  // Inizializzazione / migrazione soft
  // ---------------------------------------------------------------------------

  /**
   * Garantisce che `programma.gruppi` e `programma.esercizi` esistano e siano
   * coerenti. Al primo passaggio semina l'anagrafica dall'unione del catalogo
   * statico e dei nomi già presenti nelle sedute. Ai passaggi successivi
   * NON riseminma dal catalogo (così le cancellazioni restano), ma continua a
   * fondere eventuali nuovi nomi comparsi nelle sedute (es. da registrazioni),
   * mantenendo l'anagrafica un superset delle schede.
   *
   * Ritorna true se ha modificato `programma` (il chiamante deve persistere).
   */
  function ensure(programma) {
    if (!programma) return false;
    var changed = false;

    if (!Array.isArray(programma.gruppi) || programma.gruppi.length === 0) {
      programma.gruppi = listaGruppi(programma).filter(function (g) { return !isAltro(g); });
      changed = true;
    }

    var primaInit = !Array.isArray(programma.esercizi);
    if (primaInit) {
      programma.esercizi = [];
      changed = true;
    }

    var seen = Object.create(null);
    programma.esercizi.forEach(function (e) { if (e && e.nome) seen[key(e.nome)] = true; });

    function addEserc(nome, gruppo, tempo) {
      nome = norm(nome);
      if (!nome) return;
      var k = key(nome);
      if (seen[k]) return;
      seen[k] = true;
      programma.esercizi.push({ nome: nome, gruppo: norm(gruppo) || "Altro", tempo: !!tempo });
      changed = true;
    }

    // Primo avvio: semina dal catalogo statico.
    if (primaInit) {
      var cat = getCatalog();
      if (cat && Array.isArray(cat.esercizi)) {
        cat.esercizi.forEach(function (e) {
          addEserc(e.nome, e.gruppo, !!ISOMETRICI_DEFAULT[norm(e.nome)]);
        });
      }
    }

    // Sempre: fonde i nomi presenti nelle sedute (superset).
    if (Array.isArray(programma.sedute)) {
      programma.sedute.forEach(function (s) {
        (s.esercizi || []).forEach(function (e) {
          if (e && e.nome) addEserc(e.nome, e.gruppo, e.tempoSecondi != null);
        });
      });
    }

    // Normalizza: ogni gruppo usato dagli esercizi dev'essere in programma.gruppi.
    listaEsercizi(programma).forEach(function (e) {
      var g = norm(e.gruppo);
      if (g && !isAltro(g) && !gruppoEsiste(programma, g)) {
        programma.gruppi.push(g);
        changed = true;
      }
    });

    return changed;
  }

  // ---------------------------------------------------------------------------
  // Mutazioni esercizi (con cascata sulle sedute template)
  // ---------------------------------------------------------------------------

  function aggiungiEsercizio(programma, nome, gruppo, tempo) {
    ensure(programma);
    nome = norm(nome);
    if (!nome) return { ok: false, motivo: "nome-vuoto" };
    if (trovaEsercizio(programma, nome)) return { ok: false, motivo: "duplicato" };
    var g = norm(gruppo) || "Altro";
    assicuraGruppo(programma, g);
    var e = { nome: nome, gruppo: g, tempo: !!tempo };
    programma.esercizi.push(e);
    return { ok: true, esercizio: e };
  }

  function rinominaEsercizio(programma, vecchio, nuovo) {
    ensure(programma);
    nuovo = norm(nuovo);
    if (!nuovo) return { ok: false, motivo: "nome-vuoto" };
    var e = trovaEsercizio(programma, vecchio);
    if (!e) return { ok: false, motivo: "non-trovato" };
    if (key(nuovo) !== key(e.nome) && trovaEsercizio(programma, nuovo)) {
      return { ok: false, motivo: "duplicato" };
    }
    var vecchioNome = e.nome;
    e.nome = nuovo;
    (programma.sedute || []).forEach(function (s) {
      (s.esercizi || []).forEach(function (r) {
        if (r && key(r.nome) === key(vecchioNome)) r.nome = nuovo;
      });
    });
    return { ok: true, esercizio: e };
  }

  function spostaEsercizio(programma, nome, nuovoGruppo) {
    ensure(programma);
    var e = trovaEsercizio(programma, nome);
    if (!e) return { ok: false, motivo: "non-trovato" };
    var g = norm(nuovoGruppo) || "Altro";
    assicuraGruppo(programma, g);
    e.gruppo = g;
    (programma.sedute || []).forEach(function (s) {
      (s.esercizi || []).forEach(function (r) {
        if (r && key(r.nome) === key(e.nome)) r.gruppo = g;
      });
    });
    return { ok: true, esercizio: e };
  }

  function impostaTempo(programma, nome, tempo) {
    ensure(programma);
    var e = trovaEsercizio(programma, nome);
    if (!e) return { ok: false, motivo: "non-trovato" };
    e.tempo = !!tempo;
    return { ok: true, esercizio: e };
  }

  function eliminaEsercizio(programma, nome) {
    ensure(programma);
    var k = key(nome);
    var prima = programma.esercizi.length;
    programma.esercizi = programma.esercizi.filter(function (e) {
      return !(e && key(e.nome) === k);
    });
    // Cascata: rimuove le righe dalle sedute template (non dallo storico).
    (programma.sedute || []).forEach(function (s) {
      if (Array.isArray(s.esercizi)) {
        s.esercizi = s.esercizi.filter(function (r) { return !(r && key(r.nome) === k); });
      }
    });
    return { ok: programma.esercizi.length < prima };
  }

  // ---------------------------------------------------------------------------
  // Mutazioni gruppi (con cascata)
  // ---------------------------------------------------------------------------

  function aggiungiGruppo(programma, nome) {
    ensure(programma);
    nome = norm(nome);
    if (!nome) return { ok: false, motivo: "nome-vuoto" };
    if (isAltro(nome)) return { ok: false, motivo: "riservato" };
    if (gruppoEsiste(programma, nome)) return { ok: false, motivo: "duplicato" };
    programma.gruppi.push(nome);
    return { ok: true };
  }

  function rinominaGruppo(programma, vecchio, nuovo) {
    ensure(programma);
    nuovo = norm(nuovo);
    if (!nuovo || isAltro(nuovo)) return { ok: false, motivo: "nome-non-valido" };
    if (isAltro(vecchio)) return { ok: false, motivo: "riservato" };
    if (key(nuovo) !== key(vecchio) && gruppoEsiste(programma, nuovo)) {
      return { ok: false, motivo: "duplicato" };
    }
    programma.gruppi = programma.gruppi.map(function (g) {
      return key(g) === key(vecchio) ? nuovo : g;
    });
    (programma.esercizi || []).forEach(function (e) {
      if (e && key(e.gruppo) === key(vecchio)) e.gruppo = nuovo;
    });
    (programma.sedute || []).forEach(function (s) {
      (s.esercizi || []).forEach(function (r) {
        if (r && key(r.gruppo) === key(vecchio)) r.gruppo = nuovo;
      });
    });
    return { ok: true };
  }

  /**
   * Elimina un gruppo: lo rimuove da programma.gruppi, CANCELLA i suoi esercizi
   * dall'anagrafica e, a cascata, le righe corrispondenti dalle sedute template.
   * Non tocca lo storico (sessioni_palestra) né le sessioni già programmate.
   */
  function eliminaGruppo(programma, nome) {
    ensure(programma);
    if (isAltro(nome)) return { ok: false, motivo: "riservato" };
    var k = key(nome);
    var nomiEliminati = (programma.esercizi || [])
      .filter(function (e) { return e && key(e.gruppo) === k; })
      .map(function (e) { return key(e.nome); });
    var nomiSet = Object.create(null);
    nomiEliminati.forEach(function (n) { nomiSet[n] = true; });

    programma.gruppi = (programma.gruppi || []).filter(function (g) { return key(g) !== k; });
    programma.esercizi = (programma.esercizi || []).filter(function (e) {
      return !(e && key(e.gruppo) === k);
    });
    (programma.sedute || []).forEach(function (s) {
      if (Array.isArray(s.esercizi)) {
        s.esercizi = s.esercizi.filter(function (r) {
          return !(r && (key(r.gruppo) === k || nomiSet[key(r.nome)]));
        });
      }
    });
    return { ok: true, eliminati: nomiEliminati.length };
  }

  /** Conta quante righe seduta (template) usano un dato esercizio per nome. */
  function usiNelleSedute(programma, nome) {
    var k = key(nome);
    var n = 0;
    (programma.sedute || []).forEach(function (s) {
      (s.esercizi || []).forEach(function (r) { if (r && key(r.nome) === k) n++; });
    });
    return n;
  }

  // ---------------------------------------------------------------------------
  // Esposizione
  // ---------------------------------------------------------------------------

  var api = {
    GRUPPI_DEFAULT: GRUPPI_DEFAULT,
    ISOMETRICI_DEFAULT: ISOMETRICI_DEFAULT,
    ensure: ensure,
    listaGruppi: listaGruppi,
    listaEsercizi: listaEsercizi,
    eserciziPerGruppo: eserciziPerGruppo,
    trovaEsercizio: trovaEsercizio,
    gruppoDi: gruppoDi,
    isTempo: isTempo,
    usiNelleSedute: usiNelleSedute,
    aggiungiEsercizio: aggiungiEsercizio,
    rinominaEsercizio: rinominaEsercizio,
    spostaEsercizio: spostaEsercizio,
    impostaTempo: impostaTempo,
    eliminaEsercizio: eliminaEsercizio,
    aggiungiGruppo: aggiungiGruppo,
    rinominaGruppo: rinominaGruppo,
    eliminaGruppo: eliminaGruppo,
  };

  global.MaranelloAnagraficaEsercizi = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
