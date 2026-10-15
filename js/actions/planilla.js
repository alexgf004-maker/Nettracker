// Planilla de instalación y retiro (PDF para imprimir). Cualquier instalación puede llevarla: si el código está en la
// base (expediente de reclamo, caso de campaña o caso FT que se remide) los datos del usuario se completan solos al
// escribirlo; si no, al marcar "Generar planilla" se llenan a mano. Sin planilla, la instalación queda como siempre.
import { state } from '../state.js';
import { abrirDoc, showToast } from '../ui.js';
import { configCartas } from './documentos.js';
import { claveExpediente, todosFT } from '../domain/expedientes.js';
import { ftDeRemedicion } from '../domain/ft.js';
import { CAMPOS_PLANILLA, datosPlanilla, htmlPlanillas, tipoPlanilla } from '../domain/planilla.js';
import { hoyLocal } from '../domain/trabajo.js';
import { render } from '../views/render.js';

const norm = c => String(c || '').trim().replace(/^[[#]+|\]+$/g, '').replace(/\s+/g, '').toUpperCase();
const desdeExpediente = (e, fases) => ({ origen: 'reclamo', nc: e.nc || '', nombre: e.nombre || '', direccion: e.direccion || '', centro: e.ct || e.corte || '', medidor: e.medidor || '', tipo: tipoPlanilla('', fases) });
const desdeCaso = (c, origen) => ({ origen, nc: c.nc || '', nombre: c.nombre || '', direccion: c.direccion || c.direccionEnte || '', centro: c.ct || '', medidor: c.medidor || '', tipo: tipoPlanilla(c.tipoInstalacion || c.mult?.configuracion) });

// Datos del usuario de un código que ya está en la base (null si no está)
export function buscarDatosCaso(codigo, rec = null) {
  const c = norm(codigo); if (!c) return null;
  const clave = rec?.reclamo?.id || claveExpediente(c);
  if (clave && state.reclamos?.[clave]) return desdeExpediente(state.reclamos[clave], rec?.analisisReclamo?.params?.fases);
  for (const g of Object.values(state.campanas || {})) {
    const caso = Object.values(g?.casos || {}).find(x => norm(x.codigo) === c || norm(x.codigoEnte) === c);
    if (caso) return desdeCaso(caso, 'caso de campaña');
  }
  // Remedición: el caso FT con el número de medición anterior (aunque ya esté cerrado)
  const x = ftDeRemedicion(c, todosFT(state.campanas, state.reclamos, state.records, hoyLocal()).map(f => ({ ...f, cerrado: false })));
  if (x?.tipo === 'campana') return desdeCaso(x.caso, 'caso FT');
  if (x) { const e = state.reclamos?.[claveExpediente(x.codigo)]; if (e) return desdeExpediente(e); }
  return null;
}
export const planillaDisponible = rec => !!rec && (!!rec.conPlanilla || !!buscarDatosCaso(rec.caso, rec));

// Al escribir el código en el formulario: si está en la base se marca la planilla y se completan los datos vacíos
export function autocompletarPlanilla() {
  if (!state.form) return;
  aplicarDatosPlanilla(state.form);
  render();
}
export function aplicarDatosPlanilla(f) {
  const d = buscarDatosCaso(f.caso, f);
  // Si los datos venían de otro código de la base y el nuevo no está, se limpian (la planilla vuelve a ser opcional)
  if (!d && f.planillaOrigen) { f.conPlanilla = false; f.planilla = {}; }
  if (d && f.planillaOrigen && f.planillaCodigo !== f.caso) f.planilla = {};
  f.planillaOrigen = d?.origen || null; f.planillaCodigo = d ? f.caso : null;
  if (d) {
    f.conPlanilla = true;
    f.planilla = { ...(f.planilla || {}) };
    CAMPOS_PLANILLA.forEach(k => { if (!f.planilla[k] && d[k]) f.planilla[k] = d[k]; });
    if (!String(f.lugar || '').trim() && d.nombre) f.lugar = d.nombre;
  }
  return f;
}
export function setPlanillaCampo(k, v) {
  state.form.planilla = { ...(state.form.planilla || {}), [k]: v };
  if (k === 'tipo') render();
}

export function abrirPlanilla(id) {
  const rec = state.records.find(r => r.id === id);
  if (!planillaDisponible(rec)) return showToast('Esta instalación no tiene planilla');
  const d = datosPlanilla(rec, buscarDatosCaso(rec.caso, rec) || {});
  abrirDoc(htmlPlanillas([d], { titulo: `Planilla de instalación y retiro · ${d.codigo}`, logo: configCartas().logo }), `Planilla_${d.codigo || 'instalacion'}.html`);
}
