// Ventana para registrar descargas en bloque (ver actions/descargas.js)
import { TECNICOS } from '../config.js';
import { FALLAS_MEDICION } from '../actions/descargas.js';
import { state } from '../state.js';
import { escapeHtml, fmtDate } from '../utils.js';

const esc = s => escapeHtml(s ?? '');

export function renderDescargaBloque() {
  const b = state.descargaBloque;
  const regs = b.ids.map(id => state.records.find(r => r.id === id)).filter(Boolean);
  const n = regs.filter(r => b.sel[r.id]).length;
  let html = '<div class="modal-overlay" onclick="if (event.target === this) cerrarDescargaBloque()"><div class="modal hoja desc-bloque" role="dialog" aria-label="Registrar descargas">';
  html += `<div class="modal-head"><div><div class="modal-titulo">Registrar descargas</div><div class="page-sub">${esc(b.titulo)} · ${regs.length} ${regs.length === 1 ? 'equipo' : 'equipos'} por descargar</div></div><button class="modal-cerrar" onclick="cerrarDescargaBloque()" title="Cerrar">✕</button></div>`;
  html += `<div class="field"><label>¿Quién hizo la descarga?</label><div class="segmento segmento-ancho desc-tecnicos">${TECNICOS.map(t => `<button class="${b.tecnico === t ? 'active' : ''}" onclick="datoDescargaBloque('tecnico', '${esc(t)}')">${esc(t.split(' ')[0])}</button>`).join('')}</div></div>`;
  html += `<div class="desc-cab"><span>Marca los equipos descargados. Si una medición tuvo fallo, elígelo en su fila.</span>
    <span class="desc-todos"><button class="btn-link" onclick="todosDescargaBloque(true)">Todos</button><button class="btn-link" onclick="todosDescargaBloque(false)">Ninguno</button></span></div>`;
  html += '<div class="desc-lista">';
  regs.forEach(r => {
    const sel = !!b.sel[r.id]; const fallo = b.fallo[r.id] || '';
    html += `<div class="desc-fila ${sel ? '' : 'apagada'} ${fallo ? 'con-fallo' : ''}">
      <label class="desc-check"><input type="checkbox" ${sel ? 'checked' : ''} onchange="toggleDescargaBloque('${r.id}')" aria-label="Descargar ${esc(r.serie)}">
        <span class="desc-tx"><b>${esc(r.serie)}</b><small>${esc(r.caso)}${r.lugar ? ' · ' + esc(r.lugar) : ''}</small>
        <small>${r.retirado ? `Retirado ${fmtDate(r.fechaRetiroReal)} · descarga pendiente` : `En campo · retiro ${fmtDate(r.fechaRetiro)}`}${r.descargas?.length ? ` · ${r.descargas.length} ${r.descargas.length === 1 ? 'descarga previa' : 'descargas previas'}` : ''}</small></span></label>
      <select class="desc-fallo" aria-label="Resultado de ${esc(r.serie)}" ${sel ? '' : 'disabled'} onchange="falloDescargaBloque('${r.id}', this.value)">
        <option value="">Medición correcta</option>${FALLAS_MEDICION.map(f => `<option ${fallo === f ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select>
    </div>`;
  });
  html += '</div>';
  html += `<div class="field" style="margin-top:10px"><label>Notas (para todos, opcional)</label><input value="${esc(b.notas)}" oninput="datoDescargaBloque('notas', this.value)" placeholder="Observaciones"></div>`;
  html += `<button class="btn btn-primary" ${n ? '' : 'disabled'} onclick="guardarDescargaBloque()"><i class="ic ic-descargar"></i> Registrar ${n} ${n === 1 ? 'descarga' : 'descargas'}</button>`;
  html += '<button class="btn btn-secondary" onclick="cerrarDescargaBloque()">Cancelar</button>';
  return html + '</div></div>';
}
