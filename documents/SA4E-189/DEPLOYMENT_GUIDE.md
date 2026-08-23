# Deployment Guide - SA4E-189

## Hot-Reload System — Extension Agent List CI/CD Pipeline

---

## 1. Prerequisites

| Requirement | Version | Notes |
|------------|---------|-------|
| Node.js | >=18.14.1 | For extension build |
| VS Code | >=1.85.0 | Engines field |
| `vsce` | >=2.24.0 | Extension packaging |
| Git | 2.30+ | Source checkout |

---

## 2. Local Development Pipeline

### 2.1 Install Dependencies

```bash
cd extension
npm install
```

### 2.2 Available npm Scripts

| Script | Description |
|--------|-------------|
| `npm run esbuild` | Build extension TS to JS |
| `npm run esbuild-production` | Production build |
| `npm run package:prod` | Build + package vsix |
| `npm run lint` | Lint src |

### 2.3 Build Extension

```bash
cd extension
npm run esbuild
npm run package:prod
```

vsix output: `extension/sdlc-agents-4-enterprise-<version>.vsix`

### 2.4 Install to Kiro

```bash
kiro --install-extension extension/sdlc-agents-4-enterprise-1.33.0.vsix
```

Reload Kiro window.

---

## 3. CI/CD Pipeline (GitHub Actions)

```yaml
name: SA4E-189 Extension CI/CD
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18' }
      - run: npm ci --prefix extension
      - run: npm run esbuild --prefix extension
      - run: npm run lint --prefix extension
      - run: npm run package:prod --prefix extension
      - uses: actions/upload-artifact@v4
        with:
          name: vsix
          path: extension/*.vsix
```

---

## 4. Production Deployment

### 4.1 Package

```bash
cd extension
npm run package:prod
```

### 4.2 Distribute

Upload vsix to internal marketplace or share artifact.

### 4.3 Install

Users run `kiro --install-extension <file>.vsix` and reload.

---

## 5. Post-Deployment Verification

1. Open Kiro workspace with `.kiro/agents/`
2. Create/modify/delete agent .md file
3. Verify agent list updates in Chat Panel after ~300ms
4. Verify no console errors

---

## 6. Rollback Procedure

1. Uninstall extension v1.33.0
2. Install previous vsix version
3. Reload Kiro window

---

## 7. Monitoring & Logging

| Metric | Description |
|--------|-------------|
| Watcher active | FileSystemWatcher created/disposed correctly |
| Debounce latency | ~300ms between change and UI update |
| Extension errors | No errors in Kiro Output > SDLC Agents |

---

*Deployment Guide updated for extension-only hot-reload*
