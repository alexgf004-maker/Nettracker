// Punto de entrada: registra los handlers globales (window.*) y arranca la app.
import './handlers/general.js';
import './handlers/instalaciones.js';
import './handlers/inventario.js';
import './handlers/validaciones.js';
import './handlers/carga.js';
import './handlers/campanas.js';
import { initTheme, iniciarMonitorConexion } from './ui.js';
import { iniciarAuth } from './actions/auth.js';

iniciarAuth(); // con sesión, arranca la sincronización con la base
initTheme();
iniciarMonitorConexion();
