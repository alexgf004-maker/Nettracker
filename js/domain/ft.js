// Seguimiento de casos fuera de tolerancia (FT). Reglas según lo explicado por el equipo:
// - 90 días calendario para solucionar, contados desde la instalación de la medición inicial
// - lo primero es avisar a DELSUR por correo lo antes posible
// - el caso solo se cierra con una remedición que demuestre que el voltaje se normalizó
// - pasados los 90 días se penalizan los 90 días y la compensación diaria sigue hasta solucionarlo
//   (el cálculo de montos todavía no está definido: solo se anota la compensación informada)
import { corteSubida, CR_OBLIGATORIOS, instalacionDeCaso } from './resultados.js';
import { ordenarCasos } from './listados.js';
import { diasEntre, hoyLocal, sumarDias } from './trabajo.js';

export const DIAS_SOLUCION_FT = 90;
export const RUTAS_FT = ['Estudio y propuesta de obras', 'Transferencia de alimentador', 'CPT DELSUR y Planificación'];

// Código de la remedición: el mismo caso con el número de medición siguiente (CR1… → CR2…)
export function codigoRemedicion(codigo) {
  const m = /^(CR|DA|DF)(\d)(.*)$/.exec(codigo || '');
  return m ? `${m[1]}${Number(m[2]) + 1}${m[3]}` : '';
}

// ¿Este código es la remedición de un caso FT abierto? Mismo caso con un número de medición mayor
// (CR1… → CR2…, RE1… → RE2…). Devuelve el caso FT o null.
export function ftDeRemedicion(codigo, listaFT) {
  const partes = c => /^(CR|DA|DF|RE)(\d)(.+)$/.exec(String(c || '').trim().replace(/^[[#]+|\]+$/g, '').replace(/\s+/g, '').toUpperCase());
  const r = partes(codigo);
  if (!r) return null;
  return listaFT.find(x => {
    const f = partes(x.codigo);
    return !x.cerrado && f && f[1] === r[1] && f[3] === r[3] && Number(r[2]) > Number(f[2]);
  }) || null;
}

// Perturbaciones (DA armónicas, DF flicker): un FT en tensión es solo informativo, no lleva seguimiento (confirmado)
export const esPerturbacion = caso => /^D[AF]/i.test(String(caso?.codigo || caso?.codigoEnte || '').trim()) || ['DA', 'DF'].includes(String(caso?.tipo || '').toUpperCase());
const esFT = caso => caso.resultado?.medicion === 'valida' && caso.resultado?.tolerancia === 'fuera';
// Perturbaciones que salieron FT en tensión (para mostrarlas como aviso, sin seguimiento)
export function perturbacionesFT(g) {
  return Object.entries(g?.casos || {}).filter(([, c]) => esFT(c) && esPerturbacion(c)).map(([id, caso]) => ({ id, caso, codigo: caso.codigo || caso.codigoEnte }));
}

// CR que no se suben al sistema (confirmado): se suben, en orden de código, los CR válidos hasta completar los
// obligatorios (38 en MT, 105 en BT); los que quedan después del corte no llevan seguimiento FT. Mientras no se
// completan los obligatorios no hay corte y todos los FT se siguen. Devuelve el Set de ids que no se suben.
export function noSeSuben(g) {
  const obligatorios = CR_OBLIGATORIOS[g?.area];
  if (!obligatorios) return new Set();
  const casos = Object.entries(g.casos || {}).map(([id, caso]) => ({ ...caso, _id: id }));
  const filas = ordenarCasos(casos).map(caso => ({ caso, resultado: { medicion: caso.resultado?.medicion || '' } }));
  const { codigo } = corteSubida(filas, obligatorios);
  if (!codigo) return new Set();
  const i = filas.findIndex(f => (f.caso.codigo || f.caso.codigoEnte) === codigo);
  return new Set(filas.slice(i + 1).filter(f => f.caso.tipo === 'CR').map(f => f.caso._id));
}

// Todos los casos FT de las campañas guardadas que llevan seguimiento (no las perturbaciones ni los CR que no se
// suben al sistema). Con { noSuben: true } devuelve solo los CR FT que quedaron después del corte (sin seguimiento).
export function casosFT(campanas, registros, hoy, { noSuben = false } = {}) {
  const lista = [];
  for (const [clave, g] of Object.entries(campanas || {})) {
    const fuera = noSeSuben(g);
    for (const [id, caso] of Object.entries(g?.casos || {})) {
      if (!esFT(caso) || esPerturbacion(caso) || fuera.has(id) !== noSuben) continue;
      const inst = instalacionDeCaso(caso, registros);
      const inicio = inst?.fechaInstalacion || null;
      const limite = inicio ? sumarDias(inicio, DIAS_SOLUCION_FT) : null;
      const ft = caso.ft || {};
      const codigo = caso.codigo || caso.codigoEnte;
      const remInst = instalacionDeCaso({ codigo: codigoRemedicion(codigo) }, registros);
      const cerrado = ft.remedicion?.normalizado === true;
      lista.push({
        clave, id, area: g.area, anio: g.anio, mes: g.mes, caso, codigo, ft, inicio, limite,
        dias: inicio ? diasEntre(inicio, (cerrado && ft.remedicion?.fecha) || hoy) : null,
        vencido: !!limite && !cerrado && hoy > limite,
        remedicionInstalada: remInst ? { codigo: remInst.caso, fecha: remInst.fechaInstalacion, retirado: !!remInst.retirado, fechaRetiro: remInst.fechaRetiroReal || null } : null,
        cerrado,
      });
    }
  }
  return lista.sort((a, b) => Number(a.cerrado) - Number(b.cerrado) || (a.limite || '9').localeCompare(b.limite || '9'));
}

// Pasos de un caso FT en orden y el siguiente que falta (para el Inicio y el aviso al abrir la app).
// x: caso de casosFT/todosFT. Las fotos de los trabajos se piden al acercarse la remedición: urgente si ya está instalada.
export function pasosFT(x, hoy = hoyLocal()) {
  const ft = x.ft || {}; const rem = ft.remedicion || {}; const inst = x.remedicionInstalada;
  return [
    { k: 'aviso', label: 'Aviso a DELSUR', hecho: !!ft.aviso, texto: 'Avisar a DELSUR por correo', detalle: 'Lo antes posible' },
    { k: 'sistema', label: 'Subido al sistema', hecho: !!ft.sistema, texto: 'Subir el caso al sistema', detalle: '' },
    { k: 'resumen', label: 'Resumen punto medido', hecho: !!ft.resumen, texto: 'Enviar por correo el Resumen punto medido', detalle: 'La gráfica que genera el sistema al subir el caso' },
    { k: 'ruta', label: 'Ruta de solución', hecho: !!ft.ruta, texto: 'Definir la ruta de solución', detalle: 'Obras, transferencia de alimentador o CPT DELSUR y Planificación' },
    { k: 'fotos', label: 'Fotos en MEMOS', hecho: !!ft.fotos, texto: inst ? 'Tomar fotos de los trabajos y subirlas a MEMOS' : 'Antes de remedir: fotos de los trabajos a MEMOS',
      detalle: inst ? `La remedición ${inst.codigo} ya está ${inst.retirado ? 'retirada' : 'en campo'}` : 'Lo que se hizo para mejorar el voltaje', urgente: !!inst },
    { k: 'remedicion', label: 'Remedición normalizada', hecho: rem.normalizado === true,
      texto: inst?.retirado ? 'Revisar la remedición: ¿se normalizó?' : inst ? 'Remedición en campo' : 'Programar la remedición', detalle: inst ? `${inst.codigo} desde el ${(inst.fecha || '').split('-').reverse().join('/')}` : '' },
  ];
}
export const siguientePasoFT = (x, hoy = hoyLocal()) => pasosFT(x, hoy).find(p => !p.hecho) || null;

// ── MAPA DE LOS FT ── (abiertos, con color por plazo; también como KML para Google My Maps)
// Plazo: vencido (rojo), por vencer (naranja: desde el día 72 de 90, como la barra), en plazo (azul), sin fecha (gris)
export function plazoFT(x) {
  if (x.vencido) return { clave: 'vencido', texto: 'Plazo vencido', color: '#dc2626' };
  if (x.dias === null || x.dias === undefined) return { clave: 'sin_fecha', texto: 'Sin fecha de instalación', color: '#64748b' };
  if (x.dias * 100 / DIAS_SOLUCION_FT >= 80) return { clave: 'por_vencer', texto: `Por vencer: día ${x.dias} de ${DIAS_SOLUCION_FT}`, color: '#ea580c' };
  return { clave: 'en_plazo', texto: `En plazo: día ${x.dias} de ${DIAS_SOLUCION_FT}`, color: '#0057b8' };
}
const num = v => { const n = parseFloat(v); return Number.isFinite(n) && n !== 0 ? n : null; };
// Puntos del mapa: GPS de la instalación de la medición y, si no tiene, el del listado del caso
export function puntosFT(lista, registros) {
  const puntos = []; const sinGPS = [];
  lista.filter(x => !x.cerrado).forEach(x => {
    const inst = x.tipo === 'reclamo' ? registros.find(r => r.id === x.instId) : instalacionDeCaso(x.caso, registros);
    const lat = num(inst?.lat) ?? num(x.caso.lat); const lng = num(inst?.lng) ?? num(x.caso.lng);
    if (lat === null || lng === null) { sinGPS.push(x.codigo); return; }
    const feb = x.caso.resultado?.febNoPer;
    puntos.push({ lat, lng, codigo: x.codigo, febNoPer: feb === undefined || feb === '' ? '' : `${feb} %`, nombre: x.caso.nombre || '',
      direccion: x.caso.direccion || x.caso.direccionEnte || inst?.lugar || '', area: x.area || '', tipo: x.tipo, plazo: plazoFT(x), limite: x.limite || '' });
  });
  return { puntos, sinGPS };
}
const xml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ESTILOS_KML = { vencido: 'red', por_vencer: 'orange', en_plazo: 'blu', sin_fecha: 'wht' };
// KML para importar en Google My Maps (un pin por caso, color por plazo; el detalle lleva FebNoPer, usuario y dirección)
export function kmlFT(puntos, titulo) {
  const estilos = Object.entries(ESTILOS_KML).map(([k, c]) => `<Style id="${k}"><IconStyle><Icon><href>https://maps.google.com/mapfiles/kml/paddle/${c}-circle.png</href></Icon></IconStyle></Style>`).join('');
  const marcas = puntos.map(p => {
    const fecha = p.limite ? p.limite.split('-').reverse().join('/') : '';
    const detalle = [`FebNoPer: ${p.febNoPer || '—'}`, p.plazo.texto + (fecha ? ` (hasta el ${fecha})` : ''), p.nombre, p.direccion, p.tipo === 'reclamo' ? `Reclamo · ${p.area}` : p.area].filter(Boolean).join('\n');
    return `<Placemark><name>${xml(p.codigo)}${p.febNoPer ? ` · ${xml(p.febNoPer)}` : ''}</name><description>${xml(detalle)}</description><styleUrl>#${p.plazo.clave}</styleUrl><Point><coordinates>${p.lng},${p.lat},0</coordinates></Point></Placemark>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(titulo)}</name>${estilos}\n${marcas}\n</Document></kml>\n`;
}
