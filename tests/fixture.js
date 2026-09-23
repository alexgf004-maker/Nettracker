module.exports = {
  analizadores: {
    r1: { serie: 'SN-100', modelo: 'PQ-1', caso: 'C-001', lugar: 'Col. Escalón', lat: 13.70, lng: -89.24, fechaInstalacion: '2026-09-01', fechaRetiro: '2026-10-10', areaInstalacion: 'CPT MT', equipoId: 'e1', creadoPor: 'David García', fechaRegistro: '2026-09-01T10:00', sede: 'Plantel Central', energiaTipoInst: 'una', energiaInstUna: '123', notas: 'nota 1' },
    r2: { serie: 'SN-101', modelo: 'PQ-1', caso: 'C-002', lugar: 'Santa Tecla', lat: 13.67, lng: -89.28, fechaInstalacion: '2026-09-10', fechaRetiro: '2026-09-25', areaInstalacion: 'CPT MT', equipoId: 'e2', creadoPor: 'Bryan Francia', fechaRegistro: '2026-09-10T10:00' },
    r3: { serie: 'SN-102', modelo: 'PQ-2', caso: 'C-003', lugar: 'Soyapango', lat: 13.71, lng: -89.14, fechaInstalacion: '2026-08-01', fechaRetiro: '2026-09-01', areaInstalacion: 'CPT BT', equipoId: 'e3', creadoPor: 'Vicente Ramos', fechaRegistro: '2026-08-01T10:00' },
    r4: { serie: 'SN-103', modelo: 'PQ-2', caso: 'C-004', lugar: 'Apopa', fechaInstalacion: '2026-07-01', fechaRetiro: '2026-07-20', areaInstalacion: 'CPT MT', equipoId: 'e4', retirado: true, fechaRetiroReal: '2026-07-21', sinProblema: false, fallas: ['LED intermitente', 'No agarra WiFi'], descripcionFalla: 'Se apaga solo', retiradoPor: 'David García', fechaRegistro: '2026-07-01T10:00' },
    r5: { serie: 'SN-104', modelo: 'PQ-1', caso: 'C-005', lugar: 'Ilopango', lat: 13.69, lng: -89.1, fechaInstalacion: '2026-10-01', fechaRetiro: '2026-10-20', areaInstalacion: 'Campos y Servicios', areaBeneficiaria: 'CPT BT', equipoId: 'e5', creadoPor: 'Francisco Chulo', fechaRegistro: '2026-09-20', despachoId: 'hc1' },
    r6: { serie: 'SN-106', modelo: 'PQ-1', caso: 'C-006', lugar: 'Zaragoza', fechaInstalacion: '2026-08-10', fechaRetiro: '2026-09-10', areaInstalacion: 'Campos y Servicios', areaBeneficiaria: 'CPT MT', equipoId: 'e7', creadoPor: 'David García', fechaRegistro: '2026-08-10T10:00',
      retirado: true, fechaRetiroReal: '2026-09-12', sinProblema: false, fallas: ['No enciende / Sin señales de vida'], descripcionFalla: 'Carcasa quebrada', retiradoPor: 'Bryan Francia' },
  },
  equipos: {
    e1: { serie: 'SN-100', modelo: 'PQ-1', sede: 'Plantel Central', condicion: 'bueno', vineta: 'V1', fechaRegistro: '2026-01-01', creadoPor: 'David García',
      movimientos: [{ tipo: 'prestamo', de: 'CPT MT', a: 'CPT BT', fecha: '2026-02-01', hora: '10:00', nota: 'n', registradoPor: 'David García' }, { tipo: 'devolucion', de: 'CPT BT', a: 'CPT MT', fecha: '2026-03-01' }],
      historialMantenimiento: [{ descripcion: 'd', accion: 'a', resultado: 'resuelto', fechaInicio: '2026-04-01', fechaResolucion: '2026-04-05', observaciones: 'o', registradoPor: 'David García' }],
      historialCondicion: [{ condicion: 'regular', nota: 'rayado', fecha: '2026-05-01', registradoPor: 'Bryan Francia' }] },
    e2: { serie: 'SN-101', modelo: 'PQ-1', sede: 'Plantel Central', condicion: 'bueno' },
    e3: { serie: 'SN-102', modelo: 'PQ-2', sede: 'Subestación Cucumacayán', condicion: 'regular' },
    e4: { serie: 'SN-103', modelo: 'PQ-2', sede: 'Plantel Central', condicion: 'malo', prestado: true, prestadoA: 'CPT BT' },
    e5: { serie: 'SN-104', modelo: 'PQ-1', sede: 'Con Campos y Servicios', condicion: 'bueno' },
    e6: { serie: 'SN-105', modelo: 'PQ-3', sede: 'Plantel Central', condicion: 'bueno' },
    e7: { serie: 'SN-106', modelo: 'PQ-1', sede: 'Plantel Central', condicion: 'bueno', vineta: 'V7' },
  },
  validaciones: {
    v1: { nombre: 'Campaña Sept', fecha: '2026-09-15', tipo: 'monofasico', creadoPor: 'David García', usuarios: [
      { nombre: 'Usuario A', medidor: 'M1', ct: 'CT1', siget: 'S1' },
      { nombre: 'Usuario B', medidor: 'M2', ct: 'CT2', siget: 'S2', estado: 'validado', resultado: 'ok', validadoPor: 'David García', fechaValidacion: '2026-09-16', formData: { refVP: '13200', refVS: '240', refTap: '13200', cpVP: '13200', cpVS: 'otro', cpVSOtro: 250, refLec: '240', cpLec: '239' } },
      { nombre: 'Usuario C', medidor: 'M3', ct: 'CT3', siget: 'S3', estado: 'fallido', resultado: 'fail' } ] },
  },
  historialCargas: {
    hc1: { fecha: '2026-09-20', hora: '09:00', areaOrigen: 'CPT MT', total: 1, realizadoPor: 'David García', instalacionIds: ['r5'], memoHtml: '<html><body>memo</body></html>' },
  },
  historialAccesorios: {
    ha1: { fecha: '2026-09-18', hora: '08:00', de: 'CPT MT', para: 'Campos y Servicios', items: [{ nombre: 'Candados', cantidad: 3, detalle: '' }] },
  },
  config: { mantenimiento: false },
};
