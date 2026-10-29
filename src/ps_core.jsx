// =============================================================================
//  PS CORE — Reusable Photoshop automation library (ExtendScript / JSX)
//  -----------------------------------------------------------------------------
//  A self-contained toolkit for driving Adobe Photoshop (macOS / Windows)
//  from the command line or from an AI agent. Every function maps to a real
//  Photoshop object (adjustment layer, layer mask, text layer, fill layer,
//  selection, document, …) — never a flattened bitmap paste.
//
//  Target: Photoshop 2021+ (tested on 2026 / v27).
//
//  Usage: concatenate this file with your own recipe/script, then run through
//  the AppleScript bridge. See AGENTS.md and README.md.
//
//  Example:
//      var doc = PS.openDocument('/input.jpg');
//      PS.duplicate('Copy');
//      PS.selection.selectSubject();
//      PS.adjustment.hueSaturation({ colorize: true, hue: 332, saturation: 42 });
//      PS.save.psd(doc, '/out.psd');
//      PS.save.jpg(doc, '/out.jpg');
//      PS.close(doc);
// =============================================================================
#target photoshop

var PS = PS || {};

// ---- low-level type-id helpers --------------------------------------------
PS.typeID = function (s) { return app.stringIDToTypeID(s); };
PS.charID = function (s) { return charIDToTypeID(s); };

// Cross-version helpers so callers never touch AM directly.
(function () {
    var s2t = PS.typeID;
    var c2t = PS.charID;

    // ---------------- DOCUMENTS ----------------
    PS.openDocument = function (path) {
        var doc = app.open(File(path));
        try { PS.patchSelection(doc); } catch (e) {}
        return doc;
    };

    PS.activeDocument = function () {
        var doc = app.activeDocument;
        try { PS.patchSelection(doc); } catch (e) {}
        return doc;
    };

    PS.close = function (doc, saveChanges) {
        doc = doc || app.activeDocument;
        try {
            doc.close(saveChanges ? SaveOptions.SAVECHANGES : SaveOptions.DONOTSAVECHANGES);
        } catch (e) {
            // Document may already be closed (e.g. after a saveAs that replaced it).
        }
    };

    PS.flatten = function (doc) {
        doc = doc || app.activeDocument;
        doc.flatten();
    };

    PS.mergeVisible = function (doc) {
        doc = doc || app.activeDocument;
        doc.mergeVisibleLayers();
    };

    PS.resizeImage = function (opts) {
        // opts: { width, height, resolution, resample }
        var d = app.activeDocument;
        var w = opts.width !== undefined ? new UnitValue(opts.width, 'px') : d.width;
        var h = opts.height !== undefined ? new UnitValue(opts.height, 'px') : d.height;
        var res = opts.resolution !== undefined ? opts.resolution : d.resolution;
        var resample = opts.resample !== undefined ? opts.resample : ResampleMethod.BICUBIC;
        d.resizeImage(w, h, res, resample);
    };

    PS.crop = function (left, top, right, bottom) {
        app.activeDocument.crop([new UnitValue(left, 'px'), new UnitValue(top, 'px'),
                                 new UnitValue(right, 'px'), new UnitValue(bottom, 'px')]);
    };

    // ---------------- SAVING ----------------
    PS.save = {};
    PS.save.psd = function (doc, path) {
        var o = new PhotoshopSaveOptions();
        o.embedColorProfile = true;
        o.maximizeCompatibility = true;
        doc.saveAs(File(path), o, true, Extension.LOWERCASE);
    };
    PS.save.jpg = function (doc, path, quality) {
        var o = new JPEGSaveOptions();
        o.quality = quality !== undefined ? quality : 11;
        o.embedColorProfile = true;
        doc.saveAs(File(path), o, true, Extension.LOWERCASE);
    };
    PS.save.png = function (doc, path) {
        var o = new PNGSaveOptions();
        doc.saveAs(File(path), o, true, Extension.LOWERCASE);
    };
    PS.save.copy = function (doc, path) {
        // Flatten-safe duplicate as a copy — leaves the source document untouched.
        doc.saveAs(File(path), new JPEGSaveOptions(), true, Extension.LOWERCASE);
    };

    // ---------------- LAYERS ----------------
    PS.duplicate = function (name) {
        var l = app.activeDocument.activeLayer.duplicate();
        if (name) l.name = name;
        return l;
    };

    PS.rename = function (layer, name) {
        layer.name = name;
        return layer;
    };

    PS.setOpacity = function (layer, pct) {
        layer.opacity = pct;
        return layer;
    };

    PS.setBlendMode = function (layer, mode) {
        // Note: Photoshop ExtendScript enum objects throw on invalid keys, so
        // normalize to UPPERCASE and guard with try/catch.
        var key = (mode || 'normal').toUpperCase();
        var bm;
        try {
            bm = BlendMode[key];
        } catch (e) {
            bm = BlendMode.NORMAL;
        }
        layer.blendMode = bm;
        return layer;
    };

    PS.setVisible = function (layer, visible) {
        layer.visible = visible;
        return layer;
    };

    PS.remove = function (layer) {
        layer.remove();
    };

    PS.addGroup = function (name) {
        var g = app.activeDocument.layerSets.add();
        if (name) g.name = name;
        return g;
    };

    PS.addToGroup = function (layer, group) {
        layer.move(group, ElementPlacement.PLACEATEND);
    };

    // ---------------- SELECTION ----------------
    PS.selection = {};

    PS.selection.selectAll = function () {
        app.activeDocument.selection.selectAll();
    };

    PS.selection.deselect = function () {
        var d = new ActionDescriptor();
        var r = new ActionReference();
        r.putProperty(c2t('Chnl'), c2t('fsel'));
        d.putReference(c2t('null'), r);
        d.putEnumerated(c2t('T   '), c2t('Ordn'), c2t('None'));
        executeAction(c2t('setd'), d, DialogModes.NO);
    };

    // 64-point ellipse approximation (the DOM has no native oval selector).
    PS._ovalPoints = function (l, t, r, b) {
        var cx = (l + r) / 2, cy = (t + b) / 2;
        var rx = (r - l) / 2, ry = (b - t) / 2;
        var pts = [], n = 64, i, a;
        for (i = 0; i < n; i++) {
            a = 2 * Math.PI * i / n;
            pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
        }
        return pts;
    };

    // Select hard, then feather the live selection. Passing feather directly
    // to Selection.select() leaves semi-transparent interiors on current
    // Photoshop builds (notably when the target is a layer mask).
    PS.selection.selectRect = function (l, t, r, b, feather) {
        var sel = app.activeDocument.selection;
        sel.select([[l, t], [r, t], [r, b], [l, b]], SelectionType.REPLACE, 0, false);
        if (feather) sel.feather(feather);
    };

    PS.selection.selectOval = function (l, t, r, b, feather) {
        var sel = app.activeDocument.selection;
        sel.select(PS._ovalPoints(l, t, r, b), SelectionType.REPLACE, 0, true);
        if (feather) sel.feather(feather);
    };

    // AI subject detection — returns true on success, false if the AI model
    // was not loaded yet (open Select > Subject from the Photoshop UI once).
    PS.selection.selectSubject = function () {
        try {
            executeAction(s2t('autoCutout'), new ActionDescriptor(), DialogModes.NO);
            return true;
        } catch (e1) {
            try {
                executeAction(s2t('selectSubject'), new ActionDescriptor(), DialogModes.NO);
                return true;
            } catch (e2) {
                // AI model not loaded — warn but do not throw.
                app.playbackDisplayString = 'PS.selection.selectSubject: AI model not loaded. Use Select > Subject from the PS menu first.';
                return false;
            }
        }
    };

    PS.selection.feather = function (px) {
        app.activeDocument.selection.feather(px);
    };

    PS.selection.expand = function (px) {
        app.activeDocument.selection.expand(px);
    };

    PS.selection.contract = function (px) {
        app.activeDocument.selection.contract(px);
    };

    PS.selection.inverse = function () {
        app.activeDocument.selection.invert();
    };

    PS.selection.grow = function () {
        app.activeDocument.selection.grow(2, false);
    };

    PS.selection.similar = function () {
        app.activeDocument.selection.similar(12, false);
    };

    PS.selection.bounds = function () {
        return app.activeDocument.selection.bounds;
    };

    // Save the active selection into an alpha channel; returns the channel.
    PS.selection.store = function (name) {
        var d = app.activeDocument;
        var ch = d.channels.add();
        if (name) ch.name = name;
        d.selection.store(ch, SelectionType.REPLACE);
        return ch;
    };

    // Load an alpha channel; combine is a SelectionType (REPLACE/EXTEND/INTERSECT/DIMINISH).
    PS.selection.load = function (channel, combine, invert) {
        app.activeDocument.selection.load(channel, combine || SelectionType.REPLACE, !!invert);
    };

    // Intersect the active selection with a rectangular band (no channel needed).
    PS.selection.intersectRect = function (l, t, r, b) {
        var ch = PS.selection.store();          // stash current selection
        PS.selection.selectRect(l, t, r, b, 0);
        PS.selection.load(ch, SelectionType.INTERSECT, false);
        ch.remove();
    };

    // ---------------- ADJUSTMENT LAYERS ----------------
    PS.adjustment = {};

    // Internal: create an adjustment layer of `typeName` with `typeDesc` options.
    PS._makeAdjustment = function (typeName, typeDesc, name) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putClass(s2t('adjustmentLayer'));
        desc.putReference(s2t('null'), ref);
        var using = new ActionDescriptor();
        using.putObject(s2t('type'), s2t(typeName), typeDesc);
        desc.putObject(s2t('using'), s2t('adjustmentLayer'), using);
        executeAction(s2t('make'), desc, DialogModes.NO);
        var l = app.activeDocument.activeLayer;
        if (name) l.name = name;
        return l;
    };

    PS._preset = function (typeDesc, kind) {
        if (kind) typeDesc.putEnumerated(s2t('presetKind'), s2t('presetKindType'), s2t(kind));
        return typeDesc;
    };

    // Hue/Saturation (hue: -180..180, saturation: -100..100, lightness: -100..100).
    // channel: 'composite' | 'reds' | 'yellows' | 'greens' | 'cyans' | 'blues' | 'magentas'.
    PS.adjustment.hueSaturation = function (cfg) {
        var t = new ActionDescriptor();
        PS._preset(t, 'presetKindCustom');
        if (cfg.colorize !== undefined) t.putBoolean(s2t('colorize'), !!cfg.colorize);
        var list = new ActionList();
        var ch = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(s2t('channel'), s2t('channel'), s2t(cfg.channel || 'composite'));
        ch.putReference(s2t('channel'), ref);
        ch.putInteger(s2t('hue'), parseInt(cfg.hue) || 0);
        ch.putInteger(s2t('saturation'), parseInt(cfg.saturation) || 0);
        ch.putInteger(s2t('lightness'), parseInt(cfg.lightness) || 0);
        list.putObject(s2t('hueSaturationChannel'), ch);
        t.putList(s2t('adjustment'), list);
        return PS._makeAdjustment('hueSaturation', t, cfg.name);
    };

    // Levels. shadow/white: 0..255 (input), gray: gamma ~0.1..9.99.
    PS.adjustment.levels = function (cfg) {
        var t = new ActionDescriptor();
        PS._preset(t, 'presetKindCustom');
        var list = new ActionList();
        var ch = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(s2t('channel'), s2t('channel'), s2t('composite'));
        ch.putReference(s2t('channel'), ref);
        ch.putInteger(s2t('inputBlackPoint'), parseInt(cfg.shadow) || 0);
        ch.putInteger(s2t('inputWhitePoint'), (cfg.white !== undefined ? parseInt(cfg.white) : 255));
        ch.putDouble(s2t('inputGrayPoint'), parseFloat(cfg.gray) || 1.0);
        list.putObject(s2t('levelsAdjustment'), ch);
        t.putList(s2t('adjustment'), list);
        return PS._makeAdjustment('levels', t, cfg.name);
    };

    // Curves. points: [[in,out],...] in 0..255. Optional per-channel.
    PS.adjustment.curves = function (cfg) {
        var t = new ActionDescriptor();
        PS._preset(t, 'presetKindCustom');
        var list = new ActionList();
        var ch = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(s2t('channel'), s2t('channel'), s2t(cfg.channel || 'composite'));
        ch.putReference(s2t('channel'), ref);
        var pts = new ActionList();
        var p, i;
        for (i = 0; i < cfg.points.length; i++) {
            p = new ActionDescriptor();
            p.putDouble(s2t('horizontal'), cfg.points[i][0]);
            p.putDouble(s2t('vertical'), cfg.points[i][1]);
            pts.putObject(s2t('curvePoint'), p);
        }
        ch.putList(s2t('curve'), pts);
        list.putObject(s2t('curvesAdjustment'), ch);
        t.putList(s2t('adjustment'), list);
        return PS._makeAdjustment('curves', t, cfg.name);
    };

    // Color Balance. Each triplet is [Cyan-Red, Magenta-Green, Yellow-Blue] in -100..100.
    PS.adjustment.colorBalance = function (cfg) {
        var t = new ActionDescriptor();
        function L(a) { var l = new ActionList(); l.putInteger(a[0]); l.putInteger(a[1]); l.putInteger(a[2]); return l; }
        t.putList(s2t('shadowLevels'), L(cfg.shadows || [0, 0, 0]));
        t.putList(s2t('midtoneLevels'), L(cfg.midtones || [0, 0, 0]));
        t.putList(s2t('highlightLevels'), L(cfg.highlights || [0, 0, 0]));
        t.putBoolean(s2t('preserveLuminosity'), cfg.preserve !== undefined ? !!cfg.preserve : true);
        return PS._makeAdjustment('colorBalance', t, cfg.name);
    };

    PS.adjustment.vibrance = function (cfg) {
        var t = new ActionDescriptor();
        PS._preset(t, 'presetKindCustom');
        t.putInteger(s2t('vibrance'), parseInt(cfg.vibrance) || 0);
        t.putInteger(s2t('saturation'), parseInt(cfg.saturation) || 0);
        return PS._makeAdjustment('vibrance', t, cfg.name);
    };

    PS.adjustment.brightnessContrast = function (cfg) {
        var t = new ActionDescriptor();
        PS._preset(t, 'presetKindCustom');
        t.putInteger(s2t('brightness'), parseInt(cfg.brightness) || 0);
        t.putInteger(s2t('contrast'), parseInt(cfg.contrast) || 0);
        return PS._makeAdjustment('brightnessEvent', t, cfg.name);
    };

    PS.adjustment.photoFilter = function (cfg) {
        var t = new ActionDescriptor();
        PS._preset(t, 'presetKindCustom');
        var c = new ActionDescriptor();
        c.putDouble(s2t('red'), cfg.red !== undefined ? cfg.red : 255);
        c.putDouble(s2t('grain'), cfg.green !== undefined ? cfg.green : 255);
        c.putDouble(s2t('blue'), cfg.blue !== undefined ? cfg.blue : 255);
        t.putObject(s2t('color'), s2t('RGBColor'), c);
        t.putInteger(s2t('density'), parseInt(cfg.density) || 25);
        t.putBoolean(s2t('preserveLuminosity'), cfg.preserve !== undefined ? !!cfg.preserve : true);
        return PS._makeAdjustment('photoFilter', t, cfg.name);
    };

    PS.adjustment.exposure = function (cfg) {
        var t = new ActionDescriptor();
        PS._preset(t, 'presetKindCustom');
        t.putDouble(s2t('exposure'), parseFloat(cfg.exposure) || 0);
        t.putDouble(s2t('offset'), parseFloat(cfg.offset) || 0);
        t.putDouble(s2t('gammaCorrection'), cfg.gamma !== undefined ? parseFloat(cfg.gamma) : 1.0);
        return PS._makeAdjustment('exposure', t, cfg.name);
    };

    // Selective Color. corrections: [{ color, cyan, magenta, yellow, black }, ...]
    PS.adjustment.selectiveColor = function (cfg) {
        var t = new ActionDescriptor();
        var list = new ActionList();
        var i, corr;
        for (i = 0; i < cfg.corrections.length; i++) {
            corr = cfg.corrections[i];
            var ch = new ActionDescriptor();
            ch.putEnumerated(s2t('colors'), s2t('color'), s2t(corr.color));
            ch.putInteger(s2t('cyan'), parseInt(corr.cyan) || 0);
            ch.putInteger(s2t('magenta'), parseInt(corr.magenta) || 0);
            ch.putInteger(s2t('yellow'), parseInt(corr.yellow) || 0);
            ch.putInteger(s2t('black'), parseInt(corr.black) || 0);
            list.putObject(s2t('selectiveColorCorrection'), ch);
        }
        t.putList(s2t('colors'), list);
        t.putBoolean(s2t('absolute'), !!cfg.absolute);
        return PS._makeAdjustment('selectiveColor', t, cfg.name);
    };

    // Channel Mixer. channels: { red:[r,g,b], green:[r,g,b], blue:[r,g,b] } percent ints.
    PS.adjustment.channelMixer = function (cfg) {
        var t = new ActionDescriptor();
        PS._preset(t, 'presetKindCustom');
        t.putBoolean(s2t('monochrome'), !!cfg.monochrome);
        function L(a) { var l = new ActionList(); l.putInteger(a[0]); l.putInteger(a[1]); l.putInteger(a[2]); return l; }
        if (cfg.red) t.putList(s2t('redChannel'), L(cfg.red));
        if (cfg.green) t.putList(s2t('greenChannel'), L(cfg.green));
        if (cfg.blue) t.putList(s2t('blueChannel'), L(cfg.blue));
        return PS._makeAdjustment('channelMixer', t, cfg.name);
    };

    // Gradient Map (default preset — the two anchor colors are set via a preset
    // name or left default; use gradientMapClass type).
    PS.adjustment.gradientMap = function (cfg) {
        var t = new ActionDescriptor();
        PS._preset(t, 'presetKindDefault');
        return PS._makeAdjustment('gradientMapClass', t, cfg.name);
    };

    // Black & White. channels: { reds, yellows, greens, cyans, blues, magentas } -200..300.
    PS.adjustment.blackWhite = function (cfg) {
        var t = new ActionDescriptor();
        PS._preset(t, 'presetKindDefault');
        function put(k, def) { t.putInteger(s2t(k), cfg[k] !== undefined ? parseInt(cfg[k]) : def); }
        put('reds', 40); put('yellows', 60); put('greens', 40);
        put('cyans', 60); put('blues', 20); put('magentas', 80);
        return PS._makeAdjustment('blackAndWhite', t, cfg.name);
    };

    PS.adjustment.posterize = function (cfg) {
        var t = new ActionDescriptor();
        t.putInteger(s2t('levels'), parseInt(cfg.levels) || 4);
        return PS._makeAdjustment('posterize', t, cfg.name);
    };

    PS.adjustment.threshold = function (cfg) {
        var t = new ActionDescriptor();
        t.putInteger(s2t('level'), cfg.level !== undefined ? parseInt(cfg.level) : 128);
        return PS._makeAdjustment('thresholdClassEvent', t, cfg.name);
    };

    PS.adjustment.invert = function (cfg) {
        var t = new ActionDescriptor();
        return PS._makeAdjustment('invert', t, cfg && cfg.name);
    };

    // ---------------- FILL LAYERS ----------------
    PS.fill = {};

    PS.fill.solidColor = function (cfg) {
        // cfg: { red, green, blue, name }
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putClass(s2t('contentLayer'));
        desc.putReference(s2t('null'), ref);
        var using = new ActionDescriptor();
        var typeD = new ActionDescriptor();
        var c = new ActionDescriptor();
        c.putDouble(s2t('red'), cfg.red !== undefined ? cfg.red : 0);
        c.putDouble(s2t('grain'), cfg.green !== undefined ? cfg.green : 0);
        c.putDouble(s2t('blue'), cfg.blue !== undefined ? cfg.blue : 0);
        typeD.putObject(s2t('color'), s2t('RGBColor'), c);
        using.putObject(s2t('type'), s2t('solidColorLayer'), typeD);
        desc.putObject(s2t('using'), s2t('contentLayer'), using);
        executeAction(s2t('make'), desc, DialogModes.NO);
        var l = app.activeDocument.activeLayer;
        if (cfg && cfg.name) l.name = cfg.name;
        return l;
    };

    // ---------------- TEXT ----------------
    PS.text = {};
    PS.text.add = function (cfg) {
        // cfg: { contents, size, font, color:[r,g,b], position:[x,y], name }
        var d = app.activeDocument;
        var layer = d.artLayers.add();
        layer.kind = LayerKind.TEXT;
        layer.textItem.contents = cfg.contents;
        layer.textItem.size = cfg.size || 24;
        if (cfg.font) layer.textItem.font = cfg.font;
        if (cfg.color) {
            var sc = new SolidColor();
            sc.rgb.red = cfg.color[0]; sc.rgb.green = cfg.color[1]; sc.rgb.blue = cfg.color[2];
            layer.textItem.color = sc;
        }
        if (cfg.position) layer.textItem.position = cfg.position;
        if (cfg.name) layer.name = cfg.name;
        return layer;
    };

    // ---------------- LAYER MASKS ----------------
    PS.mask = {};

    // True when the active layer has a pixel (user) mask.
    PS.mask.has = function (layer) {
        var doc = app.activeDocument;
        try { if (layer) doc.activeLayer = layer; } catch (e) { return false; }
        var ref = new ActionReference();
        ref.putEnumerated(c2t('Lyr '), c2t('Ordn'), c2t('Trgt'));
        try {
            var desc = executeActionGet(ref);
            return !!desc.getBoolean(s2t('hasUserMask'));
        } catch (e) {
            return false;
        }
    };

    // Internal: create a mask with the given userMaskEnabled mode.
    // using ∈ 'revealAll' | 'hideAll' | 'revealSelection'.
    //
    // The ActionManager contract for "Mk > channel" is:
    //   * new = channel          (WHAT to create)
    //   * at  = channel/mask ref (WHERE to attach it)
    // Using the legacy `null` key here raises error 8800.
    PS.mask._make = function (layer, using) {
        var doc = app.activeDocument;
        if (layer) doc.activeLayer = layer;
        var desc = new ActionDescriptor();
        desc.putClass(s2t('new'), s2t('channel'));
        var ref = new ActionReference();
        ref.putEnumerated(s2t('channel'), s2t('channel'), s2t('mask'));
        desc.putReference(s2t('at'), ref);
        desc.putEnumerated(s2t('using'), s2t('userMaskEnabled'), s2t(using));
        executeAction(s2t('make'), desc, DialogModes.NO);
        return layer || doc.activeLayer;
    };

    // Fill the whole existing mask with white (255) or black (0).
    // Adjustment/fill/text layers created by Photoshop already own an internal
    // user mask, so "adding" a second one is impossible — we reset that mask.
    PS.mask._fill = function (layer, value) {
        var doc = app.activeDocument;
        PS.mask.target(layer);
        try {
            var c = new SolidColor();
            c.rgb.red = value; c.rgb.green = value; c.rgb.blue = value;
            doc.selection.selectAll();
            doc.selection.fill(c, ColorBlendMode.NORMAL, 100, false);
            doc.selection.deselect();
        } finally {
            PS.mask.exitTarget();
        }
    };

    // Create a mask from the current selection on the given layer.
    PS.mask.fromSelection = function (layer) {
        var doc = app.activeDocument;
        if (layer) doc.activeLayer = layer;
        var hasSelection = true;
        try {
            var b = doc.selection.bounds;
            hasSelection = !!(b && b.length === 4);
        } catch (e) {
            hasSelection = false;
        }
        // No active selection: a reveal-all mask is the sensible fallback.
        if (!hasSelection) return PS.mask.add(layer);

        // Stash the selection before PS.mask.add() may replace it with a
        // select-all on the mask channel.
        var chName = '__ps_mask_tmp_' + (PS._maskTmp = (PS._maskTmp || 0) + 1);
        var ch = null;
        try {
            ch = PS.selection.store(chName);
            // Ensures a fully white mask, whether the layer had one already
            // (content layers always do) or needs a new one.
            PS.mask.add(layer);
            PS.mask.target(layer);
            doc.selection.selectAll();
            var black = new SolidColor();
            black.rgb.red = 0; black.rgb.green = 0; black.rgb.blue = 0;
            doc.selection.fill(black, ColorBlendMode.NORMAL, 100, false);
            PS.selection.load(ch, SelectionType.REPLACE, false);
            var white = new SolidColor();
            white.rgb.red = 255; white.rgb.green = 255; white.rgb.blue = 255;
            doc.selection.fill(white, ColorBlendMode.NORMAL, 100, false);
            doc.selection.deselect();
        } finally {
            PS.mask.exitTarget();
            if (ch) { try { ch.remove(); } catch (e) {} }
        }
        return layer;
    };

    // Reveal-all mask (white). Resets an existing mask instead of adding a
    // second one (Photoshop forbids two pixel masks on one layer).
    PS.mask.add = function (layer) {
        var doc = app.activeDocument;
        if (layer) doc.activeLayer = layer;
        if (!PS.mask.has(layer)) PS.mask._make(layer, 'revealAll');
        // Force white: creating a mask while a selection is active can yield a
        // black/hidden mask on current builds.
        PS.mask._fill(layer, 255);
        return layer || doc.activeLayer;
    };

    // Hide-all mask (black) — also handles layers that already have a mask.
    PS.mask.hide = function (layer) {
        var doc = app.activeDocument;
        if (layer) doc.activeLayer = layer;
        if (!PS.mask.has(layer)) PS.mask._make(layer, 'hideAll');
        PS.mask._fill(layer, 0);
        return layer || doc.activeLayer;
    };

    // Target the active layer's mask channel so pixel edits (fill/blur/invert)
    // affect the mask, not the layer content.
    PS.mask.target = function (layer) {
        var doc = app.activeDocument;
        if (layer) doc.activeLayer = layer;
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(c2t('Chnl'), c2t('Chnl'), c2t('Msk '));
        desc.putReference(c2t('null'), ref);
        desc.putBoolean(c2t('MkVs'), true);
        executeAction(c2t('slct'), desc, DialogModes.NO);
        return doc.activeLayer;
    };

    // Return from the mask channel to the composite RGB channel.
    PS.mask.exitTarget = function () {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(c2t('Chnl'), c2t('Chnl'), c2t('RGB '));
        desc.putReference(c2t('null'), ref);
        try { executeAction(c2t('slct'), desc, DialogModes.NO); } catch (e) {}
    };

    PS.mask.invert = function (layer) {
        var doc = app.activeDocument;
        if (layer) doc.activeLayer = layer;
        PS.mask.target();
        try { PS.selection.deselect(); } catch (e) {}
        try {
            executeAction(s2t('invert'), new ActionDescriptor(), DialogModes.NO);
        } catch (e1) {
            // Fallback for older builds: explicit channel reference.
            var desc = new ActionDescriptor();
            var ref = new ActionReference();
            ref.putEnumerated(c2t('Chnl'), c2t('Chnl'), c2t('Msk '));
            desc.putReference(c2t('null'), ref);
            executeAction(c2t('Invr'), desc, DialogModes.NO);
        }
        PS.mask.exitTarget();
        return layer || doc.activeLayer;
    };

    // Paint a soft linear falloff directly into the layer mask.
    //   startY / endY : document pixels along the chosen axis.
    //   start is the 50% boundary; |end - start| is the feather width and the
    //   sign selects the direction (end > start = fade down / right).
    //   opts.direction : 'vertical' (default) | 'horizontal'
    //   opts.reveal    : paint white (reveal) instead of black (hide)
    //
    // This uses a feathered selection fill — not the Gradient tool — so it
    // works on every Photoshop version and never trips the 8800 descriptor
    // changes introduced in 2024–2026.
    PS.mask.linearGradient = function (layer, startY, endY, featherRadius, opts) {
        opts = opts || {};
        var doc = app.activeDocument;
        if (layer) doc.activeLayer = layer;
        if (!PS.mask.has(doc.activeLayer)) PS.mask.add(doc.activeLayer);

        var w = doc.width.as('px');
        var h = doc.height.as('px');
        var f = (featherRadius === undefined || featherRadius === null)
            ? Math.abs(endY - startY) : featherRadius;
        f = Math.max(0, Math.round(f));

        var horizontal = String(opts.direction || 'vertical').toLowerCase() === 'horizontal';
        var start = Number(startY);
        var end = Number(endY);
        var limit = horizontal ? w : h;
        start = Math.max(0, Math.min(limit, start));
        end = Math.max(0, Math.min(limit, end));

        var pts;
        if (end >= start) {
            pts = horizontal
                ? [[start, 0], [w, 0], [w, h], [start, h]]
                : [[0, start], [w, start], [w, h], [0, h]];
        } else {
            pts = horizontal
                ? [[0, 0], [start, 0], [start, h], [0, h]]
                : [[0, 0], [w, 0], [w, start], [0, start]];
        }

        PS.mask.target();
        try {
            // Select hard, then feather the live selection. Passing feather to
            // Selection.select() leaves the mask interior semi-transparent on
            // current Photoshop builds; the two-step form is reliable.
            doc.selection.select(pts, SelectionType.REPLACE, 0, false);
            if (f > 0) doc.selection.feather(f);
            var v = opts.reveal ? 255 : 0;
            var c = new SolidColor();
            c.rgb.red = v; c.rgb.green = v; c.rgb.blue = v;
            doc.selection.fill(c, ColorBlendMode.NORMAL, 100, false);
            doc.selection.deselect();
        } finally {
            PS.mask.exitTarget();
        }
        return layer || doc.activeLayer;
    };

    // Alias used by recipes / agents.
    PS.mask.gradient = PS.mask.linearGradient;

    // ---------------- v2.0: DOCUMENT CREATION & CANVAS ----------------
    PS.document = {};

    // create({ width, height, resolution, name, mode, fill, bits, colorProfile }).
    // mode ∈ 'rgb' | 'cmyk' | 'lab' | 'grayscale'.
    // fill ∈ 'white' | 'transparent' | 'black' | 'bgColor'.
    PS.document.create = function (cfg) {
        var w = cfg.width || 800, h = cfg.height || 600, res = cfg.resolution || 72;
        var mode = { rgb: NewDocumentMode.RGB, cmyk: NewDocumentMode.CMYK, lab: NewDocumentMode.LAB, grayscale: NewDocumentMode.GRAYSCALE }[(cfg.mode || 'rgb').toLowerCase()] || NewDocumentMode.RGB;
        var fillMap = { white: DocumentFill.WHITE, transparent: DocumentFill.TRANSPARENT };
        try { fillMap.black = DocumentFill.BLACK; } catch(_) {}
        try { fillMap.bgColor = DocumentFill.BACKGROUNDCOLOR; } catch(_) {}
        var fill = fillMap[(cfg.fill || 'transparent').toLowerCase()] || DocumentFill.TRANSPARENT;
        var d = app.documents.add(w, h, res, cfg.name || 'Untitled', mode, fill, 1);
        try { PS.patchSelection(d); } catch (e) {}
        return d;
    };

    PS.document.canvasSize = function (doc, width, height, anchor) {
        var d = doc || app.activeDocument;
        d.resizeCanvas(new UnitValue(width, 'px'), new UnitValue(height, 'px'), anchor || AnchorPosition.MIDDLECENTER);
    };

    // ---------------- v2.0: COLOR ----------------
    PS.color = {};
    PS.color.setForeground = function (r, g, b) {
        var c = new SolidColor();
        c.rgb.red = r; c.rgb.green = g; c.rgb.blue = b;
        app.foregroundColor = c;
    };
    PS.color.setBackground = function (r, g, b) {
        var c = new SolidColor();
        c.rgb.red = r; c.rgb.green = g; c.rgb.blue = b;
        app.backgroundColor = c;
    };

    // ---------------- v2.0: SELECTION EXTENSIONS ----------------
    PS.selection.smooth = function (px) { app.activeDocument.selection.smooth(px); };
    PS.selection.border = function (px) { app.activeDocument.selection.selectBorder(px); };

    // Fill the active selection with the foreground color.
    PS.selection.fill = function (color) {
        app.activeDocument.selection.fill(color || app.foregroundColor, ColorBlendMode.NORMAL, 100, false);
    };

    // Select > Color Range (simple form: sampled colors with fuzziness).
    PS.selection.colorRange = function (fuzziness) {
        var desc = new ActionDescriptor();
        desc.putEnumerated(c2t('Tlrn'), c2t('Tlrn'), c2t('Ctab'));
        desc.putInteger(c2t('Fzns'), fuzziness !== undefined ? fuzziness : 40);
        desc.putEnumerated(c2t('Intr'), c2t('Intr'), c2t('Sltn'));
        executeAction(c2t('ClrR'), desc, DialogModes.NO);
    };

    // ---------------- v2.0: LAYER STYLES (drop shadow + stroke) ----------------
    PS.layerStyle = {};
    PS._applyStyleFx = function (groupID, innerDesc) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putProperty(c2t('Prpr'), c2t('Lefx'));
        ref.putEnumerated(c2t('Lyr '), c2t('Ordn'), c2t('Trgt'));
        desc.putReference(c2t('null'), ref);
        var fx = new ActionDescriptor();
        fx.putEnumerated(c2t('Grup'), c2t('Type'), groupID);
        fx.putObject(groupID, groupID, innerDesc);
        desc.putObject(c2t('T   '), c2t('Lefx'), fx);
        executeAction(c2t('setd'), desc, DialogModes.NO);
    };
    PS._rgba = function (r, g, b) {
        var d = new ActionDescriptor();
        d.putDouble(c2t('Rd  '), r || 0); d.putDouble(c2t('Grn '), g || 0); d.putDouble(c2t('Bl  '), b || 0);
        return d;
    };
    // Accept '#rrggbb' or [r,g,b] for any layer-style colour argument.
    PS._colorTriplet = function (c, def) {
        if (typeof c === 'string') return PS._rgbOf(c);
        if (c && c.length >= 3) return [c[0], c[1], c[2]];
        return def || [0, 0, 0];
    };

    PS.layerStyle.dropShadow = function (cfg) {
        var sh = new ActionDescriptor();
        sh.putBoolean(c2t('enab'), true);
        sh.putInteger(c2t('Opct'), cfg.opacity !== undefined ? cfg.opacity : 75);
        sh.putBoolean(c2t('uglg'), cfg.useGlobalLight !== undefined ? !!cfg.useGlobalLight : true);
        sh.putInteger(c2t('lagl'), cfg.angle !== undefined ? cfg.angle : 120);
        sh.putInteger(c2t('Dstn'), cfg.distance !== undefined ? cfg.distance : 8);
        sh.putInteger(c2t('Ckmt'), cfg.spread !== undefined ? cfg.spread : 0);
        sh.putInteger(c2t('blur'), cfg.size !== undefined ? cfg.size : 15);
        var dscol = PS._colorTriplet(cfg.color, [0, 0, 0]);
        sh.putObject(c2t('Clr '), c2t('RGBC'), PS._rgba(dscol[0], dscol[1], dscol[2]));
        PS._applyStyleFx(c2t('DrSh'), sh);
        return app.activeDocument.activeLayer;
    };

    PS.layerStyle.stroke = function (cfg) {
        var st = new ActionDescriptor();
        st.putBoolean(c2t('enab'), true);
        st.putEnumerated(c2t('Styl'), c2t('FStl'), (cfg.position === 'inside' ? c2t('InsF') : cfg.position === 'center' ? c2t('CtrF') : c2t('OutF')));
        st.putInteger(c2t('Sz  '), cfg.size !== undefined ? cfg.size : 3);
        var stcol = PS._colorTriplet(cfg.color, [255, 0, 0]);
        st.putObject(c2t('Clr '), c2t('RGBC'), PS._rgba(stcol[0], stcol[1], stcol[2]));
        PS._applyStyleFx(c2t('FrFX'), st);
        return app.activeDocument.activeLayer;
    };

    PS.layerStyle.innerShadow = function (cfg) {
        var sh = new ActionDescriptor();
        sh.putBoolean(c2t('enab'), true);
        sh.putInteger(c2t('Opct'), cfg.opacity !== undefined ? cfg.opacity : 60);
        sh.putInteger(c2t('lagl'), cfg.angle !== undefined ? cfg.angle : 120);
        sh.putInteger(c2t('Dstn'), cfg.distance !== undefined ? cfg.distance : 5);
        sh.putInteger(c2t('Ckmt'), cfg.choke !== undefined ? cfg.choke : 0);
        sh.putInteger(c2t('blur'), cfg.size !== undefined ? cfg.size : 10);
        var iscol = PS._colorTriplet(cfg.color, [0, 0, 0]);
        sh.putObject(c2t('Clr '), c2t('RGBC'), PS._rgba(iscol[0], iscol[1], iscol[2]));
        PS._applyStyleFx(c2t('IrSh'), sh);
        return app.activeDocument.activeLayer;
    };
    PS.layerStyle.outerGlow = function (cfg) {
        var g = new ActionDescriptor();
        var col = PS._colorTriplet(cfg.color, [255, 200, 0]);
        g.putBoolean(c2t('enab'), true);
        g.putInteger(c2t('Opct'), cfg.opacity !== undefined ? cfg.opacity : 70);
        g.putInteger(c2t('Sprd'), cfg.spread !== undefined ? cfg.spread : 0);
        g.putInteger(c2t('blur'), cfg.size !== undefined ? cfg.size : 12);
        g.putObject(c2t('Clr '), c2t('RGBC'), PS._rgba(col[0], col[1], col[2]));
        PS._applyStyleFx(c2t('OrGl'), g);
        return app.activeDocument.activeLayer;
    };
    PS.layerStyle.innerGlow = function (cfg) {
        var g = new ActionDescriptor();
        var col = PS._colorTriplet(cfg.color, [0, 120, 255]);
        g.putBoolean(c2t('enab'), true);
        g.putInteger(c2t('Opct'), cfg.opacity !== undefined ? cfg.opacity : 70);
        g.putInteger(c2t('Ckmt'), cfg.choke !== undefined ? cfg.choke : 0);
        g.putInteger(c2t('blur'), cfg.size !== undefined ? cfg.size : 12);
        g.putObject(c2t('Clr '), c2t('RGBC'), PS._rgba(col[0], col[1], col[2]));
        PS._applyStyleFx(c2t('IrGl'), g);
        return app.activeDocument.activeLayer;
    };
    PS.layerStyle.colorOverlay = function (cfg) {
        var o = new ActionDescriptor();
        var col = PS._colorTriplet(cfg.color, [30, 144, 255]);
        o.putBoolean(c2t('enab'), true);
        o.putInteger(c2t('Opct'), cfg.opacity !== undefined ? cfg.opacity : 100);
        o.putObject(c2t('Clr '), c2t('RGBC'), PS._rgba(col[0], col[1], col[2]));
        PS._applyStyleFx(c2t('SoFi'), o);
        return app.activeDocument.activeLayer;
    };

    PS.layerStyle.bevel = function (cfg) {
        var b = new ActionDescriptor();
        b.putBoolean(c2t('enab'), true);
        b.putEnumerated(c2t('bvlS'), c2t('BESl'), c2t('SfBL')); // inner bevel
        if (cfg && cfg.color) { var bcol = PS._colorTriplet(cfg.color, [0, 0, 0]); b.putObject(c2t('Clr '), c2t('RGBC'), PS._rgba(bcol[0], bcol[1], bcol[2])); }
        PS._applyStyleFx(c2t('ebbl'), b);
        return app.activeDocument.activeLayer;
    };

    PS.layerStyle.gradientOverlay = function (cfg) {
        cfg = cfg || {};
        var g = new ActionDescriptor();
        g.putBoolean(c2t('enab'), true);
        g.putInteger(c2t('Opct'), cfg.opacity !== undefined ? cfg.opacity : 100);
        var gcfg = {};
        for (var k in cfg) gcfg[k] = cfg[k];
        // Locale-safe default: explicit foreground -> background RGB stops.
        if (!gcfg.preset && !gcfg.colors && gcfg.to === undefined) {
            gcfg.preset = 'Foreground to Background';
        }
        g.putObject(c2t('Grad'), s2t('Grdn'), PS._gradientDescriptor(gcfg));
        PS._applyStyleFx(c2t('GrFl'), g);
        return app.activeDocument.activeLayer;
    };

    PS.layerStyle.patternOverlay = function (cfg) {
        var p = new ActionDescriptor();
        p.putBoolean(c2t('enab'), true);
        p.putInteger(c2t('Opct'), cfg.opacity !== undefined ? cfg.opacity : 100);
        PS._applyStyleFx(c2t('PtFl'), p);
        return app.activeDocument.activeLayer;
    };

    PS.layerStyle.clearAll = function (layer) {
        app.activeDocument.activeLayer = layer || app.activeDocument.activeLayer;
        try { executeAction(s2t('removeLayerStyle'), new ActionDescriptor(), DialogModes.NO); } catch (_) {}
    };

    // ---------------- v2.0: VECTOR SHAPE LAYERS ----------------
    PS.shape = {};

    // Internal: create a vector shape layer (a real, editable vector object).
    PS._makeShape = function (shapeID, cfg) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putClass(s2t('contentLayer'));
        desc.putReference(s2t('null'), ref);
        var using = new ActionDescriptor(), shapeD = new ActionDescriptor();
        var c = new ActionDescriptor();
        c.putDouble(s2t('red'), cfg.color ? cfg.color[0] : 255);
        c.putDouble(s2t('grain'), cfg.color ? cfg.color[1] : 0);
        c.putDouble(s2t('blue'), cfg.color ? cfg.color[2] : 0);
        shapeD.putObject(s2t('color'), s2t('RGBColor'), c);
        shapeD.putEnumerated(s2t('shape'), s2t('shape'), s2t(shapeID));
        using.putObject(s2t('type'), s2t('solidColorLayer'), shapeD);
        desc.putObject(s2t('using'), s2t('contentLayer'), using);
        executeAction(s2t('make'), desc, DialogModes.NO);
        var l = app.activeDocument.activeLayer;
        if (cfg.name) l.name = cfg.name;
        return l;
    };

    PS.shape.rectangle = function (cfg) { return PS._makeShape('rectangle', cfg || {}); };
    PS.shape.roundedRect = function (cfg) { return PS._makeShape('roundedRectangle', cfg || {}); };
    PS.shape.ellipse = function (cfg) { return PS._makeShape('ellipse', cfg || {}); };
    PS.shape.triangle = function (cfg) { return PS._makeShape('triangle', cfg || {}); };
    PS.shape.polygon = function (cfg) { return PS._makeShape('polygon', cfg || {}); };
    PS.shape.line = function (cfg) { return PS._makeShape('line', cfg || {}); };

    // ---------------- v2.0: SMART OBJECT ----------------
    PS.smartObject = {};
    PS.smartObject.convert = function () {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(s2t('layer'), s2t('ordinal'), s2t('targetEnum'));
        desc.putReference(s2t('null'), ref);
        executeAction(s2t('newPlacedLayer'), desc, DialogModes.NO);
        return app.activeDocument.activeLayer;
    };

    // ---------------- v2.0: RASTERIZE ----------------
    // type: 'TEXTCONTENTS' | 'ENTIRELAYER' | null (auto → ENTIRELAYER).
    PS.rasterize = function (layer, type) {
        app.activeDocument.activeLayer = layer || app.activeDocument.activeLayer;
        var l = app.activeDocument.activeLayer;
        try {
            l.rasterize(RasterizeType[type || 'ENTIRELAYER']);
        } catch (e) {
            try { l.rasterize(RasterizeType.ENTIRELAYER); } catch (_) {}
        }
        return l;
    };

    // ---------------- v2.0: TRANSFORM ----------------
    PS.transform = {};
    PS.transform.rotateCanvas = function (angle) {
        app.activeDocument.rotateCanvas(angle);
    };
    PS.transform.flipCanvas = function (dir) {
        app.activeDocument.flipCanvas(dir === 'vertical' ? Direction.VERTICAL : Direction.HORIZONTAL);
    };

    // Free-transform the ACTIVE LAYER (scale + optional rotation), percent based.
    // cfg: { widthPct, heightPct, angle }
    PS.transform.layer = function (cfg) {
        var desc = new ActionDescriptor();
        desc.putEnumerated(c2t('FTcs'), c2t('QCSt'), c2t('Qcsa'));
        var off = new ActionDescriptor();
        off.putUnitDouble(c2t('Hrzn'), c2t('Pxl '), 0);
        off.putUnitDouble(c2t('Vrtc'), c2t('Pxl '), 0);
        desc.putObject(c2t('Ofst'), c2t('Ofst'), off);
        if (cfg.widthPct !== undefined) desc.putUnitDouble(c2t('Wdth'), c2t('Prc '), cfg.widthPct);
        if (cfg.heightPct !== undefined) desc.putUnitDouble(c2t('Hght'), c2t('Prc '), cfg.heightPct);
        if (cfg.angle !== undefined) desc.putAngle(c2t('Angl'), cfg.angle);
        desc.putEnumerated(c2t('Intr'), c2t('Intp'), c2t('Bcbc'));
        executeAction(c2t('Trnf'), desc, DialogModes.NO);
        return app.activeDocument.activeLayer;
    };

    // ---------------- v2.0: FILTERS ----------------
    PS.filter = {};
    PS.filter.gaussianBlur = function (radius) {
        app.activeDocument.activeLayer.applyGaussianBlur(radius);
        return app.activeDocument.activeLayer;
    };
    PS.filter.motionBlur = function (angle, distance) {
        app.activeDocument.activeLayer.applyMotionBlur(angle, distance);
        return app.activeDocument.activeLayer;
    };

    // ---------------- v2.0: TEXT EXTENSIONS ----------------
    PS.text.warp = function (cfg) {
        // cfg: { layer, style: 'arc','flag','wave'..., bend, horzDist, vertDist }
        var l = cfg.layer || app.activeDocument.activeLayer;
        var ti = l.textItem;
        if (cfg.style) { try { ti.warpStyle = WarpStyle[cfg.style.toUpperCase()]; } catch(e){} }
        if (cfg.bend !== undefined) ti.warpBend = cfg.bend;
        if (cfg.horzDist !== undefined) ti.warpHorizontalDistortion = cfg.horzDist;
        if (cfg.vertDist !== undefined) ti.warpVerticalDistortion = cfg.vertDist;
        return l;
    };
    PS.text.setTracking = function (layer, val) { layer.textItem.tracking = val; };
    PS.text.setLeading = function (layer, val) { layer.textItem.leading = val; };
    PS.text.setScale = function (layer, horz, vert) {
        if (horz !== undefined) layer.textItem.horizontalScale = horz;
        if (vert !== undefined) layer.textItem.verticalScale = vert;
    };
    PS.text.setBaselineShift = function (layer, val) { layer.textItem.baselineShift = val; };

    // ---------------- LOCALE-SAFE GRADIENTS ----------------
    // Gradient preset names are localized ("Foreground to Transparent" is
    // "От основного к прозрачному" in Russian Photoshop), so a string name in
    // the descriptor fails or is ignored on non-English installs. We always
    // build explicit RGB colour stops + transparency stops instead.

    PS._rgbOf = function (c) {
        if (typeof c === 'string') {
            var h = String(c).replace('#', '');
            if (h.length === 3) {
                h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
            }
            return [parseInt(h.substr(0, 2), 16) || 0,
                    parseInt(h.substr(2, 2), 16) || 0,
                    parseInt(h.substr(4, 2), 16) || 0];
        }
        if (c && c.length >= 3) return [c[0], c[1], c[2]];
        return [0, 0, 0];
    };

    // Normalize cfg to a list of { color:[r,g,b], location:0..1, opacity:0..100 }.
    PS._gradientStops = function (cfg) {
        cfg = cfg || {};
        var stops = [];
        var i, s;
        if (cfg.colors && cfg.colors.length) {
            for (i = 0; i < cfg.colors.length; i++) {
                s = cfg.colors[i];
                if (typeof s !== 'object' || s === null) s = { color: s };
                stops.push({
                    color: PS._rgbOf(s.color !== undefined ? s.color : s.rgb),
                    location: s.location !== undefined
                        ? s.location
                        : (cfg.colors.length > 1 ? i / (cfg.colors.length - 1) : 0),
                    opacity: s.opacity !== undefined ? s.opacity : 100
                });
            }
            return stops;
        }

        var fg = app.foregroundColor;
        var bg = app.backgroundColor;
        var fgRgb = [fg.rgb.red, fg.rgb.green, fg.rgb.blue];
        var bgRgb = [bg.rgb.red, bg.rgb.green, bg.rgb.blue];
        if (cfg.from !== undefined) fgRgb = PS._rgbOf(cfg.from);
        if (cfg.to !== undefined) bgRgb = PS._rgbOf(cfg.to);

        var preset = String(cfg.preset || '').toLowerCase();
        var toTransparent = preset.indexOf('transparent') >= 0 ||
                            (cfg.toOpacity !== undefined && cfg.toOpacity === 0);
        var toBackground = preset.indexOf('background') >= 0 || cfg.to !== undefined;
        if (preset.indexOf('black') >= 0 && preset.indexOf('white') >= 0) {
            fgRgb = [0, 0, 0];
            bgRgb = [255, 255, 255];
            toBackground = true;
        }

        stops.push({
            color: fgRgb,
            location: 0,
            opacity: cfg.fromOpacity !== undefined ? cfg.fromOpacity : 100
        });
        stops.push({
            color: toBackground ? bgRgb : fgRgb,
            location: 1,
            opacity: toTransparent
                ? (cfg.toOpacity !== undefined ? cfg.toOpacity : 0)
                : (cfg.toOpacity !== undefined ? cfg.toOpacity : 100)
        });
        return stops;
    };

    // Build a gradientClass ActionDescriptor from explicit stops.
    PS._gradientDescriptor = function (cfg) {
        var grad = new ActionDescriptor();
        grad.putString(s2t('name'), 'KitGradient');
        grad.putEnumerated(s2t('gradientForm'), s2t('gradientForm'), s2t('customStops'));

        var stops = PS._gradientStops(cfg);
        var colorList = new ActionList();
        var transparencyList = new ActionList();
        var i, stop, cs, ts, c, loc;
        for (i = 0; i < stops.length; i++) {
            stop = stops[i];
            loc = Math.round(stop.location * 4096);

            cs = new ActionDescriptor();
            c = new ActionDescriptor();
            c.putDouble(s2t('red'), stop.color[0]);
            c.putDouble(s2t('grain'), stop.color[1]);
            c.putDouble(s2t('blue'), stop.color[2]);
            cs.putObject(s2t('color'), s2t('RGBColor'), c);
            cs.putEnumerated(s2t('type'), s2t('colorStopType'), s2t('userStop'));
            cs.putInteger(s2t('location'), loc);
            cs.putInteger(s2t('midpoint'), 50);
            colorList.putObject(s2t('colorStop'), cs);

            ts = new ActionDescriptor();
            ts.putUnitDouble(s2t('opacity'), s2t('percentUnit'), stop.opacity);
            ts.putInteger(s2t('location'), loc);
            ts.putInteger(s2t('midpoint'), 50);
            transparencyList.putObject(s2t('transparencyStop'), ts);
        }
        grad.putList(s2t('colors'), colorList);
        grad.putList(s2t('transparency'), transparencyList);
        return grad;
    };

    // ---------------- v2.0: GRADIENT FILL LAYER ----------------
    // cfg: { style, angle, scale, reverse, name,
    //        from, to, fromOpacity, toOpacity,        // explicit colours
    //        colors: [{color, location, opacity}] }   // full custom stops
    // `preset` is still accepted as a hint ('foreground to transparent',
    // 'foreground to background', 'black, white'), but is never passed to
    // Photoshop by name.
    PS.fill.gradient = function (cfg) {
        cfg = cfg || {};
        var desc = new ActionDescriptor(); var ref = new ActionReference();
        ref.putClass(s2t('contentLayer')); desc.putReference(s2t('null'), ref);
        var using = new ActionDescriptor(), typeD = new ActionDescriptor();
        var styles = { linear: 'linear', radial: 'radial', angle: 'angle', reflected: 'reflected', diamond: 'diamond' };
        typeD.putEnumerated(s2t('type'), s2t('type'), s2t(styles[cfg.style] || 'linear'));
        typeD.putDouble(s2t('angle'), cfg.angle !== undefined ? cfg.angle : 0);
        if (cfg.scale !== undefined) typeD.putDouble(s2t('scale'), cfg.scale);
        typeD.putBoolean(s2t('reverse'), !!cfg.reverse);

        var gcfg = {};
        for (var k in cfg) gcfg[k] = cfg[k];
        if (!gcfg.preset && !gcfg.colors && gcfg.to === undefined) {
            gcfg.preset = 'Foreground to Transparent';
        }
        typeD.putObject(s2t('gradient'), s2t('gradientClass'), PS._gradientDescriptor(gcfg));
        using.putObject(s2t('type'), s2t('gradientLayer'), typeD);
        desc.putObject(s2t('using'), s2t('contentLayer'), using);
        executeAction(s2t('make'), desc, DialogModes.NO);
        var l = app.activeDocument.activeLayer;
        if (cfg.name) l.name = cfg.name;
        return l;
    };

    // Minimal JSON serializer (ExtendScript has no native JSON).
    PS.json = function (obj) {
        if (obj === null) return 'null';
        var t = typeof obj;
        if (t === 'string') return '"' + obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
        if (t === 'number' || t === 'boolean') return String(obj);
        if (obj instanceof Array) {
            var parts = [];
            for (var i = 0; i < obj.length; i++) parts.push(PS.json(obj[i]));
            return '[' + parts.join(',') + ']';
        }
        // object
        var keys = [];
        for (var k in obj) keys.push(k);
        var out = [];
        for (var j = 0; j < keys.length; j++) {
            var v = obj[keys[j]];
            if (typeof v === 'function') continue;
            out.push('"' + keys[j] + '":' + PS.json(v));
        }
        return '{' + out.join(',') + '}';
    };

    PS.report = function (doc) {
        var d = doc || app.activeDocument;
        function buildTree(layer) {
            var node = { name: layer.name, kind: layer.kind.toString(), visible: layer.visible, opacity: layer.opacity };
            var children = [];
            try {
                if (layer.layers) for (var i = 0; i < layer.layers.length; i++) children.push(buildTree(layer.layers[i]));
            } catch (_) {}
            if (children.length) node.children = children;
            return node;
        }
        var layerTree = [];
        // artLayers[0] is the topmost layer; report top -> bottom.
        for (var i = 0; i < d.artLayers.length; i++) layerTree.push(buildTree(d.artLayers[i]));
        var hRaw = '';
        try { hRaw = String(d.histogram || ''); } catch (_) { hRaw = ''; }
        var report = {
            name: d.name,
            width: parseInt(d.width.value),
            height: parseInt(d.height.value),
            resolution: parseInt(d.resolution),
            mode: d.mode.toString(),
            layers: layerTree,
            layerCount: d.artLayers.length,
            histogram256: hRaw  // comma-separated 256 RGB luminosity counts
        };
        return report;
    };

    // ---------------- v4: expose low-level type-id helpers ----------------
    // Recipes often need a one-off ActionManager descriptor. Keep the helpers
    // reachable without re-implementing the closure-bound wrappers.
    PS.s2t = s2t;
    PS.c2t = c2t;

    // ---------------- v4: Selection ergonomics ----------------
    // The native DOM only has Selection.select(points); agents instinctively
    // write doc.selection.selectRect(...). ExtendScript has no global
    // `Selection` constructor, but the live Selection object accepts
    // expando methods — so patch each document's selection instance.
    PS.patchSelection = function (doc) {
        doc = doc || (app.documents.length ? app.activeDocument : null);
        if (!doc) return false;
        try {
            var sel = doc.selection;
            if (!sel.selectRect) {
                sel.selectRect = function (l, t, r, b, feather) {
                    doc.selection.select([[l, t], [r, t], [r, b], [l, b]],
                        SelectionType.REPLACE, 0, false);
                    if (feather) doc.selection.feather(feather);
                };
            }
            if (!sel.selectOval) {
                sel.selectOval = function (l, t, r, b, feather) {
                    doc.selection.select(PS._ovalPoints(l, t, r, b),
                        SelectionType.REPLACE, 0, true);
                    if (feather) doc.selection.feather(feather);
                };
            }
            return true;
        } catch (e) {
            // Host may forbid expando methods — PS.selection still works.
            return false;
        }
    };
    PS.patchSelection();

})();

// v4: also expose the type-id helpers globally (handy in ad-hoc -e snippets).
try { if (typeof s2t === 'undefined') s2t = PS.s2t; } catch (e) {}
try { if (typeof c2t === 'undefined') c2t = PS.c2t; } catch (e) {}
