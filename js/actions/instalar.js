// Instalar la app en el celular o la compu (PWA): botón "Instalar app" y service worker.
// Android y la compu (Chrome/Edge) dan el aviso de instalación; en iPhone es manual (Compartir → Agregar a inicio).
import { state } from '../state.js';
import { showToast } from '../ui.js';
import { render } from '../views/render.js';

let aviso = null; // evento beforeinstallprompt guardado para abrir el aviso cuando la persona toque el botón

export const esInstalada = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
export const esIPhone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// El botón se muestra mientras la app no esté instalada (si el navegador no da el aviso, se explican los pasos)
export const mostrarInstalar = () => !esInstalada();

export function iniciarInstalacion() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); aviso = e; });
  window.addEventListener('appinstalled', () => { aviso = null; showToast('App instalada'); render(); });
  // El service worker solo en el sitio publicado: en local y en las pruebas guardaría versiones viejas
  if ('serviceWorker' in navigator && !/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) navigator.serviceWorker.register('sw.js').catch(() => {});
}

export async function instalarApp() {
  state.showMas = false; state.menuPerfil = false;
  if (aviso) {
    const e = aviso; aviso = null;
    render();
    e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome !== 'accepted') aviso = null;
    return;
  }
  state.ayudaInstalar = esIPhone() ? 'iphone' : 'otro';
  render();
}
export function cerrarAyudaInstalar() { state.ayudaInstalar = null; render(); }
