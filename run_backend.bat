@echo off
title RailSync FastAPI Backend Server
echo ===================================================
echo    Starting RailSync FastAPI Backend Server...
echo    API Docs: http://127.0.0.1:8000/docs
echo    Health:   http://127.0.0.1:8000/api/health
echo ===================================================
cd /d "%~dp0backend"
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
pause
