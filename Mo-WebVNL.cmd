@echo off
cd /d "%~dp0"
node server\local.js
if errorlevel 1 pause
