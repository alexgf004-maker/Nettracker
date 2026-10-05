// Fechas 1, 2 y 3: grupos de instalación de una campaña. Cada caso se asigna a una fecha con su equipo.
// El Excel de cada fecha tiene las columnas que lee Despachos (carga masiva). Funciones puras.
import { normalizar, normalizarNC } from './listados.js';
import { calcularMultiplicador } from './multiplicadores.js';
import { buscarCasoImportado } from './trabajo.js';

export const FECHAS = ['1', '2', '3'];
// Grupos de una campaña: al menos 3; BT puede tener más (un grupo por día de instalación)
export function fechasDe(g = {}) {
  let max = 3;
  Object.keys(g.fechas || {}).forEach(n => { max = Math.max(max, Number(n) || 0); });
  Object.values(g.casos || {}).forEach(c => { max = Math.max(max, Number(c.programa?.fecha) || 0); });
  return Array.from({ length: max }, (_, i) => String(i + 1));
}
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

// ── PROGRAMACIÓN (Excel "Usuarios seleccionados" con la fecha de instalación de cada caso) ──

// Fecha de Excel (número de serie, Date o texto dd/mm/aaaa) → AAAA-MM-DD
export function fechaExcel(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  const t = String(v).trim();
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return m ? m[0] : '';
}

export function leerProgramacion(filas) {
  let h = -1;
  for (let i = 0; i < Math.min(filas.length, 20) && h < 0; i++) {
    const enc = (filas[i] || []).map(normalizar);
    if (enc.includes('NUMERO SIGET') && enc.some(e => e.startsWith('FECHA INSTALACION'))) h = i;
  }
  if (h < 0) return { error: 'No se encontraron las columnas "Número SIGET" y "Fecha instalación"' };
  const enc = filas[h].map(normalizar);
  const col = { codigo: enc.indexOf('NUMERO SIGET'), nc: enc.findIndex(e => e.startsWith('ID DEL USUARIO')), fecha: enc.findIndex(e => e.startsWith('FECHA INSTALACION')) };
  const filasOk = [];
  for (const f of filas.slice(h + 1)) {
    const codigo = String(f?.[col.codigo] ?? '').replace(/[[\]#\s]/g, '').toUpperCase();
    if (!/^(CR|DA|DF)/.test(codigo)) continue;
    filasOk.push({ codigo, nc: normalizarNC(f[col.nc]), fecha: fechaExcel(f[col.fecha]) });
  }
  return { filas: filasOk };
}

// Cruza la programación con las campañas guardadas (por NC y tipo de caso; el código puede venir corregido).
// Cada día de instalación de una campaña es una Fecha (1, 2, 3…) en orden.
export function planificarFechas(programacion, campanas) {
  const porCampana = {};
  const sinCampana = [];
  for (const p of programacion) {
    const encontrado = buscarCasoImportado(p, campanas);
    if (!encontrado) { sinCampana.push(p); continue; }
    (porCampana[encontrado.clave] ??= []).push({ ...p, id: encontrado.id, caso: encontrado.caso });
  }
  const planes = Object.entries(porCampana).map(([clave, filas]) => {
    const dias = [...new Set(filas.map(f => f.fecha).filter(Boolean))].sort();
    const numero = Object.fromEntries(dias.map((d, i) => [d, String(i + 1)]));
    const asignaciones = filas.map(f => ({
      id: f.id, codigo: f.caso.codigo || f.caso.codigoEnte, fecha: numero[f.fecha] || '',
      // El código del archivo trae el tipo de sistema verificado; se toma si no se corrigió a mano
      codigoNuevo: f.codigo !== (f.caso.codigo || f.caso.codigoEnte) && !f.caso.manual?.codigo ? f.codigo : null,
      ncArchivo: f.nc && f.nc !== f.caso.nc ? f.nc : null, // mismo código con otro NC: se avisa, no se cambia
    }));
    const programados = new Set(filas.map(f => f.id));
    const sinFecha = Object.entries(campanas[clave].casos || {}).filter(([id]) => !programados.has(id)).map(([id, c]) => c.codigo || c.codigoEnte || id).sort();
    return { clave, dias, asignaciones, sinFecha };
  });
  return { planes: planes.sort((a, b) => a.clave.localeCompare(b.clave)), sinCampana };
}
