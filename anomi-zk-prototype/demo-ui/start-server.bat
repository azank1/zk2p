@echo off
REM Start Demo UI Server - Windows Batch Script

echo Starting ZK2P Demo UI Server...
echo.

cd /d %~dp0

echo Server directory: %CD%
echo Starting HTTP server on http://127.0.0.1:8080
echo.
echo Press Ctrl+C to stop the server
echo.
echo Open your browser to: http://127.0.0.1:8080
echo.

python -m http.server 8080 --bind 127.0.0.1
pause

