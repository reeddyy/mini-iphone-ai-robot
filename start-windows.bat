@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
 echo Install Node.js 22+ from https://nodejs.org/
 pause
 exit /b 1
)
if not exist .env (
 echo Copy .env.example to .env and edit it first.
 pause
 exit /b 1
)
npm start
pause
