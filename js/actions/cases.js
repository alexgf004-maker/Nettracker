// Alta y edición de expedientes antes de que exista una instalación física.
import { casesRef, db, get, push, ref, servicePointsRef, update } from '../firebase.js';
import { buildCaseRecord, caseIndexKey, classifyCase, emptyCaseForm, normalizeCaseCode } from '../domain/cases.js';
import { campaignPeriodFromCode } from '../domain/campaigns.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { render } from '../views/render.js';

function actorName() {
  return state.sesionUsuario?.nombre || 'Desconocido';
}

function numericOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function defaultSource(code) {
  const { workflowType } = classifyCase(code);
  if (workflowType === 'campaign') return 'DGEHM';
  if (workflowType === 'complaint') return 'Reclamo de usuario';
  return 'Requerimiento interno';
}

export function openNewCase(campaignId = '') {
  state.caseForm = emptyCaseForm();
  const campaign = state.campaigns.find(item => item.id === campaignId);
  state.caseForm.ownerArea = campaign?.ownerArea || (state.instTab === 'cpt_bt' ? 'CPT BT' : 'CPT MT');
  state.caseForm.campaignId = campaign?.id || '';
  state.editCaseId = null;
  state.view = 'case_form';
  render();
}

export function openEditCase(id) {
  const caseRecord = state.cases.find(item => item.id === id);
  if (!caseRecord) return;
  const point = state.servicePoints.find(item => item.id === caseRecord.servicePointId) || {};
  state.caseForm = {
    ...emptyCaseForm(),
    code: caseRecord.code || '',
    ownerArea: caseRecord.ownerArea || 'CPT MT',
    source: caseRecord.source || '',
    campaignId: caseRecord.campaignId || '',
    contractNumber: point.contractNumber || '',
    customerName: point.customerName || '',
    address: point.address || '',
    meterNumber: point.meterNumber || '',
    electricalReference: point.electricalReference || '',
    feeder: point.feeder || '',
    networkVoltageLL: point.networkVoltageLL ?? '',
    urbanity: point.urbanity || 'U',
    lat: point.coordinates?.lat ?? '',
    lng: point.coordinates?.lng ?? '',
  };
  state.editCaseId = id;
  state.view = 'case_form';
  render();
}

export async function saveCase() {
  const form = state.caseForm;
  const code = normalizeCaseCode(form.code);
  if (!code) return showToast('Ingresa el código del caso');
  if (!form.customerName.trim() && !form.contractNumber.trim()) return showToast('Ingresa el cliente o número de contrato');

  const current = state.editCaseId ? state.cases.find(item => item.id === state.editCaseId) : null;
  if (current && normalizeCaseCode(current.code) !== code && state.records.some(record => record.caseId === current.id)) {
    return showToast('No se puede cambiar el código de un caso con mediciones vinculadas');
  }
  const classification = classifyCase(code);
  const campaign = state.campaigns.find(item => item.id === form.campaignId);
  if (classification.workflowType === 'campaign') {
    const period = campaignPeriodFromCode(code);
    if (!period) return showToast('Revisa el mes y año del código regulatorio');
    if (!campaign) return showToast('Selecciona o crea la campaña mensual');
    if (campaign.year !== period.year || campaign.month !== period.month || campaign.ownerArea !== form.ownerArea) {
      return showToast('El código, mes y área deben coincidir con la campaña');
    }
  }
  const indexKey = caseIndexKey(code);
  const indexed = await get(ref(db, `caseCodeIndex/${indexKey}`));
  if (indexed.exists() && indexed.val() !== current?.id) {
    showToast('Ese código ya tiene un expediente');
    state.selectedCaseId = indexed.val();
    state.editCaseId = null;
    state.view = 'caso_detalle';
    render();
    return;
  }

  const now = Date.now();
  const actor = actorName();
  const caseId = current?.id || push(casesRef).key;
  const servicePointId = current?.servicePointId || push(servicePointsRef).key;
  const source = form.source.trim() || defaultSource(code);
  const place = form.address.trim() || form.customerName.trim();
  const baseRecord = buildCaseRecord({
    code,
    ownerArea: form.ownerArea,
    place,
    actor,
    source,
    campaignId: campaign?.id || null,
    servicePointId,
    lifecycleStatus: 'preparation',
    measurementStatus: 'not_measured',
    now,
  });
  const writes = {};

  const currentData = current ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== 'id')) : null;
  writes[`cases/${caseId}`] = currentData
    ? {
        ...currentData,
        ...classifyCase(code),
        code,
        normalizedCode: code,
        ownerArea: form.ownerArea,
        source,
        campaignId: classification.workflowType === 'campaign' ? campaign.id : null,
        servicePointId,
        placeSnapshot: place,
        updatedAt: now,
        updatedBy: actor,
      }
    : baseRecord;
  writes[`servicePoints/${servicePointId}`] = {
    contractNumber: form.contractNumber.trim(),
    customerName: form.customerName.trim(),
    address: form.address.trim(),
    meterNumber: form.meterNumber.trim(),
    electricalReference: form.electricalReference.trim(),
    feeder: form.feeder.trim(),
    networkVoltageLL: numericOrNull(form.networkVoltageLL),
    urbanity: form.urbanity || 'U',
    coordinates: {
      lat: numericOrNull(form.lat),
      lng: numericOrNull(form.lng),
    },
    active: true,
    updatedAt: now,
    updatedBy: actor,
  };
  writes[`caseCodeIndex/${indexKey}`] = caseId;
  const newCampaignId = classification.workflowType === 'campaign' ? campaign.id : null;
  if (newCampaignId) writes[`caseIdsByCampaign/${newCampaignId}/${caseId}`] = true;
  if (current?.campaignId && current.campaignId !== newCampaignId) {
    writes[`caseIdsByCampaign/${current.campaignId}/${caseId}`] = null;
  }
  if (current && current.normalizedCode !== code) {
    writes[`caseCodeIndex/${caseIndexKey(current.normalizedCode || current.code)}`] = null;
  }

  try {
    await update(ref(db), writes);
  } catch (error) {
    return showToast('No se pudo guardar el expediente: ' + error.message);
  }
  const caseRecord = { id: caseId, ...writes[`cases/${caseId}`] };
  const pointRecord = { id: servicePointId, ...writes[`servicePoints/${servicePointId}`] };
  state.cases = [caseRecord, ...state.cases.filter(item => item.id !== caseId)];
  state.servicePoints = [pointRecord, ...state.servicePoints.filter(item => item.id !== servicePointId)];
  state.selectedCaseId = caseId;
  state.editCaseId = null;
  state.caseForm = emptyCaseForm();
  state.view = 'caso_detalle';
  showToast(current ? 'Expediente actualizado' : 'Expediente creado');
  render();
}
