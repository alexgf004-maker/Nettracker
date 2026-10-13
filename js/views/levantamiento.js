// Pestaña Levantamiento (Herramientas): levantamientos de red en campo con GPS, guardados en la base para el equipo.
import { SIMBOLOS } from '../domain/dibujo.js';
import { acometidasLevantamiento, listaPuntos, listaVanos, metrosDeVano, nuevaPantallaLev, resumenLevantamiento, TIPOS_PUNTO } from '../domain/levantamiento.js';
import { fmtMetros, TIPOS_TRAMO } from '../domain/plano.js';
import { balanceAcometidas, CALIBRES, grupoEstructurasDe, textoAcometidas, textoAltura, textoEstructuras, TIPOS_ACOMETIDA, TIPOS_CONDUCTOR } from '../domain/red.js';
import { state } from '../state.js';
import { controlesConductor, controlesPoste } from './dibujo.js';
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

// Pantalla del levantamiento pensada para el celular: el mapa en toda la pantalla con "Poste aquí" encima y una hoja
// abajo con pestañas (Marcar siempre a la vista; Punto, Vanos y Más se abren). En la compu la hoja es un panel a la derecha.
const ICONO = {
  atras: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  deshacer: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/></svg>',
  seguir: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
};
function renderDetalle(id, l) {
  state.lev ??= nuevaPantallaLev();
  const u = state.lev;
  const puntos = listaPuntos(l); const vanos = listaVanos(l);
  const actual = u.actual && l.puntos?.[u.actual];
  const sel = u.sel && l.puntos?.[u.sel] ? { id: u.sel, ...l.puntos[u.sel] } : null;
  const r = resumenLevantamiento(l);
  // Pestaña activa: con un punto seleccionado se abre "Punto"
  const hoja = sel && u.hoja !== 'vanos' && u.hoja !== 'mas' ? 'punto' : u.hoja === 'punto' || !u.hoja ? 'marcar' : u.hoja;
  const abierta = hoja !== 'marcar';
  let html = `<div class="lev-app ${abierta ? 'hoja-abierta' : ''}">`;

  // Barra de arriba: volver, nombre, GPS y quitar el último
  html += `<div class="lev-top"><button class="lev-top-btn" aria-label="Volver a los levantamientos" title="Levantamientos" onclick="cerrarLevantamiento()">${ICONO.atras}</button>
    <div class="lev-top-nombre"><b>${esc(l.nombre)}</b><small>${r.puntos} puntos · ${r.vanos} vanos${r.vanos ? ` · ${fmtMetros(r.metros)}` : ''}</small></div>
    <span id="lev-gps" class="tg gris">Buscando señal GPS…</span>
    <button class="lev-top-btn" aria-label="Quitar el último" title="Quitar el último punto" onclick="deshacerUltimoLev()" ${puntos.length ? '' : 'disabled'}>${ICONO.deshacer}</button></div>`;

  html += '<div class="lev-cuerpo">';
  // Mapa con sus controles encima
  html += `<div class="lev-mapa-caja"><div id="lev-mapa" class="lev-mapa"></div>
    <div class="lev-mapa-ctrl"><div class="segmento"><button class="${u.fondo === 'calles' ? 'active' : ''}" onclick="setLev('fondo', 'calles')">Calles</button><button class="${u.fondo === 'satelite' ? 'active' : ''}" onclick="setLev('fondo', 'satelite')">Satélite</button></div>
      <button id="lev-seguir" class="lev-redondo ${u.seguir ? 'activo' : ''}" aria-label="Seguir mi ubicación" title="Seguir mi ubicación" onclick="setLev('seguir', ${!u.seguir})">${ICONO.seguir}</button></div>
    ${u.movida && l.puntos?.[u.movida.id] ? `<div class="lev-aviso alert-banner alert-yellow">${esc(u.movida.nombre || 'Punto')} movido. <button class="b b-l" onclick="deshacerMovidaLev()">Deshacer</button></div>` : ''}
    ${u.unirDesde ? `<div class="lev-aviso alert-banner alert-yellow">Toca el punto con el que se une ${esc(l.puntos?.[u.unirDesde]?.nombre || '')}. <button class="b b-l" onclick="setLev('unirDesde', null)">Cancelar</button></div>` : ''}
    ${u.modo === 'gps' ? '<button class="b b-p lev-flotante" onclick="marcarAqui()"><i class="ic ic-map-pin"></i> Poste aquí</button>' : '<div class="lev-flotante lev-flotante-info">Toca el mapa donde está el punto</div>'}</div>`;

  // Hoja con pestañas
  const pest = (k, t, dis = false) => `<button class="lev-tab ${hoja === k ? 'activo' : ''}" ${dis ? 'disabled' : ''} onclick="setHojaLev('${k}')">${t}</button>`;
  html += `<section class="lev-hoja" aria-label="Controles del levantamiento"><div class="lev-tabs">${pest('marcar', 'Marcar')}${pest('punto', sel ? esc(sel.nombre || 'Punto') : 'Punto', !sel)}${pest('vanos', `Vanos (${vanos.length})`)}${pest('mas', 'Más')}
      ${abierta ? '<button class="lev-tab-cerrar" aria-label="Cerrar" onclick="setHojaLev(\'marcar\')">✕</button>' : ''}</div>
    <div class="lev-hoja-cuerpo">${hoja === 'punto' ? hojaPunto(sel, l) : hoja === 'vanos' ? hojaVanos(l, vanos) : hoja === 'mas' ? hojaMas(l, u) : hojaMarcar(l, u, vanos, actual)}</div></section>`;
  return html + '</div></div>';
}

function hojaMarcar(l, u, vanos, actual) {
  let html = `<div class="lev-fila lev-desliza"><div class="segmento"><button class="${u.modo === 'gps' ? 'active' : ''}" onclick="setLev('modo', 'gps')">Marcar con GPS</button><button class="${u.modo === 'tocar' ? 'active' : ''}" onclick="setLev('modo', 'tocar')">Tocando el mapa</button></div>
    <label class="insp-check lev-unir"><input type="checkbox" id="lev-unir" ${u.unir ? 'checked' : ''} onchange="setLev('unir', this.checked)"><span>Unir al anterior</span></label></div>
    <div class="lev-accion page-sub">${u.modo === 'gps' ? `Párate junto al poste y toca "Poste aquí".${actual ? ` Se une a ${esc(actual.nombre)}.` : ''}` : `Toca el mapa donde está el punto.${actual && u.unir ? ` Se une a ${esc(actual.nombre)}.` : ''}`}</div>
    <div class="lev-barra lev-desliza">${TIPOS_PUNTO.map(k => `<button class="dib-chip ${u.tipo === k ? 'activo' : ''}" onclick="setLev('tipo', '${k}')">${mini(k)}${esc(SIMBOLOS[k].nombre)}</button>`).join('')}</div>
    <div class="lev-barra lev-desliza">${Object.keys(TIPOS_TRAMO).map(k => `<button class="dib-chip ${u.tramo === k ? 'activo' : ''}" onclick="setLev('tramo', '${k}')">${muestra(k)}${esc(TIPOS_TRAMO[k].nombre)}</button>`).join('')}</div>`;
  html += bloqueAcometidas(l, u, vanos, actual);
  return html;
}

function hojaPunto(sel, l) {
  if (!sel) return '';
  const tramos = listaVanos(l).filter(v => v.a === sel.id || v.b === sel.id).map(v => v.tramo);
  const info = [sel.manual ? 'Marcado en el mapa' : sel.acc ? `GPS ±${Math.round(sel.acc)} m` : '', sel.movido ? 'ajustado' : '', textoAltura(sel.altura), textoEstructuras(sel.estructuras)].filter(Boolean).join(' · ');
  return `<div class="lev-panel">${info ? `<div class="lev-panel-info tg gris">${esc(info)}</div>` : ''}
    <div class="lev-acciones"><button class="b b-p" onclick="seguirDesdeLev()">Seguir desde aquí</button><button class="b b-g" onclick="unirConLev()">Unir con otro punto</button><button class="b b-g" onclick="moverAGpsLev()">Mover a mi ubicación</button><button class="b b-l dib-borrar" onclick="borrarPuntoLev()">Borrar</button></div>
    <div class="lev-dos"><div class="field"><label>Nombre</label><input id="lev-p-nombre" value="${esc(sel.nombre || '')}" onchange="datoPuntoLev('nombre', this.value)"></div>
      <div class="field"><label>Tipo</label><select id="lev-p-tipo" onchange="datoPuntoLev('tipo', this.value)">${TIPOS_PUNTO.map(k => `<option value="${k}" ${sel.tipo === k ? 'selected' : ''}>${esc(SIMBOLOS[k].nombre)}</option>`).join('')}</select></div></div>
    <div class="field"><label>Nota</label><input id="lev-p-nota" value="${esc(sel.nota || '')}" placeholder="Ej. poste de madera deteriorado, retenida…" onchange="datoPuntoLev('nota', this.value)"></div>
    ${controlesPoste(sel, { id: 'lev-poste', altura: 'alturaPuntoLev', agregar: 'agregarEstructuraLev', quitar: 'quitarEstructuraLev', escrita: 'agregarEstructuraEscritaLev', clave: sel.id, grupo: grupoEstructurasDe(tramos) })}
    <div class="page-sub">Para corregir la posición, arrastra el punto en el mapa.</div></div>`;
}

function hojaVanos(l, vanos) {
  if (!vanos.length) return '<div class="page-sub">Todavía no hay vanos: marca dos postes seguidos.</div>';
  return `${vanos.map(v => {
    const a = l.puntos?.[v.a]; const b = l.puntos?.[v.b]; const m = metrosDeVano(l, v);
    const gps = a && b ? metrosDeVano(l, { ...v, metros: null }).metros : null;
    return `<div class="lev-vano"><div class="lev-vano-nombre"><b>${esc(a?.nombre || '?')} – ${esc(b?.nombre || '?')}</b>
        <span class="tg ${m.origen === 'medido' ? 'verde' : 'gris'}">${fmtMetros(m.metros)} ${m.origen === 'medido' ? 'medido' : 'GPS'}</span>${textoAcometidas(v.acom) ? `<span class="tg azul">${esc(textoAcometidas(v.acom))}</span>` : ''}
        <button class="lev-vano-quitar" aria-label="Quitar vano" title="Quitar vano" onclick="borrarVanoLev('${v.id}')">✕</button></div>
      <div class="lev-vano-campos">
        <label><span>Metros medidos</span><input id="lev-v-${v.id}" inputmode="decimal" value="${v.metros ?? ''}" placeholder="${gps !== null ? `GPS ${gps.toFixed(1)}` : 'm'}" onchange="datoVanoLev('${v.id}', 'metros', this.value)" aria-label="Metros medidos"></label>
        <label><span>Tipo de vano</span><select onchange="datoVanoLev('${v.id}', 'tramo', this.value)" aria-label="Tipo de vano">${Object.entries(TIPOS_TRAMO).map(([k, t]) => `<option value="${k}" ${v.tramo === k ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select></label></div>
      <div class="lev-vano-cond">${controlesConductor({ calibre: v.calibre, tipo: v.conductor }, { id: `lev-v-${v.id}`, fn: (c, val) => `conductorVanoLev('${v.id}', '${c}', ${val})` })}</div></div>`;
  }).join('')}
    <datalist id="lev-calibres">${CALIBRES.map(c => `<option value="${c}">`).join('')}</datalist>
    <div class="page-sub">La distancia sale del GPS (3 a 10 m de precisión con buena señal). Si mediste el vano con cinta o telémetro, escríbelo: manda sobre el GPS.</div>`;
}

function hojaMas(l, u) {
  return `<div class="field"><label>Nombre del levantamiento</label><input class="lev-titulo" id="lev-titulo" value="${esc(l.nombre)}" onchange="guardarDatoLev('nombre', this.value)"></div>
    <div class="field"><label>Referencia</label><input class="lev-ref" id="lev-ref" value="${esc(l.referencia || '')}" placeholder="WO, NC, reclamo…" onchange="guardarDatoLev('referencia', this.value)"></div>
    <div class="lev-acciones lev-salidas"><button class="b b-p" onclick="pasarADibujarLev()"><i class="ic ic-editar"></i> Pasar a Dibujar (lámina)</button>
      <button class="b b-g" onclick="descargarKmlLev()"><i class="ic ic-descargar"></i> KML para Google Earth</button></div>
    <div class="page-sub">Arrastra un punto para corregirlo. Toca una línea para poner un poste en medio de ese vano.</div>
    <div class="lev-acciones"><button class="b b-l dib-borrar" onclick="eliminarLevantamiento()">Eliminar levantamiento</button></div>`;
}

// Contador de acometidas: en el vano elegido o en el próximo vano que sale del punto actual
function bloqueAcometidas(l, u, vanos, actual) {
  const nombre = id => l.puntos?.[id]?.nombre || '?';
  const elegido = u.vanoAcom && l.vanos?.[u.vanoAcom] ? u.vanoAcom : '';
  const pend = l.pendiente?.desde === u.actual ? l.pendiente : null;
  const cuenta = elegido ? l.vanos[elegido].acom || {} : pend || {};
  const t = acometidasLevantamiento(l); const b = balanceAcometidas(t);
  if (!actual && !vanos.length) return '';
  return `<div class="lev-acom"><div class="lev-acom-cab"><b>Acometidas</b>
      <select id="lev-acom-vano" aria-label="Vano donde se cuentan" onchange="setVanoAcomLev(this.value)">
        ${actual ? `<option value="" ${elegido ? '' : 'selected'}>Próximo vano desde ${esc(actual.nombre)}</option>` : ''}
        ${vanos.slice().reverse().map(v => `<option value="${v.id}" ${elegido === v.id ? 'selected' : ''}>${esc(nombre(v.a))} – ${esc(nombre(v.b))}</option>`).join('')}</select></div>
    <div class="lev-acom-botones">${TIPOS_ACOMETIDA.map(x => `<div class="lev-acom-tipo"><button class="lev-acom-menos" onclick="sumarAcometidaLev('${x.k}', -1)" aria-label="Restar acometida ${x.nombre}">−</button>
      <button class="b b-p lev-acom-mas" onclick="sumarAcometidaLev('${x.k}', 1)" aria-label="Sumar acometida ${x.nombre}"><span>+${x.nombre}</span><b class="lev-acom-n" id="lev-acom-${x.k}">${Number(cuenta[x.k]) || 0}</b></button></div>`).join('')}</div>
    ${b.total ? `<div class="lev-acom-total">Total: 120 A <b>${t.a}</b> · 120 B <b>${t.b}</b> · 240 <b>${t.d}</b> → fase A ${b.faseA}, fase B ${b.faseB} · <span class="${b.dif ? 'lev-acom-dif' : ''}">${b.mayor ? `diferencia ${b.dif} (más en ${b.mayor})` : 'balanceadas'}</span></div>` : ''}</div>`;
}
