/*
 * Maranello 2027 — App_HTML
 * File: js/i18n/it.js
 *
 * i18n baseline italiano. Espone window.I18n con:
 *   - locale: codice lingua ("it")
 *   - dict:   dizionario chiave -> stringa
 *   - t(key, params): lookup con sostituzione token {nome}
 *
 * Il formato dei token è `{nome}`; i parametri non trovati vengono lasciati
 * invariati (facilita il debug).  Chiavi mancanti ritornano la chiave stessa
 * e stampano un warning in console (utile in sviluppo, innocuo in
 * produzione perché l'app è comunque in italiano).
 *
 * Tutti i testi user-facing devono passare da t() — Req 17.3, 24.2.
 */

(function initI18nIt(global) {
  "use strict";

  var DICT = {
    // ---- App shell --------------------------------------------------
    "app.title": "Programma sportivo",
    "app.subtitle": "5 km \u2192 10 km stretch",

    // ---- Navigazione ------------------------------------------------
    "nav.aria_label": "Navigazione principale",
    "nav.oggi": "Oggi",
    "nav.settimana": "Settimana",
    "nav.diario_corsa": "Corsa",
    "nav.diario_corsa.full": "Diario corsa",
    "nav.diario_palestra": "Palestra",
    "nav.diario_palestra.full": "Diario palestra",
    "nav.peso": "Peso",
    "nav.dashboard": "KPI",
    "nav.dashboard.full": "Dashboard",
    "nav.allerte": "Allerte",
    "nav.impostazioni": "Impostazioni",
    "nav.impostazioni.aria": "Impostazioni",
    "nav.schede": "Schede",

    // ---- Stato DB ---------------------------------------------------
    "db.status.pending": "DB in apertura\u2026",
    "db.status.ready": "DB pronto",
    "db.status.error": "DB non disponibile",

    // ---- Viste (placeholder in attesa delle implementazioni reali) --
    "view.oggi.title": "Oggi",
    "view.oggi.placeholder": "La sessione del giorno apparir\u00E0 qui.",
    "view.oggi.session_default": "Sessione del giorno",
    "view.oggi.fase_label": "Fase",
    "view.oggi.durata_label": "Durata",
    "view.oggi.zona_fc_label": "Zona FC",
    "view.oggi.rpe_label": "RPE",
    "view.oggi.micro_label": "Alternativa Micro",
    "view.oggi.micro_default": "15 min a RPE \u2264 5",
    "view.oggi.five_minute_title": "Regola dei 5 minuti",
    "view.oggi.five_minute_testo":
      "Ti impegni solo ai primi 5 minuti. Dopo decidi.",
    "view.oggi.actions.inizia": "Inizia",
    "view.oggi.actions.micro": "Micro",
    "view.oggi.actions.salta": "Salta",
    "view.oggi.empty_title": "Nessuna sessione programmata per oggi",
    "view.oggi.empty_desc":
      "Il piano settimanale non \u00E8 ancora stato generato. Puoi registrare una sessione dal diario.",
    "view.oggi.empty_cta_corsa": "Vai al diario corsa",
    "view.oggi.empty_cta_palestra": "Vai al diario palestra",
    "view.oggi.salta.prompt_title": "Perch\u00E9 salti la sessione?",
    "view.oggi.salta.options.lavoro": "Lavoro",
    "view.oggi.salta.options.famiglia": "Famiglia",
    "view.oggi.salta.options.salute": "Salute",
    "view.oggi.salta.options.stanchezza": "Stanchezza",
    "view.oggi.salta.options.pigrizia": "Pigrizia",
    "view.oggi.salta.options.altro": "Altro",
    "view.oggi.salta.note_label": "Nota (opzionale)",
    "view.oggi.salta.conferma": "Conferma salto",
    "view.oggi.salta.saved": "Sessione registrata come saltata",
    "view.oggi.salta.error":
      "Errore nella registrazione del salto. Riprova.",
    "view.oggi.micro.saved": "Micro_Sessione registrata",
    "view.oggi.micro.error":
      "Errore nella registrazione della Micro_Sessione. Riprova.",
    "view.oggi.timer.title": "Sessione in corso",
    "view.oggi.timer.five_rule_remaining":
      "Regola dei 5 minuti: ancora {s} sec",
    "view.oggi.timer.five_rule_passed":
      "Puoi fermarti ora (Micro) o continuare (Completa)",
    "view.oggi.timer.termina_micro": "Termina Micro",
    "view.oggi.timer.termina_completa": "Termina Completa",
    "view.oggi.timer.annulla": "Annulla sessione",
    "view.oggi.timer.annulla_conferma":
      "Annullare la sessione senza registrarla?",
    "view.oggi.session_saved": "Sessione completata e registrata",
    "view.oggi.session_error":
      "Errore nel salvataggio della sessione. Riprova.",
    "view.oggi.session_summary": "Durata: {min} min \u2014 stato: {stato}",
    "view.settimana.title": "Settimana",
    "view.settimana.placeholder": "Calendario della settimana corrente.",
    "view.diario_corsa.title": "Diario corsa",
    "view.diario_corsa.placeholder": "Storico delle sessioni di corsa.",
    "view.diario_palestra.title": "Diario palestra",
    "view.diario_palestra.placeholder": "Storico delle sessioni di palestra.",
    "view.diario_corsa.placeholder_legacy": "Storico delle sessioni di corsa.",
    "view.diario_palestra.placeholder_legacy": "Storico delle sessioni di palestra.",
    "view.peso.title": "Peso",
    "view.peso.placeholder":
      "Inserimento pesate e traiettoria verso il peso target.",
    "view.peso.form.titolo": "Nuova pesata",
    "view.peso.form.peso_label": "Peso (kg)",
    "view.peso.form.peso_hint": "Inserisci con un decimale (es. 100,5)",
    "view.peso.form.data_label": "Data",
    "view.peso.form.ora_label": "Ora del giorno",
    "view.peso.form.ora_mattina": "Mattina",
    "view.peso.form.ora_sera": "Sera",
    "view.peso.form.digiuno_label": "A digiuno",
    "view.peso.form.note_label": "Note (opzionale)",
    "view.peso.form.submit": "Salva pesata",
    "view.peso.form.saved_ok": "Pesata salvata",
    "view.peso.form.error":
      "Errore nel salvataggio. Riprova.",
    "view.peso.form.error_peso":
      "Peso non valido. Inserisci un valore tra 40,0 e 250,0 kg.",
    "view.peso.form.error_data": "Seleziona una data valida.",
    "view.peso.media_titolo": "Media mobile 7 giorni",
    "view.peso.media_nessun_dato":
      "Nessuna pesata negli ultimi 7 giorni.",
    "view.peso.media_dettaglio": "{n} pesate usate per la media",
    "view.peso.media_valore": "{valore} kg",
    "view.peso.ultime_titolo": "Ultime pesate",
    "view.peso.ultime_nessuna":
      "Non hai ancora registrato pesate.",
    "view.peso.ultime_elimina": "Elimina",
    "view.peso.ultime_elimina_conferma":
      "Eliminare la pesata del {data}?",
    "view.peso.digiuno_si": "digiuno",
    "view.peso.digiuno_no": "non digiuno",
    "view.dashboard.title": "Dashboard",
    "view.dashboard.placeholder":
      "KPI settimanali, benchmark tempo gara, stato Gate.",
    "view.allerte.title": "Allerte",
    "view.allerte.placeholder":
      "Segnali di sicurezza attivi e storico degli eventi.",
    "view.impostazioni.title": "Impostazioni",
    "view.impostazioni.placeholder":
      "Target distanza, data gara, preferenze, versione app.",
    "view.impostazioni.stato_db": "Stato database locale",
    "view.impostazioni.versione": "Versione app",

    // ---- Footer / metadati -----------------------------------------
    "footer.version": "Versione {v}",
    "footer.local_only": "App locale \u2014 nessun dato lascia il dispositivo.",

    // ---- Form corsa (Task 7) ---------------------------------------
    "view.form_corsa.titolo": "Nuova sessione di corsa",
    "view.form_corsa.titolo_modifica": "Modifica sessione di corsa",
    "view.form_corsa.data_label": "Data",
    "view.form_corsa.distanza_label": "Distanza totale (km)",
    "view.form_corsa.distanza_hint":
      "Usa il punto o la virgola (es. 5,2 oppure 5.2).",
    "view.form_corsa.tempi_label": "Tempi per km (mm:ss)",
    "view.form_corsa.tempi_hint":
      "Un tempo per ogni km. Formato mm:ss (es. 7:30).",
    "view.form_corsa.tempi_km": "km {n}",
    "view.form_corsa.fc_media_label": "FC media (bpm)",
    "view.form_corsa.fc_picco_label": "FC picco (bpm)",
    "view.form_corsa.rpe_label": "RPE (1-10)",
    "view.form_corsa.sonno_label": "Sonno notte precedente (1-5)",
    "view.form_corsa.risvegli_label": "Risvegli notturni",
    "view.form_corsa.idratazione_label": "Idratazione (litri)",
    "view.form_corsa.dolori_sede_label": "Dolori \u2014 sede",
    "view.form_corsa.dolori_intensita_label":
      "Dolori \u2014 intensit\u00E0 (0-10)",
    "view.form_corsa.dolori_hint":
      "Separa pi\u00F9 voci con virgola; sede e intensit\u00E0 devono avere lo stesso numero di elementi.",
    "view.form_corsa.walkrun_toggle": "Era una sessione walk-run",
    "view.form_corsa.walkrun_camm": "Camminata (m/km)",
    "view.form_corsa.walkrun_corsa": "Corsa (m/km)",
    "view.form_corsa.walkrun_rip": "Ripetizioni (km)",
    "view.form_corsa.stato_label": "Stato sessione",
    "view.form_corsa.stato_completa": "Completa",
    "view.form_corsa.stato_micro": "Micro",
    "view.form_corsa.altri_dati": "Altri dati (opzionale)",
    "view.form_corsa.note_label": "Note",
    "view.form_corsa.submit": "Salva sessione",
    "view.form_corsa.submit_modifica": "Aggiorna sessione",
    "view.form_corsa.saved_ok": "Sessione salvata",
    "view.form_corsa.saved_updated": "Sessione aggiornata",
    "view.form_corsa.error_distanza":
      "La distanza deve essere un numero positivo.",
    "view.form_corsa.error_tempi":
      "Inserisci almeno un tempo nel formato mm:ss.",
    "view.form_corsa.error_rpe": "RPE deve essere un intero tra 1 e 10.",
    "view.form_corsa.error_fc":
      "FC deve essere un numero tra 40 e 220 bpm.",
    "view.form_corsa.error_sonno":
      "Sonno deve essere un intero tra 1 e 5.",
    "view.form_corsa.error_walkrun":
      "I valori walk-run devono essere numeri positivi.",
    "view.form_corsa.error": "Errore nel salvataggio. Riprova.",
    "view.form_corsa.load_error":
      "Impossibile caricare la sessione da modificare.",
    "view.form_corsa.indietro": "Torna al diario",

    // ---- Form palestra (Task 8) ------------------------------------
    "view.form_palestra.titolo": "Nuova sessione di palestra",
    "view.form_palestra.titolo_modifica": "Modifica sessione di palestra",
    "view.form_palestra.data_label": "Data",
    "view.form_palestra.stato_label": "Stato sessione",
    "view.form_palestra.stato_completa": "Completa",
    "view.form_palestra.stato_micro": "Micro",
    "view.form_palestra.esercizi_titolo": "Esercizi svolti",
    "view.form_palestra.esercizio_gruppo_label": "Gruppo",
    "view.form_palestra.esercizio_nome_label": "Esercizio",
    "view.form_palestra.esercizio_altro": "Altro\u2026",
    "view.form_palestra.esercizio_altro_placeholder": "Nome esercizio",
    "view.form_palestra.esercizio_serie_label": "Serie",
    "view.form_palestra.esercizio_rip_label": "Ripetizioni",
    "view.form_palestra.esercizio_rip_hint":
      "Un numero o una lista per serie (es. 10 oppure 10,10,9,8).",
    "view.form_palestra.esercizio_carico_label": "Carico (kg)",
    "view.form_palestra.esercizio_rimuovi": "Rimuovi",
    "view.form_palestra.esercizio_aggiungi": "Aggiungi esercizio",
    "view.form_palestra.tapis_titolo": "Tapis finale (opzionale)",
    "view.form_palestra.tapis_minuti_label": "Minuti tapis",
    "view.form_palestra.tapis_pendenza_label": "Pendenza max (%)",
    "view.form_palestra.rpe_label": "RPE seduta (1-10)",
    "view.form_palestra.dolori_sede_label": "Dolori \u2014 sede",
    "view.form_palestra.dolori_intensita_label":
      "Dolori \u2014 intensit\u00E0 (0-10)",
    "view.form_palestra.note_label": "Note",
    "view.form_palestra.submit": "Salva sessione",
    "view.form_palestra.submit_modifica": "Aggiorna sessione",
    "view.form_palestra.saved_ok": "Sessione salvata",
    "view.form_palestra.saved_updated": "Sessione aggiornata",
    "view.form_palestra.error_no_esercizi":
      "Aggiungi almeno un esercizio eseguito.",
    "view.form_palestra.error_esercizio_nome":
      "Ogni esercizio deve avere un nome.",
    "view.form_palestra.error_serie":
      "Le serie devono essere un intero tra 1 e 20.",
    "view.form_palestra.error_rpe": "RPE deve essere un intero tra 1 e 10.",
    "view.form_palestra.error": "Errore nel salvataggio. Riprova.",
    "view.form_palestra.load_error":
      "Impossibile caricare la sessione da modificare.",
    "view.form_palestra.indietro": "Torna al diario",

    // ---- Diario corsa (Task 12) ------------------------------------
    "view.diario_corsa.titolo": "Diario corsa",
    "view.diario_corsa.nuova": "Nuova sessione",
    "view.diario_corsa.filtro_periodo_label": "Periodo",
    "view.diario_corsa.filtro_periodo_7": "Ultimi 7 giorni",
    "view.diario_corsa.filtro_periodo_30": "Ultimi 30 giorni",
    "view.diario_corsa.filtro_periodo_tutto": "Tutto",
    "view.diario_corsa.filtro_stato_label": "Stato",
    "view.diario_corsa.filtro_stato_tutti": "Tutti",
    "view.diario_corsa.filtro_stato_completa": "Completa",
    "view.diario_corsa.filtro_stato_micro": "Micro",
    "view.diario_corsa.filtro_stato_saltata": "Saltata",
    "view.diario_corsa.vuoto":
      "Nessuna sessione nel periodo selezionato.",
    "view.diario_corsa.primo_inserimento":
      "Aggiungi la tua prima sessione",
    "view.diario_corsa.riga_distanza": "{km} km",
    "view.diario_corsa.riga_tempo": "Tempo {tempo}",
    "view.diario_corsa.riga_fc": "FC {bpm}",
    "view.diario_corsa.riga_rpe": "RPE {rpe}",
    "view.diario_corsa.riga_dolori_n": "{n} dolori",
    "view.diario_corsa.dettaglio_distanza": "Distanza",
    "view.diario_corsa.dettaglio_tempo_totale": "Tempo totale",
    "view.diario_corsa.dettaglio_tempi_km": "Tempi per km",
    "view.diario_corsa.dettaglio_fc_media": "FC media",
    "view.diario_corsa.dettaglio_fc_picco": "FC picco",
    "view.diario_corsa.dettaglio_rpe": "RPE",
    "view.diario_corsa.dettaglio_sonno": "Sonno notte prec.",
    "view.diario_corsa.dettaglio_risvegli": "Risvegli notturni",
    "view.diario_corsa.dettaglio_idratazione": "Idratazione",
    "view.diario_corsa.dettaglio_dolori": "Dolori",
    "view.diario_corsa.dettaglio_walkrun": "Walk-run",
    "view.diario_corsa.dettaglio_walkrun_fmt":
      "{camm} m camminata / {corsa} m corsa, x{rip}",
    "view.diario_corsa.dettaglio_motivazione": "Motivazione salto",
    "view.diario_corsa.dettaglio_note": "Note",
    "view.diario_corsa.modifica": "Modifica",
    "view.diario_corsa.elimina": "Elimina",
    "view.diario_corsa.elimina_conferma":
      "Eliminare la sessione del {data}?",
    "view.diario_corsa.eliminata_ok": "Sessione eliminata",
    "view.diario_corsa.errore_generico": "Operazione non riuscita. Riprova.",
    "view.diario_corsa.load_error":
      "Impossibile caricare le sessioni. Riprova.",

    // ---- Diario palestra (Task 13) ---------------------------------
    "view.diario_palestra.titolo": "Diario palestra",
    "view.diario_palestra.nuova": "Nuova sessione",
    "view.diario_palestra.filtro_periodo_label": "Periodo",
    "view.diario_palestra.filtro_periodo_7": "Ultimi 7 giorni",
    "view.diario_palestra.filtro_periodo_30": "Ultimi 30 giorni",
    "view.diario_palestra.filtro_periodo_tutto": "Tutto",
    "view.diario_palestra.filtro_stato_label": "Stato",
    "view.diario_palestra.filtro_stato_tutti": "Tutti",
    "view.diario_palestra.filtro_stato_completa": "Completa",
    "view.diario_palestra.filtro_stato_micro": "Micro",
    "view.diario_palestra.filtro_stato_saltata": "Saltata",
    "view.diario_palestra.vuoto":
      "Nessuna sessione nel periodo selezionato.",
    "view.diario_palestra.primo_inserimento":
      "Aggiungi la tua prima sessione",
    "view.diario_palestra.settimana_header":
      "Settimana {id} (dal {da} al {a})",
    "view.diario_palestra.settimana_conteggio":
      "{n} sessioni",
    "view.diario_palestra.riga_gruppi_n": "{n} gruppi",
    "view.diario_palestra.riga_esercizi_n": "{n} esercizi",
    "view.diario_palestra.riga_rpe": "RPE {rpe}",
    "view.diario_palestra.tabella_gruppo": "Gruppo",
    "view.diario_palestra.tabella_esercizio": "Esercizio",
    "view.diario_palestra.tabella_serie": "Serie",
    "view.diario_palestra.tabella_ripetizioni": "Ripetizioni",
    "view.diario_palestra.tabella_carico": "Carico (kg)",
    "view.diario_palestra.dettaglio_tapis": "Tapis",
    "view.diario_palestra.dettaglio_tapis_fmt":
      "{min} min, pendenza max {pend}%",
    "view.diario_palestra.dettaglio_rpe": "RPE seduta",
    "view.diario_palestra.dettaglio_dolori": "Dolori",
    "view.diario_palestra.dettaglio_motivazione": "Motivazione salto",
    "view.diario_palestra.dettaglio_note": "Note",
    "view.diario_palestra.modifica": "Modifica",
    "view.diario_palestra.elimina": "Elimina",
    "view.diario_palestra.elimina_conferma":
      "Eliminare la sessione del {data}?",
    "view.diario_palestra.eliminata_ok": "Sessione eliminata",
    "view.diario_palestra.errore_generico":
      "Operazione non riuscita. Riprova.",
    "view.diario_palestra.load_error":
      "Impossibile caricare le sessioni. Riprova.",

    // ---- Generici --------------------------------------------------
    "common.loading": "Caricamento in corso\u2026",
    "common.separator": " \u2022 ",
    "common.espandi": "Mostra dettagli",
    "common.comprimi": "Nascondi dettagli",
    "common.modifica": "Modifica",
    "common.elimina": "Elimina",
    "common.salva": "Salva",
    "common.annulla": "Annulla",
    "common.nessun_dato": "\u2014",
    "common.si": "S\u00EC",
    "common.no": "No",

    // ---- Vista Settimana (Task 3) -----------------------------------
    "view.settimana.header_settimana": "Settimana {lun} \u2014 {dom} {anno}",
    "view.settimana.settimana_prec": "Settimana precedente",
    "view.settimana.settimana_succ": "Settimana successiva",
    "view.settimana.giorno_riposo": "Riposo",
    "view.settimana.durata_min": "{min} min",
    "view.settimana.schema_walkrun": "{camm}m camm / {corsa}m corsa \u00D7 {rip}",
    "view.settimana.genera_piano": "Genera piano",
    "view.settimana.empty_desc": "Nessun piano per questa settimana. Genera il piano mensile.",
    "view.settimana.form_distanza_label": "Distanza effettiva (km)",
    "view.settimana.form_distanza_placeholder": "es. 5,0",
    "view.settimana.form_rpe_label": "RPE (1-10)",
    "view.settimana.form_note_label": "Note",
    "view.settimana.form_note_placeholder": "Note opzionali\u2026",
    "view.settimana.elimina_sessione": "Elimina",
    "view.settimana.elimina_conferma": "Eliminare questa sessione dal piano?",
    "view.settimana.registra_sessione": "Registra sessione",

    // ---- Genera Piano (Task 4) -------------------------------------
    "view.genera_piano.titolo": "Genera piano mensile",
    "view.genera_piano.mese_label": "Mese",
    "view.genera_piano.tipo_label": "Tipo di piano",
    "view.genera_piano.tipo_corsa": "Corsa",
    "view.genera_piano.tipo_palestra": "Palestra",
    "view.genera_piano.nota_palestra": "\u26A0\uFE0F I carichi palestra sono da aggiornare manualmente dopo ogni ciclo.",
    "view.genera_piano.btn_anteprima": "Anteprima",
    "view.genera_piano.btn_conferma": "Genera e salva",
    "view.genera_piano.anteprima_vuota": "Nessuna sessione da generare per il periodo selezionato.",
    "view.genera_piano.anteprima_count": "{n} sessioni da generare",
    "view.genera_piano.salvato_ok": "Piano generato: {n} sessioni salvate",
    "view.genera_piano.errore_nessun_tipo": "Seleziona almeno un tipo di piano.",
    "view.genera_piano.errore_storage": "Storage non disponibile.",
    "view.genera_piano.errore_salvataggio": "Errore nel salvataggio. Riprova.",

    // ---- Impostazioni (Task 5) -------------------------------------
    "view.impostazioni.profilo.titolo": "Profilo soggetto",
    "view.impostazioni.profilo.peso_label": "Peso attuale (kg)",
    "view.impostazioni.profilo.eta_label": "Et\u00E0",
    "view.impostazioni.profilo.giorni_palestra_label": "Giorni palestra",
    "view.impostazioni.profilo.lun_mer": "Luned\u00EC + Mercoled\u00EC",
    "view.impostazioni.profilo.lun_gio": "Luned\u00EC + Gioved\u00EC",
    "view.impostazioni.corsa.titolo": "Piano corsa",
    "view.impostazioni.corsa.settimana_label": "Settimana progressione corrente (1-16)",
    "view.impostazioni.corsa.settimana_hint": "Indica in quale settimana del programma walk-run ti trovi.",
    "view.impostazioni.palestra.titolo": "Piano palestra",
    "view.impostazioni.palestra.ultima_data_label": "Data ultima seduta",
    "view.impostazioni.palestra.ultima_ciclo_label": "Numero seduta nel ciclo (1-6)",
    "view.impostazioni.palestra.ciclo_hint": "Il ciclo ha 6 sedute; indica quale era l\u2019ultima completata.",
    "view.impostazioni.obiettivo.titolo": "Obiettivo",
    "view.impostazioni.obiettivo.target_label": "Target distanza",
    "view.impostazioni.obiettivo.data_gara_label": "Data gara (opzionale)",
    "view.impostazioni.obiettivo.data_gara_hint": "Lascia vuoto se non hai ancora una data.",
    "view.impostazioni.database.titolo": "Database",
    "view.impostazioni.database.esporta_label": "Esporta backup JSON",
    "view.impostazioni.database.esportato_ok": "Backup esportato",
    "view.impostazioni.cadenza.titolo": "Cadenza bisettimanale",
    "view.impostazioni.cadenza.label": "Cadenza 14 giorni (lun\u2192dom \u00D7 2)",
    "view.impostazioni.cadenza.hint": "14 valori separati da trattino: P (palestra), C (corsa), R (riposo). Es: P-P-R-C-R-P-P-R-C-R-P-P-R-C",
    "view.impostazioni.cadenza.errore": "La cadenza deve contenere esattamente 14 valori (P, C o R) separati da trattino.",
    "view.impostazioni.salvato_ok": "Impostazioni salvate",
    "view.impostazioni.errore_peso": "Peso non valido (40-250 kg).",
    "view.impostazioni.errore_eta": "Et\u00E0 non valida (18-100).",
    "view.impostazioni.errore_settimana": "Settimana non valida (1-16).",
    "view.impostazioni.errore_data": "Seleziona una data valida.",
    "view.impostazioni.errore_ciclo": "Numero ciclo non valido (1-8).",
    "view.impostazioni.errore_storage": "Storage non disponibile.",
    "view.impostazioni.errore_salvataggio": "Errore nel salvataggio. Riprova.",
  };

  /**
   * Traduce una chiave con opzionali parametri.
   * - Se la chiave non esiste, ritorna la chiave stessa e stampa warn.
   * - I parametri sono sostituiti in `{nome}` (solo identificatori ascii).
   */
  function t(key, params) {
    var raw = Object.prototype.hasOwnProperty.call(DICT, key)
      ? DICT[key]
      : null;
    if (raw === null) {
      if (global.console && global.console.warn) {
        global.console.warn("[i18n] chiave mancante: " + key);
      }
      return key;
    }
    if (!params) return raw;
    return raw.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, function replaceToken(
      full,
      name
    ) {
      if (Object.prototype.hasOwnProperty.call(params, name)) {
        return String(params[name]);
      }
      return full; // parametro non fornito: lasciamo il segnaposto per debug
    });
  }

  /**
   * Formatta una data in italiano breve: "Ven 8 mag 2026".
   * Usa Intl.DateTimeFormat quando disponibile; fallback manuale
   * (ambienti estremamente vecchi o browser privi di Intl).
   */
  function formatDateShort(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    try {
      if (global.Intl && global.Intl.DateTimeFormat) {
        var fmt = new global.Intl.DateTimeFormat("it-IT", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        });
        // Italian locale output: "ven 8 mag 2026"; capitalizziamo il weekday.
        var raw = fmt.format(date);
        return raw.charAt(0).toUpperCase() + raw.slice(1);
      }
    } catch (e) {
      /* fall through */
    }
    var weekdays = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
    var months = [
      "gen",
      "feb",
      "mar",
      "apr",
      "mag",
      "giu",
      "lug",
      "ago",
      "set",
      "ott",
      "nov",
      "dic",
    ];
    return (
      weekdays[date.getDay()] +
      " " +
      date.getDate() +
      " " +
      months[date.getMonth()] +
      " " +
      date.getFullYear()
    );
  }

  /** ISO `YYYY-MM-DD` per attributo datetime. */
  function formatDateIso(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  global.I18n = {
    locale: "it",
    dict: DICT,
    t: t,
    formatDateShort: formatDateShort,
    formatDateIso: formatDateIso,
  };
})(typeof window !== "undefined" ? window : globalThis);
