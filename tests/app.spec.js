// Pruebas automáticas de NetTracker: recorren la app con datos de ejemplo
// (tests/fixture.js) y una Firebase falsa en memoria. Ver tests/README.md
const { test, expect } = require('@playwright/test');
const { abrirApp, cerrarAlerta, fixture } = require('./helpers');

const app$ = page => page.locator('#app');
const nav = (page, texto) => page.locator('nav.bottom-nav button', { hasText: texto }).click();

// Cada prueba termina verificando que no hubo errores de JavaScript
let app;
test.afterEach(async () => {
  expect(app.errores, 'errores de JavaScript en la página').toEqual([]);
});

test.describe('Login', () => {
  test('PIN incorrecto muestra error y PIN correcto entra al inicio', async ({ page }) => {
    app = await abrirApp(page, { usuario: null });
    await page.getByText('David García').first().click();
    await page.locator('#pin-input').fill('0000');
    await page.locator('#pin-input').press('Enter');
    await expect(app$(page)).toContainText('PIN incorrecto');

    await page.locator('#pin-input').fill('2442');
    await page.locator('#pin-input').press('Enter');
    await expect(app$(page)).toContainText('Hola, David!');
  });

  test('cerrar sesión vuelve al login', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await page.locator('[title="Cerrar sesión"]').click();
    await expect(page.locator('#pin-input')).toHaveCount(0);
    await expect(app$(page)).toContainText('Bryan Francia');
  });
});

test.describe('Navegación', () => {
  test('todas las pestañas cargan sin errores', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await expect(app$(page)).toContainText(/instalaciones activas/i);
    await nav(page, 'Instalac.');
    await expect(app$(page)).toContainText('SN-100');
    await nav(page, 'Inventario');
    await expect(app$(page)).toContainText(/disponibles/i);
    await nav(page, 'Despachos');
    await expect(app$(page)).toContainText('Subir archivo');
    await nav(page, 'Mapa');
    await expect(app$(page)).toContainText(/en mapa/i);
    await nav(page, 'Inicio');
    await expect(app$(page)).toContainText(/acciones rápidas/i);
  });

  test('búsqueda global, calendario y modo oscuro', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await app.ejecutar(() => { toggleGlobalSearch(); setGlobalSearch('SN-102'); });
    await expect(app$(page)).toContainText('SN-102');
    await app.ejecutar(() => { toggleGlobalSearch(); toggleCal(); calNav(1); calNav(-1); });
    await app.ejecutar(() => toggleDarkMode());
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});

test.describe('Dashboard', () => {
  test('muestra alertas y resumen según los datos', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await expect(app$(page)).toContainText('1 retiro vencido');
    await expect(app$(page)).toContainText(/retiros próximos \(1\)/i);
    await expect(app$(page)).toContainText('Validaciones de TAP (1 campañas)');
  });
});

test.describe('Instalaciones', () => {
  test.beforeEach(async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await nav(page, 'Instalac.');
  });

  test('filtra por área y por estado', async ({ page }) => {
    await expect(app$(page)).toContainText('SN-100');
    await expect(app$(page)).not.toContainText('SN-102'); // es de CPT BT
    await app.ejecutar(() => setInstTab('cpt_bt'));
    await expect(app$(page)).toContainText('SN-102');
    await app.ejecutar(() => { setInstTab('cpt_mt'); setFilter('PROXIMO'); });
    await expect(app$(page)).toContainText('SN-101');
    await expect(app$(page)).not.toContainText('SN-100');
    await app.ejecutar(() => { setFilter('TODOS'); setInstTab('campos'); });
    await expect(app$(page)).toContainText('SN-104');
  });

  test('detalle, editar y volver', async ({ page }) => {
    await app.ejecutar(() => openDetail('r1'));
    await expect(app$(page)).toContainText('#C-001');
    await expect(app$(page)).toContainText('Col. Escalón');
    await app.ejecutar(() => editInstall('r1'));
    await app.ejecutar(() => goBack());
    await expect(app$(page)).toContainText(/total/i);
  });

  test('un registro que ya no existe vuelve a la lista', async ({ page }) => {
    await app.ejecutar(() => openDetail('no-existe'));
    await expect(app$(page)).toContainText(/total/i);
  });

  test('registrar una instalación nueva guarda en Firebase', async ({ page }) => {
    await page.getByText('+ Nuevo').click();
    await expect(app$(page)).toContainText('Nuevo instalación');
    await app.ejecutar(() => {
      openSelector(); setSelectorSearch('105'); pickEquipo('e6');
      setField('caso', 'C-999'); setField('lugar', 'Lugar X'); setField('fechaRetiro', '2026-10-30');
    });
    await app.ejecutar(() => saveInstall());
    const push = (await app.escrituras()).find(([op, ruta]) => op === 'push' && ruta === 'analizadores');
    expect(push, 'se guardó la instalación').toBeTruthy();
    expect(push[2]).toMatchObject({ caso: 'C-999', serie: 'SN-105', fechaRetiro: '2026-10-30' });
  });

  test('modales de retiro y descarga', async ({ page }) => {
    await app.ejecutar(() => { openRetiroModal('r2'); toggleFalla('LED intermitente'); });
    await expect(app$(page)).toContainText('Registrar retiro');
    await app.ejecutar(() => { closeRetiroModal(); openDescargaModal('r1'); });
    await app.ejecutar(() => closeDescargaModal());
    await expect(app$(page)).not.toContainText('Registrar retiro');
  });

  // Al retirar, la falla marcada define la nueva condición del equipo
  for (const [falla, condicion] of [
    ['No enciende / Sin señales de vida', 'fuera'],
    ['Equipo calcinado / Explosión', 'fuera'],
    ['LED intermitente', 'detalles'],
  ]) {
    test(`retiro con "${falla}" deja el equipo como ${condicion}`, async ({ page }) => {
      await app.ejecutar(() => openRetiroModal('r2')); // SN-101, equipo e2 en condición "bueno"
      await page.locator(`div[onclick="toggleFalla('${falla}')"]`).click();
      await page.getByText('Sí, ya descargué').click();
      await page.getByText('Confirmar retiro').click();
      await expect.poll(async () => (await app.escrituras()).length).toBe(2);
      const [retiro, equipo] = await app.escrituras();
      expect(retiro.slice(0, 2)).toEqual(['update', 'analizadores/r2']);
      expect(retiro[2].fallas).toEqual([falla]);
      expect(equipo.slice(0, 2)).toEqual(['update', 'equipos/e2']);
      expect(equipo[2].condicion).toBe(condicion);
      expect(equipo[2].historialCondicion.at(-1)).toMatchObject({ condicionAnterior: 'bueno', condicionNueva: condicion });
    });
  }

  test('eliminar una instalación', async ({ page }) => {
    await app.ejecutar(() => delInstall('r2'));
    expect(await app.escrituras()).toContainEqual(['remove', 'analizadores/r2']);
  });
});

test.describe('Inventario', () => {
  test.beforeEach(async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await nav(page, 'Inventario');
  });

  test('lista, filtros, búsqueda y vista en cuadrícula', async ({ page }) => {
    await expect(app$(page)).toContainText('SN-105');
    await app.ejecutar(() => setInvFiltro('prestado'));
    await expect(app$(page)).toContainText('SN-103');
    await expect(app$(page)).not.toContainText('SN-105');
    await app.ejecutar(() => { setInvFiltro('TODOS'); toggleVistaInv(); toggleVistaInv(); setInvSearch('102'); });
    await expect(app$(page)).toContainText('SN-102');
    await expect(app$(page)).not.toContainText('SN-105');
  });

  test('detalle del equipo en todas sus pestañas', async ({ page }) => {
    for (const t of ['general', 'mantenimiento', 'instalaciones', 'movimientos']) {
      await app.ejecutar(t => { openEqDetalle('e1'); setEqDetalleTab(t); }, t);
      await expect(app$(page)).toContainText('SN-100');
    }
  });

  test('guardar mantenimiento, condición y préstamo', async ({ page }) => {
    await app.ejecutar(() => { openMantModal('e1'); setMantForm('descripcion', 'falla x'); guardarMant(); });
    await app.ejecutar(() => { openCondicionModal('e1'); setCondicionField('condicion', 'malo'); doCondicion(); });
    await app.ejecutar(() => { registrarPrestamo('e2'); setPrestamoField('a', 'Campos y Servicios'); doMovimiento(); });
    const rutas = (await app.escrituras()).map(([op, ruta]) => op + ' ' + ruta);
    expect(rutas).toEqual(['update equipos/e1', 'update equipos/e1', 'update equipos/e2']);
  });

  test('crear equipo nuevo', async ({ page }) => {
    await app.ejecutar(() => { newEquipo(); setEF('serie', 'SN-777'); setEF('modelo', 'PQ-9'); saveEquipo(); });
    const push = (await app.escrituras()).find(([op, ruta]) => op === 'push' && ruta === 'equipos');
    expect(push[2]).toMatchObject({ serie: 'SN-777', modelo: 'PQ-9' });
  });

  test('modo lote', async ({ page }) => {
    await app.ejecutar(() => { activarModoLote('prestamo'); toggleLote('e6'); });
    await expect(app$(page)).toContainText('Cancelar');
    await app.ejecutar(() => cancelarLote());
  });
});

test.describe('Validaciones de TAP', () => {
  test('campaña y formulario para cada tipo de conexión', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await app.ejecutar(() => { switchTab('validaciones'); abrirCampana('v1'); });
    await expect(app$(page)).toContainText('Usuario A');
    await expect(app$(page)).toContainText('1 / 3');
    for (const tipo of ['monofasico', 'bifasico', 'trifasico']) {
      await app.ejecutar(tipo => { abrirFormVal('0'); setValTipoUsuario(tipo); }, tipo);
      await expect(app$(page)).toContainText('Validación de TAP');
    }
    await expect(app$(page)).toContainText('23,000 V'); // opciones trifásicas
  });

  test('monofásico ofrece 120 V', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await app.ejecutar(() => { switchTab('validaciones'); abrirCampana('v1'); abrirFormVal('0'); setValTipoUsuario('monofasico'); });
    await page.locator('#vf-ref-vs').selectOption('120');
    await page.locator('#vf-cp-vs').selectOption('120');
    await expect(page.locator('#vf-ref-vs')).toHaveValue('120');
  });

  // Elegir "Otro" solo muestra el campo manual, sin redibujar: lo ya escrito no se borra
  for (const [tipo, lectura] of [['monofasico', 'vf-ref-lec'], ['bifasico', 'vf-ref-lec1'], ['trifasico', 'vf-ref-lec1']]) {
    test(`voltaje secundario "Otro" no borra lo escrito (${tipo})`, async ({ page }) => {
      app = await abrirApp(page);
      await cerrarAlerta(page);
      await app.ejecutar(tipo => { switchTab('validaciones'); abrirCampana('v1'); abrirFormVal('0'); setValTipoUsuario(tipo); }, tipo);
      await expect(page.locator('#vf-ref-vs-otro')).toBeHidden();
      await page.locator('#' + lectura).fill('236');
      await page.locator('#vf-ref-vs').selectOption('otro');
      await page.locator('#vf-ref-vs-otro').fill('250');
      await page.locator('#vf-cp-vs').selectOption('otro');
      await expect(page.locator('#' + lectura)).toHaveValue('236');
      await expect(page.locator('#vf-ref-vs')).toHaveValue('otro');
      await expect(page.locator('#vf-ref-vs-otro')).toHaveValue('250');
      await expect(page.locator('#vf-cp-vs-otro')).toBeVisible();
      // volver a un voltaje normal oculta el campo manual
      await page.locator('#vf-cp-vs').selectOption('240');
      await expect(page.locator('#vf-cp-vs-otro')).toBeHidden();
    });
  }
});

test.describe('Despachos y mapa', () => {
  test('sub-vistas de despachos', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await nav(page, 'Despachos');
    await app.ejecutar(() => setCargaSubView('historial'));
    await expect(app$(page)).toContainText('Historial de despachos');
    await expect(app$(page)).toContainText('20/09/2026');
    await app.ejecutar(() => setCargaSubView('accesorios'));
    await app.ejecutar(() => setCargaSubView('subir'));
    await expect(app$(page)).toContainText('Subir archivo');
  });

  test('mapa con filtros por área', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await nav(page, 'Mapa');
    await expect(page.locator('#app iframe')).toHaveCount(1);
    await app.ejecutar(() => setMapaFiltro('CPT BT'));
    await app.ejecutar(() => setMapaFiltro('TODOS'));
    await expect(app$(page)).toContainText('3');
  });
});

test.describe('Modo mantenimiento', () => {
  test('bloquea a los usuarios que no son admin', async ({ page }) => {
    app = await abrirApp(page, { usuario: 'Bryan Francia', datos: { ...fixture, config: { mantenimiento: true } } });
    await expect(app$(page)).toContainText('En mantenimiento');
  });

  test('el admin lo activa desde el dashboard', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await app.ejecutar(() => toggleMantenimiento());
    expect(await app.escrituras()).toContainEqual(['set', 'config/mantenimiento', true]);
  });
});

test.describe('Envío a revisión (Cucumacayán)', () => {
  // Guarda el HTML de cada documento que la app abre (memos) para poder revisarlo
  async function capturarDocs(page) {
    await page.evaluate(() => {
      window.__docs = [];
      const crear = URL.createObjectURL.bind(URL);
      URL.createObjectURL = b => { b.text().then(t => window.__docs.push(t)); return crear(b); };
    });
    return () => page.evaluate(() => window.__docs);
  }

  test.beforeEach(async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await nav(page, 'Inventario');
  });

  test('prellena con las fallas del último retiro, genera el memo y registra la entrega', async ({ page }) => {
    const docs = await capturarDocs(page);
    await app.ejecutar(() => openEqDetalle('e4'));
    await page.getByText('Enviar a revisión (Cucumacayán)').click();
    await expect(page.locator('#rev-descripcion')).toHaveValue(/LED intermitente, No agarra WiFi\. Se apaga solo/);
    await expect(page.locator('#rev-descripcion')).toHaveValue(/caso C-004, Apopa/);
    await expect(page.locator('#rev-fecha')).toHaveValue('2026-07-21');

    await page.locator('#rev-motivo').fill('Diagnóstico de batería');
    await page.locator('#rev-descripcion').fill('No enciende <sin batería>');
    await page.getByText('Enviar y generar memo').click();

    // Memo
    await expect.poll(async () => (await docs()).length).toBe(1);
    const memo = (await docs())[0];
    expect(memo).toContain('ENVÍO A REVISIÓN');
    expect(memo).toContain('SN-103');
    expect(memo).toContain('Diagnóstico de batería');
    expect(memo).toContain('No enciende &lt;sin batería&gt;'); // el texto del usuario se escapa
    expect(memo).toContain('21/07/2026'); // fecha del incidente
    expect(memo).toContain('Subestación Cucumacayán');
    expect(memo).toContain('David García');

    // Trazabilidad en Firebase
    const [op, ruta, datos] = (await app.escrituras()).at(-1);
    expect([op, ruta]).toEqual(['update', 'equipos/e4']);
    expect(datos).toMatchObject({ sede: 'Subestación Cucumacayán', condicion: 'mantenimiento' });
    expect(datos.historialCondicion.at(-1)).toMatchObject({ condicionAnterior: 'malo', condicionNueva: 'mantenimiento' });
    expect(datos.historialMantenimiento.at(-1)).toMatchObject({
      resultado: 'pendiente', descripcion: 'No enciende <sin batería>', observaciones: 'Diagnóstico de batería',
      envioRevision: { fechaIncidente: '2026-07-21', sedeOrigen: 'Plantel Central', entregadoPor: 'David García' },
    });

    // Ya no ofrece enviarlo otra vez, y el memo se puede reimprimir desde su ficha
    await expect(app$(page)).not.toContainText('Enviar a revisión (Cucumacayán)');
    await app.ejecutar(() => setEqDetalleTab('mantenimiento'));
    await page.getByText('Memo de envío').click();
    await expect.poll(async () => (await docs()).length).toBe(2);
    expect((await docs())[1]).toContain('No enciende &lt;sin batería&gt;');
  });

  test('sin historial queda en blanco y exige describir la falla', async ({ page }) => {
    await app.ejecutar(() => openEqDetalle('e6'));
    await page.getByText('Enviar a revisión (Cucumacayán)').click();
    await expect(page.locator('#rev-descripcion')).toHaveValue('');
    await expect(page.locator('#rev-fecha')).toHaveValue('2026-09-23');
    await page.getByText('Enviar y generar memo').click();
    await expect(page.locator('#toast')).toHaveText('Describe qué le pasó al equipo');
    expect(await app.escrituras()).toEqual([]);
  });

  test('no se ofrece para equipos instalados en campo', async ({ page }) => {
    await app.ejecutar(() => openEqDetalle('e1'));
    await expect(app$(page)).toContainText('SN-100');
    await expect(app$(page)).not.toContainText('Enviar a revisión (Cucumacayán)');
  });
});

test.describe('Campos y Servicios', () => {
  test.beforeEach(async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
  });

  test('el retiro individual regresa el equipo a la Cucumacayán', async ({ page }) => {
    await app.ejecutar(() => { switchTab('instalaciones'); openRetiroModal('r5'); });
    await page.locator(`div[onclick="toggleSinProblema()"]`).click();
    await page.getByText('Sí, ya descargué').click();
    await page.getByText('Confirmar retiro').click();
    await expect.poll(async () => (await app.escrituras()).length).toBe(2);
    const [, equipo] = await app.escrituras();
    expect(equipo.slice(0, 2)).toEqual(['update', 'equipos/e5']);
    expect(equipo[2].sede).toBe('Subestación Cucumacayán');
  });

  test('el retiro masivo de un despacho de CPT MT regresa los equipos a la Cucumacayán', async ({ page }) => {
    await app.ejecutar(() => retiroMasivo('hc1'));
    expect(await app.escrituras()).toContainEqual(['update', 'equipos/e5', { sede: 'Subestación Cucumacayán' }]);
  });

  test('memo de equipo dañado: prellenado, tres firmas y trazabilidad', async ({ page }) => {
    await page.evaluate(() => {
      window.__docs = [];
      const crear = URL.createObjectURL.bind(URL);
      URL.createObjectURL = b => { b.text().then(t => window.__docs.push(t)); return crear(b); };
    });
    const docs = () => page.evaluate(() => window.__docs);
    await app.ejecutar(() => { switchTab('instalaciones'); setInstTab('campos'); openDetail('r6'); });
    await page.getByText('Memo de equipo dañado').click();
    await expect(page.locator('#danio-descripcion')).toHaveValue('No enciende / Sin señales de vida. Carcasa quebrada');
    await expect(page.locator('#danio-fecha')).toHaveValue('2026-09-12');
    await expect(page.locator(`div[onclick="setDanioField('condicion','fuera')"]`)).toHaveCSS('border-top-color', 'rgb(220, 38, 38)');
    await page.locator('#danio-tecnico').fill('Juan Pérez');
    await page.getByText('Generar memo').click();

    await expect.poll(async () => (await docs()).length).toBe(1);
    const memo = (await docs())[0];
    for (const texto of ['EQUIPO DAÑADO EN CAMPO', 'SN-106', '#C-006', 'Zaragoza', 'Carcasa quebrada', '12/09/2026', 'Fuera de servicio', 'Juan Pérez', 'David García']) {
      expect(memo, texto).toContain(texto);
    }
    expect(memo.match(/class="firma-label"/g)).toHaveLength(3);
    expect(memo).toContain('<div class="firma-label">Subestación Cucumacayán</div>');
    expect(memo).toContain('<div class="firma-label">Campos y Servicios</div>');

    const escrituras = await app.escrituras();
    const inst = escrituras.find(([, ruta]) => ruta === 'analizadores/r6');
    expect(inst[2].memoDanio).toMatchObject({ caso: 'C-006', condicion: 'fuera', tecnicoCampos: 'Juan Pérez', fechaDanio: '2026-09-12' });
    const eq = escrituras.find(([, ruta]) => ruta === 'equipos/e7');
    expect(eq[2]).toMatchObject({ sede: 'Subestación Cucumacayán', condicion: 'fuera' });
    expect(eq[2].historialCondicion.at(-1)).toMatchObject({ condicionAnterior: 'bueno', condicionNueva: 'fuera' });

    // Queda guardado y se puede reimprimir
    await page.getByText('Ver memo de equipo dañado').click();
    await expect.poll(async () => (await docs()).length).toBe(2);
    expect((await docs())[1]).toContain('Carcasa quebrada');
  });

  test('no aparece en instalaciones de CPT MT', async ({ page }) => {
    await app.ejecutar(() => { switchTab('instalaciones'); openDetail('r1'); });
    await expect(app$(page)).toContainText('#C-001');
    await expect(app$(page)).not.toContainText('Memo de equipo dañado');
  });
});
