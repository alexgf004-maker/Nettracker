// Reglas puras para identificar y crear expedientes de caso.
// No accede a Firebase para que pueda probarse de forma aislada.

export function normalizeCaseCode(value) {
  return String(value || '')
    .trim()
    .replace(/^\[+|\]+$/g, '')
    .replace(/^#+/, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

// Firebase no permite . # $ [ ] / en las llaves. encodeURIComponent no
// transforma el punto, por eso se reemplaza expresamente.
export function caseIndexKey(value) {
  return encodeURIComponent(normalizeCaseCode(value)).replace(/\./g, '%2E');
}

export function classifyCase(value) {
  const code = normalizeCaseCode(value);
  if (code.startsWith('CR')) return { workflowType: 'campaign', caseType: 'CR' };
  if (code.startsWith('DA')) return { workflowType: 'campaign', caseType: 'DA' };
  if (code.startsWith('DF')) return { workflowType: 'campaign', caseType: 'DF' };
  if (code.startsWith('RE')) return { workflowType: 'complaint', caseType: 'RE' };
  return { workflowType: 'special', caseType: 'SPECIAL' };
}

export function emptyCaseForm() {
  return {
    code: '',
    ownerArea: 'CPT MT',
    source: '',
    campaignId: '',
    contractNumber: '',
    customerName: '',
    address: '',
    meterNumber: '',
    electricalReference: '',
    feeder: '',
    networkVoltageLL: '',
    urbanity: 'U',
    lat: '',
    lng: '',
  };
}

export function buildCaseRecord({ code, ownerArea, place, actor, source = '', campaignId = null, servicePointId = null, lifecycleStatus = 'scheduled', measurementStatus = 'not_measured', now = Date.now() }) {
  const normalizedCode = normalizeCaseCode(code);
  const classification = classifyCase(normalizedCode);
  return {
    code: normalizedCode,
    normalizedCode,
    ...classification,
    ownerArea: ownerArea || 'CPT MT',
    source,
    campaignId,
    servicePointId,
    lifecycleStatus,
    multiplierStatus: 'not_started',
    measurementStatus,
    complianceStatus: 'pending',
    submissionStatus: classification.workflowType === 'special' ? 'not_required' : 'pending',
    placeSnapshot: place || '',
    createdAt: now,
    createdBy: actor || 'Desconocido',
    updatedAt: now,
    updatedBy: actor || 'Desconocido',
  };
}
