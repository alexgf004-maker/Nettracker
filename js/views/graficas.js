// Gráficas de voltaje y corriente de un caso (a partir del TXT analizado). SVG propio, sin librerías.
// Voltaje con la banda de tolerancia; corriente en otra gráfica (nunca dos escalas en una).
import { completar, fasesActivas, fechaDePunto, resumenFase } from '../domain/series.js';
import { state } from '../state.js';
import { escapeHtml } from '../utils.js';

const esc = s => escapeHtml(s ?? '');
// Colores de fase: primeros tres del orden categorial validado (azul, naranja, aqua)
export const COLOR_FASE = { 1: '#2a78d6', 2: '#eb6834', 3: '#1baf7a' };
const W = 1000; const H = 240;
const fmt = (v, dec = 0) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toLocaleString('es-SV', { minimumFractionDigits: dec, maximumFractionDigits: dec }));

// Normaliza lo que viene de la base (arreglos sin null)
function preparar(d) {
  const n = d.t?.length || 0;
  const t = completar(d.t, n);
  const grupo = g => Object.fromEntries(Object.entries(g || {}).map(([p, s]) => [p, { v: completar(s.v, n), min: completar(s.min || s.v, n), max: completar(s.max || s.v, n) }]));
  return { ...d, n, t, U: grupo(d.U), I: grupo(d.I) };
}

// Escala "linda" para el eje Y
function ticks(min, max, cuantos = 4) {
  const paso0 = (max - min) / cuantos || 1;
  const mag = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map(m => m * mag).find(x => x >= paso0) || paso0;
  const ini = Math.floor(min / paso) * paso; const out = [];
  for (let v = ini; v <= max + paso * 0.001; v += paso) out.push(Math.round(v * 1000) / 1000);
  return out;
}
const percentil = (arr, p) => { const s = arr.filter(x => x !== null && x > 0).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };

function grafica({ id, titulo, unidad, d, grupo, fases, banda, dec }) {
  const tMax = d.t[d.n - 1] || 1;
  const valores = fases.flatMap(p => grupo[p].v);
  // Voltaje: se ignoran los extremos (cortes) para que se vea el detalle; corriente: hasta el pico real
  let yMin = percentil(valores, 0.005); let yMax = unidad === 'A' ? Math.max(0, ...valores.filter(x => x !== null)) : percentil(valores, 0.995);
  if (banda) { yMin = Math.min(yMin, banda.inf); yMax = Math.max(yMax, banda.sup); }
  if (unidad === 'A') yMin = 0;
  const margen = (yMax - yMin) * 0.08 || 1;
  yMin = unidad === 'A' ? 0 : yMin - margen; yMax += margen;
  const ys = ticks(yMin, yMax); yMin = Math.min(yMin, ys[0]); yMax = Math.max(yMax, ys[ys.length - 1]);
  const X = t => (t / tMax) * W; const Y = v => H - ((v - yMin) / (yMax - yMin)) * H;
  const camino = arr => { let s = ''; let abierto = false; arr.forEach((v, i) => { if (v === null || d.t[i] === null) { abierto = false; return; } s += `${abierto ? 'L' : 'M'}${X(d.t[i]).toFixed(1)},${Y(v).toFixed(1)}`; abierto = true; }); return s; };
  let svg = `<svg class="graf-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(titulo)}"><defs><clipPath id="clip-${id}"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs>`;
  ys.forEach(v => { svg += `<line class="graf-grid" x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}"/>`; });
  // Días (medianoche)
  const inicioMin = (() => { const [f, h] = String(d.inicio).split(' '); const [hh, mm] = (h || '0:0').split(':').map(Number); return hh * 60 + mm; })();
  const dias = [];
  for (let m = 1440 - inicioMin; m < tMax; m += 1440) dias.push(m);
  dias.forEach(m => { svg += `<line class="graf-dia" x1="${X(m)}" x2="${X(m)}" y1="0" y2="${H}"/>`; });
  if (banda) {
    svg += `<rect class="graf-banda" x="0" width="${W}" y="${Y(banda.sup)}" height="${Y(banda.inf) - Y(banda.sup)}"/>`;
    svg += `<line class="graf-limite" x1="0" x2="${W}" y1="${Y(banda.sup)}" y2="${Y(banda.sup)}"/><line class="graf-limite" x1="0" x2="${W}" y1="${Y(banda.inf)}" y2="${Y(banda.inf)}"/>`;
    svg += `<line class="graf-nominal" x1="0" x2="${W}" y1="${Y(banda.nominal)}" y2="${Y(banda.nominal)}"/>`;
  }
  svg += `<g clip-path="url(#clip-${id})">` + fases.map(p => `<path class="graf-linea" d="${camino(grupo[p].v)}" stroke="${COLOR_FASE[p]}"/>`).join('') + '</g>';
  svg += `<line class="graf-cursor" x1="-10" x2="-10" y1="0" y2="${H}"/></svg>`;
  // Etiquetas (HTML para que no se deformen)
  const pct = v => (1 - (v - yMin) / (yMax - yMin)) * 100;
  let ejes = ys.map(v => `<span class="graf-y" style="top:${pct(v)}%">${fmt(v, unidad === 'A' && yMax < 10 ? 1 : 0)}</span>`).join('');
  if (banda) ejes += `<span class="graf-banda-l" style="top:${pct(banda.sup)}%">+${Math.round(banda.tol * 100)} %</span><span class="graf-banda-l" style="top:${pct(banda.inf)}%">−${Math.round(banda.tol * 100)} %</span>`;
  const etiquetasX = dias.map(m => `<span class="graf-x" style="left:${(m / tMax) * 100}%">${esc(fechaDePunto(d.inicio, m).slice(0, 5))}</span>`).join('');
  return `<div class="graf-bloque"><div class="graf-titulo"><b>${esc(titulo)}</b><span>${unidad}</span>
      <span class="graf-leyenda">${fases.map(p => `<span><i style="background:${COLOR_FASE[p]}"></i>${unidad === 'V' ? 'V' : 'I'}${p}</span>`).join('')}${banda ? '<span><i class="graf-leyenda-banda"></i>Tolerancia</span>' : ''}</span></div>
    <div class="graf-area" data-graf="${id}" onpointermove="moverCursorGrafica(event)" onpointerleave="salirCursorGrafica()">${svg}<div class="graf-ejes">${ejes}</div><div class="graf-xs">${etiquetasX}</div></div></div>`;
}

export function renderGraficasModal() {
  const g = state.graficas;
  const caso = state.campanas?.[g.clave]?.casos?.[g.id] || {};
  const r = caso.resultado || {};
  let html = '<div class="modal-overlay" onclick="if (event.target === this) cerrarGraficas()"><div class="modal hoja modal-ancha graf-modal">';
  html += `<div class="modal-head"><div><div class="modal-titulo mono">${esc(caso.codigo || caso.codigoEnte)}</div><div class="page-sub">${esc(caso.nombre)}${r.febNoPer !== undefined && r.febNoPer !== '' ? ` · FebNoPer ${esc(r.febNoPer)} %` : ''}${r.tolerancia === 'fuera' ? ' · <b class="txt-rojo">Fuera de tolerancia</b>' : ''}</div></div><button class="modal-cerrar" onclick="cerrarGraficas()" title="Cerrar">✕</button></div>`;
  if (g.cargando) return html + '<div class="graf-vacio">Cargando las gráficas…</div></div></div>';
  if (g.error) return html + `<div class="aviso aviso-amarillo"><i class="ic ic-alerta"></i> No se pudieron cargar: ${esc(g.error)}</div></div></div>`;
  if (!g.datos) return html + '<div class="graf-vacio">Este caso no tiene gráficas guardadas. Sube su TXT con "Analizar TXT" en Resultados y guarda los resultados.</div></div></div>';
  const d = preparar(g.datos);
  const banda = d.nominal ? { nominal: d.nominal, tol: d.tolerancia, sup: d.nominal * (1 + d.tolerancia), inf: d.nominal * (1 - d.tolerancia) } : null;
  const fU = fasesActivas(d.U); const fI = fasesActivas(d.I);
  html += `<div class="graf-periodo">${esc(d.inicio)} al ${esc(d.fin)} · ${d.n} registros${banda ? ` · nominal ${fmt(banda.nominal)} V, tolerancia ±${Math.round(banda.tol * 100)} % (${fmt(banda.inf)} a ${fmt(banda.sup)} V)` : ' · sin nivel de tensión del caso: no se dibuja la banda'}</div>`;
  // Resumen por fase
  html += '<div class="graf-resumen">' + fU.map(p => {
    const x = resumenFase(d.U[p], banda);
    return `<div class="graf-dato"><span class="graf-fase"><i style="background:${COLOR_FASE[p]}"></i>V${p}</span><b>${fmt(x.prom)} V</b><small>mín ${fmt(x.min)} · máx ${fmt(x.max)}${banda ? ` · <span class="${x.fueraPct > 0.05 ? 'txt-rojo' : ''}">${fmt(x.fueraPct * 100, 1)} % fuera</span>` : ''}</small></div>`;
  }).join('') + '</div>';
  html += `<div class="graf-tooltip" id="graf-tooltip" hidden></div>`;
  html += grafica({ id: 'u', titulo: 'Voltaje', unidad: 'V', d, grupo: d.U, fases: fU, banda, dec: 0 });
  if (fI.length) html += grafica({ id: 'i', titulo: 'Corriente', unidad: 'A', d, grupo: d.I, fases: fI, banda: null, dec: 1 });
  else html += `<div class="aviso aviso-amarillo"><i class="ic ic-alerta"></i> El TXT no trae columnas de corriente con el nombre esperado (I1 [A], I2 [A], I3 [A])${d.sinCorriente?.length ? `; se encontraron: ${esc(d.sinCorriente.join(', '))}` : ''}.</div>`;
  html += `<div class="barra-acciones" style="margin-top:12px"><button class="b b-g" onclick="exportarSeries('${g.clave}', '${g.id}')"><i class="ic ic-excel"></i> Descargar datos en Excel</button></div>`;
  return html + '</div></div>';
}

// Cursor: línea vertical en ambas gráficas y valores de todas las fases en ese momento
export function moverCursorGrafica(ev) {
  const g = state.graficas; if (!g?.datos) return;
  const d = preparar(g.datos);
  const area = ev.currentTarget; const rect = area.getBoundingClientRect();
  const frac = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
  const tMax = d.t[d.n - 1] || 1; const objetivo = frac * tMax;
  let i = 0; let mejor = Infinity;
  d.t.forEach((t, k) => { const dist = Math.abs((t ?? -1e9) - objetivo); if (dist < mejor) { mejor = dist; i = k; } });
  const x = (d.t[i] / tMax) * W;
  document.querySelectorAll('.graf-cursor').forEach(l => { l.setAttribute('x1', x); l.setAttribute('x2', x); });
  const tip = document.getElementById('graf-tooltip'); if (!tip) return;
  const linea = (letra, grupo, unidad, dec) => fasesActivas(grupo).map(p => {
    const div = document.createElement('div');
    const sw = document.createElement('i'); sw.style.background = COLOR_FASE[p];
    const b = document.createElement('b'); b.textContent = `${fmt(grupo[p].v[i], dec)} ${unidad}`;
    div.append(sw, b, document.createTextNode(` ${letra}${p}`));
    return div;
  });
  tip.replaceChildren();
  const cab = document.createElement('div'); cab.className = 'graf-tooltip-t'; cab.textContent = fechaDePunto(d.inicio, d.t[i]);
  tip.append(cab, ...linea('V', d.U, 'V', 0), ...linea('I', d.I, 'A', 1));
  tip.hidden = false;
  const modal = area.closest('.graf-modal').getBoundingClientRect();
  const izq = ev.clientX - modal.left + 14;
  tip.style.left = `${Math.min(izq, modal.width - 170)}px`;
  tip.style.top = `${rect.top - modal.top + area.closest('.graf-modal').scrollTop + 8}px`;
}
export function salirCursorGrafica() {
  document.querySelectorAll('.graf-cursor').forEach(l => { l.setAttribute('x1', -10); l.setAttribute('x2', -10); });
  const tip = document.getElementById('graf-tooltip'); if (tip) tip.hidden = true;
}
