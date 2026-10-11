// Memos de préstamo y devolución de equipos: un solo flujo para uno o varios equipos.
// Se elige el tipo, de qué área a cuál y los equipos (solo los que se pueden mover); al confirmar se registra el
// movimiento en cada equipo y se guarda el memo en memosEquipos/{id} para reimprimirlo después.
// Con un equipo sale el memo individual; con varios, el memo de lote.
import { isAdmin, userArea } from '../config.js';
import { db, push, ref, update } from '../firebase.js';
import { AREAS_DUENAS, aplicarMovimiento, CAMPOS, devolucionAlRetirar, motivoNoMovimiento, pendientesDevolverCampos } from '../domain/inventario.js';
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

// ── Área dueña de cada equipo (la asigna el administrador) ──
export function abrirAsignarAreas() {
  if (!isAdmin()) return showToast('Solo el administrador asigna el área de los equipos');
  state.view = 'asignar_areas'; render();
}
export function guardarAreas() {
  if (!isAdmin()) return;
  const cambios = [...document.querySelectorAll('[data-area-eq]')].map(el => [el.dataset.areaEq, el.value]).filter(([, v]) => AREAS_DUENAS.includes(v));
  if (!cambios.length) return showToast('No hay cambios');
  cambios.forEach(([id, area]) => update(ref(db, 'equipos/' + id), { area }));
  showToast(`Área asignada a ${cambios.length} ${cambios.length === 1 ? 'equipo' : 'equipos'}`);
  state.view = 'lista'; render();
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

