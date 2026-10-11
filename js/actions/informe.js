// Borrador del informe de reclamo en Word: junta el expediente, la instalación y el análisis abierto
// (js/domain/informe.js arma las secciones y js/docx.js escribe el archivo).
import { borradorInforme } from '../domain/informe.js';
import { claveExpediente } from '../domain/expedientes.js';
import { hoyLocal } from '../domain/trabajo.js';
import { descargarDocx, generarDocx } from '../docx.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { calculoReclamo } from '../views/analisis-reclamo.js';

export function exportarBorradorInforme() {
  const a = state.analisisReclamo; if (!a) return;
  if (typeof XLSX === 'undefined') return showToast('No se pudo cargar la librería para generar el archivo. Revisa la conexión.');
  const inst = state.records.find(x => x.id === a.id) || {};
  const exp = state.reclamos?.[inst.reclamo?.id || claveExpediente(inst.caso)] || {};
  const c = calculoReclamo(a);
  if (!c.d && !c.arm?.n) return showToast('Sube al menos un TXT');
  const bloques = borradorInforme({ exp, inst, params: a.params, d: c.d, t: c.t, arm: c.arm, hoy: hoyLocal() });
  descargarDocx(generarDocx(bloques), `${exp.codigo || inst.caso || 'Reclamo'}${inst.reclamo?.punto ? '_' + inst.reclamo.punto : ''}_Borrador_informe.docx`);
  showToast('Borrador descargado: completa lo marcado en amarillo');
}
