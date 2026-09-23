// Handlers (onclick) de validaciones de TAP
import { db, push, ref, update, validacionesRef } from '../firebase.js';
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { today } from '../utils.js';
import { render } from '../views/render.js';

// ── VALIDACIONES HANDLERS ──
window.abrirNuevaValidacion = () => { state.showValImport = true; state.valImportData = []; state.valTipo = 'monofasico'; render(); };

window.cerrarValImport = () => { state.showValImport = false; state.valImportData = []; render(); };
window.setValTipo = el => { state.valTipo = el.dataset.t; render(); };
window.setValTipoUsuario = el => { state.valTipoUsuario = typeof el === 'string' ? el : el.dataset.t; render(); };
window.setValView = v => { state.valView = v; if (v === 'lista') { state.valCampanaId = null; state.valUsuarioIdx = null; } render(); };

window.procesarExcelVal = input => {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      state.valImportData = rows.map(r => ({
        nc: r['NC']?.toString().trim() || '',
        siget: (r['CÓDIGO SIGET'] || r['CODIGO SIGET'] || r['Código SIGET'] || '')?.toString().trim() || '',
        nombre: (r['NOMBRE'] || '')?.toString().trim() || '',
        direccion: (r['DIRECCIÓN'] || r['DIRECCION'] || '')?.toString().trim() || '',
        ct: (r['CORTE'] || '')?.toString().trim() || '',
        medidor: (r['MEDIDOR'] || '')?.toString().trim() || '',
        alimentador: (r['ALIMENTADOR'] || '')?.toString().trim() || '',
        lat: r['LATITUD']?.toString() || '',
        lng: r['LONGITUD']?.toString() || '',
        estado: 'pendiente',
        resultado: null,
      }));
      render();
    } catch(err) { showToast('❌ Error al leer el archivo: ' + err.message); }
  };
  reader.readAsArrayBuffer(file);
};

window.confirmarNuevaValidacion = () => {
  const nombre = document.getElementById('val-nombre')?.value?.trim();
  if (!nombre) return showToast('Ingresa el nombre de la campaña');
  if (state.valImportData.length === 0) return showToast('Carga el archivo Excel primero');
  push(validacionesRef, {
    nombre, fecha: today(), tipo: state.valTipo,
    usuarios: state.valImportData,
    creadoPor: state.sesionUsuario?.nombre || 'Desconocido',
  }).then(() => {
    state.showValImport = false; state.valImportData = [];
    showToast('✅ Campaña creada con ' + state.valImportData.length + ' usuarios');
  });
};

window.abrirCampana = el => {
  state.valCampanaId = typeof el === 'string' ? el : el.dataset.id; state.valView = 'detalle'; render();
};

window.abrirFormVal = el => {
  state.valUsuarioIdx = parseInt(typeof el === 'string' ? el : el.dataset.idx);
  state.valTipoUsuario = 'monofasico'; // reset per-user tipo
  const camp = state.validaciones.find(v => v.id === state.valCampanaId);
  const u = camp?.usuarios?.[state.valUsuarioIdx];
  // Pre-load saved form data if already validated
  if (u?.formData) { state.valForm = { ...u.formData }; }
  else { state.valForm = {}; }
  state.valView = 'form'; render();
};

window.calcularValidacion = () => {
  const g = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const tipo = state.valTipoUsuario;
  const refCt = g('vf-ref-ct'), refMed = g('vf-ref-med');
  const refVP = parseFloat(g('vf-ref-vp'));
  const _refVSraw = g('vf-ref-vs');
  const refVS = _refVSraw === 'otro' ? (state.valForm.refVSOtro || parseFloat(document.getElementById('vf-ref-vs-otro')?.value||'0')) : parseFloat(_refVSraw);
  const refTap = parseInt(g('vf-ref-tap'));
  const cpVP = parseFloat(g('vf-cp-vp') || g('vf-ref-vp')); // trifasico uses vf-cp-vp
  const _cpVSraw = g('vf-cp-vs');
  const cpVS = _cpVSraw === 'otro' ? (state.valForm.cpVSOtro || parseFloat(document.getElementById('vf-cp-vs-otro')?.value||'0')) : parseFloat(_cpVSraw);
  const tapsStr = g('vf-taps');

  if (!refVP || !refVS || isNaN(refTap) || !cpVS || !tapsStr) {
    return showToast('Completa todos los campos para calcular');
  }
  const taps = tapsStr.split(',').map(t => parseFloat(t.trim())).filter(t => !isNaN(t));
  if (!taps.length) return showToast('Ingresa los TAPs separados por coma');

  // Relación de referencia del trafo de referencia
  const relRef = refVP / refVS;

  let relacionCalc = 0;
  let primProyectado = 0;
  let formData = { tipoConexion: tipo, refCt, refMed, refVP, refVS, refTap, cpVS, taps: tapsStr };

  if (tipo === 'monofasico') {
    const refLec = parseFloat(g('vf-ref-lec'));
    const cpLec  = parseFloat(g('vf-cp-lec'));
    if (!refLec || !cpLec) return showToast('Ingresa las lecturas instantáneas');
    // Primario proyectado = lectura_ref × relación_ref
    primProyectado = refLec * relRef;
    // Relación del trafo campaña = primario_proyectado / lectura_campaña
    relacionCalc = primProyectado / cpLec;
    Object.assign(formData, { refLec, cpLec });

  } else if (tipo === 'bifasico') {
    // 2 lecturas por fase — promedio de relaciones
    const r1 = parseFloat(g('vf-ref-lec1')), r2 = parseFloat(g('vf-ref-lec2'));
    const c1 = parseFloat(g('vf-cp-lec1')),  c2 = parseFloat(g('vf-cp-lec2'));
    if (!r1 || !r2 || !c1 || !c2) return showToast('Ingresa las 2 lecturas por fase (Vab y Vbc)');
    // Relación por fase = prim_proyectado_fase / lec_campaña_fase
    const relFase1 = (r1 * relRef) / c1;
    const relFase2 = (r2 * relRef) / c2;
    relacionCalc = (relFase1 + relFase2) / 2;
    primProyectado = ((r1 + r2) / 2) * relRef;
    Object.assign(formData, { refLec1: r1, refLec2: r2, cpLec1: c1, cpLec2: c2 });

  } else if (tipo === 'trifasico') {
    // 3 lecturas por fase — promedio de relaciones
    const r1 = parseFloat(g('vf-ref-lec1')), r2 = parseFloat(g('vf-ref-lec2')), r3 = parseFloat(g('vf-ref-lec3'));
    const c1 = parseFloat(g('vf-cp-lec1')),  c2 = parseFloat(g('vf-cp-lec2')),  c3 = parseFloat(g('vf-cp-lec3'));
    if (!r1 || !r2 || !r3 || !c1 || !c2 || !c3) return showToast('Ingresa las 3 lecturas por fase (Vab, Vbc, Vca)');
    const relFase1 = (r1 * relRef) / c1;
    const relFase2 = (r2 * relRef) / c2;
    const relFase3 = (r3 * relRef) / c3;
    relacionCalc = (relFase1 + relFase2 + relFase3) / 3;
    primProyectado = ((r1 + r2 + r3) / 3) * relRef;
    Object.assign(formData, { refLec1: r1, refLec2: r2, refLec3: r3, cpLec1: c1, cpLec2: c2, cpLec3: c3, cpVP });
  }

  // Buscar TAP más cercano: relación de cada TAP = voltPrimario / cpVS
  let closestTap = -1, closestVP = null, minDiff = Infinity;
  taps.forEach((vp, i) => {
    const rel = vp / cpVS;
    const diff = Math.abs(rel - relacionCalc);
    if (diff < minDiff) { minDiff = diff; closestTap = i + 1; closestVP = vp; }
  });

  formData.resultado = {
    tap: closestTap,
    multiplicador: closestVP + '/' + cpVS,
    primarioProyectado: primProyectado,
    relacionCalc,
    ok: true,
  };
  state.valForm = formData;
  render();
};

window.guardarValidacion = () => {
  const camp = state.validaciones.find(v => v.id === state.valCampanaId);
  if (!camp || state.valUsuarioIdx === null) return;
  const usuarios = [...(camp.usuarios || [])];
  usuarios[state.valUsuarioIdx] = {
    ...usuarios[state.valUsuarioIdx],
    estado: 'validado',
    fechaValidacion: today(),
    validadoPor: state.sesionUsuario?.nombre || 'Desconocido',
    resultado: state.valForm.resultado,
    formData: { ...state.valForm, resultado: state.valForm.resultado },
  };
  update(ref(db, 'validaciones/' + state.valCampanaId), { usuarios }).then(() => {
    showToast('✅ Validación guardada');
    state.valView = 'detalle'; state.valForm = {}; render();
  });
};

window.exportarValidaciones = el => {
  const campId = typeof el === 'string' ? el : el.dataset.id;
  const camp = state.validaciones.find(v => v.id === campId);
  if (!camp) return;
  const rows = (camp.usuarios || []).map(u => ({
    'NC': u.nc || '',
    'Código SIGET': u.siget || '',
    'Nombre': u.nombre || '',
    'CT/DS Campaña': u.ct || '',
    'Medidor Campaña': u.medidor || '',
    'Dirección': u.direccion || '',
    'Estado': u.estado === 'validado' ? 'Validado' : 'Pendiente',
    'TAP Estimado': u.resultado ? 'TAP ' + u.resultado.tap : '',
    'Multiplicador': u.resultado ? u.resultado.multiplicador : '',
    'CT/DS Referencia': u.formData?.refCt || '',
    'Medidor Referencia': u.formData?.refMed || '',
    'V. Prim. Referencia': u.formData?.refVP || '',
    'V. Sec. Referencia': u.formData?.refVS || '',
    'Lectura Referencia (V)': u.formData?.refLec || '',
    'TAP Referencia': u.formData?.refTap || '',
    'Lectura Campaña (V)': u.formData?.cpLec || '',
    'V. Sec. Campaña': u.formData?.cpVS || '',
    'TAPs Placa': u.formData?.taps || '',
    'Primario Proyectado (V)': u.resultado ? u.resultado.primarioProyectado.toFixed(2) : '',
    'Relación Calculada': u.resultado ? u.resultado.relacionCalc.toFixed(4) : '',
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Validaciones');
  XLSX.writeFile(wb, 'validaciones_' + camp.nombre.replace(/\s+/g,'_') + '_' + today() + '.xlsx');
  showToast('📊 Excel exportado');
};

window.autoFillTapsTri = () => {
  const vpEl = document.getElementById('vf-cp-vp');
  const tapsEl = document.getElementById('vf-taps');
  if (!vpEl || !tapsEl) return;
  const T = {'23000':'24940,23900,22900,22290,21755','13200':'13860,13530,13200,12870,12540','4160':'4364,4260,4157,4054,3950'};
  const _tv = vpEl.value.trim(); if (T[_tv]) { tapsEl.value = T[_tv]; state.valForm.taps = T[_tv]; }
};

window.valVSOtro = sel => {
  if (sel.id !== 'vf-ref-vs' && sel.id !== 'vf-cp-vs') return;
  const key = sel.id === 'vf-ref-vs' ? 'refVS' : 'cpVS';
  state.valForm[key] = sel.value;
  // Solo muestra u oculta el campo manual: redibujar borraría lo ya escrito
  const otro = document.getElementById(sel.id + '-otro');
  if (otro) otro.style.display = sel.value === 'otro' ? '' : 'none';
};

window.valVSOtroVal = inp => {
  const key = inp.id === 'vf-ref-vs-otro' ? 'refVSOtro' : 'cpVSOtro';
  state.valForm[key] = parseFloat(inp.value) || 0;
};

window.autoFillTaps = () => {
  const vpEl = document.getElementById('vf-cp-vp');
  const tapsEl = document.getElementById('vf-taps');
  if (!vpEl || !tapsEl) return;
  const vp = vpEl.value.trim();
  const TAPS = {'13200':'14400,13800,13200,12870,12540','7620':'8001,7810,7620,7430,7240','2400':'2520,2460,2400,2340,2280'};
  if (TAPS[vp]) { tapsEl.value = TAPS[vp]; state.valForm.cpVP = parseFloat(vp); state.valForm.taps = TAPS[vp]; }
};
