# Changelog

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