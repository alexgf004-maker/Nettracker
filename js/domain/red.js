// Datos técnicos de la red para Dibujar y Levantamiento: altura de los postes, estructuras (primaria, secundaria,
// neutro y anclas, con los códigos de los pliegos de estructuras) y conductor de los tramos (calibre y tipo).
// Funciones puras.

export const ALTURAS_POSTE = [26, 35, 40, 50, 55, 60]; // pies
export const CALIBRES = ['#6', '#4', '#2', '#1/0', '#2/0'];
export const TIPOS_CONDUCTOR = ['ACSR', 'Triplex', 'Cuádruplex', 'Aluminio desnudo', 'Cobre'];
const ABREV_CONDUCTOR = { ACSR: 'ACSR', Triplex: 'Tpx', Cuádruplex: 'Cpx', 'Aluminio desnudo': 'Al', Cobre: 'Cu' };

// Pliegos de estructuras. El sufijo 1/2/3 sale tal cual del pliego (no se interpreta).
const serie = (base, nombre, sufijos = [1, 2, 3]) => sufijos.map(n => ({ codigo: `${base}${n}`, nombre }));
export const ESTRUCTURAS = [
  { grupo: 'Primaria (MT)', items: [
    ...serie('23TS', 'Tangente sencilla'), ...serie('23TD', 'Tangente doble'), ...serie('23TA', 'Tangente asimétrica'),
    ...serie('23TDA', 'Tangente doble asimétrica'), ...serie('23VS', 'Volada sencilla'), ...serie('23VD', 'Volada doble'),
    ...serie('23CH', 'Corte horizontal'), ...serie('23RH', 'Remate horizontal'), ...serie('23PF', 'Prolongación de fases'),
    ...serie('23CD', 'Cruce horizontal doble remate'), ...serie('23CV', 'Cruce vertical sencillo'), ...serie('23CR', 'Cruce vertical doble remate'),
    ...serie('23DH', 'Derivación horizontal'), ...serie('23DC', 'Derivación con cortacircuitos'), ...serie('23DS', 'Derivación con seccionadores', [2, 3]),
    ...serie('23PL', 'Pararrayos de línea'),
  ] },
  { grupo: 'Secundaria (BT)', items: [
    ...serie('TS', 'Tangente secundaria'), ...serie('TD', 'Tangente secundaria con derivación', [1, 2]), ...serie('CS', 'Corte secundario'),
    ...serie('CD', 'Corte secundario con derivación'), ...serie('CE', 'Corte secundario empuentado'), ...serie('RS', 'Remate secundario'),
    ...serie('PS', 'Prolongación secundaria'), ...serie('CR', 'Cruce doble remate secundario', [1, 2]), ...serie('DS', 'Derivación secundaria'),
  ] },
  { grupo: 'Neutro', items: [
    { codigo: 'TN', nombre: 'Tangente para neutro' }, { codigo: 'TD', nombre: 'Tangente con derivación para neutro' }, { codigo: 'CN', nombre: 'Corte para neutro' },
    { codigo: 'RN', nombre: 'Remate para neutro' }, { codigo: 'PN', nombre: 'Prolongación para neutro' }, { codigo: 'CV', nombre: 'Cruce vertical sencillo para neutro' },
    { codigo: 'CR', nombre: 'Cruce doble remate para neutro' }, { codigo: 'DN', nombre: 'Derivación para neutro' },
  ] },
  { grupo: 'Anclas', items: [{ codigo: 'PS', nombre: 'Ancla primaria sencilla' }, { codigo: 'PD', nombre: 'Ancla primaria doble' }] },
];
export const nombreEstructura = codigo => ESTRUCTURAS.flatMap(g => g.items).find(i => i.codigo === codigo)?.nombre || '';

// Texto corto: "35'", "23TS3 / TS3", "#2 ACSR"
export const textoAltura = a => (a ? `${a}'` : '');
export const textoEstructuras = lista => (lista || []).filter(Boolean).join(' / ');
export function textoConductor(c) {
  if (!c?.calibre && !c?.tipo) return '';
  return [c.calibre, ABREV_CONDUCTOR[c.tipo] || c.tipo].filter(Boolean).join(' ');
}
// Conductor de un vano: el propio (si se le cambió el calibre) o el del tramo
export function conductorVano(t, i) {
  const propio = t.calibres?.[i];
  return propio ? { ...(t.conductor || {}), calibre: propio } : t.conductor || null;
}
// Lo que sale junto a un poste en el plano según lo que se elige mostrar en la lámina
export function textoPoste(el, { altura = true, estructuras = true } = {}) {
  return [altura ? textoAltura(el.altura) : '', estructuras ? textoEstructuras(el.estructuras) : ''].filter(Boolean).join(' · ');
}
// Altura escrita a mano: solo el número de pies
export function leerAltura(v) {
  const n = Number(String(v ?? '').replace(/[^\d.,]/g, '').replace(',', '.'));
  return n > 0 && n < 200 ? n : null;
}
