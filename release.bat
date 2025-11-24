@echo off
REM Release script for Bando-Fi AI (Windows)

echo ======================================
echo Bando-Fi AI Release Build Script
echo ======================================
echo.

echo Step 1: Installing dependencies...
call npm install --legacy-peer-deps
if %errorlevel% neq 0 exit /b %errorlevel%

echo.
echo Step 2: Building web application...
call npm run build:web
if %errorlevel% neq 0 exit /b %errorlevel%
echo [OK] Web build complete

echo.
echo Step 3: Building Windows executable...
call npm run dist:win
if %errorlevel% neq 0 exit /b %errorlevel%
echo [OK] Windows build complete

echo.
echo Step 4: Syncing mobile platforms...
call npx cap sync
if %errorlevel% neq 0 exit /b %errorlevel%
echo [OK] Mobile platforms synced

echo.
echo Step 5: Building Android APK...
cd android
if exist gradlew.bat (
    call gradlew.bat assembleRelease
    cd ..
    if %errorlevel% neq 0 (
        echo [WARNING] Android build failed or Java not available
    ) else (
        echo [OK] Android APK build complete
    )
) else (
    cd ..
    echo [WARNING] Android project not found. Run 'npx cap add android' first.
)

echo.
echo ======================================
echo Build Summary
echo ======================================
echo.
echo Artifacts created:
echo [OK] Web build: dist/
echo [OK] Windows: release/
dir release\*.exe /b 2>nul
if %errorlevel% neq 0 echo   (no .exe files found)
if exist "android\app\build\outputs\apk\release\app-release-unsigned.apk" (
    echo [OK] Android: android/app/build/outputs/apk/release/app-release-unsigned.apk
)
echo.
echo Next steps:
echo 1. Test all platform builds
echo 2. Sign mobile apps (if not already signed)
echo 3. Create git tag and push
echo 4. Create GitHub release and upload artifacts
echo.
echo ======================================

pause
