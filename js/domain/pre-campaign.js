const REQUIRED_FIELDS = [
  ['contractNumber', 'NC'], ['customerName', 'cliente'], ['address', 'dirección'],
  ['meterNumber', 'medidor'], ['electricalReference', 'CT/DS'],
  ['feeder', 'alimentador'], ['coordinates', 'coordenadas'],
];

export function campaignPointRows(campaignId, cases, servicePoints) {
  const points = new Map(servicePoints.map(point => [point.id, point]));
  const rows = cases.filter(item => item.campaignId === campaignId).map(item => ({
    caseId: item.id, code: item.code, caseType: item.caseType,
    point: points.get(item.servicePointId) || {},
  }));
  return rows.sort((a, b) => {
    const order = { CR: 0, DA: 1, DF: 2 };
    return (order[a.caseType] ?? 3) - (order[b.caseType] ?? 3) || String(a.code).localeCompare(String(b.code), 'es', { numeric: true });
  });
}

export function distinctVisitPoints(rows) {
  const groups = new Map();
  for (const row of rows) {
    // Evita fusionar casos sin NC: pueden corresponder a clientes distintos.
    const key = String(row.point.contractNumber || '').trim() || `case:${row.caseId}`;
    if (!groups.has(key)) groups.set(key, { ...row.point, codes: [], rows: [], key });
    const group = groups.get(key);
    group.codes.push(row.code);
    group.rows.push(row);
    // Una ficha CR puede estar menos completa que DA/DF si se registró antes.
    for (const field of ['customerName', 'address', 'meterNumber', 'electricalReference', 'feeder', 'urbanity']) {
      if (!group[field] && row.point[field]) group[field] = row.point[field];
    }
    if (!group.coordinates?.lat && row.point.coordinates?.lat) group.coordinates = row.point.coordinates;
  }
  return [...groups.values()];
}

export function missingVisitFields(point) {
  return REQUIRED_FIELDS.filter(([key]) => key === 'coordinates'
    ? !validCoordinates(point.coordinates)
    : !String(point[key] ?? '').trim()).map(([, label]) => label);
}

export function validCoordinates(coordinates) {
  const lat = Number(coordinates?.lat), lng = Number(coordinates?.lng);
  return coordinates?.lat != null && coordinates?.lng != null &&
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0);
}

export function estimatedFieldReturn(deliveredAt) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveredAt || '')) return '';
  const date = new Date(`${deliveredAt}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + 10);
  return date.toISOString().slice(0, 10);
}

const xml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character]));

export function campaignMapKml(visits, title) {
  const placemarks = visits.filter(point => validCoordinates(point.coordinates)).map(point =>
    `<Placemark><name>${xml(point.codes.join(' · '))}</name><description>${xml([point.customerName, `NC ${point.contractNumber || ''}`, point.address].filter(Boolean).join(' | '))}</description><Point><coordinates>${Number(point.coordinates.lng)},${Number(point.coordinates.lat)},0</coordinates></Point></Placemark>`);
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(title)}</name>${placemarks.join('')}</Document></kml>`;
}
