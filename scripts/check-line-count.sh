#!/usr/bin/env bash
# =============================================================================
# SA4E-223 — Line-count gate (BR-18 / AC7)
# -----------------------------------------------------------------------------
# Enforces: every NEW/CHANGED .ts file under backend/src MUST be <= MAX lines.
# Pre-existing large files are NOT flagged (the rule applies to new files only),
# so we only inspect files that are part of the current change set.
#
# Modes:
#   --changed <base>   Check .ts files changed vs <base>..HEAD (CI / PR gate)
#   --staged           Check staged .ts files (pre-commit hook)
#   --all [dir]        Check ALL .ts under <dir> (full audit, informational)
#   --max N            Override max line count (default 200)
#
# Exit code: 0 = pass, 1 = violation(s), 2 = usage error.
# =============================================================================
set -o pipefail

MAX_LINES=200
MODE="changed"
BASE="origin/master"
TARGET_DIR="backend/src"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --changed)
      MODE="changed"
      if [[ $# -ge 2 && "$2" != --* ]]; then BASE="$2"; shift; fi
      ;;
    --staged)  MODE="staged" ;;
    --all)     MODE="all"
      if [[ $# -ge 2 && "$2" != --* ]]; then TARGET_DIR="$2"; shift; fi
      ;;
    --max)     MAX_LINES="$2"; shift ;;
    -h|--help)
      echo "Usage: $0 [--changed <base>] [--staged] [--all <dir>] [--max N]"
      exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

GIT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"

# Resolve the directory to scan
if [[ -n "$GIT_ROOT" ]]; then
  SRC="$GIT_ROOT/$TARGET_DIR"
else
  SRC="$(cd "$(dirname "$0")/../$TARGET_DIR" >/dev/null 2>&1 && pwd)"
fi

echo "== line-count gate (SA4E-223 / BR-18 / AC7) =="
echo "mode=$MODE  max=$MAX_LINES  target=$SRC"

files=()

if [[ "$MODE" == "all" ]]; then
  while IFS= read -r f; do [[ -n "$f" ]] && files+=("$f"); done \
    < <(find "$SRC" -type f -name '*.ts' 2>/dev/null)
elif [[ -n "$GIT_ROOT" ]]; then
  if [[ "$MODE" == "staged" ]]; then
    mapfile -t raw < <(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null)
  else
    mapfile -t raw < <(git diff --name-only "${BASE}...HEAD" --diff-filter=ACMR 2>/dev/null)
  fi
  if [[ ${#raw[@]} -gt 0 ]]; then
    for f in "${raw[@]}"; do
      if [[ "$f" == backend/src/* && "$f" == *.ts ]]; then
        files+=("$GIT_ROOT/$f")
      fi
    done
  fi
else
  # No git available -> fall back to scanning everything (informational)
  while IFS= read -r f; do [[ -n "$f" ]] && files+=("$f"); done \
    < <(find "$SRC" -type f -name '*.ts' 2>/dev/null)
fi

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No changed .ts files under $TARGET_DIR. Gate PASSED."
  exit 0
fi

violations=0
for f in "${files[@]}"; do
  [[ -f "$f" ]] || continue
  n=$(wc -l < "$f" | tr -d ' ')
  if (( n > MAX_LINES )); then
    echo "VIOLATION: $f has $n lines (> $MAX_LINES)"
    violations=$((violations + 1))
  fi
done

if (( violations > 0 )); then
  echo "FAILED: $violations changed file(s) exceed $MAX_LINES lines. (BR-18 / AC7)"
  echo "Split the file into smaller modules (each <= $MAX_LINES lines)."
  exit 1
fi

echo "PASSED: all ${#files[@]} changed file(s) <= $MAX_LINES lines."
exit 0
