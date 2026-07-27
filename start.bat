@echo off
chcp 65001 >nul
title IOMTea 认知障碍老人居家监护系统

echo.
echo    ██╗ ██████╗ ███╗   ███╗████████╗███████╗ █████╗
echo    ██║██╔═══██╗████╗ ████║╚══██╔══╝██╔════╝██╔══██╗
echo    ██║██║   ██║██╔████╔██║   ██║   █████╗  ███████║
echo    ██║██║   ██║██║╚██╔╝██║   ██║   ██╔══╝  ██╔══██║
echo    ██║╚██████╔╝██║ ╚═╝ ██║   ██║   ███████╗██║  ██║
echo    ╚═╝ ╚═════╝ ╚═╝     ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
echo.
echo    Internet of Medical Things Architecture
echo    ─────────────────────────────────────────
echo.

echo [1/2] Starting backend (port 3000)...
start "IOMTea-Server" cmd /c "cd /d C:\Users\26620\Desktop\IOMTea\apps\server && pnpm dev"
timeout /t 3 /nobreak >nul

echo [2/2] Starting frontend (port 5173)...
start "IOMTea-Web" cmd /c "cd /d C:\Users\26620\Desktop\IOMTea\apps\web && pnpm dev"
timeout /t 5 /nobreak >nul

echo.
echo ===================================
echo   System is ready!
echo   Open: http://localhost:5173
echo   Login: admin / admin123
echo ===================================
echo.
echo Close this window to stop all services.
pause
