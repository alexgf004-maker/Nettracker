import { escapeHtml, fmtDate } from '../utils.js';

const EVENT_LABELS = {
  registered: 'Equipo registrado',
  assigned: 'Asignado',
  dispatched: 'Despachado / prestado',
  installed: 'Instalado',
  installation_updated: 'Instalación actualizada',
  installation_deleted: 'Instalación eliminada',
  unassigned: 'Desasignado',
  removed: 'Retirado',
  returned: 'Devuelto',
  downloaded: 'Medición descargada',
  incident_reported: 'Falla reportada',
  sent_to_review: 'Enviado a revisión',
  maintenance_started: 'Mantenimiento registrado',
  maintenance_completed: 'Mantenimiento completado',
  condition_changed: 'Condición actualizada',
};

const EVENT_ICONS = {
  assigned: '', dispatched: '', installed: '', installation_updated: '',
  installation_deleted: '', unassigned: '', removed: '', returned: '✓', downloaded: '',
  incident_reported: '', sent_to_review: '', maintenance_started: '',
  maintenance_completed: '', condition_changed: '', registered: '',
};

export function eventLabel(type) {
  return EVENT_LABELS[type] || type || 'Evento';
}

export function renderTraceTimeline(events, { showCase = true } = {}) {
  if (!events.length) return '<div class="empty"><div class="empty-icon"></div><div class="empty-text">Sin eventos de trazabilidad todavía</div></div>';
  return '<div class="list" style="margin-bottom:16px">' + events.map(event => {
    const failure = event.failure?.description
      ? '<div style="margin-top:6px;padding:7px 9px;background:var(--red-light);color:var(--red);border-radius:8px;font-size:11px"> ' + escapeHtml(event.failure.description) + '</div>'
      : '';
    const caseLink = showCase && event.caseId
      ? '<button onclick="openCase(\'' + event.caseId + '\')" style="border:none;background:none;padding:0;color:var(--primary);font-family:var(--mono);font-size:11px;font-weight:700;cursor:pointer">#' + escapeHtml(event.caseCode || '') + '</button>'
      : event.caseCode ? '<span style="font-family:var(--mono);font-size:11px;color:var(--text3)">#' + escapeHtml(event.caseCode) + '</span>' : '';
    return '<div class="historial-card">'
      + '<div class="historial-row"><div style="min-width:0">'
      + '<div class="historial-lugar">' + (EVENT_ICONS[event.type] || '•') + ' ' + escapeHtml(eventLabel(event.type)) + '</div>'
      + (event.location ? '<div class="historial-caso"> ' + escapeHtml(event.location) + '</div>' : '')
      + (event.notes ? '<div style="font-size:11px;color:var(--text2);margin-top:3px">' + escapeHtml(event.notes) + '</div>' : '')
      + failure
      + (event.actorName ? '<div style="font-size:10px;color:var(--text3);margin-top:4px"> ' + escapeHtml(event.actorName) + '</div>' : '')
      + '</div><div style="text-align:right;flex-shrink:0;margin-left:8px"><div class="historial-fecha">' + fmtDate(event.eventDate) + '</div>' + caseLink + '</div></div></div>';
  }).join('') + '</div>';
}
