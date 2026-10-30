// Fechas 1, 2 y 3: asignar casos y equipos, fechas de cada grupo, exportar y enviar a Despachos
import { db, ref, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { validarFilaCarga } from './carga.js';
import { leerArchivo } from './campanas.js';
import { casosDeFecha, leerProgramacion, planificarFechas, filaFecha, filasFecha, tablaParaCopiar } from '../domain/fechas.js';
import { ordenarCasos } from '../domain/listados.js';
import { flujoBT, MESES } from '../domain/trabajo.js';
import { alRedibujar, render } from '../views/render.js';
import { darEstilo } from '../excel.js';

const campana = clave => state.campanas?.[clave];
const casosDe = clave => ordenarCasos(Object.entries(campana(clave)?.casos || {}).map(([id, c]) => ({ id, ...c })));

export function asignarFecha(clave, id, fecha) {
  update(ref(db, `campanas/${clave}/casos/${id}/programa`), { fecha: fecha || null });
}
export function asignarEquipo(clave, id, serie) {
  update(ref(db, `campanas/${clave}/casos/${id}/programa`), { equipo: serie || null });
}
// Ventana para elegir el equipo de un caso, con buscador (en BT son muchos equipos)
export function abrirEquipoFecha(clave, id) { state.equipoFecha = { clave, id }; render(); document.getElementById('eq-fecha-buscar')?.focus(); }
export function cerrarEquipoFecha() { state.equipoFecha = null; render(); }
// Al elegir el equipo pasa solo al siguiente caso de la misma Fecha que todavía no tiene (para programar seguido)
export function elegirEquipoFecha(serie) {
  const { clave, id } = state.equipoFecha || {};
  if (!clave) return;
  asignarEquipo(clave, id, serie);
  const fecha = campana(clave)?.casos?.[id]?.programa?.fecha;
  const lista = fecha && serie ? casosDeFecha(casosDe(clave), fecha) : [];
  const i = lista.findIndex(c => c.id === id);
  const siguiente = [...lista.slice(i + 1), ...lista.slice(0, Math.max(0, i))].find(c => c.id !== id && !c.programa?.equipo);
  state.equipoFecha = siguiente ? { clave, id: siguiente.id } : null;
  render();
  if (siguiente) document.getElementById('eq-fecha-buscar')?.focus();
}
// La ventana del equipo se vuelve a dibujar cuando llega el cambio de la base: el buscador conserva el cursor
let ventanaDe = null;
alRedibujar(() => {
  const id = state.equipoFecha?.id || null;
  if (id && id !== ventanaDe) document.getElementById('eq-fecha-buscar')?.focus();
  else if (id && document.activeElement === document.body) document.getElementById('eq-fecha-buscar')?.focus();
  ventanaDe = id;
});
// Pestaña de la Fecha que se está programando
export function setFechaTab(clave, n) { state.fechaTab = { ...(state.fechaTab || {}), [clave]: n }; render(); }

// Copia la tabla de la Fecha para pegarla en Excel, Word o un correo (código, multiplicador ECAMEC, TI, tipo de
// instalación, equipo y testblock, en ese orden; en BT, transformador y medidor)
export async function copiarFecha(clave, n) {
  const g = campana(clave); const casos = casosDeFecha(casosDe(clave), n);
  if (!casos.length) return showToast('No hay casos en la Fecha ' + n);
  const filas = tablaParaCopiar(casos, flujoBT(g.area));
  const tsv = filas.map(f => f.join('\t')).join('\n');
  const celda = (t, th) => `<${th ? 'th' : 'td'} style="border:1px solid #999;padding:3px 8px">${String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</${th ? 'th' : 'td'}>`;
  const html = `<table style="border-collapse:collapse;font-family:Calibri,Arial;font-size:11pt">${filas.map((f, i) => `<tr>${f.map(t => celda(t, !i)).join('')}</tr>`).join('')}</table>`;
  try {
    if (window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([tsv], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
    else await navigator.clipboard.writeText(tsv);
    showToast(`Fecha ${n} copiada: ${casos.length} ${casos.length === 1 ? 'caso' : 'casos'}`);
  } catch { showToast('No se pudo copiar; usa Exportar Excel'); }
}
// Filtra la lista sin redibujar (para no perder lo escrito)
export function buscarEquipoFecha(q) {
  const caja = document.getElementById('eq-fecha-lista'); if (!caja) return;
  const t = String(q || '').trim().toLowerCase(); let n = 0;
  caja.querySelectorAll('.eqf-op').forEach(b => { const ver = !t || b.dataset.q.includes(t); b.hidden = !ver; if (ver) n++; });
  caja.querySelector('.eqf-nada').hidden = n > 0;
}
export function setDatoFecha(clave, n, campo, valor) {
  update(ref(db, `campanas/${clave}/fechas/${n}`), { [campo]: valor || null });
}

export function exportarFecha(clave, n) {
  const g = campana(clave);
  const casos = casosDeFecha(casosDe(clave), n);
  if (!casos.length) return showToast('No hay casos en la Fecha ' + n);
  const bt = flujoBT(g.area);
  const ws = XLSX.utils.aoa_to_sheet(filasFecha(casos, g.fechas?.[n], bt));
  const rango = XLSX.utils.decode_range(ws['!ref']); rango.s.r = 0; ws['!ref'] = XLSX.utils.encode_range(rango); // empieza en la fila 1, como sus hojas
  ws['!cols'] = (bt ? [16, 12, 36, 12, 50, 14, 14, 14, 14, 12, 12, 40] : [16, 12, 36, 12, 50, 14, 10, 12, 14, 14, 12, 12, 40]).map(wch => ({ wch }));
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
  // Se envía con todos los equipos asignados (confirmado)
  const faltan = casos.filter(c => !c.programa?.equipo).length;
  if (faltan) return showToast(`Faltan ${faltan} ${faltan === 1 ? 'equipo' : 'equipos'} por asignar en la Fecha ${n}`);
  state.cargaData = casos.map(c => {
    if (flujoBT(g.area)) {
      // Formato de despacho de BT: transformador (en las notas) y medidor en lugar del multiplicador
      const [caso, serie, lugar, idUsuario, direccion, notas, medidor, fechaInst, fechaRetiro, lat, lng, accesorios] = filaFecha(c, g.fechas?.[n], true);
      return validarFilaCarga({ serie, caso, lugar, fechaInst, fechaRetiro, notas, medidor, lat: String(lat), lng: String(lng), idUsuario, direccion, accesorios, multiplicador: '', corrientes: '', conexion: '' });
    }
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
