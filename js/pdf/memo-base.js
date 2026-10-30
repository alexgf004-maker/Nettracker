// Base común de los memorándums: hoja carta sobria (encabezado en blanco con una franja turquesa; ver SOBRIO). Al imprimir
// lleva márgenes de 12 mm puestos por la propia hoja (ver ESTILO_IMPRESION).
// Cada plantilla arma su cuerpo con estos bloques y los envuelve con docMemo().



// Estilo sobrio (pedido del equipo: el encabezado de color gastaba mucha tinta): encabezado en blanco con una franja
// turquesa arriba (roja en equipo dañado), título en turquesa, datos con líneas finas y tablas con encabezado blanco y
// filas alternadas en gris (ayudan a seguir la fila en campo). Va aparte para ponérselo también a los memos ya guardados.
const SOBRIO = `
  .enc { background: #fff; color: var(--texto); border-top: 5px solid var(--turq); border-bottom: 0; border-radius: 0; padding: 16px 34px 12px; }
  .enc.rojo { background: #fff; border-top-color: #dc2626; }
  .enc.rojo .titulo-tipo { color: #b91c1c; }
  .marca-nombre { font-size: 16px; letter-spacing: 1.5px; color: var(--texto); }
  .marca-sub, .titulo-eti { opacity: 1; color: var(--texto3); }
  .titulo-tipo { color: var(--turq); font-size: 20px; }
  .meta { background: #fff; border-top: 1px solid var(--borde); border-bottom: 1px solid var(--borde); }
  .meta > div { border-right: 0; }
  .meta-val { color: var(--texto); }
  .sec-tit { color: var(--turq); }
  .sec-tit::before { display: none; }
  .cuenta { background: #fff; border-color: var(--borde); color: var(--texto2); }
  table.tabla { border: 0; border-radius: 0; }
  .tabla th { background: #fff; color: var(--texto2); border-bottom: 1.5px solid var(--texto); }
  .tabla td { border-top: 1px solid #e2e8f0; }
  .tabla tbody tr:nth-child(even) td { background: #f1f5f9; }
  .mov-flecha span { background: var(--turq); }
  .pie { border-top: 1px solid var(--borde); border-image: none; }
  .hoja.formal .enc { border-top: 0; border-bottom: 3px double var(--petroleo); }
  .hoja.formal .titulo-tipo { color: var(--petroleo); }`;

// Impresión: carta. Va aparte para ponérsela también a los memos ya guardados como HTML (despachos).
// La hoja de impresión no tiene margen (así el navegador no agrega la fecha, el título ni el enlace arriba y abajo): el
// margen de 12 mm lo pone la propia hoja y se repite en cada página. Las tablas largas se parten entre páginas (antes
// la sección entera pasaba a la página siguiente y dejaba la primera casi vacía), sin separar el título de la tabla.
// Sin el logo de la app (pedido del equipo).
export const ESTILO_IMPRESION = `
  @page { size: letter; margin: 0; }
  @page apaisada { size: letter landscape; margin: 0; }
  @media print {
    body { background: #fff; }
    .barra { display: none; }
    .hoja { margin: 0; box-shadow: none; width: auto; min-height: 278mm; padding: 12mm; -webkit-box-decoration-break: clone; box-decoration-break: clone; } /* el pie al fondo de la hoja (carta: 279.4 mm) */
    .hoja.apaisada { page: apaisada; min-height: 214mm; }
    .marca-logo { display: none; }
    .sec:has(table) { break-inside: auto; }
    .sec-tit { break-after: avoid; }
    table thead { display: table-header-group; }
    .firmas, .ffirmas, .pie { break-inside: avoid; }
    /* Hoja compacta (asignación de equipos): todo más junto para que unas 20 mediciones quepan en una hoja */
    .hoja.compacta { min-height: 0; padding: 9mm 10mm; }
    .hoja.compacta .enc { padding: 10px 0 8px; }
    .hoja.compacta .titulo-tipo { font-size: 18px; } .hoja.compacta .marca-nombre { font-size: 16px; }
    .hoja.compacta .meta > div { padding: 5px 16px 5px 0; }
    .hoja.compacta .cuerpo { padding: 10px 0 4px; }
    .hoja.compacta .intro { font-size: 11px; line-height: 1.45; margin-bottom: 8px; }
    .hoja.compacta .intro-acc { font-size: 10px; margin-top: 2px; }
    .hoja.compacta .sec { margin-bottom: 10px; }
    .hoja.compacta .sec-tit { margin-bottom: 5px; font-size: 9.5px; }
    .hoja.compacta .tabla th { font-size: 7.5px; padding: 4px 5px; letter-spacing: .4px; }
    .hoja.compacta .tabla td { font-size: 8.5px; padding: 3px 5px; line-height: 1.3; }
    .hoja.compacta .tabla td.mono, .hoja.compacta .tabla td.c { white-space: nowrap; }
    .hoja.compacta .firma { padding-top: 34px; }
    .hoja.compacta .firmas { gap: 24px; margin-top: 0; }
    .hoja.compacta .pie { padding: 6px 0 0; }
    ${SOBRIO}
    .enc { padding: 14px 0 10px; }
    .meta > div { padding: 8px 16px 8px 0; }
    .cuerpo { padding: 22px 0 8px; }
    .pie { margin: 0; }
  }`;

const ESTILO = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --petroleo: #0b2e3b; --turq: #0e7490; --turq2: #06b6d4; --turq-claro: #ecfeff; --texto: #0f172a; --texto2: #475569; --texto3: #64748b; --borde: #d7e3e8; --fondo: #f4f8fa; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif; color: var(--texto); background: #e6edf0; font-size: 13px; line-height: 1.45; font-variant-numeric: tabular-nums; }
  .hoja { width: 215.9mm; min-height: 279.4mm; margin: 24px auto; background: #fff; box-shadow: 0 10px 30px -12px rgba(11,46,59,.35); display: flex; flex-direction: column; }
  .hoja.apaisada { width: 279.4mm; min-height: 215.9mm; }
  .barra { position: sticky; top: 0; z-index: 2; display: flex; justify-content: center; gap: 10px; padding: 10px; background: rgba(230,237,240,.92); }
  .barra button { font: 700 13px 'Plus Jakarta Sans', Arial, sans-serif; color: #fff; background: linear-gradient(120deg, #0b2e3b, #0e7490 60%, #0891b2); border: 0; border-radius: 10px; padding: 10px 22px; cursor: pointer; }

  .enc { display: flex; justify-content: space-between; align-items: center; gap: 24px; }
  .marca { display: flex; align-items: center; gap: 14px; }
  .marca-logo { width: 50px; height: 50px; border-radius: 14px; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28); display: flex; align-items: center; justify-content: center; }
  .marca-logo svg { width: 28px; height: 28px; }
  .marca-nombre { font-size: 20px; font-weight: 800; letter-spacing: .3px; }
  .marca-img { flex-direction: column; align-items: flex-start; gap: 6px; }
  .marca-img img { max-height: 58px; max-width: 240px; object-fit: contain; }
  .marca-sub { font-size: 11px; opacity: .78; margin-top: 1px; }
  .titulo { text-align: right; }
  .titulo-eti { font-size: 10px; font-weight: 700; letter-spacing: 2.4px; text-transform: uppercase; opacity: .75; }
  .titulo-tipo { font-size: 22px; font-weight: 800; line-height: 1.15; margin-top: 3px; }
  .meta { display: flex; border-bottom: 1px solid var(--borde); background: var(--fondo); }
  .meta > div { flex: 1; padding: 10px 34px; border-right: 1px solid var(--borde); }
  .meta > div:last-child { border-right: 0; }
  .meta-eti { font-size: 9.5px; font-weight: 700; color: var(--texto3); letter-spacing: 1.2px; text-transform: uppercase; }
  .meta-val { font-size: 13px; font-weight: 700; color: var(--petroleo); margin-top: 1px; }

  .cuerpo { padding: 26px 34px 10px; flex: 1; }
  .intro { font-size: 13.5px; color: #1e293b; line-height: 1.65; margin-bottom: 22px; }
  .sec { margin-bottom: 22px; break-inside: avoid; }
  .sec-tit { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 800; color: var(--turq); letter-spacing: 1.6px; text-transform: uppercase; margin-bottom: 10px; }
  .sec-tit::before { content: ''; width: 4px; height: 14px; border-radius: 2px; background: linear-gradient(180deg, #0e7490, #06b6d4); }
  .sec-tit::after { content: ''; flex: 1; height: 1px; background: var(--borde); }
  .cuenta { display: inline-block; background: var(--turq-claro); color: var(--turq); border: 1px solid #a5f3fc; border-radius: 20px; padding: 1px 10px; font-size: 11px; letter-spacing: 0; text-transform: none; }

  .datos { display: grid; grid-template-columns: repeat(var(--cols, 3), 1fr); border: 1px solid var(--borde); border-radius: 12px; overflow: hidden; }
  .dato { padding: 11px 16px; border-right: 1px solid var(--borde); border-bottom: 1px solid var(--borde); margin: 0 -1px -1px 0; }
  .dato-eti { font-size: 9.5px; font-weight: 700; color: var(--texto3); letter-spacing: 1px; text-transform: uppercase; }
  .dato-val { font-size: 15px; font-weight: 700; color: var(--texto); margin-top: 3px; word-break: break-word; }
  .mono { font-weight: 700; }

  .mov { display: flex; align-items: stretch; gap: 0; }
  .mov-caja { flex: 1; border: 1px solid var(--borde); border-radius: 12px; padding: 14px 18px; background: #fff; }
  .mov-caja.dest { background: var(--turq-claro); border-color: #a5f3fc; }
  .mov-caja.morado { background: #f5f3ff; border-color: #ddd6fe; }
  .mov-eti { font-size: 9.5px; font-weight: 700; color: var(--texto3); letter-spacing: 1px; text-transform: uppercase; }
  .mov-val { font-size: 17px; font-weight: 800; color: var(--petroleo); margin-top: 3px; }
  .mov-sub { font-size: 12px; color: var(--texto2); margin-top: 1px; }
  .mov-flecha { width: 46px; display: flex; align-items: center; justify-content: center; }
  .mov-flecha span { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(120deg, #0b2e3b, #0e7490 60%, #0891b2); color: #fff; font-size: 17px; font-weight: 800; display: flex; align-items: center; justify-content: center; }

  .texto { background: var(--fondo); border: 1px solid var(--borde); border-left: 4px solid var(--turq); border-radius: 10px; padding: 12px 16px; font-size: 13.5px; color: #1e293b; white-space: pre-wrap; }
  .texto.falla { background: #fef2f2; border-color: #fecaca; border-left-color: #dc2626; }

  table.tabla { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid var(--borde); border-radius: 12px; overflow: hidden; }
  .tabla th { background: var(--petroleo); color: #fff; font-size: 10px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase; text-align: left; padding: 9px 12px; }
  .tabla td { padding: 9px 12px; font-size: 12.5px; border-top: 1px solid var(--borde); vertical-align: top; }
  .tabla tbody tr:nth-child(even) td { background: var(--fondo); }
  .tabla .c { text-align: center; }
  .tabla .num { color: var(--texto3); font-size: 11px; width: 34px; }
  .tabla tr { break-inside: avoid; }
  .hoja.compacta .cuerpo { padding: 18px 22px 6px; }
  .hoja.compacta .tabla th { font-size: 8.5px; padding: 6px 7px; }
  .hoja.compacta .tabla td { font-size: 10px; padding: 5px 7px; }
  .intro-acc { display: inline-block; margin-top: 4px; font-size: 12px; color: var(--texto2); }

  .firmas { display: grid; grid-template-columns: repeat(var(--cols, 2), 1fr); gap: 36px; margin-top: 8px; }
  .firma { text-align: center; padding-top: 58px; }
  .firma-linea { border-top: 1.5px solid var(--petroleo); padding-top: 8px; }
  .firma-eti { font-size: 9.5px; font-weight: 700; color: var(--texto3); letter-spacing: 1.2px; text-transform: uppercase; }
  .firma-nom { font-size: 13.5px; font-weight: 800; color: var(--texto); margin-top: 2px; min-height: 18px; }
  .firma-sub { font-size: 11.5px; color: var(--texto2); margin-top: 1px; }

  .pie { margin: 0 34px; padding: 12px 0 18px; border-top: 2px solid; border-image: linear-gradient(90deg, #0b2e3b, #0e7490, #06b6d4) 1; display: flex; justify-content: space-between; gap: 16px; font-size: 10px; color: var(--texto3); }
  .pie b { color: var(--petroleo); }

  /* Variante formal (formularios): encabezado blanco con filete, cuadros rectos y casillas */
  .hoja.formal .enc { background: #fff; color: var(--petroleo); border-bottom: 3px double var(--petroleo); padding: 20px 34px 16px; }
  .hoja.formal .marca-logo { background: var(--petroleo); border-color: var(--petroleo); border-radius: 10px; }
  .hoja.formal .marca-sub { opacity: 1; color: var(--texto2); }
  .hoja.formal .titulo-eti { opacity: 1; color: var(--texto3); }
  .hoja.formal .titulo-tipo { font-size: 18px; text-transform: uppercase; letter-spacing: .6px; }
  .hoja.formal .meta { background: #fff; }
  .hoja.formal .cuerpo { padding: 18px 30px 8px; font-size: 11.5px; }
  .hoja.formal .sec { margin-bottom: 14px; }
  .hoja.formal .sec-tit { color: var(--petroleo); font-size: 10.5px; margin-bottom: 6px; }
  .hoja.formal .sec-tit::before { background: var(--petroleo); }
  .ft { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .ft td, .ft th { border: 1px solid #9fb3bd; padding: 4px 8px; vertical-align: top; font-size: 11px; }
  .ft th { background: #eef3f5; color: var(--petroleo); font-size: 9px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; text-align: left; }
  .ft .eti { background: #eef3f5; color: var(--texto2); font-size: 9px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; width: 24%; }
  .ft .val { font-weight: 600; color: var(--texto); min-height: 16px; }
  .ft .c { text-align: center; }
  .ft td.val { height: 21px; }
  .ft tr { break-inside: avoid; }
  .cbs { display: flex; flex-wrap: wrap; gap: 4px 16px; }
  .cbs.col2 { display: grid; grid-template-columns: 1fr 1fr; }
  .cb { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; }
  .cb i { width: 11px; height: 11px; border: 1.3px solid var(--petroleo); display: inline-flex; align-items: center; justify-content: center; font-style: normal; font-size: 9px; font-weight: 800; line-height: 1; flex: none; }
  .cb.on i::after { content: '✓'; }
  .ok { color: #047857; font-weight: 800; } .mal { color: #b91c1c; font-weight: 800; }
  .ffirmas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 6px; }
  .ffirma { border: 1px solid #9fb3bd; padding: 8px 10px; text-align: center; break-inside: avoid; }
  .ffirma-img { height: 56px; display: flex; align-items: flex-end; justify-content: center; border-bottom: 1.3px solid var(--petroleo); margin-bottom: 6px; }
  .ffirma-img img { max-height: 60px; max-width: 100%; }
  .ffirma-rol { font-size: 8.5px; font-weight: 700; color: var(--texto3); letter-spacing: 1px; text-transform: uppercase; }
  .ffirma-nom { font-size: 12px; font-weight: 800; min-height: 16px; margin-top: 2px; }
  .ffirma-cargo { font-size: 10.5px; color: var(--texto2); min-height: 14px; }

  ${SOBRIO}
  ${ESTILO_IMPRESION}
  @media print {
    .hoja.formal { min-height: 0; }
    .hoja.formal .sec-tit { break-after: avoid; }
  }
  @media screen and (max-width: 820px) {
    .hoja, .hoja.apaisada { width: auto; min-height: 0; margin: 0; }
    .enc { flex-direction: column; align-items: flex-start; padding: 20px; }
    .titulo { text-align: left; }
    .meta { flex-wrap: wrap; } .meta > div { padding: 8px 20px; min-width: 50%; }
    .cuerpo { padding: 20px; } .pie { margin: 0 20px; flex-direction: column; }
    .datos { grid-template-columns: 1fr 1fr; }
    .mov { flex-direction: column; } .mov-flecha { width: auto; height: 40px; } .mov-flecha span { transform: rotate(90deg); }
    .firmas { grid-template-columns: 1fr; gap: 0; }
    .tabla-wrap { overflow-x: auto; }
    .ffirmas, .cbs.col2 { grid-template-columns: 1fr; }
  }
`;

const hoy = () => new Date().toLocaleDateString('es-SV');

// Documento completo. meta: [[etiqueta, valor], ...] bajo el encabezado.
export function docMemo({ titulo, tipo, meta = [], cuerpo, pie = '', rojo = false, compacta = false, apaisada = false, formal = false, logo = '', etiqueta = 'Memorándum de', subtitulo = 'Calidad del Producto Técnico · Analizadores de Red' }) {
  const clases = ['hoja', compacta && 'compacta', apaisada && 'apaisada', formal && 'formal'].filter(Boolean).join(' ');
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<style>${ESTILO}</style>
</head>
<body>
<div class="barra"><button onclick="window.print()">Imprimir o guardar PDF</button></div>
<div class="${clases}">
  <div class="enc${rojo ? ' rojo' : ''}">
    ${logo ? `<div class="marca marca-img"><img src="${logo}" alt=""><div class="marca-sub">${subtitulo}</div></div>` : `<div class="marca">
      <div><div class="marca-nombre">CPT INNOVA</div><div class="marca-sub">${subtitulo}</div></div>
    </div>`}
    <div class="titulo"><div class="titulo-eti">${etiqueta}</div><div class="titulo-tipo">${tipo}</div></div>
  </div>
  ${meta.length ? `<div class="meta">${meta.map(([e, v]) => `<div><div class="meta-eti">${e}</div><div class="meta-val">${v || '—'}</div></div>`).join('')}</div>` : ''}
  <div class="cuerpo">${cuerpo}</div>
  <div class="pie"><span>${pie.replace(/^ · /, '')}</span><span>${hoy()}</span></div>
</div>
</body>
</html>`;
}

export const seccion = (titulo, contenido, extra = '') => `<div class="sec"><div class="sec-tit">${titulo}${extra ? ' ' + extra : ''}</div>${contenido}</div>`;

export const dato = (etiqueta, valor, mono = false) =>
  `<div class="dato"><div class="dato-eti">${etiqueta}</div><div class="dato-val${mono ? ' mono' : ''}">${valor || '—'}</div></div>`;

export const datos = (items, cols = 3) => `<div class="datos" style="--cols:${cols}">${items.join('')}</div>`;

// Origen → destino. caja: { eti, val, sub }
export const movimiento = (origen, destino, claseDestino = 'dest') => {
  const caja = (c, cls) => `<div class="mov-caja ${cls}"><div class="mov-eti">${c.eti}</div><div class="mov-val">${c.val || '—'}</div>${c.sub ? `<div class="mov-sub">${c.sub}</div>` : ''}</div>`;
  return `<div class="mov">${caja(origen, '')}<div class="mov-flecha"><span>&rarr;</span></div>${caja(destino, claseDestino)}</div>`;
};

export const texto = (contenido, falla = false) => `<div class="texto${falla ? ' falla' : ''}">${contenido}</div>`;

// firmas: [{ eti, nom, sub, firma }]; firma = { img, nombre } si se firmó en pantalla (sin ella queda la línea para firmar
// a mano). La imagen va con estilo en línea para que también entre en los memos guardados como HTML (despachos).
const imgFirma = src => (!/^data:image\/(png|jpeg);base64,[\w+/=]+$/.test(String(src)) ? '' : `<img src="${src}" alt="Firma" style="display:block;max-height:54px;max-width:85%;margin:-56px auto 2px">`);
const firmo = f => (f?.nombre ? `<div class="firma-sub">Firmó: ${String(f.nombre).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>` : '');
export const firmas = lista =>
  `<div class="firmas" style="--cols:${lista.length}">${lista.map(f => `<div class="firma">${f.firma?.img ? imgFirma(f.firma.img) : ''}<div class="firma-linea"><div class="firma-eti">${f.eti}</div><div class="firma-nom">${f.nom || '&nbsp;'}</div>${f.sub ? `<div class="firma-sub">${f.sub}</div>` : ''}${firmo(f.firma)}</div></div>`).join('')}</div>`;

// Pone las firmas en un memo ya guardado como HTML: en orden, en cada recuadro de firma (lista: [firma | null])
export function ponerFirmas(html, lista) {
  let i = 0;
  return String(html).replace(/<div class="firma"><div class="firma-linea">([\s\S]*?)<\/div><\/div>/g, (todo, dentro) => {
    const f = lista[i++];
    return f?.img ? `<div class="firma">${imgFirma(f.img)}<div class="firma-linea">${dentro}${firmo(f)}</div></div>` : todo;
  });
}

export const cuenta = (n, palabra = 'equipos') => `<span class="cuenta">${n} ${palabra}</span>`;
