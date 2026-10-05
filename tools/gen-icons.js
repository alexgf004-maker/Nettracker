// Genera css/icons.css a partir de los SVG de Lucide (npm run icons). Para agregar un ícono, súmalo a MAP.
const fs = require('fs'); const path = require('path');
const dir = path.join(__dirname, '../node_modules/lucide-static/icons');
// nombre en la app -> archivo Lucide
const MAP = {
  home: 'house', campanas: 'calendar-range', reclamos: 'message-square-warning', requerimientos: 'clipboard-list',
  ft: 'activity', equipos: 'package', herramientas: 'wrench', instalaciones: 'zap', validacion: 'plug-zap',
  despachos: 'send', mapa: 'map', 'map-pin': 'map-pin', buscar: 'search', salir: 'log-out', usuario: 'user',
  check: 'circle-check', alerta: 'triangle-alert', repetir: 'repeat', descargar: 'download', subir: 'upload',
  cuadro: 'square', 'cuadro-check': 'square-check', x: 'circle-x', grafica: 'chart-column', archivo: 'file-text',
  editar: 'pencil', borrar: 'trash-2', clipboard: 'clipboard', antena: 'radio-tower', etiqueta: 'tag',
  'archivo-editar': 'file-pen', reloj: 'clock', bandeja: 'inbox', casco: 'hard-hat', candado: 'lock',
  calendario: 'calendar', correo: 'mail', campana: 'bell', fabrica: 'factory', enlace: 'link',
  'flecha-abajo': 'arrow-down', menu: 'menu', ajustes: 'settings', 'octagon-x': 'octagon-x', carpeta: 'folder',
  mas: 'ellipsis', 'chevron-right': 'chevron-right', 'chevron-left': 'chevron-left', plus: 'plus', edificio: 'building-2',
  capas: 'layers', excel: 'file-spreadsheet', guardar: 'save', luna: 'moon', sol: 'sun', llave: 'wrench',
  satelite: 'satellite', imprimir: 'printer', ojo: 'eye', info: 'info', bateria: 'battery-warning', escudo: 'shield-check',
  ruta: 'route', medidor: 'gauge',
};
let css = '/* Íconos Lucide (https://lucide.dev, licencia ISC) usados como máscara: toman el color del texto.\n   Uso: <i class="ic ic-home"></i> o, dentro de textos, <i class=ic-home></i> (sin comillas). Generado por un script; para agregar uno, agrega su SVG aquí. */\n';
css += '.ic, [class^=\"ic-\"], [class*=\" ic-\"] { display: inline-block; width: 1.15em; height: 1.15em; vertical-align: -0.2em; flex-shrink: 0; background-color: currentColor; -webkit-mask: var(--ic) center / contain no-repeat; mask: var(--ic) center / contain no-repeat; }\n';
for (const [name, file] of Object.entries(MAP)) {
  let svg = fs.readFileSync(path.join(dir, file + '.svg'), 'utf8').replace(/<!--.*?-->/s, '').replace(/class="[^"]*"/, '').replace(/\s+/g, ' ').replace(/> </g, '><').trim();
  svg = svg.replace('stroke="currentColor"', 'stroke="black"');
  const uri = "data:image/svg+xml," + encodeURIComponent(svg).replace(/'/g, '%27');
  css += `.ic-${name} { --ic: url("${uri}"); }\n`;
}
fs.writeFileSync(path.join(__dirname, '../css/icons.css'), css);
console.log(Object.keys(MAP).length, 'icons', css.length, 'bytes');
