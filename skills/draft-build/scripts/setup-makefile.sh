#!/usr/bin/env bash
# draft-build STEP 5-5: ensure root Makefile has `preview` target.
# Auto-commits the change since Makefile lives outside docs/ui-drafts/
# (draft-lock won't pick it up — separation of concerns).
#
# Result codes (first line of stdout):
#   exists            case 3: ^preview: line already present, no-op
#   committed-create  case 1: Makefile created from template + committed
#   committed-append  case 2 clean: appended snippet + committed
#   skipped-dirty     case 2 dirty: pre-existing changes in Makefile;
#                     template snippet follows after a `---` separator
#                     for manual handling
#
# Exit codes:
#   0  success (any of the four result codes above)
#   1  template missing or other unrecoverable error

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/../templates/Makefile"

if [ ! -f "$TEMPLATE" ]; then
  echo "error: template not found at $TEMPLATE" >&2
  exit 1
fi

if [ -f Makefile ] && grep -q '^preview:' Makefile; then
  echo "exists"
  exit 0
fi

PREEXISTING_DIRTY="$(git status --porcelain Makefile 2>/dev/null || true)"

if [ -f Makefile ]; then
  if [ -n "$PREEXISTING_DIRTY" ]; then
    echo "skipped-dirty"
    echo "---"
    cat "$TEMPLATE"
    exit 0
  fi
  printf '\n' >> Makefile
  cat "$TEMPLATE" >> Makefile
  git add Makefile
  git commit -m "build(draft): add make preview target" >/dev/null
  echo "committed-append"
  exit 0
fi

cp "$TEMPLATE" Makefile
git add Makefile
git commit -m "build(draft): add make preview target" >/dev/null
echo "committed-create"
