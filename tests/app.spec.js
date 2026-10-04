// Pruebas de humo con datos sintéticos. No contienen información operativa real.
const { test, expect } = require('@playwright/test');
const { abrirApp, cerrarAlerta } = require('./helpers');

test('permite seleccionar un perfil y entrar', async ({ page }) => {
  const app = await abrirApp(page, { usuario: null });
  await page.locator('#app [onclick^="selectLoginUser"]').first().click();
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.locator('#app')).toContainText(/acciones rápidas/i);
  expect(app.errores).toEqual([]);
});

test('carga las vistas principales', async ({ page }) => {
  const app = await abrirApp(page);
  await cerrarAlerta(page);

  for (const vista of ['Instalac.', 'Inventario', 'Despachos', 'Mapa', 'Inicio']) {
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
  await page.locator('nav.bottom-nav button', { hasText: 'Instalac.' }).click();
  await page.getByRole('button', { name: /Casos/ }).click();
  await expect(page.locator('#app')).toContainText('Cliente de prueba A');
  await page.getByText('#C-001').click();
  await expect(page.locator('#app')).toContainText('NC-TEST-001');
  expect(app.errores).toEqual([]);
});
