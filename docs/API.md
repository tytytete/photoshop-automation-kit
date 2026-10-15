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