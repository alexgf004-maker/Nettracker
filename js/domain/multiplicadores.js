// Multiplicadores: cómo se programa el analizador en cada caso, según lo que se vio en campo.
// Mismas opciones y fórmulas que la hoja "Multiplicadores" del Excel del equipo. Funciones puras.

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
