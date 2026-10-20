# API Reference

All functions live under the global `PS` namespace, defined in `src/ps_core.jsx`.  
Load order: `ps_core.jsx` first, then call any function.

---

## Documents

### `PS.openDocument(path) → Document`
Opens a file (JPEG / PNG / PSD / TIFF …) and returns the document.

```javascript
var doc = PS.openDocument('/Users/me/image.jpg');
```

### `PS.activeDocument() → Document`
Returns `app.activeDocument`.

### `PS.close(doc, saveChanges)`
Closes a document. `saveChanges` (bool) defaults to `DONOTSAVECHANGES`.

### `PS.flatten(doc?)`
Flattens the document to a single layer.

### `PS.mergeVisible(doc?)`
Merges all visible layers.

### `PS.resizeImage({ width?, height?, resolution?, resample? })`
Resizes the active document. Defaults preserve existing values.

### `PS.crop(left, top, right, bottom)`
Crops to the pixel rectangle `[left, top, right, bottom]`.

---

## Saving

### `PS.save.psd(doc, path)`
### `PS.save.jpg(doc, path, quality?)`
### `PS.save.png(doc, path)`

Each uses `SaveOptions` matching the format, embeds the color profile, and  
saves with lowercase extension via `saveAs`.

---

## Layers

### `PS.duplicate(name?) → Layer`
Duplicates the active layer; optionally renames it.

### `PS.rename(layer, name)`
### `PS.setOpacity(layer, pct)`
### `PS.setBlendMode(layer, mode)`
`mode` is a camelCase string, e.g. `'multiply'`, `'softLight'`, `'overlay'`.

### `PS.setVisible(layer, visible)`
### `PS.remove(layer)`
### `PS.addGroup(name?) → LayerSet`
### `PS.addToGroup(layer, group)`

---

## Selection (`PS.selection`)

| function | signature | notes |
|---|---|---|
| `selectAll()` | — | select whole canvas |
| `deselect()` | — | clear selection |
| `selectRect(l,t,r,b,feather?)` | px ints | rectangular marquee |
| `selectOval(l,t,r,b,feather?)` | px ints | elliptical marquee |
| `selectSubject()` | — | **AI** subject detection (Object Selection) |
| `feather(px)` | int | soften edge |
| `expand(px)` / `contract(px)` | int | grow / shrink selection |
| `inverse()` | — | invert selection |
| `grow()` / `similar()` | — | magic-wand-style grow / similar |
| `store(name?)` | → Channel | save selection to alpha channel |
| `load(channel, combine?, invert?)` | — | reload selection (combine = `SelectionType.REPLACE/EXTEND/INTERSECT/DIMINISH`) |
| `intersectRect(l,t,r,b)` | px ints | intersect current selection with a rectangle |
| `bounds()` | → [l,t,r,b] | active selection bounds |

> **Important**: when a selection is active, the NEXT adjustment or fill layer  
> created becomes masked by that selection automatically (standard Photoshop  
> behaviour). This is how selective edits are made.

---

## Adjustment layers (`PS.adjustment`)

Every function returns the created layer and accepts an optional `name` in `cfg`.

### `hueSaturation(cfg)`
`{ hue, saturation, lightness, channel?, colorize?, name }`  
`channel` ∈ `'composite' | 'reds' | 'yellows' | 'greens' | 'cyans' | 'blues' | 'magentas'`.

```javascript
PS.adjustment.hueSaturation({ colorize: true, hue: 332, saturation: 42, lightness: 6, name: 'Pink' });
```

### `levels(cfg)`
`{ shadow, white, gray, name }` — input black point (0–255), white point, gamma.

### `curves(cfg)`
`{ points: [[in,out],…], channel?, name }` — composite (default) or per-channel curve.

### `colorBalance(cfg)`
`{ shadows, midtones, highlights, preserve, name }` — each is `[CyanRed, MagentaGreen, YellowBlue]` (±100).

### `vibrance(cfg)`
`{ vibrance, saturation, name }`

### `brightnessContrast(cfg)`
`{ brightness, contrast, name }`

### `photoFilter(cfg)`
`{ red, green, blue, density, preserve, name }`

### `exposure(cfg)`
`{ exposure, offset, gamma, name }`

### `selectiveColor(cfg)`
`{ corrections: [{ color, cyan, magenta, yellow, black }], absolute, name }`  
`color` ∈ `'reds' | 'yellows' | 'greens' | 'cyans' | 'blues' | 'magentas' | 'whites' | 'neutrals' | 'blacks'`.

### `channelMixer(cfg)`
`{ monochrome, red, green, blue, name }` — each channel is `[r,g,b]` percent.

### `gradientMap(cfg)`
`{ name }` — applies the default gradient map.

### `blackWhite(cfg)`
`{ reds, yellows, greens, cyans, blues, magentas, name }` (−200…300).

### `posterize(cfg)`
`{ levels, name }`

### `threshold(cfg)`
`{ level, name }`

### `invert(cfg)`
`{ name }`

---

## Fill layers (`PS.fill`)

### `solidColor(cfg)`
`{ red, green, blue, name }`

---

## Text (`PS.text`)

### `add(cfg) → Layer`
`{ contents, size, font, color: [r,g,b], position: [x,y], name }`

```javascript
PS.text.add({ contents: 'Title', size: 48, font: 'Arial-BoldMT', color: [255,255,255] });
```

---

## Masks (`PS.mask`)

### `fromSelection(layer?)`
Creates a mask from the current selection (or reveals it) on a normal layer.

### `invert(layer?)`
Inverts the active layer's mask.

---

## Recipe runner (`RecipeRunner.run(recipe)`)

See `src/recipe_runner.jsx` header for the full schema. Synopsis:

```javascript
var RECIPE = {
    input: '/in.jpg',
    output: { psd: '/out.psd', jpg: '/out.jpg' },
    operations: [{ op: 'levels', name: 'L', shadow: 10, white: 240 }]
};
RecipeRunner.run(RECIPE);
```

---

## Type IDs cheat-sheet (for maintainers)

Adjustment layer type stringIDs used internally (so you never need to guess):

| Function | type ID string |
|---|---|
| Hue/Saturation | `hueSaturation` |
| Levels | `levels` |
| Curves | `curves` |
| Color Balance | `colorBalance` |
| Vibrance | `vibrance` |
| Brightness/Contrast | `brightnessEvent` |
| Photo Filter | `photoFilter` |
| Exposure | `exposure` |
| Selective Color | `selectiveColor` |
| Channel Mixer | `channelMixer` |
| Gradient Map | `gradientMapClass` |
| Black & White | `blackAndWhite` |
| Posterize | `posterize` |
| Threshold | `thresholdClassEvent` |
| Invert | `invert` |
| Solid Color fill | `solidColorLayer` |
---

# v2.0 Additions

## Document creation & canvas

### `PS.document.create({ width, height, resolution, name, mode, fill })`
Creates a new document. `mode` ∈ `rgb|cmyk|lab|grayscale`; `fill` ∈ `white|transparent|black|bgColor`.

### `PS.document.canvasSize(doc?, width, height, anchor?)`

## Color

### `PS.color.setForeground(r,g,b)` / `PS.color.setBackground(r,g,b)`

## Selection extensions

| function | notes |
|---|---|
| `PS.selection.smooth(px)` | Select → Modify → Smooth |
| `PS.selection.border(px)` | Select → Modify → Border |
| `PS.selection.fill(color?)` | Paint-bucket fill the selection (default: foreground) |
| `PS.selection.colorRange(fuzziness)` | Select → Color Range |

## Layer styles (`PS.layerStyle`)

Every function returns the layer and accepts a `cfg` object.

| function | params |
|---|---|
| `dropShadow(cfg)` | `opacity, angle, distance, spread, size, color:[r,g,b], useGlobalLight` |
| `innerShadow(cfg)` | `opacity, angle, distance, choke, size, color` |
| `outerGlow(cfg)` | `opacity, spread, size, color` |
| `innerGlow(cfg)` | `opacity, choke, size, color` |
| `colorOverlay(cfg)` | `opacity, color` |
| `gradientOverlay(cfg)` | `opacity, preset` |
| `patternOverlay(cfg)` | `opacity` |
| `bevel(cfg)` | `color` (simple inner bevel) |
| `stroke(cfg)` | `size, position: 'inside'/'center'/'outside', color` |
| `clearAll(layer?)` | remove all effects |

## Vector shapes (`PS.shape`)

Create real editable vector shape layers (LayerKind.SOLIDFILL).

| function | notes |
|---|---|
| `rectangle(cfg)`, `roundedRect(cfg)`, `ellipse(cfg)`, `triangle(cfg)`, `polygon(cfg)`, `line(cfg)` | `{ color:[r,g,b], name }` |

> Note: shape layers are created at full-canvas size (variable bounds need the
> free-transform path — see `PS.transform.layer`). Confirm current bounds via
> `layer.bounds`.

## Smart objects & rasterize

### `PS.smartObject.convert()`
Converts the active layer to a smart object (returns it).

### `PS.rasterize(layer?, type?)`
`type` ∈ `TEXTCONTENTS` | `ENTIRELAYER` (default).

## Transforms (`PS.transform`)

| function | notes |
|---|---|
| `rotateCanvas(angle)` | rotate whole canvas |
| `flipCanvas('horizontal'/'vertical')` | flip whole canvas |
| `layer({ widthPct, heightPct, angle })` | free-transform the active layer |

## Filters (`PS.filter`)

| function | notes |
|---|---|
| `gaussianBlur(radius)` | |
| `motionBlur(angle, distance)` | |

## Gradient fill layer

### `PS.fill.gradient({ style, angle, preset, name })`
`style` ∈ `linear|radial|angle|reflected|diamond`.

## Text extensions

| function | notes |
|---|---|
| `PS.text.warp({ style, bend, horzDist, vertDist })` | `style` ∈ `arc`,`flag`,`wave`,… |
| `PS.text.setTracking(layer, val)` | |
| `PS.text.setScale(layer, horz, vert)` | |
| `PS.text.setBaselineShift(layer, val)` | |

## Mask helpers

| function | notes |
|---|---|
| `PS.mask.add(layer?)` | reveal-all mask |
| `PS.mask.hide(layer?)` | hide-all mask |
| `PS.mask.invert(layer?)` | invert mask |
| `PS.mask.fromSelection(layer?)` | mask from active selection |

## Introspection

### `PS.report(doc?) → object`
Returns `{ name, width, height, resolution, mode, layers:[tree], layerCount, histogram256 }`.

### `PS.json(obj) → string`
Minimal JSON serializer (ExtendScript has no native JSON).

---

## Recipe runner additions (v2)

New `op` tokens: `create` (document), `gradientFill`, `warpText`, `dropShadow`, `stroke`,
`innerShadow`, `outerGlow`, `innerGlow`, `colorOverlay`, `gradientOverlay`, `bevel`,
`clearLayerStyle`, `rectangle`, `roundedRect`, `ellipse`, `triangle`, `polygon`, `line`,
`smartObject`, `rasterize`, `rotateCanvas`, `flipCanvas`, `transformLayer`,
`gaussianBlur`, `motionBlur`, `fillSelection`, `smooth`, `selectBorder`, `colorRange`,
`setForeground`, `setBackground`, `canvasSize`, `revealAllMask`, `hideAllMask`.

Recipe can now start from a new document via `"create": {...}` (instead of `"input"`),
and emit a report via `"report": "/path/report.json"`.

---

# v3.0 Additions

The v3 surface lives in `src/ps_core_v3.jsx` and is loaded automatically by
`run.sh` after `ps_core.jsx`. Every v2 function still works unchanged.

## Setup, guarding and logging

### `PS.setup(opts?) → version`

Call once at the top of any script. It:

- sets `app.displayDialogs = DialogModes.NO` — **without this a failing Action
  raises a native modal alert that blocks the AppleScript bridge forever**
  (the classic 120 s timeout + manual kill);
- forces `rulerUnits = Units.PIXELS` and `typeUnits = TypeUnits.POINTS`;
- optionally sets the log file (`opts.logPath`).

### `PS.safe(label, fn, path?) → result | null`

Runs `fn()`; on error logs it and returns `null` instead of throwing. Use it
around any risky AM/DOM call so a failure never pops a dialog.

### `PS.log(msg, path?)` / `PS.logError(label, err, path?)`

Append a line to the log file (defaults to `PS.logPath`).

## Units

### `PS.unit.pathScale(doc?) → factor`
= `doc.resolution / 72`. **Path-item anchors are stored in points** and scaled
to pixels by this factor, so a shape placed at "100" on a 150 ppi document lands
at 208 px unless converted. `PS.vector.*` converts for you.

| function | meaning |
|---|---|
| `PS.unit.px(v)` | `UnitValue(v,'px')` |
| `PS.unit.pxToPt(v, doc?)` | pixels → points |
| `PS.unit.ptToPx(v, doc?)` | points → pixels |
| `PS.unit.mmToPx(v, res?)` / `cmToPx` / `inToPx` | physical → px |
| `PS.unit.pxToMm(v, res?)` / `pxToCm` | px → physical |

## Documents

### `PS.document.createSize(cfg) → Document`
```javascript
PS.document.createSize({ width: 100, height: 100, unit: 'cm', resolution: 150,
                         mode: 'rgb', fill: 'white', name: 'Logo' });
PS.document.createSize({ width: 210, height: 297, unit: 'mm', resolution: 300,
                         mode: 'cmyk' });            // A4 for print
```
`unit` ∈ `px | mm | cm | in` (default `px`).

## Colour

```javascript
PS.color.hexToRgb('#2D4A3E');   // -> [45,74,62]
PS.color.of('#2D4A3E');         // -> SolidColor   (also accepts [r,g,b])
```

## Vector shapes — `PS.vector.*`

**Use these instead of `PS.shape.*`.** The legacy helpers create full-canvas
shapes that cannot be transformed (`transformLayer` errors; `resize`/`translate`
hang the app). `PS.vector.*` builds a real, editable shape layer at exact pixel
coordinates via a temporary work path.

### `PS.vector.create(cfg) → Layer`
```javascript
PS.vector.create({
  points: [[1450,3360],[2950,2060],[4450,3360]],   // or {anchor,left,right,smooth}
  closed: true,                                     // default true
  color: '#2D4A3E',                                 // or [r,g,b]
  name: 'MunteFata'
});
```

| call | notes |
|---|---|
| `PS.vector.rect(l,t,r,b,cfg)` | rectangle at exact bounds |
| `PS.vector.roundedRect(l,t,r,b,radius,cfg)` | bezier rounded rectangle |
| `PS.vector.circle(cx,cy,r,cfg)` | true 4-point bezier circle |
| `PS.vector.polygon(cx,cy,r,sides,cfg)` | `cfg.rotation` in degrees |
| `PS.vector.triangle(cx,cy,r,cfg)` | `polygon(...,3)` |
| `PS.vector.line(x1,y1,x2,y2,thickness,cfg)` | thin filled quad |

Curved points: `{ anchor:[x,y], left:[x,y], right:[x,y], smooth:true }`.

### `PS.shape.*` upgrade
`rectangle`, `roundedRect`, `ellipse`, `triangle` now honour
`cfg.bounds = [l,t,r,b]` (and `cfg.radius`). Without `bounds` they fall back to
the legacy full-canvas behaviour.

## Text

### `PS.text.addAt(cfg) → Layer`
```javascript
PS.text.addAt({ contents: 'MENIU', sizePx: 70, font: 'Arial-BoldMT',
                color: '#2D4A3E', x: 1240, y: 1270,
                justify: 'center', name: 'Titlu' });
```
`x`/`y` are **document pixels**; `sizePx` is pixels (or use `size` in points).
`justify` ∈ `left|center|right`. `PS.text.add` now also accepts `'#rrggbb'`.

### `PS.text.bounds(layer) → {left,top,right,bottom,width,height}` (px)
### `PS.text.sizePx(px, doc?) → pt`
### `PS.text.arc(layer, bend)`

## Layout — `PS.layout.*`

### `PS.layout.flow(cfg) → [{layer, bounds, baselineY}, …]`
Places lines one under another; each next baseline is derived from the
**measured** bounds of the previous line, so overlap is impossible.
```javascript
PS.layout.flow({
  x: 420, y: 1500, sizePx: 36, font: 'ArialMT', color: '#243830',
  gap: 12,
  items: ['Espresso', 'Cappuccino', { text: 'Latte', sizePx: 48 }]
});
```

### `PS.layout.next(layer, gap?) → { y, bounds }`

## Export

### `PS.export(doc, { psd, jpg, png, jpgQuality })`
### `PS.export.auto(doc, basePath, quality?) → { psd, jpg }`

Writes **PSD + JPG** together — the layered source is never forgotten.

```javascript
var doc = PS.document.createSize({ width:100, height:100, unit:'cm', resolution:150 });
/* … drawing … */
PS.export.auto(doc, '/tmp/logo');   // -> /tmp/logo.psd + /tmp/logo.jpg
```

## Introspection

- `PS.layer.list(doc?) → [{name, kind, visible, opacity}, …]` (top → bottom)
- `PS.layer.bounds(name, doc?) → {left,top,right,bottom,width,height}`

## Recipe runner v3

New ops: `vectorShape`, `circle`, `rect`/`rectAt`, `roundedRectAt`, `polygonAt`,
`triangleAt`, `vectorLine`, `textAt`, `textStack`, `export`, `exportAuto`.
New fields: `create.unit`, `log`, `summary`, `autoPsd`, `onError`.

The runner sets up the hang-proof preamble itself, isolates every operation
(failures are logged, the run continues unless `onError:'stop'`), returns
`'OK: N ops, M errors'`, and writes a machine-readable summary when `summary`
is given.

## Known ExtendScript pitfalls

1. **Aliasing breaks `this`.** `var s2t = app.stringIDToTypeID; s2t('x')` throws
   *"global.stringIDToTypeID() … not getting correct parameters"*. Use
   `PS.typeID` / `PS.charID` (they close over `app`).
2. **`name` is reserved.** A top-level `var name = …` throws
   *"undefined is not an object"*. Rename the variable.
3. **Failed calls without `displayDialogs=NO` hang the bridge.** Always
   `PS.setup()` first and prefer `PS.safe()`.
4. **`$.writeln` goes nowhere** under `do javascript`; log to a file with
   `PS.log`.
5. **CMYK JPEGs** are exported with 4 components — expected for print output.
