// Handlers del levantamiento de red en campo
import * as a from '../actions/levantamiento.js';

['crearLevantamiento', 'abrirLevantamiento', 'cerrarLevantamiento', 'eliminarLevantamiento', 'guardarDatoLev', 'marcarAqui', 'setLev', 'deshacerUltimoLev', 'deshacerMovidaLev',
  'borrarPuntoLev', 'seguirDesdeLev', 'unirConLev', 'moverAGpsLev', 'datoPuntoLev', 'datoVanoLev', 'borrarVanoLev', 'pasarADibujarLev', 'descargarKmlLev']
  .forEach(n => { window[n] = a[n]; });

a.instalarMapaLev();
