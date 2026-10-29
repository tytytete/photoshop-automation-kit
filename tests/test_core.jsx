// v4 self-test — exercises the ergonomic helpers, the v4 mask/gradient fixes
// and the hang-proof guards.
// Run:  ./tools/run.sh tests/test_core.jsx
#target photoshop

var LOG = '/tmp/ps_v4_test.log';
var PASS = 0, FAIL = 0;
function out(s) { PS.log(s, LOG); }
function ok(cond, label, extra) {
    if (cond) { PASS++; out('PASS  ' + label + (extra ? ('  ' + extra) : '')); }
    else      { FAIL++; out('FAIL  ' + label + (extra ? ('  ' + extra) : '')); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= tol; }

// Sample the composite at a document pixel, forcing a redraw first (mask
// edits are not reflected in color samplers until Photoshop repaints).
function sample(doc, x, y) {
    try { app.refresh(); } catch (e) {}
    var s = doc.colorSamplers.add([x, y]);
    var c = s.color;
    var rgb = [Math.round(c.rgb.red), Math.round(c.rgb.green), Math.round(c.rgb.blue)];
    s.remove();
    return rgb;
}
function isBlue(c)  { return c[2] > 180 && c[0] < 80; }
function isWhite(c) { return c[0] > 180 && c[1] > 180 && c[2] > 180; }
function isRed(c)   { return c[0] > 180 && c[2] < 80; }

try {
PS.setup({ logPath: LOG });
out('=== PS v4 self-test (version ' + PS.VERSION + ') ===');

// 1. version + low-level helpers
ok(PS.VERSION === '4.0.0', 'version is 4.0.0', PS.VERSION);
ok(PS.s2t('red') === PS.c2t('Rd  '), 'PS.s2t/PS.c2t exported', PS.s2t('red'));
ok(typeof s2t === 'function' && typeof c2t === 'function', 'global s2t/c2t exported');

// 2. unit-aware document sizing: 100x100 cm @150ppi -> 5906px
var doc = PS.document.createSize({ width: 100, height: 100, unit: 'cm', resolution: 150, mode: 'rgb', fill: 'white', name: 'TestV4' });
ok(doc.width.value === 5906 && doc.resolution === 150, 'createSize cm->px', doc.width.value + 'x' + doc.height.value + '@' + doc.resolution);

// 3. units
ok(PS.unit.mmToPx(210, 300) === 2480 && PS.unit.mmToPx(297, 300) === 3508, 'mm->px A4 @300', PS.unit.mmToPx(210,300) + 'x' + PS.unit.mmToPx(297,300));
ok(approx(PS.unit.pxToPt(150, doc), 72, 0.001), 'px->pt uses resolution', PS.unit.pxToPt(150, doc));
ok(PS.color.hexToRgb('#2D4A3E')[0] === 45, 'hexToRgb');

// 4. vector shapes land at EXACT coordinates (the v2 killer bug)
var disc = PS.vector.circle(2953, 2953, 2000, { color: '#2D4A3E', name: 'Disc' });
var b = PS.text.bounds(disc);
ok(approx(b.left, 953, 2) && approx(b.top, 953, 2) && approx(b.right, 4953, 2) && approx(b.bottom, 4953, 2),
   'vector.circle exact bounds', Math.round(b.left)+','+Math.round(b.top)+','+Math.round(b.right)+','+Math.round(b.bottom));

var rc = PS.vector.rect(100, 100, 600, 300, { color: '#C97B5A', name: 'Rect' });
var rb = PS.text.bounds(rc);
ok(approx(rb.width, 500, 2) && approx(rb.height, 200, 2), 'vector.rect size', rb.width + 'x' + rb.height);

var rr = PS.vector.roundedRect(700, 100, 1200, 400, 60, { color: '#000000', name: 'RR' });
var rrb = PS.text.bounds(rr);
ok(approx(rrb.width, 500, 3) && approx(rrb.height, 300, 3), 'vector.roundedRect size', rrb.width + 'x' + rrb.height);

var pg = PS.vector.polygon(1500, 250, 200, 6, { color: '#336699', name: 'Hex' });
var pgb = PS.text.bounds(pg);
ok(pgb.width > 300 && pgb.height > 300, 'vector.polygon created', pgb.width + 'x' + pgb.height);

var ln = PS.vector.line(100, 500, 700, 500, 20, { color: '#000000', name: 'Line' });
var lnb = PS.text.bounds(ln);
ok(approx(lnb.width, 600, 3) && approx(lnb.height, 20, 2), 'vector.line', lnb.width + 'x' + lnb.height);

// 4b. circles must be round, not diamonds (left/right tangent fix)
var cdoc = PS.document.createSize({ width: 300, height: 300, resolution: 72, fill: 'white', name: 'CircleTest' });
PS.vector.circle(150, 150, 100, { color: '#ff0000', name: 'Round' });
ok(isRed(sample(cdoc, 150, 150)), 'vector.circle centre filled', sample(cdoc, 150, 150));
ok(isRed(sample(cdoc, 210, 210)), 'vector.circle is round (diagonal)', sample(cdoc, 210, 210));
ok(isWhite(sample(cdoc, 55, 55)), 'vector.circle corner empty', sample(cdoc, 55, 55));
PS.close(cdoc, false);

// 5. upgraded PS.shape.* with bounds
var sh = PS.shape.rectangle({ bounds: [2000, 100, 2300, 300], color: '#2D4A3E', name: 'ShapeRect' });
var shb = PS.text.bounds(sh);
ok(approx(shb.width, 300, 2) && approx(shb.height, 200, 2), 'shape.rectangle bounds', shb.width + 'x' + shb.height);

// 6. text placement + measured bounds
var t1 = PS.text.addAt({ contents: 'TITLE', sizePx: 120, font: 'Arial-BoldMT', color: '#2D4A3E', x: 400, y: 800, justify: 'LEFT', name: 'T1' });
var tb1 = PS.text.bounds(t1);
ok(tb1.width > 0 && tb1.height > 0, 'text.addAt bounds', Math.round(tb1.left) + ',' + Math.round(tb1.top) + ' ' + Math.round(tb1.width) + 'x' + Math.round(tb1.height));
ok(approx(tb1.left, 400, 6), 'text.addAt x honoured (LEFT)', tb1.left);

// 7. layout.flow never overlaps
var flow = PS.layout.flow({
    x: 400, y: 1400, sizePx: 90, font: 'ArialMT', color: '#000000', justify: 'LEFT', gap: 20,
    items: ['Line one', 'Line two', { text: 'Line three bigger', sizePx: 140 }, 'Line four']
});
var overlap = false;
for (var i = 1; i < flow.length; i++) {
    if (flow[i].bounds.top < flow[i - 1].bounds.bottom - 1) overlap = true;
}
ok(flow.length === 4 && !overlap, 'layout.flow no overlap', flow.length + ' lines, overlap=' + overlap);

// 8. hang-proof guard: a failing call returns null, never raises a modal
var bad = PS.safe('expected-failure', function () { return PS.vector.create({ points: null }); });
ok(bad === null, 'PS.safe swallows failure', 'returned ' + bad);

// 9. logging buffer (problem 8)
out('buffer-marker');
ok(PS.getLogOutput().indexOf('buffer-marker') >= 0, 'PS.getLogOutput captures logs');
PS._result = 'RESULT-X';
ok(PS.finish().indexOf('RESULT-X') >= 0 && PS.finish().indexOf('buffer-marker') >= 0, 'PS.finish returns result + logs');
PS._result = null;

// 10. native Selection monkey-patch (problem 3)
ok(typeof doc.selection.selectRect === 'function', 'doc.selection.selectRect patched');
ok(typeof doc.selection.selectOval === 'function', 'doc.selection.selectOval patched');

// 11. export.auto guarantees BOTH psd and jpg
var files = PS.export.auto(doc, '/tmp/ps_v4_export_test.jpg', 11);
var fP = File(files.psd), fJ = File(files.jpg);
ok(fP.exists && fJ.exists, 'export.auto wrote psd+jpg', files.psd + ' | ' + files.jpg);

ok(PS.layer.list(doc).length > 8, 'layer.list', PS.layer.list(doc).length + ' layers');

PS.close(doc, false);

// ---------------------------------------------------------------------------
// Mask subsystem (problem 1) — small document for fast pixel checks
// ---------------------------------------------------------------------------
var mdoc = PS.document.createSize({ width: 400, height: 300, resolution: 72, fill: 'white', name: 'MaskTest' });
var ml = mdoc.artLayers.add(); ml.name = 'Raster'; mdoc.activeLayer = ml;
PS.selection.selectAll(); PS.color.setForeground(0, 0, 255); PS.selection.fill(); PS.selection.deselect();

ok(PS.mask.has(ml) === false, 'mask.has false before mask');

mdoc.selection.selectRect(100, 50, 300, 250, 0);
PS.mask.fromSelection(ml);
mdoc.selection.deselect();
ok(PS.mask.has(ml) === true, 'mask.fromSelection created mask');
ok(isBlue(sample(mdoc, 200, 150)), 'mask.fromSelection reveals inside', sample(mdoc, 200, 150));
ok(isWhite(sample(mdoc, 20, 20)), 'mask.fromSelection hides outside', sample(mdoc, 20, 20));

PS.mask.invert(ml);
ok(isWhite(sample(mdoc, 200, 150)) && isBlue(sample(mdoc, 20, 20)), 'mask.invert swaps mask');

PS.mask.add(ml);
ok(isBlue(sample(mdoc, 200, 150)) && isBlue(sample(mdoc, 20, 20)), 'mask.add reveal-all');

PS.mask.hide(ml);
ok(isWhite(sample(mdoc, 200, 150)), 'mask.hide hide-all');

PS.mask.add(ml);
PS.mask.linearGradient(ml, 150, 300, 60);
var gTop = sample(mdoc, 200, 20), gMid = sample(mdoc, 200, 150), gLow = sample(mdoc, 200, 280);
ok(isBlue(gTop), 'mask.linearGradient keeps top', gTop);
ok(gMid[0] > 80 && gMid[0] < 220 && gMid[1] > 80 && gMid[1] < 220, 'mask.linearGradient has soft middle', gMid);
ok(isWhite(gLow), 'mask.linearGradient hides bottom', gLow);

// true oval selection + mask
var odoc = PS.document.createSize({ width: 400, height: 300, resolution: 72, fill: 'white', name: 'OvalTest' });
var ol = odoc.artLayers.add(); ol.name = 'Raster'; odoc.activeLayer = ol;
PS.selection.selectAll(); PS.color.setForeground(0, 0, 255); PS.selection.fill(); PS.selection.deselect();
odoc.selection.selectOval(100, 50, 300, 250, 0);
PS.mask.fromSelection(ol);
odoc.selection.deselect();
ok(isBlue(sample(odoc, 200, 150)), 'selectOval reveals centre', sample(odoc, 200, 150));
ok(isWhite(sample(odoc, 110, 60)), 'selectOval hides corner', sample(odoc, 110, 60));
PS.close(odoc, false);

// content-layer masks: fill layers own an internal mask already
var cmaskdoc = PS.document.createSize({ width: 400, height: 300, resolution: 72, fill: 'white', name: 'ContentMask' });
var cf = PS.fill.solidColor({ red: 255, green: 0, blue: 0, name: 'RedFill' });
cmaskdoc.activeLayer = cf;
ok(PS.mask.has(cf) === true, 'content layer reports internal mask');
cmaskdoc.selection.selectRect(100, 50, 300, 250, 0);
PS.mask.fromSelection(cf);
cmaskdoc.selection.deselect();
ok(isRed(sample(cmaskdoc, 200, 150)) && isWhite(sample(cmaskdoc, 20, 20)), 'content mask fromSelection');
PS.mask.hide(cf);
ok(isWhite(sample(cmaskdoc, 200, 150)), 'content mask hide');
PS.mask.add(cf);
ok(isRed(sample(cmaskdoc, 200, 150)), 'content mask add');
PS.close(cmaskdoc, false);

// ---------------------------------------------------------------------------
// Locale-safe gradients (problem 2 + 7)
// ---------------------------------------------------------------------------
var gdoc = PS.document.createSize({ width: 300, height: 100, resolution: 72, fill: 'white', name: 'GradTest' });
var gl = PS.fill.gradient({ style: 'linear', angle: 0, from: '#0000ff', to: '#ff0000', name: 'BlueRed' });
ok(gl.kind === LayerKind.GRADIENTFILL, 'gradient fill created', gl.name);
gdoc.flatten();
var gL = sample(gdoc, 10, 50), gM = sample(gdoc, 150, 50), gR = sample(gdoc, 290, 50);
ok(gL[2] > 150 && gL[0] < 100, 'gradient left is blue', gL);
ok(gM[0] > 80 && gM[2] > 80, 'gradient middle is mixed', gM);
ok(gR[0] > 150 && gR[2] < 100, 'gradient right is red', gR);
PS.close(gdoc, false);

var odoc2 = PS.document.createSize({ width: 300, height: 200, resolution: 72, fill: 'white', name: 'OverlayTest' });
var of = PS.fill.solidColor({ red: 30, green: 30, blue: 30, name: 'Base' });
of = PS.layerStyle.gradientOverlay({ opacity: 60, from: '#00ff00', to: '#ffff00' });
ok(!!of, 'gradientOverlay locale-safe', of ? of.name : 'null');
PS.close(odoc2, false);

// ---------------------------------------------------------------------------
// Layer utilities (checklist 5)
// ---------------------------------------------------------------------------
var ldoc = PS.document.createSize({ width: 200, height: 200, resolution: 72, fill: 'white', name: 'LayerUtils' });
var la = PS.fill.solidColor({ red: 255, green: 0, blue: 0, name: 'A' });
var lb = PS.fill.solidColor({ red: 0, green: 255, blue: 0, name: 'B' });
var lc = PS.fill.solidColor({ red: 0, green: 0, blue: 255, name: 'C' });
var list0 = PS.layer.list(ldoc);
ok(list0[0].name === 'C', 'layer.list is top -> bottom', list0[0].name);

var ldup = PS.layer.duplicate(la, 'A-copy', true);
ok(ldup.name === 'A-copy' && ldup.visible === false, 'layer.duplicate(name, invisible)', ldup.name + ' visible=' + ldup.visible);

PS.layer.unlockBackground(ldoc);
ok(true, 'layer.unlockBackground did not throw');
PS.layer.moveToBottom(lc, ldoc);
var lastLayer = ldoc.layers[ldoc.layers.length - 1];
ok(lastLayer.name === 'C', 'layer.moveToBottom', lastLayer.name);
PS.close(ldoc, false);

out('=== RESULT: ' + PASS + ' passed, ' + FAIL + ' failed ===');
PS._result = PASS + '/' + (PASS + FAIL) + ' passed';
PS._result;
} catch (e) {
    FAIL++; out('FATAL: ' + e + ' @line ' + e.line);
    PS._result = 'FATAL: ' + e;
    PS._result;
}
