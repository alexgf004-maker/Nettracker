// Pendientes del Inicio: se calculan a partir de los datos, no se anotan a mano.
// Función pura: recibe los datos y la fecha de hoy y devuelve la lista ordenada.
import {
  agruparCampanas, areaDeInstalacion, nombreCampana, tipoDeRegistro, urgencia,
} from './trabajo.js';
import { listaExpedientes, todosFT } from './expedientes.js';

// Orden de las urgencias en pantalla
export const GRUPOS = [
  ['vencido', 'Vencido'],
  ['hoy', 'Hoy'],
  ['proximo', 'Próximos días'],
  ['sin_fecha', 'Por hacer'],
];

// registros: instalaciones (analizadores); campanasGuardadas: { [clave|area]: { entrega } }
// reclamos: expedientes de reclamo (reclamos/{id}); solo ellos generan pendientes de reclamo
// area: 'CPT MT' | 'CPT BT' | null (todas)
// desde: 'AAAA-MM-DD' o null. Lo que venció o se retiró antes de esa fecha no se cuenta
// (sirve para no arrastrar mediciones viejas registradas antes de usar el seguimiento).
export function calcularPendientes({ registros, campanasGuardadas = {}, reclamos = {}, hoy, area = null, desde = null }) {
  const lista = [];
  const delArea = r => !area || areaDeInstalacion(r) === area;
  const cuenta = fecha => !desde || (fecha && fecha >= desde);

  for (const r of registros) {
    if (!delArea(r)) continue;
    const tipo = tipoDeRegistro(r);
    const ref = { id: r.id, caso: r.caso, serie: r.serie, lugar: r.lugar, tipo };

    // Retiro programado
    if (!r.retirado && r.fechaRetiro && cuenta(r.fechaRetiro)) {
      const u = urgencia(r.fechaRetiro, hoy);
      if (u !== 'ok') lista.push({ ...ref, clase: 'retiro', urgencia: u, fecha: r.fechaRetiro, titulo: `Retirar ${r.serie || 'equipo'}`, detalle: detalleCaso(r) });
    }
    // Descarga pendiente después del retiro
    if (r.retirado && r.descargaPendiente && cuenta(r.fechaRetiroReal)) {
      lista.push({ ...ref, clase: 'descarga', urgencia: 'sin_fecha', fecha: r.fechaRetiroReal || null, titulo: `Descargar medición de ${r.serie || 'equipo'}`, detalle: detalleCaso(r) });
    }
    // Requerimiento con fecha de entrega
    if (tipo === 'requerimiento' && r.entregaLimite && !r.entregaRealizada && cuenta(r.entregaLimite)) {
      const u = urgencia(r.entregaLimite, hoy);
      if (u !== 'ok') lista.push({ ...ref, clase: 'requerimiento', urgencia: u, fecha: r.entregaLimite, titulo: `Entregar requerimiento ${r.caso || ''}`.trim(), detalle: r.lugar || '' });
    }
  }

  // Entrega de campaña: día 10 del mes siguiente
  for (const c of agruparCampanas(registros, hoy, campanasGuardadas)) {
    if (area && c.area !== area) continue;
    if (campanasGuardadas[c.clave]?.entrega || !cuenta(c.fechaEntrega)) continue;
    const u = urgencia(c.fechaEntrega, hoy);
    if (u !== 'ok') lista.push({ clase: 'campana', clave: c.clave, tipo: 'campana', urgencia: u, fecha: c.fechaEntrega, titulo: `Cargar la campaña ${nombreCampana(c)} en el sistema CPT DELSUR`, detalle: `${c.area} · ${c.casos.length || c.resumen.total} ${(c.casos.length || c.resumen.total) === 1 ? 'caso' : 'casos'}` });
  }

  // Expedientes de reclamo: instalar la medición y entregar el informe 8 días después del retiro
  for (const e of listaExpedientes(reclamos, registros, hoy)) {
    if (area && e.area !== area) continue;
    const ref = { clase: 'reclamo', tipo: 'reclamo', id: e.id, caso: e.codigo };
    const actual = e.resumen.actual;
    if (actual?.etapa === 'sin_instalar' && e.resumen.estado !== 'cerrado') {
      lista.push({ ...ref, urgencia: 'sin_fecha', fecha: e.recibido || null, titulo: `Ubicar e instalar el reclamo ${actual.codigo}`, detalle: e.nombre || '' });
    }
    for (const m of e.resumen.informePendiente) {
      if (!cuenta(m.inst.fechaRetiroReal)) continue;
      const u = urgencia(m.informeLimite, hoy);
      lista.push({ ...ref, clase: 'informe', urgencia: u === 'ok' ? 'sin_fecha' : u, fecha: m.informeLimite, titulo: `Entregar informe del reclamo ${m.codigo}`, detalle: e.nombre || '' });
    }
  }

  // Casos fuera de tolerancia (campañas y reclamos): avisar a DELSUR de inmediato y no pasar los 90 días
  for (const x of todosFT(campanasGuardadas, reclamos, registros, hoy)) {
    if (x.cerrado || (area && x.area !== area)) continue;
    const ref = { clase: 'ft', tipo: x.tipo, clave: x.clave, id: x.id, caso: x.codigo };
    if (!x.ft.aviso) lista.push({ ...ref, urgencia: 'hoy', fecha: hoy, titulo: `Avisar a DELSUR del caso FT ${x.codigo}`, detalle: x.caso.nombre || '' });
    if (!x.ft.sistema) lista.push({ ...ref, urgencia: 'hoy', fecha: hoy, titulo: `Subir al sistema el caso FT ${x.codigo}`, detalle: x.caso.nombre || '' });
    if (!x.ft.resumen) lista.push({ ...ref, urgencia: 'hoy', fecha: hoy, titulo: `Enviar por correo el Resumen punto medido de ${x.codigo}`, detalle: x.caso.nombre || '' });
    if (x.limite && cuenta(x.limite)) {
      const u = urgencia(x.limite, hoy);
      if (u !== 'ok') lista.push({ ...ref, urgencia: u, fecha: x.limite, titulo: `Plazo de 90 días del caso FT ${x.codigo}`, detalle: x.caso.nombre || '' });
    }
  }

  const orden = Object.fromEntries(GRUPOS.map(([k], i) => [k, i]));
  return lista.sort((a, b) => orden[a.urgencia] - orden[b.urgencia] || (a.fecha || '9').localeCompare(b.fecha || '9'));
}

function detalleCaso(r) {
  return [r.caso ? 'Caso ' + r.caso : '', r.lugar].filter(Boolean).join(' · ');
}
