// Análisis de las mediciones (TXT de ECAMEC): traslado de la macro CalidadEnergia_v1.bas (CargarMediciones).
// Se respeta la lógica de la macro, con estos cambios confirmados por el equipo:
// - Monofásico: además de no tener tensión en V2/V3, debe tener tensión en V1.
// - Un caso es FT cuando el FebNoPer pasa de 5 % (la macro solo lo pintaba de rojo).
// - ADVERTENCIA queda "por revisar" (suele ser un dato mal puesto, p. ej. el nivel de tensión).
// - Los datos del caso (configuración, alimentador y urbanidad) vienen de la app y no del Excel del listado.
// Funciones puras: reciben el texto del TXT y los datos del caso.

export const UMBRAL_FT = 0.05; // FebNoPer > 5 % → fuera de tolerancia
export const LIMITE_INVALIDO = 0.7; // registro inválido: fase activa por debajo del 70 % del nominal
const UMBRAL_FASE_V = 300; // una fase "tiene tensión" si pasa de 300 V
const UMBRAL_FASE_PCT = 0.3; // … durante más del 30 % de los registros

// Reglas por tipo de caso
export const REGLAS = {
  CR: { tipoCaso: 'Regulatorio', intervalo: 15, columnas: 74, minimo: 576 },
  DA: { tipoCaso: 'Armónica', intervalo: 10, columnas: 197, minimo: 1008 },
  DF: { tipoCaso: 'Flicker', intervalo: 10, columnas: 197, minimo: 1008 },
};

const sinTildes = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const esNumero = v => v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v));

// "dd/mm/yyyy hh:mm[:ss]" → minutos desde 1970 (0 si no se puede leer), como ParseFechaHora
export function minutosDeFecha(texto) {
  const partes = String(texto || '').trim().split(/\s+/);
  if (partes.length < 2) return 0;
  const f = partes[0].split('/');
  if (f.length < 3) return 0;
  const h = partes[1].split(':');
  const [d, m, a] = f.map(Number); const [hh, mm, ss = 0] = h.map(Number);
  if ([d, m, a, hh, mm, ss].some(Number.isNaN)) return 0;
  // DateDiff("n") cuenta límites de minuto: se ignoran los segundos
  return Math.floor(Date.UTC(a, m - 1, d, hh, mm, ss) / 60000);
}

// Lee el TXT: quita caracteres raros al inicio (BOM), salta líneas vacías y separa por comas
export function leerTXT(texto) {
  const lineas = String(texto || '').split(/\r?\n/);
  if (lineas.length) lineas[0] = lineas[0].replace(/^[^\x00-\x7F]+/, '');
  return lineas.filter(l => l.trim() !== '').map(l => l.split(',').map(c => c.trim()));
}

// Tensión de la red a partir del alimentador ("AL013-23000" → 23000)
export function nivelDeAlimentador(alimentador) {
  const partes = String(alimentador || '').trim().split('-');
  const ultimo = partes[partes.length - 1];
  return partes.length >= 2 && esNumero(ultimo) ? Number(ultimo) : 0;
}

// Nominal fase-neutro de la red
function nominalLN(nivel) {
  return { 46000: 26600, 23000: 13200, 13200: 7620, 4160: 2400 }[nivel] ?? nivel / Math.sqrt(3);
}

const familia = tipoNorm => (tipoNorm.includes('MONOFASICO') ? 'mono' : tipoNorm.includes('BIFASICO') ? 'bi'
  : (tipoNorm.includes('TRIFASICO') || tipoNorm.includes('ESTRELLA') || tipoNorm.includes('DELTA')) ? 'tri' : '');

const pct = x => `${Math.round(x * 100)}%`;

// nombre: nombre del archivo; texto: contenido; datos: { configuracion, alimentador, urbanidad }
export function analizarMedicion(nombre, texto, datos = {}) {
  const nombreSinExt = String(nombre).replace(/\.[^.]*$/, '');
  const pref = nombreSinExt.slice(0, 2).toUpperCase();
  const esPerturb = pref[0] === 'D';
  const reglas = REGLAS[pref] || (esPerturb ? { tipoCaso: 'Perturbación', intervalo: 10, columnas: 197, minimo: 1008 } : REGLAS.CR);
  const r = {
    archivo: nombreSinExt, tipoCaso: REGLAS[pref] ? reglas.tipoCaso : esPerturb ? 'Perturbación' : '', registros: 0, intervalo: '', columnas: 0,
    tipoInstalacion: '', nivelTension: 0, urbanidad: '', febNoPer: 'N/D', estado: '', detalle: '', inicio: '', fin: '',
  };

  const filas = leerTXT(texto);
  if (filas.length <= 1) return { ...r, estado: 'FALLIDA', detalle: 'Archivo TXT vacío o sin datos' };

  const enc = filas[0];
  const datosF = filas.slice(1);
  r.inicio = datosF[0]?.[0] || '';
  r.fin = datosF[datosF.length - 1]?.[0] || '';
  for (let i = 0; i < Math.min(enc.length, 200) && enc[i] !== ''; i++) r.columnas++;
  r.registros = datosF.length;

  // ── Validación 1: intervalos entre registros consecutivos ──
  let conteo15 = 0; let otros15 = 0; let enIntervalo = 0; let otrosIntervalo = 0;
  for (let i = 1; i < datosF.length; i++) {
    const a = datosF[i - 1][0]; const b = datosF[i][0];
    if (!a || !b) continue;
    const fa = minutosDeFecha(a); const fb = minutosDeFecha(b);
    if (!(fa > 0 && fb > 0)) continue;
    const dif = fb - fa;
    if (dif === 15) conteo15++; else if (dif > 0) otros15++;
    if (dif === reglas.intervalo) enIntervalo++; else if (dif > 0) otrosIntervalo++;
  }
  if (reglas.intervalo === 15) { enIntervalo = conteo15; otrosIntervalo = otros15; }
  const totalIntervalos = enIntervalo + otrosIntervalo;
  const predominante = totalIntervalos === 0 ? 0 : enIntervalo >= otrosIntervalo ? reglas.intervalo : -1;
  r.intervalo = predominante === -1 ? `No es ${reglas.intervalo} min` : `${predominante} min`;

  // ── Validación 2: tipo de instalación contra las fases con tensión ──
  const col = n => enc.findIndex(h => h === n);
  const c1 = col('U1 [V]'); const c2 = col('U2 [V]'); const c3 = col('U3 [V]');
  const valor = (f, c) => (c >= 0 && esNumero(f[c]) ? Number(f[c]) : null);
  let n1 = 0; let n2 = 0; let n3 = 0;
  for (const f of datosF) {
    if ((valor(f, c1) ?? 0) > UMBRAL_FASE_V) n1++;
    if ((valor(f, c2) ?? 0) > UMBRAL_FASE_V) n2++;
    if ((valor(f, c3) ?? 0) > UMBRAL_FASE_V) n3++;
  }
  const total = r.registros;
  const p1 = total ? n1 / total : 0; const p2 = total ? n2 / total : 0; const p3 = total ? n3 / total : 0;

  r.tipoInstalacion = datos.configuracion || '';
  r.nivelTension = nivelDeAlimentador(datos.alimentador);
  r.urbanidad = String(datos.urbanidad || '').trim().toUpperCase();
  const encontrado = r.nivelTension > 0 || r.urbanidad !== '';
  if (esPerturb) {
    const digito = nombreSinExt.charAt(10);
    r.tipoInstalacion = { 1: 'Monofásico', 2: 'Bifásico', 3: 'Trifásico' }[digito] || r.tipoInstalacion;
  }
  const tipoNorm = sinTildes(r.tipoInstalacion);
  const fam = familia(tipoNorm);

  let estadoFases = 'OK'; let detalleFases = '';
  if (!tipoNorm) { estadoFases = 'SIN INFO'; detalleFases = 'Falta la configuración del caso'; }
  else if (fam === 'mono') {
    if (p2 > UMBRAL_FASE_PCT || p3 > UMBRAL_FASE_PCT) { estadoFases = 'INVALIDA'; detalleFases = `Monofásico con tensión en V2(${pct(p2)}) o V3(${pct(p3)})`; }
    else if (p1 <= UMBRAL_FASE_PCT) { estadoFases = 'INVALIDA'; detalleFases = `Monofásico sin tensión en V1(${pct(p1)})`; }
  } else if (fam === 'bi') {
    if (p3 > UMBRAL_FASE_PCT) { estadoFases = 'INVALIDA'; detalleFases = `Bifásico con tensión en V3(${pct(p3)})`; }
  } else if (fam === 'tri') {
    if (p1 <= UMBRAL_FASE_PCT || p2 <= UMBRAL_FASE_PCT || p3 <= UMBRAL_FASE_PCT) { estadoFases = 'INVALIDA'; detalleFases = `Trifásico: V1(${pct(p1)}) V2(${pct(p2)}) V3(${pct(p3)})`; }
  } else { estadoFases = 'SIN INFO'; detalleFases = `Tipo de instalación no reconocido: ${r.tipoInstalacion}`; }

  // ── FebNoPer ──
  let invalidos = 0; let ft = 0; let febNoPer = 0;
  const conDatos = r.nivelTension > 0 && (r.urbanidad === 'U' || r.urbanidad === 'R');
  if (conDatos) {
    const tol = r.urbanidad === 'U' ? 0.06 : 0.07;
    const nominal = esPerturb || fam === 'mono' || fam === 'bi' ? nominalLN(r.nivelTension) : r.nivelTension;
    const sup = nominal * (1 + tol); const inf = nominal * (1 - tol); const minimo = nominal * LIMITE_INVALIDO;
    r.nominal = Math.round(nominal * 10) / 10; r.tolerancia = tol; // para dibujar la banda en las gráficas
    for (const f of datosF) {
      const v = [valor(f, c1) ?? 0, valor(f, c2) ?? 0, valor(f, c3) ?? 0];
      const activas = fam === 'mono' ? v.slice(0, 1) : fam === 'bi' ? v.slice(0, 2) : fam === 'tri' ? v : [];
      if (activas.some(x => x < minimo)) { invalidos++; continue; }
      if (activas.some(x => x < inf || x > sup)) ft++;
    }
    const validos = total - invalidos;
    if (validos > 0) febNoPer = ft / validos;
    r.febNoPer = invalidos === total ? 'ERROR ALIM.' : febNoPer;
  }
  r.registrosValidos = total - invalidos;
  r.registrosFT = ft;

  // ── Estado final (mismo orden que la macro) ──
  const validos = total - invalidos;
  let estado; let detalle;
  if (total === 0 && r.columnas === 0) { estado = 'FALLIDA'; detalle = 'Archivo TXT vacío o sin datos'; }
  else if (!encontrado) { estado = 'ADVERTENCIA'; detalle = `Al caso le falta el nivel de tensión (alimentador) y la urbanidad: ${nombreSinExt}`; }
  else if (r.columnas !== reglas.columnas) { estado = 'ADVERTENCIA'; detalle = `Número de columnas incorrecto: ${r.columnas} (se esperan ${reglas.columnas})`; }
  else if (validos < reglas.minimo) { estado = 'FALLIDA'; detalle = `Insuficientes registros válidos: ${validos} (mínimo ${reglas.minimo})`; }
  else if (predominante === -1) { estado = 'FALLIDA'; detalle = `Intervalo predominante NO es de ${reglas.intervalo} min. Registros: ${total}`; }
  else if (estadoFases === 'INVALIDA') { estado = 'FALLIDA'; detalle = detalleFases; }
  else if (esPerturb && otrosIntervalo > 0) { estado = 'ADVERTENCIA'; detalle = `Registros OK (${total}) pero ${otrosIntervalo} intervalo(s) fuera de ${reglas.intervalo} min`; }
  else if (!esPerturb && otros15 > 0) { estado = 'ADVERTENCIA'; detalle = `Registros OK (${total}) pero ${otros15} intervalo(s) fuera de 15 min`; }
  else if (estadoFases === 'SIN INFO') { estado = 'ADVERTENCIA'; detalle = detalleFases; }
  else { estado = 'VALIDA'; detalle = `Registros: ${total} | ${r.tipoInstalacion} | Fases OK`; }
  return { ...r, estado, detalle };
}

// Resultado del caso a partir del análisis
export function resultadoDeAnalisis(a) {
  if (a.estado === 'FALLIDA') return { medicion: 'fallida' };
  if (a.estado === 'ADVERTENCIA') return { medicion: 'revisar' };
  const fnp = typeof a.febNoPer === 'number' ? a.febNoPer : null;
  return { medicion: 'valida', ...(fnp !== null ? { febNoPer: Math.round(fnp * 10000) / 100, tolerancia: fnp > UMBRAL_FT ? 'fuera' : 'dentro' } : {}) };
}

// Filas del Excel "Resumen" con las columnas de la macro (para comparar)
export function filasResumenAnalisis(analisis) {
  const out = [['Archivo', 'Tipo Caso', 'N° Registros', 'Intervalo (min)', 'Tipo Instalacion', 'Nivel Tension', 'Urbanidad', 'FebNoPer', 'Estado', 'Detalle', 'Inicio Medicion', 'Fin Medicion']];
  analisis.forEach(a => out.push([a.archivo, a.tipoCaso, a.registros, a.intervalo, a.tipoInstalacion, a.nivelTension, a.urbanidad,
    typeof a.febNoPer === 'number' ? Math.round(a.febNoPer * 10000) / 100 + '%' : a.febNoPer, a.estado, a.detalle, a.inicio, a.fin]));
  return out;
}
