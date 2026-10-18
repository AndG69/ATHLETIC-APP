# Migrazione su un nuovo PC — Programma Sportivo (ATHLETIC / Maranello 2027)

Guida per spostare l'app su un nuovo computer **senza perdere nulla**: codice,
dipendenze e — soprattutto — i **dati di allenamento**.

> ⚠️ **La cosa più importante**: i tuoi dati (schede, sessioni, pesate, piano,
> impostazioni) vivono in **IndexedDB dentro il browser**, NON nei file del
> progetto. Copiare la cartella NON copia i dati. Devi esportarli dal vecchio
> PC e reimportarli sul nuovo (vedi §3).

---

## 1. Cosa serve sul nuovo PC (prerequisiti)

1. **Node.js** (LTS, versione 20 o superiore) — <https://nodejs.org>
   Serve per il server locale (`server.cjs`) e per i test.
2. **Git** (opzionale ma consigliato) — <https://git-scm.com>
   Serve solo per la funzione "Esporta per mobile" (commit+push automatico) e
   per sincronizzare il codice con GitHub.
3. Un **browser** (Chrome/Edge/Firefox).

L'app NON usa CDN: le librerie (idb, SheetJS, Chart.js) sono già incluse in
`assets/vendor/`. Quindi per **usare** l'app basta Node: niente `npm install`
obbligatorio.

---

## 2. Copiare l'app sul nuovo PC

Hai due strade equivalenti.

### Strada A — Pacchetto ZIP (consigliata, offline)
1. Copia sul nuovo PC lo ZIP `ATHLETIC-pacchetto-<data>.zip` (USB o cloud).
2. Estrailo dove vuoi, ad es. in `C:\Users\<tuo-utente>\Desktop\`.
3. Dentro trovi la cartella `app/` con tutto il necessario (vendor inclusi).

Lo ZIP **non** contiene `node_modules` (si ricrea con un comando) ma contiene i
vendor già pronti: l'app parte subito.

### Strada B — Git clone (solo codice, richiede ricostruzione)
> Nota: il repo GitHub **non** contiene `package.json`, `scripts/`, `tests/` né
> `assets/vendor/`. Un clone da solo NON basta a far girare l'app. Usa la
> Strada A, oppure dopo il clone copia a mano `package.json`, `package-lock.json`,
> `scripts/`, `tests/`, `vitest.config.js` e poi esegui `npm install` (che
> rigenera `assets/vendor/`).

```
git clone https://github.com/AndG69/ATHLETIC-APP.git app
```

---

## 3. Trasferire i DATI di allenamento (fondamentale)

### Sul VECCHIO PC — esporta
1. Apri l'app → **Impostazioni** → sezione **Database**.
2. Clicca **"Esporta backup JSON"**.
3. Salva il file `maranello-backup-AAAA-MM-GG.json` e portalo sul nuovo PC
   (lo stesso USB/cloud dello ZIP).

Il backup ora include: impostazioni, **programma_palestra (schede + anagrafica
esercizi + gruppi)**, piano settimane, sessioni corsa/palestra/nuoto, peso,
allerte.

### Sul NUOVO PC — importa
1. Avvia l'app (vedi §4) e aprila nel browser.
2. **Impostazioni** → **Database** → **"📂 Importa backup JSON"** → scegli il
   file `.json`.
3. Attendi "Backup importato con successo" e **ricarica la pagina**.

> Importante: usa **lo stesso identico URL/browser** per vedere i dati.
> IndexedDB è legato all'origine (es. `http://localhost:3001`). Se sul vecchio
> PC usavi `localhost:3001`, usa `localhost:3001` anche sul nuovo.

---

## 4. Avviare l'app

Dalla cartella `app/`:

- **Doppio clic su `start.bat`** → avvia `node server.cjs` sulla porta 3001 e
  apre il browser su <http://localhost:3001>. (Metodo completo: include le API
  per "Esporta per mobile".)
- In alternativa, da terminale dentro `app/`: `node server.cjs`.

Dal telefono (stessa WiFi) puoi aprire `http://<ip-del-pc>:3001`, ma ricorda che
il telefono di solito carica il codice da GitHub Pages
(<https://andg69.github.io/ATHLETIC-APP/>) — vedi `HANDOFF.md` §3.

---

## 5. (Opzionale) Ricostruire le dipendenze di sviluppo

Serve solo se vuoi lanciare i **test** o rigenerare i vendor. Dentro `app/`:

```
npm install
```

- `postinstall` rigenera automaticamente `assets/vendor/` (via
  `scripts/copy-vendor.mjs`).
- Su Windows, se PowerShell blocca `npm.ps1` (Execution Policy), usa **`npm.cmd
  install`** oppure lancia lo script `setup-nuovo-pc.bat` (vedi §6).
- Lancia i test: `npm test` (atteso: 136 passati / 1 fallito — il test peso noto).

---

## 6. Script di setup automatico

Nel pacchetto trovi due file:

- **`setup-nuovo-pc.bat`** — fai doppio clic: verifica Node/Git, esegue
  `npm install` (aggirando l'Execution Policy) e rigenera i vendor.
- `setup-nuovo-pc.ps1` — la logica vera (richiamata dal `.bat`).

Non è obbligatorio per usare l'app, ma comodo per preparare l'ambiente completo.

---

## 7. (Opzionale) GitHub e "Esporta per mobile"

Se vuoi che funzioni il push automatico di `schede.json`:
1. Installa Git e fai login a GitHub (al primo `git push` il Credential Manager
   chiede le credenziali una volta, poi le ricorda).
2. Verifica il remote dentro `app/`: `git remote -v` deve puntare a
   `https://github.com/AndG69/ATHLETIC-APP.git`.
   (Se usi lo ZIP con la cartella `.git` inclusa, è già configurato.)

---

## 8. (Opzionale) Avvio automatico all'accensione

Doppio clic su **`install-autostart.bat`**: crea un collegamento in
Esecuzione automatica che lancia il server in background all'avvio di Windows.
Per rimuoverlo, cancella il collegamento `maranello-server.lnk` dalla cartella
Startup indicata dallo script.

---

## 9. Problemi comuni

- **Grafici/export non funzionano / errori su `window.idb`/`XLSX`/`Chart`**:
  manca `assets/vendor/`. Esegui `npm install` (o `npm run setup:vendor`) dentro
  `app/`.
- **`npm` non parte in PowerShell** (Execution Policy su `npm.ps1`): usa
  `npm.cmd ...` o `setup-nuovo-pc.bat`. Non cambiare la policy di sistema.
- **Non vedo i miei dati dopo la migrazione**: non hai importato il backup (§3),
  oppure stai usando un URL/browser diverso (IndexedDB è per-origine).
- **La porta 3001 è occupata**: `start.bat` prova a liberarla; in alternativa
  imposta un'altra porta con `set PORT=3002 && node server.cjs`.

---

## 10. Checklist rapida

Sul vecchio PC:
- [ ] Esporta backup JSON (Impostazioni → Database).
- [ ] Copia il pacchetto ZIP (o l'intera cartella `app/`) + il file di backup.

Sul nuovo PC:
- [ ] Installa Node (e Git se ti serve il push).
- [ ] Estrai il pacchetto.
- [ ] Avvia con `start.bat` → apri <http://localhost:3001>.
- [ ] Importa il backup JSON e ricarica.
- [ ] (opzionale) `npm install` per i test / `setup-nuovo-pc.bat`.
- [ ] (opzionale) login GitHub + `install-autostart.bat`.
