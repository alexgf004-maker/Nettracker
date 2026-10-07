// Análisis de un reclamo: gráficas y tablas de las macros Graficar y Armónicos a partir de los dos TXT.
// SVG propio, sin librerías. Cada gráfica tiene una sola escala; los límites van como líneas punteadas.
import {
  analizarArmonicos, analizarTension, ARMONICAS, CARGA_ALERTA, DATI_LIM, LIMITE_PST, NIVELES, PERC_MAX,
  leerTension, TIPOS_RED, VDAT_LIM,
} from '../domain/reclamo.js';
import { state } from '../state.js';
import { escapeHtml, fmtDate } from '../utils.js';
import { COLOR_FASE } from './graficas.js';
import { heroSeccion } from './componentes.js';

const esc = s => escapeHtml(s ?? '');
const W = 1000; const H = 240;
export const fmt = (v, dec = 0) => (v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toLocaleString('es-SV', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
const COLOR_LIMITE = { limite: '#64748b', trafo: '#dc2626', alerta: '#d97706' };

// ── Cálculo (memorizado: render() se llama con cualquier cambio de la app) ──
// Los armónicos solo dependen del TXT y de las fases; la tensión, además, del nominal, la red y el trafo.
const memo = { lectura: {}, tension: {}, armonicos: {} };
function memorizar(caja, entradas, calcular) {
  if (caja.entradas && caja.entradas.length === entradas.length && caja.entradas.every((x, i) => x === entradas[i])) return caja.valor;
  caja.entradas = entradas; caja.valor = calcular();
  return caja.valor;
}
// Análisis activo: el del reclamo abierto o, en la pestaña Graficar, el rápido (sin guardar)
export const analisisActivo = () => state.analisisReclamo || (state.tab === 'graficar' ? state.graficar : null);

export function calculoReclamo(a = analisisActivo()) {
  if (!a) return null;
  const p = a.params || {};
  const tol = TIPOS_RED[p.red]?.tol || 0;
  const d = memorizar(memo.lectura, [a.tension?.texto], () => (a.tension ? leerTension(a.tension.texto) : null));
  const t = d ? memorizar(memo.tension, [d, p.fases, p.nominal, p.red, p.kva, p.vll],
    () => analizarTension(d, { fases: p.fases || 3, nominal: Number(p.nominal) || 0, tol, kva: Number(p.kva) || 0, vll: Number(p.vll) || 0 })) : null;
  const arm = memorizar(memo.armonicos, [a.armonicos?.texto, p.fases], () => (a.armonicos ? analizarArmonicos(a.armonicos.texto, p.fases || 3) : null));
  return { d, t, arm, tol };
}

// ── Gráficas ──

// Datos de cada gráfica dibujada, para el cursor
const GRAFICAS = new Map();

function ticks(min, max, cuantos = 4) {
  const paso0 = (max - min) / cuantos || 1;
  const mag = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map(m => m * mag).find(x => x >= paso0) || paso0;
  const ini = Math.floor(min / paso) * paso; const out = [];
  for (let v = ini; v <= max + paso * 0.001; v += paso) out.push(Math.round(v * 1000) / 1000);
  return out;
}

const decimales = (yMax, yMin) => { const r = yMax - yMin; return r < 2 ? 2 : r < 20 ? 1 : 0; };

// series: [{ nombre, color, v }]; lineas: [{ valor, nombre, tipo: limite|trafo|alerta }]; banda: { inf, sup, nominal, tol }
export function graficaLinea({ id, titulo, unidad, t, fechas, series, lineas = [], banda = null, desdeCero = false }) {
  const n = t.length; const tMax = t[n - 1] || 1;
  const valores = series.flatMap(s => s.v).filter(x => x !== null && x !== undefined);
  if (!valores.length) return '';
  let yMin = Math.min(...valores); let yMax = Math.max(...valores);
  lineas.forEach(l => { yMin = Math.min(yMin, l.valor); yMax = Math.max(yMax, l.valor); });
  if (banda) { yMin = Math.min(yMin, banda.inf); yMax = Math.max(yMax, banda.sup); }
  if (desdeCero) yMin = Math.min(0, yMin);
  const margen = (yMax - yMin) * 0.08 || 1;
  if (!desdeCero) yMin -= margen;
  yMax += margen;
  const ys = ticks(yMin, yMax); yMin = Math.min(yMin, ys[0]); yMax = Math.max(yMax, ys[ys.length - 1]);
  const X = x => (x / tMax) * W; const Y = v => H - ((v - yMin) / (yMax - yMin)) * H;
  const camino = arr => { let s = ''; let abierto = false; arr.forEach((v, i) => { if (v === null || v === undefined) { abierto = false; return; } s += `${abierto ? 'L' : 'M'}${X(t[i]).toFixed(1)},${Y(v).toFixed(1)}`; abierto = true; }); return s; };
  let svg = `<svg class="graf-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(titulo)}">`;
  ys.forEach(v => { svg += `<line class="graf-grid" x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}"/>`; });
  const [, hora] = String(fechas[0] || '').split(' ');
  const [hh, mm] = (hora || '0:0').split(':').map(Number);
  const dias = [];
  for (let m = 1440 - (hh * 60 + mm); m < tMax; m += 1440) if (m > 0) dias.push(m);
  dias.forEach(m => { svg += `<line class="graf-dia" x1="${X(m)}" x2="${X(m)}" y1="0" y2="${H}"/>`; });
  if (banda) {
    svg += `<rect class="graf-banda" x="0" width="${W}" y="${Y(banda.sup)}" height="${Y(banda.inf) - Y(banda.sup)}"/>`;
    svg += `<line class="graf-limite" x1="0" x2="${W}" y1="${Y(banda.sup)}" y2="${Y(banda.sup)}"/><line class="graf-limite" x1="0" x2="${W}" y1="${Y(banda.inf)}" y2="${Y(banda.inf)}"/>`;
    svg += `<line class="graf-nominal" x1="0" x2="${W}" y1="${Y(banda.nominal)}" y2="${Y(banda.nominal)}"/>`;
  }
  lineas.forEach(l => { svg += `<line class="graf-limite" style="stroke:${COLOR_LIMITE[l.tipo || 'limite']}" x1="0" x2="${W}" y1="${Y(l.valor)}" y2="${Y(l.valor)}"/>`; });
  svg += series.map(s => `<path class="graf-linea" d="${camino(s.v)}" stroke="${s.color}"/>`).join('');
  svg += `<line class="graf-cursor" x1="0" x2="0" y1="0" y2="${H}" visibility="hidden"/></svg>`;
  const pct = v => (1 - (v - yMin) / (yMax - yMin)) * 100;
  const dec = decimales(yMax, yMin);
  let ejes = ys.map(v => `<span class="graf-y" style="top:${pct(v)}%">${fmt(v, dec)}</span>`).join('');
  if (banda) ejes += `<span class="graf-banda-l" style="top:${pct(banda.sup)}%">+${Math.round(banda.tol * 100)} %</span><span class="graf-banda-l" style="top:${pct(banda.inf)}%">−${Math.round(banda.tol * 100)} %</span>`;
  lineas.forEach(l => { ejes += `<span class="graf-banda-l" style="top:${pct(l.valor)}%;color:${COLOR_LIMITE[l.tipo || 'limite']}">${esc(l.nombre)}</span>`; });
  const etiquetasX = dias.map(m => `<span class="graf-x" style="left:${(m / tMax) * 100}%">${esc(String(fechas[t.indexOf(m)] || fechaDeMinuto(fechas[0], m)).slice(0, 5))}</span>`).join('');
  GRAFICAS.set(id, { t, fechas, series, unidad, dec: Math.max(dec, unidad === 'p.u.' ? 3 : dec) });
  const leyenda = series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.nombre)}</span>`).join('')
    + (banda ? '<span><i class="graf-leyenda-banda"></i>Tolerancia</span>' : '')
    + lineas.map(l => `<span><i class="graf-leyenda-lim" style="border-color:${COLOR_LIMITE[l.tipo || 'limite']}"></i>${esc(l.nombre)}</span>`).join('');
  return `<div class="graf-bloque"><div class="graf-titulo"><b>${esc(titulo)}</b><span>${esc(unidad)}</span><span class="graf-leyenda">${leyenda}</span></div>
    <div class="graf-area" data-graf="${id}" onpointermove="cursorReclamo(event)" onpointerleave="salirCursorReclamo(event)">${svg}<div class="graf-ejes">${ejes}</div><div class="graf-xs">${etiquetasX}</div></div></div>`;
}

// "dd/mm/aaaa hh:mm" + minutos → "dd/mm"
function fechaDeMinuto(inicio, minutos) {
  const [f] = String(inicio).split(' ');
  const [d, m, a] = f.split('/').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d) + (minutos + 1) * 60000);
  return `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Espectro: barras por fase y el límite de la tabla como escalones punteados
export function graficaBarras({ titulo, unidad, categorias, series, limite }) {
  const valores = [...series.flatMap(s => s.v), ...limite].filter(x => x !== null && x !== undefined);
  let yMax = Math.max(0, ...valores) * 1.1 || 1;
  const ys = ticks(0, yMax); yMax = Math.max(yMax, ys[ys.length - 1]);
  const Y = v => H - (v / yMax) * H;
  const anchoCat = W / categorias.length; const anchoBarra = (anchoCat * 0.7) / series.length;
  let svg = `<svg class="graf-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(titulo)}">`;
  ys.forEach(v => { svg += `<line class="graf-grid" x1="0" x2="${W}" y1="${Y(v)}" y2="${Y(v)}"/>`; });
  categorias.forEach((c, i) => {
    const x0 = i * anchoCat + anchoCat * 0.15;
    const detalle = series.map(s => `${s.nombre}: ${fmt(s.v[i], 3)} ${unidad}`).join('\n') + `\nLímite: ${fmt(limite[i], 3)} ${unidad}`;
    svg += `<g><title>${esc(c)}\n${esc(detalle)}</title>`;
    series.forEach((s, k) => {
      const v = s.v[i] ?? 0; const fuera = v > limite[i];
      svg += `<rect class="graf-barra ${fuera ? 'fuera' : ''}" x="${(x0 + k * anchoBarra).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${(anchoBarra - 1).toFixed(1)}" height="${(H - Y(v)).toFixed(1)}" fill="${s.color}"/>`;
    });
    svg += '</g>';
  });
  // Límite en escalones
  let d = '';
  limite.forEach((v, i) => { d += `${i ? 'L' : 'M'}${(i * anchoCat).toFixed(1)},${Y(v).toFixed(1)}L${((i + 1) * anchoCat).toFixed(1)},${Y(v).toFixed(1)}`; });
  svg += `<path class="graf-limite-esc" d="${d}"/></svg>`;
  const pct = v => (1 - v / yMax) * 100;
  const ejes = ys.map(v => `<span class="graf-y" style="top:${pct(v)}%">${fmt(v, decimales(yMax, 0))}</span>`).join('');
  const xs = categorias.map((c, i) => `<span class="graf-x ${i % 2 ? 'impar' : ''}" style="left:${((i + 0.5) / categorias.length) * 100}%">${esc(c.replace('H', ''))}</span>`).join('');
  const leyenda = series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.nombre)}</span>`).join('') + '<span><i class="graf-leyenda-lim"></i>Límite SIGET</span>';
  return `<div class="graf-bloque"><div class="graf-titulo"><b>${esc(titulo)}</b><span>${esc(unidad)}</span><span class="graf-leyenda">${leyenda}</span></div>
    <div class="graf-area graf-area-barras">${svg}<div class="graf-ejes">${ejes}</div><div class="graf-xs">${xs}</div></div></div>`;
}

// Cursor de las gráficas de línea: valores de esa gráfica en el punto más cercano
export function cursorReclamo(ev) {
  const area = ev.currentTarget; const g = GRAFICAS.get(area.dataset.graf); if (!g) return;
  const rect = area.getBoundingClientRect();
  const frac = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
  const tMax = g.t[g.t.length - 1] || 1; const objetivo = frac * tMax;
  let i = 0; let mejor = Infinity;
  g.t.forEach((t, k) => { const dist = Math.abs(t - objetivo); if (dist < mejor) { mejor = dist; i = k; } });
  const x = (g.t[i] / tMax) * W;
  const linea = area.querySelector('.graf-cursor'); linea.setAttribute('x1', x); linea.setAttribute('x2', x); linea.setAttribute('visibility', 'visible');
  const tip = document.getElementById('graf-tooltip'); if (!tip) return;
  tip.replaceChildren();
  const cab = document.createElement('div'); cab.className = 'graf-tooltip-t'; cab.textContent = String(g.fechas[i] || '').slice(0, 16);
  tip.append(cab, ...g.series.map(s => {
    const div = document.createElement('div');
    const sw = document.createElement('i'); sw.style.background = s.color;
    const b = document.createElement('b'); b.textContent = `${fmt(s.v[i], g.dec)} ${g.unidad}`;
    div.append(sw, b, document.createTextNode(` ${s.nombre}`));
    return div;
  }));
  tip.hidden = false;
  const modal = area.closest('.graf-modal'); const mr = modal.getBoundingClientRect();
  tip.style.left = `${Math.min(ev.clientX - mr.left + 14, mr.width - 190)}px`;
  tip.style.top = `${rect.top - mr.top + modal.scrollTop + 8}px`;
}
export function salirCursorReclamo(ev) {
  const linea = ev.currentTarget.querySelector('.graf-cursor'); if (linea) linea.setAttribute('visibility', 'hidden');
  const tip = document.getElementById('graf-tooltip'); if (tip) tip.hidden = true;
}

// ── Tablas ──

function tablaEstadisticas(titulo, est, fases, dec = 2) {
  const filas = [['Máx', 'max'], ['Prom', 'prom'], ['Mín', 'min']];
  return `<table class="tabla-est"><thead><tr><th>${esc(titulo)}</th>${fases.map(p => `<th><i style="background:${COLOR_FASE[p]}"></i>Fase ${p}</th>`).join('')}</tr></thead><tbody>
    ${filas.map(([l, k]) => `<tr><td>${l}</td>${fases.map(p => `<td>${fmt(est[p]?.[k], dec)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function tablaArmonicos(lista, fases, nf) {
  return `<div class="tabla-scroll"><table class="tabla-est tabla-arm"><thead><tr><th>Parámetro</th><th>Límite</th>${['1', '2', '3'].map(p => `<th>Fase ${p}</th>`).join('')}</tr></thead><tbody>
    ${lista.map((f, i) => `<tr class="${i === 0 ? 'total' : ''}"><td>${esc(f.nombre)}</td><td>${esc(f.limTxt)}</td>${['1', '2', '3'].map(p => {
      const x = f.fases[p];
      if (!x || Number(p) > nf) return '<td class="na">N/A</td>';
      return `<td class="${x.cumple ? 'ok' : 'mal'}" title="${x.exc} intervalos fuera (${fmt(x.pct, 2)} % del tiempo)">${fmt(x.p95, 3)} %<small>${fmt(x.pct, 1)} % fuera</small></td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
}

// ── Modal ──

const aviso = (texto, color = 'amarillo') => `<div class="aviso aviso-${color}"><i class="ic ic-alerta"></i> ${texto}</div>`;

function bloqueArchivos(a, c) {
  const slot = (tipo, titulo, sub, info) => {
    const f = a[tipo];
    return `<div class="arch-slot ${f ? 'lleno' : ''}"><i class="ic ic-${f ? 'check' : 'archivo'}"></i><div><b>${titulo}</b>
      <small>${f ? `${esc(f.nombre)}${info ? ' · ' + info : ''}` : sub}</small></div></div>`;
  };
  const infoT = c?.d ? `${c.d.n} registros, ${c.d.columnas} columnas` : a.tension ? 'no se pudo leer' : '';
  const infoA = c?.arm ? `${c.arm.n} registros` : '';
  return `<div class="bloque"><div class="bloque-head"><div class="bloque-titulo">Archivos de la medición</div>
      <label class="btn-accion"><i class="ic ic-subir"></i> ${a.tension || a.armonicos ? 'Cambiar TXT' : 'Subir los TXT'}<input type="file" accept=".txt,text/plain" multiple hidden onchange="subirTXTReclamo(this.files); this.value=''"></label></div>
    <div class="arch-slots">${slot('tension', 'Tensión', 'TXT de 74 columnas (máximos y mínimos)', infoT)}${slot('armonicos', 'Armónicos', 'TXT de 10 minutos de 197 columnas', infoA)}</div>
    <div class="page-sub" style="margin-top:8px">Puedes subir los dos a la vez; la app reconoce cuál es cuál por sus columnas.</div></div>`;
}

function bloqueDatos(p) {
  const opcion = (v, label, sel) => `<option value="${v}" ${String(sel) === String(v) ? 'selected' : ''}>${label}</option>`;
  return `<div class="bloque"><div class="bloque-head"><div class="bloque-titulo">Datos de la medición</div></div>
    <div class="form-analisis">
      <div class="field"><label>Usuario o empresa</label><input id="ar-usuario" value="${esc(p.usuario)}" onchange="setParamReclamo('usuario', this.value)" placeholder="Aparece en los títulos del Excel"></div>
      <div class="field"><label>Tipo de instalación</label><select id="ar-fases" onchange="setParamReclamo('fases', this.value)">${opcion(1, 'Monofásico', p.fases)}${opcion(2, 'Bifásico', p.fases)}${opcion(3, 'Trifásico', p.fases)}</select></div>
      <div class="field"><label>Tensión nominal (V)</label><input id="ar-nominal" inputmode="numeric" list="ar-niveles" value="${esc(p.nominal)}" onchange="setParamReclamo('nominal', this.value)"><datalist id="ar-niveles">${NIVELES.map(n => `<option value="${n}">`).join('')}</datalist></div>
      <div class="field"><label>Urbanidad y red</label><select id="ar-red" onchange="setParamReclamo('red', this.value)">${Object.entries(TIPOS_RED).map(([k, x]) => opcion(k, `${x.label} (±${Math.round(x.tol * 100)} %)`, p.red)).join('')}</select></div>
      <div class="field"><label>Capacidad del trafo (kVA)</label><input id="ar-kva" inputmode="decimal" value="${esc(p.kva)}" onchange="setParamReclamo('kva', this.value)" placeholder="Para corriente máxima y cargabilidad"></div>
      <div class="field"><label>Voltaje L-L de salida del trafo (V)</label><input id="ar-vll" inputmode="decimal" value="${esc(p.vll)}" onchange="setParamReclamo('vll', this.value)" placeholder="Para la corriente máxima del trafo"></div>
    </div></div>`;
}

const fasesSeries = (fases, obtener, prefijo) => fases.map(p => ({ nombre: `${prefijo}${p}`, color: COLOR_FASE[p], v: obtener(p) })).filter(s => s.v);

function seccionTension(a, c) {
  const { d, t, tol } = c;
  if (!d) return a.tension ? aviso('No se pudo leer el TXT de tensión: no trae la columna U1 [V].') : aviso('Sube el TXT de tensión para ver los perfiles de tensión, corriente, PST y cargabilidad.', 'azul');
  const p = a.params; const fases = t.fases; const nominal = Number(p.nominal) || 0;
  const banda = nominal > 0 ? { nominal, tol, sup: nominal * (1 + tol), inf: nominal * (1 - tol) } : null;
  let html = `<div class="graf-periodo">${esc(d.inicio)} al ${esc(d.fin)} · ${d.n} registros${banda ? ` · nominal ${fmt(nominal)} V, ${esc(TIPOS_RED[p.red]?.label)} ±${Math.round(tol * 100)} % (${fmt(banda.inf)} a ${fmt(banda.sup)} V)` : ''}</div>`;
  if (!banda) html += aviso('Escribe la tensión nominal para calcular el FebNoPer y dibujar los límites.');
  const r = t.resumen;
  if (r) {
    const ft = r.estado === 'FUERA DE TOLERANCIA'; const err = r.validos === 0;
    html += `<div class="veredicto-dtft ${err ? 'error' : ft ? 'ft' : 'dt'}"><b>${err ? 'Revisar' : ft ? 'FT' : 'DT'}</b><span>${err ? 'Ningún registro válido: revisa la tensión nominal' : ft ? 'Fuera de tolerancia' : 'Dentro de tolerancia'} · FebNoPer ${fmt(r.febNoPer * 100, 2)} %</span></div>`;
    html += `<div class="tiles">
      <div class="tile t-azul"><span class="v">${fmt(r.total)}</span><span class="l">Registros totales</span></div>
      <div class="tile ${r.invalidos ? 't-ambar' : 't-gris'}"><span class="v">${fmt(r.invalidos)}</span><span class="l">Inválidos (&lt; 70 %)</span></div>
      <div class="tile t-azul"><span class="v">${fmt(r.validos)}</span><span class="l">Válidos</span></div>
      <div class="tile ${r.ft ? 't-rojo' : 't-verde'}"><span class="v">${fmt(r.ft)}</span><span class="l">Registros FT</span></div>
      <div class="tile ${ft || err ? 't-rojo' : 't-verde'}"><span class="v">${fmt(r.febNoPer * 100, 2)} %</span><span class="l">FebNoPer · ${esc(err ? 'Revisar nivel de tensión' : ft ? 'Fuera de tolerancia' : 'Dentro de tolerancia')}</span></div>
    </div>`;
  }
  const g = (id, titulo, unidad, series, extra = {}) => graficaLinea({ id, titulo, unidad, t: d.t, fechas: d.fechas, series, ...extra });
  const bloqueGraf = (contenido, tabla) => `<div class="bloque graf-con-tabla">${contenido}${tabla}</div>`;
  html += bloqueGraf(g('u', 'Tensión promedio', 'V', fasesSeries(fases, x => d.U[x]?.v, 'U'), { banda }), tablaEstadisticas('Tensión (V)', t.U.v, fases, 1));
  if (fases.some(x => d.U[x]?.max)) html += bloqueGraf(g('umax', 'Tensión máxima', 'V', fasesSeries(fases, x => d.U[x]?.max, 'U'), { banda }), tablaEstadisticas('Máximos (V)', t.U.max, fases, 1));
  if (fases.some(x => d.U[x]?.min)) html += bloqueGraf(g('umin', 'Tensión mínima', 'V', fasesSeries(fases, x => d.U[x]?.min, 'U'), { banda }), tablaEstadisticas('Mínimos (V)', t.U.min, fases, 1));
  if (fases.some(x => d.I[x])) html += bloqueGraf(g('i', 'Corriente promedio', 'A', fasesSeries(fases, x => d.I[x]?.v, 'I'), { desdeCero: true }), tablaEstadisticas('Corriente (A)', t.I.v, fases));
  if (fases.some(x => d.I[x]?.max)) {
    const lin = t.iMaxTrafo ? [{ valor: t.iMaxTrafo, nombre: `I máx trafo ${fmt(t.iMaxTrafo, 1)} A`, tipo: 'trafo' }] : [];
    html += bloqueGraf(g('imax', 'Corriente máxima', 'A', fasesSeries(fases, x => d.I[x]?.max, 'I'), { desdeCero: true, lineas: lin }),
      tablaEstadisticas('Máximos (A)', t.I.max, fases) + (t.iMaxTrafo ? '' : '<div class="page-sub">Escribe los kVA y el voltaje L-L del trafo para ver su corriente máxima.</div>'));
  }
  if (fases.some(x => d.PST[x])) {
    const p95 = `<table class="tabla-est"><thead><tr><th>Parámetro</th>${fases.map(x => `<th><i style="background:${COLOR_FASE[x]}"></i>Fase ${x}</th>`).join('')}</tr></thead>
      <tbody><tr><td>Percentil 95 %</td>${fases.map(x => `<td class="${t.pstP95[x] > LIMITE_PST ? 'mal' : 'ok'}">${fmt(t.pstP95[x], 4)}</td>`).join('')}</tr></tbody></table>`;
    html += bloqueGraf(g('pst', 'Flicker PST', 'p.u.', fasesSeries(fases, x => d.PST[x], 'PST'), { desdeCero: true, lineas: [{ valor: LIMITE_PST, nombre: 'Límite PST = 1' }] }), p95);
  }
  const kva = Number(p.kva) || 0;
  if (!t.S) html += aviso('El TXT de tensión no trae STOTAL (ni por nombre ni en la columna 75): no se puede graficar la cargabilidad.');
  else if (!kva) html += aviso('Escribe la capacidad del trafo (kVA) para ver la cargabilidad.', 'azul');
  else {
    html += bloqueGraf(g('carga', 'Cargabilidad', 'kVA', [{ nombre: 'STOTAL', color: COLOR_FASE[1], v: t.S }], {
      desdeCero: true, lineas: [{ valor: kva, nombre: `Capacidad ${fmt(kva)} kVA`, tipo: 'trafo' }, { valor: kva * CARGA_ALERTA, nombre: `85 % · ${fmt(kva * CARGA_ALERTA, 1)} kVA`, tipo: 'alerta' }],
    }), `<table class="tabla-est"><thead><tr><th>STOTAL (kVA)</th><th>Valor</th></tr></thead><tbody>${[['Máx', 'max'], ['Prom', 'prom'], ['Mín', 'min']].map(([l, k]) => `<tr><td>${l}</td><td>${fmt(t.carga[k], 2)}</td></tr>`).join('')}</tbody></table>
      <div class="page-sub">STOTAL tomado de la ${esc(d.stotal.origen === 'nombre' ? 'columna ' + d.stotal.encabezado : d.stotal.origen + (d.stotal.encabezado ? ` (${d.stotal.encabezado})` : ''))}.</div>`);
  }
  return html;
}

function seccionArmonicos(a, c) {
  const arm = c.arm;
  if (!a.armonicos) return aviso('Sube el TXT de armónicos (el de 10 minutos, 197 columnas) para evaluar los armónicos según SIGET 38-E-2015.', 'azul');
  if (!arm?.n) return aviso('No se pudo leer el TXT de armónicos: ninguna fila trae las 194 columnas que usa la macro.');
  const fases = arm.fases;
  let html = `<div class="graf-periodo">${esc(arm.inicio)} al ${esc(arm.fin)} · ${arm.n} intervalos de 10 minutos · cumple si está fuera de límite ${PERC_MAX} % del tiempo o menos (Arts. 45 y 51)</div>`;
  if (arm.incompletas) html += aviso(`${arm.incompletas} ${arm.incompletas === 1 ? 'fila no trae' : 'filas no traen'} las 194 columnas y no se ${arm.incompletas === 1 ? 'toma' : 'toman'} en cuenta.`);
  html += '<div class="veredictos">' + fases.map(p => `<div class="veredicto"><span class="graf-fase"><i style="background:${COLOR_FASE[p]}"></i>Fase ${p}</span>
    <div><span class="tg ${arm.cumpleTension[p] ? 'verde' : 'rojo'}">Tensión: ${arm.cumpleTension[p] ? 'CUMPLE' : 'NO CUMPLE'}</span>
    <span class="tg ${arm.cumpleCorriente[p] ? 'verde' : 'rojo'}">Corriente: ${arm.cumpleCorriente[p] ? 'CUMPLE' : 'NO CUMPLE'}</span></div></div>`).join('') + '</div>';
  const cats = ARMONICAS.map(n => 'H' + n);
  html += `<div class="bloque">${graficaBarras({ titulo: 'Espectro de tensión · TDI percentil 95 vs. Tabla 4', unidad: '%', categorias: cats, limite: arm.espectro.map(e => e.limTDI), series: fases.map(p => ({ nombre: `F${p}`, color: COLOR_FASE[p], v: arm.espectro.map(e => e.tdi[p]) })) })}</div>`;
  html += `<div class="bloque">${graficaBarras({ titulo: 'Espectro de corriente · DAII percentil 95 vs. Tabla 5', unidad: '%', categorias: cats, limite: arm.espectro.map(e => e.limDAII), series: fases.map(p => ({ nombre: `F${p}`, color: COLOR_FASE[p], v: arm.espectro.map(e => e.daii[p]) })) })}</div>`;
  html += `<div class="bloque">${graficaLinea({ id: 'vdat', titulo: 'VDAT en el tiempo', unidad: '%', t: arm.t, fechas: arm.fechas, desdeCero: true, series: fases.map(p => ({ nombre: `VDAT F${p}`, color: COLOR_FASE[p], v: arm.VDAT[p] })), lineas: [{ valor: VDAT_LIM, nombre: 'Límite SIGET 8 %' }] })}</div>`;
  html += `<div class="bloque">${graficaLinea({ id: 'dati', titulo: 'DATI en el tiempo', unidad: '%', t: arm.t, fechas: arm.fechas, desdeCero: true, series: fases.map(p => ({ nombre: `DATI F${p}`, color: COLOR_FASE[p], v: arm.DATI[p] })), lineas: [{ valor: DATI_LIM, nombre: 'Límite SIGET 20 %' }] })}</div>`;
  html += `<div class="bloque"><div class="bloque-head"><div class="bloque-titulo">Armónicos de tensión · Tabla 4 (Art. 45)</div></div>${tablaArmonicos(arm.tension, fases, arm.nf)}
    <div class="page-sub">Percentil 95 (IEC 61000-4-7) y % del tiempo fuera del límite. TDI = Un/U1 × 100.</div></div>`;
  html += `<div class="bloque"><div class="bloque-head"><div class="bloque-titulo">Armónicos de corriente · Tabla 5 (Arts. 49-51)</div></div>${tablaArmonicos(arm.corriente, fases, arm.nf)}
    <div class="page-sub">DAII = In/I1 × 100. El percentil 95 se calcula con los intervalos de P ≥ 3.5 kW. Cada intervalo se evalúa en % si P ≥ 3.5 kW y en amperios si es menor.</div></div>`;
  return html;
}

export function renderAnalisisReclamo() {
  const a = state.analisisReclamo;
  const r = state.records.find(x => x.id === a.id) || {};
  let html = '<div class="modal-overlay" onclick="if (event.target === this) cerrarAnalisisReclamo()"><div class="modal hoja modal-ancha graf-modal">';
  const g = r.analisisReclamo;
  html += `<div class="modal-head"><div><div class="modal-titulo mono">${esc(r.caso)}</div><div class="page-sub">${esc(r.lugar)}${g ? ` · guardado el ${fmtDate(g.fecha)}${g.por ? ' por ' + esc(g.por) : ''}` : ''}</div></div><button class="modal-cerrar" onclick="cerrarAnalisisReclamo()" title="Cerrar">✕</button></div>`;
  if (a.cargando) return html + '<div class="graf-vacio">Cargando los archivos guardados…</div></div></div>';
  return html + cuerpoAnalisis(a, { guardar: true }) + '</div></div>';
}

// Pestaña Graficar: lo mismo, rápido y sin guardar (para revisar una medición en campo)
export function renderGraficar() {
  const a = state.graficar;
  let html = '<div class="content">';
  html += heroSeccion({
    eyebrow: 'Herramientas', titulo: 'Graficar',
    sub: 'Sube el TXT de la medición y revisa al instante los valores, las gráficas y si queda dentro (DT) o fuera de tolerancia (FT). No se guarda nada.',
    acciones: a.tension || a.armonicos ? '<button class="hero-btn blanco" onclick="limpiarGraficar()">Empezar de nuevo</button>' : '',
  });
  return html + `<div class="graf-modal graf-pagina">${cuerpoAnalisis(a, { guardar: false })}</div></div>`;
}

function cuerpoAnalisis(a, { guardar }) {
  let html = '';
  if (a.error) html += aviso(`No se pudieron cargar los archivos guardados: ${esc(a.error)}`);
  const c = calculoReclamo(a);
  html += bloqueArchivos(a, c);
  html += bloqueDatos(a.params);
  if (a.tension || a.armonicos) {
    const vista = a.vista || (a.tension ? 'tension' : 'armonicos');
    html += `<div class="segmento segmento-ancho" style="margin-bottom:12px">
      <button class="${vista === 'tension' ? 'active' : ''}" onclick="setVistaReclamo('tension')">Tensión, corriente y PST</button>
      <button class="${vista === 'armonicos' ? 'active' : ''}" onclick="setVistaReclamo('armonicos')">Armónicos</button></div>`;
    html += '<div class="graf-tooltip" id="graf-tooltip" hidden></div>';
    html += vista === 'tension' ? seccionTension(a, c) : seccionArmonicos(a, c);
    html += `<div class="barra-acciones analisis-acciones">
      ${guardar ? `<button class="b b-p" onclick="guardarAnalisisReclamo()" ${a.guardando ? 'disabled' : ''}><i class="ic ic-check"></i> ${a.guardando ? 'Guardando…' : 'Guardar en el reclamo'}</button>` : ''}
      ${c.d ? '<button class="b b-g" onclick="exportarTensionReclamo()"><i class="ic ic-excel"></i> Excel de tensión</button>' : ''}
      ${c.arm?.n ? '<button class="b b-g" onclick="exportarArmonicosReclamo()"><i class="ic ic-excel"></i> Excel de armónicos</button>' : ''}</div>`;
  }
  return html;
}
