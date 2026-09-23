// Pestaña Instalaciones
import { SEDES, USUARIOS, isAdmin, userArea } from '../config.js';
import { state } from '../state.js';
import { badgeSt } from '../ui.js';
import { calcSt, daysUntil, fmtDate, today } from '../utils.js';

export function renderInstalaciones() {
  let html = '';
  const counts = {
    TODOS: state.records.length,
    ACTIVO: state.records.filter(r => calcSt(r) === 'ACTIVO').length,
    PROXIMO: state.records.filter(r => calcSt(r) === 'PROXIMO').length,
    VENCIDO: state.records.filter(r => calcSt(r) === 'VENCIDO').length,
    RETIRADO: state.records.filter(r => r.retirado).length,
    PROGRAMADO: state.records.filter(r => calcSt(r) === 'PROGRAMADO').length
  };

  // Pre-compute filtered records by instTab for instalaciones
  const instTabFilter = state.instTab === 'cpt_mt' ? 'CPT MT' : state.instTab === 'cpt_bt' ? 'CPT BT' : 'Campos y Servicios';
  const recordsFiltrados = state.records.filter(r => {
    if ((r.areaInstalacion || 'CPT MT') !== instTabFilter) return false;
    if (state.instTab === 'campos' && state.camposFiltro !== 'TODOS') {
      const beneficiaria = r.areaBeneficiaria || (r.creadoPor ? (USUARIOS.find(u=>u.nombre===r.creadoPor)?.area || '') : '');
      if (beneficiaria !== state.camposFiltro) return false;
    }
    return true;
  });
  const countsFiltrados = {
    TODOS: recordsFiltrados.length,
    ACTIVO: recordsFiltrados.filter(r => calcSt(r) === 'ACTIVO').length,
    PROXIMO: recordsFiltrados.filter(r => calcSt(r) === 'PROXIMO').length,
    VENCIDO: recordsFiltrados.filter(r => calcSt(r) === 'VENCIDO').length,
    RETIRADO: recordsFiltrados.filter(r => r.retirado).length,
    PROGRAMADO: recordsFiltrados.filter(r => calcSt(r) === 'PROGRAMADO').length
  };

  if (state.view === 'lista') {
    const filtered = recordsFiltrados.filter(r => {
      if (state.filterStatus !== 'TODOS' && calcSt(r) !== state.filterStatus) return false;
      if (state.search) { const q = state.search.toLowerCase(); return (r.serie||'').toLowerCase().includes(q) || (r.caso||'').toLowerCase().includes(q) || (r.lugar||'').toLowerCase().includes(q); }
      return true;
    });
    // Sub-tabs
    const subTabs = [{key:'cpt_mt',label:'⚡ CPT MT'},{key:'cpt_bt',label:'⚡ CPT BT'},{key:'campos',label:'🏗 Campos y Serv.'}];
    html += '<div style="display:flex;background:var(--white);border-bottom:1px solid var(--border);padding:0 16px">';
    subTabs.forEach(t => {
      const active = state.instTab === t.key;
      html += "<button onclick=\"setInstTab('"+t.key+"')\" style=\"flex:1;padding:12px 4px;border:none;background:none;font-family:var(--font);font-size:12px;font-weight:700;color:"+(active?'var(--primary)':'var(--text3)')+";cursor:pointer;border-bottom:2px solid "+(active?'var(--primary)':'transparent')+";transition:all .15s\">"+t.label+"</button>";
    });
    html += '</div>';
    if (state.instTab === 'campos') {
      html += '<div style="display:flex;gap:6px;padding:8px 16px;background:var(--white);border-bottom:1px solid var(--border)">';
      ['TODOS','CPT MT','CPT BT'].forEach(f => {
        const ac = state.camposFiltro === f;
        html += '<button onclick="setCamposFiltro(\''+f+'\')" style="padding:5px 14px;border-radius:20px;border:1.5px solid '+(ac?'var(--primary)':'var(--border)')+';background:'+(ac?'var(--primary)':'#fff')+';color:'+(ac?'#fff':'var(--text3)')+';font-family:var(--font);font-size:11px;font-weight:700;cursor:pointer">'+(f==='TODOS'?'Todos':f)+'</button>';
      });
      html += '</div>';
    }

    html += `<div class="content">
        <div class="stats-bar">
          ${['TODOS','ACTIVO','PROXIMO','VENCIDO','RETIRADO'].map(s => `
            <div class="stat-chip ${state.filterStatus===s?'active':''}" onclick="setFilter('${s}')" style="color:${s==='TODOS'?'var(--blue)':s==='ACTIVO'?'var(--green)':s==='PROXIMO'?'var(--yellow)':s==='VENCIDO'?'var(--red)':'var(--gray)'}">
              <span class="stat-num">${countsFiltrados[s]??counts[s]}</span>
              <span class="stat-label">${s==='TODOS'?'Total':s==='ACTIVO'?'Activos':s==='VENCIDO'?'Vencidos':s==='PROXIMO'?'Próximos':'Retirados'}</span>
            </div>`).join('')}
        </div>
        <div style="background:linear-gradient(135deg,var(--primary-dark),var(--primary));border-radius:14px;padding:14px 16px;margin-bottom:12px;color:#fff">
          <div style="font-size:11px;color:rgba(255,255,255,.7);margin-bottom:6px;font-weight:600">📅 ${new Date().toLocaleDateString("es-SV",{weekday:"long",day:"numeric",month:"long"}).replace(/^./,c=>c.toUpperCase())}</div>
          ${(()=>{
          const ua = userArea();
          const miArea = state.records.filter(r => (r.areaInstalacion||'CPT MT') === ua);
          const nActivos = miArea.filter(r=>calcSt(r)==='ACTIVO').length;
          const nHoy = miArea.filter(r=>!r.retirado&&r.fechaRetiro===today()).length;
          const nSemana = miArea.filter(r=>!r.retirado&&daysUntil(r.fechaRetiro)<=7&&daysUntil(r.fechaRetiro)>0).length;
          return '<div style="display:flex;gap:16px">'
            +'<div><div style="font-size:22px;font-weight:800">'+nActivos+'</div><div style="font-size:10px;color:rgba(255,255,255,.7)">Activos '+ua+'</div></div>'
            +(nHoy>0?'<div><div style="font-size:22px;font-weight:800;color:#ffd700">'+nHoy+'</div><div style="font-size:10px;color:rgba(255,255,255,.7)">Vencen hoy</div></div>':'')
            +(nSemana>0?'<div><div style="font-size:22px;font-weight:800;color:#7dd3fc">'+nSemana+'</div><div style="font-size:10px;color:rgba(255,255,255,.7)">Esta semana</div></div>':'')
            +'</div>'
            +(nHoy>0?'<div style="margin-top:8px;font-size:11px;color:#ffd700;font-weight:600">⚠️ Hay retiros de '+ua+' programados para hoy</div>':'');
        })()}
        </div>
        <div class="search-wrap"><span class="search-icon">🔍</span>
          <input class="search-input" placeholder="Buscar serie, caso, lugar..." value="${state.search}" oninput="setSearch(this.value)" ${state.search?'data-active="true"':''}>
        </div>`;
    if (filtered.length === 0) {
      html += `<div class="empty"><div class="empty-icon">📡</div>
          <div class="empty-text">${state.records.length === 0 ? 'Sin instalaciones registrados' : 'Sin resultados'}</div>
          ${state.records.length === 0 ? `<button class="btn btn-primary" style="max-width:240px;margin:0 auto" onclick="newInstall()">+ Registrar instalación</button>` : ''}
        </div>`;
    } else {
      html += `<div class="list">`;
      filtered.forEach(r => {
        const st = calcSt(r);
        const stCard = calcSt(r);
        const dias = !r.retirado ? daysUntil(r.fechaRetiro) : null;
        const diasInst = stCard === 'PROGRAMADO' ? daysUntil(r.fechaInstalacion) : null;
        const dc = dias === null ? '' : dias <= 0 ? 'color:var(--red)' : dias <= 3 ? 'color:var(--yellow)' : 'color:var(--text3)';
        const dt = diasInst !== null ? `en ${diasInst}d` : dias === null ? '' : dias === 0 ? 'Hoy' : dias < 0 ? `${Math.abs(dias)}d vencido` : `en ${dias}d`;
        const stripe = stCard==='ACTIVO'?'':stCard==='PROXIMO'?' yellow':stCard==='PROGRAMADO'?' purple':' gray';
        html += `<div onclick="openDetail('${r.id}')" style="background:var(--white);border:1px solid var(--border);border-left:3px solid ${stCard==='ACTIVO'?'var(--green)':stCard==='PROXIMO'?'var(--yellow)':stCard==='PROGRAMADO'?'#7c3aed':'var(--border2)'};border-radius:12px;padding:10px 14px;cursor:pointer;box-shadow:var(--shadow);margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
              <div style="display:flex;align-items:center;gap:6px"><div style="font-family:var(--mono);font-size:14px;font-weight:800;color:var(--text)">${r.serie||'—'}</div>${(()=>{const eq=state.equipos.find(e=>e.id===r.equipoId);return eq&&eq.vineta?'<span style="font-size:10px;color:var(--text3);font-family:var(--mono);background:var(--border2);padding:2px 6px;border-radius:4px">🏷'+eq.vineta+'</span>':''})()}</div>
              ${badgeSt(stCard)}
            </div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:4px">#${r.caso}${r.modelo?' · '+r.modelo:''}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-size:12px;color:var(--text2)">📍 ${r.lugar||'Sin ubicación'}</div>
              <span style="font-size:10px;color:var(--text3)">${r.areaInstalacion||'CPT MT'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;padding-top:5px;border-top:1px solid var(--border2)">
              <span style="font-size:11px;color:var(--text3)">↩ ${fmtDate(r.fechaRetiro)}</span>
              <span style="font-size:11px;font-weight:700;${dc}">${dt}</span>
            </div>
          </div>`;
      });
      // Legend
        
      html += `</div>`;
    }
    html += `</div>`;
  }

  else if (state.view === 'form') {
    const selEq = state.form.equipoId ? state.equipos.find(e => e.id === state.form.equipoId) : null;
    html += `<div class="content">
        <div class="page-title">${state.editId ? 'Editar instalación' : 'Nuevo instalación'}</div>
        <div class="form-section">
          <div class="form-section-title">Equipo</div>
          <div class="field"><label>Seleccionar equipo *</label>
            ${selEq ? `<div class="equipo-preview">
              <div><div style="font-weight:700;font-family:var(--mono)">${selEq.serie}</div><div style="font-size:12px;color:var(--text3)">${selEq.modelo}</div></div>
              <button class="change-btn" onclick="openSelector()">Cambiar</button>
            </div>` : `<button class="btn btn-secondary" style="border-color:#c7d5fd;color:var(--blue);background:var(--blue-light)" onclick="openSelector()">📦 Elegir del inventario</button>`}
          </div>
        </div>
        <div class="form-section">
          <div class="form-section-title">Caso</div>
          <div class="field"><label>Código de caso / campaña *</label>
            <input placeholder="Ej: CR1D2025201" value="${state.form.caso}" oninput="setField('caso',this.value)">
          </div>
        </div>
        <div class="form-section">
          <div class="form-section-title">Ubicación</div>
          <div class="loc-toggle">
            <button class="loc-tab ${state.locMode==='gps'?'active':''}" onclick="setLocMode('gps')">📍 GPS</button>
            <button class="loc-tab ${state.locMode==='manual'?'active':''}" onclick="setLocMode('manual')">✏️ Manual</button>
          </div>
          ${state.locMode === 'gps' ? `
            <div class="field">
              <button class="gps-btn" id="gps-btn" onclick="triggerGPS()">📍 Capturar ubicación GPS</button>
              ${state.form.lat ? `<div class="gps-tag">🛰 ${state.form.lat}, ${state.form.lng}</div>` : ''}
            </div>
            <div class="field"><label>Descripción del lugar</label>
              <input placeholder="Ej: Quezaltepeque / Edificio Central" value="${state.form.lugar}" oninput="setField('lugar',this.value)">
            </div>` : `
            <div class="field"><label>Descripción del lugar *</label>
              <input placeholder="Ej: Quezaltepeque / Edificio Central" value="${state.form.lugar}" oninput="setField('lugar',this.value)">
            </div>
            <div class="row">
              <div class="field"><label>Latitud (opcional)</label><input placeholder="13.8333" value="${state.form.lat||''}" oninput="setField('lat',this.value)"></div>
              <div class="field"><label>Longitud (opcional)</label><input placeholder="-89.2833" value="${state.form.lng||''}" oninput="setField('lng',this.value)"></div>
            </div>`}
        </div>
        <div class="form-section">
          <div class="form-section-title">Fechas</div>
          <div class="row">
            <div class="field"><label>Instalaciones</label><input type="date" value="${state.form.fechaInstalacion}" oninput="setField('fechaInstalacion',this.value)"></div>
            <div class="field"><label>Retiro *</label><input type="date" value="${state.form.fechaRetiro}" oninput="setField('fechaRetiro',this.value)"></div>
          </div>
        </div>
        <div class="form-section">
          <div class="form-section-title">Área que instala</div>
          <div class="field">
            <div style="display:flex;gap:8px">
              ${['CPT MT','CPT BT','Campos y Servicios'].map(a => {
              const sel = state.form.areaInstalacion === a;
              return '<div onclick="setField(\'areaInstalacion\',\''+a+'\')" style="flex:1;padding:9px 4px;border-radius:10px;border:2px solid '+(sel?'var(--primary)':'var(--border)')+';background:'+(sel?'var(--primary-light)':'#fff')+';text-align:center;cursor:pointer;font-size:11px;font-weight:700;color:'+(sel?'var(--primary)':'var(--text3)')+'">'+a+'</div>';
            }).join('')}
            </div>
          </div>
        </div>
        <div class="form-section">
          <div class="form-section-title">Sede de salida</div>
          <div class="field"><label>¿De qué sede sale el equipo?</label>
            <select oninput="setField('sede',this.value)" style="background-image:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath fill=%2294a3b8%22 d=%22M6 8L1 3h10z%22/%3E%3C/svg%3E');background-repeat:no-repeat;background-position:right 14px center;padding-right:36px;appearance:none">
              ${SEDES.map(s => '<option value="'+s+'" '+(state.form.sede===s?'selected':'')+'>'+s+'</option>').join('')}
            </select>
          </div>
        </div>
        <div class="form-section">
          <div class="form-section-title">Notas</div>
          <div class="field"><textarea placeholder="Observaciones, acceso al sitio, contacto..." oninput="setField('notas',this.value)">${state.form.notas}</textarea></div>
        </div>
        ${state.form.areaInstalacion !== 'Campos y Servicios' ? (() => {
        let eHtml = '<div class="form-section"><div class="form-section-title">Lecturas de energía (instalación)</div>';
        eHtml += '<div style="display:flex;gap:6px;margin-bottom:10px">';
        [['ninguna','Sin lectura'],['una','Una lectura'],['tres','P / R / V']].forEach(([t,l]) => {
          const sel = state.form.energiaTipoInst === t;
          eHtml += '<div onclick="setField(\'energiaTipoInst\',\''+t+'\')" style="flex:1;padding:8px 4px;border-radius:8px;border:2px solid '+(sel?'var(--primary)':'var(--border)')+';background:'+(sel?'var(--primary-light)':'#fff')+';text-align:center;cursor:pointer;font-size:11px;font-weight:700;color:'+(sel?'var(--primary)':'var(--text3)')+'">'+l+'</div>';
        });
        eHtml += '</div>';
        if (state.form.energiaTipoInst==='una') eHtml += '<div class="field"><input type="number" placeholder="Energía (kWh)" value="'+state.form.energiaInstUna+'" oninput="setField(\'energiaInstUna\',this.value)"></div>';
        if (state.form.energiaTipoInst==='tres') {
          eHtml += '<div style="display:flex;gap:8px">';
          [['Punta','energiaInstPunta'],['Resto','energiaInstResto'],['Valle','energiaInstValle']].forEach(([l,k]) => {
            eHtml += '<div style="flex:1"><div style="font-size:10px;font-weight:600;color:var(--text3);margin-bottom:4px">'+l.toUpperCase()+'</div><input type="number" placeholder="kWh" value="'+(state.form[k]||'')+'" oninput="setField(\''+k+'\',this.value)" style="width:100%;padding:8px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:13px;box-sizing:border-box"></div>';
          });
          eHtml += '</div>';
        }
        eHtml += '</div>';
        return eHtml;
      })() : ''}
        <button class="btn btn-primary" onclick="saveInstall()">${state.editId ? 'Guardar cambios' : 'Registrar instalación'}</button>
      </div>`;
  }

  else if (state.view === 'detalle') {
    const r = state.records.find(x => x.id === state.editId);
    if (!r) { state.view = 'lista'; return null; }
    const st = calcSt(r);
    const dias = !r.retirado ? daysUntil(r.fechaRetiro) : null;
    html += `<div class="content">
        <div class="detail-hero">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div><div class="detail-serie">${r.serie||'—'}</div><div class="detail-modelo">${r.modelo||''}</div></div>
            ${badgeSt(st)}
          </div>
          ${dias === 0 && !r.retirado ? `<div class="alert-banner alert-yellow" style="margin-top:12px">🔔 Este analizador debe retirarse HOY</div>` : ''}
          ${dias !== null && dias < 0 ? `<div class="alert-banner alert-red" style="margin-top:12px">⚠️ Vencido: debió retirarse hace ${Math.abs(dias)} día${Math.abs(dias)>1?'s':''}</div>` : ''}
        </div>
        <div class="detail-grid">
          <div class="detail-row"><div class="detail-label">Caso / Campaña</div><div class="detail-value">#${r.caso}</div></div>
          <div class="detail-row"><div class="detail-label">Área</div><div class="detail-value">${r.areaInstalacion||'CPT MT'}</div></div>
          ${r.sede ? `<div class="detail-row"><div class="detail-label">Sede salida</div><div class="detail-value">🏭 ${r.sede}</div></div>` : ''}
          <div class="detail-row"><div class="detail-label">Lugar</div><div class="detail-value">${r.lugar||'—'}</div></div>
          ${r.lat ? `<div class="detail-row"><div class="detail-label">GPS</div><div class="detail-value">${r.lat}, ${r.lng}</div></div>` : ''}
          <div class="detail-row"><div class="detail-label">Instalaciones</div><div class="detail-value">${fmtDate(r.fechaInstalacion)}</div></div>
          <div class="detail-row"><div class="detail-label">Retiro programado</div><div class="detail-value">${fmtDate(r.fechaRetiro)}${dias!==null?` <span style="font-size:12px;color:${dias<=0?'var(--red)':dias<=3?'var(--yellow)':'var(--text3)'}">(${dias===0?'hoy':dias>0?`en ${dias}d`:`${Math.abs(dias)}d vencido`})</span>`:''}</div></div>
          ${r.fechaRetiroReal ? `<div class="detail-row"><div class="detail-label">Retirado el</div><div class="detail-value">${fmtDate(r.fechaRetiroReal)}</div></div>` : ''}
          ${r.notas ? `<div class="detail-row"><div class="detail-label">Notas</div><div class="detail-value">${r.notas}</div></div>` : ''}
          ${r.energiaInstalacion && r.energiaInstalacion.tipo !== 'ninguna' ? `<div class="detail-row"><div class="detail-label">Energía instalación</div><div class="detail-value" style="font-family:var(--mono)">${r.energiaInstalacion.tipo==='una' ? r.energiaInstalacion.una+' kWh' : 'P:'+r.energiaInstalacion.punta+' R:'+r.energiaInstalacion.resto+' V:'+r.energiaInstalacion.valle+' kWh'}</div></div>` : ''}
          ${r.energiaRetiro && r.energiaRetiro.tipo !== 'ninguna' ? `<div class="detail-row"><div class="detail-label">Energía retiro</div><div class="detail-value" style="font-family:var(--mono)">${r.energiaRetiro.tipo==='una' ? r.energiaRetiro.una+' kWh' : 'P:'+r.energiaRetiro.punta+' R:'+r.energiaRetiro.resto+' V:'+r.energiaRetiro.valle+' kWh'}</div></div>` : ''}
          ${r.creadoPor ? `<div class="detail-row"><div class="detail-label">Registrado por</div><div class="detail-value" style="color:var(--text3);font-size:13px">${r.creadoPor}</div></div>` : ''}
          ${r.editadoPor ? `<div class="detail-row"><div class="detail-label">Editado por</div><div class="detail-value" style="color:var(--text3);font-size:13px">${r.editadoPor} · ${fmtDate(r.fechaEdicion)}</div></div>` : ''}
        </div>
        ${r.descargas && r.descargas.length > 0 ? `
          <div class="section-title" style="margin-top:4px">Descargas parciales (${r.descargas.length})</div>
          <div class="list" style="margin-bottom:16px">
            ${r.descargas.slice().reverse().map(d => `
              <div class="historial-card">
                <div class="historial-row">
                  <div>
                    <div class="historial-lugar">💾 ${d.tecnico}</div>
                    <div class="historial-caso">${d.notas||'Sin observaciones'}</div>
                    ${d.registradoPor && d.registradoPor !== d.tecnico ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">Registrado por: ${d.registradoPor}</div>` : ''}
                  </div>
                  <div class="historial-fecha">${fmtDate(d.fecha)}</div>
                </div>
              </div>`).join('')}
          </div>` : ''}
        ${r.lat || !r.retirado ? `
          <div style="display:flex;gap:8px;margin-bottom:10px">
            ${r.lat ? `<a href="https://maps.google.com/?q=${r.lat},${r.lng}" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;background:var(--primary-light);border:1px solid var(--primary);border-radius:10px;text-decoration:none;font-size:12px;font-weight:700;color:var(--primary)">🗺 Google Maps</a>` : ''}
            ${!r.retirado ? `<button onclick="addToCalendar('${r.id}')" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;background:#e8f0fb;border:1px solid #c7d5fd;border-radius:10px;font-family:var(--font);font-size:12px;font-weight:700;color:#1a73e8;cursor:pointer">📅 Calendar</button>` : ''}
          </div>` : ''}
        ${!r.retirado ? `
          <div style="display:flex;gap:8px;margin-bottom:10px">
            ${isAdmin() ? `<button onclick="editInstall('${r.id}')" style="flex:1;padding:11px;background:var(--white);border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:13px;font-weight:700;color:var(--text2);cursor:pointer">✏️ Editar</button>` : ''}
            <button onclick="openDescargaModal('${r.id}')" style="flex:1;padding:11px;background:var(--accent-light);border:1.5px solid var(--accent);border-radius:10px;font-family:var(--font);font-size:13px;font-weight:700;color:var(--primary);cursor:pointer">💾 Descarga</button>
          </div>
          <button class="btn btn-danger" onclick="openRetiroModal('${r.id}')">Marcar como retirado</button>
        ` : ''}
        ${isAdmin() ? `<div style="text-align:center;margin-top:4px">
          <button onclick="delInstall('${r.id}')" style="background:none;border:none;font-family:var(--font);font-size:12px;color:var(--text3);cursor:pointer;padding:6px 12px;text-decoration:underline">Eliminar registro</button>
        </div>` : ''}
      </div>`;
  }
  return html;
}
