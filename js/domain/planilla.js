// Planilla de instalación y retiro (formato "PLANILLAS_IR" del equipo) de cualquier instalación que la lleve:
// se llena con los datos de la app y se abre como página para imprimir o guardar como PDF. Es copia exacta de la
// hoja del Excel (medidas, bordes, letras y logo; en carta horizontal y sin el pie del Excel; lo llenado en negrita), con sus dos copias: se llena la de arriba y la de DS va
// en blanco. Confirmado:
// - Número SIGET = código del caso; ID Usuario = NC; nombre, dirección, centro MT/BT o corte y medidor del
//   expediente del reclamo o del caso de campaña (o FT que se remide), o escritos al instalar si no está en la base.
// - Tipo de instalación: M monofásico, M2 bifásico, T trifásico. Tensión de servicio: la que se anota al instalar.
// - Energía inicial y final: una lectura o punta + resto + valle, multiplicada por la "X" del medidor.
// - "Número Contador" se cambió por "Analizador de redes" con la serie del analizador instalado (pedido del equipo).
// - Tipo de servicio, tarifa, tipo de conexión, fase alta y medición de energía no se llenan.
// Funciones puras.
import { BASE, documento } from './documentos.js';
import { MESES } from './trabajo.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = v => { const n = Number(String(v ?? '').replace(',', '.')); return v !== '' && v !== null && v !== undefined && Number.isFinite(n) ? n : null; };

// Energía para la planilla: (una lectura o punta + resto + valle) × X del medidor (sin X se toma 1)
export function energiaPlanilla(e, x) {
  if (!e || e.tipo === 'ninguna') return null;
  const lecturas = e.tipo === 'tres' ? [e.punta, e.resto, e.valle] : [e.una];
  const vals = lecturas.map(num);
  if (vals.some(v => v === null)) return null;
  const total = vals.reduce((a, b) => a + b, 0) * (num(x) ?? 1);
  return Math.round(total * 1000) / 1000;
}

// Tipo de instalación (M, M2, T) a partir de lo que se sepa del caso
export function tipoPlanilla(texto, fases) {
  const t = String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  if (fases === 1 || t.includes('MONO')) return 'M';
  if (fases === 2 || t.includes('BIF')) return 'M2';
  if (fases === 3 || t.includes('TRIF') || t.includes('ESTRELLA') || t.includes('DELTA')) return 'T';
  return '';
}

// Datos del usuario que lleva la planilla (se completan de la base o se escriben al instalar)
export const CAMPOS_PLANILLA = ['nombre', 'nc', 'direccion', 'centro', 'medidor', 'tipo'];

// Datos de la planilla: rec (instalación, con rec.planilla si se llenaron o corrigieron al instalar) y fuente (lo que
// hay en la base para su código: { nc, nombre, direccion, centro, medidor, tipo })
export function datosPlanilla(rec, fuente = {}) {
  const f = rec.fechaInstalacion ? rec.fechaInstalacion.split('-').map(Number) : null;
  const p = rec.planilla || {};
  const dato = k => p[k] || fuente[k] || '';
  return {
    codigo: rec.caso || '', periodo: f ? `${MESES[f[1] - 1]} ${f[0]}` : '',
    centro: dato('centro'), nc: dato('nc') || rec.idUsuario || '', nombre: dato('nombre') || rec.lugar || '',
    direccion: dato('direccion') || rec.direccion || '', medidor: dato('medidor') || rec.medidor || '',
    tension: rec.tensionServicio || '', tipo: dato('tipo'),
    energiaInicial: energiaPlanilla(rec.energiaInstalacion, rec.xMedidor), energiaFinal: energiaPlanilla(rec.energiaRetiro, rec.xMedidor),
    colocacion: [rec.fechaInstalacion ? rec.fechaInstalacion.split('-').reverse().join('/') : '', rec.horaInstalacion || ''].filter(Boolean).join(' '),
    retiro: [rec.fechaRetiroReal ? rec.fechaRetiroReal.split('-').reverse().join('/') : '', rec.horaRetiro || ''].filter(Boolean).join(' '),
    observacion: rec.notas || '', analizador: rec.serie || '',
  };
}

// ── Formato: copia exacta de la hoja PLANILLA del Excel (A4 horizontal, ajustado a una página, centrado) ──
// Anchos de columna A–O en píxeles de Excel (ancho en caracteres de Calibri 11) y altos de fila 1–28 en puntos.
const COLS_PX = [125, 173, 107, 27, 27, 27, 27, 27, 27, 111, 76, 67, 80, 88, 126];
const BLOQUE_PT = Array(10).fill(21.9);
const FILAS_PT = [13.2, 17.4, 17.4, 13.2, 13.8, 13.2, ...BLOQUE_PT, 13.2, 13.2, ...BLOQUE_PT];
const ANCHO_PT = COLS_PX.reduce((a, b) => a + b, 0) * 0.75;
const ALTO_PT = FILAS_PT.reduce((a, b) => a + b, 0);
// Carta horizontal con márgenes de 1 cm (pedido del equipo; el Excel era A4 y llevaba el pie "Reporte: Formato_A2_Reemplazo")
const PAGINA = { ancho: 792, alto: 612, izq: 28.35, der: 28.35, arriba: 28.35, abajo: 28.35 };
const AREA = { ancho: PAGINA.ancho - PAGINA.izq - PAGINA.der, alto: PAGINA.alto - PAGINA.arriba - PAGINA.abajo };
const ESCALA = Math.min(AREA.ancho / ANCHO_PT, AREA.alto / ALTO_PT);
const POS = { x: PAGINA.izq + (AREA.ancho - ANCHO_PT * ESCALA) / 2, y: PAGINA.arriba + (AREA.alto - ALTO_PT * ESCALA) / 2 };

const ESTILO = `
  @page { size: letter landscape; margin: 0; }
  .pagina { width: 11in; height: 8.5in; color: #000; }
  .hoja { position: absolute; left: ${POS.x}pt; top: ${POS.y}pt; width: ${ANCHO_PT}pt; transform: scale(${ESCALA}); transform-origin: 0 0; }
  .hoja table { border-collapse: collapse; table-layout: fixed; width: ${ANCHO_PT}pt; font-family: Arial, 'Liberation Sans', Helvetica, sans-serif; font-size: 9pt; }
  .hoja td { padding: 0 2px; white-space: nowrap; overflow: hidden; vertical-align: middle; line-height: 1.1; }
  .hoja .et { font-style: italic; }
  .hoja .c { text-align: center; }
  .hoja .arriba { vertical-align: top; padding-top: 1px; white-space: normal; }
  .hoja .titulo { font-size: 14pt; font-weight: 700; text-align: center; }
  .hoja .sub { font-size: 11pt; font-weight: 700; font-style: italic; }
  .hoja .calibri { font-family: Calibri, Carlito, Arial, sans-serif; font-size: 11pt; text-align: center; }
  .hoja .v { font-weight: 700; } /* lo que se completa va en negrita */
  .hoja .b { font-weight: 700; }
  .hoja .ds { font-size: 10pt; font-style: italic; vertical-align: bottom; }
  .hoja .x { font-weight: 700; text-align: center; }
  .hoja .bt { border-top: 0.5pt solid #000; } .hoja .bb { border-bottom: 0.5pt solid #000; }
  .hoja .bl { border-left: 0.5pt solid #000; } .hoja .br { border-right: 0.5pt solid #000; }
  .hoja .caja { border: 1pt solid #000; }
  .logo { position: absolute; left: 6pt; top: 2.25pt; width: 96pt; height: 46pt; }
  .logo img { width: 100%; height: 100%; object-fit: contain; object-position: left center; }
  .logo-texto { font: 700 20pt Arial, sans-serif; color: #1a3fa8; letter-spacing: 2px; line-height: 46pt; }
`;

// Celda: texto ya escapado, columnas que abarca, clases (bordes: t/b/l/r) y filas que abarca
const td = (html = '', cs = 1, cls = '', rs = 1) => `<td${cs > 1 ? ` colspan="${cs}"` : ''}${rs > 1 ? ` rowspan="${rs}"` : ''}${cls ? ` class="${cls}"` : ''}>${html}</td>`;
const tr = (fila, celdas = '') => `<tr style="height:${FILAS_PT[fila - 1]}pt">${celdas}</tr>`;
const kwh = v => (v === null ? '' : `${v.toLocaleString('es-SV', { maximumFractionDigits: 3 })} kWh`);

// Filas 7–16 (Distribuidora) o 19–28 (DS) del formato
function bloque(d, f, ds) {
  const caja = marcada => td(marcada ? 'X' : '', 1, 'bt bb bl br x');
  const letra = t => td(t, 1, 'et c bt bb bl br');
  return `<tbody class="copia">
    ${tr(f, td(ds ? 'Número  SIGET' : 'NumeroSIGET', 1, 'et bl bt bb') + td(esc(d.codigo), 1, 'v calibri caja') + td('', 7, 'bt bb')
      + td('Centro MT/BT ó Corte', 2, 'et c bt bb') + td(esc(d.centro), 4, 'v bt bb br'))}
    ${tr(f + 1, td('ID Usuario', 1, 'et bl bt bb') + td(esc(d.nc), 1, 'v calibri caja') + td('', 5, 'bt bb')
      + td('Nombre del Usuario', 3, 'et bt bb') + td(esc(d.nombre), 5, 'v bt bb br'))}
    ${tr(f + 2, td('Dirección', 1, 'et bl bt bb') + td(esc(d.direccion), 11, 'v bt bb') + td('', 3, 'bt bb br'))}
    ${tr(f + 3, td('Tensión de Servicio', 1, 'et bl bt bb') + td(esc(d.tension) + (num(d.tension) !== null ? ' V' : ''), 1, 'v bt bb') + td('Tipo Instalación', 1, 'et bt bb br')
      + letra('M') + caja(d.tipo === 'M') + letra('T') + caja(d.tipo === 'T') + letra('M2') + caja(d.tipo === 'M2')
      + td('Tipo Conexión', 1, 'et bt bb') + td('', 1, 'bt bb') + td('Fase Alta', 1, 'et bt bb') + td('', 1, 'bt bb')
      + td('Energía Inicial', 1, 'et bt bb') + td(kwh(d.energiaInicial), 1, 'v bt bb br'))}
    ${tr(f + 4, td('Tarifa', 1, 'et bl bt bb') + td('', 1, 'bt bb') + td('Tipo Servicio', 1, 'et bt bb br')
      + (ds ? letra('U') + caja(false) + letra('R') + caja(false) + letra('A') + caja(false) : caja(false).repeat(6))
      + td('Código Medidor', 1, 'et bt bb') + td(esc(d.medidor), 3, 'b bt bb') + td('Energía Final', 1, 'et bt bb') + td(kwh(d.energiaFinal), 1, 'v bt bb br'))}
    ${tr(f + 5, td('Analizador de redes', 1, 'et bl bt bb') + td(esc(d.analizador), 1, 'v bt bb') + td('Medición Energía', 1, 'et bt bb br')
      + letra('Si') + caja(false) + letra('No') + caja(false) + caja(false) + caja(false)
      + td('Fecha Colocación', 1, 'et bt bb') + td(esc(d.colocacion), 3, 'v bt bb') + td('Fecha Retiro', 1, 'et bt bb') + td(esc(d.retiro), 1, 'v bt bb br'))}
    ${tr(f + 6, td('Observación', 1, 'et arriba bl bt bb', 2) + td(esc(d.observacion), 14, 'b et bt br'))}
    ${tr(f + 7, td('', 14, 'bb br'))}
    ${tr(f + 8, td('Instalación &nbsp; Firma Distribuidora', 1, 'et arriba bl bt bb', 2) + td('', 6, 'bt bb br', 2)
      + td('Retiro Firma Distribuidora', 3, 'et arriba bl bt bb', 2) + td('', 5, 'bt bb br', 2))}
    ${tr(f + 9)}
  </tbody>`;
}

function hoja(d, o) {
  const logo = o.logo ? `<img src="${esc(o.logo)}" alt="">` : `<div class="logo-texto">${esc(o.distribuidora)}</div>`;
  return `<section class="pagina">
    <div class="hoja"><div class="logo">${logo}</div><table>
      <colgroup>${COLS_PX.map(px => `<col style="width:${px * 0.75}pt">`).join('')}</colgroup>
      <tbody>
        ${tr(1)}
        ${tr(2, td('CAMPAÑA DE CONTROL DEL PRODUCTO TECNICO', 15, 'titulo'))}
        ${tr(3, td('DATOS DE USUARIO&nbsp; SELECCIONADOS PLANILLA DE INSTALACION Y RETIRO', 15, 'titulo'))}
        ${tr(4)}
        ${tr(5, td(`Distribuidora de Electricidad ${esc(o.distribuidora)}`, 13, 'sub') + td('PERIODO:', 1, 'sub c') + td(esc(d.periodo), 1, 'sub v'))}
        ${tr(6)}
      </tbody>
      ${bloque(d, 7, false)}
      <tbody>${tr(17)}${tr(18, td('DS', 1, 'ds'))}</tbody>
      ${bloque({ energiaInicial: null, energiaFinal: null }, 19, true)}
    </table></div>
  </section>`;
}

// Una página por instalación, con las dos copias del formato: solo se llena la de arriba; la de DS va en blanco (confirmado)
export function htmlPlanillas(lista, o = {}) {
  const op = { distribuidora: 'DELSUR', ...o };
  const paginas = lista.map(d => hoja(d, op)).join('');
  return documento(op.titulo || 'Planilla de instalación y retiro', ESTILO, paginas, lista.length);
}
