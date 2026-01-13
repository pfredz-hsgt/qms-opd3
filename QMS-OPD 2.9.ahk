#Requires AutoHotkey v2.0+

; === Step 1: Run Flask server ===
batFile := A_ScriptDir "\1.Start-Server.bat"
Run(batFile)
Sleep 3000  ; wait for server to start

; === Step 2: Run patient display script ===
batFile2 := A_ScriptDir "\2.LaunchDisplay.bat"
Run(batFile2)
Sleep 2000  ; wait for server to start

; === Step 3: Open Edge staff panel in app mode with custom profile ===
batFile3 := A_ScriptDir "\3.LaunchPanel.bat"
Run(batFile3)
Sleep 2000  ; wait for server to start


WinWaitActive "ahk_exe msedge.exe"
WinMove 0, 0, 1280, 800, "ahk_exe msedge.exe"
Sleep 500
WinMaximize "ahk_exe msedge.exe"