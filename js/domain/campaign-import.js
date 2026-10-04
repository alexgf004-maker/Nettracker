import { normalizeCaseCode } from './cases.js';
import { campaignPeriodFromCode } from './campaigns.js';

const value = cell => String(cell ?? '').trim();
const number = cell => {
  const parsed = Number(cell);
  return cell === '' || cell == null || !Number.isFinite(parsed) ? null : parsed;
};

function columns(header) {
  const labels = header.map(cell => value(cell).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase());
  const find = (...names) => labels.findIndex(label => names.includes(label));
  const code = find('NUMERO SIGET', 'CODIGO SIGET');
  const contract = find('ID DEL USUARIO', 'NC');
  const customer = find('NOMBRE DEL USUARIO', 'NOMBRE');
  const address = find('DIRECCION');
  if ([code, contract, customer, address].some(index => index < 0)) return null;
  return {
    code, contract, customer, address,
    electricalReference: find('CORTE', 'CT/DS'), meterNumber: find('MEDIDOR'),
    latitude: find('LATITUD'), longitude: find('LONGITUD'),
    feeder: find('ALIMENTADOR'), urbanity: find('URBANIDAD'),
  };
}

export function parseCampaignSheets(files, campaign) {
  const byCode = new Map();
  const errors = [];
  for (const file of files) {
    let recognized = false;
    for (const sheet of file.sheets) {
      // La plantilla de trabajo contiene hojas derivadas que repiten los casos.
      if (!['LISTADO', 'DETASORTEOCPT'].includes(sheet.name.toUpperCase())) continue;
      const headerIndex = sheet.rows.findIndex(row => columns(row));
      if (headerIndex < 0) continue;
      recognized = true;
      const col = columns(sheet.rows[headerIndex]);
      for (let rowIndex = headerIndex + 1; rowIndex < sheet.rows.length; rowIndex++) {
        const row = sheet.rows[rowIndex];
        const code = normalizeCaseCode(row[col.code]);
        if (!/^(CR|DA|DF)/.test(code)) continue;
        const period = campaignPeriodFromCode(code);
        const location = `${file.name} · ${sheet.name} · fila ${rowIndex + 1}`;
        if (!period || period.year !== campaign.year || period.month !== campaign.month) {
          errors.push(`${location}: ${code} pertenece a otro período o tiene un código inválido.`);
          continue;
        }
        const contractNumber = value(row[col.contract]);
        if (!contractNumber) {
          errors.push(`${location}: ${code} no tiene número de contrato.`);
          continue;
        }
        const feeder = col.feeder < 0 ? '' : value(row[col.feeder]);
        const voltage = /-(\d+)\s*$/.exec(feeder);
        const incoming = {
          code, contractNumber, customerName: value(row[col.customer]), address: value(row[col.address]),
          electricalReference: col.electricalReference < 0 ? '' : value(row[col.electricalReference]),
          meterNumber: col.meterNumber < 0 ? '' : value(row[col.meterNumber]),
          feeder, networkVoltageLL: voltage ? Number(voltage[1]) : null,
          urbanity: col.urbanity < 0 ? '' : value(row[col.urbanity]).toUpperCase(),
          lat: col.latitude < 0 ? null : number(row[col.latitude]),
          lng: col.longitude < 0 ? null : number(row[col.longitude]),
          source: location,
        };
        const previous = byCode.get(code);
        if (previous && previous.contractNumber !== contractNumber) {
          errors.push(`${location}: ${code} repite un código con distinto contrato; se omitirá para revisión.`);
          byCode.set(code, { ...previous, conflict: true });
          continue;
        }
        if (!previous) byCode.set(code, incoming);
        else if (!previous.conflict) {
          // Si hay listado oficial y listado enriquecido, conserva los datos completos.
          byCode.set(code, { ...previous, ...Object.fromEntries(Object.entries(incoming).filter(([key, field]) => field !== '' && field !== null && key !== 'source')) });
        }
      }
    }
    if (!recognized) errors.push(`${file.name}: no se encontró una hoja Listado o DetaSorteoCPT con encabezados reconocibles.`);
  }
  return { rows: [...byCode.values()], errors };
}

export function reviewCampaignRows(rows, campaign, existingCases, existingPoints) {
  const crContracts = new Set(rows.filter(row => row.code.startsWith('CR') && !row.conflict).map(row => row.contractNumber));
  for (const item of existingCases) {
    if (item.campaignId !== campaign.id || item.caseType !== 'CR') continue;
    const point = existingPoints.find(point => point.id === item.servicePointId);
    if (point?.contractNumber) crContracts.add(String(point.contractNumber));
  }
  return rows.map(row => {
    const existing = existingCases.find(item => normalizeCaseCode(item.code) === row.code);
    const point = existing && existingPoints.find(item => item.id === existing.servicePointId);
    let issue = '';
    if (row.conflict) issue = 'Código duplicado con contratos diferentes';
    else if (existing && (existing.workflowType !== 'campaign' || existing.ownerArea !== campaign.ownerArea || (existing.campaignId && existing.campaignId !== campaign.id))) issue = 'El expediente ya pertenece a otra área o campaña';
    else if (existing && point?.contractNumber && String(point.contractNumber) !== row.contractNumber) issue = 'El contrato difiere del expediente existente';
    else if (!row.code.startsWith('CR') && !crContracts.has(row.contractNumber)) issue = 'Perturbación sin CR de esta campaña';
    return { ...row, existingId: existing?.id || null, issue, selected: !issue };
  });
}
