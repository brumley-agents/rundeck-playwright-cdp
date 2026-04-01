@echo off
setlocal

cd /d "%~dp0"

set "NODE_EXE=C:\Program Files\sf\client\bin\node.exe"
set "PLAYWRIGHT_CLI=C:\Users\andrew.brumley\rundeck-playwright\node_modules\playwright\cli.js"
set "NODE_PATH=C:\Users\andrew.brumley\rundeck-playwright\node_modules"
set "EDGE_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "EDGE_USER_DATA_DIR=C:\Users\andrew.brumley\rundeck-playwright-cdp\auth\edge-cdp-user-data"
set "EDGE_PROFILE_DIRECTORY=Default"
set "RUNDECK_BASE_URL=https://rundeck.uipath.com"
set "RUNDECK_CDP_HOST=127.0.0.1"
set "RUNDECK_CDP_PORT=9222"

if not exist "%NODE_EXE%" (
  echo Node executable not found:
  echo %NODE_EXE%
  echo.
  pause
  exit /b 1
)

if not exist "%PLAYWRIGHT_CLI%" (
  echo Playwright CLI not found:
  echo %PLAYWRIGHT_CLI%
  echo.
  pause
  exit /b 1
)

if not exist "%EDGE_EXE%" (
  echo Edge executable not found:
  echo %EDGE_EXE%
  echo.
  pause
  exit /b 1
)

set /p RUNDECK_CLOUD_ORG=Cloud URL / Cloud Org: 
if "%RUNDECK_CLOUD_ORG%"=="" (
  echo Cloud URL / Cloud Org is required.
  echo.
  pause
  exit /b 1
)

set /p RUNDECK_TICKET_NUMBER=Ticket Number: 
if "%RUNDECK_TICKET_NUMBER%"=="" (
  echo Ticket Number is required.
  echo.
  pause
  exit /b 1
)

echo.
echo Starting Edge with CDP on port %RUNDECK_CDP_PORT%...
start "" "%EDGE_EXE%" --remote-debugging-port=%RUNDECK_CDP_PORT% --user-data-dir="%EDGE_USER_DATA_DIR%" --profile-directory=%EDGE_PROFILE_DIRECTORY% --new-window "%RUNDECK_BASE_URL%"
timeout /t 5 /nobreak >nul

echo Running Rundeck account details job...
echo.

"%NODE_EXE%" "%PLAYWRIGHT_CLI%" test src/runAcloudGetAccountDetails.ts
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo Completed successfully.
) else (
  echo Exited with code %EXIT_CODE%.
)
echo.
pause
exit /b %EXIT_CODE%
