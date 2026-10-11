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
 * - usuario: nombre para entrar con sesión ya iniciada (Auth falso), o null para ver el login
 * - excel: true para usar la librería de Excel real (por defecto se bloquea)
 * Devuelve { errores, escrituras() } para verificar al final.
 */
// Correo interno de la cuenta de un perfil (igual que correoPerfil en js/actions/auth.js)
const correoPerfil = nombre => String(nombre).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '@usuarios.nettracker.app';

/**
 * cuentas: { nombre: pin } perfiles que ya crearon su PIN (cuenta en el Auth falso y marca en cuentas/)
 */
async function abrirApp(page, { usuario = 'David García', datos = fixture, excel = false, cuentas = {} } = {}) {
  const errores = [];
  page.on('pageerror', e => errores.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errores.push('console: ' + m.text()); });

  const auth = { cuentas: {}, actual: usuario ? correoPerfil(usuario) : null };
  const clave = n => correoPerfil(n).split('@')[0];
  for (const [nombre, pin] of Object.entries(cuentas)) auth.cuentas[correoPerfil(nombre)] = pin;
  if (usuario && !(auth.actual in auth.cuentas)) auth.cuentas[auth.actual] = '000000';
  if (Object.keys(cuentas).length) datos = { ...datos, cuentas: Object.fromEntries(Object.keys(cuentas).map(n => [clave(n), { creado: '2026-01-01' }])) };
  await page.addInitScript(({ datos, auth }) => {
    if (window !== window.top) return; // el mapa corre en un iframe aparte
    window.__FIXTURE__ = datos;
    window.__AUTH__ = auth;
    window.confirm = () => true;
    window.alert = () => {};
    window.open = () => null;
    localStorage.setItem('cpt_theme', 'light');
  }, { datos, auth });
  await page.route(/gstatic\.com\/firebasejs\/.*\/(firebase-[a-z]+\.js)$/, route =>
    route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(__dirname, 'mock', route.request().url().split('/').pop())) }));
  // Leaflet falso: cualquier llamada (L.map(...).setView(...), etc.) devuelve el mismo objeto
  await page.route(/leaflet.*\.js$/, route => route.fulfill({ contentType: 'text/javascript',
    body: 'window.L = new Proxy(function () {}, { get: (t, k) => (k === "then" ? undefined : window.L), apply: () => window.L });' }));
  await page.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com|unpkg\.com\/.*\.css|tile\.openstreetmap/, route => route.fulfill({ body: '' }));
  // excel: true carga la librería de Excel real (xlsx-js-style, SheetJS con estilos, desde node_modules) para leer y generar archivos
  // (va después del bloqueo general porque Playwright aplica primero la última ruta registrada)
  if (excel) await page.route(/cdn\.jsdelivr\.net\/npm\/xlsx-js-style.*\.js$/, route =>
    route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(require.resolve('xlsx-js-style/dist/xlsx.bundle.js')) }));
  await page.clock.setFixedTime(HOY);

  await page.goto('/');
  await expect(page.locator('#app .loading')).toHaveCount(0);
  await page.waitForFunction(() => window.__PENDIENTES__ === 0); // todos los nodos cargados

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
