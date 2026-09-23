// Utilidades compartidas por las pruebas: abre la app con una Firebase falsa en memoria.
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const fixture = require('./fixture');

// Fecha fija para que los estados (activo, próximo, vencido…) no cambien con el día
const HOY = new Date('2026-09-23T12:00:00');

/**
 * Abre la app lista para probar.
 * - Firebase se reemplaza por tests/mock/firebase-*.js con los datos de tests/fixture.js
 * - Las librerías externas (Excel, PDF, mapas, fuentes) se bloquean
 * - usuario: nombre para entrar con sesión ya iniciada, o null para ver el login
 * Devuelve { errores, escrituras() } para verificar al final.
 */
async function abrirApp(page, { usuario = 'David García', datos = fixture } = {}) {
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errores.push('console: ' + m.text()); });

  await page.addInitScript(({ datos, usuario }) => {
    if (window !== window.top) return; // el mapa corre en un iframe aparte
    window.__FIXTURE__ = datos;
    window.confirm = () => true;
    window.alert = () => {};
    window.open = () => null;
    localStorage.setItem('cpt_theme', 'light');
    if (usuario) localStorage.setItem('cpt_session', JSON.stringify({ nombre: usuario }));
  }, { datos, usuario });
  await page.route(/gstatic\.com\/firebasejs\/.*\/(firebase-[a-z]+\.js)$/, route =>
    route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(__dirname, 'mock', route.request().url().split('/').pop())) }));
  // Leaflet falso: cualquier llamada (L.map(...).setView(...), etc.) devuelve el mismo objeto
  await page.route(/leaflet.*\.js$/, route => route.fulfill({ contentType: 'text/javascript',
    body: 'window.L = new Proxy(function () {}, { get: (t, k) => (k === "then" ? undefined : window.L), apply: () => window.L });' }));
  await page.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|unpkg\.com\/.*\.css|tile\.openstreetmap/, route => route.fulfill({ body: '' }));
  await page.clock.setFixedTime(HOY);

  await page.goto('/');
  await expect(page.locator('#app .loading')).toHaveCount(0);

  return {
    errores,
    /** Lista de escrituras a Firebase: [['push'|'set'|'update'|'remove', ruta, valor], ...] */
    escrituras: () => page.evaluate(() => window.__WRITES__),
    /** Ejecuta código en la página (p. ej. llamar un handler window.*) */
    ejecutar: (code, arg) => page.evaluate(code, arg),
  };
}

/** Cierra el aviso de retiros próximos si aparece */
async function cerrarAlerta(page) {
  await page.evaluate(() => window.cerrarAlerta && window.cerrarAlerta());
}

module.exports = { abrirApp, cerrarAlerta, fixture, HOY };
