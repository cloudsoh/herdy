#!/bin/bash
set -e

LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)")
TODAY=$(date +%Y-%m-%d)

if [[ -z "$LAST_TAG" ]]; then
  COMMITS=$(git log --oneline | head -30)
else
  COMMITS=$(git log "$LAST_TAG"..HEAD --oneline)
fi

if [[ -z "$COMMITS" ]]; then
  echo "No commits since $LAST_TAG — skipping changelog generation"
  exit 0
fi

echo "Generating changelog entry (current: $CURRENT_VERSION, since: ${LAST_TAG:-beginning})..."
echo ""

claude -p "You are updating CHANGELOG.md for the herdy npm CLI package (a multi-service local dev environment manager).

Current version in package.json: $CURRENT_VERSION
Today's date: $TODAY
Last release tag: ${LAST_TAG:-none}

Commits since last tag:
$COMMITS

Task:
1. Read CHANGELOG.md to understand the existing format.
2. Determine the next version: patch bump unless commits clearly introduce a new feature (minor) or breaking change (major).
3. Prepend a new ## [X.Y.Z] - $TODAY section immediately after the '# Changelog' header line, before any existing entries.
4. Use ### Added, ### Fixed, ### Changed subsections as needed. One line per item. Be concise and factual — describe the change, not the implementation.
5. Write the updated CHANGELOG.md. Do not output anything else."
