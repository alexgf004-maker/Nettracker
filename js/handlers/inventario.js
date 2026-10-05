// Handlers (onclick) de inventario, préstamos, mantenimiento y memos
import { confirmCondicion, confirmMovimiento, confirmarImportInventario, eliminarMovimientoFn, handleDelEq, handleDevolucion, handlePrestamo, handleSaveEq, openCondicionModal, procesarExcelInventario } from '../actions/inventario.js';
import { CONDICIONES, isAdmin } from '../config.js';
import { db, ref, update } from '../firebase.js';
import { generateLotePDF, generateMemoPDF } from '../pdf/memos.js';
import { state } from '../state.js';
import { abrirDoc, showToast } from '../ui.js';
import { calcSt, emptyEF, eqPrestado, fmtDate, today } from '../utils.js';
import { render } from '../views/render.js';
import { closeRevisionModal, confirmRevision, editarRevision, openRevisionModal, reimprimirMemoRevision } from '../actions/revision.js';

window.exportHojaVida = eqId => {
  const eq = state.equipos.find(x => x.id === eqId);
  if (!eq) return;
  const historial = state.records.filter(r => r.equipoId === eqId).sort((a,b) => (b.fechaRegistro||'').localeCompare(a.fechaRegistro||''));
  const conFallasFis = historial.filter(r => r.retirado && r.fallas && r.fallas.length > 0);
  const conFallasMed = historial.filter(r => r.descargas && r.descargas.some(d => d.medicionOk === false));
  const movimientos = eq.movimientos || [];
  const mantHistorial = eq.historialMantenimiento || [];
  const condHistorial = eq.historialCondicion || [];

  // Count fallas
  const conteoFis = {};
  conFallasFis.forEach(r => r.fallas.forEach(f => { conteoFis[f] = (conteoFis[f]||0) + 1; }));
  const conteoMed = {};
  conFallasMed.forEach(r => r.descargas.filter(d=>d.medicionOk===false).forEach(d => (d.fallasMedicion||[]).forEach(f => { conteoMed[f] = (conteoMed[f]||0) + 1; })));

  const condLabel = (key) => { const c = CONDICIONES.find(x=>x.key===key); return c ? c.label : 'Bueno'; };

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Inter', Arial, sans-serif; color: #0a1628; font-size: 10px; padding: 20px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom: 2px solid #0057b8; padding-bottom: 10px; margin-bottom: 16px; }
  .logo-box { width:36px; height:36px; background:linear-gradient(135deg,#003d8f,#0077cc); border-radius:8px; display:flex; align-items:center; justify-content:center; }
  h1 { font-size: 16px; font-weight: 800; color: #0057b8; }
  h2 { font-size: 11px; font-weight: 700; color: #0057b8; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #e8f0fb; padding-bottom: 4px; margin: 14px 0 8px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-bottom: 12px; }
  .field { display: flex; flex-direction: column; }
  .field-label { font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  .field-value { font-size: 11px; font-weight: 600; color: #0a1628; margin-top: 1px; }
  .badge { display:inline-block; padding: 2px 8px; border-radius: 20px; font-size: 9px; font-weight: 700; }
  .badge-green { background: #ecfdf5; color: #059669; }
  .badge-red { background: #fef2f2; color: #dc2626; }
  .badge-yellow { background: #fffbeb; color: #d97706; }
  .badge-blue { background: #e8f0fb; color: #0057b8; }
  .stat-row { display: flex; gap: 12px; margin-bottom: 12px; }
  .stat-box { flex:1; text-align:center; padding: 10px 8px; border-radius: 8px; }
  .stat-num { font-size: 20px; font-weight: 800; font-family: 'Courier New', monospace; }
  .stat-lbl { font-size: 8px; font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9px; }
  thead { background: #0057b8; }
  thead th { padding: 5px 6px; color: #fff; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  tbody td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .tag { display:inline-block; background:#e8f0fb; color:#0057b8; border-radius:4px; padding:1px 5px; font-size:8px; margin:1px; }
  .tag-red { background:#fef2f2; color:#dc2626; }
  .tag-yellow { background:#fffbeb; color:#d97706; }
  .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 8px; color: #94a3b8; }
  @media print { body { padding: 10px; } @page { margin: 8mm 6mm; } }
</style>
</head>
<body>
<div class="header">
  <div style="display:flex;align-items:center;gap:12px">
    <div class="logo-box">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="2" width="18" height="20" rx="2" stroke="white" stroke-width="1.8" fill="none"/>
        <path d="M8 7h8M8 10h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M12 14l-2 4h4l-2 4" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div>
      <div style="font-size:13px;font-weight:800;color:#0057b8">CPT INNOVA</div>
      <div style="font-size:9px;color:#94a3b8">Calidad del Producto Técnico · Analizadores de Red</div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:8px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase">Hoja de vida</div>
    <div style="font-size:13px;font-weight:800;color:#0057b8">EQUIPO ANALIZADOR</div>
    <div style="font-size:9px;color:#64748b;margin-top:3px">Generado: ${new Date().toLocaleDateString('es-SV')}</div>
  </div>
</div>

<h2>Datos generales</h2>
<div class="grid">
  <div class="field"><div class="field-label">Serie</div><div class="field-value" style="font-family:'Courier New',monospace;font-size:13px">${eq.serie}</div></div>
  <div class="field"><div class="field-label">Modelo / Marca</div><div class="field-value">${eq.modelo||'—'}</div></div>
  <div class="field"><div class="field-label">Viñeta</div><div class="field-value">${eq.vineta||'—'}</div></div>
  <div class="field"><div class="field-label">Sede</div><div class="field-value">${eq.sede||'Plantel Central'}</div></div>
  <div class="field"><div class="field-label">Condición actual</div><div class="field-value">${condLabel(eq.condicion||'bueno')}</div></div>
  <div class="field"><div class="field-label">Registrado</div><div class="field-value">${fmtDate(eq.fechaRegistro)}${eq.creadoPor?' · '+eq.creadoPor:''}</div></div>
  ${eq.notas ? `<div class="field" style="grid-column:1/-1"><div class="field-label">Notas</div><div class="field-value">${eq.notas}</div></div>` : ''}
</div>

<h2>Resumen de actividad</h2>
<div class="stat-row">
  <div class="stat-box" style="background:#e8f0fb">
    <div class="stat-num" style="color:#0057b8">${historial.length}</div>
    <div class="stat-lbl" style="color:#0057b8">INSTALACIONES</div>
  </div>
  <div class="stat-box" style="background:#fef2f2">
    <div class="stat-num" style="color:#dc2626">${conFallasFis.length}</div>
    <div class="stat-lbl" style="color:#dc2626">FALLAS FÍSICAS</div>
  </div>
  <div class="stat-box" style="background:#fffbeb">
    <div class="stat-num" style="color:#d97706">${conFallasMed.length}</div>
    <div class="stat-lbl" style="color:#d97706">FALLOS MEDICIÓN</div>
  </div>
  <div class="stat-box" style="background:#f0fdf4">
    <div class="stat-num" style="color:#059669">${movimientos.length}</div>
    <div class="stat-lbl" style="color:#059669">PRÉSTAMOS</div>
  </div>
</div>

${Object.keys(conteoFis).length > 0 ? `
<h2>Fallas físicas registradas</h2>
<table>
  <thead><tr><th>Tipo de falla</th><th style="text-align:center;width:60px">Frecuencia</th></tr></thead>
  <tbody>${Object.entries(conteoFis).sort((a,b)=>b[1]-a[1]).map(([f,n]) => `
    <tr><td>${f}</td><td style="text-align:center;font-weight:700;color:#dc2626">${n}x</td></tr>`).join('')}
  </tbody>
</table>` : ''}

${Object.keys(conteoMed).length > 0 ? `
<h2>Fallos de medición registrados</h2>
<table>
  <thead><tr><th>Tipo de fallo</th><th style="text-align:center;width:60px">Frecuencia</th></tr></thead>
  <tbody>${Object.entries(conteoMed).sort((a,b)=>b[1]-a[1]).map(([f,n]) => `
    <tr><td>${f}</td><td style="text-align:center;font-weight:700;color:#d97706">${n}x</td></tr>`).join('')}
  </tbody>
</table>` : ''}

${historial.length > 0 ? `
<h2>Historial de instalaciones (${historial.length})</h2>
<table>
  <thead><tr><th>Serie/Caso</th><th>Lugar</th><th>Área</th><th>F. Instalación</th><th>F. Retiro</th><th>Estado</th></tr></thead>
  <tbody>${historial.map(r => {
    const st = calcSt(r);
    const stLabel = r.retirado ? 'Retirado' : st === 'ACTIVO' ? 'Activo' : st === 'PROXIMO' ? 'Próximo' : st === 'VENCIDO' ? 'Vencido' : st;
    const stColor = r.retirado ? '#059669' : st === 'VENCIDO' ? '#dc2626' : st === 'PROXIMO' ? '#d97706' : '#059669';
    const fallasFis = r.fallas && r.fallas.length > 0 ? r.fallas.join(', ') : '';
    const fallasMed = r.descargas ? r.descargas.filter(d=>d.medicionOk===false).flatMap(d=>d.fallasMedicion||[]).join(', ') : '';
    return `<tr>
      <td><span style="font-family:'Courier New',monospace;font-weight:700">${r.serie}</span><br><span style="color:#94a3b8">#${r.caso||'—'}</span></td>
      <td>${r.lugar||'—'}</td>
      <td>${r.areaInstalacion||'CPT MT'}</td>
      <td style="white-space:nowrap">${fmtDate(r.fechaInstalacion)}</td>
      <td style="white-space:nowrap">${fmtDate(r.fechaRetiroReal||r.fechaRetiro)}</td>
      <td><span style="color:${stColor};font-weight:700">${stLabel}</span>${fallasFis?'<br><span class="tag tag-red">'+fallasFis+'</span>':''}${fallasMed?'<br><span class="tag tag-yellow">'+fallasMed+'</span>':''}</td>
    </tr>`;
  }).join('')}
  </tbody>
</table>` : ''}

${movimientos.length > 0 ? `
<h2>Historial de préstamos (${movimientos.length})</h2>
<table>
  <thead><tr><th>Tipo</th><th>De</th><th>A</th><th>Fecha</th><th>Notas</th></tr></thead>
  <tbody>${movimientos.map(m => `
    <tr>
      <td><span style="font-weight:700;color:${m.tipo==='prestamo'?'#0057b8':'#059669'}">${m.tipo==='prestamo'?'🔄 Préstamo':'✅ Devolución'}</span></td>
      <td>${m.de||'—'}</td>
      <td>${m.a||'—'}</td>
      <td style="white-space:nowrap">${fmtDate(m.fecha)}</td>
      <td>${m.nota||'—'}</td>
    </tr>`).join('')}
  </tbody>
</table>` : ''}

${mantHistorial.length > 0 ? `
<h2>Fichas de mantenimiento (${mantHistorial.length})</h2>
<table>
  <thead><tr><th>Descripción</th><th>Acción</th><th>Resultado</th><th>F. Inicio</th><th>F. Resolución</th></tr></thead>
  <tbody>${mantHistorial.map(m => {
    const resLabel = m.resultado==='resuelto'?'✅ Resuelto':m.resultado==='sin_solucion'?'❌ Sin solución':'⏳ Pendiente';
    return `<tr>
      <td>${m.descripcion||'—'}</td>
      <td>${m.accion||'—'}</td>
      <td style="white-space:nowrap;font-weight:700">${resLabel}</td>
      <td style="white-space:nowrap">${fmtDate(m.fechaInicio)}</td>
      <td style="white-space:nowrap">${fmtDate(m.fechaResolucion)||'—'}</td>
    </tr>`;
  }).join('')}
  </tbody>
</table>` : ''}

<div class="footer">
  Documento generado por CPT INNOVA · Sistema de Gestión de Analizadores de Red · ${new Date().toLocaleDateString('es-SV')}
</div>
</body>
</html>`;

  // Open in new window and print
  abrirDoc(html, 'documento.html');
};

window.handleImportEquipos = e => { const f = e.target.files[0]; if (f) procesarExcelInventario(f); };
window.confirmarImport = confirmarImportInventario;
window.closeImportModal = () => { state.showImportModal = false; state.importData = []; render(); };
window.setEF = (k, v) => { state.equipoForm[k] = v; if (k === 'condicion' || k === 'sede') render(); };
window.setInvFiltro = f => { state.inventarioFiltro = f; render(); };
window.toggleVistaInv = () => { state.vistaInventario = state.vistaInventario === 'lista' ? 'grid' : 'lista'; render(); };

window.setInvSearch = v => {
  state.inventarioSearch = v;
  const inp = document.querySelector('.search-input[oninput*="setInvSearch"]');
  const pos = inp ? inp.selectionStart : null;
  render();
  if (pos !== null) {
    const newInp = document.querySelector('.search-input[oninput*="setInvSearch"]');
    if (newInp) { newInp.focus(); newInp.setSelectionRange(pos, pos); }
  }
};

window.setEqDetalleTab = t => { state.eqDetalleTab = t; render(); };
window.newEquipo = () => { state.equipoForm = emptyEF(); state.editEqId = null; state.view = 'equipo_form'; render(); };
window.saveEquipo = handleSaveEq;
window.openEqDetalle = id => { state.editEqId = id; state.view = 'equipo_detalle'; state.eqDetalleTab = 'general'; render(); };

window.editEquipo = id => {
  if (!isAdmin()) return showToast('⚠️ Solo el administrador puede editar equipos');
  const eq = state.equipos.find(x => x.id === id); if (!eq) return;
  state.equipoForm = { serie: eq.serie, modelo: eq.modelo||'', notas: eq.notas||'', sede: eq.sede||'Plantel Central', condicion: eq.condicion||'bueno', vineta: eq.vineta||'' };
  state.editEqId = id; state.view = 'equipo_form'; render();
};

window.delEquipo = handleDelEq;
window.registrarPrestamo = handlePrestamo;
window.eliminarMovimiento = eliminarMovimientoFn;

window.openMantModal = id => {
  state.mantEqId = id;
  state.mantForm = { descripcion: '', accion: '', resultado: 'pendiente', fechaInicio: today(), fechaResolucion: '', observaciones: '' };
  state.showMantModal = true; render();
};

window.closeMantModal = () => { state.showMantModal = false; state.mantEqId = null; render(); };
window.setMantForm = (k, v) => { state.mantForm[k] = v; if (k === 'resultado') render(); };

window.guardarMant = () => {
  const eq = state.equipos.find(x => x.id === state.mantEqId);
  if (!eq) return;
  if (!state.mantForm.descripcion.trim()) return showToast('Ingresa la descripción del problema');
  const ficha = { ...state.mantForm, registradoPor: state.sesionUsuario?.nombre || 'Desconocido', fecha: today() };
  const historialMantenimiento = [...(eq.historialMantenimiento || []), ficha];
  const updates = { historialMantenimiento };
  if (state.mantForm.resultado === 'resuelto') updates.condicion = 'bueno';
  state.showMantModal = false; state.mantEqId = null;
  update(ref(db, 'equipos/' + eq.id), updates).then(() => showToast('🔧 Ficha guardada' + (state.mantForm.resultado === 'resuelto' ? ' · Equipo marcado como Bueno' : '')));
};

window.eliminarCondicion = (eqId, idx) => {
  if (!isAdmin()) return showToast('⚠️ Solo el administrador puede eliminar esto');
  const eq = state.equipos.find(x => x.id === eqId);
  if (!eq || !eq.historialCondicion) return;
  if (!confirm('¿Eliminar este registro de condición?')) return;
  const hist = eq.historialCondicion.filter((_, i) => i !== idx);
  // Restore condicion to last remaining entry or 'bueno'
  const lastCond = hist.length > 0 ? hist[hist.length-1].condicionNueva : 'bueno';
  update(ref(db, 'equipos/' + eqId), { historialCondicion: hist, condicion: lastCond })
    .then(() => showToast('🗑 Registro eliminado'));
};

window.registrarDevolucion = handleDevolucion;
window.closeCondicionModal = () => { state.showCondicionModal = false; state.condicionEqId = null; render(); };
window.setCondicionField = (k, v) => { state.condicionForm[k] = v; render(); };
window.setCondicionNota = v => { state.condicionForm.nota = v; };
window.doCondicion = confirmCondicion;
window.openCondicionModal = openCondicionModal;
window.closePrestamoModal = () => { state.showPrestamoModal = false; state.prestamoId = null; render(); };
window.setPrestamoField = (k, v) => { state.prestamoForm[k] = v; render(); };
window.setPrestamoNota = v => { state.prestamoForm.nota = v; };
window.doMovimiento = confirmMovimiento;

window.activarModoLote = tipo => {
  state.modoSeleccionLote = true;
  state.seleccionLote = [];
  state.tipoLote = tipo || 'prestamo';
  render();
};

window.cancelarLote = () => { state.modoSeleccionLote = false; state.seleccionLote = []; render(); };

window.toggleLote = id => {
  const idx = state.seleccionLote.indexOf(id);
  if (idx >= 0) state.seleccionLote.splice(idx, 1); else state.seleccionLote.push(id);
  render();
};

window.toggleLoteCard = id => {
  const eq = state.equipos.find(x => x.id === id);
  if (!eq) return;
  // For prestamo: must have prestado=true. For devolucion: must have last movimiento=devolucion
  if (state.tipoLote === 'prestamo' && !eqPrestado(eq)) return;
  if (state.tipoLote === 'devolucion') {
    const movs = eq.movimientos || [];
    const last = movs[movs.length - 1];
    if (!last || last.tipo !== 'devolucion') return;
  }
  toggleLote(id);
};

window.generarLotePDF = () => {
  if (state.seleccionLote.length === 0) return showToast('Selecciona al menos un equipo');
  const items = state.seleccionLote.map(id => {
    const eq = state.equipos.find(x => x.id === id);
    if (!eq) return null;
    const movs = (eq.movimientos||[]).filter(m => m.tipo === state.tipoLote);
    const mov = movs.length > 0 ? movs[movs.length-1] : null;
    return { eq, movimiento: mov };
  }).filter(Boolean);
  generateLotePDF(items, state.tipoLote);
  state.modoSeleccionLote = false; state.seleccionLote = []; render();
};

window.generarMemo = (eqId, movIdx) => {
  const eq = state.equipos.find(x => x.id === eqId);
  if (!eq || !eq.movimientos) return;
  const mov = eq.movimientos[movIdx];
  if (mov) generateMemoPDF(eq, mov);
};

window.emailMemo = (eqId, movIdx) => {
  const eq = state.equipos.find(x => x.id === eqId);
  if (!eq || !eq.movimientos) return;
  const mov = eq.movimientos[movIdx];
  if (!mov) return;
  const tipoM = mov.tipo === 'prestamo' ? 'PRESTAMO' : 'DEVOLUCION';
  const asunto = encodeURIComponent('Memorandum de ' + tipoM + ' - ' + eq.serie + ' - ' + new Date().toLocaleDateString('es-SV'));
  const lineas = [
    'Para: ' + (mov.a||''),
    'Asunto: ' + tipoM + ' de equipo analizador de red',
    'Fecha: ' + new Date().toLocaleDateString('es-SV'),
    '',
    'Serie: ' + eq.serie,
    eq.vineta ? 'Vineta: ' + eq.vineta : '',
    'Modelo: ' + (eq.modelo||''),
    '',
    'Movimiento: ' + (mov.de||'') + ' -> ' + (mov.a||''),
    mov.nota ? 'Nota: ' + mov.nota : '',
    '',
    'Documento generado por CPT INNOVA - Sistema de Gestion de Analizadores de Red'
  ].filter(Boolean).join('\n');
  window.location.href = 'mailto:?subject=' + asunto + '&body=' + encodeURIComponent(lineas);
};

// Envío a revisión (Cucumacayán)
window.openRevisionModal = openRevisionModal;
window.closeRevisionModal = closeRevisionModal;
window.setRevisionField = (k, v) => { state.revisionForm[k] = v; };
window.doEnvioRevision = confirmRevision;
window.memoRevision = reimprimirMemoRevision;
window.editarRevision = editarRevision;
