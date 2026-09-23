// Lógica de instalaciones: guardar, retiro, descarga, calendario
import { FALLAS_GRAVES, isAdmin, sedeRetorno } from '../config.js';
import { db, installsRef, push, ref, remove, update } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { emptyForm, today } from '../utils.js';
import { render } from '../views/render.js';

// ── GPS ──
export function getGPS() {
  if (!navigator.geolocation) return showToast('GPS no disponible');
  const btn = document.getElementById('gps-btn');
  if (btn) { btn.textContent = 'Obteniendo ubicación...'; btn.disabled = true; }
  navigator.geolocation.getCurrentPosition(pos => {
    state.form.lat = pos.coords.latitude.toFixed(6);
    state.form.lng = pos.coords.longitude.toFixed(6);
    if (!state.form.lugar) state.form.lugar = `${(+state.form.lat).toFixed(4)}, ${(+state.form.lng).toFixed(4)}`;
    render();
    showToast('📍 Ubicación capturada');
  }, () => { showToast('No se pudo obtener ubicación GPS'); render(); }, { enableHighAccuracy: true, timeout: 12000 });
}

// ── SAVE DEPLOY ──
export function handleSave() {
  if (!state.form.equipoId) return showToast('Selecciona un equipo del inventario');
  if (!state.form.caso.trim()) return showToast('Ingresa el código de caso / campaña');
  if (!state.form.fechaRetiro) return showToast('Ingresa la fecha de retiro');
  if (!state.form.lugar.trim()) return showToast('Ingresa la ubicación del equipo');
  // Validación de duplicados
  if (!state.editId) {
    const activa = state.records.find(r => r.equipoId === state.form.equipoId && !r.retirado);
    if (activa) return showToast('⚠️ Este equipo ya tiene instalación activa en #' + (activa.caso||'?'));
  }
  // #13 Duplicate series check
  const eq = state.equipos.find(e => e.id === state.form.equipoId);
  if (eq) {
    const yaActivo = state.records.find(r => r.serie === eq.serie && !r.retirado && r.id !== state.editId);
    if (yaActivo) return showToast('⚠️ La serie ' + eq.serie + ' ya está instalada en caso #' + (yaActivo.caso||'?'));
  }
  const usuario = state.sesionUsuario?.nombre || 'Desconocido';
  const energiaInst = state.form.energiaTipoInst === 'una'
    ? { tipo: 'una', una: state.form.energiaInstUna }
    : state.form.energiaTipoInst === 'tres'
    ? { tipo: 'tres', punta: state.form.energiaInstPunta, resto: state.form.energiaInstResto, valle: state.form.energiaInstValle }
    : { tipo: 'ninguna' };
  const payload = { ...state.form, energiaInstalacion: energiaInst, retirado: false, fechaRegistro: today(), creadoPor: usuario };
  if (state.editId) {
    const id = state.editId;
    state.editId = null; state.view = 'lista'; state.form = emptyForm();
    update(ref(db, `analizadores/${id}`), { ...payload, editadoPor: usuario, fechaEdicion: today() }).then(() => showToast('✅ Actualizado'));
  } else {
    const savedPayload = {...payload};
    state.view = 'lista'; state.form = emptyForm();
    push(installsRef, savedPayload).then(newRef => {
      showToast('✅ Instalación registrado');
      setTimeout(() => {
        if (confirm('¿Quieres agregar el recordatorio de retiro a Google Calendar?')) {
          addToGoogleCalendar(savedPayload);
        }
      }, 500);
    });
  }
}

// ── RETIRO ──
export function openRetiroModal(id) { state.retiroId = id; state.retiroForm = { sinProblema: null, fallas: [], descripcion: '', sede: sedeRetorno(state.records.find(x => x.id === id)), energiaTipo: 'ninguna', energiaUna: '', energiaPunta: '', energiaResto: '', energiaValle: '', descargaConfirmada: null }; state.showRetiroModal = true; render(); }

export function closeRetiroModal() { state.showRetiroModal = false; state.retiroId = null; render(); }

export function toggleFalla(f) {
  state.retiroForm.sinProblema = false;
  const i = state.retiroForm.fallas.indexOf(f);
  if (i >= 0) state.retiroForm.fallas.splice(i, 1); else state.retiroForm.fallas.push(f);
  render();
}

export function toggleSinProblema() {
  state.retiroForm.sinProblema = !state.retiroForm.sinProblema;
  if (state.retiroForm.sinProblema) state.retiroForm.fallas = [];
  render();
}

export function handleRetiro() {
  if (state.retiroForm.descargaConfirmada === null) return showToast('⚠️ Indica si ya descargaste la medición');
  if (state.retiroForm.sinProblema === null && state.retiroForm.fallas.length === 0) return showToast('Indica si hubo algún problema');
  const energiaRet = state.retiroForm.energiaTipo === 'una'
    ? { tipo: 'una', una: state.retiroForm.energiaUna }
    : state.retiroForm.energiaTipo === 'tres'
    ? { tipo: 'tres', punta: state.retiroForm.energiaPunta, resto: state.retiroForm.energiaResto, valle: state.retiroForm.energiaValle }
    : { tipo: 'ninguna' };
  const payload = { retirado: true, fechaRetiroReal: today(), sinProblema: state.retiroForm.sinProblema || false, fallas: state.retiroForm.fallas, descripcionFalla: state.retiroForm.descripcion, retiradoPor: state.sesionUsuario?.nombre || 'Desconocido', energiaRetiro: energiaRet, descargaConfirmada: state.retiroForm.descargaConfirmada === true, descargaPendiente: state.retiroForm.descargaConfirmada === false };
  const id = state.retiroId;
  const sedeRetiro = state.retiroForm.sede;
  const deployRec = state.records.find(x => x.id === id);
  state.showRetiroModal = false; state.retiroId = null; state.view = 'lista';
  update(ref(db, `analizadores/${id}`), payload).then(() => {
    if (deployRec && deployRec.equipoId) {
      const eq = state.equipos.find(x => x.id === deployRec.equipoId);
      const fallas = state.retiroForm.fallas;
      let nuevaCondicion = null;
      if (state.retiroForm.sinProblema) {
        nuevaCondicion = 'bueno';
      } else if (fallas.some(f => FALLAS_GRAVES.includes(f))) {
        nuevaCondicion = 'fuera';
      } else if (fallas.length > 0) {
        nuevaCondicion = 'detalles';
      }
      const eqUpdates = { sede: sedeRetiro };
      if (nuevaCondicion && eq) {
        const condAnterior = eq.condicion || 'bueno';
        if (condAnterior !== nuevaCondicion) {
          const cambio = { fecha: today(), condicionAnterior: condAnterior, condicionNueva: nuevaCondicion, nota: 'Actualizado automáticamente al retirar' + (state.retiroForm.descripcion ? ': ' + state.retiroForm.descripcion : '') };
          eqUpdates.condicion = nuevaCondicion;
          eqUpdates.historialCondicion = [...(eq.historialCondicion || []), cambio];
        }
      }
      update(ref(db, `equipos/${deployRec.equipoId}`), eqUpdates);
    }
    showToast('✅ Equipo marcado como retirado');
  });
}

// ── DESCARGA PARCIAL ──
export function openDescargaModal(id) { state.descargaId = id; state.descargaForm = { tecnico: 'David García', notas: '', medicionOk: null, fallasMedicion: [], descripcionFalla: '' }; state.showDescargaModal = true; render(); }

export function closeDescargaModal() { state.showDescargaModal = false; state.descargaId = null; render(); }

export function handleDescarga() {
  if (!state.descargaForm.tecnico) return showToast('Selecciona un técnico');
  if (state.descargaForm.medicionOk === null) return showToast('Indica si la medición fue correcta');
  if (state.descargaForm.medicionOk === false && state.descargaForm.fallasMedicion.length === 0) return showToast('Selecciona al menos un tipo de fallo');
  const rec = state.records.find(x => x.id === state.descargaId);
  if (!rec) return;
  const nueva = {
    fecha: today(), tecnico: state.descargaForm.tecnico, notas: state.descargaForm.notas,
    registradoPor: state.sesionUsuario?.nombre || 'Desconocido',
    medicionOk: state.descargaForm.medicionOk,
    fallasMedicion: state.descargaForm.fallasMedicion,
    descripcionFalla: state.descargaForm.descripcionFalla
  };
  const descargas = [...(rec.descargas || []), nueva];
  const id = state.descargaId;
  state.showDescargaModal = false; state.descargaId = null;
  // Mark descargaPendiente as resolved
  update(ref(db, 'analizadores/' + id), { descargas, descargaPendiente: false }).then(() => {
    showToast(state.descargaForm.medicionOk ? '💾 Descarga registrada correctamente' : '💾 Descarga registrada · Fallo anotado');
  });
}

// ── DELETE DEPLOY ──
export function handleDelInstall(id) {
  if (!isAdmin()) return showToast('⚠️ Solo el administrador puede eliminar registros');
  if (!confirm('¿Eliminar este instalación?')) return;
  state.view = 'lista';
  remove(ref(db, `analizadores/${id}`)).then(() => showToast('Eliminado'));
}

// ── GOOGLE CALENDAR ──
export function addToGoogleCalendar(r) {
  const title = encodeURIComponent(`Retiro analizador ${r.serie} - #${r.caso}`);
  const details = encodeURIComponent(`Equipo: ${r.serie}\nModelo: ${r.modelo||''}\nCaso: #${r.caso}\nLugar: ${r.lugar||''}\nCPT INNOVA`);
  const location = encodeURIComponent(r.lugar || '');
  // Format date as YYYYMMDD
  const date = r.fechaRetiro.replace(/-/g, '');
  // All day event
  const nextDay = (() => {
    const [y,m,d] = r.fechaRetiro.split('-').map(Number);
    const dt = new Date(y, m-1, d+1);
    return `${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}`;
  })();
  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date}/${nextDay}&details=${details}&location=${location}`;
  window.open(url, '_blank');
}
