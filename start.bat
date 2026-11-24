@echo off
title Nova
cd /d "%~dp0"

if not exist .env (
  copy /y ".env.example" ".env" >nul
  echo Created .env - paste your NVIDIA_API_KEY there if you have not already.
)

start "" "http://localhost:4173"
node --env-file-if-exists=.env server.js
pause
