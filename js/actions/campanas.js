// Precampaña: importar los listados del ente, completar con el control de puntos y las coordenadas,
// corregir casos y exportar el listado. Los casos viven en campanas/{clave}/casos/{código del ente}.
import { db, get, ref, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { hoyLocal, MESES } from '../domain/trabajo.js';
import { armarCampanas, coordenadaValida, filasListado, leerControlPuntos, leerCoordenadas, leerListadoEnte } from '../domain/listados.js';
import { render } from '../views/render.js';
import { hojaConEstilo } from '../excel.js';

// Lee un Excel (o CSV) y devuelve { nombre, hojas: { nombreHoja: filas } }
export function leerArchivo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const hojas = {};
        wb.SheetNames.forEach(n => { hojas[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }); });
        resolve({ nombre: file.name, hojas, orden: wb.SheetNames });
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

const primeraHoja = a => a.hojas[a.orden[0]];
const firma = () => ({ fecha: hoyLocal(), por: state.sesionUsuario?.nombre || '' });
const casosGuardados = clave => state.campanas?.[clave]?.casos || {};

// ── IMPORTAR LISTADOS DEL ENTE ──

export function abrirImportListados() {
  state.showImportListados = true;
  state.importListados = null;
  render();
}
export function cerrarImportListados() {
  state.showImportListados = false;
  state.importListados = null;
  render();
}

// archivos: [{ nombre, hojas, orden }]. Separado de la lectura para poder probarlo sin archivos.
export function procesarListados(archivos) {
  const leidos = archivos.map(a => ({ nombre: a.nombre, ...leerListadoEnte(primeraHoja(a), a.nombre) }));
  const { campanas, avisos } = armarCampanas(leidos.filter(l => !l.error && l.nivel));
  leidos.filter(l => !l.error && !l.nivel).forEach(l => avisos.push(`${l.nombre}: no se reconoce si es MT, BT, DA o FK`));
  state.importListados = { archivos: leidos, campanas, avisos };
  render();
}

export async function leerListadosEnte(files) {
  try {
    procesarListados(await Promise.all([...files].map(leerArchivo)));
  } catch (err) {
    showToast('No se pudo leer el archivo: ' + err.message);
  }
}

// Coordenadas de la base guardada en Firebase (coordenadas/{NC} = [lat, lng]), solo de los NC pedidos
export async function buscarCoordenadas(ncs) {
  const unicos = [...new Set(ncs.filter(Boolean))];
  const pares = await Promise.all(unicos.map(nc => get(ref(db, 'coordenadas/' + nc)).then(s => [nc, s.exists() ? s.val() : null]).catch(() => [nc, null])));
  const coords = {};
  for (const [nc, v] of pares) {
    const lat = Number(v?.[0] ?? v?.lat); const lng = Number(v?.[1] ?? v?.lng);
    if (coordenadaValida(lat, lng)) coords[nc] = { lat, lng };
  }
  return coords;
}

// Guarda las campañas. Si ya existían, actualiza los datos del ente sin tocar lo que ya se completó o corrigió.
// Las coordenadas se toman de la base en Firebase (si está cargada) para los casos que no las tengan.
export async function guardarImportListados() {
  const imp = state.importListados;
  if (!imp?.campanas.length) return;
  state.showImportListados = false;
  state.importListados = null;
  render();
  const coords = await buscarCoordenadas(imp.campanas.flatMap(c => Object.values(c.casos).map(x => x.nc)));
  const escrituras = imp.campanas.map(c => {
    const previos = casosGuardados(c.clave);
    const datos = { anio: c.anio, mes: c.mes, area: c.area, importado: { ...firma(), archivos: imp.archivos.filter(a => !a.error).map(a => a.nombre) } };
    for (const [id, caso] of Object.entries(c.casos)) {
      const base = `casos/${id}/`;
      Object.assign(datos, {
        [base + 'codigoEnte']: caso.codigo, [base + 'tipo']: caso.tipo, [base + 'nc']: caso.nc, [base + 'nombre']: caso.nombre,
        [base + 'direccionEnte']: caso.direccionEnte, [base + 'municipio']: caso.municipio, [base + 'depto']: caso.depto,
      });
      if (caso.crRelacionado) datos[base + 'crRelacionado'] = caso.crRelacionado;
      if (!previos[id]) datos[base + 'codigo'] = caso.codigo; // el código puede corregirse después (tipo de sistema)
      const p = previos[id] || {};
      if (coords[caso.nc] && (p.lat === undefined || p.lat === null || p.lat === '') && !p.manual?.lat) {
        datos[base + 'lat'] = coords[caso.nc].lat; datos[base + 'lng'] = coords[caso.nc].lng;
      }
    }
    return update(ref(db, 'campanas/' + c.clave), datos);
  });
  await Promise.all(escrituras);
  const total = imp.campanas.reduce((n, c) => n + Object.keys(c.casos).length, 0);
  const conCoords = imp.campanas.reduce((n, c) => n + Object.values(c.casos).filter(x => coords[x.nc]).length, 0);
  showToast(`${imp.campanas.length} ${imp.campanas.length === 1 ? 'campaña importada' : 'campañas importadas'} · ${total} casos${conCoords ? ` · ${conCoords} con coordenadas` : ''}`);
}

// ── COMPLETAR DATOS ──

// Escribe en los casos los datos encontrados, sin pisar lo que se corrigió a mano.
// buscar(caso) devuelve los datos de ese caso o nada.
function completarCasos(clave, buscar, mensaje) {
  const casos = casosGuardados(clave);
  const datos = {}; let completados = 0; let sinDatos = 0; let otroNC = 0;
  for (const [id, caso] of Object.entries(casos)) {
    const encontrados = buscar(caso);
    if (!encontrados) { sinDatos++; continue; }
    let cambio = false;
    for (const [campo, valor] of Object.entries(encontrados)) {
      if (campo === 'nc') continue;
      if (caso.manual?.[campo] || valor === undefined || valor === '' || caso[campo] === valor) continue;
      datos[`casos/${id}/${campo}`] = valor; cambio = true;
    }
    // Mismo código con otro NC: se guarda aparte para avisar, el NC del ente no se cambia
    if (encontrados.nc && encontrados.nc !== caso.nc) {
      otroNC++;
      if (caso.ncControl !== encontrados.nc) { datos[`casos/${id}/ncControl`] = encontrados.nc; cambio = true; }
    }
    if (cambio) completados++;
  }
  const extra = (sinDatos ? ` · ${sinDatos} no están en el archivo` : '') + (otroNC ? ` · ${otroNC} con otro NC en el control de puntos` : '');
  if (!completados) { showToast((sinDatos ? 'No se encontró información nueva' : 'Los casos ya tenían esa información') + extra); return Promise.resolve(); }
  return update(ref(db, 'campanas/' + clave), datos).then(() => showToast(mensaje(completados) + extra));
}

// Control de puntos: CT/DS, medidor, alimentador, urbanidad, dirección y tipo de instalación.
// Se busca primero por código del caso y, si no está, por NC.
export function completarConControl(clave, archivo) {
  const hoja = archivo.hojas.LISTADO || primeraHoja(archivo);
  const { datos, porCodigo, error } = leerControlPuntos(hoja);
  if (error) return showToast(error);
  completarCasos(clave, c => porCodigo[c.codigo] || porCodigo[c.codigoEnte] || datos[c.nc], n => `${n} casos completados con el control de puntos`);
}

// NC con los que se buscan coordenadas: el del ente y, si no hay, el del control de puntos
const ncCoordenadas = c => [c.nc, c.ncControl].filter(Boolean);
const coordenadaDe = (coords, c) => ncCoordenadas(c).map(nc => coords[nc]).find(Boolean);

// Base de coordenadas: solo se toman los NC de la campaña
export function completarCoordenadas(clave, archivo) {
  const ncs = Object.values(casosGuardados(clave)).flatMap(ncCoordenadas);
  let resultado = null;
  for (const n of archivo.orden) { const r = leerCoordenadas(archivo.hojas[n], ncs); if (!r.error) { resultado = r; break; } }
  if (!resultado) return showToast('No se encontraron columnas de NC, latitud y longitud');
  completarCasos(clave, c => coordenadaDe(resultado.coords, c), n => `${n} casos con coordenadas`);
}

// Desde la base en Firebase, sin subir archivos
export async function completarCoordenadasBase(clave) {
  const casos = Object.values(casosGuardados(clave));
  const coords = await buscarCoordenadas(casos.flatMap(ncCoordenadas));
  if (!Object.keys(coords).length) return showToast('No se encontraron coordenadas en la base. Revisa que esté cargada en Firebase (nodo coordenadas)');
  completarCasos(clave, c => coordenadaDe(coords, c), n => `${n} casos con coordenadas`);
}

export async function subirArchivoCampana(clave, tipo, files) {
  if (!files?.length) return;
  try {
    const archivo = await leerArchivo(files[0]);
    if (tipo === 'control') completarConControl(clave, archivo); else completarCoordenadas(clave, archivo);
  } catch (err) {
    showToast('No se pudo leer el archivo: ' + err.message);
  }
}

// ── EDITAR UN CASO ──

export const CAMPOS_CASO = ['codigo', 'nombre', 'direccion', 'ct', 'medidor', 'alimentador', 'urbanidad', 'tipoInstalacion', 'lat', 'lng'];

export function abrirCaso(clave, id) {
  const caso = casosGuardados(clave)[id];
  if (!caso) return;
  state.casoEdit = { clave, id };
  state.casoForm = Object.fromEntries(CAMPOS_CASO.map(k => [k, caso[k] ?? (k === 'direccion' ? caso.direccionEnte || '' : '')]));
  render();
}
export function cerrarCaso() { state.casoEdit = null; state.casoForm = {}; render(); }

export function guardarCaso() {
  const { clave, id } = state.casoEdit || {};
  const caso = casosGuardados(clave)[id];
  if (!caso) return cerrarCaso();
  const datos = {};
  for (const k of CAMPOS_CASO) {
    let v = state.casoForm[k];
    if (k === 'lat' || k === 'lng') v = v === '' || v === null || v === undefined ? null : Number(v);
    else v = String(v ?? '').trim();
    const antes = caso[k] ?? (k === 'direccion' ? caso.direccionEnte || '' : (k === 'lat' || k === 'lng' ? null : ''));
    if (v === antes || (k !== 'lat' && k !== 'lng' && v === '' && !caso[k])) continue;
    if ((k === 'lat' || k === 'lng') && v !== null && Number.isNaN(v)) return showToast('Las coordenadas deben ser números');
    datos[k] = v === '' ? null : v;
    datos['manual/' + k] = true; // que el control de puntos o la base de coordenadas no lo vuelvan a cambiar
  }
  if (!Object.keys(datos).length) return cerrarCaso();
  datos.editadoPor = state.sesionUsuario?.nombre || '';
  datos.fechaEdicion = hoyLocal();
  update(ref(db, `campanas/${clave}/casos/${id}`), datos).then(() => showToast('Caso actualizado'));
  cerrarCaso();
}

// ── EXPORTAR ──

export function exportarListado(clave) {
  const g = state.campanas?.[clave];
  const casos = Object.values(g?.casos || {});
  if (!casos.length) return;
  const ws = hojaConEstilo(filasListado(casos), { anchos: [12, 18, 40, 60, 12, 12, 12, 12, 30, 14, 10] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Listado');
  XLSX.writeFile(wb, `Listado_${MESES[g.mes - 1]}_${g.anio}_${g.area.replace(/\s+/g, '_')}.xlsx`);
  showToast('Listado exportado');
}
