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
