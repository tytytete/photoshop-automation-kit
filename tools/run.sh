#!/bin/bash
# Run a Photoshop recipe from the command line (macOS).
#
# Two input modes:
#   1) JSX recipe file  ->  ./tools/run.sh recipes/example_recipe.jsx
#      The file defines a global `RECIPE` and calls RecipeRunner.run(RECIPE).
#
#   2) JSON recipe file ->  ./tools/run.sh recipe.json
#      A plain .json with { input|create, output, operations, ... } — the
#      script wraps it automatically. This is the preferred mode for AI agents.
#
# Optional env vars:
#   PS_APP  — Photoshop app name (default "Adobe Photoshop 2026")
#   REPORT  — path to write a machine-readable document report (JSON)
#
# The script concatenates the core library + runner + your recipe and sends it
# to Photoshop via the AppleScript bridge.

set -euo pipefail

PS_APP="${PS_APP:-Adobe Photoshop 2026}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

CORE="${CORE:-$PROJECT_DIR/src/ps_core.jsx}"
RUNNER="${RUNNER:-$PROJECT_DIR/src/recipe_runner.jsx}"
TEMP_JSX="${TMPDIR:-/tmp}/ps_run_$$.jsx"

usage() {
    echo "Usage: run.sh [--core FILE] [--runner FILE] recipe.jsx|recipe.json"
    echo "  Env: PS_APP, REPORT"
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

[[ -z "$RECIPE" ]] && usage
[[ -f "$RECIPE" ]] || { echo "ERROR: recipe file not found: $RECIPE"; exit 1; }

# Detect JSON recipe and wrap it if needed.
if [[ "$RECIPE" == *.json ]]; then
    WRAP_START="#target photoshop\nvar RECIPE = "
    WRAP_END=";\nif (REPORT && REPORT.length) RECIPE.report = REPORT;\nRecipeRunner.run(RECIPE);"
    RECIPE_BODY="$(cat "$RECIPE")"
else
    WRAP_START=""
    WRAP_END=""
    RECIPE_BODY="$(cat "$RECIPE")"
fi

# Assemble and run.
{
    echo "#target photoshop"
    cat "$CORE"
    echo ""
    cat "$RUNNER"
    echo ""
    echo "var REPORT = \"${REPORT:-}\";"
    if [[ "$RECIPE" == *.json ]]; then
        printf "%b\n" "$WRAP_START"
        echo "$RECIPE_BODY"
        printf "%b\n" "$WRAP_END"
    else
        cat "$RECIPE"
    fi
} > "$TEMP_JSX"

osascript << EOF
set js to read POSIX file "$TEMP_JSX" as «class utf8»
tell application "$PS_APP"
    do javascript js
end tell
EOF
CODE=$?

rm -f "$TEMP_JSX"
exit $CODE