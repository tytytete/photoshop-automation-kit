# Photoshop Automation Kit

A reusable, AI-friendly ExtendScript library for automating Adobe Photoshop from the command line. Every operation produces **real Photoshop objects** (adjustment layers, layer masks, text layers, fill layers, selections) — not flattened bitmap paste.

Tested on **Photoshop 2021–2026** (macOS / Windows).

## Quick start

```bash
# 1. Write a recipe (JSX object literal)
cat > my_recipe.jsx << 'JSX'
#target photoshop

var RECIPE = {
    input: '/Users/you/photo.jpg',
    output: { psd: '/Users/you/result.psd', jpg: '/Users/you/result.jpg' },
    operations: [
        { op: 'brightnessContrast', name: 'Brighten', brightness: 45, contrast: 20 },
        { op: 'levels',             name: 'Levels',    shadow: 10, white: 240, gray: 1.2 },
        { op: 'curves',             name: 'Contrast',  points: [[0,0],[60,44],[200,212],[255,255]] },
        { op: 'saturation',         name: 'Pop',      hue: 0, saturation: 25 }
    ]
};

RecipeRunner.run(RECIPE);
JSX

# 2. Run through Photoshop
./tools/run.sh my_recipe.jsx
```

## How it works

1. `src/ps_core.jsx` — the main library (~35 functions). Provides `PS.*` namespace for documents, selections, adjustment layers, fill layers, text, and masks.
2. `src/recipe_runner.jsx` — a declarative runner. Reads a `RECIPE` object with an `operations` list and calls the corresponding `PS` functions.
3. `tools/run.sh` — a bash script that concatenates `ps_core.jsx` + `recipe_runner.jsx` + your recipe and sends it to Photoshop via AppleScript (macOS) or COM (Windows).

## What's inside

| Category | Functions |
|---|---|
| Documents | `openDocument`, `close`, `flatten`, `mergeVisible`, `resizeImage`, `crop` |
| Saving | `PS.save.psd`, `.jpg`, `.png` |
| Layers | `duplicate`, `rename`, `setOpacity`, `setBlendMode`, `addGroup`, `remove` |
| Selection | `selectAll`, `deselect`, `selectRect`, `selectOval`, `selectSubject` (AI), `feather`, `expand`, `contract`, `inverse`, `grow`, `store`, `load`, `intersectRect` |
| Adjustments | `hueSaturation`, `levels`, `curves`, `colorBalance`, `vibrance`, `brightnessContrast`, `photoFilter`, `exposure`, `selectiveColor`, `channelMixer`, `gradientMap`, `blackWhite`, `posterize`, `threshold`, `invert` |
| Fills | `solidColor` |
| Text | `PS.text.add({ contents, size, font, color, position })` |
| Masks | `maskFromSelection`, `invertMask` |

For the full API reference, see [`docs/API.md`](docs/API.md).

## AI Agent Usage

If you are an AI model (or building an agent), read [`AGENTS.md`](AGENTS.md) for the exact invocation pattern and the recipe JSON schema. You should produce a recipe file and invoke `tools/run.sh` — never write raw Action Manager code.

## Requirements

- Adobe Photoshop 2021+ (tested on 2026)
- macOS with AppleScript (built-in)
- For Windows: use `cscript` or the Adobe VBScript bridge (COM)

## License

MIT