// Constantes: sedes, técnicos, usuarios y áreas
import { state } from './state.js';

export const SEDES = ['Plantel Central', 'Subestación Cucumacayán'];
export const TECNICOS = ['David García', 'Bryan Francia', 'Francisco Chulo', 'Vicente Ramos'];
export const AREAS = ['CPT DELSUR', 'CPT MT', 'CPT BT', 'Campos y Servicios'];
export const ADMIN = 'David García';
export const isAdmin = () => state.sesionUsuario?.nombre === ADMIN;

export const USUARIOS = [
  { nombre: 'David García', pin: '2442', area: 'CPT MT' },
  { nombre: 'Bryan Francia', pin: '8250', area: 'CPT MT' },
  { nombre: 'Francisco Chulo', pin: '0177', area: 'CPT BT' },
  { nombre: 'Vicente Ramos', pin: '1190', area: 'CPT BT' },
];

export const userArea = () => { const u = USUARIOS.find(x => x.nombre === state.sesionUsuario?.nombre); return u?.area || 'CPT MT'; };
export const userInstTab = () => userArea() === 'CPT BT' ? 'cpt_bt' : 'cpt_mt';

export const CONDICIONES = [
  { key: 'bueno', label: 'Bueno', icon: '🟢', color: 'var(--green)', bg: 'var(--green-light)' },
  { key: 'detalles', label: 'Con detalles', icon: '🟡', color: 'var(--yellow)', bg: 'var(--yellow-light)' },
  { key: 'mantenimiento', label: 'En mantenimiento', icon: '🔧', color: '#7c3aed', bg: '#f3f0ff' },
  { key: 'fuera', label: 'Fuera de servicio', icon: '🔴', color: 'var(--red)', bg: 'var(--red-light)' },
];

// Fallas que se pueden marcar al retirar un equipo de campo.
// Las graves dejan el equipo como "Fuera de servicio"; las demás, "Con detalles".
export const FALLAS_RETIRO = ['Conector con falso', 'Falla batería (solo enciende energizado)', 'LED intermitente', 'No agarra WiFi', 'Tapadera no cierra'];
export const FALLAS_GRAVES = ['No enciende / Sin señales de vida', 'Equipo calcinado / Explosión'];

// Campos y Servicios saca los equipos de la Subestación Cucumacayán y los regresa ahí
export const SEDE_CUCUMACAYAN = 'Subestación Cucumacayán';
export const sedeRetorno = r => (r?.areaInstalacion === 'Campos y Servicios' ? SEDE_CUCUMACAYAN : 'Plantel Central');
