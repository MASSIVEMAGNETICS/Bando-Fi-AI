# Deployment Guide

Enterprise-level deployment guide for Bando-Fi AI across all platforms.

## Production Checklist

Before deploying to production, ensure:

- [ ] All API keys are properly configured
- [ ] Environment variables are set correctly
- [ ] Code signing certificates are in place (Windows, iOS)
- [ ] App icons and splash screens are customized
- [ ] Privacy policy and terms of service are added
- [ ] Analytics and error tracking are configured
- [ ] Security audit has been performed
- [ ] Performance testing completed
- [ ] Backup and recovery procedures are documented

## Platform Deployment

### Web Application (Production)

#### Option 1: Static Hosting (Recommended for PWA)

**Netlify**
```bash
npm run build:web
netlify deploy --prod --dir=dist
```

**Vercel**
```bash
npm run build:web
vercel --prod
```

**AWS S3 + CloudFront**
```bash
npm run build:web
aws s3 sync dist/ s3://your-bucket-name
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

#### Option 2: Docker Container

Create `Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build:web

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and deploy:
```bash
docker build -t bando-fi-ai:latest .
docker run -p 80:80 bando-fi-ai:latest
```

#### Option 3: Kubernetes

See `k8s/` directory for Kubernetes manifests.

### Windows Desktop Application

#### Code Signing

1. Obtain a code signing certificate from a trusted CA
2. Configure in `package.json`:

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/cert.pfx",
      "certificatePassword": "${env.CERT_PASSWORD}"
    }
  }
}
```

3. Build signed executable:
```bash
export CERT_PASSWORD="your_password"
npm run dist:win
```

#### Distribution Methods

**Direct Download**
- Upload to your website or CDN
- Provide installation instructions

**Microsoft Store**
- Requires Windows Store certification
- Use electron-windows-store
- Follow Microsoft Store guidelines

**Auto-Update Setup**

Install electron-updater:
```bash
npm install electron-updater --save
```

Configure in electron/main.js:
```javascript
const { autoUpdater } = require('electron-updater');

autoUpdater.checkForUpdatesAndNotify();
```

### Android Application

#### Google Play Store

1. **Prepare Signed APK**
```bash
# Create release keystore
keytool -genkey -v -keystore release.keystore -alias release -keyalg RSA -keysize 2048 -validity 10000

# Build signed APK
npm run build:android
```

2. **Configure Play Console**
- Create app listing
- Add screenshots and descriptions
- Set content rating
- Configure pricing and distribution

3. **Upload APK**
- Use Google Play Console
- Or use fastlane for automation

4. **Release Management**
- Start with internal testing
- Progress to closed beta
- Then open beta
- Finally, production release

#### Alternative Distribution

**Firebase App Distribution**
```bash
npm install -g firebase-tools
firebase appdistribution:distribute android/app/build/outputs/apk/release/app-release.apk \
  --app YOUR_APP_ID \
  --groups testers
```

**Direct APK Distribution**
- Host on your server
- Users must enable "Install from Unknown Sources"
- Not recommended for production

### iOS Application

#### App Store Distribution

1. **Configure Xcode Project**
```bash
npm run cap:open:ios
```

In Xcode:
- Set Team and Bundle Identifier
- Configure capabilities (Push Notifications, etc.)
- Add app icons and launch screens

2. **Archive Application**
```bash
# Via command line
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath ios/App/build/App.xcarchive \
  archive

# Or in Xcode: Product → Archive
```

3. **Submit to App Store**
- Open Xcode Organizer
- Select archive
- Click "Distribute App"
- Choose "App Store Connect"
- Follow submission wizard

4. **App Store Connect**
- Add app metadata
- Upload screenshots
- Set pricing
- Submit for review

#### TestFlight Distribution

1. Upload to App Store Connect
2. Add external testers
3. Share TestFlight link

#### Enterprise Distribution

For internal company distribution:
- Requires Apple Developer Enterprise Program
- Create In-House provisioning profile
- Distribute IPA via MDM or web server

## Security Configuration

### SSL/TLS Certificates

For web deployment, ensure HTTPS:

**Let's Encrypt (Free)**
```bash
sudo certbot --nginx -d yourdomain.com
```

**Custom Certificate**
- Purchase from trusted CA
- Configure in web server

### API Security

1. **Rate Limiting**
- Implement on API endpoints
- Use services like Cloudflare

2. **API Key Protection**
- Never commit API keys to repository
- Use environment variables
- Rotate keys regularly

3. **Content Security Policy**

Add to `index.html`:
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self' 'unsafe-inline' https://esm.sh; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;">
```

## Monitoring and Analytics

### Error Tracking

**Sentry Integration**
```bash
npm install @sentry/react @sentry/electron
```

Configure in your app:
```javascript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: process.env.NODE_ENV,
  release: "bando-fi-ai@1.0.0"
});
```

### Analytics

**Google Analytics 4**
```javascript
// Add to index.html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
```

**Custom Analytics**
- Track user engagement
- Monitor feature usage
- Analyze performance metrics

## Performance Optimization

### Web

1. **CDN Configuration**
- Use CDN for static assets
- Enable compression (gzip/brotli)
- Configure caching headers

2. **Asset Optimization**
```bash
# Images
npm install -D imagemin imagemin-webp

# CSS
npm install -D cssnano

# JavaScript
# Already handled by Vite
```

3. **Lazy Loading**
- Implement code splitting
- Lazy load images and components
- Use dynamic imports

### Desktop

1. **Bundle Optimization**
- Minimize node_modules in package
- Use asar for faster loading
- Enable compression

2. **Performance Settings**
```javascript
// In electron/main.js
app.commandLine.appendSwitch('disable-gpu-vsync');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
```

### Mobile

1. **APK Size Reduction**
```bash
# Enable ProGuard
# In android/app/build.gradle
buildTypes {
  release {
    minifyEnabled true
    shrinkResources true
  }
}
```

2. **iOS Optimization**
- Enable bitcode
- Use app thinning
- Optimize images with xcassets

## Backup and Recovery

### Database Backups

If using local storage:
```javascript
// Electron
const userDataPath = app.getPath('userData');
// Backup this directory regularly
```

### Configuration Backups

- Version control all configuration
- Document environment variables
- Maintain deployment scripts

## Compliance and Legal

### Privacy Policy

- Add privacy policy link
- Implement GDPR compliance if applicable
- Handle user data responsibly

### Terms of Service

- Define usage terms
- Specify acceptable use
- Include liability disclaimers

### App Store Requirements

- iOS: Add privacy manifest
- Android: Declare permissions
- Both: Content rating questionnaire

## Rollback Procedures

### Web
```bash
# Revert to previous version
git checkout v1.0.0
npm run build:web
# Deploy
```

### Desktop
- Keep previous installers available
- Disable auto-update if needed
- Communicate with users

### Mobile
- Can't rollback published apps
- Submit hotfix update ASAP
- Use staged rollout to limit impact

## Support and Maintenance

### Update Strategy

1. **Semantic Versioning**
- MAJOR.MINOR.PATCH
- Document breaking changes
- Maintain changelog

2. **Release Cadence**
- Hotfixes: As needed
- Minor: Monthly
- Major: Quarterly

3. **Testing Before Release**
- Unit tests
- Integration tests
- User acceptance testing
- Performance testing

### Monitoring Checklist

- [ ] Server uptime (99.9% target)
- [ ] Error rates (<1% target)
- [ ] Response times (<200ms target)
- [ ] User feedback and ratings
- [ ] Crash reports
- [ ] Resource usage

## Disaster Recovery

### Incident Response Plan

1. Detect issue (monitoring alerts)
2. Assess impact and severity
3. Communicate with users
4. Implement fix or rollback
5. Post-mortem analysis
6. Update documentation

### Contact Points

- Technical Lead: [contact info]
- DevOps: [contact info]
- Emergency Hotline: [contact info]

---

**Last Updated**: November 2025  
**Document Version**: 1.0  
**Maintained By**: Massive Magnetics DevOps Team
