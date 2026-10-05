// Piezas visuales comunes de las pantallas (encabezado de sección con degradado y onda)
import { escapeHtml } from '../utils.js';

const esc = s => escapeHtml(s ?? '');

// Encabezado de una sección. kpis: [{ v, l, alerta, onclick }]; derecha y acciones son HTML ya armado.
export function heroSeccion({ eyebrow = '', titulo, sub = '', derecha = '', kpis = [], acciones = '', rojo = false }) {
  let html = `<div class="hero ${rojo ? 'hero-rojo' : ''}"><div class="hero-top"><div>${eyebrow ? `<div class="hero-eyebrow">${esc(eyebrow)}</div>` : ''}<h1 class="hero-titulo">${esc(titulo)}</h1>${sub ? `<div class="hero-sub">${sub}</div>` : ''}</div>${derecha ? `<div class="hero-acciones">${derecha}</div>` : ''}</div>`;
  if (kpis.length) {
    html += `<div class="hero-kpis" data-n="${kpis.length}">` + kpis.map(k => {
      const tag = k.onclick ? 'button' : 'div';
      return `<${tag} class="hero-kpi ${k.alerta ? 'alerta' : ''}" ${k.onclick ? `onclick="${k.onclick}"` : ''}><b>${k.v}</b><span>${esc(k.l)}</span></${tag}>`;
    }).join('') + '</div>';
  }
  if (acciones) html += `<div class="hero-acciones page-hero-acciones">${acciones}</div>`;
  return html + '</div>';
}

// Selector de área sobre el encabezado
export function areaHero(mia, area) {
  return `<div class="segmento"><button class="${mia ? 'active' : ''}" onclick="setAreaFiltro('mia')">${esc(area)}</button><button class="${!mia ? 'active' : ''}" onclick="setAreaFiltro('todas')">Todas las áreas</button></div>`;
}
