@echo off
REM Maranello 2027 - Setup ambiente su nuovo PC
REM Lancia lo script PowerShell aggirando l'Execution Policy, senza modificarla.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-nuovo-pc.ps1"
