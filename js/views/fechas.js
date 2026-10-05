// Pestaña Fechas de una campaña: grupos de instalación (Fecha 1, 2 y 3) con su equipo por caso
import { ACCESORIOS_DEFECTO, casosDeFecha, fechasDe, revisarFecha } from '../domain/fechas.js';
import { MESES } from '../domain/trabajo.js';
import { fmtDate } from '../utils.js';
import { ordenarCasos } from '../domain/listados.js';
import { calcularMultiplicador, grupoDeEstado } from '../domain/multiplicadores.js';
import { state } from '../state.js';
import { eqEnCampo, escapeHtml } from '../utils.js';

const esc = s => escapeHtml(s ?? '');
const CLASE_GRUPO = { listos: 'tag-verde', por_resolver: 'tag-amarillo', no_se_miden: 'tag-gris' };

// Equipos que se pueden asignar: no instalados ni fuera de servicio o en mantenimiento
const equiposDisponibles = () => state.equipos
  .filter(e => !eqEnCampo(e) && !['fuera', 'mantenimiento'].includes(e.condicion || 'bueno'))
  .map(e => e.serie).filter(Boolean).sort();

export function renderFechas(c) {
  const g = state.campanas?.[c.clave] || {};
  const casos = ordenarCasos(c.casos);
  const disponibles = equiposDisponibles();
  const FECHAS = fechasDe(g);
  let html = `<div class="panel fila-importar"><div><b>Programación de instalaciones</b><div class="page-sub">Sube el Excel de usuarios seleccionados con la fecha de instalación de cada caso: cada día queda como una Fecha.</div></div>
    <label class="btn-accion"><i class="ic ic-subir"></i> Importar programación<input type="file" accept=".xlsx,.xls" hidden onchange="importarProgramacion(this.files)"></label></div>`;
  html += '<div class="fechas-grid">';
  FECHAS.forEach(n => {
    const f = g.fechas?.[n] || {};
    const delGrupo = casosDeFecha(casos, n);
    const avisos = delGrupo.length ? revisarFecha(delGrupo, f) : [];
    html += `<div class="panel fecha-card">
      <div class="panel-titulo">Fecha ${n} <span class="chip-dato"><b>${delGrupo.length}</b> ${delGrupo.length === 1 ? 'caso' : 'casos'}</span></div>
      <div class="row">
        <div class="field"><label>Instalación</label><input type="date" value="${esc(f.instalacion)}" onchange="setDatoFecha('${c.clave}', '${n}', 'instalacion', this.value)"></div>
        <div class="field"><label>Retiro</label><input type="date" value="${esc(f.retiro)}" onchange="setDatoFecha('${c.clave}', '${n}', 'retiro', this.value)"></div>
      </div>
      <div class="field"><label>Accesorios</label><input value="${esc(f.accesorios || ACCESORIOS_DEFECTO)}" onchange="setDatoFecha('${c.clave}', '${n}', 'accesorios', this.value)"></div>
      ${avisos.length ? `<div class="aviso aviso-amarillo avisos-lista"><i class="ic ic-alerta"></i><div>${avisos.map(esc).join('<br>')}</div></div>` : ''}
      <div class="acciones-casos">
        <button class="btn-accion" ${delGrupo.length ? '' : 'disabled'} onclick="exportarFecha('${c.clave}', '${n}')"><i class="ic ic-excel"></i> Exportar Excel</button>
        <button class="btn-accion" ${delGrupo.length ? '' : 'disabled'} onclick="enviarFechaADespachos('${c.clave}', '${n}')"><i class="ic ic-despachos"></i> Enviar a Despachos</button>
      </div>
    </div>`;
  });
  html += '</div>';

  const sinFecha = casos.filter(x => !x.programa?.fecha && grupoDeEstado(x.mult?.estado) === 'listos').length;
  if (sinFecha) html += `<div class="aviso aviso-azul"><i class="ic ic-info"></i> ${sinFecha} ${sinFecha === 1 ? 'caso listo para medir no tiene' : 'casos listos para medir no tienen'} fecha asignada</div>`;

  html += '<div class="tabla-wrap"><table class="tabla-casos tabla-fechas"><thead><tr><th>Código</th><th>Estado</th><th>Multiplicador</th><th>Fecha</th><th>Equipo</th></tr></thead><tbody>';
  casos.forEach(x => {
    const m = x.mult || {}; const k = calcularMultiplicador(m);
    const p = x.programa || {};
    const opcionesEq = [...new Set([...(p.equipo ? [p.equipo] : []), ...disponibles])];
    html += `<tr>
      <td class="mono"><b>${esc(x.codigo || x.codigoEnte)}</b><small>${esc(x.nombre)}</small></td>
      <td>${m.estado ? `<span class="tag ${CLASE_GRUPO[grupoDeEstado(m.estado)]}">${esc(m.estado)}</span>` : '<span class="falta">Sin estado</span>'}</td>
      <td class="mono">${esc(k.ecamec) || '—'}<small>${esc(k.ti)}${m.configuracion ? ' · ' + esc(m.configuracion) : ''}</small></td>
      <td><select aria-label="Fecha de ${esc(x.codigo)}" onchange="asignarFecha('${c.clave}', '${x.id}', this.value)"><option value="">—</option>${FECHAS.map(n => `<option value="${n}" ${String(p.fecha || '') === n ? 'selected' : ''}>Fecha ${n}</option>`).join('')}</select></td>
      <td><select aria-label="Equipo de ${esc(x.codigo)}" onchange="asignarEquipo('${c.clave}', '${x.id}', this.value)"><option value="">—</option>${opcionesEq.map(s => `<option ${p.equipo === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></td>
    </tr>`;
  });
  return html + '</tbody></table></div>';
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
