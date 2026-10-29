# Photoshop Automation Kit

A reusable, AI-friendly ExtendScript library for automating Adobe Photoshop from the command line. Every operation produces **real Photoshop objects** (adjustment layers, layer masks, text layers, fill layers, vector shapes, selections) — never flattened bitmap paste.

Tested on **Photoshop 2021–2026** (macOS).

> **v4.0 is out** — reliable layer masks (error 8800 fixed), mask gradients
> without the Gradient tool, locale-safe gradient fills, `doc.selection.selectRect`
> / `selectOval`, inline `run.sh -e`, stdout logging, and layer utilities.
> The v3 ergonomics (hang-proof guards, exact vector shapes, unit conversion,
> measured text layout, guaranteed PSD export) are all still here.
> See [CHANGELOG.md](CHANGELOG.md) and
> [docs/API.md → v4.0 Additions](docs/API.md#v40-additions).

---

## Download (no git needed)

The easiest way to get the kit is a ready-made archive from the **Releases** page:

- **https://github.com/tytytete/photoshop-automation-kit/releases**

Download `photoshop-automation-kit-4.0.0.zip`, unzip it anywhere, `cd` into the
resulting folder, and run `./tools/run.sh recipe.json`. The archive contains
`src/` (the library), `tools/run.sh`, `examples/`, `recipes/`, `docs/` and the
tests — everything you need, no repository checkout required.

## Installation (from git)

Clone the repository onto your machine:

```bash
git clone https://github.com/tytytete/photoshop-automation-kit.git ~/Documents/photoshop-automation-kit
```

The library lives at:

```
~/Documents/photoshop-automation-kit/
├── AGENTS.md              ← the file AI models must read (has the v4 hard rules)
├── README.md              ← this file (for humans)
├── CHANGELOG.md           ← release notes
├── VERSION
├── docs/API.md            ← full function reference incl. v4
├── src/
│   ├── ps_core.jsx        ← the library (~100 functions, PS.* namespace)
│   ├── ps_core_v3.jsx     ← v4 ergonomic extensions (loaded automatically;
│   │                        file name kept for backwards compatibility)
│   └── recipe_runner.jsx  ← declarative, hang-proof recipe engine
├── tools/
│   └── run.sh             ← one-command runner with a watchdog (macOS)
├── recipes/               ← example recipes (.json and .jsx)
├── examples/              ← full task examples (logo + menu)
└── tests/                 ← self-test (run_tests.sh)
```

**Prerequisites**

- Adobe Photoshop installed (2021+; tested on 2026)
- macOS (uses the built-in AppleScript bridge)
- `bash` (default shell works)

---

## Quick start (human)

Write a **JSON recipe** and run it with one command:

```bash
cd ~/Documents/photoshop-automation-kit

cat > /tmp/my_task.json << 'JSON'
{
  "create": { "width": 800, "height": 600, "resolution": 72, "mode": "rgb", "fill": "white" },
  "output": { "psd": "/tmp/result.psd", "jpg": "/tmp/result.jpg" },
  "operations": [
    { "op": "text", "contents": "Hello", "size": 48, "color": [255, 255, 255] },
    { "op": "dropShadow", "opacity": 50, "distance": 8, "size": 16 }
  ]
}
JSON

./tools/run.sh /tmp/my_task.json
```

That's it — Photoshop opens, runs the recipe, writes `result.psd` / `result.jpg`, and closes.

To edit an existing image instead of creating a new one, replace `"create": {...}` with `"input": "/path/to/photo.jpg"`.

Quick probe without creating a file (v4):

```bash
./tools/run.sh -e '$.writeln("PS " + PS.VERSION + " / Adobe " + app.version);'
```

---

## How to use this with an AI model

This is the whole point of the project. You hand the AI model **two pieces of context**, and it does the rest:

1. **The repo path**: `~/Documents/photoshop-automation-kit`
2. **The instruction file**: tell the model to read `AGENTS.md` first.

So your prompt to the AI can look like:

> "You are controlling Photoshop. The automation library is at
> `~/Documents/photoshop-automation-kit`. Read its `AGENTS.md` and `docs/API.md`
> first. Then produce a recipe JSON and run it via `./tools/run.sh recipe.json`."

The model will:

- read `AGENTS.md` (the recipe JSON whitelist + v4 hard rules),
- generate a `.json` recipe,
- run `./tools/run.sh recipe.json`,
- optionally read the machine-readable `report.json` / `summary` output.

You never paste the library code into the chat again — you just point the model at the path.

---

## What v4 fixes (for AI agents)

| failure | v4 fix |
|---|---|
| `PS.mask.fromSelection` / `add` / `hide` crash with error 8800 | correct `make > channel` descriptor; works on normal/text/fill/adjustment layers; `PS.mask.has()` |
| No way to blend two images through a mask (Gradient tool 8800) | `PS.mask.linearGradient()` paints a feathered falloff into the mask |
| Gradient presets fail on Russian / non-English Photoshop | explicit RGB + transparency stops (`from`/`to`/`colors`) |
| `doc.selection.selectRect / selectOval is not a function` | patched onto every document's selection; true 64-point oval |
| `#include "src/ps_core.jsx"` → error 48 | `run.sh` strips core includes; `Folder.current` = recipe dir |
| `$.writeln` output lost / `undefined` in the terminal | logs buffered by `PS.finish()`, printed on stdout |
| `s2t` / `c2t` are not defined in recipes | exported as `PS.s2t` / `PS.c2t` and as globals |
| no quick way to run a probe | `./tools/run.sh -e '…'` |
| layer stacking / background chores | `PS.layer.duplicate`, `unlockBackground`, `moveToBottom` |
| Photoshop hangs on a modal error dialog forever | `PS.setup()` disables dialogs; `PS.safe()` isolates risks; `run.sh` watchdog (`--timeout`) |
| Vector shapes come out full-canvas and can't be moved | `PS.vector.*` builds shapes at exact px coordinates |
| `PS.vector.circle` comes out as a diamond / rounded rect has a notch | correct tangent swap; circles are round |
| mm / px / pt confusion makes geometry "float" | `PS.unit.*` + `PS.document.createSize({unit:'cm'})` |
| Text lines stack on top of each other | `PS.layout.flow()` advances from measured bounds |
| PSD source is dropped after exporting a JPG preview | `PS.export.auto()` + runner `autoPsd: true` |

A complete v4 mask + gradient recipe:

```bash
cat > /tmp/blend_recipe.json << 'JSON'
{
  "create": { "width": 1200, "height": 800, "resolution": 72,
              "mode": "rgb", "fill": "white", "name": "Blend" },
  "output": { "jpg": "/tmp/blend.jpg" },
  "autoPsd": true,
  "operations": [
    { "op": "solidColor", "red": 18, "green": 42, "blue": 96, "name": "Sky" },
    { "op": "revealAllMask" },
    { "op": "maskGradient", "startY": 320, "endY": 520, "feather": 120 },
    { "op": "deselect" },
    { "op": "gradientFill", "style": "linear", "angle": 90,
      "from": "#102a60", "to": "#f2a65a", "name": "Dusk" },
    { "op": "moveToBottom" }
  ]
}
JSON

./tools/run.sh /tmp/blend_recipe.json      # -> blend.psd + blend.jpg
```

The kit's self-check runs 51 assertions, including pixel-level mask and
gradient checks:

```bash
./tests/run_tests.sh
```

---

## How it works

1. `src/ps_core.jsx` — the library. Provides the `PS.*` namespace for documents, selections, 15+ adjustment layers, layer styles, vector shapes, filters, fills, text, masks (incl. mask gradients), transforms, and introspection.
2. `src/ps_core_v3.jsx` — v4 ergonomic extensions: guards, units, logging buffer, `PS.layer.*` utilities, selection patching.
3. `src/recipe_runner.jsx` — a declarative runner. Reads a `RECIPE` object with an `operations` list and maps each `op` to a library call.
4. `tools/run.sh` — concatenates `ps_core.jsx` + `ps_core_v3.jsx` + `recipe_runner.jsx` + your recipe and sends it to Photoshop via AppleScript. Supports `-e/--eval` for inline snippets.

---

## What's inside (highlights)

| Category | Functions |
|---|---|
| Documents | `create` (new doc: RGB/CMYK/LAB, any background), `openDocument`, `close`, `canvasSize`, `flatten`, `mergeVisible`, `resizeImage`, `crop` |
| Saving | `PS.save.psd`, `.jpg`, `.png` |
| Layers | `duplicate`, `rename`, `setOpacity`, `setBlendMode`, `addGroup`, `remove` |
| Selection | `selectAll`, `deselect`, `selectRect`, `selectOval`, `selectSubject` (AI), `feather`, `expand`, `contract`, `smooth`, `border`, `colorRange`, `inverse`, `store`, `load`, `intersectRect` |
| Adjustments | `hueSaturation`, `levels`, `curves`, `colorBalance`, `vibrance`, `brightnessContrast`, `photoFilter`, `exposure`, `selectiveColor`, `channelMixer`, `gradientMap`, `blackWhite`, `posterize`, `threshold`, `invert` |
| Layer styles | `dropShadow`, `innerShadow`, `outerGlow`, `innerGlow`, `colorOverlay`, `gradientOverlay`, `bevel`, `stroke`, `clearAll` |
| Vector shapes | `rectangle`, `roundedRect`, `ellipse`, `triangle`, `polygon`, `line` |
| Smart objects | `smartObject.convert`, `rasterize` |
| Transforms | `rotateCanvas`, `flipCanvas`, `layer` (free transform) |
| Filters | `gaussianBlur`, `motionBlur` |
| Fills | `solidColor`, `gradient` (locale-safe explicit stops) |
| Text | `add`, `addAt`, `warp`, `bounds`, `setTracking`, `setScale`, `setBaselineShift` |
| Masks | `fromSelection`, `add`, `hide`, `invert`, `has`, `target`, `exitTarget`, `linearGradient` |
| Layers | `duplicate`, `unlockBackground`, `moveToBottom`, `list`, `bounds` |
| Introspection | `PS.report()` — layer tree, dimensions, histogram |
| CLI | `run.sh recipe.json`, `run.sh -e '…'`, `--version` |

Full reference: [`docs/API.md`](docs/API.md).

---

## The two recipe formats

**JSON** (preferred — no `#target` needed, most stable for AI generation):

```bash
./tools/run.sh recipe.json
```

**JSX** (for complex logic with conditionals):

```bash
./tools/run.sh recipe.jsx
```

See `recipes/` and `examples/` for runnable samples.

---

## Environment knobs

| Var | Purpose |
|---|---|
| `PS_APP` | Override Photoshop app name (default `Adobe Photoshop 2026`) |
| `REPORT` | Write a machine-readable report to this path |
| `PS_TIMEOUT` | Watchdog seconds before a stuck run is killed (default 300, `0` = off) |

---

## Requirements

- Adobe Photoshop 2021+ (tested on 2026)
- macOS with AppleScript (built-in)

## License

MIT
