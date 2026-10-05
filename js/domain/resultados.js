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

// Estado de cada caso en el cuadro resumen (mismos textos y colores que el cuadro que entrega el equipo).
// CR: DT / FT / Fallida / No instalada. DA y DF: Válida / Fallida / No instalada. '' = todavía sin resultado.
export const ESTADOS_CUADRO = {
  DT: { fill: '00B050' }, FT: { fill: 'FF0000' }, 'Válida': { fill: '00B050' },
  Fallida: { fill: 'FFFF00' }, 'No instalada': { font: 'FF0000' },
};
export function estadoCuadro(f) {
  const r = f.resultado;
  if (r.medicion === 'valida') return f.caso.tipo === 'CR' ? (r.tolerancia === 'fuera' ? 'FT' : 'DT') : 'Válida';
  if (r.medicion === 'fallida') return 'Fallida';
  if (r.medicion === 'revisar') return '';
  // No instalada: no se va a medir (acceso denegado, cliente de baja…) o se marcó como no medida.
  // Lo programado que aún no tiene resultado queda en blanco.
  if (r.medicion === 'no_medida' || f.situacion.clave === 'sin_medir') return 'No instalada';
  return '';
}
// Comentario: por qué falló o por qué no se instaló
export function comentarioCuadro(f, estado) {
  if (estado === 'Fallida') return f.resultado.nota || f.resultado.analisis?.detalle || '';
  if (estado === 'No instalada') return f.resultado.nota || (f.situacion.clave === 'sin_medir' ? f.situacion.texto : '');
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

// Filas del cuadro resumen: CR por un lado y DA/DF por otro
export function cuadroResumen(filas) {
  const fila = f => { const estado = estadoCuadro(f); return { codigo: f.caso.codigo || f.caso.codigoEnte, estado, comentario: comentarioCuadro(f, estado) }; };
  return { cr: filas.filter(f => f.caso.tipo === 'CR').map(fila), otros: filas.filter(f => f.caso.tipo !== 'CR').map(fila) };
}
