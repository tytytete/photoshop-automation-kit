#!/bin/bash
# Run a Photoshop recipe from the command line (macOS).
#
# Input modes:
#   1) JSX recipe file  ->  ./tools/run.sh recipes/example_recipe.jsx
#      The file defines a global `RECIPE` and calls RecipeRunner.run(RECIPE).
#   2) JSON recipe file ->  ./tools/run.sh recipe.json
#      A plain .json with { input|create, output, operations, ... } — the
#      script wraps it automatically. Preferred mode for AI agents.
#   3) Inline JSX       ->  ./tools/run.sh -e '$.writeln(app.version);'
#      Executes a snippet after the core library is loaded. Handy for probes.
#
# Optional env vars:
#   PS_APP      Photoshop app name          (default "Adobe Photoshop 2026")
#   REPORT      path to write a document report (JSON)
#   PS_TIMEOUT  seconds before the run is killed as hung (default 300, 0 = off)
#
# What v4 adds:
#   * -e / --eval for inline snippets (no temp recipe file to manage)
#   * #include "src/ps_core.jsx" in recipes is stripped automatically
#   * Folder.current is pointed at the recipe's directory
#   * PS.log()/$ .writeln output is returned on stdout via PS.finish()
#   * --version
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
       run.sh -e 'inline jsx code'

Options:
  -e, --eval CODE inline JSX snippet (core library is preloaded)
  --core FILE     override core library  (default src/ps_core.jsx)
  --core3 FILE    override v4 extensions (default src/ps_core_v3.jsx)
  --runner FILE   override recipe runner (default src/recipe_runner.jsx)
  --timeout SEC   watchdog timeout, 0 disables it (default 300 / $PS_TIMEOUT)
  -v, --version   print the kit version
  -h, --help      this help
Env: PS_APP, REPORT, PS_TIMEOUT
USAGE
    exit 1
}

RECIPE=""
EVAL_CODE=""
IS_EVAL=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        -e|--eval)
            [[ $# -ge 2 ]] || { echo "ERROR: $1 requires inline code" >&2; exit 2; }
            EVAL_CODE="$2"; IS_EVAL=1; shift 2 ;;
        --core)    CORE="$2";    shift 2 ;;
        --core3)   CORE3="$2";   shift 2 ;;
        --runner)  RUNNER="$2";  shift 2 ;;
        --timeout) PS_TIMEOUT="$2"; shift 2 ;;
        -v|--version) cat "$PROJECT_DIR/VERSION"; exit 0 ;;
        -h|--help) usage ;;
        *)         RECIPE="$1";  shift ;;
    esac
done

if [[ "$IS_EVAL" == "1" ]]; then
    [[ -n "$EVAL_CODE" ]] || { echo "ERROR: -e requires inline code" >&2; exit 2; }
else
    [[ -z "$RECIPE" ]] && usage
    [[ -f "$RECIPE" ]] || { echo "ERROR: recipe file not found: $RECIPE" >&2; exit 2; }
fi
[[ -f "$CORE" ]] || { echo "ERROR: core not found: $CORE" >&2; exit 2; }
[[ -f "$RUNNER" ]] || { echo "ERROR: runner not found: $RUNNER" >&2; exit 2; }

# Relative paths inside recipes (File("out.psd"), non-core #includes, …)
# resolve from the recipe's own folder, not from Photoshop's working dir.
if [[ -n "$RECIPE" && -f "$RECIPE" ]]; then
    RUN_BASE="$(cd "$(dirname "$RECIPE")" && pwd)"
else
    RUN_BASE="$PROJECT_DIR"
fi
RUN_BASE_JS="$(printf '%s' "$RUN_BASE" | sed 's/\\/\\\\/g; s/"/\\"/g')"

# Drop header lines that would break in the concatenated /tmp script:
#   * #include "src/ps_core.jsx" (already prepended)
#   * #include "src/ps_core_v3.jsx" / recipe_runner.jsx
#   * a duplicate #target photoshop
strip_recipe() {
    sed -E \
        -e '/^[[:space:]]*#include.*(ps_core|ps_core_v3|recipe_runner)/d' \
        -e '/^[[:space:]]*#target[[:space:]]+photoshop[[:space:]]*$/d' \
        "$1"
}

# Hang-proof prelude: point relative paths at the recipe, suppress native
# dialogs, and force deterministic units.
PRELUDE="try { Folder.current = new Folder(\"$RUN_BASE_JS\"); } catch (e) {}
if (typeof PS !== \"undefined\" && PS.setup) { PS.setup(); } else { app.displayDialogs = DialogModes.NO; }"

# Assemble the script: core (+ v4 extensions) + runner + recipe/eval.
{
    echo "#target photoshop"
    cat "$CORE"
    [[ -f "$CORE3" ]] && { echo ""; cat "$CORE3"; }
    echo ""
    cat "$RUNNER"
    echo ""
    echo "var REPORT = \"${REPORT:-}\";"
    echo "$PRELUDE"
    if [[ "$IS_EVAL" == "1" ]]; then
        printf '%s\n' "$EVAL_CODE"
    elif [[ "$RECIPE" == *.json ]]; then
        echo "var RECIPE = "
        cat "$RECIPE"
        echo ";"
        echo "if (REPORT && REPORT.length) RECIPE.report = REPORT;"
        echo "RecipeRunner.run(RECIPE);"
    else
        strip_recipe "$RECIPE"
    fi
    # Return the explicit result + everything captured from PS.log/$.writeln.
    echo ""
    echo '(typeof PS !== "undefined" && PS.finish) ? PS.finish() : "";'
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
