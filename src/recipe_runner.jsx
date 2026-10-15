// =============================================================================
//  PS Recipe Runner — declarative Photoshop automation
//  -----------------------------------------------------------------------------
//  Define a global `RECIPE` object before loading this file, then run:
//      RecipeRunner.run(RECIPE);
//
//  This file is intended to be concatenated AFTER ps_core.jsx. The recipe
//  describes operations in a declarative JSON-like object — the AI agent never
//  writes raw Action Manager code, only a recipe object.
//
//  Recipe schema:
//      {
//          input:   '/path/to/input.jpg',           // required
//          output:  { psd: '...', jpg: '...' },     // optional
//          operations: [
//              { op: 'duplicate',        name: 'Copy' },
//              { op: 'selectSubject' },
//              { op: 'feather',          radius: 5 },
//              { op: 'hueSaturation',    name: 'Roses pink', colorize: true, hue: 332, saturation: 42, lightness: 6 },
//              { op: 'levels',           name: 'Brightness', shadow: 10, white: 240, gray: 1.15 },
//              { op: 'curves',           name: 'Contrast', points: [[0,0],[60,45],[200,210],[255,255]] },
//              { op: 'colorBalance',     name: 'Warm', midtones: [20,0,-15] },
//              { op: 'vibrance',         name: 'Pop', vibrance: 35 },
//              { op: 'brightnessContrast', name: 'BC', brightness: 40, contrast: 18 },
//              { op: 'photoFilter',      name: 'Warming', red: 236, green: 150, blue: 60, density: 30, preserve: true },
//              { op: 'exposure',         name: 'Exp', exposure: 0.5 },
//              { op: 'blackWhite',       name: 'B/W', reds: 40, yellows: 60 },
//              { op: 'selectiveColor',   name: 'SelCol', corrections: [{ color:'reds', cyan:-20, magenta:0, yellow:10, black:0 }] },
//              { op: 'channelMixer',     name: 'CM', monochrome: true, red: [40,30,30] },
//              { op: 'gradientMap',     name: 'GM' },
//              { op: 'posterize',        levels: 5 },
//              { op: 'threshold',        level: 128 },
//              { op: 'invert' },
//              { op: 'solidColor',       red: 100, green: 150, blue: 200, name: 'Fill' },
//              { op: 'text',             contents: 'Hello', size: 24, font: 'Arial', color: [255,255,255] },
//              { op: 'selectRect',       left: 0, top: 0, right: 400, bottom: 400, feather: 0 },
//              { op: 'selectSubject' },
//              { op: 'feather',          radius: 5 },
//              { op: 'deselect' },
//              { op: 'setOpacity',       value: 80 },
//              { op: 'intersectRect',    left: 0, top: 0, right: 300, bottom: 300 },
//          ]
//      }
// =============================================================================

var RecipeRunner = (function () {

    function px(v) {
        if (typeof v === 'string') return parseInt(v);
        if (v && v.value !== undefined) return parseInt(v.value);
        return parseInt(v) || 0;
    }

    function runOp(op, doc) {
        var name = op.name || '';
        switch (op.op) {

            // -- document -------------------------------------------
            case 'flatten':
                PS.flatten(doc);
                break;
            case 'mergeVisible':
                PS.mergeVisible(doc);
                break;
            case 'resizeImage':
                PS.resizeImage(op);
                break;
            case 'crop':
                PS.crop(op.left, op.top, op.right, op.bottom);
                break;

            // -- layers ---------------------------------------------
            case 'duplicate':
                PS.duplicate(op.name);
                break;
            case 'rename':
                PS.rename(doc.activeLayer, op.name);
                break;
            case 'setOpacity':
                PS.setOpacity(doc.activeLayer, op.value);
                break;
            case 'setBlendMode':
                PS.setBlendMode(doc.activeLayer, op.mode);
                break;
            case 'setVisible':
                PS.setVisible(doc.activeLayer, op.visible);
                break;
            case 'addGroup':
                PS.addGroup(op.name);
                break;

            // -- selection ------------------------------------------
            case 'selectAll':
                PS.selection.selectAll();
                break;
            case 'deselect':
                PS.selection.deselect();
                break;
            case 'selectRect':
                PS.selection.selectRect(op.left, op.top, op.right, op.bottom, op.feather);
                break;
            case 'selectOval':
                PS.selection.selectOval(op.left, op.top, op.right, op.bottom, op.feather);
                break;
            case 'selectSubject':
                PS.selection.selectSubject();
                break;
            case 'feather':
                PS.selection.feather(op.radius || 0);
                break;
            case 'expand':
                PS.selection.expand(op.radius || 0);
                break;
            case 'contract':
                PS.selection.contract(op.radius || 0);
                break;
            case 'inverse':
                PS.selection.inverse();
                break;
            case 'grow':
                PS.selection.grow();
                break;
            case 'similar':
                PS.selection.similar();
                break;
            case 'intersectRect':
                PS.selection.intersectRect(op.left, op.top, op.right, op.bottom);
                break;
            case 'storeSelection':
                PS.selection.store(op.name);
                break;
            case 'loadSelection':
                var ch = doc.channels.getByName(op.name);
                if (ch) {
                    var combine;
                    try { combine = SelectionType[op.combine || 'REPLACE']; }
                    catch (_) { combine = SelectionType.REPLACE; }
                    PS.selection.load(ch, combine, !!op.invert);
                }
                break;

            // -- adjustments ----------------------------------------
            case 'hueSaturation':
                PS.adjustment.hueSaturation(op);
                break;
            case 'levels':
                PS.adjustment.levels(op);
                break;
            case 'curves':
                PS.adjustment.curves(op);
                break;
            case 'colorBalance':
                PS.adjustment.colorBalance(op);
                break;
            case 'vibrance':
                PS.adjustment.vibrance(op);
                break;
            case 'brightnessContrast':
                PS.adjustment.brightnessContrast(op);
                break;
            case 'photoFilter':
                PS.adjustment.photoFilter(op);
                break;
            case 'exposure':
                PS.adjustment.exposure(op);
                break;
            case 'selectiveColor':
                PS.adjustment.selectiveColor(op);
                break;
            case 'channelMixer':
                PS.adjustment.channelMixer(op);
                break;
            case 'gradientMap':
                PS.adjustment.gradientMap(op);
                break;
            case 'blackWhite':
                PS.adjustment.blackWhite(op);
                break;
            case 'posterize':
                PS.adjustment.posterize(op);
                break;
            case 'threshold':
                PS.adjustment.threshold(op);
                break;
            case 'invert':
                PS.adjustment.invert(op);
                break;

            // -- fills & text ---------------------------------------
            case 'solidColor':
                PS.fill.solidColor(op);
                break;
            case 'gradientFill':
                PS.fill.gradient(op);
                break;
            case 'text':
                PS.text.add(op);
                break;
            case 'warpText':
                PS.text.warp(op);
                break;

            // -- mask -----------------------------------------------
            case 'maskFromSelection':
                PS.mask.fromSelection(doc.activeLayer);
                break;
            case 'invertMask':
                PS.mask.invert(doc.activeLayer);
                break;
            case 'revealAllMask':
                PS.mask.add(doc.activeLayer);
                break;
            case 'hideAllMask':
                PS.mask.hide(doc.activeLayer);
                break;

            // -- v2: layer styles -----------------------------------
            case 'dropShadow':
                PS.layerStyle.dropShadow(op);
                break;
            case 'stroke':
                PS.layerStyle.stroke(op);
                break;
            case 'innerShadow':
                PS.layerStyle.innerShadow(op);
                break;
            case 'outerGlow':
                PS.layerStyle.outerGlow(op);
                break;
            case 'innerGlow':
                PS.layerStyle.innerGlow(op);
                break;
            case 'colorOverlay':
                PS.layerStyle.colorOverlay(op);
                break;
            case 'gradientOverlay':
                PS.layerStyle.gradientOverlay(op);
                break;
            case 'bevel':
                PS.layerStyle.bevel(op);
                break;
            case 'clearLayerStyle':
                PS.layerStyle.clearAll(doc.activeLayer);
                break;

            // -- v2: shapes -----------------------------------------
            case 'rectangle':
            case 'roundedRect':
            case 'ellipse':
            case 'triangle':
            case 'polygon':
            case 'line':
                PS.shape[op.op](op);
                break;

            // -- v2: smart object / rasterize -----------------------
            case 'smartObject':
                PS.smartObject.convert();
                break;
            case 'rasterize':
                PS.rasterize(doc.activeLayer, op.type);
                break;

            // -- v2: transform --------------------------------------
            case 'rotateCanvas':
                PS.transform.rotateCanvas(op.angle);
                break;
            case 'flipCanvas':
                PS.transform.flipCanvas(op.direction);
                break;
            case 'transformLayer':
                PS.transform.layer(op);
                break;

            // -- v2: filters ----------------------------------------
            case 'gaussianBlur':
                PS.filter.gaussianBlur(op.radius);
                break;
            case 'motionBlur':
                PS.filter.motionBlur(op.angle, op.distance);
                break;

            // -- v2: selection fill / smooth / border / colorRange --
            case 'fillSelection':
                PS.selection.fill();
                break;
            case 'smooth':
                PS.selection.smooth(op.radius || 5);
                break;
            case 'selectBorder':
                PS.selection.border(op.radius || 5);
                break;
            case 'colorRange':
                PS.selection.colorRange(op.fuzziness);
                break;

            // -- v2: color ------------------------------------------
            case 'setForeground':
                PS.color.setForeground(op.red, op.green, op.blue);
                break;
            case 'setBackground':
                PS.color.setBackground(op.red, op.green, op.blue);
                break;
            case 'canvasSize':
                PS.document.canvasSize(doc, op.width, op.height);
                break;

            default:
                throw 'Unknown operation: ' + op.op;
        }
    }

    // Public API
    return {
        run: function (recipe) {
            var doc;
            if (recipe.create) {
                // Recipe creates a brand-new document instead of opening input.
                doc = PS.document.create(recipe.create);
                doc.activeLayer = doc.artLayers[0];
            } else {
                if (!recipe.input) throw 'Recipe must have "input" path or "create" object';
                doc = PS.openDocument(recipe.input);
                doc.activeLayer = doc.artLayers[0];
            }

            var ops = recipe.operations || [];
            for (var i = 0; i < ops.length; i++) {
                runOp(ops[i], doc);
            }

            // Optional: emit a machine-readable report for the calling agent.
            if (recipe.report) {
                var rep = PS.report(doc);
                var rf = File(recipe.report);
                rf.open('w');
                rf.write(PS.json(rep));
                rf.close();
            }

            // Save outputs
            if (recipe.output) {
                if (recipe.output.psd) PS.save.psd(doc, recipe.output.psd);
                if (recipe.output.jpg) PS.save.jpg(doc, recipe.output.jpg, recipe.output.jpgQuality);
                if (recipe.output.png) PS.save.png(doc, recipe.output.png);
            }

            if (recipe.close !== false) {
                PS.close(doc, false);
            }

            // Return a primitive so the AppleScript bridge can marshal it.
            return 'OK';
        }
    };

})();