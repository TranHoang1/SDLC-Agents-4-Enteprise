# Release & Versioning Rules

## Mandatory: Bump ALL publishable module versions BEFORE tagging

| Module | File | Registry |
|---|---|---|
| Node.js Bridge | `mcp-client-bridge/package.json` → "version" | npm |
| Python Bridge | `mcp-bridge-python/pyproject.toml` → version | PyPI |
| Kotlin Server | `build.gradle.kts` → version | GitHub Release |

## Release process (DevOps + SM)

1. **Bump versions** — all modules must have new version
2. **Run tests locally** — `npm test` (bridge), `gradlew test` (server)
3. **Commit version bumps** — `chore: bump versions to X.Y.Z`
4. **Create tag** — `git tag vX.Y.Z -m "..."`
5. **Push** — `git push origin master --tags`
6. **Monitor CI** — `gh run watch`

## Version format

- Major: `v1.2.0` → bump all modules
- Patch: `v1.2.1` → bump only changed modules

## ⛔ NEVER

- Create tag without bumping versions
- Push tag when tests haven't passed locally
- Delete + recreate tag > 2 times (if fail twice → stop, debug)

## CI failure recovery

1. `gh run view --log-failed`
2. Fix locally, run tests
3. Commit fix
4. Delete old tag: `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`
5. Recreate + push