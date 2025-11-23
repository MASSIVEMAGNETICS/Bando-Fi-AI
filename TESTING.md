# Testing Guide

Comprehensive testing procedures for all platforms of Bando-Fi AI.

## Pre-Build Testing

### Environment Setup

```bash
# Verify Node.js version
node --version  # Should be 20.x or higher

# Verify npm version
npm --version   # Should be 10.x or higher

# Install dependencies
npm install --legacy-peer-deps

# Verify installation
npm list --depth=0
```

## Platform Testing

### Web Application

#### Development Testing

```bash
# Start dev server
npm run dev

# Open browser to http://localhost:3000
# Test checklist:
# ✓ Page loads without errors
# ✓ All features are accessible
# ✓ No console errors
# ✓ Responsive design works on mobile/tablet/desktop
# ✓ Dark mode theme is applied
```

#### Production Build Testing

```bash
# Build for production
npm run build:web

# Preview production build
npm run preview

# Open browser to http://localhost:4173
# Test checklist:
# ✓ All assets load correctly
# ✓ Service worker is registered
# ✓ PWA manifest is valid
# ✓ Offline functionality works
# ✓ Install prompt appears (on supported browsers)
```

#### PWA Testing

1. **Install PWA**
   - Chrome: Click install icon in address bar
   - Edge: Click install app from menu
   - Safari: Add to Home Screen

2. **Test Offline**
   - Open DevTools → Application → Service Workers
   - Check "Offline"
   - Reload page - should work offline

3. **Test Caching**
   - Open DevTools → Application → Cache Storage
   - Verify assets are cached
   - Check workbox cache entries

#### Docker Testing

```bash
# Build Docker image
docker build -t bando-fi-ai:test .

# Run container
docker run -p 8080:80 bando-fi-ai:test

# Test at http://localhost:8080
# Verify health endpoint: http://localhost:8080/health

# Stop container
docker stop $(docker ps -q --filter ancestor=bando-fi-ai:test)
```

### Windows Desktop Application

#### Development Testing

```bash
# Start Electron in dev mode
npm run electron:dev

# Test checklist:
# ✓ Window opens correctly
# ✓ Application loads without errors
# ✓ Window controls work (minimize, maximize, close)
# ✓ Menu bar is hidden (auto-hide enabled)
# ✓ External links open in browser
# ✓ IPC communication works
# ✓ DevTools can be opened (in dev mode)
```

#### Production Build Testing

```bash
# Build Windows executable
npm run dist:win

# Test checklist:
# ✓ Installer is created in release/ directory
# ✓ Portable executable is created
# ✓ File sizes are reasonable (~150-200MB)
```

#### Installation Testing (Windows Required)

1. **Installer Test**
   - Run the NSIS installer (.exe)
   - Choose installation directory
   - Complete installation
   - Verify desktop shortcut created
   - Verify start menu entry created
   - Launch application
   - Test all features

2. **Portable Test**
   - Run portable .exe
   - Verify no installation required
   - Test all features
   - Check if settings persist

3. **Uninstall Test**
   - Run uninstaller from Control Panel
   - Verify clean removal
   - Check if user data persists (should ask during uninstall)

### Android Application

#### Prerequisites

```bash
# Verify Java installation
java -version  # Should be JDK 17

# Verify JAVA_HOME
echo $JAVA_HOME

# Verify Android SDK (if using command line)
which adb
```

#### Build Testing

```bash
# Build web assets and sync
npm run build
npx cap sync android

# Test checklist:
# ✓ Android project is created/updated
# ✓ Web assets are copied to android/app/src/main/assets/public
# ✓ Capacitor config is generated
# ✓ No Gradle errors
```

#### Android Studio Testing

```bash
# Open in Android Studio
npm run cap:open:android

# In Android Studio:
# 1. Wait for Gradle sync to complete
# 2. Build → Make Project (Ctrl+F9)
# 3. Run → Run 'app' (Shift+F10)

# Test checklist:
# ✓ App launches on emulator/device
# ✓ Splash screen displays
# ✓ All features work
# ✓ Network requests succeed
# ✓ HTTPS is enforced
# ✓ No runtime errors in Logcat
```

#### APK Testing

```bash
# Build release APK
npm run build:android

# Install on device
adb install android/app/build/outputs/apk/release/app-release-unsigned.apk

# Test checklist:
# ✓ APK installs successfully
# ✓ App launches
# ✓ All features work
# ✓ No crashes
# ✓ Performance is acceptable
```

#### Device Testing Matrix

Test on:
- [ ] Android 5.1 (API 22) - minimum version
- [ ] Android 8.0 (API 26) - mid-range
- [ ] Android 12+ (API 31+) - latest
- [ ] Different screen sizes (phone, tablet)
- [ ] Different manufacturers (Samsung, Google, etc.)

### iOS Application

#### Prerequisites

```bash
# Verify Xcode installation (macOS only)
xcode-select --version

# Verify CocoaPods
pod --version

# Install CocoaPods if needed
sudo gem install cocoapods
```

#### Build Testing

```bash
# Build web assets and sync
npm run build
npx cap sync ios

# Install CocoaPods dependencies
cd ios/App && pod install && cd ../..

# Test checklist:
# ✓ iOS project is created/updated
# ✓ Web assets are copied
# ✓ Pods are installed
# ✓ Workspace is ready
```

#### Xcode Testing

```bash
# Open in Xcode
npm run cap:open:ios

# In Xcode:
# 1. Select development team
# 2. Choose simulator (iPhone 14 Pro recommended)
# 3. Product → Build (⌘B)
# 4. Product → Run (⌘R)

# Test checklist:
# ✓ Project builds without errors
# ✓ App launches in simulator
# ✓ All features work
# ✓ UI adapts to safe areas
# ✓ No warnings or errors
```

#### Device Testing (Requires Apple Developer Account)

1. Connect iOS device
2. Select device in Xcode
3. Build and run
4. Trust certificate on device
5. Test all features

#### TestFlight Testing

1. Archive app (Product → Archive)
2. Upload to App Store Connect
3. Add testers
4. Install via TestFlight app
5. Test on real devices

#### Device Testing Matrix

Test on:
- [ ] iOS 13.0 - minimum version
- [ ] iOS 15.0 - mid-range
- [ ] iOS 17+ - latest
- [ ] Different devices (iPhone SE, 14, 15 Pro Max)
- [ ] iPad (if supported)

## Cross-Platform Feature Testing

### Core Features

Test on all platforms:

- [ ] **Image Generation**
  - [ ] Prompt input works
  - [ ] Image generates successfully
  - [ ] Results display correctly
  - [ ] Download/save works

- [ ] **Image Blending**
  - [ ] Upload multiple images
  - [ ] Blend operation completes
  - [ ] Result is correct

- [ ] **Face Swapping**
  - [ ] Upload source and target
  - [ ] Face swap completes
  - [ ] Quality is acceptable

- [ ] **Inpainting**
  - [ ] Upload image
  - [ ] Select area to edit
  - [ ] Generate inpainted result

- [ ] **Text-to-Video**
  - [ ] Input text description
  - [ ] Video generates
  - [ ] Playback works

- [ ] **Style Transfer**
  - [ ] Upload content image
  - [ ] Select style
  - [ ] Transfer completes

### UI/UX Testing

- [ ] **Responsive Design**
  - [ ] Mobile (320px - 768px)
  - [ ] Tablet (768px - 1024px)
  - [ ] Desktop (1024px+)

- [ ] **Theme**
  - [ ] Dark mode applies correctly
  - [ ] Colors match design (lime green #39ff14, pink #ff00ff)
  - [ ] Text is readable
  - [ ] Contrast is sufficient

- [ ] **Navigation**
  - [ ] All buttons work
  - [ ] Forms validate correctly
  - [ ] Error messages display
  - [ ] Loading states show

### Performance Testing

```bash
# Lighthouse testing (Web)
npx lighthouse http://localhost:4173 --view

# Target scores:
# Performance: > 90
# Accessibility: > 90
# Best Practices: > 90
# SEO: > 90
# PWA: 100
```

### Security Testing

- [ ] **API Keys**
  - [ ] Not exposed in client code
  - [ ] Environment variables work
  - [ ] No keys in console/network tab

- [ ] **HTTPS**
  - [ ] Mobile apps enforce HTTPS
  - [ ] Web served over HTTPS in production
  - [ ] No mixed content warnings

- [ ] **Input Validation**
  - [ ] XSS protection
  - [ ] SQL injection protection (if applicable)
  - [ ] File upload validation

## Automated Testing

### Unit Tests (To Be Implemented)

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage
```

### E2E Tests (To Be Implemented)

```bash
# Run E2E tests
npm run test:e2e

# Run in headless mode
npm run test:e2e:headless
```

## CI/CD Testing

### GitHub Actions

1. **Trigger Workflow**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Monitor Build**
   - Go to Actions tab on GitHub
   - Watch build progress
   - Check for errors

3. **Verify Artifacts**
   - Download build artifacts
   - Test each platform build
   - Verify file integrity

## Bug Reporting

When reporting bugs, include:

1. **Environment**
   - Platform (Web/Windows/Android/iOS)
   - OS version
   - Browser/device (if applicable)
   - App version

2. **Steps to Reproduce**
   - Detailed steps
   - Expected behavior
   - Actual behavior
   - Screenshots/videos

3. **Console Output**
   - JavaScript console errors
   - Network errors
   - Build errors

## Performance Benchmarks

### Target Metrics

| Metric | Target | Platform |
|--------|--------|----------|
| Time to Interactive | < 3s | Web |
| First Contentful Paint | < 1.5s | Web |
| Cold Start | < 3s | Mobile |
| Memory Usage | < 200MB | Desktop |
| APK Size | < 50MB | Android |
| IPA Size | < 100MB | iOS |

### Monitoring

```bash
# Check bundle sizes (Web)
npm run build -- --mode analyze

# Check APK size (Android)
ls -lh android/app/build/outputs/apk/release/*.apk

# Memory profiling (use platform-specific tools)
# - Chrome DevTools (Web)
# - Task Manager (Windows)
# - Android Studio Profiler (Android)
# - Instruments (iOS)
```

## Test Results Documentation

Create test report with:
- Date and version tested
- Platform tested
- Test results (pass/fail)
- Issues found
- Performance metrics
- Screenshots

---

**Last Updated:** November 23, 2025  
**Version:** 1.0.0
