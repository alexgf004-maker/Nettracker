// Inicio y espacios de trabajo orientados a los procesos de CPT.
import { userArea } from '../config.js';
import { campaignLabel, CAMPAIGN_STAGES } from '../domain/campaigns.js';
import { state } from '../state.js';
import { daysUntil, escapeHtml, fmtDate } from '../utils.js';
import { renderInstalaciones } from './instalaciones.js';

function stageLabel(stage) {
  return CAMPAIGN_STAGES.find(([key]) => key === stage)?.[1] || 'Precampaña';
}

function caseInstallations(caseId) {
  return state.records.filter(record => record.caseId === caseId);
}

export function renderWorkHome() {
  const area = userArea();
  const campaigns = state.campaigns.filter(item => item.ownerArea === area && item.stage !== 'completed');
  const complaints = state.cases.filter(item => item.workflowType === 'complaint' && item.ownerArea === area && item.lifecycleStatus !== 'closed');
  const overdue = state.records.filter(item => !item.retirado && daysUntil(item.fechaRetiro) < 0 && (item.areaBeneficiaria || item.areaInstalacion || 'CPT MT') === area);
  const downloads = state.records.filter(item => item.retirado && item.descargaPendiente && (item.areaBeneficiaria || item.areaInstalacion || 'CPT MT') === area);
  const dueCampaigns = campaigns.filter(item => daysUntil(item.submissionDueAt) <= 10).sort((a, b) => (a.submissionDueAt || '').localeCompare(b.submissionDueAt || ''));
  const name = escapeHtml(state.sesionUsuario?.nombre?.split(' ')[0] || 'equipo');

  return `<main class="content work-home">
    <div class="work-welcome"><div class="work-eyebrow">Mi espacio de trabajo · ${escapeHtml(area)}</div><h1>Hola, ${name}</h1><p>Campañas, reclamos y trabajo de campo en un solo lugar.</p></div>
    <div class="work-paths">
      <button class="work-path campaign" onclick="switchTab('campaigns')"><span class="work-path-icon">🗓</span><span class="work-path-text"><strong>Campañas</strong><small>${campaigns.length} en curso · CR, armónicos y flicker</small></span><span class="work-path-arrow">→</span></button>
      <button class="work-path complaint" onclick="switchTab('complaints')"><span class="work-path-icon">📋</span><span class="work-path-text"><strong>Reclamos</strong><small>${complaints.length} abiertos · medición e informe</small></span><span class="work-path-arrow">→</span></button>
      <button class="work-path operations" onclick="switchTab('operations')"><span class="work-path-icon">⚡</span><span class="work-path-text"><strong>Trabajo de campo</strong><small>Instalaciones, retiros, validaciones y despachos</small></span><span class="work-path-arrow">→</span></button>
    </div>
    <div class="work-section-head"><h2>Atención pendiente</h2><span>${overdue.length + downloads.length + dueCampaigns.length}</span></div>
    ${overdue.length || downloads.length || dueCampaigns.length ? `<div class="work-alert-list">
      ${overdue.length ? `<button onclick="switchTab('instalaciones')" class="work-alert danger"><strong>${overdue.length} retiro${overdue.length === 1 ? '' : 's'} vencido${overdue.length === 1 ? '' : 's'}</strong><small>Revisar equipos en campo</small><span>→</span></button>` : ''}
      ${downloads.length ? `<button onclick="switchTab('instalaciones')" class="work-alert warning"><strong>${downloads.length} descarga${downloads.length === 1 ? '' : 's'} pendiente${downloads.length === 1 ? '' : 's'}</strong><small>Archivos de mediciones retiradas</small><span>→</span></button>` : ''}
      ${dueCampaigns.map(item => `<button onclick="openCampaign('${escapeHtml(item.id)}')" class="work-alert ${daysUntil(item.submissionDueAt) < 0 ? 'danger' : 'warning'}"><strong>${daysUntil(item.submissionDueAt) < 0 ? 'Entrega vencida' : 'Entrega próxima'}: ${escapeHtml(campaignLabel(item))}</strong><small>${fmtDate(item.submissionDueAt)} · ${escapeHtml(stageLabel(item.stage))}</small><span>→</span></button>`).join('')}
    </div>` : '<div class="work-empty">No hay retiros vencidos, descargas pendientes ni entregas de campaña próximas.</div>'}
    <div class="work-section-head"><h2>Campañas en curso</h2><button onclick="switchTab('campaigns')">Ver todas →</button></div>
    ${campaigns.length ? `<div class="work-campaign-grid">${campaigns.slice(0, 4).map(item => {
      const count = state.cases.filter(caseRecord => caseRecord.campaignId === item.id).length;
      return `<button class="work-campaign-card" onclick="openCampaign('${escapeHtml(item.id)}')"><span class="work-eyebrow">${escapeHtml(item.ownerArea)} · ${count} casos</span><strong>${escapeHtml(campaignLabel(item))}</strong><span class="work-stage">${escapeHtml(stageLabel(item.stage))}</span><small>Entrega ${fmtDate(item.submissionDueAt)}</small></button>`;
    }).join('')}</div>` : '<div class="work-empty">Aún no hay campañas abiertas de tu área. Puedes crear la primera desde Campañas.</div>'}
    <div class="work-footer-actions"><button onclick="switchTab('complaints')">Ver reclamos →</button><button onclick="switchTab('inventario')">Ver equipos →</button></div>
  </main>`;
}

export function renderComplaints() {
  if (state.view === 'case_form' || state.view === 'caso_detalle' || state.view === 'form' || state.view === 'detalle') return renderInstalaciones();
  const area = userArea();
  const query = state.complaintSearch.trim().toLowerCase();
  const complaints = state.cases.filter(item => item.workflowType === 'complaint' && item.ownerArea === area &&
    (!query || [item.code, item.placeSnapshot, state.servicePoints.find(point => point.id === item.servicePointId)?.customerName]
      .some(value => String(value || '').toLowerCase().includes(query))));
  return `<main class="content work-list-page">
    <div class="work-page-heading"><div><div class="work-eyebrow">Atención de usuarios · ${escapeHtml(area)}</div><h1>Reclamos</h1><p>Desde la solicitud hasta el informe y la remedición, cuando corresponda.</p></div><button class="work-primary-action" onclick="newComplaint()">+ Registrar reclamo</button></div>
    <div class="work-summary-row"><div><strong>${complaints.length}</strong><span>En tu área</span></div><div><strong>${complaints.filter(item => item.lifecycleStatus !== 'closed').length}</strong><span>Abiertos</span></div><div><strong>${complaints.filter(item => caseInstallations(item.id).some(record => record.retirado)).length}</strong><span>Con retiro</span></div></div>
    <div class="search-wrap"><span class="search-icon">🔍</span><input class="search-input" id="complaint-search" placeholder="Buscar código o usuario..." value="${escapeHtml(state.complaintSearch)}" oninput="setComplaintSearch(this.value)"></div>
    ${complaints.length ? `<div class="work-case-list">${complaints.map(item => {
      const point = state.servicePoints.find(entry => entry.id === item.servicePointId);
      const installations = caseInstallations(item.id);
      const status = installations.some(record => record.retirado) ? 'Retirado · revisar informe' : installations.length ? 'En medición / programado' : 'Pendiente de instalación';
      return `<button class="work-case-row" onclick="openCase('${escapeHtml(item.id)}')"><span class="work-case-main"><strong>#${escapeHtml(item.code)}</strong><span>${escapeHtml(point?.customerName || item.placeSnapshot || 'Cliente pendiente')}</span><small>${escapeHtml(point?.address || '')}</small></span><span class="work-case-side"><em>${escapeHtml(status)}</em><span>Ver expediente →</span></span></button>`;
    }).join('')}</div>` : '<div class="work-empty">No hay reclamos registrados para tu área. Usa “Registrar reclamo” al recibir uno.</div>'}
  </main>`;
}

export function renderOperationsHub() {
  return `<main class="content work-list-page"><div class="work-page-heading"><div><div class="work-eyebrow">Herramientas de campo</div><h1>Operación</h1><p>Registra el trabajo físico y consulta las herramientas existentes.</p></div></div>
    <div class="work-paths"><button class="work-path operations" onclick="switchTab('instalaciones')"><span class="work-path-icon">⚡</span><span class="work-path-text"><strong>Instalaciones y retiros</strong><small>Equipos colocados, descargas y fechas</small></span><span class="work-path-arrow">→</span></button>
      <button class="work-path operations" onclick="switchTab('validaciones')"><span class="work-path-icon">🔌</span><span class="work-path-text"><strong>Validaciones de TAP</strong><small>Proyecciones y resultados de campo</small></span><span class="work-path-arrow">→</span></button>
      <button class="work-path operations" onclick="switchTab('carga')"><span class="work-path-icon">📤</span><span class="work-path-text"><strong>Despachos</strong><small>Cargas masivas y memos</small></span><span class="work-path-arrow">→</span></button>
      <button class="work-path operations" onclick="switchTab('mapa')"><span class="work-path-icon">📍</span><span class="work-path-text"><strong>Mapa</strong><small>Ubicación de instalaciones</small></span><span class="work-path-arrow">→</span></button>
      <button class="work-path operations" onclick="openCaseArchive()"><span class="work-path-icon">📁</span><span class="work-path-text"><strong>Otros expedientes</strong><small>Requerimientos especiales y archivo de casos</small></span><span class="work-path-arrow">→</span></button>
      <button class="work-path operations" onclick="switchTab('operational_dashboard')"><span class="work-path-icon">📊</span><span class="work-path-text"><strong>Reportes y calendario</strong><small>Actividad mensual y estado del inventario</small></span><span class="work-path-arrow">→</span></button>
    </div></main>`;
}
