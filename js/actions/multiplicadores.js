// Multiplicadores: editar el de cada caso, usar el histórico del usuario y exportar la hoja
import { db, push, ref, set, update, validacionesRef } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { kmlMapa, ordenarCasos } from '../domain/listados.js';
import { aplicarDeCR, casosPorValidar, COLORES_POR_VALIDAR, estadoAutomatico, multiplicadorDeCR, relacionadosDeCR, filasMultiplicadores, filasPorValidar, historicoDe, leerMultiplicadoresExcel, planificarMultiplicadores, redDeCaso, sugerenciaMultiplicador, usuariosParaValidacion } from '../domain/multiplicadores.js';
import { leerArchivo } from './campanas.js';
import { hoyLocal, MESES } from '../domain/trabajo.js';
import { render } from '../views/render.js';
import { hojaConEstilo } from '../excel.js';

export const CAMPOS_MULT = ['estado', 'configuracion', 'tap', 'tensionTap', 'tensionBT', 'xMedidor', 'testblock', 'vab', 'vbc', 'vac', 'notas'];
const caso = () => state.campanas?.[state.multEdit?.clave]?.casos?.[state.multEdit?.id];

export function abrirMultiplicador(clave, id) {
  const c = state.campanas?.[clave]?.casos?.[id];
  if (!c) return;
  state.multEdit = { clave, id, red: redDeCaso(c) };
  state.multForm = { ...Object.fromEntries(CAMPOS_MULT.map(k => [k, c.mult?.[k] ?? ''])), auto: [...(c.mult?.auto || [])] };
  render();
}

// Cambio de un dato del multiplicador con el autorrelleno (pedido del equipo): con la configuración y el TAP se ponen la
// tensión según TAP (de la red del alimentador) y la de baja; el estado se pone solo (Tapón o Interno → Pendiente de
// validar; todos los datos → Realizado). Lo que pone la app queda en `auto`; lo escrito o elegido a mano no se pisa.
export function cambiarMultiplicador(k, v) {
  const f = state.multForm; const auto = new Set(f.auto || []);
  f[k] = v; auto.delete(k);
  if (k === 'configuracion' || k === 'tap') {
    const sug = sugerenciaMultiplicador(f, state.multEdit?.red);
    ['tensionTap', 'tensionBT'].forEach(c => {
      if (String(f[c] ?? '').trim() !== '' && !auto.has(c)) return;
      if (sug[c] !== null) { f[c] = String(sug[c]); auto.add(c); } else if (auto.has(c)) { f[c] = ''; auto.delete(c); }
    });
  }
  // El estado elegido a mano se respeta; el vacío o el que puso la app se recalcula
  if (k !== 'estado' && (!f.estado || auto.has('estado'))) {
    const e = estadoAutomatico(f);
    if (e) { f.estado = e; auto.add('estado'); } else if (auto.has('estado')) { f.estado = ''; auto.delete('estado'); }
  }
  f.auto = [...auto];
}
export function cerrarMultiplicador() { state.multEdit = null; state.multForm = {}; render(); }

// Copia la configuración de la última campaña del mismo usuario
export function usarHistorico() {
  const c = caso();
  const h = c && historicoDe(c.nc, state.campanas, state.multEdit.clave);
  if (!h) return;
  ['configuracion', 'tap', 'tensionTap', 'tensionBT', 'xMedidor', 'testblock'].forEach(k => { if (h.mult[k] !== undefined) state.multForm[k] = h.mult[k]; });
  state.multForm.estado = 'Validado con histórico';
  state.multForm.auto = [];
  state.multForm.historico = { clave: h.clave, codigo: h.codigo };
  render();
}

export function guardarMultiplicador() {
  const { clave, id } = state.multEdit || {};
  if (!caso()) return cerrarMultiplicador();
  const datos = {};
  for (const k of CAMPOS_MULT) {
    const v = String(state.multForm[k] ?? '').trim();
    if (!v) continue;
    if (['tensionTap', 'tensionBT', 'xMedidor', 'vab', 'vbc', 'vac'].includes(k)) {
      const n = Number(v.replace(',', '.'));
      if (Number.isNaN(n)) return showToast('Revisa los valores numéricos');
      datos[k] = n;
    } else datos[k] = v;
  }
  if (state.multForm.historico && datos.estado === 'Validado con histórico') datos.historico = state.multForm.historico;
  // Lo que puso la app (para seguir recalculándolo al volver a abrirlo)
  const auto = (state.multForm.auto || []).filter(k => datos[k] !== undefined);
  if (auto.length) datos.auto = auto;
  datos.editadoPor = state.sesionUsuario?.nombre || '';
  datos.fecha = hoyLocal();
  const red = state.multEdit.red;
  cerrarMultiplicador();
  const nombres = escribirMultiplicador(clave, id, datos, { red, aviso: true });
  if (!nombres.length) showToast('Multiplicador guardado');
}

// Guarda el multiplicador de un caso; un CR rellena sus DA y DF (lo que se cambió a mano en ellos no se pisa).
// Devuelve los códigos de los DA/DF que se rellenaron.
// validacion: viene de la validación de TAP (los DA/DF en Pendiente de validar toman el TAP aunque se haya escrito a mano)
export function escribirMultiplicador(clave, id, datos, { red = 0, aviso = false, validacion = false } = {}) {
  const c = state.campanas?.[clave]?.casos?.[id]; if (!c) return [];
  const extra = {}; const nombres = [];
  if (c.tipo === 'CR') {
    const deCR = multiplicadorDeCR(datos, red);
    relacionadosDeCR(c, state.campanas[clave].casos).forEach(r => {
      const liberar = validacion && r.caso.mult?.estado === 'Pendiente de validar' ? ['estado', 'tap', 'tensionTap', 'tensionBT'] : [];
      const nuevo = aplicarDeCR(r.caso.mult || {}, deCR, { liberar });
      if (!nuevo) return;
      extra[`casos/${r.id}/mult`] = { ...nuevo, editadoPor: datos.editadoPor || state.sesionUsuario?.nombre || '', fecha: datos.fecha || hoyLocal(), origen: 'cr' };
      nombres.push(r.caso.codigo || r.caso.codigoEnte || r.id);
    });
  }
  set(ref(db, `campanas/${clave}/casos/${id}/mult`), datos).then(() => { if (aviso && nombres.length) showToast(`Multiplicador guardado · también en ${nombres.join(', ')}`); });
  if (nombres.length) update(ref(db, `campanas/${clave}`), extra);
  return nombres;
}

// Validación de TAP con los Pendiente de validar de la campaña (sin subir Excel): se abre en Validaciones de TAP
export function crearValidacionTap(clave) {
  const g = state.campanas?.[clave]; if (!g) return;
  const casos = Object.entries(g.casos || {}).map(([cid, c]) => ({ ...c, id: c.id || cid }));
  const usuarios = usuariosParaValidacion(casos);
  if (!usuarios.length) return showToast('No hay casos en Pendiente de validar');
  const nombre = `Validación ${MESES[g.mes - 1]} ${g.anio} · ${g.area}`;
  if ((state.validaciones || []).some(v => v.campana === clave) && !confirm(`Ya hay una validación de TAP de esta campaña. ¿Crear otra con los ${usuarios.length} pendientes de ahora?`)) return;
  push(validacionesRef, { nombre, fecha: hoyLocal(), tipo: 'campana', campana: clave, usuarios, creadoPor: state.sesionUsuario?.nombre || 'Desconocido' }).then(r => {
    showToast(`Validación de TAP creada con ${usuarios.length} ${usuarios.length === 1 ? 'usuario' : 'usuarios'}`);
    Object.assign(state, { tab: 'validaciones', valView: 'detalle', valCampanaId: r.key });
    render();
  });
}

export function exportarMultiplicadores(clave) {
  const g = state.campanas?.[clave];
  const casos = ordenarCasos(Object.values(g?.casos || {}));
  if (!casos.length) return;
  const ws = hojaConEstilo(filasMultiplicadores(casos), { anchos: Array(24).fill(16) });
  // DRANETZ y proyecciones con 2 decimales (el valor completo queda en la celda)
  Object.keys(ws).filter(k => /^[JUVW]\d+$/.test(k) && typeof ws[k].v === 'number').forEach(k => { ws[k].z = '0.00'; });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Multiplicadores');
  XLSX.writeFile(wb, `Multiplicadores_${MESES[g.mes - 1]}_${g.anio}_${g.area.replace(/\s+/g, '_')}.xlsx`);
  showToast('Multiplicadores exportados');
}

// Listado (Excel) o mapa (KML para My Maps) de los puntos que hay que ir a validar en campo
export function exportarPorValidar(clave, formato) {
  const g = state.campanas?.[clave];
  const casos = casosPorValidar(Object.values(g?.casos || {}));
  if (!casos.length) return showToast('No hay puntos por validar');
  const base = `Por_validar_${MESES[g.mes - 1]}_${g.anio}_${g.area.replace(/\s+/g, '_')}`;
  if (formato === 'mapa') {
    const { kml, conPunto, sinCoordenadas } = kmlMapa(`Por validar ${MESES[g.mes - 1]} ${g.anio} ${g.area}`, casos, filasPorValidar, { motivo: 'MOTIVO', colores: COLORES_POR_VALIDAR });
    if (!conPunto) return showToast('Ninguno de los puntos por validar tiene coordenadas. Complétalas en Casos.');
    const url = URL.createObjectURL(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }));
    const a = document.createElement('a'); a.href = url; a.download = base + '.kml';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return showToast(sinCoordenadas.length ? `Mapa con ${conPunto} puntos. Sin coordenadas: ${sinCoordenadas.join(', ')}` : `Mapa con ${conPunto} puntos por validar`);
  }
  const ws = hojaConEstilo(filasPorValidar(casos), { anchos: [12, 18, 40, 60, 12, 12, 12, 12, 30, 14, 10, 20, 34, 40] });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Por validar');
  XLSX.writeFile(wb, base + '.xlsx');
  showToast(`Listado con ${casos.length} puntos por validar`);
}

// ── IMPORTAR UN EXCEL DE MULTIPLICADORES YA HECHO (también trae las fechas y el equipo de cada caso) ──

export async function importarMultiplicadores(files) {
  if (!files?.length) return;
  try {
    procesarMultiplicadores(await leerArchivo(files[0]));
  } catch (err) {
    showToast('No se pudo leer el archivo: ' + err.message);
  }
}

// archivo: { nombre, hojas, orden }. Busca la hoja "Multiplicadores" (o la primera que tenga sus columnas).
export function procesarMultiplicadores(archivo) {
  const orden = [...archivo.orden].sort((a, b) => (/multiplicador/i.test(b) ? 1 : 0) - (/multiplicador/i.test(a) ? 1 : 0));
  let leido = null;
  for (const n of orden) { const r = leerMultiplicadoresExcel(archivo.hojas[n]); if (!r.error) { leido = r; break; } }
  if (!leido) return showToast('No se encontró la hoja de multiplicadores (columnas "ESTADO" y "Código SIGET")');
  state.importMult = { nombre: archivo.nombre, estadosRaros: leido.estadosRaros, ...planificarMultiplicadores(leido.filas, state.campanas) };
  render();
}
export function cerrarImportMultiplicadores() { state.importMult = null; render(); }

export function guardarImportMultiplicadores() {
  const imp = state.importMult;
  if (!imp?.planes.length) return;
  const firma = { editadoPor: state.sesionUsuario?.nombre || '', fecha: hoyLocal(), origen: 'excel' };
  imp.planes.forEach(p => {
    const datos = {};
    p.dias.forEach(d => {
      datos[`fechas/${d.n}/instalacion`] = d.instalacion;
      if (d.retiro) datos[`fechas/${d.n}/retiro`] = d.retiro;
    });
    p.asignaciones.forEach(a => {
      if (Object.keys(a.mult).length) datos[`casos/${a.id}/mult`] = { ...a.mult, ...(a.notas ? { notas: a.notas } : {}), ...firma };
      if (a.fecha) datos[`casos/${a.id}/programa/fecha`] = a.fecha;
      if (a.equipo) datos[`casos/${a.id}/programa/equipo`] = a.equipo;
      if (a.codigoNuevo) datos[`casos/${a.id}/codigo`] = a.codigoNuevo;
    });
    update(ref(db, 'campanas/' + p.clave), datos);
  });
  const total = imp.planes.reduce((n, p) => n + p.asignaciones.length, 0);
  showToast(`Multiplicadores importados · ${total} casos`);
  state.importMult = null;
  render();
}
