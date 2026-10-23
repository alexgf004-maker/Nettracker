// Arrastrar y soltar (o pegar con Ctrl+V) archivos en cualquier lugar donde la app pide subir uno (pedido del equipo).
// No cambia cada pantalla: busca los <input type="file"> que se ven y, al soltar o pegar, les pone los archivos y
// dispara su "change", como si se hubieran elegido con el botón. Si hay varios, va al que está debajo del cursor o
// al más cercano que acepte ese tipo de archivo (dentro de la ventana abierta, si hay una).
import { showToast } from './ui.js';

const zonaDe = input => input.closest('label') || input.parentElement;
const seVe = el => !!el && el.getClientRects().length > 0;

// ¿El input acepta este archivo? (por extensión o tipo, según su accept)
export function acepta(accept, archivo) {
  const lista = String(accept || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!lista.length) return true;
  const nombre = String(archivo.name || '').toLowerCase(); const tipo = String(archivo.type || '').toLowerCase();
  return lista.some(a => (a.startsWith('.') ? nombre.endsWith(a) : a.endsWith('/*') ? tipo.startsWith(a.slice(0, -1)) : tipo === a));
}

// Inputs de archivo que se ven y aceptan alguno de los archivos (los de la ventana abierta, si hay una)
function candidatos(archivos) {
  const modales = [...document.querySelectorAll('.modal-overlay')].filter(seVe);
  const raiz = modales.at(-1) || document;
  return [...raiz.querySelectorAll('input[type="file"]')].filter(i => !i.disabled && seVe(zonaDe(i)) && (!archivos || archivos.some(f => acepta(i.accept, f))));
}

// El input que corresponde a un punto de la pantalla: el de la zona que está debajo o el más cercano
function elegir(lista, x, y, debajo) {
  const directo = debajo instanceof Node ? lista.find(i => zonaDe(i).contains(debajo)) : null;
  if (directo || lista.length <= 1) return directo || lista[0] || null;
  const dist = i => { const r = zonaDe(i).getBoundingClientRect(); const dx = Math.max(r.left - x, 0, x - r.right); const dy = Math.max(r.top - y, 0, y - r.bottom); return Math.hypot(dx, dy); };
  return [...lista].sort((a, b) => dist(a) - dist(b))[0];
}

// Pone los archivos en el input y avisa a la pantalla como si se hubieran elegido con el botón
export function entregarArchivos(input, archivos) {
  const validos = archivos.filter(f => acepta(input.accept, f));
  if (!validos.length) return showToast('Ese tipo de archivo no va aquí');
  const dt = new DataTransfer();
  (input.multiple ? validos : validos.slice(0, 1)).forEach(f => dt.items.add(f));
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  if (validos.length < archivos.length) showToast(`Se tomaron ${dt.files.length} de ${archivos.length} archivos (los demás no son del tipo que se pide aquí)`);
}

const conArchivos = e => [...(e.dataTransfer?.types || [])].includes('Files');
let marcadas = [];
function marcar(lista, activo) {
  const zonas = lista.map(zonaDe);
  marcadas.filter(z => !zonas.includes(z)).forEach(z => z.classList.remove('zona-archivo', 'zona-archivo-activa'));
  zonas.forEach(z => { z.classList.add('zona-archivo'); z.classList.toggle('zona-archivo-activa', !!activo && z === zonaDe(activo)); });
  marcadas = zonas;
  document.body.classList.toggle('arrastrando-archivo', zonas.length > 0);
}
const limpiar = () => marcar([], null);

let puntero = { x: 0, y: 0 };
export function instalarArrastrar() {
  window.addEventListener('pointermove', e => { puntero = { x: e.clientX, y: e.clientY }; }, { passive: true });
  window.addEventListener('dragover', e => {
    if (!conArchivos(e)) return;
    e.preventDefault(); // sin esto el navegador abre el archivo en lugar de soltarlo en la app
    const lista = candidatos(null); const destino = elegir(lista, e.clientX, e.clientY, e.target);
    e.dataTransfer.dropEffect = destino ? 'copy' : 'none';
    marcar(lista, destino);
  });
  window.addEventListener('dragleave', e => { if (!e.relatedTarget) limpiar(); });
  window.addEventListener('drop', e => {
    if (!conArchivos(e)) return;
    e.preventDefault(); limpiar();
    const archivos = [...e.dataTransfer.files]; if (!archivos.length) return;
    const destino = elegir(candidatos(archivos), e.clientX, e.clientY, e.target);
    if (!destino) return showToast('Aquí no se sube ese tipo de archivo');
    entregarArchivos(destino, archivos);
  });
  // Pegar archivos (p. ej. una captura de pantalla o un archivo copiado): va al lugar donde está el cursor
  window.addEventListener('paste', e => {
    const archivos = [...(e.clipboardData?.files || [])]; if (!archivos.length) return;
    const destino = elegir(candidatos(archivos), puntero.x, puntero.y, document.elementFromPoint(puntero.x, puntero.y));
    if (!destino) return; // nada que subir en esta pantalla: el pegado sigue normal
    e.preventDefault();
    entregarArchivos(destino, archivos);
  });
}
