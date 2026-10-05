// Carga masiva / despachos desde Excel
import { db, historialCargasRef, push, ref, update } from '../firebase.js';
import { buildMemoCargaMasiva } from '../pdf/memos.js';
import { state } from '../state.js';
import { abrirMemo, showToast } from '../ui.js';
import { eqEnCampo, today } from '../utils.js';
import { render } from '../views/render.js';

export function procesarExcel(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // Find header row - look for row containing 'Número SIGET' or 'Numero SIGET'
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      let headerRow = 0;
      for (let r = range.s.r; r <= Math.min(range.s.r + 5, range.e.r); r++) {
        const cell = ws[XLSX.utils.encode_cell({r, c: 0})];
        if (cell && cell.v && cell.v.toString().toLowerCase().includes('siget')) { headerRow = r; break; }
        const cell2 = ws[XLSX.utils.encode_cell({r, c: 1})];
        if (cell2 && cell2.v && cell2.v.toString().toLowerCase().includes('equipo')) { headerRow = r; break; }
      }
      const rows = XLSX.utils.sheet_to_json(ws, { raw: false, range: headerRow });
      if (rows.length === 0) return showToast('⚠️ El archivo está vacío');

      state.cargaData = rows.map(row => {
        // Flexible column finder - handles accents, case, spaces
        const findCol = (keys) => {
          const rowKeys = Object.keys(row);
          for (const k of keys) {
            const found = rowKeys.find(rk => rk.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'') === k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));
            if (found && row[found] !== undefined && row[found] !== '') return row[found];
          }
          return '';
        };
        const fmtDate = v => {
          if (!v) return '';
          if (typeof v === 'object' && v instanceof Date) return v.toLocaleDateString('es-SV');
          const s = v.toString().trim();
          // Handle Excel serial number dates
          if (/^\d{5}$/.test(s)) {
            const d = new Date(Math.round((parseInt(s) - 25569) * 86400 * 1000));
            return d.toLocaleDateString('es-SV');
          }
          return s;
        };
        const serie = findCol(['Equipo']).toString().trim();
        const caso = findCol(['Numero SIGET', 'Número SIGET', 'No SIGET', 'SIGET']).toString().trim();
        const lugar = findCol(['Nombre del Usuario', 'Nombre de Usuario', 'Nombre Usuario', 'Usuario']).toString().trim();
        const fechaInst = fmtDate(findCol(['Fecha instalacion', 'Fecha instalación', 'Fecha Instalacion', 'Fecha Instalación', 'FechaInstalacion']));
        const fechaRetiro = fmtDate(findCol(['Fecha retiro', 'Fecha Retiro', 'FechaRetiro']));
        const notas = findCol(['Transformador', 'Transf']).toString().trim();
        const lat = findCol(['Latitud', 'Lat']).toString().trim();
        const lng = findCol(['Longitud', 'Lng', 'Long']).toString().trim();
        const idUsuario = findCol(['Id del Usuario','ID del Usuario','ID Usuario','IdCliente','id_usuario']).toString().trim();
        const direccion = findCol(['Direccion','Dirección','DIRECCION','Direccion 4','Dirección 4']).toString().trim();
        const accesorios = findCol(['Accesorios','ACCESORIOS','Accesorio']).toString().trim();
        const multiplicador = findCol(['Multiplicador','MULTIPLICADOR','Mult']).toString().trim();
        const corrientes = findCol(['Corrientes','CORRIENTES','Corriente']).toString().trim();
        const conexion = findCol(['Conexion','Conexión','CONEXION','Tipo conexion','Tipo conexión']).toString().trim();

        // Validate
        const eq = state.equipos.find(e => e.serie === serie);
        let status = 'ok';
        let problema = '';
        if (!serie) { status = 'error'; problema = 'Sin número de serie'; }
        else if (!eq) { status = 'error'; problema = 'Equipo no existe en inventario'; }
        else if ((eq.condicion||'bueno') === 'fuera') { status = 'error'; problema = 'Fuera de servicio'; }
        else if (eqEnCampo(eq)) { status = 'error'; problema = '⚠️ Ya está instalado — instalación activa detectada'; }
        else if (!caso) { status = 'error'; problema = 'Sin número SIGET (obligatorio)'; }
        else if (!fechaRetiro) { status = 'error'; problema = 'Sin fecha de retiro (obligatoria)'; }

        return { serie, caso, lugar, fechaInst, fechaRetiro, notas, lat, lng, status, problema, equipoId: eq?.id, modelo: eq?.modelo||'', vineta: eq?.vineta||'', idUsuario, direccion, accesorios, multiplicador, corrientes, conexion };
      });

      state.cargaView = 'preview';
      render();
    } catch(err) {
      showToast('❌ Error al leer el archivo: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
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
  showToast('✅ ' + count + ' instalaciones registradas');
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
