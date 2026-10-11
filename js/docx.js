// Word (.docx) a partir de los bloques del borrador de informe (js/domain/informe.js), sin librerías extra:
// se escribe el WordprocessingML a mano y se empaqueta con XLSX.CFB (viene con xlsx-js-style), igual que
// las gráficas del Excel. Century Gothic, encabezados de tabla azules y veredictos en verde o rojo.
const FUENTE = 'Century Gothic';
const AZUL = '4472C4';
const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const ANCHO_TEXTO = 9638; // A4 con márgenes de 2 cm, en twips

const xml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Texto con [completar] resaltado en amarillo para encontrarlo rápido
function corridas(texto, { negrita = false, color = null, sz = 20, italica = false } = {}) {
  return String(texto ?? '').split(/(\[completar\])/).filter(Boolean).map(parte => {
    const marca = parte === '[completar]';
    const rpr = `<w:rPr>${negrita ? '<w:b/>' : ''}${italica ? '<w:i/>' : ''}${color ? `<w:color w:val="${color}"/>` : ''}<w:sz w:val="${sz}"/>${marca ? '<w:highlight w:val="yellow"/>' : ''}</w:rPr>`;
    return `<w:r>${rpr}<w:t xml:space="preserve">${xml(parte)}</w:t></w:r>`;
  }).join('');
}
const parrafo = (contenido, { estilo = null, alineado = null, antes = 0, despues = 120, sangria = null } = {}) =>
  `<w:p><w:pPr>${estilo ? `<w:pStyle w:val="${estilo}"/>` : ''}<w:spacing w:before="${antes}" w:after="${despues}"/>${sangria ? `<w:ind w:left="${sangria}" w:hanging="240"/>` : ''}${alineado ? `<w:jc w:val="${alineado}"/>` : ''}</w:pPr>${contenido}</w:p>`;

const colorVeredicto = v => (/^NO CUMPLE/.test(v) ? 'C00000' : /^CUMPLE/.test(v) ? '00863D' : null);

function tablaXML({ encabezado, filas, anchos = null, veredicto = false }) {
  const cols = encabezado.length;
  const pesos = anchos && anchos.length === cols ? anchos : Array(cols).fill(1);
  const total = pesos.reduce((a, b) => a + b, 0);
  const w = pesos.map(x => Math.round((x / total) * ANCHO_TEXTO));
  const borde = '<w:top w:val="single" w:sz="4" w:color="BFBFBF"/><w:left w:val="single" w:sz="4" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="4" w:color="BFBFBF"/><w:right w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideH w:val="single" w:sz="4" w:color="BFBFBF"/><w:insideV w:val="single" w:sz="4" w:color="BFBFBF"/>';
  const celda = (texto, i, { enc = false } = {}) => {
    const ver = !enc && veredicto && i === cols - 1 ? colorVeredicto(texto) : null;
    return `<w:tc><w:tcPr><w:tcW w:w="${w[i]}" w:type="dxa"/>${enc ? `<w:shd w:val="clear" w:color="auto" w:fill="${AZUL}"/>` : ''}<w:vAlign w:val="center"/></w:tcPr>`
      + parrafo(corridas(texto, { negrita: enc || !!ver || (i === 0 && !enc), color: enc ? 'FFFFFF' : ver, sz: 18 }), { alineado: i === 0 ? null : 'center', despues: 0 }) + '</w:tc>';
  };
  return `<w:tbl><w:tblPr><w:tblW w:w="${ANCHO_TEXTO}" w:type="dxa"/><w:tblBorders>${borde}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr>`
    + `<w:tblGrid>${w.map(x => `<w:gridCol w:w="${x}"/>`).join('')}</w:tblGrid>`
    + `<w:tr><w:trPr><w:tblHeader/></w:trPr>${encabezado.map((t, i) => celda(t, i, { enc: true })).join('')}</w:tr>`
    + filas.map(f => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${f.map((t, i) => celda(t, i)).join('')}</w:tr>`).join('')
    + '</w:tbl>' + parrafo('', { despues: 120 });
}

export function documentoXML(bloques) {
  const cuerpo = bloques.map(b => {
    switch (b.t) {
      case 'titulo': return parrafo(corridas(b.texto, { negrita: true, sz: 32, color: '0B2E3B' }), { alineado: 'center', despues: 60 })
        + (b.sub ? parrafo(corridas(b.sub, { sz: 22, color: '475569' }), { alineado: 'center', despues: 240 }) : '');
      case 'nota': return parrafo(corridas(b.texto, { italica: true, sz: 18, color: '64748B' }), { despues: 240 });
      case 'h': return parrafo(corridas(b.texto), { estilo: b.nivel === 1 ? 'Titulo1' : 'Titulo2', antes: b.nivel === 1 ? 240 : 160 });
      case 'p': return parrafo(corridas(b.texto), { alineado: 'both' });
      case 'vineta': return parrafo(corridas('▪ ') + corridas(b.texto), { alineado: 'both', sangria: 360 });
      case 'formula': return parrafo(corridas(b.texto, { negrita: true, sz: 22 }), { alineado: 'center', antes: 60, despues: 180 });
      case 'grafica': return parrafo(corridas(`[Gráfica: ${b.texto}]`, { italica: true, color: '0E7490' }), { alineado: 'center', antes: 60, despues: 180 });
      case 'tabla': return tablaXML(b);
      default: return '';
    }
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${NS_W}"><w:body>${cuerpo}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${NS_W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FUENTE}" w:hAnsi="${FUENTE}" w:cs="${FUENTE}" w:eastAsia="${FUENTE}"/><w:sz w:val="20"/><w:lang w:val="es-SV"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Titulo1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="0B2E3B"/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Titulo2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="0E7490"/><w:sz w:val="21"/></w:rPr></w:style>
</w:styles>`;

// Bytes del .docx
export function generarDocx(bloques) {
  const C = XLSX.CFB;
  const zip = C.utils.cfb_new();
  const enc = new TextEncoder();
  const agregar = (ruta, contenido) => C.utils.cfb_add(zip, '/' + ruta, enc.encode(contenido));
  agregar('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  agregar('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${NS_REL}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  agregar('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${NS_REL}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  agregar('word/styles.xml', ESTILOS);
  agregar('word/document.xml', documentoXML(bloques));
  return new Uint8Array(C.write(zip, { fileType: 'zip', type: 'array', compression: true }));
}

export function descargarDocx(bytes, nombre) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  const a = document.createElement('a'); a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
