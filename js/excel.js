// Estilos de los Excel que genera la app (librería xlsx-js-style: SheetJS con estilos).
// Encabezado petróleo con letra blanca, bordes finos y filas alternadas.
export const COLOR = { petroleo: '0E7490', oscuro: '0B2E3B', borde: 'CBD5E1', zebra: 'F1F8FA', texto: '0F172A' };
const borde = { style: 'thin', color: { rgb: COLOR.borde } };
export const BORDES = { top: borde, bottom: borde, left: borde, right: borde };
export const ESTILO_ENCABEZADO = {
  fill: { patternType: 'solid', fgColor: { rgb: COLOR.petroleo } },
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: BORDES,
};

// encabezado: índice de la fila de títulos de columna. Las filas de arriba se tratan como título.
export function darEstilo(ws, { encabezado = 0 } = {}) {
  if (!ws['!ref']) return ws;
  const rango = XLSX.utils.decode_range(ws['!ref']);
  for (let r = rango.s.r; r <= rango.e.r; r++) {
    for (let c = rango.s.c; c <= rango.e.c; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (r < encabezado) {
        if (ws[ref]) ws[ref].s = { font: { bold: true, sz: r === rango.s.r ? 13 : 10, color: { rgb: COLOR.oscuro } }, ...ws[ref].s };
        continue;
      }
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      const base = r === encabezado ? ESTILO_ENCABEZADO : {
        font: { sz: 10, color: { rgb: COLOR.texto } },
        alignment: { vertical: 'center' },
        border: BORDES,
        ...((r - encabezado) % 2 === 0 ? { fill: { patternType: 'solid', fgColor: { rgb: COLOR.zebra } } } : {}),
      };
      ws[ref].s = { ...base, ...ws[ref].s };
    }
  }
  ws['!rows'] = ws['!rows'] || [];
  ws['!rows'][encabezado] = { hpt: 26 };
  if (rango.e.r > encabezado) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: encabezado, c: rango.s.c }, e: { r: rango.e.r, c: rango.e.c } }) };
  return ws;
}

// Atajo: hoja con estilo a partir de filas (arreglo de arreglos)
export function hojaConEstilo(filas, { encabezado = 0, anchos = null } = {}) {
  const ws = XLSX.utils.aoa_to_sheet(filas);
  if (anchos) ws['!cols'] = anchos.map(wch => ({ wch }));
  return darEstilo(ws, { encabezado });
}
