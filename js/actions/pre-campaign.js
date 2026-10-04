import { campaignLabel } from '../domain/campaigns.js';
import { campaignMapKml, campaignPointRows, distinctVisitPoints, missingVisitFields, validCoordinates } from '../domain/pre-campaign.js';
import { db, ref, update } from '../firebase.js';
import { state } from '../state.js';
import { abrirDoc, showToast } from '../ui.js';
import { escapeHtml, fmtDate } from '../utils.js';
import { render } from '../views/render.js';

function context() {
  const campaign = state.campaigns.find(item => item.id === state.selectedCampaignId);
  if (!campaign) return null;
  const rows = campaignPointRows(campaign.id, state.cases, state.servicePoints);
  return { campaign, rows, visits: distinctVisitPoints(rows) };
}

export function openPreCampaign() {
  const campaign = context()?.campaign;
  if (!campaign) return;
  if (state.view !== 'campaign_map' || !state.preCampaignDraft) state.preCampaignDraft = {
    letterDate: '', contractorName: 'Campos y Servicios S.A. de C.V.',
    signerName: '', signerTitle: '',
    contact: '', lettersRequestedAt: '', lettersSignedAt: '', contractorDeliveredAt: '',
    fieldReturnedAt: '', fieldFolderUrl: '', notes: '',
    ...(campaign.preCampaign || {}),
  };
  state.view = 'campaign_preparation';
  render();
}

export function setPreCampaignField(key, value) {
  if (!state.preCampaignDraft || !Object.hasOwn(state.preCampaignDraft, key)) return;
  state.preCampaignDraft[key] = value;
}

export async function savePreCampaign() {
  const campaign = context()?.campaign, draft = state.preCampaignDraft;
  if (!campaign || !draft) return;
  if (draft.fieldFolderUrl && !/^https:\/\//i.test(draft.fieldFolderUrl)) return showToast('El enlace de campo debe comenzar con https://');
  if (draft.lettersRequestedAt && draft.lettersSignedAt && draft.lettersSignedAt < draft.lettersRequestedAt) return showToast('La firma no puede ser anterior a la solicitud');
  if (draft.contractorDeliveredAt && draft.fieldReturnedAt && draft.fieldReturnedAt < draft.contractorDeliveredAt) return showToast('La recepción de campo no puede ser anterior a la entrega');
  const now = Date.now();
  const data = { ...draft, updatedAt: now, updatedBy: state.sesionUsuario?.nombre || 'Desconocido' };
  try {
    await update(ref(db), { [`campaigns/${campaign.id}/preCampaign`]: data, [`campaigns/${campaign.id}/updatedAt`]: now });
    campaign.preCampaign = data;
    showToast('Seguimiento de precampaña guardado');
    render();
  } catch (error) { showToast('No se pudo guardar: ' + error.message); }
}

export function exportPreCampaignList() {
  const data = context();
  if (!data?.rows.length) return showToast('Primero agrega casos a la campaña');
  if (typeof XLSX === 'undefined') return showToast('No se pudo cargar el lector de Excel');
  const head = ['Código DGEHM', 'Tipo', 'NC', 'Nombre', 'Dirección', 'CT/DS', 'Medidor', 'Alimentador', 'Nivel red L-L (V)', 'Urbanidad', 'Latitud', 'Longitud', 'Datos faltantes'];
  const body = data.rows.map(({ code, caseType, point }) => [
    code, caseType, point.contractNumber || '', point.customerName || '', point.address || '',
    point.electricalReference || '', point.meterNumber || '', point.feeder || '',
    point.networkVoltageLL ?? '', point.urbanity || '',
    point.coordinates?.lat ?? '', point.coordinates?.lng ?? '', missingVisitFields(point).join(', '),
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([head, ...body]);
  sheet['!cols'] = [23, 10, 17, 36, 58, 17, 22, 20, 20, 13, 17, 17, 35].map(wch => ({ wch }));
  sheet['!autofilter'] = { ref: `A1:M${body.length + 1}` };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Listado CPT');
  XLSX.writeFile(book, `Listado_${data.campaign.id}.xlsx`);
  showToast('Listado descargado');
}

export function downloadPreCampaignMap() {
  const data = context();
  if (!data?.visits.some(point => validCoordinates(point.coordinates))) return showToast('No hay puntos con coordenadas');
  const content = campaignMapKml(data.visits, `${campaignLabel(data.campaign)} · ${data.campaign.ownerArea}`);
  const url = URL.createObjectURL(new Blob([content], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `Mapa_precampana_${data.campaign.id}.kml`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast('Mapa KML descargado');
}

const paperCss = `@page{size:letter;margin:13mm 15mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172339;margin:0}.tools{position:sticky;top:0;background:#e8f0fb;padding:12px;text-align:center;z-index:2}.tools button{padding:10px 18px;border:0;border-radius:8px;background:#0057b8;color:white;font-weight:bold}.sheet{page-break-after:always;break-after:page;min-height:230mm;padding:10mm 2mm}.sheet:last-child{page-break-after:auto;break-after:auto}h1{font-size:18px;color:#0057b8;margin:0 0 14px}.meta{font-size:11px;color:#536176;margin-bottom:12px}.id{border:1px solid #cbd5e1;border-left:4px solid #0057b8;padding:12px;margin:12px 0 18px;font-size:12px}.id p{margin:3px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.panel{border:1px solid #cbd5e1;padding:10px;font-size:11px;min-height:110px}.panel h2{font-size:11px;margin:-10px -10px 9px;padding:7px 10px;background:#eff4fa;color:#0057b8}.line{border-bottom:1px solid #8894a4;display:inline-block;min-width:95px;height:16px}.panel p{margin:6px 0}.note{color:#536176;font-size:10px}.signature{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:30px}.signature div{border-top:1px solid #8392a5;padding-top:6px;font-size:11px}.letter p{font-size:12px;line-height:1.55;margin:0 0 15px}.letter .date{text-align:right;margin-bottom:35px}.letter .salutation{margin-bottom:26px}.letter .address{font-weight:bold;padding:10px 0}.letter .signature{margin-top:65px}@media print{.tools{display:none}.sheet{padding:0;min-height:0}}`;

function documentHtml(title, contents) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${paperCss}</style></head><body><div class="tools"><button onclick="window.print()">Imprimir / guardar PDF</button></div>${contents}</body></html>`;
}

function identification(point) {
  return `<div class="id"><p><strong>Casos DGEHM:</strong> ${point.codes.map(escapeHtml).join(' · ')}</p><p><strong>NC:</strong> ${escapeHtml(point.contractNumber || 'Pendiente')} &nbsp; <strong>CT/DS:</strong> ${escapeHtml(point.electricalReference || 'Pendiente')}</p><p><strong>Cliente:</strong> ${escapeHtml(point.customerName || 'Pendiente')}</p><p><strong>Dirección:</strong> ${escapeHtml(point.address || 'Pendiente')}</p><p><strong>Medidor:</strong> ${escapeHtml(point.meterNumber || 'Pendiente')} &nbsp; <strong>Alimentador:</strong> ${escapeHtml(point.feeder || 'Pendiente')}</p><p><strong>Ubicación:</strong> ${escapeHtml(point.coordinates?.lat ?? '—')}, ${escapeHtml(point.coordinates?.lng ?? '—')}</p></div>`;
}

export function printPreCampaignInspections() {
  const data = context();
  if (!data?.visits.length) return showToast('Primero agrega casos a la campaña');
  const content = data.visits.map((point, index) => `<section class="sheet"><h1>Inspección previa · ${escapeHtml(campaignLabel(data.campaign))}</h1><div class="meta">Punto ${index + 1} de ${data.visits.length} · ${escapeHtml(data.campaign.ownerArea)} · Documento para completar en campo</div>${identification(point)}
    <div class="grid"><div class="panel"><h2>Tipo de medición y conexión</h2><p>□ Primaria &nbsp; □ Secundaria &nbsp; □ Test block sí &nbsp; □ No</p><p>□ Monofásica &nbsp; □ Bifásica &nbsp; □ Trifásica</p><p>□ Estrella &nbsp; □ Delta &nbsp; □ Delta abierta &nbsp; □ Otra</p><p>Detalle de conexión: <span class="line"></span></p><p>Tensión secundaria: □ 120 □ 208 □ 240 □ 480 □ Otro <span class="line"></span></p></div>
    <div class="panel"><h2>Transformador y medidor</h2><p>TAP visible: □ Sí □ No &nbsp; Posición: <span class="line"></span></p><p>Placa primario / secundario: <span class="line"></span></p><p>Relación medidor X: <span class="line"></span></p><p>TI / test block: <span class="line"></span></p><p>Medición primaria: □ Sí □ No</p></div>
    <div class="panel"><h2>Lecturas de campo</h2><p>Vab: <span class="line"></span> Vbc: <span class="line"></span></p><p>Vac: <span class="line"></span> Van: <span class="line"></span></p><p>Vbn: <span class="line"></span> Vcn: <span class="line"></span></p><p>Foto de placa: □ &nbsp; Foto TAP: □ &nbsp; Foto conexión: □</p></div>
    <div class="panel"><h2>Validación / multiplicador</h2><p>□ Se define con placa y lectura &nbsp; □ Pendiente de validar</p><p>□ Histórico &nbsp; □ Cliente de baja &nbsp; □ Acceso denegado</p><p>Multiplicador propuesto: <span class="line"></span></p><p>Usuario de referencia / observación: <span class="line"></span></p></div></div>
    <div class="panel" style="margin-top:12px;min-height:70px"><h2>Observaciones</h2></div><div class="signature"><div>Técnico / fecha</div><div>Carta entregada a / fecha</div></div></section>`).join('');
  abrirDoc(documentHtml(`Inspecciones ${data.campaign.id}`, content), `Inspecciones_${data.campaign.id}.html`);
}

export function printPreCampaignLetters() {
  const data = context(), draft = state.preCampaignDraft || data?.campaign.preCampaign || {};
  if (!data?.visits.length) return showToast('Primero agrega casos a la campaña');
  if (!draft.letterDate || !draft.contractorName || !draft.signerName || !draft.contact) return showToast('Completa fecha, contratista, firma y contacto antes de preparar cartas');
  if (data.visits.some(point => !point.contractNumber || !point.customerName || !point.address)) return showToast('Completa NC, nombre y dirección de todos los puntos antes de preparar cartas');
  const content = data.visits.map(point => `<section class="sheet letter"><div class="meta">${escapeHtml(data.campaign.ownerArea)} · BORRADOR PARA REVISIÓN Y FIRMA</div><p class="date">Santa Tecla, ${escapeHtml(fmtDate(draft.letterDate))}</p><p class="salutation"><strong>Estimado cliente:</strong><br>${escapeHtml(point.customerName || 'Nombre pendiente')}</p><div class="id"><strong>Códigos DGEHM:</strong> ${point.codes.map(escapeHtml).join(' · ')}<br><strong>NC:</strong> ${escapeHtml(point.contractNumber || 'Pendiente')}</div>
    <p>La Dirección General de Energía, Hidrocarburos y Minas incluyó su suministro en la campaña de control de calidad del producto técnico de ${escapeHtml(campaignLabel(data.campaign))}, en el marco del Acuerdo 38-E-2015.</p>
    <p>Para desarrollar las mediciones de regulación de tensión${point.rows.some(row => row.caseType !== 'CR') ? ' y perturbaciones' : ''}, solicitamos su apoyo para permitir una visita previa de inspección y, posteriormente, la instalación de un analizador de redes en el punto de suministro.</p>
    <p>El suministro identificado con el NC indicado se encuentra en:</p><p class="address">${escapeHtml(point.address || 'Dirección pendiente')}</p>
    <p>El personal de <strong>${escapeHtml(draft.contractorName)}</strong> realizará la visita previa para verificar la configuración y coordinar la medición. Para cualquier consulta puede comunicarse mediante ${escapeHtml(draft.contact)}.</p>
    <p>Agradecemos su colaboración.</p><div class="signature"><div><strong>${escapeHtml(draft.signerName)}</strong><br>${escapeHtml(draft.signerTitle || 'Coordinación de Servicios Técnicos y Comerciales')}<br>DELSUR Innova<br><span class="note">Espacio para firma autorizada</span></div><div>Recibido por el cliente</div></div></section>`).join('');
  abrirDoc(documentHtml(`Cartas borrador ${data.campaign.id}`, content), `Cartas_borrador_${data.campaign.id}.html`);
}
