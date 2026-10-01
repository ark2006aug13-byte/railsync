# RailSync FastAPI Backend Server Launcher
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "   Starting RailSync FastAPI Backend Server...     " -ForegroundColor Green
Write-Host "   API Docs: http://127.0.0.1:8000/docs            " -ForegroundColor Yellow
Write-Host "   Health:   http://127.0.0.1:8000/api/health      " -ForegroundColor Yellow
Write-Host "===================================================" -ForegroundColor Cyan
Set-Location -Path "$PSScriptRoot\backend"
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
