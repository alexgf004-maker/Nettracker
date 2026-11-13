// Recortar registros de un TXT de campaña (pedido del equipo): a veces hay que quitar registros del inicio o del final
// para que la medición encaje con la fecha y hora de la planilla. Se ven la hora y los voltajes del inicio y del final
// para decidir dónde cortar; el recorte cuenta para el análisis y se baja el TXT recortado para DELSUR. Funciones puras.
import { leerTXT } from './analisis.js';

const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
// Columna de voltaje de cada fase: "U1 [V]" (ECAMEC) o "AVrmsAvg[Volts]" (formato viejo de BT)
function columnasVoltaje(enc) {
  return [1, 2, 3].map((p, i) => {
    const a = enc.findIndex(h => h.trim() === `U${p} [V]`);
    if (a >= 0) return a;
    return enc.findIndex(h => new RegExp(`^${'ABC'[i]}Vrms(Avg)?\\b`, 'i').test(h.trim()));
  });
}
const mediana = arr => { const s = arr.filter(x => x !== null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

// Registros del TXT para la vista: { total, filas: [{ n, fecha, v: [v1, v2, v3] }], activas: [bool×3], referencia: [mediana×3] }
export function registrosTXT(texto) {
  const filas = leerTXT(texto);
  if (filas.length <= 1) return { total: 0, filas: [], activas: [false, false, false], referencia: [0, 0, 0] };
  const cols = columnasVoltaje(filas[0]);
  const datos = filas.slice(1).map((f, i) => ({ n: i + 1, fecha: f[0] || '', v: cols.map(c => (c >= 0 ? num(f[c]) : null)) }));
  const referencia = [0, 1, 2].map(k => mediana(datos.map(d => d.v[k])));
  const mayor = Math.max(...referencia);
  return { total: datos.length, filas: datos, activas: referencia.map(m => mayor > 0 && m > mayor * 0.05), referencia };
}

// ¿Voltaje bajo? Una fase activa por debajo del 90 % de su valor típico (p. ej. el equipo todavía sin conectar)
export const voltajeBajo = (v, k, r) => r.activas[k] && (v === null || v < r.referencia[k] * 0.9);

// El TXT sin `ini` registros al inicio ni `fin` al final. Conserva el encabezado, la marca BOM, el fin de línea y el
// formato de cada línea tal cual (el TXT corregido para DELSUR se arma después con corregirTXT).
export function quitarRegistros(texto, ini = 0, fin = 0) {
  const t = String(texto ?? '');
  const eol = t.includes('\r\n') ? '\r\n' : '\n';
  const lineas = t.split(/\r?\n/);
  const llenas = lineas.filter(l => l.trim() !== '');
  if (llenas.length <= 1) return t;
  const [enc, ...datos] = llenas;
  const a = Math.max(0, Math.floor(Number(ini) || 0)); const b = Math.max(0, Math.floor(Number(fin) || 0));
  const quedan = datos.slice(a, Math.max(a, datos.length - b));
  return [enc, ...quedan].join(eol) + (/\r?\n\s*$/.test(t) ? eol : '');
}
