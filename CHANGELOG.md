# Changelog

## 4.0.0 — mask & gradient reliability, CLI ergonomics (2026-10-28)

A focused release fixing the failures found while doing real compositing work
(subject selection + masks, gradient blends, layer stacking) and the CLI paper
cuts that slowed down agents. Every v3 function keeps working.

### Fixed

1. **`PS.mask.fromSelection` / `add` / `hide` caused error 8800.**
   The "Make > channel" descriptor used `null` instead of the layer-mask
   reference in `at` and never declared `new = channel`. Masks now use the
   correct ActionManager contract. The helpers also recognise the internal
   mask that Photoshop gives fill/adjustment/text layers, so they reset it
   instead of trying to create a second pixel mask. `PS.mask.has()` reports
   mask presence; `PS.mask.target()` / `exitTarget()` switch the active
   channel safely.

2. **No way to paint a gradient into a layer mask (error 8800 with the
   Gradient tool).** Added `PS.mask.linearGradient(layer, start, end, feather,
   opts)` (alias `PS.mask.gradient`) which paints a feathered black/white
   falloff into the mask using a selection fill. Works on every Photoshop
   version; `opts.direction` supports `vertical`/`horizontal`, `opts.reveal`
   paints white. The recipe op is `maskGradient` / `maskLinearGradient`.

3. **`doc.selection.selectRect` / `selectOval` were missing.** The native
   `Selection` object now gets both methods (per document, patched on
   `PS.openDocument`, `PS.document.create`, and `PS.setup`). `selectOval` is
   a real 64-point ellipse, not a rectangle. Feathered selections now select
   hard and then call `selection.feather()` — passing the feather argument to
   `Selection.select()` left semi-transparent interiors on current builds.

4. **Gradient presets broke on non-English Photoshop.** `PS.fill.gradient`
   and `PS.layerStyle.gradientOverlay` no longer pass localized preset names
   (`Foreground to Transparent`, …). They build explicit RGB colour stops and
   transparency stops (`colors`, `from`/`to`, `fromOpacity`/`toOpacity`,
   `colors: [{color, location, opacity}]`). `preset` remains a hint for
   `foreground to transparent`, `foreground to background`, `black, white`.

5. **`s2t` / `c2t` were unreachable.** Exported as `PS.s2t` / `PS.c2t` and as
   global functions, so ad-hoc `-e` snippets and custom descriptors work.

6. **`$.writeln` output was lost under `do javascript`.** `PS.setup()` hooks
   `$.writeln` into `PS.log()`; `PS.getLogOutput()` and `PS.finish()` return
   the buffered console. `run.sh` appends `PS.finish()` to every run, so logs
   and the recipe result now appear on stdout.

7. **`#include "src/ps_core.jsx"` failed with error 48.** `run.sh` strips core
   includes (and duplicate `#target photoshop` lines) while assembling the
   temp script, and points `Folder.current` at the recipe's directory so
   relative paths resolve predictably.

8. **Layer order / mask introspection.** `PS.layer.list()` and `PS.report()`
   now really return top → bottom (the DOM's `artLayers[0]` is topmost).

9. **`PS.vector.circle` rendered as a diamond, `roundedRect` had a notch.**
   Photoshop's `leftDirection` is the outgoing tangent (opposite of the
   geometric left/right used in the point definitions). `PS.vector._pt` now
   swaps them, and the rounded-rect left-edge handles were corrected. Circles
   and rounded rectangles are truly round; custom smooth points benefit too.

### Added

- `tools/run.sh`: `-e` / `--eval CODE`, `--version`, include stripping,
  `Folder.current`, stdout log return. Existing `--timeout`, `--core`,
  `--core3`, `--runner`, `REPORT` keep working.
- `PS.mask.has/target/exitTarget/linearGradient/gradient`.
- `PS.layer.duplicate(layer, newName, invisible)`,
  `PS.layer.unlockBackground(doc)`, `PS.layer.moveToBottom(layer, doc)`.
- `PS.getLogOutput()`, `PS.finish()`, logging buffer in `PS.log()`.
- Recipe ops: `maskGradient`, `maskLinearGradient`, `maskTarget`,
  `maskExitTarget`, `duplicateLayer`, `unlockBackground`, `moveToBottom`,
  `log`.
- `tests/test_core.jsx` expanded to **51 assertions**, including pixel-level
  checks for masks, gradients and layer utilities.

### Notes

- `PS.VERSION` is `4.0.0`. The file name `src/ps_core_v3.jsx` is kept for
  backwards compatibility with custom `run.sh` invocations.
- `PS.mask.add` / `hide` / `fromSelection` replace an existing mask rather
  than stacking a second one (Photoshop forbids two pixel masks per layer).

## 3.0.0 — hang-proof ergonomics for AI agents (2026-10-20)

This release removes the four failure classes an AI agent runs into within its
first few minutes of driving Photoshop through the AppleScript bridge. No
behaviour is silently changed: every v2 documented function still works. v3
adds a parallel, "AI-first" surface (`src/ps_core_v3.jsx`) and hardens the
runner and CLI.

### Fixed

1. **Modal error dialogs hang the bridge forever.**
   A failing Action/DOM call popped a native Photoshop alert that blocked
   `osascript`, causing a 120 s timeout and a manual process kill. The runner
   now calls `PS.setup()` which sets `app.displayDialogs = DialogModes.NO`
   before anything else, every operation is isolated in a `try/catch`
   (`onError: 'continue'|'stop'`), and `tools/run.sh` gained a watchdog
   (`--timeout`, default 300 s) that kills a stuck Photoshop and reports rather
   than blocking.

2. **Vector shapes could not be positioned.**
   The v2 `PS.shape.*` helpers create full-canvas shapes; `transform.layer`
   errors ("source rectangle is empty") and `layer.resize`/`translate` hang the
   app. Added `PS.vector.*` (`create`, `rect`, `circle`, `roundedRect`,
   `polygon`, `triangle`, `line`) that build a real editable shape layer at
   exact pixel coordinates via a temporary work path. `PS.shape.*` now also
   honours `cfg.bounds = [l,t,r,b]`.

3. **Unit confusion (px vs pt vs mm).**
   Path anchors are stored in points and scaled by `resolution/72`; text size
   is points while text position is the ruler unit. Added `PS.unit.*`
   (`mmToPx`, `cmToPx`, `pxToPt`, `ptToPx`, `pathScale`) and
   `PS.document.createSize({ width, height, unit: 'px'|'mm'|'cm'|'in' })` so
   agents state physical sizes and let the kit convert.

4. **Text stacking on itself.**
   With no visual feedback, hand-guessed Y offsets overlapped. Added
   `PS.text.addAt()` (px placement), `PS.text.bounds()`, and
   `PS.layout.flow()` which advances each baseline from the measured bounds of
   the previous line — overlap is impossible.

5. **PSD source forgotten.**
   `PS.export.auto()` writes PSD + JPG together, and the recipe runner
   auto-derives `output.psd` from `output.jpg` when `autoPsd: true`.

### Added

- `PS.setup()`, `PS.safe()`, `PS.log()`, `PS.logError()` — guards + file logging.
- `PS.vector.*`, `PS.unit.*`, `PS.color.hexToRgb/color.of`,
  `PS.document.createSize`, `PS.text.addAt/bounds/sizePx/arc`,
  `PS.layout.flow/next`, `PS.export/export.auto`, `PS.layer.list/bounds`.
- New recipe ops: `vectorShape`, `circle`, `rect`/`rectAt`, `roundedRectAt`,
  `polygonAt`, `triangleAt`, `vectorLine`, `textAt`, `textStack`,
  `export`, `exportAuto`.
- Recipe `log`, `summary`, `autoPsd`, `onError` fields; `create.unit` field.
- `run.sh`: `--timeout`, cleanup `trap`, clearer errors, `--core3`.
- `tests/test_core.jsx` self-test (16 assertions) + `tests/run_tests.sh`.
- `examples/mountain_cafe_logo.jsx` + `examples/mountain_cafe_menu.jsx`.

### Noted pitfalls (now documented in API.md)

- `stringIDToTypeID` / `charIDToTypeID` lose their `this` binding when aliased
  (`var s2t = app.stringIDToTypeID` throws) — use `PS.typeID`/`PS.charID`.
- A top-level `var name = ...` throws in ExtendScript — `name` is reserved.

## 2.0.0 — shapes, layer styles, filters, smart objects, transforms, introspection

- Added vector shape layers, 6 layer styles, filters, smart objects, transforms.
- Added `PS.report()`, `PS.json()`, and the `RecipeRunner`.
- `PS.document.create`, `PS.shape.*`, `PS.layerStyle.*`, `PS.filter.*`,
  `PS.text.warp`, `PS.fill.gradient`, `PS.selection.smooth/border/fill`.

## 1.0.0 — core library

- Initial `PS.*` core: documents, saving, layers, selection, 15+ adjustments,
  text, masks.