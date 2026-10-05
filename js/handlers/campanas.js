// Handlers de la precampaña (importar listados, completar datos, editar casos)
import {
  abrirCaso, abrirImportListados, cerrarCaso, completarCoordenadasBase, cerrarImportListados, exportarListado, exportarMapa, guardarCaso, guardarImportListados,
  leerListadosEnte, procesarListados, subirArchivoCampana,
} from '../actions/campanas.js';
import {
  abrirConfigCartas, abrirDocumentos, cargarLogo, cerrarConfigCartas, cerrarDocumentos, desmarcarPaso, excluirTodos, generarDocumentos,
  guardarConfigCartas, marcarPaso, toggleExcluirCaso,
} from '../actions/documentos.js';
import { abrirMultiplicador, cerrarImportMultiplicadores, cerrarMultiplicador, exportarMultiplicadores, guardarImportMultiplicadores, guardarMultiplicador, importarMultiplicadores, procesarMultiplicadores, usarHistorico } from '../actions/multiplicadores.js';
import { asignarEquipo, asignarFecha, cerrarProgramacion, enviarFechaADespachos, exportarFecha, guardarProgramacion, importarProgramacion, procesarProgramacion, setDatoFecha } from '../actions/fechas.js';
import { abrirResultado, analizarArchivos, analizarTXT, cerrarAnalisis, cerrarGraficas, cerrarResultado, exportarAnalisis, exportarCuadroResumen, exportarSeries, guardarAnalisis, guardarResultado, recalcularTXT, verGraficas } from '../actions/resultados.js';
import { moverCursorGrafica, salirCursorGrafica } from '../views/graficas.js';
import { abrirAnalisisReclamo, cargarTXTReclamo, cerrarAnalisisReclamo, guardarAnalisisReclamo, setParamReclamo, setVistaReclamo, subirTXTReclamo } from '../actions/analisis-reclamo.js';
import { exportarArmonicosReclamo, exportarTensionReclamo } from '../actions/excel-reclamo.js';
import { cursorReclamo, salirCursorReclamo } from '../views/analisis-reclamo.js';
import { abrirPuntoReclamo, cerrarPuntoReclamo, desvincularPuntoReclamo, registrarPuntoReclamo, setNombrePunto, vincularPuntoReclamo } from '../actions/expedientes.js';
import { abrirExpediente, abrirNuevoReclamo, cerrarExpediente, cerrarNuevoReclamo, completarCoordenadasReclamo, eliminarExpediente, guardarDatoExpediente, guardarNuevoReclamo, leerCorreoNuevoReclamo, registrarInstalacionReclamo, setCampoNuevoReclamo, setExpedienteVista } from '../actions/expedientes.js';
import { abrirFT, agregarNotaFT, cerrarFT, marcarAvisoFT, quitarAvisoFT, setCompensacionFT, setRemedicionFT, setRutaFT } from '../actions/ft.js';
import { codigoConSistema } from '../domain/listados.js';
import { state } from '../state.js';
import { htmlCalculo } from '../views/multiplicadores.js';
import { render } from '../views/render.js';

Object.assign(window, {
  abrirImportListados, cerrarImportListados, leerListadosEnte, procesarListados, guardarImportListados,
  subirArchivoCampana, completarCoordenadasBase, exportarListado, exportarMapa, abrirCaso, cerrarCaso, guardarCaso,
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
Object.assign(window, { abrirMultiplicador, cerrarMultiplicador, guardarMultiplicador, usarHistorico, exportarMultiplicadores, importarMultiplicadores, procesarMultiplicadores, guardarImportMultiplicadores, cerrarImportMultiplicadores });
window.setCampanaVista = v => { state.campanaVista = v; render(); };
window.setMultFiltro = f => { state.multFiltro = f; render(); };
window.setResultadosFiltro = f => { state.resultadosFiltro = f; render(); };
window.verFTCampana = () => { state.campanaVista = 'resultados'; state.resultadosFiltro = 'ft'; render(); };
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

// Gráficas de voltaje y corriente
Object.assign(window, { verGraficas, cerrarGraficas, exportarSeries, moverCursorGrafica, salirCursorGrafica });

// Análisis de reclamos (macros Graficar y Armónicos)
Object.assign(window, { abrirAnalisisReclamo, cerrarAnalisisReclamo, subirTXTReclamo, cargarTXTReclamo, setParamReclamo, setVistaReclamo, guardarAnalisisReclamo, exportarTensionReclamo, exportarArmonicosReclamo, cursorReclamo, salirCursorReclamo });

// Expedientes de reclamo
Object.assign(window, { abrirNuevoReclamo, cerrarNuevoReclamo, leerCorreoNuevoReclamo, setCampoNuevoReclamo, guardarNuevoReclamo, abrirExpediente, cerrarExpediente, setExpedienteVista, guardarDatoExpediente, completarCoordenadasReclamo, registrarInstalacionReclamo, eliminarExpediente });
Object.assign(window, { abrirPuntoReclamo, cerrarPuntoReclamo, setNombrePunto, registrarPuntoReclamo, vincularPuntoReclamo, desvincularPuntoReclamo });
