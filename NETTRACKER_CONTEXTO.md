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
css/icons.css            Íconos de línea (Lucide), generado con `npm run icons` (tools/gen-icons.js)
js/
  main.js                Punto de entrada: registra handlers y arranca (sesión, sync, tema)
  firebase.js            Config de Firebase, `db` y las refs a cada nodo
  state.js               Objeto `state` con TODO el estado de la app
  config.js              Constantes: SEDES, TECNICOS, AREAS, USUARIOS, CONDICIONES, isAdmin()
  utils.js               Funciones puras: fechas, calcSt(), eqSt(), formularios vacíos
  ui.js                  showToast(), badges, abrirDoc()/descargarDoc(), tema, monitor de conexión
  data/sync.js           Listeners onValue() de Firebase → actualizan `state` y llaman render()
  domain/                Reglas del trabajo, funciones puras (sin Firebase ni estado)
    trabajo.js           Tipo de caso (campaña/reclamo/requerimiento), periodo, plazos, urgencia
    pendientes.js        Lista de pendientes del Inicio (vencido / hoy / próximos días / por hacer)
    listados.js          Lectura de listados del ente, control de puntos y base de coordenadas; códigos DA/DF
    documentos.js        Cartas al cliente y hojas de inspección (HTML tamaño carta, una página por caso)
    multiplicadores.js   Estados, opciones y fórmulas de la hoja Multiplicadores; histórico por NC
    fechas.js            Fechas 1, 2 y 3: filas del Excel de cada fecha y revisión antes de despachar
    analisis.js          Análisis de los TXT (traslado de la macro CalidadEnergia_v1.bas)
    resultados.js        Situación y resultado de cada caso; cuadro resumen
    ft.js                Reglas del seguimiento de casos fuera de tolerancia
  actions/               Lógica de negocio (guardar, retirar, préstamos, carga Excel, login)
    auth.js · instalaciones.js · inventario.js · carga.js · revision.js · danio.js
    trabajo.js           Marcar entregas: campaña, informe de reclamo, requerimiento
    campanas.js          Precampaña: importar listados, completar datos, editar casos, exportar listado
    documentos.js        Generar cartas y hojas, pasos de la precampaña, datos de las cartas (config/cartas)
    multiplicadores.js   Editar el multiplicador de un caso, usar el histórico y exportar la hoja
    fechas.js            Asignar fecha y equipo a cada caso, exportar la fecha y enviarla a Despachos
  pdf/memos.js           Plantillas HTML de memorándums (movimiento, lote, carga masiva)
  views/                 Funciones que devuelven HTML (string) según el estado
    render.js            render(): arma header + modales + pestaña activa + nav
    layout.js            Header y menú (SECCIONES: Inicio · Trabajo · Recursos · Herramientas)
    login.js             Pantalla de perfiles y de mantenimiento
    trabajo.js           Pestañas Campañas, Reclamos, Requerimientos y Seguimiento FT
    casos.js             Tabla de casos de una campaña, ventana de importación y edición de un caso
    multiplicadores.js   Pestaña Multiplicadores de la campaña y su editor
    fechas.js            Pestaña Fechas de la campaña
    modals.js            Todos los modales
    dashboard.js · instalaciones.js · inventario.js · validaciones.js · mapa.js · carga.js
  handlers/              Funciones `window.*` que llaman los onclick/onchange del HTML
    general.js · instalaciones.js · inventario.js · validaciones.js · carga.js
```

### Pruebas automáticas
`npm test` recorre la app con datos de ejemplo y una Firebase falsa (detalles en `tests/README.md`). GitHub las corre en cada pull request.

### Vista de PC
Pantallas de 1024px o más (todo en `css/styles.css`, bloque `@media (min-width: 1024px)`):
- La barra inferior se convierte en menú lateral izquierdo con todas las secciones (en celular solo caben Inicio, Campañas, Reclamos y Equipos; el resto va en la hoja "Más")
- El contenido se centra (máx. 1180px) y las listas (`.list`, `.eq-lista`) pasan a varias columnas
- Los modales (`.modal-overlay`) se muestran como ventana centrada en vez de hoja inferior
- Detalles y formularios se limitan a 860px; `render()` pone `data-view` en `#app` para eso
- En celular no cambia nada

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
| `campanasRef` | `campanas/{AAAA-MM_AREA}` | `{ anio, mes, area, importado, casos, entrega }`: casos importados de los listados del ente y la marca de entrega en el sistema CPT DELSUR |

Campos de seguimiento dentro de `analizadores/{id}`: `informeEntregado: { fecha, por }` (reclamos), `entregaLimite: 'AAAA-MM-DD'` y `entregaRealizada: { fecha, por }` (requerimientos).

Los nodos `cases`, `campaigns`, `servicePoints`, `caseCodeIndex`, `caseIdsByCampaign` y `equipmentEvents` los creó una prueba anterior (ChatGPT, revertida): la app no los usa y no tienen datos reales.

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
**Importante**: los selectores de Voltaje Secundario (`vf-ref-vs`, `vf-cp-vs`) llevan `onchange="valVSOtro(this)"`. El handler tiene un guard que ignora cualquier otro selector.

---

## Tabs de navegación
El menú se arma con `SECCIONES` en `js/views/layout.js`; cada pestaña tiene su vista en `TAB_VIEWS` (`js/views/render.js`).

| Sección | Tab | Descripción |
|---|---|---|
| | `dashboard` | Inicio: pendientes, resumen del trabajo y de equipos, acciones rápidas, calendario |
| Trabajo | `campanas` | Casos CR/DA/DF agrupados por mes y área; entrega el día 10 del mes siguiente |
| Trabajo | `reclamos` | Casos RE; informe 8 días calendario después del retiro real |
| Trabajo | `requerimientos` | Otros códigos; fecha de entrega anotada a mano |
| Trabajo | `ft` | Seguimiento FT (pendiente de definir, próxima etapa) |
| Recursos | `inventario` | Equipos (analizadores + accesorios) |
| Herramientas | `instalaciones` | Registro de instalaciones de analizadores |
| Herramientas | `validaciones` | Validaciones de tap (mono/bi/trifásico) |
| Herramientas | `carga` | Despachos y movimientos de equipos entre áreas |
| Herramientas | `mapa` | Mapa con ubicación GPS de instalaciones activas |

---

## Trabajo (campañas, reclamos, requerimientos)
No hay registros aparte: todo se deduce de las instalaciones según el código del caso (`js/domain/trabajo.js`).
- **Campaña**: código que empieza con CR (regulación de tensión), DA (armónicos) o DF (flicker). Formato `CR` + nº de medición + mes (1-9, O, N, D) + año de 4 dígitos + … (ej. `CR112026201` = enero 2026). Se agrupa por mes/año y área (`2026-01_CPT-MT`).
- **Reclamo**: código que empieza con RE.
- **Requerimiento**: cualquier otro código.
- El área de una instalación de Campos y Servicios es su `areaBeneficiaria`.
- Etapa de cada instalación: programada → en campo → descarga pendiente → retirada.

## Precampaña (etapa 2, primera parte)
En **Campañas → Importar listados del ente** se suben los cuatro Excel del ente (MT, BT, DA y FK). Los datos empiezan debajo de "Número SIGET"; la dirección viene en tres columnas (colonia, calle, número).
- Los CR toman el área de su listado (MT → CPT MT, BT → CPT BT).
- Cada DA y DF es un usuario que ya está entre los CR: se liga por NC (`crRelacionado`) y toma su área. Si el NC no aparece en ningún CR, se avisa y no se importa.
- Cada caso se guarda en `campanas/{clave}/casos/{código del ente}` con `codigoEnte`, `codigo`, `tipo`, `nc`, `nombre`, `direccionEnte`, `municipio` y `depto`. Volver a importar actualiza los datos del ente sin tocar lo completado ni el código corregido.

En el detalle de la campaña:
- **Completar con control de puntos** (hoja LISTADO): busca cada caso por su código y, si no está, por NC; toma CT/DS (CENTROMTBT), medidor, alimentador (AL + "-" + TENSION, p. ej. AL091-23000), urbanidad, dirección y tipo de instalación. Las coordenadas de ese archivo no sirven y no se usan. Solo cuentan las filas con código de caso y se deja de leer en la primera fila vacía: las tablas pegadas al final (p. ej. "Usuarios con cambios o de baja", con el NC anterior) se ignoran. Si el control trae el código con otro NC (el ente cambió el usuario del punto), el NC del caso no se cambia: se guarda en `ncControl`, se muestra como "Control: NC" en la tabla y se avisa. Las coordenadas se buscan con el NC del caso y, si no hay, con `ncControl`.
- **Coordenadas**: la base de usuarios está en Firebase en `coordenadas/{NC} = [latitud, longitud]` (≈470 mil usuarios, se importa como JSON desde la consola de Firebase **en el nodo `coordenadas`**, nunca en la raíz). Al importar los listados, los casos sin coordenadas las toman de ahí; el botón "Completar coordenadas" hace lo mismo después. También se puede usar un archivo ("o desde un archivo"): columnas NC/IDCLIENTE y latitud/longitud o COORDX/COORDY; si vienen invertidas se acomodan por el rango de El Salvador, y se descartan las que caen fuera.
- **Editar un caso**: lo que se cambia a mano queda en `manual/{campo}` y ya no lo pisan los archivos. En DA/DF se corrige el tipo de sistema verificado en campo (dígito después del correlativo: 1 monofásico, 2 bifásico, 3 trifásico), lo que cambia el código; el ente no lo deja fijo.
- **Exportar listado**: Excel con las columnas del equipo (NC, CÓDIGO SIGET, NOMBRE, DIRECCIÓN, CORTE, MEDIDOR, LATITUD, LONGITUD, UBICACIÓN, ALIMENTADOR, URBANIDAD).

**Cartas y hojas de inspección** (panel "Precampaña" de la campaña):
- Las cartas usan el mismo texto que el equipo, con diseño nuevo. Se elige la fecha, el texto de la visita de instalación (por defecto "la primera semana del mes de {mes de la campaña} del {año}") y qué casos llevan carta. Salen sin firma: se piden por correo a la jefa.
- Firmante, cargo, contacto, contratista, ciudad, acuerdo, pie y logo se guardan en `config/cartas` desde la app ("Datos de las cartas"); no van en el código porque el repositorio es público.
- Las hojas de inspección tienen los mismos campos que la hoja del contratista, con los datos de cada caso arriba.
- Se abren como página para imprimir o guardar como PDF (`abrirDoc`).
- Seguimiento en `campanas/{clave}/precampana/{paso}` = `{ fecha, por }`: cartas y hojas se marcan al generarlas (con `total`); firma solicitada, cartas firmadas, entrega al contratista y evidencias recibidas se marcan a mano. "Listados importados" y "Datos completos" se calculan solos.

**Multiplicadores** (pestaña de la campaña; el detalle tiene pestañas Precampaña · Casos · Multiplicadores · Mediciones). Se guardan en `campanas/{clave}/casos/{id}/mult`:
- Estado: Realizado, Pendiente de validar, Validado con histórico, Cliente de baja, Revisar, Validado con usuario, Acceso denegado; los DF además "Conexión no posible" (como en el Excel).
- Configuración (Monofásico, Bifásico, Estrella, Delta, Estrella 2 hilos), posición de TAP (1-5, MP, Tapón, Interno), tensión según TAP (de la placa del trafo vista en campo), tensión de baja, X medidor, Testblock, lecturas Vab/Vbc/Vac opcionales y notas.
- Cálculos iguales a la hoja: ECAMEC = "tensión TAP/tensión baja"; DRANETZ = tensión TAP ÷ tensión baja; TI = MP → (X/120)·5 "/5", X ≠ 1 → X·5 "/5", X = 1 → "1/1"; proyección al primario = lectura × DRANETZ.
- Resumen: listos para medir (Realizado, Validado con histórico, Validado con usuario), por resolver (Pendiente de validar, Revisar, Acceso denegado, sin estado) y no se medirán (Cliente de baja, Conexión no posible). En CPT MT muestra los CR listos contra los 38 obligatorios.
- Histórico: si el mismo NC tuvo multiplicador en una campaña anterior registrada en la app, se ofrece "Usar", que copia la configuración y deja el estado "Validado con histórico".
- Exportar: Excel con las columnas de la hoja Multiplicadores (las de fechas, equipo y elementos quedan vacías hasta Fechas 1, 2 y 3).

**Fechas 1, 2 y 3** (pestaña de la campaña):
- Cada caso se asigna a una fecha (`casos/{id}/programa = { fecha, equipo }`) y a un equipo del inventario que no esté instalado, fuera de servicio ni en mantenimiento.
- Cada fecha tiene instalación, retiro y accesorios (`campanas/{clave}/fechas/{n}`); por defecto los accesorios son "3 pinzas de corriente, 4 caimanes, 4 alimentadores de voltaje tipo banana".
- Avisa si faltan fechas, equipos o multiplicadores, si un equipo se repite y cuántos casos listos para medir no tienen fecha.
- **Importar programación**: el Excel "Usuarios seleccionados" (hoja DATA GENERAL) trae la fecha de instalación de cada caso. Cada día distinto de una campaña queda como una Fecha en orden (MT suele tener 3; BT puede tener más). Los casos se buscan por código y, si no, por NC y tipo (en DA/DF el archivo trae el tipo de sistema corregido y se actualiza el código, salvo que se haya corregido a mano). Avisa si un código viene con otro NC, qué casos no vienen y qué filas no coinciden. La fecha de retiro no viene en el archivo.
- **Exportar Excel**: mismas columnas que las hojas Fecha1/2/3 (encabezado en la fila 3): Número SIGET, Equipo, Nombre del Usuario, Id del Usuario, Dirección, Multiplicador (ECAMEC), Corrientes (TI), Conexion (configuración), fechas, coordenadas y accesorios.
- **Enviar a Despachos**: abre la vista previa de la carga masiva con esas filas y las mismas validaciones que el Excel (`validarFilaCarga` en `actions/carga.js`); al confirmar se crean las instalaciones y el memo como siempre.

**Resultados** (pestaña de la campaña, base del cuadro resumen; `casos/{id}/resultado`):
- Cada caso se liga a su instalación por código y muestra su situación: sin instalar / programado en Fecha n, en campo, retirado con descarga pendiente, descargado, o no medido (Cliente de baja, Conexión no posible, Acceso denegado).
- **Analizar TXT**: se suben los TXT de ECAMEC (nombre del archivo = código del caso) y se calcula todo como la macro `CalidadEnergia_v1.bas` (ver abajo). El resultado se guarda en `casos/{id}/resultado` con `origen: 'txt'` y el `analisis` (estado, detalle, registros, intervalo, instalación, nivel, urbanidad, FebNoPer, inicio y fin). Los TXT quedan solo en memoria mientras la app está abierta: "Recalcular con los datos actuales" los vuelve a analizar después de corregir un dato del caso.
- También se puede anotar a mano (válida, fallida, por revisar o no medida; tolerancia; FebNoPer). Si no hay nada, se toma lo marcado al descargar ("la medición salió bien").
- "Exportar análisis" saca un Excel con las columnas de la hoja Resumen de la macro, para comparar.
- Resumen de válidas, fallidas, FT y sin resultado; en CPT MT, CR válidas contra 38.
- Exportar cuadro resumen con todos los casos del mes (también los no medidos). Formato provisional hasta tener uno ya entregado.

## Análisis de las mediciones (macro CalidadEnergia integrada)
`js/domain/analisis.js` reproduce `CargarMediciones` de `CalidadEnergia_v1.bas`:
- Tipo por prefijo: CR → regulatorio (15 min, 74 columnas, mínimo 576 registros válidos); DA/DF → perturbación (10 min, 197 columnas, mínimo 1008). En DA/DF el tipo de instalación sale del dígito 11 del código (1 mono, 2 bi, 3 tri).
- Datos del caso: configuración (multiplicadores), nivel de tensión del alimentador ("AL013-23000" → 23000) y urbanidad.
- Fases (columnas `U1 [V]`, `U2 [V]`, `U3 [V]`; con tensión = más de 300 V en más del 30 % de los registros): monofásico sin V2/V3 **y con V1** (cambio confirmado por el equipo); bifásico sin V3; trifásico/estrella/delta con las tres.
- FebNoPer: tolerancia U 6 % / R 7 %; nominal L-N para mono, bi y perturbaciones (46000→26600, 23000→13200, 13200→7620, 4160→2400, otro ÷√3) y L-L para tri/estrella/delta. Registro inválido si una fase activa está bajo el 70 % del nominal; FT si alguna fase activa sale de tolerancia. FebNoPer = FT ÷ (total − inválidos). Si todos son inválidos: "ERROR ALIM.".
- Estado en el orden de la macro: vacío → FALLIDA; sin nivel ni urbanidad → ADVERTENCIA; columnas ≠ esperadas → ADVERTENCIA; registros válidos < mínimo → FALLIDA; intervalo predominante distinto → FALLIDA; fases inválidas → FALLIDA; intervalos sueltos fuera de lo esperado → ADVERTENCIA; tipo no reconocido → ADVERTENCIA; si no, VÁLIDA.
- En la app: VÁLIDA → válida, con FT si el FebNoPer pasa de 5 % (confirmado); FALLIDA → fallida; ADVERTENCIA → "por revisar" (normalmente un dato mal puesto, como el nivel de tensión: se corrige y se recalcula).

## Seguimiento FT
Pestaña Trabajo → Seguimiento FT (`js/domain/ft.js`, `casos/{id}/ft`). Los casos FT salen de Resultados (válida + fuera de tolerancia):
- Plazo: 90 días calendario desde la instalación de la medición inicial (no desde el retiro ni la descarga).
- Paso 1: aviso a DELSUR por correo, lo antes posible (aparece en Inicio como pendiente de hoy hasta marcarlo).
- Ruta: Estudio y propuesta de obras, Transferencia de alimentador o CPT DELSUR y Planificación. Bitácora libre para los pasos (mediciones aledañas, memo, presupuesto…).
- Compensación diaria informada: solo se anota; el cálculo de montos está pendiente de definir.
- Remedición: el mismo código con el número de medición siguiente (CR1… → CR2…); si existe la instalación se muestra. Solo "Sí, se normalizó" cierra el caso.
- Pasados los 90 días queda vencido: se penalizan los 90 días y la compensación diaria sigue hasta solucionarlo.

Pendiente: verificar los cálculos con un Excel de multiplicadores ya lleno, importar el histórico de multiplicadores que tiene el equipo y el mapa para el contratista.

## Área: Inicio (dashboard)
`calcularPendientes()` (`js/domain/pendientes.js`) arma la lista; avisa desde 3 días antes (`DIAS_AVISO`):
- Retiros programados vencidos / de hoy / próximos
- Descargas pendientes después del retiro ("Por hacer", sin fecha)
- Informe de reclamo (vence 8 días calendario después de `fechaRetiroReal`)
- Requerimientos con `entregaLimite`
- Campañas sin marcar como cargadas (vence el día 10 del mes siguiente)

**Contar desde una fecha** (`config/seguimientoDesde`, compartido): lo que venció o se retiró antes de esa fecha no aparece en Pendientes (retiro programado, retiro real para descargas e informes, fecha límite de requerimientos y entrega de campañas). Sirve para no arrastrar mediciones viejas. Se pone desde el Inicio ("Contar solo desde hoy" o elegir fecha) y se quita con "Contar todo".

Por defecto muestra el área del perfil; "Todas las áreas" (`state.areaFiltro`) aplica también a las pestañas de Trabajo.

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

### Campos y Servicios (contratista)
Cada mes Campos y Servicios saca equipos de la **Subestación Cucumacayán**, los instala y los regresa ahí.
- Al retirar una instalación de Campos y Servicios (individual o masivo desde Despachos), el equipo regresa a **Subestación Cucumacayán** (`sedeRetorno()` en `config.js`)
- El despacho deja el equipo como *prestado* de CPT MT/BT a Campos y Servicios. La **devolución** desde Campos y Servicios (o eliminar ese préstamo) también lo deja en la Cucumacayán (`sedeDestinoMovimiento()` en `utils.js`)
- **Memo de equipo dañado** (`js/actions/danio.js`): botón "📝 Memo de equipo dañado" en el detalle de una instalación de Campos y Servicios
  - Prellenado con las fallas del retiro y su fecha; se elige la condición (Fuera de servicio / Con detalles) y opcionalmente el técnico de Campos y Servicios
  - Genera el memo (`generateMemoDanio`) con la fecha de retiro programado y firmas de CPT (nombre de quien lo genera), Subestación Cucumacayán y Campos y Servicios (en blanco)
  - Guarda los datos en `analizadores/{id}/memoDanio` (el botón pasa a "📄 Ver memo de equipo dañado" para reimprimir) y deja el equipo en la Cucumacayán con la condición elegida
  - "✏️ Editar" corrige el memo; si cambia la condición, también la del equipo (queda en su historial). La firma de CPT pasa a ser de quien edita (el autor original queda en `creadoPor`) y el memo muestra la última edición

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

**Envío a revisión (Cucumacayán)** (`js/actions/revision.js`):
Cuando un equipo asignado falla, la Subestación Cucumacayán es el primer filtro que lo revisa.
- Botón "📤 Enviar a revisión (Cucumacayán)" en la pestaña General del equipo (no aparece si está instalado en campo o ya está en revisión)
- Formulario prellenado con lo último registrado (fallas del último retiro de campo o la última nota de condición): motivo, qué le pasó y fecha del incidente, todo editable
- Al confirmar: genera el memo (`generateMemoRevision`), cambia la sede a Subestación Cucumacayán, la condición a "En mantenimiento" y agrega una ficha de mantenimiento pendiente con los datos del envío en `envioRevision`
- El memo se puede reimprimir desde esa ficha (pestaña Mant., botón "📄 Memo de envío")
- "✏️ Editar" en esa ficha corrige motivo, qué le pasó y fecha del incidente (no cambia sede ni condición); el memo muestra la última edición
- En el memo, la caja "Recibe" queda en blanco para firma

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
Cuando el usuario selecciona "Otro..." en el select de VS (ref o campaña), en los tres tipos de conexión:
- El `<input>` morado (`vf-ref-vs-otro` / `vf-cp-vs-otro`) siempre está en el HTML, oculto con `display:none` si VS no es "otro"
- `valVSOtro(this)` guarda `state.valForm.refVS` / `cpVS` y **solo muestra u oculta ese input, sin llamar `render()`**, para no borrar lecturas ya escritas
- `valVSOtroVal(this)` guarda el valor en `state.valForm.refVSOtro` o `state.valForm.cpVSOtro`
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

## Perfiles
Sin PIN ni Firebase Auth: al entrar se elige el perfil (`entrarComo(nombre)`), se guarda en `localStorage` (`cpt_session`) y el botón del header vuelve a la pantalla de perfiles. Sirve para saber quién registra cada cosa.
```js
sesionUsuario = { nombre }  // null = pantalla de perfiles
```
`ADMIN = 'David García'` tiene acceso a funciones extra (modo mantenimiento, eliminar registros).

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
8. **Sin emojis** en la interfaz: usar íconos `<i class="ic ic-nombre"></i>` (o `<i class=ic-nombre></i>` dentro de textos JS). Para uno nuevo, agregarlo a `tools/gen-icons.js` y correr `npm run icons`. En avisos (`showToast`, `confirm`) y documentos generados (memos, Excel), solo texto
9. **Reglas del trabajo** (plazos, tipos de caso) van en `js/domain/` como funciones puras, con su prueba en "Reglas del trabajo"
