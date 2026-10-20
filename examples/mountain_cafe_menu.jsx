// Mountain-cafe menu — reference build using the v3 helpers.
//   A4 (210 x 297 mm) @ 300 ppi, CMYK, portrait.
//   Same 3-colour palette as the logo; visual unity maintained.
//
// Run:  ./tools/run.sh examples/mountain_cafe_menu.jsx
#target photoshop

var OUT = '/tmp/mountain_cafe_menu';

var GREEN = '#2D4A3E';
var CREAM = '#F5E6D3';
var TERRA = '#C97B5A';
var DARK  = '#243830';

PS.setup({ logPath: '/tmp/mountain_cafe_menu.log' });

var doc = PS.document.createSize({
    width: 210, height: 297, unit: 'mm', resolution: 300,
    mode: 'cmyk', fill: 'white', name: 'Meniu_CafeneauaMontana'
});

var MX = 1240; // horizontal centre of the page

// background
PS.fill.solidColor({ red: 245, green: 230, blue: 211, name: 'Fond' });

// header logo mark
PS.vector.circle(MX, 400, 320, { color: GREEN, name: 'LogoInel' });
PS.vector.circle(MX, 400, 298, { color: CREAM, name: 'LogoDisc' });
PS.vector.circle(1310, 314, 48, { color: TERRA, name: 'LogoSoare' });
PS.vector.create({ points: [[1090, 620], [1240, 430], [1390, 620]], color: GREEN, name: 'LogoMunte2' });
PS.vector.create({ points: [[970, 620], [1240, 452], [1510, 620]], color: GREEN, name: 'LogoMunte1' });
PS.vector.create({ points: [[1170, 642], [1310, 642], [1298, 676], [1182, 676]], color: GREEN, name: 'LogoCana' });

PS.text.addAt({ contents: 'CAFENEUA MONTANĂ', sizePx: 42, font: 'Arial-BoldMT', color: GREEN, x: MX, y: 910, justify: 'CENTER', name: 'Denumire' });

// divider
PS.vector.rect(380, 1010, 2100, 1016, { color: GREEN, name: 'Linie1' });

// title
PS.text.addAt({ contents: 'MENIU', sizePx: 70, font: 'Arial-BoldMT', color: GREEN, x: MX, y: 1270, justify: 'CENTER', name: 'Titlu' });

// --- categories ------------------------------------------------------------
function category(hdr, y, items) {
    PS.text.addAt({ contents: hdr, sizePx: 42, font: 'Arial-BoldMT', color: GREEN, x: 420, y: y, name: hdr });
    PS.vector.rect(420, y + 24, 2060, y + 28, { color: GREEN, name: hdr + 'Linie' });
    for (var i = 0; i < items.length; i++) {
        var yy = y + 140 + i * 100;
        PS.text.addAt({ contents: items[i][0], sizePx: 36, font: 'ArialMT', color: DARK,  x: 420,  y: yy, justify: 'LEFT',  name: hdr + i });
        PS.text.addAt({ contents: items[i][1], sizePx: 36, font: 'ArialMT', color: GREEN, x: 2060, y: yy, justify: 'RIGHT', name: hdr + i + 'Pret' });
    }
}

category('CAFELE', 1450, [['Espresso', '12 lei'], ['Cappuccino', '18 lei'], ['Latte', '20 lei']]);
category('CEAIURI', 1980, [['Ceai verde', '10 lei'], ['Ceai negru', '10 lei'], ['Ceai de mentă', '12 lei']]);
category('DELICII', 2510, [['Tort de mere', '22 lei'], ['Briose', '16 lei'], ['Prăjitură', '14 lei']]);

// --- footer ----------------------------------------------------------------
PS.vector.circle(1240, 2960, 36, { color: TERRA, name: 'SoareJos' });
PS.vector.create({ points: [[1010, 3100], [1150, 2940], [1290, 3100]], color: GREEN, name: 'MunteJos2' });
PS.vector.create({ points: [[1060, 3100], [1240, 2900], [1420, 3100]], color: GREEN, name: 'MunteJos1' });
PS.vector.rect(1000, 3100, 1480, 3104, { color: GREEN, name: 'Baza' });

// contact line, stacked with the line above via measured spacing
PS.text.addAt({ contents: 'Str. Muntelui 7  ·  0700 123 456', sizePx: 28, font: 'ArialMT', color: DARK, x: MX, y: 3220, justify: 'CENTER', name: 'Contact' });
PS.vector.rect(690, 3340, 1790, 3344, { color: GREEN, name: 'LinieJJos' });

// guaranteed PSD + JPG
PS.export.auto(doc, OUT, 11);
PS.close(doc, false);

PS.log('menu done -> ' + OUT + '.psd / .jpg');
'done';