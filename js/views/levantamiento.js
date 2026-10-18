// Pestaña Levantamiento (Herramientas): levantamientos de red en campo con GPS, guardados en la base para el equipo.
import { SIMBOLOS } from '../domain/dibujo.js';
import { acometidasLevantamiento, KVA_TRAFO, listaPuntos, listaVanos, metrosDeVano, nuevaPantallaLev, resumenLevantamiento, simboloPunto, textoTrafos, TIPOS_PUNTO } from '../domain/levantamiento.js';
import { fmtMetros, TIPOS_TRAMO } from '../domain/plano.js';
import { balanceAcometidas, CALIBRES, grupoEstructurasDe, textoAcometidas, textoAltura, textoEstructuras, TIPOS_ACOMETIDA, TIPOS_CONDUCTOR } from '../domain/red.js';
import { state } from '../state.js';
import { controlesConductor, selectorAltura, selectorEstructuras } from './dibujo.js';
import { escapeHtml, fmtDate } from '../utils.js';
import { heroSeccion } from './componentes.js';

const esc = s => escapeHtml(s ?? '');
const mini = (k, t = 20) => { const s = SIMBOLOS[k] || SIMBOLOS.poste; const c = s.color || 'currentColor'; return `<svg viewBox="-2 -2 64 64" width="${t}" height="${t}" color="${c}" stroke="${c}" stroke-width="4" fill="none">${s.svg}</svg>`; };
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
  let html = `<div class="lev-app ${abierta ? 'hoja-abierta' : ''} ${u.hojaMin ? 'hoja-min' : ''}">`;

  // Barra de arriba: volver, nombre, GPS y quitar el último
  html += `<div class="lev-top"><button class="lev-top-btn" aria-label="Volver a los levantamientos" title="Levantamientos" onclick="cerrarLevantamiento()">${ICONO.atras}</button>
    <div class="lev-top-nombre"><b>${esc(l.nombre)}</b><small>${r.puntos} puntos · ${r.vanos} vanos${r.vanos ? ` · ${fmtMetros(r.metros)}` : ''}</small></div>
    <span id="lev-gps" class="tg gris">Buscando señal GPS…</span>
    <button class="lev-top-btn" aria-label="Quitar el último" title="Quitar el último punto" onclick="deshacerUltimoLev()" ${puntos.length ? '' : 'disabled'}>${ICONO.deshacer}</button></div>`;

  html += '<div class="lev-cuerpo">';
  // Mapa con sus controles encima
  html += `<div class="lev-mapa-caja"><div id="lev-mapa" class="lev-mapa"></div>
    <div class="lev-mapa-ctrl"><div class="segmento"><button class="${u.fondo === 'calles' ? 'active' : ''}" onclick="setLev('fondo', 'calles')">Calles</button><button class="${u.fondo === 'satelite' ? 'active' : ''}" onclick="setLev('fondo', 'satelite')">Satélite</button></div>
      <button class="lev-redondo lev-dist-btn ${u.distancias === false ? '' : 'activo'}" aria-label="${u.distancias === false ? 'Mostrar distancias' : 'Ocultar distancias'}" title="Distancias de los vanos" onclick="setLev('distancias', ${u.distancias === false})">m</button>
      <button id="lev-seguir" class="lev-redondo ${u.seguir ? 'activo' : ''}" aria-label="Seguir mi ubicación" title="Seguir mi ubicación" onclick="setLev('seguir', ${!u.seguir})">${ICONO.seguir}</button></div>
    ${u.movida && l.puntos?.[u.movida.id] ? `<div class="lev-aviso alert-banner alert-yellow">${esc(u.movida.nombre || 'Punto')} movido. <button class="b b-l" onclick="deshacerMovidaLev()">Deshacer</button></div>` : ''}
    ${u.unirDesde ? `<div class="lev-aviso alert-banner alert-yellow">Toca el punto con el que se une ${esc(l.puntos?.[u.unirDesde]?.nombre || '')}. <button class="b b-l" onclick="setLev('unirDesde', null)">Cancelar</button></div>` : ''}
    ${u.modo === 'gps' ? '<button class="b b-p lev-flotante" onclick="marcarAqui()"><i class="ic ic-map-pin"></i> Poste aquí</button>' : '<div class="lev-flotante lev-flotante-info">Toca el mapa donde está el punto</div>'}</div>`;

  // Hoja con pestañas
  const pest = (k, t, dis = false) => `<button class="lev-tab ${hoja === k ? 'activo' : ''}" ${dis ? 'disabled' : ''} onclick="setHojaLev('${k}')">${t}</button>`;
  // En el celular la hoja se baja con el asa para dejar casi todo el mapa (quedan las pestañas)
  html += `<section class="lev-hoja" aria-label="Controles del levantamiento"><button class="lev-asa" aria-label="${u.hojaMin ? 'Subir la hoja' : 'Bajar la hoja'}" onclick="setLev('hojaMin', ${!u.hojaMin})"><i></i></button><div class="lev-tabs">${pest('marcar', 'Marcar')}${pest('punto', sel ? esc(sel.nombre || 'Punto') : 'Punto', !sel)}${pest('vanos', `Vanos (${vanos.length})`)}${pest('mas', 'Más')}
      ${abierta ? '<button class="lev-tab-cerrar" aria-label="Cerrar" onclick="setHojaLev(\'marcar\')">✕</button>' : ''}</div>
    <div class="lev-hoja-cuerpo" data-hoja="${hoja}${hoja === 'punto' ? u.sel : ''}" onscroll="guardarScrollLev(this)">${hoja === 'punto' ? hojaPunto(sel, l) : hoja === 'vanos' ? hojaVanos(l, vanos) : hoja === 'mas' ? hojaMas(l, u) : hojaMarcar(l, u, vanos, actual)}</div></section>`;
  html += '</div>' + ventanaElegir(l, u, sel, vanos, actual);
  return html + '</div>';
}

// Fila de "ajustes": qué es, su valor y una flecha; al tocarla se abre una ventana solo para elegir eso
const fila = (k, valor, abrir, extra = '') => `<button class="lev-op" onclick="abrirPickerLev('${abrir}')" ${extra}><span class="lev-op-k">${k}</span><span class="lev-op-v">${valor}</span><span class="lev-op-f" aria-hidden="true">›</span></button>`;

function hojaMarcar(l, u, vanos, actual) {
  let html = `<div class="lev-lista">
    ${fila('Punto', `${mini(u.tipo)}${esc(SIMBOLOS[u.tipo]?.nombre || '')}`, 'tipoPunto', 'aria-label="Tipo de punto"')}
    ${fila('Vano', `${muestra(u.tramo)}${esc(TIPOS_TRAMO[u.tramo]?.nombre || '')}`, 'tipoVano', 'aria-label="Tipo de vano"')}
    <div class="lev-op lev-op-sin"><span class="lev-op-k">Marcar con</span><div class="segmento lev-seg"><button class="${u.modo === 'gps' ? 'active' : ''}" aria-label="Marcar con GPS" onclick="setLev('modo', 'gps')">GPS</button><button class="${u.modo === 'tocar' ? 'active' : ''}" aria-label="Tocando el mapa" onclick="setLev('modo', 'tocar')">Tocar mapa</button></div></div>
    <label class="lev-op lev-op-sin"><span class="lev-op-k">Unir al anterior</span><span class="lev-op-v">${actual && u.unir ? esc(actual.nombre) : ''}</span><input type="checkbox" class="lev-switch" id="lev-unir" ${u.unir ? 'checked' : ''} onchange="setLev('unir', this.checked)"></label>
  </div>
  <div class="lev-accion page-sub">${u.modo === 'gps' ? `Párate junto al poste y toca "Poste aquí".${actual && u.unir ? ` Se une a ${esc(actual.nombre)}.` : ''}` : `Toca el mapa donde está el punto.${actual && u.unir ? ` Se une a ${esc(actual.nombre)}.` : ''}`}</div>`;
  html += bloqueAcometidas(l, u, vanos, actual);
  return html;
}

function hojaPunto(sel, l) {
  if (!sel) return '';
  const info = [sel.manual ? 'Marcado en el mapa' : sel.acc ? `GPS ±${Math.round(sel.acc)} m` : '', sel.movido ? 'ajustado' : '', textoTrafos(sel.trafos), textoAltura(sel.altura), textoEstructuras(sel.estructuras)].filter(Boolean).join(' · ');
  const nada = '<i class="lev-op-nada">Sin dato</i>';
  return `<div class="lev-panel">
    <div class="lev-punto-cab">${mini(simboloPunto(sel), 28)}<div><b>${esc(sel.nombre || 'Punto')}</b><span>${esc(SIMBOLOS[sel.tipo]?.nombre || '')}</span></div>${info ? `<span class="tg gris">${esc(info)}</span>` : ''}</div>
    <div class="lev-acciones lev-acciones-punto"><button class="b b-p" onclick="seguirDesdeLev()">Seguir desde aquí</button><button class="b b-g" onclick="unirConLev()">Unir con otro punto</button><button class="b b-g" onclick="moverAGpsLev()">Mover a mi ubicación</button><button class="b b-l dib-borrar" onclick="borrarPuntoLev()">Borrar</button></div>
    <div class="lev-lista">
      ${fila('Transformador', sel.trafos?.length ? esc(textoTrafos(sel.trafos)) : nada, 'trafos', 'aria-label="Transformador sobre el poste"')}
      ${fila('Altura', sel.altura ? esc(textoAltura(sel.altura)) : nada, 'altura', 'aria-label="Altura del poste"')}
      ${fila('Estructuras', sel.estructuras?.length ? esc(textoEstructuras(sel.estructuras).replace(/ \/ /g, ', ')) : nada, 'estructuras', 'aria-label="Estructuras del poste"')}
      ${fila('Tipo', `${mini(sel.tipo)}${esc(SIMBOLOS[sel.tipo]?.nombre || '')}`, 'tipoDelPunto', 'aria-label="Tipo del punto"')}
      ${fila('Nombre', esc(sel.nombre || ''), 'nombre', 'aria-label="Nombre del punto"')}
      ${fila('Nota', sel.nota ? esc(sel.nota) : nada, 'nota', 'aria-label="Nota del punto"')}
    </div>
    <div class="page-sub">Para corregir la posición, arrastra el punto en el mapa.</div></div>`;
}

// Ventana para elegir un solo dato (encima de la hoja). Las de una opción se cierran al elegir.
function ventanaElegir(l, u, sel, vanos, actual) {
  const p = u.picker; if (!p) return '';
  const opcion = (activo, contenido, accion, extra = '') => `<button class="lev-elegir-op ${activo ? 'activo' : ''}" onclick="${accion}" ${extra}>${contenido}${activo ? '<span class="lev-elegir-ok">✓</span>' : ''}</button>`;
  let titulo = ''; let cuerpo = ''; let listo = false;
  if (p === 'tipoPunto' || (p === 'tipoDelPunto' && sel)) {
    const actualTipo = p === 'tipoPunto' ? u.tipo : sel.tipo;
    titulo = p === 'tipoPunto' ? 'Tipo de punto a marcar' : `Tipo de ${esc(sel.nombre || 'punto')}`;
    cuerpo = TIPOS_PUNTO.map(k => opcion(actualTipo === k, `${mini(k, 24)}<span>${esc(SIMBOLOS[k].nombre)}</span>`, p === 'tipoPunto' ? `elegirLev('tipo', '${k}')` : `elegirPuntoLev('tipo', '${k}')`)).join('');
  } else if (p === 'tipoVano') {
    titulo = 'Tipo de vano';
    cuerpo = Object.keys(TIPOS_TRAMO).map(k => opcion(u.tramo === k, `${muestra(k)}<span>${esc(TIPOS_TRAMO[k].nombre)}</span>`, `elegirLev('tramo', '${k}')`)).join('');
  } else if (p === 'vanoAcom') {
    const nombre = id => esc(l.puntos?.[id]?.nombre || '?');
    const elegido = u.vanoAcom && l.vanos?.[u.vanoAcom] ? u.vanoAcom : '';
    titulo = 'Contar acometidas en';
    cuerpo = (actual ? opcion(!elegido, `<span>Próximo vano desde ${esc(actual.nombre)}<small>Se pasan al vano al marcar el siguiente poste</small></span>`, "elegirLev('vanoAcom', '')") : '')
      + vanos.slice().reverse().map(v => opcion(elegido === v.id, `<span>${nombre(v.a)} – ${nombre(v.b)}${textoAcometidas(v.acom) ? `<small>${esc(textoAcometidas(v.acom))}</small>` : ''}</span>`, `elegirLev('vanoAcom', '${v.id}')`)).join('');
  } else if (sel && p === 'altura') {
    titulo = `Altura de ${esc(sel.nombre || 'poste')}`;
    cuerpo = selectorAltura(sel.altura, { id: 'lev-poste', altura: 'alturaYCerrarLev' });
  } else if (sel && p === 'estructuras') {
    const tramos = listaVanos(l).filter(v => v.a === sel.id || v.b === sel.id).map(v => v.tramo);
    titulo = `Estructuras de ${esc(sel.nombre || 'poste')}`; listo = true;
    cuerpo = selectorEstructuras(sel.estructuras, { id: 'lev-poste', agregar: 'agregarEstructuraLev', quitar: 'quitarEstructuraLev', escrita: 'agregarEstructuraEscritaLev', clave: sel.id, grupo: grupoEstructurasDe(tramos) });
  } else if (sel && p === 'trafos') {
    // Uno o varios transformadores sobre el poste: cada toque agrega una unidad con esos kVA (varias = banco)
    titulo = `Transformador en ${esc(sel.nombre || 'poste')}`; listo = true;
    const lista = sel.trafos || [];
    cuerpo = `<div class="dib-estructuras lev-trafos">${lista.length ? lista.map((k, i) => `<span class="dib-estr">${esc(k)} kVA<button aria-label="Quitar ${esc(k)} kVA" onclick="quitarTrafoLev(${i})">✕</button></span>`).join('') : '<span class="page-sub">Sin transformador</span>'}</div>
      ${lista.length ? `<div class="lev-trafo-texto">${esc(textoTrafos(lista))}</div>` : ''}
      <div class="lev-trafo-sub">Toca los kVA para agregar un transformador (para un banco, agrega uno por cada unidad)</div>
      <div class="lev-kva">${KVA_TRAFO.map(k => `<button class="b b-g" onclick="agregarTrafoLev('${k}')">${k}</button>`).join('')}</div>
      <div class="dib-estr-otra lev-trafo-otro"><input id="lev-trafo-otro" inputmode="decimal" placeholder="Otro (kVA)" onkeydown="if (event.key === 'Enter') agregarTrafoEscritoLev()"><button class="b b-g" onclick="agregarTrafoEscritoLev()">Agregar</button></div>`;
  } else if (sel && (p === 'nombre' || p === 'nota')) {
    titulo = p === 'nombre' ? 'Nombre del punto' : 'Nota del punto'; listo = true;
    cuerpo = `<input id="lev-p-${p}" class="lev-elegir-texto" value="${esc(sel[p] || '')}" placeholder="${p === 'nota' ? 'Ej. poste de madera deteriorado, retenida…' : 'Ej. P3'}" onchange="datoPuntoLev('${p}', this.value)" onkeydown="if (event.key === 'Enter') { datoPuntoLev('${p}', this.value); cerrarPickerLev(); }">`;
  } else return '';
  return `<div class="lev-elegir-fondo" onclick="if (event.target === this) cerrarPickerLev()"><div class="lev-elegir" role="dialog" aria-label="${titulo}">
    <div class="lev-elegir-cab"><b>${titulo}</b><button class="${listo ? 'b b-p' : 'lev-elegir-x'}" onclick="cerrarPickerLev()" aria-label="${listo ? 'Listo' : 'Cerrar'}">${listo ? 'Listo' : '✕'}</button></div>
    <div class="lev-elegir-cuerpo ${p === 'altura' || p === 'estructuras' || p === 'trafos' || p === 'nombre' || p === 'nota' ? '' : 'lev-elegir-lista'}">${cuerpo}</div></div></div>`;
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
    <div class="field"><label>Mapa de fondo en Dibujar</label><div class="segmento segmento-ancho">${[['calles', 'Calles'], ['satelite', 'Satélite'], ['ninguno', 'Sin mapa']].map(([k, t]) => `<button class="${(u.fondoDibujo || 'calles') === k ? 'active' : ''}" onclick="setLev('fondoDibujo', '${k}')">${t}</button>`).join('')}</div>
      <div class="page-sub">El mapa de la zona queda de fondo, a la misma escala del levantamiento (necesita conexión).</div></div>
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
  const donde = elegido ? `${esc(nombre(l.vanos[elegido].a))} – ${esc(nombre(l.vanos[elegido].b))}` : `Próximo vano desde ${esc(actual?.nombre || '')}`;
  return `<div class="lev-acom"><div class="lev-acom-titulo">Acometidas</div>
    <button class="lev-op" onclick="abrirPickerLev('vanoAcom')" aria-label="Vano donde se cuentan"><span class="lev-op-k">Contando en</span><span class="lev-op-v" id="lev-acom-vano">${donde}</span><span class="lev-op-f" aria-hidden="true">›</span></button>
    <div class="lev-acom-botones">${TIPOS_ACOMETIDA.map(x => `<div class="lev-acom-tipo"><button class="lev-acom-mas" onclick="sumarAcometidaLev('${x.k}', 1)" aria-label="Sumar acometida ${x.nombre}"><span>${x.nombre}</span><b class="lev-acom-n" id="lev-acom-${x.k}">${Number(cuenta[x.k]) || 0}</b><small>toca para sumar</small></button>
      <button class="lev-acom-menos" onclick="sumarAcometidaLev('${x.k}', -1)" aria-label="Restar acometida ${x.nombre}">− 1</button></div>`).join('')}</div>
    ${b.total ? `<div class="lev-acom-total"><span>Total del levantamiento: fase A <b>${b.faseA}</b> · fase B <b>${b.faseB}</b></span><span class="${b.dif ? 'lev-acom-dif' : 'lev-acom-ok'}">${b.mayor ? `Diferencia ${b.dif} (más en ${b.mayor})` : 'Balanceadas'}</span></div>` : ''}</div>`;
}
