// Modales (retiro, descarga, importar, mantenimiento, condición, préstamo, selector, búsqueda, alerta)
import { AREAS, CONDICIONES, SEDES, userArea } from '../config.js';
import { state } from '../state.js';
import { badgeSt } from '../ui.js';
import { areaToSede, calcSt, daysUntil, eqSt } from '../utils.js';

export function renderRetiroModal() {
  let html = '';
  const FAULT_TYPES = ['Conector con falso','Falla batería (solo enciende energizado)','LED intermitente','No agarra WiFi','Tapadera no cierra'];
  const FAULT_GRAVES = ['No enciende / Sin señales de vida','Equipo calcinado / Explosión'];
  const allOpts = ['Sin problemas', ...FAULT_TYPES];
  html += `<div style="position:fixed;inset:0;background:#00000066;z-index:200;display:flex;align-items:flex-end">
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-height:90vh;overflow-y:auto;padding:20px;font-family:'DM Sans',sans-serif">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:17px;font-weight:700;color:#1a1d27">Registrar retiro</div>
          <button onclick="closeRetiroModal()" style="background:none;border:none;font-size:24px;color:#9ca3af;cursor:pointer;line-height:1">✕</button>
        </div>
        <div style="font-size:13px;color:#6b7280;margin-bottom:14px">¿El equipo presentó algún problema?</div>

        <div onclick="toggleSinProblema()" style="padding:13px 16px;border:2px solid ${state.retiroForm.sinProblema ? '#3b6cf4' : '#e5e7eb'};border-radius:12px;margin-bottom:8px;cursor:pointer;font-size:15px;font-weight:600;color:${state.retiroForm.sinProblema ? '#3b6cf4' : '#374151'};background:${state.retiroForm.sinProblema ? '#eef2ff' : '#fff'};display:flex;align-items:center;gap:10px">
          <span style="font-size:18px">${state.retiroForm.sinProblema ? '✅' : '⬜'}</span> Sin problemas
        </div>

        ${FAULT_TYPES.map(f => `
        <div onclick="toggleFalla('${f}')" style="padding:13px 16px;border:2px solid ${state.retiroForm.fallas.includes(f) ? '#ef4444' : '#e5e7eb'};border-radius:12px;margin-bottom:8px;cursor:pointer;font-size:15px;font-weight:600;color:${state.retiroForm.fallas.includes(f) ? '#ef4444' : '#374151'};background:${state.retiroForm.fallas.includes(f) ? '#fef2f2' : '#fff'};display:flex;align-items:center;gap:10px">
          <span style="font-size:18px">${state.retiroForm.fallas.includes(f) ? '🔴' : '⬜'}</span> ${f}
        </div>`).join('')}
        <div style="font-size:11px;font-weight:700;color:var(--red);letter-spacing:1px;text-transform:uppercase;margin:12px 0 8px;padding-top:8px;border-top:1px solid #fecaca">⚠ Fallas graves — marcan equipo como Fuera de servicio</div>
        ${FAULT_GRAVES.map(f => `
        <div onclick="toggleFalla('${f}')" style="padding:13px 16px;border:2px solid ${state.retiroForm.fallas.includes(f) ? '#991b1b' : '#e5e7eb'};border-radius:12px;margin-bottom:8px;cursor:pointer;font-size:15px;font-weight:600;color:${state.retiroForm.fallas.includes(f) ? '#991b1b' : '#374151'};background:${state.retiroForm.fallas.includes(f) ? '#fee2e2' : '#fff'};display:flex;align-items:center;gap:10px">
          <span style="font-size:18px">${state.retiroForm.fallas.includes(f) ? '💀' : '⬜'}</span> ${f}
        </div>`).join('')}

        <div style="margin-top:8px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:6px">DESCRIPCIÓN ADICIONAL (OPCIONAL)</div>
          <textarea placeholder="Describe el problema..." oninput="setRetiroDesc(this.value)" style="width:100%;padding:12px;border:1.5px solid #e5e7eb;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:14px;outline:none;min-height:70px;resize:vertical">${state.retiroForm.descripcion}</textarea>
        </div>

        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:8px">¿YA DESCARGASTE LA MEDICIÓN?</div>
          <div style="display:flex;gap:8px">
            <div onclick="setRetiroDescarga(true)" style="flex:1;padding:11px;border-radius:10px;border:2px solid ${state.retiroForm.descargaConfirmada===true?'var(--green)':'#e5e7eb'};background:${state.retiroForm.descargaConfirmada===true?'var(--green-light)':'#fff'};text-align:center;cursor:pointer;font-size:13px;font-weight:700;color:${state.retiroForm.descargaConfirmada===true?'var(--green)':'#6b7280'}">✅ Sí, ya descargué</div>
            <div onclick="setRetiroDescarga(false)" style="flex:1;padding:11px;border-radius:10px;border:2px solid ${state.retiroForm.descargaConfirmada===false?'var(--red)':'#e5e7eb'};background:${state.retiroForm.descargaConfirmada===false?'var(--red-light)':'#fff'};text-align:center;cursor:pointer;font-size:13px;font-weight:700;color:${state.retiroForm.descargaConfirmada===false?'var(--red)':'#6b7280'}">⚠️ No descargué</div>
          </div>
          ${state.retiroForm.descargaConfirmada===false?'<div style="margin-top:8px;padding:8px 12px;background:var(--red-light);border-radius:8px;font-size:12px;color:var(--red);font-weight:600">⚠️ El equipo quedará marcado con descarga pendiente</div>':''}
        </div>
        <div style="margin-bottom:12px">
          ${(()=>{
          const recR = state.records.find(x => x.id === state.retiroId);
          if (!recR || (recR.areaInstalacion||'CPT MT') === 'Campos y Servicios') return '';
          let eHtml = '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:8px">LECTURAS DE ENERGÍA (RETIRO)</div>';
          eHtml += '<div style="display:flex;gap:6px;margin-bottom:10px">';
          ['ninguna','una','tres'].forEach(t => {
            const sel = state.retiroForm.energiaTipo === t;
            const lbl = t==='ninguna'?'Sin lectura':t==='una'?'Una lectura':'P / R / V';
            eHtml += '<div onclick="setRetiroEnergia(\''+t+'\')" style="flex:1;padding:8px 4px;border-radius:8px;border:2px solid '+(sel?'#3b6cf4':'#e5e7eb')+';background:'+(sel?'#eef2ff':'#fff')+';text-align:center;cursor:pointer;font-size:11px;font-weight:700;color:'+(sel?'#3b6cf4':'#6b7280')+'">'+lbl+'</div>';
          });
          eHtml += '</div>';
          if (state.retiroForm.energiaTipo==='una') eHtml += '<input type="number" placeholder="Energía (kWh)" value="'+state.retiroForm.energiaUna+'" oninput="setRetiroEnergiaVal(\'una\',this.value)" style="width:100%;padding:10px;border:1.5px solid #e5e7eb;border-radius:8px;font-family:var(--font);font-size:14px;margin-bottom:8px;box-sizing:border-box">';
          if (state.retiroForm.energiaTipo==='tres') {
            eHtml += '<div style="display:flex;gap:8px;margin-bottom:8px">';
            [['Punta','punta'],['Resto','resto'],['Valle','valle']].forEach(([l,k]) => {
              eHtml += '<div style="flex:1"><div style="font-size:10px;font-weight:600;color:#6b7280;margin-bottom:4px">'+l.toUpperCase()+'</div><input type="number" placeholder="kWh" value="'+(state.retiroForm['energia'+l]||'')+'" oninput="setRetiroEnergiaVal(\''+k+'\',this.value)" style="width:100%;padding:8px;border:1.5px solid #e5e7eb;border-radius:8px;font-family:var(--font);font-size:13px;box-sizing:border-box"></div>';
            });
            eHtml += '</div>';
          }
          eHtml += '</div>';
          return eHtml;
        })()}
          <div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:6px">¿A QUÉ SEDE REGRESA EL EQUIPO?</div>
          <div style="display:flex;gap:8px">
            ${SEDES.map(s => `<button onclick="setRetiroSede('${s}')" style="flex:1;padding:10px 8px;border-radius:10px;border:2px solid ${state.retiroForm.sede===s?'#3b6cf4':'#e5e7eb'};background:${state.retiroForm.sede===s?'#eef2ff':'#fff'};color:${state.retiroForm.sede===s?'#3b6cf4':'#6b7280'};font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer">${s}</button>`).join('')}
          </div>
        </div>
        <button onclick="doRetiro()" style="width:100%;background:#3b6cf4;color:#fff;border:none;border-radius:10px;padding:14px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:15px;cursor:pointer;margin-bottom:8px">Confirmar retiro</button>
        <button onclick="closeRetiroModal()" style="width:100%;background:#fff;color:#6b7280;border:1px solid #e5e7eb;border-radius:10px;padding:13px;font-family:'DM Sans',sans-serif;font-size:15px;cursor:pointer">Cancelar</button>
      </div>
    </div>`;
  return html;
}

export function renderDescargaModal() {
  let html = '';
  html += '<div style="position:fixed;inset:0;background:#00000066;z-index:200;display:flex;align-items:flex-end">';
  html += '<div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-height:90vh;overflow-y:auto;padding:20px;font-family:var(--font)">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div style="font-size:17px;font-weight:700;color:var(--text)">💾 Registrar descarga</div><button onclick="closeDescargaModal()" style="background:none;border:none;font-size:24px;color:var(--text3);cursor:pointer">✕</button></div>';
  html += '<div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px">¿QUIÉN REALIZÓ LA DESCARGA?</div>';
  html += '<div onclick="setDescargaTecnico(\'David García\')" style="padding:10px 14px;border:2px solid '+(state.descargaForm.tecnico==='David García'?'var(--primary)':'var(--border)')+';border-radius:10px;margin-bottom:6px;cursor:pointer;font-size:14px;font-weight:600;color:'+(state.descargaForm.tecnico==='David García'?'var(--primary)':'var(--text2)')+';background:'+(state.descargaForm.tecnico==='David García'?'var(--primary-light)':'#fff')+';display:flex;align-items:center;gap:8px"><span>'+(state.descargaForm.tecnico==='David García'?'✅':'⬜')+'</span> David García</div>';
  html += '<div onclick="setDescargaTecnico(\'Bryan Francia\')" style="padding:10px 14px;border:2px solid '+(state.descargaForm.tecnico==='Bryan Francia'?'var(--primary)':'var(--border)')+';border-radius:10px;margin-bottom:6px;cursor:pointer;font-size:14px;font-weight:600;color:'+(state.descargaForm.tecnico==='Bryan Francia'?'var(--primary)':'var(--text2)')+';background:'+(state.descargaForm.tecnico==='Bryan Francia'?'var(--primary-light)':'#fff')+';display:flex;align-items:center;gap:8px"><span>'+(state.descargaForm.tecnico==='Bryan Francia'?'✅':'⬜')+'</span> Bryan Francia</div>';
  html += '<div onclick="setDescargaTecnico(\'Francisco Chulo\')" style="padding:10px 14px;border:2px solid '+(state.descargaForm.tecnico==='Francisco Chulo'?'var(--primary)':'var(--border)')+';border-radius:10px;margin-bottom:6px;cursor:pointer;font-size:14px;font-weight:600;color:'+(state.descargaForm.tecnico==='Francisco Chulo'?'var(--primary)':'var(--text2)')+';background:'+(state.descargaForm.tecnico==='Francisco Chulo'?'var(--primary-light)':'#fff')+';display:flex;align-items:center;gap:8px"><span>'+(state.descargaForm.tecnico==='Francisco Chulo'?'✅':'⬜')+'</span> Francisco Chulo</div>';
  html += '<div onclick="setDescargaTecnico(\'Vicente Ramos\')" style="padding:10px 14px;border:2px solid '+(state.descargaForm.tecnico==='Vicente Ramos'?'var(--primary)':'var(--border)')+';border-radius:10px;margin-bottom:6px;cursor:pointer;font-size:14px;font-weight:600;color:'+(state.descargaForm.tecnico==='Vicente Ramos'?'var(--primary)':'var(--text2)')+';background:'+(state.descargaForm.tecnico==='Vicente Ramos'?'var(--primary-light)':'#fff')+';display:flex;align-items:center;gap:8px"><span>'+(state.descargaForm.tecnico==='Vicente Ramos'?'✅':'⬜')+'</span> Vicente Ramos</div>';
  html += '<div style="margin:14px 0 8px;font-size:12px;font-weight:700;color:var(--text3)">¿LA MEDICIÓN FUE CORRECTA?</div>';
  html += '<div style="display:flex;gap:8px;margin-bottom:12px">';
  html += '<div onclick="setDescargaMedicion(true)" style="flex:1;padding:11px;border-radius:10px;border:2px solid '+(state.descargaForm.medicionOk===true?'var(--green)':'var(--border)')+';background:'+(state.descargaForm.medicionOk===true?'var(--green-light)':'#fff')+';text-align:center;cursor:pointer;font-size:13px;font-weight:700;color:'+(state.descargaForm.medicionOk===true?'var(--green)':'var(--text3)')+'">✅ Sí, correcta</div>';
  html += '<div onclick="setDescargaMedicion(false)" style="flex:1;padding:11px;border-radius:10px;border:2px solid '+(state.descargaForm.medicionOk===false?'var(--red)':'var(--border)')+';background:'+(state.descargaForm.medicionOk===false?'var(--red-light)':'#fff')+';text-align:center;cursor:pointer;font-size:13px;font-weight:700;color:'+(state.descargaForm.medicionOk===false?'var(--red)':'var(--text3)')+'">⚠️ Tuvo fallos</div>';
  html += '</div>';
  if (state.descargaForm.medicionOk === false) {
    html += '<div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:8px">TIPO DE FALLO (puede ser más de uno)</div>';
    html += '<div onclick="toggleFallaMedicion(\'Pocas mediciones (incompleta)\')" style="padding:10px 14px;border:2px solid '+(state.descargaForm.fallasMedicion.includes('Pocas mediciones (incompleta)')?'var(--red)':'var(--border)')+';border-radius:10px;margin-bottom:6px;cursor:pointer;font-size:12px;font-weight:600;color:'+(state.descargaForm.fallasMedicion.includes('Pocas mediciones (incompleta)')?'var(--red)':'var(--text2)')+';background:'+(state.descargaForm.fallasMedicion.includes('Pocas mediciones (incompleta)')?'var(--red-light)':'#fff')+';display:flex;align-items:center;gap:8px"><span>'+(state.descargaForm.fallasMedicion.includes('Pocas mediciones (incompleta)')?'🔴':'⬜')+'</span> Pocas mediciones (incompleta)</div>';
    html += '<div onclick="toggleFallaMedicion(\'Valores repetidos / pegados\')" style="padding:10px 14px;border:2px solid '+(state.descargaForm.fallasMedicion.includes('Valores repetidos / pegados')?'var(--red)':'var(--border)')+';border-radius:10px;margin-bottom:6px;cursor:pointer;font-size:12px;font-weight:600;color:'+(state.descargaForm.fallasMedicion.includes('Valores repetidos / pegados')?'var(--red)':'var(--text2)')+';background:'+(state.descargaForm.fallasMedicion.includes('Valores repetidos / pegados')?'var(--red-light)':'#fff')+';display:flex;align-items:center;gap:8px"><span>'+(state.descargaForm.fallasMedicion.includes('Valores repetidos / pegados')?'🔴':'⬜')+'</span> Valores repetidos / pegados</div>';
    html += '<div onclick="toggleFallaMedicion(\'No midio (archivo vacio)\')" style="padding:10px 14px;border:2px solid '+(state.descargaForm.fallasMedicion.includes('No midio (archivo vacio)')?'var(--red)':'var(--border)')+';border-radius:10px;margin-bottom:6px;cursor:pointer;font-size:12px;font-weight:600;color:'+(state.descargaForm.fallasMedicion.includes('No midio (archivo vacio)')?'var(--red)':'var(--text2)')+';background:'+(state.descargaForm.fallasMedicion.includes('No midio (archivo vacio)')?'var(--red-light)':'#fff')+';display:flex;align-items:center;gap:8px"><span>'+(state.descargaForm.fallasMedicion.includes('No midio (archivo vacio)')?'🔴':'⬜')+'</span> No midio (archivo vacio)</div>';
    html += '<div onclick="toggleFallaMedicion(\'Archivo demasiado pesado\')" style="padding:10px 14px;border:2px solid '+(state.descargaForm.fallasMedicion.includes('Archivo demasiado pesado')?'var(--red)':'var(--border)')+';border-radius:10px;margin-bottom:6px;cursor:pointer;font-size:12px;font-weight:600;color:'+(state.descargaForm.fallasMedicion.includes('Archivo demasiado pesado')?'var(--red)':'var(--text2)')+';background:'+(state.descargaForm.fallasMedicion.includes('Archivo demasiado pesado')?'var(--red-light)':'#fff')+';display:flex;align-items:center;gap:8px"><span>'+(state.descargaForm.fallasMedicion.includes('Archivo demasiado pesado')?'🔴':'⬜')+'</span> Archivo demasiado pesado</div>';
    html += '<div onclick="toggleFallaMedicion(\'Archivo demasiado liviano\')" style="padding:10px 14px;border:2px solid '+(state.descargaForm.fallasMedicion.includes('Archivo demasiado liviano')?'var(--red)':'var(--border)')+';border-radius:10px;margin-bottom:6px;cursor:pointer;font-size:12px;font-weight:600;color:'+(state.descargaForm.fallasMedicion.includes('Archivo demasiado liviano')?'var(--red)':'var(--text2)')+';background:'+(state.descargaForm.fallasMedicion.includes('Archivo demasiado liviano')?'var(--red-light)':'#fff')+';display:flex;align-items:center;gap:8px"><span>'+(state.descargaForm.fallasMedicion.includes('Archivo demasiado liviano')?'🔴':'⬜')+'</span> Archivo demasiado liviano</div>';
    html += '<div style="margin-top:8px"><div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:6px">DESCRIPCIÓN ADICIONAL</div><textarea placeholder="Describe el fallo..." oninput="setDescargaFallaDesc(this.value)" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:14px;outline:none;min-height:60px">'+state.descargaForm.descripcionFalla+'</textarea></div>';
  }
  html += '<div style="margin:12px 0"><div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:6px">NOTAS GENERALES (OPCIONAL)</div><textarea placeholder="Observaciones adicionales..." oninput="setDescargaNotas(this.value)" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:14px;outline:none;min-height:60px">'+state.descargaForm.notas+'</textarea></div>';
  html += '<button onclick="doDescarga()" style="width:100%;background:var(--primary);color:#fff;border:none;border-radius:10px;padding:14px;font-family:var(--font);font-weight:700;font-size:15px;cursor:pointer;margin-bottom:8px">💾 Confirmar descarga</button>';
  html += '<button onclick="closeDescargaModal()" style="width:100%;background:#fff;color:var(--text3);border:1px solid var(--border);border-radius:10px;padding:13px;font-family:var(--font);font-size:15px;cursor:pointer">Cancelar</button>';
  html += '</div></div>';
  return html;
}

export function renderImportModal() {
  let html = '';
  const nuevos = state.importData.filter(r => r.status === 'ok').length;
  const dupes = state.importData.filter(r => r.status === 'duplicado').length;
  const errores = state.importData.filter(r => r.status === 'error').length;
  html += `<div style="position:fixed;inset:0;background:#00000088;z-index:200;display:flex;align-items:flex-end">
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-height:85vh;display:flex;flex-direction:column;padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-shrink:0">
          <div style="font-size:17px;font-weight:700;color:var(--text)">Importar inventario</div>
          <button onclick="closeImportModal()" style="background:none;border:none;font-size:24px;color:var(--text3);cursor:pointer">✕</button>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:14px;flex-shrink:0">
          <div style="flex:1;background:var(--green-light);border:1px solid var(--green);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--green)">${nuevos}</div><div style="font-size:10px;color:var(--green);font-weight:600">NUEVOS</div></div>
          <div style="flex:1;background:var(--yellow-light);border:1px solid var(--yellow);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--yellow)">${dupes}</div><div style="font-size:10px;color:var(--yellow);font-weight:600">DUPLICADOS</div></div>
          <div style="flex:1;background:var(--border2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--text3)">${errores}</div><div style="font-size:10px;color:var(--text3);font-weight:600">ERRORES</div></div>
        </div>
        <div style="overflow-y:auto;flex:1;margin-bottom:12px">
          ${state.importData.map(r => {
          const bg = r.status==='ok'?'var(--white)':r.status==='duplicado'?'var(--yellow-light)':'var(--red-light)';
          const border = r.status==='ok'?'var(--green)':r.status==='duplicado'?'var(--yellow)':'var(--red)';
          const icon = r.status==='ok'?'✅':r.status==='duplicado'?'⚠️':'❌';
          return '<div style="background:'+bg+';border:1px solid '+border+';border-left:4px solid '+border+';border-radius:10px;padding:10px;margin-bottom:6px">'+
            '<div style="display:flex;justify-content:space-between"><div style="font-family:var(--mono);font-size:13px;font-weight:700">'+r.serie+'</div><span>'+icon+'</span></div>'+
            '<div style="font-size:11px;color:var(--text2)">'+r.modelo+(r.vineta?' · 🏷 '+r.vineta:'')+'</div>'+
            '<div style="font-size:11px;color:var(--text3)">'+r.sede+'</div>'+
            (r.problema?'<div style="font-size:11px;font-weight:600;color:'+border+';margin-top:3px">'+r.problema+'</div>':'')+
            '</div>';
        }).join('')}
        </div>
        <div style="flex-shrink:0">
          ${nuevos > 0 ? `<button onclick="confirmarImport()" style="width:100%;background:var(--primary);color:#fff;border:none;border-radius:10px;padding:14px;font-family:var(--font);font-weight:700;font-size:15px;cursor:pointer;margin-bottom:8px">✅ Importar ${nuevos} equipos nuevos</button>` : ''}
          <button onclick="closeImportModal()" style="width:100%;background:var(--white);color:var(--text3);border:1px solid var(--border);border-radius:10px;padding:13px;font-family:var(--font);font-size:14px;cursor:pointer">Cancelar</button>
        </div>
      </div>
    </div>`;
  return html;
}

export function renderMantModal() {
  let html = '';
  html += `<div style="position:fixed;inset:0;background:#00000066;z-index:200;display:flex;align-items:flex-end">
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-height:90vh;overflow-y:auto;padding:20px;font-family:var(--font)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-size:17px;font-weight:700;color:var(--text)">🔧 Ficha de mantenimiento</div>
          <button onclick="closeMantModal()" style="background:none;border:none;font-size:24px;color:var(--text3);cursor:pointer">✕</button>
        </div>
        <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:6px">DESCRIPCIÓN DEL PROBLEMA</div>
        <textarea placeholder="¿Qué falla presenta el equipo?" oninput="setMantForm('descripcion',this.value)" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:14px;outline:none;min-height:70px;margin-bottom:12px">${state.mantForm.descripcion}</textarea>
        <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:6px">ACCIÓN REALIZADA</div>
        <textarea placeholder="¿Qué se hizo para resolverlo?" oninput="setMantForm('accion',this.value)" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:14px;outline:none;min-height:70px;margin-bottom:12px">${state.mantForm.accion}</textarea>
        <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:6px">OBSERVACIONES (SOPORTE ARGENTINA)</div>
        <textarea placeholder="Indicaciones del soporte remoto..." oninput="setMantForm('observaciones',this.value)" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:14px;outline:none;min-height:60px;margin-bottom:12px">${state.mantForm.observaciones}</textarea>
        <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:8px">RESULTADO</div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <div onclick="setMantForm('resultado','pendiente')" style="flex:1;padding:9px 4px;border-radius:10px;border:2px solid ${state.mantForm.resultado==='pendiente'?'#f59e0b':'var(--border)'};background:${state.mantForm.resultado==='pendiente'?'#fffbeb':'#fff'};text-align:center;cursor:pointer;font-size:11px;font-weight:700;color:${state.mantForm.resultado==='pendiente'?'#f59e0b':'var(--text3)'}">⏳ Pendiente</div>
          <div onclick="setMantForm('resultado','resuelto')" style="flex:1;padding:9px 4px;border-radius:10px;border:2px solid ${state.mantForm.resultado==='resuelto'?'var(--green)':'var(--border)'};background:${state.mantForm.resultado==='resuelto'?'var(--green-light)':'#fff'};text-align:center;cursor:pointer;font-size:11px;font-weight:700;color:${state.mantForm.resultado==='resuelto'?'var(--green)':'var(--text3)'}">✅ Resuelto</div>
          <div onclick="setMantForm('resultado','sin_solucion')" style="flex:1;padding:9px 4px;border-radius:10px;border:2px solid ${state.mantForm.resultado==='sin_solucion'?'var(--red)':'var(--border)'};background:${state.mantForm.resultado==='sin_solucion'?'var(--red-light)':'#fff'};text-align:center;cursor:pointer;font-size:11px;font-weight:700;color:${state.mantForm.resultado==='sin_solucion'?'var(--red)':'var(--text3)'}">❌ Sin solución</div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:16px">
          <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:6px">FECHA INICIO</div>
            <input type="date" value="${state.mantForm.fechaInicio}" oninput="setMantForm('fechaInicio',this.value)" style="width:100%;padding:11px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:13px;outline:none">
          </div>
          <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:6px">FECHA RESOLUCIÓN</div>
            <input type="date" value="${state.mantForm.fechaResolucion}" oninput="setMantForm('fechaResolucion',this.value)" style="width:100%;padding:11px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:13px;outline:none">
          </div>
        </div>
        <button onclick="guardarMant()" style="width:100%;background:linear-gradient(135deg,#7c3aed,#a78bfa);color:#fff;border:none;border-radius:10px;padding:14px;font-family:var(--font);font-weight:700;font-size:15px;cursor:pointer;margin-bottom:8px">🔧 Guardar ficha</button>
        <button onclick="closeMantModal()" style="width:100%;background:#fff;color:var(--text3);border:1px solid var(--border);border-radius:10px;padding:13px;font-family:var(--font);font-size:15px;cursor:pointer">Cancelar</button>
      </div>
    </div>`;
  return html;
}

export function renderCondicionModal() {
  let html = '';
  html += `<div style="position:fixed;inset:0;background:#00000066;z-index:200;display:flex;align-items:flex-end">
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;padding:20px;font-family:var(--font)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-size:17px;font-weight:700;color:var(--text)">Actualizar condición</div>
          <button onclick="closeCondicionModal()" style="background:none;border:none;font-size:24px;color:var(--text3);cursor:pointer">✕</button>
        </div>
        ${CONDICIONES.map(c => `
          <div onclick="setCondicionField('condicion','${c.key}')" style="padding:13px 16px;border:2px solid ${state.condicionForm.condicion===c.key?c.color:'var(--border)'};border-radius:12px;margin-bottom:8px;cursor:pointer;background:${state.condicionForm.condicion===c.key?c.bg:'#fff'};display:flex;align-items:center;gap:12px">
            <span style="font-size:20px">${c.icon}</span>
            <span style="font-size:15px;font-weight:700;color:${state.condicionForm.condicion===c.key?c.color:'var(--text2)'}">${c.label}</span>
          </div>`).join('')}
        <div style="margin:12px 0">
          <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:6px">NOTA DEL CAMBIO (OPCIONAL)</div>
          <textarea placeholder="Ej: Se reparó el conector de alimentación..." oninput="setCondicionNota(this.value)" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:14px;outline:none;min-height:60px">${state.condicionForm.nota}</textarea>
        </div>
        <button onclick="doCondicion()" style="width:100%;background:var(--primary);color:#fff;border:none;border-radius:10px;padding:14px;font-family:var(--font);font-weight:700;font-size:15px;cursor:pointer;margin-bottom:8px">Guardar condición</button>
        <button onclick="closeCondicionModal()" style="width:100%;background:#fff;color:var(--text3);border:1px solid var(--border);border-radius:10px;padding:13px;font-family:var(--font);font-size:15px;cursor:pointer">Cancelar</button>
      </div>
    </div>`;
  return html;
}

export function renderPrestamoModal() {
  let html = '';
  const esPrestamo = state.prestamoForm.tipo === 'prestamo';
  html += `<div style="position:fixed;inset:0;background:#00000066;z-index:200;display:flex;align-items:flex-end">
      <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-height:85vh;overflow-y:auto;padding:20px;font-family:var(--font)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-size:17px;font-weight:700;color:var(--text)">${esPrestamo ? '🔄 Registrar préstamo' : '✅ Registrar devolución'}</div>
          <button onclick="closePrestamoModal()" style="background:none;border:none;font-size:24px;color:var(--text3);cursor:pointer">✕</button>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:16px">
          <div style="flex:1">
            <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">De (entrega)</div>
            ${AREAS.map(a => `<div onclick="setPrestamoField('de','${a}')" style="padding:11px 14px;border:2px solid ${state.prestamoForm.de===a?'var(--primary)':'var(--border)'};border-radius:10px;margin-bottom:6px;cursor:pointer;font-size:14px;font-weight:600;color:${state.prestamoForm.de===a?'var(--primary)':'var(--text2)'};background:${state.prestamoForm.de===a?'var(--primary-light)':'#fff'}">${a}</div>`).join('')}
          </div>
          <div style="display:flex;align-items:center;font-size:22px;color:var(--primary);padding-top:30px">→</div>
          <div style="flex:1">
            <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Para (recibe)</div>
            ${AREAS.map(a => `<div onclick="setPrestamoField('a','${a}')" style="padding:11px 14px;border:2px solid ${state.prestamoForm.a===a?'var(--green)':'var(--border)'};border-radius:10px;margin-bottom:6px;cursor:pointer;font-size:14px;font-weight:600;color:${state.prestamoForm.a===a?'var(--green)':'var(--text2)'};background:${state.prestamoForm.a===a?'var(--green-light)':'#fff'}">${a}</div>`).join('')}
          </div>
        </div>
        <div style="font-size:11px;color:var(--text3);text-align:center;margin-bottom:14px">
          Sede destino: <strong style="color:var(--primary)">${areaToSede(state.prestamoForm.a)}</strong>
        </div>
        <div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:6px">NOTA (OPCIONAL)</div>
          <textarea placeholder="Observaciones del movimiento..." oninput="setPrestamoNota(this.value)" style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:14px;outline:none;min-height:60px">${state.prestamoForm.nota}</textarea>
        </div>
        <button onclick="doMovimiento()" style="width:100%;background:var(--primary);color:#fff;border:none;border-radius:10px;padding:14px;font-family:var(--font);font-weight:700;font-size:15px;cursor:pointer;margin-bottom:8px">${esPrestamo ? '🔄 Confirmar préstamo' : '✅ Confirmar devolución'}</button>
        <button onclick="closePrestamoModal()" style="width:100%;background:#fff;color:var(--text3);border:1px solid var(--border);border-radius:10px;padding:13px;font-family:var(--font);font-size:15px;cursor:pointer">Cancelar</button>
      </div>
    </div>`;
  return html;
}

export function renderSelectorModal() {
  let html = '';
  const filteredEq = state.equipos.filter(eq =>
    !state.selectorSearch || eq.serie.toLowerCase().includes(state.selectorSearch.toLowerCase()) || (eq.modelo||'').toLowerCase().includes(state.selectorSearch.toLowerCase())
  );
  html += `<div class="modal-overlay" style="align-items:flex-end">
      <div class="modal" style="max-height:85vh;display:flex;flex-direction:column;border-radius:20px 20px 0 0;margin:0;max-width:100%;width:100%">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div class="modal-title" style="margin:0">Elegir equipo</div>
          <button onclick="closeSelector()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>
        </div>
        <div style="position:relative;margin-bottom:12px;flex-shrink:0">
          <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:16px;color:var(--text3)">🔍</span>
          <input id="sel-search" style="width:100%;padding:10px 10px 10px 36px;border:1.5px solid var(--border);border-radius:10px;font-family:var(--font);font-size:14px;outline:none;box-shadow:var(--shadow)"
            placeholder="Buscar por serie o modelo..." value="${state.selectorSearch}" oninput="setSelectorSearch(this.value)">
        </div>
        <div style="overflow-y:auto;flex:1">
          ${state.equipos.length === 0 ? `<div style="text-align:center;color:var(--text3);padding:20px">Sin equipos en inventario</div>` : ''}
          ${filteredEq.length === 0 && state.equipos.length > 0 ? `<div style="text-align:center;color:var(--text3);padding:20px">Sin resultados para "${state.selectorSearch}"</div>` : ''}
          ${filteredEq.map(eq => {
          const avail = (eqSt(eq) === 'disponible' || eqSt(eq) === 'prestado') && (eq.condicion || 'bueno') !== 'fuera' && (eq.condicion || 'bueno') !== 'mantenimiento';
          return `<div class="selector-item ${!avail ? 'disabled' : ''}" onclick="${avail ? `pickEquipo('${eq.id}')` : ''}">
              <div>
                <div style="font-weight:700;font-size:15px">${eq.serie}</div>
                <div style="font-size:12px;color:var(--text3)">${eq.modelo}${!avail ? ' · <span style="color:var(--yellow)">En uso</span>' : ''}</div>
              </div>
              ${avail ? `<span style="color:var(--blue);font-size:13px;font-weight:600">Elegir →</span>` : `<span style="color:var(--text3);font-size:12px">En uso</span>`}
            </div>`;
        }).join('')}
        </div>
      </div>
    </div>`;
  return html;
}

export function renderGlobalSearch() {
  let html = '';
  const q = state.globalSearch.toLowerCase().trim();
  const instRes = q.length >= 2 ? state.records.filter(r => (r.serie||'').toLowerCase().includes(q) || (r.caso||'').toLowerCase().includes(q) || (r.lugar||'').toLowerCase().includes(q)).slice(0,6) : [];
  const eqRes = q.length >= 2 ? state.equipos.filter(e => (e.serie||'').toLowerCase().includes(q) || (e.modelo||'').toLowerCase().includes(q) || (e.vineta||'').toLowerCase().includes(q)).slice(0,6) : [];
  html += '<div style="position:fixed;inset:0;background:#00000088;z-index:300;display:flex;flex-direction:column;padding:60px 16px 16px">';
  html += '<div style="background:var(--white);border-radius:16px;overflow:hidden;max-height:80vh;display:flex;flex-direction:column">';
  html += '<div style="padding:14px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:center">';
  html += '<input id="gsearch" autofocus placeholder="Buscar serie, caso, lugar, viñeta..." value="'+state.globalSearch+'" oninput="setGlobalSearch(this.value)" style="flex:1;background:var(--bg);border:1.5px solid var(--border);border-radius:10px;padding:10px 14px;font-family:var(--font);font-size:14px;outline:none">';
  html += '<button onclick="toggleGlobalSearch()" style="background:none;border:none;font-size:22px;color:var(--text3);cursor:pointer">✕</button>';
  html += '</div>';
  html += '<div style="overflow-y:auto;padding:12px">';
  if (q.length < 2) {
    html += '<div style="text-align:center;color:var(--text3);padding:30px;font-size:14px">Escribe al menos 2 caracteres</div>';
  } else if (instRes.length === 0 && eqRes.length === 0) {
    html += '<div style="text-align:center;color:var(--text3);padding:30px;font-size:14px">Sin resultados para "'+q+'"</div>';
  } else {
    if (instRes.length > 0) {
      html += '<div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Instalaciones</div>';
      instRes.forEach(r => {
        const st = calcSt(r);
        const rid = r.id;
        html += '<div onclick="goToInstall(this.dataset.id)" data-id="'+rid+'" style="padding:12px;border:1px solid var(--border);border-radius:10px;margin-bottom:6px;cursor:pointer">';
        html += '<div style="display:flex;justify-content:space-between"><div style="font-family:var(--mono);font-weight:700">'+r.serie+'</div>'+badgeSt(st)+'</div>';
        html += '<div style="font-size:12px;color:var(--text3)">#'+r.caso+' · '+(r.lugar||'')+'</div>';
        html += '</div>';
      });
    }
    if (eqRes.length > 0) {
      html += '<div style="font-size:10px;font-weight:700;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin:8px 0">Inventario</div>';
      eqRes.forEach(e => {
        const eid = e.id;
        html += '<div onclick="goToEquipo(this.dataset.id)" data-id="'+eid+'" style="padding:12px;border:1px solid var(--border);border-radius:10px;margin-bottom:6px;cursor:pointer">';
        html += '<div style="font-family:var(--mono);font-weight:700">'+e.serie+(e.vineta?' <span style=&quot;font-size:11px;color:var(--text3)&quot;>🏷'+e.vineta+'</span>':'')+'</div>';
        html += '<div style="font-size:12px;color:var(--text3)">'+(e.modelo||'')+'</div>';
        html += '</div>';
      });
    }
  }
  html += '</div></div></div>';
  return html;
}

export function renderAlertaRetiros() {
  let html = '';
  const ua = userArea(); const proximos = state.records.filter(r => !r.retirado && daysUntil(r.fechaRetiro) <= 3 && daysUntil(r.fechaRetiro) >= 0 && (r.areaInstalacion||'CPT MT') === ua)
    .sort((a,b) => daysUntil(a.fechaRetiro) - daysUntil(b.fechaRetiro));
  html += '<div style="position:fixed;inset:0;background:#00000088;z-index:300;display:flex;align-items:center;justify-content:center;padding:24px">';
  html += '<div style="background:#fff;border-radius:20px;width:100%;max-width:380px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)">';
  html += '<div style="background:linear-gradient(135deg,#ff6b35,#f7c948);padding:20px 20px 16px">';
  html += '<div style="font-size:22px;margin-bottom:4px">🔔</div>';
  html += '<div style="font-size:17px;font-weight:800;color:#fff">Retiros próximos</div>';
  html += '<div style="font-size:12px;color:rgba(255,255,255,.8);margin-top:2px">' + proximos.length + ' instalacion' + (proximos.length>1?'es':'') + ' requieren atención</div>';
  html += '</div>';
  html += '<div style="padding:16px;max-height:280px;overflow-y:auto">';
  proximos.forEach(r => {
    const d = daysUntil(r.fechaRetiro);
    const color = d === 0 ? 'var(--red)' : d === 1 ? 'var(--yellow)' : 'var(--text2)';
    const label = d === 0 ? '⚠️ Hoy' : d === 1 ? '⚠️ Mañana' : 'en ' + d + 'd';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border2)">';
    html += '<div>';
    html += '<div style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--text)">' + (r.serie||'—') + '</div>';
    html += '<div style="font-size:11px;color:var(--text3)">' + (r.lugar||'Sin ubicación') + ' · ' + (r.areaInstalacion||'CPT MT') + '</div>';
    html += '</div>';
    html += '<span style="font-size:12px;font-weight:700;color:' + color + ';flex-shrink:0;margin-left:8px">' + label + '</span>';
    html += '</div>';
  });
  html += '</div>';
  html += '<div style="padding:16px;display:flex;gap:8px">';
  html += '<button onclick="cerrarAlerta()" style="flex:1;padding:12px;border:1px solid var(--border);border-radius:10px;background:#fff;font-family:var(--font);font-size:14px;font-weight:600;color:var(--text2);cursor:pointer">Cerrar</button>';
  html += '<button onclick="verRetiros()" style="flex:1;padding:12px;border:none;border-radius:10px;background:var(--primary);font-family:var(--font);font-size:14px;font-weight:700;color:#fff;cursor:pointer">Ver retiros</button>';
  html += '</div></div></div>';
  return html;
}
