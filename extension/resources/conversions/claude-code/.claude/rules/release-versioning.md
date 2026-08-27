# Release & Versioning Rules

## Mandatory rules before creating release tag

### Bump ALL publishable module versions BEFORE tagging:

| Module | File | Registry |
|---|---|---|
| Extension | `extension/package.json` → "version" | VS Code Marketplace |
| Backend | `backend/package.json` → "version" | npm |
| Python Services | `backend/servers/fastapi/pyproject.toml` → version | PyPI |

### Release process (DevOps + SM):

1. **Bump versions** — all modules must have new version (npm/PyPI rejects duplicate)
2. **Run tests locally** — `npm test` (backend + extension) with Vitest
3. **Commit version bumps** — `chore: bump versions to X.Y.Z for release`
4. **Create tag** — `git tag vX.Y.Z -m "description"`
5. **Push** — `git push origin master --tags`
6. **Monitor CI** — `gh run watch` — if fail, fix immediately

### Version format:

- Major release: `v1.2.0` → bump all modules
- Patch release: `v1.2.1` → bump only changed modules
- Module versions need NOT match project version, just > previous published

### ⛛ NEVER:

- Create tag without bumping module versions
- Push tag when tests haven't passed locally
- Delete + recreate tag more than 2 times (if fail twice → stop, debug root cause)

### CI failure recovery:

1. `gh run view --log-failed` — see error
2. Fix locally, run tests
3. Commit fix
4. Delete old tag: `git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`
5. Recreate: `git tag vX.Y.Z -m "..."`
6. Push: `git push origin master --tags`