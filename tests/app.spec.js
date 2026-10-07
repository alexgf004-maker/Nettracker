// Pruebas automáticas de NetTracker: recorren la app con datos de ejemplo
// (tests/fixture.js) y una Firebase falsa en memoria. Ver tests/README.md
const { test, expect } = require('@playwright/test');
const { abrirApp, cerrarAlerta, fixture } = require('./helpers');

const app$ = page => page.locator('#app');
// Navega con el menú; en celular las secciones que no caben están en "Más"
async function nav(page, texto) {
  const boton = page.locator('nav.bottom-nav button:visible', { hasText: texto });
  if (await boton.count()) return boton.first().click();
  await page.locator('nav.bottom-nav button', { hasText: 'Más' }).click();
  await page.locator('.mas-item', { hasText: texto }).click();
}

// Cada prueba termina verificando que no hubo errores de JavaScript
let app;
test.afterEach(async () => {
  expect(app.errores, 'errores de JavaScript en la página').toEqual([]);
});

test.describe('Perfiles', () => {
  test('se entra eligiendo el perfil, sin PIN', async ({ page }) => {
    app = await abrirApp(page, { usuario: null });
    await expect(app$(page)).toContainText('¿Quién eres?');
    await page.getByText('David García').first().click();
    await expect(app$(page)).toContainText('Hola, David');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cpt_session')))).toEqual({ nombre: 'David García' });
  });

  test('cambiar de perfil vuelve a la pantalla de perfiles', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await page.locator('[title="Cambiar de perfil"]').click();
    await expect(app$(page)).toContainText('¿Quién eres?');
    await page.getByText('Vicente Ramos').click();
    await expect(app$(page)).toContainText('Hola, Vicente');
  });
});

test.describe('Navegación', () => {
  test('todas las pestañas cargan sin errores', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await expect(app$(page)).toContainText('Pendientes');
    for (const [pestana, texto] of [['Campañas', 'Agosto 2026'], ['Reclamos', 'USUARIO DE PRUEBA'], ['Requerimientos', 'C-001'], ['Seguimiento FT', 'No hay casos fuera de tolerancia']]) {
      await nav(page, pestana);
      await expect(app$(page)).toContainText(texto);
    }
    await nav(page, 'Instalaciones');
    await expect(app$(page)).toContainText('SN-100');
    await nav(page, 'Equipos');
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

test.describe('Inicio', () => {
  test('muestra los pendientes del área agrupados por urgencia', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    const grupo = titulo => page.locator('.grupo', { has: page.locator('.grupo-titulo', { hasText: titulo }) });
    await expect(grupo('Vencido')).toContainText('Cargar la campaña Agosto 2026 en el sistema CPT DELSUR');
    await expect(grupo('Próximos días')).toContainText('Entregar informe del reclamo RE192026456');
    await expect(grupo('Próximos días')).toContainText('Retirar SN-101');
    await expect(grupo('Por hacer')).toContainText('Descargar medición de SN-201');
    // SN-102 es de CPT BT: solo aparece al ver todas las áreas
    await expect(app$(page)).not.toContainText('Retirar SN-102');
    await page.getByRole('button', { name: 'Todas las áreas' }).click();
    await expect(grupo('Vencido')).toContainText('Retirar SN-102');
    await expect(app$(page)).toContainText('Validaciones de TAP (1 campañas)');
  });

  test('en celular un nombre largo no hace la página más ancha que la pantalla', async ({ page }) => {
    const datos = JSON.parse(JSON.stringify(fixture));
    datos.analizadores.largo = { serie: 'SN-900', caso: 'CR1O2026299', lugar: 'INMOBILIARIA DE PRUEBA SOCIEDAD ANONIMA DE CAPITAL VARIABLE CON UN NOMBRE MUY LARGO', fechaInstalacion: '2026-09-18', fechaRetiro: '2026-09-25', areaInstalacion: 'CPT MT' };
    app = await abrirApp(page, { datos });
    await expect(page.locator('.pendiente', { hasText: 'Retirar SN-900' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(400);
  });

  test('contar pendientes solo desde una fecha deja fuera lo viejo', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await expect(page.locator('.pendiente')).toHaveCount(4);
    await page.getByRole('button', { name: 'Contar solo desde hoy' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['set', 'config/seguimientoDesde', '2026-09-23']);
    // Quedan solo los que vencen desde hoy: la campaña de agosto, la descarga y el informe eran de antes
    await expect(page.locator('.pendiente')).toHaveCount(1);
    await expect(page.locator('.pendiente')).toContainText('Retirar SN-101');
    await expect(page.locator('.desde')).toContainText('Cuenta desde el 23/09/2026');
    await page.getByRole('button', { name: 'Cambiar' }).click();
    await page.getByRole('button', { name: 'Contar todo' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['set', 'config/seguimientoDesde', null]);
    await expect(page.locator('.pendiente')).toHaveCount(4);
  });

  test('un pendiente lleva a lo que hay que hacer', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await page.locator('.pendiente', { hasText: 'Retirar SN-101' }).click();
    await expect(app$(page)).toContainText('Santa Tecla');
    await app.ejecutar(() => goBack());
    await expect(app$(page)).toContainText('Pendientes');
    await page.locator('.pendiente', { hasText: 'Cargar la campaña' }).click();
    await expect(app$(page)).toContainText('Marcar como cargada en CPT DELSUR');
  });

  test('el botón de reporte abre el reporte mensual', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await page.getByRole('button', { name: 'Reporte mensual' }).click();
    await expect(app$(page)).toContainText('Generar Excel');
  });
});

test.describe('Trabajo', () => {
  test.beforeEach(async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
  });

  test('campañas agrupadas por mes; marcar la entrega quita el aviso', async ({ page }) => {
    await nav(page, 'Campañas');
    await expect(page.locator('.camp-card', { hasText: 'Septiembre 2026' })).toContainText('faltan 17 días');
    await expect(page.locator('.camp-card', { hasText: 'Agosto 2026' })).toContainText('venció hace 13 días');
    await page.locator('.camp-card', { hasText: 'Agosto 2026' }).click();
    await expect(app$(page)).toContainText('DA182026201');
    await expect(app$(page)).toContainText('1 con descarga pendiente');
    await page.getByRole('button', { name: 'Marcar como cargada en CPT DELSUR' }).click();
    expect(await app.escrituras()).toContainEqual(['set', 'campanas/2026-08_CPT-MT/entrega', { fecha: '2026-09-23', por: 'David García' }]);
    await expect(app$(page)).toContainText('Entregada el 23/09/2026 · David García');
    await nav(page, 'Inicio');
    await expect(app$(page)).not.toContainText('Cargar la campaña Agosto 2026');
  });

  test('desde una medición de la campaña, volver regresa a la campaña', async ({ page }) => {
    await app.ejecutar(() => abrirCampanaTrabajo('2026-08_CPT-MT'));
    await page.locator('.fila', { hasText: 'DA182026201' }).click();
    await expect(app$(page)).toContainText('Quezaltepeque');
    await app.ejecutar(() => goBack());
    await expect(app$(page)).toContainText('Marcar como cargada en CPT DELSUR');
  });

  test('reclamos: informe a 8 días del retiro y marcarlo entregado', async ({ page }) => {
    await nav(page, 'Reclamos');
    await page.locator('.exp-card', { hasText: 'RE192026456' }).click();
    await expect(page.locator('.exp-medicion')).toContainText('Límite (8 días del retiro)');
    await expect(page.locator('.exp-medicion')).toContainText('24/09/2026');
    await page.getByRole('button', { name: 'Informe entregado' }).click();
    expect(await app.escrituras()).toContainEqual(['update', 'analizadores/r9', { informeEntregado: { fecha: '2026-09-23', por: 'David García' } }]);
    await page.getByRole('button', { name: 'Quitar marca de informe' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['update', 'analizadores/r9', { informeEntregado: null }]);
  });

  test('requerimientos: la fecha de entrega genera el aviso en Inicio', async ({ page }) => {
    await nav(page, 'Requerimientos');
    await page.locator('.fila', { hasText: 'C-001' }).locator('input[type=date]').fill('2026-09-25');
    await expect.poll(async () => (await app.escrituras()).at(-1)).toEqual(['update', 'analizadores/r1', { entregaLimite: '2026-09-25' }]);
    await nav(page, 'Inicio');
    await expect(page.locator('.pendiente', { hasText: 'Entregar requerimiento C-001' })).toContainText('faltan 2 días');
    await nav(page, 'Requerimientos');
    await page.locator('.fila', { hasText: 'C-001' }).getByRole('button', { name: 'Entregado' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['update', 'analizadores/r1', { entregaRealizada: { fecha: '2026-09-23', por: 'David García' } }]);
  });
});

test.describe('Reglas del trabajo', () => {
  // Funciones puras de js/domain: se prueban importándolas en la página
  test('clasificación de casos y plazos', async ({ page }) => {
    app = await abrirApp(page);
    const r = await page.evaluate(async () => {
      const t = await import('/js/domain/trabajo.js');
      return {
        tipos: ['CR112026201', 'da1n2026031o00', '[DF3D2025101]', 'RE-2026-1', 'C-001', ''].map(t.tipoDeTrabajo),
        periodos: ['CR112026201', 'DA1N2026031O00', 'DF3D2025101', 'CRX'].map(t.periodoCampana),
        entregaDic: t.fechaEntregaCampana({ anio: 2026, mes: 12 }),
        informe: t.fechaInformeReclamo('2026-09-28'),
        urgencias: ['2026-09-22', '2026-09-23', '2026-09-26', '2026-09-27', null].map(f => t.urgencia(f, '2026-09-23')),
        areaCyS: t.areaDeInstalacion({ areaInstalacion: 'Campos y Servicios', areaBeneficiaria: 'CPT BT' }),
        hoy: t.hoyLocal(new Date(2026, 8, 23, 23, 30)),
      };
    });
    expect(r.tipos).toEqual(['campana', 'campana', 'campana', 'reclamo', 'requerimiento', 'requerimiento']);
    expect(r.periodos).toEqual([{ mes: 1, anio: 2026 }, { mes: 11, anio: 2026 }, { mes: 12, anio: 2025 }, null]);
    expect(r.entregaDic).toBe('2027-01-10');
    expect(r.informe).toBe('2026-10-06');
    expect(r.urgencias).toEqual(['vencido', 'hoy', 'proximo', 'ok', 'ok']);
    expect(r.areaCyS).toBe('CPT BT');
    expect(r.hoy).toBe('2026-09-23');
  });
});

test.describe('Instalaciones', () => {
  test.beforeEach(async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await nav(page, 'Instalaciones');
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
    await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
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
    await nav(page, 'Equipos');
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
    await nav(page, 'Equipos');
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

  test('la devolución de Campos y Servicios a CPT MT deja el equipo en la Cucumacayán', async ({ page }) => {
    await app.ejecutar(() => { switchTab('inventario'); openEqDetalle('e5'); });
    await page.getByText('Registrar devolución').click();
    await expect(app$(page)).toContainText('Sede destino: Subestación Cucumacayán');
    await app.ejecutar(() => doMovimiento());
    const [op, ruta, datos] = (await app.escrituras()).at(-1);
    expect([op, ruta]).toEqual(['update', 'equipos/e5']);
    expect(datos).toMatchObject({ prestado: false, sede: 'Subestación Cucumacayán' });
    expect(datos.movimientos.at(-1)).toMatchObject({ tipo: 'devolucion', de: 'Campos y Servicios', a: 'CPT MT' });
  });

  test('eliminar el préstamo a Campos y Servicios devuelve el equipo a la Cucumacayán', async ({ page }) => {
    await app.ejecutar(() => eliminarMovimiento('e5', 0));
    const [, ruta, datos] = (await app.escrituras()).at(-1);
    expect(ruta).toBe('equipos/e5');
    expect(datos).toMatchObject({ prestado: false, sede: 'Subestación Cucumacayán' });
  });

  test('una devolución normal a CPT MT sigue yendo a Plantel Central', async ({ page }) => {
    await app.ejecutar(() => { switchTab('inventario'); registrarDevolucion('e4'); setPrestamoField('de', 'CPT BT'); setPrestamoField('a', 'CPT MT'); });
    await expect(app$(page)).toContainText('Sede destino: Plantel Central');
    await app.ejecutar(() => doMovimiento());
    expect((await app.escrituras()).at(-1)[2].sede).toBe('Plantel Central');
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
    for (const texto of ['EQUIPO DAÑADO EN CAMPO', 'SN-106', '#C-006', 'Zaragoza', 'Carcasa quebrada', 'Fuera de servicio', 'Juan Pérez', 'David García']) {
      expect(memo, texto).toContain(texto);
    }
    // Retiro programado (10/09) y fecha del daño (retiro real, 12/09)
    expect(memo).toMatch(/Retiro programado<\/div><div class="info-value normal">10\/09\/2026/);
    expect(memo).toMatch(/Fecha del daño<\/div><div class="info-value normal">12\/09\/2026/);
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

test.describe('Editar memos', () => {
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
  });

  test('memo de equipo dañado: se corrige y el cambio de condición llega al equipo', async ({ page }) => {
    const docs = await capturarDocs(page);
    await app.ejecutar(() => { switchTab('instalaciones'); setInstTab('campos'); openDetail('r6'); });
    await page.getByText('Memo de equipo dañado').click();
    await page.getByText('Generar memo').click();
    await expect(page.getByText('Ver memo de equipo dañado')).toBeVisible();

    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(page.getByText('Editar memo de equipo dañado')).toBeVisible();
    await expect(page.locator('#danio-descripcion')).toHaveValue('No enciende / Sin señales de vida. Carcasa quebrada');
    await page.locator('#danio-descripcion').fill('Pantalla rota');
    await page.locator(`div[onclick="setDanioField('condicion','detalles')"]`).click();
    await page.getByText('Guardar cambios').click();

    await expect.poll(async () => (await docs()).length).toBe(2);
    const memo = (await docs())[1];
    expect(memo).toContain('Pantalla rota');
    expect(memo).toContain('Con detalles');
    expect(memo).toContain('Última edición: 23/09/2026 por David García');

    const escrituras = await app.escrituras();
    const memos = escrituras.filter(([, ruta]) => ruta === 'analizadores/r6').map(w => w[2].memoDanio);
    expect(memos).toHaveLength(2);
    expect(memos[1]).toMatchObject({ descripcion: 'Pantalla rota', condicion: 'detalles', editadoPor: 'David García', caso: 'C-006' });
    expect(memos[1].fecha).toBe(memos[0].fecha); // conserva la fecha original del memo
    const eq = escrituras.filter(([, ruta]) => ruta === 'equipos/e7').at(-1)[2];
    expect(eq.condicion).toBe('detalles');
    expect(eq.historialCondicion.at(-1)).toMatchObject({ condicionAnterior: 'fuera', condicionNueva: 'detalles' });
    expect(eq.sede).toBeUndefined(); // editar no mueve el equipo
  });

  test('memo de envío a revisión: se corrige sin cambiar sede ni condición', async ({ page }) => {
    const docs = await capturarDocs(page);
    await app.ejecutar(() => { switchTab('inventario'); openEqDetalle('e6'); });
    await page.getByText('Enviar a revisión (Cucumacayán)').click();
    await page.locator('#rev-descripcion').fill('No enciende');
    await page.getByText('Enviar y generar memo').click();
    await app.ejecutar(() => setEqDetalleTab('mantenimiento'));

    await page.getByRole('button', { name: 'Editar', exact: true }).click();
    await expect(page.getByText('Editar envío a revisión')).toBeVisible();
    await expect(page.locator('#rev-descripcion')).toHaveValue('No enciende');
    await page.locator('#rev-descripcion').fill('No enciende y huele a quemado');
    await page.locator('#rev-fecha').fill('2026-09-20');
    await page.getByText('Guardar cambios').click();

    await expect.poll(async () => (await docs()).length).toBe(2);
    expect((await docs())[1]).toContain('No enciende y huele a quemado');
    expect((await docs())[1]).toContain('Última edición: 23/09/2026 por David García');

    const [, ruta, datos] = (await app.escrituras()).at(-1);
    expect(ruta).toBe('equipos/e6');
    expect(Object.keys(datos)).toEqual(['historialMantenimiento']);
    const ficha = datos.historialMantenimiento.at(-1);
    expect(ficha.descripcion).toBe('No enciende y huele a quemado');
    expect(ficha.envioRevision).toMatchObject({ descripcion: 'No enciende y huele a quemado', fechaIncidente: '2026-09-20', editadoPor: 'David García', entregadoPor: 'David García' });
  });
});

test.describe('Vista de PC', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('menú lateral, listas en columnas y modales centrados', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    // El menú queda a la izquierda, en vertical
    const nav = await page.locator('nav.bottom-nav').boundingBox();
    expect(nav.x).toBe(0);
    // En PC se ven todas las secciones, sin "Más"
    await expect(page.locator('.nav-seccion', { hasText: 'Herramientas' })).toBeVisible();
    await expect(page.locator('nav.bottom-nav button', { hasText: 'Mapa' })).toBeVisible();
    await expect(page.locator('nav.bottom-nav button', { hasText: 'Más' })).toBeHidden();
    expect(nav.height).toBeGreaterThan(nav.width);
    // Las tarjetas del inventario se reparten en columnas
    await page.locator('nav.bottom-nav button', { hasText: 'Equipos' }).click();
    const [a, b] = await Promise.all(['SN-105', 'SN-106'].map(s => page.locator('.eq-lista > div', { hasText: s }).boundingBox()));
    expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    // Los modales se muestran como ventana centrada
    await app.ejecutar(() => { openEqDetalle('e6'); openRevisionModal('e6'); });
    const modal = await page.locator('.modal-overlay > div').boundingBox();
    expect(modal.width).toBeLessThanOrEqual(560);
    expect(modal.y).toBeGreaterThan(20);
  });

  test('en celular el menú sigue abajo', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    app = await abrirApp(page);
    await cerrarAlerta(page);
    const nav = await page.locator('nav.bottom-nav').boundingBox();
    expect(nav.y + nav.height).toBeCloseTo(800, 0);
    expect(nav.width).toBe(400);
  });
});

test('el selector de equipo se abre como ventana sobre el formulario', async ({ page }) => {
  app = await abrirApp(page);
  await cerrarAlerta(page);
  await app.ejecutar(() => { switchTab('instalaciones'); newInstall(); openSelector(); });
  await expect(page.locator('.modal-overlay')).toHaveCSS('position', 'fixed');
});

test.describe('Firma de quien genera el memo', () => {
  const conMemos = () => {
    const d = JSON.parse(JSON.stringify(fixture));
    d.analizadores.r6.memoDanio = { fecha: '2026-09-15', hora: '10:00', fechaDanio: '2026-09-12', descripcion: 'No enciende', condicion: 'fuera',
      tecnicoCampos: '', generadoPor: 'David García', areaGenera: 'CPT MT', serie: 'SN-106', modelo: 'PQ-1', caso: 'C-006', lugar: 'Zaragoza', fechaRetiro: '2026-09-10' };
    d.equipos.e6.historialMantenimiento = [{ descripcion: 'No enciende', accion: 'Enviado a revisión', resultado: 'pendiente', fechaInicio: '2026-09-15',
      envioRevision: { fecha: '2026-09-15', hora: '10:00', fechaIncidente: '2026-09-14', motivo: 'Revisión', descripcion: 'No enciende',
        sedeOrigen: 'Plantel Central', condicionAnterior: 'bueno', entregadoPor: 'David García', antecedentes: [] } }];
    return d;
  };
  async function capturarDocs(page) {
    await page.evaluate(() => {
      window.__docs = [];
      const crear = URL.createObjectURL.bind(URL);
      URL.createObjectURL = b => { b.text().then(t => window.__docs.push(t)); return crear(b); };
    });
    return () => page.evaluate(() => window.__docs);
  }

  test('al editar el memo de equipo dañado firma quien lo edita', async ({ page }) => {
    app = await abrirApp(page, { usuario: 'Bryan Francia', datos: conMemos() });
    await cerrarAlerta(page);
    const docs = await capturarDocs(page);
    await app.ejecutar(() => editarDanio('r6'));
    await page.getByText('Guardar cambios').click();
    await expect.poll(async () => (await docs()).length).toBe(1);
    expect((await docs())[0]).toMatch(/firma-label">CPT MT<\/div>\s*<div class="firma-name">Bryan Francia/);
    const memo = (await app.escrituras()).find(([, ruta]) => ruta === 'analizadores/r6')[2].memoDanio;
    expect(memo).toMatchObject({ generadoPor: 'Bryan Francia', areaGenera: 'CPT MT', creadoPor: 'David García', fecha: '2026-09-15' });
  });

  test('al editar el memo de envío a revisión firma quien lo edita', async ({ page }) => {
    app = await abrirApp(page, { usuario: 'Francisco Chulo', datos: conMemos() });
    await cerrarAlerta(page);
    const docs = await capturarDocs(page);
    await app.ejecutar(() => editarRevision('e6', 0));
    await page.getByText('Guardar cambios').click();
    await expect.poll(async () => (await docs()).length).toBe(1);
    expect((await docs())[0]).toMatch(/firma-name">Francisco Chulo<\/div>\s*<div class="firma-sub">CPT BT/);
    const envio = (await app.escrituras()).at(-1)[2].historialMantenimiento[0].envioRevision;
    expect(envio).toMatchObject({ entregadoPor: 'Francisco Chulo', creadoPor: 'David García' });
  });
});

test.describe('Precampaña', () => {
  const XLSX = require('xlsx');
  // Arma un Excel en memoria a partir de filas (arreglo de arreglos)
  const excel = (nombre, filas, hoja = 'Hoja1') => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), hoja);
    return { name: nombre, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) };
  };
  // Excel con varias hojas: { nombreHoja: filas }
  const excelLibro = (nombre, hojas) => {
    const wb = XLSX.utils.book_new();
    Object.entries(hojas).forEach(([hoja, filas]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), hoja));
    return { name: nombre, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) };
  };
  // Mismo formato que los listados del ente: título, periodo y datos debajo de "Número SIGET"
  const listadoEnte = (nombre, titulo, casos) => {
    const filas = Array.from({ length: 10 }, () => []);
    filas[2] = [, , , , , , , 'CAMPAÑA DE CONTROL DEL PRODUCTO TECNICO - DATOS USUARIOS SELECCIONADOS'];
    filas[4] = [, , , , , , , titulo];
    filas[7] = [, , 'DISTRIBUIDORA', , , 'DELSUR', , , , , 'PERIODO', , , 'OCTUBRE- 2026'];
    filas.push([, 'Número SIGET', , 'Id del Usuario', , , , , 'Nombre del  Usuario', , , 'Dirección', , , , , , 'Fecha Colocación', , 'Departamento', 'Municipio']);
    casos.forEach(([codigo, nc, nombre]) => filas.push([, codigo, , nc, , , , , nombre + '  ', , , 'COLONIA X', , , 'CALLE 1', , '12', , , 'LA LIBERTAD', 'SANTA TECLA']));
    return excel(nombre, filas, 'DetaSorteoCPT');
  };
  const LISTADOS = [
    listadoEnte('Listado_MT_CPT_DELSUR_Octubre_2026.xlsx', 'MEDIA TENSION', [['CR1O2026201', '111', 'EMPRESA UNO'], ['CR1O2026202', '222', 'EMPRESA DOS'], ['CR1O2026203', '333', 'EMPRESA TRES']]),
    listadoEnte('Listado_BT_CPT_DELSUR_Octubre_2026.xlsx', 'BAJA TENSION', [['CR1O2026001', '901', 'PERSONA UNO'], ['CR1O2026002', '902', 'PERSONA DOS']]),
    listadoEnte('Listado_DA_CPT_DELSUR_Octubre_2026.xlsx', 'ARMONICO', [['DA1O2026011O00', '222', 'EMPRESA DOS'], ['DA1O2026041O00', '901', 'PERSONA UNO'], ['DA1O2026051O00', '999', 'NADIE']]),
    listadoEnte('Listado_FK_CPT_DELSUR_Octubre_2026.xlsx', 'FLICKER', [['DF1O2026011O00', '333', 'EMPRESA TRES']]),
  ];
  // Campaña ya importada, para probar completar, corregir y exportar
  const caso = (codigo, nc, extra = {}) => ({ codigoEnte: codigo, codigo, tipo: codigo.slice(0, 2), nc, nombre: 'USUARIO ' + nc, direccionEnte: 'COLONIA X, CALLE 1, 12, SANTA TECLA, LA LIBERTAD', ...extra });
  // Guarda el HTML de los documentos que abre la app
  async function capturarDocsPrecampana(page) {
    await page.evaluate(() => {
      window.__docs = [];
      const crear = URL.createObjectURL.bind(URL);
      URL.createObjectURL = b => { b.text().then(t => window.__docs.push(t)); return crear(b); };
    });
    return () => page.evaluate(() => window.__docs);
  }
  const conCampana = () => ({ ...fixture, campanas: { '2026-10_CPT-MT': { anio: 2026, mes: 10, area: 'CPT MT', casos: {
    CR1O2026201: caso('CR1O2026201', '111'), CR1O2026202: caso('CR1O2026202', '222', { ct: 'CT1', manual: { ct: true } }),
    DA1O2026011O00: caso('DA1O2026011O00', '222', { crRelacionado: 'CR1O2026202' }),
  } } } });

  test('importar los listados del ente arma las campañas por área y liga DA/DF a su CR', async ({ page }) => {
    app = await abrirApp(page, { excel: true });
    await cerrarAlerta(page);
    await nav(page, 'Campañas');
    await page.getByRole('button', { name: 'Importar listados del ente' }).click();
    await page.locator('.modal input[type=file]').setInputFiles(LISTADOS);
    const modal = page.locator('.modal');
    await expect(modal).toContainText('Media tensión (CR) · 3 casos');
    await expect(modal).toContainText('Flicker (DF) · 1 casos');
    await expect(modal.locator('.fila', { hasText: 'Octubre 2026 · CPT MT' })).toContainText('3 CR · 1 DA · 1 DF');
    await expect(modal.locator('.fila', { hasText: 'Octubre 2026 · CPT BT' })).toContainText('2 CR · 1 DA');
    await expect(modal).toContainText('DA1O2026051O00: el usuario 999 no está en los listados de CR');
    await page.getByRole('button', { name: 'Guardar campañas' }).click();

    const escrituras = await app.escrituras();
    const mt = escrituras.find(([, ruta]) => ruta === 'campanas/2026-10_CPT-MT')[2];
    expect(mt).toMatchObject({ anio: 2026, mes: 10, area: 'CPT MT', 'casos/CR1O2026201/codigo': 'CR1O2026201', 'casos/CR1O2026201/nc': '111',
      'casos/CR1O2026201/nombre': 'EMPRESA UNO', 'casos/CR1O2026201/direccionEnte': 'COLONIA X, CALLE 1, 12, SANTA TECLA, LA LIBERTAD',
      'casos/DA1O2026011O00/crRelacionado': 'CR1O2026202', 'casos/DF1O2026011O00/tipo': 'DF' });
    expect(mt.importado).toMatchObject({ fecha: '2026-09-23', por: 'David García' });
    const bt = escrituras.find(([, ruta]) => ruta === 'campanas/2026-10_CPT-BT')[2];
    expect(bt['casos/DA1O2026041O00/crRelacionado']).toBe('CR1O2026001');
    await expect(page.locator('.camp-card', { hasText: 'Octubre 2026' })).toContainText('Paso actual: Precampaña');
  });

  test('volver a importar no cambia el código corregido', async ({ page }) => {
    const datos = conCampana();
    datos.campanas['2026-10_CPT-MT'].casos.DA1O2026011O00.codigo = 'DA1O2026013O00';
    app = await abrirApp(page, { excel: true, datos });
    await cerrarAlerta(page);
    await app.ejecutar(() => { switchTab('campanas'); abrirImportListados(); });
    await page.locator('.modal input[type=file]').setInputFiles(LISTADOS);
    await expect(page.locator('.modal')).toContainText('Ya existe');
    await page.getByRole('button', { name: 'Guardar campañas' }).click();
    const mt = (await app.escrituras()).find(([, ruta]) => ruta === 'campanas/2026-10_CPT-MT')[2];
    expect(mt['casos/DA1O2026011O00/codigo']).toBeUndefined();
    expect(mt['casos/CR1O2026203/codigo']).toBe('CR1O2026203'); // caso nuevo
  });

  test('completar con el control de puntos y la base de coordenadas, sin pisar lo corregido a mano', async ({ page }) => {
    app = await abrirApp(page, { excel: true, datos: conCampana() });
    await cerrarAlerta(page);
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('casos'); });
    await expect(page.locator('.tabla-casos')).toContainText('CR1O2026201');
    await expect(page.locator('.tg', { hasText: 'con datos faltantes' })).toHaveText('3 con datos faltantes');

    const control = excel('Puntos_Control_TOTAL.xlsx', [
      ['CONF', 'Punto de Control', 'NC', 'Tipo de punto de control', 'Nivel de Tensión', 'Fecha de Colocación', 'Fecha de Retiro', 'Tipo de Instalacion', 'Tipo de Medicion', 'comprobacion bdth', 'TARIFA', 'URBANIDAD', 'CENTROMTBT', 'POTENCIA INSTALADA', 'AL', 'NOMBRE', 'DIRECCION', 'ENERGIA', 'TENSION', 'MEDIDOR', 'FASES', 'PERIODO', 'X', 'PERIODO', 'NC'],
      [111, 'CR1O2026201', 111, 'B', 'MT', '', '', 'TRIFÁSICO', 'MEDICIONES', '', 212, 'U', 'DS108258', 37.5, 'AL091', 'USUARIO 111', 'COLONIA X, CALLE 1, 12, 0, SANTA TECLA, LA LIBERTAD', 231, 23000, 1453689, 'ABC', '', '', '', 555],
      [222, 'CR1O2026202', 222, 'B', 'MT', '', '', 'MONOFÁSICO', 'MEDICIONES', '', 212, 'R', 'CT999', 10, 'AL013', 'USUARIO 222', 'DIR 222', 1, 13200, 777, 'A'],
      ['Usuario', 'Punto', 111, 'basura', '', '', '', 'BASURA', '', '', '', '#N/A', '#N/A'],
    ], 'LISTADO');
    await page.locator('label', { hasText: 'Completar con control de puntos' }).locator('input').setInputFiles(control);
    await expect.poll(async () => (await app.escrituras()).length).toBe(1);
    const [op, ruta, datos] = (await app.escrituras())[0];
    expect([op, ruta]).toEqual(['update', 'campanas/2026-10_CPT-MT']);
    expect(datos).toMatchObject({ 'casos/CR1O2026201/ct': 'DS108258', 'casos/CR1O2026201/medidor': '1453689', 'casos/CR1O2026201/alimentador': 'AL091-23000',
      'casos/CR1O2026201/urbanidad': 'U', 'casos/CR1O2026201/tipoInstalacion': 'TRIFÁSICO', 'casos/DA1O2026011O00/alimentador': 'AL013-13200' });
    expect(datos['casos/CR1O2026202/ct']).toBeUndefined(); // se corrigió a mano

    // Mismo formato que la base del equipo: IDCLIENTE, COORDX (latitud), COORDY (longitud)
    const coordenadas = excel('coor.xlsx', [['IDCLIENTE', 'COORDX', 'COORDY'], [111, 13.7001, -89.21], [222, 506769.6, 264759.8], [444, 13.5, -89.0]]);
    await page.locator('label', { hasText: 'o desde un archivo' }).locator('input').setInputFiles(coordenadas);
    await expect.poll(async () => (await app.escrituras()).length).toBe(2);
    expect((await app.escrituras())[1][2]).toEqual({ 'casos/CR1O2026201/lat': 13.7001, 'casos/CR1O2026201/lng': -89.21 });
    await expect(page.locator('.tabla-casos tr', { hasText: 'CR1O2026201' })).toContainText('13.70010, -89.21000');
  });

  test('el control de puntos se busca por código: si el ente cambió el NC, completa y avisa', async ({ page }) => {
    const datos = conCampana();
    datos.campanas['2026-10_CPT-MT'].casos.CR1O2026220 = caso('CR1O2026220', '500447201');
    app = await abrirApp(page, { excel: true, datos });
    await cerrarAlerta(page);
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('casos'); });
    const control = excel('Puntos_Control_TOTAL.xlsx', [
      ['CONF', 'Punto de Control', 'NC', 'Tipo de punto de control', 'Nivel de Tensión', 'Fecha de Colocación', 'Fecha de Retiro', 'Tipo de Instalacion', 'Tipo de Medicion', 'comprobacion bdth', 'TARIFA', 'URBANIDAD', 'CENTROMTBT', 'POTENCIA INSTALADA', 'AL', 'NOMBRE', 'DIRECCION', 'ENERGIA', 'TENSION', 'MEDIDOR', 'FASES'],
      [903857600, 'CR1O2026220', 903857600, 'B', 'MT', '', '', 'MONOFÁSICO', 'MEDICIONES', '', 212, 'R', 'CT3708', 50, 'AL181', 'ISRAEL CALDERON', 'CASERIO BARRIO NUEVO', 137, 13200, 1311583, 'C'],
      ['', '', '', ''], ['', 'Usuarios con cambios o de baja'], ['', 'Punto de Control', 'IDCLIENTE', 'nombre', 'PERIODO', 'DIRECCION', 'IDCENTRO'],
      ['', 'CR1O2026220', 500447201, 'ISRAEL CRUZ CALDERON', 45901, 'CASERIO BARRIO NUEVO', 'CT3708'], ['', '', 903857600, 'ISRAEL CALDERON', 46235, 'CASERIO BARRIO NUEVO', 'CT3708'],
    ], 'LISTADO');
    await page.locator('label', { hasText: 'Completar con control de puntos' }).locator('input').setInputFiles(control);
    await expect.poll(async () => (await app.escrituras()).length).toBe(1);
    const escrito = (await app.escrituras())[0][2];
    expect(escrito).toMatchObject({ 'casos/CR1O2026220/ct': 'CT3708', 'casos/CR1O2026220/alimentador': 'AL181-13200', 'casos/CR1O2026220/ncControl': '903857600' });
    expect(escrito['casos/CR1O2026220/tipoInstalacion']).toBe('MONOFÁSICO'); // la tabla de cambios del final no se lee
    expect(escrito['casos/CR1O2026220/nc']).toBeUndefined(); // el NC del ente no se cambia
    await expect(page.locator('.toast')).toContainText('1 con otro NC en el control de puntos');
    await expect(page.locator('.tabla-casos tr', { hasText: 'CR1O2026220' })).toContainText('Control: 903857600');

    // Sin coordenadas para el NC del ente, se usan las del NC del control de puntos
    const coordenadas = excel('coor.xlsx', [['IDCLIENTE', 'COORDX', 'COORDY'], [903857600, 13.974043, -89.340876]]);
    await page.locator('label', { hasText: 'o desde un archivo' }).locator('input').setInputFiles(coordenadas);
    await expect.poll(async () => (await app.escrituras()).length).toBe(2);
    expect((await app.escrituras())[1][2]).toMatchObject({ 'casos/CR1O2026220/lat': 13.974043, 'casos/CR1O2026220/lng': -89.340876 });
  });

  test('corregir el tipo de sistema de un DA cambia su código y queda marcado como manual', async ({ page }) => {
    app = await abrirApp(page, { datos: conCampana() });
    await cerrarAlerta(page);
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('casos'); });
    await page.locator('.tabla-casos tr', { hasText: 'DA1O2026011O00' }).click();
    await page.locator('.modal').getByRole('button', { name: 'Trifásico' }).click();
    await expect(page.locator('.modal-titulo')).toHaveText('DA1O2026013O00');
    await page.locator('#caso-ct').fill('CT555');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    const [, ruta, datos] = (await app.escrituras()).at(-1);
    expect(ruta).toBe('campanas/2026-10_CPT-MT/casos/DA1O2026011O00');
    expect(datos).toMatchObject({ codigo: 'DA1O2026013O00', ct: 'CT555', 'manual/codigo': true, 'manual/ct': true, editadoPor: 'David García' });
    await expect(page.locator('.tabla-casos tr', { hasText: 'DA1O2026013O00' })).toContainText('Ente: DA1O2026011O00');
  });

  test('filtros de la tabla y exportar el listado con las columnas del equipo', async ({ page }) => {
    app = await abrirApp(page, { excel: true, datos: conCampana() });
    await cerrarAlerta(page);
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('casos'); });
    await app.ejecutar(() => setCasosFiltro('DA'));
    await expect(page.locator('.tabla-casos tbody tr')).toHaveCount(1);
    await app.ejecutar(() => { setCasosFiltro('todos'); setCasosBusqueda('usuario 111'); });
    await expect(page.locator('.tabla-casos tbody tr')).toHaveCount(1);
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar listado' }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toBe('Listado_Octubre_2026_CPT_MT.xlsx');
    const wb = XLSX.readFile(await archivo.path());
    const filas = XLSX.utils.sheet_to_json(wb.Sheets.Listado, { header: 1 });
    expect(filas[0]).toEqual(['NC', 'CÓDIGO SIGET', 'NOMBRE', 'DIRECCIÓN', 'CORTE', 'MEDIDOR', 'LATITUD', 'LONGITUD', 'UBICACIÓN', 'ALIMENTADOR', 'URBANIDAD']);
    expect(filas.map(f => f[1])).toEqual(['CÓDIGO SIGET', 'CR1O2026201', 'CR1O2026202', 'DA1O2026011O00']);
    expect(filas[2].slice(0, 5)).toEqual([222, 'CR1O2026202', 'USUARIO 222', 'COLONIA X, CALLE 1, 12, SANTA TECLA, LA LIBERTAD', 'CT1']);
  });

  test('mapa para My Maps: un punto por caso con coordenadas y los datos del listado', async ({ page }) => {
    const datos = conCampana();
    Object.assign(datos.campanas['2026-10_CPT-MT'].casos.CR1O2026201, { lat: 13.67, lng: -89.28, medidor: 'M-1' });
    Object.assign(datos.campanas['2026-10_CPT-MT'].casos.DA1O2026011O00, { lat: 13.7, lng: -89.2 });
    app = await abrirApp(page, { datos });
    await cerrarAlerta(page);
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('casos'); });
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Mapa para My Maps' }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toBe('Mapa_Octubre_2026_CPT_MT.kml');
    const kml = require('fs').readFileSync(await archivo.path(), 'utf8');
    expect(kml.match(/<Placemark>/g)).toHaveLength(2);
    expect(kml.match(/<styleUrl>#caso<\/styleUrl>/g)).toHaveLength(2); // todos del mismo color
    expect(kml).toContain('<name>CR1O2026201</name>');
    expect(kml).toContain('<coordinates>-89.28,13.67,0</coordinates>');
    expect(kml).toContain('<Data name="MEDIDOR"><value>M-1</value></Data>');
    expect(kml).toContain('<Data name="DIRECCIÓN"><value>COLONIA X, CALLE 1, 12, SANTA TECLA, LA LIBERTAD</value></Data>');
    await expect(page.locator('.toast')).toContainText('Sin coordenadas: CR1O2026202');
  });

  test('cartas: piden los datos del firmante la primera vez y se generan con el texto del equipo', async ({ page }) => {
    app = await abrirApp(page, { datos: conCampana() });
    await cerrarAlerta(page);
    const docs = await capturarDocsPrecampana(page);
    await app.ejecutar(() => abrirCampanaTrabajo('2026-10_CPT-MT'));
    await expect(page.locator('.bloque', { hasText: 'Pasos de la precampaña' })).toContainText('0 de 8');
    await page.getByRole('button', { name: 'Generar cartas' }).click();
    await expect(page.locator('.modal-titulo')).toHaveText('Datos de las cartas');
    await page.locator('#cfg-firmante').fill('Persona Firmante');
    await page.locator('#cfg-cargo').fill('Coordinadora');
    await page.locator('#cfg-contratista').fill('CONTRATISTA S.A. DE C.V.');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['set', 'config/cartas', expect.objectContaining({ firmante: 'Persona Firmante', cargo: 'Coordinadora', distribuidora: 'DELSUR', ciudad: 'La Libertad', acuerdo: 'N°38-E-2015' })]);

    await page.getByRole('button', { name: 'Generar cartas' }).click();
    await expect(page.locator('.modal input[type=text], .modal input:not([type])').first()).toHaveValue('la primera semana del mes de octubre del 2026');
    await page.locator('.caso-check', { hasText: 'DA1O2026011O00' }).locator('input').uncheck();
    await page.getByRole('button', { name: 'Generar 2 cartas' }).click();
    await expect.poll(async () => (await docs()).length).toBe(1);
    const html = (await docs())[0];
    expect(html.match(/class="pagina"/g)).toHaveLength(2);
    for (const t of ['Extendida en La Libertad, 23 de septiembre de 2026', 'Código DGEHM', 'CR1O2026201', 'USUARIO 111', 'acuerdo N°38-E-2015',
      'COLONIA X, CALLE 1, 12, SANTA TECLA, LA LIBERTAD', 'la primera semana del mes de octubre del 2026', 'CONTRATISTA S.A. DE C.V.', 'Persona Firmante']) expect(html).toContain(t);
    expect(html).not.toContain('DA1O2026011O00');
    expect((await app.escrituras()).at(-1)).toEqual(['set', 'campanas/2026-10_CPT-MT/precampana/cartas', { fecha: '2026-09-23', por: 'David García', total: 2 }]);
    await expect(page.locator('.paso', { hasText: 'Cartas generadas' })).toContainText('23/09/2026 · David García · 2 casos');
  });

  test('hojas de inspección y pasos manuales de la precampaña', async ({ page }) => {
    const datos = conCampana();
    datos.campanas['2026-10_CPT-MT'].casos.CR1O2026201 = caso('CR1O2026201', '111', { ct: 'DS108258', alimentador: 'AL091-23000', medidor: '1453689', lat: 13.7, lng: -89.2 });
    app = await abrirApp(page, { datos });
    await cerrarAlerta(page);
    const docs = await capturarDocsPrecampana(page);
    await app.ejecutar(() => abrirCampanaTrabajo('2026-10_CPT-MT'));
    await page.getByRole('button', { name: 'Generar hojas' }).click();
    await page.getByRole('button', { name: 'Generar 3 hojas' }).click();
    await expect.poll(async () => (await docs()).length).toBe(1);
    const html = (await docs())[0];
    expect(html.match(/class="pagina"/g)).toHaveLength(3);
    for (const t of ['Hoja de inspección', 'DS108258', 'AL091-23000', '1453689', '13.7, -89.2', 'Medición auxiliar', 'Multiplicador ECAMEC', 'Parámetro 17:', 'Carta entregada a:']) expect(html).toContain(t);

    await page.locator('.paso', { hasText: 'Firma de las cartas' }).getByRole('button', { name: 'Marcar' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['set', 'campanas/2026-10_CPT-MT/precampana/firma', { fecha: '2026-09-23', por: 'David García' }]);
    await expect(page.locator('.bloque', { hasText: 'Pasos de la precampaña' })).toContainText('2 de 8');
    await page.locator('.paso', { hasText: 'Firma de las cartas' }).getByRole('button', { name: 'Deshacer' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['remove', 'campanas/2026-10_CPT-MT/precampana/firma']);
  });

  test('multiplicadores: estado, cálculo con las fórmulas del Excel y resumen', async ({ page }) => {
    app = await abrirApp(page, { excel: true, datos: conCampana() });
    await cerrarAlerta(page);
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('multiplicadores'); });
    await expect(page.locator('.aviso')).toContainText('0 de 38 CR obligatorios listos para medir');
    await page.locator('.tabla-casos tr', { hasText: 'CR1O2026201' }).click();
    const modal = page.locator('.modal');
    await modal.locator('select').nth(0).selectOption('Realizado');
    await modal.locator('select').nth(1).selectOption('Estrella');
    await modal.locator('select').nth(2).selectOption('3');
    await page.locator('#mult-tensionTap').fill('13200');
    await page.locator('#mult-tensionBT').fill('240');
    await page.locator('#mult-xMedidor').fill('80');
    await page.locator('#mult-vab').fill('241');
    await expect(page.locator('#mult-calculo')).toContainText('13200/240');
    await expect(page.locator('#mult-calculo')).toContainText('55');
    await expect(page.locator('#mult-calculo')).toContainText('400/5');
    await expect(page.locator('#mult-calculo')).toContainText('ab: 13255');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['set', 'campanas/2026-10_CPT-MT/casos/CR1O2026201/mult',
      { estado: 'Realizado', configuracion: 'Estrella', tap: '3', tensionTap: 13200, tensionBT: 240, xMedidor: 80, vab: 241, editadoPor: 'David García', fecha: '2026-09-23' }]);
    await expect(page.locator('.tile', { hasText: 'Listos para medir' })).toContainText('1');
    await expect(page.locator('.aviso')).toContainText('1 de 38 CR obligatorios');

    // Medición primaria: TI = (X/120)·5/5
    await page.locator('.tabla-casos tr', { hasText: 'CR1O2026202' }).click();
    await modal.locator('select').nth(2).selectOption('MP');
    await page.locator('#mult-xMedidor').fill('240');
    await expect(page.locator('#mult-calculo')).toContainText('10/5');
    await page.locator('#mult-xMedidor').fill('1');
    await modal.locator('select').nth(2).selectOption('2');
    await expect(page.locator('#mult-calculo')).toContainText('1/1');
    await app.ejecutar(() => cerrarMultiplicador());

    // Solo los DF pueden quedar como "Conexión no posible"
    await page.locator('.tabla-casos tr', { hasText: 'DA1O2026011O00' }).click();
    await expect(modal.locator('select').nth(0).locator('option', { hasText: 'Conexión no posible' })).toHaveCount(0);
    await app.ejecutar(() => cerrarMultiplicador());

    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar multiplicadores' }).click();
    const wb = XLSX.readFile(await (await descarga).path());
    const filas = XLSX.utils.sheet_to_json(wb.Sheets.Multiplicadores, { header: 1 });
    expect(filas[0].slice(0, 13)).toEqual(['ESTADO', 'Código SIGET', 'NC', 'Alimentador', 'Configuración', 'Posición de TAP', 'Nivel de tensión según TAP (KV)', 'Nivel de Baja Tensión (V)', 'Multiplicador ECAMEC', 'Multiplicador DRANETZ', 'X medidor', 'TI', 'Testblock']);
    expect(filas[1].slice(0, 12)).toEqual(['Realizado', 'CR1O2026201', 111, '', 'Estrella', '3', 13200, 240, '13200/240', 55, 80, '400/5']);
  });

  test('multiplicadores: importar un Excel ya hecho con sus fechas y equipos, con vista previa', async ({ page }) => {
    const datos = conCampana();
    datos.campanas['2026-10_CPT-MT'].casos.CR1O2026202.mult = { estado: 'Revisar', notas: 'llamar antes' };
    app = await abrirApp(page, { excel: true, datos });
    await cerrarAlerta(page);
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('multiplicadores'); });
    const enc = ['ESTADO', 'Código SIGET', 'NC', 'Alimentador', 'Configuración ', 'Posición de TAP', 'Nivel de tensión según TAP (KV)', 'Nivel de Baja Tensión (V)',
      'Multiplicador ECAMEC', 'Multiplicador DRANETZ', 'X medidor', 'TI', 'Testblock', 'Fecha de instalación', 'Fecha de retiro', 'EQUIPO', 'ELEMENTOS', '', '', '', 'Vac',
      'Proyección primario ab', 'Proyección primario bc', 'Proyección primario ac', 'Urbanidad'];
    const archivo = excelLibro('Listado_octubre__2026.xlsx', {
      Listado: [['NC', 'CÓDIGO SIGET', 'NOMBRE'], [111, 'CR1O2026201', 'USUARIO 111']],
      Multiplicadores: [enc,
        ['Realizado', 'CR1O2026201', 111, 'AL091-23000', 'Delta', 1, 13860, 240, '13860/240', 57.75, 160, '800/5', 'Sí', '2026-10-01', '2026-10-09', '1350S2402', '', '', '', '', '', 0, 0, 0, 'U'],
        ['Validado con usuario', 'CR1O2026202', 222, 'AL013', 'Monofásico', 'Tapón', 7620, 240, '7620/240', 31.75, 1, '1/1', 'No', 46300, '', '1351S2402', '', '', '', '', '', 0, 0, 0, 'R'],
        ['Validado con usuario', 'DA1O2026013O00', 222, 'AL013', 'Delta', 'Tapón', 23900, 240, '23900/240', 99.58, 120, '600/5', 'Sí', '2026-10-01', '', 0],
        ['Acceso denegado', 'CR1O2026299', 999, '', '', '', '', '', '/', '#DIV/0!', '', '0/5'],
        ['', 'DF1O2026023O00', 333, '', '', '', '', '', '/', '#DIV/0!', '', '0/5'],
      ],
    });
    await page.locator('label', { hasText: 'Importar desde Excel' }).locator('input').setInputFiles(archivo);
    const modal = page.locator('.modal');
    await expect(modal).toContainText('3 casos');
    await expect(modal).toContainText('Ya tenían multiplicador y se reemplaza con el del archivo: CR1O2026202');
    await expect(modal).toContainText('DA1O2026011O00 → DA1O2026013O00');
    await expect(modal).toContainText('1 filas no coinciden con ningún caso importado: CR1O2026299');
    await expect(modal).toContainText('Fecha 101/10/2026 al 09/10/2026 · 2 casos');
    await expect(modal).toContainText('Fecha 205/10/2026 · 1 caso');
    await expect(modal).toContainText('2 casos con equipo asignado');
    await page.getByRole('button', { name: 'Guardar multiplicadores' }).click();
    const [op, ruta, escrito] = (await app.escrituras()).at(-1);
    expect([op, ruta]).toEqual(['update', 'campanas/2026-10_CPT-MT']);
    expect(escrito['casos/CR1O2026201/mult']).toMatchObject({ estado: 'Realizado', configuracion: 'Delta', tap: '1', tensionTap: 13860, tensionBT: 240, xMedidor: 160, testblock: 'Sí', origen: 'excel' });
    expect(escrito['casos/CR1O2026201/mult'].vab).toBeUndefined();
    expect(escrito['casos/CR1O2026202/mult']).toMatchObject({ estado: 'Validado con usuario', tap: 'Tapón', notas: 'llamar antes' });
    expect(escrito['casos/DA1O2026011O00/mult']).toMatchObject({ configuracion: 'Delta', xMedidor: 120 });
    expect(escrito['casos/DA1O2026011O00/codigo']).toBe('DA1O2026013O00');
    // Fechas: cada día de instalación es una Fecha, con el retiro y el equipo del archivo
    expect(escrito).toMatchObject({ 'fechas/1/instalacion': '2026-10-01', 'fechas/1/retiro': '2026-10-09', 'fechas/2/instalacion': '2026-10-05',
      'casos/CR1O2026201/programa/fecha': '1', 'casos/CR1O2026201/programa/equipo': '1350S2402', 'casos/CR1O2026202/programa/fecha': '2',
      'casos/CR1O2026202/programa/equipo': '1351S2402', 'casos/DA1O2026011O00/programa/fecha': '1' });
    expect(escrito['fechas/2/retiro']).toBeUndefined();
    expect(escrito['casos/DA1O2026011O00/programa/equipo']).toBeUndefined();
    await expect(page.locator('.toast')).toContainText('Multiplicadores importados · 3 casos');
  });

  test('multiplicadores: usar el histórico del mismo usuario de una campaña anterior', async ({ page }) => {
    const datos = conCampana();
    datos.campanas['2026-09_CPT-MT'] = { anio: 2026, mes: 9, area: 'CPT MT', casos: { CR192026210: caso('CR192026210', '111', { mult: { estado: 'Realizado', configuracion: 'Delta', tap: '2', tensionTap: 23900, tensionBT: 480, xMedidor: 40, testblock: 'Sí' } }) } };
    app = await abrirApp(page, { datos });
    await cerrarAlerta(page);
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('multiplicadores'); abrirMultiplicador('2026-10_CPT-MT', 'CR1O2026201'); });
    await expect(page.locator('.modal .aviso-azul')).toContainText('Histórico de Septiembre 2026 (CR192026210): Delta · TAP 2 · 23900/480 · X 40');
    await page.locator('.modal').getByRole('button', { name: 'Usar' }).click();
    await expect(page.locator('#mult-tensionTap')).toHaveValue('23900');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    expect((await app.escrituras()).at(-1)[2]).toMatchObject({ estado: 'Validado con histórico', configuracion: 'Delta', tap: '2', tensionTap: 23900, tensionBT: 480, xMedidor: 40, testblock: 'Sí', historico: { clave: '2026-09_CPT-MT', codigo: 'CR192026210' } });
  });

  test('fechas: asignar casos y equipos, exportar el Excel de la fecha y enviarla a Despachos', async ({ page }) => {
    const datos = conCampana();
    const mult = { estado: 'Realizado', configuracion: 'Estrella', tap: '3', tensionTap: 13200, tensionBT: 240, xMedidor: 80 };
    Object.assign(datos.campanas['2026-10_CPT-MT'].casos.CR1O2026201, { mult, lat: 13.7, lng: -89.2 });
    Object.assign(datos.campanas['2026-10_CPT-MT'].casos.CR1O2026202, { mult, programa: { fecha: '1', equipo: 'SN-101' } });
    app = await abrirApp(page, { excel: true, datos });
    await cerrarAlerta(page);
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('fechas'); });
    await expect(page.locator('.meta')).toContainText('1 caso listo para medir no tiene fecha');
    await page.getByLabel('Fecha de CR1O2026201').selectOption('1');
    expect((await app.escrituras()).at(-1)).toEqual(['update', 'campanas/2026-10_CPT-MT/casos/CR1O2026201/programa', { fecha: '1' }]);
    await page.getByLabel('Equipo de CR1O2026201').selectOption('SN-105');
    expect((await app.escrituras()).at(-1)).toEqual(['update', 'campanas/2026-10_CPT-MT/casos/CR1O2026201/programa', { equipo: 'SN-105' }]);
    const tarjeta = page.locator('.fecha-card', { hasText: 'Fecha 1' });
    await expect(tarjeta).toContainText('2 casos');
    await expect(tarjeta).toContainText('Faltan las fechas de instalación o de retiro');
    await tarjeta.locator('input[type=date]').nth(0).fill('2026-10-05');
    await tarjeta.locator('input[type=date]').nth(1).fill('2026-10-13');
    await expect.poll(async () => (await app.escrituras()).at(-1)).toEqual(['update', 'campanas/2026-10_CPT-MT/fechas/1', { retiro: '2026-10-13' }]);
    await expect(tarjeta.locator('.boleto-avisos')).toHaveCount(0);

    const descarga = page.waitForEvent('download');
    await tarjeta.getByRole('button', { name: 'Exportar Excel' }).click();
    const archivo = await descarga;
    expect(archivo.suggestedFilename()).toBe('Fecha1_Octubre_2026_CPT_MT.xlsx');
    const filas = XLSX.utils.sheet_to_json(XLSX.readFile(await archivo.path()).Sheets.Fecha1, { header: 1, defval: '', blankrows: true });
    expect(filas[2]).toEqual(['Número SIGET', 'Equipo', 'Nombre del Usuario', 'Id del Usuario', 'Dirección', 'Multiplicador', 'Corrientes', 'Conexion', 'Fecha instalación', 'Fecha retiro', 'Latitud', 'Longitud', 'Accesorios']);
    expect(filas[3]).toEqual(['CR1O2026201', 'SN-105', 'USUARIO 111', '111', 'COLONIA X, CALLE 1, 12, SANTA TECLA, LA LIBERTAD', '13200/240', '400/5', 'Estrella', '2026-10-05', '2026-10-13', 13.7, -89.2, '3 pinzas de corriente, 4 caimanes, 4 alimentadores de voltaje tipo banana']);

    // En Despachos se valida igual que el Excel: SN-101 ya está instalado
    await tarjeta.getByRole('button', { name: 'Enviar a Despachos' }).click();
    await expect(app$(page)).toContainText('CR1O2026201');
    await expect(app$(page)).toContainText('Ya está instalado');
    await app.ejecutar(() => confirmarCarga());
    const push = (await app.escrituras()).find(([op, ruta]) => op === 'push' && ruta === 'analizadores');
    expect(push[2]).toMatchObject({ caso: 'CR1O2026201', serie: 'SN-105', fechaInstalacion: '2026-10-05', fechaRetiro: '2026-10-13', areaInstalacion: 'Campos y Servicios', areaBeneficiaria: 'CPT MT', lat: '13.7' });
  });

  test('importar la programación: cada día de instalación queda como una Fecha', async ({ page }) => {
    const datos = conCampana();
    datos.campanas['2026-10_CPT-MT'].casos.DA1O2026011O00.manual = undefined;
    app = await abrirApp(page, { excel: true, datos });
    await cerrarAlerta(page);
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('fechas'); });
    const programacion = excel('10-Usuarios_seleccionados-octubre-2026.xlsx', [
      ['Número SIGET', 'Id del Usuario', 'Nombre del Usuario   4', 'DIRECCIÓN', 'Municipio  7', 'Fecha instalación', 'Transformador', 'Alimentador   16', 'TIPO  B/R', 'TIPO 2  BT/MT', 'EMPRESA'],
      ['CR1O2026202', 222, 'USUARIO 222', 'X', 'Y', new Date(Date.UTC(2026, 9, 2)), 'CT1', 'AL014', 'B', 'MT', 'C&S'],
      ['DA1O2026013O00', 222, 'USUARIO 222', 'X', 'Y', new Date(Date.UTC(2026, 9, 2)), 'CT1', 'AL014', 'B', 'MT', 'C&S'],
      ['CR1O2026201', 999, 'OTRO DUEÑO', 'X', 'Y', new Date(Date.UTC(2026, 9, 1)), 'CT1', 'AL014', 'B', 'MT', 'C&S'],
      ['CR1O2026999', 555, 'NO EXISTE', 'X', 'Y', new Date(Date.UTC(2026, 9, 1)), 'CT1', 'AL014', 'B', 'MT', 'C&S'],
    ], 'DATA GENERAL');
    await page.locator('label', { hasText: 'Importar programación' }).locator('input').setInputFiles(programacion);
    const modal = page.locator('.modal');
    await expect(modal).toContainText('Fecha 1');
    await expect(modal).toContainText('01/10/2026 · 1 casos');
    await expect(modal).toContainText('02/10/2026 · 2 casos');
    await expect(modal).toContainText('DA1O2026011O00 → DA1O2026013O00');
    await expect(modal).toContainText('CR1O2026201 (999)');
    await expect(modal).toContainText('1 filas no coinciden con ningún caso importado: CR1O2026999');
    await page.getByRole('button', { name: 'Guardar programación' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['update', 'campanas/2026-10_CPT-MT', {
      'fechas/1/instalacion': '2026-10-01', 'fechas/2/instalacion': '2026-10-02',
      'casos/CR1O2026201/programa/fecha': '1', 'casos/CR1O2026202/programa/fecha': '2',
      'casos/DA1O2026011O00/programa/fecha': '2', 'casos/DA1O2026011O00/codigo': 'DA1O2026013O00',
    }]);
  });

  test('resultados: situación de cada caso, anotar el resultado y exportar el cuadro resumen', async ({ page }) => {
    const datos = conCampana();
    datos.analizadores = { ...datos.analizadores, r20: { serie: 'SN-300', caso: 'CR1O2026201', lugar: 'X', fechaInstalacion: '2026-09-10', fechaRetiro: '2026-09-18', areaInstalacion: 'Campos y Servicios', areaBeneficiaria: 'CPT MT', retirado: true, fechaRetiroReal: '2026-09-18', descargaPendiente: false, descargas: [{ fecha: '2026-09-19', medicionOk: true }], fechaRegistro: '2026-09-10' } };
    datos.campanas['2026-10_CPT-MT'].casos.DA1O2026011O00.mult = { estado: 'Acceso denegado' };
    app = await abrirApp(page, { excel: true, datos });
    await cerrarAlerta(page);
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('resultados'); });
    const fila = codigo => page.locator('.tabla-casos tr', { hasText: codigo });
    await expect(fila('CR1O2026201')).toContainText('Descargado');
    await expect(fila('CR1O2026201')).toContainText('Válida');
    await expect(fila('CR1O2026201')).toContainText('según la descarga');
    await expect(fila('CR1O2026202')).toContainText('Sin instalar');
    await expect(fila('DA1O2026011O00')).toContainText('Acceso denegado');
    await expect(page.locator('.meta', { hasText: 'CR obligatorios con medición válida' })).toContainText('1 / 38');

    await fila('CR1O2026202').click();
    await page.locator('.modal').getByRole('button', { name: 'Válida' }).click();
    await page.locator('.modal').getByRole('button', { name: 'Fuera (FT)' }).click();
    await page.locator('#res-febNoPer').fill('7,5');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['set', 'campanas/2026-10_CPT-MT/casos/CR1O2026202/resultado', { medicion: 'valida', tolerancia: 'fuera', febNoPer: 7.5, por: 'David García', fecha: '2026-09-23' }]);
    await expect(fila('CR1O2026202')).toContainText('Fuera de tolerancia');
    await expect(fila('CR1O2026202')).toHaveClass(/fila-ft/); // resalta en rojo
    await expect(page.locator('.ft-bloque')).toContainText('1 caso fuera de tolerancia');
    await expect(page.locator('.ft-bloque')).toContainText('Falta avisar a DELSUR');
    await expect(page.locator('.tile', { hasText: 'Fuera de tolerancia' })).toContainText('1');

    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar cuadro resumen' }).click();
    const hoja = XLSX.readFile(await (await descarga).path(), { cellStyles: true, cellFormula: true }).Sheets['Cuadro resumen'];
    const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', blankrows: true });
    // Mismo formato que el cuadro del equipo: CR a la izquierda y DA/DF a la derecha
    expect(filas[0].slice(0, 3)).toEqual(['CASO', 'ESTADO', 'COMENTARIO']);
    expect(filas[0].slice(7, 10)).toEqual(['CASO', 'ESTADO', 'COMENTARIO']);
    expect(filas.slice(1, 3).map(f => f.slice(0, 2))).toEqual([['CR1O2026201', 'DT'], ['CR1O2026202', 'FT']]);
    expect(filas[1].slice(7, 10)).toEqual(['DA1O2026011O00', 'No instalada', 'Acceso denegado']);
    expect([hoja.B2.s.fgColor.rgb, hoja.B3.s.fgColor.rgb]).toEqual(['00B050', 'FF0000']); // DT verde, FT rojo
    // Conteos con fórmula (se recalculan si editan un estado)
    expect([hoja.E2.v, hoja.F2.v, hoja.F2.f, hoja.E4.v, hoja.F4.v]).toEqual(['DT', 1, 'COUNTIFS(B2:B3,"DT")', 'VÁLIDAS', 2]);
    // Caso hasta el que se carga: todavía faltan 36 CR válidas para llegar a 38
    expect([hoja.E11.v, hoja.G11.v, hoja.E12.v, hoja.F12.v]).toEqual(['Número de mediciones a subir', 38, 'Número de caso hasta que se cargará', 'Faltan 36']);
    expect(hoja.F12.f).toContain('MATCH(G11,K2:K3,0)');
  });

  test('hasta qué medición se sube: se cuentan los CR válidos en orden de código hasta 38', async ({ page }) => {
    app = await abrirApp(page);
    const r = await page.evaluate(async () => {
      const { corteSubida } = await import('/js/domain/resultados.js');
      const fila = (codigo, tipo, medicion) => ({ caso: { codigo, tipo }, resultado: { medicion } });
      const filas = [];
      for (let i = 1; i <= 42; i++) filas.push(fila('CR' + String(i).padStart(3, '0'), 'CR', i === 5 ? 'fallida' : 'valida'));
      filas.splice(3, 0, fila('DA001', 'DA', 'valida')); // los DA no cuentan
      return [corteSubida(filas, 38), corteSubida(filas.slice(0, 10), 38)];
    });
    expect(r[0]).toEqual({ codigo: 'CR039', contados: 38, faltan: 0 }); // CR005 fallida no cuenta
    expect(r[1]).toEqual({ codigo: null, contados: 8, faltan: 30 });
  });

  test('seguimiento FT: plazo de 90 días desde la instalación, aviso, bitácora y cierre con remedición', async ({ page }) => {
    const datos = conCampana();
    datos.analizadores = { ...datos.analizadores,
      r20: { serie: 'SN-300', caso: 'CR1O2026201', lugar: 'X', fechaInstalacion: '2026-07-01', fechaRetiro: '2026-07-09', areaInstalacion: 'Campos y Servicios', areaBeneficiaria: 'CPT MT', retirado: true, fechaRetiroReal: '2026-07-09', fechaRegistro: '2026-07-01' },
      r21: { serie: 'SN-301', caso: 'CR2O2026201', lugar: 'X', fechaInstalacion: '2026-09-20', fechaRetiro: '2026-09-28', areaInstalacion: 'CPT MT', fechaRegistro: '2026-09-20' } };
    datos.campanas['2026-10_CPT-MT'].casos.CR1O2026201.resultado = { medicion: 'valida', tolerancia: 'fuera', febNoPer: 7.5 };
    app = await abrirApp(page, { datos });
    await cerrarAlerta(page);
    // En Inicio: avisar ya y el plazo (01/07 + 90 = 29/09, faltan 6 días: aún no avisa el plazo)
    await expect(page.locator('.pendiente', { hasText: 'Avisar a DELSUR del caso FT CR1O2026201' })).toBeVisible();
    await page.locator('.pendiente', { hasText: 'Avisar a DELSUR' }).click();
    const modal = page.locator('.modal');
    await expect(modal).toContainText('29/09/2026 · día 84');
    await expect(modal).toContainText('Instalación encontrada: CR2O2026201');
    await modal.getByRole('button', { name: 'Marcar aviso enviado por correo' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['set', 'campanas/2026-10_CPT-MT/casos/CR1O2026201/ft/aviso', { fecha: '2026-09-23', por: 'David García' }]);
    await modal.locator('select').selectOption('Transferencia de alimentador');
    expect((await app.escrituras()).at(-1)).toEqual(['update', 'campanas/2026-10_CPT-MT/casos/CR1O2026201/ft', { ruta: 'Transferencia de alimentador' }]);
    await page.locator('#ft-nota').fill('Se transfirió al AL092');
    await modal.getByRole('button', { name: 'Agregar' }).click();
    expect((await app.escrituras()).at(-1)[2].notas).toEqual([{ fecha: '2026-09-23', por: 'David García', texto: 'Se transfirió al AL092' }]);
    await expect(modal).toContainText('Se transfirió al AL092');
    // "No" no cierra; "Sí" cierra
    await modal.getByRole('button', { name: 'No', exact: true }).click();
    await expect(modal).not.toContainText('Caso cerrado');
    await modal.getByRole('button', { name: 'Sí, se normalizó' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['update', 'campanas/2026-10_CPT-MT/casos/CR1O2026201/ft/remedicion', { normalizado: true, registradoPor: 'David García' }]);
    await expect(modal).toContainText('Caso cerrado por remedición normalizada');
    await app.ejecutar(() => cerrarFT());
    await expect(page.locator('.section-title', { hasText: 'Cerrados (1)' })).toBeVisible();
  });

  test('seguimiento FT: pasados los 90 días queda vencido', async ({ page }) => {
    const datos = conCampana();
    datos.analizadores = { ...datos.analizadores, r20: { serie: 'SN-300', caso: 'CR1O2026201', fechaInstalacion: '2026-06-01', fechaRetiro: '2026-06-09', areaInstalacion: 'CPT MT', retirado: true, fechaRetiroReal: '2026-06-09', fechaRegistro: '2026-06-01' } };
    datos.campanas['2026-10_CPT-MT'].casos.CR1O2026201.resultado = { medicion: 'valida', tolerancia: 'fuera' };
    datos.campanas['2026-10_CPT-MT'].casos.CR1O2026201.ft = { aviso: { fecha: '2026-06-20', por: 'David García' } };
    app = await abrirApp(page, { datos });
    await cerrarAlerta(page);
    await expect(page.locator('.grupo', { has: page.locator('.grupo-titulo', { hasText: 'Vencido' }) })).toContainText('Plazo de 90 días del caso FT CR1O2026201');
    await nav(page, 'Seguimiento FT');
    await expect(page.locator('.card', { hasText: 'CR1O2026201' })).toContainText('Más de 90 días: se penalizan los 90 días y la compensación sigue');
  });

  // TXT de prueba con el formato de ECAMEC: fecha + U1/U2/U3 + columnas de relleno
  const hacerTXT = ({ n = 700, paso = 15, columnas = 74, v = () => [13200, 13200, 13200], saltos = [] } = {}) => {
    const enc = ['Fecha/Hora', 'U1 [V]', 'U2 [V]', 'U3 [V]', ...Array.from({ length: columnas - 4 }, (_, i) => 'C' + (i + 5))];
    const lineas = ['\ufeff' + enc.join(',')];
    let t = Date.UTC(2026, 9, 1, 8, 0, 0);
    const f = x => String(x).padStart(2, '0');
    for (let i = 0; i < n; i++) {
      const d = new Date(t);
      const [a, b, c] = v(i);
      lineas.push([`${f(d.getUTCDate())}/${f(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${f(d.getUTCHours())}:${f(d.getUTCMinutes())}:00`, a, b, c, ...Array(columnas - 4).fill('1')].join(','));
      t += (saltos.includes(i) ? paso * 2 : paso) * 60000;
    }
    return lineas.join('\r\n');
  };

  test('análisis de TXT: misma lógica que la macro CalidadEnergia', async ({ page }) => {
    app = await abrirApp(page);
    const txts = {
      valida: hacerTXT(),
      ft: hacerTXT({ v: i => (i % 10 === 0 ? [14500, 13200, 13200] : [13200, 13200, 13200]) }),
      pocos: hacerTXT({ n: 500 }),
      intervalo: hacerTXT({ paso: 30 }),
      columnas: hacerTXT({ columnas: 73 }),
      saltos: hacerTXT({ saltos: [100, 200] }),
      monoSinV1: hacerTXT({ v: () => [0, 0, 0] }),
      monoConV2: hacerTXT({ v: () => [7620, 7620, 0] }),
      alim: hacerTXT({ v: () => [400, 400, 400] }),
      perturb: hacerTXT({ n: 1100, paso: 10, columnas: 197, v: () => [7620, 7620, 7620] }),
      vacio: '',
    };
    const r = await page.evaluate(async t => {
      const m = await import('/js/domain/analisis.js');
      const tri = { configuracion: 'Estrella', alimentador: 'AL013-13200', urbanidad: 'U' };
      const mono = { configuracion: 'Monofásico', alimentador: 'AL013-13200', urbanidad: 'R' };
      const a = (n, x, d = tri) => { const z = m.analizarMedicion(n, x, d); return [z.estado, z.detalle, typeof z.febNoPer === 'number' ? Math.round(z.febNoPer * 10000) / 10000 : z.febNoPer]; };
      return {
        valida: a('CR1O2026201.txt', t.valida),
        ft: a('CR1O2026201.txt', t.ft),
        pocos: a('CR1O2026201.txt', t.pocos),
        intervalo: a('CR1O2026201.txt', t.intervalo),
        columnas: a('CR1O2026201.txt', t.columnas),
        saltos: a('CR1O2026201.txt', t.saltos),
        monoSinV1: a('CR1O2026201.txt', t.monoSinV1, { configuracion: 'Monofásico', alimentador: 'AL013', urbanidad: 'U' }),
        monoConV2: a('CR1O2026201.txt', t.monoConV2, mono),
        alim: a('CR1O2026201.txt', t.alim),
        sinDatos: a('CR1O2026201.txt', t.valida, {}),
        perturb: a('DA1O2026013O00.txt', t.perturb, { configuracion: '', alimentador: 'AL013-13200', urbanidad: 'U' }),
        vacio: a('CR1O2026201.txt', t.vacio),
        resultadoFT: m.resultadoDeAnalisis(m.analizarMedicion('CR1O2026201.txt', t.ft, tri)),
        resultadoOk: m.resultadoDeAnalisis(m.analizarMedicion('CR1O2026201.txt', t.valida, tri)),
        resultadoRevisar: m.resultadoDeAnalisis(m.analizarMedicion('CR1O2026201.txt', t.columnas, tri)),
      };
    }, txts);
    expect(r.valida).toEqual(['VALIDA', 'Registros: 700 | Estrella | Fases OK', 0]);
    expect(r.ft).toEqual(['VALIDA', 'Registros: 700 | Estrella | Fases OK', 0.1]); // 70 de 700 registros por encima de +6 %
    expect(r.pocos).toEqual(['FALLIDA', 'Insuficientes registros válidos: 500 (mínimo 576)', 0]);
    expect(r.intervalo).toEqual(['FALLIDA', 'Intervalo predominante NO es de 15 min. Registros: 700', 0]);
    expect(r.columnas).toEqual(['ADVERTENCIA', 'Número de columnas incorrecto: 73 (se esperan 74)', 0]);
    expect(r.saltos).toEqual(['ADVERTENCIA', 'Registros OK (700) pero 2 intervalo(s) fuera de 15 min', 0]);
    expect(r.monoSinV1).toEqual(['FALLIDA', 'Monofásico sin tensión en V1(0%)', 'N/D']);
    expect(r.monoConV2).toEqual(['FALLIDA', 'Monofásico con tensión en V2(100%) o V3(0%)', 0]);
    expect(r.alim).toEqual(['FALLIDA', 'Insuficientes registros válidos: 0 (mínimo 576)', 'ERROR ALIM.']);
    expect(r.sinDatos[0]).toBe('ADVERTENCIA');
    expect(r.perturb).toEqual(['VALIDA', 'Registros: 1100 | Trifásico | Fases OK', 0]);
    expect(r.vacio).toEqual(['FALLIDA', 'Archivo TXT vacío o sin datos', 'N/D']);
    expect(r.resultadoFT).toEqual({ medicion: 'valida', febNoPer: 10, tolerancia: 'fuera' });
    expect(r.resultadoOk).toEqual({ medicion: 'valida', febNoPer: 0, tolerancia: 'dentro' });
    expect(r.resultadoRevisar).toEqual({ medicion: 'revisar' });
  });

  test('gráficas: al analizar el TXT se guardan voltaje y corriente y se ven con la banda de tolerancia', async ({ page }) => {
    const datos = conCampana();
    Object.assign(datos.campanas['2026-10_CPT-MT'].casos.CR1O2026201, { alimentador: 'AL013-13200', urbanidad: 'U', mult: { configuracion: 'Monofásico' } });
    app = await abrirApp(page, { datos });
    await cerrarAlerta(page);
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('resultados'); });
    // Mismo formato que el TXT de ECAMEC: U1Max, U1, U1Min … I1Max, I1, I1Min …
    const enc = ['Fecha y Hora', 'U1Max [V]', 'U1 [V]', 'U1Min [V]', 'U2Max [V]', 'U2 [V]', 'U2Min [V]', 'U3Max [V]', 'U3 [V]', 'U3Min [V]', 'I1Max [A]', 'I1 [A]', 'I1Min [A]', 'I2Max [A]', 'I2 [A]', 'I2Min [A]', 'I3Max [A]', 'I3 [A]', 'I3Min [A]'];
    const f = x => String(x).padStart(2, '0');
    const lineas = ['\ufeff' + [...enc, ...Array.from({ length: 74 - enc.length }, (_, i) => 'C' + i)].join(',')];
    for (let i = 0; i < 700; i++) {
      const d = new Date(Date.UTC(2026, 9, 1, 8, 0) + i * 15 * 60000);
      const u = i % 10 === 0 ? 8300 : 7700; // 10 % de los registros arriba del +6 %
      lineas.push([`${f(d.getUTCDate())}/${f(d.getUTCMonth() + 1)}/2026 ${f(d.getUTCHours())}:${f(d.getUTCMinutes())}:00`, u + 50, u, u - 50, 6, 5, 4, 2, 1, 1, 30, 25 + (i % 4), 20, 0, 0, 0, 0, 0, 0, ...Array(74 - enc.length).fill('1')].join(','));
    }
    await page.locator('label', { hasText: 'Analizar TXT' }).locator('input').setInputFiles([{ name: 'CR1O2026201.txt', mimeType: 'text/plain', buffer: Buffer.from(lineas.join('\r\n')) }]);
    await page.getByRole('button', { name: 'Guardar resultados' }).click();
    const escritas = await app.escrituras();
    const serie = escritas.find(([op, ruta]) => op === 'update' && ruta === 'series/2026-10_CPT-MT')[2].CR1O2026201;
    expect(serie).toMatchObject({ inicio: '01/10/2026 08:00:00', nominal: 7620, tolerancia: 0.06, codigo: 'CR1O2026201' });
    expect(serie.t.length).toBe(700);
    expect(serie.U['1'].v.slice(0, 2)).toEqual([8300, 7700]);
    expect(serie.I['1'].v.slice(0, 2)).toEqual([25, 26]);
    expect(escritas.find(([, ruta]) => ruta === 'campanas/2026-10_CPT-MT')[2]['casos/CR1O2026201/resultado']).toMatchObject({ graficas: true, tolerancia: 'fuera' });

    // Botón en la fila: abre voltaje (solo V1, la única fase con tensión) y corriente
    await page.locator('.tabla-casos tr', { hasText: 'CR1O2026201' }).locator('.b-graf').click();
    const modal = page.locator('.graf-modal');
    await expect(modal).toContainText('tolerancia ±6 % (7,163 a 8,077 V)');
    await expect(modal.locator('.graf-dato')).toHaveCount(1);
    await expect(modal.locator('.graf-dato')).toContainText('10.0 % fuera');
    await expect(modal.locator('[data-graf="u"] .graf-linea')).toHaveCount(1);
    await expect(modal.locator('[data-graf="u"] .graf-banda')).toHaveCount(1);
    await expect(modal.locator('[data-graf="i"] .graf-linea')).toHaveCount(1);
    // Al pasar el cursor se ven fecha, voltaje y corriente de ese momento
    const area = modal.locator('[data-graf="u"]');
    const caja = await area.boundingBox();
    await page.mouse.move(caja.x + 0.2, caja.y + caja.height / 2);
    await expect(page.locator('#graf-tooltip')).toContainText('01/10 08:00');
    await expect(page.locator('#graf-tooltip')).toContainText('8,300 V');
    await expect(page.locator('#graf-tooltip')).toContainText('25.0 A');
    expect(app.errores).toEqual([]);
  });

  test('resultados: subir los TXT llena los resultados y los FT pasan a seguimiento', async ({ page }) => {
    const datos = conCampana();
    const cs = datos.campanas['2026-10_CPT-MT'].casos;
    Object.assign(cs.CR1O2026201, { alimentador: 'AL013-13200', urbanidad: 'U', mult: { configuracion: 'Estrella' } });
    Object.assign(cs.CR1O2026202, { alimentador: 'AL013-13200', urbanidad: 'U', mult: { configuracion: 'Estrella' } });
    app = await abrirApp(page, { datos });
    await cerrarAlerta(page);
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('resultados'); });
    const archivo = (name, texto) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(texto) });
    await page.locator('label', { hasText: 'Analizar TXT' }).locator('input').setInputFiles([
      archivo('CR1O2026201.txt', hacerTXT({ v: i => (i % 10 === 0 ? [14500, 13200, 13200] : [13200, 13200, 13200]) })),
      archivo('CR1O2026202.txt', hacerTXT({ columnas: 73 })),
      archivo('CR1O2026999.txt', hacerTXT()),
    ]);
    const modal = page.locator('.modal');
    await expect(modal).toContainText('Análisis de 2 mediciones');
    await expect(modal).toContainText('1 fuera de tolerancia');
    await expect(modal).toContainText('Sin caso con ese código (no se guardan): CR1O2026999.txt');
    await expect(modal.locator('tr', { hasText: 'CR1O2026201' })).toContainText('10.00 %');
    await expect(modal.locator('tr', { hasText: 'CR1O2026202' })).toContainText('POR REVISAR');
    await page.getByRole('button', { name: 'Guardar resultados' }).click();
    const [op, ruta, guardado] = (await app.escrituras()).at(-1);
    expect([op, ruta]).toEqual(['update', 'campanas/2026-10_CPT-MT']);
    expect(guardado['casos/CR1O2026201/resultado']).toMatchObject({ medicion: 'valida', febNoPer: 10, tolerancia: 'fuera', origen: 'txt', por: 'David García', analisis: { estado: 'VALIDA', registros: 700 } });
    expect(guardado['casos/CR1O2026202/resultado']).toMatchObject({ medicion: 'revisar', analisis: { estado: 'ADVERTENCIA' } });
    await expect(page.locator('.tabla-casos tr', { hasText: 'CR1O2026202' })).toContainText('Por revisar');
    await expect(page.locator('.tabla-casos tr', { hasText: 'CR1O2026202' })).toContainText('Número de columnas incorrecto');

    // Recalcular con los datos actuales (sin volver a subir los TXT)
    await page.getByRole('button', { name: 'Recalcular con los datos actuales' }).click();
    await expect(modal).toContainText('Análisis de 2 mediciones');
    await app.ejecutar(() => cerrarAnalisis());
    await nav(page, 'Seguimiento FT');
    await expect(page.locator('.card', { hasText: 'CR1O2026201' })).toContainText('Falta avisar a DELSUR');
  });

  test('coordenadas desde la base en Firebase: al importar los listados y con el botón', async ({ page }) => {
    const datos = conCampana();
    datos.coordenadas = { 111: [13.7001, -89.21], 222: [13.6, -89.3], 333: [13.5, -88.9], 901: [13.65, -89.2] };
    app = await abrirApp(page, { excel: true, datos });
    await cerrarAlerta(page);
    // Botón de la campaña: CR1O2026202 tiene el CT corregido a mano pero no coordenadas
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('casos'); });
    await page.getByRole('button', { name: 'Completar coordenadas' }).click();
    await expect.poll(async () => (await app.escrituras()).at(-1)?.[1]).toBe('campanas/2026-10_CPT-MT');
    expect((await app.escrituras()).at(-1)[2]).toMatchObject({ 'casos/CR1O2026201/lat': 13.7001, 'casos/CR1O2026201/lng': -89.21, 'casos/CR1O2026202/lat': 13.6, 'casos/DA1O2026011O00/lat': 13.6 });

    // Al importar listados nuevos, los casos traen sus coordenadas
    await app.ejecutar(() => { switchTab('campanas'); abrirImportListados(); });
    await page.locator('.modal input[type=file]').setInputFiles(LISTADOS);
    await page.getByRole('button', { name: 'Guardar campañas' }).click();
    await expect.poll(async () => (await app.escrituras()).filter(([, r]) => r === 'campanas/2026-10_CPT-BT').length).toBe(1);
    const bt = (await app.escrituras()).find(([, r]) => r === 'campanas/2026-10_CPT-BT')[2];
    expect(bt).toMatchObject({ 'casos/CR1O2026001/lat': 13.65, 'casos/CR1O2026001/lng': -89.2 });
    expect(bt['casos/CR1O2026002/lat']).toBeUndefined();
    const mt = (await app.escrituras()).filter(([, r]) => r === 'campanas/2026-10_CPT-MT').at(-1)[2];
    expect(mt['casos/CR1O2026203/lat']).toBe(13.5); // caso nuevo
    expect(mt['casos/CR1O2026201/lat']).toBeUndefined(); // ya las tenía (se completaron arriba con el botón)
  });
});

// ── Análisis de reclamos (macros Graficar y Armónicos) ──
// TXT sintéticos con el mismo formato del ECAMEC: 144 registros de 10 minutos.
const fechaTXT = i => { const d = new Date(Date.UTC(2026, 8, 1) + i * 600000); const z = n => String(n).padStart(2, '0'); return `${z(d.getUTCDate())}/${z(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:00`; };
// Tensión (74 columnas): 13.2 kV, los primeros 10 registros 8 % arriba (FT); PST 2 en el primero
function txtTension({ stotal = false } = {}) {
  const enc = ['Fecha y Hora'];
  for (const p of [1, 2, 3]) enc.push(`U${p}Max [V]`, `U${p} [V]`, `U${p}Min [V]`);
  for (const p of [1, 2, 3]) enc.push(`I${p}Max [A]`, `I${p} [A]`, `I${p}Min [A]`);
  while (enc.length < 71) enc.push(`Otra${enc.length} [x]`);
  enc.push('PST1 [p.u]', 'PST2 [p.u]', 'PST3 [p.u]');
  if (stotal) enc.push('');
  const filas = [enc.join(',')];
  for (let i = 0; i < 144; i++) {
    const u = i < 10 ? 13200 * 1.08 : 13200;
    const f = [fechaTXT(i)];
    for (let p = 0; p < 3; p++) f.push(u + 50, u, u - 50);
    for (let p = 0; p < 3; p++) f.push(80, 50, 30);
    while (f.length < 71) f.push(0);
    f.push(i === 0 ? 2 : 0.5, 0.5, 0.5);
    if (stotal) f.push(400000);
    filas.push(f.join(','));
  }
  return filas.join('\r\n');
}
// Armónicos (197 columnas): H5 de tensión al 3 %, salvo en la fase 1 los primeros 15 registros al 7 % (límite 6 %)
function txtArmonicos() {
  const enc = ['Fecha y Hora', 'U1 [V]', 'U2 [V]', 'U3 [V]', 'I1 [A]', 'I2 [A]', 'I3 [A]', 'I4 [A]', 'P1 [kW]', 'P2 [kW]', 'P3 [kW]', 'PTotal [kW]', 'FP1', 'FP2', 'FP3', 'EA1 [kWh]', 'EA2 [kWh]', 'EA3 [kWh]', 'EATot [kWh]'];
  for (let n = 1; n <= 25; n++) for (let p = 1; p <= 3; p++) enc.push(`Uarm${n}-${p}`);
  for (let n = 1; n <= 25; n++) for (let p = 1; p <= 4; p++) enc.push(`Iarm${n}-${p}`);
  enc.push('PST1 [p.u]', 'PST2 [p.u]', 'PST3 [p.u]');
  const filas = [enc.join(',')];
  for (let i = 0; i < 144; i++) {
    const f = [fechaTXT(i), 13200, 13200, 13200, 50, 50, 50, 1, 5, 5, 5, 15, 1, 1, 1, 0, 0, 0, 0];
    for (let n = 1; n <= 25; n++) for (let p = 1; p <= 3; p++) f.push(n === 1 ? 13200 : n === 5 ? 13200 * (p === 1 && i < 15 ? 0.07 : 0.03) : 0);
    for (let n = 1; n <= 25; n++) for (let p = 1; p <= 4; p++) f.push(n === 1 ? 50 : n === 5 ? 2.5 : 0);
    f.push(0.5, 0.5, 0.5);
    filas.push(f.join(','));
  }
  return filas.join('\r\n');
}

test.describe('Análisis de reclamos', () => {
  test('calcula el FebNoPer y los armónicos como las macros', async ({ page }) => {
    app = await abrirApp(page);
    const r = await page.evaluate(async ([tt, ta, ts]) => {
      const m = await import('/js/domain/reclamo.js');
      const d = m.leerTension(tt);
      const t = m.analizarTension(d, { fases: 3, nominal: 13200, tol: 0.06, kva: 100, vll: 240 });
      const a = m.analizarArmonicos(ta, 3);
      const h5 = a.tension.find(f => f.nombre === 'H5 - TDI');
      return {
        tipos: [m.tipoDeTXT(tt), m.tipoDeTXT(ta)], fases: m.fasesConTension(d.U), nominal: m.sugerirNominal(d.U), stotal: d.stotal,
        resumen: t.resumen, pst: t.pstP95, iTrafo: t.iMaxTrafo, conS: m.leerTension(ts).stotal, carga: m.analizarTension(m.leerTension(ts), { fases: 3, nominal: 13200, tol: 0.06 }).carga,
        n: a.n, vdat: a.tension[0].fases['1'].p95, h5: h5.fases, cumpleT: a.cumpleTension, cumpleI: a.cumpleCorriente, lim: [h5.limTxt, a.tension[1].limTxt],
        guardado: m.resumenGuardado(t, a),
      };
    }, [txtTension(), txtArmonicos(), txtTension({ stotal: true })]);
    expect(r.tipos).toEqual(['tension', 'armonicos']);
    expect(r.fases).toBe(3);
    expect(r.nominal).toBe(13200);
    expect(r.stotal).toBeNull(); // sin STOTAL no hay cargabilidad (la macro tomaba PST3)
    expect(r.conS).toEqual({ origen: 'columna 75', encabezado: '' });
    expect(r.carga.max).toBe(400); // STOTAL en VA → kVA
    expect(r.resumen).toMatchObject({ total: 144, invalidos: 0, validos: 144, ft: 10, estado: 'FUERA DE TOLERANCIA' });
    expect(r.resumen.febNoPer).toBeCloseTo(10 / 144, 6);
    expect(r.iTrafo).toBeCloseTo(100 * 1000 / (Math.sqrt(3) * 240), 6); // trifásico: kVA × 1000 / (√3 × V L-L)
    expect(r.pst['1']).toBeCloseTo(0.5, 6);
    expect(r.n).toBe(144);
    expect(r.h5['1']).toMatchObject({ exc: 15, cumple: false });
    expect(r.h5['1'].pct).toBeCloseTo(1500 / 144, 6);
    expect(r.h5['2']).toMatchObject({ exc: 0, cumple: true });
    expect(r.cumpleT).toEqual({ 1: false, 2: true, 3: true });
    expect(r.cumpleI).toEqual({ 1: true, 2: true, 3: true });
    expect(r.lim).toEqual(['6.0%', '2.0%']);
    expect(r.guardado).toEqual({ tension: { febNoPer: 10 / 144, estado: 'FUERA DE TOLERANCIA' }, flicker: 'CUMPLE', armonicos: { tension: 'NO CUMPLE', corriente: 'CUMPLE' } });
  });

  test('sube los dos TXT, muestra las gráficas y lo guarda en el reclamo', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await nav(page, 'Reclamos');
    await page.locator('.exp-card', { hasText: 'RE192026456' }).click();
    await page.locator('.exp-medicion').getByRole('button', { name: 'Analizar TXT' }).click();
    await page.locator('.graf-modal input[type=file]').setInputFiles([
      { name: 'RE192026456.txt', mimeType: 'text/plain', buffer: Buffer.from(txtTension()) },
      { name: 'RE1920264560.txt', mimeType: 'text/plain', buffer: Buffer.from(txtArmonicos()) }]);
    const modal = page.locator('.graf-modal');
    await expect(modal.locator('.arch-slot.lleno')).toHaveCount(2);
    await expect(page.locator('#ar-nominal')).toHaveValue('13200');
    await expect(modal.locator('.tile', { hasText: 'FebNoPer' })).toContainText('6.94 %');
    for (const g of ['u', 'umax', 'umin', 'i', 'imax', 'pst']) await expect(modal.locator(`[data-graf="${g}"]`)).toHaveCount(1);
    await expect(modal).toContainText('no trae STOTAL');
    // Cambiar la tolerancia recalcula
    await page.locator('#ar-red').selectOption('rural_bt');
    await expect(modal.locator('.tile', { hasText: 'FebNoPer' })).toContainText('0.00 %');
    await page.locator('#ar-red').selectOption('urbano_mt');
    await modal.getByRole('button', { name: 'Armónicos', exact: true }).click();
    await expect(modal.locator('.veredicto').first()).toContainText('Tensión: NO CUMPLE');
    await expect(modal.locator('.veredicto').nth(1)).toContainText('Tensión: CUMPLE');
    await expect(modal.locator('.tabla-arm td.mal')).toHaveCount(1); // H5 de la fase 1
    await modal.getByRole('button', { name: 'Guardar en el reclamo' }).click();
    await expect(page.locator('.toast')).toContainText('Análisis guardado');
    const esc = await app.escrituras();
    const archivos = esc.find(([, ruta]) => ruta === 'archivosReclamo/r9')[2];
    expect(archivos.tension.nombre).toBe('RE192026456');
    expect(archivos.armonicos.gz.length).toBeGreaterThan(100);
    const guardado = esc.find(([, ruta, v]) => ruta === 'analizadores/r9' && v.analisisReclamo)[2].analisisReclamo;
    expect(guardado.params).toMatchObject({ fases: 3, nominal: '13200', red: 'urbano_mt' });
    expect(guardado.resultado.armonicos).toEqual({ tension: 'NO CUMPLE', corriente: 'CUMPLE' });
    await modal.locator('.modal-cerrar').click();
    // El expediente muestra el resultado; con FebNoPer > 5 % pasa a fuera de tolerancia
    const med = page.locator('.exp-medicion');
    await expect(med).toContainText('FebNoPer 6.94 % · fuera de tolerancia');
    await expect(med).toContainText('Armónicos: tensión no cumple · corriente cumple');
    await expect(page.locator('.hero')).toContainText('Fuera de tolerancia');
    await page.getByRole('tab', { name: /Seguimiento/ }).click();
    await expect(app$(page)).toContainText('Armónicos de tensión fuera de límite. Le compete al usuario');
    await expect(page.locator('.ft-item')).toContainText('Falta avisar a DELSUR');
    await nav(page, 'Seguimiento FT');
    await expect(page.locator('.ft-card')).toContainText('USUARIO DE PRUEBA · Reclamo');
    // Al reabrir se cargan los TXT guardados (comprimidos) y los datos de la medición
    await nav(page, 'Reclamos');
    await page.locator('.exp-card', { hasText: 'RE192026456' }).click();
    await page.locator('.exp-medicion').getByRole('button', { name: 'Ver análisis' }).click();
    await expect(modal.locator('.arch-slot.lleno')).toHaveCount(2);
    await expect(modal.locator('.tile', { hasText: 'FebNoPer' })).toContainText('6.94 %');
  });

  test('descarga los Excel de tensión y armónicos con sus gráficas', async ({ page }) => {
    const XLSX = require('xlsx-js-style');
    app = await abrirApp(page, { excel: true });
    await cerrarAlerta(page);
    await page.evaluate(([tt, ta]) => {
      abrirAnalisisReclamo('r9');
      cargarTXTReclamo([{ nombre: 'RE192026456.txt', texto: tt }, { nombre: 'RE1920264560.txt', texto: ta }]);
      setParamReclamo('usuario', 'Empresa');
    }, [txtTension(), txtArmonicos()]);
    const bajar = async boton => { const d = page.waitForEvent('download'); await page.getByRole('button', { name: boton }).click(); return d; };
    const dt = await bajar('Excel de tensión');
    expect(dt.suggestedFilename()).toBe('RE192026456_Graficas.xlsx');
    const bt = require('fs').readFileSync(await dt.path());
    const wt = XLSX.read(bt);
    expect(wt.SheetNames).toEqual(['Tensión promedio', 'Tensión máxima', 'Tensión mínima', 'Corriente promedio', 'Corriente máxima', 'PST']);
    const prom = XLSX.utils.sheet_to_json(wt.Sheets['Tensión promedio'], { header: 1 });
    expect(prom[0].slice(0, 6)).toEqual(['Fecha/Hora', 'U1 [V]', 'U2 [V]', 'U3 [V]', 'SOBRE+6%', 'SUB-6%']);
    expect(prom[1][0]).toBe('1/9/2026 00:00');
    expect(prom[3].slice(7, 13)).toEqual([144, 0, 144, 10, 10 / 144, 'FUERA DE TOLERANCIA']);
    // Cada hoja lleva su gráfica nativa de Excel, con las series apuntando a sus columnas
    const zt = XLSX.CFB.read(bt, { type: 'buffer' });
    const chart1 = Buffer.from(XLSX.CFB.find(zt, '/xl/charts/chart1.xml').content).toString();
    expect(chart1).toContain("'Tensión promedio'!$B$2:$B$145");
    expect(chart1).toContain('PERFIL DE TENSIÓN PROMEDIO - EMPRESA');
    expect(XLSX.CFB.find(zt, '/xl/charts/chart6.xml')).toBeTruthy();
    expect(Buffer.from(XLSX.CFB.find(zt, '/xl/worksheets/sheet1.xml').content).toString()).toContain('<drawing r:id="rIdDibujo1"/>');

    const da = await bajar('Excel de armónicos');
    expect(da.suggestedFilename()).toBe('RE1920264560_Armonicos.xlsx');
    const ba = require('fs').readFileSync(await da.path());
    const wa = XLSX.read(ba);
    expect(wa.SheetNames).toEqual(['Detalle_V', 'Detalle_I', 'Resumen_Armonicos', 'Resumen_Compacto', 'Graficos']);
    const res = XLSX.utils.sheet_to_json(wa.Sheets.Resumen_Armonicos, { header: 1 });
    const h5 = res.find(f => f[0] === 'H5 - TDI');
    expect(h5.slice(1, 2)).toEqual(['6.0%']);
    expect(h5.slice(5, 8)).toEqual([15, 0, 0]);
    expect(h5.slice(11, 14)).toEqual(['NO CUMPLE', 'CUMPLE', 'CUMPLE']);
    expect(XLSX.utils.sheet_to_json(wa.Sheets.Detalle_V, { header: 1 })[0].slice(0, 5)).toEqual(['Fecha y Hora', 'VDAT F1 (%)', 'VDAT F2 (%)', 'VDAT F3 (%)', 'TDI H2 F1 (%)']);
    const za = XLSX.CFB.read(ba, { type: 'buffer' });
    const espectro = Buffer.from(XLSX.CFB.find(za, '/xl/charts/chart1.xml').content).toString();
    expect(espectro).toContain('<c:barChart>');
    expect(espectro).toContain("'Graficos'!$B$2:$B$25"); // límite de la Tabla 4
    expect(XLSX.CFB.find(za, '/xl/charts/chart4.xml')).toBeTruthy();
  });
});

// ── Expedientes de reclamo ──
test.describe('Expedientes de reclamo', () => {
  // Correo como queda al copiarlo de Outlook (datos inventados)
  const CORREO = [
    'RE182026999 _ RV: WO-123456 , CT20001 , Se requiere el estudio de voltaje , COLONIA PRUEBA, MUNICIPIO PRUEBA LA LIBERTAD',
    'Buenas tardes David.',
    'Favor su apoyo con la atención de este requerimiento.',
    'RE182026999',
    'Identificación del Punto de medición',
    'ID Usuario:\t900999',
    'Nombre del Usuario:\tUSUARIO INVENTADO',
    'Dirección:',
    'CALLE INVENTADA 5, SAN SALVADOR',
    'Centro MT/BT ó Corte:\tDS999999',
    'Medidor\t999999-XT',
  ].join('\n');

  test('lee el asunto y la tabla del correo de DELSUR', async ({ page }) => {
    app = await abrirApp(page);
    const r = await page.evaluate(async c => (await import('/js/domain/expedientes.js')).leerCorreoReclamo(c), CORREO);
    expect(r).toEqual({ codigo: 'RE182026999', wo: 'WO-123456', ct: 'CT20001', motivo: 'Se requiere el estudio de voltaje', zona: 'COLONIA PRUEBA, MUNICIPIO PRUEBA LA LIBERTAD', nc: '900999', nombre: 'USUARIO INVENTADO', direccion: 'CALLE INVENTADA 5, SAN SALVADOR', corte: 'DS999999', medidor: '999999-XT' });
  });

  test('acepta los códigos de octubre, noviembre y diciembre (O, N, D)', async ({ page }) => {
    app = await abrirApp(page);
    const r = await page.evaluate(async c => {
      const m = await import('/js/domain/expedientes.js');
      return {
        partes: ['RE1O2026201', 'RE1N2026201', 'RE2D2026201', 'RE182026201', 'RE-2026-01'].map(m.partesCodigoRE),
        clave: m.claveExpediente('RE1O2026201'),
        correo: m.leerCorreoReclamo(c.replace('RE182026999', 'RE1O2026999').replace('RE182026999', 'RE1O2026999')).codigo,
      };
    }, CORREO);
    expect(r.partes).toEqual([{ n: 1, resto: 'O2026201' }, { n: 1, resto: 'N2026201' }, { n: 2, resto: 'D2026201' }, { n: 1, resto: '82026201' }, null]);
    expect(r.clave).toBe('RE-O2026201');
    expect(r.correo).toBe('RE1O2026999');
  });

  test('nuevo reclamo desde el correo: crea el expediente y lleva a registrar la instalación', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await nav(page, 'Reclamos');
    // Las instalaciones RE sueltas no son expedientes: solo aparece el que se creó a mano
    await expect(page.locator('.exp-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Nuevo reclamo' }).click();
    await page.locator('#nr-correo').fill(CORREO);
    await page.locator('#nr-correo').blur();
    await expect(page.locator('#nr-nombre')).toHaveValue('USUARIO INVENTADO');
    await expect(page.locator('#nr-wo')).toHaveValue('WO-123456');
    await page.getByRole('button', { name: 'Crear expediente' }).click();
    const creado = (await app.escrituras()).find(([op, ruta]) => op === 'set' && ruta === 'reclamos/RE-82026999');
    expect(creado[2]).toMatchObject({ codigo: 'RE182026999', nc: '900999', medidor: '999999-XT', area: 'CPT MT', recibido: '2026-09-23', creado: { fecha: '2026-09-23', por: 'David García' } });
    await expect(page.locator('.hero')).toContainText('RE182026999');
    await expect(page.locator('#exp-direccion')).toHaveValue('CALLE INVENTADA 5, SAN SALVADOR');
    // Pendiente en el Inicio hasta instalar
    await nav(page, 'Inicio');
    await expect(app$(page)).toContainText('Ubicar e instalar el reclamo RE182026999');
    // Registrar la instalación: formulario con el código y el retiro al 8.º día
    await page.locator('.pendiente', { hasText: 'RE182026999' }).click();
    await page.getByRole('tab', { name: /Mediciones/ }).click();
    await page.getByRole('button', { name: 'Registrar instalación' }).click();
    await expect(page.locator('input[oninput*="\'caso\'"]')).toHaveValue('RE182026999');
    await expect(page.locator('input[oninput*="\'fechaRetiro\'"]')).toHaveValue('2026-10-01');
    await expect(page.locator('input[oninput*="\'lugar\'"]:visible')).toHaveValue('USUARIO INVENTADO · CALLE INVENTADA 5, SAN SALVADOR');
  });

  test('las remediciones (RE2…) se ligan al mismo expediente y el FT se sigue como en campañas', async ({ page }) => {
    const datos = JSON.parse(JSON.stringify(fixture));
    datos.analizadores.r9.analisisReclamo = { resultado: { tension: { febNoPer: 0.12, estado: 'FUERA DE TOLERANCIA' }, flicker: 'NO CUMPLE' } };
    datos.analizadores.rem = { serie: 'SN-300', caso: 'RE292026456', lugar: 'x', fechaInstalacion: '2026-09-20', fechaRetiro: '2026-09-28', areaInstalacion: 'CPT MT' };
    app = await abrirApp(page, { datos });
    await cerrarAlerta(page);
    await nav(page, 'Reclamos');
    await page.locator('.exp-card', { hasText: 'USUARIO DE PRUEBA' }).click();
    await page.getByRole('tab', { name: /Mediciones/ }).click();
    await expect(page.locator('.exp-medicion')).toHaveCount(2);
    await expect(page.locator('.exp-medicion').nth(1)).toContainText('Remedición 1 · RE292026456');
    await expect(page.locator('.exp-medicion').first()).toContainText('Flicker no cumple');
    await page.getByRole('tab', { name: /Seguimiento/ }).click();
    await expect(page.locator('.ft-item')).toContainText('Remedición RE292026456 en campo');
    await page.locator('.ft-item').getByRole('button', { name: 'Seguimiento' }).click();
    await page.getByRole('button', { name: 'Marcar aviso enviado por correo' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['set', 'reclamos/RE-92026456/ft/aviso', { fecha: '2026-09-23', por: 'David García' }]);
  });

  test('varios puntos en la misma medición: el principal lleva el código y los demás se vinculan', async ({ page }) => {
    const datos = JSON.parse(JSON.stringify(fixture));
    datos.analizadores.tab = { serie: 'SN-400', caso: 'tableroprincipal', lugar: 'x', fechaInstalacion: '2026-09-01', fechaRetiro: '2026-09-09', retirado: true, fechaRetiroReal: '2026-09-16', areaInstalacion: 'CPT MT',
      analisisReclamo: { resultado: { flicker: 'NO CUMPLE' } } };
    app = await abrirApp(page, { datos });
    await cerrarAlerta(page);
    // Sin vincular, la instalación sin código sale en Requerimientos
    await nav(page, 'Requerimientos');
    await expect(app$(page)).toContainText('tableroprincipal');
    await nav(page, 'Reclamos');
    await page.locator('.exp-card', { hasText: 'USUARIO DE PRUEBA' }).click();
    await page.getByRole('button', { name: /Agregar punto/ }).click();
    await page.locator('#punto-nombre').fill('Tablero principal');
    await page.locator('.modal .fila', { hasText: 'tableroprincipal' }).getByRole('button', { name: 'Vincular' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['update', 'analizadores/tab', { reclamo: { id: 'RE-92026456', n: 1, punto: 'Tablero principal' } }]);
    const punto = page.locator('.exp-punto', { hasText: 'Tablero principal' });
    await expect(punto).toContainText('Flicker no cumple');
    await expect(punto.getByRole('button', { name: 'Ver análisis' })).toBeVisible();
    // El aviso al usuario incluye el punto; el FT solo lo decide el principal (no hay FT)
    await page.getByRole('tab', { name: /Seguimiento/ }).click();
    await expect(app$(page)).toContainText('Flicker (Tablero principal)');
    await expect(page.locator('.ft-item')).toHaveCount(0);
    // Ya no es un requerimiento
    await nav(page, 'Requerimientos');
    await expect(app$(page)).not.toContainText('tableroprincipal');
    // Registrar un punto nuevo: formulario con el nombre como caso y vuelta al expediente al guardar
    await nav(page, 'Reclamos');
    await page.locator('.exp-card', { hasText: 'USUARIO DE PRUEBA' }).click();
    await page.getByRole('button', { name: /Agregar punto/ }).click();
    await page.locator('#punto-nombre').fill('Trafo');
    await page.getByRole('button', { name: 'Registrar instalación nueva' }).click();
    await expect(page.locator('input[oninput*="\'caso\'"]')).toHaveValue('trafo');
  });
});
