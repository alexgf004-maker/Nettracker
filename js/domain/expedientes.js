// Expedientes de reclamo. Funciones puras (sin Firebase ni estado).
// Proceso confirmado por el equipo:
//   recibir el reclamo (correo de DELSUR) → ubicar al usuario → inspección e instalación →
//   retiro (normalmente al 8.º día, a veces más) → análisis de los TXT → informe (8 días desde el retiro).
// - El expediente se crea a mano ("Nuevo reclamo"); las instalaciones RE sueltas no se vuelven expedientes.
// - Un reclamo puede medirse hasta 6 veces: el mismo código con el número de medición siguiente (RE1… → RE2…).
// - En cada medición puede haber varios puntos a la vez (medidor, trafo, tablero…). El principal lleva el código RE
//   y es el que manda (FT y plazo del informe); los demás llevan un nombre libre y se vinculan a mano
//   (campo reclamo: { id, n, punto } en la instalación). Cada punto tiene su análisis; el informe es uno solo.
// - FT (FebNoPer > 5 % en tensión): mismo tratamiento que un caso regulatorio FT (aviso, 90 días, remedición).
// - Armónicos o flicker fuera de límite: solo se avisa; le compete al usuario corregirlo.
import { instalacionDeCaso } from './resultados.js';
import { casosFT, DIAS_SOLUCION_FT } from './ft.js';
import { diasEntre, etapaInstalacion, fechaInformeReclamo, normalizarCodigo, sumarDias } from './trabajo.js';

export const MAX_MEDICIONES = 6;
// Campos del reclamo (los del correo de DELSUR)
export const CAMPOS_RECLAMO = ['codigo', 'wo', 'ct', 'motivo', 'zona', 'nc', 'nombre', 'direccion', 'corte', 'medidor'];
export const DIAS_RETIRO_RECLAMO = 8; // el equipo se retira normalmente al 8.º día

// RE + nº de medición + mes + año + correlativo. El mes va de 1 a 9 y O, N, D para octubre,
// noviembre y diciembre (como en campañas): RE182026201 → { n: 1, resto: '82026201' }, RE1O2026201 → { n: 1, resto: 'O2026201' }
const CODIGO_RE = /\bRE\d[1-9OND]20\d{2}\d+\b/i;
export function partesCodigoRE(codigo) {
  const m = /^RE(\d)([1-9OND]20\d{2}\d+)$/.exec(normalizarCodigo(codigo));
  return m ? { n: Number(m[1]), resto: m[2] } : null;
}
export const codigoMedicion = (resto, n) => `RE${n}${resto}`;
// Llave del expediente en Firebase: la parte del código que no cambia entre mediciones
export const claveExpediente = codigo => { const p = partesCodigoRE(codigo); return p ? 'RE-' + p.resto : null; };

// ── Correo de DELSUR ──
// Asunto: "RE182026201 _ RV: WO-772546 , CT30656 , Se requiere el estudio de voltaje , COLONIA…, MUNICIPIO…"
// Cuerpo: tabla "Identificación del Punto de medición" con ID Usuario, Nombre del Usuario, Dirección,
// Centro MT/BT ó Corte y Medidor (al copiar de Outlook queda "etiqueta<TAB>valor" o el valor en la línea siguiente).
const ETIQUETAS = [
  ['nc', /^id\s*(de\s*)?usuario\b/i],
  ['nombre', /^nombre\s*(del\s*)?usuario\b/i],
  ['direccion', /^direcci[oó]n\b/i],
  ['corte', /^centro\s*mt\s*\/\s*bt|^corte\b/i],
  ['medidor', /^medidor\b/i],
];
export function leerCorreoReclamo(texto) {
  const lineas = String(texto || '').split(/\r?\n/).map(l => l.replace(/ /g, ' ').trim());
  const out = { codigo: '', wo: '', ct: '', motivo: '', zona: '', nc: '', nombre: '', direccion: '', corte: '', medidor: '' };
  const todo = lineas.join('\n');
  out.codigo = (CODIGO_RE.exec(todo) || [''])[0].toUpperCase();
  // Asunto: la línea con el código y comas (la que trae WO y CT)
  const asunto = lineas.find(l => out.codigo && l.toUpperCase().includes(out.codigo) && l.includes(',')) || '';
  if (asunto) {
    const partes = asunto.split(',').map(s => s.trim()).filter(Boolean);
    const wo = /\bWO\s*-?\s*(\d+)/i.exec(asunto); if (wo) out.wo = `WO-${wo[1]}`;
    const ct = /\bCT\s*-?\s*(\d+)/i.exec(asunto); if (ct) out.ct = `CT${ct[1]}`;
    // Lo que viene después de WO y CT: primero el motivo y luego la zona
    const resto = partes.filter(p => !CODIGO_RE.test(p) && !/^CT\s*-?\s*\d+$/i.test(p) && !/^WO\s*-?\s*\d+$/i.test(p));
    out.motivo = resto[0] || '';
    out.zona = resto.slice(1).join(', ');
  }
  // Tabla del cuerpo
  for (let i = 0; i < lineas.length; i++) {
    for (const [campo, re] of ETIQUETAS) {
      if (out[campo] || !re.test(lineas[i])) continue;
      let valor = lineas[i].replace(re, '').replace(/^[^:\t]*[:\t]/, '').replace(/^[\s:]+/, '').trim();
      if (!valor) valor = (lineas.slice(i + 1).find(l => l !== '') || '');
      if (ETIQUETAS.some(([, r]) => r.test(valor))) valor = ''; // la línea siguiente es otra etiqueta
      out[campo] = valor;
    }
  }
  return out;
}

// ── Mediciones del expediente ──

export const ETAPAS_MEDICION = {
  sin_instalar: 'Sin instalar', programada: 'Programada', en_campo: 'En campo', descarga_pendiente: 'Descarga pendiente', retirada: 'Retirada',
};

// Mediciones RE1…RE6 que tienen instalación en la app (siempre aparece la primera, aunque no esté instalada)
export function medicionesExpediente(exp, registros, hoy) {
  const p = partesCodigoRE(exp.codigo);
  if (!p) return [];
  const lista = [];
  for (let n = 1; n <= MAX_MEDICIONES; n++) {
    const codigo = codigoMedicion(p.resto, n);
    const inst = instalacionDeCaso({ codigo }, registros);
    const res = inst?.analisisReclamo?.resultado || null;
    // Puntos adicionales de esta medición (medidor, trafo, tablero…): instalaciones vinculadas al expediente
    const puntos = registros.filter(r => exp.id && r.reclamo?.id === exp.id && Number(r.reclamo.n) === n && normalizarCodigo(r.caso) !== codigo)
      .sort((a, b) => (a.fechaInstalacion || '').localeCompare(b.fechaInstalacion || ''))
      .map(r => {
        const rp = r.analisisReclamo?.resultado || null;
        return { inst: r, nombre: r.reclamo.punto || r.caso, etapa: etapaInstalacion(r, hoy), resultado: rp, avisos: avisosUsuario(rp) };
      });
    if (!inst && !puntos.length && n !== p.n) continue;
    lista.push({
      n, codigo, inst,
      etapa: inst ? etapaInstalacion(inst, hoy) : 'sin_instalar',
      retiroSugerido: inst?.fechaInstalacion ? sumarDias(inst.fechaInstalacion, DIAS_RETIRO_RECLAMO) : null,
      informeLimite: inst?.retirado ? fechaInformeReclamo(inst.fechaRetiroReal) : null,
      informe: inst?.informeEntregado || null,
      resultado: res,
      ft: res?.tension?.estado === 'FUERA DE TOLERANCIA',
      avisos: [...new Set([...avisosUsuario(res), ...puntos.flatMap(x => x.avisos.map(a => `${a} (${x.nombre})`))])],
      puntos,
    });
  }
  return lista;
}

// Armónicos o flicker fuera de límite: le toca al usuario (no es FT de la distribuidora)
export function avisosUsuario(res) {
  const out = [];
  if (res?.armonicos?.tension === 'NO CUMPLE') out.push('Armónicos de tensión');
  if (res?.armonicos?.corriente === 'NO CUMPLE') out.push('Armónicos de corriente');
  if (res?.flicker === 'NO CUMPLE') out.push('Flicker');
  return out;
}

// Pasos de la medición actual (la última que existe)
export const PASOS_RECLAMO = [
  ['recibido', 'Recibido'], ['ubicado', 'Ubicado'], ['instalado', 'Instalado'], ['retirado', 'Retirado'], ['analizado', 'Analizado'], ['informe', 'Informe entregado'],
];

export function resumenExpediente(exp, registros, hoy) {
  const mediciones = medicionesExpediente(exp, registros, hoy);
  const actual = mediciones[mediciones.length - 1] || null;
  const inst = actual?.inst;
  const hecho = {
    recibido: true,
    ubicado: exp.lat != null && exp.lat !== '' && exp.lng != null && exp.lng !== '',
    instalado: !!inst && actual.etapa !== 'programada',
    retirado: !!inst?.retirado,
    analizado: !!actual?.resultado,
    informe: !!actual?.informe,
  };
  const pasos = PASOS_RECLAMO.map(([k, label]) => ({ k, label, ok: hecho[k] }));
  const ft = ftExpediente(exp, mediciones, hoy);
  const informePendiente = mediciones.filter(m => m.inst?.retirado && !m.informe);
  const avisos = [...new Set(mediciones.flatMap(m => m.avisos))];
  const completo = pasos.every(x => x.ok) && (!ft || ft.cerrado);
  let estado = 'abierto';
  if (ft && !ft.cerrado) estado = 'ft';
  else if (completo) estado = 'cerrado';
  const siguiente = pasos.find(x => !x.ok) || null;
  return { mediciones, actual, pasos, siguiente, ft, informePendiente, avisos, estado };
}

// FT del expediente: la primera medición fuera de tolerancia; los 90 días corren desde su instalación
// y lo cierra la remedición normalizada (como en los casos regulatorios)
export function ftExpediente(exp, mediciones, hoy) {
  const inicial = mediciones.find(m => m.ft);
  if (!inicial) return null;
  const ft = exp.ft || {};
  const inicio = inicial.inst?.fechaInstalacion || null;
  const limite = inicio ? sumarDias(inicio, DIAS_SOLUCION_FT) : null;
  const cerrado = ft.remedicion?.normalizado === true;
  const rem = mediciones.find(m => m.n > inicial.n && m.inst);
  return {
    medicion: inicial, ft, inicio, limite, cerrado,
    dias: inicio ? diasEntre(inicio, (cerrado && ft.remedicion?.fecha) || hoy) : null,
    vencido: !!limite && !cerrado && hoy > limite,
    remedicionInstalada: rem ? { codigo: rem.codigo, fecha: rem.inst.fechaInstalacion, retirado: !!rem.inst.retirado } : null,
  };
}

// Expedientes guardados con su resumen, del más reciente al más antiguo
export function listaExpedientes(reclamos, registros, hoy) {
  return Object.entries(reclamos || {})
    .filter(([, e]) => e?.codigo)
    .map(([id, e]) => ({ id, ...e, resumen: resumenExpediente({ id, ...e }, registros, hoy) }))
    .sort((a, b) => (b.recibido || '').localeCompare(a.recibido || '') || b.codigo.localeCompare(a.codigo));
}

// Casos FT de los reclamos con la misma forma que los de campaña (para Seguimiento FT, Inicio y pendientes)
export function ftReclamos(reclamos, registros, hoy) {
  return listaExpedientes(reclamos, registros, hoy).filter(e => e.resumen.ft).map(e => {
    const f = e.resumen.ft;
    const feb = f.medicion.resultado?.tension?.febNoPer;
    return {
      tipo: 'reclamo', clave: 'reclamo', id: e.id, area: e.area, codigo: f.medicion.codigo,
      caso: { nombre: e.nombre, resultado: { febNoPer: typeof feb === 'number' ? Math.round(feb * 10000) / 100 : '' } },
      instId: f.medicion.inst?.id || null,
      ft: f.ft, inicio: f.inicio, limite: f.limite, dias: f.dias, vencido: f.vencido, remedicionInstalada: f.remedicionInstalada, cerrado: f.cerrado,
    };
  });
}

// Todos los casos FT (campañas y reclamos), abiertos primero y por plazo
export function todosFT(campanas, reclamos, registros, hoy) {
  return [...casosFT(campanas, registros, hoy).map(x => ({ tipo: 'campana', ...x })), ...ftReclamos(reclamos, registros, hoy)]
    .sort((a, b) => Number(a.cerrado) - Number(b.cerrado) || (a.limite || '9').localeCompare(b.limite || '9'));
}
