// Pestaña Seguimiento FT: casos fuera de tolerancia de todas las campañas, con su plazo de 90 días
import { casosFT, DIAS_SOLUCION_FT, ftDeRemedicion, plazoFT, puntosFT, RUTAS_FT } from '../domain/ft.js';
import { todosFT } from '../domain/expedientes.js';
import { hoyLocal, nombreCampana } from '../domain/trabajo.js';
import { state } from '../state.js';
import { escapeHtml, fmtDate } from '../utils.js';
import { areaVista, tagPlazo } from './trabajo.js';
import { areaHero } from './componentes.js';
import { userArea } from '../config.js';

const esc = s => escapeHtml(s ?? '');

// Casos FT que se ven en Seguimiento FT (según el área elegida)
export const listaFTVista = (hoy = hoyLocal()) => todosFT(state.campanas, state.reclamos, state.records, hoy).filter(x => !areaVista() || x.area === areaVista());

export function renderFT() {
  const hoy = hoyLocal();
  const lista = listaFTVista(hoy);
  const noSuben = casosFT(state.campanas, state.records, hoy, { noSuben: true }).filter(x => !areaVista() || x.area === areaVista());
  const abiertos = lista.filter(x => !x.cerrado);
  const cerrados = lista.filter(x => x.cerrado);
  const sinAviso = abiertos.filter(x => !x.ft.aviso).length;
  const vencidos = abiertos.filter(x => x.vencido).length;
  let html = '<div class="content">';
  html += `<div class="hero ${abiertos.length ? 'hero-rojo' : ''}"><div class="hero-top"><div><div class="hero-eyebrow">Trabajo</div><h1 class="hero-titulo">Seguimiento FT</h1>
    <div class="hero-sub">Casos fuera de tolerancia: se penalizan. Hay ${DIAS_SOLUCION_FT} días calendario desde la instalación de la medición inicial y solo la remedición normalizada cierra el caso.</div></div></div>
    <div class="hero-kpis">
      <div class="hero-kpi"><b>${abiertos.length}</b><span>Abiertos</span></div>
      <div class="hero-kpi ${sinAviso ? 'alerta' : ''}"><b>${sinAviso}</b><span>Sin avisar a DELSUR</span></div>
      <div class="hero-kpi ${vencidos ? 'alerta' : ''}"><b>${vencidos}</b><span>Plazo vencido</span></div>
      <div class="hero-kpi"><b>${cerrados.length}</b><span>Cerrados</span></div>
    </div>
    <div class="hero-acciones page-hero-acciones">${areaHero(state.areaFiltro !== 'todas', userArea())}</div></div>`;
  if (!lista.length) {
    return html + `<div class="empty"><i class="empty-icon ic ic-ft"></i><div class="empty-text">No hay casos fuera de tolerancia. Aparecen aquí cuando un resultado de campaña o el análisis de un reclamo queda fuera de tolerancia.</div></div>${seccionNoSuben(noSuben)}</div>`;
  }
  // Lista o mapa de los abiertos; el mapa también se baja como KML para Google My Maps
  const vista = state.ftVista === 'mapa' && abiertos.length ? 'mapa' : 'lista';
  if (abiertos.length) {
    html += `<div class="ft-vista"><div class="seg" role="tablist"><button role="tab" class="${vista === 'lista' ? 'on' : ''}" onclick="setFTVista('lista')"><i class="ic ic-ft"></i> Lista</button><button role="tab" class="${vista === 'mapa' ? 'on' : ''}" onclick="setFTVista('mapa')"><i class="ic ic-mapa"></i> Mapa</button></div>
      <button class="b b-g" onclick="bajarKMLFT()" title="Archivo para importar en Google My Maps"><i class="ic ic-descargar"></i> Bajar KML (My Maps)</button></div>`;
  }
  if (vista === 'mapa') return html + mapaFT(abiertos) + seccionNoSuben(noSuben) + '</div>';
  const tarjeta = x => {
    const pct = x.dias === null ? 0 : Math.min(100, Math.round(x.dias * 100 / DIAS_SOLUCION_FT));
    const feb = x.caso.resultado?.febNoPer;
    return `<div class="card ft-card ${x.cerrado ? 'cerrado' : ''}" onclick="abrirFT('${x.clave}', '${x.id}')"><div class="ft-item" style="border:none">
      <div class="ft-pct">${feb === undefined || feb === '' ? '—' : esc(feb) + '%'}<small>FebNoPer</small></div>
      <div class="ft-info"><div class="card-top" style="margin:0"><div><b>${esc(x.codigo)}</b><div class="n">${esc(x.caso.nombre)} · ${x.tipo === 'reclamo' ? 'Reclamo' : nombreCampana(x)} · ${esc(x.area)}</div></div>
          ${x.cerrado ? '<span class="tg verde"><i class="ic ic-check"></i> Cerrado</span>' : x.limite ? tagPlazo(x.limite, hoy) : '<span class="falta">Sin fecha de instalación</span>'}</div>
        ${x.dias !== null && !x.cerrado ? `<div class="ft-dias"><i class="${x.vencido || pct >= 80 ? 'mal' : ''}" style="width:${pct}%"></i></div>
          <div class="barra-leyenda" style="margin:4px 0 0"><span>Día ${x.dias} de ${DIAS_SOLUCION_FT}</span><span>Instalación ${fmtDate(x.inicio)} · plazo ${fmtDate(x.limite)}</span></div>` : ''}
        <div class="tags">
          ${x.ft.aviso ? `<span class="tg verde"><i class="ic ic-correo"></i> Aviso enviado ${fmtDate(x.ft.aviso.fecha)}</span>` : '<span class="tg rojo"><i class="ic ic-correo"></i> Falta avisar a DELSUR</span>'}
          ${x.cerrado ? '' : `${x.ft.sistema ? '' : '<span class="tg rojo"><i class="ic ic-subir"></i> Falta subir al sistema</span>'}${x.ft.resumen ? '' : '<span class="tg rojo"><i class="ic ic-correo"></i> Falta enviar Resumen punto medido</span>'}`}
          ${x.ft.ruta ? `<span class="tg azul">${esc(x.ft.ruta)}</span>` : ''}
          ${x.remedicionInstalada ? `<span class="tg gris">Remedición ${esc(x.remedicionInstalada.codigo)} ${x.remedicionInstalada.retirado ? 'retirada' : 'en campo'}</span>` : ''}
          ${x.vencido ? '<span class="tg rojo">Más de 90 días: se penalizan los 90 días y la compensación sigue</span>' : ''}
        </div></div>
      <i class="ic ic-chevron-right" style="color:var(--text3)"></i></div></div>`;
  };
  if (abiertos.length) html += `<div class="section-title">Abiertos (${abiertos.length})</div><div class="list">${abiertos.map(tarjeta).join('')}</div>`;
  if (cerrados.length) html += `<div class="section-title" style="margin-top:16px">Cerrados (${cerrados.length})</div><div class="list">${cerrados.map(tarjeta).join('')}</div>`;
  return html + seccionNoSuben(noSuben) + '</div>';
}

// CR FT que quedaron después de la medición hasta la que se sube al sistema: solo para verlos, sin seguimiento
function seccionNoSuben(lista) {
  if (!lista.length) return '';
  return `<div class="section-title" style="margin-top:16px">No se suben al sistema (${lista.length})</div>
    <div class="aviso aviso-azul"><i class="ic ic-info"></i><div>Salieron fuera de tolerancia pero quedan después de la medición hasta la que se sube al sistema: no llevan seguimiento FT.</div></div>
    <div class="list">${lista.map(x => { const feb = x.caso.resultado?.febNoPer; return `<div class="card ft-card ft-nosube"><div class="ft-item" style="border:none">
      <div class="ft-pct">${feb === undefined || feb === '' ? '—' : esc(feb) + '%'}<small>FebNoPer</small></div>
      <div class="ft-info"><b>${esc(x.codigo)}</b><div class="n">${esc(x.caso.nombre)} · ${nombreCampana(x)} · ${esc(x.area)}</div><div class="tags"><span class="tg gris">No se sube · sin seguimiento</span></div></div></div></div>`; }).join('')}</div>`;
}

// Mapa de los FT abiertos (Leaflet en un iframe, como la pestaña Mapa): color por plazo, código y FebNoPer en cada punto
function mapaFT(abiertos) {
  const { puntos, sinGPS } = puntosFT(abiertos, state.records);
  const n = k => puntos.filter(p => p.plazo.clave === k).length;
  const leyenda = [['vencido', 'Vencido'], ['por_vencer', 'Por vencer'], ['en_plazo', 'En plazo'], ['sin_fecha', 'Sin fecha']]
    .map(([k, t]) => n(k) ? `<span><i style="background:${plazoFT({ vencido: k === 'vencido', dias: k === 'sin_fecha' ? null : k === 'por_vencer' ? 90 : 0 }).color}"></i>${t} (${n(k)})</span>` : '').join('');
  let html = '<div class="ft-mapa">';
  if (puntos.length) {
    const datos = JSON.stringify(puntos).replace(/</g, '\\u003c');
    const doc = `<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'><link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'/>\x3cscript src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'><\/script><style>*{margin:0;padding:0}body,html,#map{width:100%;height:100%;font-family:sans-serif}.et{background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:1px 5px;font-size:10px;font-weight:700;color:#0f172a;box-shadow:none}.et:before{display:none}.pc{font-weight:800;font-size:14px}.pm{font-size:12px;color:#475569;margin-top:2px}<\/style><\/head><body><div id='map'><\/div>\x3cscript>var P=${datos};var map=L.map('map');L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:''}).addTo(map);var b=[];var e=function(s){return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});};P.forEach(function(p){var m=L.circleMarker([p.lat,p.lng],{radius:8,color:'#fff',weight:2,fillColor:p.plazo.color,fillOpacity:1}).addTo(map);m.bindTooltip(e(p.codigo)+(p.febNoPer?' · '+e(p.febNoPer):''),{permanent:true,direction:'right',offset:[8,0],className:'et'});m.bindPopup('<div class=pc>'+e(p.codigo)+'<\/div><div class=pm>FebNoPer: '+e(p.febNoPer||'—')+'<\/div><div class=pm style="color:'+p.plazo.color+';font-weight:700">'+e(p.plazo.texto)+'<\/div><div class=pm>'+e(p.nombre)+'<\/div><div class=pm>'+e(p.direccion)+'<\/div><a href="https://maps.google.com/?q='+p.lat+','+p.lng+'" target=_blank style="font-size:11px">Ver en Google Maps<\/a>');b.push([p.lat,p.lng]);});if(b.length===1)map.setView(b[0],15);else map.fitBounds(b,{paddingTopLeft:[30,30],paddingBottomRight:[150,30]});<\/script><\/body><\/html>`;
    html += `<iframe title="Mapa de los casos FT" src="data:text/html;charset=utf-8,${encodeURIComponent(doc)}"></iframe>`;
  } else html += '<div class="empty"><i class="empty-icon ic ic-mapa"></i><div class="empty-text">Ningún caso FT abierto tiene GPS.</div></div>';
  html += `<div class="ft-mapa-leyenda">${leyenda}</div>`;
  if (sinGPS.length) html += `<div class="aviso aviso-amarillo"><i class="ic ic-alerta"></i><div>Sin GPS (no salen en el mapa ni en el KML): ${sinGPS.map(esc).join(', ')}</div></div>`;
  return html + '</div>';
}

export function renderFTModal() {
  const { clave, id } = state.ftEdit;
  const x = todosFT(clave === 'reclamo' ? {} : { [clave]: state.campanas?.[clave] }, clave === 'reclamo' ? state.reclamos : {}, state.records, hoyLocal()).find(f => f.id === id);
  if (!x) return '';
  const ft = x.ft; const rem = ft.remedicion || {};
  let html = '<div class="modal-overlay"><div class="modal hoja">';
  html += `<div class="modal-head"><div><div class="modal-titulo mono">${esc(x.codigo)}</div><div class="page-sub">${esc(x.caso.nombre)} · FebNoPer ${esc(x.caso.resultado?.febNoPer ?? '—')} %</div></div><button class="modal-cerrar" onclick="cerrarFT()" title="Cerrar">✕</button></div>`;
  if (x.tipo === 'reclamo' && x.instId) html += `<button class="btn btn-secondary" onclick="cerrarFT(); abrirAnalisisReclamo('${x.instId}')"><i class="ic ic-grafica"></i> Ver análisis de la medición</button>`;
  else if (x.caso.resultado?.graficas) html += `<button class="btn btn-secondary" onclick="verGraficas('${clave}', '${id}')"><i class="ic ic-grafica"></i> Ver gráficas de voltaje y corriente</button>`;
  html += `<div class="panel-fila"><span>Instalación de la medición inicial</span><b>${fmtDate(x.inicio)}</b></div>`;
  html += `<div class="panel-fila"><span>Plazo de ${DIAS_SOLUCION_FT} días</span><b>${fmtDate(x.limite)}${x.dias !== null ? ` · día ${x.dias}` : ''}</b></div>`;

  html += '<div class="section-title" style="margin-top:12px">1. Aviso a DELSUR</div>';
  html += ft.aviso
    ? `<div class="aviso aviso-verde"><i class="ic ic-check"></i> Enviado el ${fmtDate(ft.aviso.fecha)} por ${esc(ft.aviso.por)} <button class="btn-link" onclick="quitarAvisoFT('${clave}', '${id}')">Deshacer</button></div>`
    : `<button class="btn btn-primary" onclick="marcarAvisoFT('${clave}', '${id}')"><i class="ic ic-correo"></i> Marcar aviso enviado por correo</button>`;

  // Pasos que se marcan con fecha y quién (salen en Inicio hasta marcarlos)
  const paso = (k, hecho, boton, icono) => ft[k]
    ? `<div class="aviso aviso-verde"><i class="ic ic-check"></i> ${hecho} el ${fmtDate(ft[k].fecha)} por ${esc(ft[k].por)} <button class="btn-link" onclick="quitarPasoFT('${clave}', '${id}', '${k}')">Deshacer</button></div>`
    : `<button class="btn btn-primary" onclick="marcarPasoFT('${clave}', '${id}', '${k}')"><i class="ic ic-${icono}"></i> ${boton}</button>`;
  html += '<div class="section-title" style="margin-top:12px">2. Subir el caso al sistema</div>';
  html += paso('sistema', 'Subido', 'Marcar caso subido al sistema', 'subir');
  html += '<div class="section-title" style="margin-top:12px">3. Resumen punto medido</div>';
  if (!ft.resumen) html += '<div class="aviso aviso-amarillo ft-recordatorio"><i class="ic ic-correo"></i> Envía por correo el <b>Resumen punto medido</b>: la gráfica que genera el sistema al subir el caso.</div>';
  html += paso('resumen', 'Enviado', 'Marcar Resumen punto medido enviado', 'correo');

  html += '<div class="section-title" style="margin-top:12px">4. Ruta de solución</div>';
  html += `<div class="field"><select onchange="setRutaFT('${clave}', '${id}', this.value)"><option value="">Sin definir</option>${RUTAS_FT.map(r => `<option ${ft.ruta === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>`;
  html += `<div class="field"><label>Compensación diaria informada (el cálculo de montos está pendiente de definir)</label><input inputmode="decimal" value="${esc(ft.compensacionDiaria ?? '')}" onchange="setCompensacionFT('${clave}', '${id}', this.value)"></div>`;

  html += '<div class="section-title" style="margin-top:12px">Bitácora</div><div class="filas">';
  (ft.notas || []).forEach(n => { html += `<div class="fila"><div class="fila-main"><div class="fila-sub">${fmtDate(n.fecha)} · ${esc(n.por)}</div><div>${esc(n.texto)}</div></div></div>`; });
  html += `</div><div class="row"><input id="ft-nota" value="${esc(state.ftNota)}" oninput="setFTNota(this.value)" placeholder="Ej.: mediciones aledañas, memo de soluciones, presupuesto enviado…"><button class="btn-accion" onclick="agregarNotaFT('${clave}', '${id}')">Agregar</button></div>`;

  html += '<div class="section-title" style="margin-top:12px">5. Remedición (cierra el caso)</div>';
  html += avisoFotos(ft.fotos);
  html += paso('fotos', 'Fotos subidas a MEMOS', 'Marcar fotos subidas a MEMOS', 'subir');
  if (x.remedicionInstalada) html += `<div class="aviso aviso-azul"><i class="ic ic-info"></i> Instalación encontrada: ${esc(x.remedicionInstalada.codigo)} desde el ${fmtDate(x.remedicionInstalada.fecha)}${x.remedicionInstalada.retirado ? ' (retirada)' : ''}</div>`;
  html += `<div class="row"><div class="field"><label>Código</label><input value="${esc(rem.codigo || x.remedicionInstalada?.codigo || '')}" onchange="setRemedicionFT('${clave}', '${id}', 'codigo', this.value)"></div>
    <div class="field"><label>Fecha</label><input type="date" value="${esc(rem.fecha || '')}" onchange="setRemedicionFT('${clave}', '${id}', 'fecha', this.value)"></div></div>`;
  html += `<div class="field"><label>¿La remedición demuestra que el voltaje se normalizó?</label><div class="segmento segmento-ancho">
    <button class="${rem.normalizado === true ? 'active' : ''}" onclick="setRemedicionFT('${clave}', '${id}', 'normalizado', true)">Sí, se normalizó</button>
    <button class="${rem.normalizado === false ? 'active' : ''}" onclick="setRemedicionFT('${clave}', '${id}', 'normalizado', false)">No</button></div></div>`;
  html += x.cerrado ? '<div class="aviso aviso-verde"><i class="ic ic-check"></i> Caso cerrado por remedición normalizada</div>' : '';
  html += '<button class="btn btn-secondary" style="margin-top:8px" onclick="cerrarFT()">Cerrar</button>';
  return html + '</div></div>';
}

// Recordatorio de las fotos de los trabajos antes de la remedición (en Seguimiento FT y al registrar la remedición)
export function avisoFotos(hecho) {
  if (hecho) return '';
  return `<div class="aviso-fotos"><i class="ic ic-alerta"></i><div><b>Antes de remedir: toma fotografías de los trabajos realizados</b>
    <span>Todo lo que se hizo para mejorar el voltaje (cambio de trafo, transferencia, conexiones, etc.). Después súbelas a la carpeta compartida <b>MEMOS</b>.</span></div></div>`;
}

// En el formulario de instalación: si el código es la remedición de un caso FT abierto, recuerda las fotos
export function avisoRemedicionHTML(codigo) {
  const x = ftDeRemedicion(codigo, todosFT(state.campanas, state.reclamos, state.records, hoyLocal()));
  if (!x) return '';
  return `<div class="aviso-remedicion-tit">Remedición del caso FT ${esc(x.codigo)}</div>` + (avisoFotos(x.ft.fotos) || '<div class="aviso aviso-verde"><i class="ic ic-check"></i> Fotos de los trabajos ya subidas a MEMOS</div>');
}
