// Pestaña Inventario
import { CONDICIONES, SEDES, isAdmin } from '../config.js';
import { state } from '../state.js';
import { badgeSt } from '../ui.js';
import { calcSt, eqEnCampo, eqPrestado, eqSt, fmtDate } from '../utils.js';

export function renderInventario() {
  let html = '';

  if (state.view === 'lista') {
    const disp = state.equipos.filter(e => eqSt(e) === 'disponible').length;
    const desp = state.equipos.filter(e => eqSt(e) === 'instalado').length;
    const enPlantel = state.equipos.filter(e => eqSt(e) === 'disponible' && (e.sede||'Plantel Central')==='Plantel Central').length;
    const enCucu = state.equipos.filter(e => eqSt(e) === 'disponible' && e.sede==='Subestación Cucumacayán' && e.sede !== 'Con Campos y Servicios').length;
    const prestados = state.equipos.filter(e => e.prestado).length;
    const enCampo = state.equipos.filter(e => eqSt(e) === 'instalado').length;
    html += `<div class="content">
        <div class="stats-bar">
          <div class="stat-chip ${state.inventarioFiltro==='TODOS'?'active':''}" onclick="setInvFiltro('TODOS')" style="flex-shrink:0;color:var(--primary)"><span class="stat-num">${state.equipos.length}</span><span class="stat-label">Total</span></div>
          <div class="stat-chip ${state.inventarioFiltro==='disponible'?'active':''}" onclick="setInvFiltro('disponible')" style="flex-shrink:0;color:var(--green)"><span class="stat-num">${enPlantel+enCucu}</span><span class="stat-label">Disponibles</span></div>
          <div class="stat-chip ${state.inventarioFiltro==='prestado'?'active':''}" onclick="setInvFiltro('prestado')" style="flex-shrink:0;color:var(--primary)"><span class="stat-num">${prestados}</span><span class="stat-label">Prestados</span></div>
          <div class="stat-chip ${state.inventarioFiltro==='instalado'?'active':''}" onclick="setInvFiltro('instalado')" style="flex-shrink:0;color:var(--yellow)"><span class="stat-num">${enCampo}</span><span class="stat-label">En campo</span></div>

        </div>`;
    // Lote action bar (when in selection mode, show at top)

    if (state.modoSeleccionLote) {
      html += '<div style="background:var(--primary);border-radius:12px;padding:12px 16px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">';
      html += '<div style="color:#fff;font-size:13px;font-weight:700">📄 ' + (state.tipoLote==='prestamo'?'Memo préstamo':'Memo devolución') + ' · ' + state.seleccionLote.length + ' equipo' + (state.seleccionLote.length !== 1 ? 's' : '') + '</div>';
      html += '<button onclick="generarLotePDF()" ' + (state.seleccionLote.length === 0 ? 'disabled' : '') + ' style="background:#fff;color:var(--primary);border:none;border-radius:8px;padding:8px 14px;font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer;opacity:' + (state.seleccionLote.length === 0 ? '.5' : '1') + '">Generar PDF</button>';
      html += '</div>';
    }
    html += '<div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">';
    html += '<div class="search-wrap" style="margin-bottom:0;flex:1"><span class="search-icon">🔍</span><input class="search-input" placeholder="Buscar por serie o modelo..." value="' + state.inventarioSearch + '" oninput="setInvSearch(this.value)" ' + (state.inventarioSearch ? 'data-active="true"' : '') + '></div>';
    html += '<button onclick="toggleVistaInv()" style="flex-shrink:0;padding:11px 14px;border:1.5px solid var(--border);border-radius:var(--radius-sm);background:var(--white);font-size:16px;cursor:pointer;box-shadow:var(--shadow)">' + (state.vistaInventario==='lista' ? '⊞' : '☰') + '</button>';
    html += '</div>';
    if (!state.modoSeleccionLote) {
      html += '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
      html += '<button onclick="activarModoLote(\'prestamo\')" style="padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--white);color:var(--text2);font-family:var(--font);font-size:11px;font-weight:600;cursor:pointer">🔄 Lote préstamo</button>';
      html += '<button onclick="activarModoLote(\'devolucion\')" style="padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--white);color:var(--text2);font-family:var(--font);font-size:11px;font-weight:600;cursor:pointer">✅ Lote devolución</button>';
      html += '<label style="padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--white);color:var(--text2);font-family:var(--font);font-size:11px;font-weight:600;cursor:pointer">📥 Importar<input type="file" accept=".xlsx,.xls" onchange="handleImportEquipos(event)" style="display:none"></label>';
      html += '</div>';
    }
    if (state.equipos.length === 0) {
      html += '<div class="empty"><div class="empty-icon">📦</div><div class="empty-text">El inventario está vacío</div><button class="btn btn-primary" style="max-width:240px;margin:0 auto" onclick="newEquipo()">+ Agregar primer equipo</button></div>';
    } else {
      const filteredEq = state.equipos.filter(eq => {
        if (state.inventarioFiltro === 'disponible' && eqSt(eq) !== 'disponible') return false;
        if (state.inventarioFiltro === 'prestado' && !eqPrestado(eq)) return false;
        if (state.inventarioFiltro === 'instalado' && !eqEnCampo(eq)) return false;
if (state.inventarioSearch) {
          const q = state.inventarioSearch.toLowerCase();
          return eq.serie.toLowerCase().includes(q) || (eq.modelo||'').toLowerCase().includes(q);
        }
        return true;
      });
      if (filteredEq.length === 0) {
        html += '<div class="empty"><div class="empty-icon">🔍</div><div class="empty-text">Sin resultados</div></div>';
      } else {
        const grupos = [
          { label: '🏭 Plantel Central', color: 'var(--primary)', items: filteredEq.filter(e => !eqEnCampo(e) && (e.sede||'Plantel Central')==='Plantel Central') },
          { label: '⚡ Subestación Cucumacayán', color: '#00aaff', items: filteredEq.filter(e => !eqEnCampo(e) && e.sede==='Subestación Cucumacayán') },
          { label: '📡 En campo', color: 'var(--yellow)', items: filteredEq.filter(e => eqEnCampo(e)) },
        ];
        grupos.forEach(grupo => {
          if (grupo.items.length === 0) return;
          html += '<div style="margin-bottom:16px">';
          html += '<div style="font-size:11px;font-weight:700;color:'+grupo.color+';letter-spacing:.5px;margin-bottom:8px;padding:6px 10px;background:'+grupo.color+'18;border-radius:8px;border-left:3px solid '+grupo.color+'">' + grupo.label + ' <span style="font-weight:400;color:var(--text3)">(' + grupo.items.length + ')</span></div>';
          if (state.vistaInventario === 'grid') html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
          grupo.items.forEach(eq => {
            const isPrestado = eqPrestado(eq);
            const isEnCampo = eqEnCampo(eq);
            const c = isEnCampo ? 'var(--yellow)' : isPrestado ? 'var(--primary)' : 'var(--green)';
            const dep = state.records.find(r => r.equipoId === eq.id && !r.retirado);
            const eqId = eq.id;
            const isSelected = state.seleccionLote.includes(eqId);
            // Determine if eligible for current lote type
            let elegible = false;
        
    if (state.modoSeleccionLote) {
              if (state.tipoLote === 'prestamo') elegible = eqPrestado(eq);
              else {
                const movs = eq.movimientos || [];
                const last = movs[movs.length-1];
                elegible = last && last.tipo === 'devolucion';
              }
            }
            const clickable = state.modoSeleccionLote ? (elegible ? `toggleLoteCard('${eqId}')` : '') : `openEqDetalle('${eqId}')`;

            const cardOpacity = state.modoSeleccionLote && !elegible ? '0.35' : '1';
            const cardBorder = isSelected ? '2px solid var(--primary)' : '1px solid var(--border)';
            if (state.vistaInventario === 'lista') {
              // List view
              html += '<div onclick="' + clickable + '" style="background:' + (isSelected?'var(--primary-light)':'var(--white)') + ';border-left:4px solid ' + c + ';border:' + cardBorder + ';border-left:4px solid ' + c + ';border-radius:10px;padding:10px 14px;cursor:' + (state.modoSeleccionLote&&!elegible?'default':'pointer') + ';box-shadow:var(--shadow);display:flex;align-items:center;gap:10px;margin-bottom:6px">';
              if (isSelected) html += '<div style="width:20px;height:20px;background:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;flex-shrink:0">✓</div>';

              html += '<div style="flex:1;min-width:0">';
              html += '<div style="display:flex;align-items:center;gap:6px"><div style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + eq.serie + '</div>' + (eq.vineta ? '<span style="font-size:10px;color:var(--text3);font-family:var(--mono);flex-shrink:0">🏷' + eq.vineta + '</span>' : '') + '</div>';
              html += '<div style="font-size:11px;color:var(--text3)">' + (eq.modelo||'Sin modelo') + '</div>';
              if (dep) html += '<div style="font-size:10px;color:var(--yellow);font-weight:600">📡 #' + dep.caso + '</div>';
              else if (isPrestado) { const movs2=eq.movimientos||[]; const lm=movs2[movs2.length-1]; html += '<div style="font-size:10px;color:var(--primary);font-weight:600">' + (lm&&lm.a==='Campos y Servicios'?'🏗 Con Campos y Servicios':'🔄 Prestado') + '</div>'; }
              html += '</div>';
              html += '<div style="display:flex;flex-direction:column;gap:2px;align-items:flex-end;flex-shrink:0">';
              const tienePendiente = state.records.some(r => r.equipoId === eq.id && r.retirado && r.descargaPendiente);
              if (tienePendiente) html += '<span class="badge badge-yellow" style="font-size:8px;padding:2px 5px">⚠️ Desc.</span>';
              if ((eq.condicion||'bueno')==='fuera') html += '<span class="badge badge-red" style="font-size:8px;padding:2px 5px">🔴 Fuera</span>';
              else if ((eq.condicion||'bueno')==='mantenimiento') html += '<span class="badge" style="font-size:8px;padding:2px 5px;background:#f3f0ff;color:#7c3aed">🔧 Mant.</span>';
              else { if (isPrestado) html += '<span class="badge badge-blue" style="font-size:8px;padding:2px 5px">Prest.</span>'; if (isEnCampo) html += '<span class="badge badge-yellow" style="font-size:8px;padding:2px 5px">Campo</span>'; if (!isPrestado&&!isEnCampo) html += '<span class="badge badge-green" style="font-size:8px;padding:2px 5px">Disp.</span>'; if ((eq.condicion||'bueno')==='detalles') html += '<span style="font-size:10px">🟡</span>'; }
              html += '</div></div>';
            } else {
            html += '<div onclick="' + clickable + '" style="background:' + (isSelected?'var(--primary-light)':'var(--white)') + ';border-top:3px solid ' + c + ';border:' + cardBorder + ';border-top:3px solid ' + c + ';border-radius:12px;padding:12px;cursor:' + (state.modoSeleccionLote&&!elegible?'default':'pointer') + ';box-shadow:var(--shadow);opacity:' + cardOpacity + ';position:relative">';
            if (isSelected) html += '<div style="position:absolute;top:8px;right:8px;width:20px;height:20px;background:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700">✓</div>';

            html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px">';
            html += '<div style="font-family:var(--mono);font-size:12px;font-weight:700;color:var(--text);word-break:break-all;flex:1;margin-right:4px">' + eq.serie + '</div>';
            html += '<div style="display:flex;flex-direction:column;gap:2px;align-items:flex-end">';
            const tienePendGrid = state.records.some(r => r.equipoId === eq.id && r.retirado && r.descargaPendiente);
            if (tienePendGrid) html += '<span class="badge badge-yellow" style="font-size:8px;padding:2px 5px;white-space:nowrap">⚠️ Descarga pend.</span>';
            if ((eq.condicion||'bueno') === 'fuera') {
              html += '<span class="badge badge-red" style="font-size:8px;padding:2px 5px;white-space:nowrap">🔴 Fuera servicio</span>';
            } else if ((eq.condicion||'bueno') === 'mantenimiento') {
              html += '<span class="badge" style="font-size:8px;padding:2px 5px;white-space:nowrap;background:#f3f0ff;color:#7c3aed">🔧 Mantenimiento</span>';
            } else {
              if (isPrestado) html += '<span class="badge badge-blue" style="font-size:8px;padding:2px 5px;white-space:nowrap">Prestado</span>';
              if (isEnCampo) html += '<span class="badge badge-yellow" style="font-size:8px;padding:2px 5px;white-space:nowrap">En campo</span>';
              if (!isPrestado && !isEnCampo) html += '<span class="badge badge-green" style="font-size:8px;padding:2px 5px;white-space:nowrap">Disponible</span>';
            }
            html += '</div></div>';
            html += '<div style="font-size:11px;color:var(--text3);margin-bottom:3px">' + (eq.modelo||'Sin modelo') + '</div>';
            if (eq.vineta) html += '<div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-bottom:3px">🏷 ' + eq.vineta + '</div>';
            if (dep) html += '<div style="font-size:10px;color:var(--yellow);font-weight:600">📡 #' + dep.caso + '</div>';
            else if (isPrestado) {
              const movs = eq.movimientos || [];
              const lastMov = movs[movs.length-1];
              const destino = (lastMov && lastMov.a) ? lastMov.a : 'otra área';
              if (destino === 'Campos y Servicios') html += '<div style="font-size:10px;color:var(--primary);font-weight:600">🏗 Con Campos y Servicios</div>';
              else html += '<div style="font-size:10px;color:var(--primary);font-weight:600">🔄 Prestado a ' + destino + '</div>';
            }
            const cond = CONDICIONES.find(x => x.key === (eq.condicion||'bueno'));
            if (cond && cond.key !== 'bueno' && cond.key !== 'fuera') html += '<div style="font-size:10px;color:'+cond.color+';margin-top:2px">'+cond.icon+' '+cond.label+'</div>';
            if (state.vistaInventario === 'grid') html += '</div>';
            } // end else grid
          });
          if (state.vistaInventario === 'grid') html += '<\/div>';
          html += '<\/div>';
        });
      }
    }

    if (!state.modoSeleccionLote) {
      html += '<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border)">'; 
      html += '<div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">Memorándums de lote</div>';
      html += '<div style="display:flex;gap:8px">';
      html += "<button onclick=\"activarModoLote('prestamo')\" style=\"flex:1;padding:9px;border:1px solid var(--border);border-radius:10px;background:var(--white);color:var(--text2);font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer\">🔄 Lote préstamo</button>";
      html += "<button onclick=\"activarModoLote('devolucion')\" style=\"flex:1;padding:9px;border:1px solid var(--border);border-radius:10px;background:var(--white);color:var(--text2);font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer\">✅ Lote devolución</button>";
      html += '</div>';
      html += '<div style="margin-top:8px"><label style="display:flex;align-items:center;justify-content:center;gap:8px;padding:9px;border:1px solid var(--border);border-radius:10px;background:var(--white);color:var(--text2);font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;width:100%">📥 Importar equipos desde Excel<input type="file" accept=".xlsx,.xls" onchange="handleImportEquipos(event)" style="display:none"></label></div>';

      html += '</div>';
    }
    html += '</div>';
  }

      else if (state.view === 'equipo_form') {
    html += `<div class="content">
        <div class="page-title">${state.editEqId ? 'Editar equipo' : 'Agregar equipo'}</div>
        <div class="field"><label>Número de serie *</label>
          <input placeholder="Ej: 1333S2311" value="${state.equipoForm.serie}" oninput="setEF('serie',this.value)">
        </div>
        <div class="field"><label>Viñeta (N° inventario)</label>
          <input placeholder="Ej: 11063" value="${state.equipoForm.vineta||''}" oninput="setEF('vineta',this.value)">
        </div>
        <div class="field"><label>Modelo / marca *</label>
          <input placeholder="Ej: ECAPLUS / DRANETZ" value="${state.equipoForm.modelo}" oninput="setEF('modelo',this.value)">
        </div>
        <div class="field"><label>Sede de almacenamiento *</label>
          <select oninput="setEF('sede',this.value)" style="background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath fill=%2294a3b8%22 d=%22M6 8L1 3h10z%22/%3E%3C/svg%3E');background-repeat:no-repeat;background-position:right 14px center;padding-right:36px;appearance:none">
            ${SEDES.map(s => '<option value="'+s+'" '+(state.equipoForm.sede===s?'selected':'')+'>'+s+'</option>').join('')}
          </select>
        </div>
        <div class="field"><label>Condición del equipo *</label>
          <div style="display:flex;gap:8px">
            ${CONDICIONES.map(c => {
            const sel = state.equipoForm.condicion === c.key;
            return '<div onclick="setEF(\'condicion\',\''+c.key+'\')" style="flex:1;padding:10px 6px;border-radius:10px;border:2px solid '+(sel?c.color:'var(--border)')+';background:'+(sel?c.bg:'#fff')+';text-align:center;cursor:pointer"><div style="font-size:18px">'+c.icon+'</div><div style="font-size:10px;font-weight:700;color:'+(sel?c.color:'var(--text3)')+'">'+c.label+'</div></div>';
          }).join('')}
          </div>
        </div>
        <div class="field"><label>Notas</label>
          <textarea placeholder="Observaciones del equipo..." oninput="setEF('notas',this.value)">${state.equipoForm.notas}</textarea>
        </div>
        <button class="btn btn-primary" onclick="saveEquipo()">${state.editEqId ? 'Guardar cambios' : 'Agregar al inventario'}</button>
      </div>`;
  }

  else if (state.view === 'equipo_detalle') {
    const eq = state.equipos.find(x => x.id === state.editEqId);
    if (!eq) { state.view = 'lista'; return null; }
    const st = eqSt(eq);
    const historial = state.records.filter(r => r.equipoId === eq.id).sort((a,b) => (b.fechaRegistro||'').localeCompare(a.fechaRegistro||''));
    const condIcon = eq.condicion === 'fuera' ? '🔴' : eq.condicion === 'mantenimiento' ? '🔧' : eq.condicion === 'detalles' ? '🟡' : '🟢';

    html += `<div class="content">
        <div class="detail-hero">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div><div class="detail-serie">${eq.serie}</div><div class="detail-modelo">${eq.modelo||''}</div></div>
            <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
              ${(eq.condicion||'bueno') === 'fuera'
              ? '<span class="badge badge-red">🔴 Fuera de servicio</span>'
              : (eq.condicion||'bueno') === 'mantenimiento'
              ? '<span class="badge" style="background:#f3f0ff;color:#7c3aed">🔧 En mantenimiento</span>'
              : '<span class="badge ' + (st==='disponible'?'badge-green':st==='prestado'?'badge-blue':'badge-yellow') + '">' + (st==='disponible'?'Disponible':st==='prestado'?'Prestado':'Instalado') + '</span>' +
                ((eq.condicion||'bueno') === 'detalles' ? '<span class="badge badge-yellow">🟡 Con detalles</span>' : '')
            }
            </div>
          </div>
          <div style="display:flex;gap:12px;margin-top:14px">
            <div style="text-align:center"><div style="font-size:18px;font-weight:800;color:#fff;font-family:var(--mono)">${historial.length}</div><div style="font-size:9px;color:rgba(255,255,255,.7)">Instalaciones</div></div>
            <div style="text-align:center"><div style="font-size:18px;font-weight:800;color:#fff;font-family:var(--mono)">${historial.filter(r=>r.retirado&&r.fallas&&r.fallas.length>0).length}</div><div style="font-size:9px;color:rgba(255,255,255,.7)">F. Físicas</div></div>
            <div style="text-align:center"><div style="font-size:18px;font-weight:800;color:#fff;font-family:var(--mono)">${historial.filter(r=>r.descargas&&r.descargas.some(d=>d.medicionOk===false)).length}</div><div style="font-size:9px;color:rgba(255,255,255,.7)">F. Medición</div></div>
            <div style="text-align:center"><div style="font-size:18px;font-weight:800;color:#fff;font-family:var(--mono)">${(eq.movimientos||[]).length}</div><div style="font-size:9px;color:rgba(255,255,255,.7)">Movimientos</div></div>
          </div>
        </div>`;

    // TABS
    const tabs = [{key:'general',label:'📋 General'},{key:'instalaciones',label:'📡 Instalaciones'},{key:'mantenimiento',label:'🔧 Mant.'},{key:'movimientos',label:'🔄 Movim.'}];
    html += '<div style="display:flex;background:var(--white);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:12px;overflow:hidden">';
    tabs.forEach(t => {
      const active = state.eqDetalleTab === t.key;
      html += '<button onclick="setEqDetalleTab(\'' + t.key + '\')" style="flex:1;padding:10px 4px;border:none;background:' + (active?'var(--primary)':'#fff') + ';color:' + (active?'#fff':'var(--text3)') + ';font-family:var(--font);font-size:10px;font-weight:700;cursor:pointer;border-right:1px solid var(--border)">' + t.label + '</button>';
    });
    html += '</div>';

    // TAB: GENERAL
    if (state.eqDetalleTab === 'general') {
      html += `<div class="detail-grid">
          ${eq.vineta ? '<div class="detail-row"><div class="detail-label">Viñeta</div><div class="detail-value" style="font-family:var(--mono);font-weight:700">'+eq.vineta+'</div></div>' : ''}
          <div class="detail-row"><div class="detail-label">Modelo / Marca</div><div class="detail-value">${eq.modelo||'—'}</div></div>
          <div class="detail-row"><div class="detail-label">Sede</div><div class="detail-value">${eq.sede||'Plantel Central'}</div></div>
          <div class="detail-row"><div class="detail-label">Condición</div><div class="detail-value">${condIcon} ${(()=>{const c=CONDICIONES.find(x=>x.key===(eq.condicion||'bueno'));return c?c.label:'Bueno';})()}</div></div>
          ${eq.notas ? '<div class="detail-row"><div class="detail-label">Notas</div><div class="detail-value">'+eq.notas+'</div></div>' : ''}
          <div class="detail-row"><div class="detail-label">Registrado</div><div class="detail-value">${fmtDate(eq.fechaRegistro)}${eq.creadoPor?'<span style="color:var(--text3);font-size:12px"> · '+eq.creadoPor+'</span>':''}</div></div>
        </div>`;
      if (isAdmin()) html += `<button class="btn btn-primary" onclick="editEquipo('${eq.id}')">✏️ Editar equipo</button>`;
      html += `<button class="btn" style="background:${(()=>{const c=CONDICIONES.find(x=>x.key===(eq.condicion||'bueno'));return c?c.bg:'var(--green-light)';})()};color:${(()=>{const c=CONDICIONES.find(x=>x.key===(eq.condicion||'bueno'));return c?c.color:'var(--green)';})()};border:1px solid ${(()=>{const c=CONDICIONES.find(x=>x.key===(eq.condicion||'bueno'));return c?c.color:'var(--green)';})()}" onclick="openCondicionModal('${eq.id}')">⚙️ Actualizar condición</button>`;
      if (!eq.prestado && !eqEnCampo(eq) && (eq.condicion||'bueno') !== 'fuera') html += `<button class="btn" style="background:var(--primary-light);color:var(--primary);border:1px solid var(--primary)" onclick="registrarPrestamo('${eq.id}')">🔄 Registrar préstamo</button>`;
      if (eq.prestado) html += `<button class="btn" style="background:var(--green-light);color:var(--green);border:1px solid var(--green)" onclick="registrarDevolucion('${eq.id}')">✅ Registrar devolución</button>`;
      html += `<button class="btn" style="background:var(--primary-light);color:var(--primary);border:1px solid var(--primary)" onclick="exportHojaVida('${eq.id}')">📄 Exportar hoja de vida</button>`;
      if (isAdmin()) html += `<button class="btn btn-secondary" style="color:var(--red)" onclick="delEquipo('${eq.id}')">Eliminar del inventario</button>`;
    }

    // TAB: MANTENIMIENTO
    if (state.eqDetalleTab === 'mantenimiento') {
      if ((eq.condicion||'bueno') === 'mantenimiento') {
        html += `<button class="btn" style="background:#f3f0ff;color:#7c3aed;border:1px solid #7c3aed" onclick="openMantModal('${eq.id}')">🔧 Registrar ficha de mantenimiento</button>`;
      }
      if (eq.historialCondicion && eq.historialCondicion.length > 0) {
        html += '<div class="section-title" style="margin-top:4px">Historial de condición</div>';
        html += '<div class="list" style="margin-bottom:16px">';
        eq.historialCondicion.slice().reverse().forEach((h, hIdx) => {
          const cOld = CONDICIONES.find(c => c.key === h.condicionAnterior);
          const cNew = CONDICIONES.find(c => c.key === h.condicionNueva);
          const realIdx = eq.historialCondicion.length - 1 - hIdx;
          html += '<div class="historial-card"><div class="historial-row"><div>';
          html += '<div class="historial-lugar">' + (cOld?cOld.icon+' '+cOld.label:'—') + ' → ' + (cNew?cNew.icon+' '+cNew.label:'—') + '</div>';
          if (h.nota) html += '<div class="historial-caso">' + h.nota + '</div>';
          if (h.registradoPor) html += '<div style="font-size:10px;color:var(--text3);margin-top:2px">👤 '+h.registradoPor+'</div>';
          html += '</div><div class="historial-fecha">' + fmtDate(h.fecha) + '</div></div>';
          if (isAdmin()) html += '<button onclick="eliminarCondicion(\'' + eq.id + '\',' + realIdx + ')" style="background:none;border:none;font-size:11px;color:var(--red);cursor:pointer;padding:2px 4px;font-family:var(--font)">🗑 Eliminar</button>';
          html += '</div>';
        });
        html += '</div>';
      }
      if (eq.historialMantenimiento && eq.historialMantenimiento.length > 0) {
        html += '<div class="section-title">Fichas de mantenimiento</div>';
        html += '<div class="list" style="margin-bottom:16px">';
        eq.historialMantenimiento.slice().reverse().forEach(m => {
          const resColor = m.resultado==='resuelto'?'var(--green)':m.resultado==='sin_solucion'?'var(--red)':'#f59e0b';
          const resLabel = m.resultado==='resuelto'?'✅ Resuelto':m.resultado==='sin_solucion'?'❌ Sin solución':'⏳ Pendiente';
          html += '<div class="historial-card"><div class="historial-row"><div>';
          html += '<div class="historial-lugar">' + (m.descripcion||'Sin descripción') + '</div>';
          if (m.accion) html += '<div class="historial-caso">Acción: ' + m.accion + '</div>';
          if (m.observaciones) html += '<div style="font-size:11px;color:var(--text3);margin-top:2px">📋 ' + m.observaciones + '</div>';
          html += '<div style="margin-top:4px"><span style="font-size:10px;font-weight:700;color:'+resColor+'">'+resLabel+'</span></div>';
          if (m.registradoPor) html += '<div style="font-size:10px;color:var(--text3);margin-top:2px">👤 '+m.registradoPor+'</div>';
          html += '</div><div class="historial-fecha">' + fmtDate(m.fechaInicio) + (m.fechaResolucion?'<br>→ '+fmtDate(m.fechaResolucion):'') + '</div></div></div>';
        });
        html += '</div>';
      }
      if ((!eq.historialCondicion || eq.historialCondicion.length === 0) && (!eq.historialMantenimiento || eq.historialMantenimiento.length === 0)) {
        html += '<div class="empty"><div class="empty-icon">🔧</div><div class="empty-text">Sin historial de mantenimiento</div></div>';
      }
    }

    // TAB: INSTALACIONES
    if (state.eqDetalleTab === 'instalaciones') {
      // Trazabilidad de fallas
      html += `${(()=>{
        const conFallasFis = historial.filter(r => r.retirado && r.fallas && r.fallas.length > 0);
        const conFallasMed = historial.filter(r => r.descargas && r.descargas.some(d => d.medicionOk === false));
        if (conFallasFis.length === 0 && conFallasMed.length === 0) return '';
        const totalInst = historial.filter(r => r.retirado).length;
        const conteoFis = {};
        conFallasFis.forEach(r => r.fallas.forEach(f => { conteoFis[f] = (conteoFis[f]||0) + 1; }));
        const conteoMed = {};
        conFallasMed.forEach(r => r.descargas.filter(d=>d.medicionOk===false).forEach(d => (d.fallasMedicion||[]).forEach(f => { conteoMed[f] = (conteoMed[f]||0) + 1; })));
        let out = '<div style="background:var(--white);border:1px solid var(--border);border-radius:var(--radius);padding:14px 16px;margin-bottom:12px">';
        out += '<div style="font-size:10px;font-weight:700;color:var(--text);letter-spacing:1px;text-transform:uppercase;margin-bottom:12px">📋 Trazabilidad de fallas</div>';
        out += '<div style="display:flex;gap:8px;margin-bottom:12px">';
        out += '<div style="flex:1;background:var(--red-light);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--red);font-family:var(--mono)">'+conFallasFis.length+'</div><div style="font-size:9px;color:var(--red);font-weight:600">FALLAS<br>FÍSICAS</div></div>';
        out += '<div style="flex:1;background:var(--yellow-light);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--yellow);font-family:var(--mono)">'+conFallasMed.length+'</div><div style="font-size:9px;color:var(--yellow);font-weight:600">FALLOS DE<br>MEDICIÓN</div></div>';
        out += '<div style="flex:1;background:var(--border2);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--text);font-family:var(--mono)">'+totalInst+'</div><div style="font-size:9px;color:var(--text3);font-weight:600">TOTAL<br>RETIRADAS</div></div>';
        out += '</div>';
        if (conFallasFis.length > 0) { out += '<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:var(--red);margin-bottom:6px">🔧 Fallas físicas</div>'; out += Object.entries(conteoFis).sort((a,b)=>b[1]-a[1]).map(([f,n])=>'<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid var(--border2)"><span style="color:var(--text2)">• '+f+'</span><span style="font-weight:700;color:var(--red);font-family:var(--mono)">'+n+'x</span></div>').join(''); out += '</div>'; }
        if (conFallasMed.length > 0) { out += '<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;color:var(--yellow);margin-bottom:6px">📊 Fallos de medición</div>'; out += Object.entries(conteoMed).sort((a,b)=>b[1]-a[1]).map(([f,n])=>'<div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px solid var(--border2)"><span style="color:var(--text2)">• '+f+'</span><span style="font-weight:700;color:var(--yellow);font-family:var(--mono)">'+n+'x</span></div>').join(''); out += '</div>'; }
        const timeline = [];
        conFallasFis.forEach(r => timeline.push({fecha:r.fechaRetiroReal||r.fechaRetiro,tipo:'fisica',desc:r.fallas.join(', ')+(r.descripcionFalla?' — '+r.descripcionFalla:''),caso:r.caso}));
        conFallasMed.forEach(r => r.descargas.filter(d=>d.medicionOk===false).forEach(d => timeline.push({fecha:d.fecha,tipo:'medicion',desc:(d.fallasMedicion||[]).join(', ')+(d.descripcionFalla?' — '+d.descripcionFalla:''),caso:r.caso})));
        timeline.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
        out += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)"><div style="font-size:9px;font-weight:700;color:var(--text3);letter-spacing:1px;margin-bottom:6px">CRONOLOGÍA</div>';
        out += timeline.map(e=>'<div style="display:flex;justify-content:space-between;font-size:11px;padding:4px 0;border-bottom:1px solid var(--border2)"><div><span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;margin-right:4px;'+(e.tipo==='fisica'?'background:var(--red-light);color:var(--red)':'background:var(--yellow-light);color:var(--yellow)')+'">'+( e.tipo==='fisica'?'Física':'Medición')+'</span><span style="color:var(--text2)">'+e.desc+'</span>'+(e.caso?'<span style="color:var(--text3);font-size:10px"> · #'+e.caso+'</span>':'')+'</div><div style="color:var(--text3);font-family:var(--mono);flex-shrink:0;margin-left:8px">'+fmtDate(e.fecha)+'</div></div>').join('');
        out += '</div></div>';
        return out;
      })()}`;

      if (historial.length === 0) {
        html += '<div class="empty"><div class="empty-icon">📡</div><div class="empty-text">Sin instalaciones registradas</div></div>';
      } else {
        html += '<div class="section-title">Historial de instalaciones ('+historial.length+')</div>';
        html += '<div class="list" style="margin-bottom:16px">';
        historial.forEach(r => {
          const st2 = calcSt(r);
          const tieneFallas = r.fallas && r.fallas.length > 0;
          const sinProblema = r.sinProblema;
          html += '<div class="historial-card">';
          html += '<div class="historial-row"><div>';
          html += '<div class="historial-lugar">' + (r.lugar||'Sin lugar') + '</div>';
          html += '<div class="historial-caso">#' + r.caso + '</div>';
          if (r.descargas && r.descargas.length > 0) html += '<div style="font-size:11px;color:var(--primary);font-weight:600;margin-top:2px">💾 '+r.descargas.length+' descarga'+(r.descargas.length>1?'s':'')+'</div>';
          html += '</div><div class="historial-fecha">' + fmtDate(r.fechaInstalacion) + '<br>→ ' + fmtDate(r.fechaRetiroReal||r.fechaRetiro) + '</div></div>';
          html += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">';
          html += badgeSt(st2);
          if (r.retirado && sinProblema) html += '<span class="badge badge-green">✓ Sin problemas</span>';
          if (r.retirado && tieneFallas) html += '<span class="badge badge-red">⚠ Falla física</span>';
          if (r.retirado && r.descargaPendiente) html += '<span class="badge badge-yellow" style="cursor:pointer" onclick="openDescargaModal(\'' + r.id + '\')">⚠️ Desc. pendiente</span>';
          if (r.descargas && r.descargas.some(d=>d.medicionOk===false)) html += '<span class="badge badge-yellow">📊 Fallo medición</span>';
          if (r.descargas && r.descargas.length>0 && r.descargas.every(d=>d.medicionOk===true)) html += '<span class="badge badge-green">📊 Medición OK</span>';
          html += '</div>';
          if (r.retirado && tieneFallas) {
            html += '<div style="margin-top:8px;padding:8px 10px;background:var(--red-light);border-radius:8px">';
            html += '<div style="font-size:11px;font-weight:600;color:var(--red);margin-bottom:4px">FALLAS FÍSICAS</div>';
            r.fallas.forEach(f => { html += '<div style="font-size:12px;color:var(--red)">• '+f+'</div>'; });
            if (r.descripcionFalla) html += '<div style="font-size:11px;color:var(--text2);margin-top:4px;font-style:italic">"'+r.descripcionFalla+'"</div>';
            html += '</div>';
          }
          if (r.descargas && r.descargas.some(d=>d.medicionOk===false)) {
            html += '<div style="margin-top:6px;padding:8px 10px;background:var(--yellow-light);border-radius:8px">';
            html += '<div style="font-size:11px;font-weight:600;color:var(--yellow);margin-bottom:4px">FALLOS DE MEDICIÓN</div>';
            r.descargas.filter(d=>d.medicionOk===false).forEach(d => {
              html += '<div style="font-size:12px;color:var(--yellow)">'+fmtDate(d.fecha)+': '+(d.fallasMedicion||[]).join(', ')+(d.descripcionFalla?' — '+d.descripcionFalla:'')+'</div>';
            });
            html += '</div>';
          }
          if (r.retiradoPor) html += '<div style="font-size:10px;color:var(--text3);margin-top:6px">👤 Retirado por: '+r.retiradoPor+'</div>';
          html += '</div>';
        });
        html += '</div>';
      }
    }

    // TAB: MOVIMIENTOS
    if (state.eqDetalleTab === 'movimientos') {
      if (!eq.movimientos || eq.movimientos.length === 0) {
        html += '<div class="empty"><div class="empty-icon">🔄</div><div class="empty-text">Sin movimientos registrados</div></div>';
      } else {
        html += '<div class="list" style="margin-bottom:16px">';
        eq.movimientos.slice().reverse().forEach(m => {
          const movIdx = eq.movimientos.indexOf(m);
          html += '<div class="historial-card">';
          html += '<div class="historial-row"><div>';
          html += '<div class="historial-lugar">' + m.de + ' → ' + m.a + '</div>';
          html += '<div class="historial-caso">' + (m.tipo==='prestamo'?'🔄 Préstamo':'✅ Devolución') + (m.nota?' · '+m.nota:'') + '</div>';
          if (m.registradoPor) html += '<div style="font-size:10px;color:var(--text3);margin-top:2px">👤 '+m.registradoPor+'</div>';
          html += '</div><div class="historial-fecha">'+fmtDate(m.fecha)+'</div></div>';
          html += '<div style="display:flex;gap:6px;margin-top:8px">';
          html += '<button onclick="generarMemo(\'' + eq.id + '\',' + movIdx + ')" style="flex:1;padding:8px;border:1px solid var(--primary);border-radius:8px;background:var(--primary-light);color:var(--primary);font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer">📄 Memo PDF</button>';
          html += '<button onclick="emailMemo(\'' + eq.id + '\',' + movIdx + ')" style="padding:8px 12px;border:1px solid var(--accent);border-radius:8px;background:var(--accent-light);color:var(--primary);font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer">📧</button>';
          if (isAdmin()) html += '<button onclick="eliminarMovimiento(\'' + eq.id + '\',' + movIdx + ')" style="padding:8px 10px;border:1px solid var(--red);border-radius:8px;background:var(--red-light);color:var(--red);font-family:var(--font);font-size:12px;cursor:pointer">🗑</button>';
          html += '</div></div>';
        });
        html += '</div>';
      }
    }

    html += '</div>';
  }
  return html;
}
