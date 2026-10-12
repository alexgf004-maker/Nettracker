// Levantamiento de red en campo (levantamientos/{id}, se guarda en la base y lo ve el equipo; independiente, con
// referencia libre). Mapa Leaflet con calles o satélite y la ubicación GPS en vivo; "Poste aquí" marca un punto en la
// posición actual y lo une con el anterior. El mapa se crea una sola vez y se vuelve a colocar tras cada render().
import { db, push, ref, remove, update } from '../firebase.js';
import { SIMBOLOS } from '../domain/dibujo.js';
import { aDibujo, kmlLevantamiento, listaPuntos, listaVanos, metrosDeVano, nuevaPantallaLev, PRECISION_BAJA, siguienteNombre } from '../domain/levantamiento.js';
import { TIPOS_TRAMO } from '../domain/plano.js';
import { hoyLocal } from '../domain/trabajo.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { alRedibujar, render } from '../views/render.js';
import { cargarEnDibujo } from './dibujo.js';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/';
const CAPAS = {
  calles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }],
  satelite: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' }],
};
const ruta = (id, sub = '') => `levantamientos/${id}${sub ? '/' + sub : ''}`;
const lev = () => (state.levId ? state.levantamientos?.[state.levId] : null);
const ui = () => state.lev;
const por = () => state.sesionUsuario?.nombre || '';

// ── Lista ──
export function crearLevantamiento() {
  const nombre = document.getElementById('lev-nombre')?.value.trim();
  if (!nombre) return showToast('Ponle un nombre al levantamiento');
  const referencia = document.getElementById('lev-referencia')?.value.trim() || '';
  const { key } = push(ref(db, 'levantamientos'), { nombre, referencia, creado: { fecha: hoyLocal(), por: por() } });
  abrirLevantamiento(key);
}
export function abrirLevantamiento(id) { state.levId = id; state.lev = nuevaPantallaLev(); render(); }
export function cerrarLevantamiento() { state.levId = null; state.lev = null; detenerGPS(); render(); }
export function eliminarLevantamiento() {
  const l = lev(); if (!l) return;
  if (!confirm(`¿Eliminar el levantamiento "${l.nombre}"? Se borra para todo el equipo.`)) return;
  remove(ref(db, ruta(state.levId)));
  cerrarLevantamiento();
}
export function guardarDatoLev(campo, valor) { if (state.levId) update(ref(db, ruta(state.levId)), { [campo]: String(valor || '').trim() }); }

// ── GPS ──
let vigilancia = null;
export function iniciarGPS() {
  if (vigilancia !== null || !navigator.geolocation) return;
  vigilancia = navigator.geolocation.watchPosition(p => {
    state.gps = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, t: Date.now() };
    pintarGPS();
  }, err => {
    state.gps = { error: err.code === 1 ? 'Sin permiso de ubicación: actívalo en el navegador' : 'No se pudo obtener la ubicación' };
    pintarGPS();
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
}
export function detenerGPS() { if (vigilancia !== null) navigator.geolocation.clearWatch(vigilancia); vigilancia = null; }
function textoGPS() {
  const g = state.gps;
  if (!g) return { clase: 'gris', texto: 'Buscando señal GPS…' };
  if (g.error) return { clase: 'rojo', texto: g.error };
  return { clase: g.acc <= 6 ? 'verde' : g.acc <= PRECISION_BAJA ? 'ambar' : 'rojo', texto: `GPS ±${Math.round(g.acc)} m` };
}
function pintarGPS() {
  const t = textoGPS(); const el = document.getElementById('lev-gps');
  if (el) { el.className = `tg ${t.clase}`; el.textContent = t.texto; }
  if (!mapa || !state.gps?.lat) return;
  const ll = [state.gps.lat, state.gps.lng];
  if (!yo) {
    yoCirculo = L.circle(ll, { radius: state.gps.acc, color: '#2563eb', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(mapa);
    yo = L.circleMarker(ll, { radius: 8, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1, interactive: false }).addTo(mapa);
  } else { yo.setLatLng(ll); yoCirculo.setLatLng(ll).setRadius(state.gps.acc); }
  if (ui()?.seguir) mapa.setView(ll, Math.max(mapa.getZoom() || 0, 18), { animate: false });
}

// ── Mapa (Leaflet, se carga solo al abrir un levantamiento) ──
let cargaLeaflet = null; let mapa = null; let contenedor = null; let capaFondo = null; let capaRed = null; let yo = null; let yoCirculo = null; let fondoActual = null;
function cargarLeaflet() {
  if (window.L?.map && window.L?.version) return Promise.resolve();
  cargaLeaflet ??= new Promise((resolve, reject) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET + 'leaflet.css'; document.head.appendChild(css);
    const js = document.createElement('script'); js.src = LEAFLET + 'leaflet.js'; js.onload = resolve; js.onerror = () => { cargaLeaflet = null; reject(new Error('sin mapa')); };
    document.head.appendChild(js);
  });
  return cargaLeaflet;
}
async function montarMapa() {
  const lugar = document.getElementById('lev-mapa');
  if (!lugar || !state.levId) { detenerGPS(); return; } // fuera del levantamiento no se usa el GPS
  iniciarGPS();
  if (contenedor) {
    if (lugar !== contenedor) { lugar.replaceWith(contenedor); mapa?.invalidateSize(); }
    if (mapa && montadoPara !== state.levId) encuadrar();
    dibujarRed(); actualizarSeguir(); return;
  }
  contenedor = document.createElement('div'); contenedor.id = 'lev-mapa'; contenedor.className = 'lev-mapa';
  lugar.replaceWith(contenedor);
  iniciarGPS();
  try { await cargarLeaflet(); } catch {
    contenedor.innerHTML = '<div class="lev-sin-mapa">Sin conexión para cargar el mapa. Puedes seguir marcando puntos con el GPS; se verán al volver la señal.</div>';
    contenedor = null; return;
  }
  mapa = L.map(contenedor, { zoomControl: true, attributionControl: true }).setView([13.7, -89.2], 9);
  capaRed = L.layerGroup().addTo(mapa);
  mapa.on('click', e => alTocarMapa(e.latlng));
  mapa.on('dragstart', () => { if (ui()) { ui().seguir = false; actualizarSeguir(); } });
  encuadrar();
  dibujarRed(); pintarGPS(); actualizarSeguir();
  setTimeout(() => mapa?.invalidateSize(), 50);
}
// Al abrir un levantamiento con puntos se encuadran; uno nuevo sigue la ubicación
let montadoPara = null;
function encuadrar() {
  montadoPara = state.levId;
  const puntos = listaPuntos(lev());
  if (puntos.length) { mapa.fitBounds(puntos.map(p => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 19 }); if (ui()) ui().seguir = false; }
}
// Se registra desde handlers/levantamiento.js (cuando todos los módulos ya cargaron)
export function instalarMapaLev() { alRedibujar(() => { montarMapa(); }); }

const COLOR_PUNTO = { poste: '#111827', poste_nuevo: '#2563eb', trafo: '#15803d', trafo_nuevo: '#2563eb', banco: '#15803d', usuario: '#dc2626', medidor_red: '#0f172a', seccionador: '#ea580c', medicion: '#f59e0b' };
function icono(p, { actual, sel }) {
  const s = SIMBOLOS[p.tipo] || SIMBOLOS.poste; const c = COLOR_PUNTO[p.tipo] || '#111827';
  return L.divIcon({
    className: 'lev-icono', iconSize: [30, 30], iconAnchor: [15, 15],
    html: `<div class="lev-punto ${actual ? 'actual' : ''} ${sel ? 'sel' : ''}"><svg viewBox="-4 -4 68 68" width="26" height="26" color="${c}" stroke="${c}" stroke-width="3" fill="none">${s.svg}</svg><span>${String(p.nombre || '').replace(/</g, '&lt;')}</span></div>`,
  });
}
function dibujarRed() {
  const l = lev(); const u = ui();
  if (!mapa || !capaRed || !l || !u) return;
  if (fondoActual !== u.fondo) {
    if (capaFondo) mapa.removeLayer(capaFondo);
    capaFondo = L.tileLayer(CAPAS[u.fondo][0], CAPAS[u.fondo][1]).addTo(mapa); capaFondo.bringToBack(); fondoActual = u.fondo;
  }
  capaRed.clearLayers();
  listaVanos(l).forEach(v => {
    const a = l.puntos?.[v.a]; const b = l.puntos?.[v.b]; if (!a || !b) return;
    const t = TIPOS_TRAMO[v.tramo] || TIPOS_TRAMO.bt; const m = metrosDeVano(l, v);
    L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: '#ffffff', weight: 9, opacity: 0.9, interactive: false }).addTo(capaRed);
    L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: t.color, weight: 5, dashArray: t.dash ? t.dash.split(' ').map(x => x * 5).join(' ') : null })
      .bindTooltip(`${m.metros.toFixed(1)} m${m.origen === 'medido' ? '' : ' GPS'}`, { permanent: true, direction: 'center', className: 'lev-dist' }).addTo(capaRed);
  });
  listaPuntos(l).forEach(p => {
    const mk = L.marker([p.lat, p.lng], { icon: icono(p, { actual: u.actual === p.id, sel: u.sel === p.id }), draggable: u.sel === p.id, zIndexOffset: u.sel === p.id ? 1000 : 0 }).addTo(capaRed);
    mk.on('click', ev => { L.DomEvent.stopPropagation(ev); alTocarPunto(p.id); });
    mk.on('dragend', () => { const ll = mk.getLatLng(); update(ref(db, ruta(state.levId, 'puntos/' + p.id)), { lat: ll.lat, lng: ll.lng, movido: true }); });
  });
}
function actualizarSeguir() { const b = document.getElementById('lev-seguir'); if (b) b.classList.toggle('activo', !!ui()?.seguir); }

// ── Marcar puntos ──
function marcar(lat, lng, acc = null) {
  const l = lev(); const u = ui(); if (!l || !u) return;
  const datos = { lat, lng, tipo: u.tipo, nombre: siguienteNombre(l), orden: Date.now(), por: por(), fecha: hoyLocal(), ...(acc !== null ? { acc: Math.round(acc * 10) / 10 } : { manual: true }) };
  const { key } = push(ref(db, ruta(state.levId, 'puntos')), datos);
  if (u.unir && u.actual && l.puntos?.[u.actual]) push(ref(db, ruta(state.levId, 'vanos')), { a: u.actual, b: key, tramo: u.tramo, orden: Date.now() });
  u.actual = key; u.sel = null;
  showToast(`${datos.nombre} marcado`);
}
export function marcarAqui() {
  const g = state.gps;
  if (!g || g.error || !g.lat) return showToast(g?.error || 'Esperando señal GPS…');
  if (g.acc > PRECISION_BAJA && !confirm(`La precisión del GPS es baja (±${Math.round(g.acc)} m). ¿Marcar igual? También puedes esperar unos segundos o marcar tocando el mapa.`)) return;
  marcar(g.lat, g.lng, g.acc);
}
function alTocarMapa(ll) {
  const u = ui(); if (!u) return;
  if (u.modo === 'tocar') { marcar(ll.lat, ll.lng); return; }
  if (u.sel || u.unirDesde) { u.sel = null; u.unirDesde = null; render(); }
}
function alTocarPunto(id) {
  const u = ui(); const l = lev(); if (!u || !l) return;
  if (u.unirDesde && u.unirDesde !== id) {
    push(ref(db, ruta(state.levId, 'vanos')), { a: u.unirDesde, b: id, tramo: u.tramo, orden: Date.now() });
    u.unirDesde = null; u.actual = id; showToast('Vano agregado'); render(); return;
  }
  u.sel = u.sel === id ? null : id; render();
}

// ── Barra y panel ──
export function setLev(campo, valor) {
  const u = ui(); if (!u) return;
  u[campo] = valor;
  if (campo === 'seguir' && valor && state.gps?.lat && mapa) mapa.setView([state.gps.lat, state.gps.lng], Math.max(mapa.getZoom(), 18));
  render();
}
export function deshacerUltimoLev() {
  const l = lev(); const u = ui(); if (!l) return;
  const ultimo = listaPuntos(l).pop(); if (!ultimo) return;
  if (!confirm(`¿Quitar ${ultimo.nombre || 'el último punto'} y sus vanos?`)) return;
  borrarPunto(ultimo.id);
  const restantes = listaPuntos(l).filter(p => p.id !== ultimo.id);
  u.actual = restantes.length ? restantes[restantes.length - 1].id : null;
}
function borrarPunto(id) {
  const l = lev(); const cambios = { [`puntos/${id}`]: null };
  listaVanos(l).filter(v => v.a === id || v.b === id).forEach(v => { cambios[`vanos/${v.id}`] = null; });
  update(ref(db, ruta(state.levId)), cambios);
  const u = ui(); if (u.sel === id) u.sel = null; if (u.actual === id) u.actual = null;
}
export function borrarPuntoLev() { const u = ui(); if (!u?.sel) return; const p = lev()?.puntos?.[u.sel]; if (!confirm(`¿Borrar ${p?.nombre || 'el punto'} y sus vanos?`)) return; borrarPunto(u.sel); render(); }
export function seguirDesdeLev() { const u = ui(); if (!u?.sel) return; u.actual = u.sel; u.sel = null; showToast('El próximo punto se une a este'); render(); }
export function unirConLev() { const u = ui(); if (!u?.sel) return; u.unirDesde = u.sel; u.sel = null; showToast('Toca el punto con el que se une'); render(); }
export function moverAGpsLev() {
  const u = ui(); const g = state.gps; if (!u?.sel) return;
  if (!g?.lat) return showToast('Esperando señal GPS…');
  update(ref(db, ruta(state.levId, 'puntos/' + u.sel)), { lat: g.lat, lng: g.lng, acc: Math.round(g.acc * 10) / 10, movido: true });
}
export function datoPuntoLev(campo, valor) {
  const u = ui(); if (!u?.sel) return;
  update(ref(db, ruta(state.levId, 'puntos/' + u.sel)), { [campo]: String(valor ?? '').trim() || null });
}
export function datoVanoLev(id, campo, valor) {
  let v = String(valor ?? '').trim();
  if (campo === 'metros' && v) { v = v.replace(',', '.'); if (Number.isNaN(Number(v)) || Number(v) < 0) return showToast('Escribe solo el número de metros'); v = Number(v); }
  update(ref(db, ruta(state.levId, 'vanos/' + id)), { [campo]: v === '' ? null : v });
}
export function borrarVanoLev(id) { if (confirm('¿Quitar este vano?')) remove(ref(db, ruta(state.levId, 'vanos/' + id))); }

// ── Salidas ──
export function pasarADibujarLev() {
  const l = lev(); if (!l) return;
  if (listaPuntos(l).length < 2) return showToast('Marca al menos dos puntos');
  if (state.dibujo?.elementos?.length && !confirm('En Dibujar hay un dibujo; se reemplaza por este levantamiento. ¿Continuar?')) return;
  const d = aDibujo(l);
  cargarEnDibujo({ elementos: d.elementos, escala: d.escala, lamina: { titulo: 'Levantamiento de red', subtitulo: l.nombre, proyecto: l.referencia || '', elaboro: l.creado?.por || por() } });
  state.levId = null; state.lev = null; detenerGPS();
  state.tab = 'dibujar'; state.view = 'lista';
  render();
  showToast('Levantamiento pasado a Dibujar: agrega etiquetas, cajetín y descarga la lámina');
}
export function descargarKmlLev() {
  const l = lev(); if (!l) return;
  const nombres = Object.fromEntries(Object.entries(SIMBOLOS).map(([k, s]) => [k, s.nombre]));
  const url = URL.createObjectURL(new Blob([kmlLevantamiento(l, nombres)], { type: 'application/vnd.google-earth.kml+xml' }));
  const a = document.createElement('a'); a.href = url; a.download = `${String(l.nombre || 'levantamiento').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_')}.kml`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Para las pruebas y la pantalla: el mapa ya montado (o null)
export const mapaLev = () => mapa;
