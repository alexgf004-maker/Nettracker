// Genera los íconos PNG de la app instalable a partir de icons/icon.svg (node tools/gen-app-icons.js).
// Android pide PNG de 192 y 512 (y uno "maskable" que se puede recortar en círculo); el iPhone usa el apple-touch-icon.
const fs = require('fs'); const path = require('path');
const { chromium } = require('@playwright/test');
const dir = path.join(__dirname, '../icons');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
// Versión a sangre (sin esquinas redondeadas) con el dibujo al 80 %: zona segura de los íconos maskable
const interior = svg.replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/<rect width="512" height="512" rx="100" fill="url\(#grad\)"\/>/, '');
const defs = (svg.match(/<defs>[\s\S]*?<\/defs>/) || [''])[0];
const sangre = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">${defs}<rect width="512" height="512" fill="url(#grad)"/><g transform="translate(51.2 51.2) scale(0.8)">${interior.replace(defs, '')}</g></svg>`;
const SALIDAS = [['icon-192.png', 192, svg], ['icon-512.png', 512, svg], ['icon-maskable-512.png', 512, sangre], ['apple-touch-icon.png', 180, sangre]];
(async () => {
  const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const pagina = await navegador.newPage();
  for (const [nombre, lado, fuente] of SALIDAS) {
    await pagina.setViewportSize({ width: lado, height: lado });
    await pagina.setContent(`<html><body style="margin:0;background:transparent">${fuente.replace('width="512" height="512"', `width="${lado}" height="${lado}"`)}</body></html>`);
    await pagina.screenshot({ path: path.join(dir, nombre), omitBackground: true, clip: { x: 0, y: 0, width: lado, height: lado } });
    console.log('icons/' + nombre);
  }
  await navegador.close();
})();
