@echo off
setlocal EnableExtensions

cd /d "%~dp0"
title Carnet - Build Windows

set "NO_PAUSE=0"
set "CHECK_ONLY=0"
if /i "%~1"=="--no-pause" set "NO_PAUSE=1"
if /i "%~1"=="--check" set "CHECK_ONLY=1"

echo.
echo ========================================
echo   Carnet - Build de l'application
echo ========================================
echo.

rem Locate Node.js, including common Windows and Codex runtime locations.
set "NODE_EXE="
where node.exe >nul 2>&1 && set "NODE_EXE=node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_EXE=%LocalAppData%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not defined NODE_EXE (
  set "ERROR_MESSAGE=Node.js est introuvable. Installez la version LTS depuis https://nodejs.org/"
  goto :build_error
)

for /f "delims=" %%V in ('"%NODE_EXE%" --version 2^>nul') do set "NODE_VERSION=%%V"
if not defined NODE_VERSION (
  set "ERROR_MESSAGE=Node.js a ete trouve mais ne peut pas etre execute."
  goto :build_error
)
echo [OK] Node.js %NODE_VERSION%

rem npm is only required to install dependencies. Forge also checks its
rem version, so a local version-only shim is used when dependencies already
rem exist and npm is not exposed in PATH.
set "NPM_CMD="
where npm.cmd >nul 2>&1 && set "NPM_CMD=npm.cmd"
if not defined NPM_CMD if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD if exist "%LocalAppData%\Programs\nodejs\npm.cmd" set "NPM_CMD=%LocalAppData%\Programs\nodejs\npm.cmd"

if not exist "node_modules\" (
  if not defined NPM_CMD (
    set "ERROR_MESSAGE=Les dependances sont absentes et npm est introuvable. Reinstallez Node.js LTS avec npm."
    goto :build_error
  )
  echo [1/4] Installation propre des dependances...
  call "%NPM_CMD%" ci
  if errorlevel 1 (
    set "ERROR_MESSAGE=L'installation des dependances a echoue."
    goto :build_error
  )
) else (
  echo [1/4] Dependances presentes.
)

if not exist "node_modules\eslint\bin\eslint.js" (
  set "ERROR_MESSAGE=ESLint est absent de node_modules. Supprimez node_modules puis relancez avec npm disponible."
  goto :build_error
)
if not exist "node_modules\@electron-forge\cli\dist\electron-forge.js" (
  set "ERROR_MESSAGE=Electron Forge est absent de node_modules. Supprimez node_modules puis relancez avec npm disponible."
  goto :build_error
)

if "%CHECK_ONLY%"=="1" (
  echo [OK] Tous les outils necessaires sont disponibles.
  goto :build_success
)

tasklist /FI "IMAGENAME eq notes.exe" /NH 2>nul | findstr /I /C:"notes.exe" >nul
if not errorlevel 1 (
  set "ERROR_MESSAGE=L'application notes.exe est ouverte. Fermez-la avant de reconstruire."
  goto :build_error
)

echo [2/4] Verification du code...
"%NODE_EXE%" "node_modules\eslint\bin\eslint.js" --ext .ts,.tsx .
if errorlevel 1 (
  set "ERROR_MESSAGE=La verification ESLint a echoue."
  goto :build_error
)

rem Forge selects npm because package-lock.json is present. If npm is not in
rem PATH, provide the version check it needs without modifying node_modules.
set "NPM_SHIM_DIR="
if not defined NPM_CMD (
  set "NPM_SHIM_DIR=%TEMP%\carnet-npm-shim-%RANDOM%-%RANDOM%"
  mkdir "%NPM_SHIM_DIR%" >nul 2>&1
  >"%NPM_SHIM_DIR%\npm.cmd" echo @echo off
  >>"%NPM_SHIM_DIR%\npm.cmd" echo echo 10.0.0
  set "PATH=%NPM_SHIM_DIR%;%PATH%"
) else (
  for %%D in ("%NPM_CMD%") do set "PATH=%%~dpD;%PATH%"
)
for %%D in ("%NODE_EXE%") do set "PATH=%%~dpD;%PATH%"

echo [3/4] Creation du package Electron...
"%NODE_EXE%" "node_modules\@electron-forge\cli\dist\electron-forge.js" make
if errorlevel 1 (
  set "ERROR_MESSAGE=Electron Forge n'a pas pu terminer le build. Consultez les erreurs ci-dessus."
  goto :build_error
)

echo [4/4] Verification du resultat...
if not exist "out\notes-win32-x64\notes.exe" (
  set "ERROR_MESSAGE=Forge s'est termine sans produire out\notes-win32-x64\notes.exe."
  goto :build_error
)

:build_success
call :cleanup
echo.
echo ========================================
if "%CHECK_ONLY%"=="1" (
  echo   Environnement pret pour le build
) else (
  echo   Build termine avec succes
  echo   Application : out\notes-win32-x64\notes.exe
  echo   Installateur : out\make
)
echo ========================================
echo.
if "%NO_PAUSE%"=="0" pause
exit /b 0

:build_error
call :cleanup
echo.
echo ========================================
echo   ECHEC DU BUILD
echo ========================================
echo %ERROR_MESSAGE%
echo.
echo Cette fenetre reste ouverte pour permettre de lire l'erreur.
echo.
if "%NO_PAUSE%"=="0" pause
exit /b 1

:cleanup
if defined NPM_SHIM_DIR if exist "%NPM_SHIM_DIR%\" rmdir /s /q "%NPM_SHIM_DIR%" >nul 2>&1
exit /b 0
