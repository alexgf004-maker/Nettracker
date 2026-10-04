// Escrituras coordinadas para expedientes y bitácora caso-equipo.
import { casesRef, db, equipmentEventsRef, get, installsRef, push, ref, update } from '../firebase.js';
import { state } from '../state.js';
import { buildCaseRecord, caseIndexKey, normalizeCaseCode } from '../domain/cases.js';
import { today } from '../utils.js';

function actorName() {
  return state.sesionUsuario?.nombre || 'Desconocido';
}

export async function resolveCaseForWrite({ code, ownerArea, place, installationDate = '', existingCaseId = null }) {
  const normalizedCode = normalizeCaseCode(code);
  const existing = existingCaseId ? state.cases.find(c => c.id === existingCaseId) : null;
  if (existing && existing.normalizedCode === normalizedCode) {
    return { caseId: existing.id, code: normalizedCode, writes: {}, isNew: false };
  }

  const local = state.cases.find(c => c.normalizedCode === normalizedCode || normalizeCaseCode(c.code) === normalizedCode);
  if (local) return { caseId: local.id, code: normalizedCode, writes: {}, isNew: false };

  const indexKey = caseIndexKey(normalizedCode);
  const indexed = await get(ref(db, `caseCodeIndex/${indexKey}`));
  if (indexed.exists()) return { caseId: indexed.val(), code: normalizedCode, writes: {}, isNew: false };

  const caseId = push(casesRef).key;
  const isFuture = installationDate && installationDate > today();
  const record = buildCaseRecord({
    code: normalizedCode, ownerArea, place, actor: actorName(),
    lifecycleStatus: isFuture ? 'scheduled' : 'measuring',
    measurementStatus: isFuture ? 'not_measured' : 'measuring',
  });
  return {
    caseId,
    code: normalizedCode,
    isNew: true,
    writes: {
      [`cases/${caseId}`]: record,
      [`caseCodeIndex/${indexKey}`]: caseId,
    },
  };
}

export function buildEquipmentEvent({
  type,
  equipmentId,
  caseId = null,
  caseCode = '',
  installationId = null,
  eventDate = today(),
  location = '',
  from = null,
  to = null,
  failure = null,
  notes = '',
}) {
  return {
    type,
    equipmentId,
    caseId,
    caseCode: normalizeCaseCode(caseCode),
    installationId,
    eventDate,
    occurredAt: Date.now(),
    actorName: actorName(),
    location,
    from,
    to,
    failure,
    notes,
  };
}

export function addEquipmentEventWrites(writes, event) {
  if (!event?.equipmentId) return null;
  const eventId = push(equipmentEventsRef).key;
  writes[`equipmentEvents/${eventId}`] = event;
  writes[`eventIdsByEquipment/${event.equipmentId}/${eventId}`] = true;
  if (event.caseId) writes[`eventIdsByCase/${event.caseId}/${eventId}`] = true;
  return eventId;
}

function addObjectFields(writes, basePath, values) {
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) writes[`${basePath}/${key}`] = value;
  });
}

export async function saveInstallationWithTrace({ payload, installationId = null, previous = null, eventType = null, eventContext = {}, equipmentUpdates = {} }) {
  const resolved = await resolveCaseForWrite({
    code: payload.caso,
    ownerArea: payload.areaBeneficiaria || payload.areaInstalacion,
    place: payload.lugar,
    installationDate: payload.fechaInstalacion,
    existingCaseId: previous?.caseId,
  });
  const id = installationId || push(installsRef).key;
  const actor = actorName();
  const installation = { ...payload, caso: resolved.code, caseId: resolved.caseId };
  const writes = { ...resolved.writes };

  if (previous) addObjectFields(writes, `analizadores/${id}`, installation);
  else writes[`analizadores/${id}`] = installation;

  writes[`installationIdsByCase/${resolved.caseId}/${id}`] = true;
  if (previous?.caseId && previous.caseId !== resolved.caseId) {
    writes[`installationIdsByCase/${previous.caseId}/${id}`] = null;
  }

  const isFuture = installation.fechaInstalacion && installation.fechaInstalacion > today();
  const type = eventType || (previous ? 'installation_updated' : isFuture ? 'assigned' : 'installed');
  addEquipmentEventWrites(writes, buildEquipmentEvent({
    type,
    equipmentId: installation.equipoId,
    caseId: resolved.caseId,
    caseCode: resolved.code,
    installationId: id,
    eventDate: eventContext.eventDate || installation.fechaInstalacion || today(),
    location: eventContext.location || installation.lugar,
    from: previous ? { equipmentId: previous.equipoId, caseId: previous.caseId || null } : null,
    to: eventContext.to || { state: isFuture ? 'assigned' : 'installed', location: installation.lugar },
    notes: eventContext.notes || (previous ? 'Datos de instalación actualizados' : `Instalación registrada por ${actor}`),
  }));

  const operationalState = eventType === 'dispatched' ? 'loaned' : isFuture ? 'assigned' : 'installed';
  addObjectFields(writes, `equipos/${installation.equipoId}`, {
    activeInstallationId: id,
    operationalState,
    ...equipmentUpdates,
  });

  if (previous?.equipoId && previous.equipoId !== installation.equipoId) {
    writes[`equipos/${previous.equipoId}/activeInstallationId`] = null;
    writes[`equipos/${previous.equipoId}/operationalState`] = 'available';
    addEquipmentEventWrites(writes, buildEquipmentEvent({
      type: 'unassigned',
      equipmentId: previous.equipoId,
      caseId: previous.caseId || null,
      caseCode: previous.caso,
      installationId: id,
      location: previous.lugar,
      notes: `Equipo sustituido por ${installation.serie || installation.equipoId}`,
    }));
  }

  if (!resolved.isNew) {
    writes[`cases/${resolved.caseId}/updatedAt`] = Date.now();
    writes[`cases/${resolved.caseId}/updatedBy`] = actor;
  }
  await update(ref(db), writes);
  return { id, caseId: resolved.caseId, payload: installation };
}

export async function writeTraceUpdate({ writes = {}, event = null }) {
  if (event) addEquipmentEventWrites(writes, event);
  await update(ref(db), writes);
}
