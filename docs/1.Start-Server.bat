@echo off
:loop
Python app.py
if errorlevel 1 goto loop
pause