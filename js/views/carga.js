// Pestaña Despachos (carga masiva, historial, accesorios)
import { AREAS, isAdmin } from '../config.js';
import { state } from '../state.js';
import { fmtDate } from '../utils.js';

export function renderCarga() {
  let html = '';
  html += '<div class="content">';
  // Toggle between subir and historial
  html += '<div style="display:flex;gap:8px;margin-bottom:16px">';
  html += '<button onclick="setCargaSubView(\'subir\')" style="flex:1;padding:10px;border-radius:10px;border:2px solid '+(state.cargaSubView==='subir'?'var(--primary)':'var(--border)')+';background:'+(state.cargaSubView==='subir'?'var(--primary-light)':'#fff')+';color:'+(state.cargaSubView==='subir'?'var(--primary)':'var(--text3)')+';font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">📥 Subir archivo</button>';
  html += '<button onclick="setCargaSubView(\'historial\')" style="flex:1;padding:10px;border-radius:10px;border:2px solid '+(state.cargaSubView==='historial'?'var(--primary)':'var(--border)')+';background:'+(state.cargaSubView==='historial'?'var(--primary-light)':'#fff')+';color:'+(state.cargaSubView==='historial'?'var(--primary)':'var(--text3)')+';font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">📋 Historial '+(state.historialCargas.length>0?'('+state.historialCargas.length+')':'')+'</button>';
  html += '<button onclick="setCargaSubView(\'accesorios\')" style="flex:1;padding:10px;border-radius:10px;border:2px solid '+(state.cargaSubView==='accesorios'?'var(--primary)':'var(--border)')+';background:'+(state.cargaSubView==='accesorios'?'var(--primary-light)':'#fff')+';color:'+(state.cargaSubView==='accesorios'?'var(--primary)':'var(--text3)')+';font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">🔒 Accesorios</button>';
  html += '</div>';

  if (state.cargaSubView === 'historial') {
    html += '<div class="page-title">📋 Historial de despachos</div>';
    if (state.historialCargas.length === 0) {
      html += '<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Sin despachos registrados</div></div>';
    } else {
      state.historialCargas.forEach((c, i) => {
        html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
        html += '<div style="font-size:13px;font-weight:700;color:var(--text)">' + fmtDate(c.fecha) + ' · ' + (c.hora||'') + '</div>';
        html += '<span style="background:var(--primary-light);color:var(--primary);font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px">' + c.total + ' eq.</span>';
        html += '</div>';
        html += '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">' + (c.areaOrigen||'CPT BT') + ' → Campos y Serv.' + (c.realizadoPor ? ' · 👤 ' + c.realizadoPor : '') + '</div>';
        // Check retiro status
        const instDespacho = c.instalacionIds ? state.records.filter(r => c.instalacionIds.includes(r.id)) : [];
        const retirados = instDespacho.filter(r => r.retirado).length;
        const pendientes = instDespacho.filter(r => !r.retirado).length;
        const descPend = instDespacho.filter(r => r.retirado && r.descargaPendiente).length;

        // Status badge
        if (instDespacho.length > 0) {
          html += '<div style="display:flex;gap:6px;margin-bottom:8px">';
          html += '<div style="flex:1;background:var(--green-light);border-radius:8px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--green)">'+retirados+'</div><div style="font-size:9px;color:var(--green);font-weight:600">RETIRADOS</div></div>';
          html += '<div style="flex:1;background:var(--yellow-light);border-radius:8px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--yellow)">'+pendientes+'</div><div style="font-size:9px;color:var(--yellow);font-weight:600">PENDIENTES</div></div>';
          if (descPend > 0) html += '<div style="flex:1;background:var(--red-light);border-radius:8px;padding:6px;text-align:center"><div style="font-size:14px;font-weight:800;color:var(--red)">'+descPend+'</div><div style="font-size:9px;color:var(--red);font-weight:600">DESC. PEND.</div></div>';
          html += '</div>';
        }

        html += '<div style="display:flex;gap:6px;margin-bottom:6px">';
        html += '<button onclick="verMemo(\''+c.id+'\')" style="flex:1;padding:9px;border:1px solid var(--primary);border-radius:8px;background:var(--primary-light);color:var(--primary);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">📄 Ver memo</button>';
        html += '<button onclick="emailDespacho(\''+c.id+'\')" style="flex-shrink:0;padding:9px 12px;border:1px solid var(--accent);border-radius:8px;background:var(--accent-light);color:var(--primary);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">📧</button>';
        html += '</div>';
        html += '<button onclick="gestionarRetiro(\''+c.id+'\')" style="width:100%;padding:9px;border:1px solid var(--yellow);border-radius:8px;background:var(--yellow-light);color:var(--yellow);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer;margin-bottom:6px">📦 Gestionar retiro</button>';
        html += isAdmin() ? '<button onclick="eliminarDespacho(\''+c.id+'\')" style="width:100%;padding:8px;border:1px solid var(--red);border-radius:8px;background:var(--red-light);color:var(--red);font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer">🗑 Eliminar despacho</button>' : '';
        html += '</div>';
      });
    }
  } else if (state.cargaSubView === 'despacho' && state.despachoDetalle) {
    const c = state.historialCargas.find(x => x.id === state.despachoDetalle);
    if (!c) { state.cargaSubView = 'historial'; state.despachoDetalle = null; }
    else {
      const instDespacho = getInstDespacho(c);
      const retirados = instDespacho.filter(r => r.retirado).length;
      const pendientes = instDespacho.filter(r => !r.retirado).length;

      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">';
      html += '<button onclick="setCargaSubView(\'historial\')" style="background:var(--primary-light);border:1px solid var(--primary);color:var(--primary);border-radius:8px;padding:6px 12px;font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">← Volver</button>';
      html += '<div style="font-size:15px;font-weight:800;color:var(--text)">Despacho ' + fmtDate(c.fecha) + '</div>';
      html += '</div>';

      // Summary chips
      html += '<div style="display:flex;gap:8px;margin-bottom:14px">';
      html += '<div style="flex:1;background:var(--border2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--text)">' + c.total + '</div><div style="font-size:9px;color:var(--text3);font-weight:600">TOTAL</div></div>';
      html += '<div style="flex:1;background:var(--green-light);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--green)">' + retirados + '</div><div style="font-size:9px;color:var(--green);font-weight:600">RETIRADOS</div></div>';
      html += '<div style="flex:1;background:var(--yellow-light);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--yellow)">' + pendientes + '</div><div style="font-size:9px;color:var(--yellow);font-weight:600">PENDIENTES</div></div>';
      html += '</div>';

      // Retiro masivo button
      if (pendientes > 0) {
        html += '<button onclick="retiroMasivo(\''+c.id+'\')" style="width:100%;padding:11px;border:none;border-radius:10px;background:var(--primary);color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer;margin-bottom:12px">✅ Marcar todos como retirados (' + pendientes + ')</button>';
      }

      // List of installations
      html += '<div style="display:flex;flex-direction:column;gap:8px">';
      instDespacho.forEach(r => {
        const descPend = r.retirado && r.descargaPendiente;
        const descOk = r.retirado && !r.descargaPendiente && r.descargas && r.descargas.length > 0;
        const color = r.retirado ? (descPend ? 'var(--yellow)' : 'var(--green)') : 'var(--border)';
        html += '<div style="background:var(--white);border:1px solid var(--border);border-left:4px solid '+color+';border-radius:10px;padding:12px 14px">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">';
        html += '<div style="font-family:var(--mono);font-size:13px;font-weight:700">' + (r.serie||'—') + '</div>';
        if (r.retirado) {
          if (descPend) html += '<span class="badge badge-yellow" style="font-size:10px">⚠️ Desc. pendiente</span>';
          else if (descOk) html += '<span class="badge badge-green" style="font-size:10px">✅ Descargado</span>';
          else html += '<span class="badge badge-green" style="font-size:10px">✅ Retirado</span>';
        } else {
          html += '<span class="badge badge-gray" style="font-size:10px">🔄 En campo</span>';
        }
        html += '</div>';
        html += '<div style="font-size:11px;color:var(--text3)">#' + (r.caso||'—') + ' · ' + (r.lugar||'—') + '</div>';
        if (r.retirado) html += '<div style="font-size:11px;color:var(--text3);margin-top:2px">Retirado: ' + fmtDate(r.fechaRetiroReal) + '</div>';
        html += '<div style="display:flex;gap:6px;margin-top:8px">';
        if (!r.retirado) {
          html += '<button onclick="openRetiroModal(\''+r.id+'\')" style="flex:1;padding:7px;border:1px solid var(--primary);border-radius:8px;background:var(--primary-light);color:var(--primary);font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer">📥 Marcar retirado</button>';
        }
        if (r.retirado && descPend) {
          html += '<button onclick="openDescargaModal(\''+r.id+'\')" style="flex:1;padding:7px;border:1px solid var(--yellow);border-radius:8px;background:var(--yellow-light);color:var(--yellow);font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer">💾 Registrar descarga</button>';
        }
        html += '</div></div>';
      });
      html += '</div>';
    }
  } else if (state.cargaSubView === 'accesorios') {
    // Static form - reads values from DOM on submit, no oninput render
    html += '<div class="page-title">🔒 Memo de Accesorios</div>';
    html += '<div style="font-size:12px;color:var(--text3);margin-bottom:16px">Genera un memo de entrega de accesorios</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">';
    html += '<div><div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">DE</div>';
    html += '<select id="acc-de" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:13px;background:var(--white);color:var(--text)">';
    [...AREAS].forEach(a => { html += '<option value="'+a+'"'+(a==='CPT MT'?' selected':'')+'>'+a+'</option>'; });
    html += '</select></div>';
    html += '<div><div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">PARA</div>';
    html += '<select id="acc-para" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:13px;background:var(--white);color:var(--text)">';
    [...AREAS].forEach(a => { html += '<option value="'+a+'"'+(a==='Campos y Servicios'?' selected':'')+'>'+a+'</option>'; });
    html += '</select></div>';
    html += '</div>';

    // Candados
    html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">';
    html += '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">🔒 Candados con llave</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Cantidad</div><input id="acc-candados" type="number" min="0" placeholder="0" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:14px;outline:none"></div>';
    html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Notas (opcional)</div><input id="acc-candados-notas" type="text" placeholder="Ej: cuello largo" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:13px;outline:none"></div>';
    html += '</div></div>';

    // Cadenas
    html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">';
    html += '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">⛓️ Cadenas</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Cantidad</div><input id="acc-cadenas" type="number" min="0" placeholder="0" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:14px;outline:none"></div>';
    html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Notas (opcional)</div><input id="acc-cadenas-notas" type="text" placeholder="Ej: con argollas" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:13px;outline:none"></div>';
    html += '</div></div>';

    // Sellos
    html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:16px">';
    html += '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:10px">🏷️ Sellos de seguridad</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">';
    html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Cantidad</div><input id="acc-sellos" type="number" min="0" placeholder="0" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:14px;outline:none"></div>';
    html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Notas (opcional)</div><input id="acc-sellos-notas" type="text" placeholder="Ej: con distintivo rojo" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:13px;outline:none"></div>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Serie desde</div><input id="acc-serie-desde" type="text" placeholder="Ej: 134567" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;outline:none"></div>';
    html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Serie hasta</div><input id="acc-serie-hasta" type="text" placeholder="Ej: 136700" style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;outline:none"></div>';
    html += '</div></div>';

    html += '<button onclick="generarMemoAccesorios()" style="width:100%;padding:14px;border:none;border-radius:12px;background:var(--primary);color:#fff;font-family:var(--font);font-size:14px;font-weight:700;cursor:pointer;margin-bottom:20px">📄 Generar y guardar memo</button>';

    // Historial de accesorios
    if (state.historialAccesorios.length > 0) {
      html += '<div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">Historial de memos (' + state.historialAccesorios.length + ')</div>';
      state.historialAccesorios.forEach(m => {
        html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
        html += '<div style="font-size:13px;font-weight:700;color:var(--text)">' + fmtDate(m.fecha) + ' · ' + (m.hora||'') + '</div>';
        html += '<div style="font-size:11px;color:var(--text3)">' + (m.de||'') + ' → ' + (m.para||'') + '</div>';
        html += '</div>';
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">';
        (m.items||[]).forEach(item => {
          html += '<span style="background:var(--primary-light);color:var(--primary);font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">' + item.qty + ' ' + item.label + (item.detalle?' · '+item.detalle:'') + '</span>';
        });
        html += '</div>';
        html += '<div style="display:flex;gap:6px">';
        html += '<button onclick="reimprimirMemoAcc(this.dataset.id)" data-id="' + m.id + '" style="flex:1;padding:8px;border:1px solid var(--primary);border-radius:8px;background:var(--primary-light);color:var(--primary);font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">📄 Reimprimir</button>';
        if (isAdmin()) html += '<button onclick="eliminarMemoAcc(this.dataset.id)" data-id="' + m.id + '" style="padding:8px 12px;border:1px solid var(--red);border-radius:8px;background:var(--red-light);color:var(--red);font-family:var(--font);font-size:12px;cursor:pointer">🗑</button>';
        html += '</div></div>';
      });
    }

  } else {
  html += '<div class="page-title">📤 Despachos a C&S</div>';
  html += '<div style="font-size:13px;color:var(--text3);margin-bottom:20px">Importa instalaciones para <strong style="color:var(--primary)">Campos y Servicios</strong> desde un archivo Excel.</div>';

  if (state.cargaView === 'upload') {
    // Upload area
    html += '<div style="border:2px dashed var(--border);border-radius:var(--radius);padding:40px 20px;text-align:center;background:var(--white);margin-bottom:16px">';
    html += '<div style="font-size:40px;margin-bottom:12px">📊</div>';
    html += '<div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px">Selecciona tu archivo Excel</div>';
    html += '<div style="font-size:12px;color:var(--text3);margin-bottom:20px">.xlsx o .xls</div>';
    html += '<label style="display:inline-block;background:var(--primary);color:#fff;padding:12px 24px;border-radius:10px;font-family:var(--font);font-size:14px;font-weight:700;cursor:pointer">Elegir archivo<input type="file" accept=".xlsx,.xls" onchange="handleFileUpload(event)" style="display:none"></label>';
    html += '</div>';
    html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px">';
    html += '<div style="font-size:10px;font-weight:700;color:var(--primary);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">¿De qué área salen los equipos?</div>';
    html += '<div style="display:flex;gap:8px">';
    AREAS.forEach(a => {
      const sel = state.cargaAreaOrigen === a;
      html += "<div onclick=\"setCargaOrigen('"+a+"')\" style=\"flex:1;padding:10px 6px;border-radius:10px;border:2px solid "+(sel?'var(--primary)':'var(--border)')+";background:"+(sel?'var(--primary-light)':'#fff')+";text-align:center;cursor:pointer;font-size:11px;font-weight:700;color:"+(sel?'var(--primary)':'var(--text3)')+"\">"+a+"</div>";
    });
    html += '</div></div>';

    // Column guide
    html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:var(--radius);padding:16px">';
    html += '<div style="font-size:10px;font-weight:700;color:var(--primary);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">Columnas requeridas</div>';
    const cols = [
      {name:'Número SIGET', desc:'Código del caso'},
      {name:'Equipo', desc:'Serie del analizador'},
      {name:'Nombre del Usuario', desc:'Lugar de instalación'},
      {name:'Fecha instalación', desc:'DD/MM/YYYY'},
      {name:'Fecha retiro', desc:'DD/MM/YYYY'},
      {name:'Transformador', desc:'Va a notas'},
      {name:'Latitud', desc:'Opcional, para mapa'},
      {name:'Longitud', desc:'Opcional, para mapa'},
    ];
    cols.forEach(c => {
      html += '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border2)">';
      html += '<span style="font-size:12px;font-weight:700;font-family:var(--mono);color:var(--text)">' + c.name + '</span>';
      html += '<span style="font-size:11px;color:var(--text3)">' + c.desc + '</span>';
      html += '</div>';
    });
    html += '</div>';

  } else if (state.cargaView === 'preview') {
    const ok = state.cargaData.filter(r => r.status === 'ok').length;
    const warn = state.cargaData.filter(r => r.status === 'warning').length;
    const err = state.cargaData.filter(r => r.status === 'error').length;

    // Summary chips
    html += '<div style="display:flex;gap:8px;margin-bottom:16px">';
    html += '<div style="flex:1;background:var(--green-light);border:1px solid var(--green);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--green)">' + ok + '</div><div style="font-size:10px;color:var(--green);font-weight:600">LISTOS</div></div>';
    html += '<div style="flex:1;background:var(--yellow-light);border:1px solid var(--yellow);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--yellow)">' + warn + '</div><div style="font-size:10px;color:var(--yellow);font-weight:600">ADVERTENCIA</div></div>';
    html += '<div style="flex:1;background:var(--red-light);border:1px solid var(--red);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--red)">' + err + '</div><div style="font-size:10px;color:var(--red);font-weight:600">BLOQUEADOS</div></div>';
    html += '</div>';

    if (err > 0) {
      html += '<div style="background:var(--red-light);border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:12px;font-size:12px;color:var(--red);font-weight:600">⚠️ Hay ' + err + ' equipo' + (err>1?'s':'') + ' bloqueado' + (err>1?'s':'') + '. Se registrarán solo los válidos y con advertencia.</div>';
    }

    // Rows preview
    html += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">';
    state.cargaData.forEach((r, i) => {
      const bg = r.status==='ok' ? 'var(--white)' : r.status==='warning' ? 'var(--yellow-light)' : 'var(--red-light)';
      const border = r.status==='ok' ? 'var(--green)' : r.status==='warning' ? 'var(--yellow)' : 'var(--red)';
      const icon = r.status==='ok' ? '✅' : r.status==='warning' ? '⚠️' : '❌';
      html += '<div style="background:' + bg + ';border:1px solid ' + border + ';border-left:4px solid ' + border + ';border-radius:10px;padding:12px">';
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">';
      html += '<div style="font-family:var(--mono);font-size:13px;font-weight:700">' + (r.serie||'Sin serie') + '</div>';
      html += '<span style="font-size:14px">' + icon + '</span>';
      html += '</div>';
      html += '<div style="font-size:11px;color:var(--text2)">Caso: ' + (r.caso||'—') + ' · ' + (r.lugar||'Sin lugar') + '</div>';
      html += '<div style="font-size:11px;color:var(--text3)">Inst: ' + (r.fechaInst||'—') + ' · Retiro: ' + (r.fechaRetiro||'—') + '</div>';
      if (r.problema) html += '<div style="font-size:11px;font-weight:700;color:' + border + ';margin-top:4px">' + r.problema + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // Action buttons
    if (ok + warn > 0) {
      html += '<button onclick="confirmarCarga()" style="width:100%;background:var(--primary);color:#fff;border:none;border-radius:10px;padding:14px;font-family:var(--font);font-weight:700;font-size:15px;cursor:pointer;margin-bottom:8px">✅ Confirmar e importar (' + (ok+warn) + ' equipos)</button>';
    }
    html += '<button onclick="cancelarCarga()" style="width:100%;background:var(--white);color:var(--text3);border:1px solid var(--border);border-radius:10px;padding:13px;font-family:var(--font);font-size:14px;cursor:pointer">Cancelar</button>';
  }

  html += '</div>';

      html += '<div style="height:20px"></div>';
  html += '</div>'; // close upload view else
  } // close carga subview if/else
  html += '</div>'; // close content
  return html;
}
