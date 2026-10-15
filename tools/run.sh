#!/bin/bash
# Run a Photoshop JSX recipe from the command line (macOS).
# The recipe file must `#target photoshop` and use the PS library.
#
# Usage:
#   ./tools/run.sh recipe.jsx
#   ./tools/run.sh --recipe-src src/ps_core.jsx:src/recipe_runner.jsx --recipe recipes/my.jsx
#
# The script concatenates source files and sends them to Photoshop via osascript.

set -euo pipefail

PS_APP="${PS_APP:-Adobe Photoshop 2026}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default source files (concatenated before the recipe)
CORE="${PROJECT_DIR}/src/ps_core.jsx"
RUNNER="${PROJECT_DIR}/src/recipe_runner.jsx"

TEMP_JSX="${TMPDIR:-/tmp}/ps_run_$$.jsx"

usage() {
    echo "Usage: run.sh [--core FILE] [--runner FILE] recipe.jsx"
    echo "  Concatenates core + runner + recipe and executes in Photoshop."
    exit 1
}

RECIPE=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --core)    CORE="$2";    shift 2 ;;
        --runner)  RUNNER="$2";  shift 2 ;;
        -h|--help) usage ;;
        *)         RECIPE="$1";  shift ;;
    esac
done

if [[ -z "$RECIPE" ]]; then
    usage
fi

if [[ ! -f "$RECIPE" ]]; then
    echo "ERROR: recipe file not found: $RECIPE"
    exit 1
fi

# Concatenate: core + runner + recipe
{
    cat "$CORE"
    echo ""
    cat "$RUNNER"
    echo ""
    cat "$RECIPE"
} > "$TEMP_JSX"

# Send to Photoshop
osascript << EOF
set js to read POSIX file "$TEMP_JSX" as «class utf8»
tell application "$PS_APP"
    do javascript js
end tell
EOF
CODE=$?

rm -f "$TEMP_JSX"
exit $CODE