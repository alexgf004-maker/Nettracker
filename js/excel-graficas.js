// Gráficas nativas de Excel (DrawingML) dentro de un xlsx generado con xlsx-js-style.
// SheetJS no escribe gráficas: se genera el libro, se abre el zip con XLSX.CFB (viene con la librería)
// y se agregan los archivos de dibujo y de gráfica. Las series apuntan a celdas del libro, así que
// Excel las dibuja con los datos reales (como las que hacen las macros del equipo).

const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const FUENTE = 'Century Gothic';

const xml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Referencia a un rango de una hoja: 'Hoja'!$B$2:$B$100 (col y filas desde 1)
export function rango(hoja, col, desde, hasta) {
  const letra = XLSX.utils.encode_col(col - 1);
  return `'${String(hoja).replace(/'/g, "''")}'!$${letra}$${desde}:$${letra}$${hasta}`;
}

const linea = (color, { guion = false, ancho = 1.5 } = {}) =>
  `<a:ln w="${Math.round(ancho * 12700)}" cap="rnd"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>${guion ? '<a:prstDash val="dash"/>' : ''}<a:round/></a:ln>`;

const texto = (sz, { negrita = false, rot = null, color = null } = {}) =>
  `<c:txPr><a:bodyPr${rot !== null ? ` rot="${rot}" vert="horz"` : ''}/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${negrita ? 1 : 0}">${color ? `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>` : ''}<a:latin typeface="${FUENTE}"/></a:defRPr></a:pPr><a:endParaRPr lang="es-SV"/></a:p></c:txPr>`;

function valores(s) {
  if (s.ref) return `<c:val><c:numRef><c:f>${xml(s.ref)}</c:f></c:numRef></c:val>`;
  // Valores fijos (p. ej. un límite constante): se escriben dentro de la gráfica
  return `<c:val><c:numLit><c:formatCode>General</c:formatCode><c:ptCount val="${s.valores.length}"/>${s.valores.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('')}</c:numLit></c:val>`;
}

function serie(s, i, cat, tipo) {
  const base = `<c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${xml(s.nombre)}</c:v></c:tx>`;
  const categorias = cat ? `<c:cat><c:strRef><c:f>${xml(cat)}</c:f></c:strRef></c:cat>` : '';
  if (tipo === 'barra') {
    return `<c:ser>${base}<c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:ln w="6350"><a:solidFill><a:srgbClr val="505050"/></a:solidFill></a:ln></c:spPr><c:invertIfNegative val="0"/>${categorias}${valores(s)}</c:ser>`;
  }
  return `<c:ser>${base}<c:spPr>${linea(s.color, s)}</c:spPr><c:marker><c:symbol val="none"/></c:marker>${categorias}${valores(s)}<c:smooth val="0"/></c:ser>`;
}

// spec: { titulo, categorias (rango), series: [{ nombre, ref | valores, color, guion, ancho, tipo: 'barra' | 'linea' }],
//         y: { min, max }, saltoEtiquetas, rotarEtiquetas, tituloX, tituloY, colorTitulo }
export function xmlGrafica(spec) {
  const barras = spec.series.map((s, i) => ({ s, i })).filter(x => x.s.tipo === 'barra');
  const lineas = spec.series.map((s, i) => ({ s, i })).filter(x => x.s.tipo !== 'barra');
  const ejes = '<c:axId val="50010"/><c:axId val="50020"/>';
  let plot = '';
  if (barras.length) plot += `<c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>${barras.map(x => serie(x.s, x.i, spec.categorias, 'barra')).join('')}<c:gapWidth val="80"/>${ejes}</c:barChart>`;
  if (lineas.length) plot += `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${lineas.map(x => serie(x.s, x.i, spec.categorias, 'linea')).join('')}<c:marker val="1"/>${ejes}</c:lineChart>`;
  const tituloEje = t => (t ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="0"><a:latin typeface="${FUENTE}"/></a:defRPr></a:pPr><a:r><a:rPr lang="es-SV" sz="900" b="0"><a:latin typeface="${FUENTE}"/></a:rPr><a:t>${xml(t)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>` : '');
  const y = spec.y || {};
  const escala = `<c:scaling><c:orientation val="minMax"/>${y.max !== undefined ? `<c:max val="${y.max}"/>` : ''}${y.min !== undefined ? `<c:min val="${y.min}"/>` : ''}</c:scaling>`;
  const salto = spec.saltoEtiquetas ? `<c:tickLblSkip val="${spec.saltoEtiquetas}"/><c:tickMarkSkip val="${spec.saltoEtiquetas}"/>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:roundedCorners val="0"/><c:chart>
<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100" b="1"/></a:pPr><a:r><a:rPr lang="es-SV" sz="1100" b="1">${spec.colorTitulo ? `<a:solidFill><a:srgbClr val="${spec.colorTitulo}"/></a:solidFill>` : ''}<a:latin typeface="${FUENTE}"/></a:rPr><a:t>${xml(spec.titulo)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>
<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}
<c:catAx><c:axId val="50010"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>${tituloEje(spec.tituloX)}<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>${texto(800, { rot: spec.rotarEtiquetas ? -5400000 : null })}<c:crossAx val="50020"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/>${salto}<c:noMultiLvlLbl val="0"/></c:catAx>
<c:valAx><c:axId val="50020"/>${escala}<c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="D2D2D2"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>${tituloEje(spec.tituloY)}<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${texto(800)}<c:crossAx val="50010"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>
<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></c:spPr></c:plotArea>
<c:legend><c:legendPos val="b"/><c:overlay val="0"/>${texto(800)}</c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>
<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="6350"><a:solidFill><a:srgbClr val="B4B4B4"/></a:solidFill></a:ln></c:spPr>${texto(900)}</c:chartSpace>`;
}

function xmlDibujo(anclas, primerRid) {
  const ancla = (a, i) => `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${a.desde[0]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.desde[1]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${a.hasta[0]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${a.hasta[1]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
    + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Grafica ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>`
    + `<a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rId${primerRid + i}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${NS_A}">${anclas.map(ancla).join('')}</xdr:wsDr>`;
}

// libro: workbook de SheetJS; graficas: { [nombreHoja]: [{ desde: [col, fila], hasta: [col, fila], grafica: spec }] }
// (col y fila desde 0). Devuelve los bytes del xlsx.
export function escribirConGraficas(libro, graficas) {
  const bytes = new Uint8Array(XLSX.write(libro, { type: 'array', bookType: 'xlsx' }));
  const zip = XLSX.CFB.read(bytes, { type: 'array' });
  const enc = new TextEncoder(); const dec = new TextDecoder();
  const leer = ruta => { const e = XLSX.CFB.find(zip, '/' + ruta); return e ? dec.decode(e.content) : null; };
  const escribir = (ruta, contenido) => {
    const e = XLSX.CFB.find(zip, '/' + ruta);
    const datos = enc.encode(contenido);
    if (e) { e.content = datos; e.size = datos.length; } else XLSX.CFB.utils.cfb_add(zip, '/' + ruta, datos);
  };
  let tipos = leer('[Content_Types].xml');
  let nChart = 0; let nDibujo = 0;
  libro.SheetNames.forEach((nombre, idx) => {
    const anclas = graficas[nombre];
    if (!anclas?.length) return;
    nDibujo++;
    const hoja = `xl/worksheets/sheet${idx + 1}.xml`;
    // Gráficas del dibujo
    const rels = anclas.map((a, i) => {
      nChart++;
      escribir(`xl/charts/chart${nChart}.xml`, xmlGrafica(a.grafica));
      tipos = tipos.replace('</Types>', `<Override PartName="/xl/charts/chart${nChart}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`);
      return `<Relationship Id="rId${i + 1}" Type="${NS_R}/chart" Target="../charts/chart${nChart}.xml"/>`;
    });
    escribir(`xl/drawings/drawing${nDibujo}.xml`, xmlDibujo(anclas, 1));
    escribir(`xl/drawings/_rels/drawing${nDibujo}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS_REL}">${rels.join('')}</Relationships>`);
    tipos = tipos.replace('</Types>', `<Override PartName="/xl/drawings/drawing${nDibujo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
    // La hoja apunta al dibujo
    const rutaRels = `xl/worksheets/_rels/sheet${idx + 1}.xml.rels`;
    const relDibujo = `<Relationship Id="rIdDibujo1" Type="${NS_R}/drawing" Target="../drawings/drawing${nDibujo}.xml"/>`;
    const previas = leer(rutaRels);
    escribir(rutaRels, previas ? previas.replace('</Relationships>', relDibujo + '</Relationships>') : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${NS_REL}">${relDibujo}</Relationships>`);
    let xmlHoja = leer(hoja);
    if (!/xmlns:r=/.test(xmlHoja)) xmlHoja = xmlHoja.replace('<worksheet ', `<worksheet xmlns:r="${NS_R}" `);
    // <drawing> va después de pageMargins/ignoredErrors y antes de legacyDrawing/tableParts/extLst
    const antes = xmlHoja.search(/<(legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)[\s>/]/);
    const pos = antes >= 0 ? antes : xmlHoja.lastIndexOf('</worksheet>');
    escribir(hoja, xmlHoja.slice(0, pos) + '<drawing r:id="rIdDibujo1"/>' + xmlHoja.slice(pos));
  });
  escribir('[Content_Types].xml', tipos);
  return new Uint8Array(XLSX.CFB.write(zip, { fileType: 'zip', type: 'array' }));
}

export function descargarXlsx(bytes, nombre) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
