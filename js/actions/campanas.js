// Precampaña: importar los listados del ente, completar con el control de puntos y las coordenadas,
// corregir casos y exportar el listado. Los casos viven en campanas/{clave}/casos/{código del ente}.
import { db, ref, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { hoyLocal, MESES } from '../domain/trabajo.js';
import { armarCampanas, filasListado, leerControlPuntos, leerCoordenadas, leerListadoEnte } from '../domain/listados.js';
import { render } from '../views/render.js';

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

// Guarda las campañas. Si ya existían, actualiza los datos del ente sin tocar lo que ya se completó o corrigió.
export function guardarImportListados() {
  const imp = state.importListados;
  if (!imp?.campanas.length) return;
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
    }
    return update(ref(db, 'campanas/' + c.clave), datos);
  });
  Promise.all(escrituras).then(() => {
    const total = imp.campanas.reduce((n, c) => n + Object.keys(c.casos).length, 0);
    showToast(`${imp.campanas.length} ${imp.campanas.length === 1 ? 'campaña importada' : 'campañas importadas'} · ${total} casos`);
  });
  state.showImportListados = false;
  state.importListados = null;
  render();
}

// ── COMPLETAR DATOS ──

// Escribe en los casos los datos encontrados, sin pisar lo que se corrigió a mano
function completarCasos(clave, porNC, mensaje) {
  const casos = casosGuardados(clave);
  const datos = {}; let completados = 0;
  for (const [id, caso] of Object.entries(casos)) {
    const encontrados = porNC[caso.nc];
    if (!encontrados) continue;
    let cambio = false;
    for (const [campo, valor] of Object.entries(encontrados)) {
      if (caso.manual?.[campo] || valor === undefined || valor === '' || caso[campo] === valor) continue;
      datos[`casos/${id}/${campo}`] = valor; cambio = true;
    }
    if (cambio) completados++;
  }
  const sinDatos = Object.values(casos).filter(c => !porNC[c.nc]).length;
  if (!completados) { showToast(sinDatos ? `No se encontró información nueva (${sinDatos} casos no están en el archivo)` : 'Los casos ya tenían esa información'); return Promise.resolve(); }
  return update(ref(db, 'campanas/' + clave), datos).then(() => showToast(mensaje(completados) + (sinDatos ? ` · ${sinDatos} no están en el archivo` : '')));
}

// Control de puntos: CT/DS, medidor, alimentador, urbanidad, dirección y tipo de instalación
export function completarConControl(clave, archivo) {
  const hoja = archivo.hojas.LISTADO || primeraHoja(archivo);
  const { datos, error } = leerControlPuntos(hoja);
  if (error) return showToast(error);
  completarCasos(clave, datos, n => `${n} casos completados con el control de puntos`);
}

// Base de coordenadas: solo se toman los NC de la campaña
export function completarCoordenadas(clave, archivo) {
  const ncs = Object.values(casosGuardados(clave)).map(c => c.nc);
  let resultado = null;
  for (const n of archivo.orden) { const r = leerCoordenadas(archivo.hojas[n], ncs); if (!r.error) { resultado = r; break; } }
  if (!resultado) return showToast('No se encontraron columnas de NC, latitud y longitud');
  completarCasos(clave, resultado.coords, n => `${n} casos con coordenadas`);
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
  const ws = XLSX.utils.aoa_to_sheet(filasListado(casos));
  ws['!cols'] = [12, 18, 40, 60, 12, 12, 12, 12, 30, 14, 10].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Listado');
  XLSX.writeFile(wb, `Listado_${MESES[g.mes - 1]}_${g.anio}_${g.area.replace(/\s+/g, '_')}.xlsx`);
  showToast('Listado exportado');
}
