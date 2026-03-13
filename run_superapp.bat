@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "PY_EXE=%BACKEND_DIR%\venv\Scripts\python.exe"
set "UVICORN_EXE=%BACKEND_DIR%\venv\Scripts\uvicorn.exe"

if not exist "%PY_EXE%" (
  echo [ERROR] Python executable not found: %PY_EXE%
  echo Ensure backend virtual environment exists at backend\venv.
  pause
  exit /b 1
)

if not exist "%UVICORN_EXE%" (
  echo [ERROR] Uvicorn executable not found: %UVICORN_EXE%
  echo Ensure backend virtual environment exists at backend\venv.
  pause
  exit /b 1
)

echo Starting backend on http://127.0.0.1:8000 ...
start "Smart Meter Backend" /D "%BACKEND_DIR%" "%UVICORN_EXE%" main:app --reload --host 127.0.0.1 --port 8000

echo Starting frontend on http://127.0.0.1:5510 ...
start "Smart Meter Frontend" /D "%ROOT%" "%PY_EXE%" -m http.server 5510 --directory "%ROOT%frontend"

echo.
echo Login URL: http://127.0.0.1:5510/index.html
echo Consumer App URL: http://127.0.0.1:5510/app/
echo Admin Portal URL: http://127.0.0.1:5510/admin/
echo Backend API URL: http://127.0.0.1:8000
echo.
echo Demo User     : user@demo.com / demo123
echo Demo Admin    : admin@demo.com / admin123
echo Demo Operator : operator@demo.com / operator123
echo.
echo Closing this launcher will not stop the two server windows.
echo Stop servers by closing those terminal windows.

start "" "http://127.0.0.1:5510/index.html"
endlocal
