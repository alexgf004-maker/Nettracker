// Formulario de inspección de las instalaciones del usuario (uno por reclamo, en reclamos/{id}/inspeccion).
// Se llena en sitio, genera el PDF del formulario (js/pdf/inspeccion.js) y alimenta la sección 3 del borrador.
// Reglas confirmadas por el equipo:
//   - Subestación monofásica: un transformador, secundario monofásico. Bifásica: dos transformadores (los kVA se
//     suman); secundario delta abierta o estrella de 2 hilos. Trifásica: banco de tres o una unidad trifásica;
//     secundario delta o estrella. Se anota también la conexión del primario.
//   - Resistencia de puesta a tierra: hasta 25 Ω CUMPLE (NEC 2008, 250.56), arriba NO CUMPLE.
//   - Equipo dañado con rango de voltaje de placa: NO CUMPLE si la tensión estuvo fuera del rango más del 5 % del
//     tiempo en alguna fase. Se compara con el secundario equivalente si la medición es en MT con relación TP; si
//     no, con la tensión medida. Opcional ×√3 cuando la placa es fase-fase y la medición fase-neutro.
//   - Fotos fuera de la app. Firmas en pantalla o en blanco para firmar a mano.

export const LIMITE_TIERRA = 25; // Ω
export const UMBRAL_EQUIPO = 0.05; // fracción del tiempo fuera del rango de placa
export const OTRA = 'Otra';

export const TIPOS_SUBESTACION = { mono: 'Monofásica', bi: 'Bifásica', tri: 'Trifásica' };
export const CONSTRUCCION_TRI = { banco: 'Banco de 3 transformadores', unidad: 'Transformador trifásico (1 unidad)' };
export const MONTAJES = ['Poste', 'Pedestal (pad mounted)', 'Caseta o cuarto eléctrico', 'Plataforma o piso'];
export const CONEXIONES_PRI = {
  mono: ['Fase-neutro', 'Fase-fase'],
  bi: ['Estrella abierta', 'Delta abierta'],
  tri: ['Estrella', 'Estrella aterrizada', 'Delta'],
};
export const CONEXIONES_SEC = {
  mono: ['Monofásica'],
  bi: ['Delta abierta', 'Estrella de 2 hilos'],
  tri: ['Delta', 'Estrella'],
};

// Checklists (clave → texto). Lo que no se marca sale como casilla vacía en el formulario.
export const PROTECCIONES = {
  principal: 'Interruptor principal termomagnético',
  derivados: 'Interruptores derivados',
  dps: 'Supresor de transitorios (DPS / TVSS)',
  perdidaFase: 'Relé de pérdida o falla de fase',
  voltaje: 'Relé de sobre/baja tensión',
  desbalance: 'Relé de desbalance de fases',
  guardamotor: 'Guardamotor o relé térmico',
  diferencial: 'Protección diferencial (GFCI / RCD)',
  regulador: 'Regulador de voltaje',
  ups: 'UPS',
  barraTierra: 'Barra de tierra conectada',
  rotulado: 'Circuitos rotulados',
};
export const CONDICIONES_TABLERO = {
  limpio: 'Limpio y ordenado',
  polvo: 'Polvo o material particulado',
  corrosion: 'Corrosión',
  humedad: 'Humedad o filtraciones',
  calentamiento: 'Puntos calientes o evidencia de sobrecalentamiento',
  conexiones: 'Conexiones flojas o deterioradas',
  quemado: 'Evidencia de arco o componentes quemados',
  abierto: 'Tablero sin tapa o expuesto',
};
export const INSTALACION_GENERAL = {
  planta: 'Planta de emergencia',
  transferencia: 'Transferencia automática',
  capacitores: 'Banco de capacitores',
  solar: 'Sistema fotovoltaico',
  trafosSecos: 'Transformadores secos',
  mediaTension: 'Cargas en media tensión',
};
export const CARGAS = {
  motores: 'Motores',
  vfd: 'Variadores de frecuencia',
  clima: 'Aire acondicionado / chiller',
  computo: 'Equipo de cómputo / servidores',
  led: 'Iluminación LED',
  soldadoras: 'Soldadoras',
  hornos: 'Hornos o resistencias',
  refrigeracion: 'Refrigeración',
  bombeo: 'Bombeo',
};
export const LECTURAS = [['v1n', 'V L1-N'], ['v2n', 'V L2-N'], ['v3n', 'V L3-N'], ['v12', 'V L1-L2'], ['v23', 'V L2-L3'], ['v31', 'V L3-L1'], ['i1', 'I L1'], ['i2', 'I L2'], ['i3', 'I L3'], ['in', 'I N']];
export const BASES_EQUIPO = { directa: 'Tensión tal cual', ff: '×√3 (placa fase-fase, medición fase-neutro)' };
export const ROLES_FIRMA = { inspector1: 'Inspector CPT', inspector2: 'Inspector CPT', acompanante: 'Por parte del usuario' };

const num = v => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

// Listas guardadas como objetos con claves de push → arreglo con su clave, en el orden en que se agregaron
export const lista = obj => Object.entries(obj || {}).map(([id, x]) => ({ id, ...x })).sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.id.localeCompare(b.id));
export const marcados = (obj, catalogo) => Object.keys(catalogo).filter(k => obj?.[k]);

// Cantidad de transformadores según el tipo
export function cantidadTrafos(sub = {}) {
  if (sub.tipo === 'mono') return 1;
  if (sub.tipo === 'bi') return 2;
  if (sub.tipo === 'tri') return sub.construccion === 'unidad' ? 1 : 3;
  return 0;
}
// kVA de cada transformador (los que corresponden al tipo) y el total
export function kvasTrafos(sub = {}) {
  const n = cantidadTrafos(sub);
  return Array.from({ length: n }, (_, i) => num(sub.kvas?.[i + 1]));
}
export function kvaTotal(sub = {}) {
  const v = kvasTrafos(sub).filter(x => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) : null;
}
// Conexión elegida (con "Otra" se usa lo escrito)
export const conexion = (sub = {}, lado) => (sub[lado] === OTRA ? sub[lado + 'Otra'] || '' : sub[lado] || '');

export function veredictoTierra(ohm) {
  const v = num(ohm);
  return v === null ? null : v <= LIMITE_TIERRA ? 'CUMPLE' : 'NO CUMPLE';
}

// ¿Tiene la inspección algo capturado?
export function inspeccionVacia(insp) {
  if (!insp) return true;
  const lleno = v => v && (typeof v !== 'object' || Object.values(v).some(lleno));
  return !Object.entries(insp).some(([k, v]) => k !== 'firmas' && lleno(v));
}

// Firmas que faltan (nombre sin firma en pantalla): se firman a mano en el impreso
export const firmasEnBlanco = insp => Object.keys(ROLES_FIRMA).filter(r => insp?.firmas?.[r]?.nombre && !insp.firmas[r].img);

// Tensión del equipo frente a su rango de placa.
// U: { fase: { v: [...] } } de leerTension; factor: relación TP (1 si no aplica); base: 'directa' | 'ff'
export function tensionVsEquipo(U, fases, { vmin, vmax, base = 'directa' }, factor = 1) {
  const lo = num(vmin); const hi = num(vmax);
  if (lo === null || hi === null || hi <= lo) return null;
  const k = (base === 'ff' ? Math.sqrt(3) : 1) / (factor || 1);
  const porFase = {};
  fases.filter(p => U[p]).forEach(p => {
    const v = U[p].v.filter(x => x !== null && x !== undefined).map(x => x * k);
    const arriba = v.filter(x => x > hi).length; const abajo = v.filter(x => x < lo).length;
    porFase[p] = { n: v.length, arriba, abajo, pArriba: v.length ? arriba / v.length : 0, pAbajo: v.length ? abajo / v.length : 0,
      max: v.length ? Math.max(...v) : null, min: v.length ? Math.min(...v) : null, prom: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null };
  });
  const peor = Math.max(0, ...Object.values(porFase).map(x => x.pArriba + x.pAbajo));
  return { vmin: lo, vmax: hi, porFase, peor, cumple: peor <= UMBRAL_EQUIPO };
}
