// Fechas 1, 2 y 3: asignar casos y equipos, fechas de cada grupo, exportar y enviar a Despachos
import { db, ref, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { validarFilaCarga } from './carga.js';
import { leerArchivo } from './campanas.js';
import { casosDeFecha, leerProgramacion, planificarFechas, filaFecha, filasFecha } from '../domain/fechas.js';
import { ordenarCasos } from '../domain/listados.js';
import { MESES } from '../domain/trabajo.js';
import { render } from '../views/render.js';
import { darEstilo } from '../excel.js';

const campana = clave => state.campanas?.[clave];
const casosDe = clave => ordenarCasos(Object.entries(campana(clave)?.casos || {}).map(([id, c]) => ({ id, ...c })));

export function asignarFecha(clave, id, fecha) {
  update(ref(db, `campanas/${clave}/casos/${id}/programa`), { fecha: fecha || null });
}
export function asignarEquipo(clave, id, serie) {
  update(ref(db, `campanas/${clave}/casos/${id}/programa`), { equipo: serie || null });
}
export function setDatoFecha(clave, n, campo, valor) {
  update(ref(db, `campanas/${clave}/fechas/${n}`), { [campo]: valor || null });
}

export function exportarFecha(clave, n) {
  const g = campana(clave);
  const casos = casosDeFecha(casosDe(clave), n);
  if (!casos.length) return showToast('No hay casos en la Fecha ' + n);
  const ws = XLSX.utils.aoa_to_sheet(filasFecha(casos, g.fechas?.[n]));
  const rango = XLSX.utils.decode_range(ws['!ref']); rango.s.r = 0; ws['!ref'] = XLSX.utils.encode_range(rango); // empieza en la fila 1, como sus hojas
  ws['!cols'] = [16, 12, 36, 12, 50, 14, 10, 12, 14, 14, 12, 12, 40].map(wch => ({ wch }));
  darEstilo(ws, { encabezado: 2 });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fecha' + n);
  XLSX.writeFile(wb, `Fecha${n}_${MESES[g.mes - 1]}_${g.anio}_${g.area.replace(/\s+/g, '_')}.xlsx`);
  showToast(`Fecha ${n} exportada`);
}

// Lleva la fecha a Despachos con las mismas validaciones que la carga desde Excel
export function enviarFechaADespachos(clave, n) {
  const g = campana(clave);
  const casos = casosDeFecha(casosDe(clave), n);
  if (!casos.length) return showToast('No hay casos en la Fecha ' + n);
  state.cargaData = casos.map(c => {
    const [caso, serie, lugar, idUsuario, direccion, multiplicador, corrientes, conexion, fechaInst, fechaRetiro, lat, lng, accesorios] = filaFecha(c, g.fechas?.[n]);
    return validarFilaCarga({ serie, caso, lugar, fechaInst, fechaRetiro, notas: '', lat: String(lat), lng: String(lng), idUsuario, direccion, accesorios, multiplicador, corrientes, conexion });
  });
  state.cargaAreaOrigen = g.area;
  state.cargaView = 'preview';
  state.cargaSubView = 'subir';
  state.tab = 'carga'; state.view = 'lista'; state.campanaClave = null;
  render();
}

// ── IMPORTAR PROGRAMACIÓN (Excel con la fecha de instalación de cada caso) ──

export async function importarProgramacion(files) {
  if (!files?.length) return;
  try {
    procesarProgramacion(await leerArchivo(files[0]));
  } catch (err) {
    showToast('No se pudo leer el archivo: ' + err.message);
  }
}

// archivo: { nombre, hojas, orden } (separado para poder probarlo sin archivo)
export function procesarProgramacion(archivo) {
  let leido = null;
  for (const n of archivo.orden) { const r = leerProgramacion(archivo.hojas[n]); if (!r.error) { leido = r; break; } }
  if (!leido) return showToast('No se encontraron las columnas "Número SIGET" y "Fecha instalación"');
  state.importProgramacion = { nombre: archivo.nombre, ...planificarFechas(leido.filas, state.campanas) };
  render();
}
export function cerrarProgramacion() { state.importProgramacion = null; render(); }

export function guardarProgramacion() {
  const imp = state.importProgramacion;
  if (!imp?.planes.length) return;
  imp.planes.forEach(p => {
    const datos = {};
    p.dias.forEach((d, i) => { datos[`fechas/${i + 1}/instalacion`] = d; });
    p.asignaciones.forEach(a => {
      if (a.fecha) datos[`casos/${a.id}/programa/fecha`] = a.fecha;
      if (a.codigoNuevo) datos[`casos/${a.id}/codigo`] = a.codigoNuevo;
    });
    update(ref(db, 'campanas/' + p.clave), datos);
  });
  const total = imp.planes.reduce((n, p) => n + p.asignaciones.length, 0);
  showToast(`Programación guardada · ${total} casos`);
  state.importProgramacion = null;
  render();
}
