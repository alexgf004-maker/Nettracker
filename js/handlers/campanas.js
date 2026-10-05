// Handlers de la precampaña (importar listados, completar datos, editar casos)
import {
  abrirCaso, abrirImportListados, cerrarCaso, cerrarImportListados, exportarListado, guardarCaso, guardarImportListados,
  leerListadosEnte, procesarListados, subirArchivoCampana,
} from '../actions/campanas.js';
import {
  abrirConfigCartas, abrirDocumentos, cargarLogo, cerrarConfigCartas, cerrarDocumentos, desmarcarPaso, excluirTodos, generarDocumentos,
  guardarConfigCartas, marcarPaso, toggleExcluirCaso,
} from '../actions/documentos.js';
import { codigoConSistema } from '../domain/listados.js';
import { state } from '../state.js';
import { render } from '../views/render.js';

Object.assign(window, {
  abrirImportListados, cerrarImportListados, leerListadosEnte, procesarListados, guardarImportListados,
  subirArchivoCampana, exportarListado, abrirCaso, cerrarCaso, guardarCaso,
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
