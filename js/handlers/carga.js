// Handlers (onclick) de despachos y accesorios
import { confirmarCargaMasiva, generarMemoCargaMasiva, procesarExcel } from '../actions/carga.js';
import { isAdmin } from '../config.js';
import { db, get, ref, remove, update } from '../firebase.js';
import { state } from '../state.js';
import { abrirDoc, abrirMemo, showToast } from '../ui.js';
import { fmtDate, today } from '../utils.js';
import { render } from '../views/render.js';

window.reimprimirMemoAcc = el => {
  const id = typeof el === 'string' ? el : el.dataset.id;
  const m = state.historialAccesorios.find(x => x.id === id);
  if (!m) return;
  // Rebuild memo HTML from saved data
  const fecha = fmtDate(m.fecha);
  const itemRows = (m.items||[]).map(item => '<tr><td>'+item.label+'</td><td style="text-align:center"><span style="font-family:Courier New,monospace;font-weight:700;font-size:13px;color:#0057b8">'+item.qty+'</span></td><td style="color:#64748b">'+( item.detalle||'—')+'</td></tr>').join('');
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#0a1628;padding:16px;font-size:10px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;border-bottom:2px solid #0057b8;padding-bottom:8px}.logo-box{width:36px;height:36px;background:linear-gradient(135deg,#003d8f,#0077cc);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}.company-name{font-size:14px;font-weight:800;color:#0057b8}.section-title{font-size:9px;font-weight:700;color:#0057b8;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #e8f0fb}table{width:100%;border-collapse:collapse;margin-bottom:16px}thead{background:#0057b8}thead th{padding:6px 8px;text-align:left;font-size:9px;font-weight:700;color:#fff}tbody td{padding:8px;font-size:11px;border-bottom:1px solid #e2e8f0}.firma-grid{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:8px}.firma-line{border-top:1.5px solid #0a1628;margin-top:28px;padding-top:6px;text-align:center}.footer{margin-top:10px;padding-top:6px;border-top:1px solid #e2e8f0;text-align:center;font-size:8px;color:#94a3b8}@media print{body{padding:8px}@page{margin:8mm 6mm}}</style></head><body><div class="header"><div style="display:flex;align-items:center;gap:12px"><div class="logo-box"><svg width="30" height="30" viewBox="0 0 24 24" fill="none"><rect x="3" y="2" width="18" height="20" rx="2" stroke="white" stroke-width="1.8" fill="none"/><path d="M8 7h8M8 10h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M12 14l-2 4h4l-2 4" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div><div class="company-name">CPT INNOVA</div><div style="font-size:9px;color:#94a3b8">Calidad del Producto Técnico · Analizadores de Red</div></div></div><div style="text-align:right"><div style="font-size:8px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase">Memorándum de</div><div style="font-size:13px;font-weight:800;color:#0057b8">ENTREGA DE ACCESORIOS</div><div style="font-size:9px;color:#64748b;text-align:right;margin-top:4px">Para: ${m.para} · ${fecha}</div></div></div><div style="margin-bottom:16px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0"><div><div style="font-size:8px;color:#94a3b8;text-transform:uppercase">Entrega</div><div style="font-size:12px;font-weight:700;margin-top:2px">${m.de}</div></div><div><div style="font-size:8px;color:#94a3b8;text-transform:uppercase">Recibe</div><div style="font-size:12px;font-weight:700;margin-top:2px">${m.para}</div></div></div></div><div class="section-title">Accesorios entregados</div><table><thead><tr><th>Accesorio</th><th style="text-align:center;width:80px">Cantidad</th><th>Detalle</th></tr></thead><tbody>${itemRows}</tbody></table><div class="section-title">Firmas de conformidad</div><div class="firma-grid"><div class="firma-line"><div style="font-size:10px;color:#64748b">Entrega</div><div style="font-size:13px;font-weight:700;margin-top:2px">${m.de}</div></div><div class="firma-line"><div style="font-size:10px;color:#64748b">Recibe</div><div style="font-size:13px;font-weight:700;margin-top:2px">${m.para}</div></div></div><div class="footer">Documento generado por CPT INNOVA · Sistema de Gestión de Analizadores de Red · ${fecha}</div></body></html>`;
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  const opt = { margin:[8,6,8,6], filename:'memo_accesorios_'+m.fecha+'.pdf', image:{type:'jpeg',quality:0.98}, html2canvas:{scale:2}, jsPDF:{unit:'mm',format:'letter',orientation:'portrait'} };
  html2pdf().set(opt).from(container).save().then(() => { document.body.removeChild(container); });
};

window.eliminarMemoAcc = el => {
  const id = typeof el === 'string' ? el : el.dataset.id;
  if (!confirm('¿Eliminar este memo del historial?')) return;
  remove(ref(db, 'historialAccesorios/' + id)).then(() => showToast('🗑 Memo eliminado'));
};

window.handleFileUpload = e => { const f = e.target.files[0]; if (f) procesarExcel(f); };
window.confirmarCarga = confirmarCargaMasiva;
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
  const fecha = new Date().toLocaleDateString('es-SV', {day:'2-digit',month:'2-digit',year:'numeric'});
  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',Arial,sans-serif;color:#0a1628;padding:16px;font-size:10px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;border-bottom:2px solid #0057b8;padding-bottom:8px}
  .logo-box{width:36px;height:36px;background:linear-gradient(135deg,#003d8f,#0077cc);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .company-name{font-size:14px;font-weight:800;color:#0057b8}
  .company-sub{font-size:10px;color:#94a3b8;margin-top:2px}
  .memo-type{font-size:14px;font-weight:800;color:#0057b8;text-align:right}
  .memo-label{font-size:10px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;text-align:right}
  .section-title{font-size:9px;font-weight:700;color:#0057b8;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #e8f0fb}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  thead{background:#0057b8}
  thead th{padding:6px 8px;text-align:left;font-size:9px;font-weight:700;color:#fff;letter-spacing:.5px;text-transform:uppercase}
  tbody td{padding:8px 8px;font-size:11px;border-bottom:1px solid #e2e8f0}
  .qty{font-family:'Courier New',monospace;font-weight:700;font-size:13px;color:#0057b8}
  .firma-grid{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:8px}
  .firma-line{border-top:1.5px solid #0a1628;margin-top:28px;padding-top:6px;text-align:center}
  .firma-label{font-size:10px;color:#64748b}
  .firma-name{font-size:13px;font-weight:700;margin-top:2px}
  .footer{margin-top:10px;padding-top:6px;border-top:1px solid #e2e8f0;text-align:center;font-size:8px;color:#94a3b8}
  @media print{body{padding:8px}@page{margin:8mm 6mm}}
</style></head><body>
<div class="header">
  <div style="display:flex;align-items:center;gap:12px">
    <div class="logo-box">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="2" width="18" height="20" rx="2" stroke="white" stroke-width="1.8" fill="none"/>
        <path d="M8 7h8M8 10h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M12 14l-2 4h4l-2 4" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div>
      <div class="company-name">CPT INNOVA</div>
      <div class="company-sub">Calidad del Producto Técnico · Analizadores de Red</div>
    </div>
  </div>
  <div>
    <div class="memo-label">Memorándum de</div>
    <div class="memo-type">ENTREGA DE ACCESORIOS</div>
    <div style="font-size:11px;color:#64748b;text-align:right;margin-top:4px">Para: ${f.para} · ${fecha}</div>
  </div>
</div>

<div style="margin-bottom:16px">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
    <div><div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Entrega</div><div style="font-size:12px;font-weight:700;margin-top:2px">${f.de}</div></div>
    <div><div style="font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px">Recibe</div><div style="font-size:12px;font-weight:700;margin-top:2px">${f.para}</div></div>
  </div>
</div>

<div class="section-title">Accesorios entregados</div>
<table>
  <thead><tr><th>Accesorio</th><th style="text-align:center;width:80px">Cantidad</th><th>Detalle</th></tr></thead>
  <tbody>
    ${items.map(item => `<tr>
      <td>${item.label}</td>
      <td style="text-align:center"><span class="qty">${item.qty}</span></td>
      <td style="color:#64748b">${item.detalle||'—'}</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="section-title">Firmas de conformidad</div>
<div class="firma-grid">
  <div class="firma-line">
    <div class="firma-label">Entrega</div>
    <div class="firma-name">${f.de}</div>
  </div>
  <div class="firma-line">
    <div class="firma-label">Recibe</div>
    <div class="firma-name">${f.para}</div>
  </div>
</div>

<div class="footer">Documento generado por CPT INNOVA · Sistema de Gestión de Analizadores de Red · ${fecha}</div>
</body></html>`;
  abrirDoc(html, 'documento.html');
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
      if (eq) update(ref(db, 'equipos/' + r.equipoId), { sede: c.areaOrigen === 'CPT BT' ? 'Subestación Cucumacayán' : 'Plantel Central' });
    }
  });
  showToast('✅ ' + instDespacho.length + ' equipos marcados como retirados · Descarga pendiente');
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
