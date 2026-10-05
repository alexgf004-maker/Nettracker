// Fechas 1, 2 y 3: grupos de instalación de una campaña. Cada caso se asigna a una fecha con su equipo.
// El Excel de cada fecha tiene las columnas que lee Despachos (carga masiva). Funciones puras.
import { calcularMultiplicador } from './multiplicadores.js';

export const FECHAS = ['1', '2', '3'];
export const ACCESORIOS_DEFECTO = '3 pinzas de corriente, 4 caimanes, 4 alimentadores de voltaje tipo banana';
export const COLUMNAS_FECHA = ['Número SIGET', 'Equipo', 'Nombre del Usuario', 'Id del Usuario', 'Dirección', 'Multiplicador', 'Corrientes', 'Conexion', 'Fecha instalación', 'Fecha retiro', 'Latitud', 'Longitud', 'Accesorios'];

export const casosDeFecha = (casos, n) => casos.filter(c => String(c.programa?.fecha || '') === String(n));

// Fila de un caso con los datos de su fecha (mismo orden que COLUMNAS_FECHA)
export function filaFecha(c, fecha = {}) {
  const m = c.mult || {}; const k = calcularMultiplicador(m);
  return [c.codigo || c.codigoEnte, c.programa?.equipo || '', c.nombre || '', c.nc || '', c.direccion || c.direccionEnte || '', k.ecamec, k.ti, m.configuracion || '',
    fecha.instalacion || '', fecha.retiro || '', c.lat ?? '', c.lng ?? '', fecha.accesorios || ACCESORIOS_DEFECTO];
}

// Hoja del Excel: dos filas vacías y el encabezado en la tercera, como las hojas Fecha1/2/3
export const filasFecha = (casos, fecha) => [[], [], COLUMNAS_FECHA, ...casos.map(c => filaFecha(c, fecha))];

// Problemas a revisar antes de despachar una fecha
export function revisarFecha(casos, fecha = {}) {
  const avisos = [];
  if (!fecha.instalacion || !fecha.retiro) avisos.push('Faltan las fechas de instalación o de retiro');
  const sinEquipo = casos.filter(c => !c.programa?.equipo);
  if (sinEquipo.length) avisos.push(`${sinEquipo.length} sin equipo asignado`);
  const sinMult = casos.filter(c => !c.mult?.tensionTap || !c.mult?.tensionBT);
  if (sinMult.length) avisos.push(`${sinMult.length} sin multiplicador`);
  const vistos = {};
  casos.forEach(c => { const e = c.programa?.equipo; if (e) vistos[e] = (vistos[e] || 0) + 1; });
  const repetidos = Object.entries(vistos).filter(([, n]) => n > 1).map(([e]) => e);
  if (repetidos.length) avisos.push(`Equipo repetido: ${repetidos.join(', ')}`);
  return avisos;
}
