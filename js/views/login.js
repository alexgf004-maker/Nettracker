// Pantallas de login y de mantenimiento
import { USUARIOS } from '../config.js';
import { state } from '../state.js';

export function renderMantenimiento(el) {
  el.innerHTML = '<div style="position:fixed;inset:0;background:#0a1628;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font)"><div style="font-size:48px;margin-bottom:20px">🔧</div><div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:8px">En mantenimiento</div><div style="font-size:14px;color:rgba(255,255,255,.5);text-align:center;max-width:280px;line-height:1.6">David está haciendo actualizaciones.<br>Vuelve en unos minutos.</div><button onclick="cerrarSesion()" style="margin-top:24px;padding:10px 24px;border:1.5px solid rgba(255,255,255,.3);border-radius:20px;background:transparent;color:rgba(255,255,255,.6);font-size:13px;cursor:pointer">← Cambiar perfil</button></div>';
}

export function renderLogin(el) {
  let html = '';
  html += `<div style="min-height:100vh;background:linear-gradient(135deg,var(--primary-dark) 0%,var(--primary) 60%,#0077cc 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 24px;font-family:var(--font)">
      <div style="margin-bottom:28px;text-align:center">
        <div style="width:72px;height:72px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);border-radius:18px;display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="2" width="18" height="20" rx="2" stroke="white" stroke-width="1.8" fill="none"/>
            <path d="M8 7h8M8 10h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M12 14l-2 4h4l-2 4" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-.5px">CPT INNOVA</div>
        <div style="font-size:13px;color:rgba(255,255,255,.6);margin-top:4px">Analizadores de Red</div>
      </div>
      <div style="background:#fff;border-radius:20px;padding:24px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:16px">¿Quién eres?</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
          ${USUARIOS.map(u => `<div onclick="selectLoginUser('${u.nombre}')" style="padding:12px 16px;border:2px solid ${state.loginForm.nombre===u.nombre?'var(--primary)':'var(--border)'};border-radius:12px;cursor:pointer;background:${state.loginForm.nombre===u.nombre?'var(--primary-light)':'#fff'};font-size:15px;font-weight:600;color:${state.loginForm.nombre===u.nombre?'var(--primary)':'var(--text2)'};transition:all .15s">${u.nombre}</div>`).join('')}
        </div>
        ${state.loginForm.nombre ? `
          <div style="margin-bottom:16px">
            <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:8px;letter-spacing:.5px">PIN DE ACCESO</div>
            <input id="pin-input" type="password" inputmode="numeric" maxlength="4" placeholder="• • • •"
              value="${state.loginForm.pin}"
              oninput="setLoginPin(this.value)"
              onkeydown="if(event.key==='Enter')doLogin()"
              style="width:100%;padding:14px;border:2px solid ${state.loginForm.error?'var(--red)':'var(--border)'};border-radius:12px;font-size:24px;font-family:var(--mono);text-align:center;outline:none;letter-spacing:8px;background:var(--bg)">
            ${state.loginForm.error ? `<div style="color:var(--red);font-size:12px;font-weight:600;margin-top:6px;text-align:center">${state.loginForm.error}</div>` : ''}
          </div>
          <button onclick="doLogin()" style="width:100%;background:linear-gradient(135deg,var(--primary),#0077cc);color:#fff;border:none;border-radius:12px;padding:14px;font-family:var(--font);font-weight:700;font-size:15px;cursor:pointer;box-shadow:var(--shadow-blue)">Entrar</button>
        ` : ''}
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
      </div>
    </div>`;
  el.innerHTML = html;
  // Focus PIN input if user selected
  if (state.loginForm.nombre) {
    const pinEl = document.getElementById('pin-input');
    if (pinEl) pinEl.focus();
  }
}
