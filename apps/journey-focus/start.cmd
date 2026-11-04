@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Journey Focus - http://localhost:5173
node server.mjs
pause
