# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Bando-Fi AI seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do Not Publicly Disclose

Please do not publicly disclose the vulnerability until we've had a chance to address it.

### 2. Report Privately

Send details to:
- **Email**: security@massivemagnetics.com (if available)
- **GitHub Security Advisory**: Use the "Security" tab in this repository

### 3. Include Details

Your report should include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information

### 4. Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: 90 days

## Security Measures

### Application Security

#### Web Application
- Content Security Policy (CSP) headers
- HTTPS enforcement in production
- Secure cookie handling
- XSS protection
- Input validation and sanitization

#### Desktop (Electron)
- Context isolation enabled
- Node integration disabled in renderer
- Preload scripts for IPC
- Secure external link handling
- Code signing (when configured)

#### Mobile (iOS/Android)
- HTTPS-only networking
- Secure storage for sensitive data
- Platform permission management
- Certificate pinning (recommended)
- ProGuard/R8 (Android)

### API Security

#### API Keys
- Never commit API keys to repository
- Use environment variables
- Rotate keys regularly
- Implement rate limiting

#### Network Security
- TLS/SSL for all communications
- Certificate validation
- Secure headers
- CORS configuration

### Build Security

#### Dependencies
- Regular dependency updates
- Vulnerability scanning (npm audit)
- Minimal dependency tree
- Trusted sources only

#### Code Signing
- Windows: Authenticode signing
- macOS: Developer ID signing
- iOS: App Store signing
- Android: APK signing

## Security Best Practices

### For Developers

1. **Keep Dependencies Updated**
   ```bash
   npm audit
   npm audit fix
   ```

2. **Use Environment Variables**
   ```bash
   # Never do this
   const API_KEY = "abc123...";
   
   # Do this instead
   const API_KEY = process.env.GEMINI_API_KEY;
   ```

3. **Validate Input**
   ```typescript
   // Validate and sanitize all user input
   function sanitizeInput(input: string): string {
     return input.trim().replace(/[<>]/g, '');
   }
   ```

4. **Secure IPC (Electron)**
   ```javascript
   // Use contextBridge in preload
   contextBridge.exposeInMainWorld('api', {
     // Expose only what's needed
   });
   ```

### For Users

1. **Download from Official Sources**
   - GitHub Releases
   - Official website
   - Verified app stores

2. **Verify Signatures**
   - Check code signatures on downloads
   - Verify checksums when provided

3. **Keep Updated**
   - Install security updates promptly
   - Enable auto-update when available

4. **Use Strong API Keys**
   - Don't share API keys
   - Use separate keys for dev/prod
   - Monitor key usage

## Security Checklist

Before each release:

- [ ] Run security audit (`npm audit`)
- [ ] Update dependencies with known vulnerabilities
- [ ] Review and update CSP headers
- [ ] Verify API keys are not exposed
- [ ] Test authentication/authorization
- [ ] Verify HTTPS enforcement
- [ ] Test input validation
- [ ] Review error messages (no sensitive info)
- [ ] Check file upload restrictions
- [ ] Verify secure cookie settings
- [ ] Test CSP and security headers
- [ ] Run OWASP ZAP or similar scanner
- [ ] Code review for security issues
- [ ] Sign builds with valid certificates

## Known Security Considerations

### API Key Handling

The application requires a Gemini API key. Users must:
- Obtain their own API key
- Store it securely
- Never commit it to version control
- Use environment variables

### Web Application

- Service worker caches may store sensitive data
- Clear cache when logging out
- Use private browsing for sensitive operations

### Desktop Application

- User data stored in app data directory
- Encrypt sensitive files
- Clear data on uninstall (optional)

### Mobile Applications

- Platform keychain/keystore for secrets
- Biometric authentication (future enhancement)
- Secure app lifecycle management

## Compliance

### Data Privacy

- GDPR compliant (minimal data collection)
- User data stays local by default
- Clear privacy policy
- Data export capabilities

### Platform Requirements

- **iOS**: Privacy manifest required
- **Android**: Permission declarations required
- **Web**: Cookie consent (if applicable)

## Third-Party Services

### Google Gemini API

- Review Google's security guidelines
- Follow API best practices
- Monitor usage and quotas
- Implement error handling

### ESM.sh CDN

- Verify package integrity
- Use subresource integrity (SRI) when possible
- Have fallback mechanisms

## Incident Response

In case of a security incident:

1. **Assess Impact**
   - Determine scope and severity
   - Identify affected versions

2. **Contain**
   - Patch vulnerability
   - Prepare hotfix release

3. **Communicate**
   - Notify affected users
   - Publish security advisory
   - Update documentation

4. **Remediate**
   - Release patched version
   - Monitor deployment
   - Verify fix effectiveness

5. **Post-Mortem**
   - Document incident
   - Improve processes
   - Update security measures

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [React Security Best Practices](https://reactjs.org/docs/dom-elements.html#dangerouslysetinnerhtml)
- [Capacitor Security](https://capacitorjs.com/docs/guides/security)

## Contact

For security concerns:
- GitHub Security Advisories
- Email: security@massivemagnetics.com

---

**Last Updated:** November 23, 2025  
**Version:** 1.0.0
