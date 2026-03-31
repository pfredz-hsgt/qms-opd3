@echo off
REM === Step 3: Open Edge staff panel in app mode with custom profile ===

set "edgePath=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "profileDir=C:\Temp\EdgeKioskProfile"
set "profileName=MyProfile"
set "url=http://10.78.115.21:5000/"

REM Create profile directory if it doesn't exist
if not exist "%profileDir%" mkdir "%profileDir%"

REM Launch Edge in app mode and immediately close this window
start "" "%edgePath%" --app="%url%" --user-data-dir="%profileDir%" --profile-directory="%profileName%"
ECHO ] Successfully loaded QMS Panel!
ECHO.
ECHO  This command window will now close!
TIMEOUT /T 2 >nul
