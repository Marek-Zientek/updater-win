@echo off
title Instalator zaleznosci UpdaterWin
echo =======================================================
echo   Instalowanie zaleznosci (npm install) dla UpdaterWin
echo =======================================================
echo.
cd /d "%~dp0"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [BLAD] Instalacja zaleznosci nie powiodla sie! 
    echo Upewnij sie, ze Node.js i npm sa zainstalowane w systemie.
    echo.
) else (
    echo.
    echo [SUKCES] Zaleznosci zostaly zainstalowane pomyslnie.
    echo.
)
pause
