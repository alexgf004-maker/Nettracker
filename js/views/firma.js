// Recuadro para firmar con el dedo (inspección de reclamos y memos). Lo manejan firmaInicio/Mover/Fin, limpiarFirma
// y guardarFirma (actions/inspeccion.js) con state.firmaInsp.
import { cuentaFirmas, firmasDeMemo } from '../actions/firmas-memo.js';
import { state } from '../state.js';
import { escapeHtml, fmtDate } from '../utils.js';

const esc = s => escapeHtml(s ?? '');

// sub: para qué es la firma; nombre: si se pide quién firma (memos), su valor inicial
export function modalFirma(sub, { nombre = null } = {}) {
  return `<div class="modal-overlay modal-firma"><div class="modal hoja"><div class="modal-head"><div><div class="modal-titulo">Firma</div><div class="page-sub">${esc(sub)}</div></div><button class="modal-cerrar" onclick="cerrarFirma()" title="Cerrar">✕</button></div>
    ${nombre !== null ? `<div class="field"><label>Nombre de quien firma</label><input id="firma-nombre" value="${esc(nombre)}" placeholder="Nombre y apellido" oninput="setNombreFirma(this.value)"></div>` : ''}
    <canvas id="firma-canvas" class="firma-canvas" width="600" height="240" onpointerdown="firmaInicio(event)" onpointermove="firmaMover(event)" onpointerup="firmaFin(event)" onpointerleave="firmaFin(event)"></canvas>
    <div class="page-sub" style="margin:6px 0 10px">Firma con el dedo dentro del recuadro.</div>
    <div class="barra-acciones"><button class="b b-p" onclick="guardarFirma()"><i class="ic ic-check"></i> Guardar firma</button><button class="b b-g" onclick="limpiarFirma()">Borrar y repetir</button></div></div></div>`;
}

// Ventana con las firmas de un memo: cada una se firma en pantalla cuando le toca; las que falten salen en blanco
export function renderFirmasMemo() {
  const { tipo, id } = state.firmasMemo;
  const d = firmasDeMemo(tipo, id);
  if (!d) return '';
  const filas = d.roles.map(r => `<div class="firma-memo">
      <div class="firma-memo-k"><b>${esc(r.eti)}</b><span>${esc(r.de || '')}</span></div>
      ${r.firma?.img ? `<img class="insp-firma-img" src="${esc(r.firma.img)}" alt="Firma de ${esc(r.eti)}"><div class="page-sub">${esc([r.firma.nombre, fmtDate(r.firma.fecha)].filter(Boolean).join(' · '))}</div>` : '<div class="insp-firma-vacia">Sin firma: en el memo sale la línea para firmar a mano</div>'}
      <div class="barra-acciones"><button class="b b-g" onclick="firmarMemo('${r.k}')">${r.firma?.img ? 'Firmar de nuevo' : 'Firmar en pantalla'}</button>${r.firma?.img ? `<button class="b b-l" onclick="quitarFirmaMemo('${r.k}')">Quitar firma</button>` : ''}</div>
    </div>`).join('');
  return `<div class="modal-overlay" onclick="if (event.target === this) cerrarFirmasMemo()"><div class="modal hoja"><div class="modal-head"><div><div class="modal-titulo">Firmas del memo</div><div class="page-sub">${esc(d.titulo)}</div></div><button class="modal-cerrar" onclick="cerrarFirmasMemo()" title="Cerrar">✕</button></div>
    <div class="firmas-memo">${filas}</div>
    <div class="barra-acciones"><button class="b b-p" onclick="verMemoFirmado()"><i class="ic ic-archivo"></i> Ver memo con las firmas</button></div></div></div>`;
}

// Botón "Firmas 1/2" de un memo (id: el del memo; en el equipo dañado, el de la instalación)
export function botonFirmas(tipo, memo, id = memo?.id) {
  if (!memo || !id) return '';
  const { hechas, total } = cuentaFirmas(tipo, memo);
  return `<button class="b ${hechas === total ? 'b-g firmas-ok' : 'b-g'} btn-firmas" onclick="abrirFirmasMemo('${tipo}', '${id}')" aria-label="Firmas del memo"><i class="ic ic-editar"></i> Firmas ${hechas}/${total}</button>`;
}
