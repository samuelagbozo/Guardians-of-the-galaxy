@echo off
title Orbit Architect
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening the download page...
  echo Install the LTS version, then double-click START_GAME.bat again.
  start https://nodejs.org
  pause
  exit /b
)
if not exist node_modules (
  echo First run: installing the game. This takes a few minutes, please wait...
  call npm install --legacy-peer-deps
  if errorlevel 1 ( echo Install failed. Check your internet connection and try again. & pause & exit /b )
)
echo.
echo Starting the game. Your browser will open automatically.
echo If it does not, open the link shown below (usually http://localhost:5173).
echo Close this window to stop the game.
echo.
call npm run dev
pause
