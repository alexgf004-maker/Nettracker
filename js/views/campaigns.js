import { CAMPAIGN_STAGES, campaignDueDate, campaignLabel, campaignPeriodFromCode } from '../domain/campaigns.js';
import { normalizeCaseCode } from '../domain/cases.js';
import { state } from '../state.js';
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
  let html = renderInstallSectionSwitch();
  html += `<div class="content"><div class="page-title">Campañas regulatorias</div>
    <div style="font-size:12px;color:var(--text3);margin:-8px 0 14px">Cada mes conserva sus casos CR, DA y DF, etapa y fecha de entrega.</div>`;
  if (!state.campaigns.length) {
    html += '<div class="empty"><div class="empty-icon">🗓</div><div class="empty-text">Todavía no hay campañas mensuales</div><button class="btn btn-primary" style="max-width:240px;margin:12px auto 0" onclick="newCampaign()">+ Crear campaña</button></div>';
  } else {
    html += '<div class="list">';
    state.campaigns.forEach(campaign => {
      const cases = linkedCases(campaign);
      const pending = unlinkedCases(campaign).length;
      html += `<div onclick="openCampaign('${escapeHtml(campaign.id)}')" style="background:var(--white);border:1px solid var(--border);border-left:3px solid var(--primary);border-radius:12px;padding:14px;cursor:pointer;box-shadow:var(--shadow);margin-bottom:9px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div style="font-size:16px;font-weight:800;color:var(--text)">${escapeHtml(campaignLabel(campaign))}</div><span style="font-size:11px;color:var(--primary);font-weight:700">${escapeHtml(campaign.ownerArea)}</span></div>
        <div style="font-size:12px;color:var(--text2);margin-top:7px">${escapeHtml(stageLabel(campaign.stage))} · Entrega: ${fmtDate(campaign.submissionDueAt || campaignDueDate(campaign.year, campaign.month))}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:8px">${cases.length} casos · ${cases.filter(item => item.caseType === 'CR').length} CR · ${cases.filter(item => item.caseType === 'DA').length} DA · ${cases.filter(item => item.caseType === 'DF').length} DF${pending ? ` · ${pending} por asociar` : ''}</div>
      </div>`;
    });
    html += '</div>';
  }
  return html + '</div>';
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
  return `<div class="content">
    <div class="detail-hero"><div style="font-size:10px;color:rgba(255,255,255,.7);font-weight:700;letter-spacing:1px;text-transform:uppercase">Campaña regulatoria · ${escapeHtml(campaign.ownerArea)}</div>
      <div class="detail-serie" style="margin-top:4px">${escapeHtml(campaignLabel(campaign))}</div><div class="detail-modelo">${escapeHtml(stageLabel(campaign.stage))}</div>
      <div style="display:flex;gap:16px;margin-top:14px"><div><div style="font-size:18px;font-weight:800">${counts.CR}</div><div style="font-size:9px;color:rgba(255,255,255,.7)">REGULACIÓN</div></div><div><div style="font-size:18px;font-weight:800">${counts.DA}</div><div style="font-size:9px;color:rgba(255,255,255,.7)">ARMÓNICOS</div></div><div><div style="font-size:18px;font-weight:800">${counts.DF}</div><div style="font-size:9px;color:rgba(255,255,255,.7)">FLICKER</div></div></div>
    </div>
    <div class="detail-grid"><div class="detail-row"><div class="detail-label">Listado recibido</div><div class="detail-value">${fmtDate(campaign.receivedAt)}</div></div><div class="detail-row"><div class="detail-label">Entrega al sistema</div><div class="detail-value">${fmtDate(campaign.submissionDueAt || campaignDueDate(campaign.year, campaign.month))}</div></div></div>
    <div class="form-section"><div class="form-section-title">Etapa de trabajo</div><div class="field"><select oninput="setCampaignStage(this.value)">${CAMPAIGN_STAGES.map(([key, label]) => `<option value="${key}" ${campaign.stage === key ? 'selected' : ''}>${label}</option>`).join('')}</select></div></div>
    ${campaign.stageHistory ? `<div class="section-title">Cambios de etapa</div><div class="list" style="margin-bottom:16px">${Object.values(campaign.stageHistory).sort((a, b) => b.at - a.at).map(event => `<div class="historial-card"><div class="historial-row"><div><div class="historial-lugar">${escapeHtml(stageLabel(event.from))} → ${escapeHtml(stageLabel(event.to))}</div><div class="historial-caso">${escapeHtml(event.by || '')}</div></div><span class="historial-fecha">${new Date(event.at).toLocaleDateString('es-SV')}</span></div></div>`).join('')}</div>` : ''}
    <div style="display:flex;gap:8px;margin-bottom:16px"><button class="btn btn-primary" onclick="newCase('${escapeHtml(campaign.id)}')">+ Agregar caso</button></div>
    <div class="section-title">Casos vinculados (${cases.length})</div>
    ${cases.length ? `<div class="list" style="margin-bottom:16px">${cases.map(item => `<div class="historial-card" onclick="openCase('${escapeHtml(item.id)}')" style="cursor:pointer"><div class="historial-row"><div><div class="historial-lugar">#${escapeHtml(item.code)}</div><div class="historial-caso">${item.caseType === 'CR' ? 'Regulación' : item.caseType === 'DA' ? 'Armónicos' : 'Flicker'} · ${escapeHtml(item.placeSnapshot || 'Sin ubicación')}</div></div><div style="font-size:11px;color:var(--primary);font-weight:700">Ver →</div></div></div>`).join('')}</div>` : '<div class="empty"><div class="empty-text">Aún no hay casos en esta campaña</div></div>'}
    ${pending.length ? `<div class="section-title">Casos anteriores por asociar (${pending.length})</div><div style="font-size:11px;color:var(--text3);margin-bottom:8px">Abre y edita cada expediente para asignarlo a esta campaña.</div><div class="list">${pending.map(item => `<div class="historial-card" onclick="openCase('${escapeHtml(item.id)}')" style="cursor:pointer"><div class="historial-row"><div class="historial-lugar">#${escapeHtml(item.code)}</div><span style="font-size:11px;color:var(--primary)">Asociar →</span></div></div>`).join('')}</div>` : ''}
  </div>`;
}
