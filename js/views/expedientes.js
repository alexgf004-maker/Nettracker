// Pestaña Reclamos: expedientes creados a mano desde el correo de DELSUR.
// Lista como tarjetas (igual que campañas) y el expediente con pestañas Datos / Mediciones / Seguimiento.
import { userArea } from '../config.js';
import { CAMPOS_RECLAMO, ETAPAS_MEDICION, listaExpedientes, PASOS_RECLAMO } from '../domain/expedientes.js';
import { DIAS_SOLUCION_FT } from '../domain/ft.js';
import { hoyLocal, urgencia } from '../domain/trabajo.js';
import { state } from '../state.js';
import { escapeHtml, fmtDate } from '../utils.js';
import { areaHero, heroSeccion } from './componentes.js';
import { tagPlazo, textoPlazo } from './trabajo.js';

const esc = s => escapeHtml(s ?? '');
const ETIQUETA = { codigo: 'Código', wo: 'Orden de trabajo (WO)', ct: 'CT', motivo: 'Motivo', zona: 'Zona', nc: 'ID de usuario (NC)', nombre: 'Nombre del usuario', direccion: 'Dirección', corte: 'Centro MT/BT o corte', medidor: 'Medidor' };
const CLASE_ETAPA = { sin_instalar: 'gris', programada: 'gris', en_campo: 'azul', descarga_pendiente: 'ambar', retirada: 'verde' };
const pct = v => (typeof v === 'number' ? `${(v * 100).toFixed(2)} %` : '—');
const delArea = e => state.areaFiltro === 'todas' || !e.area || e.area === userArea();

// Chip del estado del expediente para la tarjeta y el encabezado
function chipEstado(e, hoy) {
  const r = e.resumen;
  if (r.estado === 'ft') return '<span class="hero-chip rojo"><i class="ic ic-sirena"></i> Fuera de tolerancia</span>';
  if (r.estado === 'cerrado') return '<span class="hero-chip verde"><i class="ic ic-check"></i> Cerrado</span>';
  const inf = r.informePendiente[0];
  if (inf) return `<span class="hero-chip ${{ vencido: 'rojo', hoy: 'rojo', proximo: 'ambar', ok: '' }[urgencia(inf.informeLimite, hoy)]}">Informe ${textoPlazo(inf.informeLimite, hoy)}</span>`;
  const a = r.actual;
  if (a?.etapa === 'en_campo' && a.retiroSugerido) return `<span class="hero-chip">Retiro ${fmtDate(a.retiroSugerido)}</span>`;
  return `<span class="hero-chip">${esc(r.siguiente ? 'Sigue: ' + r.siguiente.label.toLowerCase() : '')}</span>`;
}

export function renderReclamos() {
  const hoy = hoyLocal();
  const todos = listaExpedientes(state.reclamos, state.records, hoy).filter(delArea);
  const sel = state.expedienteId && todos.find(e => e.id === state.expedienteId);
  if (sel) return renderExpediente(sel, hoy);

  const abiertos = todos.filter(e => e.resumen.estado !== 'cerrado');
  const cerrados = todos.filter(e => e.resumen.estado === 'cerrado');
  const informe = todos.filter(e => e.resumen.informePendiente.length).length;
  const ft = todos.filter(e => e.resumen.estado === 'ft').length;
  let html = '<div class="content">';
  html += heroSeccion({
    eyebrow: 'Trabajo', titulo: 'Reclamos', sub: 'Un expediente por reclamo, desde el correo de DELSUR hasta el informe (8 días después del retiro).',
    kpis: [{ v: abiertos.length, l: 'Abiertos' }, { v: informe, l: 'Informe pendiente' }, { v: ft, l: 'Fuera de tolerancia', alerta: ft > 0 }, { v: cerrados.length, l: 'Cerrados' }],
    acciones: `<button class="hero-btn blanco" onclick="abrirNuevoReclamo()"><i class="ic ic-plus"></i> Nuevo reclamo</button>${areaHero(state.areaFiltro !== 'todas', userArea())}`,
  });
  if (!todos.length) {
    return html + '<div class="empty"><i class="empty-icon ic ic-reclamos"></i><div class="empty-text">Todavía no hay reclamos. Cuando llegue el correo de DELSUR, toca "Nuevo reclamo" y pega el asunto y la tabla.</div></div></div>';
  }
  const tarjeta = e => {
    const r = e.resumen; const actual = PASOS_RECLAMO.findIndex(([k]) => !r.pasos.find(p => p.k === k).ok);
    return `<div class="camp-card exp-card" onclick="abrirExpediente('${e.id}')">
      <div class="camp-card-top ${r.estado === 'cerrado' ? 'entregada' : ''} ${r.estado === 'ft' ? 'ft' : ''}"><div><div class="hero-eyebrow">${esc(e.area || '')}${e.recibido ? ' · recibido ' + fmtDate(e.recibido) : ''}</div>
        <div class="hero-titulo mono" style="font-size:18px">${esc(r.actual?.codigo || e.codigo)}</div></div>${chipEstado(e, hoy)}</div>
      <div class="camp-card-cuerpo">
        <div class="exp-nombre">${esc(e.nombre) || 'Sin nombre'}</div><div class="exp-sub">${esc(e.motivo || '')}${e.motivo && e.direccion ? ' · ' : ''}${esc(e.direccion || '')}</div>
        <div class="camp-pasos">${r.pasos.map((p, i) => `<i class="${p.ok ? 'ok' : i === actual ? 'en' : ''}" title="${p.label}"></i>`).join('')}</div>
        <div class="camp-pasos-l"><span>${actual < 0 ? 'Todo listo' : 'Paso actual: ' + PASOS_RECLAMO[actual][1]}</span><span>${r.mediciones.filter(m => m.inst).length} de ${r.mediciones.length} ${r.mediciones.length === 1 ? 'medición' : 'mediciones'}</span></div>
        ${r.avisos.length ? `<div class="tags" style="margin-top:8px"><span class="tg ambar"><i class="ic ic-alerta"></i> ${esc(r.avisos.join(', '))}: le compete al usuario</span></div>` : ''}
      </div></div>`;
  };
  if (abiertos.length) html += `<div class="list">${abiertos.map(tarjeta).join('')}</div>`;
  if (cerrados.length) html += `<details class="exp-cerrados"${abiertos.length ? '' : ' open'}><summary class="section-title">Cerrados (${cerrados.length})</summary><div class="list">${cerrados.map(tarjeta).join('')}</div></details>`;
  return html + '</div>';
}

function renderExpediente(e, hoy) {
  const r = e.resumen;
  let html = '<div class="content">';
  html += `<div class="hero ${r.estado === 'ft' ? 'hero-rojo' : ''}"><div class="hero-top"><div><div class="hero-eyebrow">Reclamo · ${esc(e.area || '')}</div><h1 class="hero-titulo mono">${esc(r.actual?.codigo || e.codigo)}</h1>
      <div class="hero-sub">${esc(e.nombre || '')}${e.motivo ? ' · ' + esc(e.motivo) : ''}</div></div>
      <div class="hero-acciones">${chipEstado(e, hoy)}</div></div>
    <div class="exp-pasos">${r.pasos.map(p => `<span class="${p.ok ? 'ok' : ''}"><i class="ic ic-${p.ok ? 'check' : 'reloj'}"></i>${p.label}</span>`).join('')}</div></div>`;
  const secciones = [
    ['datos', 'Datos', 'usuarios', [e.wo, e.ct].filter(Boolean).join(' · ') || 'Del correo de DELSUR'],
    ['mediciones', 'Mediciones', 'instalaciones', `${r.mediciones.filter(m => m.inst).length} de ${r.mediciones.length} instaladas`],
    ['seguimiento', 'Seguimiento', r.ft ? 'ft' : 'check', r.ft ? (r.ft.cerrado ? 'FT cerrado' : 'Fuera de tolerancia') : r.avisos.length ? 'Avisos al usuario' : 'Sin FT'],
  ];
  const vista = secciones.some(([k]) => k === state.expedienteVista) ? state.expedienteVista : 'mediciones';
  html += '<div class="pasos-tabs" role="tablist">' + secciones.map(([k, label, icono, estado]) => {
    const alerta = k === 'seguimiento' && r.estado === 'ft';
    return `<button role="tab" class="paso-tab ${vista === k ? 'active' : ''} ${alerta ? 'alerta' : ''}" onclick="setExpedienteVista('${k}')">
      <span class="paso-tab-ic"><i class="ic ic-${icono}"></i></span><span class="paso-tab-tx"><b>${label}</b><small>${esc(estado)}</small></span></button>`;
  }).join('') + '</div>';
  if (vista === 'datos') html += vistaDatos(e);
  if (vista === 'mediciones') html += vistaMediciones(e, hoy);
  if (vista === 'seguimiento') html += vistaSeguimiento(e, hoy);
  return html + '</div>';
}

function vistaDatos(e) {
  const campo = k => `<div class="field"><label>${ETIQUETA[k]}</label><input id="exp-${k}" value="${esc(e[k] ?? '')}" ${k === 'codigo' ? 'disabled' : ''} onchange="guardarDatoExpediente('${e.id}', '${k}', this.value)"></div>`;
  let html = `<div class="bloque"><div class="bloque-head"><div class="bloque-titulo">Datos del reclamo</div>${e.creado ? `<span class="page-sub">Creado el ${fmtDate(e.creado.fecha)} por ${esc(e.creado.por)}</span>` : ''}</div>
    <div class="form-analisis">${CAMPOS_RECLAMO.map(campo).join('')}
      <div class="field"><label>Fecha en que se recibió</label><input type="date" id="exp-recibido" value="${esc(e.recibido || '')}" onchange="guardarDatoExpediente('${e.id}', 'recibido', this.value)"></div>
      <div class="field"><label>Área</label><select onchange="guardarDatoExpediente('${e.id}', 'area', this.value)">${['CPT MT', 'CPT BT'].map(a => `<option ${e.area === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div></div></div>`;
  const ubicado = e.lat != null && e.lng != null && e.lat !== '' && e.lng !== '';
  html += `<div class="bloque"><div class="bloque-head"><div class="bloque-titulo">Ubicación del usuario</div>${ubicado ? '<span class="tg verde"><i class="ic ic-check"></i> Ubicado</span>' : '<span class="tg ambar">Sin coordenadas</span>'}</div>
    <div class="form-analisis">
      <div class="field"><label>Latitud</label><input id="exp-lat" inputmode="decimal" value="${esc(e.lat ?? '')}" onchange="guardarDatoExpediente('${e.id}', 'lat', this.value)"></div>
      <div class="field"><label>Longitud</label><input id="exp-lng" inputmode="decimal" value="${esc(e.lng ?? '')}" onchange="guardarDatoExpediente('${e.id}', 'lng', this.value)"></div></div>
    <div class="barra-acciones"><button class="b b-g" onclick="completarCoordenadasReclamo('${e.id}')"><i class="ic ic-map-pin"></i> Buscar en la base por NC</button>
      ${ubicado ? `<a class="b b-g" href="https://www.google.com/maps?q=${e.lat},${e.lng}" target="_blank" rel="noopener"><i class="ic ic-mapa"></i> Ver en Google Maps</a>` : ''}
      <span class="sep"></span><button class="b b-l" onclick="eliminarExpediente('${e.id}')">Eliminar expediente</button></div></div>`;
  return html;
}

function vistaMediciones(e, hoy) {
  const r = e.resumen;
  let html = '';
  r.mediciones.forEach(m => {
    const i = m.inst; const res = m.resultado;
    html += `<div class="bloque exp-medicion"><div class="bloque-head"><div class="bloque-titulo">${m.n === 1 ? 'Medición inicial' : `Remedición ${m.n - 1}`} · <span class="mono">${esc(m.codigo)}</span></div>
      <span class="tg ${CLASE_ETAPA[m.etapa]}">${ETAPAS_MEDICION[m.etapa]}</span></div>`;
    if (!i) {
      html += `<div class="page-sub" style="margin-bottom:10px">Todavía no hay una instalación con el código ${esc(m.codigo)}. Al registrarla con ese código se liga sola a este expediente.</div>
        <button class="b b-p" onclick="registrarInstalacionReclamo('${e.id}', '${m.codigo}')"><i class="ic ic-plus"></i> Registrar instalación</button></div>`;
      return;
    }
    html += `<div class="exp-fechas">
      <div><small>Instalación</small><b>${fmtDate(i.fechaInstalacion)}</b><span>${esc(i.serie || '')}</span></div>
      <div><small>Retiro</small><b>${i.retirado ? fmtDate(i.fechaRetiroReal) : fmtDate(i.fechaRetiro || m.retiroSugerido)}</b><span>${i.retirado ? 'Retirado' : `Programado · 8.º día ${fmtDate(m.retiroSugerido)}`}</span></div>
      <div><small>Informe</small><b>${m.informe ? fmtDate(m.informe.fecha) : m.informeLimite ? fmtDate(m.informeLimite) : '—'}</b><span>${m.informe ? 'Entregado' + (m.informe.por ? ' · ' + esc(m.informe.por) : '') : m.informeLimite ? 'Límite (8 días del retiro)' : 'Después del retiro'}</span></div>
    </div>`;
    if (res) {
      html += '<div class="tags" style="margin:10px 0 2px">';
      if (res.tension) html += `<span class="tg ${m.ft ? 'rojo' : 'verde'}">FebNoPer ${pct(res.tension.febNoPer)} · ${m.ft ? 'fuera de tolerancia' : 'dentro de tolerancia'}</span>`;
      if (res.flicker) html += `<span class="tg ${res.flicker === 'CUMPLE' ? 'verde' : 'ambar'}">Flicker ${res.flicker === 'CUMPLE' ? 'cumple' : 'no cumple'}</span>`;
      if (res.armonicos) html += `<span class="tg ${res.armonicos.tension === 'CUMPLE' && res.armonicos.corriente === 'CUMPLE' ? 'verde' : 'ambar'}">Armónicos: tensión ${res.armonicos.tension === 'CUMPLE' ? 'cumple' : 'no cumple'} · corriente ${res.armonicos.corriente === 'CUMPLE' ? 'cumple' : 'no cumple'}</span>`;
      html += '</div>';
    }
    html += '<div class="barra-acciones" style="margin-top:10px">';
    if (i.retirado) html += `<button class="b ${res ? 'b-g' : 'b-p'}" onclick="abrirAnalisisReclamo('${i.id}')"><i class="ic ic-grafica"></i> ${res ? 'Ver análisis' : 'Analizar TXT'}</button>`;
    if (i.retirado && !m.informe) html += `<button class="b b-p" onclick="marcarInformeEntregado('${i.id}')"><i class="ic ic-check"></i> Informe entregado</button> ${m.informeLimite ? tagPlazo(m.informeLimite, hoy) : ''}`;
    if (m.informe) html += `<button class="b b-l" onclick="desmarcarInformeEntregado('${i.id}')">Quitar marca de informe</button>`;
    html += `<span class="sep"></span><button class="b b-l" onclick="goToInstall('${i.id}')">Ver instalación</button></div></div>`;
  });
  const ultima = r.mediciones[r.mediciones.length - 1];
  const siguiente = ultima && ultima.n < 6 && ultima.inst?.retirado ? `RE${ultima.n + 1}${ultima.codigo.slice(3)}` : null;
  if (siguiente) html += `<div class="barra-acciones"><button class="b b-g" onclick="registrarInstalacionReclamo('${e.id}', '${siguiente}')"><i class="ic ic-plus"></i> Registrar remedición ${esc(siguiente)}</button></div>`;
  return html;
}

function vistaSeguimiento(e, hoy) {
  const r = e.resumen;
  let html = '';
  if (r.avisos.length) {
    html += `<div class="bloque"><div class="bloque-head"><div class="bloque-titulo">Avisos al usuario</div></div>
      <div class="aviso aviso-amarillo"><i class="ic ic-alerta"></i> ${esc(r.avisos.join(', '))} fuera de límite. Le compete al usuario corregirlo; no es un FT de la distribuidora.</div></div>`;
  }
  const f = r.ft;
  if (!f) return html || '<div class="empty"><i class="empty-icon ic ic-check"></i><div class="empty-text">Sin casos fuera de tolerancia. Si el análisis de una medición da FebNoPer mayor a 5 %, aquí empieza el seguimiento FT (aviso a DELSUR, 90 días y remedición).</div></div>';
  const p = f.dias === null ? 0 : Math.min(100, Math.round(f.dias * 100 / DIAS_SOLUCION_FT));
  html += `<div class="ft-bloque"><div class="ft-head"><div class="ft-head-ic"><i class="ic ic-sirena"></i></div><div class="ft-head-tx">
      <div class="ft-head-t">${f.cerrado ? 'FT cerrado por remedición normalizada' : 'Fuera de tolerancia'} · ${esc(f.medicion.codigo)}</div>
      <div class="ft-head-s">Mismo tratamiento que un caso regulatorio: avisar a DELSUR y normalizar con una remedición antes de ${DIAS_SOLUCION_FT} días desde la instalación.</div></div></div>
    <div class="ft-item" onclick="abrirFT('reclamo', '${e.id}')">
      <div class="ft-pct">${pct(f.medicion.resultado?.tension?.febNoPer)}<small>FebNoPer</small></div>
      <div class="ft-info"><b>${esc(f.medicion.codigo)}</b><div class="n">Instalación ${fmtDate(f.inicio)} · plazo ${fmtDate(f.limite)}</div>
        <div class="tags">${f.cerrado ? '<span class="tg verde"><i class="ic ic-check"></i> Normalizado</span>' : f.ft.aviso ? `<span class="tg verde"><i class="ic ic-correo"></i> Avisado ${fmtDate(f.ft.aviso.fecha)}</span>` : '<span class="tg rojo"><i class="ic ic-correo"></i> Falta avisar a DELSUR</span>'}
          ${f.limite && !f.cerrado ? `<span class="tg ${f.vencido ? 'rojo' : 'gris'}"><i class="ic ic-reloj"></i> ${f.vencido ? 'Plazo vencido' : `Día ${f.dias} de ${DIAS_SOLUCION_FT}`}</span>` : ''}
          ${f.remedicionInstalada ? `<span class="tg gris">Remedición ${esc(f.remedicionInstalada.codigo)} ${f.remedicionInstalada.retirado ? 'retirada' : 'en campo'}</span>` : ''}</div>
        ${f.limite && !f.cerrado ? `<div class="ft-dias"><i class="${f.vencido || p >= 80 ? 'mal' : ''}" style="width:${p}%"></i></div>` : ''}</div>
      <button class="b b-g" onclick="event.stopPropagation(); abrirFT('reclamo', '${e.id}')">Seguimiento</button></div></div>`;
  return html;
}

// Nuevo reclamo: pegar el correo y revisar los campos
export function renderNuevoReclamo() {
  const n = state.nuevoReclamo;
  let html = '<div class="modal-overlay"><div class="modal hoja modal-ancha">';
  html += '<div class="modal-head"><div class="modal-titulo">Nuevo reclamo</div><button class="modal-cerrar" onclick="cerrarNuevoReclamo()" title="Cerrar">✕</button></div>';
  html += `<div class="field"><label>Pega aquí el asunto y la tabla del correo de DELSUR</label>
    <textarea id="nr-correo" rows="6" placeholder="RE182026201 _ RV: WO-… , CT… , Se requiere el estudio de voltaje , …&#10;ID Usuario:  …&#10;Nombre del Usuario:  …" onchange="leerCorreoNuevoReclamo(this.value)">${esc(n.texto)}</textarea>
    <small class="page-sub">Los campos se llenan solos al salir del cuadro. Revisa que estén bien antes de guardar.</small></div>`;
  html += `<div class="form-analisis">${CAMPOS_RECLAMO.map(k => `<div class="field"><label>${ETIQUETA[k]}</label><input id="nr-${k}" value="${esc(n.datos[k])}" oninput="setCampoNuevoReclamo('${k}', this.value)"></div>`).join('')}
    <div class="field"><label>Fecha en que se recibió</label><input type="date" id="nr-recibido" value="${esc(n.recibido)}" oninput="setCampoNuevoReclamo('recibido', this.value)"></div>
    <div class="field"><label>Área</label><select id="nr-area" onchange="setCampoNuevoReclamo('area', this.value)">${['CPT MT', 'CPT BT'].map(a => `<option ${n.area === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div></div>`;
  html += '<button class="btn btn-primary" onclick="guardarNuevoReclamo()">Crear expediente</button><button class="btn btn-secondary" onclick="cerrarNuevoReclamo()">Cancelar</button>';
  return html + '</div></div>';
}
