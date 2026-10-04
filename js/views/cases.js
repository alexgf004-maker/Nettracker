// Bandeja y formulario de expedientes de campaña, reclamo y requerimiento especial.
import { classifyCase } from '../domain/cases.js';
import { state } from '../state.js';
import { escapeHtml } from '../utils.js';

const TYPE_LABELS = {
  CR: 'Regulación de tensión',
  DA: 'Armónicos',
  DF: 'Flicker',
  RE: 'Reclamo',
  SPECIAL: 'Requerimiento especial',
};

const STATUS_LABELS = {
  preparation: 'En preparación',
  scheduled: 'Programado',
  measuring: 'En medición',
  pending_download: 'Descarga pendiente',
  analysis: 'En análisis',
  pending_submission: 'Pendiente de entrega',
  follow_up: 'Seguimiento FT',
  closed: 'Cerrado',
};

export function renderInstallSectionSwitch() {
  return `<div style="display:flex;gap:6px;padding:10px 16px;background:var(--white);border-bottom:1px solid var(--border)">
    <button onclick="setInstSection('installations')" style="flex:1;padding:9px;border-radius:10px;border:1.5px solid ${state.instSection === 'installations' ? 'var(--primary)' : 'var(--border)'};background:${state.instSection === 'installations' ? 'var(--primary)' : '#fff'};color:${state.instSection === 'installations' ? '#fff' : 'var(--text3)'};font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">⚡ Instalaciones</button>
    <button onclick="setInstSection('cases')" style="flex:1;padding:9px;border-radius:10px;border:1.5px solid ${state.instSection === 'cases' ? 'var(--primary)' : 'var(--border)'};background:${state.instSection === 'cases' ? 'var(--primary)' : '#fff'};color:${state.instSection === 'cases' ? '#fff' : 'var(--text3)'};font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">📁 Casos</button>
  </div>`;
}

export function renderCaseList() {
  const query = state.caseSearch.trim().toLowerCase();
  const filtered = state.cases.filter(caseRecord => {
    if (state.caseFilter !== 'ALL' && caseRecord.workflowType !== state.caseFilter) return false;
    if (state.caseAreaFilter !== 'TODOS' && caseRecord.ownerArea !== state.caseAreaFilter) return false;
    if (!query) return true;
    const point = state.servicePoints.find(item => item.id === caseRecord.servicePointId);
    return [caseRecord.code, caseRecord.placeSnapshot, point?.contractNumber, point?.customerName, point?.meterNumber]
      .some(value => String(value || '').toLowerCase().includes(query));
  });
  const totals = {
    ALL: state.cases.length,
    campaign: state.cases.filter(item => item.workflowType === 'campaign').length,
    complaint: state.cases.filter(item => item.workflowType === 'complaint').length,
    special: state.cases.filter(item => item.workflowType === 'special').length,
  };

  let html = renderInstallSectionSwitch();
  html += `<div class="content">
    <div class="page-title">Expedientes</div>
    <div style="font-size:12px;color:var(--text3);margin:-8px 0 14px">Cada caso conserva sus mediciones, equipos, incidencias y entregas.</div>
    <div class="stats-bar">
      ${[
        ['ALL', 'Total'], ['campaign', 'Campaña'], ['complaint', 'Reclamos'], ['special', 'Especiales'],
      ].map(([key, label]) => `<div class="stat-chip ${state.caseFilter === key ? 'active' : ''}" onclick="setCaseFilter('${key}')"><span class="stat-num">${totals[key]}</span><span class="stat-label">${label}</span></div>`).join('')}
    </div>
    <div style="display:flex;gap:6px;margin-bottom:10px">
      ${['TODOS', 'CPT MT', 'CPT BT'].map(area => `<button onclick="setCaseAreaFilter('${area}')" style="padding:6px 12px;border-radius:20px;border:1.5px solid ${state.caseAreaFilter === area ? 'var(--primary)' : 'var(--border)'};background:${state.caseAreaFilter === area ? 'var(--primary)' : '#fff'};color:${state.caseAreaFilter === area ? '#fff' : 'var(--text3)'};font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer">${area === 'TODOS' ? 'Todas las áreas' : area}</button>`).join('')}
    </div>
    <div class="search-wrap"><span class="search-icon">🔍</span><input id="case-search" class="search-input" placeholder="Código, cliente, NC, medidor..." value="${escapeHtml(state.caseSearch)}" oninput="setCaseSearch(this.value)"></div>`;

  if (!filtered.length) {
    html += `<div class="empty"><div class="empty-icon">📁</div><div class="empty-text">${state.cases.length ? 'No hay casos con estos filtros' : 'Todavía no hay expedientes'}</div>${state.cases.length ? '' : '<button class="btn btn-primary" style="max-width:240px;margin:12px auto 0" onclick="newCase()">+ Crear primer caso</button>'}</div>`;
  } else {
    html += '<div class="list">';
    filtered.forEach(caseRecord => {
      const point = state.servicePoints.find(item => item.id === caseRecord.servicePointId);
      const installations = state.records.filter(record => record.caseId === caseRecord.id).length;
      const incidents = state.equipmentEvents.filter(event => event.caseId === caseRecord.id && event.failure).length;
      const status = STATUS_LABELS[caseRecord.lifecycleStatus] || caseRecord.lifecycleStatus || 'En preparación';
      html += `<div onclick="openCase('${caseRecord.id}')" style="background:var(--white);border:1px solid var(--border);border-left:3px solid ${caseRecord.lifecycleStatus === 'follow_up' ? 'var(--red)' : caseRecord.lifecycleStatus === 'closed' ? 'var(--green)' : 'var(--primary)'};border-radius:12px;padding:12px 14px;cursor:pointer;box-shadow:var(--shadow);margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
          <div><div style="font-family:var(--mono);font-size:14px;font-weight:800;color:var(--text)">#${escapeHtml(caseRecord.code)}</div><div style="font-size:11px;color:var(--text3);margin-top:2px">${TYPE_LABELS[caseRecord.caseType] || 'Caso'} · ${escapeHtml(caseRecord.ownerArea || 'CPT MT')}</div></div>
          <span style="font-size:10px;font-weight:700;color:${caseRecord.lifecycleStatus === 'follow_up' ? 'var(--red)' : 'var(--primary)'};background:var(--primary-light);padding:4px 7px;border-radius:12px;white-space:nowrap">${escapeHtml(status)}</span>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-top:8px">👤 ${escapeHtml(point?.customerName || 'Cliente pendiente')}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">📍 ${escapeHtml(point?.address || caseRecord.placeSnapshot || 'Dirección pendiente')}${point?.contractNumber ? ' · NC ' + escapeHtml(point.contractNumber) : ''}</div>
        <div style="display:flex;gap:14px;margin-top:9px;padding-top:8px;border-top:1px solid var(--border2);font-size:10px;color:var(--text3)"><span>📏 ${installations} medición${installations === 1 ? '' : 'es'}</span><span>⚠️ ${incidents} incidencia${incidents === 1 ? '' : 's'}</span><span style="margin-left:auto">${escapeHtml(caseRecord.source || '')}</span></div>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
}

export function renderCaseForm() {
  const form = state.caseForm;
  const classification = classifyCase(form.code);
  const typeLabel = TYPE_LABELS[classification.caseType];
  return `<div class="content">
    <div class="page-title">${state.editCaseId ? 'Editar expediente' : 'Nuevo expediente'}</div>
    <div class="form-section">
      <div class="form-section-title">Identificación</div>
      <div class="field"><label>Código del caso *</label><input placeholder="CR112026201, DA..., DF..., RE..." value="${escapeHtml(form.code)}" oninput="setCaseField('code',this.value)" onblur="refreshCaseForm()"></div>
      ${form.code ? `<div style="margin:-4px 0 12px;padding:9px 10px;background:var(--primary-light);border-radius:9px;font-size:11px;color:var(--primary);font-weight:700">Detectado: ${escapeHtml(typeLabel)}</div>` : ''}
      <div class="field"><label>Origen</label><input placeholder="DGEHM, reclamo, solicitud interna..." value="${escapeHtml(form.source)}" oninput="setCaseField('source',this.value)"></div>
      <div class="field"><label>Área responsable</label><div style="display:flex;gap:8px">${['CPT MT', 'CPT BT'].map(area => `<div onclick="setCaseField('ownerArea','${area}')" style="flex:1;padding:9px;border-radius:10px;border:2px solid ${form.ownerArea === area ? 'var(--primary)' : 'var(--border)'};background:${form.ownerArea === area ? 'var(--primary-light)' : '#fff'};text-align:center;cursor:pointer;font-size:12px;font-weight:700;color:${form.ownerArea === area ? 'var(--primary)' : 'var(--text3)'}">${area}</div>`).join('')}</div></div>
    </div>
    <div class="form-section">
      <div class="form-section-title">Punto de servicio</div>
      <div class="row"><div class="field"><label>Número de contrato</label><input value="${escapeHtml(form.contractNumber)}" oninput="setCaseField('contractNumber',this.value)"></div><div class="field"><label>Medidor</label><input value="${escapeHtml(form.meterNumber)}" oninput="setCaseField('meterNumber',this.value)"></div></div>
      <div class="field"><label>Cliente / usuario</label><input value="${escapeHtml(form.customerName)}" oninput="setCaseField('customerName',this.value)"></div>
      <div class="field"><label>Dirección</label><textarea oninput="setCaseField('address',this.value)">${escapeHtml(form.address)}</textarea></div>
      <div class="row"><div class="field"><label>CT / DS</label><input value="${escapeHtml(form.electricalReference)}" oninput="setCaseField('electricalReference',this.value)"></div><div class="field"><label>Alimentador</label><input placeholder="AL013" value="${escapeHtml(form.feeder)}" oninput="setCaseField('feeder',this.value)"></div></div>
      <div class="row"><div class="field"><label>Nivel de red L-L</label><input type="number" placeholder="23000" value="${escapeHtml(form.networkVoltageLL)}" oninput="setCaseField('networkVoltageLL',this.value)"></div><div class="field"><label>Urbanidad</label><select oninput="setCaseField('urbanity',this.value)"><option value="U" ${form.urbanity === 'U' ? 'selected' : ''}>Urbano</option><option value="R" ${form.urbanity === 'R' ? 'selected' : ''}>Rural</option></select></div></div>
      <div class="row"><div class="field"><label>Latitud</label><input type="number" step="any" value="${escapeHtml(form.lat)}" oninput="setCaseField('lat',this.value)"></div><div class="field"><label>Longitud</label><input type="number" step="any" value="${escapeHtml(form.lng)}" oninput="setCaseField('lng',this.value)"></div></div>
    </div>
    <button class="btn btn-primary" onclick="saveCase()">${state.editCaseId ? 'Guardar cambios' : 'Crear expediente'}</button>
  </div>`;
}
