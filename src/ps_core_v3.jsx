// =============================================================================
//  PS CORE v3 — ergonomic, hang-proof extensions for AI agents
//  -----------------------------------------------------------------------------
//  Load AFTER ps_core.jsx (same global PS namespace).
//
//  v3 fixes the five failure classes an agent actually hits:
//
//    1. MODAL ERROR DIALOGS HANG THE BRIDGE
//       A failing Action/DOM call pops a native alert that blocks the
//       AppleScript bridge forever (the classic 120 s timeout + manual kill).
//       -> PS.setup() disables dialogs; PS.safe() isolates every risky call.
//
//    2. HAND-ROLLED ActionDescriptors FOR VECTOR SHAPES
//       Writing "Mk > contentLayer + pathClass + subpathListKey" by hand is
//       50 fragile lines and easy to typo.
//       -> PS.vector.create() / .rect() / .circle() / .polygon() ...
//
//    3. MILLIMETRE / PIXEL / POINT CONFUSION
//       Path anchors are in POINTS and get scaled by resolution/72; text size
//       is in points while text position is in the current ruler unit.
//       -> PS.unit.* auto-converts; PS.document.createSize({unit:'cm'}).
//
//    4. BLIND TYPOGRAPHIC LAYOUT (text stacking on top of itself)
//       No visual feedback means hand-guessed Y offsets overlap.
//       -> PS.text.addAt() + PS.layout.flow() advance from measured bounds.
//
//    5. PSD SOURCE FORGOTTEN
//       The agent exports only a JPG preview and loses the layered source.
//       -> PS.export.auto() and the recipe runner's auto-PSD.
// =============================================================================
#target photoshop

var PS = PS || {};
PS.VERSION = '3.0.0';

// -----------------------------------------------------------------------------
//  Logging & guards
// -----------------------------------------------------------------------------

PS.logPath = null;

// Call once at the top of every script. Returns the version string.
PS.setup = function (opts) {
    opts = opts || {};
    // Kill native alerts -> no more blocked AppleScript bridge.
    try { app.displayDialogs = DialogModes.NO; } catch (e) {}
    // Deterministic units for both paths and text.
    try { app.preferences.rulerUnits = Units.PIXELS; } catch (e) {}
    try { app.preferences.typeUnits = TypeUnits.POINTS; } catch (e) {}
    if (opts.logPath) PS.logPath = opts.logPath;
    return PS.VERSION;
};

PS.log = function (msg, path) {
    var p = path || PS.logPath;
    if (!p) return false;
    try {
        var f = File(p);
        f.open('a');
        f.writeln(String(msg));
        f.close();
        return true;
    } catch (e) { return false; }
};

PS.logError = function (label, e, path) {
    var line = (e && e.line) ? (' @line ' + e.line) : '';
    PS.log('[' + (label || 'op') + '] ERROR: ' + e + line, path);
    return e;
};

// Run fn(); on any error log it and return null instead of throwing.
// This is what keeps a failed Action from raising a modal dialog.
PS.safe = function (label, fn, path) {
    try { return fn(); }
    catch (e) { PS.logError(label, e, path); return null; }
};

// -----------------------------------------------------------------------------
//  Units — the pixel / point / millimetre bridge
// -----------------------------------------------------------------------------

PS.unit = {};

// Path-item anchors are stored in POINTS and scaled to pixels by resolution/72.
// To land a shape on document pixel X you must store X * 72 / resolution.
PS.unit.pathScale = function (doc) {
    doc = doc || app.activeDocument;
    return 72 / doc.resolution;
};

PS.unit.px = function (v) { return new UnitValue(v, 'px'); };
PS.unit.pxToPt = function (v, doc) { doc = doc || app.activeDocument; return v * 72 / doc.resolution; };
PS.unit.ptToPx = function (v, doc) { doc = doc || app.activeDocument; return v * doc.resolution / 72; };
PS.unit.mmToPx = function (v, res) { return Math.round(v / 25.4 * (res || 72)); };
PS.unit.cmToPx = function (v, res) { return Math.round(v / 2.54 * (res || 72)); };
PS.unit.inToPx = function (v, res) { return Math.round(v * (res || 72)); };
PS.unit.pxToMm = function (v, res) { return v / (res || 72) * 25.4; };
PS.unit.pxToCm = function (v, res) { return v / (res || 72) * 2.54; };

// -----------------------------------------------------------------------------
//  Document sizing
// -----------------------------------------------------------------------------

// createSize({ width, height, unit:'px'|'mm'|'cm'|'in', resolution, mode, fill, name })
PS.document.createSize = function (cfg) {
    var res = cfg.resolution || 72;
    var unit = String(cfg.unit || 'px').toLowerCase();
    function toPx(v) {
        if (unit === 'mm') return PS.unit.mmToPx(v, res);
        if (unit === 'cm') return PS.unit.cmToPx(v, res);
        if (unit === 'in') return PS.unit.inToPx(v, res);
        return Math.round(v);
    }
    return PS.document.create({
        width: toPx(cfg.width),
        height: toPx(cfg.height),
        resolution: res,
        mode: cfg.mode || 'rgb',
        fill: cfg.fill || 'white',
        name: cfg.name || 'Untitled'
    });
};

// -----------------------------------------------------------------------------
//  Colour
// -----------------------------------------------------------------------------

PS.color.hexToRgb = function (hex) {
    hex = String(hex).replace('#', '');
    if (hex.length === 3) {
        hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    }
    return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
};

// Accepts [r,g,b] or '#2D4A3E' — returns a SolidColor.
PS.color.of = function (c) {
    if (typeof c === 'string') c = PS.color.hexToRgb(c);
    var sc = new SolidColor();
    sc.rgb.red = c[0];
    sc.rgb.green = c[1];
    sc.rgb.blue = c[2];
    return sc;
};

// -----------------------------------------------------------------------------
//  Vector shapes — real editable vector layers at EXACT pixel coordinates
// -----------------------------------------------------------------------------
//  NOTE: the legacy PS.shape.* helpers create full-canvas shapes that CANNOT be
//  resized or moved (transformLayer errors, layer.resize/translate hang the
//  app). Always use PS.vector.* for composition.

PS.vector = {};
PS.vector._n = 0;

// A point is either [x, y] (corner) or { anchor, left, right, smooth }.
PS.vector._pt = function (def, scale) {
    var a, l, r, smooth;
    if (def instanceof Array) {
        a = def; l = def; r = def; smooth = false;
    } else {
        a = def.anchor;
        l = def.left !== undefined ? def.left : def.anchor;
        r = def.right !== undefined ? def.right : def.anchor;
        smooth = !!def.smooth;
    }
    var p = new PathPointInfo();
    p.kind = smooth ? PointKind.SMOOTHPOINT : PointKind.CORNERPOINT;
    p.anchor = [a[0] * scale, a[1] * scale];
    p.leftDirection = [l[0] * scale, l[1] * scale];
    p.rightDirection = [r[0] * scale, r[1] * scale];
    return p;
};

// create({ points, closed, color, name, doc })
//   points : [[x,y], ...]  or  [{anchor:[x,y], left:[x,y], right:[x,y], smooth:bool}, ...]
//   color  : [r,g,b] or '#rrggbb'
PS.vector.create = function (cfg) {
    var doc = cfg.doc || app.activeDocument;
    var scale = PS.unit.pathScale(doc);
    var pts = [];
    for (var i = 0; i < cfg.points.length; i++) pts.push(PS.vector._pt(cfg.points[i], scale));

    var sub = new SubPathInfo();
    sub.closed = (cfg.closed !== false);
    sub.operation = ShapeOperation.SHAPEADD;
    sub.entireSubPath = pts;

    var tmp = '__ps_tmp_' + (++PS.vector._n);
    var pi = doc.pathItems.add(tmp, [sub]);
    var made = null;
    try {
        var d = new ActionDescriptor(), ref = new ActionReference();
        ref.putName(PS.typeID('path'), tmp);
        d.putReference(PS.typeID('null'), ref);
        executeAction(PS.typeID('select'), d, DialogModes.NO);

        var col = (typeof cfg.color === 'string') ? PS.color.hexToRgb(cfg.color) : (cfg.color || [0, 0, 0]);
        var d2 = new ActionDescriptor(), r2 = new ActionReference();
        r2.putClass(PS.typeID('contentLayer'));
        d2.putReference(PS.typeID('null'), r2);
        var using = new ActionDescriptor(), type = new ActionDescriptor(), c = new ActionDescriptor();
        c.putDouble(PS.typeID('red'), col[0]);
        c.putDouble(PS.typeID('grain'), col[1]);
        c.putDouble(PS.typeID('blue'), col[2]);
        type.putObject(PS.typeID('color'), PS.typeID('RGBColor'), c);
        using.putObject(PS.typeID('type'), PS.typeID('solidColorLayer'), type);
        d2.putObject(PS.typeID('using'), PS.typeID('contentLayer'), using);
        executeAction(PS.typeID('make'), d2, DialogModes.NO);

        made = doc.activeLayer;
        if (cfg.name) made.name = cfg.name;
    } finally {
        PS.safe('vector.removeTempPath', function () { pi.remove(); });
    }
    return made;
};

PS.vector.rect = function (l, t, r, b, cfg) {
    cfg = cfg || {};
    cfg.points = [[l, t], [r, t], [r, b], [l, b]];
    return PS.vector.create(cfg);
};

PS.vector.polygon = function (cx, cy, r, sides, cfg) {
    cfg = cfg || {};
    var n = sides || 3;
    var start = (cfg.rotation || 0) * Math.PI / 180;
    var pts = [];
    for (var i = 0; i < n; i++) {
        var a = start + 2 * Math.PI * i / n - Math.PI / 2;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    cfg.points = pts;
    return PS.vector.create(cfg);
};

PS.vector.triangle = function (cx, cy, r, cfg) { return PS.vector.polygon(cx, cy, r, 3, cfg); };

// True bezier circle (4 smooth points) — smooth curves, still fully vector.
PS.vector.circle = function (cx, cy, r, cfg) {
    cfg = cfg || {};
    var k = 0.5522847498 * r;
    cfg.points = [
        { anchor: [cx, cy - r], left: [cx - k, cy - r], right: [cx + k, cy - r], smooth: true },
        { anchor: [cx + r, cy], left: [cx + r, cy - k], right: [cx + r, cy + k], smooth: true },
        { anchor: [cx, cy + r], left: [cx + k, cy + r], right: [cx - k, cy + r], smooth: true },
        { anchor: [cx - r, cy], left: [cx - r, cy + k], right: [cx - r, cy - k], smooth: true }
    ];
    return PS.vector.create(cfg);
};

PS.vector.roundedRect = function (l, t, r, b, rad, cfg) {
    cfg = cfg || {};
    rad = Math.min(rad, (r - l) / 2, (b - t) / 2);
    var k = 0.5522847498 * rad;
    function P(ax, ay, lx, ly, rx, ry) { return { anchor: [ax, ay], left: [lx, ly], right: [rx, ry], smooth: true }; }
    cfg.points = [
        P(l, t + rad, l, t + rad - k, l + k, t + rad),
        P(l + rad, t, l + rad - k, t, l + rad + k, t),
        P(r - rad, t, r - rad - k, t, r - rad + k, t),
        P(r, t + rad, r, t + rad - k, r, t + rad + k),
        P(r, b - rad, r, b - rad - k, r, b - rad + k),
        P(r - rad, b, r - rad + k, b, r - rad - k, b),
        P(l + rad, b, l + rad + k, b, l + rad - k, b),
        P(l, b - rad, l, b - rad + k, l, b - rad - k)
    ];
    return PS.vector.create(cfg);
};

// A straight line segment as a thin filled rect (works with any resolution).
PS.vector.line = function (x1, y1, x2, y2, thickness, cfg) {
    cfg = cfg || {};
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len * (thickness / 2), ny = dx / len * (thickness / 2);
    cfg.closed = true;
    cfg.points = [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]];
    return PS.vector.create(cfg);
};

// -----------------------------------------------------------------------------
//  Upgraded PS.shape.* — now positionable via cfg.bounds = [l, t, r, b]
// -----------------------------------------------------------------------------
//  (the legacy full-canvas behaviour is kept as a fallback when no bounds given)

PS.shape.rectangle = function (cfg) {
    cfg = cfg || {};
    if (cfg.bounds) return PS.vector.rect(cfg.bounds[0], cfg.bounds[1], cfg.bounds[2], cfg.bounds[3], cfg);
    return PS._makeShape('rectangle', cfg);
};

PS.shape.roundedRect = function (cfg) {
    cfg = cfg || {};
    if (cfg.bounds) return PS.vector.roundedRect(cfg.bounds[0], cfg.bounds[1], cfg.bounds[2], cfg.bounds[3], cfg.radius || 24, cfg);
    return PS._makeShape('roundedRectangle', cfg);
};

PS.shape.ellipse = function (cfg) {
    cfg = cfg || {};
    if (cfg.bounds) {
        var b = cfg.bounds;
        return PS.vector.circle((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, Math.min(b[2] - b[0], b[3] - b[1]) / 2, cfg);
    }
    return PS._makeShape('ellipse', cfg);
};

PS.shape.triangle = function (cfg) {
    cfg = cfg || {};
    if (cfg.bounds) {
        var t = cfg.bounds;
        cfg.points = [[t[0], t[3]], [(t[0] + t[2]) / 2, t[1]], [t[2], t[3]]];
        return PS.vector.create(cfg);
    }
    return PS._makeShape('triangle', cfg);
};

// -----------------------------------------------------------------------------
//  Text — px-aware placement + measured bounds
// -----------------------------------------------------------------------------

// v3: PS.text.add now accepts '#rrggbb' as well as [r,g,b].
(function () {
    var baseAdd = PS.text.add;
    PS.text.add = function (cfg) {
        cfg = cfg || {};
        if (typeof cfg.color === 'string') cfg.color = PS.color.hexToRgb(cfg.color);
        return baseAdd(cfg);
    };
})();

// addAt({ contents, size | sizePx, font, color, x, y, justify, name, doc })
//   x / y are in DOCUMENT PIXELS (converted to the right unit internally).
PS.text.addAt = function (cfg) {
    var doc = cfg.doc || app.activeDocument;
    var size = cfg.size;
    if (size === undefined && cfg.sizePx !== undefined) size = PS.unit.pxToPt(cfg.sizePx, doc);
    var col = (typeof cfg.color === 'string') ? PS.color.hexToRgb(cfg.color) : cfg.color;
    var layer = PS.text.add({
        contents: cfg.contents, size: size, font: cfg.font,
        color: col, name: cfg.name
    });
    if (cfg.justify) {
        try { layer.textItem.justification = Justification[String(cfg.justify).toUpperCase()]; } catch (e) {}
    }
    layer.textItem.position = [PS.unit.px(cfg.x !== undefined ? cfg.x : 0), PS.unit.px(cfg.y !== undefined ? cfg.y : 0)];
    return layer;
};

// Measured bounding box of a layer, in document pixels.
PS.text.bounds = function (layer) {
    var b = layer.bounds;
    function v(u) { return (u && u.value !== undefined) ? Number(u.value) : parseFloat(String(u)); }
    var l = v(b[0]), t = v(b[1]), r = v(b[2]), bo = v(b[3]);
    return { left: l, top: t, right: r, bottom: bo, width: r - l, height: bo - t };
};

PS.text.sizePx = function (px, doc) { return PS.unit.pxToPt(px, doc); };
PS.text.arc = function (layer, bend) { return PS.text.warp({ layer: layer, style: 'arc', bend: bend }); };

// -----------------------------------------------------------------------------
//  Layout — sequential flow that NEVER overlaps
// -----------------------------------------------------------------------------
//  flow({ items:[...], x, y, size, sizePx, font, color, justify, gap, doc })
//    items: string  or  { text, size, sizePx, font, color, x, justify, gap, name }
//  Each next baseline is computed from the measured bounds of the previous
//  line:  nextY = prevBounds.bottom + ascent(next) + gap
//  Measured boxes are returned so the caller can verify placement.

PS.layout = {};

PS.layout.flow = function (cfg) {
    var doc = cfg.doc || app.activeDocument;
    var out = [];
    var items = cfg.items || [];
    var curY = cfg.y || 0;

    for (var i = 0; i < items.length; i++) {
        var it = (typeof items[i] === 'string') ? { text: items[i] } : items[i];
        var sizePt = (it.size !== undefined) ? it.size : cfg.size;
        var sizePx = (it.sizePx !== undefined) ? it.sizePx : cfg.sizePx;
        if (sizePx === undefined && sizePt !== undefined) sizePx = PS.unit.ptToPx(sizePt, doc);
        if (sizePx === undefined) sizePx = 24;

        var layer = PS.text.addAt({
            contents: it.text,
            size: sizePt,
            font: it.font || cfg.font,
            color: it.color || cfg.color,
            x: (it.x !== undefined) ? it.x : cfg.x,
            y: curY,
            justify: it.justify || cfg.justify,
            name: it.name,
            doc: doc
        });
        var b = PS.text.bounds(layer);
        out.push({ layer: layer, bounds: b, baselineY: curY });

        var ascent = sizePx * 0.75;               // cap+ascender height
        var gap = (it.gap !== undefined) ? it.gap : (cfg.gap || 0);
        curY = b.bottom + ascent + gap;
    }
    return out;
};

// Bottom edge of a layer's box + gap -> ready to use as the next baseline.
PS.layout.next = function (layer, gap) {
    var b = PS.text.bounds(layer);
    return { y: b.bottom + (gap || 0), bounds: b };
};

// -----------------------------------------------------------------------------
//  Export — one call, source guaranteed
// -----------------------------------------------------------------------------

PS.export = function (doc, out) {
    doc = doc || app.activeDocument;
    out = out || {};
    if (out.psd) PS.save.psd(doc, out.psd);
    if (out.jpg) PS.save.jpg(doc, out.jpg, out.jpgQuality);
    if (out.png) PS.save.png(doc, out.png);
    return out;
};

// Save PSD + JPG next to basePath (any extension is stripped first).
// Auto-PSD is the point: the layered source is never forgotten.
PS.export.auto = function (doc, basePath, quality) {
    doc = doc || app.activeDocument;
    var base = String(basePath).replace(/\.(psd|jpg|jpeg|png)$/i, '');
    var out = { psd: base + '.psd', jpg: base + '.jpg', jpgQuality: quality };
    PS.export(doc, out);
    return out;
};

// -----------------------------------------------------------------------------
//  Introspection helpers
// -----------------------------------------------------------------------------

PS.layer = PS.layer || {};

// List {name, kind, visible, opacity} of the top-level art layers, top -> bottom.
PS.layer.list = function (doc) {
    doc = doc || app.activeDocument;
    var out = [];
    for (var i = doc.artLayers.length - 1; i >= 0; i--) {
        var l = doc.artLayers[i];
        out.push({ name: l.name, kind: String(l.kind), visible: l.visible, opacity: l.opacity });
    }
    return out;
};

// Measured box at a named layer, in px.
PS.layer.bounds = function (name, doc) {
    doc = doc || app.activeDocument;
    var l = doc.artLayers.getByName(name);
    return PS.text.bounds(l);
};
