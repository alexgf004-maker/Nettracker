// Handlers del levantamiento de red en campo
import * as a from '../actions/levantamiento.js';

['crearLevantamiento', 'abrirLevantamiento', 'cerrarLevantamiento', 'eliminarLevantamiento', 'guardarDatoLev', 'marcarAqui', 'setLev', 'deshacerUltimoLev', 'deshacerMovidaLev',
  'borrarPuntoLev', 'alturaPuntoLev', 'agregarEstructuraLev', 'agregarEstructuraEscritaLev', 'quitarEstructuraLev', 'conductorVanoLev', 'setVanoAcomLev', 'setHojaLev', 'abrirPickerLev', 'cerrarPickerLev', 'elegirLev', 'elegirPuntoLev', 'alturaYCerrarLev', 'sumarAcometidaLev', 'seguirDesdeLev', 'unirConLev', 'moverAGpsLev', 'datoPuntoLev', 'datoVanoLev', 'borrarVanoLev', 'pasarADibujarLev', 'descargarKmlLev']
  .forEach(n => { window[n] = a[n]; });

a.instalarMapaLev();
