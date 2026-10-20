// Resultados de la campaña (cuadro resumen): situación de cada caso, desde la instalación hasta el resultado.
// Por ahora el resultado (válida/fallida, tolerancia, FebNoPer) se anota a mano; cuando la macro esté
// integrada se llenará desde los TXT. Funciones puras.
import { grupoDeEstado } from './multiplicadores.js';
import { normalizarCodigo } from './trabajo.js';

export const MEDICION = { valida: 'Válida', fallida: 'Fallida', revisar: 'Por revisar', no_medida: 'No medida' };
export const TOLERANCIA = { dentro: 'Dentro de tolerancia', fuera: 'Fuera de tolerancia (FT)' };

// Instalación de la app que corresponde a un caso (por código, sin importar formato)
// Con varias del mismo código: la última es la que vale (una reinstalación reemplaza a la anterior), pero si hay varias
// en campo a la vez (varios analizadores para el mismo caso) la principal es la primera que se instaló y las demás son
// puntos adicionales (`instalacionesMismoCaso`). Las que ya se nombraron como punto de un reclamo no cuentan.
const finInst = r => (r.retirado ? r.fechaRetiroReal || r.fechaRetiro : r.fechaRetiro) || '9999-12-31';
export function instalacionesMismoCaso(caso, registros) {
  const codigos = [caso.codigo, caso.codigoEnte].filter(Boolean).map(normalizarCodigo);
  const propias = registros.filter(r => codigos.includes(normalizarCodigo(r.caso)) && !r.reclamo?.punto)
    .sort((a, b) => (a.fechaInstalacion || '').localeCompare(b.fechaInstalacion || '') || String(a.id || '').localeCompare(String(b.id || '')));
  if (!propias.length) return { principal: null, otras: [] };
  const ultima = propias[propias.length - 1];
  // Las que estuvieron en campo al mismo tiempo que la última (se enciman sus fechas)
  const juntas = propias.filter(r => r === ultima || ((r.fechaInstalacion || '') <= finInst(ultima) && finInst(r) >= (ultima.fechaInstalacion || '')));
  return { principal: juntas[0], otras: juntas.slice(1) };
}
export function instalacionDeCaso(caso, registros) { return instalacionesMismoCaso(caso, registros).principal; }

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

// Resultado de la medición: solo el del análisis de los TXT o el anotado a mano. Lo que se marca al descargar el
// equipo (medición correcta o con fallo) no es un resultado (confirmado): se muestra como aviso mientras no se analice.
export function resultadoCaso(caso, inst) {
  const r = caso.resultado || {};
  const medicion = r.medicion || '';
  const ultima = inst?.descargas?.length ? inst.descargas[inst.descargas.length - 1] : null;
  const falloDescarga = !medicion && ultima?.medicionOk === false ? (ultima.fallasMedicion || []).join(', ') || 'con fallo' : '';
  return { medicion, tolerancia: medicion === 'valida' ? r.tolerancia || '' : '', febNoPer: medicion === 'valida' ? r.febNoPer ?? '' : '', nota: r.nota || '', falloDescarga, analisis: r.origen === 'txt' ? r.analisis : null };
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

// CR que se suben al sistema por área
export const CR_OBLIGATORIOS = { 'CPT MT': 38, 'CPT BT': 105 };

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

// ── PERTURBACIONES (DA y DF) ──
// El ente manda 12 DA y 12 DF por mes para MT y BT juntas y se suben 9 de cada tipo: en orden de código (MT y BT
// revueltas), las primeras 9 válidas. Si una falla, entra la siguiente (la 10, la 11…). `filas` son las de
// filasResultados de las dos campañas del mes, cada una con su `area`.
export const PERTURBACIONES_A_SUBIR = 9;
const codigoFila = f => f.caso.codigo || f.caso.codigoEnte;
const noSeMide = f => f.resultado.medicion === 'fallida' || f.resultado.medicion === 'no_medida' || f.situacion.clave === 'sin_medir';

// Por cada fila: 'sube' (válida dentro de las 9), 'pendiente' (sin resultado; puede entrar), 'no_entra' (fallida o no
// medida) o 'no_sube' (después de la última que se sube). `corte`: código de la 9.ª válida; `proyectado`: hasta cuál se
// subiría si todas las pendientes salen válidas. `porArea`: cuántas sube y cuántas tiene pendientes cada área.
export function subidaPerturbaciones(filas, aSubir = PERTURBACIONES_A_SUBIR) {
  const orden = [...filas].sort((a, b) => (a.caso.codigoEnte || a.caso.codigo).localeCompare(b.caso.codigoEnte || b.caso.codigo));
  let validas = 0; let posibles = 0; let corte = null; let proyectado = null;
  const estado = {};
  for (const f of orden) {
    const id = codigoFila(f);
    if (corte) { estado[id] = 'no_sube'; continue; }
    if (f.resultado.medicion === 'valida') {
      validas++; posibles++; estado[id] = 'sube';
      if (validas === aSubir) corte = id;
    } else if (noSeMide(f)) estado[id] = 'no_entra';
    else { posibles++; estado[id] = 'pendiente'; }
    if (!proyectado && posibles === aSubir) proyectado = id;
  }
  const porArea = {};
  orden.forEach(f => {
    const a = (porArea[f.area] ??= { total: 0, sube: 0, pendiente: 0 });
    a.total++;
    if (estado[codigoFila(f)] === 'sube') a.sube++;
    if (estado[codigoFila(f)] === 'pendiente') a.pendiente++;
  });
  return { filas: orden, estado, corte, proyectado, validas, faltan: Math.max(0, aSubir - validas), porArea };
}
