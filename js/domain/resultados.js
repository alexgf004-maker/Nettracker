// Resultados de la campaña (cuadro resumen): situación de cada caso, desde la instalación hasta el resultado.
// Por ahora el resultado (válida/fallida, tolerancia, FebNoPer) se anota a mano; cuando la macro esté
// integrada se llenará desde los TXT. Funciones puras.
import { grupoDeEstado } from './multiplicadores.js';
import { normalizarCodigo } from './trabajo.js';

export const MEDICION = { valida: 'Válida', fallida: 'Fallida', revisar: 'Por revisar', no_medida: 'No medida' };
export const TOLERANCIA = { dentro: 'Dentro de tolerancia', fuera: 'Fuera de tolerancia (FT)' };

// Instalación de la app que corresponde a un caso (por código, sin importar formato)
export function instalacionDeCaso(caso, registros) {
  const codigos = [caso.codigo, caso.codigoEnte].filter(Boolean).map(normalizarCodigo);
  const propias = registros.filter(r => codigos.includes(normalizarCodigo(r.caso)));
  return propias.sort((a, b) => (b.fechaInstalacion || '').localeCompare(a.fechaInstalacion || ''))[0] || null;
}

// Situación del caso en la campaña
export function situacionCaso(caso, inst, hoy) {
  const estado = caso.mult?.estado || '';
  if (!inst) {
    if (grupoDeEstado(estado) === 'no_se_miden' || estado === 'Acceso denegado') return { clave: 'sin_medir', texto: estado };
    return { clave: 'sin_instalar', texto: caso.programa?.fecha ? `Programado en Fecha ${caso.programa.fecha}` : 'Sin instalar' };
  }
  if (!inst.retirado) return { clave: 'en_campo', texto: inst.fechaInstalacion > hoy ? 'Instalación programada' : 'En campo' };
  if (inst.descargaPendiente) return { clave: 'descarga', texto: 'Retirado, descarga pendiente' };
  return { clave: 'descargado', texto: 'Descargado' };
}

// Resultado de la medición: lo anotado a mano o, si no hay, lo que se marcó al descargar
export function resultadoCaso(caso, inst) {
  const r = caso.resultado || {};
  let medicion = r.medicion || '';
  if (!medicion && inst?.descargas?.length) {
    const ultima = inst.descargas[inst.descargas.length - 1];
    if (ultima.medicionOk === true) medicion = 'valida';
    if (ultima.medicionOk === false) medicion = 'fallida';
  }
  return { medicion, tolerancia: medicion === 'valida' ? r.tolerancia || '' : '', febNoPer: medicion === 'valida' ? r.febNoPer ?? '' : '', nota: r.nota || '', desdeDescarga: !r.medicion && !!medicion, analisis: r.origen === 'txt' ? r.analisis : null };
}

export function resumenResultados(filas) {
  const n = { total: filas.length, valida: 0, fallida: 0, revisar: 0, pendiente: 0, ft: 0, crValidas: 0, daValidas: 0, dfValidas: 0, sinMedir: 0 };
  for (const f of filas) {
    if (f.resultado.medicion === 'valida') {
      n.valida++;
      if (f.caso.tipo === 'CR') n.crValidas++;
      if (f.caso.tipo === 'DA') n.daValidas++;
      if (f.caso.tipo === 'DF') n.dfValidas++;
      if (f.resultado.tolerancia === 'fuera') n.ft++;
    } else if (f.resultado.medicion === 'fallida') n.fallida++;
    else if (f.resultado.medicion === 'revisar') n.revisar++;
    else if (f.resultado.medicion === 'no_medida' || f.situacion.clave === 'sin_medir') n.sinMedir++;
    else n.pendiente++;
  }
  return n;
}

// Estado de cada caso en el cuadro resumen (lo que se pinta)
export const ESTADOS_CUADRO = {
  dt: { texto: 'Dentro de tolerancia (DT)', color: '22C55E' },
  ft: { texto: 'Fuera de tolerancia (FT)', color: 'EF4444' },
  fallida: { texto: 'Fallida', color: 'F97316' },
  no_instalada: { texto: 'No instalada', color: '9CA3AF' },
  '': { texto: 'Sin resultado', color: null },
};
export function estadoCuadro(f) {
  const r = f.resultado;
  if (r.medicion === 'valida') return r.tolerancia === 'fuera' ? 'ft' : 'dt';
  if (r.medicion === 'fallida') return 'fallida';
  if (r.medicion === 'revisar') return ''; // por revisar: todavía sin resultado final
  if (r.medicion === 'no_medida' || f.situacion.clave === 'sin_instalar' || f.situacion.clave === 'sin_medir') return 'no_instalada';
  return '';
}

// Hasta qué medición se sube al sistema: en orden de código, se cuentan los CR con medición válida
// (DT o FT) hasta completar los obligatorios. Devuelve { codigo, contados, faltan }.
export function corteSubida(filas, obligatorios) {
  let n = 0;
  for (const f of filas) {
    if (f.caso.tipo !== 'CR' || f.resultado.medicion !== 'valida') continue;
    n++;
    if (n === obligatorios) return { codigo: f.caso.codigo || f.caso.codigoEnte, contados: n, faltan: 0 };
  }
  return { codigo: null, contados: n, faltan: obligatorios - n };
}

// Cuadro resumen: los códigos en cuadrícula (columnas), cada uno con su estado
export function cuadroResumen(filas, columnas = 6) {
  const celdas = filas.map(f => ({ codigo: f.caso.codigo || f.caso.codigoEnte, estado: estadoCuadro(f) }));
  const grilla = [];
  for (let i = 0; i < celdas.length; i += columnas) grilla.push(celdas.slice(i, i + columnas));
  const cuenta = Object.fromEntries(Object.keys(ESTADOS_CUADRO).map(k => [k, celdas.filter(c => c.estado === k).length]));
  return { grilla, cuenta };
}
