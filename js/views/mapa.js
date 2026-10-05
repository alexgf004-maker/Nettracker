// Pestaña Mapa
import { state } from '../state.js';
import { calcSt, daysUntil } from '../utils.js';

export function renderMapa() {
  let html = '';
  const areaColor = a => a === 'CPT BT' ? '#16a34a' : a === 'Campos y Servicios' ? '#ea580c' : '#0057b8';
  const visibles = state.records.filter(r => {
    const st = calcSt(r);
    const areaOk = state.mapaFiltro === 'TODOS' || (r.areaInstalacion||'CPT MT') === state.mapaFiltro;
    return (st === 'ACTIVO' || st === 'PROXIMO' || st === 'VENCIDO') && r.lat && r.lng && areaOk;
  });
  const sinGPS = state.records.filter(r => {
    const st = calcSt(r);
    return (st === 'ACTIVO' || st === 'PROXIMO' || st === 'VENCIDO') && (!r.lat || !r.lng);
  });
  const countActivo = state.records.filter(r => calcSt(r)==='ACTIVO' && r.lat).length;
  const countProximo = state.records.filter(r => calcSt(r)==='PROXIMO' && r.lat).length;
  const countVencido = state.records.filter(r => calcSt(r)==='VENCIDO' && r.lat).length;

  // Build iframe HTML with embedded Leaflet map
  const markers = visibles.map(r => {
    const st = calcSt(r);
    const area = r.areaInstalacion || 'CPT MT';
    const color = areaColor(area);
    const proximo = st === 'PROXIMO';
    const vencido = st === 'VENCIDO';
    const markerColor = vencido ? '#dc2626' : areaColor(area);
    const label = vencido ? '⚠️ Vencido' : proximo ? 'Retiro próximo' : 'Activo';
    const dias = daysUntil(r.fechaRetiro);
    const diasTxt = dias === 0 ? 'HOY' : dias > 0 ? 'en ' + dias + 'd' : Math.abs(dias) + 'd vencido';
    return JSON.stringify({lat: parseFloat(r.lat), lng: parseFloat(r.lng), serie: r.serie, modelo: r.modelo||'', caso: r.caso, lugar: r.lugar||'', label, color: markerColor, proximo, vencido, dias: diasTxt, area});
  });

  const mapHtml = `<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'><link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'/>\x3cscript src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'><\/script><style>*{margin:0;padding:0}body,html,#map{width:100%;height:100%}.leaflet-popup-content{font-family:sans-serif;min-width:140px}.ps{font-weight:800;font-size:14px;color:#0a1628}.pm{font-size:12px;color:#64748b;margin-top:2px}.pb{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;margin-top:5px}<\/style><\/head><body><div id='map'><\/div>\x3cscript>var markers=${JSON.stringify(markers)};var map=L.map('map');L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:''}).addTo(map);var bounds=[];markers.forEach(function(m){var d=JSON.parse(m);var border=d.vencido?'3px solid #dc2626':d.proximo?'3px solid #ef4444':'3px solid white';var dot=d.proximo?'<div style="position:absolute;top:-4px;right:-4px;width:7px;height:7px;border-radius:50%;background:#ef4444;border:1px solid white"><\/div>':'';var icon=L.divIcon({className:'',html:'<div style="position:relative;width:16px;height:16px;border-radius:50%;background:'+d.color+';border:'+border+';box-shadow:0 2px 8px rgba(0,0,0,.4)">'+(d.proximo?'<div style="position:absolute;top:-5px;right:-5px;width:8px;height:8px;border-radius:50%;background:#ef4444;border:1px solid white"><\/div>':'')+'<\/div>',iconSize:[16,16],iconAnchor:[8,8]});var popup='<div class=ps>'+d.serie+'<\/div><div class=pm>'+d.modelo+'<\/div><div class=pm>📍 '+d.lugar+'<\/div><div class=pm>#'+d.caso+' · '+(d.area||'CPT MT')+'<\/div><span class=pb style="background:'+(d.color=='#0057b8'?'#e8f0fb':'#fffbeb')+';color:'+d.color+'">'+d.label+'<\/span><br><a href="https://maps.google.com/?q='+d.lat+','+d.lng+'" target=_blank style="font-size:11px;color:#0057b8;margin-top:4px;display:inline-block">Ver en Google Maps →<\/a>';L.marker([d.lat,d.lng],{icon:icon}).bindPopup(popup).addTo(map);bounds.push([d.lat,d.lng]);});if(bounds.length>0){if(bounds.length===1){map.setView(bounds[0],14);}else{map.fitBounds(bounds,{padding:[20,20]});}}else{map.setView([13.7942,-88.8965],8);}<\/script><\/body><\/html>`;

  const encodedHtml = 'data:text/html;charset=utf-8,' + encodeURIComponent(mapHtml);

  html += '<div style="display:flex;flex-direction:column;height:calc(100vh - 60px)">';

  // Stats bar
  html += '<div style="padding:10px 16px;display:flex;gap:8px;flex-shrink:0">';
  html += '<div class="stat-chip active" style="color:var(--primary)"><span class="stat-num">' + visibles.length + '</span><span class="stat-label">En mapa</span></div>';
  html += '<div class="stat-chip" style="color:var(--green)"><span class="stat-num">' + countActivo + '</span><span class="stat-label">Activos</span></div>';
  html += '<div class="stat-chip" style="color:var(--yellow)"><span class="stat-num">' + countProximo + '</span><span class="stat-label">Próximos</span></div>';
  html += '<div class="stat-chip" style="color:var(--red)"><span class="stat-num">' + countVencido + '</span><span class="stat-label">Vencidos</span></div>';
  html += '</div>';

  // Filter chips
  html += '<div style="display:flex;gap:6px;padding:0 16px 10px;overflow-x:auto;flex-shrink:0">';
  [{key:'TODOS',label:'Todos',color:'var(--primary)'},{key:'CPT MT',label:'⚡ CPT MT',color:'#0057b8'},{key:'CPT BT',label:'⚡ CPT BT',color:'#16a34a'},{key:'Campos y Servicios',label:'🏗 Campos',color:'#ea580c'}].forEach(function(f){
    var active = state.mapaFiltro === f.key;
    html += '<div onclick="setMapaFiltro(\'' + f.key + '\')" style="flex-shrink:0;padding:5px 12px;border-radius:20px;border:2px solid '+(active?f.color:'var(--border)')+';background:'+(active?f.color:'#fff')+';color:'+(active?'#fff':'var(--text3)')+';font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">'+f.label+'</div>';
  });
  html += '</div>';

  if (visibles.length === 0) {
    html += '<div class="empty"><div class="empty-icon">🗺️</div><div class="empty-text">Sin instalaciones activas con GPS</div></div>';
  } else {
    html += '<iframe src="' + encodedHtml + '" style="flex:1;border:none;width:100%"></iframe>';
  }

  if (sinGPS.length > 0) {
    html += '<div style="padding:8px 16px;background:var(--yellow-light);font-size:12px;color:var(--yellow);font-weight:600;flex-shrink:0">⚠ ' + sinGPS.length + ' instalación' + (sinGPS.length > 1 ? 'es' : '') + ' sin GPS</div>';
  }

  // Legend
  html += '<div style="display:flex;gap:10px;padding:8px 16px;background:#fff;border-top:1px solid var(--border);flex-shrink:0;flex-wrap:wrap">';
  html += '<span style="font-size:10px;color:var(--text3);display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:50%;background:#0057b8;display:inline-block"></span>CPT MT</span>';
  html += '<span style="font-size:10px;color:var(--text3);display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:50%;background:#16a34a;display:inline-block"></span>CPT BT</span>';
  html += '<span style="font-size:10px;color:var(--text3);display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:50%;background:#ea580c;display:inline-block"></span>Campos y Serv.</span>';
  html += '<span style="font-size:10px;color:var(--text3);display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:50%;background:#fff;border:2px solid #ef4444;display:inline-block"></span>Retiro próximo</span>';
  html += '</div>';
  html += '</div>';
  return html;
}
