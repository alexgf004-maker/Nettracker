// Punto de entrada: registra los handlers globales (window.*) y arranca la app.
import './handlers/general.js';
import './handlers/instalaciones.js';
import './handlers/inventario.js';
import './handlers/validaciones.js';
import './handlers/carga.js';
import './handlers/campanas.js';
import './handlers/dibujo.js';
import './handlers/levantamiento.js';
import { initTheme, iniciarMonitorConexion } from './ui.js';
import { iniciarAuth } from './actions/auth.js';
import { cerrarAyudaInstalar, iniciarInstalacion, instalarApp } from './actions/instalar.js';
import { instalarArrastrar } from './arrastrar.js';

Object.assign(window, { instalarApp, cerrarAyudaInstalar });
iniciarInstalacion(); // aviso de instalación y service worker
iniciarAuth(); // con sesión, arranca la sincronización con la base
initTheme();
iniciarMonitorConexion();
instalarArrastrar(); // arrastrar y soltar o pegar archivos donde se pide subir uno
