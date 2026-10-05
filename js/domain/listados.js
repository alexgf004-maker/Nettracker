// Lectura de los archivos de la precampaña: listados del ente, control de puntos y base de coordenadas.
// Funciones puras: reciben las filas de cada hoja (arreglo de arreglos, como XLSX.utils.sheet_to_json con header: 1)
// y devuelven datos listos para guardar. Así se pueden probar sin Excel ni Firebase.
import { claveCampana, periodoCampana, subtipoCampana } from './trabajo.js';

// Mayúsculas, sin tildes ni espacios repetidos (para comparar encabezados)
export const normalizar = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
const texto = v => String(v ?? '').replace(/\s+/g, ' ').trim();
const valido = v => { const t = texto(v); return t && t !== '#N/A' && t !== '0' ? t : ''; };
// NC como texto (en unos archivos viene como número y en otros como texto)
export const normalizarNC = v => String(v ?? '').trim().replace(/\.0+$/, '');

// Busca la fila de encabezados: la primera que contiene todos los textos pedidos
function filaEncabezados(filas, requeridos, maxFilas = 40) {
  for (let i = 0; i < Math.min(filas.length, maxFilas); i++) {
    const celdas = (filas[i] || []).map(normalizar);
    if (requeridos.every(r => celdas.includes(r))) return i;
  }
  return -1;
}
// Columna del primer encabezado que coincida con alguno de los nombres
const columna = (encabezados, nombres) => encabezados.findIndex(h => nombres.includes(h));

// ── LISTADOS DEL ENTE ──

const TITULOS = { 'MEDIA TENSION': 'MT', 'BAJA TENSION': 'BT', 'ARMONICO': 'DA', 'ARMONICOS': 'DA', 'FLICKER': 'DF' };

// Lee un listado del ente (MT, BT, DA o FK). Los datos empiezan debajo de "Número SIGET".
// La dirección viene partida en varias columnas (colonia, calle, número) entre "Dirección" y "Fecha Colocación".
export function leerListadoEnte(filas, nombreArchivo = '') {
  const h = filaEncabezados(filas, ['NUMERO SIGET', 'ID DEL USUARIO']);
  if (h < 0) return { error: 'No se encontró la fila "Número SIGET" / "Id del Usuario"' };
  const enc = filas[h].map(normalizar);
  const col = {
    codigo: enc.indexOf('NUMERO SIGET'), nc: enc.indexOf('ID DEL USUARIO'), nombre: enc.indexOf('NOMBRE DEL USUARIO'),
    direccion: enc.indexOf('DIRECCION'), fecha: enc.indexOf('FECHA COLOCACION'), depto: enc.indexOf('DEPARTAMENTO'), municipio: enc.indexOf('MUNICIPIO'),
  };
  const finDireccion = [col.fecha, col.depto, col.municipio].filter(c => c > col.direccion).sort((a, b) => a - b)[0] ?? col.direccion + 1;

  let nivel = null;
  filas.slice(0, h).forEach(f => (f || []).forEach(c => { const t = TITULOS[normalizar(c)]; if (t) nivel = t; }));
  if (!nivel) { const n = normalizar(nombreArchivo); nivel = ['MT', 'BT', 'DA', 'FK', 'DF'].find(t => n.includes('_' + t + '_')) || null; if (nivel === 'FK') nivel = 'DF'; }

  const casos = [];
  for (const f of filas.slice(h + 1)) {
    const codigo = texto(f?.[col.codigo]).replace(/[[\]#\s]/g, '').toUpperCase();
    if (!/^(CR|DA|DF)/.test(codigo)) continue;
    const partes = (f.slice(col.direccion, finDireccion) || []).map(texto).filter(Boolean);
    casos.push({
      codigo, nc: normalizarNC(f[col.nc]), nombre: texto(f[col.nombre]),
      direccionEnte: [...partes, texto(f[col.municipio]), texto(f[col.depto])].filter(Boolean).join(', '),
      municipio: texto(f[col.municipio]), depto: texto(f[col.depto]),
    });
  }
  return { nivel, casos };
}

export const AREA_NIVEL = { MT: 'CPT MT', BT: 'CPT BT' };
export const claveArea = area => area.replace(/\s+/g, '-');

// Une los listados en campañas por mes/año y área.
// Los CR toman el área de su listado (MT o BT); los DA y DF, la del CR del mismo usuario (NC).
export function armarCampanas(listados) {
  const avisos = [];
  const campanas = {};
  const areaPorNC = {};
  const crPorNC = {};
  const agregar = (caso, area, extra = {}) => {
    const periodo = periodoCampana(caso.codigo);
    if (!periodo) { avisos.push(`${caso.codigo}: no se pudo leer el mes y año del código`); return; }
    const clave = claveCampana(periodo) + '_' + claveArea(area);
    campanas[clave] ??= { clave, ...periodo, area, casos: {} };
    campanas[clave].casos[caso.codigo] = { ...caso, tipo: subtipoCampana(caso.codigo), area, ...extra };
  };

  for (const l of listados.filter(l => l.nivel === 'MT' || l.nivel === 'BT')) {
    for (const c of l.casos) {
      areaPorNC[c.nc] = AREA_NIVEL[l.nivel];
      crPorNC[c.nc] = c.codigo;
      agregar(c, AREA_NIVEL[l.nivel]);
    }
  }
  for (const l of listados.filter(l => l.nivel === 'DA' || l.nivel === 'DF')) {
    for (const c of l.casos) {
      if (!areaPorNC[c.nc]) { avisos.push(`${c.codigo}: el usuario ${c.nc} no está en los listados de CR, no se sabe a qué área pertenece`); continue; }
      agregar(c, areaPorNC[c.nc], { crRelacionado: crPorNC[c.nc] });
    }
  }
  return { campanas: Object.values(campanas).sort((a, b) => a.clave.localeCompare(b.clave)), avisos };
}

// Cuenta CR, DA y DF de un conjunto de casos
export function contarTipos(casos) {
  const n = { CR: 0, DA: 0, DF: 0 };
  Object.values(casos || {}).forEach(c => { if (n[c.tipo] !== undefined) n[c.tipo]++; });
  return n;
}

// ── CONTROL DE PUNTOS ──

// Datos por NC desde el archivo "control de puntos". Se toma la primera columna de cada nombre
// (el archivo repite NC, NOMBRE, etc. en un segundo bloque que no corresponde a las mismas filas).
// Alimentador = AL + tensión (AL162-13200). Las coordenadas de este archivo no sirven y no se usan.
export function leerControlPuntos(filas) {
  const h = filaEncabezados(filas, ['NC', 'CENTROMTBT']);
  if (h < 0) return { error: 'No se encontraron las columnas "NC" y "CENTROMTBT"' };
  const enc = filas[h].map(normalizar);
  const col = {
    codigo: enc.indexOf('PUNTO DE CONTROL'), nc: enc.indexOf('NC'), ct: enc.indexOf('CENTROMTBT'), urbanidad: enc.indexOf('URBANIDAD'), al: enc.indexOf('AL'),
    tension: enc.indexOf('TENSION'), medidor: enc.indexOf('MEDIDOR'), direccion: enc.indexOf('DIRECCION'), nombre: enc.indexOf('NOMBRE'),
    tipoInstalacion: enc.indexOf('TIPO DE INSTALACION'), nivel: enc.indexOf('NIVEL DE TENSION'),
  };
  const datos = {}; const porCodigo = {};
  let empezo = false;
  for (const f of filas.slice(h + 1)) {
    // Al terminar la tabla principal el ente pega otras (p. ej. "Usuarios con cambios o de baja", con el NC anterior):
    // se deja de leer en la primera fila vacía
    const vacia = !f || f.every(v => v === '' || v === null || v === undefined);
    if (vacia) { if (empezo) break; continue; }
    empezo = true;
    const nc = normalizarNC(f?.[col.nc]);
    if (!/^\d+$/.test(nc)) continue;
    // Al final del archivo suele haber otras tablas pegadas: solo cuentan las filas con código de caso
    if (col.codigo >= 0 && !/^(CR|DA|DF)/.test(normalizar(f[col.codigo]))) continue;
    const al = valido(f[col.al]); const tension = valido(f[col.tension]);
    const d = {
      ct: valido(f[col.ct]), urbanidad: valido(f[col.urbanidad]), medidor: valido(f[col.medidor]),
      alimentador: al ? (tension ? `${al}-${tension}` : al) : '', direccion: valido(f[col.direccion]),
      tipoInstalacion: valido(f[col.tipoInstalacion]), nivel: valido(f[col.nivel]),
    };
    Object.keys(d).forEach(k => { if (!d[k]) delete d[k]; });
    if (!Object.keys(d).length) continue;
    datos[nc] = { ...d, ...datos[nc] }; // si el NC se repite (CR y DA), gana la primera fila
    if (col.codigo >= 0) porCodigo[normalizar(f[col.codigo])] ??= { ...d, nc };
  }
  // porCodigo: el ente a veces cambia el usuario de un punto; el código manda y el NC del archivo se informa
  return { datos, porCodigo };
}

// ── BASE DE COORDENADAS ──

const NOMBRES_NC = ['NC', 'IDCLIENTE', 'ID CLIENTE', 'IDUSUARIO', 'ID USUARIO', 'ID DEL USUARIO', 'NUMERO DE CONTRATO', 'CONTRATO'];
const NOMBRES_LAT = ['LATITUD', 'LATITUDE', 'LAT', 'COORDX', 'COORD X', 'COORDENADA X', 'Y'];
const NOMBRES_LNG = ['LONGITUD', 'LONGITUDE', 'LON', 'LNG', 'LONG', 'COORDY', 'COORD Y', 'COORDENADA Y', 'X'];
// Rango aproximado de El Salvador (descarta coordenadas en otro sistema, como las del control de puntos)
export const coordenadaValida = (lat, lng) => lat >= 13 && lat <= 14.6 && lng >= -90.2 && lng <= -87.6;

// Coordenadas por NC, solo de los NC pedidos (la base completa tiene cientos de miles de usuarios)
export function leerCoordenadas(filas, ncBuscados) {
  let h = -1; let col = null;
  for (let i = 0; i < Math.min(filas.length, 20) && h < 0; i++) {
    const enc = (filas[i] || []).map(normalizar);
    const c = { nc: columna(enc, NOMBRES_NC), lat: columna(enc, NOMBRES_LAT), lng: columna(enc, NOMBRES_LNG) };
    if (c.nc >= 0 && c.lat >= 0 && c.lng >= 0) { h = i; col = c; }
  }
  if (h < 0) return { error: 'No se encontraron columnas de NC, latitud y longitud' };
  const buscados = new Set(ncBuscados.map(normalizarNC));
  const coords = {}; let descartadas = 0;
  for (let i = h + 1; i < filas.length; i++) {
    const f = filas[i]; if (!f) continue;
    const nc = normalizarNC(f[col.nc]);
    if (!buscados.has(nc)) continue;
    let lat = parseFloat(f[col.lat]); let lng = parseFloat(f[col.lng]);
    // Hay bases donde "X" es la latitud y "Y" la longitud: se acomodan por el rango de El Salvador
    if (!coordenadaValida(lat, lng) && coordenadaValida(lng, lat)) [lat, lng] = [lng, lat];
    if (coordenadaValida(lat, lng)) coords[nc] = { lat, lng }; else descartadas++;
  }
  return { coords, descartadas };
}

// ── CASOS ──

// Campos que se completan con el control de puntos y las coordenadas; si faltan, la tabla los marca
export const CAMPOS_COMPLETAR = [['ct', 'CT/DS'], ['medidor', 'Medidor'], ['alimentador', 'Alimentador'], ['urbanidad', 'Urbanidad'], ['lat', 'Coordenadas']];
export const faltantes = caso => CAMPOS_COMPLETAR.filter(([k]) => caso[k] === undefined || caso[k] === null || caso[k] === '').map(([, label]) => label);

// Tipo de sistema en los códigos DA/DF (dígito después del correlativo): 1 monofásico, 2 bifásico, 3 trifásico.
// El ente lo propone y se corrige con lo que se verifica en campo durante la precampaña.
export const SISTEMAS = { 1: 'Monofásico', 2: 'Bifásico', 3: 'Trifásico' };
const RE_PERTURBACION = /^(DA|DF)(\d)([1-9OND])(20\d{2})(\d{2})(\d)(.*)$/;
export function sistemaDeCodigo(codigo) {
  const m = RE_PERTURBACION.exec(codigo || '');
  return m ? Number(m[6]) : null;
}
export function codigoConSistema(codigo, sistema) {
  const m = RE_PERTURBACION.exec(codigo || '');
  return m ? `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${sistema}${m[7]}` : codigo;
}

// Orden de la tabla: CR, luego DA, luego DF, cada uno por código
const ORDEN_TIPO = { CR: 0, DA: 1, DF: 2 };
export const ordenarCasos = casos => [...casos].sort((a, b) => (ORDEN_TIPO[a.tipo] ?? 9) - (ORDEN_TIPO[b.tipo] ?? 9) || (a.codigoEnte || a.codigo).localeCompare(b.codigoEnte || b.codigo));

// Filas del Excel "Listado" con las mismas columnas que usa el equipo
export function filasListado(casos) {
  const filas = [['NC', 'CÓDIGO SIGET', 'NOMBRE', 'DIRECCIÓN', 'CORTE', 'MEDIDOR', 'LATITUD', 'LONGITUD', 'UBICACIÓN', 'ALIMENTADOR', 'URBANIDAD']];
  ordenarCasos(casos).forEach(c => filas.push([
    /^\d+$/.test(c.nc) ? Number(c.nc) : c.nc, c.codigo, c.nombre, c.direccion || c.direccionEnte || '', c.ct || '', c.medidor || '',
    c.lat ?? '', c.lng ?? '', c.lat != null && c.lng != null && c.lat !== '' ? `${c.lat} , ${c.lng}` : '', c.alimentador || '', c.urbanidad || '',
  ]));
  return filas;
}

// Mapa para el contratista (Google My Maps): KML con un punto por caso, todos del mismo color
// (en la precampaña todavía no hay fechas de instalación). Cada punto lleva las columnas del listado,
// que My Maps muestra como tabla. Devuelve { kml, conPunto, sinCoordenadas: [códigos] }.
export function kmlMapa(nombre, casos) {
  const x = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const [enc, ...filas] = filasListado(casos);
  const iLat = enc.indexOf('LATITUD'); const iLng = enc.indexOf('LONGITUD'); const iCod = enc.indexOf('CÓDIGO SIGET');
  const num = v => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
  const conPunto = filas.filter(f => num(f[iLat]) !== null && num(f[iLng]) !== null);
  const sinCoordenadas = filas.filter(f => !conPunto.includes(f)).map(f => f[iCod]);
  const marca = f => `<Placemark><name>${x(f[iCod])}</name><styleUrl>#caso</styleUrl><ExtendedData>${enc.map((h, i) => `<Data name="${x(h)}"><value>${x(f[i])}</value></Data>`).join('')}</ExtendedData>`
    + `<Point><coordinates>${num(f[iLng])},${num(f[iLat])},0</coordinates></Point></Placemark>`;
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(nombre)}</name>
<Style id="caso"><IconStyle><color>ff90740e</color><scale>1.1</scale><Icon><href>https://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon></IconStyle></Style>
<Folder><name>${x(nombre)}</name>
${conPunto.map(marca).join('\n')}
</Folder></Document></kml>`;
  return { kml, conPunto: conPunto.length, sinCoordenadas };
}
