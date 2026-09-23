import { emptyEF, emptyForm } from './utils.js';

// Estado global de la app. Todo lo que cambia en pantalla vive aquí;
// después de modificarlo hay que llamar render().
export const state = {
  records: [],
  equipos: [],
  historialAccesorios: [],
  validaciones: [], // { id, nombre, fecha, tipo, usuarios: [{...datos, estado, resultado}] }
  valView: 'lista', // lista | detalle | form
  valCampanaId: null,
  valUsuarioIdx: null,
  valForm: {},
  modoMantenimiento: false,
  valTipoUsuario: 'monofasico',
  calView: false, // show calendar in dashboard
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(), // 0-indexed
  calDiaSeleccionado: null,
  showReporteModal: false,
  reporteMes: new Date().getMonth() + 1,
  reporteAnio: new Date().getFullYear(),
  reporteArea: 'TODOS',
  showValImport: false,
  valImportData: [],
  valTipo: 'monofasico',
  // ── SESSION ──
  sesionUsuario: null, // { nombre, pin }
  loginForm: { nombre: '', pin: '', error: '' },
  tab: 'dashboard',
  globalSearch: '',
  showGlobalSearch: false,
  showAlertaRetiros: false,
  mapaFiltro: 'TODOS', // TODOS | CPT MT | CPT BT | Campos y Servicios
  alertaDismissed: false,
  view: 'lista',
  editId: null,
  editEqId: null,
  filterStatus: 'TODOS',
  instTab: 'cpt_mt', // cpt_mt | cpt_bt | campos
  camposFiltro: 'TODOS', // TODOS | CPT MT | CPT BT
  search: '',
  showSelector: false,
  showDescargaModal: false,
  showPrestamoModal: false,
  showCondicionModal: false,
  showMantModal: false,
  mantEqId: null,
  mantForm: { descripcion: '', accion: '', resultado: 'pendiente', fechaInicio: '', fechaResolucion: '', observaciones: '' },
  condicionEqId: null,
  condicionForm: { condicion: 'bueno', nota: '' },
  showRevisionModal: false, // envío de equipo a revisión en Cucumacayán
  revisionEqId: null,
  revisionForm: { motivo: '', descripcion: '', fechaIncidente: '' },
  prestamoId: null,
  prestamoForm: { de: 'CPT BT', a: 'CPT MT', nota: '', tipo: 'prestamo' },
  modoSeleccionLote: false,
  cargaData: [], // preview rows from excel
  cargaView: 'upload', // upload | preview
  cargaSubView: 'subir', // subir | historial | accesorios
  despachoDetalle: null, // id of despacho being managed
  accesoriosForm: { de: 'CPT MT', para: 'Campos y Servicios', candados: '', cadenas: '', sellos: '', serieDesde: '', serieHasta: '' }, // subir | historial
  historialCargas: [],
  cargaAreaOrigen: 'CPT BT',
  showImportModal: false,
  importData: [],
  seleccionLote: [],
  tipoLote: 'prestamo',
  descargaId: null,
  descargaForm: { tecnico: 'David García', notas: '', medicionOk: null, fallasMedicion: [], descripcionFalla: '' },
  showRetiroModal: false,
  retiroId: null,
  retiroForm: { sinProblema: null, fallas: [], descripcion: '', sede: 'Plantel Central' },
  locMode: 'gps',
  selectorSearch: '',
  inventarioSearch: '',
  vistaInventario: 'lista', // lista | grid
  eqDetalleTab: 'general', // general | mantenimiento | instalaciones | movimientos
  inventarioFiltro: 'TODOS',
  form: emptyForm(),
  equipoForm: emptyEF(),
  // ── TOAST ──
  toastTimer: null,
};
