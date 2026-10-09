// Multiplicadores: cómo se programa el analizador en cada caso, según lo que se vio en campo.
// Mismas opciones y fórmulas que la hoja "Multiplicadores" del Excel del equipo. Funciones puras.
import { filasListado, normalizar, normalizarNC } from './listados.js';
import { buscarCasoImportado } from './trabajo.js';
import { fechaExcel } from './fechas.js';

export const ESTADOS = ['Realizado', 'Pendiente de validar', 'Validado con histórico', 'Cliente de baja', 'Revisar', 'Validado con usuario', 'Acceso denegado'];
// En el Excel, "Conexión no posible" solo aparece en las filas de flicker (DF)
export const estadosDe = tipo => (tipo === 'DF' ? [...ESTADOS, 'Conexión no posible'] : ESTADOS);

// Para saber cuántas mediciones se podrán hacer
export const GRUPOS_ESTADO = [
  ['listos', 'Listos para medir', ['Realizado', 'Validado con histórico', 'Validado con usuario']],
  ['por_resolver', 'Por resolver', ['Pendiente de validar', 'Revisar', 'Acceso denegado', '']],
  ['no_se_miden', 'No se medirán', ['Cliente de baja', 'Conexión no posible']],
];
export const grupoDeEstado = estado => GRUPOS_ESTADO.find(([, , es]) => es.includes(estado || ''))?.[0] || 'por_resolver';

// Puntos que hay que ir a validar en campo: solo Pendiente de validar y Acceso denegado (los sin estado no)
export const ESTADOS_POR_VALIDAR = ['Pendiente de validar', 'Acceso denegado'];
export const casosPorValidar = casos => casos.filter(c => ESTADOS_POR_VALIDAR.includes(c.mult?.estado));
// Listado de esos puntos: las columnas del listado de la campaña más el estado del multiplicador y su nota
export function filasPorValidar(casos) {
  const [enc, ...filas] = filasListado(casos);
  const porCodigo = new Map(casos.map(c => [c.codigo, c]));
  return [[...enc, 'ESTADO', 'NOTAS'], ...filas.map(f => { const c = porCodigo.get(f[1]) || {}; return [...f, c.mult?.estado || '', c.mult?.notas || '']; })];
}

export const CONFIGURACIONES = ['Monofásico', 'Bifásico', 'Estrella', 'Delta', 'Estrella 2 hilos'];
export const POSICIONES_TAP = ['1', '2', '3', '4', '5', 'MP', 'Tapón', 'Interno'];
export const TENSIONES_BT = ['120', '208', '240', '480'];
// Mediciones de regulación de tensión de MT que hay que entregar como mínimo
export const CR_OBLIGATORIOS_MT = 38;

const num = v => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
// Redondeo para mostrar (como Excel con pocos decimales), sin ceros de más
export const redondear = (n, dec = 4) => (n === null ? '' : String(Number(n.toFixed(dec))));

// m: { tap, tensionTap, tensionBT, xMedidor, vab, vbc, vac }
export function calcularMultiplicador(m = {}) {
  const prim = num(m.tensionTap); const sec = num(m.tensionBT); const x = num(m.xMedidor);
  const dranetz = prim !== null && sec ? prim / sec : null;
  // TI: =IFS(F="MP",(K/120)*5&"/5", AND(F<>"MP",K<>1),(K*5)&"/5", K=1,"1/1")
  let ti = '';
  if (x !== null) {
    if (m.tap === 'MP') ti = `${redondear((x / 120) * 5)}/5`;
    else if (x !== 1) ti = `${redondear(x * 5)}/5`;
    else ti = '1/1';
  }
  const proy = v => (num(v) !== null && dranetz !== null ? num(v) * dranetz : null);
  return {
    ecamec: prim !== null || sec !== null ? `${prim ?? ''}/${sec ?? ''}` : '',
    dranetz,
    ti,
    proyeccion: { ab: proy(m.vab), bc: proy(m.vbc), ac: proy(m.vac) },
  };
}

// Cuántos casos hay en cada estado y en cada grupo
export function resumenMultiplicadores(casos) {
  const porEstado = {}; const porGrupo = { listos: 0, por_resolver: 0, no_se_miden: 0 };
  let crListos = 0;
  for (const c of casos) {
    const e = c.mult?.estado || '';
    porEstado[e] = (porEstado[e] || 0) + 1;
    const g = grupoDeEstado(e);
    porGrupo[g]++;
    if (g === 'listos' && c.tipo === 'CR') crListos++;
  }
  return { porEstado, porGrupo, crListos, total: casos.length };
}

// Último multiplicador registrado del mismo usuario (NC) en una campaña anterior
export function historicoDe(nc, campanas, claveActual) {
  let mejor = null;
  for (const [clave, g] of Object.entries(campanas || {})) {
    if (clave.slice(0, 7) >= claveActual.slice(0, 7)) continue; // solo meses anteriores
    for (const c of Object.values(g?.casos || {})) {
      if (c.nc !== nc || !c.mult?.tensionTap) continue;
      if (!mejor || clave > mejor.clave) mejor = { clave, anio: g.anio, mes: g.mes, codigo: c.codigo || c.codigoEnte, mult: c.mult };
    }
  }
  return mejor;
}

// Filas del Excel "Multiplicadores" con las columnas del equipo
export function filasMultiplicadores(casos) {
  const filas = [['ESTADO', 'Código SIGET', 'NC', 'Alimentador', 'Configuración', 'Posición de TAP', 'Nivel de tensión según TAP (KV)', 'Nivel de Baja Tensión (V)',
    'Multiplicador ECAMEC', 'Multiplicador DRANETZ', 'X medidor', 'TI', 'Testblock', 'Fecha de instalación', 'Fecha de retiro', 'EQUIPO', 'ELEMENTOS',
    'Vab', 'Vbc', 'Vac', 'Proyección primario ab', 'Proyección primario bc', 'Proyección primario ac', 'Urbanidad']];
  for (const c of casos) {
    const m = c.mult || {}; const r = calcularMultiplicador(m);
    const n = v => num(v) ?? '';
    filas.push([m.estado || '', c.codigo || c.codigoEnte, /^\d+$/.test(c.nc) ? Number(c.nc) : c.nc, c.alimentador || '', m.configuracion || '', m.tap || '',
      n(m.tensionTap), n(m.tensionBT), r.ecamec, r.dranetz ?? '', n(m.xMedidor), r.ti, m.testblock || '', '', '', '', '',
      n(m.vab), n(m.vbc), n(m.vac), r.proyeccion.ab ?? '-', r.proyeccion.bc ?? '-', r.proyeccion.ac ?? '-', c.urbanidad || '']);
  }
  return filas;
}

// ── IMPORTAR LA HOJA "Multiplicadores" DE UN EXCEL YA HECHO ──

const NUMERICOS = ['tensionTap', 'tensionBT', 'xMedidor', 'vab', 'vbc', 'vac'];
const enLista = (v, lista) => lista.find(x => normalizar(x) === normalizar(v)) || '';

// filas: hoja con encabezados ESTADO, Código SIGET, NC, Configuración, Posición de TAP, ...
// Las columnas calculadas (ECAMEC, DRANETZ, TI, proyecciones) no se leen: la app las calcula.
export function leerMultiplicadoresExcel(filas) {
  let h = -1;
  for (let i = 0; i < Math.min(filas.length, 20) && h < 0; i++) {
    const enc = (filas[i] || []).map(normalizar);
    if (enc.includes('ESTADO') && enc.includes('CODIGO SIGET')) h = i;
  }
  if (h < 0) return { error: 'No se encontró la hoja de multiplicadores (columnas "ESTADO" y "Código SIGET")' };
  const enc = filas[h].map(normalizar);
  const busca = inicio => enc.findIndex(e => e.startsWith(inicio));
  const proy = busca('PROYECCION PRIMARIO AB');
  const col = {
    estado: enc.indexOf('ESTADO'), codigo: enc.indexOf('CODIGO SIGET'), nc: enc.indexOf('NC'), configuracion: busca('CONFIGURACION'),
    tap: busca('POSICION DE TAP'), tensionTap: busca('NIVEL DE TENSION SEGUN TAP'), tensionBT: busca('NIVEL DE BAJA TENSION'),
    xMedidor: busca('X MEDIDOR'), testblock: busca('TESTBLOCK'),
    instalacion: busca('FECHA DE INSTALACION'), retiro: busca('FECHA DE RETIRO'), equipo: enc.indexOf('EQUIPO'),
    // Vab, Vbc y Vac van justo antes de las proyecciones (en el Excel del equipo a veces sin título)
    vab: enc.indexOf('VAB') >= 0 ? enc.indexOf('VAB') : (proy >= 3 ? proy - 3 : -1),
    vbc: enc.indexOf('VBC') >= 0 ? enc.indexOf('VBC') : (proy >= 2 ? proy - 2 : -1),
    vac: enc.indexOf('VAC') >= 0 ? enc.indexOf('VAC') : (proy >= 1 ? proy - 1 : -1),
  };
  const filasOk = []; const estadosRaros = new Set();
  for (const f of filas.slice(h + 1)) {
    const codigo = String(f?.[col.codigo] ?? '').replace(/[[\]#\s]/g, '').toUpperCase();
    if (!/^(CR|DA|DF)/.test(codigo)) continue;
    const celda = k => (col[k] >= 0 ? f[col[k]] : '');
    const tipo = codigo.slice(0, 2);
    const mult = {};
    const estadoTxt = String(celda('estado') ?? '').trim();
    if (estadoTxt) { mult.estado = enLista(estadoTxt, estadosDe(tipo)) || estadoTxt; if (!enLista(estadoTxt, estadosDe(tipo))) estadosRaros.add(estadoTxt); }
    const conf = enLista(celda('configuracion'), CONFIGURACIONES); if (conf) mult.configuracion = conf;
    const tap = String(celda('tap') ?? '').trim(); if (tap) mult.tap = enLista(tap, POSICIONES_TAP) || tap;
    const tb = normalizar(celda('testblock')); if (tb === 'SI' || tb === 'NO') mult.testblock = tb === 'SI' ? 'Sí' : 'No';
    // Vab/Vbc/Vac en 0 es la celda vacía del Excel
    NUMERICOS.forEach(k => { const v = celda(k); const n = num(typeof v === 'string' ? v.replace(',', '.') : v); if (n !== null && !(k.startsWith('v') && n === 0)) mult[k] = n; });
    // Programación del caso: día de instalación, retiro y equipo (las hojas Fecha del Excel salen de aquí)
    const instalacion = fechaExcel(celda('instalacion')); const retiro = fechaExcel(celda('retiro'));
    const equipo = String(celda('equipo') ?? '').trim().replace(/^0$/, '');
    if (!Object.keys(mult).length && !instalacion && !equipo) continue; // fila sin nada que importar
    filasOk.push({ codigo, nc: normalizarNC(celda('nc')), mult, instalacion, retiro, equipo });
  }
  return { filas: filasOk, estadosRaros: [...estadosRaros] };
}

// Cruza las filas con los casos guardados (mismo criterio que la programación)
export function planificarMultiplicadores(filas, campanas) {
  const porCampana = {}; const sinCaso = [];
  for (const p of filas) {
    const hit = buscarCasoImportado(p, campanas);
    if (!hit) { sinCaso.push(p); continue; }
    const actual = hit.caso.codigo || hit.caso.codigoEnte;
    (porCampana[hit.clave] ??= []).push({
      id: hit.id, codigo: actual, mult: p.mult, instalacion: p.instalacion, retiro: p.retiro, equipo: p.equipo, reemplaza: !!hit.caso.mult?.estado || !!hit.caso.mult?.tensionTap, notas: hit.caso.mult?.notas,
      codigoNuevo: p.codigo !== actual && !hit.caso.manual?.codigo ? p.codigo : null,
    });
  }
  const planes = Object.entries(porCampana).map(([clave, asignaciones]) => {
    const ids = new Set(asignaciones.map(a => a.id));
    const faltan = Object.entries(campanas[clave].casos || {}).filter(([id]) => !ids.has(id)).map(([id, c]) => c.codigo || c.codigoEnte || id).sort();
    // Cada día de instalación es una Fecha (1, 2, 3…) en orden, igual que al importar la programación.
    // El retiro de la Fecha se toma si viene en el archivo.
    const dias = [...new Set(asignaciones.map(a => a.instalacion).filter(Boolean))].sort().map((instalacion, i) => {
      const retiros = [...new Set(asignaciones.filter(a => a.instalacion === instalacion && a.retiro).map(a => a.retiro))].sort();
      return { n: String(i + 1), instalacion, retiro: retiros.at(-1) || '', casos: asignaciones.filter(a => a.instalacion === instalacion).length };
    });
    asignaciones.forEach(a => { a.fecha = dias.find(d => d.instalacion === a.instalacion)?.n || ''; });
    return { clave, asignaciones, faltan, dias };
  });
  return { planes: planes.sort((a, b) => a.clave.localeCompare(b.clave)), sinCaso };
}
