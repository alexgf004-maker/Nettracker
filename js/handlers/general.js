// Handlers globales (onclick): navegación, búsqueda, tema, calendario, reportes, login
import { cerrarSesion, doLogin } from '../actions/auth.js';
import { userArea, userInstTab } from '../config.js';
import { mantenimientoRef, set } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { emptyEF, emptyForm, eqSt } from '../utils.js';
import { render } from '../views/render.js';

// ── GLOBAL HANDLERS ──
window.toggleDarkMode = () => {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark');
  try { localStorage.setItem('cpt_theme', dark ? 'light' : 'dark'); } catch(e) {}
  render();
};

window.dashAction = el => { switchTab(el.dataset.action); };
window.toggleGlobalSearch = () => { state.showGlobalSearch = !state.showGlobalSearch; state.globalSearch = ''; render(); setTimeout(() => { const el = document.getElementById('gsearch'); if (el) el.focus(); }, 50); };

window.setGlobalSearch = v => {
  state.globalSearch = v;
  const el = document.getElementById('gsearch');
  const pos = el ? el.selectionStart : null;
  render();
  const nel = document.getElementById('gsearch');
  if (nel && pos !== null) { nel.focus(); nel.setSelectionRange(pos, pos); }
};

window.goToInstall = el => {
  const id = typeof el === 'string' ? el : el.dataset.id;
  state.showGlobalSearch = false; state.tab = 'instalaciones'; state.view = 'detalle'; state.editId = id;
  const r = state.records.find(x => x.id === id);
  if (r) state.instTab = (r.areaInstalacion||'CPT MT')==='CPT BT'?'cpt_bt':(r.areaInstalacion==='Campos y Servicios'?'campos':'cpt_mt');
  render();
};

window.goToEquipo = el => {
  const id = typeof el === 'string' ? el : el.dataset.id;
  state.showGlobalSearch = false; state.tab = 'inventario'; state.view = 'equipo_detalle'; state.editEqId = id; state.eqDetalleTab = 'general'; render();
};

window.newInstallFromDash = () => {
  state.tab = 'instalaciones'; state.instTab = userInstTab();
  if (state.equipos.filter(e => (eqSt(e)==='disponible'||eqSt(e)==='prestado') && (e.condicion||'bueno')!=='fuera' && (e.condicion||'bueno')!=='mantenimiento').length===0) return showToast('No hay equipos disponibles');
  state.form = emptyForm(); state.form.areaInstalacion = userArea(); state.editId = null; state.view = 'form'; render();
};

window.toggleMantenimiento = () => {
  const nuevo = !state.modoMantenimiento;
  set(mantenimientoRef, nuevo).then(() => {
    showToast(nuevo ? '🔧 Modo mantenimiento activado' : '✅ Mantenimiento desactivado');
  });
};

// ── CALENDAR HANDLERS ──
window.toggleCal = () => { state.calView = !state.calView; state.calDiaSeleccionado = null; render(); };

window.calNav = dir => {
  state.calMonth += dir;
  if (state.calMonth > 11) { state.calMonth = 0; state.calYearalYear++; }
  if (state.calMonth < 0) { state.calMonth = 11; state.calYearalYear--; }
  state.calDiaSeleccionado = null;
  render();
};

window.selCal = ds => {
  state.calDiaSeleccionado = state.calDiaSeleccionado === ds ? null : ds;
  render();
};

window.cerrarReporteModal = () => { state.showReporteModal = false; render(); };
window.setReporteMes = m => { state.reporteMes = m; render(); };
window.setReporteAnio = a => { state.reporteAnio = a; render(); };
window.setReporteArea = el => { state.reporteArea = typeof el === 'string' ? el : el.dataset.a; render(); };

window.generarReporteMensual = () => {
  const mes=state.reporteMes,anio=state.reporteAnio,area=state.reporteArea;
  const MN=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const pfx=anio+'-'+String(mes).padStart(2,'0');
  const enM=f=>f&&f.toString().startsWith(pfx);
  const enA=r=>area==='TODOS'||(r.areaInstalacion||'CPT MT')===area||(r.areaBeneficiaria||'')===area;
  const AR=area==='TODOS'?['CPT MT','CPT BT','Campos y Servicios']:[area];
  const RES=[['Reporte '+MN[mes-1]+' '+anio+(area!=='TODOS'?' ('+area+')':'')],[],['Área','Instalaciones','Retiros','Desc.OK','Desc.Fallo','Despachos','Validaciones']];
  AR.forEach(a=>{const i2=state.records.filter(r=>enM(r.fechaInstalacion)&&(r.areaInstalacion===a||r.areaBeneficiaria===a)).length;const rt=state.records.filter(r=>r.retirado&&enM(r.fechaRetiroReal)&&(r.areaInstalacion===a||r.areaBeneficiaria===a)).length;const ds=state.records.filter(r=>r.areaInstalacion===a||r.areaBeneficiaria===a).flatMap(r2=>(r2.descargas||[]).filter(d=>enM(d.fecha)));const dp=state.historialCargas.filter(h=>enM(h.fecha)&&(area==='TODOS'||h.areaOrigen===a)).length;const vl=state.validaciones.flatMap(v=>(v.usuarios||[]).filter(u=>u.estado==='validado'&&enM(u.fechaValidacion))).length;RES.push([a,i2,rt,ds.filter(d=>d.medicionOk===true).length,ds.filter(d=>d.medicionOk===false).length,dp,vl]);});
  RES.push([]);const aD=state.records.filter(r=>area==='TODOS'||enA(r)).flatMap(r=>(r.descargas||[]).filter(d=>enM(d.fecha)));
  RES.push(['TOTAL',state.records.filter(r=>enM(r.fechaInstalacion)&&(area==='TODOS'||enA(r))).length,state.records.filter(r=>r.retirado&&enM(r.fechaRetiroReal)&&(area==='TODOS'||enA(r))).length,aD.filter(d=>d.medicionOk===true).length,aD.filter(d=>d.medicionOk===false).length,state.historialCargas.filter(h=>enM(h.fecha)).length,state.validaciones.flatMap(v=>(v.usuarios||[]).filter(u=>u.estado==='validado'&&enM(u.fechaValidacion))).length]);
  const iR=[['SIGET','Serie','Lugar','Área','F.Inst','F.Ret']];state.records.filter(r=>enM(r.fechaInstalacion)&&(area==='TODOS'||enA(r))).forEach(r=>iR.push([r.caso||'',r.serie||'',r.lugar||'',r.areaInstalacion||'',r.fechaInstalacion||'',r.fechaRetiro||'']));
  const rtR=[['SIGET','Serie','Lugar','Área','F.Retiro','Por','Fallas']];state.records.filter(r=>r.retirado&&enM(r.fechaRetiroReal)&&(area==='TODOS'||enA(r))).forEach(r=>rtR.push([r.caso||'',r.serie||'',r.lugar||'',r.areaInstalacion||'',r.fechaRetiroReal||'',r.retiradoPor||'',(r.fallas||[]).join(', ')||'Sin fallas']));
  const dR=[['SIGET','Serie','Fecha','Técnico','OK','Fallos']];state.records.filter(r=>area==='TODOS'||enA(r)).forEach(r=>{(r.descargas||[]).filter(d=>enM(d.fecha)).forEach(d=>dR.push([r.caso||'',r.serie||'',d.fecha||'',d.tecnico||'',d.medicionOk===true?'Sí':d.medicionOk===false?'No':'—',(d.fallasMedicion||[]).join(', ')||'']));});
  const dpR=[['Fecha','Área','Total','Por']];state.historialCargas.filter(h=>enM(h.fecha)&&(area==='TODOS'||h.areaOrigen===area)).forEach(h=>dpR.push([h.fecha||'',h.areaOrigen||'',h.total||'',h.realizadoPor||'']));
  const vR=[['Campaña','SIGET','Nombre','Fecha','TAP','Mult']];state.validaciones.forEach(v=>{(v.usuarios||[]).filter(u=>u.estado==='validado'&&enM(u.fechaValidacion)).forEach(u=>vR.push([v.nombre||'',u.siget||'',u.nombre||'',u.fechaValidacion||'',u.resultado?'TAP '+u.resultado.tap:'',u.resultado?u.resultado.multiplicador:'']));});
  const wb=XLSX.utils.book_new();const aS=(n,d)=>{const ws=XLSX.utils.aoa_to_sheet(d);ws['!cols']=Array(10).fill({wch:20});XLSX.utils.book_append_sheet(wb,ws,n);};
  aS('Resumen',RES);aS('Instalaciones',iR);aS('Retiros',rtR);aS('Descargas',dR);aS('Despachos',dpR);aS('Validaciones',vR);
  XLSX.writeFile(wb,'Reporte_'+MN[mes-1]+'_'+anio+(area!=='TODOS'?'_'+area.replace(/ /g,'_'):'')+'.xlsx');
  state.showReporteModal=false;showToast('📊 Reporte generado');render();
};

window.goBack = () => { state.view = 'lista'; state.editId = null; state.editEqId = null; state.form = emptyForm(); state.equipoForm = emptyEF(); state.showSelector = false; render(); };

window.switchTab = t => {
  state.tab = t; state.view = 'lista'; state.editId = null; state.editEqId = null;
  if (t === 'instalaciones') state.filterStatus = 'TODOS';
  if (t === 'validaciones') { state.valView = 'lista'; state.valCampanaId = null; state.valUsuarioIdx = null; }
  state.showGlobalSearch = false; state.globalSearch = '';
  render();
};

window.cerrarAlerta = () => { state.showAlertaRetiros = false; render(); };
window.setMapaFiltro = f => { state.mapaFiltro = f; render(); };
window.verRetiros = () => { state.showAlertaRetiros = false; state.tab = 'instalaciones'; state.filterStatus = 'PROXIMO'; render(); };
window.selectLoginUser = n => { state.loginForm.nombre = n; state.loginForm.pin = ''; state.loginForm.error = ''; render(); };
window.setLoginPin = v => { state.loginForm.pin = v; state.loginForm.error = ''; };
window.doLogin = doLogin;
window.cerrarSesion = cerrarSesion;
