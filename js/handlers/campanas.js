// Handlers de la precampaña (importar listados, completar datos, editar casos)
import {
  abrirCaso, abrirImportListados, cerrarCaso, completarCoordenadasBase, cerrarImportListados, exportarListado, guardarCaso, guardarImportListados,
  leerListadosEnte, procesarListados, subirArchivoCampana,
} from '../actions/campanas.js';
import {
  abrirConfigCartas, abrirDocumentos, cargarLogo, cerrarConfigCartas, cerrarDocumentos, desmarcarPaso, excluirTodos, generarDocumentos,
  guardarConfigCartas, marcarPaso, toggleExcluirCaso,
} from '../actions/documentos.js';
import { abrirMultiplicador, cerrarMultiplicador, exportarMultiplicadores, guardarMultiplicador, usarHistorico } from '../actions/multiplicadores.js';
import { asignarEquipo, asignarFecha, cerrarProgramacion, enviarFechaADespachos, exportarFecha, guardarProgramacion, importarProgramacion, procesarProgramacion, setDatoFecha } from '../actions/fechas.js';
import { abrirResultado, analizarArchivos, analizarTXT, cerrarAnalisis, cerrarResultado, exportarAnalisis, exportarCuadroResumen, guardarAnalisis, guardarResultado, recalcularTXT } from '../actions/resultados.js';
import { abrirFT, agregarNotaFT, cerrarFT, marcarAvisoFT, quitarAvisoFT, setCompensacionFT, setRemedicionFT, setRutaFT } from '../actions/ft.js';
import { codigoConSistema } from '../domain/listados.js';
import { state } from '../state.js';
import { htmlCalculo } from '../views/multiplicadores.js';
import { render } from '../views/render.js';

Object.assign(window, {
  abrirImportListados, cerrarImportListados, leerListadosEnte, procesarListados, guardarImportListados,
  subirArchivoCampana, completarCoordenadasBase, exportarListado, abrirCaso, cerrarCaso, guardarCaso,
  abrirDocumentos, cerrarDocumentos, generarDocumentos, toggleExcluirCaso, excluirTodos, marcarPaso, desmarcarPaso,
  abrirConfigCartas, cerrarConfigCartas, guardarConfigCartas, cargarLogo,
});
window.setDocsField = (k, v) => { state.docsForm[k] = v; };
window.setConfigCartasField = (k, v) => { state.configCartasForm[k] = v; };
window.quitarLogo = () => { state.configCartasForm.logo = ''; render(); };

window.setCasosFiltro = f => { state.casosFiltro = f; render(); };
window.setCasosBusqueda = v => { state.casosBusqueda = v; render(); };
// Los campos de texto no redibujan para no perder el foco
window.setCasoField = (k, v) => { state.casoForm[k] = v; };
window.setCasoSistema = s => { state.casoForm.codigo = codigoConSistema(state.casoForm.codigo, s); render(); };

// Multiplicadores
Object.assign(window, { abrirMultiplicador, cerrarMultiplicador, guardarMultiplicador, usarHistorico, exportarMultiplicadores });
window.setCampanaVista = v => { state.campanaVista = v; render(); };
window.setMultFiltro = f => { state.multFiltro = f; render(); };
window.setMultSelect = (k, v) => { state.multForm[k] = v; render(); };
// Mientras se escribe solo se actualiza el cálculo, para no perder el foco
window.setMultField = (k, v) => {
  state.multForm[k] = v;
  const el = document.getElementById('mult-calculo');
  if (el) el.innerHTML = htmlCalculo(state.multForm);
};

// Fechas 1, 2 y 3
Object.assign(window, { asignarFecha, asignarEquipo, setDatoFecha, exportarFecha, enviarFechaADespachos, importarProgramacion, procesarProgramacion, guardarProgramacion, cerrarProgramacion });

// Resultados
Object.assign(window, { abrirResultado, cerrarResultado, guardarResultado, exportarCuadroResumen, analizarTXT, analizarArchivos, recalcularTXT, cerrarAnalisis, guardarAnalisis, exportarAnalisis });
window.setResultadoOpcion = (k, v) => { state.resultadoForm[k] = v; render(); };
window.setResultadoField = (k, v) => { state.resultadoForm[k] = v; };

// Seguimiento FT
Object.assign(window, { abrirFT, cerrarFT, marcarAvisoFT, quitarAvisoFT, setRutaFT, setCompensacionFT, agregarNotaFT, setRemedicionFT });
window.setFTNota = v => { state.ftNota = v; };
