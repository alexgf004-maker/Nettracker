// Planilla de instalación y retiro (formato "PLANILLAS_IR" del equipo) de cualquier instalación que la lleve:
// se llena con los datos de la app y se abre como página para imprimir o guardar como PDF. Lleva dos copias,
// como el formato: la de la Distribuidora y la de DS. Confirmado con el equipo:
// - Número SIGET = código del caso; ID Usuario = NC; nombre, dirección, centro MT/BT o corte y medidor del
//   expediente del reclamo o del caso de campaña (o FT que se remide), o escritos al instalar si no está en la base.
// - Tipo de instalación: M monofásico, M2 bifásico, T trifásico. Tensión de servicio: la que se anota al instalar.
// - Energía inicial y final: una lectura o punta + resto + valle, multiplicada por la "X" del medidor.
// - Tipo de servicio, tarifa, número de contador, tipo de conexión, fase alta y medición de energía no se llenan.
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
// Cómo se calculó, para dejarlo anotado debajo del valor
export function detalleEnergia(e, x) {
  if (!e || e.tipo === 'ninguna') return '';
  const xs = num(x) ?? 1;
  return e.tipo === 'tres' ? `(P ${e.punta} + R ${e.resto} + V ${e.valle}) × ${xs}` : `${e.una} × ${xs}`;
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
    energiaInicial: energiaPlanilla(rec.energiaInstalacion, rec.xMedidor), detalleInicial: detalleEnergia(rec.energiaInstalacion, rec.xMedidor),
    energiaFinal: energiaPlanilla(rec.energiaRetiro, rec.xMedidor), detalleFinal: detalleEnergia(rec.energiaRetiro, rec.xMedidor),
    colocacion: [rec.fechaInstalacion ? rec.fechaInstalacion.split('-').reverse().join('/') : '', rec.horaInstalacion || ''].filter(Boolean).join(' '),
    retiro: [rec.fechaRetiroReal ? rec.fechaRetiroReal.split('-').reverse().join('/') : '', rec.horaRetiro || ''].filter(Boolean).join(' '),
    observacion: rec.notas || '',
  };
}

const ESTILO = `
  .pagina { padding: 0.35in 0.45in; display: flex; flex-direction: column; gap: 0.22in; }
  .copia { border: 1.4px solid #14213d; border-radius: 6px; padding: 10px 12px 8px; flex: 1; display: flex; flex-direction: column; font-size: 9.5pt; }
  .cab { text-align: center; line-height: 1.25; }
  .cab b { display: block; font-size: 11pt; letter-spacing: .3px; }
  .cab small { font-size: 9pt; font-weight: 700; color: #334155; }
  .sub { display: flex; justify-content: space-between; align-items: center; margin: 6px 0 6px; font-size: 9pt; font-weight: 700; }
  .copia-k { font-size: 8pt; font-weight: 800; letter-spacing: 1px; color: #fff; background: #14213d; border-radius: 4px; padding: 2px 8px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td { border: 0.8px solid #94a3b8; padding: 3px 6px; height: 21px; vertical-align: middle; overflow: hidden; }
  td.l { background: #eef2f7; font-weight: 700; font-size: 8.3pt; color: #334155; }
  td.v { font-size: 9.5pt; font-weight: 600; }
  td.v small { display: block; font-size: 7pt; font-weight: 500; color: #64748b; line-height: 1.1; }
  .cajas { display: inline-flex; gap: 8px; align-items: center; }
  .caja { display: inline-flex; align-items: center; gap: 3px; font-size: 8.5pt; font-weight: 700; }
  .caja i { width: 12px; height: 12px; border: 1px solid #14213d; display: inline-flex; align-items: center; justify-content: center; font-style: normal; font-size: 9pt; line-height: 1; }
  .firmas { display: flex; gap: 30px; margin-top: auto; padding-top: 26px; }
  .firma { flex: 1; border-top: 1px solid #14213d; padding-top: 3px; font-size: 8.5pt; font-weight: 700; text-align: center; color: #334155; }
`;

const caja = (letra, marcada) => `<span class="caja"><i>${marcada ? 'X' : ''}</i>${letra}</span>`;
const kwh = (v, det) => (v === null ? '' : `${v.toLocaleString('es-SV', { maximumFractionDigits: 3 })} kWh${det ? `<small>${esc(det)}</small>` : ''}`);

function copia(d, etiqueta, o) {
  return `<div class="copia">
    <div class="cab"><b>CAMPAÑA DE CONTROL DEL PRODUCTO TÉCNICO</b><small>DATOS DE USUARIO SELECCIONADOS · PLANILLA DE INSTALACIÓN Y RETIRO</small></div>
    <div class="sub"><span>Distribuidora de Electricidad ${esc(o.distribuidora)}</span><span>PERIODO: ${esc(d.periodo)}</span><span class="copia-k">${etiqueta}</span></div>
    <table>
      <colgroup><col style="width:15%"><col style="width:20%"><col style="width:13%"><col style="width:18%"><col style="width:15%"><col style="width:19%"></colgroup>
      <tr><td class="l">Número SIGET</td><td class="v">${esc(d.codigo)}</td><td class="l">Centro MT/BT ó Corte</td><td class="v">${esc(d.centro)}</td><td class="l">ID Usuario</td><td class="v">${esc(d.nc)}</td></tr>
      <tr><td class="l">Nombre del Usuario</td><td class="v" colspan="5">${esc(d.nombre)}</td></tr>
      <tr><td class="l">Dirección</td><td class="v" colspan="5">${esc(d.direccion)}</td></tr>
      <tr><td class="l">Tensión de Servicio</td><td class="v">${esc(d.tension)}${num(d.tension) !== null ? ' V' : ''}</td><td class="l">Tipo Instalación</td><td class="v"><span class="cajas">${caja('M', d.tipo === 'M')}${caja('M2', d.tipo === 'M2')}${caja('T', d.tipo === 'T')}</span></td><td class="l">Energía Inicial</td><td class="v">${kwh(d.energiaInicial, d.detalleInicial)}</td></tr>
      <tr><td class="l">Tarifa</td><td class="v"></td><td class="l">Tipo Conexión</td><td class="v"></td><td class="l">Energía Final</td><td class="v">${kwh(d.energiaFinal, d.detalleFinal)}</td></tr>
      <tr><td class="l">Número Contador</td><td class="v"></td><td class="l">Código Medidor</td><td class="v">${esc(d.medidor)}</td><td class="l">Fase Alta</td><td class="v"></td></tr>
      <tr><td class="l">Medición Energía</td><td class="v"><span class="cajas">${caja('Sí', false)}${caja('No', false)}</span></td><td class="l">Fecha Colocación</td><td class="v">${esc(d.colocacion)}</td><td class="l">Fecha Retiro</td><td class="v">${esc(d.retiro)}</td></tr>
      <tr><td class="l">Observación</td><td class="v" colspan="5">${esc(d.observacion)}</td></tr>
    </table>
    <div class="firmas"><div class="firma">Instalación · Firma Distribuidora</div><div class="firma">Retiro · Firma Distribuidora</div></div>
  </div>`;
}

// Una página por instalación, con las dos copias (Distribuidora y DS)
export function htmlPlanillas(lista, o = {}) {
  const op = { distribuidora: 'DELSUR', ...o };
  const paginas = lista.map(d => `<section class="pagina">${copia(d, 'DISTRIBUIDORA', op)}${copia(d, 'DS', op)}</section>`).join('');
  return documento(op.titulo || 'Planilla de instalación y retiro', ESTILO, paginas, lista.length);
}
