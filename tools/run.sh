#!/bin/bash
# Run a Photoshop recipe from the command line (macOS).
#
# Input modes:
#   1) JSX recipe file  ->  ./tools/run.sh recipes/example_recipe.jsx
#      The file defines a global `RECIPE` and calls RecipeRunner.run(RECIPE).
#   2) JSON recipe file ->  ./tools/run.sh recipe.json
#      A plain .json with { input|create, output, operations, ... } — the
#      script wraps it automatically. Preferred mode for AI agents.
#
# Optional env vars:
#   PS_APP      Photoshop app name          (default "Adobe Photoshop 2026")
#   REPORT      path to write a document report (JSON)
#   PS_TIMEOUT  seconds before the run is killed as hung (default 300, 0 = off)
#
# What v3 adds:
#   * hang-proof prelude injected before any recipe (no modal dialogs)
#   * a watchdog that kills a stuck Photoshop instead of blocking forever
#   * a cleanup trap, so the temp .jsx is never leaked on failure
#   * clear, greppable errors and a real exit code
#
# The script concatenates core + core_v3 + runner + recipe and sends the whole
# thing to Photoshop via the AppleScript bridge.

set -uo pipefail

PS_APP="${PS_APP:-Adobe Photoshop 2026}"
PS_TIMEOUT="${PS_TIMEOUT:-300}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

CORE="${CORE:-$PROJECT_DIR/src/ps_core.jsx}"
CORE3="${CORE3:-$PROJECT_DIR/src/ps_core_v3.jsx}"
RUNNER="${RUNNER:-$PROJECT_DIR/src/recipe_runner.jsx}"
TEMP_JSX="${TMPDIR:-/tmp}/ps_run_$$.jsx"
OUTPUT_LOG="${TMPDIR:-/tmp}/ps_run_$$.out"

cleanup() { rm -f "$TEMP_JSX" "$OUTPUT_LOG"; }
trap cleanup EXIT

usage() {
    cat <<'USAGE'
Usage: run.sh [options] recipe.jsx|recipe.json
Options:
  --core FILE     override core library  (default src/ps_core.jsx)
  --core3 FILE    override v3 extensions (default src/ps_core_v3.jsx)
  --runner FILE   override recipe runner (default src/recipe_runner.jsx)
  --timeout SEC   watchdog timeout, 0 disables it (default 300 / $PS_TIMEOUT)
  -h, --help      this help
Env: PS_APP, REPORT, PS_TIMEOUT
USAGE
    exit 1
}

RECIPE=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --core)    CORE="$2";    shift 2 ;;
        --core3)   CORE3="$2";   shift 2 ;;
        --runner)  RUNNER="$2";  shift 2 ;;
        --timeout) PS_TIMEOUT="$2"; shift 2 ;;
        -h|--help) usage ;;
        *)         RECIPE="$1";  shift ;;
    esac
done

[[ -z "$RECIPE" ]] && usage
[[ -f "$RECIPE" ]] || { echo "ERROR: recipe file not found: $RECIPE" >&2; exit 2; }
[[ -f "$CORE" ]] || { echo "ERROR: core not found: $CORE" >&2; exit 2; }
[[ -f "$RUNNER" ]] || { echo "ERROR: runner not found: $RUNNER" >&2; exit 2; }

# Hang-proof prelude: suppress native dialogs and force deterministic units.
PRELUDE='if (typeof PS !== "undefined" && PS.setup) { PS.setup(); } else { app.displayDialogs = DialogModes.NO; }'

# Assemble the script: core (+ v3 extensions) + runner + recipe.
{
    echo "#target photoshop"
    cat "$CORE"
    [[ -f "$CORE3" ]] && { echo ""; cat "$CORE3"; }
    echo ""
    cat "$RUNNER"
    echo ""
    echo "var REPORT = \"${REPORT:-}\";"
    echo "$PRELUDE"
    if [[ "$RECIPE" == *.json ]]; then
        echo "var RECIPE = "
        cat "$RECIPE"
        echo ";"
        echo "if (REPORT && REPORT.length) RECIPE.report = REPORT;"
        echo "RecipeRunner.run(RECIPE);"
    else
        cat "$RECIPE"
    fi
} > "$TEMP_JSX"

# --- run through the AppleScript bridge, with a watchdog --------------------
osascript \
    -e "set js to read POSIX file \"$TEMP_JSX\" as «class utf8»" \
    -e "tell application \"$PS_APP\" to do javascript js" \
    > "$OUTPUT_LOG" 2>&1 &
OSA_PID=$!

TIMED_OUT=0
if [[ "${PS_TIMEOUT:-0}" -gt 0 ]] 2>/dev/null; then
    elapsed=0
    while kill -0 "$OSA_PID" 2>/dev/null; do
        sleep 1
        elapsed=$((elapsed + 1))
        if [[ "$elapsed" -ge "$PS_TIMEOUT" ]]; then
            TIMED_OUT=1
            echo "__PS_TIMEOUT__: no response after ${PS_TIMEOUT}s — killing Photoshop (was it stuck on a modal dialog?)" >> "$OUTPUT_LOG"
            kill -9 "$OSA_PID" 2>/dev/null
            pkill -9 -f "$PS_APP" 2>/dev/null
            break
        fi
    done
fi

set +e
wait "$OSA_PID" 2>/dev/null
CODE=$?
set -e

cat "$OUTPUT_LOG"

if [[ "$TIMED_OUT" == "1" ]]; then
    echo "run.sh: TIMEOUT after ${PS_TIMEOUT}s (see above)" >&2
    exit 124
fi

exit $CODE
