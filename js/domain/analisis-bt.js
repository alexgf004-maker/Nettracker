// Análisis de las mediciones de las campañas de CPT BT (TXT de ECAMEC): traslado de la macro MacroBT_1.bas
// (CargarMedicionesBT). Se respeta la lógica de la macro, con estos cambios confirmados por el equipo:
// - El tipo de instalación y la urbanidad salen del caso en la app (control de puntos), no del Excel del listado.
// - Sin urbanidad o sin tipo de instalación la macro no calculaba el FebNoPer y dejaba la medición VÁLIDA con 0 %:
//   aquí queda "por revisar" (ADVERTENCIA) con el dato que falta.
// - Archivo vacío: la macro lo marcaba INVALIDA; en la app es fallida, igual que en MT.
// - Si en campo la instalación es otra, se corrige en la app y se recalcula con los registros guardados
//   (series/{campaña}/{caso}), sin volver a subir el TXT (`analizarSeriesBT`).
// Funciones puras: reciben el texto del TXT (o los registros guardados) y los datos del caso.
import { leerTXT, minutosDeFecha } from './analisis.js';
import { completar } from './series.js';

export const NOMINAL_BT = 120;
const UMBRAL_ACTIVA_V = 18; // una fase tiene tensión si pasa de 18 V (15 % de 120 V)…
const UMBRAL_ACTIVA_PCT = 0.15; // … en más del 15 % de los registros
const PREDOMINANTE = 0.8; // el intervalo esperado debe ser al menos el 80 % de los intervalos

// Reglas por tipo de caso (CR o perturbación)
const REGLAS_BT = {
  CR: { tipoCaso: 'Regulatorio BT', intervalo: 15, columnas: 74, minimo: 576 },
  DA: { tipoCaso: 'Perturb. Armónica BT', intervalo: 10, columnas: 197, minimo: 1008 },
  DF: { tipoCaso: 'Perturb. Flicker BT', intervalo: 10, columnas: 197, minimo: 1008 },
  D: { tipoCaso: 'Perturbación BT', intervalo: 10, columnas: 197, minimo: 1008 },
  otro: { tipoCaso: 'Desconocido', intervalo: 15, columnas: 74, minimo: 576 },
};
const COLUMNAS_U = { nuevo: ['U1 [V]', 'U2 [V]', 'U3 [V]'], viejo: ['AVrmsAvg[Volts]', 'BVrmsAvg[Volts]', 'CVrmsAvg[Volts]'] };
const DIGITO_SISTEMA = { 1: 'MONOFASICO', 2: 'BIFASICO', 3: 'TRIFASICO' };

const sinTildes = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const numero = v => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : 0);

// Tipos de instalación que se pueden corregir en campo (el dígito es el del código de las DA/DF)
export const INSTALACIONES_BT = { 1: 'MONOFÁSICO', 2: 'BIFÁSICO', 3: 'TRIFÁSICO' };
export const digitoInstalacion = tipo => Number(Object.keys(DIGITO_SISTEMA).find(k => sinTildes(tipo).includes(DIGITO_SISTEMA[k]))) || null;

// nombre: nombre del archivo; texto: contenido; datos: { tipoInstalacion, urbanidad } del caso
export function analizarMedicionBT(nombre, texto, datos = {}) {
  const filas = leerTXT(texto);
  if (filas.length <= 1) return analizarRegistrosBT(nombre, null, datos);
  const enc = filas[0];
  const datosF = filas.slice(1);
  const formatoViejo = enc[0] === 'X-Data';
  const cols = COLUMNAS_U[formatoViejo ? 'viejo' : 'nuevo'].map(n => enc.indexOf(n));
  return analizarRegistrosBT(nombre, {
    columnas: enc.length, formatoViejo, inicio: datosF[0][0] || '', fin: datosF[datosF.length - 1][0] || '',
    // m: minutos de la fecha (null si la celda está vacía); u: tensión por fase (0 si no es número)
    filas: datosF.map(f => ({ m: f[0] ? minutosDeFecha(f[0]) : null, u: cols.map(c => (c >= 0 ? numero(f[c]) : 0)) })),
  }, datos);
}

// Mismo análisis con los registros guardados al analizar el TXT (los de las gráficas): serie = { inicio, fin, t, U };
// `previo`: el análisis anterior (de ahí sale el número de columnas del TXT)
export function analizarSeriesBT(nombre, serie, previo = {}, datos = {}) {
  const base = minutosDeFecha(serie.inicio); const n = serie.t?.length || 0;
  const fase = p => completar(serie.U?.[p]?.v, n);
  const [u1, u2, u3] = ['1', '2', '3'].map(fase);
  return analizarRegistrosBT(nombre, {
    columnas: previo.columnas || 0, formatoViejo: false, inicio: previo.inicio || serie.inicio, fin: previo.fin || serie.fin,
    filas: Array.from({ length: n }, (_, i) => ({ m: base + (serie.t[i] ?? 0), u: [u1[i] ?? 0, u2[i] ?? 0, u3[i] ?? 0] })),
  }, datos);
}

// medicion: { columnas, formatoViejo, inicio, fin, filas: [{ m, u: [v1, v2, v3] }] } o null si el archivo está vacío
function analizarRegistrosBT(nombre, medicion, datos) {
  const nombreSinExt = String(nombre).replace(/\.[^.]*$/, '');
  const mayus = nombreSinExt.toUpperCase();
  const esPerturb = !mayus.startsWith('CR') && mayus.startsWith('D');
  const reglas = mayus.startsWith('CR') ? REGLAS_BT.CR : esPerturb ? REGLAS_BT[mayus.slice(0, 2)] || REGLAS_BT.D : REGLAS_BT.otro;
  const tipoInstalacion = String(datos.tipoInstalacion || '').trim();
  const urbanidad = String(datos.urbanidad || '').trim().toUpperCase();
  const r = {
    archivo: nombreSinExt, tipoCaso: reglas.tipoCaso, registros: 0, intervalo: '', columnas: 0, tipoInstalacion, nivelTension: NOMINAL_BT,
    urbanidad, febNoPer: 'N/D', estado: '', detalle: '', inicio: '', fin: '',
  };

  if (!medicion || !medicion.filas.length) return { ...r, estado: 'FALLIDA', detalle: 'Archivo TXT vacío o sin datos' };

  const datosF = medicion.filas;
  const { formatoViejo } = medicion;
  r.columnas = medicion.columnas;
  r.registros = datosF.length;
  r.inicio = medicion.inicio;
  r.fin = medicion.fin;
  const tension = f => f.u;

  // ── Intervalos y fases con tensión ──
  let enIntervalo = 0; let totalIntervalos = 0; let anterior = null;
  const activos = [0, 0, 0];
  for (const f of datosF) {
    if (anterior !== null && f.m !== null) {
      if (anterior > 0 && f.m > 0) {
        if (f.m - anterior === reglas.intervalo) enIntervalo++;
        totalIntervalos++;
      }
    }
    if (f.m !== null) anterior = f.m;
    tension(f).forEach((v, i) => { if (v > UMBRAL_ACTIVA_V) activos[i]++; });
  }
  const predominante = totalIntervalos > 0 && enIntervalo / totalIntervalos >= PREDOMINANTE;
  r.intervalo = predominante ? `${reglas.intervalo} min` : `No es ${reglas.intervalo} min`;
  const fasesTXT = activos.filter(n => n / r.registros > UMBRAL_ACTIVA_PCT).length;

  // ── Fases del caso contra las del TXT ──
  const tipoNorm = sinTildes(tipoInstalacion);
  const esperadas = tipoNorm.includes('MONOFASICO') ? 1 : tipoNorm.includes('BIFASICO') ? 2 : tipoNorm.includes('TRIFASICO') ? 3 : 0;
  let estadoFases = 'OK'; let detalleFases = '';
  if (!tipoNorm) estadoFases = 'SIN INFO';
  else if (esperadas > 0 && fasesTXT !== esperadas) {
    estadoFases = 'ADVERTENCIA';
    detalleFases = `Verificar con planilla física: listado=${tipoInstalacion} (${esperadas} fase(s)) pero TXT tiene ${fasesTXT} fase(s) activa(s)`;
  }

  // ── FebNoPer: 120 V, 7 % urbano y 8 % rural ──
  let invalidos = 0; let ft = 0; let calculado = false;
  if (estadoFases !== 'SIN INFO' && urbanidad) {
    calculado = true;
    const tol = urbanidad === 'U' ? 0.07 : 0.08;
    const sup = NOMINAL_BT * (1 + tol); const inf = NOMINAL_BT * (1 - tol); const minimo = NOMINAL_BT * 0.7;
    r.nominal = NOMINAL_BT; r.tolerancia = tol; // para dibujar la banda en las gráficas
    // Si las fases no coinciden se calcula con las del TXT
    const tipoCalculo = estadoFases === 'ADVERTENCIA' ? ({ 1: 'MONOFASICO', 2: 'BIFASICO' }[fasesTXT] || 'TRIFASICO') : tipoNorm;
    const n = tipoCalculo.includes('MONOFASICO') ? 1 : tipoCalculo.includes('BIFASICO') ? 2 : 3;
    for (const f of datosF) {
      const v = tension(f).slice(0, n);
      if (v.some(x => x < minimo)) invalidos++;
      else if (v.some(x => x < inf || x > sup)) ft++;
    }
  }
  const validos = r.registros - invalidos;
  if (calculado && validos > 0) r.febNoPer = ft / validos;
  else if (calculado) r.febNoPer = 'N/A';
  r.registrosValidos = validos;
  r.registrosFT = ft;

  // ── Estado final (mismo orden que la macro: las advertencias primero; las fallidas pesan más) ──
  let estado = ''; let detalle = '';
  const advertir = d => { if (!estado) { estado = 'ADVERTENCIA'; detalle = d; } };
  if (esPerturb && tipoNorm && nombreSinExt.length >= 11) {
    const delNombre = DIGITO_SISTEMA[nombreSinExt.charAt(10)];
    if (delNombre && !tipoNorm.includes(delNombre)) advertir(`Tipo en nombre archivo (${delNombre}) no coincide con listado (${tipoInstalacion})`);
  }
  if (!formatoViejo && r.columnas !== reglas.columnas) advertir(`Número de columnas incorrecto: ${r.columnas} (se esperan ${reglas.columnas})`);
  if (estadoFases === 'ADVERTENCIA') advertir(detalleFases);
  if (!tipoNorm) advertir('Falta el tipo de instalación del caso: no se calculó el FebNoPer');
  else if (!urbanidad) advertir('Falta la urbanidad del caso: no se calculó el FebNoPer');
  const fallar = (d, solo = d) => { estado = 'FALLIDA'; detalle = detalle ? `${detalle} | ${d}` : solo; };
  if (validos < reglas.minimo) fallar(`Insuficientes registros válidos: ${validos} (mínimo ${reglas.minimo})`);
  if (!predominante) fallar(`Intervalo predominante NO es de ${reglas.intervalo} min`, `Intervalo predominante NO es de ${reglas.intervalo} min. Registros: ${r.registros}`);
  if (validos === 0 && r.registros > 0) fallar('ERROR ALIM. - Todos los registros son inválidos');
  if (!estado) estado = 'VALIDA';
  return { ...r, estado, detalle };
}
