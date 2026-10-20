// Mountain-cafe logo — reference build using the v3 helpers.
//   100 x 100 cm @ 150 ppi, vector-only, 3-colour palette.
//
// Run:  ./tools/run.sh examples/mountain_cafe_logo.jsx
#target photoshop

var OUT = '/tmp/mountain_cafe_logo';

// palette
var GREEN = '#2D4A3E';
var CREAM = '#F5E6D3';
var TERRA = '#C97B5A';

PS.setup({ logPath: '/tmp/mountain_cafe_logo.log' });

var doc = PS.document.createSize({
    width: 100, height: 100, unit: 'cm', resolution: 150,
    mode: 'rgb', fill: 'white', name: 'Logo_CafeneauaMontana'
});

var CX = 2953, CY = 2953;

// badge
PS.vector.circle(CX, CY, 2550, { color: GREEN, name: 'InelExterior' });
PS.vector.circle(CX, CY, 2420, { color: CREAM, name: 'DiscInterior' });

// sun behind the peaks
PS.vector.circle(3220, 1680, 340, { color: TERRA, name: 'Soare' });

// mountains
PS.vector.create({ points: [[2150, 3360], [3250, 1860], [4350, 3360]], color: GREEN, name: 'MunteSpate' });
PS.vector.create({ points: [[1450, 3360], [2950, 2060], [4450, 3360]], color: GREEN, name: 'MunteFata' });

// cup + steam
PS.vector.create({ points: [[2500, 3660], [3450, 3660], [3350, 4170], [2600, 4170]], color: GREEN, name: 'Cana' });
PS.vector.line(2742, 3440, 2742, 3560, 25, { color: GREEN, name: 'Abur1' });
PS.vector.line(2952, 3390, 2952, 3540, 25, { color: GREEN, name: 'Abur2' });
PS.vector.line(3162, 3440, 3162, 3560, 25, { color: GREEN, name: 'Abur3' });

// typography — baselines in document pixels
PS.text.addAt({ contents: 'cafea  ·  natură  ·  liniște', sizePx: 90, font: 'ArialMT',
                color: GREEN, x: CX, y: 820, justify: 'CENTER', name: 'Slogan' });

var brand = PS.text.addAt({ contents: 'CAFENEUA MONTANĂ', sizePx: 235, font: 'Arial-BoldMT',
                            color: GREEN, x: CX, y: 4750, justify: 'CENTER', name: 'Denumire' });
PS.text.arc(brand, -45);

// guaranteed PSD + JPG
PS.export.auto(doc, OUT, 11);
PS.close(doc, false);

PS.log('logo done -> ' + OUT + '.psd / .jpg');
'done';
