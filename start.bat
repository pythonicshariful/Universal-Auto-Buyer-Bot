@echo off
echo ===================================================
echo     Starting Universal Auto-Buyer Bot Ecosystem
echo ===================================================
echo.

echo [1/3] Starting FastAPI Dashboard...
cd dashboard
start cmd /k "title Dashboard API && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
cd ..

:: Wait 3 seconds to ensure the dashboard starts up before the bots try to connect
timeout /t 3 /nobreak >nul

echo [2/3] Starting Target Bot...
start cmd /k "title Target Bot && npm start"

echo [3/3] Starting Walmart Bot...
start cmd /k "title Walmart Bot && npm run start:walmart"

echo.
echo ===================================================
echo All services have been launched in separate windows!
echo Dashboard is available at: http://localhost:8000
echo ===================================================
pause
