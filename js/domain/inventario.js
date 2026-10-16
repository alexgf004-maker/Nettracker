// Reglas del inventario de analizadores (funciones puras: reciben los equipos y las instalaciones).
// - Cada equipo es de un área (CPT MT o CPT BT): el préstamo sale de esa área y la devolución regresa a ella.
// - Quién lo tiene: si está prestado, el área del último préstamo; si no, su área dueña.
// - Se pueden prestar los que están en Bueno o Con detalles (con aviso); no los de mantenimiento o fuera de servicio.
// - Un equipo despachado a Campos y Servicios se devuelve solo al retirarse de campo.
// - Un equipo instalado también se presta o se devuelve (pedido del equipo: a veces se instala antes de hacer el memo):
//   queda registrado el movimiento, sigue instalado en su caso y su ubicación no cambia hasta que se retire.
import { areaToSede } from '../utils.js';

export const AREAS_DUENAS = ['CPT MT', 'CPT BT'];
export const AREAS_MOVIMIENTO = ['CPT MT', 'CPT BT', 'CPT DELSUR', 'Campos y Servicios'];
export const CAMPOS = 'Campos y Servicios';

export const instalacionActiva = (eq, registros) => registros.find(r => r.equipoId === eq.id && !r.retirado) || null;
export const ultimoPrestamo = eq => [...(eq.movimientos || [])].reverse().find(m => m.tipo === 'prestamo') || null;
export const tenedor = eq => (eq.prestado ? ultimoPrestamo(eq)?.a || eq.prestadoA || 'Otra área' : eq.area || null);
const condicion = eq => eq.condicion || 'bueno';

// Estado principal del equipo (uno solo) para la lista y la ficha
export function estadoEquipo(eq, registros) {
  const inst = instalacionActiva(eq, registros);
  const base = { inst, tenedor: tenedor(eq), conDetalles: condicion(eq) === 'detalles' };
  if (inst) return { ...base, clave: 'campo', label: 'En campo' };
  if (condicion(eq) === 'fuera') return { ...base, clave: 'fuera', label: 'Fuera de servicio' };
  if (condicion(eq) === 'mantenimiento') return { ...base, clave: 'mantenimiento', label: 'En mantenimiento' };
  if (eq.prestado) return { ...base, clave: 'prestado', label: base.tenedor === CAMPOS ? 'Con Campos y Servicios' : `Prestado a ${base.tenedor}` };
  return { ...base, clave: 'disponible', label: 'Disponible' };
}

// Por qué no se puede prestar (null = sí se puede).
// A Campos y Servicios se le entregan equipos de la bodega (Cucumacayán) aunque sean de otra área: CPT MT puede
// entregar equipos de CPT BT; al retirarse regresan solos a su área. Entre áreas, el préstamo sale del área dueña.
export function motivoNoPrestamo(eq, de, registros, a = '') {
  if (!eq.area) return 'Sin área asignada';
  if (eq.area !== de && a !== CAMPOS) return `Es de ${eq.area}`;
  if (eq.prestado) { const t = tenedor(eq); return t === CAMPOS ? 'Con Campos y Servicios' : `Prestado a ${t}`; }
  if (instalacionActiva(eq, registros)) return null; // en campo sí se presta
  const e = estadoEquipo(eq, registros);
  if (e.clave === 'fuera' || e.clave === 'mantenimiento') return e.label;
  return null;
}

// Por qué no se puede devolver de `de` a `para` (null = sí se puede)
export function motivoNoDevolucion(eq, de, para, registros) {
  if (!eq.prestado) return 'No está prestado';
  const t = tenedor(eq);
  if (t !== de) return `Lo tiene ${t}`;
  if (!eq.area) return 'Sin área asignada';
  if (eq.area !== para) return `Es de ${eq.area}`;
  return null;
}

export const motivoNoMovimiento = (eq, { tipo, de, a }, registros) =>
  tipo === 'prestamo' ? motivoNoPrestamo(eq, de, registros, a) : motivoNoDevolucion(eq, de, a, registros);

// Sede donde queda el equipo después del movimiento (Campos y Servicios los regresa a la Cucumacayán)
export function sedeDespues({ tipo, de, a }) {
  if (tipo === 'devolucion' && de === CAMPOS) return 'Subestación Cucumacayán';
  return areaToSede(a);
}

// Datos que cambian en el equipo al registrar el movimiento (instalado: la ubicación no cambia hasta que se retire)
export function aplicarMovimiento(eq, mov, { instalado = false } = {}) {
  const movimientos = [...(eq.movimientos || []), mov];
  const sede = instalado ? {} : { sede: sedeDespues(mov) };
  return mov.tipo === 'prestamo'
    ? { prestado: true, prestadoFecha: mov.fecha, ...sede, movimientos }
    : { prestado: false, prestadoFecha: null, ...sede, movimientos };
}

// Al retirar de campo: si el equipo estaba con Campos y Servicios, la devolución a su área se registra sola.
// Devuelve los datos a sumar al update del equipo (o {} si no aplica).
export function devolucionAlRetirar(eq, { caso, fecha, por }) {
  if (!eq?.prestado || tenedor(eq) !== CAMPOS) return {};
  const a = eq.area || ultimoPrestamo(eq)?.de || 'CPT MT';
  const mov = { tipo: 'devolucion', de: CAMPOS, a, fecha, nota: `Devolución automática al retirar${caso ? ' el caso #' + caso : ''}`, registradoPor: por || '', auto: true };
  const { prestado, prestadoFecha, movimientos } = aplicarMovimiento(eq, mov);
  return { prestado, prestadoFecha, movimientos };
}

// Ordenar el inventario: los equipos marcados son de CPT MT (se quedan en Plantel Central) y todos los demás son de
// CPT BT y se guardan en la Cucumacayán (la bodega). Solo se mueven de sede los que están guardados: los que están en
// campo o prestados conservan su ubicación y solo se les corrige el área. Devuelve [{ eq, cambios }] con lo que cambia.
export const SEDE_BODEGA = 'Subestación Cucumacayán';
export function planOrdenar(equipos, registros, idsMT) {
  return equipos.map(eq => {
    const area = idsMT.includes(eq.id) ? 'CPT MT' : 'CPT BT';
    const cambios = {};
    if (eq.area !== area) cambios.area = area;
    const guardado = !eq.prestado && !instalacionActiva(eq, registros);
    if (area === 'CPT BT' && guardado && eq.sede !== SEDE_BODEGA) cambios.sede = SEDE_BODEGA;
    return { eq, cambios };
  }).filter(x => Object.keys(x.cambios).length);
}

// Texto para buscar: serie, viñeta y modelo
export const coincideBusqueda = (eq, q) => !q || [eq.serie, eq.vineta, eq.modelo].some(v => String(v || '').toLowerCase().includes(q.toLowerCase()));

// Equipos que ya volvieron de campo pero siguen como prestados a Campos y Servicios (de antes de la devolución automática)
export const pendientesDevolverCampos = (equipos, registros) =>
  equipos.filter(eq => eq.prestado && tenedor(eq) === CAMPOS && !instalacionActiva(eq, registros));
