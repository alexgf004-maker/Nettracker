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
