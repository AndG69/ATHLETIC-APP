# Maranello 2027 — Setup ambiente su un nuovo PC
# Prepara le dipendenze di sviluppo (test) e rigenera le librerie vendor.
# Per USARE l'app basta Node + start.bat: questo script serve solo se vuoi
# anche i test o rigenerare assets/vendor/.
#
# Avvio consigliato: doppio clic su setup-nuovo-pc.bat (aggira l'Execution Policy).

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host ""
Write-Host "=== Setup Programma Sportivo (Maranello 2027) ===" -ForegroundColor Cyan
Write-Host "Cartella: $PSScriptRoot"
Write-Host ""

# --- Node ---
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "[X] Node.js non trovato nel PATH." -ForegroundColor Red
    Write-Host "    Installa la versione LTS da https://nodejs.org e riprova."
    Read-Host "Premi Invio per chiudere"
    exit 1
}
Write-Host ("[OK] Node " + (& node --version)) -ForegroundColor Green

# --- Git (opzionale) ---
$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
    Write-Host ("[OK] Git  " + (& git --version)) -ForegroundColor Green
} else {
    Write-Host "[!] Git non trovato (opzionale): la funzione 'Esporta per mobile' non funzionera' finche' non lo installi da https://git-scm.com" -ForegroundColor Yellow
}

# --- npm install (usa npm.cmd per aggirare l'Execution Policy su npm.ps1) ---
Write-Host ""
Write-Host "Installazione dipendenze (npm install)..." -ForegroundColor Cyan
& npm.cmd install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[X] npm install ha restituito un errore. Controlla la connessione e riprova." -ForegroundColor Red
    Read-Host "Premi Invio per chiudere"
    exit 1
}

# --- Rigenera i vendor (postinstall lo fa gia', qui per sicurezza) ---
Write-Host ""
Write-Host "Copia librerie vendor in assets/vendor/..." -ForegroundColor Cyan
& node "scripts/copy-vendor.mjs"

Write-Host ""
Write-Host "=== Fatto! ===" -ForegroundColor Green
Write-Host "Per avviare l'app: doppio clic su start.bat  (oppure: node server.cjs)"
Write-Host "Per i test:        npm.cmd test   (atteso: 136 passati / 1 fallito noto)"
Write-Host "Ricorda di importare il backup JSON dei dati (Impostazioni -> Database)."
Write-Host ""
Read-Host "Premi Invio per chiudere"
