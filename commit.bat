@echo off
cd /d "%USERPROFILE%\Documents\ggpogo-event-tools"

if "%~1"=="" (
    echo ERROR: You must provide a version, e.g. commit.bat v2.12.25 "Description here"
    pause
    exit /b 1
)
if "%~2"=="" (
    echo ERROR: You must provide a description, e.g. commit.bat v2.12.25 "Description here"
    pause
    exit /b 1
)

set VERSION=%~1
set DESC=%~2

echo.
echo ===============================
echo  Version:     %VERSION%
echo  Description: %DESC%
echo ===============================
echo.

git add .
git commit -m "%VERSION%: %DESC%"
if errorlevel 1 (
    echo.
    echo Commit failed or nothing to commit. Stopping before push.
    pause
    exit /b 1
)

git tag %VERSION%
git push
git push origin %VERSION%

echo.
echo Done. %VERSION% committed, tagged, and pushed.
pause