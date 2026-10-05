// Expedientes de reclamo: crear desde el correo de DELSUR, editar datos, ubicar al usuario
// y registrar la instalación de cada medición.
import { db, ref, remove, set, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { userArea } from '../config.js';
import { emptyForm } from '../utils.js';
import { CAMPOS_RECLAMO, claveExpediente, DIAS_RETIRO_RECLAMO, leerCorreoReclamo, partesCodigoRE } from '../domain/expedientes.js';
import { coordenadaValida } from '../domain/listados.js';
import { hoyLocal, normalizarCodigo, sumarDias } from '../domain/trabajo.js';
import { buscarCoordenadas } from './campanas.js';
import { render } from '../views/render.js';

const firma = () => ({ fecha: hoyLocal(), por: state.sesionUsuario?.nombre || '' });

// ── Nuevo reclamo ──

export function abrirNuevoReclamo() {
  state.nuevoReclamo = { texto: '', datos: Object.fromEntries(CAMPOS_RECLAMO.map(k => [k, ''])), area: userArea(), recibido: hoyLocal() };
  render();
}
export function cerrarNuevoReclamo() { state.nuevoReclamo = null; render(); }

// Al pegar el correo se llenan los campos (lo ya escrito a mano se respeta)
export function leerCorreoNuevoReclamo(texto) {
  const n = state.nuevoReclamo; if (!n) return;
  n.texto = texto;
  const leidos = leerCorreoReclamo(texto);
  for (const k of CAMPOS_RECLAMO) if (leidos[k] && !n.manual?.[k]) n.datos[k] = leidos[k];
  render();
}
export function setCampoNuevoReclamo(campo, valor) {
  const n = state.nuevoReclamo; if (!n) return;
  if (campo === 'area' || campo === 'recibido') n[campo] = valor;
  else { n.datos[campo] = valor; (n.manual ??= {})[campo] = true; }
}

export async function guardarNuevoReclamo() {
  const n = state.nuevoReclamo; if (!n) return;
  const datos = Object.fromEntries(Object.entries(n.datos).map(([k, v]) => [k, String(v || '').trim()]));
  datos.codigo = normalizarCodigo(datos.codigo);
  if (!partesCodigoRE(datos.codigo)) return showToast('El código debe ser de reclamo, por ejemplo RE182026201');
  const id = claveExpediente(datos.codigo);
  if (state.reclamos?.[id]) {
    showToast(`Ya existe el expediente de ${state.reclamos[id].codigo}`);
    state.nuevoReclamo = null; state.expedienteId = id; render();
    return;
  }
  await set(ref(db, 'reclamos/' + id), { ...datos, area: n.area, recibido: n.recibido || hoyLocal(), creado: firma() });
  state.nuevoReclamo = null; state.expedienteId = id; state.expedienteVista = 'datos';
  showToast('Reclamo creado');
  render();
  if (datos.nc) completarCoordenadasReclamo(id, { silencioso: true });
}

// ── Expediente ──

export function abrirExpediente(id) { state.expedienteId = id; state.expedienteVista = 'mediciones'; render(); }
export function cerrarExpediente() { state.expedienteId = null; render(); }
export function setExpedienteVista(vista) { state.expedienteVista = vista; render(); }

export function guardarDatoExpediente(id, campo, valor) {
  let v = String(valor ?? '').trim();
  if (campo === 'lat' || campo === 'lng') {
    if (v && Number.isNaN(Number(v))) return showToast('La coordenada debe ser un número');
    v = v ? Number(v) : null;
  }
  update(ref(db, 'reclamos/' + id), { [campo]: v === '' ? null : v });
}

// Coordenadas desde la base cargada en la app (nodo coordenadas, por NC)
export async function completarCoordenadasReclamo(id, { silencioso = false } = {}) {
  const e = state.reclamos?.[id]; if (!e?.nc) return silencioso || showToast('Escribe el NC (ID de usuario) para buscar sus coordenadas');
  const coords = await buscarCoordenadas([e.nc]);
  const c = coords[e.nc];
  if (!c || !coordenadaValida(c.lat, c.lng)) return silencioso || showToast('El NC no está en la base de coordenadas; escríbelas a mano');
  await update(ref(db, 'reclamos/' + id), { lat: c.lat, lng: c.lng });
  showToast('Coordenadas del usuario completadas');
}

// Lleva al formulario de nueva instalación con el código de la medición, la dirección y el retiro al 8.º día.
// punto: { n, nombre } para un punto adicional (medidor, trafo, tablero…): lleva el nombre como caso y queda vinculado.
export function registrarInstalacionReclamo(id, codigo, punto = null) {
  const e = state.reclamos?.[id]; if (!e) return;
  const hoy = hoyLocal();
  state.form = {
    ...emptyForm(), caso: codigo, lugar: [e.nombre, e.direccion].filter(Boolean).join(' · '),
    ...(punto ? { reclamo: { id, n: punto.n, punto: punto.nombre } } : {}),
    lat: e.lat ?? null, lng: e.lng ?? null, fechaInstalacion: hoy, fechaRetiro: sumarDias(hoy, DIAS_RETIRO_RECLAMO), areaInstalacion: e.area || userArea(),
  };
  state.volverA = { tab: 'reclamos', expedienteId: id };
  state.tab = 'instalaciones'; state.instTab = e.area === 'CPT BT' ? 'cpt_bt' : 'cpt_mt';
  state.editId = null; state.view = 'form';
  render();
}

export function eliminarExpediente(id) {
  const e = state.reclamos?.[id]; if (!e) return;
  if (!confirm(`¿Eliminar el expediente de ${e.codigo}? Las instalaciones y sus análisis no se borran.`)) return;
  remove(ref(db, 'reclamos/' + id)).then(() => showToast('Expediente eliminado'));
  state.expedienteId = null; render();
}

// ── Puntos adicionales de una medición ──

export function abrirPuntoReclamo(id, n) { state.puntoReclamo = { id, n, nombre: '' }; render(); }
export function cerrarPuntoReclamo() { state.puntoReclamo = null; render(); }
export function setNombrePunto(v) { if (state.puntoReclamo) state.puntoReclamo.nombre = v; }

const nombrePunto = () => {
  const nombre = String(state.puntoReclamo?.nombre || '').trim();
  if (!nombre) showToast('Escribe el nombre del punto (medidor, trafo, tablero principal…)');
  return nombre;
};

// Instalación nueva para el punto: el nombre va como caso (así lo anotan en campo)
export function registrarPuntoReclamo() {
  const p = state.puntoReclamo; const nombre = nombrePunto(); if (!p || !nombre) return;
  state.puntoReclamo = null;
  registrarInstalacionReclamo(p.id, nombre.replace(/\s+/g, '').toLowerCase(), { n: p.n, nombre });
}

// Instalación que ya existe (registrada con un nombre libre): se vincula al expediente
export function vincularPuntoReclamo(instId) {
  const p = state.puntoReclamo; const nombre = nombrePunto(); if (!p || !nombre) return;
  update(ref(db, 'analizadores/' + instId), { reclamo: { id: p.id, n: p.n, punto: nombre } }).then(() => showToast('Punto vinculado al reclamo'));
  state.puntoReclamo = null; render();
}

export function desvincularPuntoReclamo(instId) {
  if (!confirm('¿Quitar este punto del reclamo? La instalación y su análisis no se borran.')) return;
  update(ref(db, 'analizadores/' + instId), { reclamo: null }).then(() => showToast('Punto quitado del reclamo'));
}
