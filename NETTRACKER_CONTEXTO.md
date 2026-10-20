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
- **PWA instalable**: `manifest.webmanifest` con íconos PNG 192, 512 y 512 maskable (más el SVG) y `icons/apple-touch-icon.png` para el iPhone; los PNG salen de `icons/icon.svg` con `node tools/gen-app-icons.js` (usa el Chromium de Playwright). `sw.js` (service worker): siempre busca primero en internet y solo usa lo guardado sin señal; Firebase, fuentes y librerías de otros sitios van directo a la red; solo se registra en el sitio publicado (no en localhost ni en las pruebas). Botón "Instalar app" en el menú del perfil y en la hoja "Más" del celular mientras la app no esté instalada (`js/actions/instalar.js`): con el aviso del navegador (Android, Chrome/Edge en la compu) lo abre; si no hay aviso, muestra los pasos (en iPhone: Safari → Compartir → Agregar a inicio).
- **Librerías por CDN** (en `index.html`): `xlsx` (leer/escribir Excel) y `html2pdf.js`

### Estructura de archivos
```
index.html               Solo el <head>, el <div id="app"> y la carga de js/main.js
manifest.webmanifest     Manifest de la PWA
sw.js                    Service worker (red primero, lo guardado solo sin señal)
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
  data/sync.js           Listeners onValue() de Firebase → actualizan `state` y llaman render(); al entrar se espera a que llegue el primer dato de todos los nodos (`state.datosListos`, máximo 8 s) con el "Cargando…", para que el inicio y el aviso no parpadeen
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
  pdf/memos.js           Plantillas HTML de memorándums (movimiento, lote, carga masiva, revisión, daño, accesorios)
  pdf/memo-base.js       Hoja común de los memos: estilo, encabezado, bloques (datos, movimiento, firmas) y pie
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
TECNICOS = ['David García', 'Bryan Francia', 'Francisco Chulo', 'Samuel Villalobos']
ADMIN    = 'David García'
USUARIOS = [
  { nombre: 'David García',      area: 'CPT MT' },
  { nombre: 'Bryan Francia',     area: 'CPT MT' },
  { nombre: 'Francisco Chulo',   area: 'CPT BT' },
  { nombre: 'Samuel Villalobos', area: 'CPT BT' },
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

## Diseño de las pantallas de campaña (identidad propia: degradado petróleo → turquesa)

Componentes en `css/styles.css` (sección "REDISEÑO DE CAMPAÑAS"); usarlos en pantallas nuevas en vez de inventar estilos:
- Identidad: degradado petróleo → turquesa (`--degradado`, #0b2e3b → #0e7490 → #0891b2) con una onda de medición de fondo (`--onda`) en la barra superior, encabezados, tarjetas de campaña y cabeceras de Fechas; fechas en tarjeta blanca (sin forma de boleto). La organización se inspiró en Daily-log, pero el aspecto debe verse distinto a la planilla. Los FT siempre en rojo.
- Toda la app usa la misma paleta: `--primary` #0e7490, `--primary-dark` #0b2e3b, `--accent` #06b6d4. Cada sección (Inicio, Campañas, Reclamos, Requerimientos, Seguimiento FT, Instalaciones, Equipos, Validación de TAP, Despachos) abre con `heroSeccion({ eyebrow, titulo, sub, derecha, kpis, acciones })` de `js/views/componentes.js`; el selector de área sobre el encabezado es `areaHero()`. El morado se reserva para mantenimiento de equipos.
- `.hero`: encabezado en degradado con `.hero-eyebrow`, `.hero-titulo`, `.hero-sub`, `.hero-chip` (rojo/ambar/verde según plazo), `.hero-kpis` (números; `.alerta` en rojo con latido) y `.hero-btn`. `.hero-rojo` para Seguimiento FT.
- `.pasos-tabs` / `.paso-tab`: pestañas de la campaña como pasos del proceso, cada una con su estado (`listo` en verde, `alerta` en rojo con `.badge-ft`). El avance se calcula en `avanceCampana(c)` (views/trabajo.js).
- `.bloque` + `.bloque-titulo` (título en mayúsculas con barra azul), `.tiles` / `.tile` (mosaicos de color que filtran la lista: t-verde, t-rojo, t-ambar, t-azul, t-gris, t-morado), `.meta` (barra de avance hacia una meta, p. ej. 38 CR), `.barra-acciones` con botones `.b-p` (principal), `.b-g` (secundario) y `.b-l` (enlace), `.ayuda` (explicación plegable), `.pildora` (filtros), `.tg` (etiqueta de estado con borde).
- `.tabla-r` dentro de `.tabla-caja`: tabla en PC que en celular (≤760 px) se vuelve una tarjeta por fila; cada celda lleva `data-l` con su nombre, `.cod` ocupa todo el ancho y `.vacio-m` se oculta en celular.
- Resultados: los FT van primero en `.ft-bloque` (FebNoPer, aviso a DELSUR, día del plazo de 90) y sus filas llevan `.fila-ft`. El filtro de resultados es `state.resultadosFiltro`; `verFTCampana()` abre Resultados filtrado en FT.
- Fechas como `.boleto`. Precampaña como línea de tiempo `.tl`.
- El modo oscuro de la app no se aplica hoy (las variables de `[data-theme="dark"]` quedan antes de `:root` y pierden); está pendiente.

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
- Cálculos iguales a la hoja: ECAMEC = "tensión TAP/tensión baja"; DRANETZ = tensión TAP ÷ tensión baja; TI = MP → (X/120)·5 "/5" (en red de 13200, X/63.5), X ≠ 1 → X·5 "/5", X = 1 → "1/1"; proyección al primario = lectura × DRANETZ.
- Autorrelleno (pedido del equipo, valores confirmados; todo editable): la red sale del alimentador del caso ("AL013-23000" → 23000; sin alimentador no se rellena). Al elegir configuración y TAP se pone la tensión según TAP (`TAPS_RED`): trifásico (delta, estrella) en 23000 24940/23900/22900/22290/21755, en 13200 14400/13800/13200/12870/12540, en 4160 4365/4260/4160/4053/3897; monofásico, bifásico y estrella 2 hilos en 23000 14400/13800/13200/12870/12540, en 13200 8001/7810/7620/7430/7240, en 4160 2520/2460/2400/2340/2280. Tensión de baja: 240 en monofásico, bifásico y delta; 208 en estrella; 120 en estrella 2 hilos. MP: 23000 → 24940/208, 13200 → 13200/208 (en 4160 no se rellena). Estado automático: Tapón o Interno → Pendiente de validar; con configuración, TAP, tensión según TAP, tensión de baja y X medidor → Realizado (el testblock no hace falta). Lo que pone la app queda en `mult.auto` (marca "automático" en el editor) y se recalcula; lo escrito o elegido a mano no se pisa.
- DA y DF desde su CR (pedido del equipo): al guardar el multiplicador de un CR se rellenan los DA y DF del mismo usuario (NC) en la campaña (`multiplicadorDeCR`, `aplicarDeCR`): configuración, TAP, tensiones, X medidor, testblock y estado iguales al CR, salvo en estrella, que va línea-neutro: tensión según TAP de la tabla monofásica del mismo TAP y 120 en baja (en MP, tapón o interno la del primario queda para escribirla). Lo escrito o elegido a mano en el DA/DF no se pisa (lo que puso la app va en `auto`); se guardan con `origen: 'cr'` y el editor del DA/DF lo explica.
- Resumen: listos para medir (Realizado, Validado con histórico, Validado con usuario), por resolver (Pendiente de validar, Revisar, Acceso denegado, sin estado) y no se medirán (Cliente de baja, Conexión no posible). En CPT MT muestra los CR listos contra los 38 obligatorios.
- Histórico: si el mismo NC tuvo multiplicador en una campaña anterior registrada en la app, se ofrece "Usar", que copia la configuración y deja el estado "Validado con histórico".
- **Puntos por validar**: "Listado por validar" (Excel, hoja "Por validar") y "Mapa por validar" (KML para My Maps) sacan solo los casos en Pendiente de validar o Acceso denegado (los sin estado y los de Revisar no), con las columnas del listado más ESTADO, MOTIVO y NOTAS del multiplicador (`casosPorValidar`/`filasPorValidar` en `domain/multiplicadores.js`). MOTIVO (pedido del equipo, `motivoPorValidar`): "Pendiente de validar: TAP con tapón", "Pendiente de validar: TAP interno", "Acceso denegado" o el estado. En el mapa la gota lleva el motivo en el nombre y en la descripción (con la nota) y su color: tapón ámbar, interno morado, acceso denegado rojo (`kmlMapa(…, { motivo, colores })`).
- Exportar: Excel con las columnas de la hoja Multiplicadores (las de fechas, equipo y elementos quedan vacías hasta Fechas 1, 2 y 3).
- Importar desde Excel: lee la hoja "Multiplicadores" de un Excel ya hecho (encabezados ESTADO + Código SIGET). Toma estado, configuración, posición de TAP, tensión según TAP, BT, X medidor, testblock y Vab/Vbc/Vac (0 = vacío); lo calculado (ECAMEC, DRANETZ, TI, proyecciones) lo recalcula la app. Cruza con los casos igual que la programación (`buscarCasoImportado` en trabajo.js: código y, si no, NC + tipo; aplica el código corregido de DA/DF si no se corrigió a mano). Vista previa con estados, reemplazos, códigos corregidos y casos sin datos; al guardar reemplaza `mult` (conserva las notas) con `origen: 'excel'`. También toma Fecha de instalación, Fecha de retiro y EQUIPO de la misma hoja (las hojas Fecha1/2/3 del Excel son filtros de ella): cada día de instalación es una Fecha en orden (`fechas/{n}/instalacion`, y `retiro` si viene) y cada caso recibe `programa/fecha` y `programa/equipo`. Filas sin ningún dato se ignoran.

**Fechas 1, 2 y 3** (pestaña de la campaña):
- Cada caso se asigna a una fecha (`casos/{id}/programa = { fecha, equipo }`) y a un equipo del inventario que no esté instalado, fuera de servicio ni en mantenimiento. El equipo se elige en una ventana con buscador (serie, modelo, viñeta, sede o área; Enter elige el primero); los que ya tiene otro caso de la campaña salen al final con su caso, y se puede quitar el equipo.
- Cada fecha tiene instalación, retiro y accesorios (`campanas/{clave}/fechas/{n}`); por defecto los accesorios son "3 pinzas de corriente, 4 caimanes, 4 alimentadores de voltaje tipo banana".
- Avisa si faltan fechas, equipos o multiplicadores, si un equipo se repite y cuántos casos listos para medir no tienen fecha.
- **Importar programación**: el Excel "Usuarios seleccionados" (hoja DATA GENERAL) trae la fecha de instalación de cada caso. Cada día distinto de una campaña queda como una Fecha en orden (MT suele tener 3; BT puede tener más). Los casos se buscan por código y, si no, por NC y tipo (en DA/DF el archivo trae el tipo de sistema corregido y se actualiza el código, salvo que se haya corregido a mano). Avisa si un código viene con otro NC, qué casos no vienen y qué filas no coinciden. La fecha de retiro no viene en el archivo.
- **Exportar Excel**: mismas columnas que las hojas Fecha1/2/3 (encabezado en la fila 3): Número SIGET, Equipo, Nombre del Usuario, Id del Usuario, Dirección, Multiplicador (ECAMEC), Corrientes (TI), Conexion (configuración), fechas, coordenadas y accesorios.
- **Enviar a Despachos**: abre la vista previa de la carga masiva con esas filas y las mismas validaciones que el Excel (`validarFilaCarga` en `actions/carga.js`); al confirmar se crean las instalaciones y el memo como siempre.

**Resultados** (pestaña de la campaña, base del cuadro resumen; `casos/{id}/resultado`):
- Cada caso se liga a su instalación por código y muestra su situación: sin instalar / programado en Fecha n, en campo, retirado con descarga pendiente, descargado, o no medido (Cliente de baja, Conexión no posible, Acceso denegado).
- **Analizar TXT**: se suben los TXT de ECAMEC (nombre del archivo = código del caso) y se calcula todo como la macro `CalidadEnergia_v1.bas` (ver abajo). El resultado se guarda en `casos/{id}/resultado` con `origen: 'txt'` y el `analisis` (estado, detalle, registros, intervalo, instalación, nivel, urbanidad, FebNoPer, inicio y fin). Los TXT quedan solo en memoria mientras la app está abierta: "Recalcular con los datos actuales" los vuelve a analizar después de corregir un dato del caso.
- Alimentador y urbanidad desde el resultado (MT): al tocar un caso se ven el alimentador (con el nivel de tensión que sale de él) y la urbanidad, con lo que da hoy la medición; "Corregir" (o Urbano/Rural) lo guarda como dato corregido a mano (`manual/alimentador`, el control de puntos ya no lo cambia) y recalcula al momento (`corregirDatoMedicion`). También en la columna Instalación de la vista previa del análisis. Sin el TXT en memoria se recalcula con los registros guardados (`series/…`): `txtDesdeSerie` arma un TXT con la fecha, U1/U2/U3 y el mismo número de columnas, y corre la misma macro (da lo mismo que el TXT). "Recalcular con los datos actuales" también usa esos registros en MT.
- También se puede anotar a mano (válida, fallida, por revisar o no medida; tolerancia; FebNoPer). El resultado solo sale del análisis de los TXT o de lo anotado a mano (confirmado): lo que se marca al descargar el equipo ("medición correcta" o con fallo) ya no cuenta como resultado; un caso descargado sin analizar dice "Falta analizar el TXT" y, si la descarga anotó un fallo, lo muestra como aviso.
- "Exportar análisis" saca un Excel con las columnas de la hoja Resumen de la macro, para comparar.
- Orden de la pestaña: casos FT arriba; luego "Resultados de la campaña" (CR obligatorios con el corte, Analizar TXT, recalcular y exportar); luego "Casos", con la lista separada por tipo (CR / DA / DF, `state.resultadosTipo`) y los mosaicos de válidas, FT (solo CR), fallidas, por revisar y sin resultado de ese tipo.
- Exportar cuadro resumen con todos los casos del mes (también los no medidos). Formato provisional hasta tener uno ya entregado.

## Campaña de CPT BT (otro flujo)
`flujoBT(area)` en `js/domain/trabajo.js` (confirmado con el equipo):
- No hay precampaña (el contratista no hace visita previa con fotos) ni multiplicadores. Pestañas: Casos · Fechas · Resultados · Mediciones. Los pasos de la tarjeta son Listado (datos completos), Fechas, Resultados y Entrega; en lugar de "Listos para medir" se cuentan los programados.
- Casos: se suben los listados, se completan con el control de puntos y se sacan el listado y el mapa, igual que MT.
- Fechas: con el mismo Excel "Usuarios seleccionados"; todos los casos se programan (no hay estado de multiplicador). La tabla muestra CT/DS y medidor; el Excel de cada Fecha lleva Transformador y Medidor en lugar de Multiplicador, Corrientes y Conexión (`COLUMNAS_FECHA_BT`) y al enviar a Despachos el transformador va en las notas y el medidor en su columna, como el formato de despacho de BT.
- Cartas por Fecha: se entregan al instalar, así que cada Fecha tiene "Cartas" (solo sus casos, mismo texto, la visita dice "el {día de instalación}"); se marca en `campanas/{clave}/fechas/{n}/cartas`.
- Resultados: se suben 105 CR (`CR_OBLIGATORIOS` en `domain/resultados.js`: MT 38, BT 105), con el mismo corte "Hasta aquí se sube" y en el cuadro resumen.
- Analizar TXT en BT usa la macro de BT (`MacroBT_1.bas`, `analizarMedicionBT` en `js/domain/analisis-bt.js`), para CR, DA y DF:
  - Datos del caso: tipo de instalación y urbanidad del control de puntos (el mismo con el que se completan los casos).
  - Nominal siempre 120 V; tolerancia 7 % urbano, 8 % el resto. Registro inválido si una fase activa baja de 84 V (70 %); FT si alguna sale de la banda; FebNoPer = FT ÷ válidos (más de 5 % es FT).
  - Fases con tensión: más de 18 V en más del 15 % de los registros. Si no coinciden con el tipo de instalación: ADVERTENCIA ("verificar con planilla física") y el FebNoPer se calcula con las fases del TXT.
  - ADVERTENCIA (por revisar): columnas distintas de 74 (CR) o 197 (DA/DF) en el formato nuevo; en DA/DF, el dígito del tipo de sistema no coincide con el tipo de instalación; fases que no coinciden; y (confirmado, la macro las dejaba VÁLIDAS con 0 %) sin urbanidad o sin tipo de instalación no se calcula el FebNoPer.
  - FALLIDA (pesa más que las advertencias y se agrega al detalle): menos de 576 registros válidos (CR) o 1008 (DA/DF); el intervalo de 15 o 10 min no llega al 80 % de los intervalos; todos los registros inválidos (ERROR ALIM.); archivo vacío.
  - Lee también el formato viejo ("X-Data" con AVrmsAvg/BVrmsAvg/CVrmsAvg). Gráficas con la banda de 120 V ± tolerancia.
- Instalación verificada en campo (solo BT, confirmado): en Resultados, al tocar un caso, "Instalación verificada en campo" (Monofásico / Bifásico / Trifásico); también en la columna Instalación de la vista previa del análisis. Se pone a todos los casos del usuario en la campaña (mismo NC: su CR y sus DA/DF) como dato corregido a mano (`manual/tipoInstalacion`, el control de puntos ya no lo cambia) y en las DA/DF cambia el dígito del tipo de sistema del código (confirmado). Lo ya analizado se recalcula al momento (`corregirInstalacionBT`).
- Recalcular sin el TXT (BT): con los registros que se guardan al analizar (`series/{campaña}/{caso}`, los de las gráficas; la tensión con 2 decimales desde este cambio, antes 0.1 V) se vuelve a correr la macro (`analizarSeriesBT`, el número de columnas sale del análisis anterior). "Recalcular con los datos actuales" usa los TXT en memoria y, si ya no están, esos registros. Los TXT del formato viejo no guardan registros: esos se suben de nuevo.

**Perturbaciones del mes (MT y BT)**: el ente manda 12 DA y 12 DF por mes para MT y BT juntas (normalmente 9 de BT y 3 de MT) y se suben 9 de cada tipo: en orden de código, las primeras 9 válidas sin importar el área; si una falla o no se mide, entra la siguiente (`subidaPerturbaciones`). En la pestaña "DA y DF" de la campaña (aparte de Resultados, en las dos áreas; muestra "n/9 DA · n/9 DF") se ven las DA y DF de las dos campañas del mes con área, equipo, situación y si se sube, no entra, está pendiente o ya no se sube; cuántas sube cada área, hasta cuál se sube y, si faltan, hasta cuál se subiría si las pendientes salen válidas.

## Excel que genera la app

- Librería: **xlsx-js-style** (SheetJS con estilos) desde jsDelivr; lee y escribe igual que SheetJS y además guarda formato. En las pruebas se carga desde `node_modules/xlsx-js-style`.
- `js/excel.js`: `darEstilo(ws, { encabezado })` pinta la fila de encabezado en petróleo con letra blanca, bordes finos, filas alternadas y filtro; las filas de arriba del encabezado se tratan como título. `hojaConEstilo(filas, { encabezado, anchos })` es el atajo. Se usa en listado, multiplicadores (DRANETZ con 2 decimales), fechas (encabezado en la fila 3), análisis, validaciones y reporte mensual.
- **Cuadro resumen** (mismo formato que el cuadro que entrega el equipo, p. ej. agosto 2026): CR en A:C (CASO, ESTADO, COMENTARIO) con ESTADO DT (verde 00B050), FT (rojo), Fallida (amarillo) o No instalada (letra roja); DA/DF en H:J con Válida / Fallida / No instalada. Conteos con fórmulas COUNTIFS (DT, FT, VÁLIDAS; Fallida, No instalada, NO VÁLIDAS; y Válidas/Fallida/No instalada/TOTAL de DA/DF). En MT: "Número de mediciones a subir" 38 y "Número de caso hasta que se cargará" con fórmula INDEX/MATCH sobre la columna K, que acumula las DT/FT (igual que su Excel). No instalada = no se va a medir (acceso denegado, cliente de baja…) o no medida; lo programado sin resultado queda en blanco. Los colores son fijos (la librería no escribe formato condicional): si cambian un estado a mano, los conteos se recalculan pero el color no.
- **Hasta qué medición se sube** (`corteSubida`, solo CPT MT): en orden de código se cuentan los CR con medición válida (DT o FT) hasta llegar a los 38 obligatorios; ese CR es el último que se sube. Se muestra en el Excel (línea 2 y borde grueso en la celda) y en Resultados (en la barra de los 38 CR, etiqueta "Hasta aquí se sube" en la fila y los CR siguientes atenuados con "No se sube").

## Análisis de las mediciones (macro CalidadEnergia integrada)
`js/domain/analisis.js` reproduce `CargarMediciones` de `CalidadEnergia_v1.bas`:
- Tipo por prefijo: CR → regulatorio (15 min, 74 columnas, mínimo 576 registros válidos); DA/DF → perturbación (10 min, 197 columnas, mínimo 1008). En DA/DF el tipo de instalación sale del dígito 11 del código (1 mono, 2 bi, 3 tri).
- Datos del caso: configuración (multiplicadores), nivel de tensión del alimentador ("AL013-23000" → 23000) y urbanidad.
- Fases (columnas `U1 [V]`, `U2 [V]`, `U3 [V]`; con tensión = más de 300 V en más del 30 % de los registros): monofásico sin V2/V3 **y con V1** (cambio confirmado por el equipo); bifásico sin V3; trifásico/estrella/delta con las tres.
- FebNoPer: tolerancia U 6 % / R 7 %; nominal L-N para mono y bi (46000→26600, 23000→13200, 13200→7620, 4160→2400, otro ÷√3) y L-L para tri/estrella/delta, igual en CR y perturbaciones (la macro usaba L-N en todas las perturbaciones; cambiado a pedido del equipo). Registro inválido si una fase activa está bajo el 70 % del nominal; FT si alguna fase activa sale de tolerancia. FebNoPer = FT ÷ (total − inválidos). Si todos son inválidos: "ERROR ALIM.".
- Estado en el orden de la macro: vacío → FALLIDA; sin nivel ni urbanidad → ADVERTENCIA; columnas ≠ esperadas → ADVERTENCIA; registros válidos < mínimo → FALLIDA; intervalo predominante distinto → FALLIDA; fases inválidas → FALLIDA; intervalos sueltos fuera de lo esperado → ADVERTENCIA; tipo no reconocido → ADVERTENCIA; si no, VÁLIDA.
- En la app: VÁLIDA → válida, con FT si el FebNoPer pasa de 5 % (confirmado); FALLIDA → fallida; ADVERTENCIA → "por revisar" (normalmente un dato mal puesto, como el nivel de tensión: se corrige y se recalcula).

## Gráficas de voltaje y corriente

- Al guardar el análisis de los TXT (Resultados → Analizar TXT → Guardar resultados) se guardan las series en `series/{campaña}/{caso}`: `inicio`, `fin`, `t` (minutos desde el inicio), `U.{1,2,3}.{v,min,max}` (V, 1 decimal), `I.{1,2,3}.{v,max}` (A, 2 decimales), `nominal`, `tolerancia` y `codigo` (~60 KB por caso). Van aparte de `campanas` para que la app no las cargue con la campaña; se leen con `get` al abrir las gráficas. El resultado del caso lleva `graficas: true`.
- `js/domain/series.js` lee el TXT de ECAMEC por nombre de columna (`U1 [V]`, `U1Min [V]`, `U1Max [V]`, `I1 [A]`…); si no hay corriente con ese nombre se informa qué columnas `[A]` traía. `fasesActivas` descarta fases en cero o con ruido.
- `js/views/graficas.js`: SVG propio sin librerías. Voltaje con la banda de tolerancia (nominal ±6 % U / ±7 % R, la misma del FebNoPer) y corriente en otra gráfica (nunca dos escalas en una). Colores de fase: azul, naranja, aqua. Cursor sincronizado en ambas con fecha y valor de cada fase; resumen por fase (promedio, mín, máx, % fuera) y "Descargar datos en Excel".
- Se abren desde el ícono de la fila en Resultados, el bloque rojo de FT, el editor del resultado y el detalle en Seguimiento FT.
- Ojo: el TXT real de ECAMEC (p. ej. CR122026234) trae los 74 encabezados repetidos dos veces (148 columnas); la macro y la app lo marcan "por revisar" por número de columnas.

## Expedientes de reclamo

- Un reclamo es un expediente (`reclamos/{RE-<resto del código>}`) que se crea **a mano** con "Nuevo reclamo" (confirmado: las instalaciones RE sueltas no se vuelven expedientes ni generan pendientes). Se pega el asunto y la tabla del correo de DELSUR y `leerCorreoReclamo` (`js/domain/expedientes.js`) llena código, WO, CT, motivo, zona, ID de usuario (NC), nombre, dirección, centro MT/BT o corte y medidor.
- Proceso: recibido → ubicado (coordenadas por NC desde la base o a mano) → instalado → retirado (normalmente al 8.º día; "Registrar instalación" abre el formulario con el código, la dirección y el retiro a 8 días) → analizado → informe entregado (8 días calendario desde el retiro).
- Mediciones: hasta 6, el mismo código con el número de medición siguiente (RE1… → RE2…). Cada una se liga sola con su instalación por código; el informe entregado se guarda en la instalación (`informeEntregado`).
- Puntos de medición: en cada medición puede haber varios equipos a la vez (medidor, trafo, tablero…). El **punto principal** lleva el código RE y es el que manda (FT y plazo del informe). Los demás se anotan con un nombre libre (p. ej. "tableroprincipal") y se vinculan desde el expediente ("Agregar punto": registrar una instalación nueva o vincular una existente); la instalación guarda `reclamo: { id, n, punto }`. Cada punto tiene su análisis; el informe es uno solo. Las instalaciones vinculadas dejan de contar como requerimientos (`tipoDeRegistro`). Los avisos de armónicos y flicker incluyen todos los puntos. Varios analizadores con el mismo código (pedido del equipo): si están en campo a la vez, la principal es la primera que se instaló y las demás salen como puntos "(mismo código)" con un aviso y "Ponerle nombre" (`instalacionesMismoCaso` en `domain/resultados.js`; también lo usa `instalacionDeCaso`); si no se enciman, la última reemplaza a la anterior (reinstalación). Al registrar una instalación con un código RE que ya tiene un analizador en campo, pregunta si es otro punto del mismo reclamo y pide su nombre (queda `reclamo: { id, n, punto }`).
- FT: si el análisis da FebNoPer > 5 % (tensión) el expediente pasa a FT con el mismo tratamiento de un caso regulatorio: aviso a DELSUR, 90 días desde la instalación de esa medición, ruta, bitácora y remedición (`reclamos/{id}/ft`, mismas acciones de Seguimiento FT con clave `reclamo`). Aparece en Seguimiento FT y en el Inicio junto a los de campaña (`todosFT`).
- Armónicos o flicker (P95 del PST > 1) fuera de límite: solo aviso en el expediente; le compete al usuario (confirmado).
- Pendientes del Inicio: "Ubicar e instalar el reclamo" mientras no hay instalación, "Entregar informe del reclamo" por medición retirada y los de FT.

## Levantamiento (Herramientas)

- Levantamiento de red en campo con el GPS del celular, independiente de los casos con una referencia libre (confirmado), guardado en la base para el equipo: `levantamientos/{id}` = { nombre, referencia, creado: { fecha, por }, puntos: { id: { lat, lng, tipo, nombre, nota, acc, manual, movido, orden, por, fecha } }, vanos: { id: { a, b, tramo, metros, orden } } }.
- En el celular (≤ 900 px) el levantamiento ocupa toda la pantalla, sin la barra de CPT INNOVA ni el menú de abajo (tiene su propio botón para volver). La hoja de abajo llega al 42 % de la pantalla en Marcar (64 % en las otras pestañas) y con el asa de arriba se baja para dejar solo las pestañas (`hojaMin`); tocar una pestaña la vuelve a subir.
- Mapa Leaflet (unpkg 1.9.4, se carga solo al abrir un levantamiento) con calles (OpenStreetMap) o satélite (Esri), a elegir (confirmado); sin internet se sigue marcando con el GPS. El mapa se crea una sola vez y se vuelve a colocar después de cada `render()` (gancho `alRedibujar` en `views/render.js`, registrado desde `handlers/levantamiento.js`). El GPS (`watchPosition`, alta precisión) solo corre con un levantamiento abierto; se muestra la precisión y "Seguir mi ubicación".
- "Poste aquí" (flotante sobre el mapa; en celular fijo sobre la barra) marca un punto en la posición actual con el tipo elegido (simbología de red de Dibujar), lo nombra solo (P1, P2…) y lo une con el anterior con el tipo de vano elegido. Con precisión peor a 15 m pide confirmar. También se marca tocando el mapa. Al tocar un punto: nombre, tipo, nota, "Seguir desde aquí" (ramal), "Unir con otro punto", "Mover a mi ubicación", arrastrarlo para corregir y borrar. "Quitar el último".
- Imán en campo (pensado para el celular): los puntos del mapa son de 44 px y tocar a menos de 36 px de un punto lo toma a él (no crea otro; con "Unir al punto anterior" cierra el vano con él). "Poste aquí" a menos de la precisión del GPS (entre 3 y 8 m) de un punto ya marcado pregunta si es el mismo poste: Aceptar sigue desde ese punto (y lo une con el anterior, sin duplicar vanos); Cancelar marca uno nuevo.
- Corregir en campo: cualquier punto se arrastra directo (sin seleccionarlo antes); la última movida se puede deshacer ("P3 movido. Deshacer"). Tocar a menos de 24 px de una línea (sin punto cerca) pregunta si poner un punto del tipo elegido en medio de ese vano: A–B pasa a A–nuevo–B (`cambiosPartirVano`), del mismo tipo de vano; los metros medidos del vano partido se quitan (hay que medir de nuevo) y el punto nuevo queda seleccionado.
- Acometidas por vano (confirmado: por tramo de poste a poste y total; 120 A, 120 B y 240; conteo y diferencia; pasan a la lámina y al KML): bloque "Acometidas" con botones grandes +120 A, +120 B, +240 (y − para corregir, sin bajar de cero). Por defecto cuentan en el "próximo vano desde" el punto actual: quedan en `levantamientos/{id}/pendiente` = { desde, a, b, d } y pasan al vano (`vanos/{id}/acom` = { a, b, d }) cuando se marca o une el siguiente poste desde ese punto; también se elige un vano existente para corregirlo. Total del levantamiento con el balance: fase A = 120 A + 240, fase B = 120 B + 240, diferencia = |120 A − 120 B| y qué fase tiene más. En Dibujar van junto a los metros del vano ("Acom. A:3 B:2 240:1") y en el cajetín una tabla "Acometidas" (por fase, 240 y diferencia), con la casilla `verAcometidas`.
- Pantalla pensada para el celular (`lev-app`): ocupa todo el espacio entre el encabezado y la barra de abajo (en la compu, al lado del menú). Arriba una barra con volver, nombre, resumen, estado del GPS y "Quitar el último". El mapa llena la pantalla con "Poste aquí" encima (o el aviso de tocar el mapa), Calles/Satélite y el botón de seguir mi ubicación. Abajo una hoja con pestañas (`u.hoja`): Marcar (modo GPS o tocar, unir al anterior, tipo de punto, tipo de vano y acometidas; siempre a la vista), Punto (se abre sola al tocar un punto: acciones, nombre, tipo, nota, altura y estructuras), Vanos (tarjetas con metros, calibre, conductor y tipo) y Más (nombre, referencia, Pasar a Dibujar, KML, eliminar). En la compu la hoja es un panel a la derecha.
- Orden tipo "ajustes del celular" (confirmado): en Marcar y en el punto cada dato es una fila con su valor y una flecha (Punto, Vano, Marcar con GPS/Tocar mapa, Unir al anterior; en el punto: Altura, Estructuras, Tipo, Nombre, Nota) y al tocarla se abre una ventana solo para eso (`u.picker`): las de una opción se cierran al elegir; estructuras, nombre y nota tienen "Listo". En el celular la ventana sube desde abajo; en la compu va a la derecha. El punto muestra arriba su nombre y tipo y los botones Seguir desde aquí, Unir, Mover a mi ubicación y Borrar. Acometidas: fila "Contando en" (abre la lista de vanos), tres botones grandes 120 A / 120 B / 240 con su cuenta adentro (tocar suma) y "− 1" debajo, y el total del levantamiento por fase con la diferencia.
- Distancias: las de cada vano salen de las coordenadas (`distancia`, haversine; precisión del celular 3 a 10 m); los metros medidos con cinta o telémetro se escriben en el vano y mandan.
- Distancias en el mapa (pedido del equipo: en vanos cortos las etiquetas tapaban el mapa): solo se muestran las que no se enciman con el símbolo o el nombre de un punto ni con otra distancia (`distanciasQueCaben`; primero las de los vanos más largos en pantalla; al centro del vano o un poco hacia una punta). Se recalculan al acercar o alejar; el mapa se puede acercar hasta el zoom 22 (la imagen del zoom 19 agrandada) para ver los vanos cortos. Botón "m" para ocultar o mostrar todas (`state.lev.distancias`). Las medidas a mano con borde oscuro; las del GPS en gris. Todas están siempre en la pestaña Vanos.
- Transformador sobre el poste (pedido del equipo): en Punto, "Transformador" con los kVA de cada unidad (5, 10, 15, 25, 37.5, 50, 75, 100, 167 o escritos; varias unidades = banco). Se guarda `trafos` = ['25', …] en el punto. Texto: "Trafo 25 kVA", "Banco 3 × 50 kVA" o "Banco 25 + 50 kVA" (`textoTrafos`). Un poste con transformadores se ve con el símbolo de transformador (banco si son varios; proyectado si el poste es proyectado; `simboloPunto`), con los kVA bajo el nombre en el mapa, en la etiqueta de la lámina de Dibujar y en el KML.
- Mapa de fondo al pasar a Dibujar (pedido del equipo): en Más se elige "Calles" (por defecto), "Satélite" o "Sin mapa" (`state.lev.fondoDibujo`). La app baja las teselas de la zona (OpenStreetMap o Esri, las mismas del mapa del levantamiento) al zoom con más detalle que la lámina (hasta 19, máximo 48 teselas; `teselasLamina`), las arma en una imagen de la lámina × 1.5 con el crédito del mapa abajo a la derecha (lo piden sus condiciones de uso) y queda como fondo de Dibujar (`mapaDeFondo`), alineada con los postes (`aDibujo` devuelve `geo` y `latLngDe`; en una zona de unas cuadras Mercator y la proyección local coinciden). Sin conexión pasa sin fondo con un aviso. En la lámina de propuesta el plano se recorta a lo dibujado también con imagen de fondo.
- Salidas: "Pasar a Dibujar" arma la lámina (`aDibujo`: croquis en blanco con el norte arriba y la escala exacta, postes, vanos con sus metros medidos, etiquetas con nombre y nota) y "KML para Google Earth" (`kmlLevantamiento`).
- Archivos: `js/domain/levantamiento.js`, `js/actions/levantamiento.js`, `js/views/levantamiento.js`, `js/handlers/levantamiento.js`. Pruebas con el GPS simulado de Playwright y Leaflet real desde node_modules (`abrirApp(page, { leaflet: true })`).

## Dibujar (Herramientas)

- Pestaña aparte, sin relación con ningún caso (confirmado). Pensada para las propuestas de modificación de red sobre la captura del mapa, como lámina profesional (no solo rayas sobre la imagen). Solo se descarga (confirmado): PNG de la lámina completa o "Copiar" para pegar en Word; el borrador queda en este navegador (`localStorage` `nettracker_dibujo`, con escala y cajetín). La imagen se reduce a 2400 px por lado. El PNG se exporta al triple de resolución de la hoja (máximo 8000 px por lado) para que se lea nítido al acercarlo; las letras del cajetín, las tablas, los metros de los vanos y las etiquetas son más grandes.
- Proyectos (confirmado: en la base para el equipo, nombre y referencia libre, imagen en JPG): "Guardar como proyecto" pide nombre y referencia y guarda `dibujos/{id}` = { nombre, referencia, creado, editado: { fecha, por } } (liviano, para la lista) y `dibujosDatos/{id}` = { fondo: { src JPG, w, h }, datos: JSON de { elementos, escala, lamina } } (se baja solo al abrirlo; el JSON evita que la base pierda arreglos vacíos). Con un proyecto abierto la barra muestra su nombre, "Cambios sin guardar"/"Guardado" y "Guardar" (actualiza el mismo); "Proyectos guardados" lista, abre y elimina; "Cerrar proyecto" deja el dibujo como borrador. Abrir otro o "Nuevo" con cambios sin guardar pide confirmar. El borrador local recuerda el proyecto abierto. Gana el último que guarda.
- Lienzo y zoom: el lienzo usa el alto libre de la pantalla (debajo de la barra fija, cuyo alto se mide tras cada render en `--dib-barra`). Zoom con −/+ (o teclas - + 0), "Ajustar", Ctrl + rueda o pellizco del trackpad y, en el celular, con dos dedos (si un dedo ya había empezado algo, se deshace). Con zoom, arrastrar el fondo con "Seleccionar" desplaza la vista; también la rueda apretada o la barra espaciadora. La vista (`viewBox`) no se guarda. "Pantalla completa" deja solo la barra (en el celular en una fila que se desliza) y el lienzo; ahí la rueda sola hace zoom; Escape sale. Tiradores e imán se miden en px de pantalla, así que con zoom siguen del mismo tamaño. Los metros sobre los vanos salen un poco más grandes (mínimo 15 px de lámina).
- Metros que se arrastran: con "Seleccionar", el chip de metros de cada vano (y la medida de una cota) se arrastra para que no queden encimados; se guarda como desfase desde el centro del vano (`desfases[i]` en la polilínea, `desfase` en la cota) y, si se aleja, una guía punteada lo une al vano. "Metros a su lugar" / "Medida a su lugar" los devuelve. Símbolo de red "Puente al vuelo" (derivación sin poste; arco con punto de conexión, verde azulado), con imán como los postes y también como tipo de punto en Levantamiento.
- Datos técnicos (`domain/red.js`, confirmado): altura del poste en pies (lista 26, 35, 40, 50, 55, 60 o escrita), estructuras del poste (varias; lista de los pliegos de estructuras: primaria 23xx, secundaria, neutro y anclas, más códigos escritos a mano; el sufijo 1/2/3 se deja tal cual, sin interpretar; TD3 y el cruce vertical secundario no se leían en las fotos y no están en la lista) y conductor del tramo (calibre #6, #4, #2, #1/0, #2/0 o escrito, y tipo ACSR, Triplex, Cuádruplex, Aluminio desnudo, Cobre), con calibre distinto por vano (`calibres[i]`). En la lámina: el conductor junto a los metros del vano ("40.0 m · #2 ACSR") y la altura y estructuras junto al poste ("35' · 23TS3 / TS3", se arrastra); casillas del cajetín para mostrar u ocultar cada uno (`verCalibre`, `verAltura`, `verEstructuras`). El conductor y los tramos nuevos heredan el último. También en Levantamiento (punto: `altura`, `estructuras`; vano: `calibre`, `conductor`), pasan a Dibujar y salen en el KML.
- Lámina de propuesta (`domain/propuesta.js`; pedido del equipo, estilo "informe moderno" elegido entre dos ejemplos): para que quien ejecuta o presupuesta entienda la propuesta. Cada poste, transformador, símbolo de red o tramo tiene su acción en la propuesta (panel "En la propuesta": Sin cambio, Instalar, Reemplazar, Retirar, Trasladar, con un detalle opcional; `accion`, `detalleAccion`). Lo proyectado (poste y transformador proyectados, red BT/MT proyectada) ya es Instalar y la red a retirar ya es Retirar (`accionDe`). Los transformadores llevan sus kVA (`trafos`, uno por unidad; también vienen del levantamiento).
  - Trabajos a ejecutar (`trabajos`): uno por elemento con acción, numerado, con texto y cantidad armados solos ("Poste 26' con RS3 (P8)", "Transformador 37.5 kVA en P4", "Red BT #2 Triplex, P7–P8" con los metros); los tramos seguidos con la misma acción, tipo y conductor salen como uno solo ("P1–P3"). Se corrigen en el panel de la lámina (`lamina.trabajos[id] = { texto, cantidad, oculto }`), se quitan y se vuelven a poner, y se agregan a mano (`lamina.trabajosExtra`). Confirmado: automáticos y editables.
  - Cantidades de obra (`cantidades`): postes por altura, transformadores por kVA, estructuras de los postes nuevos o reemplazados, metros de conductor por calibre y tipo (por vano), retiros y traslados. Sin porcentaje adicional por flecha.
  - Dos láminas en carta horizontal (confirmado), SVG de 1650 × 1275: 1 · situación actual (sin lo nuevo; lo que se retira o cambia como está hoy) contra propuesta, lado a lado con el mismo encuadre, y debajo "Problema encontrado" y "Con la propuesta" (`lamina.problema` / `lamina.solucion`, una línea por dato, "dato: valor"); 2 · propuesta para ejecutar: plano en tarjeta con fondo tipo mapa, trabajos numerados sobre el plano, X roja en lo que se retira o reemplaza, conductor viejo en rojo punteado junto al nuevo, leyenda y escala flotantes, norte; a la derecha las tarjetas de trabajos (acción con color: Instalar turquesa, Reemplazar índigo, Retirar rojo, Trasladar ámbar) y las cantidades. Encabezado con tipo de propuesta, título (descripción del cajetín), referencia y cifras clave (trabajos, metros de red nueva, postes nuevos, kVA que se agregan); pie con elaboró, revisó, aprobó y número de lámina. Colores propios de la lámina: existente gris pizarra, nuevo turquesa, a retirar rojo (el editor conserva los suyos). Sin imagen de fondo el plano se acerca a lo dibujado.
  - Qué se pone y adónde va (pedido del equipo: "no se entiende qué se pone al reemplazar"): al elegir una acción sale debajo qué significa. Reemplazar abre "Se cambia por" con lo de hoy y los mismos botones de siempre: conductor (tramo), altura y estructuras (poste), kVA (transformador) (`el.reemplazo`; el elemento guarda lo de hoy). Trasladar (solo postes y símbolos; la red los sigue) tiene "Marcar dónde queda": el siguiente toque en el plano es el lugar nuevo (`el.traslado` = centro nuevo; con escala dice los metros). La propuesta aplica ambos (`elementosPropuestos`: reemplazos con lo nuevo; lo trasladado en su lugar con los tramos y la etiqueta que llegan a él); la situación actual los quita. En la lámina lo nuevo va en turquesa y lo de hoy tachado en rojo debajo; el traslado lleva círculo punteado donde está hoy y flecha naranja. En el editor: "35' · RS3 → 40' · TS3", "#4 ACSR → #2 Tpx" y la flecha. Trabajos: "Cambiar conductor #4 ACSR por #2 Triplex, P1–P3", "Cambiar poste 35' con RS3 por 40' con TS3 (P2)", "Cambiar transformador 25 kVA por 50 kVA en P1", "Trasladar poste P5 21.7 m". Cantidades: lo nuevo con los datos nuevos y lo de hoy en retiros (un tramo reemplazado también suma "Retiro de conductor"); sin "Se cambia por", lo nuevo cuenta igual que lo de hoy. El detalle ahora es "Nota (opcional)".
  - Plano en estilo de presentación (`domain/plano-limpio.js`, elegido viendo un antes y después; el editor de Dibujar se queda como está, confirmado): el dibujo se redibuja a tamaño de hoja con letras y grosores fijos (legibles impresos en carta). Rótulos sin recuadro: nombre en negrita y debajo altura, estructuras y kVA (lo nuevo en turquesa); un solo rótulo por lugar (poste y transformador encima comparten nombre). Metros de cada vano como en el editor (pedido del equipo, no les gustaron girados a lo largo de la línea): recuadro blanco derecho al lado del vano, metros en negrita y debajo conductor y acometidas (y el conductor de hoy tachado si se cambia); se corre a lo largo del vano o al otro lado si choca. Símbolos simplificados del mismo tamaño (también en la leyenda). Rótulos, metros y números de trabajo se acomodan solos para no taparse ni tapar la red (con línea fina al punto si quedan lejos); el usuario va resaltado en amarillo. Imagen de fondo tenue (55 %). La situación actual no muestra el detalle de la propuesta ni la acometida que sale de lo nuevo.
  - Descarga (confirmado): "Láminas en PDF" (página para imprimir con las dos láminas en carta horizontal) y "Láminas en PNG" (una imagen por lámina, al doble de resolución).
- Selección con un toque (Dibujar y Levantamiento): altura en botones 26'…60' (otro tocando de nuevo se quita; "Otra" para escribir), calibre y conductor en botones ("Otro" calibre escrito). Estructuras: pestañas Primaria / Secundaria / Neutro / Anclas que abren por defecto la de la red que llega al poste (`grupoEstructurasDe`: si llega BT → Secundaria; solo MT → Primaria; el grupo elegido se recuerda por punto en `state.estrGrupo`), buscador por código o nombre que busca en todos los grupos (primero el elegido) sin redibujar, un toque agrega; las ya puestas se marcan.
- Legibilidad del plano (revisión de diseño): un poste con etiqueta lleva su altura y estructuras dentro de ella, en una franja blanca debajo del nombre (un solo rótulo por poste; sin etiqueta salen junto al poste). Los metros de cada vano van al lado de la línea (abajo en los vanos acostados, a la izquierda en los parados), en dos renglones: metros grande y debajo conductor y acometidas. Al pasar un levantamiento a Dibujar, cada etiqueta (nombre y nota en dos líneas) va hacia el lado más libre de vanos, de preferencia arriba (abajo van los metros) y sin salirse de la lámina. Levantamiento: el contador de acometidas va justo debajo del mapa (junto a "Poste aquí") y cada vano ocupa una fila. Dibujar: la ayuda va en el panel, debajo del título, sin tapar el dibujo.
- Imagen de fondo sobre un dibujo hecho (p. ej. el croquis encima de un levantamiento): al subirla, si la hoja cambia de tamaño todo el dibujo se lleva a la nueva hoja con la misma proporción (`transformar`: coordenadas, grosores, tamaños, desfases) y la escala se divide por el mismo factor, así los metros no cambian (antes se borraba la escala y el dibujo quedaba enorme sobre una imagen chica). Luego queda la herramienta "Encajar el dibujo sobre la imagen" (`encajar`): arrastrar mueve todo, −− / − / + / ++ agranda o achica desde el centro del dibujo (la escala se ajusta), "Listo" vuelve a seleccionar; también se abre desde el panel de la lámina. Imagen de fondo más tenue (`fondoOpacidad`, 0.2 a 1; se guarda en el borrador y en los proyectos y sale en el PNG).
- Editor (como un programa de diseño): ocupa todo el espacio libre (debajo del encabezado, al lado del menú lateral; en el celular hasta la barra de abajo). Arriba: proyecto (guardar, proyectos), deshacer/rehacer, subir o cambiar imagen, Descargar PNG, Copiar, Nuevo y mostrar/ocultar el panel. Izquierda: herramientas en dos columnas (seleccionar; red: tramo y símbolos; anotar; libre; escala). Derecha: panel de propiedades de lo seleccionado o de la herramienta activa (tipo, color y nombre de la red, grosor, metros por vano, tamaño, texto, estilo, acciones); sin nada seleccionado muestra la lámina (escala, cajetín, imagen, atajos). En el celular las herramientas van en una tira abajo y las propiedades en una hoja que se abre con el botón de arriba a la izquierda del lienzo. Con un símbolo de red activo, tocar uno que ya está lo selecciona y se puede arrastrar (no se pone otro encima); "Tamaño" −/+ lo agranda desde su centro y los postes siguientes salen de ese tamaño (`tamNuevos`). Cada tramo puede tener su color (`colorRed`, para distinguir redes del mismo tipo) y nombre (`nombreRed`); en la simbología y los totales sale una entrada por red (tipo, color y nombre). Tecla V: seleccionar.
- Barra por grupos:
  - Red: tramo de red y simbología (poste existente, poste proyectado, transformador existente, transformador proyectado, banco de transformadores, usuario, medidor, seccionador, punto de medición).
  - Anotar: etiqueta de punto, cota, texto, flecha.
  - Dibujo libre: seleccionar, línea, rectángulo, círculo, trazo y símbolos de unifilar.
  - Escala: calibrar.
  - Color y grosor; deshacer, rehacer, descargar, copiar, nuevo.
- Tramos por tipo (`TIPOS_TRAMO` en `js/domain/plano.js`): red BT existente (magenta), BT proyectada (azul), MT (rojo), MT proyectada (naranja, guiones), red a retirar (gris, guiones), acometida (punteada). Borde blanco para leerse sobre el mapa. Se trazan tocando cada poste (doble toque, Enter o "Terminar tramo" cierran) y los vértices se ajustan al poste, vértice o punto de etiqueta más cercano (`anclas`/`ajustar`).
- Etiquetas de punto como chips con línea guía hasta el poste (se ajustan a su centro); estilos (`ESTILOS_ETIQUETA`): punto existente (P, azul marino), punto proyectado (W, azul), destacado y nota. Se numeran solas por prefijo. "Texto rápido" con las acciones de las propuestas (`ACCIONES_PUNTO`: instalar transformador, seccionar red BT, remate de red BT, poste de madera deteriorado, cambio de poste, puente al vuelo) conserva el nombre del punto ("P8: Seccionar red BT").
- Metros: las capturas del GIS no traen barra de escala, así que cada vano de un tramo acepta sus metros escritos a mano ("Metros por vano" al seleccionar el tramo; `metros[i]` en la polilínea, `metrosVano`/`metrosTramo`). Opcionalmente, "Calibrar" traza una línea sobre algo de medida conocida (barra de escala, un vano o una calle medida en Google Maps) y se escriben los metros (`escalaDe`, m por px); lo escrito a mano manda sobre la escala. Con metros: chips sobre cada vano (opcional), tabla de distancias automática entre puntos etiquetados a lo largo de cada tramo (`tablaDistancias`; un trecho con algún vano sin metros no sale) y totales por tipo (`totalesPorTipo`). Las cotas necesitan la escala.
- Imán (`imanar`/`segmentosTramos` en `domain/plano.js`): al poner o mover un vértice, una punta de etiqueta, una cota o un símbolo de red, se pega a un punto cercano (centro de poste, vértice, punta de etiqueta) y, si no hay, a la línea de un vano. La tolerancia es en píxeles de pantalla (34 al dedo, 18 con mouse), igual con zoom; un anillo ámbar marca dónde se pegó. Tocar cerca de un poste lo selecciona antes que la línea o la etiqueta que tenga encima, y al moverlo arrastra los vértices y puntas de etiqueta pegados a él.
- Cajetín debajo del plano (`svgLamina`, opcional): título, descripción, proyecto/WO, fecha y elaboró; simbología solo con lo usado (tramos, símbolos de red y estilos de punto); distancias (automáticas o manuales); escala gráfica y flecha de norte (opcional).
- Archivos: `js/domain/plano.js` (tipos, escala, distancias), `js/domain/dibujo.js` (símbolos, elementos, cajetín, SVG exportable), `js/actions/dibujo.js`, `js/views/dibujo.js`, `js/handlers/dibujo.js`. Mientras se arrastra se repintan solo `#dib-capa` y `#dib-cajetin`, sin `render()`; la fila de opciones tiene alto fijo para que el lienzo no salte.

## Graficar (Herramientas)

- Pestaña para revisar rápido una medición en campo: se sube el TXT (de tensión, de armónicos o de campaña), se ponen nominal y red, y se ven el veredicto DT/FT con el FebNoPer, los valores y todas las gráficas del análisis de reclamos, con los dos Excel. No se guarda nada (`state.graficar`, `renderGraficar`; mismo cuerpo que el análisis del reclamo con `analisisActivo()`).
- También muestra (y exporta) el **FebNoPer por fase** como dato de análisis (mismos registros válidos; en cada fase, los que quedan fuera de la banda; el DT/FT lo define el FebNoPer general) y la **cargabilidad en % de la capacidad** del trafo (máx, prom y mín de STOTAL ÷ kVA).
- Zoom: arrastrar sobre una gráfica acerca ese tramo en todas (`a.zoom = { desde, hasta }` en minutos); "Restablecer zoom" vuelve a todo. La escala de tensión no toma en cuenta los registros bajo el 70 % del nominal (ceros) salvo con "Ver escala completa".
- Gráficas combinadas (vs): se eligen series del TXT de tensión (U prom/máx/mín, I prom/máx, PST, STOTAL por fase) y se agregan como gráfica; máximo dos unidades, la segunda en el eje derecho (punteada). Se guardan en `params.combinadas` (con el análisis del reclamo) y salen en el Excel de tensión como hojas "Combinada N" con eje secundario.
- Proyección con cambio de TAP (opcional, "Proyectar"; en Graficar y en el análisis del reclamo, se guarda en `params.tapProy` = { activo, red, placas[5], actual, propuesta }; `domain/tap.js`): se elige la red y se llenan las placas de las 5 posiciones (confirmado: 23 kV con trafo de 13.2 kV 14400/13800/13200/12870/12540; 13.2 kV con trafo de 7.62 kV 8001/7810/7620/7430/7240; 4.16 kV con trafo de 2.4 kV 2520/2460/2400/2340/2280 (corregido por el equipo: 2400 es el nominal monofásico de la red de 4.16 kV); "Otra" en blanco), que se pueden corregir. La posición 1 es la de mayor placa. Con la posición actual y la propuesta, la tensión medida se multiplica por placa(actual) ÷ placa(propuesta): curva punteada por fase en la gráfica de tensión promedio, veredicto DT/FT y FebNoPer proyectados (misma regla que la medición) y máx/prom/mín por fase. Tabla con todas las posiciones con placa (cambio %, U prom/máx/mín, FebNoPer y DT/FT), marcando la actual, la propuesta y la de menor FebNoPer (empate: la más cercana a la actual). El veredicto de la medición no cambia. En el Excel de tensión, con la proyección activa, sale la hoja "Proyección TAP" (después de "Tensión promedio"): datos medidos y proyectados (punteados) con los límites y su gráfica, datos del cambio (red, placas, factor, %), resumen proyectado, estadística por fase y la tabla de todas las posiciones. No entra en el Word.
- Excel de tensión: la gráfica va arriba (H2:U23) y las tablas debajo (desde H25). Escala del eje de tensión: banda ±tolerancia con 3 % de margen redondeada a un paso según el nivel (10^(dígitos−3)); la macro redondeaba a centenas y en 120 V quedaba de 100 a 200. Máximos y mínimos usan la misma escala.

## Análisis de reclamos (macros Graficar y Armónicos)

- En reclamo se mide con doble intervalo y el equipo genera dos TXT de 10 minutos del mismo periodo: el de **tensión** (74 columnas, con máximos y mínimos; STOTAL en la columna 75 cuando viene) y el de **armónicos** (197 columnas: `Uarm{n}-{fase}`, `Iarm{n}-{fase}`, PST). La app reconoce cuál es cuál por los encabezados.
- Expediente → Mediciones → "Analizar TXT" en cada medición retirada. Datos que pide (como la macro): usuario o empresa, tipo de instalación (1, 2 o 3 fases; se sugiere por las fases con tensión), tensión nominal (se sugiere la más cercana de la lista de la macro), urbanidad y red (Urbano/MT ±6 %, Rural/MT ±7 %, Urbano/BT ±7 %, Rural/BT ±8 %), kVA y V L-L del trafo.
- `js/domain/reclamo.js` (funciones puras):
  - Tensión (GraficarTension3): resumen sobre la tensión promedio igual que la macro (inválido si una fase < 70 % del nominal, FT si alguna fase sale de la banda, FebNoPer = FT ÷ válidos, estado FUERA/DENTRO DE TOLERANCIA o "ERROR - NIVEL DE TENSIÓN INCORRECTO"); Máx/Prom/Mín por fase de cada perfil; PST con límite 1 y percentil 95 (PERCENTILE de Excel, inclusivo); corriente máxima del trafo = kVA × 1000 ÷ (√3 × V L-L) en trifásico y kVA × 1000 ÷ V L-L en mono y bifásico (la macro no dividía entre √3; corregido a pedido del equipo); cargabilidad = STOTAL ÷ 1000 contra la capacidad y el 85 %.
  - STOTAL se busca por nombre y si no en la columna 75 (confirmado). La macro tomaba la última columna, que en un TXT sin STOTAL es PST3; la app avisa que no hay cargabilidad.
  - Armónicos (Armonicos_SIGET10, SIGET 38-E-2015 Título V): VDAT y TDI (Tabla 4), DATI y DAII (Tabla 5), H2 a H25. P por fase; si viene en 0 y PTotal indica carga se reparte PTotal entre las fases (como la macro). Cada intervalo de corriente se evalúa en % si P ≥ 3.5 kW y en amperios si es menor; DATI solo se penaliza con P ≥ 3.5 kW. CUMPLE si el % del tiempo fuera de límite es ≤ 5 %. P95 de tensión con todos los intervalos; P95 de DATI/DAII de las tablas solo con P ≥ 3.5 kW; espectros con todos los intervalos (como la hoja Graficos de la macro, confirmado). Diferencia: las filas con menos de 194 campos no se cuentan (la macro las dejaba como ceros) y se avisa. Presentación (corregido tras revisar un Excel real, sin cambiar reglas): el intervalo se toma de los datos (el más frecuente; antes decía "10 min" fijo) y se avisa en la pantalla y en el Excel si no es de 10 minutos; en corriente, las fases sin intervalos con carga muestran el P95 en amperios de los intervalos sin carga (`p95A`, contra el límite en A) y las mixtas ambos ("x % / y A"); el DATI sin carga dice "No aplica (P < 3.5 kW)" (antes salía 0 %); si en todo el periodo P < 3.5 kW (`regimenCorriente` = 'A'), el espectro de corriente (pantalla y hoja Graficos) va en amperios contra los límites en A; Detalle_I lleva también I1 e Ii por orden en A; el borrador de informe y la severidad del diagnóstico usan A en ese caso (`textoP95Corriente`).
- Se guarda en el reclamo `analizadores/{id}/analisisReclamo` = { params, archivos (nombres), resultado (FebNoPer y estado; CUMPLE/NO CUMPLE de armónicos en tensión y corriente), fecha, por }. Los TXT van comprimidos (gzip + base64, ~600 KB los dos) en `archivosReclamo/{id}` y se leen con `get` al abrir el análisis. La lista de Reclamos muestra el FebNoPer y si los armónicos cumplen.
- Excel (`js/actions/excel-reclamo.js`) con las hojas de las macros y **gráficas nativas de Excel** (`js/excel-graficas.js`: se abre el xlsx de SheetJS con `XLSX.CFB` y se agregan los archivos de dibujo/gráfica que apuntan a las celdas). Tensión: una hoja por perfil con datos, límites, resumen en H2 y la gráfica. Armónicos: Detalle_V, Detalle_I, Resumen_Armonicos, Resumen_Compacto y Graficos (2 espectros de barras con el límite y 2 tendencias). Colores de fase de los informes CPT (amarillo, azul, rojo) y Century Gothic.

## Borrador de informe de reclamo (Word)

- En el análisis del reclamo, "Borrador de informe (Word)" descarga `<código>[_punto]_Borrador_informe.docx` con las secciones del informe CPT ya redactadas con los datos del expediente, de la instalación y de los TXT abiertos. Lo que la app no sabe va como `[completar]` resaltado en amarillo; las gráficas van como marcas `[Gráfica: …]` que dicen de qué hoja del Excel de tensión o de armónicos se pegan.
- `js/domain/informe.js` (`borradorInforme`, funciones puras con prueba) arma bloques (título, párrafos, tablas, fórmula, viñetas):
  1. Generalidades: usuario, NC, dirección, CT, tensión nominal, urbanidad y red, código/WO y tipo de reclamo (circuito/subestación a completar).
  2. Equipo de medición: modelo y serie, punto, fechas de instalación y retiro, factor multiplicador (relación TP y TC, campos nuevos "Relación de voltaje (TP)" y "Relación de corriente (TC)" en los datos de la medición, `params.relV`/`params.relI`), intervalos y total de registros.
  3. Inspección: sale del checklist del expediente (ver "Inspección del reclamo").
  4. Mediciones: regulación (Art. 22-23, FEBNoPer con su fórmula, tabla Máx/Prom/Mín y extremos respecto al nominal); perfil secundario equivalente si es MT y hay relación TP (tensión ÷ relación, banda sobre el secundario); corrientes (tabla, hora de mayor y menor demanda promedio, fase mayor y menor, desbalance = mayor desviación respecto al promedio de las fases ÷ promedio, promedio y P95); flicker (P95 por fase, picos sobre 1 y veredicto).
  5. Armónicos: VDAT y DATI por P95 con veredicto, armónicos individuales que no cumplen agrupados por orden (aunque el total cumpla), intervalos con carga y los tres órdenes con más contenido de corriente; tabla de indicadores que no cumplen.
  6-7. Calidad del servicio y evento: a completar.
  8. Conclusiones: tabla parámetro / límite / resultado / veredicto (CUMPLE en verde, NO CUMPLE en rojo) y viñetas; continuidad a completar.
  9. Recomendaciones: a completar.
- `js/docx.js` escribe el WordprocessingML a mano (Century Gothic, encabezados de tabla azules) y lo empaqueta con `XLSX.CFB`, sin librerías nuevas. Acción en `js/actions/informe.js`.

## Diagnóstico de armónicos

- `js/domain/diagnostico.js` (`diagnosticarArmonicos`, funciones puras con prueba). Se muestra en la pestaña Armónicos del análisis (bloque "Diagnóstico") y en el borrador de informe como "5.3. Diagnóstico" con la tabla de severidad y un `[completar]` para la conclusión. Partes confirmadas:
  - Contexto en amperios: fases que no cumplen el DATI con corriente fundamental baja (menos del 25 % de la fase más cargada o la mayor parte del tiempo bajo 3.5 kW); se dan la mediana de I1 y la corriente armónica total en A. Solo cita el Art. 49 (evaluación en amperios) si la fase estuvo la mayor parte del tiempo bajo 3.5 kW.
  - Tipo de carga por los tres órdenes dominantes de corriente: H5/H7 seis pulsos (variadores, rectificadores, UPS); H11/H13 doce pulsos; H3/H9 monofásicas electrónicas; pares media onda, CD o saturación. Si la inspección marcó variadores o cómputo/LED, dice que concuerda.
  - Origen (red o usuario) SIEMPRE como indicio con la evidencia (confirmado): correlación de Pearson entre VDAT y la corriente armónica total del usuario por fase (r ≥ 0.6 sugiere aporte del usuario, r ≤ 0.2 sugiere la red, en medio no concluyente) y por cada orden de tensión que no cumple. Si la medición es en MT y el banco trifásico tiene un devanado en delta (inspección), los triplen de tensión no pueden atribuirse a las cargas del usuario.
  - Perfil horario: horas de mayor y menor VDAT y de mayor corriente armónica del usuario, y si coinciden (si la corriente es casi pareja todo el día, lo dice en vez de comparar).
  - Severidad: por orden que no cumple, P95 de la peor fase, veces el límite y % del tiempo fuera.
- `analizarArmonicos` guarda ahora también las corrientes en amperios (`I1`, `IhA` y `IA[n]` por fase).

## Formulario de inspección del reclamo

- Pestaña "Inspección" del expediente (uno por reclamo, confirmado), en `reclamos/{id}/inspeccion`. Pensado para llenarse en sitio desde el celular; cada campo se guarda al salir de él (`js/actions/inspeccion.js`) y las listas usan claves de push. Vista en `js/views/inspeccion.js`.
- El encabezado toma del expediente NC, nombre del usuario, DS/CT (`corte` / `ct`), medidor, código, WO, dirección y motivo.
- Equipo de medición: sale de las instalaciones de la medición inicial del reclamo (punto principal y puntos adicionales) con analizador, serie, viñeta, instalación y retiro (`equiposMedicion` en `domain/inspeccion.js`); no se escribe en el formulario.
- Secciones: visita (fecha, horas, circuito MT, subestación de distribución); subestación; medidor de facturación; instalación del usuario (cuenta con: planta, transferencia, capacitores, fotovoltaico, transformadores secos, cargas en MT; cargas principales; horario); transformadores secos (lista: kVA, voltaje primario y secundario, ubicación; aparece al marcarlos); tableros (lista: nombre, resistencia a tierra, checklist de protecciones, otras protecciones o ajustes, checklist de condiciones, lecturas instantáneas V L-N, V L-L, I por fase y neutro, observaciones); equipo dañado (lista); observaciones generales; firmas.
- Subestación (confirmado): monofásica = 1 transformador, secundario monofásico fijo; bifásica = 2 transformadores, secundario delta abierta o estrella de 2 hilos; trifásica = banco de 3 o 1 unidad, secundario delta o estrella. Un campo de kVA por transformador y el total suma (`kvaTotal`). También conexión del primario (mono: fase-neutro o fase-fase; bi: estrella abierta o delta abierta; tri: estrella, estrella aterrizada o delta), siempre con "Otra" escribiendo cuál. Al cambiar el tipo se borran las conexiones del tipo anterior.
- Firmas (inspector CPT, segundo inspector y quien acompañó por parte del usuario): nombre, cargo y firma con el dedo en pantalla (PNG en `firmas/{rol}/img`); sin firma, el PDF deja la línea para firmar a mano (confirmado).
- "Generar PDF del formulario" (`js/pdf/inspeccion.js`): variante formal de los memos (`docMemo({ formal: true, etiqueta: 'Formulario de', subtitulo: 'Calidad del Producto Técnico' })`); en el encabezado va el logo que se subió en la configuración de las cartas (`config/cartas/logo`, el de DELSUR INNOVA), solo en este formulario; sin logo sale CPT INNOVA, todas las opciones como casillas marcadas o vacías, se imprime o guarda como PDF.
- Fotos: fuera de la app (confirmado); el borrador de informe deja `[Foto: …]`.
- Reglas (`js/domain/inspeccion.js`, confirmadas): puesta a tierra hasta 25 Ω CUMPLE (NEC 2008); equipo dañado NO CUMPLE si la tensión estuvo fuera de su rango de placa más del 5 % del tiempo en alguna fase (secundario equivalente si la medición es en MT con relación TP; opción ×√3).
- En el borrador de informe: sección 3 redactada (visita y acompañante, subestación con tipo, transformadores, montaje y conexiones, medidor con aviso `[verificar]` si su RTC no coincide con la relación de corriente de la medición, instalación y cargas, transformadores secos, cada tablero con protecciones que tiene y las que no, condiciones, lecturas y tierra, equipos dañados con montos), circuito y subestación en Generalidades, "Tensión frente al rango de operación" por equipo y filas en conclusiones.

## Seguimiento FT
Pestaña Trabajo → Seguimiento FT (`js/domain/ft.js`, `casos/{id}/ft`). Los casos FT salen de Resultados (válida + fuera de tolerancia):
- Plazo: 90 días calendario desde la instalación de la medición inicial (no desde el retiro ni la descarga).
- Paso 1: aviso a DELSUR por correo, lo antes posible (aparece en Inicio como pendiente de hoy hasta marcarlo).
- Paso 2: subir el caso al sistema (`ft/sistema`). Paso 3: enviar por correo el **Resumen punto medido**, la gráfica que genera ese sistema (`ft/resumen`). Los dos se marcan con fecha y quién (`marcarPasoFT`) y, como el aviso, salen en Inicio como pendientes de hoy hasta marcarlos; la tarjeta muestra lo que falta.
- Antes de la remedición: recuadro destacado para tomar fotografías de los trabajos realizados y subirlas a la carpeta compartida MEMOS, con "Marcar fotos subidas a MEMOS" (`ft/fotos`). El mismo recordatorio aparece en el formulario de instalación al escribir el código de la remedición de un caso FT abierto (CR1… → CR2…, RE1… → RE2…; `ftDeRemedicion` en `domain/ft.js`, `avisoRemedicionHTML` en `views/ft.js`).
- Ruta: Estudio y propuesta de obras, Transferencia de alimentador o CPT DELSUR y Planificación. Bitácora libre para los pasos (mediciones aledañas, memo, presupuesto…).
- Compensación diaria informada: solo se anota; el cálculo de montos está pendiente de definir.
- Remedición: el mismo código con el número de medición siguiente (CR1… → CR2…); si existe la instalación se muestra. Solo "Sí, se normalizó" cierra el caso.
- Pasados los 90 días queda vencido: se penalizan los 90 días y la compensación diaria sigue hasta solucionarlo.

Mapa para el contratista: en Casos, "Mapa para My Maps" descarga un KML (`kmlMapa` en `js/domain/listados.js`) con un punto por caso con coordenadas, todos del mismo color (en la precampaña no hay fechas de instalación) y todas las columnas del listado como datos del punto. Se importa en Google My Maps (Importar → archivo KML). Avisa qué casos no tienen coordenadas.

Pendiente: verificar los cálculos con un Excel de multiplicadores ya lleno e importar el histórico de multiplicadores que tiene el equipo.

## Área: Inicio (dashboard)
**Casos FT primero**: si hay casos FT abiertos, el Inicio abre con el bloque "Casos FT" (antes de Pendientes): cada caso con su **siguiente paso** en grande (`siguientePasoFT`/`pasosFT` en `domain/ft.js`: aviso a DELSUR → subir al sistema → Resumen punto medido → ruta → fotos de los trabajos a MEMOS (urgente si la remedición ya está instalada) → remedición normalizada; sin informe), el avance "n de 6" y el plazo de 90 días. Esos pasos ya no se repiten en Pendientes. El aviso al abrir la app (una vez por sesión) muestra primero los casos FT del área con su paso y después los retiros próximos.

**Informes de reclamos por entregar (8 días calendario desde el retiro)**: bloque después de los casos FT (`informesPorEntregar` y `conteoInforme` en `domain/expedientes.js`). Solo reclamos: cada medición retirada sin informe (FT o no), con "Quedan N días · vence el dd/mm" (o vence hoy / vencido) y una barra de 8 días; respeta "Contar desde" y ya no se repite en Pendientes. Al registrar el retiro de un reclamo la app avisa que empieza el conteo y la fecha en que vence. Los casos FT no llevan informe: solo su plazo de 90 días.

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

**Estado**: `equipos[]` (nodo `equipos`), `memosEquipos[]` (nodo `memosEquipos`)
**Vistas** (`state.view` en la pestaña Equipos): `lista` (pestañas Equipos | Memos, `invVista`), `memo_nuevo`, `ordenar`, `equipo_form`, `equipo_detalle`

**Reglas** (`js/domain/inventario.js`, funciones puras con prueba):
- Un equipo instalado también se presta y se devuelve (pedido del equipo: a veces se instala antes de hacer el memo): queda el movimiento con su memo, sigue instalado en su caso y su ubicación (`sede`) no cambia hasta que se retire. En la lista sigue "En campo" con "Prestado a …" en su línea; en el memo nuevo sale con la etiqueta "En campo · #caso". No se presta dos veces: si ya está prestado, primero la devolución.
- **Área dueña** (`eq.area`, CPT MT o CPT BT): el préstamo sale de esa área y la devolución regresa a ella. Sin área no se puede prestar ni devolver. CPT MT tiene unos pocos equipos propios en Plantel Central; todos los demás son de CPT BT y se guardan en la Cucumacayán (la bodega), de donde se le prestan a CPT MT para las campañas. **Ordenar equipos** (administrador, `planOrdenar`): se marcan solo los de CPT MT y al guardar todos los demás quedan de CPT BT y, si están guardados (no en campo ni prestados), pasan a la Cucumacayán; a los de CPT MT solo se les pone el área. Al crear un equipo el área es obligatoria.
- **Quién lo tiene** (`tenedor`): si está prestado, el área del último préstamo; si no, su área dueña.
- **Estado único** (`estadoEquipo`): En campo (instalación activa) > Fuera de servicio > En mantenimiento > Prestado (a Campos y Servicios o a otra área) > Disponible. "Con detalles" se marca aparte y sí se presta (con aviso en la lista y en el memo).
- **Préstamo** (`motivoNoPrestamo`): disponible (no instalado, no prestado, ni en mantenimiento ni fuera) y de su área dueña; excepto **a Campos y Servicios**, que puede recibir equipos de cualquier área (CPT MT les entrega equipos de la bodega de la Cucumacayán, que son de CPT BT); al retirarse regresan solos a su área. **Devolución** (`motivoNoDevolucion`): prestado, no instalado, que lo tenga el área que entrega y que regrese a su área dueña.
- **Sede después del movimiento** (`sedeDespues`): según el área que recibe (CPT BT → Cucumacayán, Campos y Servicios → "Con Campos y Servicios", otras → Plantel Central); lo que devuelve Campos y Servicios queda en la Cucumacayán.
- **Devolución automática al retirar** (`devolucionAlRetirar`): si el equipo estaba con Campos y Servicios, al registrar el retiro (individual o masivo del despacho) se agrega la devolución a su área (`auto: true`, nota "Devolución automática al retirar el caso #…"), sin memo. Los que quedaron prestados de antes salen en un aviso con "Registrar devolución".

**Lista**: grupos por dónde está cada equipo (Disponibles por sede, Con Campos y Servicios, Prestados a otra área, En campo, En mantenimiento, Fuera de servicio), indicadores corregidos, filtro por estado y por área dueña, búsqueda por serie, viñeta o modelo.

**Memos de préstamo y devolución** (`js/actions/memos-equipos.js`, `js/views/equipos.js`): un solo flujo para uno o varios equipos ("Nuevo préstamo" / "Nueva devolución", o desde la ficha con el equipo ya elegido):
1. Tipo; 2. De → Para; 3. Equipos: solo se pueden elegir los que cumplen las reglas, con buscador y "Elegir todos"; los elegidos quedan arriba como chips (se quitan con ×) y la lista va en una caja desplegable con su propio scroll (no se pierde la posición al marcar); los demás aparecen en "No se pueden elegir" con el motivo; 4. Nota. "Ordenar equipos" usa la misma caja con scroll.
- Al confirmar se guarda el memo en `memosEquipos/{id}` (`tipo, de, a, fecha, hora, nota, registradoPor, equipos[{id, serie, modelo, vineta, condicion}]`), se registra el movimiento en cada equipo con `memoId` y se abre el memo: individual con un equipo, de lote con varios (con la condición de cada uno y la nota).
- Firmas en pantalla de los memos (pedido del equipo, como en la inspección): préstamo y devolución (`memosEquipos/{id}/firmas`: entrega, recibe), despacho a Campos y Servicios (`historialCargas/{id}/firmas`: entrega, recibe; el memo está guardado como HTML y las firmas se le ponen al abrirlo con `ponerFirmas`) y equipo dañado (`analizadores/{id}/memoDanio/firmas`: cpt, cucumacayan, campos; al editar el memo se conservan). Se firman después de generar el memo, cada quien cuando le toca, con el botón "Firmas 1/2" (en Equipos → Memos, en el historial de despachos y en la instalación junto a "Ver memo de equipo dañado"): ventana con cada firma (Firmar en pantalla, Firmar de nuevo, Quitar firma) y "Ver memo con las firmas". El recuadro es el de la inspección (`views/firma.js`, `state.firmaInsp.memo`) y pide el nombre de quien firma (opcional). Cada firma = { img, nombre, fecha, por }; en el PDF va la imagen sobre la línea y "Firmó: nombre"; las que faltan quedan con la línea para firmar a mano. Envío a revisión y accesorios no llevan firma en pantalla (confirmado).
- Pestaña **Memos**: todos los memos guardados para reimprimir. En Movimientos de la ficha, "Memo PDF" abre el memo guardado (de lote si eran varios); los movimientos de antes sacan el memo individual como siempre.

**Otras funciones**: `doCondicion()` (condición), `guardarMant()` (mantenimiento), retiro y descarga en Instalaciones.

**Planilla de instalación y retiro** (formato PLANILLAS_IR del equipo; `js/domain/planilla.js`, `js/actions/planilla.js`): cualquier instalación puede llevarla (confirmado). En el formulario de instalación, al escribir el código se busca en la base (`buscarDatosCaso`: expediente de reclamo, caso de campaña o caso FT que se remide): si está, la sección "Planilla de instalación y retiro" se marca sola y se completan nombre, NC, dirección, centro MT/BT o corte, medidor y tipo de instalación (se pueden corregir; también al registrar desde un expediente); si no está, la planilla es opcional: "Generar planilla para esta instalación" habilita esos campos para llenarlos a mano; sin marcarla la instalación queda como siempre. Se guarda `conPlanilla` y `planilla` = { nombre, nc, direccion, centro, medidor, tipo } (lo escrito manda sobre lo de la base). Botón "Planilla de instalación y retiro (PDF)" en el detalle de las instalaciones que la llevan (o cuyo código está en la base). Página para imprimir o guardar como PDF, copia exacta de la hoja PLANILLA del Excel (pedido del equipo): carta horizontal (pedido del equipo; el Excel es A4) ajustado a una página y centrado, mismos anchos de columna y altos de fila, bordes, letras (Arial 9 cursiva en las etiquetas, títulos Arial 14), logo arriba a la izquierda (el logo de config/cartas; sin logo, el nombre de la distribuidora), casillas M/T/M2, Si/No y U/R/A (en la copia DS), recuadros de firma; sin el pie "Reporte: Formato_A2_Reemplazo" del Excel (pedido del equipo). Lo que se llena va en negrita. "Número Contador" se cambió por "Analizador de redes" con la serie del analizador instalado. Solo se llena la copia de arriba; la de DS va en blanco (confirmado). Datos (confirmado): Número SIGET = código del caso; ID Usuario = NC; nombre, dirección, centro MT/BT o corte y código de medidor del expediente del reclamo o del caso FT de campaña que se remide (aunque ya esté cerrado); tipo de instalación M (monofásico), M2 (bifásico), T (trifásico) según el análisis del reclamo o la configuración del caso; tensión de servicio la que se anota al instalar; periodo = mes de la instalación. Energía inicial y final = (una lectura o punta + resto + valle) × X del medidor. Tipo de servicio, tarifa, tipo de conexión, fase alta y medición de energía no se llenan (confirmado). Al instalar se piden la hora de inicio (se toma al abrir el formulario, cuando se empieza la instalación, no al registrar; se puede cambiar), la tensión de servicio y la X del medidor (con las lecturas); al retirar, la hora de retiro y la misma X (se puede corregir). Editar una instalación ya no borra la energía, el área ni quién la registró.

**Descargas en bloque** (`js/actions/descargas.js`, `js/views/descargas.js`): "Registrar descargas (n)" en cada Fecha de la campaña (los equipos de los casos de esa Fecha) y "Registrar descargas en bloque (n)" en Instalaciones (los de la pestaña y el filtro que se ven). Entran los equipos ya instalados (no los programados a futuro) y los retirados con la descarga pendiente. Se elige una vez quién hizo la descarga (por defecto quien tiene la sesión) y notas para todos; cada equipo se marca o desmarca y, si su medición tuvo fallo, se elige el tipo en su fila. Cada uno queda igual que la descarga de uno en uno (se agrega a `descargas` con `enBloque: true` y `descargaPendiente: false`). Descargar no da el resultado de la medición: eso sale de Analizar TXT. Editar un equipo conserva su fecha de registro y quién lo creó.

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
- En el memo de lote, el nombre de quien registró va bajo la firma de su área (igual que en el de un equipo)

**Diseño de los memos** (`js/pdf/memo-base.js`): todos usan `docMemo()`, una hoja carta con el encabezado degradado petróleo → turquesa de la app (rojo en equipo dañado), una franja de datos clave (fecha, equipo, quién registra), secciones con título turquesa, datos en cuadrícula, caja origen → destino, firmas y pie. Botón "Imprimir o guardar PDF" (no sale impreso). El de asignación (carga masiva) va en carta horizontal y compacto por la cantidad de columnas. Al imprimir: carta con márgenes de 12 mm y el encabezado dentro de ellos con esquinas redondeadas (`ESTILO_IMPRESION`; pedido del equipo: antes iba en A4 a sangre y al imprimir o guardar el PDF desde el celular se veía cortado en los bordes). A los despachos ya guardados como HTML se les pone el mismo estilo al abrirlos. En celular la hoja se acomoda en una columna.

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
  - `filasDespacho()` en `actions/carga.js` lee el formato de MT y el de BT: busca la fila del encabezado (la que tiene SIGET y Equipo) en cualquier parte, lee las fechas de Excel como fecha real (el "9/4/26" de BT es 04/09/2026), toma lat/lng de "Ubicación" ("lat lng") si no hay Latitud/Longitud, lee Medidor e ignora las filas sin equipo ni SIGET (firmas al pie). La serie se busca igual sin importar mayúsculas
  - El formato de BT no trae fecha de retiro: la vista previa pide una fecha y se pone a todos los que no la tienen (`aplicarRetiroCarga`)
- Generar memo de despacho de accesorios (`generarMemoAccesorios`)
- Ver historial de cargas anteriores

---

## Perfiles
Entrada con PIN de 6 dígitos (`js/actions/auth.js`) usando **Firebase Authentication**:
- Cada perfil es una cuenta de correo y contraseña: `<perfil>@usuarios.nettracker.app` (correo interno, nadie lo usa) y el PIN como contraseña (Firebase pide 6 caracteres como mínimo).
- La primera vez cada quien crea su PIN (dos veces) con `createUserWithEmailAndPassword`; en `cuentas/{perfil}` queda solo `{ creado }` para saber si pedir el PIN o crearlo. El PIN nunca se guarda en la base.
- Firebase bloquea los intentos repetidos (`auth/too-many-requests`); además la app espera un minuto después de 5 PIN equivocados.
- La sesión la recuerda Firebase en el dispositivo (`onAuthStateChanged` en `iniciarAuth`) hasta "Cambiar de perfil" (`signOut`). La sincronización (`iniciarSync`) arranca solo con sesión y se detiene al salir.
- **Reglas de la base** (`database.rules.json`, se pegan en la consola): solo las cuentas `@usuarios.nettracker.app` pueden leer y escribir; lo único público es `cuentas` (qué perfiles ya tienen PIN).
- **Borrar PIN** (administrador, menú del perfil): quita `cuentas/{perfil}`; además hay que borrar la cuenta en la consola (Authentication → Users) para que esa persona cree otra. Si la creación de cuentas está desactivada, hay que activarla un momento.
- **Persona nueva**: agregarla en `USUARIOS` (config.js), activar un momento la creación de cuentas en la consola, que cree su PIN y volver a desactivarla.
- Los PIN viejos de 4 dígitos (`pines/`) ya no se usan: la app borra el de cada quien al crear su cuenta y el nodo se puede borrar en la consola.
- Pruebas: `tests/mock/firebase-auth.js` es un Auth falso en memoria; `abrirApp(page, { usuario, cuentas: { nombre: pin } })`.
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
8. **Una sola fuente** (Plus Jakarta Sans), también para números, series y códigos: `--mono` apunta a ella y las cifras van tabulares (`font-variant-numeric: tabular-nums`) para que las columnas queden alineadas. No usar fuentes monoespaciadas (JetBrains Mono, Courier, Consolas).
9. **Sin emojis** en la interfaz: usar íconos `<i class="ic ic-nombre"></i>` (o `<i class=ic-nombre></i>` dentro de textos JS). Para uno nuevo, agregarlo a `tools/gen-icons.js` y correr `npm run icons`. En avisos (`showToast`, `confirm`) y documentos generados (memos, Excel), solo texto
10. **Reglas del trabajo** (plazos, tipos de caso) van en `js/domain/` como funciones puras, con su prueba en "Reglas del trabajo"
