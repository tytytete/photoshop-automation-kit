// =============================================================================
//  Example: v4 mask & gradient showcase (no external assets)
//  -----------------------------------------------------------------------------
//  One self-contained composition exercising the v4 fixes:
//    * locale-safe gradient fill (explicit RGB stops, no preset names)
//    * PS.mask.fromSelection() on a normal layer (the error-8800 fix)
//    * PS.mask.linearGradient() painted into a layer mask (gradient-tool 8800)
//    * doc.selection.selectOval() (native Selection patching)
//    * PS.layer.unlockBackground() / moveToBottom()
//
//  Run:  ./tools/run.sh examples/v4_mask_showcase.jsx
//  Note: the #include below is stripped automatically by run.sh.
// =============================================================================
#include "src/ps_core.jsx"

PS.setup({});

var OUT = '/tmp/v4_mask_showcase';

var doc = PS.document.createSize({ width: 1200, height: 800, resolution: 150, fill: 'white', name: 'Showcase' });

// Sky + dusk tint (locale-safe gradient fill -> gradient blend on a mask).
PS.fill.gradient({ style: 'linear', angle: 90, from: '#fde68a', to: '#b45309', name: 'Sky' });
var tint = PS.fill.gradient({ style: 'linear', angle: 90, from: '#1e3a8a', to: '#f59e0b', name: 'Dusk tint' });
PS.setBlendMode(tint, 'overlay');
PS.mask.linearGradient(tint, 360, 640, 180);

// Mountains + water.
PS.vector.create({ points: [[160, 800], [600, 340], [1040, 800]], color: '#1f2937', name: 'Mountain' });
PS.vector.roundedRect(0, 640, 1200, 800, 0, { color: '#0f766e', name: 'Water' });

// A normal raster layer masked to an oval "sun".
var sun = doc.artLayers.add();
sun.name = 'Sun';
doc.activeLayer = sun;
PS.selection.selectAll();
PS.color.setForeground(255, 214, 80);
PS.selection.fill();
PS.selection.deselect();
doc.selection.selectOval(450, 220, 750, 520, 0);
PS.mask.fromSelection(sun);
doc.selection.deselect();

PS.text.addAt({ contents: 'SUNRISE', sizePx: 64, font: 'Arial-BoldMT',
                color: '#fff7ed', x: 600, y: 80, justify: 'CENTER', name: 'Title' });

PS.export.auto(doc, OUT, 11);
PS.close(doc, false);

$.writeln('v4 showcase done -> ' + OUT + '.psd / .jpg');
'done';