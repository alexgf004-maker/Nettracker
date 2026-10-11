// Formulario de inspección del reclamo (reclamos/{id}/inspeccion): se guarda campo por campo al salir de cada uno.
// Tableros, transformadores secos y equipos dañados son listas con claves de push. Las firmas se dibujan en
// pantalla y se guardan como PNG pequeño; sin firma, el PDF deja la línea para firmar a mano.
import { db, push, ref, remove, update } from '../firebase.js';
import { state } from '../state.js';
import { abrirDoc, showToast } from '../ui.js';
import { buildFormularioInspeccion } from '../pdf/inspeccion.js';
import { medicionesExpediente } from '../domain/expedientes.js';
import { equiposMedicion } from '../domain/inspeccion.js';
import { hoyLocal } from '../domain/trabajo.js';
import { configCartas } from './documentos.js';
import { render } from '../views/render.js';

const NUMERICOS = /(^|\/)(kvas\/\d|kva|tierra|vmin|vmax|monto|lect\/\w+)$/;
const rutaBase = id => `reclamos/${id}/inspeccion`;

// ruta: 'fecha', 'subestacion/tap', 'tableros/{clave}/tierra'…
export function guardarInspeccion(id, ruta, valor) {
  let v = String(valor ?? '').trim();
  if (v && NUMERICOS.test(ruta)) {
    v = v.replace(',', '.').replace(/^\$/, '');
    if (Number.isNaN(Number(v))) return showToast('Escribe solo el número');
  }
  const cambios = { [ruta]: v === '' ? null : v };
  // Al cambiar el tipo de subestación, las conexiones y la construcción del tipo anterior ya no aplican
  if (ruta === 'subestacion/tipo') ['construccion', 'conexionPri', 'conexionPriOtra', 'conexionSec', 'conexionSecOtra'].forEach(k => { cambios['subestacion/' + k] = null; });
  update(ref(db, rutaBase(id)), cambios);
}

export function marcarInspeccion(id, ruta, marcado) {
  update(ref(db, rutaBase(id)), { [ruta]: marcado ? true : null });
}

export function agregarItemInspeccion(id, lista) {
  push(ref(db, `${rutaBase(id)}/${lista}`), { orden: Date.now() });
}

const NOMBRE_LISTA = { tableros: 'tablero', equipos: 'equipo', trafosSecos: 'transformador seco' };
export function quitarItemInspeccion(id, lista, clave) {
  if (!confirm(`¿Quitar este ${NOMBRE_LISTA[lista] || 'elemento'} de la inspección?`)) return;
  remove(ref(db, `${rutaBase(id)}/${lista}/${clave}`));
}

// ── Firma en pantalla ──
export function abrirFirma(id, rol) { state.firmaInsp = { id, rol, trazos: [] }; render(); }
export function cerrarFirma() { state.firmaInsp = null; render(); }

const lienzo = () => document.getElementById('firma-canvas');
function punto(ev, c) {
  const r = c.getBoundingClientRect();
  return [((ev.clientX - r.left) / r.width) * c.width, ((ev.clientY - r.top) / r.height) * c.height];
}
// Redibuja todo (si la pantalla se volvió a dibujar mientras firmaba, el lienzo nuevo llega en blanco)
function dibujar(c) {
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b2e3b';
  (state.firmaInsp?.trazos || []).forEach(t => {
    ctx.beginPath(); t.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (t.length === 1) ctx.lineTo(t[0][0] + 0.1, t[0][1]);
    ctx.stroke();
  });
  c.dataset.listo = '1';
}
export function firmaInicio(ev) {
  const f = state.firmaInsp; const c = lienzo(); if (!f || !c) return;
  ev.preventDefault(); c.setPointerCapture?.(ev.pointerId);
  f.dibujando = true; f.trazos.push([punto(ev, c)]); dibujar(c);
}
export function firmaMover(ev) {
  const f = state.firmaInsp; const c = lienzo(); if (!f?.dibujando || !c) return;
  ev.preventDefault();
  f.trazos[f.trazos.length - 1].push(punto(ev, c));
  dibujar(c);
}
export function firmaFin() { if (state.firmaInsp) state.firmaInsp.dibujando = false; }
export function limpiarFirma() { const f = state.firmaInsp; const c = lienzo(); if (!f) return; f.trazos = []; if (c) dibujar(c); }

export function guardarFirma() {
  const f = state.firmaInsp; const c = lienzo(); if (!f || !c) return;
  if (!f.trazos.some(t => t.length)) return showToast('Firma dentro del recuadro');
  dibujar(c);
  update(ref(db, rutaBase(f.id)), { [`firmas/${f.rol}/img`]: c.toDataURL('image/png') });
  state.firmaInsp = null;
  showToast('Firma guardada');
  render();
}
export function borrarFirma(id, rol) {
  if (!confirm('¿Quitar esta firma? En el PDF quedará la línea para firmar a mano.')) return;
  update(ref(db, rutaBase(id)), { [`firmas/${rol}/img`]: null });
}

// Abre el formulario listo para imprimir o guardar como PDF
export function generarFormularioInspeccion(id) {
  const exp = state.reclamos?.[id]; if (!exp) return;
  const medicion = equiposMedicion(medicionesExpediente({ ...exp, id }, state.records, hoyLocal()), state.equipos);
  abrirDoc(buildFormularioInspeccion({ ...exp, id }, exp.inspeccion || {}, { inspector: state.sesionUsuario?.nombre || '', medicion, logo: configCartas().logo }), `Inspeccion-${String(exp.codigo || id).replace(/[^\w-]+/g, '_')}.html`);
}
