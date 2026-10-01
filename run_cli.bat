@echo off
title RailSync Terminal CLI
cd /d "%~dp0backend"
if "%~1"=="" (
    python cli.py --train 12301
) else (
    python cli.py %*
)
pause
