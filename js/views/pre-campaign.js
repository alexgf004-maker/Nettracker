import { campaignLabel } from '../domain/campaigns.js';
import { campaignPointRows, distinctVisitPoints, estimatedFieldReturn, missingVisitFields, validCoordinates } from '../domain/pre-campaign.js';
import { state } from '../state.js';
import { daysUntil, escapeHtml, fmtDate } from '../utils.js';

function data() {
  const campaign = state.campaigns.find(item => item.id === state.selectedCampaignId);
  if (!campaign) return null;
  const rows = campaignPointRows(campaign.id, state.cases, state.servicePoints);
  return { campaign, visits: distinctVisitPoints(rows), rows };
}

function dateField(key, label, draft) {
  return `<div class="field"><label>${label}</label><input type="date" value="${escapeHtml(draft[key] || '')}" oninput="setPreCampaignField('${key}',this.value)"></div>`;
}

function textField(key, label, draft, placeholder = '') {
  return `<div class="field"><label>${label}</label><input value="${escapeHtml(draft[key] || '')}" placeholder="${escapeHtml(placeholder)}" oninput="setPreCampaignField('${key}',this.value)"></div>`;
}

export function renderPreCampaign() {
  const item = data();
  if (!item) { state.view = 'lista'; return null; }
  const { campaign, visits, rows } = item;
  const draft = state.preCampaignDraft || campaign.preCampaign || {};
  const incomplete = visits.filter(point => missingVisitFields(point).length);
  const withGPS = visits.filter(point => validCoordinates(point.coordinates));
  const returnDate = estimatedFieldReturn(draft.contractorDeliveredAt);
  return `<main class="content work-list-page"><div class="work-page-heading"><div><div class="work-eyebrow">${escapeHtml(campaign.ownerArea)} · ${escapeHtml(campaignLabel(campaign))}</div><h1>Precampaña</h1><p>Prepara la visita y registra la entrega del contratista.</p></div><button class="btn btn-secondary" onclick="openCampaign('${escapeHtml(campaign.id)}')">Volver a la campaña</button></div>
    <div class="work-summary-row"><div><strong>${rows.length}</strong><span>Casos CR / DA / DF</span></div><div><strong>${visits.length}</strong><span>Puntos a visitar</span></div><div><strong>${incomplete.length}</strong><span>Puntos incompletos</span></div></div>
    <div class="form-section"><div class="form-section-title">Datos del listado</div><p class="work-import-help">Un punto con varios códigos aparece una sola vez en las cartas, hojas de campo y mapa. El Excel conserva una fila por caso.</p>
      <div class="work-campaign-actions"><button class="btn btn-primary" onclick="exportPreCampaignList()">Descargar listado Excel</button><button class="btn btn-secondary" onclick="openPreCampaignMap()">Ver mapa (${withGPS.length})</button><button class="btn btn-secondary" onclick="downloadPreCampaignMap()">Entregar mapa KML</button></div>
      ${incomplete.length ? `<div class="work-pre-missing"><strong>Completa los datos antes de imprimir:</strong>${incomplete.map(point => `<button onclick="openCase('${escapeHtml(point.rows[0].caseId)}')"><span>${escapeHtml(point.codes.join(' · '))} · NC ${escapeHtml(point.contractNumber || 'pendiente')}</span><small>Falta: ${escapeHtml(missingVisitFields(point).join(', '))}</small></button>`).join('')}</div>` : '<p class="work-pre-ready">Todos los puntos tienen los datos principales de campo.</p>'}
    </div>
    <div class="form-section"><div class="form-section-title">Hojas de inspección</div><p class="work-import-help">Una hoja por punto de suministro, con todos sus códigos y espacios para TAP, conexión, lecturas y multiplicador. Revisa los datos faltantes antes de imprimir.</p><button class="btn btn-secondary" onclick="printPreCampaignInspections()">Abrir hojas para imprimir</button></div>
    <div class="form-section"><div class="form-section-title">Cartas para revisión y firma</div><p class="work-import-help">Se preparan como borradores sin firma. Revisa el texto y los datos antes de enviarlos a firma.</p>
      <div class="row">${dateField('letterDate', 'Fecha de la carta', draft)}${textField('contractorName', 'Contratista', draft)}</div>
      ${textField('signerName', 'Nombre de quien firma', draft)}${textField('signerTitle', 'Cargo', draft)}${textField('contact', 'Contacto para consultas *', draft, 'Teléfono o correo oficial')}
      <button class="btn btn-secondary" onclick="printPreCampaignLetters()">Abrir cartas borrador</button></div>
    <div class="form-section"><div class="form-section-title">Seguimiento de la precampaña</div>
      <div class="row">${dateField('lettersRequestedAt', 'Firma solicitada', draft)}${dateField('lettersSignedAt', 'Cartas firmadas', draft)}</div>
      <div class="row">${dateField('contractorDeliveredAt', 'Documentos entregados al contratista', draft)}${dateField('fieldReturnedAt', 'Hojas y fotos recibidas', draft)}</div>
      ${returnDate && !draft.fieldReturnedAt ? `<p class="work-pre-estimate">Recepción estimada de campo: ${fmtDate(returnDate)} (unos 10 días después de la entrega). ${daysUntil(returnDate) < 0 ? 'Seguimiento pendiente.' : ''}</p>` : ''}
      ${textField('fieldFolderUrl', 'Enlace a hojas escaneadas y fotos', draft, 'https://...')}
      <div class="field"><label>Notas de coordinación</label><textarea oninput="setPreCampaignField('notes',this.value)">${escapeHtml(draft.notes || '')}</textarea></div>
      <button class="btn btn-primary" onclick="savePreCampaign()">Guardar seguimiento</button>
      ${/^https:\/\//i.test(campaign.preCampaign?.fieldFolderUrl || '') ? `<a class="work-pre-link" href="${escapeHtml(campaign.preCampaign.fieldFolderUrl)}" target="_blank" rel="noopener noreferrer">Abrir carpeta de campo →</a>` : ''}
    </div></main>`;
}

export function renderPreCampaignMap() {
  const item = data();
  if (!item) { state.view = 'lista'; return null; }
  const visible = item.visits.filter(point => validCoordinates(point.coordinates));
  const markers = visible.map(point => ({ lat: Number(point.coordinates.lat), lng: Number(point.coordinates.lng),
    name: point.customerName || 'Cliente pendiente', nc: point.contractNumber || '', codes: point.codes.join(' · ') }));
  // Los datos pasan como JSON y se agregan al popup solo mediante textContent.
  const payload = JSON.stringify(markers).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0}.leaflet-popup-content{font:12px Arial,sans-serif;line-height:1.5}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script><script>const markers=${payload};const map=L.map('map');L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);const bounds=[];for(const p of markers){const box=document.createElement('div');for(const line of [p.codes,p.name,'NC '+p.nc]){const el=document.createElement('div');el.textContent=line;box.appendChild(el);}const link=document.createElement('a');link.href='https://maps.google.com/?q='+p.lat+','+p.lng;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Abrir ruta →';box.appendChild(link);L.marker([p.lat,p.lng]).bindPopup(box).addTo(map);bounds.push([p.lat,p.lng]);}if(bounds.length===1)map.setView(bounds[0],14);else if(bounds.length)map.fitBounds(bounds,{padding:[25,25]});else map.setView([13.7,-89.2],8);<\/script></body></html>`;
  return `<main class="content work-list-page"><div class="work-page-heading"><div><div class="work-eyebrow">${escapeHtml(campaignLabel(item.campaign))} · ${escapeHtml(item.campaign.ownerArea)}</div><h1>Mapa de precampaña</h1><p>${visible.length} puntos con coordenadas · ${item.visits.length - visible.length} sin ubicación.</p></div><button class="btn btn-secondary" onclick="openPreCampaign()">Volver</button></div>
    ${visible.length ? `<iframe title="Puntos de precampaña" class="work-pre-map" src="data:text/html;charset=utf-8,${encodeURIComponent(html)}"></iframe>` : '<div class="work-empty">Completa las coordenadas de los puntos para verlos en el mapa.</div>'}
    <div class="work-pre-map-list">${item.visits.map(point => `<div><strong>${escapeHtml(point.codes.join(' · '))}</strong><span>${escapeHtml(point.customerName || 'Cliente pendiente')}</span>${validCoordinates(point.coordinates) ? `<a href="https://maps.google.com/?q=${Number(point.coordinates.lat)},${Number(point.coordinates.lng)}" target="_blank" rel="noopener noreferrer">Abrir ruta</a>` : '<small>Sin GPS</small>'}</div>`).join('')}</div></main>`;
}
