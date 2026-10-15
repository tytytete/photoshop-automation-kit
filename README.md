# Photoshop Automation Kit

A reusable, AI-friendly ExtendScript library for automating Adobe Photoshop from the command line. Every operation produces **real Photoshop objects** (adjustment layers, layer masks, text layers, fill layers, vector shapes, selections) — never flattened bitmap paste.

Tested on **Photoshop 2021–2026** (macOS).

---

## Installation

Clone the repository onto your machine:

```bash
git clone https://github.com/tytytete/photoshop-automation-kit.git ~/Documents/photoshop-automation-kit
```

The library lives at:

```
~/Documents/photoshop-automation-kit/
├── AGENTS.md          ← the file AI models must read
├── README.md          ← this file (for humans)
├── docs/API.md        ← full function reference
├── src/
│   ├── ps_core.jsx    ← the library (~80 functions, PS.* namespace)
│   └── recipe_runner.jsx  ← declarative recipe engine
├── tools/
│   └── run.sh         ← one-command runner (macOS)
├── recipes/           ← example recipes (.json and .jsx)
└── examples/          ← full task examples
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

- read `AGENTS.md` (the recipe JSON whitelist),
- generate a `.json` recipe,
- run `./tools/run.sh recipe.json`,
- optionally read the machine-readable `report.json` output.

You never paste the library code into the chat again — you just point the model at the path.

---

## How it works

1. `src/ps_core.jsx` — the library. Provides the `PS.*` namespace for documents, selections, 15+ adjustment layers, layer styles, vector shapes, filters, fills, text, masks, transforms, and introspection.
2. `src/recipe_runner.jsx` — a declarative runner. Reads a `RECIPE` object with an `operations` list and maps each `op` to a library call.
3. `tools/run.sh` — concatenates `ps_core.jsx` + `recipe_runner.jsx` + your recipe and sends it to Photoshop via AppleScript.

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
| Fills | `solidColor`, `gradient` |
| Text | `add`, `warp`, `setTracking`, `setScale`, `setBaselineShift` |
| Masks | `add`, `hide`, `invert`, `fromSelection` |
| Introspection | `PS.report()` — layer tree, dimensions, histogram |

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

---

## Requirements

- Adobe Photoshop 2021+ (tested on 2026)
- macOS with AppleScript (built-in)

## License

MIT
