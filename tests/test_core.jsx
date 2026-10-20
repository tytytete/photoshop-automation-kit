// v3 self-test — exercises the ergonomic helpers and the hang-proof guards.
// Run:  ./tools/run.sh tests/test_core.jsx
#target photoshop

var LOG = '/tmp/ps_v3_test.log';
var PASS = 0, FAIL = 0;
function out(s) { PS.log(s, LOG); }
function ok(cond, label, extra) {
    if (cond) { PASS++; out('PASS  ' + label + (extra ? ('  ' + extra) : '')); }
    else      { FAIL++; out('FAIL  ' + label + (extra ? ('  ' + extra) : '')); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= tol; }

try {
PS.setup({ logPath: LOG });
out('=== PS v3 self-test (version ' + PS.VERSION + ') ===');

// 1. unit-aware document sizing: 100x100 cm @150ppi -> 5906px
var doc = PS.document.createSize({ width: 100, height: 100, unit: 'cm', resolution: 150, mode: 'rgb', fill: 'white', name: 'TestV3' });
ok(doc.width.value === 5906 && doc.resolution === 150, 'createSize cm->px', doc.width.value + 'x' + doc.height.value + '@' + doc.resolution);

// 2. units
ok(PS.unit.mmToPx(210, 300) === 2480 && PS.unit.mmToPx(297, 300) === 3508, 'mm->px A4 @300', PS.unit.mmToPx(210,300) + 'x' + PS.unit.mmToPx(297,300));
ok(approx(PS.unit.pxToPt(150, doc), 72, 0.001), 'px->pt uses resolution', PS.unit.pxToPt(150, doc));
ok(PS.color.hexToRgb('#2D4A3E')[0] === 45, 'hexToRgb');

// 3. vector shapes land at EXACT coordinates (the v2 killer bug)
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

// 4. upgraded PS.shape.* with bounds
var sh = PS.shape.rectangle({ bounds: [2000, 100, 2300, 300], color: '#2D4A3E', name: 'ShapeRect' });
var shb = PS.text.bounds(sh);
ok(approx(shb.width, 300, 2) && approx(shb.height, 200, 2), 'shape.rectangle bounds', shb.width + 'x' + shb.height);

// 5. text placement + measured bounds
var t1 = PS.text.addAt({ contents: 'TITLE', sizePx: 120, font: 'Arial-BoldMT', color: '#2D4A3E', x: 400, y: 800, justify: 'LEFT', name: 'T1' });
var tb1 = PS.text.bounds(t1);
ok(tb1.width > 0 && tb1.height > 0, 'text.addAt bounds', Math.round(tb1.left) + ',' + Math.round(tb1.top) + ' ' + Math.round(tb1.width) + 'x' + Math.round(tb1.height));
ok(approx(tb1.left, 400, 6), 'text.addAt x honoured (LEFT)', tb1.left);

// 6. layout.flow never overlaps
var flow = PS.layout.flow({
    x: 400, y: 1400, sizePx: 90, font: 'ArialMT', color: '#000000', justify: 'LEFT', gap: 20,
    items: ['Line one', 'Line two', { text: 'Line three bigger', sizePx: 140 }, 'Line four']
});
var overlap = false;
for (var i = 1; i < flow.length; i++) {
    if (flow[i].bounds.top < flow[i - 1].bounds.bottom - 1) overlap = true;
}
ok(flow.length === 4 && !overlap, 'layout.flow no overlap', flow.length + ' lines, overlap=' + overlap);
for (var j = 0; j < flow.length; j++) out('   line ' + j + ' top=' + Math.round(flow[j].bounds.top) + ' bottom=' + Math.round(flow[j].bounds.bottom));

// 7. hang-proof guard: a failing call returns null, never raises a modal
var bad = PS.safe('expected-failure', function () { return PS.vector.create({ points: null }); });
ok(bad === null, 'PS.safe swallows failure', 'returned ' + bad);

// 8. export.auto guarantees BOTH psd and jpg
var files = PS.export.auto(doc, '/tmp/ps_v3_export_test.jpg', 11);
var fP = File(files.psd), fJ = File(files.jpg);
ok(fP.exists && fJ.exists, 'export.auto wrote psd+jpg', files.psd + ' | ' + files.jpg);

ok(PS.layer.list(doc).length > 8, 'layer.list', PS.layer.list(doc).length + ' layers');

PS.close(doc, false);
} catch (e) {
    FAIL++; out('FATAL: ' + e + ' @line ' + e.line);
}
out('=== RESULT: ' + PASS + ' passed, ' + FAIL + ' failed ===');
(PASS + '/' + (PASS + FAIL)) + ' passed';
