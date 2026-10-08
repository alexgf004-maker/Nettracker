// Análisis de un reclamo: subir los TXT, ajustar los datos de la medición y guardarlo en el reclamo.
// Los TXT se guardan comprimidos en archivosReclamo/{id} (se leen solo al abrir el análisis) y en el
// reclamo queda lo mínimo: datos de la medición, nombres de los archivos y el resultado.
import { db, get, ref, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { catalogoSeries, fasesConTension, fasesDe, leerTension, MAX_UNIDADES_COMBO, resumenGuardado, sugerirNominal, tipoDeTXT } from '../domain/reclamo.js';
import { hoyLocal, normalizarCodigo } from '../domain/trabajo.js';
import { analisisActivo, calculoReclamo } from '../views/analisis-reclamo.js';
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

export async function abrirAnalisisReclamo(id) {
  const r = state.records.find(x => x.id === id); if (!r) return;
  const g = r.analisisReclamo;
  state.analisisReclamo = { id, params: { ...paramsIniciales(r), ...(g?.params || {}) }, tension: null, armonicos: null, cargando: !!g?.archivos };
  render();
  if (!g?.archivos) return;
  try {
    const snap = await get(ref(db, 'archivosReclamo/' + id));
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
  a.cambios = true;
  render();
}
export function setVistaReclamo(vista) { const a = analisisActivo(); if (a) { a.vista = vista; render(); } }

export async function guardarAnalisisReclamo() {
  const a = state.analisisReclamo; if (!a || a.guardando) return;
  if (!a.tension && !a.armonicos) return showToast('Sube al menos un TXT');
  const c = calculoReclamo(a);
  a.guardando = true; render();
  try {
    const archivos = {};
    for (const tipo of ['tension', 'armonicos']) if (a[tipo]) archivos[tipo] = { nombre: a[tipo].nombre, gz: await comprimir(a[tipo].texto) };
    await update(ref(db, 'archivosReclamo/' + a.id), archivos);
    await update(ref(db, 'analizadores/' + a.id), {
      analisisReclamo: {
        params: a.params,
        archivos: Object.fromEntries(Object.entries(archivos).map(([k, v]) => [k, v.nombre])),
        resultado: resumenGuardado(c.t, c.arm),
        fecha: hoyLocal(), por: state.sesionUsuario?.nombre || '',
      },
    });
    a.cambios = false;
    showToast('Análisis guardado en el reclamo');
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
