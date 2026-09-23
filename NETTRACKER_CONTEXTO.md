# NetTracker — Documento de contexto para Claude

## Qué es
PWA de una sola página (`index.html`) desplegada en GitHub Pages:
`alexgf004-maker.github.io/Nettracker`

Herramienta interna del equipo CPT INNOVA / DELSUR para gestión de analizadores de red, validaciones de tap y despachos de equipos. La usa David García y su equipo de campo.

---

## Stack técnico
- **Sin build**: HTML + CSS + JS con ES modules nativos. GitHub Pages sirve los archivos tal cual (no hay npm, bundler ni paso de compilación)
- **Firebase Realtime Database**: proyecto `pqfind`, toda la data persiste ahí
- **Sin frameworks**: JS puro, sin React ni Vue
- **PWA**: `manifest.webmanifest` + `icons/icon.svg`
- **Librerías por CDN** (en `index.html`): `xlsx` (leer/escribir Excel) y `html2pdf.js`

### Estructura de archivos
```
index.html               Solo el <head>, el <div id="app"> y la carga de js/main.js
manifest.webmanifest     Manifest de la PWA
icons/icon.svg           Ícono de la app
css/styles.css           Todos los estilos (variables de tema claro/oscuro incluidas)
js/
  main.js                Punto de entrada: registra handlers y arranca (sesión, sync, tema)
  firebase.js            Config de Firebase, `db` y las refs a cada nodo
  state.js               Objeto `state` con TODO el estado de la app
  config.js              Constantes: SEDES, TECNICOS, AREAS, USUARIOS, CONDICIONES, isAdmin()
  utils.js               Funciones puras: fechas, calcSt(), eqSt(), formularios vacíos
  ui.js                  showToast(), badges, abrirDoc()/descargarDoc(), tema, monitor de conexión
  data/sync.js           Listeners onValue() de Firebase → actualizan `state` y llaman render()
  actions/               Lógica de negocio (guardar, retirar, préstamos, carga Excel, login)
    auth.js · instalaciones.js · inventario.js · carga.js
  pdf/memos.js           Plantillas HTML de memorándums (movimiento, lote, carga masiva)
  views/                 Funciones que devuelven HTML (string) según el estado
    render.js            render(): arma header + modales + pestaña activa + nav
    layout.js            Header y barra de navegación inferior
    login.js             Pantalla de login y de mantenimiento
    modals.js            Todos los modales
    dashboard.js · instalaciones.js · inventario.js · validaciones.js · mapa.js · carga.js
  handlers/              Funciones `window.*` que llaman los onclick/onchange del HTML
    general.js · instalaciones.js · inventario.js · validaciones.js · carga.js
```

### Pruebas automáticas
`npm test` recorre la app con datos de ejemplo y una Firebase falsa (detalles en `tests/README.md`). GitHub las corre en cada pull request.

### Probar en local
Los ES modules **no funcionan abriendo el archivo con doble clic** (`file://`). Hay que servir la carpeta:
```
python3 -m http.server 8000     # y abrir http://localhost:8000
```

### Firebase config
```js
apiKey: "AIzaSyDmwLWle24Nldh-Y6YBmYLaaDA6ZTpuKuc"
authDomain: "pqfind.firebaseapp.com"
databaseURL: "https://pqfind-default-rtdb.firebaseio.com"
projectId: "pqfind"
```

### Firebase refs (nodos en uso)
| Variable | Nodo Firebase | Contenido |
|---|---|---|
| `installsRef` | `analizadores` | Instalaciones activas de analizadores |
| `equiposRef` | `equipos` | Inventario de equipos (analizadores, accesorios) |
| `historialCargasRef` | `historialCargas` | Historial de despachos/cargas |
| `historialAccesoriosRef` | `historialAccesorios` | Historial de despachos de accesorios |
| `validacionesRef` | `validaciones` | Validaciones de tap guardadas |
| `mantenimientoRef` | `config/mantenimiento` | Flag de modo mantenimiento (bool) |

---

## Constantes globales
```js
SEDES    = ['Plantel Central', 'Subestación Cucumacayán']
TECNICOS = ['David García', 'Bryan Francia', 'Francisco Chulo', 'Vicente Ramos']
ADMIN    = 'David García'
USUARIOS = [
  { nombre: 'David García',    pin: '2442', area: 'CPT MT' },
  { nombre: 'Bryan Francia',   pin: '8250', area: 'CPT MT' },
  { nombre: 'Francisco Chulo', pin: '0177', area: 'CPT BT' },
  { nombre: 'Vicente Ramos',   pin: '1190', area: 'CPT BT' },
]
```

---

## Cómo funciona el renderizado
**No hay framework reactivo.** `render()` (en `js/views/render.js`) regenera el `innerHTML` de `div#app` cada vez que cambia el estado. Cada pestaña tiene su propia función en `js/views/` que devuelve un string de HTML.

**Todo el estado vive en `state`** (`js/state.js`). Siempre se lee y escribe como `state.tab`, `state.valForm`, etc. (no existen variables sueltas). Después de cambiarlo hay que llamar `render()`.

```js
// Patrón estándar de handler (en js/handlers/<área>.js)
import { state } from '../state.js';
import { render } from '../views/render.js';

window.miHandler = (val) => {
  state.miEstado = val;
  render();
};
```

Los `onValue()` de Firebase (`js/data/sync.js`) también llaman `render()` cuando llegan datos nuevos.

Si una vista necesita abortar y redibujar (p. ej. el registro que se estaba viendo ya no existe), cambia el estado y devuelve `null`; `render()` vuelve a dibujar.

**Los `onclick="..."` del HTML solo ven funciones asignadas a `window`.** Si agregas un botón nuevo, su handler va en `js/handlers/` como `window.nombre = ...`.

### Helpers de HTML dentro de las vistas
Dentro del bloque de cada formulario (p. ej. `js/views/validaciones.js`) existen helpers locales:
```js
const inp  = (id, val, ph) => `<input id="${id}" value="${val}" placeholder="${ph}" ...>`
const sel  = (id, opts)    => `<select id="${id}" ...>${opts}</select>`   // bifasico
const tSel = (id, opts)    => `<select id="${id}" ...>${opts}</select>`   // trifasico
```
**Importante**: `sel()` y `tSel()` tienen `onchange="valVSOtro(this)"` en su definición — se usan para los selectores de Voltaje Secundario (VS). Si se usan para otros selectores (VP, TAP) el handler tiene un guard que los ignora.

---

## Tabs de navegación
| Tab | Descripción |
|---|---|
| `dashboard` | Vista principal — acciones rápidas, alertas, resumen |
| `instalaciones` | Registro de instalaciones activas de analizadores |
| `inventario` | Inventario de equipos (analizadores + accesorios) |
| `validaciones` | Validaciones de tap (mono/bi/trifásico) |
| `mapa` | Mapa con ubicación GPS de instalaciones activas |
| `carga` | Despachos y movimientos de equipos entre áreas |

---

## Área: Dashboard
Muestra acciones rápidas y alertas. `dashAction(accion)` ejecuta navegación rápida a sub-vistas:
- `'nueva-validacion'` → abre el flujo de validación de tap
- `'nueva-instalacion'` → formulario de nueva instalación
- Alertas de retiros pendientes, vencimientos próximos

---

## Área: Instalaciones
Registro de analizadores instalados en campo.

**Estado**: `records[]` (del nodo `analizadores`)
**Sub-tabs** (`instTab`): `'cpt_mt'` | `'cpt_bt'` | `'campos'`

**Campos de una instalación**:
- Serie del analizador, fecha instalación, fecha vencimiento
- Ubicación (lat/lng), municipio, nombre del medidor
- CT ratio, calibre cable, voltaje, área

**Funciones clave**:
- `newInstall()` / `saveInstall()` — crear/editar instalación
- `doRetiro()` — retirar analizador de campo
- `addToCalendar(id)` — agregar vencimiento al calendario

---

## Área: Inventario
Catálogo de equipos físicos del equipo.

**Estado**: `equipos[]` (del nodo `equipos`)
**Vistas** (`vistaInventario`): `'lista'` | `'detalle'`
**Filtros**: por status, área, búsqueda por texto

**Equipo tiene**:
- Serie, modelo, tipo (analizador / accesorio)
- Condición (`bueno` / `regular` / `malo`)
- Movimientos (préstamos/devoluciones), mantenimientos, historial de retiros

**Funciones clave**:
- `doMovimiento()` — registrar préstamo o devolución
- `generarMemo(id)` — genera PDF del memo de movimiento
- `generarLotePDF()` — memo de múltiples equipos a la vez
- `doCondicion()` — registrar condición del equipo
- `guardarMant()` — registrar mantenimiento
- `doRetiro()` / `doDescarga()` — retiro/descarga de campo

**Memo de movimiento** (`generateMemoPDF`):
- Caja "Entrega": muestra nombre de quien registró el movimiento (`registradoPor`)
- Caja "Recibe": queda en blanco para firma manual del receptor

---

## Área: Validaciones de Tap
Flujo para validar el tap de un transformador comparando lecturas de referencia vs campaña.

### Flujo de navegación (`valView`)
```
'lista' → seleccionar campaña
  → 'usuarios' → seleccionar caso (usuario)
    → formulario según tipo (mono/bi/tri)
      → calcular → guardar
```

### Tipos de instalación (`valTipoUsuario`)
| Tipo | VP campaña | VS opciones | TAPs (autollenado) |
|---|---|---|---|
| `monofasico` | 13200 / 7620 / 2400 V | 120 / 208 / 240 / 480 / Otro | `autoFillTaps()` |
| `bifasico` | 13200 / 7620 / 2400 V | 208 / 240 / 480 / Otro | `autoFillTaps()` — mismos TAPs que mono |
| `trifasico` | 23000 / 13200 / 4160 V | 208 / 240 / 480 / Otro | `autoFillTapsTri()` — TAPs × √3 |

### TAPs por VP (monofásico y bifásico)
| VP | TAPs |
|---|---|
| 13200 V | 14400, 13800, 13200, 12870, 12540 |
| 7620 V  | 8001, 7810, 7620, 7430, 7240 |
| 2400 V  | 2520, 2460, 2400, 2340, 2280 |

### TAPs por VP (trifásico — × √3)
| VP | TAPs |
|---|---|
| 23000 V | 24940, 23900, 22900, 22290, 21755 |
| 13200 V | 13860, 13530, 13200, 12870, 12540 |
| 4160 V  | 4364, 4260, 4157, 4054, 3950 |

### Voltaje Secundario "Otro"
Cuando el usuario selecciona "Otro..." en el select de VS (ref o campaña):
- `valVSOtro(this)` guarda `valForm.refVS = 'otro'` y llama `render()`
- `render()` dibuja un `<input>` morado para ingresar el voltaje manualmente
- `valVSOtroVal(this)` guarda el valor en `valForm.refVSOtro` o `valForm.cpVSOtro`
- `calcularValidacion()` lee esos valores cuando VS === 'otro'

### Campos del formulario (`valForm`)
```js
{
  tipoConexion, refCt, refMed, refVP, refVS, refTap,
  cpVS, cpVP, taps,
  // monofasico:
  refLec, cpLec,
  // bifasico:
  refLec1, refLec2, cpLec1, cpLec2,
  // trifasico:
  refLec1, refLec2, refLec3, cpLec1, cpLec2, cpLec3,
  // cuando VS = 'otro':
  refVSOtro, cpVSOtro
}
```

---

## Área: Mapa
Muestra instalaciones activas con GPS en un mapa Leaflet.
**Filtro** (`mapaFiltro`): `'TODOS'` | `'CPT MT'` | `'CPT BT'` | `'Campos y Servicios'`

---

## Área: Carga / Despachos
Gestión de despachos de equipos hacia campo y devoluciones.

**Sub-vistas** (`cargaSubView`): `'subir'` | `'historial'`
**Estado**: `historialCargas[]`, `historialAccesorios[]`

Permite:
- Registrar despacho por Excel (carga masiva)
- Generar memo de despacho de accesorios (`generarMemoAccesorios`)
- Ver historial de cargas anteriores

---

## Autenticación
Login por PIN, sin Firebase Auth (solo local en `sesionUsuario`).
```js
sesionUsuario = { nombre, pin, area }  // null = no logueado
```
`ADMIN = 'David García'` tiene acceso a funciones extra (modo mantenimiento, toggle dark mode global).

**Modo mantenimiento**: cuando está activo (`modoMantenimiento = true`), todos los usuarios excepto el admin ven una pantalla bloqueada.

---

## Reglas al editar el código

1. **Buscar el archivo del área** (tabla de estructura arriba): vista en `js/views/`, lógica en `js/actions/`, botones en `js/handlers/`
2. **Estado nuevo** → agregarlo en `js/state.js` y usarlo como `state.x`
3. **Función nueva usada en otro archivo** → `export` donde se define e `import` donde se usa (rutas relativas con `.js` al final)
4. **Handler para un `onclick`** → `window.nombre = ...` en `js/handlers/`
5. **`render()` debe llamarse** al final de cualquier handler que cambie estado visible
6. **Correr `npm test`** antes de publicar; si agregas una función importante, agrega su prueba en `tests/app.spec.js`
7. Probar en local con `npm run serve` (o `python3 -m http.server`)
