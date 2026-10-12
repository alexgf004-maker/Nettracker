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
  const marcar = async (page, pin) => { for (const d of pin) await page.locator('.pin-tecla', { hasText: new RegExp(`^${d}$`) }).click(); };

  test('la primera vez cada quien crea su PIN de 6 dígitos (dos veces): queda una cuenta de Firebase y entra', async ({ page }) => {
    app = await abrirApp(page, { usuario: null });
    await expect(app$(page)).toContainText('¿Quién eres?');
    await page.getByText('David García').first().click();
    await expect(app$(page)).toContainText('Crea tu PIN');
    await expect(page.locator('.pin-puntos i')).toHaveCount(6);
    await marcar(page, '123456');
    await expect(app$(page)).toContainText('Confirma tu PIN');
    await marcar(page, '999999');
    await expect(page.locator('.pin-error')).toContainText('no coinciden');
    await marcar(page, '123456'); await marcar(page, '123456');
    await expect(app$(page)).toContainText('Hola, David');
    // La cuenta queda en Auth (el PIN es la contraseña); en la base solo la marca de que ya tiene cuenta
    expect(await page.evaluate(() => window.__AUTH__.cuentas)).toEqual({ 'david-garcia@usuarios.nettracker.app': '123456' });
    const escrituras = await app.escrituras();
    expect(escrituras.find(([op, ruta]) => op === 'set' && ruta === 'cuentas/david-garcia')[2]).toEqual({ creado: expect.any(String) });
    expect(JSON.stringify(escrituras)).not.toContain('123456'); // el PIN no se guarda en la base
  });

  test('con cuenta: un PIN equivocado no deja entrar y el correcto sí', async ({ page }) => {
    app = await abrirApp(page, { usuario: null, cuentas: { 'Samuel Villalobos': '432100' } });
    await page.getByText('Samuel Villalobos').click();
    await expect(app$(page)).toContainText('Pon tu PIN');
    await marcar(page, '111111');
    await expect(page.locator('.pin-error')).toContainText('PIN incorrecto');
    await expect(app$(page)).not.toContainText('Hola, Samuel');
    await marcar(page, '432100');
    await expect(app$(page)).toContainText('Hola, Samuel');
  });

  test('sin sesión no se lee nada de la base', async ({ page }) => {
    app = await abrirApp(page, { usuario: null });
    await expect(app$(page)).toContainText('¿Quién eres?');
    expect(await page.evaluate(() => window.__LECTURAS__)).toEqual([]);
  });

  test('cambiar de perfil cierra la sesión de Firebase; el administrador puede borrar un PIN', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await page.locator('.user-chip').click();
    await page.locator('.perfil-menu button', { hasText: 'Samuel Villalobos' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['remove', 'cuentas/samuel-villalobos']);
    await page.locator('.user-chip').click();
    await page.getByRole('button', { name: 'Cambiar de perfil' }).click();
    await expect(app$(page)).toContainText('¿Quién eres?');
    await expect(app$(page)).not.toContainText('Vicente Ramos');
    await page.reload();
    await expect(app$(page)).toContainText('¿Quién eres?'); // la sesión ya no se recuerda
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
    // El informe del reclamo va en su propio bloque, con el conteo de 8 días desde el retiro
    await expect(page.locator('.inf-caso', { hasText: 'RE192026456' })).toContainText('Reclamo');
    await expect(page.locator('.pendiente', { hasText: 'Entregar informe' })).toHaveCount(0);
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
    await expect(page.locator('.pendiente')).toHaveCount(3);
    await expect(page.locator('.inf-caso')).toHaveCount(1);
    await page.getByRole('button', { name: 'Contar solo desde hoy' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['set', 'config/seguimientoDesde', '2026-09-23']);
    // Quedan solo los que vencen desde hoy: la campaña de agosto, la descarga y el informe eran de antes
    await expect(page.locator('.pendiente')).toHaveCount(1);
    await expect(page.locator('.inf-caso')).toHaveCount(0);
    await expect(page.locator('.pendiente')).toContainText('Retirar SN-101');
    await expect(page.locator('.desde')).toContainText('Cuenta desde el 23/09/2026');
    await page.getByRole('button', { name: 'Cambiar' }).click();
    await page.getByRole('button', { name: 'Contar todo' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['set', 'config/seguimientoDesde', null]);
    await expect(page.locator('.pendiente')).toHaveCount(3);
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
    await expect(app$(page)).toContainText('Nueva instalación');
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

  test('sin parpadeo: la animación de entrada no se repite al escribir en el buscador', async ({ page }) => {
    const anim = () => page.evaluate(() => getComputedStyle(document.querySelector('#app .content')).animationName);
    await page.locator('.inv-buscar .search-input').pressSequentially('SN-1');
    expect(await anim()).toBe('none');
    await nav(page, 'Inicio'); // al cambiar de pantalla sí entra con su animación
    expect(await anim()).toBe('fadeSlide');
  });

  test('lista, filtros y búsqueda', async ({ page }) => {
    await expect(app$(page)).toContainText('SN-105');
    await app.ejecutar(() => setInvFiltro('prestado'));
    await expect(app$(page)).toContainText('SN-103');
    await expect(app$(page)).not.toContainText('SN-105');
    await app.ejecutar(() => { setInvFiltro('TODOS'); setInvSearch('102'); });
    await expect(app$(page)).toContainText('SN-102');
    await expect(app$(page)).not.toContainText('SN-105');
  });

  test('detalle del equipo en todas sus pestañas', async ({ page }) => {
    for (const t of ['general', 'mantenimiento', 'instalaciones', 'movimientos']) {
      await app.ejecutar(t => { openEqDetalle('e1'); setEqDetalleTab(t); }, t);
      await expect(app$(page)).toContainText('SN-100');
    }
  });

  test('guardar mantenimiento y condición', async ({ page }) => {
    await app.ejecutar(() => { openMantModal('e1'); setMantForm('descripcion', 'falla x'); guardarMant(); });
    await app.ejecutar(() => { openCondicionModal('e1'); setCondicionField('condicion', 'malo'); doCondicion(); });
    const rutas = (await app.escrituras()).map(([op, ruta]) => op + ' ' + ruta);
    expect(rutas).toEqual(['update equipos/e1', 'update equipos/e1']);
  });

  test('crear equipo nuevo: pide el área dueña; editar conserva la fecha de registro', async ({ page }) => {
    await app.ejecutar(() => { newEquipo(); setEF('serie', 'SN-777'); setEF('modelo', 'PQ-9'); saveEquipo(); });
    await expect(page.locator('.toast')).toContainText('Elige el área dueña');
    await app.ejecutar(() => { setEF('area', 'CPT BT'); saveEquipo(); });
    const push = (await app.escrituras()).find(([op, ruta]) => op === 'push' && ruta === 'equipos');
    expect(push[2]).toMatchObject({ serie: 'SN-777', modelo: 'PQ-9', area: 'CPT BT', creadoPor: 'David García' });
    await app.ejecutar(() => { editEquipo('e1'); setEF('area', 'CPT MT'); saveEquipo(); });
    const edicion = (await app.escrituras()).at(-1);
    expect(edicion[1]).toBe('equipos/e1');
    expect(edicion[2]).toMatchObject({ area: 'CPT MT', editadoPor: 'David García' });
    expect(edicion[2].fechaRegistro).toBeUndefined();
    expect(edicion[2].creadoPor).toBeUndefined();
  });

});

test.describe('Memos de préstamo y devolución', () => {
  // Inventario con áreas dueñas: e2/e6 de CPT MT disponibles, e7 de CPT BT, e4 de CPT MT prestado a CPT BT,
  // e8 de CPT MT con Campos y Servicios pero ya sin instalación (de antes de la devolución automática)
  const conAreas = () => {
    const d = JSON.parse(JSON.stringify(fixture));
    Object.assign(d.equipos.e1, { area: 'CPT MT' }); Object.assign(d.equipos.e2, { area: 'CPT MT' }); Object.assign(d.equipos.e6, { area: 'CPT MT' });
    Object.assign(d.equipos.e7, { area: 'CPT BT' }); Object.assign(d.equipos.e3, { area: 'CPT BT' });
    Object.assign(d.equipos.e4, { area: 'CPT MT', movimientos: [{ tipo: 'prestamo', de: 'CPT MT', a: 'CPT BT', fecha: '2026-09-01' }] });
    Object.assign(d.equipos.e5, { area: 'CPT MT' });
    d.equipos.e8 = { serie: 'SN-108', modelo: 'PQ-1', sede: 'Subestación Cucumacayán', condicion: 'detalles', area: 'CPT MT', prestado: true, prestadoFecha: '2026-08-01',
      movimientos: [{ tipo: 'prestamo', de: 'CPT MT', a: 'Campos y Servicios', fecha: '2026-08-01' }] };
    d.equipos.e9 = { serie: 'SN-109', modelo: 'PQ-3', sede: 'Plantel Central', condicion: 'detalles', area: 'CPT MT', vineta: 'V9' };
    return d;
  };
  const capturar = page => page.evaluate(() => {
    window.__docs = [];
    const crear = URL.createObjectURL.bind(URL);
    URL.createObjectURL = b => { b.text().then(t => window.__docs.push(t)); return crear(b); };
  });

  test('lista por estado: nadie se queda fuera y los ya retirados con Campos y Servicios se pueden devolver', async ({ page }) => {
    app = await abrirApp(page, { datos: conAreas() });
    await cerrarAlerta(page);
    await nav(page, 'Equipos');
    await expect(page.locator('.eq-grupo', { hasText: 'Con Campos y Servicios' })).toContainText('SN-108');
    await expect(page.locator('.eq-grupo', { hasText: 'Prestados a otra área' })).toContainText('SN-103');
    await expect(page.locator('.eq-grupo', { hasText: 'En campo' })).toContainText('SN-104');
    // Buscar por viñeta
    await app.ejecutar(() => setInvSearch('V7'));
    await expect(page.locator('.eq-item')).toHaveCount(1);
    await app.ejecutar(() => setInvSearch(''));
    // Aviso: ya no están instalados pero siguen prestados a Campos y Servicios
    await expect(page.locator('.inv-aviso')).toContainText('SN-108');
    await page.getByRole('button', { name: 'Registrar devolución' }).click();
    const [, ruta, datos] = (await app.escrituras()).at(-1);
    expect(ruta).toBe('equipos/e8');
    expect(datos).toMatchObject({ prestado: false, prestadoFecha: null });
    expect(datos.movimientos.at(-1)).toMatchObject({ tipo: 'devolucion', de: 'Campos y Servicios', a: 'CPT MT', auto: true });
  });

  test('préstamo de varios equipos: solo deja elegir los que se pueden, registra todos y guarda un memo de lote', async ({ page }) => {
    app = await abrirApp(page, { datos: conAreas() });
    await cerrarAlerta(page);
    await nav(page, 'Equipos');
    await page.getByRole('button', { name: 'Nuevo préstamo' }).click();
    await expect(page.locator('.memo-nuevo h2')).toHaveText('Nuevo memo');
    // De CPT MT: disponibles SN-105 y SN-109 (Con detalles, se presta con aviso); los demás explican por qué no
    await expect(page.locator('.memo-eq')).toHaveCount(2);
    await expect(page.locator('.memo-eq', { hasText: 'SN-109' })).toContainText('Con detalles');
    await page.locator('.memo-no summary').click();
    await expect(page.locator('.memo-no')).toContainText('Es de CPT BT');
    await expect(page.locator('.memo-no')).toContainText('Instalado en #C-001');
    await expect(page.locator('.memo-no')).toContainText('Prestado a CPT BT');
    await page.locator('.memo-eq', { hasText: 'SN-105' }).click();
    await page.locator('.memo-eq', { hasText: 'SN-109' }).click();
    await page.locator('.memo-chips').nth(1).getByRole('button', { name: 'Campos y Servicios' }).click();
    await page.locator('.memo-nota').fill('Campaña de octubre');
    await expect(page.locator('.memo-pie')).toContainText('Memo de lote con 2 equipos');
    // Los elegidos quedan como chips arriba (se quitan con ×) y la lista se puede plegar
    await expect(page.locator('.memo-sel-chip')).toHaveText(['SN-105×', 'SN-109×']);
    await page.getByRole('button', { name: /Ocultar equipos disponibles/ }).click();
    await expect(page.locator('.memo-eq')).toHaveCount(0);
    await page.getByRole('button', { name: /Ver equipos disponibles \(3\)/ }).click(); // a Campos y Servicios también los de CPT BT
    await expect(page.locator('.memo-eq')).toHaveCount(3);
    await capturar(page);
    await page.getByRole('button', { name: 'Registrar y generar memo' }).click();
    const esc = await app.escrituras();
    const memo = esc.find(([op, ruta]) => op === 'push' && ruta === 'memosEquipos')[2];
    expect(memo).toMatchObject({ tipo: 'prestamo', de: 'CPT MT', a: 'Campos y Servicios', nota: 'Campaña de octubre', registradoPor: 'David García' });
    expect(memo.equipos.map(e => e.serie)).toEqual(['SN-105', 'SN-109']);
    const eqs = esc.filter(([op, ruta]) => op === 'update' && ruta.startsWith('equipos/'));
    expect(eqs.map(e => e[1])).toEqual(['equipos/e6', 'equipos/e9']);
    expect(eqs[0][2]).toMatchObject({ prestado: true, sede: 'Con Campos y Servicios' });
    expect(eqs[0][2].movimientos.at(-1)).toMatchObject({ tipo: 'prestamo', de: 'CPT MT', a: 'Campos y Servicios', memoId: expect.any(String) });
    await expect.poll(() => page.evaluate(() => window.__docs.length)).toBe(1);
    const doc = (await page.evaluate(() => window.__docs))[0];
    for (const t of ['Préstamo de lote', 'SN-105', 'SN-109', 'Campaña de octubre', 'Con detalles']) expect(doc).toContain(t);
    // Queda en Memos para reimprimirlo
    await expect(page.locator('.memo-item')).toContainText('CPT MT → Campos y Servicios');
    await page.locator('.memo-item').getByRole('button', { name: 'Memo' }).click();
    await expect.poll(() => page.evaluate(() => window.__docs.length)).toBe(2);
  });

  test('a Campos y Servicios, CPT MT puede entregar equipos de la Cucumacayán (de CPT BT)', async ({ page }) => {
    app = await abrirApp(page, { datos: conAreas() });
    await cerrarAlerta(page);
    await nav(page, 'Equipos');
    await page.getByRole('button', { name: 'Nuevo préstamo' }).click();
    await expect(page.locator('.memo-eq', { hasText: 'SN-106' })).toHaveCount(0); // a CPT BT no: es de CPT BT
    await page.locator('.memo-chips').nth(1).getByRole('button', { name: 'Campos y Servicios' }).click();
    const bt = page.locator('.memo-eq', { hasText: 'SN-106' });
    await expect(bt).toContainText('de CPT BT');
    await bt.click();
    await capturar(page);
    await page.getByRole('button', { name: 'Registrar y generar memo' }).click();
    const [, ruta, datos] = (await app.escrituras()).filter(([op]) => op === 'update').at(-1);
    expect(ruta).toBe('equipos/e7');
    expect(datos.movimientos.at(-1)).toMatchObject({ tipo: 'prestamo', de: 'CPT MT', a: 'Campos y Servicios' });
    // Al volver de campo regresa a su área (CPT BT)
    const r = await page.evaluate(async eq => (await import('/js/domain/inventario.js')).devolucionAlRetirar(eq, { fecha: '2026-09-30', por: 'x' }), { area: 'CPT BT', prestado: true, movimientos: datos.movimientos });
    expect(r.movimientos.at(-1)).toMatchObject({ tipo: 'devolucion', de: 'Campos y Servicios', a: 'CPT BT' });
  });

  test('devolución desde la ficha: el mismo flujo con el equipo ya elegido y memo individual', async ({ page }) => {
    app = await abrirApp(page, { datos: conAreas() });
    await cerrarAlerta(page);
    await nav(page, 'Equipos');
    await app.ejecutar(() => openEqDetalle('e4'));
    await expect(app$(page)).toContainText('Lo tiene');
    await page.getByRole('button', { name: 'Registrar devolución' }).click();
    await expect(page.locator('.memo-chips').first().locator('.active')).toHaveText('CPT BT');
    await expect(page.locator('.memo-eq.sel')).toContainText('SN-103');
    await expect(page.locator('.memo-pie')).toContainText('Memo individual');
    await capturar(page);
    await page.getByRole('button', { name: 'Registrar y generar memo' }).click();
    const [, ruta, datos] = (await app.escrituras()).filter(([op]) => op === 'update').at(-1);
    expect(ruta).toBe('equipos/e4');
    expect(datos).toMatchObject({ prestado: false, sede: 'Plantel Central' });
    expect(datos.movimientos.at(-1)).toMatchObject({ tipo: 'devolucion', de: 'CPT BT', a: 'CPT MT' });
    await expect.poll(() => page.evaluate(() => window.__docs.length)).toBe(1);
    const doc = (await page.evaluate(() => window.__docs))[0];
    expect(doc).toContain('Devolución');
    expect(doc).not.toContain('de lote');
  });

  test('ordenar equipos: se marcan los de CPT MT y todos los demás pasan a CPT BT en la Cucumacayán', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await nav(page, 'Equipos');
    await expect(page.locator('.inv-aviso').first()).toContainText('no tienen área dueña');
    await page.getByRole('button', { name: 'Ordenar equipos' }).first().click();
    await expect(page.locator('.memo-nuevo h2')).toHaveText('Ordenar equipos');
    // Se marcan los dos de CPT MT (SN-105 está guardado en Plantel; SN-100 está en campo)
    await page.locator('.memo-eq', { hasText: 'SN-105' }).click();
    await page.locator('.memo-eq', { hasText: 'SN-100' }).click();
    await expect(page.locator('.ordenar-resumen')).toContainText('2CPT MT');
    // SN-101 está en campo y SN-103 prestado: no se mueven; SN-106 (guardado en Plantel) pasa a la Cucumacayán
    await expect(page.locator('.memo-eq', { hasText: 'SN-106' })).toContainText('Plantel Central → Cucumacayán');
    await expect(page.locator('.memo-eq', { hasText: 'SN-101' })).not.toContainText('→ Cucumacayán');
    await page.locator('.memo-pie').getByRole('button', { name: 'Guardar' }).click();
    const esc = Object.fromEntries((await app.escrituras()).filter(([op, ruta]) => op === 'update' && ruta.startsWith('equipos/')).map(([, r, d]) => [r.split('/')[1], d]));
    expect(esc.e6).toMatchObject({ area: 'CPT MT' }); expect(esc.e6.sede).toBeUndefined();
    expect(esc.e1).toMatchObject({ area: 'CPT MT' });
    expect(esc.e7).toMatchObject({ area: 'CPT BT', sede: 'Subestación Cucumacayán' });
    expect(esc.e2).toMatchObject({ area: 'CPT BT' }); expect(esc.e2.sede).toBeUndefined(); // en campo
    expect(esc.e4).toMatchObject({ area: 'CPT BT' }); expect(esc.e4.sede).toBeUndefined(); // prestado
    expect(esc.e3).toMatchObject({ area: 'CPT BT' }); expect(esc.e3.sede).toBeUndefined(); // ya estaba en la Cucumacayán
  });

  test('al retirar un equipo de Campos y Servicios la devolución se registra sola', async ({ page }) => {
    app = await abrirApp(page, { datos: conAreas() });
    await cerrarAlerta(page);
    await app.ejecutar(() => { switchTab('instalaciones'); openRetiroModal('r5'); });
    await page.locator(`div[onclick="toggleSinProblema()"]`).click();
    await page.getByText('Sí, ya descargué').click();
    await page.getByText('Confirmar retiro').click();
    await expect.poll(async () => (await app.escrituras()).length).toBe(2);
    const [, [, ruta, datos]] = await app.escrituras();
    expect(ruta).toBe('equipos/e5');
    expect(datos).toMatchObject({ sede: 'Subestación Cucumacayán', prestado: false });
    expect(datos.movimientos.at(-1)).toMatchObject({ tipo: 'devolucion', de: 'Campos y Servicios', a: 'CPT MT', auto: true, nota: 'Devolución automática al retirar el caso #C-005' });
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

  test('acepta el formato de despacho de BT: encabezado más abajo, fechas de Excel, ubicación y retiro elegido al cargar', async ({ page }) => {
    const XLSX = require('xlsx');
    const serial = (Date.UTC(2026, 8, 4) - Date.UTC(1899, 11, 30)) / 864e5; // 04/09/2026 (el Excel lo muestra 9/4/26)
    const filas = [
      ['De: Calidad de producto BT'], ['Para: Campos y servicios.'], ['Asunto: Asignación de equipos'], ['Fecha: 04 DE SEPTIEMBRE'], [],
      ['Mediante la presente se notifica asignación de 2 equipos'], [],
      ['Número SIGET', 'Equipo', 'Id del Usuario', 'Nombre del Usuario', 'DIRECCION', 'Fecha instalación', 'Transformador', 'Medidor', 'Accesorio', 'Ubicación'],
      ['CR192026901', 'SN-105', 100001, 'Usuario de prueba A', 'Colonia Ejemplo 1', serial, 'T-1', 'M-1', 'Cables', '13.5 -88.8'],
      ['CR192026902', 'sn-106', 100002, 'Usuario de prueba B', 'Colonia Ejemplo 2', serial, 'T-2', 'M-2', 'Cables', '13.6 -88.9'],
      [], [], ['', '', '', 'Firma de quien entrega'], ['', '', '', 'Unidad de Calidad', '', '', '', 'Campos & Servicios'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(filas);
    for (const c of ['F9', 'F10']) ws[c].z = 'm/d/yy';
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
    app = await abrirApp(page, { excel: true });
    await cerrarAlerta(page);
    await nav(page, 'Despachos');
    await app.ejecutar(() => setCargaSubView('subir'));
    await page.locator('input[type=file][accept=".xlsx,.xls"]').setInputFiles({ name: 'Despacho_BT.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) });
    // Dos filas (las firmas del pie no cuentan), con la fecha bien leída y sin retiro
    await expect(app$(page)).toContainText('2 equipos sin fecha de retiro');
    await expect(app$(page)).toContainText('Inst: 04/09/2026');
    await expect(app$(page)).not.toContainText('Sin serie');
    await page.locator('#carga-retiro').fill('2026-09-11');
    await page.getByRole('button', { name: 'Poner fecha' }).click();
    await expect(app$(page)).toContainText('Retiro: 11/09/2026');
    await page.getByRole('button', { name: /Confirmar e importar \(2 equipos\)/ }).click();
    const inst = (await app.escrituras()).filter(([op, ruta]) => op === 'push' && ruta === 'analizadores').map(e => e[2]);
    expect(inst).toHaveLength(2);
    expect(inst[0]).toMatchObject({ serie: 'SN-105', caso: 'CR192026901', fechaInstalacion: '2026-09-04', fechaRetiro: '2026-09-11', lat: '13.5', lng: '-88.8', areaBeneficiaria: 'CPT BT' });
    expect(inst[1]).toMatchObject({ caso: 'CR192026902', lat: '13.6', lng: '-88.9' });
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
    expect(memo).toContain('Envío a revisión');
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
    const datos = (await app.escrituras()).find(([op, ruta]) => op === 'update' && ruta === 'equipos/e5')[2];
    expect(datos).toMatchObject({ sede: 'Subestación Cucumacayán', prestado: false });
    expect(datos.movimientos.at(-1)).toMatchObject({ tipo: 'devolucion', de: 'Campos y Servicios', auto: true });
  });

  test('la devolución de Campos y Servicios a CPT MT deja el equipo en la Cucumacayán', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const m = await import('/js/domain/inventario.js');
      return [m.sedeDespues({ tipo: 'devolucion', de: 'Campos y Servicios', a: 'CPT MT' }), m.sedeDespues({ tipo: 'devolucion', de: 'CPT BT', a: 'CPT MT' }), m.sedeDespues({ tipo: 'prestamo', de: 'CPT MT', a: 'CPT BT' })];
    });
    expect(r).toEqual(['Subestación Cucumacayán', 'Plantel Central', 'Subestación Cucumacayán']);
  });

  test('eliminar el préstamo a Campos y Servicios devuelve el equipo a la Cucumacayán', async ({ page }) => {
    await app.ejecutar(() => eliminarMovimiento('e5', 0));
    const [, ruta, datos] = (await app.escrituras()).at(-1);
    expect(ruta).toBe('equipos/e5');
    expect(datos).toMatchObject({ prestado: false, sede: 'Subestación Cucumacayán' });
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
    for (const texto of ['Equipo dañado en campo', 'SN-106', '#C-006', 'Zaragoza', 'Carcasa quebrada', 'Fuera de servicio', 'Juan Pérez', 'David García']) {
      expect(memo, texto).toContain(texto);
    }
    // Retiro programado (10/09) y fecha del daño (retiro real, 12/09)
    expect(memo).toMatch(/Retiro programado<\/div><div class="dato-val">10\/09\/2026/);
    expect(memo).toMatch(/Fecha del daño<\/div><div class="dato-val">12\/09\/2026/);
    expect(memo.match(/class="firma-eti"/g)).toHaveLength(3);
    expect(memo).toContain('<div class="firma-eti">Subestación Cucumacayán</div>');
    expect(memo).toContain('<div class="firma-eti">Campos y Servicios</div>');

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
    const [a, b] = await Promise.all(['SN-105', 'SN-106'].map(s => page.locator('.eq-lista > .eq-item', { hasText: s }).boundingBox()));
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
    expect((await docs())[0]).toMatch(/firma-eti">CPT MT<\/div>\s*<div class="firma-nom">Bryan Francia/);
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
    expect((await docs())[0]).toMatch(/firma-nom">Francisco Chulo<\/div>\s*<div class="firma-sub">CPT BT/);
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

  test('multiplicadores: listado y mapa de los puntos por validar (pendientes y acceso denegado)', async ({ page }) => {
    const XLSX = require('xlsx');
    const datos = conCampana();
    const casos = datos.campanas['2026-10_CPT-MT'].casos;
    Object.assign(casos.CR1O2026201, { lat: 13.67, lng: -89.28, mult: { estado: 'Realizado' } });
    Object.assign(casos.CR1O2026202, { lat: 13.68, lng: -89.27, mult: { estado: 'Pendiente de validar', notas: 'Llamar antes' } });
    Object.assign(casos.DA1O2026011O00, { mult: { estado: 'Acceso denegado' } });
    casos.CR1O2026203 = { ...casos.CR1O2026202, codigo: 'CR1O2026203', codigoEnte: 'CR1O2026203', nc: '333', mult: {} }; // sin estado: no va
    casos.CR1O2026204 = { ...casos.CR1O2026202, codigo: 'CR1O2026204', codigoEnte: 'CR1O2026204', nc: '444', mult: { estado: 'Revisar' } }; // tampoco
    app = await abrirApp(page, { datos, excel: true });
    await cerrarAlerta(page);
    await app.ejecutar(() => { abrirCampanaTrabajo('2026-10_CPT-MT'); setCampanaVista('multiplicadores'); });
    // Por validar: el pendiente y el de acceso denegado (no el realizado, el sin estado ni el de revisar)
    let descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Listado por validar (2)' }).click();
    let archivo = await descarga;
    expect(archivo.suggestedFilename()).toBe('Por_validar_Octubre_2026_CPT_MT.xlsx');
    const filas = XLSX.utils.sheet_to_json(XLSX.readFile(await archivo.path()).Sheets['Por validar'], { header: 1 });
    expect(filas[0].slice(-2)).toEqual(['ESTADO', 'NOTAS']);
    expect(filas.slice(1).map(f => [f[1], f[11], f[12]])).toEqual([['CR1O2026202', 'Pendiente de validar', 'Llamar antes'], ['DA1O2026011O00', 'Acceso denegado', '']]);
    descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Mapa por validar' }).click();
    archivo = await descarga;
    const kml = require('fs').readFileSync(await archivo.path(), 'utf8');
    expect(kml.match(/<Placemark>/g)).toHaveLength(1);
    expect(kml).toContain('<name>CR1O2026202</name>');
    expect(kml).toContain('<Data name="ESTADO"><value>Pendiente de validar</value></Data>');
    await expect(page.locator('.toast')).toContainText('Sin coordenadas: DA1O2026011O00');
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
    // En Inicio, primero los casos FT con su siguiente paso (01/07 + 90 = 29/09: día 84)
    const caso = page.locator('.ft-caso', { hasText: 'CR1O2026201' });
    await expect(caso).toContainText('Avisar a DELSUR por correo');
    await expect(caso).toContainText('Día 84 de 90');
    await expect(page.locator('.pendiente', { hasText: 'Avisar a DELSUR' })).toHaveCount(0); // no se repite en Pendientes
    await caso.click();
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

  test('seguimiento FT: subir al sistema, Resumen punto medido y fotos de los trabajos para la remedición', async ({ page }) => {
    const datos = conCampana();
    datos.analizadores = { ...datos.analizadores, r20: { serie: 'SN-300', caso: 'CR1O2026201', fechaInstalacion: '2026-09-01', fechaRetiro: '2026-09-09', areaInstalacion: 'CPT MT', retirado: true, fechaRetiroReal: '2026-09-09', fechaRegistro: '2026-09-01' } };
    datos.campanas['2026-10_CPT-MT'].casos.CR1O2026201.resultado = { medicion: 'valida', tolerancia: 'fuera' };
    datos.campanas['2026-10_CPT-MT'].casos.CR1O2026201.ft = { aviso: { fecha: '2026-09-20', por: 'David García' } };
    app = await abrirApp(page, { datos });
    await cerrarAlerta(page);
    // En Inicio, hasta marcarlos
    // En Inicio, el caso FT va primero con el paso que sigue (el aviso ya está: toca subirlo al sistema)
    const ftInicio = page.locator('.ini-ft .ft-caso', { hasText: 'CR1O2026201' });
    await expect(ftInicio.locator('.ft-sig')).toContainText('Subir el caso al sistema');
    await expect(ftInicio.locator('.ft-pasos')).toContainText('1 de 6');
    const orden = await page.evaluate(() => [...document.querySelectorAll('.inicio-layout > div')].map(d => d.className));
    expect(orden.indexOf('ini-ft')).toBeLessThan(orden.indexOf('ini-pend'));
    await nav(page, 'Seguimiento FT');
    const card = page.locator('.card', { hasText: 'CR1O2026201' });
    await expect(card).toContainText('Falta subir al sistema');
    await expect(card).toContainText('Falta enviar Resumen punto medido');
    await card.click();
    const modal = page.locator('.modal');
    await expect(modal).toContainText('la gráfica que genera el sistema');
    await expect(modal.locator('.aviso-fotos')).toContainText('toma fotografías de los trabajos realizados');
    await expect(modal.locator('.aviso-fotos')).toContainText('MEMOS');
    await modal.getByRole('button', { name: 'Marcar caso subido al sistema' }).click();
    expect((await app.escrituras()).at(-1)).toEqual(['set', 'campanas/2026-10_CPT-MT/casos/CR1O2026201/ft/sistema', { fecha: '2026-09-23', por: 'David García' }]);
    await modal.getByRole('button', { name: 'Marcar Resumen punto medido enviado' }).click();
    expect((await app.escrituras()).at(-1)[1]).toBe('campanas/2026-10_CPT-MT/casos/CR1O2026201/ft/resumen');
    await expect(modal).toContainText('Enviado el 23/09/2026 por David García');
    await app.ejecutar(() => cerrarFT());
    await expect(card).not.toContainText('Falta subir al sistema');
    // Al registrar la remedición (CR2…), el recordatorio de las fotos aparece mientras se escribe el código
    await app.ejecutar(() => newInstallFromDash());
    const codigo = page.getByPlaceholder('Ej: CR1D2025201');
    await codigo.fill('CR1O2026202');
    await expect(page.locator('#aviso-remedicion')).toBeEmpty();
    await codigo.fill('CR2O2026201');
    await expect(page.locator('#aviso-remedicion')).toContainText('Remedición del caso FT CR1O2026201');
    await expect(page.locator('#aviso-remedicion .aviso-fotos')).toContainText('MEMOS');
    // Marcadas las fotos en el seguimiento, ya no insiste
    await app.ejecutar(() => { abrirFT('2026-10_CPT-MT', 'CR1O2026201'); });
    await page.locator('.modal').getByRole('button', { name: 'Marcar fotos subidas a MEMOS' }).click();
    await expect(page.locator('.modal .aviso-fotos')).toHaveCount(0);
    await expect(page.locator('.modal')).toContainText('Fotos subidas a MEMOS el 23/09/2026');
  });

  test('Inicio y aviso al abrir: los casos FT van primero, con las fotos de los trabajos cuando ya hay remedición', async ({ page }) => {
    const datos = conCampana();
    datos.analizadores = { ...datos.analizadores,
      r20: { serie: 'SN-300', caso: 'CR1O2026201', fechaInstalacion: '2026-09-01', fechaRetiro: '2026-09-09', areaInstalacion: 'CPT MT', retirado: true, fechaRetiroReal: '2026-09-09', fechaRegistro: '2026-09-01' },
      r21: { serie: 'SN-301', caso: 'CR2O2026201', fechaInstalacion: '2026-09-20', fechaRetiro: '2026-09-24', areaInstalacion: 'CPT MT', fechaRegistro: '2026-09-20' } };
    const f = { fecha: '2026-09-10', por: 'David García' };
    Object.assign(datos.campanas['2026-10_CPT-MT'].casos.CR1O2026201, { resultado: { medicion: 'valida', tolerancia: 'fuera' }, ft: { aviso: f, sistema: f, resumen: f, ruta: 'Transferencia de alimentador' } });
    app = await abrirApp(page, { datos });
    // Aviso al abrir: primero el caso FT con su paso, después los retiros
    const aviso = page.locator('.aviso-inicio');
    await expect(aviso).toContainText('Antes de empezar');
    await expect(aviso.locator('.aviso-inicio-sec').first()).toHaveText('Casos FT: lo primero');
    await expect(aviso.locator('.aviso-inicio-fila.ft')).toContainText('Tomar fotos de los trabajos y subirlas a MEMOS');
    await expect(aviso).toContainText('Retiros');
    await aviso.getByRole('button', { name: 'Cerrar' }).click();
    // En Inicio la remedición ya está en campo: las fotos son el siguiente paso y va marcado como urgente
    const caso = page.locator('.ft-caso', { hasText: 'CR1O2026201' });
    await expect(caso).toHaveClass(/urgente/);
    await expect(caso.locator('.ft-sig')).toContainText('Tomar fotos de los trabajos y subirlas a MEMOS');
    await expect(caso.locator('.ft-sig')).toContainText('La remedición CR2O2026201 ya está en campo');
    await expect(caso.locator('.ft-pasos')).toContainText('4 de 6');
  });

  test('informes: el conteo de 8 días es solo de reclamos; la remedición de un caso FT no lleva informe', async ({ page }) => {
    const datos = conCampana();
    datos.analizadores = { ...datos.analizadores,
      r20: { serie: 'SN-300', caso: 'CR1O2026201', fechaInstalacion: '2026-08-01', fechaRetiro: '2026-08-09', areaInstalacion: 'CPT MT', retirado: true, fechaRetiroReal: '2026-08-09', fechaRegistro: '2026-08-01' },
      r21: { serie: 'SN-301', caso: 'CR2O2026201', lugar: 'X', fechaInstalacion: '2026-09-12', fechaRetiro: '2026-09-23', areaInstalacion: 'CPT MT', fechaRegistro: '2026-09-12' },
      r22: { serie: 'SN-302', caso: 'RE292026456', lugar: 'Y', fechaInstalacion: '2026-09-15', fechaRetiro: '2026-09-23', areaInstalacion: 'CPT MT', fechaRegistro: '2026-09-15' } };
    const f = { fecha: '2026-08-10', por: 'David García' };
    Object.assign(datos.campanas['2026-10_CPT-MT'].casos.CR1O2026201, { resultado: { medicion: 'valida', tolerancia: 'fuera' }, ft: { aviso: f, sistema: f, resumen: f, ruta: 'Transferencia de alimentador', fotos: f } });
    app = await abrirApp(page, { datos });
    await cerrarAlerta(page);
    const retirar = async id => {
      await app.ejecutar(id => { switchTab('instalaciones'); openRetiroModal(id); }, id);
      await page.locator(`div[onclick="toggleSinProblema()"]`).click();
      await page.getByText('Sí, ya descargué').click();
      await page.getByText('Confirmar retiro').click();
    };
    // La remedición del caso FT: retiro normal, sin conteo de informe
    await retirar('r21');
    await expect(page.locator('.toast')).toHaveText('Equipo marcado como retirado');
    // El reclamo: empieza el conteo de 8 días
    await retirar('r22');
    await expect(page.locator('.toast')).toContainText('Empieza el conteo: 8 días para entregar el informe (vence el 01/10/2026)');
    await nav(page, 'Inicio');
    await expect(page.locator('.inf-caso', { hasText: 'RE292026456' })).toContainText('Quedan 8 días · vence el 01/10/2026');
    await expect(page.locator('.inf-caso', { hasText: 'CR2O2026201' })).toHaveCount(0);
    // En el caso FT solo cuenta el plazo de 90 días; con la remedición retirada sigue confirmar si se normalizó
    const caso = page.locator('.ft-caso', { hasText: 'CR1O2026201' });
    await expect(caso).toContainText('de 90');
    await expect(caso.locator('.ft-sig')).toContainText('Revisar la remedición: ¿se normalizó?');
    await expect(caso.locator('.ft-pasos')).toContainText('5 de 6');
  });

  test('seguimiento FT: pasados los 90 días queda vencido', async ({ page }) => {
    const datos = conCampana();
    datos.analizadores = { ...datos.analizadores, r20: { serie: 'SN-300', caso: 'CR1O2026201', fechaInstalacion: '2026-06-01', fechaRetiro: '2026-06-09', areaInstalacion: 'CPT MT', retirado: true, fechaRetiroReal: '2026-06-09', fechaRegistro: '2026-06-01' } };
    datos.campanas['2026-10_CPT-MT'].casos.CR1O2026201.resultado = { medicion: 'valida', tolerancia: 'fuera' };
    datos.campanas['2026-10_CPT-MT'].casos.CR1O2026201.ft = { aviso: { fecha: '2026-06-20', por: 'David García' } };
    app = await abrirApp(page, { datos });
    await cerrarAlerta(page);
    await expect(page.locator('.ft-caso', { hasText: 'CR1O2026201' })).toContainText('Plazo vencido');
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

// Armónicos a la medida: u(i, n, p) e iA(i, n, p) en V y A por orden (n = 1 fundamental), P(i, p) en kW
function txtArmonicosCon({ u, iA, P, filas = 144 }) {
  const enc = ['Fecha y Hora', 'U1 [V]', 'U2 [V]', 'U3 [V]', 'I1 [A]', 'I2 [A]', 'I3 [A]', 'I4 [A]', 'P1 [kW]', 'P2 [kW]', 'P3 [kW]', 'PTotal [kW]', 'FP1', 'FP2', 'FP3', 'EA1 [kWh]', 'EA2 [kWh]', 'EA3 [kWh]', 'EATot [kWh]'];
  for (let n = 1; n <= 25; n++) for (let p = 1; p <= 3; p++) enc.push(`Uarm${n}-${p}`);
  for (let n = 1; n <= 25; n++) for (let p = 1; p <= 4; p++) enc.push(`Iarm${n}-${p}`);
  enc.push('PST1 [p.u]', 'PST2 [p.u]', 'PST3 [p.u]');
  const out = [enc.join(',')];
  for (let i = 0; i < filas; i++) {
    const ps = [1, 2, 3].map(p => P(i, p));
    const f = [fechaTXT(i), 13200, 13200, 13200, 50, 50, 50, 1, ...ps, ps.reduce((a, b) => a + b, 0), 1, 1, 1, 0, 0, 0, 0];
    for (let n = 1; n <= 25; n++) for (let p = 1; p <= 3; p++) f.push(u(i, n, p));
    for (let n = 1; n <= 25; n++) for (let p = 1; p <= 4; p++) f.push(p === 4 ? 0 : iA(i, n, p));
    f.push(0.5, 0.5, 0.5);
    out.push(f.join(','));
  }
  return out.join('\r\n');
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
    expect(r.resumen.porFase['1']).toEqual({ ft: 10, febNoPer: 10 / 144 }); // dato de análisis por fase
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
    await expect(modal.locator('.bloque.diagnostico')).toContainText('Severidad de lo que no cumple');
    await expect(modal.locator('.bloque.diagnostico')).toContainText('H5');
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

  test('Graficar: proyección opcional con cambio de TAP (placas por red, curva punteada, resumen y todas las posiciones)', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await nav(page, 'Graficar');
    await page.locator('.graf-pagina input[type=file]').setInputFiles({ name: 'CR192026100.txt', mimeType: 'text/plain', buffer: Buffer.from(txtTension()) });
    await expect(page.locator('#ar-nominal')).toHaveValue('13200');
    await expect(page.locator('.veredicto-dtft').first()).toContainText('FebNoPer 6.94 %');
    // Apagada por defecto
    await expect(page.locator('#ar-tap-red')).toHaveCount(0);
    await page.locator('#ar-tap-activo').check();
    // Red de 23 kV: placas predeterminadas
    await page.locator('#ar-tap-red').selectOption('23kv');
    await expect(page.locator('#ar-tap-placa-1')).toHaveValue('14400');
    await expect(page.locator('#ar-tap-placa-5')).toHaveValue('12540');
    await page.locator('#ar-tap-actual').selectOption('3');
    // Sin propuesta ya sale la tabla de todas las posiciones; la 2 es la de menor FebNoPer
    const tabla = page.locator('.tap-tabla');
    await expect(tabla.locator('tbody tr')).toHaveCount(5);
    await expect(tabla.locator('tr', { hasText: 'actual' })).toContainText('6.94 % FT');
    await expect(tabla.locator('tr.tap-mejor')).toContainText('13,800');
    await expect(tabla.locator('tr.tap-mejor')).toContainText('0.00 % DT');
    await expect(tabla.locator('tbody tr').first()).toContainText('FT'); // posición 1: baja demasiado
    // Propuesta 2: resumen proyectado DT y curva punteada en la gráfica
    await page.locator('#ar-tap-propuesta').selectOption('2');
    const ver = page.locator('.tap-bloque .veredicto-dtft');
    await expect(ver).toContainText('DT');
    await expect(ver).toContainText('En TAP 2 (−4.35 %)');
    await expect(page.locator('[data-graf="u"] path.graf-linea.proy')).toHaveCount(3);
    await expect(page.locator('.graf-titulo', { hasText: 'proyectada en TAP 2' })).toHaveCount(1);
    // La medición sigue igual (FT); la proyección no la cambia
    await expect(page.locator('.veredicto-dtft').first()).toContainText('FebNoPer 6.94 %');
    // Placa corregida a mano (4.16 kV solo trae la posición 3)
    await page.locator('#ar-tap-red').selectOption('4.16kv');
    await expect(page.locator('#ar-tap-placa-3')).toHaveValue('2200');
    await expect(page.locator('#ar-tap-placa-2')).toHaveValue('');
    await expect(page.locator('.tap-bloque')).toContainText('Escribe la placa de la posición propuesta');
    await page.locator('#ar-tap-placa-2').fill('2255'); await page.locator('#ar-tap-placa-2').press('Enter');
    await expect(page.locator('.tap-bloque .veredicto-dtft')).toContainText('En TAP 2');
    expect((await app.escrituras()).length).toBe(0);
  });

  test('Graficar: subir un TXT en la pestaña rápida muestra DT o FT sin guardar nada', async ({ page }) => {
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await nav(page, 'Graficar');
    await page.locator('.graf-pagina input[type=file]').setInputFiles({ name: 'CR192026100.txt', mimeType: 'text/plain', buffer: Buffer.from(txtTension({ stotal: true })) });
    await expect(page.locator('#ar-nominal')).toHaveValue('13200');
    // FebNoPer por fase como dato y cargabilidad en % de la capacidad (STOTAL 400 kVA de 500 kVA)
    await expect(page.locator('.bloque', { hasText: 'FebNoPer por fase' })).toContainText('10 de 144');
    await page.locator('#ar-kva').fill('500'); await page.locator('#ar-kva').press('Enter');
    await expect(page.locator('.tabla-est', { hasText: '% de la capacidad' })).toContainText('80.0 %');
    await expect(page.locator('.veredicto-dtft')).toContainText('FT');
    await expect(page.locator('.veredicto-dtft')).toContainText('FebNoPer 6.94 %');
    await page.locator('#ar-red').selectOption('rural_bt');
    await expect(page.locator('.veredicto-dtft')).toContainText('DT');
    await expect(page.getByRole('button', { name: 'Guardar en el reclamo' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Excel de tensión' })).toBeVisible();
    expect((await app.escrituras()).length).toBe(0);
    // Zoom: arrastrar sobre una gráfica acerca ese tramo; Restablecer vuelve a verlo todo
    const area = page.locator('[data-graf="u"]'); await area.scrollIntoViewIfNeeded(); const caja = await area.boundingBox();
    await page.mouse.move(caja.x + caja.width * 0.1, caja.y + caja.height / 2); await page.mouse.down();
    await page.mouse.move(caja.x + caja.width * 0.4, caja.y + caja.height / 2, { steps: 5 }); await page.mouse.up();
    await expect(page.locator('.graf-herramientas')).toContainText('Viendo del');
    await page.getByRole('button', { name: 'Restablecer zoom' }).click();
    await expect(page.locator('.graf-herramientas')).toContainText('Arrastra sobre una gráfica');
    // Combinada con dos unidades: la segunda va al eje derecho; una tercera unidad no se permite
    await page.locator('.combo-grupo', { hasText: 'Tensión mínima' }).getByRole('button', { name: 'U1 mín' }).click();
    await page.locator('.combo-grupo', { hasText: 'Corriente máxima' }).getByRole('button', { name: 'I1 máx' }).click();
    await page.locator('.combo-grupo', { hasText: 'Flicker PST' }).getByRole('button', { name: 'PST1' }).click();
    await expect(page.locator('.toast')).toContainText('dos unidades');
    await page.getByRole('button', { name: /Agregar gráfica combinada/ }).click();
    await expect(page.locator('.combo-graf')).toContainText('Tensión mínima vs Corriente máxima');
    await expect(page.locator('.combo-graf')).toContainText('(eje der.)');
    await page.getByRole('button', { name: 'Empezar de nuevo' }).click();
    await expect(page.locator('.arch-slot.lleno')).toHaveCount(0);
  });

  test('diagnóstico de armónicos: amperios, tipo de carga, origen como indicio, horario y severidad', async ({ page }) => {
    app = await abrirApp(page);
    // Caso 1: variadores del usuario. De día (8 a 17 h) inyecta H5/H7 y la tensión H5 sube con ella; la fase 3 con muy poca corriente
    const dia = i => { const h = Math.floor(i / 6) % 24; return h >= 8 && h < 17; };
    const usuario = txtArmonicosCon({
      u: (i, n, p) => (n === 1 ? 7620 : n === 5 ? 7620 * (dia(i) ? 0.065 : 0.02) : 0),
      iA: (i, n, p) => { const i1 = p === 3 ? 1.5 : dia(i) ? 100 : 30; return n === 1 ? i1 : n === 5 ? i1 * (p === 3 ? 0.5 : dia(i) ? 0.3 : 0.05) : n === 7 ? i1 * (p === 3 ? 0.2 : dia(i) ? 0.12 : 0.02) : 0; },
      P: (i, p) => (p === 3 ? 5 : dia(i) ? 60 : 20),
    });
    // Caso 2: red. H3 de tensión alto de noche, sin relación con la corriente del usuario (constante); banco Y-Δ en MT
    const red = txtArmonicosCon({
      u: (i, n, p) => (n === 1 ? 7620 : n === 3 ? 7620 * (dia(i) ? 0.02 : 0.06 + 0.002 * ((i * 7) % 5)) : 0),
      iA: (i, n, p) => (n === 1 ? 80 : n === 5 ? 80 * (0.1 + 0.01 * ((i * 3) % 4)) : 0),
      P: () => 40,
    });
    const r = await page.evaluate(async ([tu, tr]) => {
      const m = await import('/js/domain/reclamo.js');
      const d = await import('/js/domain/diagnostico.js');
      const a1 = d.diagnosticarArmonicos(m.analizarArmonicos(tu, 3), { enMT: false, cargas: { vfd: true } });
      const a2 = d.diagnosticarArmonicos(m.analizarArmonicos(tr, 3), { enMT: true, subestacion: { tipo: 'tri', conexionPri: 'Estrella', conexionSec: 'Delta' } });
      return { a1: { infladas: a1.amperios.infladas, dom: a1.dominantes.map(x => x.n), tipos: a1.tipos.map(t => t.clave), indicio: a1.origen.indicio, sevI: a1.severidad.corriente.map(x => x.n), parrafos: a1.parrafos },
        a2: { indicio: a2.origen.indicio, delta: a2.origen.delta, sevV: a2.severidad.tension.map(x => ({ n: x.n, veces: x.veces })), parrafos: a2.parrafos },
        r: [d.correlacion([1, 2, 3, 4], [2, 4, 6, 8]), d.correlacion([1, 1, 1], [1, 2, 3])] };
    }, [usuario, red]);
    expect(r.r[0]).toBeCloseTo(1, 6); expect(r.r[1]).toBeNull();
    // Usuario: F3 con DATI alto por poca carga; H5/H7 de variadores; la tensión sigue a su corriente
    expect(r.a1.infladas).toEqual(['3']);
    expect(r.a1.dom.slice(0, 2)).toEqual([5, 7]);
    expect(r.a1.tipos).toContain('seisPulsos');
    expect(r.a1.indicio).toBe('usuario');
    expect(r.a1.parrafos.join(' ')).toContain('Esto concuerda con los variadores de frecuencia identificados en la inspección.');
    expect(r.a1.parrafos.join(' ')).toContain('sugiere que las cargas del usuario contribuyen');
    expect(r.a1.parrafos.join(' ')).toContain('conviene leerlo junto con su valor en amperios');
    expect(r.a1.parrafos.join(' ')).not.toContain('Art. 49'); // la fase 3 sí tuvo carga (P ≥ 3.5 kW)
    expect(r.a1.sevI).toContain(5);
    // Red: la tensión no sigue al usuario; con delta, el H3 medido en MT no viene del usuario
    expect(r.a2.indicio).toBe('red');
    expect(r.a2.delta).toBe(true);
    expect(r.a2.sevV[0].n).toBe(3);
    expect(r.a2.sevV[0].veces).toBeGreaterThan(1);
    const t2 = r.a2.parrafos.join(' ');
    expect(t2).toContain('sugiere que proviene principalmente de la red');
    expect(t2).toContain('el H3 de tensión medido en media tensión no puede atribuirse a las cargas del usuario');
    expect(t2).toMatch(/La distorsión de tensión es mayor en promedio entre las (0\d|1[7-9]|2\d):00/); // de noche
    expect(t2).toContain('La corriente armónica del usuario se mantiene prácticamente constante a lo largo del día');
    expect(r.a1.parrafos.join(' ')).toContain('Ambos máximos coinciden en horario.');
  });

  test('borrador de informe: redacta las secciones con los datos del expediente y del análisis', async ({ page }) => {
    app = await abrirApp(page);
    const b = await page.evaluate(async ([tt, ta]) => {
      const m = await import('/js/domain/reclamo.js');
      const inf = await import('/js/domain/informe.js');
      const d = m.leerTension(tt);
      const params = { fases: 3, nominal: '13200', red: 'urbano_mt', relV: '13200/120', relI: '800/5' };
      const t = m.analizarTension(d, { fases: 3, nominal: 13200, tol: 0.06 });
      const arm = m.analizarArmonicos(ta, 3);
      const exp = { codigo: 'RE192026456', wo: 'WO-100200', ct: 'CT10001', motivo: 'Se requiere el estudio de voltaje', nc: '900100', nombre: 'USUARIO DE PRUEBA', direccion: 'CALLE PRUEBA 1' };
      const inst = { serie: 'SN-202', modelo: 'PQ-2', caso: 'RE192026456', fechaInstalacion: '2026-09-01', fechaRetiroReal: '2026-09-02' };
      return { bloques: inf.borradorInforme({ exp, inst, params, d, t, arm, hoy: '2026-10-11' }), periodo: inf.periodoTexto('28/07/2026 10:00', '03/08/2026 09:50'), rel: inf.leerRelacion('22290 / 240') };
    }, [txtTension(), txtArmonicos()]);
    const texto = b.bloques.map(x => x.texto || '').join('\n');
    expect(b.periodo).toBe('28 de julio al 3 de agosto del 2026');
    expect(b.rel.factor).toBeCloseTo(92.875, 6);
    // Generalidades y equipo de medición
    const [gen, equipo] = b.bloques.filter(x => x.t === 'tabla' && x.encabezado[0] === 'Característica');
    expect(gen.filas).toContainEqual(['Referencia eléctrica (CT)', 'CT10001']);
    expect(gen.filas).toContainEqual(['Circuito / Subestación', '[completar]']);
    expect(equipo.filas).toContainEqual(['Analizador de redes', 'PQ-2: SN-202']);
    expect(equipo.filas).toContainEqual(['Factor multiplicador', 'Voltaje= 13200/120   Corriente= 800/5']);
    expect(equipo.filas).toContainEqual(['Intervalo de regulación de tensión', '10 minutos']);
    expect(equipo.filas).toContainEqual(['Total de registros', '144 registros (tensión) · 144 registros (armónicos)']);
    // Regulación: FEBNoPer con su fórmula y el periodo
    expect(texto).toContain('4.1. Resultados de calidad de energía en media tensión – 1 de septiembre del 2026');
    expect(texto).toContain('se obtuvo un total de 144 registros, de los cuales se obtuvieron 0 registros inválidos y 10 registros fuera de tolerancia');
    expect(texto).toContain('FEBNoPer = NtrgNoPer / NrgTOT = 10 / (144 − 0) × 100% = 6.94%');
    expect(texto).toContain('4.2. Perfil de tensión secundario');
    expect(texto).toContain('4.3. Perfil de corriente medido');
    expect(texto).toContain('4.4. Perfil de distorsión por efecto parpadeo flicker');
    // Flicker: P95 cumple aunque haya un pico
    expect(texto).toContain('resultó en 0.5000, 0.5000 y 0.5000 para las fases U1, U2 y U3 respectivamente, dentro del límite unitario');
    expect(texto).toContain('Se observa 1 registro puntual que supera el límite de referencia (1 en U1)');
    expect(texto).not.toContain('mayor magnitud'); // con corrientes iguales no se inventa una fase mayor
    // Armónicos: el VDAT cumple pero el H5 de la fase 1 no (como el hallazgo del informe)
    expect(texto).toContain('No obstante, el armónico individual H5 incumple su límite propio (6.00%) en la Fase 1');
    // Conclusiones con su veredicto
    const concl = b.bloques.find(x => x.t === 'tabla' && x.encabezado[0] === 'Parámetro' && x.encabezado[1] === 'Límite SIGET');
    expect(concl.filas[0]).toEqual(['Regulación de tensión (MT)', '±6% (Art. 22-23)', 'FEBNoPer 6.9%', 'NO CUMPLE']);
    expect(concl.filas.map(f => f[0])).toEqual(['Regulación de tensión (MT)', 'Flicker Pst', 'Armónicos de tensión (VDAT)', 'Armónicos individuales de tensión', 'Armónicos de corriente (DATI)', 'Continuidad (SAIFI/SAIDI)']);
    expect(concl.filas[3][3]).toBe('NO CUMPLE');
    expect(b.bloques.filter(x => x.t === 'vineta').length).toBe(4);
    expect(texto).toContain('5.3. Diagnóstico');
  });

  test('descarga el borrador de informe en Word desde el análisis del reclamo', async ({ page }) => {
    app = await abrirApp(page, { excel: true });
    await cerrarAlerta(page);
    await page.evaluate(([tt, ta]) => {
      abrirAnalisisReclamo('r9');
      cargarTXTReclamo([{ nombre: 'RE192026456.txt', texto: tt }, { nombre: 'RE1920264560.txt', texto: ta }]);
    }, [txtTension(), txtArmonicos()]);
    await page.locator('#ar-reli').fill('800/5'); await page.locator('#ar-reli').press('Tab');
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Borrador de informe (Word)' }).click();
    const d = await descarga;
    expect(d.suggestedFilename()).toBe('RE192026456_Borrador_informe.docx');
    const XLSX = require('xlsx-js-style');
    const zip = XLSX.CFB.read(require('fs').readFileSync(await d.path()), { type: 'buffer' });
    const doc = Buffer.from(XLSX.CFB.find(zip, '/word/document.xml').content).toString();
    expect(doc).toContain('INFORME DE RECLAMO RE192026456');
    expect(doc).toContain('USUARIO DE PRUEBA');
    expect(doc).toContain('Corriente= 800/5');
    expect(doc).toContain('w:highlight w:val="yellow"'); // lo que falta va resaltado
    expect(XLSX.CFB.find(zip, '/word/styles.xml')).toBeTruthy();
    expect(XLSX.CFB.find(zip, '/[Content_Types].xml')).toBeTruthy();
  });

  test('inspección: reglas de puesta a tierra y del rango de placa del equipo', async ({ page }) => {
    app = await abrirApp(page);
    const r = await page.evaluate(async tt => {
      const m = await import('/js/domain/reclamo.js');
      const i = await import('/js/domain/inspeccion.js');
      const d = m.leerTension(tt);
      return {
        tierra: [i.veredictoTierra('22.3'), i.veredictoTierra(25), i.veredictoTierra('320'), i.veredictoTierra('')],
        kva: [i.kvaTotal({ tipo: 'bi', kvas: { 1: '50', 2: '25', 3: '999' } }), i.kvaTotal({ tipo: 'tri', kvas: { 1: '100', 2: '100', 3: '100' } }), i.kvaTotal({ tipo: 'tri', construccion: 'unidad', kvas: { 1: '300', 2: '5' } }), i.kvaTotal({ tipo: 'mono', kvas: { 1: '37.5' } })],
        cant: ['mono', 'bi', 'tri'].map(tipo => i.cantidadTrafos({ tipo })),
        vacia: [i.inspeccionVacia({ firmas: { inspector1: { nombre: 'X' } } }), i.inspeccionVacia({ general: { planta: true } })],
        // 13200 V entre 12 000 y 13 500: los 10 registros al 8 % (14 256 V) quedan arriba → 6.9 % del tiempo
        eq: i.tensionVsEquipo(d.U, ['1', '2', '3'], { vmin: '12000', vmax: '13500' }),
        // Secundario equivalente (÷ 55) contra 200–240 V: 13200/55 = 240 dentro; 14256/55 = 259 arriba
        sec: i.tensionVsEquipo(d.U, ['1'], { vmin: 200, vmax: 240 }, 55),
        sinRango: i.tensionVsEquipo(d.U, ['1'], { vmin: '', vmax: 240 }),
      };
    }, txtTension());
    expect(r.tierra).toEqual(['CUMPLE', 'CUMPLE', 'NO CUMPLE', null]);
    expect(r.kva).toEqual([75, 300, 300, 37.5]); // bifásica suma 2 trafos; trifásica de 1 unidad usa solo el primero
    expect(r.cant).toEqual([1, 2, 3]);
    expect(r.vacia).toEqual([true, false]);
    expect(r.eq.porFase['1']).toMatchObject({ n: 144, arriba: 10, abajo: 0 });
    expect(r.eq.peor).toBeCloseTo(10 / 144, 6);
    expect(r.eq.cumple).toBe(false); // más del 5 % del tiempo
    expect(r.sec.porFase['1'].arriba).toBe(10);
    expect(r.sinRango).toBeNull();
  });

  test('inspección: abre lo llenado con la primera versión del formulario y lo pasa al formato nuevo', async ({ page }) => {
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    const datos = JSON.parse(JSON.stringify(fixture));
    datos.reclamos['RE-92026456'].inspeccion = { fecha: '2026-09-01', atendio: 'Persona X',
      subestacion: { tipo: 'Banco de transformadores', cantidad: '3', kva: '100', conexionPri: 'Estrella', conexionSec: 'Delta', tap: '4' },
      tableros: { a: { orden: 1, nombre: 'Tablero general', tierra: '22', protecciones: 'DPS en cada fase' } } };
    app = await abrirApp(page, { datos });
    await cerrarAlerta(page);
    await nav(page, 'Reclamos');
    await page.locator('.exp-card', { hasText: 'RE192026456' }).click();
    await page.getByRole('tab', { name: /Inspección/ }).click();
    await expect(page.locator('.insp-op.sel')).toHaveText(['Trifásica', 'Banco de 3 transformadores']);
    await expect(page.locator('.bloque', { hasText: 'Subestación del usuario' })).toContainText('300 kVA en total');
    await expect(page.locator('#insp-subestacion-conexionPri')).toHaveValue('Estrella');
    await expect(page.locator('#insp-subestacion-conexionSec')).toHaveValue('Delta');
    await expect(page.locator('input[id$="-protOtras"]')).toHaveValue('DPS en cada fase');
    await expect(page.locator('#insp-firmas-acompanante-nombre')).toHaveValue('Persona X');
    // Al editar cualquier campo se guarda en el formato nuevo
    await page.locator('#insp-circuito').fill('AL1'); await page.locator('#insp-circuito').press('Tab');
    await expect.poll(async () => (await app.escrituras()).some(([, ruta, v]) => ruta === 'reclamos/RE-92026456/inspeccion' && v['subestacion/tipo'] === 'tri' && v['subestacion/kvas']?.[3] === '100' && v.atendio === null)).toBe(true);
    expect(errores).toEqual([]);
  });

  test('inspección: formulario en el expediente, PDF con firmas y sección en el borrador', async ({ page }) => {
    app = await abrirApp(page, { excel: true });
    await cerrarAlerta(page);
    await nav(page, 'Reclamos');
    await page.locator('.exp-card', { hasText: 'RE192026456' }).click();
    await page.getByRole('tab', { name: /Inspección/ }).click();
    await expect(page.getByRole('tab', { name: /Inspección/ })).toContainText('Sin llenar');
    // Encabezado con los datos del expediente
    const cab = page.locator('.insp-cabecera');
    await expect(cab).toContainText('900100'); await expect(cab).toContainText('USUARIO DE PRUEBA'); await expect(cab).toContainText('DS100001 / CT10001'); await expect(cab).toContainText('MED-1');
    // Equipo de medición: de la instalación del reclamo
    await expect(page.locator('.bloque', { hasText: 'Equipo de medición' })).toContainText('RE192026456');
    await expect(page.locator('.insp-equipos')).toContainText('Punto principal');
    await expect(page.locator('.insp-equipos')).toContainText('PQ-2 · SN-202');
    const campo = async (sel, v) => { await page.locator(sel).fill(v); await page.locator(sel).press('Tab'); };
    await page.locator('#insp-fecha').fill('2026-09-01'); await page.locator('#insp-fecha').dispatchEvent('change');
    await campo('#insp-circuito', 'AL999-23KV');
    // Bifásica: dos transformadores que se suman; secundario delta abierta o estrella de 2 hilos
    await page.getByRole('button', { name: 'Bifásica' }).click();
    await expect(page.locator('#insp-subestacion-kvas-3')).toHaveCount(0);
    await campo('#insp-subestacion-kvas-1', '50'); await campo('#insp-subestacion-kvas-2', '25');
    await expect(page.locator('.bloque', { hasText: 'Subestación del usuario' })).toContainText('75 kVA en total');
    expect(await page.locator('#insp-subestacion-conexionSec option').allTextContents()).toEqual(['—', 'Delta abierta', 'Estrella de 2 hilos', 'Otra']);
    // Monofásica: un solo transformador y secundario monofásico fijo
    await page.getByRole('button', { name: 'Monofásica' }).click();
    await expect(page.locator('#insp-subestacion-kvas-2')).toHaveCount(0);
    await expect(page.locator('.field', { hasText: 'Conexión del secundario' }).locator('input')).toHaveValue('Monofásica');
    // Trifásica en banco: tres transformadores; conexiones delta o estrella
    await page.getByRole('button', { name: 'Trifásica' }).click();
    await page.getByRole('button', { name: 'Banco de 3 transformadores' }).click();
    for (const k of [1, 2, 3]) await campo(`#insp-subestacion-kvas-${k}`, '100');
    await expect(page.locator('.bloque', { hasText: 'Subestación del usuario' })).toContainText('300 kVA en total');
    await page.locator('#insp-subestacion-conexionPri').selectOption('Estrella');
    await page.locator('#insp-subestacion-conexionSec').selectOption('Delta');
    await page.locator('#insp-subestacion-montaje').selectOption('Poste');
    await campo('#insp-medidor-rtc', '600/5');
    await page.locator('#insp-general-trafosSecos').check();
    await page.getByRole('button', { name: 'Agregar transformador seco' }).click();
    await campo('.insp-item input[id$="-vSec"]', '240/120');
    await page.getByRole('button', { name: 'Agregar tablero' }).click();
    const tb = page.locator('.insp-item', { hasText: 'Tablero sin nombre' });
    await campo('.insp-item input[id^="insp-tableros-"][id$="-nombre"]', 'Sub-tablero del VFD');
    const tablero = page.locator('.insp-item', { hasText: 'Protecciones que tiene' });
    await tablero.locator('input[id$="-tierra"]').fill('abc'); await tablero.locator('input[id$="-tierra"]').press('Tab');
    await expect(page.locator('.toast')).toContainText('solo el número');
    await tablero.locator('input[id$="-tierra"]').fill('320'); await tablero.locator('input[id$="-tierra"]').press('Tab');
    await expect(tablero).toContainText('320 Ω · no cumple');
    await tablero.locator('label', { hasText: 'Supresor de transitorios' }).locator('input').check();
    await tablero.locator('label', { hasText: 'Corrosión' }).locator('input').check();
    await tablero.locator('input[id$="-lect-v12"]').fill('247'); await tablero.locator('input[id$="-lect-v12"]').press('Tab');
    await page.getByRole('button', { name: 'Agregar equipo dañado' }).click();
    const eq = page.locator('.insp-item', { hasText: 'Voltaje mínimo de placa' });
    await eq.locator('input[id$="-equipo"]').fill('Variador de frecuencia'); await eq.locator('input[id$="-equipo"]').press('Tab');
    await eq.locator('input[id$="-vmin"]').fill('12000'); await eq.locator('input[id$="-vmin"]').press('Tab');
    await eq.locator('input[id$="-vmax"]').fill('13500'); await eq.locator('input[id$="-vmax"]').press('Tab');
    await eq.locator('input[id$="-monto"]').fill('$1500'); await eq.locator('input[id$="-monto"]').press('Tab');
    await eq.locator('select[id$="-disponible"]').selectOption('no');
    // Firmas: el inspector firma en pantalla; el acompañante queda en blanco para firmar a mano
    await campo('#insp-firmas-acompanante-nombre', 'Persona de prueba'); await campo('#insp-firmas-acompanante-cargo', 'Mantenimiento');
    await page.locator('.insp-firma').first().getByRole('button', { name: 'Firmar en pantalla' }).click();
    await page.getByRole('button', { name: 'Guardar firma' }).click();
    await expect(page.locator('.toast')).toContainText('Firma dentro del recuadro');
    const lienzo = await page.locator('#firma-canvas').boundingBox();
    await page.mouse.move(lienzo.x + 40, lienzo.y + 60); await page.mouse.down();
    await page.mouse.move(lienzo.x + 200, lienzo.y + 90, { steps: 8 }); await page.mouse.move(lienzo.x + 300, lienzo.y + 40, { steps: 8 }); await page.mouse.up();
    await page.getByRole('button', { name: 'Guardar firma' }).click();
    await expect(page.locator('.insp-firma').first().locator('img.insp-firma-img')).toHaveCount(1);
    await expect(page.locator('.insp-firma').nth(2)).toContainText('Sin firma en pantalla');
    await expect(page.getByRole('tab', { name: /Inspección/ })).toContainText('Visita 01/09/2026');
    // PDF del formulario
    const html = await page.evaluate(async () => {
      const { buildFormularioInspeccion } = await import('/js/pdf/inspeccion.js');
      const { state } = await import('/js/state.js');
      const { medicionesExpediente } = await import('/js/domain/expedientes.js');
      const { equiposMedicion } = await import('/js/domain/inspeccion.js');
      const exp = { ...state.reclamos['RE-92026456'], id: 'RE-92026456' };
      const medicion = equiposMedicion(medicionesExpediente(exp, state.records, '2026-09-23'), state.equipos);
      return buildFormularioInspeccion(exp, exp.inspeccion, { inspector: 'David García', medicion });
    });
    expect(html).toContain('Formulario de');
    expect(html).toContain('Calidad del Producto Técnico</div>');
    expect(html).not.toContain('Documento generado');
    expect(html).toContain('CPT INNOVA'); // sin logo configurado
    const conLogo = await page.evaluate(async () => (await import('/js/pdf/inspeccion.js')).buildFormularioInspeccion({}, {}, { logo: 'data:image/png;base64,AAAA' }));
    expect(conLogo).toContain('<div class="marca marca-img"><img src="data:image/png;base64,AAAA" alt=""><div class="marca-sub">Calidad del Producto Técnico</div>');
    expect(conLogo).not.toContain('CPT INNOVA</div>');
    expect(html).toContain('Equipo de medición · RE192026456');
    expect(html).toMatch(/Punto principal<\/td><td class="val">PQ-2<\/td><td class="val">SN-202/);
    expect(html).toContain('DS100001 / CT10001');
    expect(html).toContain('<span class="cb on"><i></i>Trifásica</span>');
    expect(html).toContain('<span class="cb"><i></i>Monofásica</span>');
    expect(html).toContain('<b>Total: 300 kVA</b>');
    expect(html).toContain('<span class="cb on"><i></i>Supresor de transitorios (DPS / TVSS)</span>');
    expect(html).toContain('<span class="cb"><i></i>UPS</span>');
    expect(html).toContain('320 Ω');
    expect(html).toContain('data:image/png;base64,'); // firma del inspector
    expect(html).toContain('Persona de prueba');
    expect(html).toContain('David García');
    // Borrador desde el análisis con relación TC distinta a la del medidor (aviso para verificar)
    await page.evaluate(([tt, ta]) => {
      abrirAnalisisReclamo('r9');
      cargarTXTReclamo([{ nombre: 'RE192026456.txt', texto: tt }, { nombre: 'RE1920264560.txt', texto: ta }]);
      setParamReclamo('relI', '800/5');
    }, [txtTension(), txtArmonicos()]);
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Borrador de informe (Word)' }).click();
    const XLSX = require('xlsx-js-style');
    const zip = XLSX.CFB.read(require('fs').readFileSync(await (await descarga).path()), { type: 'buffer' });
    const doc = Buffer.from(XLSX.CFB.find(zip, '/word/document.xml').content).toString().replace(/<[^>]+>/g, '');
    expect(doc).toContain('AL999-23KV / [completar]');
    expect(doc).toContain('en compañía de Persona de prueba, Mantenimiento, por parte del usuario');
    expect(doc).toContain('La subestación en análisis es trifásica, conformada por un banco de tres transformadores con una capacidad nominal total de 300 kVA (3 × 100 kVA), con montaje en poste. El banco presenta una configuración estrella en el lado primario y delta en el lado secundario.');
    expect(doc).toContain('[verificar] La RTC del medidor (600/5) no coincide con la relación de corriente usada en la medición (800/5).');
    expect(doc).toContain('La instalación cuenta con transformadores secos.');
    expect(doc).toContain('El tablero cuenta con los siguientes elementos de protección: supresor de transitorios (DPS / TVSS).');
    expect(doc).toContain('Durante la inspección se observó: corrosión.');
    expect(doc).toContain('247 V');
    expect(doc).toContain('obteniéndose un valor de 320 Ω');
    expect(doc).toContain('ya no se encontraba disponible en sitio');
    expect(doc).toContain('$1500');
    expect(doc).toContain('Tensión frente al rango de operación del variador de frecuencia');
    expect(doc).toContain('Resistencia a tierra — Sub-tablero del VFD25 Ω (NEC 2008)320 ΩNO CUMPLE');
    expect(doc).toContain('6.9% del tiempo fuera de rangoNO CUMPLE');
  });

  test('descarga los Excel de tensión y armónicos con sus gráficas', async ({ page }) => {
    const XLSX = require('xlsx-js-style');
    app = await abrirApp(page, { excel: true });
    await cerrarAlerta(page);
    await page.evaluate(([tt, ta]) => {
      abrirAnalisisReclamo('r9');
      cargarTXTReclamo([{ nombre: 'RE192026456.txt', texto: tt }, { nombre: 'RE1920264560.txt', texto: ta }]);
      setParamReclamo('usuario', 'Empresa');
      toggleSerieComboReclamo('U.min.1'); toggleSerieComboReclamo('I.max.1'); agregarComboReclamo();
    }, [txtTension(), txtArmonicos()]);
    const bajar = async boton => { const d = page.waitForEvent('download'); await page.getByRole('button', { name: boton }).click(); return d; };
    const dt = await bajar('Excel de tensión');
    expect(dt.suggestedFilename()).toBe('RE192026456_Graficas.xlsx');
    const bt = require('fs').readFileSync(await dt.path());
    const wt = XLSX.read(bt);
    expect(wt.SheetNames).toEqual(['Tensión promedio', 'Tensión máxima', 'Tensión mínima', 'Corriente promedio', 'Corriente máxima', 'PST', 'Combinada 1']);
    const prom = XLSX.utils.sheet_to_json(wt.Sheets['Tensión promedio'], { header: 1 });
    expect(prom[0].slice(0, 6)).toEqual(['Fecha/Hora', 'U1 [V]', 'U2 [V]', 'U3 [V]', 'SOBRE+6%', 'SUB-6%']);
    expect(prom[1][0]).toBe('1/9/2026 00:00');
    // La gráfica va arriba (H2) y las tablas debajo: el resumen queda en las filas 25 a 27
    expect(prom[25].slice(7, 13)).toEqual(['Registros Totales', 'Registros Inválidos', 'Registros Válidos', 'Registros FT', 'FebNoPer', 'Estado']);
    expect(prom[26].slice(7, 13)).toEqual([144, 0, 144, 10, 10 / 144, 'FUERA DE TOLERANCIA']);
    // Cada hoja lleva su gráfica nativa de Excel, con las series apuntando a sus columnas
    const zt = XLSX.CFB.read(bt, { type: 'buffer' });
    const chart1 = Buffer.from(XLSX.CFB.find(zt, '/xl/charts/chart1.xml').content).toString();
    expect(chart1).toContain("'Tensión promedio'!$B$2:$B$145");
    expect(chart1).toContain('PERFIL DE TENSIÓN PROMEDIO - EMPRESA');
    expect(XLSX.CFB.find(zt, '/xl/charts/chart6.xml')).toBeTruthy();
    expect(Buffer.from(XLSX.CFB.find(zt, '/xl/worksheets/sheet1.xml').content).toString()).toContain('<drawing r:id="rIdDibujo1"/>');
    // Escala de tensión ajustada al nivel (13.2 kV ±6 %: 12 000 a 14 500), también en mínimos
    expect(chart1).toContain('<c:max val="14500"/><c:min val="12000"/>');
    expect(Buffer.from(XLSX.CFB.find(zt, '/xl/charts/chart3.xml').content).toString()).toContain('<c:min val="12000"/>');
    // Combinada: tensión mínima vs corriente máxima, la corriente en el eje derecho
    const combo = Buffer.from(XLSX.CFB.find(zt, '/xl/charts/chart7.xml').content).toString();
    expect(combo).toContain('TENSIÓN MÍNIMA VS CORRIENTE MÁXIMA');
    expect(combo).toContain('<c:axPos val="r"/>');
    expect(combo).toContain("'Combinada 1'!$C$2:$C$145");

    // Proyección con cambio de TAP activa: hoja propia con medida y proyectada (punteada), resumen y todas las posiciones
    await page.evaluate(() => { setTapReclamo('activo', true); setTapReclamo('red', '23kv'); setTapReclamo('actual', '3'); setTapReclamo('propuesta', '2'); });
    const dp = await bajar('Excel de tensión');
    const bp = require('fs').readFileSync(await dp.path());
    const wp = XLSX.read(bp);
    expect(wp.SheetNames.slice(0, 2)).toEqual(['Tensión promedio', 'Proyección TAP']);
    const proy = XLSX.utils.sheet_to_json(wp.Sheets['Proyección TAP'], { header: 1 });
    expect(proy[0].slice(0, 9)).toEqual(['Fecha/Hora', 'U1 [V]', 'U2 [V]', 'U3 [V]', 'U1 TAP 2 [V]', 'U2 TAP 2 [V]', 'U3 TAP 2 [V]', 'SOBRE+6%', 'SUB-6%']);
    expect(proy[1][4]).toBeCloseTo(14256 * 13200 / 13800, 2); // primer registro (alto) proyectado
    const fila = txt => proy.find(f => f.includes(txt));
    expect(fila('Posición propuesta')).toContain('2 (placa 13800 V)');
    const resumen = proy[proy.indexOf(fila('Registros Totales')) + 1].filter(v => v !== undefined && v !== null && v !== '');
    expect(resumen.slice(-2)).toEqual([0, 'DENTRO DE TOLERANCIA']);
    const pos2 = proy.find(f => f[10] === 2 && f[11] === 13800);
    expect(pos2).toContain('propuesta · menor FebNoPer');
    expect(proy.filter(f => typeof f[10] === 'number' && f[11] >= 12540 && f[11] <= 14400)).toHaveLength(5);
    const zp = XLSX.CFB.read(bp, { type: 'buffer' });
    const chartP = Buffer.from(XLSX.CFB.find(zp, '/xl/charts/chart2.xml').content).toString();
    expect(chartP).toContain('TENSIÓN PROMEDIO MEDIDA Y PROYECTADA EN TAP 2');
    expect(chartP).toContain("'Proyección TAP'!$E$2:$E$145");
    expect(chartP).toContain('<a:prstDash val="dash"/>');

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

test.describe('Herramienta Dibujar', () => {
  // Imagen de fondo hecha en el navegador (w×h) y subida con el botón
  async function subirImagen(page, w, h) {
    const png = await page.evaluate(([w, h]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#e5e7eb'; x.fillRect(0, 0, w, h); return c.toDataURL('image/png').split(',')[1]; }, [w, h]);
    await page.locator('label', { hasText: /Subir imagen|Cambiar imagen/ }).locator('input').setInputFiles({ name: 'mapa.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await expect(page.locator('#dib-svg')).toHaveAttribute('viewBox', new RegExp(`^0 0 ${w} `));
  }
  // Coordenadas de pantalla de un punto del plano (en píxeles de la imagen)
  // (se sube al inicio para que la barra fija no tape el lienzo)
  // (se lleva el punto al centro de la ventana para que la barra fija no lo tape)
  const pantalla = async (page, x, y) => page.evaluate(([x, y]) => {
    const s = document.getElementById('dib-svg'); const a = new DOMPoint(x, y).matrixTransform(s.getScreenCTM());
    window.scrollBy(0, a.y - window.innerHeight / 2);
    const p = new DOMPoint(x, y).matrixTransform(s.getScreenCTM()); return [p.x, p.y];
  }, [x, y]);
  const tocar = async (page, x, y) => { await page.mouse.click(...await pantalla(page, x, y)); await page.waitForTimeout(380); };
  // (un solo desplazamiento de la página, centrado entre los dos puntos, antes de apretar)
  const enPantalla = async (page, x, y) => page.evaluate(([x, y]) => { const p = new DOMPoint(x, y).matrixTransform(document.getElementById('dib-svg').getScreenCTM()); return [p.x, p.y]; }, [x, y]);
  const arrastrar = async (page, a, b) => {
    await pantalla(page, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    const pa = await enPantalla(page, ...a); const pb = await enPantalla(page, ...b);
    await page.mouse.move(...pa); await page.mouse.down(); await page.mouse.move(...pb, { steps: 6 }); await page.mouse.up();
  };

  test('dibujo libre: líneas, figuras, texto y unifilar; deshacer, borrador, cajetín opcional y PNG', async ({ page }) => {
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    await page.setViewportSize({ width: 1280, height: 1000 });
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await page.evaluate(() => localStorage.removeItem('nettracker_dibujo'));
    await nav(page, 'Dibujar');
    await subirImagen(page, 800, 400);
    await page.getByRole('button', { name: 'Línea', exact: true }).click();
    await arrastrar(page, [80, 80], [400, 80]);
    await expect(page.locator('#dib-capa line[stroke="#dc2626"]')).toHaveCount(1);
    await tocar(page, 700, 350); // un clic sin arrastrar no deja una línea vacía
    await expect(page.locator('#dib-capa [data-id]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Color #2563eb' }).click();
    await page.getByRole('button', { name: 'Flecha' }).click();
    await arrastrar(page, [160, 240], [320, 320]);
    await expect(page.locator('#dib-capa marker#punta-2563eb')).toHaveCount(1);
    await page.getByRole('button', { name: 'Rectángulo' }).click();
    await arrastrar(page, [480, 200], [720, 360]);
    await page.getByRole('button', { name: 'Texto', exact: true }).click();
    await pantalla(page, 80, 200);
    const y0 = (await page.locator('#dib-svg').boundingBox()).y;
    await tocar(page, 80, 200);
    expect((await page.locator('#dib-svg').boundingBox()).y).toBe(y0); // al seleccionar, el lienzo no se mueve
    await page.locator('#dib-texto').fill('Tablero general'); await page.locator('#dib-texto').press('Tab');
    await expect(page.locator('#dib-capa text')).toContainText('Tablero general');
    await page.getByRole('button', { name: 'Símbolos de unifilar' }).click();
    await page.locator('.dib-simbolo', { hasText: 'Transformador' }).click();
    await tocar(page, 600, 100);
    await page.getByRole('button', { name: 'Girar 90°' }).click();
    await expect(page.locator('#dib-capa g[transform*="rotate(90"]')).toHaveCount(1);
    await expect(page.locator('#dib-capa [data-id]')).toHaveCount(5);
    // Mover, borrar y deshacer
    await page.getByRole('button', { name: 'Seleccionar y mover (V)' }).click();
    const antes = await page.locator('#dib-capa rect[data-id]').getAttribute('x');
    await arrastrar(page, [600, 280], [560, 260]);
    expect(await page.locator('#dib-capa rect[data-id]').getAttribute('x')).not.toBe(antes);
    await page.getByRole('button', { name: 'Borrar' }).click();
    await expect(page.locator('#dib-capa [data-id]')).toHaveCount(4);
    await page.getByRole('button', { name: 'Deshacer' }).click();
    await expect(page.locator('#dib-capa [data-id]')).toHaveCount(5);
    // El borrador queda en el navegador
    await nav(page, 'Inicio'); await nav(page, 'Dibujar');
    await expect(page.locator('#dib-capa [data-id]')).toHaveCount(5);
    // Sin cajetín la lámina es solo la imagen; el PNG sale de ese tamaño
    await page.locator('#dib-lam-activa').uncheck();
    await expect(page.locator('#dib-svg')).toHaveAttribute('viewBox', '0 0 800 400');
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar PNG' }).click();
    const buf = require('fs').readFileSync(await (await descarga).path());
    expect(buf.slice(1, 4).toString()).toBe('PNG');
    expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([800, 400]);
    page.once('dialog', dl => dl.accept());
    await page.getByRole('button', { name: 'Nuevo' }).click();
    await expect(page.locator('#dib-capa [data-id]')).toHaveCount(0);
    expect(errores).toEqual([]);
  });

  test('lámina de red: escala calibrada, postes, tramos ajustados, etiquetas, distancias automáticas y cajetín', async ({ page }) => {
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    await page.setViewportSize({ width: 1280, height: 1100 });
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await page.evaluate(() => localStorage.removeItem('nettracker_dibujo'));
    await nav(page, 'Dibujar');
    await subirImagen(page, 1600, 900);
    // Calibrar: 800 px = 100 m → 0.125 m/px
    await page.getByRole('button', { name: 'Calibrar', exact: true }).click();
    await arrastrar(page, [100, 850], [900, 850]);
    await page.locator('#dib-metros').fill('100');
    await page.getByRole('button', { name: 'Aplicar escala' }).click();
    await expect(page.locator('.tg', { hasText: '1 m = 8.0 px' })).toHaveCount(1);
    // Postes existentes y un transformador proyectado
    const postes = [[200, 500], [600, 400], [1000, 300]];
    await page.getByRole('button', { name: 'Poste existente' }).click();
    for (const [x, y] of postes) await tocar(page, x, y);
    await page.getByRole('button', { name: 'Transformador proyectado' }).click();
    await tocar(page, 1000, 200);
    // Tramo BT existente: los toques cerca de los postes se ajustan a su centro
    await page.getByRole('button', { name: 'Tramo de red' }).click();
    await page.locator('.dib-chip', { hasText: 'Red BT existente' }).click();
    for (const [x, y] of postes) await tocar(page, x + 6, y - 5);
    await page.getByRole('button', { name: 'Terminar tramo' }).click();
    const d = await page.evaluate(async () => (await import('/js/state.js')).state.dibujo.elementos.find(e => e.tipo === 'polilinea').puntos.map(p => p.map(Math.round)));
    expect(d).toEqual(postes);
    // Metros por vano sobre el tramo: √(400²+100²) × 0.125 = 51.5 m
    await expect(page.locator('#dib-capa text', { hasText: '51.5 m' })).toHaveCount(2);
    // Etiquetas: P1 en el primer poste; W1 (estilo proyectado) en el tercero
    await page.getByRole('button', { name: 'Etiqueta de punto (P1, W1…)' }).click();
    await tocar(page, 205, 495);
    await page.locator('#dib-texto').fill('P1: DS111267'); await page.locator('#dib-texto').press('Tab');
    await page.getByRole('button', { name: 'Etiqueta de punto (P1, W1…)' }).click();
    await page.locator('.dib-chip', { hasText: 'Punto proyectado' }).click();
    await expect(page.locator('#dib-prefijo')).toHaveValue('W');
    await tocar(page, 995, 305);
    await expect(page.locator('#dib-capa text', { hasText: /^W1$/ })).toHaveCount(1);
    // Distancias automáticas en el cajetín: P1 – W1 = 103.1 m y el total del tipo
    const caj = page.locator('#dib-cajetin');
    await expect(caj.locator('text', { hasText: 'P1 – W1' })).toHaveCount(1);
    await expect(caj.locator('text', { hasText: /^103\.1$/ })).toHaveCount(2); // tramo y total
    await expect(caj.locator('text', { hasText: 'Total red BT existente' })).toHaveCount(1);
    // Simbología: solo lo usado
    const exacto = t => caj.locator('text', { hasText: new RegExp(`^${t}$`) });
    for (const t of ['Red BT existente', 'Poste existente', 'Transformador proyectado', 'Punto existente', 'Punto proyectado']) await expect(exacto(t)).toHaveCount(1);
    await expect(exacto('Red MT')).toHaveCount(0);
    // Escala gráfica y título
    await expect(caj.locator('text', { hasText: /^\d+ m$/ })).toHaveCount(1);
    // Sin nada seleccionado, el panel muestra la lámina (cajetín)
    await page.getByRole('button', { name: 'Seleccionar y mover (V)' }).click(); await page.keyboard.press('Escape');
    await page.locator('#dib-lam-titulo').fill('Referencia eléctrica');
    await expect(caj.locator('text', { hasText: 'REFERENCIA ELÉCTRICA' })).toHaveCount(1);
    // Cota entre dos postes (se ajusta a ellos): 400 px × 0.125 = 50.0 m… en diagonal √(400²+100²) = 51.5 m
    await page.getByRole('button', { name: 'Cota (medir distancia)' }).click();
    await arrastrar(page, [604, 396], [996, 304]);
    await expect(page.locator('.dib-panel')).toContainText('Mide 51.5 m');
    // Cambiar el tipo del tramo seleccionado cambia su estilo y la simbología
    await page.getByRole('button', { name: 'Seleccionar y mover (V)' }).click();
    await tocar(page, 400, 450);
    await page.locator('.dib-chip', { hasText: 'Red BT proyectada' }).click();
    await expect(exacto('Red BT proyectada')).toHaveCount(1);
    await expect(exacto('Red BT existente')).toHaveCount(0);
    // PNG de la lámina completa (imagen + cajetín)
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar PNG' }).click();
    const dl = await descarga;
    expect(dl.suggestedFilename()).toMatch(/^referencia_electrica-\d{4}-\d{2}-\d{2}\.png$/);
    const buf = require('fs').readFileSync(await dl.path());
    expect(buf.readUInt32BE(16)).toBe(1600);
    expect(buf.readUInt32BE(20)).toBeGreaterThan(900);
    const filas = await page.evaluate(async () => (await import('/js/domain/dibujo.js')).leerFilasTabla('A 1\nB C, 2\n\nD'));
    expect(filas).toEqual([['A', '1'], ['B C', '2'], ['D', '']]);
    expect(errores).toEqual([]);
  });
  test('sin escala: metros escritos por vano, tabla de distancias y textos rápidos de etiqueta', async ({ page }) => {
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    await page.setViewportSize({ width: 1280, height: 1100 });
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await page.evaluate(() => localStorage.removeItem('nettracker_dibujo'));
    await nav(page, 'Dibujar');
    await subirImagen(page, 1600, 900);
    await page.getByRole('button', { name: 'Banco de transformadores' }).click();
    await tocar(page, 300, 200);
    const postes = [[200, 500], [600, 400], [1000, 300]];
    await page.getByRole('button', { name: 'Poste existente' }).click();
    for (const [x, y] of postes) await tocar(page, x, y);
    await page.getByRole('button', { name: 'Tramo de red' }).click();
    for (const [x, y] of postes) await tocar(page, x, y);
    await page.getByRole('button', { name: 'Terminar tramo' }).click();
    await page.getByRole('button', { name: 'Etiqueta de punto (P1, W1…)' }).click();
    await tocar(page, 200, 500);
    await page.getByRole('button', { name: 'Etiqueta de punto (P1, W1…)' }).click();
    await tocar(page, 1000, 300);
    // Texto rápido: conserva el nombre del punto
    await page.locator('.dib-acciones .dib-chip', { hasText: 'Seccionar red BT' }).click();
    await expect(page.locator('#dib-capa text', { hasText: 'P2: Seccionar red BT' })).toHaveCount(1);
    // Sin escala no hay metros; se escriben por vano al seleccionar el tramo
    await expect(page.locator('#dib-cajetin text', { hasText: 'Escribe los metros de los vanos o calibra' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Seleccionar y mover (V)' }).click();
    await tocar(page, 400, 450);
    await expect(page.locator('.dib-sec', { hasText: 'Metros por vano' })).toContainText('Vano 1: P1 → punto 2');
    await page.locator('#dib-vano-1').fill('20'); await page.locator('#dib-vano-2').fill('30.5');
    await page.locator('#dib-vano-2').press('Tab');
    await expect(page.locator('#dib-capa text', { hasText: '20.0 m' })).toHaveCount(1);
    await expect(page.locator('#dib-capa text', { hasText: '30.5 m' })).toHaveCount(1);
    const caj = page.locator('#dib-cajetin');
    await expect(caj.locator('text', { hasText: 'P1 – P2' })).toHaveCount(1);
    await expect(caj.locator('text', { hasText: /^50\.5$/ })).toHaveCount(2); // trecho y total
    await expect(caj.locator('text', { hasText: /^Banco de transformadores$/ })).toHaveCount(1);
    await expect(page.locator('.dib-panel')).toContainText('Total 50.5 m');
    // Letras en el campo de metros no se aceptan
    await page.locator('#dib-vano-1').fill('abc');
    await expect(page.locator('.toast')).toContainText('solo el número');
    expect(errores).toEqual([]);
  });
  test('zoom: acercar y dibujar en el lugar correcto, desplazar el fondo, Ctrl + rueda, pellizco con dos dedos y pantalla completa', async ({ page }) => {
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    await page.setViewportSize({ width: 1280, height: 900 });
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await page.evaluate(() => localStorage.removeItem('nettracker_dibujo'));
    await nav(page, 'Dibujar');
    await subirImagen(page, 1600, 900);
    const vb = () => page.locator('#dib-svg').getAttribute('viewBox');
    const completa = await vb();
    await expect(page.locator('#dib-zoom-pct')).toHaveText('100 %');
    await page.getByRole('button', { name: 'Acercar' }).click();
    await page.getByRole('button', { name: 'Acercar' }).click();
    await expect(page.locator('#dib-zoom-pct')).toHaveText('156 %');
    expect(await vb()).not.toBe(completa);
    // Con zoom, un poste cae donde se toca (en coordenadas de la lámina)
    await page.getByRole('button', { name: 'Poste existente' }).click();
    await tocar(page, 800, 450);
    const c = () => page.evaluate(async () => (await import('/js/state.js')).state.dibujo.elementos.filter(e => e.tipo === 'simbolo').map(e => [Math.round(e.x + 30 * e.escala), Math.round(e.y + 30 * e.escala)]));
    expect(await c()).toEqual([[800, 450]]);
    // Arrastrar el fondo con Seleccionar desplaza la vista (no mueve nada)
    await page.getByRole('button', { name: 'Seleccionar y mover (V)' }).click();
    const antes = (await vb()).split(' ').map(Number);
    await arrastrar(page, [300, 300], [400, 300]);
    const despues = (await vb()).split(' ').map(Number);
    expect(despues[0]).toBeCloseTo(antes[0] - 100, 0);
    expect(await c()).toEqual([[800, 450]]);
    // Ajustar vuelve a toda la lámina
    await page.getByRole('button', { name: 'Ajustar' }).click();
    expect(await vb()).toBe(completa);
    // Ctrl + rueda acerca; la rueda sola no
    const [mx, my] = await pantalla(page, 800, 450);
    await page.mouse.move(mx, my);
    await page.mouse.wheel(0, -300);
    expect(await vb()).toBe(completa);
    // (Chromium de las pruebas toma Ctrl + rueda como zoom del navegador: el evento se manda directo)
    await page.evaluate(([x, y]) => document.getElementById('dib-svg').dispatchEvent(new WheelEvent('wheel', { deltaY: -300, ctrlKey: true, clientX: x, clientY: y, bubbles: true, cancelable: true })), await pantalla(page, 800, 450));
    await expect(page.locator('#dib-zoom-pct')).not.toHaveText('100 %');
    await page.getByRole('button', { name: 'Ajustar' }).click();
    // Pellizco con dos dedos: acerca y no deja nada dibujado (estando en Poste)
    await page.getByRole('button', { name: 'Poste existente' }).click();
    await page.evaluate(() => {
      const s = document.getElementById('dib-svg'); const r = s.getBoundingClientRect(); const cx = r.left + r.width / 2; const cy = r.top + r.height / 3;
      const ev = (tipo, id, x) => s.dispatchEvent(new PointerEvent(tipo, { pointerId: id, pointerType: 'touch', clientX: x, clientY: cy, bubbles: true, cancelable: true, isPrimary: id === 1 }));
      ev('pointerdown', 1, cx - 40); ev('pointerdown', 2, cx + 40);
      for (let k = 1; k <= 6; k++) { ev('pointermove', 1, cx - 40 - k * 15); ev('pointermove', 2, cx + 40 + k * 15); }
      ev('pointerup', 2, cx + 130); ev('pointerup', 1, cx - 130);
    });
    await expect(page.locator('#dib-zoom-pct')).not.toHaveText('100 %');
    expect(await c()).toEqual([[800, 450]]); // el primer dedo no dejó un poste
    // Pantalla completa: solo la barra y el lienzo; Escape sale
    await page.getByRole('button', { name: 'Pantalla completa' }).click();
    await expect(page.locator('.dib-pagina.ampliada')).toHaveCount(1);
    await expect(page.locator('.dib-pagina .hero')).toBeHidden();
    const alto = (await page.locator('.dib-lienzo').boundingBox()).height;
    expect(alto).toBeGreaterThan(550);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await expect(page.locator('.dib-pagina.ampliada')).toHaveCount(0);
    expect(errores).toEqual([]);
  });

  test('metros de los vanos que se arrastran (y vuelven a su lugar) y puente al vuelo sobre la línea', async ({ page }) => {
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    await page.setViewportSize({ width: 1280, height: 1100 });
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await page.evaluate(() => localStorage.removeItem('nettracker_dibujo'));
    await nav(page, 'Dibujar');
    await subirImagen(page, 1600, 900);
    await page.getByRole('button', { name: 'Tramo de red' }).click();
    await tocar(page, 200, 500); await tocar(page, 1000, 500);
    await page.getByRole('button', { name: 'Terminar tramo' }).click();
    await page.locator('#dib-vano-1').fill('40'); await page.locator('#dib-vano-1').press('Tab');
    await expect(page.locator('#dib-capa [data-chip="1"]')).toContainText('40.0 m');
    const tramo = () => page.evaluate(async () => (await import('/js/state.js')).state.dibujo.elementos.find(e => e.tipo === 'polilinea'));
    // Arrastrar el chip de metros: se corre (con guía) y el tramo no se mueve
    await page.getByRole('button', { name: 'Seleccionar y mover (V)' }).click();
    await arrastrar(page, [600, 500], [600, 400]);
    let t = await tramo();
    expect(t.puntos.map(q => q.map(Math.round))).toEqual([[200, 500], [1000, 500]]);
    expect(t.desfases['1'].map(Math.round)).toEqual([0, -100]);
    await expect(page.locator('#dib-capa line[stroke-dasharray]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Metros a su lugar' }).click();
    t = await tramo();
    expect(t.desfases).toBeUndefined();
    // Puente al vuelo: cae sobre la línea (imán) y sale en la simbología del cajetín
    await page.getByRole('button', { name: 'Puente al vuelo' }).click();
    await tocar(page, 400, 488);
    const p = await page.evaluate(async () => (await import('/js/state.js')).state.dibujo.elementos.filter(e => e.simbolo === 'puente').map(e => [Math.round(e.x + 30 * e.escala), Math.round(e.y + 30 * e.escala)]));
    expect(p).toEqual([[400, 500]]);
    await expect(page.locator('#dib-cajetin text', { hasText: 'Puente al vuelo' })).toHaveCount(1);
    expect(errores).toEqual([]);
  });

  test('editor: con Poste activo, tocar un poste lo selecciona (no pone otro), se agranda y los nuevos salen de ese tamaño; color y nombre de cada red', async ({ page }) => {
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    await page.setViewportSize({ width: 1280, height: 900 });
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await page.evaluate(() => localStorage.removeItem('nettracker_dibujo'));
    await nav(page, 'Dibujar');
    await subirImagen(page, 1600, 900);
    const elementos = () => page.evaluate(async () => (await import('/js/state.js')).state.dibujo.elementos);
    await page.getByRole('button', { name: 'Poste existente' }).click();
    await tocar(page, 400, 400);
    let e = await elementos();
    const escala0 = e[0].escala;
    // Tocar el mismo poste: queda seleccionado, no se pone otro
    await tocar(page, 404, 402);
    e = await elementos();
    expect(e).toHaveLength(1);
    await expect(page.locator('.dib-panel-cab')).toContainText('Poste existente');
    await page.getByRole('button', { name: 'Más grande' }).click();
    await page.getByRole('button', { name: 'Más grande' }).click();
    e = await elementos();
    expect(e[0].escala).toBeCloseTo(escala0 * 1.18 * 1.18, 3);
    expect(Math.round(e[0].x + 30 * e[0].escala)).toBe(400); // crece desde su centro
    // El siguiente poste sale del mismo tamaño
    await tocar(page, 800, 400);
    e = await elementos();
    expect(e).toHaveLength(2);
    expect(e[1].escala).toBeCloseTo(e[0].escala, 3);
    // Dos redes BT: la segunda en azul con nombre; cada una sale aparte en la simbología
    await page.getByRole('button', { name: 'Tramo de red' }).click();
    await tocar(page, 200, 600); await tocar(page, 700, 600);
    await page.getByRole('button', { name: 'Terminar tramo' }).click();
    await page.getByRole('button', { name: 'Tramo de red' }).click();
    await page.getByRole('button', { name: 'Red color #2563eb' }).click();
    await tocar(page, 200, 750); await tocar(page, 700, 750);
    await page.getByRole('button', { name: 'Terminar tramo' }).click();
    await page.locator('#dib-nombre-red').fill('Red BT trafo 2'); await page.locator('#dib-nombre-red').press('Tab');
    e = await elementos();
    const tramos = e.filter(x => x.tipo === 'polilinea');
    expect(tramos.map(t => t.colorRed || null)).toEqual([null, '#2563eb']);
    expect(tramos[1].nombreRed).toBe('Red BT trafo 2');
    const caj = page.locator('#dib-cajetin');
    await expect(caj.locator('text', { hasText: /^Red BT existente$/ })).toHaveCount(1);
    await expect(caj.locator('text', { hasText: /^Red BT trafo 2$/ })).toHaveCount(1);
    await expect(page.locator('#dib-capa path[stroke="#2563eb"]')).toHaveCount(1);
    expect(errores).toEqual([]);
  });

  test('datos técnicos: altura y estructuras del poste, conductor del tramo y calibre distinto en un vano', async ({ page }) => {
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    await page.setViewportSize({ width: 1280, height: 900 });
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await page.evaluate(() => localStorage.removeItem('nettracker_dibujo'));
    await nav(page, 'Dibujar');
    await subirImagen(page, 1600, 900);
    await page.getByRole('button', { name: 'Poste existente' }).click();
    await tocar(page, 400, 400);
    await page.locator('#dib-poste-altura').fill('40'); await page.locator('#dib-poste-altura').press('Tab');
    await page.locator('#dib-poste-estructura').selectOption('RS3');
    await expect(page.locator('#dib-capa text', { hasText: "40' · RS3" })).toHaveCount(1);
    await page.locator('.dib-estr button').click(); // quitar RS3
    await expect(page.locator('#dib-capa text', { hasText: /^40'$/ })).toHaveCount(1);
    // Tramo de dos vanos con conductor; el segundo vano con otro calibre
    await page.getByRole('button', { name: 'Tramo de red' }).click();
    await tocar(page, 400, 400); await tocar(page, 900, 400); await tocar(page, 900, 800);
    await page.getByRole('button', { name: 'Terminar tramo' }).click();
    await page.locator('#dib-cond-calibre').fill('#1/0'); await page.locator('#dib-cond-calibre').press('Tab');
    await page.locator('#dib-cond-tipo').selectOption('Triplex');
    await page.locator('#dib-vano-cal-2').selectOption('#2');
    await expect(page.locator('#dib-capa text', { hasText: /^#1\/0 Tpx$/ })).toHaveCount(1);
    await expect(page.locator('#dib-capa text', { hasText: /^#2 Tpx$/ })).toHaveCount(1);
    const t = await page.evaluate(async () => (await import('/js/state.js')).state.dibujo.elementos.find(e => e.tipo === 'polilinea'));
    expect(t.conductor).toEqual({ calibre: '#1/0', tipo: 'Triplex' });
    expect(t.calibres).toEqual({ 2: '#2' });
    // El siguiente tramo sale con el mismo conductor
    await page.getByRole('button', { name: 'Tramo de red' }).click();
    await tocar(page, 200, 700); await tocar(page, 600, 700);
    await page.getByRole('button', { name: 'Terminar tramo' }).click();
    await expect(page.locator('#dib-cond-calibre')).toHaveValue('#1/0');
    expect(errores).toEqual([]);
  });

  test('proyectos: se guardan en la base para el equipo, se marcan los cambios sin guardar y se vuelven a abrir', async ({ page }) => {
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    await page.setViewportSize({ width: 1280, height: 1100 });
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await page.evaluate(() => localStorage.removeItem('nettracker_dibujo'));
    await nav(page, 'Dibujar');
    await subirImagen(page, 1600, 900);
    await page.getByRole('button', { name: 'Tramo de red' }).click();
    await tocar(page, 200, 500); await tocar(page, 1000, 500);
    await page.getByRole('button', { name: 'Terminar tramo' }).click();
    // Guardar como proyecto: nombre y referencia
    await page.getByRole('button', { name: 'Guardar como proyecto' }).click();
    await page.locator('#dib-proy-nombre').fill('Propuesta Col. Prueba');
    await page.locator('#dib-proy-ref').fill('WO-1');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.locator('.dib-proyecto')).toContainText('Propuesta Col. Prueba');
    await expect(page.locator('.dib-proyecto .tg')).toHaveText('Guardado');
    let esc = await app.escrituras();
    const meta = esc.find(([op, r]) => op === 'set' && /^dibujos\/[^/]+$/.test(r));
    const datos = esc.find(([op, r]) => op === 'set' && /^dibujosDatos\/[^/]+$/.test(r));
    expect(meta[2]).toMatchObject({ nombre: 'Propuesta Col. Prueba', referencia: 'WO-1' });
    expect(datos[2].fondo.src.startsWith('data:image/jpeg')).toBe(true); // la imagen se guarda en JPG
    expect(JSON.parse(datos[2].datos).elementos.filter(e => e.tipo === 'polilinea')).toHaveLength(1);
    // Un cambio: queda "sin guardar"; Guardar actualiza el mismo proyecto
    await page.getByRole('button', { name: 'Poste existente' }).click();
    await tocar(page, 600, 500);
    await expect(page.locator('.dib-proyecto .tg')).toHaveText('Cambios sin guardar');
    await page.locator('.dib-proyecto').getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.locator('.dib-proyecto .tg')).toHaveText('Guardado');
    esc = await app.escrituras();
    expect(esc.filter(([op, r]) => op === 'set' && /^dibujos\/[^/]+$/.test(r)).map(([, r]) => r)).toEqual([meta[1], meta[1]]);
    // Nuevo dibujo y volver a abrir el proyecto desde la lista
    await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
    await expect(page.locator('.dib-proyecto')).toContainText('Borrador');
    await page.getByRole('button', { name: /Proyectos guardados \(1\)/ }).click();
    await expect(page.locator('.dib-proy-card')).toContainText('WO-1');
    await page.locator('.dib-proy-card').getByRole('button', { name: 'Abrir' }).click();
    await expect(page.locator('.dib-proyecto')).toContainText('Propuesta Col. Prueba');
    const el = await page.evaluate(async () => (await import('/js/state.js')).state.dibujo.elementos.map(e => e.tipo));
    expect(el.sort()).toEqual(['polilinea', 'simbolo']);
    await expect(page.locator('#dib-svg image')).toHaveCount(1);
    expect(errores).toEqual([]);
  });

  test('imán: el poste cae sobre la línea, se pega a los vértices y arrastra lo que tiene pegado', async ({ page }) => {
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    await page.setViewportSize({ width: 1280, height: 1100 });
    app = await abrirApp(page);
    await cerrarAlerta(page);
    await page.evaluate(() => localStorage.removeItem('nettracker_dibujo'));
    await nav(page, 'Dibujar');
    await subirImagen(page, 1600, 900);
    const estado = () => page.evaluate(async () => (await import('/js/state.js')).state.dibujo.elementos.map(e => ({ tipo: e.tipo, puntos: e.puntos?.map(p => p.map(Math.round)), c: e.tipo === 'simbolo' ? [Math.round(e.x + 30 * e.escala), Math.round(e.y + 30 * e.escala)] : null, t: e.tipo === 'etiqueta' ? [Math.round(e.tx), Math.round(e.ty)] : null })));
    // Tramo de dos vértices
    await page.getByRole('button', { name: 'Tramo de red' }).click();
    await tocar(page, 200, 500); await tocar(page, 1000, 500);
    await page.getByRole('button', { name: 'Terminar tramo' }).click();
    // Poste tocado 15 px por encima de la línea: cae sobre ella (imán a la línea)
    await page.getByRole('button', { name: 'Poste existente' }).click();
    await tocar(page, 600, 485);
    // Poste tocado cerca del extremo: cae en el vértice (el punto manda sobre la línea)
    await tocar(page, 1008, 492);
    let e = await estado();
    expect(e.filter(x => x.tipo === 'simbolo').map(x => x.c)).toEqual([[600, 500], [1000, 500]]);
    // Etiqueta al poste del extremo: su punta se pega al centro
    await page.getByRole('button', { name: 'Etiqueta de punto (P1, W1…)' }).click();
    await tocar(page, 1006, 494);
    // Mover el poste del extremo arrastra el vértice del tramo y la punta de la etiqueta
    await page.getByRole('button', { name: 'Seleccionar y mover (V)' }).click();
    await arrastrar(page, [1000, 500], [1100, 300]);
    e = await estado();
    expect(e.find(x => x.tipo === 'polilinea').puntos).toEqual([[200, 500], [1100, 300]]);
    expect(e.filter(x => x.tipo === 'simbolo')[1].c).toEqual([1100, 300]);
    expect(e.find(x => x.tipo === 'etiqueta').t).toEqual([1100, 300]);
    expect(errores).toEqual([]);
  });
});

test.describe('Levantamiento en campo', () => {
  test('distancia entre coordenadas y lámina para Dibujar', async ({ page }) => {
    app = await abrirApp(page);
    const r = await page.evaluate(async () => {
      const m = await import('/js/domain/levantamiento.js');
      const lev = { nombre: 'X', puntos: { a: { lat: 13.5, lng: -88.87, nombre: 'P1', tipo: 'poste', orden: 1 }, b: { lat: 13.50027, lng: -88.87, nombre: 'P2', tipo: 'poste', orden: 2 }, c: { lat: 13.50027, lng: -88.8697, nombre: 'P3', tipo: 'trafo', nota: 'CT nuevo', orden: 3 } },
        vanos: { v1: { a: 'a', b: 'b', tramo: 'bt', orden: 1 }, v2: { a: 'b', b: 'c', tramo: 'bt_nueva', metros: 35, orden: 2 } } };
      const d = m.aDibujo(lev);
      const { tablaDistancias } = await import('/js/domain/plano.js');
      return { d1: m.metrosDeVano(lev, lev.vanos.v1), d2: m.metrosDeVano(lev, lev.vanos.v2), sig: m.siguienteNombre(lev), tipos: d.elementos.map(e => e.tipo), escala: d.escala,
        tabla: tablaDistancias(d.elementos, d.escala, 14).map(f => [f.desde, f.hasta, Math.round(f.metros * 10) / 10]), kml: m.kmlLevantamiento(lev) };
    });
    expect(r.d1.origen).toBe('gps'); expect(r.d1.metros).toBeCloseTo(30.0, 0);
    expect(r.d2).toEqual({ metros: 35, origen: 'medido' });
    expect(r.sig).toBe('P4');
    expect(r.tipos.filter(t => t === 'polilinea').length).toBe(2);
    expect(r.tipos.filter(t => t === 'simbolo').length).toBe(3);
    expect(r.tipos.filter(t => t === 'etiqueta').length).toBe(3);
    // La escala de la lámina sale exacta de las coordenadas: el vano por GPS mide lo mismo en Dibujar
    expect(r.tabla[0][0]).toBe('P1'); expect(r.tabla[0][2]).toBeCloseTo(30.0, 0);
    expect(r.tabla[1]).toEqual(['P2', 'P3', 35]);
    expect(r.kml).toContain('<coordinates>-88.87,13.5,0</coordinates>');
    expect(r.kml).toContain('<LineString>');
  });

  test('en campo: marca postes con el GPS, mide los vanos, corrige, exporta y pasa a Dibujar', async ({ page, context }) => {
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 13.5, longitude: -88.87, accuracy: 5 });
    await page.setViewportSize({ width: 1280, height: 1100 });
    app = await abrirApp(page, { leaflet: true });
    await cerrarAlerta(page);
    await nav(page, 'Levantamiento');
    await page.locator('#lev-nombre').fill('Calle de prueba');
    await page.locator('#lev-referencia').fill('WO-PRUEBA');
    await page.getByRole('button', { name: 'Empezar levantamiento' }).click();
    await expect(page.locator('#lev-gps')).toHaveText('GPS ±5 m');
    await expect(page.locator('#lev-mapa.leaflet-container')).toHaveCount(1);
    // P1 aquí; caminar 30 m al norte y P2
    await page.getByRole('button', { name: 'Poste aquí' }).click();
    await expect(page.locator('.leaflet-marker-icon', { hasText: 'P1' })).toHaveCount(1);
    await context.setGeolocation({ latitude: 13.50027, longitude: -88.87, accuracy: 4 });
    await expect(page.locator('#lev-gps')).toHaveText('GPS ±4 m');
    await page.getByRole('button', { name: 'Poste aquí' }).click();
    await expect(page.locator('.leaflet-marker-icon', { hasText: 'P2' })).toHaveCount(1);
    await expect(page.locator('.lev-dist', { hasText: '30.0 m GPS' })).toHaveCount(1);
    const esc = await app.escrituras();
    const vano = esc.find(([op, ruta]) => op === 'push' && /^levantamientos\/[^/]+\/vanos$/.test(ruta))[2];
    expect(vano.tramo).toBe('bt');
    // Medido a mano: manda sobre el GPS
    const inp = page.locator('.lev-vano input[aria-label="Metros medidos"]');
    await inp.fill('32'); await inp.press('Tab');
    // Conductor del vano: calibre y tipo
    await page.locator('.lev-vano input[aria-label="Calibre"]').fill('#2'); await page.locator('.lev-vano input[aria-label="Calibre"]').press('Tab');
    await page.locator('.lev-vano select[aria-label="Tipo de conductor"]').selectOption('ACSR');
    await expect(page.locator('.lev-dist', { hasText: '32.0 m' })).toHaveCount(1);
    await expect(page.locator('.lev-vano')).toContainText('32.0 m medido');
    // Con precisión baja pide confirmar; transformador como tipo de punto
    await page.locator('.lev-barra .dib-chip', { hasText: 'Transformador existente' }).click();
    await context.setGeolocation({ latitude: 13.50027, longitude: -88.86975, accuracy: 30 });
    await expect(page.locator('#lev-gps')).toHaveText('GPS ±30 m');
    page.once('dialog', dl => dl.accept());
    await page.getByRole('button', { name: 'Poste aquí' }).click();
    await expect(page.locator('.leaflet-marker-icon', { hasText: 'P3' })).toHaveCount(1);
    // Seleccionar P1, nota y ramal desde ahí tocando el mapa
    await page.locator('.leaflet-marker-icon', { hasText: 'P1' }).click();
    await expect(page.locator('.lev-panel')).toContainText('GPS ±5 m');
    await page.locator('#lev-p-nota').fill('Poste de madera deteriorado'); await page.locator('#lev-p-nota').press('Tab');
    // Altura y estructuras del poste: de la lista y una escrita
    await page.locator('#lev-poste-altura').fill('35'); await page.locator('#lev-poste-altura').press('Tab');
    await page.locator('#lev-poste-estructura').selectOption('23TS3');
    await page.locator('#lev-poste-estr-otra').fill('ts3'); await page.getByRole('button', { name: 'Agregar', exact: true }).click();
    await expect(page.locator('.lev-panel .dib-estr')).toHaveText(['23TS3✕', 'TS3✕']);
    await expect(page.locator('.lev-panel .tg')).toContainText("35' · 23TS3 / TS3");
    await page.getByRole('button', { name: 'Seguir desde aquí' }).click();
    await page.getByRole('button', { name: 'Tocando el mapa' }).click();
    const caja = await page.locator('#lev-mapa').boundingBox();
    await page.mouse.click(caja.x + caja.width * 0.2, caja.y + caja.height * 0.8);
    await expect(page.locator('.leaflet-marker-icon', { hasText: 'P4' })).toHaveCount(1);
    await expect(page.locator('.lev-vano')).toHaveCount(3);
    await expect(page.locator('.lev-vano', { hasText: 'P1 – P4' })).toHaveCount(1);
    // KML
    const kml = page.waitForEvent('download');
    await page.getByRole('button', { name: 'KML para Google Earth' }).click();
    const k = require('fs').readFileSync(await (await kml).path(), 'utf8');
    expect((k.match(/<Point>/g) || []).length).toBe(4);
    expect(k).toContain('Poste de madera deteriorado');
    expect(k).toContain("35' · 23TS3 / TS3");
    expect(k).toContain('#2 ACSR');
    // Pasar a Dibujar: lámina con escala exacta, tramos y etiquetas
    await page.getByRole('button', { name: 'Pasar a Dibujar (lámina)' }).click();
    await expect(page.locator('#dib-svg')).toHaveCount(1);
    await expect(page.locator('#dib-cajetin text', { hasText: /^P1 – P2$/ })).toHaveCount(1);
    await expect(page.locator('#dib-cajetin text', { hasText: /^32\.0$/ })).toHaveCount(1);
    await expect(page.locator('#dib-cajetin text', { hasText: 'LEVANTAMIENTO DE RED' })).toHaveCount(1);
    await expect(page.locator('#dib-capa text', { hasText: 'P1: Poste de madera deteriorado' })).toHaveCount(1);
    // Pasan a la lámina: altura y estructuras junto al poste y el conductor junto a los metros del vano
    await expect(page.locator('#dib-capa text', { hasText: "35' · 23TS3 / TS3" })).toHaveCount(1);
    await expect(page.locator('#dib-capa text', { hasText: '32.0 m · #2 ACSR' })).toHaveCount(1);
    // Se pueden ocultar desde la lámina
    await page.locator('#dib-lam-verEstructuras').uncheck();
    await expect(page.locator('#dib-capa text', { hasText: /^35'$/ })).toHaveCount(1);
    await page.locator('#dib-lam-verCalibre').uncheck();
    await expect(page.locator('#dib-capa text', { hasText: /^32\.0 m$/ })).toHaveCount(1);
    expect(errores).toEqual([]);
  });
  test('imán en campo: junto a un poste ya marcado pregunta si es el mismo, y tocar cerca de un punto lo une', async ({ page, context }) => {
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 13.5, longitude: -88.87, accuracy: 4 });
    await page.setViewportSize({ width: 1280, height: 1100 });
    app = await abrirApp(page, { leaflet: true });
    await cerrarAlerta(page);
    await nav(page, 'Levantamiento');
    await page.locator('#lev-nombre').fill('Imán');
    await page.getByRole('button', { name: 'Empezar levantamiento' }).click();
    await expect(page.locator('#lev-gps')).toHaveText('GPS ±4 m');
    const poste = page.getByRole('button', { name: 'Poste aquí' });
    await poste.click();
    await context.setGeolocation({ latitude: 13.50027, longitude: -88.87, accuracy: 4 });
    await expect(page.locator('#lev-gps')).toHaveText('GPS ±4 m');
    await poste.click(); // P2
    await expect(page.locator('.leaflet-marker-icon', { hasText: 'P2' })).toHaveCount(1);
    // De vuelta junto a P1 (a 2 m): es el mismo poste → no se crea otro; el siguiente sale desde P1
    await context.setGeolocation({ latitude: 13.500018, longitude: -88.87, accuracy: 3 });
    await expect(page.locator('#lev-gps')).toHaveText('GPS ±3 m');
    await page.evaluate(() => { window.__preguntas = []; window.confirm = m => { window.__preguntas.push(m); return true; }; });
    await poste.click();
    expect((await page.evaluate(() => window.__preguntas)).join(' ')).toContain('Estás a 2.0 m de P1. ¿Es el mismo poste?');
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2); // no se creó otro poste
    await expect(page.locator('.lev-vano')).toHaveCount(1); // P1 – P2 ya existía: no se duplica el vano
    await expect(page.locator('.lev-accion')).toContainText('Se une a P1.');
    await context.setGeolocation({ latitude: 13.5, longitude: -88.86973, accuracy: 5 });
    await expect(page.locator('#lev-gps')).toHaveText('GPS ±5 m');
    await poste.click(); // P3 unido a P1
    await expect(page.locator('.lev-vano', { hasText: 'P1 – P3' })).toHaveCount(1);
    // Tocando el mapa cerca (no encima) de P2 con "unir al anterior": cierra la red P3 – P2 sin crear un punto
    await page.getByRole('button', { name: 'Tocando el mapa' }).click();
    const p2 = await page.locator('.leaflet-marker-icon', { hasText: 'P2' }).boundingBox();
    await page.mouse.click(p2.x + p2.width / 2 + 26, p2.y + p2.height / 2 + 10);
    await expect(page.locator('.lev-vano', { hasText: 'P3 – P2' })).toHaveCount(1);
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(3);
    expect(errores).toEqual([]);
  });

  test('corregir en campo: arrastrar un poste sin seleccionarlo (y deshacer) y poner un poste en medio de un vano', async ({ page, context }) => {
    const errores = []; page.on('pageerror', e => errores.push(e.message));
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 13.5, longitude: -88.87, accuracy: 4 });
    await page.setViewportSize({ width: 1280, height: 1100 });
    app = await abrirApp(page, { leaflet: true });
    await cerrarAlerta(page);
    await nav(page, 'Levantamiento');
    await page.locator('#lev-nombre').fill('Corregir');
    await page.getByRole('button', { name: 'Empezar levantamiento' }).click();
    await expect(page.locator('#lev-gps')).toHaveText('GPS ±4 m');
    const poste = page.getByRole('button', { name: 'Poste aquí' });
    await poste.click();
    await context.setGeolocation({ latitude: 13.5, longitude: -88.8694, accuracy: 4 });
    await expect(page.locator('#lev-gps')).toHaveText('GPS ±4 m');
    await poste.click();
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(2);
    await page.getByRole('button', { name: 'Seguir mi ubicación' }).click(); // que el mapa no se mueva solo
    const centro = async n => { const b = await page.locator('.leaflet-marker-icon', { hasText: n }).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
    const pos = async n => page.evaluate(async n => { const { state } = await import('/js/state.js'); return Object.values(state.levantamientos[state.levId].puntos).find(p => p.nombre === n); }, n);
    // Arrastrar P1 directo (sin tocarlo antes)
    const antes = await pos('P1');
    const [x1, y1] = await centro('P1');
    await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x1, y1 + 60, { steps: 8 }); await page.mouse.up();
    await expect(page.locator('.alert-banner', { hasText: 'P1 movido' })).toHaveCount(1);
    const despues = await pos('P1');
    expect(despues.lat).toBeLessThan(antes.lat);
    expect(despues.movido).toBe(true);
    await page.locator('.alert-banner', { hasText: 'P1 movido' }).getByRole('button', { name: 'Deshacer' }).click();
    await expect(page.locator('.alert-banner', { hasText: 'P1 movido' })).toHaveCount(0);
    expect((await pos('P1')).lat).toBeCloseTo(antes.lat, 7);
    // Tocar la línea entre P1 y P2: poste nuevo en medio, el vano se parte en dos
    const [a, b] = [await centro('P1'), await centro('P2')];
    await page.evaluate(() => { window.__preguntas = []; window.confirm = m => { window.__preguntas.push(m); return true; }; });
    await page.mouse.click((a[0] + b[0]) / 2 + 10, (a[1] + b[1]) / 2 + 8);
    expect((await page.evaluate(() => window.__preguntas)).join(' ')).toContain('en medio del vano P1 – P2');
    await expect(page.locator('.leaflet-marker-icon')).toHaveCount(3);
    await expect(page.locator('.lev-vano')).toHaveCount(2);
    await expect(page.locator('.lev-vano', { hasText: 'P1 – P3' })).toHaveCount(1);
    await expect(page.locator('.lev-vano', { hasText: 'P3 – P2' })).toHaveCount(1);
    await expect(page.locator('.lev-panel')).toContainText('P3'); // queda seleccionado
    const p3 = await pos('P3');
    expect(Math.abs(p3.lat - 13.5)).toBeLessThan(0.00002); // sobre la línea
    expect(errores).toEqual([]);
  });
});
