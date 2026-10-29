// Handlers de la herramienta Dibujar
import * as a from '../actions/dibujo.js';

const NOMBRES = [
  'accionEtiquetaDib', 'agregarEntradaLeyendaDib', 'metrosVanoDib', 'finVanoDib', 'alFrenteDib', 'aplicarCalibracionDib', 'borrarDib', 'cancelarCalibracionDib', 'copiarDib', 'deshacerDib', 'descargarDib',
  'dibPointerDown', 'dibPointerMove', 'dibPointerUp', 'duplicarDib', 'finEdicionDib', 'finTextoDib', 'girarDib', 'leyendaColorDib', 'leyendaTextoDib',
  'nuevoLienzoDib', 'quitarEntradaLeyendaDib', 'quitarEscalaDib', 'quitarFondoDib', 'rehacerDib', 'setColorDib', 'setEstiloEtiquetaDib', 'setGrosorDib',
  'setHerramientaDib', 'setLaminaDib', 'setPrefijoDib', 'setSimboloDib', 'setTamTextoDib', 'setTipoTramoDib', 'subirFondoDib', 'tablaEncabezadoDib',
  'tablaFilasDib', 'terminarTramoDib', 'textoDib',
  'setAlturaDib', 'agregarEstructuraDib', 'agregarEstructuraEscritaDib', 'quitarEstructuraDib', 'setConductorDib', 'setCalibreVanoDib',
  'escalarTodoDib', 'girarTodoDib', 'anclarMedidasDib', 'setNotaDib', 'setOpacidadFondoDib',
  'grupoEstructurasUI', 'buscarEstructuras',
  'metrosASuLugarDib', 'setColorRedDib', 'setNombreRedDib', 'setTamanoDib', 'setTamNuevosDib', 'togglePanelDib', 'cerrarMenusDib', 'verLaminaDib', 'verCajetinDib', 'masSimbolosDib', 'aparienciaDib', 'seccionarAquiDib', 'setReferenciaDib', 'seleccionarDib', 'seccionarLadoDib', 'alimentaCorteDib', 'estructuraCorteDib', 'estrAbiertaDib', 'abrirPanelMovilDib', 'zoomDib', 'ajustarVistaDib', 'ampliarDib', 'dibRueda',
  'setAccionDib', 'setDetalleAccionDib', 'setKvaDib', 'setReemplazoConductorDib', 'setReemplazoAlturaDib', 'agregarReemplazoEstructuraDib', 'agregarReemplazoEstructuraEscritaDib', 'quitarReemplazoEstructuraDib', 'setReemplazoKvaDib', 'marcarTrasladoDib', 'cancelarTrasladoDib', 'quitarTrasladoDib', 'setTrabajoDib', 'ocultarTrabajoDib', 'agregarTrabajoDib', 'setTrabajoExtraDib', 'quitarTrabajoExtraDib', 'descargarPropuestaDib',
  'setVistaProyectosDib', 'guardarProyectoDib', 'guardarComoProyectoDib', 'abrirProyectoDib', 'eliminarProyectoDib', 'soltarProyectoDib',
];
NOMBRES.forEach(n => { window[n] = a[n]; });
a.instalarAltoDib();
