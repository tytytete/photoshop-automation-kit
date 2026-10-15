// Full demonstration: build a simple logo card using v2 features.
//   new document -> vector shapes -> layer styles -> text + warp -> save
//
// Run:
//   ./tools/run.sh examples/logo_card.jsx
#target photoshop

var OUT = '/tmp/logo_card';

var doc = PS.document.create({ width: 800, height: 500, resolution: 72, name: 'LogoCard', mode: 'rgb', fill: 'white' });

// Background accent
PS.selection.selectRect(0, 0, 800, 500, 0);
PS.color.setForeground(240, 244, 248);
PS.selection.fill();
PS.selection.deselect();

// A vector shape "badge" with layer styles
PS.selection.selectRect(300, 120, 500, 320, 0);
PS.color.setForeground(70, 130, 180);
var badge = PS.fill.solidColor({ red: 70, green: 130, blue: 180, name: 'Badge' });
PS.selection.deselect();

PS.layerStyle.dropShadow({ opacity: 45, angle: 120, distance: 6, size: 16, color: [0, 0, 0] });
PS.layerStyle.stroke({ size: 3, position: 'outside', color: [255, 255, 255] });

// Title text + warp
var title = PS.text.add({ contents: 'MOUNTAIN CAFE', size: 42, font: 'Arial-BoldMT', color: [255, 255, 255], position: [270, 205], name: 'Title' });
PS.text.warp({ layer: title, style: 'arc', bend: 12 });

// Subtitle
PS.text.add({ contents: 'warmth & quiet', size: 16, font: 'ArialMT', color: [230, 240, 250], position: [340, 270], name: 'Subtitle' });

PS.save.psd(doc, OUT + '.psd');
PS.save.jpg(doc, OUT + '.jpg');
PS.close(doc, false);