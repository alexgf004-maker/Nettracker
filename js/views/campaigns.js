import { CAMPAIGN_STAGES, campaignDueDate, campaignLabel, campaignPeriodFromCode } from '../domain/campaigns.js';
import { normalizeCaseCode } from '../domain/cases.js';
import { campaignPointRows, distinctVisitPoints, missingVisitFields } from '../domain/pre-campaign.js';
import { state } from '../state.js';
import { userArea } from '../config.js';
import { escapeHtml, fmtDate } from '../utils.js';
import { renderInstallSectionSwitch } from './cases.js';

function linkedCases(campaign) {
  return state.cases.filter(item => item.campaignId === campaign.id);
}

function unlinkedCases(campaign) {
  return state.cases.filter(item => {
    if (item.workflowType !== 'campaign' || item.campaignId || item.ownerArea !== campaign.ownerArea) return false;
    const period = campaignPeriodFromCode(normalizeCaseCode(item.code));
    return period?.year === campaign.year && period?.month === campaign.month;
  });
}

function stageLabel(stage) {
  return CAMPAIGN_STAGES.find(([key]) => key === stage)?.[1] || 'Precampaña';
}

export function renderCampaignList() {
  let html = state.tab === 'instalaciones' ? renderInstallSectionSwitch() : '';
  const visible = state.campaignAreaView === 'all' ? state.campaigns : state.campaigns.filter(item => item.ownerArea === userArea());
  html += `<main class="content work-list-page"><div class="work-page-heading"><div><div class="work-eyebrow">Control regulatorio</div><h1>Campañas</h1><p>Un espacio de trabajo por mes, con casos y entrega propios.</p></div><button class="work-primary-action" onclick="newCampaign()">+ Nueva campaña</button></div>
    <div class="work-summary-row"><div><strong>${visible.length}</strong><span>Campañas</span></div><div><strong>${visible.filter(item => item.stage !== 'completed').length}</strong><span>En curso</span></div><div><strong>${visible.reduce((total, item) => total + linkedCases(item).length, 0)}</strong><span>Casos vinculados</span></div></div>
    <div class="work-filter-row"><button class="${state.campaignAreaView === 'mine' ? 'active' : ''}" onclick="setCampaignAreaView('mine')">Mi área · ${escapeHtml(userArea())}</button><button class="${state.campaignAreaView === 'all' ? 'active' : ''}" onclick="setCampaignAreaView('all')">Todas</button></div>`;
  if (!visible.length) {
    html += '<div class="empty"><div class="empty-icon"></div><div class="empty-text">Todavía no hay campañas mensuales</div><button class="btn btn-primary" style="max-width:240px;margin:12px auto 0" onclick="newCampaign()">+ Crear campaña</button></div>';
  } else {
    html += '<div class="work-campaign-grid">';
    visible.forEach(campaign => {
      const cases = linkedCases(campaign);
      const pending = unlinkedCases(campaign).length;
      const stageIndex = Math.max(0, CAMPAIGN_STAGES.findIndex(([key]) => key === campaign.stage));
      html += `<button class="work-campaign-card" onclick="openCampaign('${escapeHtml(campaign.id)}')"><span class="work-eyebrow">${escapeHtml(campaign.ownerArea)} · ${cases.length} casos</span><strong>${escapeHtml(campaignLabel(campaign))}</strong><span class="work-stage">${escapeHtml(stageLabel(campaign.stage))}</span><span class="work-progress"><span style="width:${Math.round((stageIndex + 1) / CAMPAIGN_STAGES.length * 100)}%"></span></span><small>${cases.filter(item => item.caseType === 'CR').length} CR · ${cases.filter(item => item.caseType === 'DA').length} DA · ${cases.filter(item => item.caseType === 'DF').length} DF${pending ? ` · ${pending} por asociar` : ''}</small><small>Entrega al sistema: ${fmtDate(campaign.submissionDueAt || campaignDueDate(campaign.year, campaign.month))}</small></button>`;
    });
    html += '</div>';
  }
  return html + '</main>';
}

export function renderCampaignForm() {
  const form = state.campaignForm;
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `<div class="content"><div class="page-title">Nueva campaña mensual</div>
    <div class="form-section"><div class="form-section-title">Período</div>
      <div class="row"><div class="field"><label>Mes</label><select oninput="setCampaignField('month',Number(this.value))">${months.map((name, i) => `<option value="${i + 1}" ${Number(form.month) === i + 1 ? 'selected' : ''}>${name}</option>`).join('')}</select></div>
      <div class="field"><label>Año</label><input type="number" min="2000" max="2100" value="${escapeHtml(form.year)}" oninput="setCampaignField('year',Number(this.value))"></div></div>
      <div class="field"><label>Área</label><select oninput="setCampaignField('ownerArea',this.value)"><option ${form.ownerArea === 'CPT MT' ? 'selected' : ''}>CPT MT</option><option ${form.ownerArea === 'CPT BT' ? 'selected' : ''}>CPT BT</option></select></div>
      <div class="field"><label>Fecha de recepción del listado (opcional)</label><input type="date" value="${escapeHtml(form.receivedAt)}" oninput="setCampaignField('receivedAt',this.value)"></div>
    </div><button class="btn btn-primary" onclick="saveCampaign()">Crear campaña</button>
  </div>`;
}

export function renderCampaignDetail() {
  const campaign = state.campaigns.find(item => item.id === state.selectedCampaignId);
  if (!campaign) { state.view = 'lista'; return null; }
  const cases = linkedCases(campaign);
  const pending = unlinkedCases(campaign);
  const counts = {
    CR: cases.filter(item => item.caseType === 'CR').length,
    DA: cases.filter(item => item.caseType === 'DA').length,
    DF: cases.filter(item => item.caseType === 'DF').length,
  };
  const stageIndex = Math.max(0, CAMPAIGN_STAGES.findIndex(([key]) => key === campaign.stage));
  const installationCount = cases.reduce((total, item) => total + state.records.filter(record => record.caseId === item.id).length, 0);
  const removedCount = cases.reduce((total, item) => total + state.records.filter(record => record.caseId === item.id && record.retirado).length, 0);
  const visits = distinctVisitPoints(campaignPointRows(campaign.id, state.cases, state.servicePoints));
  const missingCount = visits.filter(point => missingVisitFields(point).length).length;
  const stageDescriptions = ['Listado, cartas e inspección', 'Configuración y validaciones', 'Asignación de fechas y equipos', 'Instalación y retiro', 'Descarga y resultados', 'Cuadro resumen y carga', 'Entrega registrada'];
  return `<div class="content campaign-workspace">
    <div class="detail-hero campaign-overview"><div class="work-eyebrow">Campaña regulatoria · ${escapeHtml(campaign.ownerArea)}</div>
      <div class="detail-serie campaign-title" style="margin-top:4px">${escapeHtml(campaignLabel(campaign))}</div><div class="detail-modelo">${escapeHtml(stageLabel(campaign.stage))}</div>
      <div style="display:flex;gap:16px;margin-top:14px"><div><div style="font-size:18px;font-weight:800">${counts.CR}</div><div style="font-size:9px;color:var(--text2)">REGULACIÓN</div></div><div><div style="font-size:18px;font-weight:800">${counts.DA}</div><div style="font-size:9px;color:var(--text2)">ARMÓNICOS</div></div><div><div style="font-size:18px;font-weight:800">${counts.DF}</div><div style="font-size:9px;color:var(--text2)">FLICKER</div></div></div>
    </div>
    <div class="detail-grid"><div class="detail-row"><div class="detail-label">Listado recibido</div><div class="detail-value">${fmtDate(campaign.receivedAt)}</div></div><div class="detail-row"><div class="detail-label">Entrega al sistema</div><div class="detail-value">${fmtDate(campaign.submissionDueAt || campaignDueDate(campaign.year, campaign.month))}</div></div></div>
    <div class="work-summary-row"><div><strong>${cases.length}</strong><span>Casos registrados</span></div><div><strong>${installationCount}</strong><span>Instalaciones</span></div><div><strong>${removedCount}</strong><span>Retiros</span></div></div>
    <div class="work-campaign-actions"><button class="btn btn-primary" onclick="openPreCampaign()">Preparar precampaña →</button><button class="btn btn-secondary" onclick="openCampaignImport()">Importar listado Excel</button><button class="btn btn-secondary" onclick="newCase('${escapeHtml(campaign.id)}')">+ Agregar caso</button></div>
    <button class="work-pre-entry" onclick="openPreCampaign()"><span><strong>Precampaña · ${visits.length} puntos</strong><small>${missingCount ? `${missingCount} con datos faltantes` : 'Datos principales completos'} · ${campaign.preCampaign?.fieldReturnedAt ? 'Hojas y fotos recibidas' : campaign.preCampaign?.contractorDeliveredAt ? 'Esperando trabajo de campo' : campaign.preCampaign?.lettersSignedAt ? 'Cartas firmadas' : 'Documentos por preparar'}</small></span><span>Preparar →</span></button>
    <details class="campaign-progress"><summary>Estado de la campaña <span>${escapeHtml(stageLabel(campaign.stage))}</span></summary><div class="campaign-progress-body"><div class="work-steps">${CAMPAIGN_STAGES.map(([key, label], index) => `<div class="work-step ${index === stageIndex ? 'current' : index < stageIndex ? 'passed' : ''}"><span>${index + 1}</span><div><strong>${escapeHtml(label)}</strong><small>${stageDescriptions[index]}</small></div></div>`).join('')}</div><div class="field" style="margin-top:15px"><label>Etapa actual</label><select oninput="setCampaignStage(this.value)">${CAMPAIGN_STAGES.map(([key, label]) => `<option value="${key}" ${campaign.stage === key ? 'selected' : ''}>${label}</option>`).join('')}</select></div></div></details>
    ${campaign.stageHistory ? `<div class="section-title">Cambios de etapa</div><div class="list" style="margin-bottom:16px">${Object.values(campaign.stageHistory).sort((a, b) => b.at - a.at).map(event => `<div class="historial-card"><div class="historial-row"><div><div class="historial-lugar">${escapeHtml(stageLabel(event.from))} → ${escapeHtml(stageLabel(event.to))}</div><div class="historial-caso">${escapeHtml(event.by || '')}</div></div><span class="historial-fecha">${new Date(event.at).toLocaleDateString('es-SV')}</span></div></div>`).join('')}</div>` : ''}

    <div class="section-title">Casos vinculados (${cases.length})</div>
    ${cases.length ? `<div class="list campaign-case-list" style="margin-bottom:16px">${cases.map(item => `<div class="historial-card" onclick="openCase('${escapeHtml(item.id)}')" style="cursor:pointer"><div class="historial-row"><div><div class="historial-lugar">#${escapeHtml(item.code)}</div><div class="historial-caso">${item.caseType === 'CR' ? 'Regulación' : item.caseType === 'DA' ? 'Armónicos' : 'Flicker'} · ${escapeHtml(item.placeSnapshot || 'Sin ubicación')}</div></div><div style="font-size:11px;color:var(--primary);font-weight:700">Ver →</div></div></div>`).join('')}</div>` : '<div class="empty"><div class="empty-text">Aún no hay casos en esta campaña</div></div>'}
    ${pending.length ? `<div class="section-title">Casos anteriores por asociar (${pending.length})</div><div style="font-size:11px;color:var(--text3);margin-bottom:8px">Abre y edita cada expediente para asignarlo a esta campaña.</div><div class="list">${pending.map(item => `<div class="historial-card" onclick="openCase('${escapeHtml(item.id)}')" style="cursor:pointer"><div class="historial-row"><div class="historial-lugar">#${escapeHtml(item.code)}</div><span style="font-size:11px;color:var(--primary)">Asociar →</span></div></div>`).join('')}</div>` : ''}
    <div class="form-section" style="margin-top:20px"><div class="form-section-title">Eliminar campaña</div><p class="work-import-help">${cases.length ? 'Esta campaña tiene casos vinculados. Se conservan sus expedientes y no se permite borrarla.' : 'Puedes eliminar esta campaña vacía. Se borrarán sus fechas y seguimiento de precampaña.'}</p><button class="btn btn-danger" onclick="deleteCampaign()" ${cases.length ? 'disabled' : ''}>Eliminar campaña</button></div>
  </div>`;
}

export function renderCampaignImport() {
  const campaign = state.campaigns.find(item => item.id === state.selectedCampaignId);
  if (!campaign) { state.view = 'lista'; return null; }
  const preview = state.campaignImport || { rows: [], errors: [], files: [], busy: false };
  const selected = preview.rows.filter(row => row.selected && !row.issue);
  const rejected = preview.rows.filter(row => row.issue);
  const existing = selected.filter(row => row.existingId).length;
  return `<main class="content work-list-page">
    <div class="work-page-heading"><div><div class="work-eyebrow">${escapeHtml(campaign.ownerArea)} · ${escapeHtml(campaignLabel(campaign))}</div><h1>Importar listado</h1><p>Revisa los casos antes de agregarlos a esta campaña.</p></div><button class="btn" onclick="openCampaign('${escapeHtml(campaign.id)}')">Volver a la campaña</button></div>
    <div class="form-section"><div class="form-section-title">Archivos de origen</div>
      <p class="work-import-help">Selecciona el listado preparado o, juntos, los tres listados oficiales (regulación, armónicos y flicker). Puedes elegir varios Excel a la vez. El archivo permanece en este dispositivo; solo se guardan los datos de los casos que confirmes.</p>
      <label class="work-import-picker"> Elegir archivos Excel<input type="file" accept=".xlsx,.xls" multiple onchange="readCampaignFiles(event)" hidden></label>
      ${preview.files.length ? `<p class="work-import-help">Leídos: ${preview.files.map(escapeHtml).join(' · ')}</p>` : ''}
    </div>
    ${preview.rows.length || preview.errors.length ? `<div class="work-summary-row"><div><strong>${selected.length}</strong><span>Seleccionados</span></div><div><strong>${existing}</strong><span>Ya registrados</span></div><div><strong>${rejected.length + preview.errors.length}</strong><span>Por revisar</span></div></div>` : ''}
    ${preview.rows.length ? `<div class="form-section"><div class="form-section-title">Vista previa (${preview.rows.length})</div>
      <p class="work-import-help">Las perturbaciones se incluyen cuando su contrato figura en un CR del mismo mes. Los casos existentes se asocian sin sobrescribir sus datos.</p>
      <div class="work-import-list">${preview.rows.map((row, index) => `<label class="work-import-row ${row.issue ? 'needs-review' : ''}">
        <input type="checkbox" ${row.selected && !row.issue ? 'checked' : ''} ${row.issue || preview.busy ? 'disabled' : ''} onchange="toggleCampaignImportRow(${index},this.checked)">
        <span><strong>${escapeHtml(row.code)}</strong><small>NC ${escapeHtml(row.contractNumber)} · ${escapeHtml(row.customerName || 'Nombre pendiente')}</small>${row.issue ? `<em>${escapeHtml(row.issue)}</em>` : row.existingId ? '<em>Expediente existente: asociar o conservar</em>' : ''}</span>
      </label>`).join('')}</div></div>` : ''}
    ${preview.errors.length ? `<div class="form-section"><div class="form-section-title">Filas y archivos por revisar (${preview.errors.length})</div><ul class="work-import-errors">${preview.errors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul></div>` : ''}
    ${preview.rows.length ? `<button class="btn btn-primary" ${preview.busy || !selected.length ? 'disabled' : ''} onclick="saveCampaignImport()">${preview.busy ? 'Guardando…' : `Importar ${selected.length} casos`}</button>` : ''}
  </main>`;
}
