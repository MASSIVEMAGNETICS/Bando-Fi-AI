# Contributing to Bando-Fi AI

Thank you for your interest in contributing to Bando-Fi AI! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Building and Testing](#building-and-testing)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Help maintain a positive environment

## Getting Started

1. **Fork the repository**
   ```bash
   # Click the "Fork" button on GitHub
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Bando-Fi-AI.git
   cd Bando-Fi-AI
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/MASSIVEMAGNETICS/Bando-Fi-AI.git
   ```

4. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

5. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Web Development

```bash
npm run dev
```

Access at `http://localhost:3000`. Changes auto-reload.

### Desktop Development

```bash
npm run electron:dev
```

Both Vite and Electron will run with hot reload.

### Mobile Development

```bash
# Android
npm run cap:sync:android
npm run cap:open:android

# iOS
npm run cap:sync:ios
npm run cap:open:ios
```

## Building and Testing

### Build All Platforms

```bash
# Web
npm run build:web

# Windows
npm run dist:win

# Android
npm run build:android

# iOS
npm run build:ios
```

### Run Tests

```bash
# Add tests as appropriate
npm test
```

## Pull Request Process

1. **Update your branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Make your changes**
   - Write clean, documented code
   - Follow existing code style
   - Add tests if applicable
   - Update documentation

3. **Test your changes**
   - Build on all platforms you've modified
   - Test functionality thoroughly
   - Check for console errors
   - Verify responsive design (if UI changes)

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create Pull Request**
   - Go to GitHub and create PR
   - Fill out the PR template
   - Link related issues
   - Request review

7. **Address feedback**
   - Respond to review comments
   - Make requested changes
   - Push updates to same branch

## Coding Standards

### TypeScript/JavaScript

- Use TypeScript for type safety
- Follow existing code patterns
- Use meaningful variable names
- Add JSDoc comments for complex functions
- Avoid `any` types when possible

```typescript
// Good
interface GenerateOptions {
  prompt: string;
  resolution: 'low' | 'standard' | 'high';
}

function generate(options: GenerateOptions): Promise<Result> {
  // Implementation
}

// Avoid
function generate(options: any): any {
  // Implementation
}
```

### React Components

- Use functional components
- Implement proper prop types
- Follow hooks rules
- Keep components focused and single-purpose

```tsx
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
```

### File Organization

```
src/
  ├── components/     # React components
  ├── models/         # AI models
  ├── utils/          # Utility functions
  ├── types/          # TypeScript types
  └── styles/         # CSS/styling
```

### CSS/Styling

- Use CSS custom properties (variables)
- Follow existing color scheme
- Maintain responsive design
- Support dark mode (already implemented)

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes

### Examples

```bash
# Feature
git commit -m "feat(ui): add image preview component"

# Bug fix
git commit -m "fix(electron): resolve window creation issue on Linux"

# Documentation
git commit -m "docs(readme): update build instructions"

# Breaking change
git commit -m "feat(api)!: change response format

BREAKING CHANGE: API responses now include metadata object"
```

## Platform-Specific Guidelines

### Electron (Desktop)

- Test on Windows, macOS, and Linux if possible
- Use IPC for renderer-main communication
- Follow security best practices
- Keep main process minimal

### Capacitor (Mobile)

- Test on real devices when possible
- Follow platform guidelines (Material Design, Human Interface)
- Handle permissions properly
- Consider offline functionality

### Web/PWA

- Ensure offline functionality works
- Test service worker updates
- Validate manifest.json
- Check responsive design on multiple devices

## Documentation

Update documentation when:

- Adding new features
- Changing APIs
- Modifying build process
- Updating dependencies
- Changing configuration

Files to update:
- README.md - General information
- BUILD.md - Build instructions
- DEPLOYMENT.md - Deployment procedures
- CHANGELOG.md - Version changes
- Code comments - Complex logic

## Questions?

- Open an issue for bugs
- Use discussions for questions
- Tag maintainers for urgent issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Bando-Fi AI! 🚀
