@echo off
title Uruchamianie deweloperskie UpdaterWin
echo =======================================================
echo   Uruchamianie aplikacji w trybie deweloperskim...
echo =======================================================
echo.
cd /d "%~dp0"
call npm run dev
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [BLAD] Nie udalo sie uruchomic aplikacji!
    echo Upewnij sie, ze najpierw uruchomiles instaluj-zaleznosci.bat
    echo.
    pause
)
