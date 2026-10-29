// =============================================================================
//  PS Recipe Runner v4 — declarative, hang-proof Photoshop automation
//  -----------------------------------------------------------------------------
//  Define a global `RECIPE` object before loading this file, then run:
//      RecipeRunner.run(RECIPE);
//
//  Concatenated AFTER ps_core.jsx and ps_core_v3.jsx.
//
//  Recipe schema (v4):
//      {
//          input:   '/path/to/input.jpg',            // OR:
//          create:  { width, height, resolution, mode, fill, name,
//                     unit: 'px'|'mm'|'cm'|'in' },   // unit-aware sizing (v3)
//          output:  { psd:'...', jpg:'...', png:'...', jpgQuality: 11 },
//          autoPsd: true,                            // derive PSD from jpg path (v3)
//          log:     '/path/recipe.log',              // run log (v3)
//          report:  '/path/report.json',
//          onError: 'continue' | 'stop',             // default 'continue' (v3)
//          operations: [
//              { op: 'vectorShape', points: [[x,y],...], closed: true,
//                                   color: [r,g,b] | '#rrggbb', name: 'Peak' },
//              { op: 'circle',  cx: 500, cy: 500, r: 120, color: '#2D4A3E' },
//              { op: 'rect',    left: 10, top: 10, right: 100, bottom: 60, color: '#000' },
//              { op: 'roundedRect', left:.., top:.., right:.., bottom:.., radius: 24 },
//              { op: 'polygon', cx:.., cy:.., r:.., sides: 5, rotation: 0 },
//              { op: 'vectorLine', x1:.., y1:.., x2:.., y2:.., thickness: 4 },
//              { op: 'textAt',  contents: 'Menu', sizePx: 48, x: 100, y: 200,
//                               font: 'ArialMT', color: [0,0,0], justify: 'center' },
//              { op: 'textStack', x: 100, y: 200, sizePx: 32, gap: 12,
//                               items: ['Line 1', 'Line 2', { text:'Line 3', sizePx: 20 }] },
//              { op: 'maskGradient', startY: 500, endY: 900, feather: 200,
//                                    direction: 'vertical', reveal: false },
//              { op: 'duplicateLayer', name: 'Copy', invisible: false },
//              { op: 'moveToBottom' }, { op: 'unlockBackground' },
//              { op: 'exportAuto', base: '/path/out' },
//              ... plus every v2 op (adjustments, styles, text, filters, ...)
//          ]
//      }
//
//  v4 behaviour changes:
//    * every operation is still isolated; logs are returned to stdout by
//      run.sh through PS.finish().
//    * mask ops (maskFromSelection/revealAllMask/hideAllMask/invertMask) now
//      work on normal, text, fill and adjustment layers.
//    * maskGradient paints a soft falloff into the active layer mask.
//    * gradientFill/gradientOverlay build explicit RGB stops (no localized
//      preset names).
//    * new layer ops: duplicateLayer, unlockBackground, moveToBottom, log.
//
//  v3 behaviour changes:
//    * app.displayDialogs = DialogModes.NO is set automatically (no hang).
//    * rulerUnits forced to PIXELS, typeUnits to POINTS.
//    * every operation is isolated: a failure is logged and the run CONTINUES
//      (set onError:'stop' to abort). Errors never raise a modal dialog.
//    * output.psd is auto-derived from output.jpg when autoPsd is true, so the
//      layered source is always written.
// =============================================================================

var RecipeRunner = (function () {

    function px(v) {
        if (typeof v === 'string') return parseInt(v, 10);
        if (v && v.value !== undefined) return parseInt(v.value, 10);
        return parseInt(v, 10) || 0;
    }

    // ---------------------------------------------------------------- ops v2 --
    function runOp(op, doc) {
        switch (op.op) {

            // -- document -------------------------------------------
            case 'flatten':
                PS.flatten(doc); break;
            case 'mergeVisible':
                PS.mergeVisible(doc); break;
            case 'resizeImage':
                PS.resizeImage(op); break;
            case 'crop':
                PS.crop(op.left, op.top, op.right, op.bottom); break;

            // -- layers ---------------------------------------------
            case 'duplicate':
                PS.duplicate(op.name); break;
            case 'duplicateLayer':
                PS.layer.duplicate(doc.activeLayer, op.name, op.invisible); break;
            case 'unlockBackground':
                PS.layer.unlockBackground(doc); break;
            case 'moveToBottom':
                PS.layer.moveToBottom(doc.activeLayer, doc); break;
            case 'rename':
                PS.rename(doc.activeLayer, op.name); break;
            case 'setOpacity':
                PS.setOpacity(doc.activeLayer, op.value); break;
            case 'setBlendMode':
                PS.setBlendMode(doc.activeLayer, op.mode); break;
            case 'setVisible':
                PS.setVisible(doc.activeLayer, op.visible); break;
            case 'addGroup':
                PS.addGroup(op.name); break;

            // -- selection ------------------------------------------
            case 'selectAll':
                PS.selection.selectAll(); break;
            case 'deselect':
                PS.selection.deselect(); break;
            case 'selectRect':
                PS.selection.selectRect(op.left, op.top, op.right, op.bottom, op.feather); break;
            case 'selectOval':
                PS.selection.selectOval(op.left, op.top, op.right, op.bottom, op.feather); break;
            case 'selectSubject':
                PS.selection.selectSubject(); break;
            case 'feather':
                PS.selection.feather(op.radius || 0); break;
            case 'expand':
                PS.selection.expand(op.radius || 0); break;
            case 'contract':
                PS.selection.contract(op.radius || 0); break;
            case 'inverse':
                PS.selection.inverse(); break;
            case 'grow':
                PS.selection.grow(); break;
            case 'similar':
                PS.selection.similar(); break;
            case 'intersectRect':
                PS.selection.intersectRect(op.left, op.top, op.right, op.bottom); break;
            case 'storeSelection':
                PS.selection.store(op.name); break;
            case 'loadSelection':
                var ch = doc.channels.getByName(op.name);
                if (ch) {
                    var combine;
                    try { combine = SelectionType[op.combine || 'REPLACE']; }
                    catch (e) { combine = SelectionType.REPLACE; }
                    PS.selection.load(ch, combine, !!op.invert);
                }
                break;

            // -- adjustments ----------------------------------------
            case 'hueSaturation':
                PS.adjustment.hueSaturation(op); break;
            case 'levels':
                PS.adjustment.levels(op); break;
            case 'curves':
                PS.adjustment.curves(op); break;
            case 'colorBalance':
                PS.adjustment.colorBalance(op); break;
            case 'vibrance':
                PS.adjustment.vibrance(op); break;
            case 'brightnessContrast':
                PS.adjustment.brightnessContrast(op); break;
            case 'photoFilter':
                PS.adjustment.photoFilter(op); break;
            case 'exposure':
                PS.adjustment.exposure(op); break;
            case 'selectiveColor':
                PS.adjustment.selectiveColor(op); break;
            case 'channelMixer':
                PS.adjustment.channelMixer(op); break;
            case 'gradientMap':
                PS.adjustment.gradientMap(op); break;
            case 'blackWhite':
                PS.adjustment.blackWhite(op); break;
            case 'posterize':
                PS.adjustment.posterize(op); break;
            case 'threshold':
                PS.adjustment.threshold(op); break;
            case 'invert':
                PS.adjustment.invert(op); break;

            // -- fills & text ---------------------------------------
            case 'solidColor':
                PS.fill.solidColor(op); break;
            case 'gradientFill':
                PS.fill.gradient(op); break;
            case 'text':
                PS.text.add(op); break;
            case 'warpText':
                PS.text.warp(op); break;

            // -- mask -----------------------------------------------
            case 'maskFromSelection':
                PS.mask.fromSelection(doc.activeLayer); break;
            case 'invertMask':
                PS.mask.invert(doc.activeLayer); break;
            case 'revealAllMask':
                PS.mask.add(doc.activeLayer); break;
            case 'hideAllMask':
                PS.mask.hide(doc.activeLayer); break;
            case 'maskTarget':
                PS.mask.target(doc.activeLayer); break;
            case 'maskExitTarget':
                PS.mask.exitTarget(); break;
            case 'maskGradient':
            case 'maskLinearGradient':
                PS.mask.linearGradient(
                    doc.activeLayer,
                    op.startY !== undefined ? op.startY : op.start,
                    op.endY !== undefined ? op.endY : op.end,
                    op.feather,
                    op
                );
                break;

            // -- misc -----------------------------------------------
            case 'log':
                PS.log(op.message !== undefined ? op.message : op.text); break;

            // -- v2: layer styles -----------------------------------
            case 'dropShadow':
                PS.layerStyle.dropShadow(op); break;
            case 'stroke':
                PS.layerStyle.stroke(op); break;
            case 'innerShadow':
                PS.layerStyle.innerShadow(op); break;
            case 'outerGlow':
                PS.layerStyle.outerGlow(op); break;
            case 'innerGlow':
                PS.layerStyle.innerGlow(op); break;
            case 'colorOverlay':
                PS.layerStyle.colorOverlay(op); break;
            case 'gradientOverlay':
                PS.layerStyle.gradientOverlay(op); break;
            case 'bevel':
                PS.layerStyle.bevel(op); break;
            case 'clearLayerStyle':
                PS.layerStyle.clearAll(doc.activeLayer); break;

            // -- v2: shapes (full-canvas legacy) --------------------
            case 'rectangle':
            case 'roundedRect':
            case 'ellipse':
            case 'triangle':
            case 'polygon':
            case 'line':
                PS.shape[op.op](op); break;

            // -- v2: smart object / rasterize -----------------------
            case 'smartObject':
                PS.smartObject.convert(); break;
            case 'rasterize':
                PS.rasterize(doc.activeLayer, op.type); break;

            // -- v2: transform --------------------------------------
            case 'rotateCanvas':
                PS.transform.rotateCanvas(op.angle); break;
            case 'flipCanvas':
                PS.transform.flipCanvas(op.direction); break;
            case 'transformLayer':
                PS.transform.layer(op); break;

            // -- v2: filters ----------------------------------------
            case 'gaussianBlur':
                PS.filter.gaussianBlur(op.radius); break;
            case 'motionBlur':
                PS.filter.motionBlur(op.angle, op.distance); break;

            // -- v2: selection fill / smooth / border / colorRange --
            case 'fillSelection':
                PS.selection.fill(); break;
            case 'smooth':
                PS.selection.smooth(op.radius || 5); break;
            case 'selectBorder':
                PS.selection.border(op.radius || 5); break;
            case 'colorRange':
                PS.selection.colorRange(op.fuzziness); break;

            // -- v2: color ------------------------------------------
            case 'setForeground':
                PS.color.setForeground(op.red, op.green, op.blue); break;
            case 'setBackground':
                PS.color.setBackground(op.red, op.green, op.blue); break;
            case 'canvasSize':
                PS.document.canvasSize(doc, op.width, op.height); break;

            // ------------------------------------------------- v3 ops --
            // Vector shapes at exact coordinates (never full-canvas).
            case 'vectorShape':
                PS.vector.create(op); break;
            case 'circle':
                PS.vector.circle(op.cx, op.cy, op.r, op); break;
            case 'rect':
                PS.vector.rect(op.left, op.top, op.right, op.bottom, op); break;
            case 'rectAt':
                PS.vector.rect(op.left, op.top, op.right, op.bottom, op); break;
            case 'roundedRectAt':
                PS.vector.roundedRect(op.left, op.top, op.right, op.bottom, op.radius || 24, op); break;
            case 'polygonAt':
                PS.vector.polygon(op.cx, op.cy, op.r, op.sides || 3, op); break;
            case 'triangleAt':
                PS.vector.triangle(op.cx, op.cy, op.r, op); break;
            case 'vectorLine':
                PS.vector.line(op.x1, op.y1, op.x2, op.y2, op.thickness || 2, op); break;

            // Text placed in document pixels.
            case 'textAt':
                PS.text.addAt(op); break;
            case 'textStack':
                PS.layout.flow(op); break;

            // Explicit / derived export.
            case 'export':
                PS.export(doc, op); break;
            case 'exportAuto':
                PS.export.auto(doc, op.base, op.jpgQuality); break;

            default:
                throw 'Unknown operation: ' + op.op;
        }
    }

    // ------------------------------------------------------------------ run --
    return {
        run: function (recipe) {
            var logPath = recipe.log || null;
            var onError = recipe.onError || 'continue';
            var errors = [];
            var i;

            // Hang-proof preamble: no modal dialogs, deterministic units.
            PS.setup({ logPath: logPath });
            PS.log('=== RecipeRunner v' + PS.VERSION + ' start ===', logPath);

            var doc;
            if (recipe.create) {
                doc = PS.document.createSize(recipe.create);
                try { doc.activeLayer = doc.artLayers[0]; } catch (e) {}
            } else {
                if (!recipe.input) throw 'Recipe must have "input" path or "create" object';
                doc = PS.openDocument(recipe.input);
                try { doc.activeLayer = doc.artLayers[0]; } catch (e) {}
            }
            PS.log('document: ' + doc.name + ' ' + doc.width.value + 'x' + doc.height.value +
                   'px @' + doc.resolution + 'ppi ' + doc.mode, logPath);

            var ops = recipe.operations || [];
            for (i = 0; i < ops.length; i++) {
                try {
                    runOp(ops[i], doc);
                    PS.log('ok   ' + (i + 1) + '/' + ops.length + '  ' + ops[i].op + (ops[i].name ? ('  "' + ops[i].name + '"') : ''), logPath);
                } catch (e) {
                    var rec = { index: i, op: ops[i].op, error: String(e), line: (e && e.line) || null };
                    errors.push(rec);
                    PS.logError('op ' + (i + 1) + '/' + ops.length + ' ' + ops[i].op, e, logPath);
                    if (onError === 'stop') break;
                }
            }

            var report = null;
            if (recipe.report) {
                report = PS.report(doc);
                var rf = File(recipe.report);
                rf.open('w');
                rf.write(PS.json(report));
                rf.close();
            }

            // Export: explicit outputs win, autoPsd guarantees the source.
            var output = recipe.output || {};
            if (recipe.autoPsd && output.jpg && !output.psd) {
                output.psd = String(output.jpg).replace(/\.(jpg|jpeg|png)$/i, '') + '.psd';
            }
            try {
                PS.export(doc, output);
                PS.log('exported: ' + (output.psd || '-') + ' | ' + (output.jpg || '-'), logPath);
            } catch (e) {
                PS.logError('export', e, logPath);
                errors.push({ index: -1, op: 'export', error: String(e) });
            }

            // Machine-readable summary — captured BEFORE closing the document.
            var summary = {
                version: PS.VERSION,
                document: { name: doc.name, width: px(doc.width), height: px(doc.height), resolution: px(doc.resolution) },
                operations: ops.length,
                errors: errors,
                output: output,
                log: logPath
            };

            if (recipe.close !== false) PS.close(doc, false);

            PS.log('=== RecipeRunner done (' + errors.length + ' error(s)) ===', logPath);

            if (recipe.summary) {
                var sf = File(recipe.summary);
                sf.open('w');
                sf.write(PS.json(summary));
                sf.close();
            }

            // Return a primitive the AppleScript bridge can marshal. PS._result
            // is also picked up by run.sh's PS.finish() footer.
            var result = 'OK: ' + ops.length + ' ops, ' + errors.length + ' errors';
            PS._result = result;
            return result;
        }
    };

})();
