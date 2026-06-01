# Services

Moduli di servizio dell'App_HTML. Sono componenti a livello di "dominio",
indipendenti dalla UI e dal routing.

## storage.js — layer di persistenza IndexedDB

Implementa il layer di persistenza sopra **IndexedDB** con database
`MaranelloPlan_v1` (v1). Espone l'oggetto globale `window.MaranelloStorage`
(il file è caricato via `<script>` classico, non come modulo ES).

### Strategia libreria

1. **Primario**: usa `window.idb` (Jake Archibald's `idb`, 8.x) se il file
   `/assets/vendor/idb.js` è stato sostituito con la distribuzione UMD reale.
2. **Fallback**: wrapper IndexedDB **vanilla interno** (nessuna dipendenza
   esterna). Serve esattamente la superficie richiesta da `MaranelloStorage`
   (`get`, `put`, `delete`, `getAll`, `getAllFromIndex`, `clear`, `tx`).

Questo è coerente con Req 22.2 e Property 23 (zero richieste esterne a
runtime) e permette lo sviluppo out-of-the-box senza installare dipendenze.

### Stores (schema v1)

| Store | keyPath | Indici |
|---|---|---|
| `impostazioni` | `id` (singleton `"main"`) | — |
| `piano_settimane` | `id` (`"YYYY-Www"`) | `by_fase`, `by_numSettimana`, `by_dataInizio` |
| `sessioni_corsa` | `id` (uuid) | `by_data`, `by_stato`, `by_settimana` |
| `sessioni_palestra` | `id` (uuid) | `by_data`, `by_stato`, `by_settimana` |
| `sessioni_nuoto` | `id` (uuid) | `by_data` |
| `peso` | `id` (uuid) | `by_data` |
| `proposte` | `id` (uuid) | `by_dataProposta`, `by_decisione` |
| `allerte` | `id` (uuid) | `by_dataAttivazione`, `by_livello`, `by_attiva` |
| `kpi_settimanali` | `id` (`"YYYY-Www"`) | — |
| `log_modifiche` | `id` (uuid) | `by_timestamp`, `by_entita` |

> Nota: l'indice `by_attiva` su `allerte` usa il campo derivato `_attiva`
> (`"1"` = attiva, `"0"` = sbloccata) valorizzato automaticamente al `put()`
> (IndexedDB non indicizza i valori `null`).

### API

```js
await MaranelloStorage.init();

// Lettura: null se non trovato
const imp = await MaranelloStorage.get('impostazioni', 'main');

// Scrittura (upsert). Aggiunge _updatedAt e assegna uuid se mancante.
await MaranelloStorage.put('sessioni_corsa', { data: '2026-05-15', ... },
  { origine: 'utente' });

// Cancellazione
await MaranelloStorage.delete('sessioni_corsa', uuid);

// Query per indice (con eventuale IDBKeyRange)
const logs = await MaranelloStorage.query('log_modifiche',
  { index: 'by_timestamp', limit: 50 });

// Svuotamento (distruttivo, conferma lato chiamante)
await MaranelloStorage.clear('kpi_settimanali');

// Log esplicito (per scritture "indirette")
await MaranelloStorage.logModifica('impostazioni', 'main', 'modificata',
  { before, after }, 'utente');

MaranelloStorage.generateUuid();
MaranelloStorage.STORES.SESSIONI_CORSA; // === 'sessioni_corsa'
```

### Contratto di comportamento

- `put()` è l'unico percorso di scrittura "loggante": legge il record
  pre-esistente per distinguere `creata` vs `modificata`, scrive dato e log
  in un'unica transazione multi-store.
- `delete()` logga come `eliminata`. Se la chiave non esiste, è no-op.
- `clear()` produce **una sola** entry di log con `entitaId = "*"` e
  `delta = { count: N }`.
- Per `log_modifiche` stesso, il logging è disabilitato (no ricorsione).
- Ogni record riceve automaticamente `_updatedAt` (ISO 8601) se non
  specificato.
- UUID: preferibilmente `crypto.randomUUID()`; fallback RFC-4122-ish.
- Timestamp: sempre stringhe ISO 8601.

### Migrazioni

Le migrazioni vivono nell'array `MIGRATIONS` dentro `storage.js`.
Per passare a `v2`:

1. Aggiungere una funzione `function migrateV2(db, oldVersion, transaction)`
   in coda all'array.
2. Incrementare di conseguenza `DB_VERSION`.
3. IndexedDB preserva i dati esistenti negli store non toccati.

### Smoke test manuale

In DevTools:

```js
await window.__DEV_STORAGE_SMOKE__();
```

Esegue init → put di un record impostazioni → get → ispezione
`log_modifiche`. Utile per verifica rapida senza avere ancora il test runner
(arriverà in Task 4).

### Test automatici

Deferiti a **Task 4** (configurazione `vitest` + `fast-check`). I sub-task
`2.4*` (unit per store) e `2.5*` (property test round-trip) sono già
tracciati in `tasks.md`.

_Ref: Req 22.3, 23.1, 23.7, 24.5, 24.6; Property 23._
