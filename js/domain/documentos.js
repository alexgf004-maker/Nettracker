// Documentos de la precampaña: cartas al cliente y hojas de inspección.
// El texto de la carta es el mismo que usa el equipo; solo cambia el diseño.
// Funciones puras que devuelven un HTML listo para imprimir o guardar como PDF (tamaño carta, una página por caso).
// Los datos del firmante, el contacto y el logo no van en el código: se guardan en config/cartas desde la app.
import { MESES } from './trabajo.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const CONFIG_CARTAS_VACIA = {
  distribuidora: 'DELSUR', ciudad: 'La Libertad', acuerdo: 'N°38-E-2015', contratista: '',
  firmante: '', cargo: '', telefono: '', email: '', pie: '', logo: '',
};

// "25 de septiembre de 2026"
export function fechaEnLetras(fecha) {
  const [y, m, d] = String(fecha || '').split('-').map(Number);
  return y && m && d ? `${d} de ${MESES[m - 1].toLowerCase()} de ${y}` : '';
}
// Texto por defecto del periodo de instalación según el mes de la campaña
export const periodoInstalacion = (anio, mes) => `la primera semana del mes de ${MESES[mes - 1].toLowerCase()} del ${anio}`;

const direccionDe = c => c.direccion || c.direccionEnte || '';
const coord = v => (typeof v === 'number' ? String(Number(v.toFixed(7))) : String(v));
const ubicacionDe = c => (c.lat != null && c.lat !== '' && c.lng != null ? `${coord(c.lat)}, ${coord(c.lng)}` : '');

const BASE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: letter; margin: 0; }
  html, body { background: #e9edf2; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #14213d; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pagina { width: 8.5in; height: 11in; margin: 16px auto; background: #fff; position: relative; overflow: hidden; page-break-after: always; break-after: page; box-shadow: 0 2px 12px rgba(0,0,0,.12); }
  .pagina:last-child { page-break-after: auto; break-after: auto; }
  .barra-acciones { position: sticky; top: 0; z-index: 5; display: flex; gap: 12px; align-items: center; justify-content: center; padding: 10px; background: #14213d; color: #fff; font-size: 13px; }
  .barra-acciones button { background: #fff; color: #14213d; border: none; border-radius: 8px; padding: 8px 16px; font-weight: 700; cursor: pointer; font-size: 13px; }
  @media print { html, body { background: #fff; } .pagina { margin: 0; box-shadow: none; } .barra-acciones { display: none; } }
`;

function documento(titulo, estilos, paginas, total) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(titulo)}</title><style>${BASE}${estilos}</style></head><body>
<div class="barra-acciones"><span>${esc(titulo)} · ${total} ${total === 1 ? 'página' : 'páginas'}</span><button onclick="window.print()">Imprimir o guardar como PDF</button></div>
${paginas}
</body></html>`;
}

// ── CARTAS ──

const ESTILO_CARTA = `
  .carta { padding: 0.7in 0.9in 0.5in; height: 100%; display: flex; flex-direction: column; font-size: 11.2pt; line-height: 1.45; }
  .franja { position: absolute; top: 0; left: 0; right: 0; height: 10px; background: linear-gradient(90deg, #0057b8, #00a3e0); }
  .encabezado { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; }
  .logo img { max-height: 70px; max-width: 220px; }
  .logo-texto { font-size: 22pt; font-weight: 800; color: #0057b8; letter-spacing: 1px; }
  .lugar-fecha { text-align: right; font-size: 10.5pt; color: #4a5568; padding-top: 8px; }
  .referencias { display: flex; gap: 10px; justify-content: flex-end; margin-bottom: 22px; }
  .ref { border: 1px solid #d6e2f0; background: #f4f8fc; border-radius: 8px; padding: 6px 12px; text-align: right; }
  .ref small { display: block; font-size: 7.5pt; letter-spacing: 1px; text-transform: uppercase; color: #6b7a90; }
  .ref b { font-size: 11pt; font-variant-numeric: tabular-nums; color: #14213d; }
  .saludo { margin-bottom: 2px; }
  .cliente { font-weight: 800; font-size: 12.5pt; margin-bottom: 18px; }
  p { text-align: justify; margin-bottom: 12px; }
  .direccion { border-left: 4px solid #0057b8; background: #f4f8fc; padding: 9px 14px; margin: 0 0 14px; font-weight: 700; font-size: 10.5pt; }
  .contratista { text-align: center; font-weight: 800; font-size: 12pt; color: #0057b8; margin: 4px 0 14px; }
  .firmas { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-start; gap: 40px; padding-top: 24px; }
  .firma { flex: 1; font-size: 10pt; line-height: 1.35; }
  .firma .linea { border-top: 1.2px solid #14213d; margin-top: 50px; padding-top: 6px; }
  .firma b { display: block; font-size: 10.5pt; }
  .pie { margin-top: 18px; padding-top: 8px; border-top: 1px solid #d6e2f0; text-align: center; font-size: 8pt; color: #6b7a90; }
`;

export function htmlCartas(casos, opciones) {
  const o = { ...CONFIG_CARTAS_VACIA, ...opciones };
  const logo = o.logo ? `<img src="${esc(o.logo)}" alt="">` : `<div class="logo-texto">${esc(o.distribuidora)}</div>`;
  const contacto = [o.telefono ? `al teléfono <b>${esc(o.telefono)}</b>` : '', o.email ? `al correo <b>${esc(o.email)}</b>` : ''].filter(Boolean).join(' o ');
  const paginas = casos.map(c => `<section class="pagina"><div class="franja"></div><div class="carta">
    <div class="encabezado"><div class="logo">${logo}</div><div class="lugar-fecha">Extendida en ${esc(o.ciudad)}, ${esc(fechaEnLetras(o.fecha))}</div></div>
    <div class="referencias"><div class="ref"><small>Código DGEHM</small><b>${esc(c.codigo)}</b></div><div class="ref"><small>NC</small><b>${esc(c.nc)}</b></div></div>
    <div class="saludo">Estimado cliente:</div>
    <div class="cliente">${esc(c.nombre)}</div>
    <p>Me es grato saludarle y a la vez informarle que la Dirección General de Energía, Hidrocarburos y Minas ha establecido a través del acuerdo ${esc(o.acuerdo)} la realización de la Campaña de Regulación de Tensión mensual, con el objetivo de verificar la calidad de los niveles de voltaje que ${esc(o.distribuidora)} como distribuidora de energía les entrega a los usuarios de sus servicios.</p>
    <p>Por lo anterior SIGET lo seleccionó para ser parte de este proceso, eligiendo el código de referencia asignado a su propiedad, que de acuerdo con nuestro registro pertenece a su NIC (Número de Identificación de Contrato) ubicado en la siguiente dirección:</p>
    <div class="direccion">${esc(direccionDe(c))}</div>
    <p>Para dar cumplimiento a este requerimiento es necesario la instalación de un equipo analizador de redes en el punto de entrega de servicio, esto es, en el gabinete del medidor de facturación o en el punto que el técnico encargado identifique mejor, para esto solicitamos su valioso apoyo permitiendo primeramente el ingreso de nuestro personal a sus instalaciones para recopilar la información necesaria para la configuración del equipo analizador de redes y posteriormente, realizar la visita para la instalación del mismo ${esc(o.periodo)}.</p>
    ${o.contratista ? `<p style="margin-bottom:4px">La empresa contratista encargada de realizar este requerimiento es:</p><div class="contratista">${esc(o.contratista)}</div>` : ''}
    <p>Agradeciendo su atención quedo a su disposición para cualquier información adicional que requiera${contacto ? `, para lo cual puede contactar ${contacto}` : ''}.</p>
    <div class="firmas">
      <div class="firma"><div class="linea"><b>${esc(o.firmante)}</b>${esc(o.cargo)}</div></div>
      <div class="firma"><div class="linea"><b>Autorizado</b>Personal encargado</div></div>
    </div>
    ${o.pie ? `<div class="pie">${esc(o.pie)}</div>` : ''}
  </div></section>`).join('\n');
  return documento(`Cartas · ${o.titulo || ''}`.trim(), ESTILO_CARTA, paginas, casos.length);
}

// ── HOJAS DE INSPECCIÓN ──
// Mismos campos que la hoja que usa el contratista; solo cambia el diseño.

const ESTILO_HOJA = `
  .hoja { padding: 0.45in 0.5in 0.4in; height: 100%; display: flex; flex-direction: column; font-size: 8.6pt; }
  .hoja-top { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #0057b8; padding-bottom: 8px; margin-bottom: 10px; }
  .hoja-top img { max-height: 40px; max-width: 170px; }
  .hoja-top .logo-texto { font-size: 15pt; font-weight: 800; color: #0057b8; }
  .hoja-titulo { text-align: right; }
  .hoja-titulo small { display: block; font-size: 7pt; letter-spacing: 2px; text-transform: uppercase; color: #6b7a90; }
  .hoja-titulo b { font-size: 13pt; color: #0057b8; }
  .datos { display: grid; grid-template-columns: 1.1fr 1fr 1fr 1fr; gap: 6px 10px; background: #f4f8fc; border: 1px solid #d6e2f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; }
  .dato small { display: block; font-size: 6.5pt; letter-spacing: 1px; text-transform: uppercase; color: #6b7a90; }
  .dato b { font-size: 9pt; }
  .dato.ancho { grid-column: span 2; }
  .dato.completo { grid-column: 1 / -1; }
  .mono { font-variant-numeric: tabular-nums; }
  .columnas { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; flex: 1; }
  .col { display: flex; flex-direction: column; gap: 8px; }
  .bloque { border: 1px solid #c9d6e6; border-radius: 7px; overflow: hidden; }
  .bloque h3 { background: #0057b8; color: #fff; font-size: 7.6pt; letter-spacing: 1px; text-transform: uppercase; padding: 4px 8px; }
  .bloque .cuerpo { padding: 6px 8px; display: flex; flex-direction: column; gap: 5px; }
  .fila { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .fila > span:first-child { min-width: 62px; color: #4a5568; }
  .op { display: inline-flex; align-items: center; gap: 4px; margin-right: 8px; }
  .caja { display: inline-block; width: 11px; height: 11px; border: 1.2px solid #14213d; border-radius: 2px; }
  .campo { display: inline-flex; align-items: flex-end; gap: 4px; flex: 1; min-width: 70px; }
  .campo i { font-style: normal; color: #4a5568; white-space: nowrap; }
  .campo u { flex: 1; border-bottom: 1px solid #14213d; height: 13px; text-decoration: none; }
  .tabla-tap { border-collapse: collapse; width: 100%; }
  .tabla-tap th, .tabla-tap td { border: 1px solid #c9d6e6; height: 17px; font-size: 7.6pt; padding: 0 6px; }
  .tabla-tap th { background: #f4f8fc; font-weight: 700; text-align: center; }
  .tabla-tap td:first-child { width: 34px; font-weight: 700; text-align: center; background: #f4f8fc; }
  .recuadro { border: 1px dashed #9fb3cc; border-radius: 6px; height: 46px; display: flex; align-items: flex-start; justify-content: center; padding-top: 4px; color: #6b7a90; font-size: 7.5pt; }
  .sub { font-weight: 700; font-size: 7.6pt; color: #0057b8; text-transform: uppercase; letter-spacing: .5px; margin-top: 2px; }
  .entrega { display: flex; gap: 14px; margin-top: 10px; padding-top: 8px; border-top: 1px solid #d6e2f0; }
`;

const caja = t => `<span class="op"><span class="caja"></span>${t}</span>`;
const campo = t => `<span class="campo"><i>${t}</i><u></u></span>`;
const filaCampos = (...ts) => `<div class="fila">${ts.map(campo).join('')}</div>`;
const tablaTap = () => `<table class="tabla-tap"><tr><th></th><th>Visible</th><th>Interno</th></tr>${['T1', 'T2', 'T3'].map(t => `<tr><td>${t}</td><td></td><td></td></tr>`).join('')}</table>`;

export function htmlHojasInspeccion(casos, opciones = {}) {
  const logo = opciones.logo ? `<img src="${esc(opciones.logo)}" alt="">` : `<div class="logo-texto">${esc(opciones.distribuidora || '')}</div>`;
  const paginas = casos.map(c => `<section class="pagina"><div class="hoja">
    <div class="hoja-top">${logo}<div class="hoja-titulo"><small>Hoja de inspección</small><b class="mono">${esc(c.codigo)}</b></div></div>
    <div class="datos">
      <div class="dato"><small>Caso DGEHM</small><b class="mono">${esc(c.codigo)}</b></div>
      <div class="dato"><small>NC</small><b class="mono">${esc(c.nc)}</b></div>
      <div class="dato"><small>CT/DS</small><b>${esc(c.ct)}</b></div>
      <div class="dato"><small>Alimentador</small><b>${esc(c.alimentador)}</b></div>
      <div class="dato ancho"><small>Nombre</small><b>${esc(c.nombre)}</b></div>
      <div class="dato"><small>Medidor</small><b>${esc(c.medidor)}</b></div>
      <div class="dato"><small>Ubicación</small><b class="mono">${esc(ubicacionDe(c))}</b></div>
      <div class="dato completo"><small>Dirección</small><b>${esc(direccionDe(c))}</b></div>
    </div>
    <div class="columnas">
      <div class="col">
        <div class="bloque"><h3>Tipo de medición</h3><div class="cuerpo">
          <div class="fila">${caja('Secundaria')}${caja('Primaria')}</div>
          <div class="fila"><span>Testblock</span>${caja('Sí')}${caja('No')}</div>
        </div></div>
        <div class="bloque"><h3>Tipo de conexión</h3><div class="cuerpo">
          ${['Delta', 'Estrella', 'Bifásica', 'Monofásica'].map(t => `<div class="fila"><span>${t}</span>${caja('Primaria')}${caja('Secundaria')}</div>`).join('')}
        </div></div>
        <div class="bloque"><h3>Voltaje secundario</h3><div class="cuerpo">
          <div class="fila">${['120 V', '208 V', '240 V', '480 V'].map(caja).join('')}</div>
          ${filaCampos('Otro:')}
        </div></div>
        <div class="bloque"><h3>Posición del TAP</h3><div class="cuerpo">${tablaTap()}</div></div>
        <div class="bloque"><h3>Medición auxiliar</h3><div class="cuerpo">
          <div class="fila"><span>Tipo</span>${caja('Primaria')}${caja('Secundaria')}</div>
          ${filaCampos('Referencia (CT/DS):')}
          ${filaCampos('X medidor:', 'Multiplicador placa:')}
          <div class="sub">Posición del TAP</div>${tablaTap()}
          <div class="sub">Voltaje primario</div>
          ${filaCampos('Van:', 'Vab:')}${filaCampos('Vbn:', 'Vbc:')}${filaCampos('Vcn:', 'Vca:')}
          <div class="sub">Voltaje secundario</div>
          ${filaCampos('va:', 'vab:')}${filaCampos('vb:', 'vbc:')}${filaCampos('vc:', 'vac:')}
        </div></div>
      </div>
      <div class="col">
        <div class="bloque"><h3>Relaciones</h3><div class="cuerpo">${filaCampos('Xp:')}${filaCampos('Xc:')}${filaCampos('Xt:')}</div></div>
        <div class="bloque"><h3>Lecturas del medidor</h3><div class="cuerpo">${filaCampos('Parámetro 15:')}${filaCampos('Parámetro 16:')}${filaCampos('Parámetro 17:')}</div></div>
        <div class="bloque"><h3>Lecturas (voltímetro)</h3><div class="cuerpo">${filaCampos('Van:', 'Vab:')}${filaCampos('Vbn:', 'Vbc:')}${filaCampos('Vcn:', 'Vac:')}</div></div>
        <div class="bloque"><h3>Definición del multiplicador</h3><div class="cuerpo">
          <div class="sub">Multiplicador ECAMEC</div><div class="recuadro">V ll (prim) / V ll (sec)</div>
          <div class="sub">Multiplicador DRANETZ</div><div class="recuadro" style="height:30px"></div>
        </div></div>
        <div class="bloque"><h3>Lecturas punto de control</h3><div class="cuerpo">
          <div class="fila"><span class="sub" style="min-width:0;flex:1">vlnPC</span><span class="sub" style="min-width:0;flex:1">vllPC</span></div>
          ${filaCampos('van:', 'vab:')}${filaCampos('vbn:', 'vbc:')}${filaCampos('vcn:', 'vac:')}
        </div></div>
        <div class="bloque"><h3>Multiplicador encontrado</h3><div class="cuerpo">
          <div class="fila"><span class="sub" style="min-width:0;flex:1">VlnAux / vlnPC</span><span class="sub" style="min-width:0;flex:1">VllAux / vllPC</span></div>
          ${filaCampos('Xan:', 'Xab:')}${filaCampos('Xbn:', 'Xbc:')}${filaCampos('Xcn:', 'Xca:')}
        </div></div>
      </div>
    </div>
    <div class="entrega">${campo('Carta entregada a:')}</div>
  </div></section>`).join('\n');
  return documento(`Hojas de inspección · ${opciones.titulo || ''}`.trim(), ESTILO_HOJA, paginas, casos.length);
}
