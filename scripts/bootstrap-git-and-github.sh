#!/usr/bin/env bash
set -euo pipefail

# Run this in your normal macOS terminal (not the Cursor sandboxed runner).
# 1) Fixes invalid `gh` tokens: https://cli.github.com/manual/gh_auth_login
# 2) Initializes git and creates a private GitHub repo + pushes.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: https://cli.github.com/"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated. Run:"
  echo "  gh auth login -h github.com"
  exit 1
fi

if [[ ! -f README.md ]]; then
  echo "Missing README.md"
  exit 1
fi

if [[ ! -d .git ]]; then
  git init -b main
fi

git add -A
if git diff --cached --quiet; then
  echo "Nothing to commit (already committed)."
else
  git commit -m "Initial commit"
fi

REPO_NAME="${1:-beacon-oncall}"

# Create private repo from existing folder and push (GitHub CLI).
gh repo create "${REPO_NAME}" --private --source=. --remote=origin --push

echo "Done. Remote:"
git remote -v
