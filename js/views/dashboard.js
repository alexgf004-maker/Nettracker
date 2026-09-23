// Pestaña Inicio (dashboard)
import { isAdmin, userArea } from '../config.js';
import { state } from '../state.js';
import { calcSt, daysUntil, eqEnCampo, eqSt } from '../utils.js';

export function renderDashboard() {
  let html = '';
  const ua = userArea();
  const activos = state.records.filter(r => calcSt(r) === 'ACTIVO');
  const proximos = state.records.filter(r => !r.retirado && daysUntil(r.fechaRetiro) <= 7 && daysUntil(r.fechaRetiro) > 0).sort((a,b) => daysUntil(a.fechaRetiro)-daysUntil(b.fechaRetiro));
  const vencidos = state.records.filter(r => !r.retirado && daysUntil(r.fechaRetiro) < 0);
  const descPend = state.records.filter(r => r.retirado && r.descargaPendiente);
  const enMant = state.equipos.filter(e => (e.condicion||'bueno') === 'mantenimiento');
  const fuera = state.equipos.filter(e => (e.condicion||'bueno') === 'fuera');
  const disponibles = state.equipos.filter(e => eqSt(e) === 'disponible');
  const enCampo = state.equipos.filter(e => eqEnCampo(e));

  html += '<div class="content">';
  html += '<div style="margin-bottom:16px">';
  html += '<div style="font-size:20px;font-weight:800;color:var(--text)">Hola, '+(state.sesionUsuario?.nombre?.split(' ')[0]||'')+'! 👋</div>';
  html += '<div style="font-size:12px;color:var(--text3);margin-top:2px">'+new Date().toLocaleDateString('es-SV',{weekday:'long',day:'numeric',month:'long'}).replace(/^./,c=>c.toUpperCase())+'</div>';
  html += '</div>';

  // Alerts
  if (vencidos.length > 0) {
    html += '<div onclick="switchTab(this.dataset.t)" data-t="instalaciones" style="background:var(--red-light);border:1px solid #fecaca;border-radius:12px;padding:12px 16px;margin-bottom:10px;cursor:pointer">';
    html += '<div style="font-size:13px;font-weight:700;color:var(--red)">⚠️ '+vencidos.length+' retiro'+(vencidos.length>1?'s':'')+' vencido'+(vencidos.length>1?'s':'')+'</div>';
    html += '<div style="font-size:11px;color:var(--red);margin-top:2px">Toca para ver</div></div>';
  }
  if (descPend.length > 0) {
    html += '<div onclick="switchTab(this.dataset.t)" data-t="inventario" style="background:var(--yellow-light);border:1px solid #fcd34d;border-radius:12px;padding:12px 16px;margin-bottom:10px;cursor:pointer">';
    html += '<div style="font-size:13px;font-weight:700;color:var(--yellow)">💾 '+descPend.length+' descarga'+(descPend.length>1?'s':'')+' pendiente'+(descPend.length>1?'s':'')+'</div>';
    html += '<div style="font-size:11px;color:var(--yellow);margin-top:2px">Toca para ver inventario</div></div>';
  }

  // Active installs
  html += '<div style="background:linear-gradient(135deg,var(--primary-dark),var(--primary));border-radius:14px;padding:16px;margin-bottom:12px;color:#fff">';
  html += '<div style="font-size:11px;color:rgba(255,255,255,.7);margin-bottom:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Instalaciones activas</div>';
  html += '<div style="display:flex;gap:12px">';
  html += '<div style="flex:1;text-align:center"><div style="font-size:26px;font-weight:800;font-family:var(--mono)">'+activos.filter(r=>(r.areaInstalacion||'CPT MT')==='CPT MT').length+'</div><div style="font-size:10px;color:rgba(255,255,255,.7)">CPT MT</div></div>';
  html += '<div style="width:1px;background:rgba(255,255,255,.2)"></div>';
  html += '<div style="flex:1;text-align:center"><div style="font-size:26px;font-weight:800;font-family:var(--mono)">'+activos.filter(r=>(r.areaInstalacion||'CPT MT')==='CPT BT').length+'</div><div style="font-size:10px;color:rgba(255,255,255,.7)">CPT BT</div></div>';
  html += '<div style="width:1px;background:rgba(255,255,255,.2)"></div>';
  html += '<div style="flex:1;text-align:center"><div style="font-size:26px;font-weight:800;font-family:var(--mono)">'+activos.filter(r=>(r.areaInstalacion||'CPT MT')==='Campos y Servicios').length+'</div><div style="font-size:10px;color:rgba(255,255,255,.7)">C&S</div></div>';
  html += '</div></div>';

  // Retiros proximos
  html += '<div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Retiros próximos (' + proximos.length + ')</div>';
  if (proximos.length === 0) {
    html += '<div style="background:var(--green-light);border:1px solid var(--green);border-radius:12px;padding:12px 16px;margin-bottom:12px;font-size:13px;color:var(--green);font-weight:600">✅ Sin retiros próximos</div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px">';
    proximos.slice(0,5).forEach(r => {
      const d = daysUntil(r.fechaRetiro);
      const color = d===0?'var(--red)':d<=3?'var(--yellow)':'var(--text2)';
      const label = d===0?'HOY':d===1?'Mañana':'en '+d+'d';
      const rid = r.id;
      html += '<div onclick="goToInstall(this.dataset.id)" data-id="'+rid+'" style="background:var(--white);border:1px solid var(--border);border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;cursor:pointer">';
      html += '<div><div style="font-family:var(--mono);font-size:13px;font-weight:700">'+r.serie+'</div><div style="font-size:11px;color:var(--text3)">'+(r.areaInstalacion||'CPT MT')+' · '+(r.lugar||'')+'</div></div>';
      html += '<span style="font-size:12px;font-weight:800;color:'+color+'">'+label+'</span>';
      html += '</div>';
    });
    if (proximos.length > 5) html += '<div style="font-size:11px;color:var(--text3);text-align:center;padding:4px">+'+(proximos.length-5)+' más</div>';
    html += '</div>';
  }

  // Equipment grid
  html += '<div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Estado del inventario</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
  [
    {n:disponibles.length, label:'Disponibles', color:'var(--green)'},
    {n:enCampo.length, label:'En campo', color:'var(--yellow)'},
    {n:enMant.length, label:'En mantenimiento', color:'#7c3aed'},
    {n:fuera.length, label:'Fuera de servicio', color:'var(--red)'}
  ].forEach(item => {
    html += '<div onclick="switchTab(\"inventario\")" style="background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px;cursor:pointer">';
    html += '<div style="font-size:22px;font-weight:800;color:'+item.color+';font-family:var(--mono)">'+item.n+'</div>';
    html += '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+item.label+'</div>';
    html += '</div>';
  });
  html += '</div>';

  // Quick actions
  html += '<div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Acciones rápidas</div>';
  html += '<div style="display:flex;gap:8px">';
  html += '<button onclick="newInstallFromDash()" style="flex:1;padding:12px;border:1.5px solid var(--primary);border-radius:12px;background:var(--primary-light);color:var(--primary);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">⚡ Nueva instalación</button>';
  html += '<button onclick="switchTab(this.dataset.t)" data-t="carga" style="flex:1;padding:12px;border:1.5px solid var(--border);border-radius:12px;background:var(--white);color:var(--text2);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">📤 Despacho</button>';
  html += '</div>';
  html += '<div style="margin-top:10px">';
  html += '<button onclick="switchTab(\'validaciones\')" style="width:100%;padding:12px;border:1.5px solid #7c3aed;border-radius:12px;background:#f3f0ff;color:#7c3aed;font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">🔌 Validaciones de TAP' + (state.validaciones.length > 0 ? ' (' + state.validaciones.length + ' campañas)' : '') + '</button>';
  html += '</div>';
  html += '<div style="margin-top:8px;display:flex;gap:8px">';
  html += '<button onclick="abrirReporteModal()" style="flex:1;padding:12px;border:1.5px solid #0891b2;border-radius:12px;background:#ecfeff;color:#0891b2;font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">📊 Reporte</button>';
  html += '</div>';
  if (state.showReporteModal) {
    const MESES_RM = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    html += '<div style="position:fixed;inset:0;background:#00000088;z-index:300;display:flex;align-items:flex-end"><div style="background:var(--white);border-radius:20px 20px 0 0;width:100%;padding:20px;font-family:var(--font);max-height:90vh;overflow-y:auto">';
    html += '<div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:14px">📊 Reporte mensual</div>';
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
    html += '<button onclick="generarReporteMensual()" style="width:100%;padding:13px;border:none;border-radius:10px;background:#0891b2;color:#fff;font-family:var(--font);font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px">⬇️ Generar Excel</button>';
    html += '<button onclick="cerrarReporteModal()" style="width:100%;padding:11px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--text3);font-family:var(--font);font-size:13px;cursor:pointer">Cancelar</button>';
    html += '</div></div>';
  }
  if (isAdmin()) {
    html += '<div style="margin-top:8px">';
    html += '<button onclick="toggleMantenimiento()" style="width:100%;padding:10px;border:1.5px solid '+(state.modoMantenimiento?'var(--red)':'var(--border)')+';border-radius:12px;background:'+(state.modoMantenimiento?'var(--red-light)':'#fff')+';color:'+(state.modoMantenimiento?'var(--red)':'var(--text3)')+';font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer">'+(state.modoMantenimiento?'🔧 Desactivar mantenimiento':'🔧 Activar mantenimiento')+'</button>';
    html += '</div>';
  }

  // ── CALENDARIO DE ACTIVIDAD ──
  html += '<div style="margin-top:14px">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
  html += '<div style="font-size:13px;font-weight:700;color:var(--text)">📅 Actividad</div>';
  html += '<button onclick="toggleCal()" style="font-size:11px;font-weight:700;padding:5px 12px;border:1px solid var(--border);border-radius:20px;background:var(--white);color:var(--text3);cursor:pointer">'+(state.calView?'Ocultar':'Ver calendario')+'</button>';
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
      if (r.fechaInstalacion) addAct(r.fechaInstalacion, 'install', '⚡ Instalación: '+(r.caso||r.serie||''), sub);
      if (r.retirado && r.fechaRetiroReal) addAct(r.fechaRetiroReal, 'retiro', '📤 Retiro: '+(r.caso||r.serie||''), sub);
      // Descargas
      (r.descargas||[]).forEach(dsc => {
        if (dsc.fecha) addAct(dsc.fecha, 'descarga', '💾 Descarga: '+(r.caso||r.serie||'')+(dsc.medicionOk===false?' ❌':''), sub);
      });
    });
    // Despachos
    state.historialCargas.forEach(h => {
      if (h.fecha) addAct(h.fecha, 'despacho', '📦 Despacho: '+(h.total||'')+(h.total?' equipos':''), h.areaOrigen||'');
    });
    // Validaciones
    state.validaciones.forEach(v => {
      (v.usuarios||[]).forEach(u => {
        if (u.fechaValidacion) addAct(u.fechaValidacion, 'validacion', '🔌 Validación: '+(u.siget||u.nombre||''));
      });
    });

    // Calendar grid
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const DIAS = ['D','L','M','X','J','V','S'];
    const firstDay = new Date(state.calYear, state.calMonth, 1).getDay();
    const daysInMonth = new Date(state.calYear, state.calMonth+1, 0).getDate();
    const today2 = new Date();
    const todayStr = today2.getFullYear()+'-'+String(today2.getMonth()+1).padStart(2,'0')+'-'+String(today2.getDate()).padStart(2,'0');

    html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:14px;padding:14px">';
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
      console.log('DEBUG selActs for', state.calDiaSeleccionado, ':', JSON.stringify((actMap[state.calDiaSeleccionado]||[]).map(a=>({label:a.label,sub:a.sub}))));
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

  html += '</div>';
  return html;
}
