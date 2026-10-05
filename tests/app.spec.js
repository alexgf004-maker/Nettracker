// Pruebas de humo con datos sintéticos. No contienen información operativa real.
const { test, expect } = require('@playwright/test');
const { abrirApp, cerrarAlerta } = require('./helpers');

test('interfaz sin emojis decorativos y sin desbordamiento en móvil y escritorio', async ({ page }, testInfo) => {
  const app = await abrirApp(page);
  await cerrarAlerta(page);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    await app.ejecutar(() => switchTab('dashboard'));
    await expect(page.locator('nav.bottom-nav .nav-icon svg')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Buscar', exact: true })).toBeVisible();
    expect(await page.locator('#app').innerText()).not.toMatch(/\p{Extended_Pictographic}/u);
    await page.screenshot({ path: testInfo.outputPath(`inicio-${width}.png`), fullPage: true });
    await app.ejecutar(() => openCampaign('MT_2026_04'));
    await expect(page.locator('#app')).toContainText('Casos vinculados (2)');
    await expect(page.locator('details.campaign-progress')).not.toHaveAttribute('open', '');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`campana-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 850 });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await app.ejecutar(() => switchTab('dashboard'));
  await page.screenshot({ path: testInfo.outputPath('inicio-oscuro.png'), fullPage: true });
  expect(app.errores).toEqual([]);
});

test('permite seleccionar un perfil y entrar', async ({ page }) => {
  const app = await abrirApp(page, { usuario: null });
  await page.locator('#app [onclick^="selectLoginUser"]').first().click();
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('#app')).toContainText('Mi espacio de trabajo');
  await expect(page.locator('#app')).toContainText('Campañas en curso');
  expect(app.errores).toEqual([]);
});

test('carga las vistas principales', async ({ page }) => {
  const app = await abrirApp(page);
  await cerrarAlerta(page);

  for (const vista of ['Campañas', 'Reclamos', 'Equipos', 'Operación', 'Inicio']) {
    await page.locator('nav.bottom-nav button', { hasText: vista }).click();
    await expect(page.locator('#app .loading')).toHaveCount(0);
  }

  expect(app.errores).toEqual([]);
});

test('abre la trazabilidad sintética de una instalación', async ({ page }) => {
  const app = await abrirApp(page);
  await cerrarAlerta(page);
  await app.ejecutar(() => {
    switchTab('instalaciones');
    openDetail('r1');
  });

  await expect(page.locator('#app')).toContainText('#C-001');
  await expect(page.locator('#app')).toContainText('Sitio de prueba A');
  expect(app.errores).toEqual([]);
});

test('muestra la bandeja y el expediente de casos', async ({ page }) => {
  const app = await abrirApp(page);
  await cerrarAlerta(page);
  await page.locator('nav.bottom-nav button', { hasText: 'Operación' }).click();
  await page.getByRole('button', { name: /Otros expedientes/ }).click();
  await expect(page.locator('#app')).toContainText('Cliente de prueba A');
  await page.getByText('#C-001').click();
  await expect(page.locator('#app')).toContainText('NC-TEST-001');
  expect(app.errores).toEqual([]);
});

test('separa campañas mensuales y sus casos', async ({ page }) => {
  const app = await abrirApp(page);
  await cerrarAlerta(page);
  await page.locator('nav.bottom-nav button', { hasText: 'Campañas' }).click();
  await expect(page.locator('#app')).toContainText('Abril 2026');
  await expect(page.locator('#app')).toContainText('Junio 2026');
  await page.getByText('Abril 2026').click();
  await expect(page.locator('#app')).toContainText('#CR142026201');
  await expect(page.locator('#app')).toContainText('#DA142026011O00');
  await expect(page.locator('#app')).not.toContainText('#CR162026201');
  await expect(page.locator('#app')).toContainText('10/05/2026');
  expect(app.errores).toEqual([]);
});

test('abre reclamos desde su espacio propio', async ({ page }) => {
  const app = await abrirApp(page);
  await cerrarAlerta(page);
  await page.locator('nav.bottom-nav button', { hasText: 'Reclamos' }).click();
  await expect(page.locator('#app')).toContainText('#RE172026201');
  await page.getByText('#RE172026201').click();
  await expect(page.locator('#app')).toContainText('Próximo paso · Reclamo');
  await expect(page.locator('#app')).toContainText('Programar la visita');
  expect(app.errores).toEqual([]);
});

test('mantiene instalaciones, mapa y despachos en Operación', async ({ page }) => {
  const app = await abrirApp(page);
  await cerrarAlerta(page);
  await page.locator('nav.bottom-nav button', { hasText: 'Operación' }).click();
  await page.getByRole('button', { name: /Instalaciones y retiros/ }).click();
  await expect(page.locator('#app')).toContainText('SN-100');
  await page.locator('nav.bottom-nav button', { hasText: 'Operación' }).click();
  await page.getByRole('button', { name: /Despachos/ }).click();
  await expect(page.locator('#app')).toContainText('Subir archivo');
  expect(app.errores).toEqual([]);
});

test('valida el período al agregar un caso a una campaña', async ({ page }) => {
  const app = await abrirApp(page);
  await cerrarAlerta(page);
  await app.ejecutar(() => { openCampaign('MT_2026_04'); newCase('MT_2026_04'); });
  await app.ejecutar(() => {
    setCaseField('code', 'CR162026202');
    setCaseField('customerName', 'Cliente de prueba');
  });
  await page.getByRole('button', { name: 'Crear expediente' }).click();
  await expect(page.locator('#toast')).toContainText('deben coincidir');
  expect(await app.escrituras()).toEqual([]);
  expect(app.errores).toEqual([]);
});

test('crea una campaña independiente con entrega el mes siguiente', async ({ page }) => {
  const app = await abrirApp(page);
  await cerrarAlerta(page);
  await app.ejecutar(() => {
    switchTab('instalaciones');
    setInstSection('campaigns');
    newCampaign();
    setCampaignField('year', 2026);
    setCampaignField('month', 8);
  });
  await page.getByRole('button', { name: 'Crear campaña' }).click();
  await expect(page.locator('#app')).toContainText('Agosto 2026');
  const writes = await app.escrituras();
  const saved = writes.find(([operation, path, values]) => operation === 'update' && path === '' && values['campaigns/MT_2026_08']);
  expect(saved?.[2]['campaigns/MT_2026_08']).toMatchObject({ year: 2026, month: 8, ownerArea: 'CPT MT', submissionDueAt: '2026-09-10' });
  expect(app.errores).toEqual([]);
});

test('vincula el caso creado dentro de su campaña', async ({ page }) => {
  const app = await abrirApp(page);
  await cerrarAlerta(page);
  await app.ejecutar(() => {
    openCampaign('MT_2026_04');
    newCase('MT_2026_04');
    setCaseField('code', 'CR142026202');
    setCaseField('customerName', 'Cliente de prueba');
  });
  await page.getByRole('button', { name: 'Crear expediente' }).click();
  await expect(page.locator('#app')).toContainText('#CR142026202');
  const writes = await app.escrituras();
  const saved = writes.find(([operation, path, values]) => operation === 'update' && path === '' && values['caseCodeIndex/CR142026202']);
  const caseId = saved?.[2]['caseCodeIndex/CR142026202'];
  expect(saved?.[2][`cases/${caseId}`]).toMatchObject({ campaignId: 'MT_2026_04', caseType: 'CR' });
  expect(saved?.[2][`caseIdsByCampaign/MT_2026_04/${caseId}`]).toBe(true);
  expect(app.errores).toEqual([]);
});

test('revisa un listado antes de importar y vincula perturbaciones por contrato', async ({ page }) => {
  await page.addInitScript(() => {
    window.XLSX = {
      read: () => ({ SheetNames: ['Listado'], Sheets: { Listado: {} } }),
      utils: { sheet_to_json: () => [
        ['NC', 'CÓDIGO SIGET', 'NOMBRE', 'DIRECCIÓN', 'CORTE', 'MEDIDOR', 'LATITUD', 'LONGITUD', 'UBICACIÓN', 'ALIMENTADOR', 'URBANIDAD'],
        ['NC-PRUEBA-1', 'CR142026202', 'Cliente ficticio', 'Lugar ficticio', 'CT-PRUEBA', 'M-PRUEBA', 13.7, -89.2, '', 'AL013-23000', 'U'],
        ['NC-PRUEBA-1', 'DA142026021O00', 'Cliente ficticio', 'Lugar ficticio'],
        ['NC-AJENO', 'DF142026031O00', 'Cliente ajeno', 'Lugar ajeno'],
      ] },
    };
  });
  const app = await abrirApp(page);
  await cerrarAlerta(page);
  await app.ejecutar(() => openCampaign('MT_2026_04'));
  await page.getByRole('button', { name: /Importar listado Excel/ }).click();
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'Sintetico.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('fixture') });
  await expect(page.locator('#app')).toContainText('Perturbación sin CR de esta campaña');
  await page.getByRole('button', { name: 'Importar 2 casos' }).click();
  await expect(page.locator('#app')).toContainText('#CR142026202');
  await expect(page.locator('#app')).toContainText('#DA142026021O00');
  const writes = await app.escrituras();
  const saved = writes.find(([operation, path, values]) => operation === 'update' && path === '' && values['caseCodeIndex/CR142026202']);
  const crId = saved?.[2]['caseCodeIndex/CR142026202'];
  const daId = saved?.[2]['caseCodeIndex/DA142026021O00'];
  expect(saved?.[2][`cases/${crId}`].servicePointId).toBe(saved?.[2][`cases/${daId}`].servicePointId);
  expect(saved?.[2][`servicePoints/${saved[2][`cases/${crId}`].servicePointId}`].networkVoltageLL).toBe(23000);
  expect(saved?.[2]['caseCodeIndex/DF142026031O00']).toBeUndefined();
  expect(app.errores).toEqual([]);
});

test('abre la precampaña mensual y guarda la recepción estimada del contratista', async ({ page }) => {
  const app = await abrirApp(page);
  await cerrarAlerta(page);
  await app.ejecutar(() => openCampaign('MT_2026_04'));
  await page.getByRole('button', { name: /Preparar precampaña/ }).click();
  await expect(page.locator('#app')).toContainText('Puntos incompletos');
  await expect(page.locator('#app')).toContainText('Descargar listado Excel');
  await app.ejecutar(() => setPreCampaignField('contractorDeliveredAt', '2026-04-02'));
  await page.getByRole('button', { name: 'Guardar seguimiento' }).click();
  const writes = await app.escrituras();
  expect(writes.some(([operation, path, value]) => operation === 'update' && path === '' && value['campaigns/MT_2026_04/preCampaign']?.contractorDeliveredAt === '2026-04-02')).toBe(true);
  await page.getByRole('button', { name: /Ver mapa/i }).click();
  await expect(page.locator('#app')).toContainText('Mapa de precampaña');
  expect(app.errores).toEqual([]);
});

test('muestra los 54 casos importados y los conserva al volver a abrir', async ({ page }) => {
  await page.addInitScript(() => {
    const row = (code, contract) => [code, contract, 'Cliente sintético', 'Dirección sintética'];
    const rows = Array.from({ length: 48 }, (_, index) => row(`CR1O2026${201 + index}`, `NC-MT-${index + 1}`));
    for (const type of ['DA', 'DF']) {
      for (let index = 0; index < 12; index++) {
        rows.push(row(`${type}1O2026${String(index + 1).padStart(2, '0')}1O00`,
          index < 3 ? `NC-MT-${index + 1}` : `NC-BT-${index + 1}`));
      }
    }
    window.XLSX = {
      read: () => ({ SheetNames: ['DetaSorteoCPT'], Sheets: { DetaSorteoCPT: {} } }),
      utils: { sheet_to_json: () => [['Número SIGET', 'Id del Usuario', 'Nombre del Usuario', 'Dirección'], ...rows] },
    };
  });
  const app = await abrirApp(page, { datos: {
    campaigns: { MT_2026_10: { year: 2026, month: 10, ownerArea: 'CPT MT', stage: 'pre_campaign' } },
  } });
  await app.ejecutar(() => openCampaign('MT_2026_10'));
  await page.getByRole('button', { name: /Importar listado Excel/ }).click();
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'Sintetico.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('fixture') });
  await page.getByRole('button', { name: 'Importar 54 casos' }).click();
  await expect(page.locator('#app')).toContainText('Casos vinculados (54)');
  await expect(page.locator('#app [onclick^="openCase("]')).toHaveCount(54);
  await expect(page.locator('#app')).toContainText('#CR1O2026248');
  const persisted = await app.ejecutar(() => window.__DB__);
  expect(Object.keys(persisted.cases)).toHaveLength(54);
  expect(Object.keys(persisted.servicePoints)).toHaveLength(48);
  const reopenedPage = await page.context().newPage();
  const reopened = await abrirApp(reopenedPage, { datos: persisted });
  await expect(reopenedPage.locator('#app')).toContainText('Octubre 2026');
  await reopened.ejecutar(() => openCampaign('MT_2026_10'));
  await expect(reopenedPage.locator('#app')).toContainText('Casos vinculados (54)');
  await expect(reopenedPage.locator('#app [onclick^="openCase("]')).toHaveCount(54);
  expect(reopened.errores).toEqual([]);
  await reopenedPage.close();
  expect(app.errores).toEqual([]);
});

test('elimina una campaña vacía y protege las campañas con casos', async ({ page }) => {
  const app = await abrirApp(page);
  await cerrarAlerta(page);
  await app.ejecutar(() => openCampaign('MT_2026_04'));
  await expect(page.getByRole('button', { name: 'Eliminar campaña', exact: true })).toBeDisabled();
  await app.ejecutar(() => deleteCampaign());
  expect(await app.escrituras()).toEqual([]);
  await app.ejecutar(() => { newCampaign(); setCampaignField('year', 2026); setCampaignField('month', 8); });
  await page.getByRole('button', { name: 'Crear campaña' }).click();
  await page.getByRole('button', { name: 'Eliminar campaña', exact: true }).click();
  await expect(page.locator('#app')).not.toContainText('Agosto 2026');
  const writes = await app.escrituras();
  expect(writes.some(([operation, path, values]) => operation === 'update' && path === '' && Object.hasOwn(values, 'campaigns/MT_2026_08') && values['campaigns/MT_2026_08'] === null)).toBe(true);
  expect(app.errores).toEqual([]);
});
