// Base común de los memorándums: hoja A4 con la identidad de la app (degradado petróleo → turquesa).
// Cada plantilla arma su cuerpo con estos bloques y los envuelve con docMemo().

const LOGO = `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="2" width="18" height="20" rx="2" stroke="white" stroke-width="1.8" fill="none"/><path d="M8 7h8M8 10h5" stroke="white" stroke-width="1.5" stroke-linecap="round"/><path d="M12 14l-2 4h4l-2 4" stroke="#7dd3fc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const ONDA = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='120' viewBox='0 0 240 120'%3E%3Cpath d='M0 60 Q30 10 60 60 T120 60 T180 60 T240 60' fill='none' stroke='%23ffffff' stroke-opacity='.16' stroke-width='2'/%3E%3Cpath d='M0 75 Q30 35 60 75 T120 75 T180 75 T240 75' fill='none' stroke='%23ffffff' stroke-opacity='.07' stroke-width='1.5'/%3E%3C/svg%3E")`;

const ESTILO = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --petroleo: #0b2e3b; --turq: #0e7490; --turq2: #06b6d4; --turq-claro: #ecfeff; --texto: #0f172a; --texto2: #475569; --texto3: #64748b; --borde: #d7e3e8; --fondo: #f4f8fa; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif; color: var(--texto); background: #e6edf0; font-size: 13px; line-height: 1.45; font-variant-numeric: tabular-nums; }
  .hoja { width: 210mm; min-height: 297mm; margin: 24px auto; background: #fff; box-shadow: 0 10px 30px -12px rgba(11,46,59,.35); display: flex; flex-direction: column; }
  .hoja.apaisada { width: 297mm; min-height: 210mm; }
  .barra { position: sticky; top: 0; z-index: 2; display: flex; justify-content: center; gap: 10px; padding: 10px; background: rgba(230,237,240,.92); }
  .barra button { font: 700 13px 'Plus Jakarta Sans', Arial, sans-serif; color: #fff; background: linear-gradient(120deg, #0b2e3b, #0e7490 60%, #0891b2); border: 0; border-radius: 10px; padding: 10px 22px; cursor: pointer; }

  .enc { color: #fff; background-image: ${ONDA}, linear-gradient(120deg, #0b2e3b 0%, #0e7490 60%, #0891b2 100%); background-repeat: repeat-x, no-repeat; background-position: right 0 bottom -46px, 0 0; background-size: 240px 120px, auto; padding: 26px 34px 22px; display: flex; justify-content: space-between; align-items: center; gap: 24px; }
  .enc.rojo { background-image: ${ONDA}, linear-gradient(120deg, #4c0f0f 0%, #991b1b 60%, #dc2626 100%); }
  .marca { display: flex; align-items: center; gap: 14px; }
  .marca-logo { width: 50px; height: 50px; border-radius: 14px; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28); display: flex; align-items: center; justify-content: center; }
  .marca-logo svg { width: 28px; height: 28px; }
  .marca-nombre { font-size: 20px; font-weight: 800; letter-spacing: .3px; }
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

  .firmas { display: grid; grid-template-columns: repeat(var(--cols, 2), 1fr); gap: 36px; margin-top: 8px; }
  .firma { text-align: center; padding-top: 58px; }
  .firma-linea { border-top: 1.5px solid var(--petroleo); padding-top: 8px; }
  .firma-eti { font-size: 9.5px; font-weight: 700; color: var(--texto3); letter-spacing: 1.2px; text-transform: uppercase; }
  .firma-nom { font-size: 13.5px; font-weight: 800; color: var(--texto); margin-top: 2px; min-height: 18px; }
  .firma-sub { font-size: 11.5px; color: var(--texto2); margin-top: 1px; }

  .pie { margin: 0 34px; padding: 12px 0 18px; border-top: 2px solid; border-image: linear-gradient(90deg, #0b2e3b, #0e7490, #06b6d4) 1; display: flex; justify-content: space-between; gap: 16px; font-size: 10px; color: var(--texto3); }
  .pie b { color: var(--petroleo); }

  @page { size: A4; margin: 0; }
  @page apaisada { size: A4 landscape; margin: 0; }
  @media print {
    body { background: #fff; }
    .barra { display: none; }
    .hoja { margin: 0; box-shadow: none; width: auto; min-height: 297mm; }
    .hoja.apaisada { page: apaisada; min-height: 210mm; }
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
  }
`;

const hoy = () => new Date().toLocaleDateString('es-SV');

// Documento completo. meta: [[etiqueta, valor], ...] bajo el encabezado.
export function docMemo({ titulo, tipo, meta = [], cuerpo, pie = '', rojo = false, compacta = false, apaisada = false, subtitulo = 'Calidad del Producto Técnico · Analizadores de Red' }) {
  const clases = ['hoja', compacta && 'compacta', apaisada && 'apaisada'].filter(Boolean).join(' ');
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
    <div class="marca">
      <div class="marca-logo">${LOGO}</div>
      <div><div class="marca-nombre">CPT INNOVA</div><div class="marca-sub">${subtitulo}</div></div>
    </div>
    <div class="titulo"><div class="titulo-eti">Memorándum de</div><div class="titulo-tipo">${tipo}</div></div>
  </div>
  ${meta.length ? `<div class="meta">${meta.map(([e, v]) => `<div><div class="meta-eti">${e}</div><div class="meta-val">${v || '—'}</div></div>`).join('')}</div>` : ''}
  <div class="cuerpo">${cuerpo}</div>
  <div class="pie"><span>Documento generado por <b>NetTracker</b> · CPT INNOVA${pie}</span><span>${hoy()}</span></div>
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

// firmas: [{ eti, nom, sub }]
export const firmas = lista =>
  `<div class="firmas" style="--cols:${lista.length}">${lista.map(f => `<div class="firma"><div class="firma-linea"><div class="firma-eti">${f.eti}</div><div class="firma-nom">${f.nom || '&nbsp;'}</div>${f.sub ? `<div class="firma-sub">${f.sub}</div>` : ''}</div></div>`).join('')}</div>`;

export const cuenta = (n, palabra = 'equipos') => `<span class="cuenta">${n} ${palabra}</span>`;
