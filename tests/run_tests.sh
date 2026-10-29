#!/bin/bash
# Run the v4 self-test through the real Photoshop bridge.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG=/tmp/ps_v4_test.log
rm -f "$LOG"
PS_TIMEOUT="${PS_TIMEOUT:-300}" "$DIR/../tools/run.sh" "$DIR/test_core.jsx"
code=$?
echo "----- test log -----"
cat "$LOG" 2>/dev/null || echo "(no log written)"
exit $code
