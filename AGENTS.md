# AGENTS.md — How an AI agent should use this library

## tl;dr

1. **Read `docs/API.md`** for the full function reference.
2. **Produce a recipe file** — either a JSON recipe (preferred) or a JSX recipe.
3. **Run**: `./tools/run.sh recipe.json` (macOS).
4. The recipe schema is documented in `src/recipe_runner.jsx` header comments.

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
    output:   { psd?: string, jpg?: string, png?: string, jpgQuality?: int },
    operations: [ Operation, ... ],       // executed top-to-bottom
    close:    boolean                     // default true — close doc after save?
}
```

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