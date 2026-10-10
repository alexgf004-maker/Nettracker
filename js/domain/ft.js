// Seguimiento de casos fuera de tolerancia (FT). Reglas según lo explicado por el equipo:
// - 90 días calendario para solucionar, contados desde la instalación de la medición inicial
// - lo primero es avisar a DELSUR por correo lo antes posible
// - el caso solo se cierra con una remedición que demuestre que el voltaje se normalizó
// - pasados los 90 días se penalizan los 90 días y la compensación diaria sigue hasta solucionarlo
//   (el cálculo de montos todavía no está definido: solo se anota la compensación informada)
import { instalacionDeCaso } from './resultados.js';
import { diasEntre, sumarDias } from './trabajo.js';

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

// Todos los casos FT de las campañas guardadas
export function casosFT(campanas, registros, hoy) {
  const lista = [];
  for (const [clave, g] of Object.entries(campanas || {})) {
    for (const [id, caso] of Object.entries(g?.casos || {})) {
      if (caso.resultado?.medicion !== 'valida' || caso.resultado?.tolerancia !== 'fuera') continue;
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
        remedicionInstalada: remInst ? { codigo: remInst.caso, fecha: remInst.fechaInstalacion, retirado: !!remInst.retirado } : null,
        cerrado,
      });
    }
  }
  return lista.sort((a, b) => Number(a.cerrado) - Number(b.cerrado) || (a.limite || '9').localeCompare(b.limite || '9'));
}
