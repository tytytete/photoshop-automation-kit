# AGENTS.md — How an AI agent should use this library

## tl;dr

1. **Read `docs/API.md`** for the full function reference.
2. **Produce a recipe file** — either a JSON recipe (preferred) or a JSX recipe.
3. **Run**: `./tools/run.sh recipe.json` (macOS).
4. The recipe schema is documented in `src/recipe_runner.jsx` header comments.

## v4 hard rules (read before writing any script)

These are the mistakes every agent makes; each one wastes minutes or hangs the app.

1. **Never hand-roll ActionDescriptors for shapes or masks.** Use `PS.vector.*`
   (`rect`, `circle`, `polygon`, `line`, `roundedRect`, `create`) and
   `PS.mask.*` (`fromSelection`, `add`, `hide`, `invert`, `linearGradient`).
   Hand-written mask descriptors caused error 8800; the legacy `PS.shape.*`
   helpers output full-canvas shapes that **cannot be moved or resized**
   (`transformLayer` errors, `resize`/`translate` hang Photoshop).
2. **Gradients on masks go through `PS.mask.linearGradient`** (recipe op
   `maskGradient`), never the Gradient tool. Photoshop 2024–2026 throws 8800
   for the interactive gradient descriptor.
3. **Gradient fills use colours, not preset names.** `PS.fill.gradient` /
   `gradientOverlay` accept `from`/`to` (`'#rrggbb'`) or explicit
   `colors: [{color, location, opacity}]`. Localized preset names like
   `'Foreground to Transparent'` break non-English Photoshop.
4. **State sizes physically.** `PS.document.createSize({ width:100, height:100,
   unit:'cm', resolution:150 })`. Don't hand-convert mm↔px↔pt.
5. **Pass coordinates in pixels and hex colours.** Every helper (`vector.*`,
   `text.addAt`, `layout.flow`) takes document pixels and `'#rrggbb'` and does
   the unit conversion for you. Text `sizePx` (not `size` — that's in points).
6. **Never hand-compute Y baselines.** Use `PS.layout.flow` / `textStack`,
   which advances from measured bounds. `layer.bounds` gives real pixels.
7. **Always write the PSD.** Use `PS.export.auto(doc, base)` or set
   `autoPsd: true` on output with a `jpg` path.
8. **Wrap risky calls** in `PS.safe(...)` (or rely on the runner, which
   isolates every op). A thrown error without `app.displayDialogs=NO` is a
   modal dialog = a hang. The runner sets this up automatically.
9. **Do not name a global variable `name`** — it throws in ExtendScript.
   Do not alias `app.stringIDToTypeID` — use `PS.typeID` / `PS.charID`
   (or the exported `PS.s2t` / `PS.c2t` / global `s2t` / `c2t`).
10. `doc.selection.selectRect` / `selectOval` now work (v4 patches each
    document's selection); `PS.selection.*` remains the canonical form.
11. Use `./tools/run.sh -e '…'` for quick probes; `$.writeln` and `PS.log`
    output is returned on stdout via `PS.finish()`.
12. `run.sh` has a watchdog: a stuck run is killed after `PS_TIMEOUT` (default
    300 s) and reported, never blocking forever.

## Exact invocation pattern (macOS)

### JSON recipe (preferred)

```bash
cat > /tmp/my_recipe.json << 'JSON'
{
  "create": { "width": 800, "height": 600, "resolution": 72, "mode": "rgb", "fill": "white" },
  "output": { "psd": "/path/out.psd", "jpg": "/path/out.jpg" },
  "report": "/path/report.json",
  "operations": [
    { "op": "brightnessContrast", "brightness": 45, "contrast": 20 },
    { "op": "text", "contents": "Hello", "size": 48, "color": [255,255,255] },
    { "op": "dropShadow", "opacity": 50, "distance": 8, "size": 16 }
  ]
}
JSON

./tools/run.sh /tmp/my_recipe.json
# -> writes out.psd, out.jpg, and report.json (a PS.report() snapshot)
```

### JSX recipe (for complex logic)

```bash
cat > /tmp/my_recipe.jsx << 'JSX'
#target photoshop
var RECIPE = {
    input: '/path/to/input.jpg',
    output: { psd: '/path/to/output.psd', jpg: '/path/to/output.jpg' },
    operations: [ { op: 'brightnessContrast', brightness: 45, contrast: 20 } ]
};
RecipeRunner.run(RECIPE);
JSX

./tools/run.sh /tmp/my_recipe.jsx
```

`#include "src/ps_core.jsx"` in a recipe is stripped automatically. For quick
checks use inline mode (core + v4 are preloaded):

```bash
./tools/run.sh -e '$.writeln("PS " + PS.VERSION); $.writeln(app.version);'
./tools/run.sh --version
```

If you don't have the repo cloned, you can still use the library directly by  
concatenating `ps_core.jsx` + your code and piping to `osascript`:

```bash
cat ps_core.jsx <(echo '#target photoshop') <(echo 'PS.openDocument("/in.jpg");') \
  | osascript -e 'tell application "Adobe Photoshop 2026" to do javascript (read STDIN as «class utf8»)'
```

## Recipe JSON schema

A recipe is a JS object literal assigned to `var RECIPE`:

```
{   
    input:    string,                     // required — path to source image  
    create:   { width, height, resolution, mode, fill, name,
                unit: 'px'|'mm'|'cm'|'in' }, // OR create a new document (unit-aware)
    output:   { psd?: string, jpg?: string, png?: string, jpgQuality?: int },
    autoPsd:  boolean,                    // derive PSD path from jpg (v3)
    log:      string,                     // run log path (v3)
    summary:  string,                     // machine-readable summary json (v3)
    onError:  'continue' | 'stop',        // default 'continue' (v3)
    operations: [ Operation, ... ],       // executed top-to-bottom
    close:    boolean                     // default true — close doc after save?
}
```

### v4 operation types

| op | required params | optional |
|---|---|---|
| `vectorShape` | `points: [[x,y],…]` | `closed, color, name` |
| `circle` | `cx cy r` | `color, name` |
| `rect` / `rectAt` | `left top right bottom` | `color, name` |
| `roundedRectAt` | `left top right bottom` | `radius, color, name` |
| `polygonAt` | `cx cy r` | `sides, rotation, color, name` |
| `triangleAt` | `cx cy r` | `color, name` |
| `vectorLine` | `x1 y1 x2 y2` | `thickness, color, name` |
| `textAt` | `contents` | `sizePx, size, font, color, x, y, justify, name` |
| `textStack` | `items: […]` | `x, y, sizePx, font, color, justify, gap` |
| `maskGradient` / `maskLinearGradient` | `startY/start, endY/end` | `feather, direction, reveal` |
| `duplicateLayer` | | `name, invisible` |
| `unlockBackground` | | |
| `moveToBottom` | | |
| `log` | `message` | |
| `export` | `psd/jpg/png` | `jpgQuality` |
| `exportAuto` | `base` | `jpgQuality` |

`color` accepts `[r,g,b]` or `'#rrggbb'`; `justify` is `left|center|right`.
`gradientFill` / `gradientOverlay` accept `from` / `to` (`'#rrggbb'`) or
`colors: [{color, location, opacity}]`; `preset` is only a hint.

### Operation types

Every operation has an `op` string. Optional `name: string` renames the resulting layer.

| op                     | required params              | optional params                    |
|------------------------|------------------------------|------------------------------------|
| `duplicate`            |                              | `name`                             |
| `duplicateLayer`       |                              | `name, invisible`                  |
| `unlockBackground`     |                              |                                    |
| `moveToBottom`         |                              |                                    |
| `selectSubject`        |                              |                                    |
| `feather`              | `radius`                     |                                    |
| `selectRect`           | `left top right bottom`      | `feather`                          |
| `deselect`             |                              |                                    |
| `inverse`              |                              |                                    |
| `intersectRect`        | `left top right bottom`      |                                    |
| `hueSaturation`        |                              | `hue sat lightness channel colorize name` |
| `levels`               |                              | `shadow gray white name`           |
| `curves`               | `points: [[in,out]…]`       | `channel name`                     |
| `colorBalance`         |                              | `shadows midtones highlights preserve name` |
| `vibrance`             |                              | `vibrance saturation name`         |
| `brightnessContrast`   |                              | `brightness contrast name`         |
| `photoFilter`          |                              | `red green blue density preserve name` |
| `exposure`             |                              | `exposure offset gamma name`       |
| `selectiveColor`       | `corrections: […]`          | `absolute name`                    |
| `channelMixer`         |                              | `monochrome red green blue name`   |
| `blackWhite`           |                              | `reds yellows greens cyans blues magentas name` |
| `gradientMap`          |                              | `name`                             |
| `posterize`            | `levels`                     | `name`                             |
| `threshold`            | `level`                      | `name`                             |
| `invert`               |                              | `name`                             |
| `solidColor`           | `red green blue`            | `name`                             |
| `gradientFill`         | `style angle`               | `from to colors name scale reverse` |
| `text`                 | `contents`                   | `size font color position name`    |
| `warpText`             | `style bend`                 | `horzDist vertDist`                |
| `setOpacity`           | `value`                      |                                    |
| `setBlendMode`         | `mode`                       |                                    |
| `maskFromSelection` / `revealAllMask` / `hideAllMask` / `invertMask` / `maskTarget` / `maskExitTarget` | | |
| `maskGradient` / `maskLinearGradient` | `startY/start endY/end` | `feather direction reveal` |
| `log`                  | `message`                    |                                    |
| `dropShadow` / `innerShadow` / `outerGlow` / `innerGlow` / `colorOverlay` / `gradientOverlay` / `bevel` / `stroke` / `clearLayerStyle` | style-specific | see API.md |
| `rectangle` / `roundedRect` / `ellipse` / `triangle` / `polygon` / `line` | `color` | `name` |
| `smartObject` / `rasterize(type)` | | |
| `rotateCanvas(angle)` / `flipCanvas(direction)` / `transformLayer({widthPct,heightPct,angle})` | | |
| `gaussianBlur(radius)` / `motionBlur(angle,distance)` | | |
| `fillSelection` / `smooth(radius)` / `selectBorder(radius)` / `colorRange(fuzziness)` | | |
| `setForeground(r,g,b)` / `setBackground(r,g,b)` / `canvasSize(width,height)` | | |
| `flatten`              |                              |                                    |

### When to use the raw library directly

If you need a complex operation not covered by the recipe runner (nested  
group logic, per-channel curves, iterative scripts with conditionals),  
write regular ExtendScript using the `PS.*` namespace directly. See  
`docs/API.md` for all function signatures.

## Notes for AI models

- Always include `#target photoshop` at the top of your recipe file.
- The Photoshop app name in `tools/run.sh` is `Adobe Photoshop 2026` by default.  
  Override with `PS_APP="Adobe Photoshop 2025" ./tools/run.sh recipe.jsx`.
- Selections created with `selectSubject` / `selectRect` etc. automatically  
  become the mask of the NEXT adjustment or fill layer created.
- All adjustment parameters use the same ranges as the Photoshop UI (hue in  
  degrees, saturation/lightness in ±, levels in 0–255, etc.).
- `run.sh` accepts `--timeout SEC` (watchdog), `-e/--eval`, `--version`, and
  `PS_TIMEOUT` (default 300 s).
- Validate your work with `tests/run_tests.sh` (51 assertions on the v3/v4
  helpers, including pixel checks for masks and gradients).
- Real builds to copy from: `examples/mountain_cafe_logo.jsx`,
  `examples/mountain_cafe_menu.jsx`, `examples/v4_mask_showcase.jsx`,
  `recipes/v4_mask_gradient.json`.
- Full reference and the pitfall list: `docs/API.md` → "v4.0 Additions".

## Pitfalls (learned the hard way — see docs/API.md)

| Symptom | Cause | Fix |
|---|---|---|
| `osascript` blocks forever, needs a manual kill | a failing Action/DOM call raised a native modal alert | call `PS.setup()` at the top; wrap calls in `PS.safe()`; `run.sh` watchdog |
| `General Photoshop error … source rectangle is empty` | `transformLayer` on a shape layer | use `PS.vector.*` (no transforms needed) |
| Photoshop freezes on `layer.resize` / `layer.translate` | those DOM calls hang on vector layers | same as above |
| shape ends up full-canvas | `PS.shape.*` legacy behaviour | pass `cfg.bounds` or use `PS.vector.*` |
| circle looks like a diamond / rounded rect has a notch | path-point tangent order | fixed in v4; use `PS.vector.circle` / `roundedRect` |
| geometry scaled by ~2× (e.g. 150 ppi) | path anchors are in points, scaled by `resolution/72` | use `PS.unit.*` / `PS.vector.*` (auto-converted) |
| `global.stringIDToTypeID() … not getting correct parameters` | aliasing `var s2t = app.stringIDToTypeID` loses `this` | use `PS.typeID` / `PS.charID` |
| `TypeError: undefined is not an object` on a text layer | top-level `var name = …` — `name` is reserved | rename the variable |
| text lines overlap | hand-computed baselines | `PS.layout.flow()` / `textStack` |
| `.jpg` saved but no `.psd` | export called with jpg only | `PS.export.auto()` or `autoPsd: true` |
| error 8800 on "Make" when masking | hand-rolled mask descriptor (`null` key / `revealSelection`) | `PS.mask.fromSelection()` / `add()` / `hide()` |
| gradient tool error 8800 on a mask | interactive gradient descriptor changed in 2024–2026 | `PS.mask.linearGradient()` / `maskGradient` |
| gradient preset ignored on RU/non-EN PS | localized preset name string | pass `from`/`to`/`colors` instead |
| error 48 on `#include "src/ps_core.jsx"` | temp script lives in /tmp | run via `run.sh` (it strips core includes) |
| `$.writeln` prints `undefined` | `do javascript` returns only the final value | run via `run.sh`; logs are returned by `PS.finish()` |
| `doc.selection.selectRect is not a function` | native DOM only has `select()` | v4 patches it; or use `PS.selection.selectRect()` |