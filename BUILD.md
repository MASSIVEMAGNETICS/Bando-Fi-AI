# Build and Release Guide

This document provides comprehensive instructions for building and releasing Bando-Fi AI across multiple platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Web Application](#web-application)
- [Windows Desktop Application](#windows-desktop-application)
- [Android APK](#android-apk)
- [iOS Application](#ios-application)
- [Automated Release Process](#automated-release-process)
- [Environment Variables](#environment-variables)

## Prerequisites

### Common Requirements

- Node.js 20.x or higher
- npm 10.x or higher
- Git

### Platform-Specific Requirements

#### Windows Desktop
- Windows 10/11 (for building on Windows)
- Or any OS with Wine (for cross-compilation)

#### Android
- Java Development Kit (JDK) 17
- Android SDK
- Gradle 8.x

#### iOS
- macOS with Xcode 14+
- CocoaPods
- Apple Developer Account (for distribution)

## Web Application

### Development

```bash
npm install --legacy-peer-deps
npm run dev
```

Access the application at `http://localhost:3000`

### Production Build

```bash
npm run build:web
```

The production build will be created in the `dist/` directory.

### Features
- Progressive Web App (PWA) support
- Service Worker for offline functionality
- Optimized bundle splitting
- Asset caching strategies

### PWA Icons

Before deploying, add PWA icons to the `public/` directory:
- `pwa-192x192.png` - 192x192 icon
- `pwa-512x512.png` - 512x512 icon
- `pwa-512x512-maskable.png` - 512x512 maskable icon (with safe zone)

For maskable icons, ensure important content is within the safe zone (center 80%).

### Deployment

Deploy the contents of the `dist/` directory to any static hosting service:
- Netlify
- Vercel
- AWS S3 + CloudFront
- GitHub Pages
- Firebase Hosting

## Windows Desktop Application

### Development

```bash
npm run electron:dev
```

This will start both the Vite dev server and Electron in development mode.

### Production Build

```bash
npm run dist:win
```

This creates:
- NSIS installer: `Bando-Fi AI-Setup-{version}-x64.exe`
- Portable executable: `Bando-Fi AI-Portable-{version}-x64.exe`

Output location: `release/` directory

### Build Options

```bash
# Build installer only
npm run electron:build:win

# Build for all platforms (requires platform-specific tools)
npm run dist:all

# Create unpacked directory (for testing)
npm run pack
```

### Configuration

Electron Builder configuration is in `package.json` under the `build` section.

#### Custom Icon
Replace `build-resources/icon.ico` with your custom Windows icon (256x256 or higher).

## Android APK

### Setup

1. Install Java JDK 17:
```bash
# Ubuntu/Debian
sudo apt install openjdk-17-jdk

# macOS
brew install openjdk@17
```

2. Install Android SDK or Android Studio

### Development

```bash
# Build web assets and sync to Android
npm run cap:sync:android

# Open in Android Studio
npm run cap:open:android
```

### Production Build

```bash
npm run build:android
```

Output: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

### Signing the APK

1. Create a keystore:
```bash
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

2. Update `capacitor.config.ts` with keystore information

3. Sign the APK:
```bash
cd android
./gradlew assembleRelease
```

### Running on Device

```bash
# Via USB debugging
npm run cap:run:android

# Or manually install
adb install android/app/build/outputs/apk/release/app-release.apk
```

## iOS Application

### Setup

1. Install Xcode from the Mac App Store

2. Install CocoaPods:
```bash
sudo gem install cocoapods
```

3. Configure Apple Developer account in Xcode

### Development

```bash
# Build web assets and sync to iOS
npm run cap:sync:ios

# Open in Xcode
npm run cap:open:ios
```

### Production Build

```bash
npm run build:ios
```

Then in Xcode:
1. Open `ios/App/App.xcworkspace`
2. Select your development team
3. Update bundle identifier if needed
4. Product → Archive
5. Distribute to App Store or export IPA

### Troubleshooting

If you encounter CocoaPods issues:
```bash
cd ios/App
pod deintegrate
pod install
```

## Automated Release Process

### GitHub Actions Workflow

The repository includes automated build workflows for all platforms.

#### Trigger a Release

1. Tag a new version:
```bash
git tag v1.0.0
git push origin v1.0.0
```

2. The workflow will automatically:
   - Build web application
   - Build Windows executables
   - Build Android APK
   - Build iOS archive
   - Create a GitHub release with artifacts

#### Manual Workflow Dispatch

You can also trigger builds manually from the GitHub Actions tab.

### Required GitHub Secrets

Configure these in your repository settings:

- `GEMINI_API_KEY`: Your Google Gemini API key (optional, for build time)
- Add signing keys/certificates for production releases

## Environment Variables

### Development

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_api_key_here
```

### Production

Environment variables can be set:
- At build time (for web deployment)
- In GitHub Secrets (for CI/CD)
- In platform-specific configuration files

## Build Artifacts

After successful builds, you'll find:

```
release/
  ├── Bando-Fi AI-Setup-1.0.0-x64.exe    # Windows installer
  ├── Bando-Fi AI-Portable-1.0.0-x64.exe # Windows portable
  
dist/
  ├── index.html                          # Web application
  ├── assets/                             # Web assets
  ├── manifest.webmanifest               # PWA manifest
  └── sw.js                              # Service worker

android/app/build/outputs/apk/release/
  └── app-release.apk                    # Android APK

ios/App/build/
  └── App.xcarchive                      # iOS archive
```

## Platform-Specific Notes

### Windows
- The app uses Electron for native desktop integration
- Auto-update functionality can be added via electron-updater
- Supports Windows 10 and 11

### Android
- Minimum SDK: 22 (Android 5.1)
- Target SDK: 34 (Android 14)
- Requires HTTPS for security
- Supports ARM64 and x86_64 architectures

### iOS
- Minimum deployment target: iOS 13.0
- Requires valid provisioning profile for distribution
- App Store submission requires compliance review

### Web
- PWA installable on all modern browsers
- Offline functionality via service workers
- Responsive design for mobile and desktop

## Troubleshooting

### Common Issues

1. **Build fails with "out of memory"**
   - Increase Node.js heap size: `export NODE_OPTIONS="--max-old-space-size=4096"`

2. **Electron build fails on macOS**
   - Install Wine for Windows builds: `brew install wine-stable`

3. **Android build fails**
   - Ensure JAVA_HOME is set correctly
   - Clear Gradle cache: `cd android && ./gradlew clean`

4. **iOS build fails**
   - Update CocoaPods: `sudo gem update cocoapods`
   - Clean build folder in Xcode: Product → Clean Build Folder

## Support

For issues or questions:
- Create an issue on GitHub
- Check the documentation in `/docs`
- Review the architecture in `ARCHITECTURE.md`

---

**Massive Magnetics** - Building the future of AI-powered creativity
