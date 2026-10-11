// Equipos: lista por estado, memos de préstamo/devolución (nuevo y guardados) y asignación del área dueña
import { isAdmin } from '../config.js';
import { AREAS_DUENAS, AREAS_MOVIMIENTO, CAMPOS, coincideBusqueda, estadoEquipo, motivoNoMovimiento, pendientesDevolverCampos, planOrdenar } from '../domain/inventario.js';
import { state } from '../state.js';
import { escapeHtml, fmtDate } from '../utils.js';
import { heroSeccion } from './componentes.js';

const esc = s => escapeHtml(s ?? '');
const COLOR = { disponible: 'verde', prestado: 'azul', campo: 'ambar', mantenimiento: 'morado', fuera: 'rojo' };

// Tarjeta de un equipo en la lista
function tarjetaEquipo(eq, est) {
  const pend = state.records.some(r => r.equipoId === eq.id && r.retirado && r.descargaPendiente);
  const linea = est.clave === 'campo' ? `<i class="ic ic-antena"></i> #${esc(est.inst.caso)} · ${esc(est.inst.lugar || '')}`
    : est.clave === 'prestado' ? `<i class="ic ic-repetir"></i> ${esc(est.label)}${eq.prestadoFecha ? ' desde ' + fmtDate(eq.prestadoFecha) : ''}`
      : esc(eq.sede || 'Plantel Central');
  return `<button class="eq-item ${COLOR[est.clave]}" onclick="openEqDetalle('${eq.id}')">
    <div class="eq-item-main">
      <div class="eq-item-top"><b>${esc(eq.serie)}</b>${eq.vineta ? `<span class="eq-vineta"><i class="ic ic-etiqueta"></i> ${esc(eq.vineta)}</span>` : ''}</div>
      <div class="eq-item-sub">${esc(eq.modelo || 'Sin modelo')} · ${eq.area ? esc(eq.area) : '<span class="falta">Sin área</span>'}</div>
      <div class="eq-item-linea">${linea}</div>
    </div>
    <div class="eq-item-tags"><span class="tg ${COLOR[est.clave]}">${est.clave === 'prestado' ? 'Prestado' : esc(est.label)}</span>
      ${est.conDetalles ? '<span class="tg ambar">Con detalles</span>' : ''}${pend ? '<span class="tg ambar">Descarga pend.</span>' : ''}</div>
  </button>`;
}

export function renderListaEquipos() {
  const todos = state.equipos.map(eq => ({ eq, est: estadoEquipo(eq, state.records) }));
  const cuenta = k => todos.filter(x => x.est.clave === k).length;
  const sinArea = state.equipos.filter(eq => !eq.area);
  const pendCampos = pendientesDevolverCampos(state.equipos, state.records);
  let html = `<div class="content">${heroSeccion({
    eyebrow: 'Recursos', titulo: 'Equipos',
    sub: `${state.equipos.length} analizadores. Préstamos y devoluciones con su memo, de uno o varios equipos.`,
    kpis: [{ v: cuenta('disponible'), l: 'Disponibles' }, { v: cuenta('prestado'), l: 'Prestados' }, { v: cuenta('campo'), l: 'En campo' },
      { v: cuenta('mantenimiento') + cuenta('fuera'), l: 'Mant. / fuera', alerta: cuenta('fuera') > 0 }],
  })}`;

  html += `<div class="memo-acciones">
    <button class="b b-p" onclick="abrirMemoNuevo({ tipo: 'prestamo' })"><i class="ic ic-repetir"></i> Nuevo préstamo</button>
    <button class="b b-p" onclick="abrirMemoNuevo({ tipo: 'devolucion' })"><i class="ic ic-check"></i> Nueva devolución</button>
  </div>`;
  if (sinArea.length) html += `<div class="aviso aviso-amarillo inv-aviso"><i class="ic ic-alerta"></i><span>${sinArea.length} ${sinArea.length === 1 ? 'equipo no tiene' : 'equipos no tienen'} área dueña (CPT MT o CPT BT). Sin área no se pueden prestar ni devolver.</span>
    ${isAdmin() ? '<button class="b b-g" onclick="abrirOrdenar()">Ordenar equipos</button>' : '<span>Pídele al administrador que ordene los equipos.</span>'}</div>`;
  if (pendCampos.length) html += `<div class="aviso aviso-azul inv-aviso"><i class="ic ic-info"></i><span>${pendCampos.length} ${pendCampos.length === 1 ? 'equipo ya no está instalado pero sigue como prestado' : 'equipos ya no están instalados pero siguen como prestados'} a Campos y Servicios: ${pendCampos.map(e => esc(e.serie)).join(', ')}.</span>
    <button class="b b-g" onclick="regularizarDevolucionesCampos()">Registrar devolución</button></div>`;

  html += `<div class="segmento segmento-ancho inv-vistas"><button class="${state.invVista !== 'memos' ? 'active' : ''}" onclick="setInvVista('equipos')">Equipos</button><button class="${state.invVista === 'memos' ? 'active' : ''}" onclick="setInvVista('memos')">Memos (${state.memosEquipos.length})</button></div>`;
  if (state.invVista === 'memos') return html + renderMemosEquipos() + '</div>';

  const filtro = state.inventarioFiltro || 'TODOS';
  const FILTROS = [['TODOS', 'Todos', todos.length], ['disponible', 'Disponibles', cuenta('disponible')], ['prestado', 'Prestados', cuenta('prestado')], ['instalado', 'En campo', cuenta('campo')], ['mant', 'Mant. / fuera', cuenta('mantenimiento') + cuenta('fuera')]];
  html += `<div class="filtros inv-filtros">${FILTROS.map(([k, l, n]) => `<button class="pildora ${filtro === k ? 'active' : ''}" onclick="setInvFiltro('${k}')">${l} <b>${n}</b></button>`).join('')}</div>`;
  html += `<div class="inv-buscar"><input class="search-input" placeholder="Buscar serie, viñeta o modelo" value="${esc(state.inventarioSearch)}" oninput="setInvSearch(this.value)" ${state.inventarioSearch ? 'data-active="true"' : ''}>
    <div class="segmento">${[['', 'Todas'], ...AREAS_DUENAS.map(a => [a, a])].map(([k, l]) => `<button class="${(state.invArea || '') === k ? 'active' : ''}" onclick="setInvArea('${k}')">${l}</button>`).join('')}</div></div>`;

  const visibles = todos.filter(({ eq, est }) => {
    if (filtro === 'disponible' && est.clave !== 'disponible') return false;
    if (filtro === 'prestado' && est.clave !== 'prestado') return false;
    if (filtro === 'instalado' && est.clave !== 'campo') return false;
    if (filtro === 'mant' && !['mantenimiento', 'fuera'].includes(est.clave)) return false;
    if (state.invArea && eq.area !== state.invArea) return false;
    return coincideBusqueda(eq, state.inventarioSearch);
  });
  if (!state.equipos.length) return html + '<div class="empty"><div class="empty-icon"><i class=ic-equipos></i></div><div class="empty-text">El inventario está vacío</div></div></div>';
  if (!visibles.length) return html + '<div class="empty"><div class="empty-icon"><i class=ic-buscar></i></div><div class="empty-text">Sin resultados</div></div></div>';

  // Grupos por dónde está cada equipo; ninguno se queda fuera de la lista
  const disp = visibles.filter(x => x.est.clave === 'disponible');
  const grupos = [
    ['Disponibles · Plantel Central', 'verde', disp.filter(x => (x.eq.sede || 'Plantel Central') === 'Plantel Central')],
    ['Disponibles · Subestación Cucumacayán', 'verde', disp.filter(x => x.eq.sede === 'Subestación Cucumacayán')],
    ['Disponibles · Otra sede', 'verde', disp.filter(x => !['Plantel Central', 'Subestación Cucumacayán'].includes(x.eq.sede || 'Plantel Central'))],
    ['Con Campos y Servicios', 'azul', visibles.filter(x => x.est.clave === 'prestado' && x.est.tenedor === CAMPOS)],
    ['Prestados a otra área', 'azul', visibles.filter(x => x.est.clave === 'prestado' && x.est.tenedor !== CAMPOS)],
    ['En campo', 'ambar', visibles.filter(x => x.est.clave === 'campo')],
    ['En mantenimiento', 'morado', visibles.filter(x => x.est.clave === 'mantenimiento')],
    ['Fuera de servicio', 'rojo', visibles.filter(x => x.est.clave === 'fuera')],
  ];
  grupos.forEach(([titulo, color, items]) => {
    if (!items.length) return;
    html += `<div class="eq-grupo ${color}"><div class="eq-grupo-t">${titulo} <span>(${items.length})</span></div><div class="eq-lista">${items.map(x => tarjetaEquipo(x.eq, x.est)).join('')}</div></div>`;
  });
  html += `<div class="inv-pie"><label class="b b-g"><i class="ic ic-bandeja"></i> Importar equipos desde Excel<input type="file" accept=".xlsx,.xls" onchange="handleImportEquipos(event)" hidden></label>
    ${isAdmin() ? '<button class="b b-g" onclick="abrirOrdenar()"><i class="ic ic-ajustes"></i> Ordenar equipos (MT / Cucumacayán)</button>' : ''}</div>`;
  return html + '</div>';
}

// Memos guardados, del más reciente al más antiguo
function renderMemosEquipos() {
  if (!state.memosEquipos.length) return '<div class="empty"><div class="empty-icon"><i class=ic-archivo></i></div><div class="empty-text">Todavía no hay memos. Se guardan al registrar un préstamo o una devolución.</div></div>';
  return '<div class="eq-lista">' + state.memosEquipos.map(m => {
    const n = (m.equipos || []).length;
    return `<div class="memo-item"><div class="memo-item-main">
        <div class="memo-item-top"><span class="tg ${m.tipo === 'prestamo' ? 'azul' : 'verde'}">${m.tipo === 'prestamo' ? 'Préstamo' : 'Devolución'}</span><b>${esc(m.de)} → ${esc(m.a)}</b></div>
        <div class="memo-item-sub">${fmtDate(m.fecha)}${m.hora ? ' · ' + esc(m.hora) : ''} · ${n} ${n === 1 ? 'equipo' : 'equipos'} · ${esc(m.registradoPor || '')}</div>
        <div class="memo-item-series">${(m.equipos || []).map(e => esc(e.serie)).join(', ')}</div>
        ${m.nota ? `<div class="memo-item-nota">${esc(m.nota)}</div>` : ''}
      </div><button class="b b-g" onclick="reimprimirMemoEquipos('${m.id}')"><i class="ic ic-archivo"></i> Memo</button></div>`;
  }).join('') + '</div>';
}

// Flujo de un memo nuevo: tipo, de → para, equipos y nota
export function renderMemoNuevo() {
  const m = state.memoNuevo;
  const esPrestamo = m.tipo === 'prestamo';
  const opcionesDe = esPrestamo ? AREAS_DUENAS : AREAS_MOVIMIENTO;
  const opcionesA = (esPrestamo ? AREAS_MOVIMIENTO : AREAS_DUENAS).filter(a => a !== m.de);
  const chips = (campo, opciones, valor) => `<div class="memo-chips">${opciones.map(a => `<button class="${valor === a ? 'active' : ''}" onclick="setMemoNuevo('${campo}', '${a}')">${esc(a)}</button>`).join('')}</div>`;
  const lista = state.equipos.filter(eq => coincideBusqueda(eq, m.busqueda)).map(eq => ({ eq, motivo: motivoNoMovimiento(eq, m, state.records) }));
  const elegibles = lista.filter(x => !x.motivo);
  const noElegibles = lista.filter(x => x.motivo);
  const todosSel = elegibles.length && elegibles.every(x => m.sel.includes(x.eq.id));

  let html = `<div class="content memo-nuevo">
    <div class="memo-nuevo-head"><button class="btn-link" onclick="cerrarMemoNuevo()"><i class="ic ic-chevron-left"></i> Equipos</button><h2>Nuevo memo</h2></div>
    <div class="bloque"><div class="memo-paso">1. ¿Qué vas a registrar?</div>
      <div class="segmento segmento-ancho"><button class="${esPrestamo ? 'active' : ''}" onclick="setMemoNuevo('tipo', 'prestamo')">Préstamo</button><button class="${!esPrestamo ? 'active' : ''}" onclick="setMemoNuevo('tipo', 'devolucion')">Devolución</button></div></div>
    <div class="bloque"><div class="memo-paso">2. ${esPrestamo ? '¿De qué área sale y a quién se presta?' : '¿Quién lo devuelve y a qué área regresa?'}</div>
      <div class="memo-campo"><label>${esPrestamo ? 'Entrega' : 'Entrega (quien lo tiene)'}</label>${chips('de', opcionesDe, m.de)}</div>
      <div class="memo-campo"><label>Recibe</label>${chips('a', opcionesA, m.a)}</div></div>
    <div class="bloque"><div class="memo-paso">3. Equipos <span class="memo-cuenta">${m.sel.length} ${m.sel.length === 1 ? 'elegido' : 'elegidos'}</span></div>
      <input id="memo-buscar" class="search-input" placeholder="Buscar serie, viñeta o modelo" value="${esc(m.busqueda)}" oninput="setMemoBusqueda(this.value)">`;
  if (esPrestamo && m.a === CAMPOS) html += '<div class="memo-ayuda">A Campos y Servicios se le pueden entregar equipos de cualquier área (los de la bodega de la Cucumacayán). Al retirarlos de campo regresan solos a su área.</div>';
  if (!elegibles.length) html += `<div class="memo-vacio">${esPrestamo ? `No hay equipos ${m.a === CAMPOS ? '' : 'de ' + esc(m.de) + ' '}disponibles para prestar.` : `${esc(m.de)} no tiene equipos prestados de ${esc(m.a)} para devolver.`}</div>`;
  else {
    // Elegidos siempre a la vista (se quitan con ×); la lista va en una caja desplegable con su propio scroll
    const elegidos = m.sel.map(id => state.equipos.find(x => x.id === id)).filter(Boolean);
    if (elegidos.length) html += `<div class="memo-sel-chips">${elegidos.map(eq => `<span class="memo-sel-chip">${esc(eq.serie)}<button onclick="toggleEquipoMemo('${eq.id}')" title="Quitar">×</button></span>`).join('')}</div>`;
    const abierta = m.listaAbierta !== false || !!m.busqueda;
    html += `<div class="memo-lista ${abierta ? 'abierta' : ''}">
      <div class="memo-lista-head"><button class="memo-lista-toggle" onclick="toggleListaMemo()"><i class="ic ic-chevron-down"></i> ${abierta ? 'Ocultar' : 'Ver'} equipos disponibles (${elegibles.length})</button>
        <button class="btn-link memo-todos" onclick="seleccionarTodosMemo(${esc(JSON.stringify(elegibles.map(x => x.eq.id)))})">${todosSel ? 'Quitar todos' : 'Elegir todos'}</button></div>`;
    if (abierta) html += '<div class="memo-eqs">' + elegibles.map(({ eq }) => {
      const sel = m.sel.includes(eq.id);
      return `<button class="memo-eq ${sel ? 'sel' : ''}" onclick="toggleEquipoMemo('${eq.id}')"><span class="memo-check">${sel ? '<i class="ic ic-check"></i>' : ''}</span>
        <span class="memo-eq-main"><b>${esc(eq.serie)}</b>${eq.vineta ? ` · ${esc(eq.vineta)}` : ''}<small>${esc(eq.modelo || '')}${eq.area !== m.de && esPrestamo ? ` · de ${esc(eq.area)} (${esc(eq.sede || '')})` : ''}${!esPrestamo && eq.prestadoFecha ? ' · prestado desde ' + fmtDate(eq.prestadoFecha) : ''}</small></span>
        ${(eq.condicion || 'bueno') === 'detalles' ? '<span class="tg ambar">Con detalles</span>' : ''}</button>`;
    }).join('') + '</div>';
    html += '</div>';
  }
  if (noElegibles.length) {
    html += `<details class="memo-no"><summary>No se pueden elegir (${noElegibles.length})</summary>${noElegibles.map(({ eq, motivo }) => `<div class="memo-no-fila"><b>${esc(eq.serie)}</b><span>${esc(motivo)}</span></div>`).join('')}</details>`;
  }
  html += `</div>
    <div class="bloque"><div class="memo-paso">4. Nota (opcional)</div><textarea class="memo-nota" placeholder="Ej.: para la campaña de octubre" oninput="setMemoNuevo('nota', this.value)">${esc(m.nota)}</textarea></div>
    <div class="memo-pie"><div><b>${esPrestamo ? 'Préstamo' : 'Devolución'} · ${esc(m.de)} → ${esc(m.a)}</b><small>${m.sel.length > 1 ? `Memo de lote con ${m.sel.length} equipos` : m.sel.length === 1 ? 'Memo individual' : 'Elige al menos un equipo'}</small></div>
      <button class="b b-p" onclick="confirmarMemoNuevo()" ${m.sel.length ? '' : 'disabled'}><i class="ic ic-archivo"></i> Registrar y generar memo</button></div>
  </div>`;
  return html;
}

// Ordenar el inventario: se marcan los equipos de CPT MT (Plantel Central); todos los demás son de CPT BT y van a la Cucumacayán
export function renderOrdenar() {
  const o = state.ordenar;
  const plan = planOrdenar(state.equipos, state.records, o.mt);
  const mover = plan.filter(x => x.cambios.sede);
  const lista = [...state.equipos].sort((a, b) => Number(b.area === 'CPT MT') - Number(a.area === 'CPT MT') || (a.serie || '').localeCompare(b.serie || '')) // no se reordena al marcar
    .filter(eq => coincideBusqueda(eq, o.busqueda));
  let html = `<div class="content memo-nuevo"><div class="memo-nuevo-head"><button class="btn-link" onclick="volverEquipos()"><i class="ic ic-chevron-left"></i> Equipos</button><h2>Ordenar equipos</h2></div>
    <div class="bloque"><p class="memo-ayuda">Marca solo los equipos que son de <b>CPT MT</b> (los que tienen en Plantel Central). Todos los demás quedan como <b>CPT BT</b> y guardados en la <b>Cucumacayán</b>, la bodega. Los que están en campo o prestados no se mueven: solo se les corrige el área.</p>
      <div class="ordenar-resumen"><div><b>${o.mt.length}</b><span>CPT MT</span></div><div><b>${state.equipos.length - o.mt.length}</b><span>CPT BT</span></div><div class="${mover.length ? 'mueve' : ''}"><b>${mover.length}</b><span>Pasan a la Cucumacayán</span></div></div>
      <input id="ordenar-buscar" class="search-input" placeholder="Buscar serie, viñeta o modelo" value="${esc(o.busqueda)}" oninput="setOrdenarBusqueda(this.value)">
      <div class="memo-lista abierta"><div class="memo-eqs">${lista.map(eq => {
        const mt = o.mt.includes(eq.id);
        const est = estadoEquipo(eq, state.records);
        const p = plan.find(x => x.eq.id === eq.id);
        const nota = p?.cambios.sede ? `<span class="tg ambar">${esc(eq.sede || 'Plantel Central')} → Cucumacayán</span>` : '';
        return `<button class="memo-eq ${mt ? 'sel' : ''}" onclick="toggleOrdenarMT('${eq.id}')"><span class="memo-check">${mt ? '<i class="ic ic-check"></i>' : ''}</span>
          <span class="memo-eq-main"><b>${esc(eq.serie)}</b>${eq.vineta ? ` · ${esc(eq.vineta)}` : ''}<small>${mt ? 'CPT MT' : 'CPT BT'} · ${esc(est.clave === 'disponible' ? eq.sede || 'Plantel Central' : est.label)}</small></span>${nota}</button>`;
      }).join('')}</div></div></div>
    <div class="memo-pie"><div><b>${o.mt.length} de CPT MT · ${state.equipos.length - o.mt.length} de CPT BT</b><small>${plan.length ? `${plan.length} ${plan.length === 1 ? 'cambio' : 'cambios'}${mover.length ? ` · ${mover.length} a la Cucumacayán` : ''}` : 'Sin cambios'}</small></div>
      <button class="b b-p" onclick="guardarOrdenar()" ${plan.length ? '' : 'disabled'}><i class="ic ic-check"></i> Guardar</button></div>
  </div>`;
  return html;
}
