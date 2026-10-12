// Proyección de la tensión medida con un cambio de TAP del transformador. Funciones puras.
// El secundario es proporcional a la tensión del primario dividida entre la tensión de placa de la posición, así que al
// pasar de la posición A a la B la tensión medida se multiplica por placa(A) / placa(B). La posición 1 es la de mayor
// tensión de placa (la que da menos tensión en el secundario).
import { estadisticas, fasesDe, resumenTension } from './reclamo.js';

export const POSICIONES = ['1', '2', '3', '4', '5'];
// Placas de cada posición según la red (confirmado por el equipo). 4.16 kV: solo se sabe la posición 3; el resto se escribe.
export const PLACAS_TAP = {
  '23kv': { nombre: 'Red 23 kV (trafo 13.2 kV)', v: [14400, 13800, 13200, 12870, 12540] },
  '13.2kv': { nombre: 'Red 13.2 kV (trafo 7.62 kV)', v: [8001, 7810, 7620, 7430, 7240] },
  '4.16kv': { nombre: 'Red 4.16 kV (trafo 2.2 kV)', v: [null, null, 2200, null, null] },
  otra: { nombre: 'Otra (escribir las placas)', v: [null, null, null, null, null] },
};
export const nuevaProyeccionTap = () => ({ activo: false, red: '', placas: ['', '', '', '', ''], actual: '', propuesta: '' });

const num = x => { const n = Number(String(x ?? '').replace(',', '.')); return x !== '' && x !== null && x !== undefined && n > 0 ? n : null; };
export const placaDe = (proy, pos) => num(proy?.placas?.[Number(pos) - 1]);

// Factor por el que se multiplica la tensión al pasar de `actual` a `propuesta` (null si falta alguna placa)
export function factorTap(proy, actual = proy?.actual, propuesta = proy?.propuesta) {
  const a = placaDe(proy, actual); const b = placaDe(proy, propuesta);
  return a && b ? a / b : null;
}
// Tensiones por fase multiplicadas por el factor (los vacíos siguen vacíos)
export function proyectarU(U, fases, factor) {
  return Object.fromEntries(fases.filter(p => U[p]).map(p => [p, { ...U[p], v: U[p].v.map(x => (x === null || x === undefined ? x : x * factor)) }]));
}
// Resumen de la tensión promedio con un factor: el mismo FebNoPer y DT/FT de la medición y las estadísticas por fase
export function resumenProyectado(U, nFases, nominal, tol, factor) {
  const fases = fasesDe(nFases).filter(p => U[p]);
  const Up = proyectarU(U, fases, factor);
  return { factor, resumen: resumenTension(Up, nFases, nominal, tol), est: Object.fromEntries(fases.map(p => [p, estadisticas(Up[p].v)])) };
}
// Todas las posiciones con placa, comparadas desde la actual; `mejor`: la de menor FebNoPer (empate: la más cercana a la actual)
export function compararPosiciones(U, nFases, nominal, tol, proy) {
  if (!placaDe(proy, proy?.actual)) return [];
  const filas = POSICIONES.filter(pos => placaDe(proy, pos)).map(pos => {
    const factor = factorTap(proy, proy.actual, pos);
    return { pos, placa: placaDe(proy, pos), cambio: (factor - 1) * 100, ...resumenProyectado(U, nFases, nominal, tol, factor) };
  });
  const validas = filas.filter(f => f.resumen.validos > 0);
  const mejor = validas.sort((a, b) => a.resumen.febNoPer - b.resumen.febNoPer || Math.abs(a.pos - proy.actual) - Math.abs(b.pos - proy.actual))[0];
  return filas.map(f => ({ ...f, mejor: f === mejor }));
}
