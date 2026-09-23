// Handlers (onclick) de instalaciones, retiro y descarga
import { addToGoogleCalendar, closeDescargaModal, closeRetiroModal, getGPS, handleDelInstall, handleDescarga, handleRetiro, handleSave, openDescargaModal, openRetiroModal, toggleFalla, toggleSinProblema } from '../actions/instalaciones.js';
import { isAdmin } from '../config.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { emptyForm, eqSt } from '../utils.js';
import { render } from '../views/render.js';

window.setFilter = f => { state.filterStatus = f; render(); };
window.setInstTab = t => { state.instTab = t; state.filterStatus = 'TODOS'; state.camposFiltro = 'TODOS'; render(); };
window.setCamposFiltro = f => { state.camposFiltro = f; render(); };

window.setSearch = v => {
  state.search = v;
  const inp = document.querySelector('.search-input[oninput*="setSearch"]');
  const pos = inp ? inp.selectionStart : null;
  render();
  if (pos !== null) {
    const newInp = document.querySelector('.search-input[oninput*="setSearch"]');
    if (newInp) { newInp.focus(); newInp.setSelectionRange(pos, pos); }
  }
};

window.setField = (k, v) => { state.form[k] = v; if (k === 'energiaTipoInst' || k === 'areaInstalacion' || k === 'locMode') render(); };
window.setLocMode = m => { state.locMode = m; render(); };
window.triggerGPS = getGPS;
window.setRetiroDesc = v => { state.retiroForm.descripcion = v; };
window.setRetiroDescarga = v => { state.retiroForm.descargaConfirmada = v; render(); };
window.toggleFalla = toggleFalla;
window.toggleSinProblema = toggleSinProblema;
window.doRetiro = handleRetiro;
window.closeRetiroModal = closeRetiroModal;
window.openRetiroModal = openRetiroModal;

window.newInstall = () => {
  if (state.equipos.filter(e => (eqSt(e) === 'disponible' || eqSt(e) === 'prestado') && (e.condicion||'bueno') !== 'fuera' && (e.condicion||'bueno') !== 'mantenimiento').length === 0) return showToast('⚠️ No hay equipos disponibles en inventario');
  state.form = emptyForm();
  state.form.areaInstalacion = state.instTab === 'cpt_mt' ? 'CPT MT' : state.instTab === 'cpt_bt' ? 'CPT BT' : 'Campos y Servicios';
  state.editId = null; state.view = 'form'; render();
};

window.saveInstall = handleSave;
window.openDetail = id => { state.editId = id; state.view = 'detalle'; render(); };

window.editInstall = id => {
  if (!isAdmin()) return showToast('⚠️ Solo el administrador puede editar instalaciones');
  const r = state.records.find(x => x.id === id); if (!r) return;
  state.form = { equipoId: r.equipoId, serie: r.serie, modelo: r.modelo||'', caso: r.caso, lugar: r.lugar||'', lat: r.lat||null, lng: r.lng||null, fechaInstalacion: r.fechaInstalacion, fechaRetiro: r.fechaRetiro, notas: r.notas||'' };
  state.editId = id; state.view = 'form'; render();
};

window.delInstall = handleDelInstall;
window.addToCalendar = id => { const r = state.records.find(x => x.id === id); if (r) addToGoogleCalendar(r); };
window.openSelector = () => { state.showSelector = true; state.selectorSearch = ''; render(); };
window.closeSelector = () => { state.showSelector = false; state.selectorSearch = ''; render(); };

window.setSelectorSearch = v => {
  const inp = document.getElementById('sel-search');
  const pos = inp ? inp.selectionStart : null;
  state.selectorSearch = v; render();
  const ni = document.getElementById('sel-search');
  if (ni && pos !== null) { ni.focus(); ni.setSelectionRange(pos, pos); }
};

window.pickEquipo = id => {
  const eq = state.equipos.find(x => x.id === id); if (!eq) return;
  // Check active install (duplicate)
  const activa = state.records.find(r => r.equipoId === id && !r.retirado);
  if (activa) {
    if (!confirm('⚠️ Este equipo ya tiene una instalación activa en caso #' + (activa.caso||'?') + '. ¿Deseas registrar otra de todas formas?')) return;
  }
  // Check pending download
  const pendiente = state.records.find(r => r.equipoId === id && r.retirado && r.descargaPendiente);
  if (pendiente) {
    if (!confirm('⚠️ Este equipo tiene una descarga pendiente del caso #' + (pendiente.caso||'') + '. ¿Deseas instalarlo de todas formas?')) return;
  }
  state.form.equipoId = id; state.form.serie = eq.serie; state.form.modelo = eq.modelo || '';
  state.showSelector = false; render();
};

window.setRetiroSede = s => { state.retiroForm.sede = s; render(); };
window.setRetiroEnergia = t => { state.retiroForm.energiaTipo = t; render(); };
window.setRetiroEnergiaVal = (k, v) => { if(k==='una') state.retiroForm.energiaUna=v; else if(k==='punta') state.retiroForm.energiaPunta=v; else if(k==='resto') state.retiroForm.energiaResto=v; else if(k==='valle') state.retiroForm.energiaValle=v; };
window.openDescargaModal = openDescargaModal;
window.closeDescargaModal = closeDescargaModal;
window.doDescarga = handleDescarga;
window.setDescargaTecnico = t => { state.descargaForm.tecnico = t; render(); };
window.setDescargaNotas = v => { state.descargaForm.notas = v; };
window.setDescargaMedicion = v => { state.descargaForm.medicionOk = v; if (!v) {} else { state.descargaForm.fallasMedicion = []; state.descargaForm.descripcionFalla = ''; } render(); };
window.toggleFallaMedicion = f => { const i = state.descargaForm.fallasMedicion.indexOf(f); if (i>=0) state.descargaForm.fallasMedicion.splice(i,1); else state.descargaForm.fallasMedicion.push(f); render(); };
window.setDescargaFallaDesc = v => { state.descargaForm.descripcionFalla = v; };
