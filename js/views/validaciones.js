// Pestaña Validaciones de TAP
import { state } from '../state.js';

export function renderValidaciones() {
  let html = '';
  html += '<div class="content">';
  if (state.valView === 'lista') {
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
    html += '<div style="font-size:18px;font-weight:800;color:var(--text)">🔌 Validaciones de TAP</div>';
    html += '<button onclick="abrirNuevaValidacion()" style="padding:8px 14px;border:none;border-radius:10px;background:#7c3aed;color:#fff;font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">+ Nueva campaña</button>';
    html += '</div>';
    if (state.validaciones.length === 0) {
      html += '<div class="empty"><div class="empty-icon">🔌</div><div class="empty-text">Sin campañas de validación</div><div style="font-size:12px;color:var(--text3);margin-top:8px">Crea una nueva campaña subiendo<br>el listado de usuarios a validar</div></div>';
    } else {
      state.validaciones.forEach(v => {
        const total = (v.usuarios||[]).length;
        const validados2 = (v.usuarios||[]).filter(u => u.estado === 'validado').length;
        const pct = total > 0 ? Math.round(validados2/total*100) : 0;
        html += '<div onclick="abrirCampana(this.dataset.id)" data-id="'+v.id+'" style="background:var(--white);border:1px solid var(--border);border-left:4px solid #7c3aed;border-radius:12px;padding:14px;margin-bottom:10px;cursor:pointer">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
        html += '<div><div style="font-size:14px;font-weight:700;color:var(--text)">'+v.nombre+'</div>';
        html += '<div style="font-size:11px;color:var(--text3);margin-top:2px">'+v.fecha+' · '+(v.tipo==='monofasico'?'Monofásico':v.tipo==='bifasico'?'Bifásico':'Trifásico')+'</div></div>';
        html += '<span style="background:#f3f0ff;color:#7c3aed;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">'+validados2+'/'+total+'</span>';
        html += '</div>';
        html += '<div style="height:6px;background:var(--border2);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+(pct===100?'var(--green)':'#7c3aed')+';border-radius:3px"></div></div>';
        html += '<div style="font-size:10px;color:var(--text3);margin-top:4px">'+pct+'% completado</div>';
        html += '</div>';
      });
    }
    if (state.showValImport) {
      html += '<div style="position:fixed;inset:0;background:#00000088;z-index:300;display:flex;align-items:flex-end">';
      html += '<div style="background:var(--white);border-radius:20px 20px 0 0;width:100%;padding:20px;font-family:var(--font);max-height:90vh;overflow-y:auto">';
      html += '<div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">Nueva campaña de validación</div>';
      html += '<div style="font-size:12px;color:var(--text3);margin-bottom:14px">Sube el Excel con los usuarios a validar</div>';
      html += '<div style="margin-bottom:12px"><div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">NOMBRE DE LA CAMPAÑA</div>';
      html += '<input id="val-nombre" type="text" placeholder="Ej: Campaña Abril 2026" style="width:100%;padding:11px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:14px;outline:none"></div>';

      html += '<div style="margin-bottom:16px"><div style="font-size:11px;font-weight:700;color:var(--text3);margin-bottom:6px">ARCHIVO EXCEL</div>';
      html += '<label style="display:block;padding:14px;border:2px dashed var(--border);border-radius:10px;text-align:center;cursor:pointer;color:var(--text3);font-size:13px">📂 Seleccionar archivo Excel<input type="file" accept=".xlsx,.xls" onchange="procesarExcelVal(this)" style="display:none"></label></div>';
      if (state.valImportData.length > 0) {
        html += '<div style="background:var(--green-light);border:1px solid var(--green);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:var(--green);font-weight:600">✅ '+state.valImportData.length+' usuarios cargados</div>';
        html += '<button onclick="confirmarNuevaValidacion()" style="width:100%;padding:13px;border:none;border-radius:10px;background:#7c3aed;color:#fff;font-family:var(--font);font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px">Crear campaña</button>';
      }
      html += '<button onclick="cerrarValImport()" style="width:100%;padding:12px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--text3);font-family:var(--font);font-size:14px;cursor:pointer">Cancelar</button>';
      html += '</div></div>';
    }
  } else if (state.valView === 'detalle' && state.valCampanaId) {
    const camp = state.validaciones.find(v => v.id === state.valCampanaId);
    if (!camp) { state.valView = 'lista'; }
    else {
      const usrs = camp.usuarios || [];
      const valCount = usrs.filter(u => u.estado === 'validado').length;
      const pct2 = usrs.length > 0 ? Math.round(valCount/usrs.length*100) : 0;
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">';
      html += '<button onclick="setValView(\'lista\')" style="background:var(--primary-light);border:1px solid var(--primary);color:var(--primary);border-radius:8px;padding:6px 12px;font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">← Volver</button>';
      html += '<div style="font-size:15px;font-weight:800;color:var(--text)">'+camp.nombre+'</div>';
      html += '</div>';
      html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px">';
      html += '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:12px;font-weight:700;color:var(--text)">Progreso</span><span style="font-size:12px;font-weight:800;color:#7c3aed">'+valCount+' / '+usrs.length+'</span></div>';
      html += '<div style="height:8px;background:var(--border2);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+pct2+'%;background:'+(pct2===100?'var(--green)':'#7c3aed')+';border-radius:4px"></div></div>';
      html += '</div>';
      if (valCount > 0) {
        html += '<button onclick="exportarValidaciones(this.dataset.id)" data-id="'+camp.id+'" style="width:100%;padding:11px;border:1px solid var(--green);border-radius:10px;background:var(--green-light);color:var(--green);font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer;margin-bottom:12px">📊 Exportar Excel de respaldo</button>';
      }
      html += '<div style="display:flex;flex-direction:column;gap:8px">';
      usrs.forEach((u, idx) => {
        const ok = u.estado === 'validado';
        html += '<div onclick="abrirFormVal(this.dataset.idx)" data-idx="'+idx+'" style="background:var(--white);border:1px solid var(--border);border-left:4px solid '+(ok?'var(--green)':'var(--border2)')+';border-radius:10px;padding:12px 14px;cursor:pointer">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
        html += '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:var(--text);font-family:var(--mono)">'+(u.siget||'—')+'</div>';
        html += '<div style="font-size:11px;color:var(--text2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(u.nombre||'—')+'</div>';
        html += '<div style="font-size:10px;color:var(--text3);margin-top:2px">'+(u.ct||'—')+' · '+(u.medidor||'—')+'</div></div>';
        if (ok) {
          html += '<div style="text-align:right;flex-shrink:0;margin-left:8px"><span style="background:var(--green-light);color:var(--green);font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px">✅ Validado</span>';
          if (u.resultado) html += '<div style="font-size:10px;color:var(--text3);margin-top:4px">TAP '+u.resultado.tap+' · '+u.resultado.multiplicador+'</div>';
          if (u.fechaValidacion) html += '<div style="font-size:9px;color:var(--text3);margin-top:2px">'+u.fechaValidacion+(u.validadoPor?' · '+u.validadoPor:'')+'</div>';
          html += '</div>';
        } else {
          html += '<span style="background:var(--yellow-light);color:var(--yellow);font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;flex-shrink:0;margin-left:8px">⏳ Pendiente</span>';
        }
        html += '</div></div>';
      });
      html += '</div>';
    }
  } else if (state.valView === 'form' && state.valCampanaId !== null && state.valUsuarioIdx !== null) {
    const camp2 = state.validaciones.find(v => v.id === state.valCampanaId);
    const u2 = camp2?.usuarios?.[state.valUsuarioIdx];
    if (!camp2 || !u2) { state.valView = 'detalle'; }
    else {
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">';
      html += '<button onclick="setValView(\'detalle\')" style="background:var(--primary-light);border:1px solid var(--primary);color:var(--primary);border-radius:8px;padding:6px 12px;font-family:var(--font);font-size:12px;font-weight:700;cursor:pointer">← Volver</button>';
      html += '<div style="font-size:14px;font-weight:800;color:var(--text)">Validación de TAP</div>';
      html += '</div>';
      html += '<div style="background:#f3f0ff;border:1px solid #ddd6fe;border-radius:12px;padding:14px;margin-bottom:14px">';
      html += '<div style="font-size:10px;font-weight:700;color:#7c3aed;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Usuario campaña</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
      [['SIGET',u2.siget||'—'],['NC',u2.nc||'—'],['Nombre',u2.nombre||'—'],['CT/DS',u2.ct||'—'],['Medidor',u2.medidor||'—'],['Alimentador',u2.alimentador||'—']].forEach(([lbl,val]) => {
        html += '<div><div style="font-size:9px;color:#7c3aed;font-weight:600;text-transform:uppercase">'+lbl+'</div><div style="font-size:12px;font-weight:700;color:var(--text)">'+val+'</div></div>';
      });
      if (u2.direccion) html += '<div style="grid-column:1/-1"><div style="font-size:9px;color:#7c3aed;font-weight:600;text-transform:uppercase">Dirección</div><div style="font-size:11px;color:var(--text2)">'+u2.direccion+'</div></div>';
      html += '</div></div>';
      // ── TIPO DE CONEXIÓN selector per usuario ──
      html += '<div style="margin-bottom:14px"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Tipo de conexión</div>';
      html += '<div style="display:flex;gap:8px">';
      [{t:'monofasico',l:'Monofásico'},{t:'bifasico',l:'Bifásico'},{t:'trifasico',l:'Trifásico'}].forEach(x => {
        html += '<div onclick="setValTipoUsuario(this.dataset.t)" data-t="'+x.t+'" style="flex:1;padding:10px;border-radius:10px;border:2px solid '+(state.valTipoUsuario===x.t?'#7c3aed':'var(--border)')+';background:'+(state.valTipoUsuario===x.t?'#f3f0ff':'#fff')+';text-align:center;cursor:pointer;font-size:12px;font-weight:700;color:'+(state.valTipoUsuario===x.t?'#7c3aed':'var(--text3)')+'">'+x.l+'</div>';
      });
      html += '</div></div>';
      if (state.valTipoUsuario === 'monofasico') {
        html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">';
        html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Usuario de referencia</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">CT/DS referencia</div><input id="vf-ref-ct" type="text" placeholder="Ej: DS110465" value="'+(state.valForm.refCt||'')+'" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;outline:none"></div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Medidor referencia</div><input id="vf-ref-med" type="text" placeholder="Número medidor" value="'+(state.valForm.refMed||'')+'" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:13px;outline:none"></div>';
        html += '</div></div>';
        html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">';
        html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Transformador de referencia</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
        // Volt Primario selector
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Volt. Primario (V)</div><select id="vf-ref-vp" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;background:var(--white);color:var(--text);outline:none"><option value="">Seleccionar...</option><option value="13200" '+(state.valForm.refVP==13200?'selected':'')+'>13200 V</option><option value="7620" '+(state.valForm.refVP==7620?'selected':'')+'>7620 V</option><option value="2400" '+(state.valForm.refVP==2400?'selected':'')+'>2400 V</option></select></div>';
        // Volt Secundario selector
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Volt. Secundario (V)</div><select id="vf-ref-vs" onchange="valVSOtro(this)" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;background:var(--white);color:var(--text);outline:none"><option value="">Seleccionar...</option><option value="120" '+(state.valForm.refVS==120?'selected':'')+'>120 V</option><option value="208" '+(state.valForm.refVS==208?'selected':'')+'>208 V</option><option value="240" '+(state.valForm.refVS==240?'selected':'')+'>240 V</option><option value="480" '+(state.valForm.refVS==480?'selected':'')+'>480 V</option><option value="otro" '+(state.valForm.refVS==='otro'?'selected':'')+'>Otro...</option></select>'+'<input id="vf-ref-vs-otro" type="number" step="0.1" placeholder="Voltaje en V" oninput="valVSOtroVal(this)" value="'+(state.valForm.refVSOtro||'')+'" style="width:100%;padding:9px;border:1.5px solid #7c3aed;border-radius:8px;font-family:var(--mono);font-size:13px;outline:none;margin-top:4px'+(state.valForm.refVS==='otro'?'':';display:none')+'">'+'</div>';
        // Lectura + TAP
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Lectura instantánea (V)</div><input id="vf-ref-lec" type="number" step="0.1" placeholder="Ej: 236" value="'+(state.valForm.refLec||'')+'" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;outline:none"></div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">TAP visible</div><select id="vf-ref-tap" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;background:var(--white);color:var(--text);outline:none"><option value="">TAP...</option>'+ [1,2,3,4,5].map(t=>'<option value="'+t+'" '+(state.valForm.refTap==t?'selected':'')+'>TAP '+t+'</option>').join('') +'</select></div>';
        html += '</div></div>';
        html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px">';
        html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Transformador campaña (con tapón)</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">';
        // CP Volt Secundario
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Volt. Secundario (V)</div><select id="vf-cp-vs" onchange="valVSOtro(this)" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;background:var(--white);color:var(--text);outline:none"><option value="">Seleccionar...</option><option value="120" '+(state.valForm.cpVS==120?'selected':'')+'>120 V</option><option value="208" '+(state.valForm.cpVS==208?'selected':'')+'>208 V</option><option value="240" '+(state.valForm.cpVS==240?'selected':'')+'>240 V</option><option value="480" '+(state.valForm.cpVS==480?'selected':'')+'>480 V</option><option value="otro" '+(state.valForm.cpVS==='otro'?'selected':'')+'>Otro...</option></select>'+'<input id="vf-cp-vs-otro" type="number" step="0.1" placeholder="Voltaje en V" oninput="valVSOtroVal(this)" value="'+(state.valForm.cpVSOtro||'')+'" style="width:100%;padding:9px;border:1.5px solid #7c3aed;border-radius:8px;font-family:var(--mono);font-size:13px;outline:none;margin-top:4px'+(state.valForm.cpVS==='otro'?'':';display:none')+'">'+'</div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Lectura instantánea (V)</div><input id="vf-cp-lec" type="number" step="0.1" placeholder="Ej: 247" value="'+(state.valForm.cpLec||'')+'" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;outline:none"></div>';
        html += '</div>';
        // Volt primario CP + TAPs nominales
        const TAPS_NOM = {'13200':'14400,13800,13200,12870,12540','7620':'8001,7810,7620,7430,7240','2400':'2520,2460,2400,2340,2280'};
        html += '<div style="margin-bottom:8px"><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Volt. Primario trafo campaña (V)</div><select id="vf-cp-vp" onchange="autoFillTaps()" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;background:var(--white);color:var(--text);outline:none"><option value="">Seleccionar para auto-llenar TAPs...</option><option value="13200" '+(state.valForm.cpVP==13200?'selected':'')+'>13200 V</option><option value="7620" '+(state.valForm.cpVP==7620?'selected':'')+'>7620 V</option><option value="2400" '+(state.valForm.cpVP==2400?'selected':'')+'>2400 V</option></select></div>';
        html += '<div style="font-size:10px;color:var(--text3);margin-bottom:4px">TAPs de la placa (volt. primario por TAP, separados por coma)</div>';
        html += '<input id="vf-taps" type="text" placeholder="Ej: 14400,13800,13200,12870,12540" value="'+(state.valForm.taps||'')+'" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;outline:none">';
        html += '</div>';
        html += '<button onclick="calcularValidacion()" style="width:100%;padding:13px;border:none;border-radius:10px;background:#7c3aed;color:#fff;font-family:var(--font);font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px">🔌 Calcular TAP estimado</button>';
        if (state.valForm.resultado) {
          const res = state.valForm.resultado;
          html += '<div style="background:#f3f0ff;border:2px solid #7c3aed;border-radius:12px;padding:16px;margin-bottom:12px">';
          html += '<div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;margin-bottom:12px">Resultado</div>';
          html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">';
          html += '<div style="text-align:center"><div style="font-size:28px;font-weight:800;color:#7c3aed;font-family:var(--mono)">TAP '+res.tap+'</div><div style="font-size:10px;color:var(--text3);font-weight:600">TAP ESTIMADO</div></div>';
          html += '<div style="text-align:center"><div style="font-size:18px;font-weight:800;color:var(--text);font-family:var(--mono)">'+res.multiplicador+'</div><div style="font-size:10px;color:var(--text3);font-weight:600">MULTIPLICADOR</div></div>';
          html += '</div>';
          html += '<div style="font-size:11px;color:var(--text2);margin-bottom:10px">Prim. proyectado: <b>'+res.primarioProyectado.toFixed(1)+' V</b> · Relación calc.: <b>'+res.relacionCalc.toFixed(4)+'</b></div>';
          html += '<button onclick="guardarValidacion()" style="width:100%;padding:11px;border:none;border-radius:10px;background:#7c3aed;color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">✅ Guardar validación</button>';
          html += '</div>';
        }
      } else if (state.valTipoUsuario === 'bifasico') {
        // ── BIFÁSICO ──
        const bVP = '<option value="">Seleccionar...</option>'
          + '<option value="13200" '+(state.valForm.refVP==13200?'selected':'')+'>13,200 V</option>'
          + '<option value="7620"  '+(state.valForm.refVP==7620 ?'selected':'')+'>7,620 V</option>'
          + '<option value="2400"  '+(state.valForm.refVP==2400 ?'selected':'')+'>2,400 V</option>';
        const bVS = vs => '<option value="">(Seleccionar...)</option>'
          + '<option value="208" '+(state.valForm[vs]==208?'selected':'')+'>208 V</option>'
          + '<option value="240" '+(state.valForm[vs]==240?'selected':'')+'>240 V</option>'
          + '<option value="480" '+(state.valForm[vs]==480?'selected':'')+'>480 V</option>'
          + '<option value="otro" '+(state.valForm[vs]==='otro'?'selected':'')+'>Otro...</option>';
        const bTap = '<option value="">TAP...</option>'
          + [1,2,3,4,5].map(t=>'<option value="'+t+'" '+(state.valForm.refTap==t?'selected':'')+'>TAP '+t+'</option>').join('');
        const sel = (id,opts) => '<select id="'+id+'" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;background:var(--white);outline:none">'+opts+'</select>';
        const inp = (id,val,ph) => '<input id="'+id+'" type="number" step="0.1" placeholder="'+ph+'" value="'+(val||'')+'" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;outline:none">';

        html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">';
        html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:10px">Transformador de referencia (bifásico)</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">CT/DS referencia</div><input id="vf-ref-ct" type="text" value="'+(state.valForm.refCt||'')+'" placeholder="DS110465" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;outline:none"></div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Medidor referencia</div><input id="vf-ref-med" type="text" value="'+(state.valForm.refMed||'')+'" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:13px;outline:none"></div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Volt. Primario</div>'+sel('vf-ref-vp',bVP)+'</div>';
        html += '<div style="grid-column:1/-1"><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Volt. Secundario ref.</div><select id="vf-ref-vs" onchange="valVSOtro(this)" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;background:var(--white);outline:none">'+bVS('refVS')+'</select>'+'<input id="vf-ref-vs-otro" type="number" step="0.1" placeholder="Voltaje en V" oninput="valVSOtroVal(this)" value="'+(state.valForm.refVSOtro||'')+'" style="width:100%;padding:9px;border:1.5px solid #7c3aed;border-radius:8px;font-family:var(--mono);font-size:13px;outline:none;margin-top:4px'+(state.valForm.refVS==='otro'?'':';display:none')+'">'+'</div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Lectura Vab ref (V)</div>'+inp('vf-ref-lec1',state.valForm.refLec1,'Ej: 236')+'</div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Lectura Vbc ref (V)</div>'+inp('vf-ref-lec2',state.valForm.refLec2,'Ej: 238')+'</div>';
        html += '<div style="grid-column:1/-1"><div style="font-size:10px;color:var(--text3);margin-bottom:4px">TAP visible</div>'+sel('vf-ref-tap',bTap)+'</div>';
        html += '</div></div>';

        html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px">';
        html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:10px">Transformador campaña (bifásico)</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
        html += '<div style="grid-column:1/-1"><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Volt. Secundario campaña</div><select id="vf-cp-vs" onchange="valVSOtro(this)" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;background:var(--white);outline:none">'+bVS('cpVS')+'</select>'+'<input id="vf-cp-vs-otro" type="number" step="0.1" placeholder="Voltaje en V" oninput="valVSOtroVal(this)" value="'+(state.valForm.cpVSOtro||'')+'" style="width:100%;padding:9px;border:1.5px solid #7c3aed;border-radius:8px;font-family:var(--mono);font-size:13px;outline:none;margin-top:4px'+(state.valForm.cpVS==='otro'?'':';display:none')+'">'+'</div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Volt. Primario campaña</div><select id="vf-cp-vp" onchange="autoFillTaps()" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;background:var(--white);outline:none">'+bVP+'</select></div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Lectura Vab campaña (V)</div>'+inp('vf-cp-lec1',state.valForm.cpLec1,'Ej: 247')+'</div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Lectura Vbc campaña (V)</div>'+inp('vf-cp-lec2',state.valForm.cpLec2,'Ej: 245')+'</div>';
        html += '</div>';
        html += '<div style="margin-top:8px"><div style="font-size:10px;color:var(--text3);margin-bottom:4px">TAPs de la placa (separados por coma)</div>';
        html += '<input id="vf-taps" type="text" placeholder="Ej: 14400,13800,13200,12870,12540" value="'+(state.valForm.taps||'')+'" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;outline:none"></div>';
        html += '</div>';

        html += '<button onclick="calcularValidacion()" style="width:100%;padding:13px;border:none;border-radius:10px;background:#7c3aed;color:#fff;font-family:var(--font);font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px">🔌 Calcular TAP estimado</button>';
        if (state.valForm.resultado) {
          const res = state.valForm.resultado;
          html += '<div style="background:#f3f0ff;border:2px solid #7c3aed;border-radius:12px;padding:16px;margin-bottom:12px">';
          html += '<div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;margin-bottom:12px">Resultado</div>';
          html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">';
          html += '<div style="text-align:center"><div style="font-size:28px;font-weight:800;color:#7c3aed;font-family:var(--mono)">TAP '+res.tap+'</div><div style="font-size:10px;color:var(--text3);font-weight:600">TAP ESTIMADO</div></div>';
          html += '<div style="text-align:center"><div style="font-size:18px;font-weight:800;color:var(--text);font-family:var(--mono)">'+res.multiplicador+'</div><div style="font-size:10px;color:var(--text3);font-weight:600">MULTIPLICADOR</div></div>';
          html += '</div>';
          html += '<div style="font-size:11px;color:var(--text2);margin-bottom:10px">Relación prom. calculada: <b>'+res.relacionCalc.toFixed(4)+'</b></div>';
          html += '<button onclick="guardarValidacion()" style="width:100%;padding:11px;border:none;border-radius:10px;background:#7c3aed;color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">✅ Guardar validación</button>';
          html += '</div>';
        }

      } else if (state.valTipoUsuario === 'trifasico') {
        // ── TRIFÁSICO: VP = 23000/13200/4160, TAPs * √3 ──
        const tVP = '<option value="">Seleccionar...</option>'
          + '<option value="23000" '+(state.valForm.refVP==23000?'selected':'')+'>23,000 V</option>'
          + '<option value="13200" '+(state.valForm.refVP==13200?'selected':'')+'>13,200 V</option>'
          + '<option value="4160"  '+(state.valForm.refVP==4160 ?'selected':'')+'>4,160 V</option>';
        const tVS = vs => '<option value="">(Seleccionar...)</option>'
          + '<option value="208" '+(state.valForm[vs]==208?'selected':'')+'>208 V</option>'
          + '<option value="240" '+(state.valForm[vs]==240?'selected':'')+'>240 V</option>'
          + '<option value="480" '+(state.valForm[vs]==480?'selected':'')+'>480 V</option>'
          + '<option value="otro" '+(state.valForm[vs]==='otro'?'selected':'')+'>Otro...</option>';
        const tTap = '<option value="">TAP...</option>'
          + [1,2,3,4,5].map(t=>'<option value="'+t+'" '+(state.valForm.refTap==t?'selected':'')+'>TAP '+t+'</option>').join('');
        const tSel = (id,opts) => '<select id="'+id+'" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;background:var(--white);outline:none">'+opts+'</select>';
        const tInp = (id,val,ph) => '<input id="'+id+'" type="number" step="0.1" placeholder="'+ph+'" value="'+(val||'')+'" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;outline:none">';

        html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">';
        html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:10px">Transformador de referencia (trifásico)</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">CT/DS referencia</div><input id="vf-ref-ct" type="text" value="'+(state.valForm.refCt||'')+'" placeholder="DS110465" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;outline:none"></div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Medidor referencia</div><input id="vf-ref-med" type="text" value="'+(state.valForm.refMed||'')+'" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:13px;outline:none"></div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Volt. Primario</div>'+tSel('vf-ref-vp',tVP)+'</div>';
        html += '<div style="grid-column:1/-1"><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Volt. Secundario ref.</div><select id="vf-ref-vs" onchange="valVSOtro(this)" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;background:var(--white);outline:none">'+tVS('refVS')+'</select>'+'<input id="vf-ref-vs-otro" type="number" step="0.1" placeholder="Voltaje en V" oninput="valVSOtroVal(this)" value="'+(state.valForm.refVSOtro||'')+'" style="width:100%;padding:9px;border:1.5px solid #7c3aed;border-radius:8px;font-family:var(--mono);font-size:13px;outline:none;margin-top:4px'+(state.valForm.refVS==='otro'?'':';display:none')+'">'+'</div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Lectura Vab ref (V)</div>'+tInp('vf-ref-lec1',state.valForm.refLec1,'Ej: 236')+'</div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Lectura Vbc ref (V)</div>'+tInp('vf-ref-lec2',state.valForm.refLec2,'Ej: 238')+'</div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Lectura Vca ref (V)</div>'+tInp('vf-ref-lec3',state.valForm.refLec3,'Ej: 237')+'</div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">TAP visible</div>'+tSel('vf-ref-tap',tTap)+'</div>';
        html += '</div></div>';

        html += '<div style="background:var(--white);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px">';
        html += '<div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:10px">Transformador campaña (trifásico)</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
        html += '<div style="grid-column:1/-1"><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Volt. Secundario campaña</div><select id="vf-cp-vs" onchange="valVSOtro(this)" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;background:var(--white);outline:none">'+tVS('cpVS')+'</select>'+'<input id="vf-cp-vs-otro" type="number" step="0.1" placeholder="Voltaje en V" oninput="valVSOtroVal(this)" value="'+(state.valForm.cpVSOtro||'')+'" style="width:100%;padding:9px;border:1.5px solid #7c3aed;border-radius:8px;font-family:var(--mono);font-size:13px;outline:none;margin-top:4px'+(state.valForm.cpVS==='otro'?'':';display:none')+'">'+'</div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Volt. Primario campaña</div><select id="vf-cp-vp" onchange="autoFillTapsTri()" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;background:var(--white);outline:none">'+tVP+'</select></div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Lectura Vab campaña (V)</div>'+tInp('vf-cp-lec1',state.valForm.cpLec1,'Ej: 247')+'</div>';
        html += '<div><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Lectura Vbc campaña (V)</div>'+tInp('vf-cp-lec2',state.valForm.cpLec2,'Ej: 245')+'</div>';
        html += '<div style="grid-column:1/-1"><div style="font-size:10px;color:var(--text3);margin-bottom:4px">Lectura Vca campaña (V)</div>'+tInp('vf-cp-lec3',state.valForm.cpLec3,'Ej: 246')+'</div>';
        html += '</div>';
        html += '<div style="margin-top:8px"><div style="font-size:10px;color:var(--text3);margin-bottom:4px">TAPs de la placa — valores ×√3 (separados por coma)</div>';
        html += '<input id="vf-taps" type="text" placeholder="Ej: 24940,23900,22900,22290,21755" value="'+(state.valForm.taps||'')+'" style="width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--mono);font-size:13px;outline:none"></div>';
        html += '</div>';

        html += '<button onclick="calcularValidacion()" style="width:100%;padding:13px;border:none;border-radius:10px;background:#7c3aed;color:#fff;font-family:var(--font);font-size:14px;font-weight:700;cursor:pointer;margin-bottom:10px">🔌 Calcular TAP estimado</button>';
        if (state.valForm.resultado) {
          const res = state.valForm.resultado;
          html += '<div style="background:#f3f0ff;border:2px solid #7c3aed;border-radius:12px;padding:16px;margin-bottom:12px">';
          html += '<div style="font-size:11px;font-weight:700;color:#7c3aed;text-transform:uppercase;margin-bottom:12px">Resultado</div>';
          html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">';
          html += '<div style="text-align:center"><div style="font-size:28px;font-weight:800;color:#7c3aed;font-family:var(--mono)">TAP '+res.tap+'</div><div style="font-size:10px;color:var(--text3);font-weight:600">TAP ESTIMADO</div></div>';
          html += '<div style="text-align:center"><div style="font-size:18px;font-weight:800;color:var(--text);font-family:var(--mono)">'+res.multiplicador+'</div><div style="font-size:10px;color:var(--text3);font-weight:600">MULTIPLICADOR</div></div>';
          html += '</div>';
          html += '<div style="font-size:11px;color:var(--text2);margin-bottom:10px">Relación prom. calculada: <b>'+res.relacionCalc.toFixed(4)+'</b></div>';
          html += '<button onclick="guardarValidacion()" style="width:100%;padding:11px;border:none;border-radius:10px;background:#7c3aed;color:#fff;font-family:var(--font);font-size:13px;font-weight:700;cursor:pointer">✅ Guardar validación</button>';
          html += '</div>';
        }
      }
    }
  }
  html += '</div>';
  return html;
}
