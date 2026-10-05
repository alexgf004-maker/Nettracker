// Handlers de la precampaña (importar listados, completar datos, editar casos)
import {
  abrirCaso, abrirImportListados, cerrarCaso, cerrarImportListados, exportarListado, guardarCaso, guardarImportListados,
  leerListadosEnte, procesarListados, subirArchivoCampana,
} from '../actions/campanas.js';
import { codigoConSistema } from '../domain/listados.js';
import { state } from '../state.js';
import { render } from '../views/render.js';

Object.assign(window, {
  abrirImportListados, cerrarImportListados, leerListadosEnte, procesarListados, guardarImportListados,
  subirArchivoCampana, exportarListado, abrirCaso, cerrarCaso, guardarCaso,
});

window.setCasosFiltro = f => { state.casosFiltro = f; render(); };
window.setCasosBusqueda = v => { state.casosBusqueda = v; render(); };
// Los campos de texto no redibujan para no perder el foco
window.setCasoField = (k, v) => { state.casoForm[k] = v; };
window.setCasoSistema = s => { state.casoForm.codigo = codigoConSistema(state.casoForm.codigo, s); render(); };
