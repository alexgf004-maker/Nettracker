// Handlers (onclick) de despachos y accesorios
import { aplicarRetiroCarga, confirmarCargaMasiva, generarMemoCargaMasiva, procesarExcel } from '../actions/carga.js';
import { SEDE_CUCUMACAYAN, isAdmin } from '../config.js';
import { db, get, ref, remove, update } from '../firebase.js';
import { state } from '../state.js';
import { abrirDoc, abrirMemo, showToast } from '../ui.js';
import { buildMemoAccesorios } from '../pdf/memos.js';
import { today } from '../utils.js';
import { render } from '../views/render.js';

window.reimprimirMemoAcc = el => {
  const id = typeof el === 'string' ? el : el.dataset.id;
  const m = state.historialAccesorios.find(x => x.id === id);
  if (!m) return;
  abrirDoc(buildMemoAccesorios(m, m.items || [], m.fecha), 'memo_accesorios_' + m.fecha + '.html');
};

window.eliminarMemoAcc = el => {
  const id = typeof el === 'string' ? el : el.dataset.id;
  if (!confirm('¿Eliminar este memo del historial?')) return;
  remove(ref(db, 'historialAccesorios/' + id)).then(() => showToast('Memo eliminado'));
};

window.handleFileUpload = e => { const f = e.target.files[0]; if (f) procesarExcel(f); };
window.confirmarCarga = confirmarCargaMasiva;
window.aplicarRetiroCarga = aplicarRetiroCarga;
window.cancelarCarga = () => { state.cargaData = []; state.cargaView = 'upload'; render(); };

window.verMemo = id => {
  get(ref(db, 'historialCargas/' + id + '/memo')).then(snap => {
    if (snap.exists()) abrirMemo(snap.val());
    else showToast('Memo no disponible');
  }).catch(() => showToast('Error al cargar memo'));
};

window.emailDespacho = id => {
  const c = state.historialCargas.find(x => x.id === id);
  if (!c) return;
  showToast('Preparando correo...');
  get(ref(db, 'historialCargas/' + id + '/memo')).then(snap => {
    const asunto = encodeURIComponent('Memorandum de Asignacion de Equipos - ' + (c.areaOrigen||'CPT') + ' - ' + (c.fecha||''));
    const fechaFmt = c.fecha ? c.fecha.split('-').reverse().join('/') : '';
    let tabla = '';
    if (snap.exists()) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(snap.val(), 'text/html');
      const rows = doc.querySelectorAll('tbody tr');
      const pad = (s, w) => (s||'').substring(0, w).padEnd(w);
      tabla = pad('N SIGET', 16) + pad('Serie', 14) + pad('Vineta', 10) + 'Usuario\n';
      tabla += '-'.repeat(60) + '\n';
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 4) tabla += pad(cells[0].textContent.trim(), 16) + pad(cells[1].textContent.trim(), 14) + pad(cells[2].textContent.trim(), 10) + cells[4].textContent.trim() + '\n';
      });
    }
    const lineas = ['Para: Campos y Servicios', 'Asunto: Asignacion de ' + c.total + ' analizadores de redes ECAMEC', 'Fecha: ' + fechaFmt, '', 'Mediante la presente se notifica asignacion de ' + c.total + ' analizadores de redes ECAMEC, los cuales seran usados para las siguientes mediciones.', '', tabla, 'Area: ' + (c.areaOrigen||'') + ' -> Campos y Servicios', c.realizadoPor ? 'Registrado por: ' + c.realizadoPor : '', '', 'Documento generado por CPT INNOVA - Sistema de Gestion de Analizadores de Red'].join('\n');
    window.location.href = 'mailto:?subject=' + asunto + '&body=' + encodeURIComponent(lineas);
  }).catch(() => showToast('Error al cargar memo'));
};

window.eliminarDespacho = id => {
  if (!isAdmin()) return showToast('Solo el administrador puede eliminar');
  if (!confirm('Eliminar este despacho del historial?')) return;
  remove(ref(db, 'historialCargas/' + id)).then(() => showToast('Despacho eliminado'));
};

window.setCargaSubView = v => { state.cargaSubView = v; if (v !== 'despacho') state.despachoDetalle = null; if (v === 'accesorios') state.accesoriosForm = { de: 'CPT MT', para: 'Campos y Servicios', candados: '', cadenas: '', sellos: '', serieDesde: '', serieHasta: '' }; render(); };

window.generarMemoAccesorios = () => {
  const g = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const f = {
    de: g('acc-de') || 'CPT MT',
    para: g('acc-para') || 'Campos y Servicios',
    candados: g('acc-candados'),
    candadosNotas: g('acc-candados-notas'),
    cadenas: g('acc-cadenas'),
    cadenasNotas: g('acc-cadenas-notas'),
    sellos: g('acc-sellos'),
    sellosNotas: g('acc-sellos-notas'),
    serieDesde: g('acc-serie-desde'),
    serieHasta: g('acc-serie-hasta'),
  };
  const items = [];
  if (parseInt(f.candados) > 0) items.push({ label: 'Candados con llave', qty: parseInt(f.candados), detalle: f.candadosNotas || '' });
  if (parseInt(f.cadenas) > 0) items.push({ label: 'Cadenas', qty: parseInt(f.cadenas), detalle: f.cadenasNotas || '' });
  if (parseInt(f.sellos) > 0) {
    let det = '';
    if (f.serieDesde && f.serieHasta) det += 'Serie: ' + f.serieDesde + ' al ' + f.serieHasta;
    if (f.sellosNotas) det += (det ? ' · ' : '') + f.sellosNotas;
    items.push({ label: 'Sellos de seguridad', qty: parseInt(f.sellos), detalle: det });
  }
  if (items.length === 0) return showToast('Ingresa al menos un accesorio');
  abrirDoc(buildMemoAccesorios(f, items), 'documento.html');
};

window.getInstDespacho = (c) => {
  if (c.instalacionIds && c.instalacionIds.length > 0) {
    return state.records.filter(r => c.instalacionIds.includes(r.id));
  }
  // Fallback: parse series from memo HTML
  if (c._series) {
    return state.records.filter(r => c._series.includes(r.serie) && r.areaInstalacion === 'Campos y Servicios');
  }
  // Last resort: filter by date only (may include multiple despachos)
  return state.records.filter(r => r.fechaRegistro === c.fecha && r.areaInstalacion === 'Campos y Servicios');
};

window.gestionarRetiro = id => {
  const c = state.historialCargas.find(x => x.id === id);
  if (!c) return;
  // If no instalacionIds, load memo to extract series
  if (!c.instalacionIds) {
    get(ref(db, 'historialCargas/' + id + '/memo')).then(snap => {
      if (snap.exists()) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(snap.val(), 'text/html');
        const rows = doc.querySelectorAll('tbody tr');
        const series = [];
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) series.push(cells[1].textContent.trim());
        });
        c._series = series;
      }
      state.despachoDetalle = id; state.cargaSubView = 'despacho'; render();
    }).catch(() => { state.despachoDetalle = id; state.cargaSubView = 'despacho'; render(); });
  } else {
    state.despachoDetalle = id; state.cargaSubView = 'despacho'; render();
  }
};

window.retiroMasivo = id => {
  const c = state.historialCargas.find(x => x.id === id);
  if (!c) return;
  const instDespacho = getInstDespacho(c).filter(r => !r.retirado);
  if (instDespacho.length === 0) return showToast('No hay instalaciones pendientes');
  if (!confirm('¿Marcar ' + instDespacho.length + ' equipos como retirados? Se marcarán con descarga pendiente.')) return;
  const usuario = state.sesionUsuario?.nombre || 'Desconocido';
  instDespacho.forEach(r => {
    update(ref(db, 'analizadores/' + r.id), {
      retirado: true, fechaRetiroReal: today(),
      sinProblema: true, fallas: [],
      retiradoPor: usuario,
      descargaConfirmada: false,
      descargaPendiente: true
    });
    // Return equipo to sede
    if (r.equipoId) {
      const eq = state.equipos.find(x => x.id === r.equipoId);
      if (eq) update(ref(db, 'equipos/' + r.equipoId), { sede: SEDE_CUCUMACAYAN }); // Campos y Servicios los regresa a la Cucumacayán
    }
  });
  showToast('' + instDespacho.length + ' equipos marcados como retirados · Descarga pendiente');
};

window.regenerarMemo = id => {
  const c = state.historialCargas.find(x => x.id === id);
  if (!c) return showToast('No se encontró el registro');
  // Rebuild filas format expected by generarMemoCargaMasiva
  const filas = (c.equipos||[]).map(e => ({
    serie: e.s||e.serie||'', modelo: e.modelo||'', vineta: e.v||e.vineta||'',
    caso: e.c||e.caso||'', lugar: e.l||e.lugar||'',
    fechaInst: e.fi||e.fechaInst||'', fechaRetiro: e.fr||e.fechaRetiro||'', notas: e.n||e.notas||'',
    idUsuario: e.iu||e.idUsuario||'', direccion: e.d||e.direccion||'',
    accesorios: e.ac||e.accesorios||'', multiplicador: e.m||e.multiplicador||'',
    corrientes: e.co||e.corrientes||'', conexion: e.cx||e.conexion||''
  }));
  // Temporarily set cargaAreaOrigen to saved value
  const prevArea = state.cargaAreaOrigen;
  state.cargaAreaOrigen = c.areaOrigen || 'CPT BT';
  generarMemoCargaMasiva(filas);
  state.cargaAreaOrigen = prevArea;
};

window.setCargaOrigen = a => { state.cargaAreaOrigen = a; render(); };
