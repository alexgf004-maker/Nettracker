// Pendientes del Inicio: se calculan a partir de los datos, no se anotan a mano.
// Función pura: recibe los datos y la fecha de hoy y devuelve la lista ordenada.
import {
  agruparCampanas, areaDeInstalacion, fechaInformeReclamo, nombreCampana, tipoDeTrabajo, urgencia,
} from './trabajo.js';

// Orden de las urgencias en pantalla
export const GRUPOS = [
  ['vencido', 'Vencido'],
  ['hoy', 'Hoy'],
  ['proximo', 'Próximos días'],
  ['sin_fecha', 'Por hacer'],
];

// registros: instalaciones (analizadores); campanasGuardadas: { [clave|area]: { entrega } }
// area: 'CPT MT' | 'CPT BT' | null (todas)
export function calcularPendientes({ registros, campanasGuardadas = {}, hoy, area = null }) {
  const lista = [];
  const delArea = r => !area || areaDeInstalacion(r) === area;

  for (const r of registros) {
    if (!delArea(r)) continue;
    const tipo = tipoDeTrabajo(r.caso);
    const ref = { id: r.id, caso: r.caso, serie: r.serie, lugar: r.lugar, tipo };

    // Retiro programado
    if (!r.retirado && r.fechaRetiro) {
      const u = urgencia(r.fechaRetiro, hoy);
      if (u !== 'ok') lista.push({ ...ref, clase: 'retiro', urgencia: u, fecha: r.fechaRetiro, titulo: `Retirar ${r.serie || 'equipo'}`, detalle: detalleCaso(r) });
    }
    // Descarga pendiente después del retiro
    if (r.retirado && r.descargaPendiente) {
      lista.push({ ...ref, clase: 'descarga', urgencia: 'sin_fecha', fecha: r.fechaRetiroReal || null, titulo: `Descargar medición de ${r.serie || 'equipo'}`, detalle: detalleCaso(r) });
    }
    // Informe de reclamo: 8 días calendario desde el retiro
    if (tipo === 'reclamo' && r.retirado && !r.informeEntregado) {
      const limite = fechaInformeReclamo(r.fechaRetiroReal);
      const u = urgencia(limite, hoy);
      lista.push({ ...ref, clase: 'informe', urgencia: u === 'ok' ? 'sin_fecha' : u, fecha: limite, titulo: `Entregar informe del reclamo ${r.caso || ''}`.trim(), detalle: r.lugar || '' });
    }
    // Requerimiento con fecha de entrega
    if (tipo === 'requerimiento' && r.entregaLimite && !r.entregaRealizada) {
      const u = urgencia(r.entregaLimite, hoy);
      if (u !== 'ok') lista.push({ ...ref, clase: 'requerimiento', urgencia: u, fecha: r.entregaLimite, titulo: `Entregar requerimiento ${r.caso || ''}`.trim(), detalle: r.lugar || '' });
    }
  }

  // Entrega de campaña: día 10 del mes siguiente
  for (const c of agruparCampanas(registros, hoy)) {
    if (area && c.area !== area) continue;
    if (campanasGuardadas[c.clave]?.entrega) continue;
    const u = urgencia(c.fechaEntrega, hoy);
    if (u !== 'ok') lista.push({ clase: 'campana', clave: c.clave, tipo: 'campana', urgencia: u, fecha: c.fechaEntrega, titulo: `Cargar la campaña ${nombreCampana(c)} en el sistema CPT DELSUR`, detalle: `${c.area} · ${c.resumen.total} ${c.resumen.total === 1 ? 'medición' : 'mediciones'}` });
  }

  const orden = Object.fromEntries(GRUPOS.map(([k], i) => [k, i]));
  return lista.sort((a, b) => orden[a.urgencia] - orden[b.urgencia] || (a.fecha || '9').localeCompare(b.fecha || '9'));
}

function detalleCaso(r) {
  return [r.caso ? 'Caso ' + r.caso : '', r.lugar].filter(Boolean).join(' · ');
}
