@echo off
title Programma Sportivo - Server Locale
echo Avvio server locale...
echo.
echo L'app si aprira' nel browser tra pochi secondi.
echo NON chiudere questa finestra mentre usi l'app.
echo.
start "" http://localhost:3001
node server.cjs
echo.
echo === SERVER TERMINATO ===
echo Se vedi un errore sopra, segnalalo.
pause
