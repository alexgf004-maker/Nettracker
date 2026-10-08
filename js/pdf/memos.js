// Plantillas HTML de memorándums (movimientos, lotes, carga masiva, revisión y daño).
// El estilo y los bloques comunes viven en memo-base.js.
import { CONDICIONES, USUARIOS } from '../config.js';
import { state } from '../state.js';
import { abrirDoc } from '../ui.js';
import { areaToSede, escapeHtml as e, fmtDate } from '../utils.js';
import { cuenta, dato, datos, docMemo, firmas, movimiento as bloqueMovimiento, seccion, texto } from './memo-base.js';

const nombreArchivo = (prefijo, serie) => prefijo + '-' + String(serie || 'equipo').replace(/[^\w-]+/g, '_') + '.html';
const hora = () => new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });

export function generateLotePDF(equiposLote, tipo) {
  const esTipo = tipo === 'prestamo' ? 'Préstamo' : 'Devolución';
  const mov0 = equiposLote[0]?.movimiento || {};
  const de = mov0.de || (tipo === 'prestamo' ? 'CPT BT' : 'CPT MT');
  const a = mov0.a || (tipo === 'prestamo' ? 'CPT MT' : 'CPT BT');
  const registrado = mov0.registradoPor || '';
  const areaRegistro = USUARIOS.find(x => x.nombre === registrado)?.area; // el nombre va bajo el área de quien registra

  const filas = equiposLote.map((item, i) => {
    const mov = item.movimiento;
    return `<tr>
      <td class="num">${i + 1}</td>
      <td class="mono"><b>${e(item.eq.serie)}</b></td>
      <td class="mono">${e(item.eq.vineta || '—')}</td>
      <td>${e(item.eq.modelo || '—')}</td>
      <td class="c">${mov ? fmtDate(mov.fecha) : '—'}</td>
    </tr>`;
  }).join('');

  const cuerpo =
    seccion('Movimiento', bloqueMovimiento({ eti: 'Área que entrega', val: e(de) }, { eti: 'Área que recibe', val: e(a) }))
    + seccion('Equipos incluidos', `<div class="tabla-wrap"><table class="tabla">
        <thead><tr><th>#</th><th>N° de serie</th><th>Viñeta</th><th>Modelo</th><th class="c">Fecha</th></tr></thead>
        <tbody>${filas}</tbody></table></div>`, cuenta(equiposLote.length))
    + seccion('Firmas de conformidad', firmas([
      { eti: 'Entrega', nom: e(de), sub: areaRegistro === de ? e(registrado) : '' },
      { eti: 'Recibe', nom: e(a), sub: areaRegistro === a ? e(registrado) : '' },
    ]));

  abrirDoc(docMemo({
    titulo: `${esTipo} de lote · ${equiposLote.length} equipos`,
    tipo: `${esTipo} de lote`,
    meta: [['Fecha', fmtDate(mov0.fecha) || new Date().toLocaleDateString('es-SV')], ['Equipos', String(equiposLote.length)], ['Registrado por', e(registrado)]],
    cuerpo,
  }), 'documento.html');
}

export function generateMemoPDF(eq, mov) {
  const esTipo = mov.tipo === 'prestamo' ? 'Préstamo' : 'Devolución';
  const de = mov.de || '';
  const a = mov.a || '';
  const usuario = USUARIOS.find(x => x.nombre === mov.registradoPor);
  const firmaDe = usuario && usuario.area === de ? e(mov.registradoPor) : '';
  const firmaA = usuario && usuario.area === a ? e(mov.registradoPor) : '';

  const cuerpo =
    seccion('Datos del equipo', datos([
      dato('Número de serie', e(eq.serie), true),
      dato('Modelo / Marca', e(eq.modelo)),
      dato('Viñeta', e(eq.vineta), true),
    ]))
    + seccion('Movimiento', bloqueMovimiento({ eti: 'Área que entrega', val: e(de) }, { eti: 'Área que recibe', val: e(a) }))
    + (mov.nota ? seccion('Observaciones', texto(e(mov.nota))) : '')
    + seccion('Firmas de conformidad', firmas([
      { eti: 'Entrega', nom: e(de), sub: firmaDe },
      { eti: 'Recibe', nom: e(a), sub: firmaA },
    ]));

  abrirDoc(docMemo({
    titulo: `${esTipo} · ${e(eq.serie)}`,
    tipo: esTipo,
    meta: [['Fecha', fmtDate(mov.fecha)], ['Equipo', e(eq.serie)], ['Registrado por', e(mov.registradoPor)]],
    cuerpo,
  }), 'documento.html');
}

export function buildMemoCargaMasiva(filas) {
  const origen = state.cargaAreaOrigen;
  const esMT = origen === 'CPT MT' || origen === 'CPT DELSUR';
  const fecha = new Date().toLocaleDateString('es-SV');
  const td = (v, mono, c) => `<td class="${[mono && 'mono', c && 'c'].filter(Boolean).join(' ')}">${v || '—'}</td>`;
  const rows = filas.map((r, i) => '<tr>'
    + `<td class="num">${i + 1}</td>`
    + td(r.caso, true)
    + td(r.serie, true)
    + td(r.vineta, true)
    + td(r.idUsuario)
    + td(r.lugar)
    + td(r.direccion)
    + (esMT ? td(r.multiplicador) + td(r.corrientes) + td(r.conexion) : td(r.notas) + td(r.medidor, true))
    + td(r.fechaInst, false, true)
    + (esMT ? '' : td(r.fechaRetiro, false, true))
    + td(r.accesorios)
    + '</tr>').join('');

  const cuerpo =
    `<p class="intro">Mediante la presente se notifica la asignación de <b>${filas.length} analizadores de red ECAMEC</b> a <b>Campos y Servicios</b>, los cuales serán usados para las siguientes mediciones.</p>`
    + seccion('Equipos asignados', `<div class="tabla-wrap"><table class="tabla">
      <thead><tr>
        <th>#</th><th>N° SIGET</th><th>Equipo</th><th>Viñeta</th><th>ID usuario</th><th>Nombre del usuario</th><th>Dirección</th>
        ${esMT ? '<th>Multiplicador</th><th>Corrientes</th><th>Conexión</th>' : '<th>Transformador</th><th>Medidor</th>'}
        <th class="c">F. instalación</th>${esMT ? '' : '<th class="c">F. retiro</th>'}<th>Accesorios</th>
      </tr></thead>
      <tbody>${rows}</tbody></table></div>`, cuenta(filas.length))
    + seccion('Firmas de conformidad', firmas([
      { eti: 'Entrega', nom: `${origen} · ${areaToSede(origen)}`, sub: state.sesionUsuario?.nombre || '' },
      { eti: 'Recibe', nom: 'Campos y Servicios' },
    ]));

  return docMemo({
    titulo: `Asignación de equipos · ${fecha}`,
    tipo: 'Asignación de equipos',
    meta: [['Fecha', fecha], ['Para', 'Campos y Servicios'], ['Entrega', `${origen} · ${areaToSede(origen)}`], ['Equipos', String(filas.length)]],
    cuerpo,
    compacta: true,
    apaisada: true,
  });
}

// Memo de envío de un equipo a revisión en la Subestación Cucumacayán
export function generateMemoRevision(eq, envio) {
  const cond = CONDICIONES.find(c => c.key === envio.condicionAnterior);
  const area = USUARIOS.find(u => u.nombre === envio.entregadoPor)?.area || '';
  const antecedentes = envio.antecedentes || [];

  const cuerpo =
    seccion('Datos del equipo', datos([
      dato('Número de serie', e(eq.serie), true),
      dato('Modelo / Marca', e(eq.modelo)),
      dato('Viñeta', e(eq.vineta), true),
      dato('Condición al entregar', cond ? cond.label : ''),
      dato('Fecha del incidente', fmtDate(envio.fechaIncidente)),
      dato('Fecha de entrega', fmtDate(envio.fecha)),
    ]))
    + seccion('Entrega', bloqueMovimiento(
      { eti: 'Entrega', val: e(envio.sedeOrigen), sub: area ? e(area) : '' },
      { eti: 'Recibe para revisión', val: 'Subestación Cucumacayán' }, 'morado'))
    + seccion('Motivo de la entrega', texto(e(envio.motivo)))
    + seccion('¿Qué le pasó al equipo?', texto(e(envio.descripcion), true))
    + (antecedentes.length ? seccion('Antecedentes registrados', `<table class="tabla">
        <thead><tr><th style="width:96px">Fecha</th><th>Detalle</th><th style="width:34%">Origen</th></tr></thead>
        <tbody>${antecedentes.map(x => `<tr><td>${fmtDate(x.fecha)}</td><td>${e(x.texto)}</td><td>${e(x.origen)}</td></tr>`).join('')}</tbody>
      </table>`) : '')
    + seccion('Firmas de conformidad', firmas([
      { eti: 'Entrega', nom: e(envio.entregadoPor), sub: area ? e(area) : '' },
      { eti: 'Recibe', nom: '', sub: 'Subestación Cucumacayán' },
    ]));

  abrirDoc(docMemo({
    titulo: `Envío a revisión · ${e(eq.serie)}`,
    tipo: 'Envío a revisión',
    meta: [['Fecha', fmtDate(envio.fecha) + (envio.hora ? ' · ' + e(envio.hora) : '')], ['Equipo', e(eq.serie)], ['Entregado por', e(envio.entregadoPor)]],
    cuerpo,
    pie: envio.editadoPor ? ` · Última edición: ${fmtDate(envio.fechaEdicion)} por ${e(envio.editadoPor)}` : '',
  }), nombreArchivo('envio-revision', eq.serie));
}

// Memo de equipo dañado en campo por Campos y Servicios (tres firmas)
export function generateMemoDanio(m) {
  const cond = CONDICIONES.find(c => c.key === m.condicion);

  const cuerpo =
    `<p class="intro">Por medio del presente se hace constar que el analizador de red detallado a continuación, despachado a
    <b>Campos y Servicios</b> para su instalación en campo, resultó dañado. El equipo se entrega en la
    <b>Subestación Cucumacayán</b> en la condición indicada.</p>`
    + seccion('Datos del equipo', datos([
      dato('Número de serie', e(m.serie), true),
      dato('Modelo / Marca', e(m.modelo)),
      dato('Viñeta', e(m.vineta), true),
    ]))
    + seccion('Datos de la instalación', datos([
      dato('Caso', m.caso ? '#' + e(m.caso) : '', true),
      dato('Lugar', e(m.lugar)),
      dato('Área beneficiaria', e(m.areaBeneficiaria)),
      dato('Fecha de instalación', fmtDate(m.fechaInstalacion)),
      dato('Retiro programado', fmtDate(m.fechaRetiro)),
      dato('Fecha del daño', fmtDate(m.fechaDanio)),
    ]))
    + seccion('¿Qué le pasó al equipo?', texto(e(m.descripcion), true))
    + seccion('Recepción', datos([
      dato('Condición en que se recibe', cond ? cond.label : e(m.condicion)),
      dato('Se entrega en', 'Subestación Cucumacayán'),
      dato('Técnico de Campos y Servicios', e(m.tecnicoCampos)),
    ]))
    + seccion('Firmas de conformidad', firmas([
      { eti: e(m.areaGenera || 'CPT MT'), nom: e(m.generadoPor), sub: 'CPT INNOVA' },
      { eti: 'Subestación Cucumacayán', nom: '', sub: 'Recibe el equipo' },
      { eti: 'Campos y Servicios', nom: '', sub: 'Contratista' },
    ]));

  abrirDoc(docMemo({
    titulo: `Equipo dañado · ${e(m.serie)}`,
    tipo: 'Equipo dañado en campo',
    meta: [['Fecha', fmtDate(m.fecha) + (m.hora ? ' · ' + e(m.hora) : '')], ['Equipo', e(m.serie)], ['Generado por', e(m.generadoPor)]],
    cuerpo,
    rojo: true,
    pie: m.editadoPor ? ` · Última edición: ${fmtDate(m.fechaEdicion)} por ${e(m.editadoPor)}` : '',
  }), nombreArchivo('equipo-danado', m.serie));
}

// Memo de entrega de accesorios (candados, cadenas, sellos). items: [{ label, qty, detalle }]
// fechaGuardada (AAAA-MM-DD) se usa al reimprimir un memo del historial
export function buildMemoAccesorios(f, items, fechaGuardada) {
  const fecha = fechaGuardada ? fmtDate(fechaGuardada) : new Date().toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const cuerpo =
    seccion('Movimiento', bloqueMovimiento({ eti: 'Entrega', val: e(f.de) }, { eti: 'Recibe', val: e(f.para) }))
    + seccion('Accesorios entregados', `<table class="tabla">
        <thead><tr><th>Accesorio</th><th class="c" style="width:100px">Cantidad</th><th>Detalle</th></tr></thead>
        <tbody>${items.map(x => `<tr><td><b>${e(x.label)}</b></td><td class="c mono" style="font-size:15px;font-weight:800;color:#0e7490">${x.qty}</td><td>${e(x.detalle || '—')}</td></tr>`).join('')}</tbody>
      </table>`)
    + seccion('Firmas de conformidad', firmas([
      { eti: 'Entrega', nom: e(f.de) },
      { eti: 'Recibe', nom: e(f.para) },
    ]));
  return docMemo({
    titulo: `Entrega de accesorios · ${fecha}`,
    tipo: 'Entrega de accesorios',
    meta: [['Fecha', fechaGuardada ? fecha : fecha + ' · ' + hora()], ['De', e(f.de)], ['Para', e(f.para)]],
    cuerpo,
  });
}
