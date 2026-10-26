// Análisis de un reclamo: subir los TXT, ajustar los datos de la medición y guardarlo en el reclamo.
// Los TXT se guardan comprimidos en archivosReclamo/{id} (se leen solo al abrir el análisis) y en el
// reclamo queda lo mínimo: datos de la medición, nombres de los archivos y el resultado.
import { db, get, ref, update } from '../firebase.js';
import { nuevaProyeccionTap, PLACAS_TAP } from '../domain/tap.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { campoDeMinutos, catalogoSeries, factorMultiplicador, fasesConTension, fasesDe, leerTension, MAX_UNIDADES_COMBO, resumenGuardado, sugerirNominal, tipoDeTXT } from '../domain/reclamo.js';
import { hoyLocal, normalizarCodigo } from '../domain/trabajo.js';
import { minutosDeFecha } from '../domain/analisis.js';
import { analisisActivo, calculoReclamo, periodoParcial } from '../views/analisis-reclamo.js';
import { userArea } from '../config.js';
import { render } from '../views/render.js';

// ── Compresión (gzip + base64) para no guardar 2 MB de texto por reclamo ──
export async function comprimir(texto) {
  const datos = await new Response(new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const bytes = new Uint8Array(datos); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export async function descomprimir(b64) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}

const paramsIniciales = r => ({
  usuario: '', fases: 3, nominal: '', red: r.areaInstalacion === 'CPT BT' ? 'urbano_bt' : 'urbano_mt', kva: '', vll: '',
});

// Análisis parcial (pedido del equipo): con el TXT de una descarga mientras el equipo sigue en campo. Se guarda aparte
// (analisisParcial y archivosReclamo/{id}/parcial): no decide el FT ni cuenta para plazos; el del retiro lo reemplaza.
const rutaArchivos = (id, parcial) => 'archivosReclamo/' + id + (parcial ? '/parcial' : '');
export async function abrirAnalisisReclamo(id, opciones = {}) {
  const r = state.records.find(x => x.id === id); if (!r) return;
  const parcial = opciones.parcial ?? !r.retirado;
  const g = parcial ? r.analisisParcial : r.analisisReclamo;
  // El primer parcial toma los datos de la medición que ya se hubieran puesto; el final, los del parcial
  const base = g?.params || (parcial ? r.analisisReclamo?.params : r.analisisParcial?.params) || {};
  state.analisisReclamo = { id, parcial, params: { ...paramsIniciales(r), ...base }, tension: null, armonicos: null, cargando: !!g?.archivos };
  render();
  if (!g?.archivos) return;
  try {
    const snap = await get(ref(db, rutaArchivos(id, parcial)));
    const a = state.analisisReclamo; if (a?.id !== id) return;
    const guardados = snap.exists() ? snap.val() : {};
    for (const tipo of ['tension', 'armonicos']) {
      if (guardados[tipo]?.gz) a[tipo] = { nombre: guardados[tipo].nombre, texto: await descomprimir(guardados[tipo].gz) };
    }
  } catch (err) {
    if (state.analisisReclamo?.id === id) state.analisisReclamo.error = err.message;
  }
  if (state.analisisReclamo?.id === id) state.analisisReclamo.cargando = false;
  render();
}
export function cerrarAnalisisReclamo() { state.analisisReclamo = null; render(); }

const leerTexto = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = e => resolve(e.target.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsText(file);
});

export async function subirTXTReclamo(files) {
  const archivos = await Promise.all([...files].map(async f => ({ nombre: f.name, texto: await leerTexto(f) })));
  cargarTXTReclamo(archivos);
}

// archivos: [{ nombre, texto }] (separado de la lectura para poder probarlo sin archivos)
export function cargarTXTReclamo(archivos) {
  const a = analisisActivo(); if (!a) return;
  const r = state.records.find(x => x.id === a.id) || {};
  const codigo = r.reclamo?.id ? '' : normalizarCodigo(r.caso); // los puntos adicionales llevan un nombre libre
  const avisos = [];
  for (const f of archivos) {
    const tipo = tipoDeTXT(f.texto);
    if (!tipo) { avisos.push(`${f.nombre} no es un TXT del ECAMEC`); continue; }
    if (codigo && !normalizarCodigo(f.nombre).startsWith(codigo)) avisos.push(`${f.nombre} no parece de ${codigo}`);
    a[tipo] = { nombre: f.nombre.replace(/\.[^.]*$/, ''), texto: f.texto };
    a.cambios = true;
  }
  // Sugerencias la primera vez: fases con tensión y nivel nominal más cercano (el usuario las confirma)
  const base = leerTension((a.tension || a.armonicos)?.texto || '');
  if (base && !a.params.nominal) {
    a.params.fases = fasesConTension(base.U);
    a.params.nominal = String(sugerirNominal(base.U) || '');
  }
  if (avisos.length) showToast(avisos.join(' · '));
  render();
}

export function setParamReclamo(campo, valor) {
  const a = analisisActivo(); if (!a) return;
  a.params[campo] = campo === 'fases' ? Number(valor) : String(valor).trim();
  // Al revertir (o dejar de revertir) un multiplicador cambia el nivel: nominal sugerido y red MT ↔ BT (se pueden corregir)
  if (campo === 'revertirV') {
    if (a.params.revertirV && !factorMultiplicador(a.params.revertirV)) showToast('Escribe el multiplicador como 22900/240 o como un número (95.42)');
    const d = calculoReclamo(a).d;
    if (d) {
      const nominal = sugerirNominal(d.U); if (nominal) a.params.nominal = String(nominal);
      const familia = Number(a.params.nominal) > 1000 ? 'mt' : 'bt';
      a.params.red = String(a.params.red || 'urbano_mt').replace(/_(mt|bt)$/, '_' + familia);
    }
  }
  a.cambios = true;
  render();
}
// Proyección con cambio de TAP (opcional): params.tapProy = { activo, red, placas[5], actual, propuesta }
export function setTapReclamo(campo, valor, i = null) {
  const a = analisisActivo(); if (!a) return;
  const t = a.params.tapProy = { ...nuevaProyeccionTap(), ...(a.params.tapProy || {}) };
  if (campo === 'placa') { t.placas = [...t.placas]; t.placas[i] = String(valor).trim(); } else t[campo] = campo === 'activo' ? !!valor : String(valor);
  // Al elegir la red se llenan sus placas predeterminadas (se pueden corregir)
  if (campo === 'red' && PLACAS_TAP[valor]) t.placas = PLACAS_TAP[valor].v.map(x => (x ? String(x) : ''));
  a.cambios = true;
  render();
}
// Recortar la medición: params.recorte = { desde, hasta } (fecha y hora del campo; vacío = sin límite)
export function setRecorteReclamo(campo, valor) {
  const a = analisisActivo(); if (!a) return;
  const r = { ...(a.params.recorte || {}), [campo]: String(valor || '') };
  if (r.desde && r.hasta && r.desde > r.hasta) return showToast('"Desde" tiene que ser antes de "Hasta"');
  a.params.recorte = r.desde || r.hasta ? r : null; a.zoom = null; a.cambios = true;
  render();
}
// El tramo que se ve en la gráfica acercada pasa a ser el recorte
export function recorteDelZoomReclamo() {
  const a = analisisActivo(); const c = calculoReclamo(a); if (!a?.zoom) return;
  const base = minutosDeFecha((c.d || c.arm)?.inicio); if (!base) return;
  a.params.recorte = { desde: campoDeMinutos(base + Math.floor(a.zoom.desde)), hasta: campoDeMinutos(base + Math.ceil(a.zoom.hasta)) };
  a.zoom = null; a.cambios = true;
  render();
}
export function quitarRecorteReclamo() { const a = analisisActivo(); if (!a) return; a.params.recorte = null; a.zoom = null; a.cambios = true; render(); }
export function setVistaReclamo(vista) { const a = analisisActivo(); if (a) { a.vista = vista; render(); } }

export async function guardarAnalisisReclamo() {
  const a = state.analisisReclamo; if (!a || a.guardando) return;
  if (!a.tension && !a.armonicos) return showToast('Sube al menos un TXT');
  const c = calculoReclamo(a);
  a.guardando = true; render();
  try {
    const archivos = {};
    for (const tipo of ['tension', 'armonicos']) if (a[tipo]) archivos[tipo] = { nombre: a[tipo].nombre, gz: await comprimir(a[tipo].texto) };
    await update(ref(db, rutaArchivos(a.id, a.parcial)), archivos);
    const guardado = {
      params: a.params,
      archivos: Object.fromEntries(Object.entries(archivos).map(([k, v]) => [k, v.nombre])),
      resultado: resumenGuardado(c.t, c.arm),
      fecha: hoyLocal(), por: state.sesionUsuario?.nombre || '',
    };
    // Parcial: hasta cuándo llegan los datos de la descarga
    if (a.parcial) { const p = periodoParcial(c); if (p) Object.assign(guardado, p); }
    await update(ref(db, 'analizadores/' + a.id), { [a.parcial ? 'analisisParcial' : 'analisisReclamo']: guardado });
    a.cambios = false;
    showToast(a.parcial ? 'Análisis parcial guardado (no decide el FT)' : 'Análisis guardado en el reclamo');
  } catch (err) {
    showToast('No se pudo guardar: ' + err.message);
  }
  a.guardando = false;
  render();
}

// ── Graficar (pestaña rápida, sin reclamo y sin guardar) ──
export const nuevoGraficar = () => ({ id: null, params: paramsIniciales({ areaInstalacion: userArea() }), tension: null, armonicos: null });
export function limpiarGraficar() { state.graficar = nuevoGraficar(); render(); }

// ── Zoom, escala y gráficas combinadas ──
export function setZoomReclamo(desde, hasta) {
  const a = analisisActivo(); if (!a || hasta - desde < 20) return; // menos de 20 minutos no se acerca más
  a.zoom = { desde: Math.round(desde), hasta: Math.round(hasta) }; render();
}
export function restablecerZoomReclamo() { const a = analisisActivo(); if (a) { a.zoom = null; render(); } }
export function toggleEscalaReclamo() { const a = analisisActivo(); if (a) { a.escalaCompleta = !a.escalaCompleta; render(); } }

export function toggleSerieComboReclamo(clave) {
  const a = analisisActivo(); if (!a) return;
  const sel = a.comboSel || [];
  if (sel.includes(clave)) a.comboSel = sel.filter(k => k !== clave);
  else {
    // Máximo dos unidades por gráfica (la segunda va en el eje derecho)
    const cat = catalogoSeries(calculoReclamo(a).d, fasesDe(a.params.fases || 3));
    const unidad = k => cat.find(c => c.clave === k)?.unidad;
    const unidades = new Set([...sel, clave].map(unidad));
    if (unidades.size > MAX_UNIDADES_COMBO) return showToast('Una gráfica combinada admite dos unidades como máximo (una por eje)');
    a.comboSel = [...sel, clave];
  }
  render();
}
export function limpiarComboReclamo() { const a = analisisActivo(); if (a) { a.comboSel = []; render(); } }
export function agregarComboReclamo() {
  const a = analisisActivo(); if (!a?.comboSel?.length) return;
  a.params.combinadas = [...(a.params.combinadas || []), [...a.comboSel]];
  a.comboSel = []; a.cambios = true;
  render();
}
export function quitarComboReclamo(i) {
  const a = analisisActivo(); if (!a) return;
  a.params.combinadas = (a.params.combinadas || []).filter((_, k) => k !== i); a.cambios = true;
  render();
}
