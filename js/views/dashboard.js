// Pestaña Inicio: lo que hay que hacer (calculado de los datos), resumen del trabajo y de los equipos
import { isAdmin, userArea } from '../config.js';
import { GRUPOS, calcularPendientes } from '../domain/pendientes.js';
import { agruparCampanas, areaDeInstalacion, diasEntre, hoyLocal, registrosDeTipo } from '../domain/trabajo.js';
import { casosFT } from '../domain/ft.js';
import { state } from '../state.js';
import { calcSt, escapeHtml, eqEnCampo, eqSt, fmtDate } from '../utils.js';
import { areaVista, textoPlazo } from './trabajo.js';
import { areaHero, heroSeccion } from './componentes.js';

const esc = s => escapeHtml(s ?? '');
const ICONO_PENDIENTE = { ft: 'ft', retiro: 'ruta', descarga: 'descargar', informe: 'reclamos', requerimiento: 'requerimientos', campana: 'campanas' };
const CLASE_GRUPO = { vencido: 'rojo', hoy: 'rojo', proximo: 'amarillo', sin_fecha: 'gris' };

export function renderDashboard() {
  const hoy = hoyLocal();
  const area = areaVista();
  const nombre = state.sesionUsuario?.nombre?.split(' ')[0] || '';
  const fechaLarga = new Date().toLocaleDateString('es-SV', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, c => c.toUpperCase());
  const pend = calcularPendientes({ registros: state.records, campanasGuardadas: state.campanas || {}, hoy, area, desde: state.seguimientoDesde });
  const cuenta = u => pend.filter(p => p.urgencia === u).length;
  const resumen = [[cuenta('vencido'), 'vencido', 'vencidos'], [cuenta('hoy'), 'para hoy', 'para hoy'], [cuenta('proximo'), 'próximo', 'próximos']]
    .filter(([n]) => n).map(([n, uno, varios]) => `${n} ${n === 1 ? uno : varios}`).join(' · ');

  // Estado del trabajo (no repite los pendientes)
  const delArea = r => !area || areaDeInstalacion(r) === area;
  const enCampo = state.records.filter(r => delArea(r) && !r.retirado && (r.fechaInstalacion || '') <= hoy).length;
  const retirosSemana = state.records.filter(r => delArea(r) && !r.retirado && r.fechaRetiro && r.fechaRetiro >= hoy && diasEntre(hoy, r.fechaRetiro) <= 7).length;
  const campAbiertas = agruparCampanas(state.records, hoy, state.campanas).filter(c => (!area || c.area === area) && !state.campanas?.[c.clave]?.entrega).length;
  const ftAbiertos = casosFT(state.campanas, state.records, hoy).filter(x => !x.cerrado && (!area || x.area === area)).length;

  let html = '<div class="content inicio">';
  html += heroSeccion({
    eyebrow: fechaLarga, titulo: `Hola, ${nombre}`, sub: pend.length ? `Tienes ${pend.length} ${pend.length === 1 ? 'pendiente' : 'pendientes'}${resumen ? ': ' + resumen : ''}.` : 'Todo al día.',
    derecha: areaHero(state.areaFiltro !== 'todas', userArea()),
    kpis: [
      { v: enCampo, l: 'Mediciones en campo', onclick: "switchTab('instalaciones')" },
      { v: retirosSemana, l: 'Retiros esta semana', onclick: "switchTab('instalaciones')" },
      { v: campAbiertas, l: 'Campañas sin entregar', onclick: "switchTab('campanas')" },
      { v: ftAbiertos, l: 'Casos FT abiertos', alerta: ftAbiertos > 0, onclick: "switchTab('ft')" },
    ],
  });
  html += '<div class="inicio-layout">';
  html += `<div class="ini-pend">${renderPendientes(hoy, pend)}</div>`;
  html += `<div class="ini-trabajo">${renderResumenTrabajo(hoy, area, ftAbiertos)}</div>`;
  html += `<div class="ini-equipos">${renderEquipos()}</div>`;
  html += `<div class="ini-acciones">${renderAcciones()}</div>`;
  html += `<div class="ini-actividad">${renderActividad()}</div>`;
  html += '</div>';
  if (state.showReporteModal) html += renderReporteModal();
  return html + '</div>';
}

function renderPendientes(hoy, lista) {
  const desde = state.seguimientoDesde;
  let html = `<div class="bloque pend-estilo-tiempo"><div class="bloque-head"><div class="bloque-titulo">Pendientes${lista.length ? ` <span class="cuenta">${lista.length}</span>` : ''}</div></div>`;
  if (!lista.length) {
    html += '<div class="todo-al-dia"><i class="ic ic-check"></i> Todo al día. No hay nada vencido ni por vencer en los próximos 3 días.</div>';
  } else {
    GRUPOS.forEach(([clave, titulo]) => {
      const items = lista.filter(p => p.urgencia === clave);
      if (!items.length) return;
      html += `<div class="grupo grupo-${CLASE_GRUPO[clave]}"><div class="grupo-titulo"><i class="grupo-punto"></i>${titulo} <span>${items.length}</span></div><div class="pend-lista">`;
      items.forEach(p => {
        const tgClase = { vencido: 'rojo', hoy: 'rojo', proximo: 'ambar', sin_fecha: 'gris' }[clave];
        const [, mm, dd] = (p.fecha || '').split('-');
        const MES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        html += `<div class="pendiente pend-${CLASE_GRUPO[clave]}" onclick="${accionPendiente(p)}">
          <span class="pend-dia">${dd ? `<b>${Number(dd)}</b><span>${MES[Number(mm) - 1]}</span>` : '<b>—</b><span>sin fecha</span>'}</span>
          <span class="pend-ic"><i class="ic ic-${ICONO_PENDIENTE[p.clase]}"></i></span>
          <div class="pendiente-texto"><div class="pendiente-titulo">${esc(p.titulo)}</div>${p.detalle ? `<div class="pendiente-detalle">${esc(p.detalle)}</div>` : ''}</div>
          ${p.fecha && clave !== 'sin_fecha' ? `<div class="pendiente-fecha"><span class="tg ${tgClase}">${textoPlazo(p.fecha, hoy)}</span><small>${fmtDate(p.fecha)}</small></div>` : ''}
          ${clave === 'sin_fecha' && p.clase === 'informe' && p.fecha ? `<div class="pendiente-fecha"><small>${fmtDate(p.fecha)}</small></div>` : ''}
          <i class="ic ic-chevron-right pend-go"></i>
        </div>`;
      });
      html += '</div></div>';
    });
  }
  html += renderDesde(hoy, desde);
  return html + '</div>';
}

// Desde qué fecha se cuentan los pendientes (lo anterior no se arrastra)
function renderDesde(hoy, desde) {
  if (state.editandoDesde) {
    return `<div class="desde"><label>Contar pendientes desde <input type="date" id="desde-fecha" value="${desde || hoy}"></label>
      <button class="btn-accion" onclick="guardarSeguimientoDesde(document.getElementById('desde-fecha').value)">Guardar</button>
      ${desde ? '<button class="btn-link" onclick="guardarSeguimientoDesde(null)">Contar todo</button>' : ''}
      <button class="btn-link" onclick="toggleEditarDesde()">Cancelar</button></div>`;
  }
  if (desde) return `<div class="desde">Cuenta desde el ${fmtDate(desde)}; lo anterior no aparece. <button class="btn-link" onclick="toggleEditarDesde()">Cambiar</button></div>`;
  return `<div class="desde">¿Aparecen mediciones viejas? <button class="btn-link" onclick="guardarSeguimientoDesde('${hoy}')">Contar solo desde hoy</button> <button class="btn-link" onclick="toggleEditarDesde()">Elegir fecha</button></div>`;
}

function accionPendiente(p) {
  if (p.clase === 'campana') return `abrirCampanaTrabajo('${p.clave}')`;
  if (p.clase === 'ft') return `switchTab('ft'); abrirFT('${p.clave}', '${p.id}')`;
  if (p.clase === 'informe') return "switchTab('reclamos')";
  if (p.clase === 'requerimiento') return "switchTab('requerimientos')";
  return `goToInstall('${p.id}')`;
}

// Trabajo: una fila por tipo, con su número y lo que significa
function renderResumenTrabajo(hoy, area, ftAbiertos) {
  const delArea = r => !area || areaDeInstalacion(r) === area;
  const campanas = agruparCampanas(state.records, hoy, state.campanas).filter(c => !area || c.area === area);
  const campAbiertas = campanas.filter(c => !state.campanas?.[c.clave]?.entrega);
  const reclamos = registrosDeTipo(state.records, 'reclamo').filter(delArea);
  const reqs = registrosDeTipo(state.records, 'requerimiento').filter(delArea);
  const fila = (tab, icono, titulo, num, sub, alerta = false) => `<button class="ini-fila ${alerta ? 'alerta' : ''}" onclick="switchTab('${tab}')">
      <span class="ini-fila-ic"><i class="ic ic-${icono}"></i></span><span class="ini-fila-tx"><b>${titulo}</b><small>${sub}</small></span><span class="ini-fila-n">${num}</span><i class="ic ic-chevron-right ini-fila-go"></i></button>`;
  let html = '<div class="bloque"><div class="bloque-head"><div class="bloque-titulo">Trabajo</div></div><div class="ini-filas">';
  html += fila('campanas', 'campanas', 'Campañas', campAbiertas.length, campAbiertas.length === 1 ? 'sin entregar' : 'sin entregar');
  html += fila('reclamos', 'reclamos', 'Reclamos', reclamos.filter(r => !r.informeEntregado).length,
    `${reclamos.filter(r => !r.retirado).length} en campo · ${reclamos.filter(r => r.retirado && !r.informeEntregado).length} con informe pendiente`);
  html += fila('requerimientos', 'requerimientos', 'Requerimientos', reqs.filter(r => !r.entregaRealizada).length, 'por entregar');
  html += fila('ft', 'ft', 'Seguimiento FT', ftAbiertos, ftAbiertos ? 'abiertos: se penalizan' : 'sin casos abiertos', ftAbiertos > 0);
  return html + '</div></div>';
}

function renderEquipos() {
  const activos = state.records.filter(r => calcSt(r) === 'ACTIVO' || calcSt(r) === 'PROXIMO' || calcSt(r) === 'VENCIDO');
  const cond = e => e.condicion || 'bueno';
  const items = [
    [state.equipos.filter(e => eqSt(e) === 'disponible').length, 'Disponibles', 'verde'],
    [state.equipos.filter(e => eqEnCampo(e)).length, 'En campo', 'azul'],
    [state.equipos.filter(e => cond(e) === 'mantenimiento').length, 'En mantenimiento', 'morado'],
    [state.equipos.filter(e => cond(e) === 'fuera').length, 'Fuera de servicio', 'rojo'],
  ];
  let html = `<div class="bloque"><div class="bloque-head"><div class="bloque-titulo">Equipos <span class="cuenta">${state.equipos.length}</span></div><button class="b b-l" onclick="switchTab('inventario')">Ver equipos</button></div>`;
  html += '<div class="equipos-grid">';
  items.forEach(([n, label, color]) => { html += `<button class="equipo-dato" onclick="switchTab('inventario')"><b class="txt-${color}">${n}</b><span>${label}</span></button>`; });
  html += '</div>';
  html += '<div class="instalaciones-area"><span>Instalaciones en campo</span>';
  ['CPT MT', 'CPT BT', 'Campos y Servicios'].forEach(a => {
    html += `<span class="chip-dato"><b>${activos.filter(r => (r.areaInstalacion || 'CPT MT') === a).length}</b> ${a === 'Campos y Servicios' ? 'C&S' : a}</span>`;
  });
  return html + '</div></div>';
}

function renderAcciones() {
  const accion = (onclick, icono, texto) => `<button class="accion" onclick="${onclick}"><i class="ic ic-${icono}"></i><span>${texto}</span></button>`;
  let html = '<div class="bloque"><div class="bloque-head"><div class="bloque-titulo">Acciones rápidas</div></div><div class="acciones">';
  html += accion('newInstallFromDash()', 'instalaciones', 'Nueva instalación');
  html += accion("switchTab('carga')", 'despachos', 'Despacho');
  html += accion("switchTab('validaciones')", 'validacion', 'Validaciones de TAP' + (state.validaciones.length ? ` (${state.validaciones.length} campañas)` : ''));
  html += accion('abrirReporteModal()', 'excel', 'Reporte mensual');
  html += '</div>';
  if (isAdmin()) html += `<button class="b b-l" style="margin-top:8px" onclick="toggleMantenimiento()"><i class="ic ic-ajustes"></i> ${state.modoMantenimiento ? 'Desactivar' : 'Activar'} modo mantenimiento de la app</button>`;
  return html + '</div>';
}

function renderReporteModal() {
  let html = '';
  const MESES_RM = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  html += '<div class="modal-overlay" style="position:fixed;inset:0;background:#00000088;z-index:300;display:flex;align-items:flex-end"><div style="background:var(--white);border-radius:20px 20px 0 0;width:100%;padding:20px;font-family:var(--font);max-height:90vh;overflow-y:auto">';
  html += '<div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:14px"><i class=ic-grafica></i> Reporte mensual</div>';
  html += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">MES</div><div style="display:flex;gap:4px;flex-wrap:wrap">';
  MESES_RM.forEach((m,i) => { const ms=i+1; html += '<div onclick="setReporteMes('+ms+')" style="padding:5px 9px;border-radius:8px;border:2px solid '+(state.reporteMes===ms?'#0891b2':'var(--border)')+';background:'+(state.reporteMes===ms?'#ecfeff':'#fff')+';color:'+(state.reporteMes===ms?'#0891b2':'var(--text3)')+';font-size:11px;font-weight:700;cursor:pointer">'+m+'</div>'; });
  html += '</div></div>';
  const aNow = new Date().getFullYear();
  html += '<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">AÑO</div><div style="display:flex;gap:6px">';
  [aNow-1,aNow,aNow+1].forEach(a => { html += '<div onclick="setReporteAnio('+a+')" style="padding:6px 14px;border-radius:8px;border:2px solid '+(state.reporteAnio===a?'#0891b2':'var(--border)')+';background:'+(state.reporteAnio===a?'#ecfeff':'#fff')+';color:'+(state.reporteAnio===a?'#0891b2':'var(--text3)')+';font-size:12px;font-weight:700;cursor:pointer">'+a+'</div>'; });
  html += '</div></div>';
  html += '<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">ÁREA</div><div style="display:flex;gap:6px;flex-wrap:wrap">';
  ['TODOS','CPT MT','CPT BT','Campos y Servicios'].forEach(ar => { html += '<div onclick="setReporteArea(this.dataset.a)" data-a="'+ar+'" style="padding:6px 10px;border-radius:8px;border:2px solid '+(state.reporteArea===ar?'#0891b2':'var(--border)')+';background:'+(state.reporteArea===ar?'#ecfeff':'#fff')+';color:'+(state.reporteArea===ar?'#0891b2':'var(--text3)')+';font-size:11px;font-weight:700;cursor:pointer">'+(ar==='TODOS'?'Todas':ar)+'</div>'; });
  html += '</div></div>';
  html += '<button onclick="generarReporteMensual()" style="width:100%;padding:13px;border:none;border-radius:10px;background:#0891b2;color:#fff;font-family:var(--font);font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px"><i class=ic-descargar></i> Generar Excel</button>';
  html += '<button onclick="cerrarReporteModal()" style="width:100%;padding:11px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--text3);font-family:var(--font);font-size:13px;cursor:pointer">Cancelar</button>';
  html += '</div></div>';
  return html;
}

function renderActividad() {
  let html = '';
  // ── CALENDARIO DE ACTIVIDAD ──
  html += '<div class="bloque">';
  html += '<div class="bloque-head" style="margin-bottom:' + (state.calView ? '12px' : '0') + '"><div class="bloque-titulo">Actividad</div>';
  html += '<button class="b b-g" onclick="toggleCal()"><i class="ic ic-calendario"></i> ' + (state.calView ? 'Ocultar calendario' : 'Ver calendario') + '</button>';
  html += '</div>';

  if (state.calView) {
    // Build activity map from all data
    const actMap = {};
    const addAct = (fecha, tipo, label, sub) => {
      if (!fecha) return;
      const d = fecha.toString().split('T')[0].substring(0,10);
      if (!actMap[d]) actMap[d] = [];
      actMap[d].push({ tipo, label, sub: sub||'' });
    };
    // Instalaciones y retiros
    state.records.forEach(r => {
      const sub = [r.lugar||r.nombre||r.usuario||'', r.idUsuario||r.id_usuario||r.nc||'', r.direccion||''].filter(Boolean).join(' · ');
      if (r.fechaInstalacion) addAct(r.fechaInstalacion, 'install', '<i class=ic-instalaciones></i> Instalación: '+(r.caso||r.serie||''), sub);
      if (r.retirado && r.fechaRetiroReal) addAct(r.fechaRetiroReal, 'retiro', '<i class=ic-subir></i> Retiro: '+(r.caso||r.serie||''), sub);
      // Descargas
      (r.descargas||[]).forEach(dsc => {
        if (dsc.fecha) addAct(dsc.fecha, 'descarga', '<i class=ic-descargar></i> Descarga: '+(r.caso||r.serie||'')+(dsc.medicionOk===false?' <i class=ic-x></i>':''), sub);
      });
    });
    // Despachos
    state.historialCargas.forEach(h => {
      if (h.fecha) addAct(h.fecha, 'despacho', '<i class=ic-equipos></i> Despacho: '+(h.total||'')+(h.total?' equipos':''), h.areaOrigen||'');
    });
    // Validaciones
    state.validaciones.forEach(v => {
      (v.usuarios||[]).forEach(u => {
        if (u.fechaValidacion) addAct(u.fechaValidacion, 'validacion', '<i class=ic-validacion></i> Validación: '+(u.siget||u.nombre||''));
      });
    });

    // Calendar grid
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const DIAS = ['D','L','M','X','J','V','S'];
    const firstDay = new Date(state.calYear, state.calMonth, 1).getDay();
    const daysInMonth = new Date(state.calYear, state.calMonth+1, 0).getDate();
    const today2 = new Date();
    const todayStr = today2.getFullYear()+'-'+String(today2.getMonth()+1).padStart(2,'0')+'-'+String(today2.getDate()).padStart(2,'0');

    html += '<div class="ini-calendario">';
    // Month nav
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
    html += '<button onclick="calNav(-1)" style="width:28px;height:28px;border:1px solid var(--border);border-radius:8px;background:var(--white);cursor:pointer;font-size:14px">‹</button>';
    html += '<div style="font-size:14px;font-weight:800;color:var(--text)">'+MESES[state.calMonth]+' '+state.calYear+'</div>';
    html += '<button onclick="calNav(1)" style="width:28px;height:28px;border:1px solid var(--border);border-radius:8px;background:var(--white);cursor:pointer;font-size:14px">›</button>';
    html += '</div>';
    // Day headers
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">';
    DIAS.forEach(d => { html += '<div style="text-align:center;font-size:10px;font-weight:700;color:var(--text3);padding:2px 0">'+d+'</div>'; });
    html += '</div>';
    // Day cells
    html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">';
    // Empty cells before first day
    for (let i=0; i<firstDay; i++) html += '<div></div>';
    for (let d=1; d<=daysInMonth; d++) {
      const ds = state.calYear+'-'+String(state.calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
      const acts = actMap[ds] || [];
      const isToday = ds === todayStr;
      const isSel = ds === state.calDiaSeleccionado;
      const hasAct = acts.length > 0;
      // Color dots by type
      const tipos = [...new Set(acts.map(a=>a.tipo))];
      const dotColors = { install:'#16a34a', retiro:'#ea580c', descarga:'#0057b8', despacho:'#7c3aed', validacion:'#0891b2' };
      html += '<div onclick="selCal(\''+ds+'\')" style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:8px;cursor:'+(hasAct?'pointer':'default')+';background:'+(isSel?'var(--primary)':isToday?'var(--primary-light)':'transparent')+';border:'+(isToday&&!isSel?'1.5px solid var(--primary)':'1.5px solid transparent')+'">';
      html += '<div style="font-size:12px;font-weight:'+(isToday||isSel?'800':'500')+';color:'+(isSel?'#fff':isToday?'var(--primary)':'var(--text)')+'">'+d+'</div>';
      if (hasAct) {
        html += '<div style="display:flex;gap:2px;margin-top:1px">';
        tipos.slice(0,3).forEach(t => { html += '<div style="width:4px;height:4px;border-radius:50%;background:'+(isSel?'rgba(255,255,255,.8)':dotColors[t]||'var(--primary)')+'"></div>'; });
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';

    // Selected day detail
    if (state.calDiaSeleccionado) {
      const selActs = actMap[state.calDiaSeleccionado] || [];
      const [sy,sm,sd] = state.calDiaSeleccionado.split('-');
      html += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border2)">';
      html += '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:8px">'+parseInt(sd)+' de '+MESES[parseInt(sm)-1]+' '+sy+'</div>';
      if (selActs.length === 0) {
        html += '<div style="font-size:12px;color:var(--text3);text-align:center;padding:8px 0">Sin actividad este día</div>';
      } else {
        const dotColors2 = { install:'#16a34a', retiro:'#ea580c', descarga:'#0057b8', despacho:'#7c3aed', validacion:'#0891b2' };
        const bgColors = { install:'#dcfce7', retiro:'#ffedd5', descarga:'#dbeafe', despacho:'#f3f0ff', validacion:'#cffafe' };
        selActs.forEach(a => {
          html += '<div style="padding:8px 10px;background:'+(bgColors[a.tipo]||'#f8fafc')+';border-radius:8px;margin-bottom:4px">';
          html += '<div style="display:flex;align-items:center;gap:8px">';
          html += '<div style="width:6px;height:6px;border-radius:50%;background:'+(dotColors2[a.tipo]||'var(--primary)')+';flex-shrink:0"></div>';
          html += '<div style="font-size:12px;color:var(--text);font-weight:600">'+a.label+'</div>';
          html += '</div>';
          if (a.sub) html += '<div style="font-size:11px;color:var(--text3);margin-top:3px;padding-left:14px">'+a.sub+'</div>';
          html += '</div>';
        });
      }
      html += '</div>';
    }
    html += '</div>'; // end calendar card
  }
  html += '</div>'; // end actividad section
  return html;
}
