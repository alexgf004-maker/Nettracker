// Formulario de inspección del reclamo, pensado para llenarse en sitio desde el celular.
// Cada campo se guarda al salir de él; los encabezados del reclamo (NC, usuario, DS/CT, medidor) vienen del expediente.
import {
  BASES_EQUIPO, CARGAS, cantidadTrafos, CONDICIONES_TABLERO, CONEXIONES_PRI, CONEXIONES_SEC, CONSTRUCCION_TRI, INSTALACION_GENERAL,
  kvaTotal, LECTURAS, LIMITE_TIERRA, lista, MONTAJES, OTRA, PROTECCIONES, ROLES_FIRMA, TIPOS_SUBESTACION, veredictoTierra,
} from '../domain/inspeccion.js';
import { medicionesExpediente } from '../domain/expedientes.js';
import { equiposMedicion, normalizarInspeccion } from '../domain/inspeccion.js';
import { hoyLocal } from '../domain/trabajo.js';
import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { modalFirma } from './firma.js';

const esc = s => escapeHtml(s ?? '');
const aObj = arr => Object.fromEntries(arr.map(x => [x, x]));

export function vistaInspeccion(e) {
  const insp = normalizarInspeccion(e.inspeccion);
  const val = ruta => ruta.split('/').reduce((o, k) => (o == null ? undefined : o[k]), insp) ?? '';
  const id = ruta => 'insp-' + ruta.replace(/\//g, '-');
  const guardar = ruta => `guardarInspeccion('${e.id}', '${ruta}', this.value)`;
  const texto = (ruta, label, ph = '', modo = '') => `<div class="field"><label>${label}</label><input id="${id(ruta)}" ${modo ? `inputmode="${modo}"` : ''} value="${esc(val(ruta))}" placeholder="${esc(ph)}" onchange="${guardar(ruta)}"></div>`;
  const area = (ruta, label, ph = '') => `<div class="field field-ancho"><label>${label}</label><textarea id="${id(ruta)}" rows="2" placeholder="${esc(ph)}" onchange="${guardar(ruta)}">${esc(val(ruta))}</textarea></div>`;
  const opciones = (ruta, label, ops, vacio = '—') => `<div class="field"><label>${label}</label><select id="${id(ruta)}" onchange="${guardar(ruta)}"><option value="">${esc(vacio)}</option>${Object.entries(ops).map(([k, l]) => `<option value="${esc(k)}" ${String(val(ruta)) === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
  // Botones de opción única (para lo que se toca rápido en campo)
  const botones = (ruta, label, ops) => `<div class="field field-ancho"><label>${label}</label><div class="insp-opciones">${Object.entries(ops).map(([k, l]) =>
    `<button type="button" class="insp-op ${val(ruta) === k ? 'sel' : ''}" onclick="guardarInspeccion('${e.id}', '${ruta}', '${val(ruta) === k ? '' : esc(k)}')">${esc(l)}</button>`).join('')}</div></div>`;
  const checks = (ruta, catalogo) => `<div class="insp-checks">${Object.entries(catalogo).map(([k, l]) =>
    `<label class="insp-check"><input type="checkbox" id="${id(ruta + '/' + k)}" ${val(ruta + '/' + k) ? 'checked' : ''} onchange="marcarInspeccion('${e.id}', '${ruta}/${k}', this.checked)"><span>${esc(l)}</span></label>`).join('')}</div>`;
  const bloque = (titulo, cuerpo, extra = '') => `<div class="bloque"><div class="bloque-head"><div class="bloque-titulo">${titulo}</div>${extra}</div>${cuerpo}</div>`;
  const quitar = (lst, clave) => `<button class="b b-l" onclick="quitarItemInspeccion('${e.id}', '${lst}', '${clave}')">Quitar</button>`;

  const botonPDF = `<button class="b b-p" onclick="generarFormularioInspeccion('${e.id}')"><i class="ic ic-archivo"></i> Generar PDF del formulario</button>`;
  let html = `<div class="barra-acciones" style="margin-bottom:10px">${botonPDF}<span class="page-sub">Se llena en la visita; cada campo se guarda solo. Las fotos van fuera de la app.</span></div>`;

  // Encabezado con los datos del reclamo (se editan en Datos)
  const dato = (l, v) => `<div><small>${l}</small><b>${esc(v) || '—'}</b></div>`;
  html += bloque('Datos del reclamo', `<div class="insp-cabecera">${dato('Código', e.codigo)}${dato('NC', e.nc)}${dato('Nombre del usuario', e.nombre)}${dato('DS / CT', [e.corte, e.ct].filter(Boolean).join(' / '))}${dato('Medidor', e.medidor)}${dato('Dirección', e.direccion)}</div>
    <div class="page-sub" style="margin-top:6px">Vienen del expediente; si algo está mal, corrígelo en la pestaña Datos.</div>`);

  // Equipo de medición: sale de las instalaciones registradas (no se escribe aquí)
  const med = equiposMedicion(medicionesExpediente(e, state.records, hoyLocal()), state.equipos);
  html += bloque(`Equipo de medición${med.codigo ? ' · ' + esc(med.codigo) : ''}`, med.lista.length
    ? `<div class="insp-equipos">${med.lista.map(x => `<div><small>${esc(x.punto)}</small><b>${esc([x.modelo, x.serie].filter(Boolean).join(' · ')) || '—'}</b>${x.vineta ? `<span>Viñeta ${esc(x.vineta)}</span>` : ''}</div>`).join('')}</div>
      <div class="page-sub" style="margin-top:6px">Sale de las instalaciones del reclamo (punto principal y puntos adicionales de la medición inicial).</div>`
    : '<div class="page-sub">Todavía no hay una instalación registrada para este reclamo. Al registrarla en Mediciones, el equipo aparece aquí y en el PDF.</div>');

  html += bloque('Visita', `<div class="form-analisis">
    <div class="field"><label>Fecha de la inspección</label><input type="date" id="insp-fecha" value="${esc(insp.fecha || '')}" onchange="${guardar('fecha')}"></div>
    <div class="field"><label>Hora de inicio</label><input type="time" id="insp-horaInicio" value="${esc(insp.horaInicio || '')}" onchange="${guardar('horaInicio')}"></div>
    <div class="field"><label>Hora de finalización</label><input type="time" id="insp-horaFin" value="${esc(insp.horaFin || '')}" onchange="${guardar('horaFin')}"></div>
    ${texto('circuito', 'Circuito MT', 'Ej. AL013-23KV')}
    ${texto('subestacionDist', 'Subestación de distribución', 'Ej. Subestación Nuevo Cuscatlán')}</div>`);

  // Subestación: las opciones dependen del tipo
  const sub = insp.subestacion || {};
  const tipo = sub.tipo;
  let cs = botones('subestacion/tipo', 'Tipo de subestación', TIPOS_SUBESTACION);
  if (TIPOS_SUBESTACION[tipo]) {
    if (tipo === 'tri') cs += botones('subestacion/construccion', 'Construcción', CONSTRUCCION_TRI);
    const n = cantidadTrafos(sub);
    cs += '<div class="form-analisis">';
    for (let i = 1; i <= n; i++) cs += texto(`subestacion/kvas/${i}`, n === 1 ? 'Capacidad del transformador (kVA)' : `Transformador ${i} (kVA)`, '', 'decimal');
    cs += opciones('subestacion/montaje', 'Montaje', aObj(MONTAJES));
    cs += opciones('subestacion/conexionPri', 'Conexión del primario', aObj([...(CONEXIONES_PRI[tipo] || []), OTRA]));
    if (sub.conexionPri === OTRA) cs += texto('subestacion/conexionPriOtra', '¿Cuál conexión del primario?');
    cs += (CONEXIONES_SEC[tipo] || []).length === 1
      ? `<div class="field"><label>Conexión del secundario</label><input value="${esc(CONEXIONES_SEC[tipo][0])}" disabled></div>`
      : opciones('subestacion/conexionSec', 'Conexión del secundario', aObj([...(CONEXIONES_SEC[tipo] || []), OTRA]));
    if (sub.conexionSec === OTRA) cs += texto('subestacion/conexionSecOtra', '¿Cuál conexión del secundario?');
    cs += texto('subestacion/vPri', 'Tensión primaria (V)', 'Ej. 23000 o 13200');
    cs += texto('subestacion/vSec', 'Tensión secundaria (V)', tipo === 'tri' ? 'Ej. 240 o 480/277' : 'Ej. 240/120');
    cs += texto('subestacion/tap', 'Posición del TAP', 'Ej. nivel 4 (posición D)');
    cs += area('subestacion/notas', 'Observaciones de la subestación', 'Estado, fugas de aceite, herrajes, puentes…') + '</div>';
  }
  const total = kvaTotal(sub);
  html += bloque('Subestación del usuario', cs, total ? `<span class="tg gris">${total} kVA en total</span>` : '');

  html += bloque('Medidor de facturación', `<div class="form-analisis">
    ${texto('medidor/modelo', 'Modelo', 'Ej. ION8650')}
    ${texto('medidor/serie', 'Número de serie', e.medidor ? 'Del expediente: ' + e.medidor : '')}
    ${texto('medidor/rtc', 'RTC (corriente)', 'Ej. 800/5')}
    ${texto('medidor/rtp', 'RTP (voltaje)', 'Si aplica')}
    ${area('medidor/notas', 'Observaciones')}</div>`);

  // Instalación en general
  html += bloque('Instalación del usuario', `<div class="insp-sub">Cuenta con</div>${checks('general', INSTALACION_GENERAL)}
    <div class="insp-sub">Cargas principales</div>${checks('cargas', CARGAS)}
    <div class="form-analisis">${texto('cargasOtras', 'Otras cargas', 'Ej. compresores, máquinas CNC')}${texto('horario', 'Horario de operación', 'Ej. lunes a sábado, 7:00 a 17:00')}</div>`);

  // Transformadores secos (si los marcó o ya hay alguno)
  const secos = lista(insp.trafosSecos);
  if (insp.general?.trafosSecos || secos.length) {
    html += bloque('Transformadores secos', secos.map((t, i) => {
      const r = `trafosSecos/${t.id}`;
      return `<div class="insp-item"><div class="insp-item-head"><b>Transformador seco ${i + 1}</b>${quitar('trafosSecos', t.id)}</div>
        <div class="form-analisis">${texto(r + '/kva', 'Capacidad (kVA)', '', 'decimal')}${texto(r + '/vPri', 'Voltaje primario (V)', 'Ej. 480')}${texto(r + '/vSec', 'Voltaje secundario (V)', 'Ej. 240/120')}${texto(r + '/ubicacion', 'Ubicación o cargas que alimenta')}</div></div>`;
    }).join('') + `<button class="b b-g" onclick="agregarItemInspeccion('${e.id}', 'trafosSecos')"><i class="ic ic-plus"></i> Agregar transformador seco</button>`);
  }

  // Tableros: checklist de protecciones y condiciones, lecturas y puesta a tierra
  const tableros = lista(insp.tableros);
  html += bloque('Tableros', tableros.map(tb => {
    const r = `tableros/${tb.id}`; const ver = veredictoTierra(tb.tierra);
    return `<div class="insp-item"><div class="insp-item-head"><b>${esc(tb.nombre || 'Tablero sin nombre')}</b>${ver ? `<span class="tg ${ver === 'CUMPLE' ? 'verde' : 'rojo'}">${esc(tb.tierra)} Ω · ${ver === 'CUMPLE' ? 'cumple' : 'no cumple'}</span>` : ''}${quitar('tableros', tb.id)}</div>
      <div class="form-analisis">${texto(r + '/nombre', 'Nombre', 'Ej. Tablero general del cuarto de máquinas')}${texto(r + '/tierra', `Resistencia a tierra (Ω) · límite ${LIMITE_TIERRA} Ω`, '', 'decimal')}</div>
      <div class="insp-sub">Protecciones que tiene</div>${checks(r + '/prot', PROTECCIONES)}
      <div class="form-analisis">${texto(r + '/protOtras', 'Otras protecciones o ajustes', 'Ej. MotorSaver 460: desbalance 5 %, retardo 1 s')}</div>
      <div class="insp-sub">Condiciones</div>${checks(r + '/cond', CONDICIONES_TABLERO)}
      <div class="insp-sub">Lecturas instantáneas</div><div class="insp-lecturas">${LECTURAS.map(([k, l]) => texto(`${r}/lect/${k}`, l + (k.startsWith('i') ? ' (A)' : ' (V)'), '', 'decimal')).join('')}</div>
      <div class="form-analisis">${area(r + '/observaciones', 'Observaciones del tablero')}</div></div>`;
  }).join('') + `<button class="b b-g" onclick="agregarItemInspeccion('${e.id}', 'tableros')"><i class="ic ic-plus"></i> Agregar tablero</button>`);

  const equipos = lista(insp.equipos);
  html += bloque('Equipo dañado', equipos.map(eq => {
    const r = `equipos/${eq.id}`;
    return `<div class="insp-item"><div class="insp-item-head"><b>${esc(eq.equipo || 'Equipo sin nombre')}</b>${eq.vmin && eq.vmax ? `<span class="tg gris">${esc(eq.vmin)}–${esc(eq.vmax)} V</span>` : ''}${quitar('equipos', eq.id)}</div>
      <div class="form-analisis">${texto(r + '/equipo', 'Equipo', 'Ej. Variador de frecuencia')}${texto(r + '/marca', 'Marca')}${texto(r + '/modelo', 'Modelo')}${texto(r + '/serie', 'Serie')}
      ${texto(r + '/vmin', 'Voltaje mínimo de placa (V)', '', 'decimal')}${texto(r + '/vmax', 'Voltaje máximo de placa (V)', '', 'decimal')}
      ${opciones(r + '/base', 'Comparar la placa con', { ff: BASES_EQUIPO.ff }, BASES_EQUIPO.directa)}
      ${texto(r + '/monto', 'Monto reclamado ($)', '', 'decimal')}${opciones(r + '/disponible', '¿Disponible en sitio para verificarlo?', { si: 'Sí', no: 'No' })}
      ${area(r + '/descripcion', 'Descripción del daño', 'Lo que reporta el usuario')}</div></div>`;
  }).join('') + `<div class="page-sub" style="margin:4px 0 10px">Con el rango de placa, el borrador de informe calcula el % del tiempo que la tensión estuvo fuera de él. Más del 5 % del tiempo: NO CUMPLE.</div>
    <button class="b b-g" onclick="agregarItemInspeccion('${e.id}', 'equipos')"><i class="ic ic-plus"></i> Agregar equipo dañado</button>`);

  html += bloque('Observaciones generales', `<div class="form-analisis">${area('observaciones', 'Observaciones', 'Lo que no cabe en las secciones anteriores')}</div>`);

  // Firmas: en pantalla o en blanco para firmar a mano en el impreso
  html += bloque('Firmas', `<div class="insp-firmas">${Object.entries(ROLES_FIRMA).map(([rol, eti]) => {
    const f = insp.firmas?.[rol] || {};
    const nombreDefecto = rol === 'inspector1' && !f.nombre ? state.sesionUsuario?.nombre || '' : '';
    return `<div class="insp-firma"><div class="insp-sub">${rol === 'acompanante' ? 'Acompañó por parte del usuario' : eti + (rol === 'inspector2' ? ' (2)' : '')}</div>
      <div class="field"><label>Nombre</label><input id="${id('firmas/' + rol + '/nombre')}" value="${esc(f.nombre || nombreDefecto)}" onchange="${guardar('firmas/' + rol + '/nombre')}"></div>
      <div class="field"><label>Cargo</label><input id="${id('firmas/' + rol + '/cargo')}" value="${esc(f.cargo || '')}" placeholder="${rol === 'acompanante' ? 'Ej. Encargado de mantenimiento' : 'Ej. Técnico CPT'}" onchange="${guardar('firmas/' + rol + '/cargo')}"></div>
      ${f.img ? `<img class="insp-firma-img" src="${f.img}" alt="Firma">` : '<div class="insp-firma-vacia">Sin firma en pantalla: sale la línea para firmar a mano</div>'}
      <div class="barra-acciones"><button class="b b-g" onclick="abrirFirma('${e.id}', '${rol}')">${f.img ? 'Firmar de nuevo' : 'Firmar en pantalla'}</button>${f.img ? `<button class="b b-l" onclick="borrarFirma('${e.id}', '${rol}')">Quitar firma</button>` : ''}</div></div>`;
  }).join('')}</div>`);
  html += `<div class="barra-acciones">${botonPDF}</div>`;
  if (state.firmaInsp?.id === e.id) html += modalFirma(ROLES_FIRMA[state.firmaInsp.rol]);
  return html;
}

