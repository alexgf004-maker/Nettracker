// Plantillas HTML de memorándums (movimientos, lotes, carga masiva)
import { CONDICIONES, USUARIOS } from '../config.js';
import { state } from '../state.js';
import { abrirDoc } from '../ui.js';
import { areaToSede, escapeHtml, fmtDate } from '../utils.js';

export function generateLotePDF(equiposLote, tipo) {
  const esTipo = tipo === 'prestamo' ? 'PRÉSTAMO' : 'DEVOLUCIÓN';
  const fecha = new Date().toLocaleDateString('es-SV');

  const filas = equiposLote.map(item => {
    const mov = item.movimiento;
    return `<tr>
      <td style="padding:10px 14px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0;font-family:'Courier New',monospace">${item.eq.vineta||'—'}</td>
      <td style="padding:10px 14px;font-family:'Courier New',monospace;font-weight:700;font-size:13px;color:#0a1628;border-bottom:1px solid #e2e8f0">${item.eq.serie}</td>
      <td style="padding:10px 14px;font-size:13px;color:#4a5568;border-bottom:1px solid #e2e8f0">${item.eq.modelo||'—'}</td>
      <td style="padding:10px 14px;font-size:13px;color:#4a5568;border-bottom:1px solid #e2e8f0;text-align:center">${mov ? fmtDate(mov.fecha) : '—'}</td>
      <td style="padding:10px 14px;font-size:13px;color:#4a5568;border-bottom:1px solid #e2e8f0">${mov ? (mov.de||'') : '—'} → ${mov ? (mov.a||'') : '—'}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #0a1628; background: #fff; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #0057b8; padding-bottom: 20px; }
  .logo-area { display: flex; align-items: center; gap: 14px; }
  .logo-box { width: 56px; height: 56px; background: linear-gradient(135deg, #003d8f, #0077cc); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
  .company-name { font-size: 22px; font-weight: 800; color: #0057b8; }
  .company-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .memo-title { text-align: right; }
  .memo-label { font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase; }
  .memo-type { font-size: 24px; font-weight: 800; color: #0057b8; margin-top: 4px; }
  .memo-date { font-size: 12px; color: #64748b; margin-top: 4px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 10px; font-weight: 700; color: #0057b8; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e8f0fb; }
  table { width: 100%; border-collapse: collapse; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  thead { background: #0057b8; }
  thead th { padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 700; color: #fff; letter-spacing: 1px; text-transform: uppercase; }
  thead th:last-child { text-align: center; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .transfer-row { display: flex; align-items: center; gap: 16px; margin: 16px 0; }
  .transfer-box { flex: 1; background: #e8f0fb; border: 2px solid #0057b8; border-radius: 10px; padding: 12px 16px; text-align: center; }
  .transfer-box.dest { background: #ecfdf5; border-color: #059669; }
  .transfer-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }
  .transfer-name { font-size: 15px; font-weight: 800; }
  .arrow { font-size: 26px; color: #0057b8; }
  .firma-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 8px; }
  .firma-box { text-align: center; }
  .firma-line { border-top: 1.5px solid #0a1628; margin-top: 60px; padding-top: 8px; }
  .firma-label { font-size: 11px; color: #64748b; }
  .firma-name { font-size: 13px; font-weight: 700; margin-top: 2px; }
  .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
  .badge-count { display: inline-block; background: #e8f0fb; color: #0057b8; border-radius: 20px; padding: 3px 12px; font-size: 12px; font-weight: 700; margin-left: 8px; }
<\/style>
  <\/head>
<body>
  <div class="header">
    <div class="logo-area">
      <div class="logo-box">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="2" width="18" height="20" rx="2" stroke="white" stroke-width="1.8" fill="none"/>
          <path d="M8 7h8M8 10h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M12 14l-2 4h4l-2 4" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="company-name">CPT INNOVA</div>
        <div class="company-sub">Analizadores de Red · Calidad de Energía</div>
      </div>

    </div>
    <div class="memo-title">
      <div class="memo-label">Memorándum de</div>
      <div class="memo-type">${esTipo} DE LOTE</div>
      <div class="memo-date">Generado el ${fecha}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Equipos incluidos <span class="badge-count">${equiposLote.length} equipos</span></div>
    <table>
      <thead>
        <tr>
          <th>Viñeta</th>
          <th>N° de Serie</th>
          <th>Modelo</th>
          <th style="text-align:center">Fecha</th>
          <th>Área entrega → Área recibe</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Firmas de conformidad</div>
    <div class="firma-grid">
      <div class="firma-box">
        <div class="firma-line">
          <div class="firma-label">Entrega</div>
          <div class="firma-name">${equiposLote[0]?.movimiento?.de || (tipo === 'prestamo' ? 'CPT BT' : 'CPT MT')}</div>
          ${equiposLote[0]?.movimiento?.registradoPor && (equiposLote[0]?.movimiento?.de || '') !== 'Campos y Servicios' ? `<div style="font-size:11px;color:#64748b;margin-top:3px">${equiposLote[0].movimiento.registradoPor}</div>` : ''}
        </div>
      </div>
      <div class="firma-box">
        <div class="firma-line">
          <div class="firma-label">Recibe</div>
          <div class="firma-name">${equiposLote[0]?.movimiento?.a || (tipo === 'prestamo' ? 'CPT MT' : 'CPT BT')}</div>
          ${equiposLote[0]?.movimiento?.registradoPor && (equiposLote[0]?.movimiento?.a || '') !== 'Campos y Servicios' ? `<div style="font-size:11px;color:#64748b;margin-top:3px">${equiposLote[0].movimiento.registradoPor}</div>` : ''}
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    Documento generado por CPT INNOVA · Sistema de Gestión de Analizadores de Red · ${fecha}
  </div>
<\/body>
<\/html>`;

  abrirDoc(html, 'documento.html');
}

export function generateMemoPDF(eq, movimiento) {
  const esTipo = movimiento.tipo === 'prestamo' ? 'PRÉSTAMO' : 'DEVOLUCIÓN';
  const de = movimiento.de || '';
  const a = movimiento.a || '';
  const fecha = fmtDate(movimiento.fecha);
  const nota = movimiento.nota || '';
  const vineta = eq.vineta || '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; color: #0a1628; background: #fff; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #0057b8; padding-bottom: 20px; }
  .logo-area { display: flex; align-items: center; gap: 14px; }
  .logo-box { width: 56px; height: 56px; background: linear-gradient(135deg, #003d8f, #0077cc); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
  .logo-box svg { width: 32px; height: 32px; }
  .company-name { font-size: 22px; font-weight: 800; color: #0057b8; letter-spacing: -.5px; }
  .company-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .memo-title { text-align: right; }
  .memo-label { font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase; }
  .memo-type { font-size: 24px; font-weight: 800; color: #0057b8; margin-top: 4px; }
  .memo-date { font-size: 12px; color: #64748b; margin-top: 4px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 10px; font-weight: 700; color: #0057b8; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #e8f0fb; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-item { background: #f8fafc; border-radius: 8px; padding: 12px 16px; }
  .info-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .info-value { font-size: 15px; font-weight: 700; color: #0a1628; font-family: 'Courier New', monospace; }
  .info-value.normal { font-family: Arial, sans-serif; font-size: 14px; }
  .transfer-row { display: flex; align-items: center; gap: 16px; margin: 20px 0; }
  .transfer-box { flex: 1; background: #e8f0fb; border: 2px solid #0057b8; border-radius: 10px; padding: 14px 18px; text-align: center; }
  .transfer-box.dest { background: #ecfdf5; border-color: #059669; }
  .transfer-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .transfer-name { font-size: 16px; font-weight: 800; color: #0a1628; }
  .arrow { font-size: 28px; color: #0057b8; font-weight: 700; }
  .nota-box { background: #f8fafc; border-left: 3px solid #0057b8; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #4a5568; font-style: italic; min-height: 40px; }
  .firma-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 8px; }
  .firma-box { text-align: center; }
  .firma-line { border-top: 1.5px solid #0a1628; margin-top: 60px; padding-top: 8px; }
  .firma-label { font-size: 11px; color: #64748b; }
  .firma-name { font-size: 13px; font-weight: 700; color: #0a1628; margin-top: 2px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
<\/style>
  <\/head>
<body>
  <div class="header">
    <div class="logo-area">
      <div class="logo-box">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="2" width="18" height="20" rx="2" stroke="white" stroke-width="1.8" fill="none"/>
          <path d="M8 7h8M8 10h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M12 14l-2 4h4l-2 4" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="company-name">CPT INNOVA</div>
        <div class="company-sub">Analizadores de Red · Calidad de Energía</div>
      </div>

    </div>
    <div class="memo-title">
      <div class="memo-label">Memorándum de</div>
      <div class="memo-type">${esTipo}</div>
      <div class="memo-date">${fecha}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Datos del equipo</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Número de serie</div>
        <div class="info-value">${eq.serie}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Modelo / Marca</div>
        <div class="info-value normal">${eq.modelo||'—'}</div>
      </div>
      ${vineta ? `<div class="info-item">
        <div class="info-label">Viñeta</div>
        <div class="info-value">${vineta}</div>
      </div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Movimiento</div>
    <div class="transfer-row">
      <div class="transfer-box">
        <div class="transfer-label">Área que entrega</div>
        <div class="transfer-name">${de}</div>
      </div>
      <div class="arrow">→</div>
      <div class="transfer-box dest">
        <div class="transfer-label">Área que recibe</div>
        <div class="transfer-name">${a}</div>
      </div>
    </div>
  </div>

  ${nota ? `<div class="section">
    <div class="section-title">Observaciones</div>
    <div class="nota-box">${nota}</div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Firmas de conformidad</div>
    <div class="firma-grid">
      <div class="firma-box">
        <div class="firma-line">
          <div class="firma-label">Entrega</div>
          <div class="firma-name">${de}</div>
          ${(() => { const u = USUARIOS.find(x => x.nombre === movimiento.registradoPor); return (u && u.area === de) ? '<div style="font-size:11px;color:#64748b;margin-top:3px">'+movimiento.registradoPor+'</div>' : ''; })()}
        </div>
      </div>
      <div class="firma-box">
        <div class="firma-line">
          <div class="firma-label">Recibe</div>
          <div class="firma-name">${a}</div>
          ${(() => { const u = USUARIOS.find(x => x.nombre === movimiento.registradoPor); return (u && u.area === a) ? '<div style="font-size:11px;color:#64748b;margin-top:3px">'+movimiento.registradoPor+'</div>' : ''; })()}
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    Documento generado por CPT INNOVA · Sistema de Gestión de Analizadores de Red · ${new Date().toLocaleDateString('es-SV')}
  </div>
<\/body>
<\/html>`;

  abrirDoc(html, 'documento.html');

}

export function buildMemoCargaMasiva(filas) {
  const esMT = state.cargaAreaOrigen === 'CPT MT' || state.cargaAreaOrigen === 'CPT DELSUR';
  const fecha = new Date().toLocaleDateString('es-SV');
  const td = (v, mono) => '<td style="padding:4px 6px;font-size:9px;border-bottom:1px solid #e2e8f0;'+(mono?'font-family:\'Courier New\',monospace;font-weight:700':'')+'">'+(v||'—')+'</td>';
  const rows = filas.map(r => '<tr>'
    +td(r.caso, true)
    +td(r.serie, true)
    +td(r.vineta||'—', true)
    +td(r.idUsuario||'—', false)
    +td(r.lugar, false)
    +td(r.direccion||'—', false)
    +(esMT ? td(r.multiplicador||'—',false)+td(r.corrientes||'—',false)+td(r.conexion||'—',false) : td(r.notas||'—',false)+td(r.medidor||'—',true))
    +'<td style="padding:4px 6px;font-size:9px;border-bottom:1px solid #e2e8f0;text-align:center">'+(r.fechaInst||'—')+'</td>'
    +(esMT ? '' : '<td style="padding:4px 6px;font-size:9px;border-bottom:1px solid #e2e8f0;text-align:center">'+(r.fechaRetiro||'—')+'</td>')
    +td(r.accesorios||'—', false)
    +'</tr>').join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#0a1628;padding:16px;font-size:10px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;border-bottom:2px solid #0057b8;padding-bottom:8px}
    .logo-box{width:36px;height:36px;background:linear-gradient(135deg,#003d8f,#0077cc);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .company-name{font-size:14px;font-weight:800;color:#0057b8}
    .company-sub{font-size:10px;color:#94a3b8;margin-top:2px}
    .memo-type{font-size:14px;font-weight:800;color:#0057b8;text-align:right}
    .memo-label{font-size:10px;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;text-align:right}
    .section-title{font-size:9px;font-weight:700;color:#0057b8;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #e8f0fb}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}
    thead{background:#0057b8}
    thead th{padding:5px 6px;text-align:left;font-size:8px;font-weight:700;color:#fff;letter-spacing:.5px;text-transform:uppercase}
    .badge{display:inline-block;background:#e8f0fb;color:#0057b8;border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700}
    .firma-grid{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:8px}
    .firma-line{border-top:1.5px solid #0a1628;margin-top:28px;padding-top:6px;text-align:center}
    .firma-label{font-size:10px;color:#64748b}
    .firma-name{font-size:13px;font-weight:700;margin-top:2px}
    .footer{margin-top:10px;padding-top:6px;border-top:1px solid #e2e8f0;text-align:center;font-size:8px;color:#94a3b8}
  @media print{body{padding:8px}@page{margin:8mm 6mm}}<\/style><\/head><body>
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
      <div class="memo-type">ASIGNACIÓN DE EQUIPOS</div>
      <div style="font-size:11px;color:#64748b;text-align:right;margin-top:4px">Para: Campos y Servicios · ${fecha}</div>
    </div>
  </div>
  <div style="margin-bottom:20px">
    <div class="section-title">Equipos asignados <span class="badge">${filas.length} equipos</span></div>
    <table>
      <thead><tr>
        <th>N° SIGET</th>
        <th>Equipo</th>
        <th>Viñeta</th>
        <th>ID Usuario</th>
        <th>Nombre del Usuario</th>
        <th>Dirección</th>
        ${esMT ? '<th>Multiplicador</th><th>Corrientes</th><th>Conexión</th>' : '<th>Transformador</th><th>Medidor</th>'}
        <th style="text-align:center">F. Instalación</th>
        ${!esMT ? '<th style="text-align:center">F. Retiro</th>' : ''}
        <th>Accesorios</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div style="margin-bottom:24px">
    <div class="section-title">Firmas de conformidad</div>
    <div class="firma-grid">
      <div class="firma-line">
        <div class="firma-label">Entrega</div>
        <div class="firma-name">${state.cargaAreaOrigen} · ${areaToSede(state.cargaAreaOrigen)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${state.sesionUsuario?.nombre||''}</div>
      </div>
      <div class="firma-line"><div class="firma-label">Recibe</div><div class="firma-name">Campos y Servicios</div></div>
    </div>
  </div>
  <div class="footer">Documento generado por CPT INNOVA · Sistema de Gestión de Analizadores de Red · ${fecha}</div>
  <\/body><\/html>`;

  return html;
}

// Memo de envío de un equipo a revisión en la Subestación Cucumacayán
export function generateMemoRevision(eq, envio) {
  const e = escapeHtml;
  const cond = CONDICIONES.find(c => c.key === envio.condicionAnterior);
  const area = USUARIOS.find(u => u.nombre === envio.entregadoPor)?.area || '';
  const antecedentes = envio.antecedentes || [];

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Envío a revisión · ${e(eq.serie)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; color: #0a1628; background: #fff; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; border-bottom: 3px solid #0057b8; padding-bottom: 20px; }
  .logo-area { display: flex; align-items: center; gap: 14px; }
  .logo-box { width: 56px; height: 56px; background: linear-gradient(135deg, #003d8f, #0077cc); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
  .logo-box svg { width: 32px; height: 32px; }
  .company-name { font-size: 22px; font-weight: 800; color: #0057b8; letter-spacing: -.5px; }
  .company-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .memo-title { text-align: right; }
  .memo-label { font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase; }
  .memo-type { font-size: 22px; font-weight: 800; color: #0057b8; margin-top: 4px; }
  .memo-date { font-size: 12px; color: #64748b; margin-top: 4px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 10px; font-weight: 700; color: #0057b8; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e8f0fb; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .info-item { background: #f8fafc; border-radius: 8px; padding: 10px 14px; }
  .info-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .info-value { font-size: 15px; font-weight: 700; color: #0a1628; font-family: 'Courier New', monospace; }
  .info-value.normal { font-family: Arial, sans-serif; font-size: 14px; }
  .transfer-row { display: flex; align-items: center; gap: 16px; }
  .transfer-box { flex: 1; background: #e8f0fb; border: 2px solid #0057b8; border-radius: 10px; padding: 12px 16px; text-align: center; }
  .transfer-box.dest { background: #f3f0ff; border-color: #7c3aed; }
  .transfer-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .transfer-name { font-size: 15px; font-weight: 800; color: #0a1628; }
  .arrow { font-size: 28px; color: #0057b8; font-weight: 700; }
  .texto-box { background: #f8fafc; border-left: 3px solid #0057b8; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #1e293b; line-height: 1.5; white-space: pre-wrap; }
  .texto-box.falla { border-left-color: #dc2626; background: #fef2f2; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .firma-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .firma-box { text-align: center; }
  .firma-line { border-top: 1.5px solid #0a1628; margin-top: 60px; padding-top: 8px; }
  .firma-label { font-size: 11px; color: #64748b; }
  .firma-name { font-size: 13px; font-weight: 700; color: #0a1628; margin-top: 2px; }
  .firma-sub { font-size: 11px; color: #64748b; margin-top: 3px; }
  .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
  @media print { body { padding: 20px; } @page { margin: 12mm; } }
</style>
</head>
<body>
  <div class="header">
    <div class="logo-area">
      <div class="logo-box">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="2" width="18" height="20" rx="2" stroke="white" stroke-width="1.8" fill="none"/>
          <path d="M8 7h8M8 10h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M12 14l-2 4h4l-2 4" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="company-name">CPT INNOVA</div>
        <div class="company-sub">Analizadores de Red · Calidad de Energía</div>
      </div>
    </div>
    <div class="memo-title">
      <div class="memo-label">Memorándum de</div>
      <div class="memo-type">ENVÍO A REVISIÓN</div>
      <div class="memo-date">${fmtDate(envio.fecha)}${envio.hora ? ' · ' + e(envio.hora) : ''}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Datos del equipo</div>
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Número de serie</div><div class="info-value">${e(eq.serie)}</div></div>
      <div class="info-item"><div class="info-label">Modelo / Marca</div><div class="info-value normal">${e(eq.modelo || '—')}</div></div>
      ${eq.vineta ? `<div class="info-item"><div class="info-label">Viñeta</div><div class="info-value">${e(eq.vineta)}</div></div>` : ''}
      <div class="info-item"><div class="info-label">Condición al entregar</div><div class="info-value normal">${cond ? cond.label : '—'}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Entrega</div>
    <div class="transfer-row">
      <div class="transfer-box">
        <div class="transfer-label">Entrega</div>
        <div class="transfer-name">${e(envio.sedeOrigen)}${area ? ' · ' + e(area) : ''}</div>
      </div>
      <div class="arrow">→</div>
      <div class="transfer-box dest">
        <div class="transfer-label">Recibe para revisión</div>
        <div class="transfer-name">Subestación Cucumacayán</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Motivo de la entrega</div>
    <div class="texto-box">${e(envio.motivo)}</div>
  </div>

  <div class="section">
    <div class="section-title">¿Qué le pasó al equipo?</div>
    <div class="texto-box falla">${e(envio.descripcion)}</div>
  </div>

  <div class="section">
    <div class="info-grid">
      <div class="info-item"><div class="info-label">Fecha del incidente</div><div class="info-value normal">${fmtDate(envio.fechaIncidente)}</div></div>
      <div class="info-item"><div class="info-label">Fecha de entrega</div><div class="info-value normal">${fmtDate(envio.fecha)}</div></div>
    </div>
  </div>

  ${antecedentes.length ? `<div class="section">
    <div class="section-title">Antecedentes registrados</div>
    <table>
      <thead><tr><th style="width:90px">Fecha</th><th>Detalle</th><th style="width:34%">Origen</th></tr></thead>
      <tbody>${antecedentes.map(a => `<tr><td>${fmtDate(a.fecha)}</td><td>${e(a.texto)}</td><td>${e(a.origen)}</td></tr>`).join('')}</tbody>
    </table>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Firmas de conformidad</div>
    <div class="firma-grid">
      <div class="firma-box"><div class="firma-line">
        <div class="firma-label">Entrega</div>
        <div class="firma-name">${e(envio.entregadoPor)}</div>
        ${area ? `<div class="firma-sub">${e(area)}</div>` : ''}
      </div></div>
      <div class="firma-box"><div class="firma-line">
        <div class="firma-label">Recibe</div>
        <div class="firma-name">&nbsp;</div>
        <div class="firma-sub">Subestación Cucumacayán</div>
      </div></div>
    </div>
  </div>

  <div class="footer">
    Documento generado por CPT INNOVA · Sistema de Gestión de Analizadores de Red · ${new Date().toLocaleDateString('es-SV')}
  </div>
</body>
</html>`;

  abrirDoc(html, 'envio-revision-' + String(eq.serie || 'equipo').replace(/[^\w-]+/g, '_') + '.html');
}

// Memo de equipo dañado en campo por Campos y Servicios (tres firmas)
export function generateMemoDanio(m) {
  const e = escapeHtml;
  const cond = CONDICIONES.find(c => c.key === m.condicion);
  const dato = (label, valor, mono) => `<div class="info-item"><div class="info-label">${label}</div><div class="info-value${mono ? '' : ' normal'}">${valor || '—'}</div></div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Equipo dañado · ${e(m.serie)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; color: #0a1628; background: #fff; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 26px; border-bottom: 3px solid #0057b8; padding-bottom: 20px; }
  .logo-area { display: flex; align-items: center; gap: 14px; }
  .logo-box { width: 56px; height: 56px; background: linear-gradient(135deg, #003d8f, #0077cc); border-radius: 12px; display: flex; align-items: center; justify-content: center; }
  .logo-box svg { width: 32px; height: 32px; }
  .company-name { font-size: 22px; font-weight: 800; color: #0057b8; letter-spacing: -.5px; }
  .company-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .memo-title { text-align: right; }
  .memo-label { font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase; }
  .memo-type { font-size: 22px; font-weight: 800; color: #dc2626; margin-top: 4px; }
  .memo-date { font-size: 12px; color: #64748b; margin-top: 4px; }
  .section { margin-bottom: 22px; }
  .section-title { font-size: 10px; font-weight: 700; color: #0057b8; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e8f0fb; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
  .info-item { background: #f8fafc; border-radius: 8px; padding: 10px 14px; }
  .info-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .info-value { font-size: 14px; font-weight: 700; color: #0a1628; font-family: 'Courier New', monospace; }
  .info-value.normal { font-family: Arial, sans-serif; font-size: 13px; }
  .texto-box { background: #fef2f2; border-left: 3px solid #dc2626; border-radius: 6px; padding: 12px 16px; font-size: 13px; color: #1e293b; line-height: 1.5; white-space: pre-wrap; }
  .intro { font-size: 13px; color: #334155; line-height: 1.6; }
  .firma-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 28px; }
  .firma-box { text-align: center; }
  .firma-line { border-top: 1.5px solid #0a1628; margin-top: 64px; padding-top: 8px; }
  .firma-label { font-size: 12px; font-weight: 700; color: #0a1628; }
  .firma-name { font-size: 12px; color: #334155; margin-top: 3px; min-height: 15px; }
  .firma-sub { font-size: 10px; color: #94a3b8; margin-top: 2px; }
  .footer { margin-top: 34px; padding-top: 14px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
  @media print { body { padding: 20px; } @page { margin: 12mm; } }
</style>
</head>
<body>
  <div class="header">
    <div class="logo-area">
      <div class="logo-box">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="2" width="18" height="20" rx="2" stroke="white" stroke-width="1.8" fill="none"/>
          <path d="M8 7h8M8 10h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M12 14l-2 4h4l-2 4" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="company-name">CPT INNOVA</div>
        <div class="company-sub">Analizadores de Red · Calidad de Energía</div>
      </div>
    </div>
    <div class="memo-title">
      <div class="memo-label">Memorándum de</div>
      <div class="memo-type">EQUIPO DAÑADO EN CAMPO</div>
      <div class="memo-date">${fmtDate(m.fecha)}${m.hora ? ' · ' + e(m.hora) : ''}</div>
    </div>
  </div>

  <div class="section">
    <p class="intro">Por medio del presente se hace constar que el analizador de red detallado a continuación, despachado a
    <b>Campos y Servicios</b> para su instalación en campo, resultó dañado. El equipo se entrega en la
    <b>Subestación Cucumacayán</b> en la condición indicada.</p>
  </div>

  <div class="section">
    <div class="section-title">Datos del equipo</div>
    <div class="info-grid">
      ${dato('Número de serie', e(m.serie), true)}
      ${dato('Modelo / Marca', e(m.modelo))}
      ${dato('Viñeta', e(m.vineta), true)}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Datos de la instalación</div>
    <div class="info-grid">
      ${dato('Caso', m.caso ? '#' + e(m.caso) : '', true)}
      ${dato('Lugar', e(m.lugar))}
      ${dato('Área beneficiaria', e(m.areaBeneficiaria))}
      ${dato('Fecha de instalación', fmtDate(m.fechaInstalacion))}
      ${dato('Retiro programado', fmtDate(m.fechaRetiro))}
      ${dato('Fecha del daño', fmtDate(m.fechaDanio))}
    </div>
  </div>

  <div class="section">
    <div class="section-title">¿Qué le pasó al equipo?</div>
    <div class="texto-box">${e(m.descripcion)}</div>
  </div>

  <div class="section">
    <div class="info-grid">
      ${dato('Condición en que se recibe', cond ? cond.label : e(m.condicion))}
      ${dato('Se entrega en', 'Subestación Cucumacayán')}
      ${dato('Técnico de Campos y Servicios', e(m.tecnicoCampos))}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Firmas de conformidad</div>
    <div class="firma-grid">
      <div class="firma-box"><div class="firma-line">
        <div class="firma-label">${e(m.areaGenera || 'CPT MT')}</div>
        <div class="firma-name">${e(m.generadoPor)}</div>
        <div class="firma-sub">CPT INNOVA</div>
      </div></div>
      <div class="firma-box"><div class="firma-line">
        <div class="firma-label">Subestación Cucumacayán</div>
        <div class="firma-name"></div>
        <div class="firma-sub">Recibe el equipo</div>
      </div></div>
      <div class="firma-box"><div class="firma-line">
        <div class="firma-label">Campos y Servicios</div>
        <div class="firma-name"></div>
        <div class="firma-sub">Contratista</div>
      </div></div>
    </div>
  </div>

  <div class="footer">
    Documento generado por CPT INNOVA · Sistema de Gestión de Analizadores de Red · ${new Date().toLocaleDateString('es-SV')}
  </div>
</body>
</html>`;

  abrirDoc(html, 'equipo-danado-' + String(m.serie || 'equipo').replace(/[^\w-]+/g, '_') + '.html');
}
