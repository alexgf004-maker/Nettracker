// Handlers de la herramienta Dibujar
import * as a from '../actions/dibujo.js';

const NOMBRES = [
  'accionEtiquetaDib', 'agregarEntradaLeyendaDib', 'metrosVanoDib', 'finVanoDib', 'alFrenteDib', 'aplicarCalibracionDib', 'borrarDib', 'cancelarCalibracionDib', 'copiarDib', 'deshacerDib', 'descargarDib',
  'dibPointerDown', 'dibPointerMove', 'dibPointerUp', 'duplicarDib', 'finEdicionDib', 'finTextoDib', 'girarDib', 'leyendaColorDib', 'leyendaTextoDib',
  'nuevoLienzoDib', 'quitarEntradaLeyendaDib', 'quitarEscalaDib', 'quitarFondoDib', 'rehacerDib', 'setColorDib', 'setEstiloEtiquetaDib', 'setGrosorDib',
  'setHerramientaDib', 'setLaminaDib', 'setPrefijoDib', 'setSimboloDib', 'setTamTextoDib', 'setTipoTramoDib', 'subirFondoDib', 'tablaEncabezadoDib',
  'tablaFilasDib', 'terminarTramoDib', 'textoDib',
  'setAlturaDib', 'agregarEstructuraDib', 'agregarEstructuraEscritaDib', 'quitarEstructuraDib', 'setConductorDib', 'setCalibreVanoDib',
  'metrosASuLugarDib', 'setColorRedDib', 'setNombreRedDib', 'setTamanoDib', 'setTamNuevosDib', 'togglePanelDib', 'abrirPanelMovilDib', 'zoomDib', 'ajustarVistaDib', 'ampliarDib', 'dibRueda',
  'setVistaProyectosDib', 'guardarProyectoDib', 'guardarComoProyectoDib', 'abrirProyectoDib', 'eliminarProyectoDib', 'soltarProyectoDib',
];
NOMBRES.forEach(n => { window[n] = a[n]; });
a.instalarAltoDib();
