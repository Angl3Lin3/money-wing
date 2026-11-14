@echo off
rem Double-click this file to start MoneyWing on a Windows computer.
rem It sets things up the first time, starts the server, then the app.
rem To stop everything, close this window and the "MoneyWing server" window.
setlocal
cd /d "%~dp0"
title MoneyWing

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. Download the LTS version from https://nodejs.org,
  echo install it, then double-click this file again.
  echo.
  pause
  exit /b 1
)

if exist backend\.env goto haveenv
echo.
echo First-time setup: creating the settings file.
echo.
echo Which email will you use as the owner of the app?
echo (Sign up in the app with this same email to open the owner area.)
set /p "OWNER_EMAIL=Owner email: "
echo.
echo Type the password you chose when you installed PostgreSQL.
set /p "PG_PASS=PostgreSQL password: "
node backend\scripts\create-env.js "%OWNER_EMAIL%" "%PG_PASS%"
if errorlevel 1 goto fail
:haveenv

echo.
echo Installing what the app needs. The first time takes several minutes...
pushd backend
call npm install
if errorlevel 1 goto fail
popd
pushd frontend
call npm install
if errorlevel 1 goto fail
popd

echo.
echo Getting the database ready...
pushd backend
call npx prisma migrate deploy
if errorlevel 1 goto dbfail
call npx prisma generate >nul
popd

echo.
echo Starting the server in a second window...
start "MoneyWing server" /D "%~dp0backend" cmd /k npm run dev
timeout /t 5 /nobreak >nul

echo.
echo Starting the app. It opens in your web browser.
echo Sign-up codes appear in the "MoneyWing server" window.
echo To test on a phone, scan the QR code below with Expo Go.
echo.
cd frontend
call npx expo start --web
goto end

:dbfail
popd
echo.
echo Could not reach the database. Check that PostgreSQL is installed.
echo If the password was typed wrong, delete the file ".env" inside the
echo "backend" folder, then double-click this file again.
echo.
pause
exit /b 1

:fail
echo.
echo Something went wrong. Take a photo of this window and send it to the developer.
echo.
pause
exit /b 1

:end
endlocal
