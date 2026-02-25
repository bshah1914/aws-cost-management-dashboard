@echo off
echo ============================================
echo  AWS Cost Management Platform - Setup
echo ============================================
echo.

:: Backend setup
echo [1/4] Setting up Python virtual environment...
cd backend
python -m venv venv
call venv\Scripts\activate
echo [2/4] Installing Python dependencies...
pip install -r requirements.txt
cd ..

:: Frontend setup
echo [3/4] Installing Node.js dependencies...
cd frontend
call npm install
cd ..

echo [4/4] Setup complete!
echo.
echo To start the platform, run: start.bat
echo.
pause
