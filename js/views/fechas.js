// Pestaña Fechas de una campaña: grupos de instalación (Fecha 1, 2 y 3) con su equipo por caso
import { ACCESORIOS_DEFECTO, casosDeFecha, fechasDe, revisarFecha } from '../domain/fechas.js';
import { MESES } from '../domain/trabajo.js';
import { fmtDate } from '../utils.js';
import { ordenarCasos } from '../domain/listados.js';
import { calcularMultiplicador, grupoDeEstado } from '../domain/multiplicadores.js';
import { state } from '../state.js';
import { eqEnCampo, escapeHtml } from '../utils.js';

const esc = s => escapeHtml(s ?? '');
const TG_GRUPO = { listos: 'verde', por_resolver: 'ambar', no_se_miden: 'gris' };

// Equipos que se pueden asignar: no instalados ni fuera de servicio o en mantenimiento
const equiposDisponibles = () => state.equipos
  .filter(e => !eqEnCampo(e) && !['fuera', 'mantenimiento'].includes(e.condicion || 'bueno'))
  .map(e => e.serie).filter(Boolean).sort();

export function renderFechas(c) {
  const g = state.campanas?.[c.clave] || {};
  const casos = ordenarCasos(c.casos);
  const disponibles = equiposDisponibles();
  const FECHAS = fechasDe(g);
  const sinFecha = casos.filter(x => !x.programa?.fecha && grupoDeEstado(x.mult?.estado) === 'listos').length;
  let html = '<div class="bloque">';
  html += `<div class="bloque-head"><div class="bloque-titulo">Programación de instalaciones</div>
    <label class="b b-p"><i class="ic ic-subir"></i> Importar programación<input type="file" accept=".xlsx,.xls" hidden onchange="importarProgramacion(this.files)"></label></div>`;
  html += sinFecha
    ? `<div class="meta"><div class="meta-tx">${sinFecha} ${sinFecha === 1 ? 'caso listo para medir no tiene' : 'casos listos para medir no tienen'} fecha<small>Asígnalos en la tabla de abajo o importa la programación</small></div></div>`
    : '<div class="meta ok"><div class="meta-tx">Todos los casos listos para medir tienen fecha</div></div>';
  html += '<details class="ayuda"><summary><i class="ic ic-ayuda"></i> ¿Cómo funciona?</summary><p>Sube el Excel de usuarios seleccionados con la fecha de instalación de cada caso: cada día queda como una Fecha. En cada Fecha pon el retiro y los accesorios, exporta el Excel para Despachos o envíala directo a la carga masiva.</p></details>';
  html += '</div>';

  html += '<div class="boletos fechas-grid">';
  FECHAS.forEach(n => {
    const f = g.fechas?.[n] || {};
    const delGrupo = casosDeFecha(casos, n);
    const avisos = delGrupo.length ? revisarFecha(delGrupo, f) : [];
    html += `<div class="boleto fecha-card ${delGrupo.length ? '' : 'vacio'}">
      <div class="boleto-top"><div><div class="boleto-k">Fecha ${n}</div><div class="boleto-t">${f.instalacion ? fmtDate(f.instalacion) : 'Sin fecha'}${f.retiro ? ' al ' + fmtDate(f.retiro) : ''}</div></div>
        <div class="boleto-n"><b>${delGrupo.length}</b> <span>${delGrupo.length === 1 ? 'caso' : 'casos'}</span></div></div>
      <div class="boleto-corte"></div>
      <div class="boleto-campos">
        <div><label>Instalación</label><input type="date" value="${esc(f.instalacion)}" onchange="setDatoFecha('${c.clave}', '${n}', 'instalacion', this.value)"></div>
        <div><label>Retiro</label><input type="date" value="${esc(f.retiro)}" onchange="setDatoFecha('${c.clave}', '${n}', 'retiro', this.value)"></div>
        <div class="ancho"><label>Accesorios</label><input value="${esc(f.accesorios || ACCESORIOS_DEFECTO)}" onchange="setDatoFecha('${c.clave}', '${n}', 'accesorios', this.value)"></div>
      </div>
      ${avisos.length ? `<div class="boleto-avisos">${avisos.map(esc).join('<br>')}</div>` : ''}
      <div class="boleto-acciones">
        <button class="hero-btn blanco" ${delGrupo.length ? '' : 'disabled'} onclick="exportarFecha('${c.clave}', '${n}')"><i class="ic ic-excel"></i> Exportar Excel</button>
        <button class="hero-btn" ${delGrupo.length ? '' : 'disabled'} onclick="enviarFechaADespachos('${c.clave}', '${n}')"><i class="ic ic-despachos"></i> Enviar a Despachos</button>
      </div>
    </div>`;
  });
  html += '</div>';

  html += '<div class="tabla-caja"><div class="tabla-scroll"><table class="tabla-r tabla-casos tabla-fechas"><thead><tr><th>Código</th><th>Estado</th><th>Multiplicador</th><th>Fecha</th><th>Equipo</th></tr></thead><tbody>';
  casos.forEach(x => {
    const m = x.mult || {}; const k = calcularMultiplicador(m);
    const p = x.programa || {};
    const opcionesEq = [...new Set([...(p.equipo ? [p.equipo] : []), ...disponibles])];
    html += `<tr>
      <td class="cod"><b>${esc(x.codigo || x.codigoEnte)}</b><small>${esc(x.nombre)}</small></td>
      <td data-l="Estado">${m.estado ? `<span class="tg ${TG_GRUPO[grupoDeEstado(m.estado)]}">${esc(m.estado)}</span>` : '<span class="falta">Sin estado</span>'}</td>
      <td data-l="Multiplicador" class="num">${esc(k.ecamec) || '—'}<small>${esc(k.ti)}${m.configuracion ? ' · ' + esc(m.configuracion) : ''}</small></td>
      <td data-l="Fecha"><select aria-label="Fecha de ${esc(x.codigo)}" onchange="asignarFecha('${c.clave}', '${x.id}', this.value)"><option value="">—</option>${FECHAS.map(n => `<option value="${n}" ${String(p.fecha || '') === n ? 'selected' : ''}>Fecha ${n}</option>`).join('')}</select></td>
      <td data-l="Equipo"><select aria-label="Equipo de ${esc(x.codigo)}" onchange="asignarEquipo('${c.clave}', '${x.id}', this.value)"><option value="">—</option>${opcionesEq.map(s => `<option ${p.equipo === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></td>
    </tr>`;
  });
  return html + '</tbody></table></div></div>';
}

// Vista previa de la programación importada
export function renderProgramacionModal() {
  const imp = state.importProgramacion;
  let html = '<div class="modal-overlay"><div class="modal hoja">';
  html += `<div class="modal-head"><div><div class="modal-titulo">Importar programación</div><div class="page-sub">${esc(imp.nombre)}</div></div><button class="modal-cerrar" onclick="cerrarProgramacion()" title="Cerrar">✕</button></div>`;
  if (!imp.planes.length) html += '<div class="aviso aviso-amarillo"><i class="ic ic-alerta"></i> Ningún caso del archivo coincide con las campañas importadas. Primero importa los listados del ente.</div>';
  imp.planes.forEach(p => {
    const g = state.campanas?.[p.clave] || {};
    const corregidos = p.asignaciones.filter(a => a.codigoNuevo);
    html += `<div class="panel" style="margin-top:10px"><div class="panel-titulo">${MESES[(g.mes || 1) - 1]} ${g.anio} · ${esc(g.area)} <span class="chip-dato"><b>${p.asignaciones.length}</b> casos</span></div>`;
    html += '<div class="filas">' + p.dias.map((d, i) => `<div class="panel-fila"><span>Fecha ${i + 1}</span><b>${fmtDate(d)} · ${p.asignaciones.filter(a => a.fecha === String(i + 1)).length} casos</b></div>`).join('') + '</div>';
    if (corregidos.length) html += `<div class="aviso aviso-azul avisos-lista"><i class="ic ic-info"></i><div>Se actualiza el código (tipo de sistema verificado): ${corregidos.map(a => `${esc(a.codigo)} → ${esc(a.codigoNuevo)}`).join(', ')}</div></div>`;
    const otroNC = p.asignaciones.filter(a => a.ncArchivo);
    if (otroNC.length) html += `<div class="aviso aviso-amarillo avisos-lista"><i class="ic ic-alerta"></i><div>Mismo código con otro NC en el archivo (revisa si cambió el contrato): ${otroNC.map(a => `${esc(a.codigo)} (${esc(a.ncArchivo)})`).join(', ')}</div></div>`;
    if (p.sinFecha.length) html += `<div class="aviso aviso-amarillo avisos-lista"><i class="ic ic-alerta"></i><div>No vienen en el archivo (quedan como están): ${p.sinFecha.map(esc).join(', ')}</div></div>`;
    html += '</div>';
  });
  if (imp.sinCampana.length) html += `<div class="aviso aviso-amarillo avisos-lista"><i class="ic ic-alerta"></i><div>${imp.sinCampana.length} filas no coinciden con ningún caso importado: ${imp.sinCampana.slice(0, 12).map(f => esc(f.codigo)).join(', ')}${imp.sinCampana.length > 12 ? '…' : ''}</div></div>`;
  html += `<button class="btn btn-primary" style="margin-top:12px" ${imp.planes.length ? '' : 'disabled'} onclick="guardarProgramacion()">Guardar programación</button>`;
  html += '<button class="btn btn-secondary" onclick="cerrarProgramacion()">Cancelar</button>';
  return html + '</div></div>';
}
