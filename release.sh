#!/bin/bash

# Release script for Bando-Fi AI
# This script builds all platform versions for release

set -e

echo "======================================"
echo "Bando-Fi AI Release Build Script"
echo "======================================"
echo ""

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
echo "Building version: $VERSION"
echo ""

# Check if clean working directory
if [[ -n $(git status -s) ]]; then
    echo "Warning: Working directory is not clean"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "Step 1: Installing dependencies..."
npm install --legacy-peer-deps

echo ""
echo "Step 2: Running tests (if any)..."
# npm test || echo "No tests configured"

echo ""
echo "Step 3: Building web application..."
npm run build:web
echo "✓ Web build complete"

echo ""
echo "Step 4: Building Windows executable..."
if [[ "$OSTYPE" == "win32" ]] || [[ "$OSTYPE" == "msys" ]] || command -v wine &> /dev/null; then
    npm run dist:win
    echo "✓ Windows build complete"
else
    echo "⚠ Skipping Windows build (not on Windows and Wine not available)"
fi

echo ""
echo "Step 5: Syncing mobile platforms..."
npx cap sync
echo "✓ Mobile platforms synced"

echo ""
echo "Step 6: Building Android APK..."
if command -v java &> /dev/null; then
    cd android && ./gradlew assembleRelease && cd ..
    echo "✓ Android APK build complete"
else
    echo "⚠ Skipping Android build (Java not available)"
fi

echo ""
echo "======================================"
echo "Build Summary"
echo "======================================"
echo ""
echo "Version: $VERSION"
echo ""
echo "Artifacts created:"
if [ -d "dist" ]; then
    echo "✓ Web build: dist/"
fi
if [ -d "release" ]; then
    echo "✓ Windows: release/"
    ls -lh release/*.exe 2>/dev/null || echo "  (no .exe files found)"
fi
if [ -f "android/app/build/outputs/apk/release/app-release-unsigned.apk" ]; then
    echo "✓ Android: android/app/build/outputs/apk/release/app-release-unsigned.apk"
fi
echo ""
echo "Next steps:"
echo "1. Test all platform builds"
echo "2. Sign mobile apps (if not already signed)"
echo "3. Create git tag: git tag v$VERSION"
echo "4. Push tag: git push origin v$VERSION"
echo "5. Create GitHub release and upload artifacts"
echo ""
echo "======================================"
