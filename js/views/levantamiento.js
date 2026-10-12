// Pestaña Levantamiento (Herramientas): levantamientos de red en campo con GPS, guardados en la base para el equipo.
import { SIMBOLOS } from '../domain/dibujo.js';
import { listaPuntos, listaVanos, metrosDeVano, nuevaPantallaLev, resumenLevantamiento, TIPOS_PUNTO } from '../domain/levantamiento.js';
import { fmtMetros, TIPOS_TRAMO } from '../domain/plano.js';
import { CALIBRES, textoAltura, textoEstructuras, TIPOS_CONDUCTOR } from '../domain/red.js';
import { state } from '../state.js';
import { controlesPoste } from './dibujo.js';
import { escapeHtml, fmtDate } from '../utils.js';
import { heroSeccion } from './componentes.js';

const esc = s => escapeHtml(s ?? '');
const mini = k => { const s = SIMBOLOS[k]; const c = s.color || 'currentColor'; return `<svg viewBox="-2 -2 64 64" width="20" height="20" color="${c}" stroke="${c}" stroke-width="4" fill="none">${s.svg}</svg>`; };
const muestra = k => { const t = TIPOS_TRAMO[k]; return `<svg viewBox="0 0 30 10" width="30" height="10"><line x1="2" y1="5" x2="28" y2="5" stroke="${t.color}" stroke-width="${4 * t.ancho}" stroke-linecap="round" ${t.dash ? `stroke-dasharray="${t.dash.split(' ').map(v => v * 4).join(' ')}"` : ''}/></svg>`; };

export function renderLevantamientos() {
  const l = state.levId ? state.levantamientos?.[state.levId] : null;
  if (state.levId && l) return renderDetalle(state.levId, l);
  // Recién creado: el dato llega de la base en un momento
  if (state.levId && !l) return '<div class="content"><div class="empty"><div class="empty-text">Abriendo el levantamiento…</div><button class="b b-l" onclick="cerrarLevantamiento()">Volver</button></div></div>';
  const lista = Object.entries(state.levantamientos || {}).map(([id, x]) => ({ id, ...x })).sort((a, b) => String(b.creado?.fecha || '').localeCompare(String(a.creado?.fecha || '')));
  let html = '<div class="content">';
  html += heroSeccion({
    eyebrow: 'Herramientas', titulo: 'Levantamiento',
    sub: 'Levanta la red en campo con el GPS del celular: marca cada poste donde estás parado y la app traza los vanos y calcula las distancias. Queda guardado para el equipo y se pasa a Dibujar como lámina o se exporta a Google Earth.',
  });
  html += `<div class="bloque"><div class="bloque-head"><div class="bloque-titulo">Nuevo levantamiento</div></div>
    <div class="form-analisis"><div class="field"><label>Nombre</label><input id="lev-nombre" placeholder="Ej. Barrio San José, 5a calle oriente"></div>
    <div class="field"><label>Referencia (opcional)</label><input id="lev-referencia" placeholder="WO, NC, reclamo…"></div></div>
    <button class="b b-p" onclick="crearLevantamiento()"><i class="ic ic-plus"></i> Empezar levantamiento</button></div>`;
  if (!lista.length) return html + '<div class="empty"><div class="empty-text">Todavía no hay levantamientos.</div></div></div>';
  html += `<div class="list">${lista.map(x => {
    const r = resumenLevantamiento(x);
    return `<div class="camp-card lev-card" onclick="abrirLevantamiento('${x.id}')"><div class="camp-card-cuerpo">
      <div class="exp-nombre">${esc(x.nombre)}</div><div class="exp-sub">${esc([x.referencia, x.creado ? `${fmtDate(x.creado.fecha)} · ${x.creado.por}` : ''].filter(Boolean).join(' · '))}</div>
      <div class="tags" style="margin-top:8px"><span class="tg gris">${r.puntos} ${r.puntos === 1 ? 'punto' : 'puntos'}</span><span class="tg gris">${r.vanos} ${r.vanos === 1 ? 'vano' : 'vanos'}</span>${r.vanos ? `<span class="tg gris">${fmtMetros(r.metros)}</span>` : ''}</div></div></div>`;
  }).join('')}</div>`;
  return html + '</div>';
}

function renderDetalle(id, l) {
  state.lev ??= nuevaPantallaLev();
  const u = state.lev;
  const puntos = listaPuntos(l); const vanos = listaVanos(l);
  const actual = u.actual && l.puntos?.[u.actual];
  const sel = u.sel && l.puntos?.[u.sel] ? { id: u.sel, ...l.puntos[u.sel] } : null;
  const r = resumenLevantamiento(l);
  let html = '<div class="content lev-pagina">';
  html += `<div class="lev-cabecera"><button class="b b-l" onclick="cerrarLevantamiento()"><i class="ic ic-chevron-left"></i> Levantamientos</button>
    <input class="lev-titulo" id="lev-titulo" value="${esc(l.nombre)}" onchange="guardarDatoLev('nombre', this.value)" aria-label="Nombre del levantamiento">
    <input class="lev-ref" id="lev-ref" value="${esc(l.referencia || '')}" placeholder="Referencia" onchange="guardarDatoLev('referencia', this.value)" aria-label="Referencia"></div>`;

  // Controles
  html += `<div class="lev-barra lev-desliza">
    <span id="lev-gps" class="tg gris">Buscando señal GPS…</span>
    <button id="lev-seguir" class="dib-chip ${u.seguir ? 'activo' : ''}" onclick="setLev('seguir', ${!u.seguir})">Seguir mi ubicación</button>
    <div class="segmento"><button class="${u.fondo === 'calles' ? 'active' : ''}" onclick="setLev('fondo', 'calles')">Calles</button><button class="${u.fondo === 'satelite' ? 'active' : ''}" onclick="setLev('fondo', 'satelite')">Satélite</button></div>
    <div class="segmento"><button class="${u.modo === 'gps' ? 'active' : ''}" onclick="setLev('modo', 'gps')">Marcar con GPS</button><button class="${u.modo === 'tocar' ? 'active' : ''}" onclick="setLev('modo', 'tocar')">Tocando el mapa</button></div>
  </div>
  <div class="lev-barra lev-desliza"><small class="lev-eti">Punto</small>${TIPOS_PUNTO.map(k => `<button class="dib-chip ${u.tipo === k ? 'activo' : ''}" onclick="setLev('tipo', '${k}')">${mini(k)}${esc(SIMBOLOS[k].nombre)}</button>`).join('')}</div>
  <div class="lev-barra lev-desliza"><small class="lev-eti">Vano</small>${Object.keys(TIPOS_TRAMO).map(k => `<button class="dib-chip ${u.tramo === k ? 'activo' : ''}" onclick="setLev('tramo', '${k}')">${muestra(k)}${esc(TIPOS_TRAMO[k].nombre)}</button>`).join('')}
    <label class="insp-check"><input type="checkbox" id="lev-unir" ${u.unir ? 'checked' : ''} onchange="setLev('unir', this.checked)"><span>Unir al punto anterior${actual ? ` (${esc(actual.nombre)})` : ''}</span></label></div>`;

  // Acción principal
  html += `<div class="lev-accion">${u.modo === 'gps'
    ? `<span class="page-sub">Párate junto al poste y toca "Poste aquí".${actual ? ` Se une a ${esc(actual.nombre)}.` : ''}</span>`
    : '<span class="page-sub">Toca el mapa donde está el punto.</span>'}
    <button class="b b-l" onclick="deshacerUltimoLev()" ${puntos.length ? '' : 'disabled'}>Quitar el último</button>
    <span class="page-sub">${r.puntos} puntos · ${r.vanos} vanos${r.vanos ? ` · ${fmtMetros(r.metros)}` : ''}</span></div>`;
  if (u.movida && l.puntos?.[u.movida.id]) html += `<div class="alert-banner alert-yellow">${esc(u.movida.nombre || 'Punto')} movido. <button class="b b-l" onclick="deshacerMovidaLev()">Deshacer</button></div>`;
  if (u.unirDesde) html += `<div class="alert-banner alert-yellow">Toca en el mapa el punto con el que se une ${esc(l.puntos?.[u.unirDesde]?.nombre || '')}. <button class="b b-l" onclick="setLev('unirDesde', null)">Cancelar</button></div>`;

  // El mapa con el botón principal flotando encima (en campo se marca sin bajar la pantalla)
  html += `<div class="lev-mapa-caja"><div id="lev-mapa" class="lev-mapa"></div>${u.modo === 'gps' ? '<button class="b b-p lev-flotante" onclick="marcarAqui()"><i class="ic ic-map-pin"></i> Poste aquí</button>' : ''}</div>`;

  // Punto seleccionado
  if (sel) {
    html += `<div class="bloque lev-panel"><div class="bloque-head"><div class="bloque-titulo">${esc(sel.nombre || 'Punto')}</div><span class="tg gris">${sel.manual ? 'Marcado en el mapa' : sel.acc ? `GPS ±${Math.round(sel.acc)} m` : ''}${sel.movido ? ' · ajustado' : ''}${sel.altura ? ` · ${esc(textoAltura(sel.altura))}` : ''}${sel.estructuras?.length ? ` · ${esc(textoEstructuras(sel.estructuras))}` : ''}</span></div>
      <div class="form-analisis">
        <div class="field"><label>Nombre</label><input id="lev-p-nombre" value="${esc(sel.nombre || '')}" onchange="datoPuntoLev('nombre', this.value)"></div>
        <div class="field"><label>Tipo</label><select id="lev-p-tipo" onchange="datoPuntoLev('tipo', this.value)">${TIPOS_PUNTO.map(k => `<option value="${k}" ${sel.tipo === k ? 'selected' : ''}>${esc(SIMBOLOS[k].nombre)}</option>`).join('')}</select></div>
        <div class="field field-ancho"><label>Nota</label><input id="lev-p-nota" value="${esc(sel.nota || '')}" placeholder="Ej. poste de madera deteriorado, remate, retenida…" onchange="datoPuntoLev('nota', this.value)"></div></div>
      <div class="lev-datos-poste">${controlesPoste(sel, { id: 'lev-poste', altura: 'alturaPuntoLev', agregar: 'agregarEstructuraLev', quitar: 'quitarEstructuraLev', escrita: 'agregarEstructuraEscritaLev' })}</div>
      <div class="barra-acciones"><button class="b b-g" onclick="seguirDesdeLev()">Seguir desde aquí</button><button class="b b-g" onclick="unirConLev()">Unir con otro punto</button><button class="b b-g" onclick="moverAGpsLev()">Mover a mi ubicación</button><button class="b b-l dib-borrar" onclick="borrarPuntoLev()">Borrar</button></div>
      <div class="page-sub">Para corregir la posición, arrastra el punto en el mapa.</div></div>`;
  } else if (puntos.length) {
    html += '<div class="page-sub lev-tip">Arrastra un punto para corregirlo. Toca una línea para poner un poste en medio de ese vano.</div>';
  }

  // Vanos con sus metros
  if (vanos.length) {
    html += `<details class="bloque lev-vanos" ${sel ? '' : 'open'}><summary class="bloque-titulo">Vanos (${vanos.length})</summary>
      ${vanos.map(v => {
        const a = l.puntos?.[v.a]; const b = l.puntos?.[v.b]; const m = metrosDeVano(l, v);
        const gps = a && b ? metrosDeVano(l, { ...v, metros: null }).metros : null;
        return `<div class="lev-vano"><b>${esc(a?.nombre || '?')} – ${esc(b?.nombre || '?')}</b>
          <span class="tg ${m.origen === 'medido' ? 'verde' : 'gris'}">${fmtMetros(m.metros)} ${m.origen === 'medido' ? 'medido' : 'GPS'}</span>
          <input id="lev-v-${v.id}" inputmode="decimal" value="${v.metros ?? ''}" placeholder="Medido (m)${gps !== null ? ` · GPS ${gps.toFixed(1)}` : ''}" onchange="datoVanoLev('${v.id}', 'metros', this.value)" aria-label="Metros medidos">
          <input id="lev-v-cal-${v.id}" list="lev-calibres" value="${esc(v.calibre || '')}" placeholder="Calibre" aria-label="Calibre" onchange="conductorVanoLev('${v.id}', 'calibre', this.value)">
          <select aria-label="Tipo de conductor" onchange="conductorVanoLev('${v.id}', 'tipo', this.value)"><option value="">Conductor</option>${TIPOS_CONDUCTOR.map(t => `<option ${v.conductor === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <select onchange="datoVanoLev('${v.id}', 'tramo', this.value)" aria-label="Tipo de vano">${Object.entries(TIPOS_TRAMO).map(([k, t]) => `<option value="${k}" ${v.tramo === k ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select>
          <button class="b b-l" onclick="borrarVanoLev('${v.id}')">Quitar</button></div>`;
      }).join('')}
      <datalist id="lev-calibres">${CALIBRES.map(c => `<option value="${c}">`).join('')}</datalist>
      <div class="page-sub">La distancia sale del GPS (precisión del celular, 3 a 10 m con buena señal). Si mediste el vano con cinta o telémetro, escríbelo: manda sobre el GPS.</div></details>`;
  }

  html += `<div class="barra-acciones lev-salidas"><button class="b b-p" onclick="pasarADibujarLev()"><i class="ic ic-editar"></i> Pasar a Dibujar (lámina)</button>
    <button class="b b-g" onclick="descargarKmlLev()"><i class="ic ic-descargar"></i> KML para Google Earth</button>
    <span class="sep"></span><button class="b b-l" onclick="eliminarLevantamiento()">Eliminar levantamiento</button></div>`;
  return html + '</div>';
}
