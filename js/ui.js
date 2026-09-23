// Utilidades de interfaz: toast, badges, abrir documentos, tema y monitor de conexión
import { state } from './state.js';

export function showToast(msg) {
  clearTimeout(state.toastTimer);
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.style.display = 'block';
  state.toastTimer = setTimeout(() => { t.style.display = 'none'; }, 3500);
}

export function abrirMemo(html) {
  abrirDoc(html, 'documento.html');
}

// ── BADGE HELPERS ──
export function badgeSt(st) {
  if (st === 'ACTIVO') return '<span class="badge badge-green">Activo</span>';
  if (st === 'PROXIMO') return '<span class="badge badge-yellow">Retiro próximo</span>';
  if (st === 'VENCIDO') return '<span class="badge badge-red badge-vencido">⚠️ Vencido</span>';
  if (st === 'PROGRAMADO') return '<span class="badge" style="background:#f3f0ff;color:#7c3aed">Programado</span>';
  return '<span class="badge badge-gray">Retirado</span>';
}

export function accentColor(st) { return st === 'ACTIVO' ? 'var(--green)' : st === 'PROXIMO' ? 'var(--yellow)' : 'var(--gray)'; }

// ── DOC HELPERS ──
export function abrirDoc(html, filename) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  setTimeout(() => {
    if (!win || win.closed) {
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }, 800);
}

export function descargarDoc(html, filename) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function initTheme() {
  try {
    const t = localStorage.getItem('cpt_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
  } catch(e) {}
}

// Indicador de conexión (punto verde/rojo del header)
export function iniciarMonitorConexion() {
  function updateDot() {
    const dot = document.getElementById('conn-dot');
    if (!dot) return;
    dot.style.background = navigator.onLine ? '#22c55e' : '#ef4444';
    dot.title = navigator.onLine ? 'Conectado' : 'Sin conexión';
  }
  window.addEventListener('online', updateDot);
  window.addEventListener('offline', updateDot);
  setInterval(updateDot, 3000);
}
