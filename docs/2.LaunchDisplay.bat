@echo off

:: 1. Launch Chrome immediately in a separate process.
:: The START command is what lets the script continue running.
START "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --user-data-dir="C:\ChromeKiosk" ^
  --kiosk ^
  --window-position=1920,0 ^
  --autoplay-policy=no-user-gesture-required ^
  --no-first-run ^
  --disable-infobars ^
  --disable-session-crashed-bubble ^
  "http://10.78.115.21:5000/display?kiosk=true"

:: 2. Clear the screen and display the loading animation.
CLS
ECHO.
ECHO  Starting up QMS OPD Display in Kiosk Mode..
<nul set /p "=  Status: ["

:: This loop pauses for 1 second, 5 times.
FOR /L %%i IN (1,1,5) DO (
    <nul set /p "=###"
    TIMEOUT /T 1 /NOBREAK >nul
)

:: 3. Finish the animation and close the window.
ECHO ] Successfully loaded QMS Display!
ECHO.
ECHO  This command window will now close!
TIMEOUT /T 2 >nul
