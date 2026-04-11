@echo off
cd /d "%~dp0"
start "ShopSphere Frontend" cmd /k "%~dp0start-frontend.cmd"
start "ShopSphere Backend" cmd /k "%~dp0start-backend.cmd"
start "" chrome http://localhost:3000
