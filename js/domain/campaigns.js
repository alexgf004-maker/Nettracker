// Una campaña agrupa los expedientes del mismo mes y área.
const MONTH_CODES = { O: 10, N: 11, D: 12 };

export function campaignPeriodFromCode(value) {
  const code = String(value || '').trim().replace(/^\[+|\]+$/g, '').toUpperCase();
  const match = /^(?:CR|DA|DF)[1-9]([1-9OND])(20\d{2})/.exec(code);
  if (!match) return null;
  return { month: MONTH_CODES[match[1]] || Number(match[1]), year: Number(match[2]) };
}

export function campaignIdFor(year, month, area) {
  if (!Number.isInteger(Number(year)) || Number(year) < 2000 || Number(year) > 2100 ||
      !Number.isInteger(Number(month)) || Number(month) < 1 || Number(month) > 12 ||
      !['CPT MT', 'CPT BT'].includes(area)) return null;
  return `${area === 'CPT MT' ? 'MT' : 'BT'}_${year}_${String(month).padStart(2, '0')}`;
}

export function campaignDueDate(year, month) {
  const nextYear = Number(month) === 12 ? Number(year) + 1 : Number(year);
  const nextMonth = Number(month) === 12 ? 1 : Number(month) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-10`;
}

export function campaignLabel(campaign) {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${months[Number(campaign.month) - 1] || 'Mes'} ${campaign.year}`;
}

export const CAMPAIGN_STAGES = [
  ['pre_campaign', 'Precampaña'],
  ['multipliers', 'Multiplicadores'],
  ['scheduled', 'Programación'],
  ['measuring', 'Medición'],
  ['analysis', 'Análisis'],
  ['submission', 'Entrega'],
  ['completed', 'Completada'],
];
