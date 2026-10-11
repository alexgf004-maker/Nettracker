// Formulario de inspección de las instalaciones del usuario (PDF para subir con el reclamo).
// Formato formal de la app: todas las opciones aparecen como casillas, marcadas o vacías, para que se lea igual
// que un formulario impreso. Sin firma en pantalla queda la línea para firmar a mano.
import {
  CARGAS, conexion, CONDICIONES_TABLERO, CONEXIONES_PRI, CONEXIONES_SEC, CONSTRUCCION_TRI, INSTALACION_GENERAL,
  kvasTrafos, kvaTotal, LECTURAS, LIMITE_TIERRA, lista, MONTAJES, OTRA, PROTECCIONES, ROLES_FIRMA, TIPOS_SUBESTACION, veredictoTierra,
} from '../domain/inspeccion.js';
import { escapeHtml } from '../utils.js';
import { docMemo, seccion } from './memo-base.js';

const e = s => escapeHtml(s ?? '');
const fecha = iso => { const [a, m, d] = String(iso || '').split('-'); return a && m && d ? `${d}/${m}/${a}` : ''; };
const cb = (marcado, texto) => `<span class="cb${marcado ? ' on' : ''}"><i></i>${e(texto)}</span>`;
const cbs = (pares, col2 = false) => `<div class="cbs${col2 ? ' col2' : ''}">${pares.map(([m, t]) => cb(m, t)).join('')}</div>`;
const checklist = (obj, catalogo, col2 = true) => cbs(Object.entries(catalogo).map(([k, t]) => [!!obj?.[k], t]), col2);
// Filas de etiqueta/valor en pares: [[eti, val], ...] → tabla de 4 columnas
const filas = pares => {
  let html = '';
  for (let i = 0; i < pares.length; i += 2) {
    const [a, b] = [pares[i], pares[i + 1]];
    html += `<tr><td class="eti">${a[0]}</td><td class="val"${b ? '' : ' colspan="3"'}>${a[1]}</td>${b ? `<td class="eti">${b[0]}</td><td class="val">${b[1]}</td>` : ''}</tr>`;
  }
  return `<table class="ft">${html}</table>`;
};

export function buildFormularioInspeccion(exp = {}, insp = {}, { inspector = '' } = {}) {
  const sub = insp.subestacion || {}; const med = insp.medidor || {};
  const tipo = sub.tipo;
  let n = 0; const sec = (titulo, html) => seccion(`${++n}. ${titulo}`, html);
  let cuerpo = '';

  cuerpo += sec('Datos del usuario y del reclamo', filas([
    ['NC', e(exp.nc)], ['Nombre del usuario', e(exp.nombre)],
    ['DS / CT', e([exp.corte, exp.ct].filter(Boolean).join(' / '))], ['Medidor', e(exp.medidor)],
    ['Dirección', e(exp.direccion)], ['Código / WO', e([exp.codigo, exp.wo].filter(Boolean).join(' / '))],
    ['Motivo del reclamo', e(exp.motivo)], ['Circuito / Subestación', e([insp.circuito, insp.subestacionDist].filter(Boolean).join(' / '))],
  ]));

  // Subestación: tipo, transformadores con sus kVA, montaje y conexiones del tipo elegido
  const kvas = kvasTrafos(sub); const total = kvaTotal(sub);
  const tiposCon = tipo ? [tipo] : Object.keys(TIPOS_SUBESTACION);
  const opcionesCon = (lado, catalogo) => {
    const elegido = sub[lado];
    const ops = [...new Set(tiposCon.flatMap(t => catalogo[t]))];
    const pares = ops.map(o => [elegido === o || (lado === 'conexionSec' && tipo === 'mono'), o]);
    pares.push([elegido === OTRA, `Otra${elegido === OTRA && conexion(sub, lado) ? ': ' + conexion(sub, lado) : ''}`]);
    return cbs(pares);
  };
  let s = `<table class="ft"><tr><td class="eti">Tipo</td><td colspan="3">${cbs(Object.entries(TIPOS_SUBESTACION).map(([k, t]) => [tipo === k, t]))}</td></tr>`;
  if (tipo === 'tri') s += `<tr><td class="eti">Construcción</td><td colspan="3">${cbs(Object.entries(CONSTRUCCION_TRI).map(([k, t]) => [(sub.construccion || 'banco') === k, t]))}</td></tr>`;
  s += `<tr><td class="eti">Transformadores</td><td colspan="3" class="val">${kvas.length ? kvas.map((k, i) => `${kvas.length > 1 ? `T${i + 1}: ` : ''}${k === null ? '____' : k} kVA`).join(' · ') : ''}${total ? ` &nbsp;&nbsp;<b>Total: ${total} kVA</b>` : ''}</td></tr>`;
  s += `<tr><td class="eti">Montaje</td><td colspan="3">${cbs(MONTAJES.map(m => [sub.montaje === m, m]))}</td></tr>`;
  s += `<tr><td class="eti">Conexión del primario</td><td colspan="3">${opcionesCon('conexionPri', CONEXIONES_PRI)}</td></tr>`;
  s += `<tr><td class="eti">Conexión del secundario</td><td colspan="3">${opcionesCon('conexionSec', CONEXIONES_SEC)}</td></tr>`;
  s += `<tr><td class="eti">Tensión primaria (V)</td><td class="val">${e(sub.vPri)}</td><td class="eti">Tensión secundaria (V)</td><td class="val">${e(sub.vSec)}</td></tr>`;
  s += `<tr><td class="eti">Posición del TAP</td><td class="val" colspan="3">${e(sub.tap)}</td></tr>`;
  s += `<tr><td class="eti">Observaciones</td><td class="val" colspan="3">${e(sub.notas)}</td></tr></table>`;
  cuerpo += sec('Subestación del usuario', s);

  cuerpo += sec('Medidor de facturación', filas([['Modelo', e(med.modelo)], ['Número de serie', e(med.serie || exp.medidor)], ['RTC (corriente)', e(med.rtc)], ['RTP (voltaje)', e(med.rtp)], ['Observaciones', e(med.notas)]]));

  cuerpo += sec('Instalación del usuario', `<table class="ft">
    <tr><td class="eti">Cuenta con</td><td colspan="3">${checklist(insp.general, INSTALACION_GENERAL, false)}</td></tr>
    <tr><td class="eti">Cargas principales</td><td colspan="3">${checklist(insp.cargas, CARGAS, false)}${insp.cargasOtras ? `<div class="val" style="margin-top:4px">Otras: ${e(insp.cargasOtras)}</div>` : ''}</td></tr>
    <tr><td class="eti">Horario de operación</td><td class="val" colspan="3">${e(insp.horario)}</td></tr></table>`);

  const secos = lista(insp.trafosSecos);
  if (insp.general?.trafosSecos || secos.length) {
    cuerpo += sec('Transformadores secos', `<table class="ft"><tr><th style="width:8%">#</th><th>Capacidad (kVA)</th><th>Voltaje primario (V)</th><th>Voltaje secundario (V)</th><th style="width:34%">Ubicación / cargas</th></tr>
      ${(secos.length ? secos : [{}]).map((t, i) => `<tr><td class="c">${i + 1}</td><td class="val">${e(t.kva)}</td><td class="val">${e(t.vPri)}</td><td class="val">${e(t.vSec)}</td><td class="val">${e(t.ubicacion)}</td></tr>`).join('')}</table>`);
  }

  // Tableros
  const tableros = lista(insp.tableros);
  (tableros.length ? tableros : [{}]).forEach((tb, i) => {
    const ver = veredictoTierra(tb.tierra);
    const lect = tb.lect || {};
    cuerpo += sec(`Tablero${tableros.length > 1 ? ' ' + (i + 1) : ''}: ${e(tb.nombre || '')}`, `<table class="ft">
      <tr><td class="eti">Resistencia a tierra</td><td class="val" colspan="3">${tb.tierra ? `${e(tb.tierra)} Ω &nbsp; <span class="${ver === 'CUMPLE' ? 'ok' : 'mal'}">${ver}</span> <span style="color:#64748b;font-weight:500">(límite ${LIMITE_TIERRA} Ω, NEC 2008)</span>` : ''}</td></tr>
      <tr><td class="eti">Protecciones</td><td colspan="3">${checklist(tb.prot, PROTECCIONES)}${tb.protOtras ? `<div class="val" style="margin-top:4px">Otras / ajustes: ${e(tb.protOtras)}</div>` : ''}</td></tr>
      <tr><td class="eti">Condiciones</td><td colspan="3">${checklist(tb.cond, CONDICIONES_TABLERO)}</td></tr>
      <tr><td class="eti">Lecturas instantáneas</td><td colspan="3" style="padding:0"><table class="ft" style="border:0"><tr>${LECTURAS.map(([, l]) => `<th class="c" style="border-top:0">${l}</th>`).join('')}</tr><tr>${LECTURAS.map(([k]) => `<td class="val c" style="border-bottom:0">${e(lect[k])}</td>`).join('')}</tr></table></td></tr>
      <tr><td class="eti">Observaciones</td><td class="val" colspan="3">${e(tb.observaciones)}</td></tr></table>`);
  });

  const equipos = lista(insp.equipos);
  cuerpo += sec('Equipo dañado reportado', `<table class="ft"><tr><th>Equipo</th><th>Marca / modelo / serie</th><th>Rango de placa</th><th>Monto ($)</th><th>Disponible</th></tr>
    ${(equipos.length ? equipos : [{}]).map(q => `<tr><td class="val">${e(q.equipo)}</td><td class="val">${e([q.marca, q.modelo, q.serie].filter(Boolean).join(' / '))}</td><td class="val">${q.vmin && q.vmax ? `${e(q.vmin)} – ${e(q.vmax)} V` : ''}</td><td class="val">${e(q.monto)}</td><td>${cbs([[q.disponible === 'si', 'Sí'], [q.disponible === 'no', 'No']])}</td></tr>${q.descripcion ? `<tr><td colspan="5" class="val"><span style="color:#64748b;font-weight:500">Daño reportado:</span> ${e(q.descripcion)}</td></tr>` : ''}`).join('')}</table>`);

  cuerpo += sec('Observaciones generales', `<table class="ft"><tr><td class="val" style="height:${insp.observaciones ? 'auto' : '60px'}">${e(insp.observaciones)}</td></tr></table>`);

  const fs = insp.firmas || {};
  cuerpo += sec('Firmas', `<div class="ffirmas">${Object.entries(ROLES_FIRMA).map(([rol, eti]) => {
    const f = fs[rol] || {};
    const nombre = f.nombre || (rol === 'inspector1' ? inspector : '');
    return `<div class="ffirma"><div class="ffirma-img">${f.img ? `<img src="${f.img}" alt="Firma">` : ''}</div><div class="ffirma-rol">${rol === 'acompanante' ? 'Acompañó por parte del usuario' : eti}</div><div class="ffirma-nom">${e(nombre)}</div><div class="ffirma-cargo">${e(f.cargo)}</div></div>`;
  }).join('')}</div>`);

  const hora = [insp.horaInicio, insp.horaFin].filter(Boolean).join(' – ');
  return docMemo({
    titulo: `Inspección ${exp.codigo || ''}`.trim(), tipo: 'Inspección de instalaciones', etiqueta: 'Formulario de', formal: true,
    meta: [['Reclamo', e(exp.codigo)], ['Fecha de inspección', fecha(insp.fecha)], ['Hora', e(hora)], ['Área', e(exp.area)]],
    cuerpo, pie: ` · Formulario de inspección ${e(exp.codigo || '')}`,
  });
}
