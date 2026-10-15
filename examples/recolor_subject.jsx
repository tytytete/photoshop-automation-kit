// =============================================================================
//  Example: direct library usage (no recipe runner)
//  -----------------------------------------------------------------------------
//  Demonstrates the raw PS.* namespace for a full non-destructive workflow:
//  open -> duplicate -> AI subject select -> recolor subject -> save PSD + JPG.
//
//  Run (after cloning):
//      ./tools/run.sh examples/recolor_subject.jsx
// =============================================================================
#target photoshop

// Edit these paths:
var INPUT = '/path/to/input.jpg';
var OUT_PSD = '/path/to/output.psd';
var OUT_JPG = '/path/to/output.jpg';

var doc = PS.openDocument(INPUT);
doc.activeLayer = doc.artLayers[0];

// 1. Keep a working copy of the original pixels
var copy = PS.duplicate('Subject copy');

// 2. Select the subject with Photoshop's AI (object selection)
PS.selection.selectSubject();
PS.selection.feather(4);

// 3. Recolor the subject with a colorize Hue/Saturation layer.
//    Because a selection is active, the layer is masked to the subject only.
PS.adjustment.hueSaturation({
    name: 'Recolor subject',
    colorize: true,
    hue: 210,          // blueish teal
    saturation: 45,
    lightness: 8
});

PS.selection.deselect();

// 4. Add a global subtle vibrance for a finished look
PS.adjustment.vibrance({ name: 'Pop', vibrance: 25, saturation: 4 });

// 5. Save both formats
doc.activeLayer = doc.artLayers[0];
PS.save.psd(doc, OUT_PSD);
PS.save.jpg(doc, OUT_JPG);
PS.close(doc, false);