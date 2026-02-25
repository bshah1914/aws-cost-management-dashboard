@echo off
echo ============================================
echo  AWS Cost Management Platform
echo ============================================
echo.

:: Start backend
echo Starting backend on http://localhost:8000 ...
cd backend
start cmd /k "call venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
cd ..

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak > nul

:: Start frontend
echo Starting frontend on http://localhost:3000 ...
cd frontend
start cmd /k "npm run dev"
cd ..

echo.
echo Both servers are starting in separate windows.
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo Login with: kpiadmin / 0LT6pcs-65xGV5P_DgUMUU
echo.
pause
