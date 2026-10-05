// Precampaña: generar cartas y hojas de inspección, datos de las cartas y pasos de seguimiento
import { configCartasRef, db, ref, remove, set } from '../firebase.js';
import { state } from '../state.js';
import { abrirDoc, showToast } from '../ui.js';
import { CONFIG_CARTAS_VACIA, htmlCartas, htmlHojasInspeccion, periodoInstalacion } from '../domain/documentos.js';
import { ordenarCasos } from '../domain/listados.js';
import { hoyLocal, nombreCampana } from '../domain/trabajo.js';
import { render } from '../views/render.js';

const firma = extra => ({ fecha: hoyLocal(), por: state.sesionUsuario?.nombre || '', ...extra });
export const configCartas = () => ({ ...CONFIG_CARTAS_VACIA, ...(state.configCartas || {}) });

// ── GENERAR ──

export function abrirDocumentos(clave, tipo) {
  const g = state.campanas?.[clave];
  if (!g?.casos) return;
  if (tipo === 'cartas' && !configCartas().firmante) {
    showToast('Primero completa los datos de las cartas');
    return abrirConfigCartas();
  }
  state.docsModal = { clave, tipo };
  state.docsForm = { fecha: hoyLocal(), periodo: periodoInstalacion(g.anio, g.mes), excluidos: {} };
  render();
}
export function cerrarDocumentos() { state.docsModal = null; render(); }

export function toggleExcluirCaso(id) {
  const ex = state.docsForm.excluidos;
  if (ex[id]) delete ex[id]; else ex[id] = true;
  render();
}
export function excluirTodos(todos) {
  const g = state.campanas?.[state.docsModal?.clave];
  state.docsForm.excluidos = todos ? Object.fromEntries(Object.keys(g?.casos || {}).map(id => [id, true])) : {};
  render();
}

export function generarDocumentos() {
  const { clave, tipo } = state.docsModal || {};
  const g = state.campanas?.[clave];
  if (!g) return;
  const casos = ordenarCasos(Object.entries(g.casos || {}).filter(([id]) => !state.docsForm.excluidos[id]).map(([id, c]) => ({ id, ...c, codigo: c.codigo || c.codigoEnte })));
  if (!casos.length) return showToast('No hay casos seleccionados');
  const titulo = `${nombreCampana(g)} · ${g.area}`;
  const cfg = configCartas();
  const html = tipo === 'cartas'
    ? htmlCartas(casos, { ...cfg, fecha: state.docsForm.fecha, periodo: state.docsForm.periodo, titulo })
    : htmlHojasInspeccion(casos, { logo: cfg.logo, distribuidora: cfg.distribuidora, titulo });
  abrirDoc(html, `${tipo === 'cartas' ? 'Cartas' : 'Hojas_inspeccion'}_${titulo.replace(/[^\wÁÉÍÓÚáéíóúñÑ]+/g, '_')}.html`);
  set(ref(db, `campanas/${clave}/precampana/${tipo}`), firma({ total: casos.length }));
  state.docsModal = null;
  render();
}

// ── PASOS DE LA PRECAMPAÑA ──

export function marcarPaso(clave, paso) {
  set(ref(db, `campanas/${clave}/precampana/${paso}`), firma()).then(() => showToast('Paso marcado'));
}
export function desmarcarPaso(clave, paso) {
  if (!confirm('¿Quitar la marca de este paso?')) return;
  remove(ref(db, `campanas/${clave}/precampana/${paso}`));
}

// ── DATOS DE LAS CARTAS ──

export function abrirConfigCartas() {
  state.docsModal = null;
  state.configCartasForm = configCartas();
  state.showConfigCartas = true;
  render();
}
export function cerrarConfigCartas() { state.showConfigCartas = false; render(); }

// El logo se guarda como imagen dentro de la configuración (se reduce para que no pese)
export function cargarLogo(files) {
  const file = files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, 600 / img.width, 240 / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala); canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      state.configCartasForm.logo = canvas.toDataURL('image/png');
      render();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

export function guardarConfigCartas() {
  const datos = Object.fromEntries(Object.keys(CONFIG_CARTAS_VACIA).map(k => [k, String(state.configCartasForm[k] ?? '').trim()]));
  if (!datos.firmante) return showToast('Falta el nombre de quien firma');
  set(configCartasRef, { ...datos, editadoPor: state.sesionUsuario?.nombre || '', fechaEdicion: hoyLocal() }).then(() => showToast('Datos de las cartas guardados'));
  state.showConfigCartas = false;
  render();
}
