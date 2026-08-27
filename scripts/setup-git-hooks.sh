#!/usr/bin/env bash
# Installs the SA4E-223 pre-commit hook into .git/hooks WITHOUT requiring husky.
# Run once after cloning: bash scripts/setup-git-hooks.sh
set -e
ROOT="$(git rev-parse --show-toplevel)"
HOOK="$ROOT/.git/hooks/pre-commit"
mkdir -p "$(dirname "$HOOK")"
cp "$ROOT/.husky/pre-commit" "$HOOK"
chmod +x "$HOOK"
echo "pre-commit hook installed at $HOOK"
