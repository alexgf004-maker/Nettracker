// Punto de entrada: registra los handlers globales (window.*) y arranca la app.
import './handlers/general.js';
import './handlers/instalaciones.js';
import './handlers/inventario.js';
import './handlers/validaciones.js';
import './handlers/carga.js';
import { initTheme, iniciarMonitorConexion } from './ui.js';
import { restaurarSesion } from './actions/auth.js';
import { iniciarSync } from './data/sync.js';

restaurarSesion();
iniciarSync();
initTheme();
iniciarMonitorConexion();
