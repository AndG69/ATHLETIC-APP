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
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, count: payload.sessioni.length }));
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
