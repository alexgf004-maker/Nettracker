// Planilla de instalación y retiro (PDF para imprimir) de reclamos y remediciones de casos FT
import { state } from '../state.js';
import { abrirDoc, showToast } from '../ui.js';
import { claveExpediente, todosFT } from '../domain/expedientes.js';
import { ftDeRemedicion } from '../domain/ft.js';
import { datosPlanilla, htmlPlanillas } from '../domain/planilla.js';
import { hoyLocal, tipoDeTrabajo } from '../domain/trabajo.js';

// De dónde salen los datos del usuario: el expediente del reclamo o el caso FT de campaña que se remide
export function fuentePlanilla(rec) {
  if (!rec) return null;
  const expediente = codigo => state.reclamos?.[rec.reclamo?.id || claveExpediente(codigo)] || null;
  if (rec.reclamo?.id || tipoDeTrabajo(rec.caso) === 'reclamo') {
    const e = expediente(rec.caso);
    return { ...(e || {}), fases: rec.analisisReclamo?.params?.fases };
  }
  // Remedición: el caso FT con el número de medición anterior (aunque ya esté cerrado)
  const lista = todosFT(state.campanas, state.reclamos, state.records, hoyLocal()).map(x => ({ ...x, cerrado: false }));
  const x = ftDeRemedicion(rec.caso, lista);
  if (!x) return null;
  if (x.tipo === 'campana') return { ...x.caso, configuracion: x.caso.mult?.configuracion };
  return expediente(x.codigo) || {};
}
export const planillaDisponible = rec => !!fuentePlanilla(rec);

export function abrirPlanilla(id) {
  const rec = state.records.find(r => r.id === id);
  const fuente = fuentePlanilla(rec);
  if (!fuente) return showToast('La planilla es para reclamos y remediciones de casos FT');
  const d = datosPlanilla(rec, fuente);
  abrirDoc(htmlPlanillas([d], { titulo: `Planilla de instalación y retiro · ${d.codigo}` }), `Planilla_${d.codigo || 'instalacion'}.html`);
}
