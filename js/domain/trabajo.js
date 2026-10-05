// Clasificación del trabajo de CPT y cálculo de plazos.
// Funciones puras (sin Firebase ni estado) para poder probarlas aisladas.
//
// Tipos de trabajo:
//   campana       → casos regulatorios CR (regulación de tensión), DA (armónicos), DF (flicker)
//   reclamo       → casos RE (reclamos de usuarios)
//   requerimiento → cualquier otro código (mediciones esporádicas)

export const TIPOS_TRABAJO = {
  campana: { label: 'Campaña', plural: 'Campañas' },
  reclamo: { label: 'Reclamo', plural: 'Reclamos' },
  requerimiento: { label: 'Requerimiento', plural: 'Requerimientos' },
};

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Días antes de un vencimiento en que el Inicio empieza a avisar
export const DIAS_AVISO = 3;
// Días calendario desde el retiro para entregar el informe de un reclamo
export const DIAS_INFORME_RECLAMO = 8;
// Día del mes siguiente en que vence la entrega de una campaña
export const DIA_ENTREGA_CAMPANA = 10;

export function normalizarCodigo(codigo) {
  return String(codigo || '').trim().replace(/^[[#]+|\]+$/g, '').replace(/\s+/g, '').toUpperCase();
}

export function tipoDeTrabajo(codigo) {
  const c = normalizarCodigo(codigo);
  if (/^(CR|DA|DF)/.test(c)) return 'campana';
  if (/^RE/.test(c)) return 'reclamo';
  return 'requerimiento';
}

// Subtipo del caso de campaña: CR regulación de tensión, DA armónicos, DF flicker
export function subtipoCampana(codigo) {
  const c = normalizarCodigo(codigo);
  return ['CR', 'DA', 'DF'].find(p => c.startsWith(p)) || null;
}

// Mes y año de la campaña a partir del código.
// CR + nº de medición + mes + año…  (mes: 1-9, O=octubre, N=noviembre, D=diciembre)
// Ej.: CR112026201 → enero 2026; DA1N2026031O00 → noviembre 2026
const MES_CODIGO = { O: 10, N: 11, D: 12 };
export function periodoCampana(codigo) {
  const m = /^(?:CR|DA|DF)\d([1-9OND])(20\d{2})/.exec(normalizarCodigo(codigo));
  if (!m) return null;
  return { mes: MES_CODIGO[m[1]] || Number(m[1]), anio: Number(m[2]) };
}

// Número de medición dentro del código (1 = primera, 2 = remedición…)
export function numeroMedicion(codigo) {
  const m = /^(?:CR|DA|DF)(\d)/.exec(normalizarCodigo(codigo));
  return m ? Number(m[1]) : null;
}

export function claveCampana({ anio, mes }) {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

export function nombreCampana({ anio, mes }) {
  return `${MESES[mes - 1]} ${anio}`;
}

// Área a la que pertenece una instalación. Las de Campos y Servicios cuentan para su área beneficiaria.
export function areaDeInstalacion(r) {
  if (r.areaInstalacion === 'Campos y Servicios') return r.areaBeneficiaria || 'CPT MT';
  return r.areaInstalacion || 'CPT MT';
}

// ── Fechas (YYYY-MM-DD, sin horas) ──

// Fecha de hoy en hora local (toISOString daría la fecha UTC, que en El Salvador cambia a las 6 p. m.)
export function hoyLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function sumarDias(fecha, dias) {
  const [y, m, d] = fecha.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}

export function diasEntre(desde, hasta) {
  const a = Date.UTC(...desde.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)));
  const b = Date.UTC(...hasta.split('-').map((n, i) => Number(n) - (i === 1 ? 1 : 0)));
  return Math.round((b - a) / 86400000);
}

export function fechaEntregaCampana({ anio, mes }) {
  const sigAnio = mes === 12 ? anio + 1 : anio;
  const sigMes = mes === 12 ? 1 : mes + 1;
  return `${sigAnio}-${String(sigMes).padStart(2, '0')}-${String(DIA_ENTREGA_CAMPANA).padStart(2, '0')}`;
}

export function fechaInformeReclamo(fechaRetiroReal) {
  return fechaRetiroReal ? sumarDias(fechaRetiroReal, DIAS_INFORME_RECLAMO) : null;
}

// Urgencia de un vencimiento respecto a hoy: vencido | hoy | proximo | ok
export function urgencia(fechaLimite, hoy) {
  if (!fechaLimite) return 'ok';
  const d = diasEntre(hoy, fechaLimite);
  if (d < 0) return 'vencido';
  if (d === 0) return 'hoy';
  if (d <= DIAS_AVISO) return 'proximo';
  return 'ok';
}

// ── Agrupación de instalaciones en trabajo ──

// Etapa de una instalación dentro de su caso
export function etapaInstalacion(r, hoy) {
  if (r.retirado) return r.descargaPendiente ? 'descarga_pendiente' : 'retirada';
  if (r.fechaInstalacion && r.fechaInstalacion > hoy) return 'programada';
  return 'en_campo';
}

export const ETAPAS = {
  programada: 'Programada',
  en_campo: 'En campo',
  descarga_pendiente: 'Descarga pendiente',
  retirada: 'Retirada',
};

// Agrupa las instalaciones de campaña por mes/año y área, junto con las campañas importadas
// de los listados del ente (guardadas en campanas/{clave} con sus casos).
// La clave (p. ej. 2026-09_CPT-MT) sirve también como llave en Firebase (campanas/{clave}).
export function agruparCampanas(registros, hoy, guardadas = {}) {
  const campanas = new Map();
  const nueva = (clave, periodo, area) => {
    if (!campanas.has(clave)) campanas.set(clave, { clave, ...periodo, area, nombre: nombreCampana(periodo), fechaEntrega: fechaEntregaCampana(periodo), registros: [] });
    return campanas.get(clave);
  };
  for (const [clave, g] of Object.entries(guardadas || {})) {
    if (g?.casos && g.anio && g.mes && g.area) nueva(clave, { anio: g.anio, mes: g.mes }, g.area);
  }
  for (const r of registros) {
    if (tipoDeTrabajo(r.caso) !== 'campana') continue;
    const periodo = periodoCampana(r.caso);
    if (!periodo) continue;
    const area = areaDeInstalacion(r);
    nueva(claveCampana(periodo) + '_' + area.replace(/\s+/g, '-'), periodo, area).registros.push(r);
  }
  return [...campanas.values()]
    .map(c => {
      const casos = Object.entries(guardadas?.[c.clave]?.casos || {}).map(([id, x]) => ({ id, ...x }));
      return { ...c, casos, resumen: resumenEtapas(c.registros, hoy), subtipos: casos.length ? contarSubtiposCasos(casos) : contarSubtipos(c.registros) };
    })
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes || a.area.localeCompare(b.area));
}

function contarSubtiposCasos(casos) {
  const c = { CR: 0, DA: 0, DF: 0 };
  casos.forEach(x => { const s = x.tipo || subtipoCampana(x.codigo); if (s) c[s]++; });
  return c;
}

export function resumenEtapas(registros, hoy) {
  const r = { total: registros.length, programada: 0, en_campo: 0, descarga_pendiente: 0, retirada: 0 };
  registros.forEach(x => { r[etapaInstalacion(x, hoy)]++; });
  return r;
}

function contarSubtipos(registros) {
  const c = { CR: 0, DA: 0, DF: 0 };
  registros.forEach(r => { const s = subtipoCampana(r.caso); if (s) c[s]++; });
  return c;
}

export function registrosDeTipo(registros, tipo) {
  return registros.filter(r => tipoDeTrabajo(r.caso) === tipo);
}

// Caso de una campaña guardada que corresponde a una fila de un Excel del equipo ({ codigo, nc }).
// Primero por código exacto (el NC puede cambiar si cambió el contrato); si no, por NC y tipo
// (en DA/DF el código puede traer corregido el tipo de sistema). Devuelve { clave, id, caso } o null.
export function buscarCasoImportado(p, campanas) {
  const periodo = periodoCampana(p.codigo);
  const tipo = subtipoCampana(p.codigo);
  const candidatas = Object.entries(campanas || {}).filter(([clave]) => periodo && clave.startsWith(claveCampana(periodo) + '_'));
  for (const porCodigo of [true, false]) {
    for (const [clave, g] of candidatas) {
      const hit = Object.entries(g.casos || {}).find(([, c]) => (porCodigo
        ? c.codigo === p.codigo || c.codigoEnte === p.codigo
        : p.nc && c.nc === p.nc && (c.tipo || subtipoCampana(c.codigo)) === tipo));
      if (hit) return { clave, id: hit[0], caso: hit[1] };
    }
  }
  return null;
}
