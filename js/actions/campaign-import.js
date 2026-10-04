import { parseCampaignSheets, reviewCampaignRows } from '../domain/campaign-import.js';
import { buildCaseRecord, caseIndexKey } from '../domain/cases.js';
import { casesRef, db, get, push, ref, servicePointsRef, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { render } from '../views/render.js';

export function openCampaignImport() {
  state.campaignImport = { rows: [], errors: [], files: [], busy: false };
  state.view = 'campaign_import';
  render();
}

export async function readCampaignFiles(event) {
  const input = event.target;
  const files = [...input.files];
  const campaign = state.campaigns.find(item => item.id === state.selectedCampaignId);
  if (!campaign || !files.length) return;
  if (typeof XLSX === 'undefined') return showToast('No se pudo cargar el lector de Excel');
  try {
    const sources = await Promise.all(files.map(async file => {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      return {
        name: file.name,
        sheets: wb.SheetNames.filter(name => ['LISTADO', 'DETASORTEOCPT'].includes(name.toUpperCase()))
          .map(name => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true }) })),
      };
    }));
    const parsed = parseCampaignSheets(sources, campaign);
    state.campaignImport = {
      files: files.map(file => file.name), errors: parsed.errors,
      rows: reviewCampaignRows(parsed.rows, campaign, state.cases, state.servicePoints), busy: false,
    };
    if (!parsed.rows.length) showToast('No se encontraron casos para esta campaña');
    render();
  } catch (error) {
    showToast('No se pudo leer el Excel: ' + error.message);
  }
}

export function toggleCampaignImportRow(index, selected) {
  const row = state.campaignImport.rows[index];
  if (row && !row.issue) row.selected = selected;
  render();
}

export async function saveCampaignImport() {
  const campaign = state.campaigns.find(item => item.id === state.selectedCampaignId);
  const preview = state.campaignImport;
  if (!campaign || !preview || preview.busy) return;
  const chosen = preview.rows.filter(row => row.selected && !row.issue);
  if (!chosen.length) return showToast('No hay casos seleccionados');
  preview.busy = true;
  render();
  try {
    // Relee los índices y expedientes antes de guardar; la vista previa puede llevar abierta un rato.
    const [indexSnap, casesSnap, pointsSnap] = await Promise.all([
      get(ref(db, 'caseCodeIndex')), get(casesRef), get(servicePointsRef),
    ]);
    const indices = indexSnap.val() || {};
    const liveCases = casesSnap.val() || {};
    const livePoints = pointsSnap.val() || {};
    const checked = reviewCampaignRows(chosen, campaign,
      Object.entries(liveCases).map(([id, item]) => ({ id, ...item })),
      Object.entries(livePoints).map(([id, item]) => ({ id, ...item })));
    const invalid = checked.filter(row => row.issue);
    if (invalid.length) {
      preview.rows = reviewCampaignRows(preview.rows, campaign,
        Object.entries(liveCases).map(([id, item]) => ({ id, ...item })),
        Object.entries(livePoints).map(([id, item]) => ({ id, ...item })));
      for (const row of invalid) {
        const item = preview.rows.find(item => item.code === row.code);
        if (item) { item.issue = row.issue; item.selected = false; }
      }
      showToast('Algunos casos cambiaron. Revisa la vista previa antes de guardar.');
      return;
    }
    const writes = {};
    const pointIds = new Map(Object.entries(livePoints).filter(([, point]) => point.contractNumber).map(([id, point]) => [String(point.contractNumber), id]));
    const now = Date.now();
    const actor = state.sesionUsuario?.nombre || 'Desconocido';
    let created = 0, linked = 0, unchanged = 0;
    for (const row of checked) {
      const key = caseIndexKey(row.code);
      const indexedId = indices[key];
      const current = indexedId ? liveCases[indexedId] : null;
      const matchingEntry = Object.entries(liveCases).find(([, item]) => item.normalizedCode === row.code || item.code === row.code);
      if (indexedId && !current || matchingEntry && indexedId && matchingEntry[0] !== indexedId) throw new Error(`Índice inconsistente para ${row.code}`);
      if (!indexedId && matchingEntry) throw new Error(`El caso ${row.code} ya existe sin índice; requiere revisión manual`);
      if (current && (current.ownerArea !== campaign.ownerArea || (current.campaignId && current.campaignId !== campaign.id))) throw new Error(`Conflicto de campaña para ${row.code}`);
      if (current) {
        if (current.campaignId === campaign.id) { unchanged++; continue; }
        writes[`cases/${indexedId}/campaignId`] = campaign.id;
        writes[`cases/${indexedId}/updatedAt`] = now;
        writes[`cases/${indexedId}/updatedBy`] = actor;
        writes[`caseIdsByCampaign/${campaign.id}/${indexedId}`] = true;
        linked++;
        continue;
      }
      let pointId = pointIds.get(row.contractNumber);
      if (!pointId) {
        pointId = push(servicePointsRef).key;
        pointIds.set(row.contractNumber, pointId);
        writes[`servicePoints/${pointId}`] = {
          contractNumber: row.contractNumber, customerName: row.customerName, address: row.address,
          electricalReference: row.electricalReference, meterNumber: row.meterNumber,
          feeder: row.feeder, networkVoltageLL: row.networkVoltageLL,
          urbanity: ['U', 'R'].includes(row.urbanity) ? row.urbanity : '',
          coordinates: { lat: row.lat, lng: row.lng }, active: true,
          updatedAt: now, updatedBy: actor,
        };
      }
      const id = push(casesRef).key;
      writes[`cases/${id}`] = {
        ...buildCaseRecord({ code: row.code, ownerArea: campaign.ownerArea,
          place: row.address || row.customerName, actor, source: 'DGEHM', campaignId: campaign.id,
          servicePointId: pointId, lifecycleStatus: 'preparation', measurementStatus: 'not_measured', now }),
        importedFrom: row.source,
      };
      writes[`caseCodeIndex/${key}`] = id;
      writes[`caseIdsByCampaign/${campaign.id}/${id}`] = true;
      created++;
    }
    if (Object.keys(writes).length) await update(ref(db), writes);
    state.campaignImport = null;
    state.view = 'campaign_detail';
    showToast(`${created} casos creados · ${linked} asociados · ${unchanged} ya registrados`);
  } catch (error) {
    showToast('No se pudo importar: ' + error.message);
  } finally {
    if (state.campaignImport) state.campaignImport.busy = false;
    render();
  }
}
