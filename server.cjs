/*
 * Maranello 2027 — Server locale
 *
 * Serve l'app statica + API per sincronizzazione PC → Mobile.
 *
 * Endpoints:
 *   GET  /                → app statica (index.html, js, css, etc.)
 *   GET  /api/schede      → ritorna le schede palestra esportate dal PC
 *   POST /api/schede      → il PC salva le schede palestra per il mobile
 *
 * Avvio: node server.js
 * Porta: 3001 (default) o variabile PORT
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3001;

// Dati in memoria (persistiti su file per sopravvivere ai restart)
const DATA_FILE = path.join(__dirname, "sync-data.json");

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    }
  } catch (e) { /* ignore */ }
  return { sessioni: [], dataExport: null };
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

/**
 * Esegue add + commit + push di schede.json su GitHub.
 * Chiama callback({ ok: boolean, error: string|null }) con l'esito.
 *
 * - Tollera il caso "niente da committare" (schede invariate): è un successo,
 *   perché il file remoto è già aggiornato.
 * - Imposta GIT_TERMINAL_PROMPT=0 così, se mancano le credenziali, il push
 *   fallisce subito con un errore chiaro invece di restare bloccato in attesa
 *   di un'autenticazione interattiva che qui non arriverà mai.
 */
function pushSchedeSuGitHub(callback) {
  const { exec } = require("child_process");
  const env = Object.assign({}, process.env, {
    GIT_TERMINAL_PROMPT: "0",
    GIT_ASKPASS: "echo",
  });

  function done(ok, error) {
    if (typeof callback === "function") callback({ ok: ok, error: error || null });
  }

  exec("git add schede.json", { cwd: __dirname, env: env }, (addErr, _o, addStderr) => {
    if (addErr) {
      const msg = (addStderr || addErr.message || "git add fallito").trim();
      console.warn("[server] git add fallito:", msg);
      return done(false, msg);
    }

    exec('git commit -m "Aggiorna schede mobile"', { cwd: __dirname, env: env }, (commitErr, commitStdout, commitStderr) => {
      const commitOut = (commitStdout || "") + (commitStderr || "");
      // "nothing to commit" = schede invariate: va comunque bene.
      const nienteDaCommittare = /nothing to commit|niente di cui eseguire il commit|no changes added/i.test(commitOut);

      if (commitErr && !nienteDaCommittare) {
        const msg = (commitStderr || commitErr.message || "git commit fallito").trim();
        console.warn("[server] git commit fallito:", msg);
        return done(false, msg);
      }

      if (nienteDaCommittare) {
        console.log("[server] schede.json invariato: nessun commit, provo comunque il push.");
      }

      exec("git push", { cwd: __dirname, env: env }, (pushErr, _po, pushStderr) => {
        if (pushErr) {
          const msg = (pushStderr || pushErr.message || "git push fallito").trim();
          console.warn("[server] git push fallito:", msg);
          return done(false, msg);
        }
        console.log("[server] schede.json pushato su GitHub.");
        done(true, null);
      });
    });
  });
}

let schedeData = loadData();

// MIME types
const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function serveStatic(req, res) {
  let filePath = req.url.split("?")[0]; // rimuove query string
  if (filePath === "/") filePath = "/index.html";

  const fullPath = path.join(__dirname, filePath);

  // Sicurezza: non uscire dalla cartella app
  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found: " + filePath);
      return;
    }
    const ext = path.extname(fullPath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  });
}

function handleApi(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === "/api/schede" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(schedeData));
    return;
  }

  if (req.url === "/api/schede" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        if (!payload || !Array.isArray(payload.sessioni)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Campo 'sessioni' mancante" }));
          return;
        }
        schedeData = payload;
        schedeData.dataExport = new Date().toISOString();
        saveData(schedeData);

        // Salva anche come schede.json (per GitHub Pages)
        const schedeFile = path.join(__dirname, "schede.json");
        fs.writeFileSync(schedeFile, JSON.stringify(schedeData, null, 2), "utf8");

        // Git add, commit e push: attende l'esito per riportarlo all'app.
        // GIT_TERMINAL_PROMPT=0 evita che il processo resti bloccato in attesa
        // di autenticazione interattiva (fallisce subito invece di appendersi).
        pushSchedeSuGitHub(function (gitResult) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            ok: true,
            count: payload.sessioni.length,
            git: gitResult.ok,
            gitError: gitResult.ok ? null : gitResult.error,
          }));
        });
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "JSON non valido" }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Endpoint non trovato" }));
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const nets = require("os").networkInterfaces();
  let localIp = "localhost";
  Object.values(nets).forEach(ifaces => {
    ifaces.forEach(iface => {
      if (iface.family === "IPv4" && !iface.internal) {
        localIp = iface.address;
      }
    });
  });
  console.log(`\n  Maranello 2027 — Server attivo\n`);
  console.log(`  PC:      http://localhost:${PORT}`);
  console.log(`  Mobile:  http://${localIp}:${PORT}`);
  console.log(`\n  Apri l'URL "Mobile" dal telefono (stessa rete WiFi)\n`);
});
