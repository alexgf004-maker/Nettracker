// Datos completamente sintéticos: no representan clientes, ubicaciones ni mediciones reales.
module.exports = {
  analizadores: {
    r1: { serie: 'SN-100', modelo: 'PQ-1', caso: 'C-001', caseId: 'c1', lugar: 'Sitio de prueba A', lat: 0.10, lng: -0.10, fechaInstalacion: '2026-09-01', fechaRetiro: '2026-10-10', areaInstalacion: 'CPT MT', equipoId: 'e1', creadoPor: 'Usuario de prueba', fechaRegistro: '2026-09-01T10:00', sede: 'Plantel Central', energiaTipoInst: 'una', energiaInstUna: '123', notas: 'nota 1' },
    r2: { serie: 'SN-101', modelo: 'PQ-1', caso: 'C-002', caseId: 'c2', lugar: 'Sitio de prueba B', lat: 0.20, lng: -0.20, fechaInstalacion: '2026-09-10', fechaRetiro: '2026-09-25', areaInstalacion: 'CPT MT', equipoId: 'e2', creadoPor: 'Usuario de prueba', fechaRegistro: '2026-09-10T10:00' },
    r3: { serie: 'SN-102', modelo: 'PQ-2', caso: 'C-003', lugar: 'Sitio de prueba C', lat: 0.30, lng: -0.30, fechaInstalacion: '2026-08-01', fechaRetiro: '2026-09-01', areaInstalacion: 'CPT BT', equipoId: 'e3', creadoPor: 'Usuario de prueba', fechaRegistro: '2026-08-01T10:00' },
    r4: { serie: 'SN-103', modelo: 'PQ-2', caso: 'C-004', lugar: 'Sitio de prueba D', fechaInstalacion: '2026-07-01', fechaRetiro: '2026-07-20', areaInstalacion: 'CPT MT', equipoId: 'e4', retirado: true, fechaRetiroReal: '2026-07-21', sinProblema: false, fallas: ['LED intermitente', 'No agarra WiFi'], descripcionFalla: 'Se apaga solo', retiradoPor: 'Usuario de prueba', fechaRegistro: '2026-07-01T10:00' },
    r5: { serie: 'SN-104', modelo: 'PQ-1', caso: 'C-005', lugar: 'Sitio de prueba E', lat: 0.40, lng: -0.40, fechaInstalacion: '2026-10-01', fechaRetiro: '2026-10-20', areaInstalacion: 'Campos y Servicios', areaBeneficiaria: 'CPT BT', equipoId: 'e5', creadoPor: 'Usuario de prueba', fechaRegistro: '2026-09-20', despachoId: 'hc1' },
    r6: { serie: 'SN-106', modelo: 'PQ-1', caso: 'C-006', lugar: 'Sitio de prueba F', fechaInstalacion: '2026-08-10', fechaRetiro: '2026-09-10', areaInstalacion: 'Campos y Servicios', areaBeneficiaria: 'CPT MT', equipoId: 'e7', creadoPor: 'Usuario de prueba', fechaRegistro: '2026-08-10T10:00',
      retirado: true, fechaRetiroReal: '2026-09-12', sinProblema: false, fallas: ['No enciende / Sin señales de vida'], descripcionFalla: 'Carcasa quebrada', retiradoPor: 'Usuario de prueba' },
  },
  cases: {
    c1: { code: 'C-001', normalizedCode: 'C-001', workflowType: 'special', caseType: 'SPECIAL', ownerArea: 'CPT MT', lifecycleStatus: 'measuring', placeSnapshot: 'Sitio de prueba A', createdBy: 'Usuario de prueba', updatedAt: 1 },
    c2: { code: 'C-002', normalizedCode: 'C-002', workflowType: 'special', caseType: 'SPECIAL', ownerArea: 'CPT MT', lifecycleStatus: 'measuring', placeSnapshot: 'Sitio de prueba B', createdBy: 'Usuario de prueba', updatedAt: 2 },
  },
  caseCodeIndex: { 'C-001': 'c1', 'C-002': 'c2' },
  equipmentEvents: {
    ev1: { type: 'installed', equipmentId: 'e1', caseId: 'c1', caseCode: 'C-001', installationId: 'r1', eventDate: '2026-09-01', occurredAt: 1, actorName: 'Usuario de prueba', location: 'Sitio de prueba A', notes: 'Instalación registrada' },
  },
  equipos: {
    e1: { serie: 'SN-100', modelo: 'PQ-1', sede: 'Plantel Central', condicion: 'bueno', vineta: 'V1', fechaRegistro: '2026-01-01', creadoPor: 'Usuario de prueba',
      movimientos: [{ tipo: 'prestamo', de: 'CPT MT', a: 'CPT BT', fecha: '2026-02-01', hora: '10:00', nota: 'n', registradoPor: 'Usuario de prueba' }, { tipo: 'devolucion', de: 'CPT BT', a: 'CPT MT', fecha: '2026-03-01' }],
      historialMantenimiento: [{ descripcion: 'd', accion: 'a', resultado: 'resuelto', fechaInicio: '2026-04-01', fechaResolucion: '2026-04-05', observaciones: 'o', registradoPor: 'Usuario de prueba' }],
      historialCondicion: [{ condicion: 'regular', nota: 'rayado', fecha: '2026-05-01', registradoPor: 'Usuario de prueba' }] },
    e2: { serie: 'SN-101', modelo: 'PQ-1', sede: 'Plantel Central', condicion: 'bueno' },
    e3: { serie: 'SN-102', modelo: 'PQ-2', sede: 'Subestación Cucumacayán', condicion: 'regular' },
    e4: { serie: 'SN-103', modelo: 'PQ-2', sede: 'Plantel Central', condicion: 'malo', prestado: true, prestadoA: 'CPT BT' },
    e5: { serie: 'SN-104', modelo: 'PQ-1', sede: 'Subestación Cucumacayán', condicion: 'bueno', prestado: true, prestadoFecha: '2026-09-20',
      movimientos: [{ tipo: 'prestamo', de: 'CPT MT', a: 'Campos y Servicios', fecha: '2026-09-20', nota: 'Asignación carga masiva - Caso #C-005' }] },
    e6: { serie: 'SN-105', modelo: 'PQ-3', sede: 'Plantel Central', condicion: 'bueno' },
    e7: { serie: 'SN-106', modelo: 'PQ-1', sede: 'Plantel Central', condicion: 'bueno', vineta: 'V7' },
  },
  validaciones: {
    v1: { nombre: 'Campaña de prueba', fecha: '2026-09-15', tipo: 'monofasico', creadoPor: 'Usuario de prueba', usuarios: [
      { nombre: 'Usuario A', medidor: 'M1', ct: 'CT1', siget: 'S1' },
      { nombre: 'Usuario B', medidor: 'M2', ct: 'CT2', siget: 'S2', estado: 'validado', resultado: 'ok', validadoPor: 'Usuario de prueba', fechaValidacion: '2026-09-16', formData: { refVP: '13200', refVS: '240', refTap: '13200', cpVP: '13200', cpVS: 'otro', cpVSOtro: 250, refLec: '240', cpLec: '239' } },
      { nombre: 'Usuario C', medidor: 'M3', ct: 'CT3', siget: 'S3', estado: 'fallido', resultado: 'fail' } ] },
  },
  historialCargas: {
    hc1: { fecha: '2026-09-20', hora: '09:00', areaOrigen: 'CPT MT', total: 1, realizadoPor: 'Usuario de prueba', instalacionIds: ['r5'], memoHtml: '<html><body>memo</body></html>' },
  },
  historialAccesorios: {
    ha1: { fecha: '2026-09-18', hora: '08:00', de: 'CPT MT', para: 'Campos y Servicios', items: [{ nombre: 'Candados', cantidad: 3, detalle: '' }] },
  },
  config: { mantenimiento: false },
};
