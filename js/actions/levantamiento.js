// Levantamiento de red en campo (levantamientos/{id}, se guarda en la base y lo ve el equipo; independiente, con
// referencia libre). Mapa Leaflet con calles o satélite y la ubicación GPS en vivo; "Poste aquí" marca un punto en la
// posición actual y lo une con el anterior. El mapa se crea una sola vez y se vuelve a colocar tras cada render().
import { db, push, ref, remove, set, update } from '../firebase.js';
import { SIMBOLOS } from '../domain/dibujo.js';
import { aDibujo, cambiosPartirVano, teselasLamina, distancia, kmlLevantamiento, listaPuntos, listaVanos, metrosDeVano, nuevaPantallaLev, PRECISION_BAJA, siguienteNombre, simboloPunto, textoTrafos } from '../domain/levantamiento.js';
import { TIPOS_TRAMO } from '../domain/plano.js';
import { hayAcometidas, leerAltura } from '../domain/red.js';
import { hoyLocal } from '../domain/trabajo.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { alRedibujar, render } from '../views/render.js';
import { cargarEnDibujo } from './dibujo.js';

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/';
const CAPAS = {
  // Se puede acercar más allá de lo que da el mapa (se agranda la última imagen) para ver los vanos cortos y sus distancias
  calles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxNativeZoom: 19, maxZoom: 22, attribution: '© OpenStreetMap' }],
  satelite: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxNativeZoom: 19, maxZoom: 22, attribution: '© Esri' }],
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
function pintarEtiquetaGPS() {
  const t = textoGPS(); const el = document.getElementById('lev-gps');
  if (el) { el.className = `tg ${t.clase}`; el.textContent = t.texto; }
}
function pintarGPS() {
  pintarEtiquetaGPS();
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
    dibujarRed(); actualizarSeguir(); pintarEtiquetaGPS(); return; // tras redibujar, la señal que ya había (no "Buscando…")
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
  mapa.on('zoomend moveend resize', () => dibujarRed()); // al acercar, alejar o cambiar el tamaño del mapa se ve qué distancias caben
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
export function instalarMapaLev() { alRedibujar(() => { montarMapa(); restaurarScrollLev(); }); }
// La hoja de abajo se vuelve a dibujar con cada cambio (p. ej. al sumar una acometida): se queda donde estaba
export function guardarScrollLev(el) { const u = ui(); if (u) u.scroll = { hoja: el.dataset.hoja, top: el.scrollTop }; }
function restaurarScrollLev() {
  const u = ui(); const el = document.querySelector('.lev-hoja-cuerpo');
  if (el && u?.scroll && u.scroll.hoja === el.dataset.hoja) el.scrollTop = u.scroll.top;
}

const COLOR_PUNTO = { puente: '#0f766e', poste: '#111827', poste_nuevo: '#2563eb', trafo: '#15803d', trafo_nuevo: '#2563eb', banco: '#15803d', usuario: '#dc2626', medidor_red: '#0f172a', seccionador: '#ea580c', medicion: '#f59e0b' };
function icono(p, { actual, sel }) {
  const k = simboloPunto(p); const s = SIMBOLOS[k] || SIMBOLOS.poste; const c = COLOR_PUNTO[k] || '#111827';
  const kva = textoTrafos(p.trafos).replace(/^Trafo |^Banco /, '');
  return L.divIcon({
    className: 'lev-icono', iconSize: [44, 44], iconAnchor: [22, 22], // zona táctil grande para el dedo
    html: `<div class="lev-punto ${actual ? 'actual' : ''} ${sel ? 'sel' : ''}"><svg viewBox="-4 -4 68 68" width="26" height="26" color="${c}" stroke="${c}" stroke-width="3" fill="none">${s.svg}</svg><span>${String(p.nombre || '').replace(/</g, '&lt;')}${kva ? `<em>${kva.replace(/</g, '&lt;')}</em>` : ''}</span></div>`,
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
  const conDistancia = u.distancias === false ? new Map() : distanciasQueCaben(l);
  listaVanos(l).forEach(v => {
    const a = l.puntos?.[v.a]; const b = l.puntos?.[v.b]; if (!a || !b) return;
    const t = TIPOS_TRAMO[v.tramo] || TIPOS_TRAMO.bt; const m = metrosDeVano(l, v);
    L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: '#ffffff', weight: 9, opacity: 0.9, interactive: false }).addTo(capaRed);
    L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: t.color, weight: 5, dashArray: t.dash ? t.dash.split(' ').map(x => x * 5).join(' ') : null }).addTo(capaRed);
    // Distancia: solo las que no tapan postes, nombres u otras distancias (al acercar aparecen las de los vanos cortos)
    const texto = `${m.metros.toFixed(1)} m`;
    if (conDistancia.has(v.id)) {
      const t = conDistancia.get(v.id);
      L.tooltip({ permanent: true, direction: 'center', className: `lev-dist ${m.origen === 'medido' ? 'medido' : ''}` })
        .setLatLng([a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t]).setContent(texto).addTo(capaRed);
    }
  });
  listaPuntos(l).forEach(p => {
    // Cualquier punto se arrastra directo (sin seleccionarlo antes); la última movida se puede deshacer
    const mk = L.marker([p.lat, p.lng], { icon: icono(p, { actual: u.actual === p.id, sel: u.sel === p.id }), draggable: true, autoPan: true, zIndexOffset: u.sel === p.id ? 1000 : 0 }).addTo(capaRed);
    mk.on('click', ev => { L.DomEvent.stopPropagation(ev); alTocarPunto(p.id); });
    mk.on('dragend', () => {
      const ll = mk.getLatLng();
      u.movida = { id: p.id, nombre: p.nombre, lat: p.lat, lng: p.lng, movido: !!p.movido };
      update(ref(db, ruta(state.levId, 'puntos/' + p.id)), { lat: ll.lat, lng: ll.lng, movido: true });
      render();
    });
  });
}
// Distancias que se pueden mostrar sin encimarse: la etiqueta va al centro del vano y no debe tapar el símbolo ni
// el nombre de un punto ni otra distancia (se colocan primero las de los vanos más largos en pantalla)
const HOLGURA = 3; // px que se pueden tocar los bordes
function distanciasQueCaben(l) {
  const pt = p => mapa.latLngToContainerPoint([p.lat, p.lng]);
  const ocupado = [];
  listaPuntos(l).forEach(p => {
    const c = pt(p); const nombre = String(p.nombre || ''); const kva = textoTrafos(p.trafos) ? 12 : 0;
    ocupado.push([c.x - 13, c.y - 13, c.x + 13, c.y + 13]); // símbolo
    ocupado.push([c.x + 11, c.y - 21, c.x + 11 + nombre.length * 7 + 12, c.y - 5 + kva]); // nombre (y kVA)
  });
  const choca = (r, s) => r[0] + HOLGURA < s[2] && s[0] + HOLGURA < r[2] && r[1] + HOLGURA < s[3] && s[1] + HOLGURA < r[3];
  const caben = new Map(); // vano → posición de la etiqueta a lo largo del vano (0.5 = al centro)
  listaVanos(l).map(v => {
    const a = l.puntos?.[v.a]; const b = l.puntos?.[v.b]; if (!a || !b) return null;
    const p = pt(a); const q = pt(b); const w = `${metrosDeVano(l, v).metros.toFixed(1)} m`.length * 6.5 + 14;
    // Al centro del vano o, si ahí tapa algo, un poco hacia una de las puntas
    const cajas = [0.5, 0.4, 0.6, 0.32, 0.68].map(t => { const x = p.x + (q.x - p.x) * t; const y = p.y + (q.y - p.y) * t; return { t, caja: [x - w / 2, y - 9, x + w / 2, y + 9] }; });
    return { id: v.id, largo: Math.hypot(q.x - p.x, q.y - p.y), cajas };
  }).filter(Boolean).sort((r, s) => s.largo - r.largo).forEach(d => {
    const libre = d.cajas.find(c => !ocupado.some(o => choca(c.caja, o)));
    if (!libre) return;
    ocupado.push(libre.caja); caben.set(d.id, libre.t);
  });
  return caben;
}
function actualizarSeguir() { const b = document.getElementById('lev-seguir'); if (b) b.classList.toggle('activo', !!ui()?.seguir); }

// ── Marcar puntos ──
function marcar(lat, lng, acc = null) {
  const l = lev(); const u = ui(); if (!l || !u) return;
  const datos = { lat, lng, tipo: u.tipo, nombre: siguienteNombre(l), orden: Date.now(), por: por(), fecha: hoyLocal(), ...(acc !== null ? { acc: Math.round(acc * 10) / 10 } : { manual: true }) };
  const { key } = push(ref(db, ruta(state.levId, 'puntos')), datos);
  if (u.unir && u.actual && l.puntos?.[u.actual]) push(ref(db, ruta(state.levId, 'vanos')), { a: u.actual, b: key, tramo: u.tramo, ...(u.cond || {}), ...conPendiente(u.actual), orden: Date.now() });
  u.actual = key; u.sel = null; u.movida = null; u.vanoAcom = null;
  showToast(`${datos.nombre} marcado`);
}
export function marcarAqui() {
  const g = state.gps;
  if (!g || g.error || !g.lat) return showToast(g?.error || 'Esperando señal GPS…');
  // Imán en campo: si estás junto a un punto ya marcado (a menos de la precisión, entre 3 y 8 m), puede ser el mismo poste
  const l = lev(); const u = ui();
  const radio = Math.max(3, Math.min(g.acc, 8));
  const cerca = listaPuntos(l).map(p => ({ p, d: distancia(p, g) })).filter(x => x.d <= radio && x.p.id !== u.actual).sort((a, b) => a.d - b.d)[0];
  if (cerca && confirm(`Estás a ${cerca.d.toFixed(1)} m de ${cerca.p.nombre}. ¿Es el mismo poste?\n\nAceptar: usar ${cerca.p.nombre}${u.unir && u.actual ? ' y unirlo con el anterior' : ''}.\nCancelar: marcar un poste nuevo.`)) {
    if (u.unir && u.actual) unir(u.actual, cerca.p.id);
    u.actual = cerca.p.id; u.sel = null; showToast(`Sigue desde ${cerca.p.nombre}`); render(); return;
  }
  if (g.acc > PRECISION_BAJA && !confirm(`La precisión del GPS es baja (±${Math.round(g.acc)} m). ¿Marcar igual? También puedes esperar unos segundos o marcar tocando el mapa.`)) return;
  marcar(g.lat, g.lng, g.acc);
}
// Imán: el punto ya marcado más cercano al toque, si está a menos de 36 px en pantalla
const IMAN_PX = 36;
function puntoCerca(ll) {
  const l = lev(); if (!l || !mapa) return null;
  const c = mapa.latLngToContainerPoint(ll); let mejor = null; let dmin = IMAN_PX;
  listaPuntos(l).forEach(p => { const q = mapa.latLngToContainerPoint([p.lat, p.lng]); const d = Math.hypot(q.x - c.x, q.y - c.y); if (d <= dmin) { dmin = d; mejor = p; } });
  return mejor;
}
// Une dos puntos con un vano (si no están unidos ya)
function unir(a, b) {
  const l = lev(); const u = ui();
  if (!a || !b || a === b) return false;
  if (listaVanos(l).some(v => (v.a === a && v.b === b) || (v.a === b && v.b === a))) return false;
  push(ref(db, ruta(state.levId, 'vanos')), { a, b, tramo: u.tramo, ...(u.cond || {}), ...conPendiente(a), orden: Date.now() });
  u.vanoAcom = null;
  return true;
}
// El vano más cercano al toque (a menos de 24 px en pantalla) y el punto de la línea más cercano
const VANO_PX = 24;
function vanoCerca(ll) {
  const l = lev(); if (!l || !mapa) return null;
  const c = mapa.latLngToContainerPoint(ll); let mejor = null; let dmin = VANO_PX;
  listaVanos(l).forEach(v => {
    const a = l.puntos?.[v.a]; const b = l.puntos?.[v.b]; if (!a || !b) return;
    const p0 = mapa.latLngToContainerPoint([a.lat, a.lng]); const p1 = mapa.latLngToContainerPoint([b.lat, b.lng]);
    const vx = p1.x - p0.x; const vy = p1.y - p0.y; const l2 = vx * vx + vy * vy; if (!l2) return;
    const t = Math.max(0.05, Math.min(0.95, ((c.x - p0.x) * vx + (c.y - p0.y) * vy) / l2));
    const x = p0.x + vx * t; const y = p0.y + vy * t; const d = Math.hypot(x - c.x, y - c.y);
    if (d <= dmin) { dmin = d; mejor = { v, en: mapa.containerPointToLatLng([x, y]), a, b }; }
  });
  return mejor;
}
// Poste en medio de un vano: A–B pasa a A–nuevo–B; el nuevo queda seleccionado para nombrarlo o moverlo
function insertarEnVano({ v, en, a, b }) {
  const l = lev(); const u = ui();
  const r = ref(db, ruta(state.levId, 'puntos'));
  const id = push(r).key; const keys = [push(ref(db, ruta(state.levId, 'vanos'))).key, push(ref(db, ruta(state.levId, 'vanos'))).key];
  const nombre = siguienteNombre(l);
  update(ref(db, ruta(state.levId)), {
    [`puntos/${id}`]: { lat: en.lat, lng: en.lng, tipo: u.tipo, nombre, manual: true, orden: Date.now(), por: por(), fecha: hoyLocal() },
    ...cambiosPartirVano(v, id, keys),
  });
  u.sel = id; u.movida = null;
  showToast(`${nombre} puesto entre ${a.nombre} y ${b.nombre}${v.metros !== undefined && v.metros !== null && v.metros !== '' ? '; los metros medidos de ese vano se quitaron' : ''}`);
  render();
}
function alTocarMapa(ll) {
  const u = ui(); if (!u) return;
  const cerca = puntoCerca(ll);
  if (cerca) return alTocarPunto(cerca.id); // tocar cerca de un punto es tocar el punto
  // Tocar una línea: poste en medio de ese vano
  const vano = !u.unirDesde && vanoCerca(ll);
  if (vano && confirm(`¿Poner un ${(SIMBOLOS[u.tipo]?.nombre || 'punto').toLowerCase()} en medio del vano ${vano.a.nombre} – ${vano.b.nombre}?`)) return insertarEnVano(vano);
  if (u.modo === 'tocar') { marcar(ll.lat, ll.lng); return; }
  if (u.sel || u.unirDesde) { u.sel = null; u.unirDesde = null; render(); }
}
function alTocarPunto(id) {
  const u = ui(); const l = lev(); if (!u || !l) return;
  if (u.unirDesde && u.unirDesde !== id) {
    showToast(unir(u.unirDesde, id) ? 'Vano agregado' : 'Esos puntos ya están unidos');
    u.unirDesde = null; u.actual = id; render(); return;
  }
  // Marcando en el mapa con "unir al anterior": tocar un punto existente lo une y sigue desde ahí (cierra la red)
  if (u.modo === 'tocar' && u.unir && u.actual && u.actual !== id && l.puntos?.[u.actual]) {
    if (unir(u.actual, id)) showToast(`Unido con ${l.puntos[id]?.nombre || 'el punto'}`);
    u.actual = id; u.sel = null; render(); return;
  }
  u.sel = u.sel === id ? null : id; render();
}

// ── Barra y panel ──
// Ventanas para elegir un dato (tipo de punto, de vano, vano de las acometidas, altura, estructuras, tipo, nombre, nota)
export function abrirPickerLev(t) { const u = ui(); if (!u) return; u.picker = t; render(); }
export function cerrarPickerLev() { const u = ui(); if (!u) return; u.picker = null; render(); }
export function elegirLev(campo, valor) {
  const u = ui(); if (!u) return;
  if (campo === 'vanoAcom') u.vanoAcom = valor || null; else u[campo] = valor;
  u.picker = null; render();
}
export function elegirPuntoLev(campo, valor) { datoPuntoLev(campo, valor); const u = ui(); if (u) { u.picker = null; render(); } }
export function alturaYCerrarLev(v) { alturaPuntoLev(v); const u = ui(); if (u) { u.picker = null; render(); } }
// Pestañas de la hoja de abajo (Marcar, Punto, Vanos, Más); volver a Marcar suelta el punto seleccionado
export function setHojaLev(k) {
  const u = ui(); if (!u) return;
  u.hoja = k; u.picker = null; u.hojaMin = false; if (k === 'marcar') u.sel = null;
  render();
}
export function setLev(campo, valor) {
  const u = ui(); if (!u) return;
  u[campo] = valor;
  if (campo === 'seguir' && valor && state.gps?.lat && mapa) mapa.setView([state.gps.lat, state.gps.lng], Math.max(mapa.getZoom(), 18));
  render();
}
export function deshacerMovidaLev() {
  const u = ui(); const m = u?.movida; if (!m) return;
  update(ref(db, ruta(state.levId, 'puntos/' + m.id)), { lat: m.lat, lng: m.lng, movido: m.movido || null });
  u.movida = null; showToast(`${m.nombre} volvió a su lugar`); render();
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
// Altura y estructuras del punto seleccionado
export function alturaPuntoLev(v) {
  const u = ui(); if (!u?.sel) return;
  const a = leerAltura(v);
  if (String(v ?? '').trim() && a === null) return showToast('Escribe la altura en pies (solo el número)');
  update(ref(db, ruta(state.levId, 'puntos/' + u.sel)), { altura: a });
}
// Transformadores sobre el punto seleccionado: kVA de cada unidad (varias = banco)
function trafosSel() { const u = ui(); return [...(lev()?.puntos?.[u?.sel]?.trafos || [])]; }
export function agregarTrafoLev(kva) {
  const u = ui(); const k = String(kva ?? '').trim().replace(',', '.').replace(/\s*kva$/i, ''); if (!u?.sel || !k) return;
  if (Number.isNaN(Number(k)) || Number(k) <= 0) return showToast('Escribe los kVA (solo el número)');
  update(ref(db, ruta(state.levId, 'puntos/' + u.sel)), { trafos: [...trafosSel(), String(Number(k))] });
}
export function agregarTrafoEscritoLev() { const inp = document.getElementById('lev-trafo-otro'); if (inp?.value.trim()) { agregarTrafoLev(inp.value); inp.value = ''; } }
export function quitarTrafoLev(i) {
  const u = ui(); if (!u?.sel) return;
  const lista = trafosSel().filter((_, k) => k !== i);
  update(ref(db, ruta(state.levId, 'puntos/' + u.sel)), { trafos: lista.length ? lista : null });
}
function estructurasSel() { const u = ui(); return [...(lev()?.puntos?.[u?.sel]?.estructuras || [])]; }
export function agregarEstructuraLev(codigo) {
  const u = ui(); const c = String(codigo || '').trim().toUpperCase(); if (!u?.sel || !c) return;
  const lista = estructurasSel(); if (lista.includes(c)) return;
  update(ref(db, ruta(state.levId, 'puntos/' + u.sel)), { estructuras: [...lista, c] });
}
export function agregarEstructuraEscritaLev() { const inp = document.getElementById('lev-poste-estr-otra'); if (inp?.value.trim()) { agregarEstructuraLev(inp.value); inp.value = ''; } }
export function quitarEstructuraLev(i) {
  const u = ui(); if (!u?.sel) return;
  const lista = estructurasSel().filter((_, k) => k !== i);
  update(ref(db, ruta(state.levId, 'puntos/' + u.sel)), { estructuras: lista.length ? lista : null });
}
// Conductor de un vano (calibre y tipo); queda para los vanos que se marquen después
export function conductorVanoLev(id, campo, valor) {
  const u = ui(); const v = String(valor ?? '').trim();
  const clave = campo === 'tipo' ? 'conductor' : 'calibre';
  update(ref(db, ruta(state.levId, 'vanos/' + id)), { [clave]: v || null });
  if (u) { u.cond = { ...(u.cond || {}), [clave]: v || null }; Object.keys(u.cond).forEach(k => { if (!u.cond[k]) delete u.cond[k]; }); }
}
// ── Acometidas por vano (120 A, 120 B, 240) ──
// Se cuentan en el vano elegido o, por defecto, en el próximo vano que sale del punto actual: quedan "pendientes"
// (levantamientos/{id}/pendiente = { desde, a, b, d }) y se pasan al vano cuando se marca el siguiente poste.
function conPendiente(desde) {
  const p = lev()?.pendiente;
  if (!p || p.desde !== desde || !hayAcometidas(p)) return {};
  remove(ref(db, ruta(state.levId, 'pendiente')));
  return { acom: { a: Number(p.a) || 0, b: Number(p.b) || 0, d: Number(p.d) || 0 } };
}
export function setVanoAcomLev(id) { const u = ui(); if (!u) return; u.vanoAcom = id || null; render(); }
export function sumarAcometidaLev(k, delta) {
  const l = lev(); const u = ui(); if (!l || !u) return;
  const vano = u.vanoAcom && l.vanos?.[u.vanoAcom] ? u.vanoAcom : null;
  if (vano) {
    const n = Math.max(0, (Number(l.vanos[vano].acom?.[k]) || 0) + delta);
    update(ref(db, ruta(state.levId, `vanos/${vano}/acom`)), { [k]: n });
  } else {
    if (!u.actual || !l.puntos?.[u.actual]) return showToast('Marca primero el poste desde donde sale el vano');
    const p = l.pendiente?.desde === u.actual ? l.pendiente : { desde: u.actual };
    const n = Math.max(0, (Number(p[k]) || 0) + delta);
    set(ref(db, ruta(state.levId, 'pendiente')), { ...p, desde: u.actual, [k]: n });
  }
}
export function datoVanoLev(id, campo, valor) {
  let v = String(valor ?? '').trim();
  if (campo === 'metros' && v) { v = v.replace(',', '.'); if (Number.isNaN(Number(v)) || Number(v) < 0) return showToast('Escribe solo el número de metros'); v = Number(v); }
  update(ref(db, ruta(state.levId, 'vanos/' + id)), { [campo]: v === '' ? null : v });
}
export function borrarVanoLev(id) { if (confirm('¿Quitar este vano?')) remove(ref(db, ruta(state.levId, 'vanos/' + id))); }

// ── Salidas ──
// Mapa de fondo para Dibujar: las teselas del mapa (calles o satélite) de la zona, en una imagen del tamaño de la lámina,
// con el crédito del mapa abajo a la derecha (lo piden sus condiciones de uso). null si no se pudo bajar.
const CREDITO = { calles: '© OpenStreetMap', satelite: '© Esri, Maxar, Earthstar Geographics' };
const urlTesela = (capa, t) => CAPAS[capa][0].replace('{z}', t.z).replace('{x}', t.x).replace('{y}', t.y);
function cargarTesela(src) {
  return new Promise(resolve => {
    const img = new Image(); img.crossOrigin = 'anonymous';
    const fin = ok => { clearTimeout(espera); resolve(ok ? img : null); };
    const espera = setTimeout(() => fin(false), 10000);
    img.onload = () => fin(true); img.onerror = () => fin(false);
    img.src = src;
  });
}
export async function mapaDeFondo(geo, capa, { ancho = 1600, alto = 1000, factor = 1.5 } = {}) {
  if (!geo || !CAPAS[capa]) return null;
  const { teselas } = teselasLamina(geo, ancho, alto, { detalleMin: factor });
  const imgs = await Promise.all(teselas.map(t => cargarTesela(urlTesela(capa, t))));
  if (!imgs.some(Boolean)) return null;
  const c = document.createElement('canvas'); c.width = Math.round(ancho * factor); c.height = Math.round(alto * factor);
  const ctx = c.getContext('2d'); ctx.fillStyle = '#f2efe9'; ctx.fillRect(0, 0, c.width, c.height);
  // Un píxel de más por lado para que no se vean rayas entre teselas
  teselas.forEach((t, i) => { if (imgs[i]) ctx.drawImage(imgs[i], t.dx * factor - 0.5, t.dy * factor - 0.5, t.dw * factor + 1, t.dh * factor + 1); });
  const tam = Math.round(13 * factor); ctx.font = `600 ${tam}px Arial, sans-serif`;
  const texto = CREDITO[capa]; const w = ctx.measureText(texto).width + tam;
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(c.width - w - 6, c.height - tam * 1.7 - 6, w, tam * 1.7);
  ctx.fillStyle = '#334155'; ctx.fillText(texto, c.width - w - 6 + tam / 2, c.height - tam * 0.6 - 6);
  try { return { src: c.toDataURL('image/jpeg', 0.85), w: ancho, h: alto }; } catch { return null; } // si el servidor no deja leer la imagen
}
export async function pasarADibujarLev() {
  const l = lev(); const u = ui(); if (!l) return;
  if (listaPuntos(l).length < 2) return showToast('Marca al menos dos puntos');
  if (state.dibujo?.elementos?.length && !confirm('En Dibujar hay un dibujo; se reemplaza por este levantamiento. ¿Continuar?')) return;
  const d = aDibujo(l);
  const capa = u?.fondoDibujo || 'calles';
  let fondo = null;
  if (capa !== 'ninguno') {
    showToast('Bajando el mapa de la zona…');
    fondo = await mapaDeFondo(d.geo, capa);
    if (!fondo) showToast('No se pudo bajar el mapa (¿sin conexión?): pasa sin fondo; puedes subir una captura en Dibujar');
  }
  cargarEnDibujo({ elementos: d.elementos, escala: d.escala, fondo, lamina: { titulo: 'Levantamiento de red', subtitulo: l.nombre, proyecto: l.referencia || '', elaboro: l.creado?.por || por() } });
  state.levId = null; state.lev = null; detenerGPS();
  state.tab = 'dibujar'; state.view = 'lista';
  render();
  if (fondo || capa === 'ninguno') showToast('Levantamiento pasado a Dibujar: agrega etiquetas, cajetín y descarga la lámina');
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
