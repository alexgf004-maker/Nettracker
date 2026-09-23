// Utilidades puras: fechas, formularios vacíos y cálculo de estados
import { state } from './state.js';

export function areaToSede(area) {
  if (area === 'CPT BT') return 'Subestación Cucumacayán';
  if (area === 'Campos y Servicios') return 'Con Campos y Servicios';
  return 'Plantel Central';
}

export function emptyForm() {
  return { equipoId: null, serie: '', modelo: '', caso: '', lugar: '', lat: null, lng: null, fechaInstalacion: today(), fechaRetiro: '', notas: '', sede: 'Plantel Central', areaInstalacion: 'CPT MT', energiaTipoInst: 'ninguna', energiaInstUna: '', energiaInstPunta: '', energiaInstResto: '', energiaInstValle: '' };
}

export function emptyEF() {
  return { serie: '', modelo: '', notas: '', sede: 'Plantel Central', condicion: 'bueno', vineta: '' };
}

export function today() { return new Date().toISOString().split('T')[0]; }
export function fmtDate(d) { if (!d) return '—'; const [y,m,dd] = d.split('-'); return `${dd}/${m}/${y}`; }
export function daysUntil(d) { if (!d || typeof d !== 'string') return 999; const [y,m,dd] = d.split('-').map(Number); if (!y||!m||!dd) return 999; const r = new Date(y, m-1, dd); const n = new Date(); n.setHours(0,0,0,0); r.setHours(0,0,0,0); return Math.round((r-n)/86400000); }

export function calcSt(r) {
  if (r.retirado) return 'RETIRADO';
  if (r.fechaInstalacion && daysUntil(r.fechaInstalacion) > 0) return 'PROGRAMADO';
  const d = daysUntil(r.fechaRetiro);
  if (d < 0) return 'VENCIDO';
  return d <= 3 ? 'PROXIMO' : 'ACTIVO';
}

export function eqSt(eq) {
  if (state.records.find(r => r.equipoId === eq.id && !r.retirado)) return 'instalado';
  if (eq.prestado) return 'prestado';
  return 'disponible';
}

export function eqEnCampo(eq) { return !!state.records.find(r => r.equipoId === eq.id && !r.retirado); }
export function eqPrestado(eq) { return !!eq.prestado; }
