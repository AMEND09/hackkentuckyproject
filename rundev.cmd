@echo off
REM Windows launcher — avoids PowerShell ExecutionPolicy blocking rundev.ps1
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0rundev.ps1" %*
