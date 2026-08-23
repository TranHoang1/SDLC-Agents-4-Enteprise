# Deployment Guide (DPG)

## SA4E-188 Skill Auto-Activation

### Deploy to Kiro for UAT

1. Ensure backend server running: `npx sdlc-agent-4-enterprise-server`
2. Build extension: `cd extension && npm ci && npm run esbuild`
3. Install extension in Kiro: `kiro --install-extension sdlc-agents-4-enterprise-1.32.0.vsix`
4. Inject agents: `@sm-agent SA4E-188 status`
5. Verify skill auto-activation, slash command, preload in Kiro chat

### Rollback

Revert to previous extension version.
