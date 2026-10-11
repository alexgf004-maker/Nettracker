// Memos de préstamo y devolución de equipos: un solo flujo para uno o varios equipos.
// Se elige el tipo, de qué área a cuál y los equipos (solo los que se pueden mover); al confirmar se registra el
// movimiento en cada equipo y se guarda el memo en memosEquipos/{id} para reimprimirlo después.
// Con un equipo sale el memo individual; con varios, el memo de lote.
import { isAdmin, userArea } from '../config.js';
import { db, push, ref, update } from '../firebase.js';
import { AREAS_DUENAS, aplicarMovimiento, CAMPOS, devolucionAlRetirar, motivoNoMovimiento, pendientesDevolverCampos, planOrdenar } from '../domain/inventario.js';
import { generateLotePDF, generateMemoPDF } from '../pdf/memos.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { today } from '../utils.js';
import { render } from '../views/render.js';

const duenaPorDefecto = () => (AREAS_DUENAS.includes(userArea()) ? userArea() : 'CPT MT');
const otraArea = a => (a === 'CPT MT' ? 'CPT BT' : 'CPT MT');

// Valores por defecto según el tipo: préstamo sale del área del usuario; devolución regresa de Campos y Servicios a ella
function porDefecto(tipo) {
  const duena = duenaPorDefecto();
  return tipo === 'prestamo' ? { de: duena, a: otraArea(duena) } : { de: CAMPOS, a: duena };
}

// Abre el flujo. opts: { tipo, de, a, sel: [ids] } (desde la ficha de un equipo llega ya elegido)
export function abrirMemoNuevo(opts = {}) {
  const tipo = opts.tipo || 'prestamo';
  state.memoNuevo = { tipo, ...porDefecto(tipo), nota: '', busqueda: '', sel: [], ...opts };
  state.view = 'memo_nuevo';
  depurarSeleccion();
  render();
}
export function cerrarMemoNuevo() { state.memoNuevo = null; state.view = state.editEqId ? 'equipo_detalle' : 'lista'; render(); }

// Deja en la selección solo los equipos que se pueden mover con los datos actuales
function depurarSeleccion() {
  const m = state.memoNuevo; if (!m) return;
  m.sel = m.sel.filter(id => { const eq = state.equipos.find(x => x.id === id); return eq && !motivoNoMovimiento(eq, m, state.records); });
}

export function setMemoNuevo(campo, valor) {
  const m = state.memoNuevo; if (!m) return;
  if (campo === 'tipo' && valor !== m.tipo) Object.assign(m, { tipo: valor, ...porDefecto(valor) });
  else m[campo] = valor;
  if (campo === 'de' && m.tipo === 'prestamo' && m.a === valor) m.a = otraArea(valor);
  if (campo !== 'nota' && campo !== 'busqueda') depurarSeleccion();
  if (campo !== 'nota') render();
}

export function toggleEquipoMemo(id) {
  const m = state.memoNuevo; if (!m) return;
  const eq = state.equipos.find(x => x.id === id);
  if (!eq || motivoNoMovimiento(eq, m, state.records)) return;
  m.sel = m.sel.includes(id) ? m.sel.filter(x => x !== id) : [...m.sel, id];
  render();
}
export function seleccionarTodosMemo(ids) {
  const m = state.memoNuevo; if (!m) return;
  const todos = ids.every(id => m.sel.includes(id));
  m.sel = todos ? m.sel.filter(id => !ids.includes(id)) : [...new Set([...m.sel, ...ids])];
  render();
}

// Registra el movimiento en todos los equipos elegidos, guarda el memo y lo abre
export function confirmarMemoNuevo() {
  const m = state.memoNuevo; if (!m) return;
  if (m.de === m.a) return showToast('El área que entrega y la que recibe deben ser distintas');
  const equipos = m.sel.map(id => state.equipos.find(x => x.id === id)).filter(eq => eq && !motivoNoMovimiento(eq, m, state.records));
  if (!equipos.length) return showToast('Elige al menos un equipo');
  const por = state.sesionUsuario?.nombre || 'Desconocido';
  const fecha = today();
  const hora = new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
  const nota = String(m.nota || '').trim();
  const memo = { tipo: m.tipo, de: m.de, a: m.a, fecha, hora, nota, registradoPor: por,
    equipos: equipos.map(eq => ({ id: eq.id, serie: eq.serie, modelo: eq.modelo || '', vineta: eq.vineta || '', condicion: eq.condicion || 'bueno' })) };
  const { key: memoId } = push(ref(db, 'memosEquipos'), memo);
  const mov = { tipo: m.tipo, de: m.de, a: m.a, fecha, nota, registradoPor: por, memoId };
  equipos.forEach(eq => update(ref(db, 'equipos/' + eq.id), aplicarMovimiento(eq, mov)));
  imprimirMemo(memo);
  showToast(`${m.tipo === 'prestamo' ? 'Préstamo' : 'Devolución'} registrado${equipos.length > 1 ? ` para ${equipos.length} equipos` : ''}`);
  state.memoNuevo = null; state.view = 'lista'; state.editEqId = null; state.invVista = 'memos';
  render();
}

// Abre el memo guardado (individual si es un equipo, de lote si son varios)
export function imprimirMemo(memo) {
  const mov = { tipo: memo.tipo, de: memo.de, a: memo.a, fecha: memo.fecha, nota: memo.nota, registradoPor: memo.registradoPor };
  const items = (memo.equipos || []).map(eq => ({ eq, movimiento: mov }));
  if (items.length === 1) generateMemoPDF(items[0].eq, mov);
  else generateLotePDF(items, memo.tipo);
}
export function reimprimirMemoEquipos(id) {
  const memo = state.memosEquipos.find(x => x.id === id);
  if (memo) imprimirMemo(memo);
}

// ── Ordenar el inventario (administrador): se marcan los de CPT MT; los demás son de CPT BT y van a la Cucumacayán ──
export function abrirOrdenar() {
  if (!isAdmin()) return showToast('Solo el administrador ordena el inventario');
  state.ordenar = { mt: state.equipos.filter(eq => eq.area === 'CPT MT').map(eq => eq.id), busqueda: '' };
  state.view = 'ordenar'; render();
}
export function toggleOrdenarMT(id) {
  const o = state.ordenar; if (!o) return;
  o.mt = o.mt.includes(id) ? o.mt.filter(x => x !== id) : [...o.mt, id];
  render();
}
export function setOrdenarBusqueda(v) {
  if (!state.ordenar) return;
  state.ordenar.busqueda = v; render();
  const inp = document.getElementById('ordenar-buscar');
  if (inp) { inp.focus(); inp.setSelectionRange(v.length, v.length); }
}
export function guardarOrdenar() {
  const o = state.ordenar; if (!o || !isAdmin()) return;
  const plan = planOrdenar(state.equipos, state.records, o.mt);
  if (!plan.length) { showToast('No hay cambios'); state.ordenar = null; state.view = 'lista'; render(); return; }
  const mover = plan.filter(x => x.cambios.sede).length;
  if (!confirm(`¿Guardar? ${o.mt.length} quedan de CPT MT y el resto de CPT BT.${mover ? ` ${mover} ${mover === 1 ? 'equipo pasa' : 'equipos pasan'} a la Cucumacayán.` : ''}`)) return;
  const usuario = state.sesionUsuario?.nombre || '';
  plan.forEach(({ eq, cambios }) => update(ref(db, 'equipos/' + eq.id), { ...cambios, editadoPor: usuario, fechaEdicion: today() }));
  showToast(`Inventario ordenado: ${plan.length} ${plan.length === 1 ? 'equipo actualizado' : 'equipos actualizados'}`);
  state.ordenar = null; state.view = 'lista'; render();
}

// Equipos que ya regresaron de campo pero siguen como prestados a Campos y Servicios (de antes de la devolución automática)
export function regularizarDevolucionesCampos() {
  const lista = pendientesDevolverCampos(state.equipos, state.records);
  if (!lista.length) return;
  if (!confirm(`¿Registrar la devolución de ${lista.length} ${lista.length === 1 ? 'equipo' : 'equipos'} de Campos y Servicios a su área? Ya no están instalados.`)) return;
  const por = state.sesionUsuario?.nombre || '';
  lista.forEach(eq => update(ref(db, 'equipos/' + eq.id), devolucionAlRetirar(eq, { fecha: today(), por })));
  showToast(`${lista.length} ${lista.length === 1 ? 'equipo devuelto' : 'equipos devueltos'} a su área`);
}

