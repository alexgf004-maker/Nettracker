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
  sesionUsuario: null, // { nombre }
  tab: 'dashboard',
  showMas: false, // hoja "Más" del menú en celular
  areaFiltro: 'mia', // mia | todas (Inicio y pestañas de Trabajo)
  seguimientoDesde: null, // config/seguimientoDesde: el Inicio ignora lo vencido o retirado antes
  editandoDesde: false,
  campanas: {}, // campanas/{clave} en Firebase: { entrega: { fecha, por } }
  campanaClave: null, // campaña abierta en la pestaña Campañas
  // Precampaña
  showImportListados: false,
  importListados: null, // { archivos, campanas, avisos } antes de guardar
  casosFiltro: 'todos', // todos | CR | DA | DF | faltantes
  casosBusqueda: '',
  casoEdit: null, // { clave, id }
  campanaVista: 'precampana', // precampana | casos | multiplicadores | fechas | mediciones
  multFiltro: 'todos', // todos | listos | por_resolver | no_se_miden
  multEdit: null, // { clave, id }
  multForm: {},
  importProgramacion: null, // vista previa del Excel de programación de instalaciones
  casoForm: {},
  configCartas: null, // config/cartas: firmante, contacto, contratista y logo
  showConfigCartas: false,
  configCartasForm: {},
  docsModal: null, // { clave, tipo: 'cartas' | 'hojas' }
  docsForm: { fecha: '', periodo: '', excluidos: {} },
  volverA: null, // { tab, campanaClave } para regresar desde el detalle de una instalación
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
  revisionFichaIdx: null, // índice de la ficha cuando se edita un envío ya registrado
  revisionForm: { motivo: '', descripcion: '', fechaIncidente: '' },
  showDanioModal: false, // memo de equipo dañado en campo (Campos y Servicios)
  danioId: null,
  danioEditando: false,
  danioForm: { fechaDanio: '', descripcion: '', condicion: 'detalles', tecnicoCampos: '' },
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
