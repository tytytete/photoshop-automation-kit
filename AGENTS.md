# AGENTS.md — How an AI agent should use this library

## tl;dr

1. **Read `docs/API.md`** for the full function reference.
2. **Produce a recipe file** — either a JSON recipe (preferred) or a JSX recipe.
3. **Run**: `./tools/run.sh recipe.json` (macOS).
4. The recipe schema is documented in `src/recipe_runner.jsx` header comments.

## v3 hard rules (read before writing any script)

These are the mistakes every agent makes; each one wastes minutes or hangs the app.

1. **Never hand-roll ActionDescriptors for shapes.** Use `PS.vector.*`
   (`rect`, `circle`, `polygon`, `line`, `roundedRect`, `create`) or the
   `vectorShape`/`circle`/`rect` ops. The legacy `PS.shape.*` helpers output
   full-canvas shapes that **cannot be moved or resized** (`transformLayer`
   errors, `resize`/`translate` hang Photoshop).
2. **State sizes physically.** `PS.document.createSize({ width:100, height:100,
   unit:'cm', resolution:150 })`. Don't hand-convert mm↔px↔pt.
3. **Pass coordinates in pixels and hex colours.** Every v3 helper (`vector.*`,
   `text.addAt`, `layout.flow`) takes document pixels and `'#rrggbb'` and does
   the unit conversion for you. Text `sizePx` (not `size` — that's in points).
4. **Never hand-compute Y baselines.** Use `PS.layout.flow` / `textStack`,
   which advances from measured bounds. `layer.bounds` gives real pixels.
5. **Always write the PSD.** Use `PS.export.auto(doc, base)` or set
   `autoPsd: true` on output with a `jpg` path.
6. **Wrap risky calls** in `PS.safe(...)` (or rely on the runner, which
   isolates every op). A thrown error without `app.displayDialogs=NO` is a
   modal dialog = a hang. The runner sets this up automatically.
7. **Do not name a global variable `name`** — it throws in ExtendScript.
   Do not alias `app.stringIDToTypeID` — use `PS.typeID` / `PS.charID`.
8. `run.sh` has a watchdog: a stuck run is killed after `PS_TIMEOUT` (default
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
                unit: 'px'|'mm'|'cm'|'in' }, // OR create a new document (v3 unit-aware)
    output:   { psd?: string, jpg?: string, png?: string, jpgQuality?: int },
    autoPsd:  boolean,                    // derive PSD path from jpg (v3)
    log:      string,                     // run log path (v3)
    summary:  string,                     // machine-readable summary json (v3)
    onError:  'continue' | 'stop',        // default 'continue' (v3)
    operations: [ Operation, ... ],       // executed top-to-bottom
    close:    boolean                     // default true — close doc after save?
}
```

### v3 operation types

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
| `export` | `psd/jpg/png` | `jpgQuality` |
| `exportAuto` | `base` | `jpgQuality` |

`color` accepts `[r,g,b]` or `'#rrggbb'`; `justify` is `left|center|right`.

### Operation types

Every operation has an `op` string. Optional `name: string` renames the resulting layer.

| op                     | required params              | optional params                    |
|------------------------|------------------------------|------------------------------------|
| `duplicate`            |                              | `name`                             |
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
| `gradientFill`         | `style angle preset`        | `name`                             |
| `text`                 | `contents`                   | `size font color position name`    |
| `warpText`             | `style bend`                 | `horzDist vertDist`                |
| `setOpacity`           | `value`                      |                                    |
| `setBlendMode`         | `mode`                       |                                    |
| `maskFromSelection` / `revealAllMask` / `hideAllMask` / `invertMask` | | |
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
- `run.sh` accepts `--timeout SEC` (watchdog) and `PS_TIMEOUT` (default 300 s).
- Validate your work with `tests/run_tests.sh` (16 assertions on the v3 helpers).
- Real builds to copy from: `examples/mountain_cafe_logo.jsx`,
  `examples/mountain_cafe_menu.jsx`.
- Full v3 reference and the pitfall list: `docs/API.md` → "v3.0 Additions".

## Pitfalls (learned the hard way — see docs/API.md)

| Symptom | Cause | Fix |
|---|---|---|
| `osascript` blocks forever, needs a manual kill | a failing Action/DOM call raised a native modal alert | call `PS.setup()` at the top; wrap calls in `PS.safe()`; `run.sh` watchdog |
| `General Photoshop error … source rectangle is empty` | `transformLayer` on a shape layer | use `PS.vector.*` (no transforms needed) |
| Photoshop freezes on `layer.resize` / `layer.translate` | those DOM calls hang on vector layers | same as above |
| shape ends up full-canvas | `PS.shape.*` legacy behaviour | pass `cfg.bounds` or use `PS.vector.*` |
| geometry scaled by ~2× (e.g. 150 ppi) | path anchors are in points, scaled by `resolution/72` | use `PS.unit.*` / `PS.vector.*` (auto-converted) |
| `global.stringIDToTypeID() … not getting correct parameters` | aliasing `var s2t = app.stringIDToTypeID` loses `this` | use `PS.typeID` / `PS.charID` |
| `TypeError: undefined is not an object` on a text layer | top-level `var name = …` — `name` is reserved | rename the variable |
| text lines overlap | hand-computed baselines | `PS.layout.flow()` / `textStack` |
| `.jpg` saved but no `.psd` | export called with jpg only | `PS.export.auto()` or `autoPsd: true` |