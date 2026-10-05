# Pruebas automáticas

Recorren la app en un navegador real (Chromium) con **datos de ejemplo** y una **Firebase falsa en memoria**, así que nunca tocan la base de datos real.

Cada prueba verifica lo que se ve en pantalla, lo que se guardaría en Firebase, y que no haya errores de JavaScript.

## Correrlas

Una sola vez:
```
npm install
npx playwright install chromium
```

Cada vez que cambies algo:
```
npm test
```

GitHub también las corre solo en cada pull request y en cada push a `main` (pestaña **Actions**). Si alguna falla, el PR se marca en rojo.

## Archivos

| Archivo | Qué es |
|---|---|
| `app.spec.js` | Las pruebas, agrupadas por área |
| `fixture.js` | Datos de ejemplo (instalaciones, equipos, validaciones, despachos) |
| `helpers.js` | `abrirApp()`: abre la app con la Firebase falsa y la fecha fija en 23/09/2026 |
| `mock/` | Reemplazo de Firebase que guarda todo en memoria y registra cada escritura |
| `server.js` | Servidor local (`npm run serve` → http://localhost:8000) |

## Agregar una prueba

```js
test('lo que debería pasar', async ({ page }) => {
  app = await abrirApp(page);                  // entra como David García
  await cerrarAlerta(page);
  await app.ejecutar(() => switchTab('inventario'));   // llamar handlers window.*
  await expect(page.locator('#app')).toContainText('SN-100');
  expect(await app.escrituras()).toContainEqual(['remove', 'equipos/e6']);
});
```

Si una prueba necesita otros datos, agrégalos en `fixture.js` o pásalos con `abrirApp(page, { datos })`.
