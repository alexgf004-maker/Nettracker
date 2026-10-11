// Handlers de la herramienta Dibujar
import {
  alFrenteDib, borrarDib, copiarDib, deshacerDib, descargarDib, dibPointerDown, dibPointerMove, dibPointerUp, duplicarDib, finTextoDib, girarDib,
  nuevoLienzoDib, quitarFondoDib, rehacerDib, setColorDib, setGrosorDib, setHerramientaDib, setSimboloDib, setTamTextoDib, subirFondoDib, textoDib,
} from '../actions/dibujo.js';

Object.assign(window, {
  alFrenteDib, borrarDib, copiarDib, deshacerDib, descargarDib, dibPointerDown, dibPointerMove, dibPointerUp, duplicarDib, finTextoDib, girarDib,
  nuevoLienzoDib, quitarFondoDib, rehacerDib, setColorDib, setGrosorDib, setHerramientaDib, setSimboloDib, setTamTextoDib, subirFondoDib, textoDib,
});
