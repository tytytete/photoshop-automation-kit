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
        return app.open(File(path));
    };

    PS.activeDocument = function () {
        return app.activeDocument;
    };

    PS.close = function (doc, saveChanges) {
        doc.close(saveChanges ? SaveOptions.SAVECHANGES : SaveOptions.DONOTSAVECHANGES);
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

    PS.selection.selectRect = function (l, t, r, b, feather) {
        var f = feather || 0;
        app.activeDocument.selection.select([[l, t], [r, t], [r, b], [l, b]],
            SelectionType.REPLACE, f, false);
    };

    PS.selection.selectOval = function (l, t, r, b, feather) {
        var f = feather || 0;
        app.activeDocument.selection.select([[l, t], [r, t], [r, b], [l, b]],
            SelectionType.REPLACE, f, true);
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

    // Create a mask from the current selection on the given layer.
    PS.mask.fromSelection = function (layer) {
        // When an adjustment/fill layer is created with an active selection,
        // Photoshop auto-generates the mask. For a normal layer call add().
        if (layer && layer.kind === LayerKind.NORMAL) {
            app.activeDocument.activeLayer = layer;
            var d = new ActionDescriptor();
            var r = new ActionReference();
            r.putEnumerated(s2t('channel'), s2t('channel'), s2t('mask'));
            d.putReference(s2t('null'), r);
            d.putEnumerated(s2t('using'), s2t('userMaskEnabled'), s2t('revealSelection'));
            executeAction(s2t('make'), d, DialogModes.NO);
        }
        return layer;
    };

    PS.mask.invert = function (layer) {
        app.activeDocument.activeLayer = layer || app.activeDocument.activeLayer;
        executeAction(s2t('invert'), new ActionDescriptor(), DialogModes.NO);
    };

})();
