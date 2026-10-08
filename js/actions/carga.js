// Carga masiva / despachos desde Excel
import { db, historialCargasRef, push, ref, update } from '../firebase.js';
import { buildMemoCargaMasiva } from '../pdf/memos.js';
import { state } from '../state.js';
import { abrirMemo, showToast } from '../ui.js';
import { eqEnCampo, today } from '../utils.js';
import { render } from '../views/render.js';

// Normaliza un encabezado: sin tildes, minúsculas y sin espacios de más
const norm = v => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

// Fecha de una celda: número de serie de Excel, Date o texto (el texto se deja como viene, DD/MM/AAAA)
function fechaCelda(v) {
  if (v === '' || v == null) return '';
  const dd = (d, m, y) => String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + y;
  if (v instanceof Date) return dd(v.getDate(), v.getMonth() + 1, v.getFullYear());
  if (typeof v === 'number') { const p = XLSX.SSF.parse_date_code(v); return p ? dd(p.d, p.m, p.y) : ''; }
  return String(v).trim();
}

// Filas del Excel de despacho (arreglo de arreglos) → filas de la carga. Acepta el formato de MT y el de BT:
// el encabezado puede estar más abajo (el de BT trae De/Para/Asunto/Fecha arriba), sin fecha de retiro
// y con "Ubicación" = "lat lng". Las filas sin equipo ni SIGET (firmas al pie) se ignoran.
export function filasDespacho(aoa) {
  const fila = aoa.findIndex(r => r.some(c => norm(c).includes('siget')) && r.some(c => norm(c) === 'equipo'));
  if (fila < 0) return null;
  const enc = aoa[fila].map(norm);
  const col = (...nombres) => { const k = enc.findIndex(h => nombres.map(norm).includes(h)); return k; };
  const c = {
    caso: col('Numero SIGET', 'No SIGET', 'N° SIGET', 'SIGET'),
    serie: col('Equipo'),
    lugar: col('Nombre del Usuario', 'Nombre de Usuario', 'Nombre Usuario', 'Usuario'),
    fechaInst: col('Fecha instalacion', 'FechaInstalacion', 'F. instalacion'),
    fechaRetiro: col('Fecha retiro', 'FechaRetiro', 'F. retiro'),
    notas: col('Transformador', 'Transf'),
    medidor: col('Medidor'),
    lat: col('Latitud', 'Lat'),
    lng: col('Longitud', 'Lng', 'Long'),
    ubicacion: col('Ubicacion', 'Coordenadas'),
    idUsuario: col('Id del Usuario', 'ID Usuario', 'IdCliente', 'id_usuario'),
    direccion: col('Direccion', 'Direccion 4'),
    accesorios: col('Accesorios', 'Accesorio'),
    multiplicador: col('Multiplicador', 'Mult'),
    corrientes: col('Corrientes', 'Corriente'),
    conexion: col('Conexion', 'Tipo conexion'),
  };
  const filas = [];
  for (const r of aoa.slice(fila + 1)) {
    const v = k => c[k] < 0 ? '' : String(r[c[k]] ?? '').trim();
    if (!v('serie') && !v('caso')) continue;
    let lat = v('lat'), lng = v('lng');
    if (!lat && !lng && v('ubicacion')) [lat = '', lng = ''] = v('ubicacion').split(/[\s,;]+/).filter(Boolean);
    filas.push({
      serie: v('serie'), caso: v('caso'), lugar: v('lugar'),
      fechaInst: c.fechaInst < 0 ? '' : fechaCelda(r[c.fechaInst]),
      fechaRetiro: c.fechaRetiro < 0 ? '' : fechaCelda(r[c.fechaRetiro]),
      notas: v('notas'), medidor: v('medidor'), lat, lng, idUsuario: v('idUsuario'), direccion: v('direccion'),
      accesorios: v('accesorios'), multiplicador: v('multiplicador'), corrientes: v('corrientes'), conexion: v('conexion'),
    });
  }
  return filas;
}

export function procesarExcel(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
      const filas = filasDespacho(aoa);
      if (!filas) return showToast('No encontré el encabezado (Número SIGET, Equipo…) en el archivo');
      if (filas.length === 0) return showToast('El archivo está vacío');
      state.cargaData = filas.map(validarFilaCarga);
      state.cargaView = 'preview';
      render();
    } catch(err) {
      showToast('Error al leer el archivo: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// El formato de BT no trae fecha de retiro: se elige una al cargar y se pone a las filas que no la tienen
export function aplicarRetiroCarga(iso) {
  if (!iso) return showToast('Elige la fecha de retiro');
  const [y, m, d] = iso.split('-');
  state.cargaData = state.cargaData.map(r => r.fechaRetiro ? r : validarFilaCarga({ ...r, fechaRetiro: d + '/' + m + '/' + y }));
  render();
}

// Revisa una fila del despacho (venga del Excel o de las Fechas de una campaña) y le agrega el equipo
export function validarFilaCarga(fila) {
  const { serie, caso, fechaRetiro } = fila;
  const eq = state.equipos.find(e => e.serie === serie) || state.equipos.find(e => norm(e.serie) === norm(serie));
  let status = 'ok';
  let problema = '';
  if (!serie) { status = 'error'; problema = 'Sin número de serie'; }
  else if (!eq) { status = 'error'; problema = 'Equipo no existe en inventario'; }
  else if ((eq.condicion||'bueno') === 'fuera') { status = 'error'; problema = 'Fuera de servicio'; }
  else if (eqEnCampo(eq)) { status = 'error'; problema = 'Ya está instalado — instalación activa detectada'; }
  else if (!caso) { status = 'error'; problema = 'Sin número SIGET (obligatorio)'; }
  else if (!fechaRetiro) { status = 'error'; problema = 'Sin fecha de retiro (obligatoria)'; }
  return { ...fila, status, problema, equipoId: eq?.id, modelo: eq?.modelo||'', vineta: eq?.vineta||'' };
}

export function confirmarCargaMasiva() {
  const validos = state.cargaData.filter(r => r.status === 'ok' || r.status === 'warning');
  if (validos.length === 0) return showToast('No hay registros válidos para importar');

  // Show progress
  let procesados = 0;
  const total = validos.length;
  const progressEl = document.getElementById('carga-progress');
  const progressBar = document.getElementById('carga-progress-bar');
  const progressTxt = document.getElementById('carga-progress-txt');
  if (progressEl) progressEl.style.display = 'block';

  let count = 0;
  const instalacionIds = [];
  validos.forEach(r => {
    const eq = state.equipos.find(e => e.id === r.equipoId);
    if (!eq) return;

    // Parse date - handle DD/MM/YYYY or YYYY-MM-DD
    const parseDate = d => {
      if (!d) return today();
      if (d.includes('/')) { const [dd,mm,yy] = d.split('/'); return yy+'-'+mm.padStart(2,'0')+'-'+dd.padStart(2,'0'); }
      return d.substring(0,10);
    };

    const payload = {
      equipoId: r.equipoId, serie: r.serie, modelo: r.modelo,
      caso: r.caso, lugar: r.lugar,
      lat: r.lat||null, lng: r.lng||null,
      fechaInstalacion: parseDate(r.fechaInst),
      fechaRetiro: parseDate(r.fechaRetiro),
      notas: r.notas, sede: 'Subestación Cucumacayán',
      areaInstalacion: 'Campos y Servicios',
      areaBeneficiaria: state.cargaAreaOrigen,
      retirado: false, fechaRegistro: today()
    };

    // Register installation
    const newRef = push(ref(db, 'analizadores'), payload);
    procesados++;
    if (progressBar) { progressBar.style.width = Math.round(procesados/total*100)+'%'; }
    if (progressTxt) { progressTxt.textContent = procesados + ' / ' + total; }
    instalacionIds.push(newRef.key);

    // Register prestamo movement (avoid duplicate if already prestado today to same area)
    const existeMov = (eq.movimientos||[]).some(m => m.tipo==='prestamo' && m.a==='Campos y Servicios' && m.fecha===today() && m.nota && m.nota.includes(r.caso));
    if (existeMov) { return; } // skip duplicate, don't decrement
    const mov = { tipo: 'prestamo', de: state.cargaAreaOrigen, a: 'Campos y Servicios', fecha: today(), nota: 'Asignación carga masiva - Caso #' + r.caso };
    const movimientos = [...(eq.movimientos||[]), mov];
    update(ref(db, 'equipos/' + r.equipoId), { prestado: true, prestadoFecha: today(), sede: 'Subestación Cucumacayán', movimientos });
    count++;
  });

  // Save to historial
  const registroCarga = {
    fecha: today(),
    hora: new Date().toLocaleTimeString('es-SV', {hour:'2-digit', minute:'2-digit'}),
    areaOrigen: state.cargaAreaOrigen,
    total: validos.length,
    realizadoPor: state.sesionUsuario?.nombre || 'Desconocido',
    equipos: validos.map(r => ({ s: r.serie, v: r.vineta||'', c: r.caso, l: r.lugar, fi: r.fechaInst, fr: r.fechaRetiro, n: r.notas||'', iu: r.idUsuario||'', d: r.direccion||'', ac: r.accesorios||'', m: r.multiplicador||'', co: r.corrientes||'', cx: r.conexion||'' }))
  };
  showToast('' + count + ' instalaciones registradas');
  const memoHtml = buildMemoCargaMasiva(validos);
  push(historialCargasRef, {
    fecha: today(),
    hora: new Date().toLocaleTimeString('es-SV', {hour:'2-digit', minute:'2-digit'}),
    areaOrigen: state.cargaAreaOrigen,
    total: validos.length,
    realizadoPor: state.sesionUsuario?.nombre || 'Desconocido',
    instalacionIds: instalacionIds,
    memo: memoHtml
  });
  abrirMemo(memoHtml);
  state.cargaData = []; state.cargaView = 'upload';
  state.tab = 'carga'; state.cargaSubView = 'historial';
  render();
}

export function generarMemoCargaMasiva(filas) {
  abrirMemo(buildMemoCargaMasiva(filas));
}
