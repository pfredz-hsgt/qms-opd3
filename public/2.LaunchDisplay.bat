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
  "http://10.77.232.20/qms/display?kiosk=true"

