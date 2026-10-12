// Handlers de la herramienta Dibujar
import * as a from '../actions/dibujo.js';

const NOMBRES = [
  'accionEtiquetaDib', 'agregarEntradaLeyendaDib', 'metrosVanoDib', 'finVanoDib', 'alFrenteDib', 'aplicarCalibracionDib', 'borrarDib', 'cancelarCalibracionDib', 'copiarDib', 'deshacerDib', 'descargarDib',
  'dibPointerDown', 'dibPointerMove', 'dibPointerUp', 'duplicarDib', 'finEdicionDib', 'finTextoDib', 'girarDib', 'leyendaColorDib', 'leyendaTextoDib',
  'nuevoLienzoDib', 'quitarEntradaLeyendaDib', 'quitarEscalaDib', 'quitarFondoDib', 'rehacerDib', 'setColorDib', 'setEstiloEtiquetaDib', 'setGrosorDib',
  'setHerramientaDib', 'setLaminaDib', 'setPrefijoDib', 'setSimboloDib', 'setTamTextoDib', 'setTipoTramoDib', 'subirFondoDib', 'tablaEncabezadoDib',
  'tablaFilasDib', 'terminarTramoDib', 'textoDib',
];
NOMBRES.forEach(n => { window[n] = a[n]; });
