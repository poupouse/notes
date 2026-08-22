@echo off
setlocal EnableExtensions

cd /d "%~dp0"
title Carnet - Mode developpement

set "CHECK_ONLY=0"
if /i "%~1"=="--check" set "CHECK_ONLY=1"

echo.
echo ========================================
echo   Carnet - Apercu rapide avec HMR
echo ========================================
echo.

rem Find Node.js in PATH or in the usual Windows/Codex locations.
set "NODE_EXE="
where node.exe >nul 2>&1 && set "NODE_EXE=node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_EXE=%LocalAppData%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not defined NODE_EXE (
  set "ERROR_MESSAGE=Node.js est introuvable. Installez la version LTS depuis https://nodejs.org/"
  goto :refresh_error
)

for /f "delims=" %%V in ('"%NODE_EXE%" --version 2^>nul') do set "NODE_VERSION=%%V"
if not defined NODE_VERSION (
  set "ERROR_MESSAGE=Node.js a ete trouve mais ne peut pas etre execute."
  goto :refresh_error
)
echo [OK] Node.js %NODE_VERSION%

if not exist "node_modules\@electron-forge\cli\dist\electron-forge.js" (
  set "ERROR_MESSAGE=Les dependances sont absentes. Lancez d'abord build.bat avec npm disponible."
  goto :refresh_error
)

if "%CHECK_ONLY%"=="1" (
  echo [OK] Le mode developpement est disponible.
  exit /b 0
)

rem Forge checks npm because package-lock.json exists. The project is already
rem installed, so provide a harmless version response when npm is not in PATH.
set "NPM_SHIM_DIR="
where npm.cmd >nul 2>&1
if errorlevel 1 (
  set "NPM_SHIM_DIR=%~dp0.vite\refresh-npm-shim-%RANDOM%-%RANDOM%"
  mkdir "%NPM_SHIM_DIR%" >nul 2>&1
  >"%NPM_SHIM_DIR%\npm.cmd" echo @echo off
  >>"%NPM_SHIM_DIR%\npm.cmd" echo echo 10.0.0
  set "PATH=%NPM_SHIM_DIR%;%PATH%"
)
for %%D in ("%NODE_EXE%") do set "PATH=%%~dpD;%PATH%"

echo.
echo L'application va s'ouvrir en mode developpement.
echo Gardez cette fenetre ouverte : les changements JS et CSS seront
echo appliques automatiquement, sans relancer build.bat.
echo Utilisez Ctrl+C ici pour arreter le serveur.
echo.

"%NODE_EXE%" "node_modules\@electron-forge\cli\dist\electron-forge.js" start
set "REFRESH_EXIT=%ERRORLEVEL%"
call :cleanup

if not "%REFRESH_EXIT%"=="0" (
  set "ERROR_MESSAGE=Le serveur de developpement s'est arrete avec une erreur."
  goto :refresh_error
)
exit /b 0

:refresh_error
call :cleanup
echo.
echo ========================================
echo   ECHEC DU MODE DEVELOPPEMENT
echo ========================================
echo %ERROR_MESSAGE%
echo.
pause
exit /b 1

:cleanup
if defined NPM_SHIM_DIR if exist "%NPM_SHIM_DIR%\" rmdir /s /q "%NPM_SHIM_DIR%" >nul 2>&1
exit /b 0
