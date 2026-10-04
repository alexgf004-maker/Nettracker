# NetTracker

PWA interna de CPT INNOVA / DELSUR para gestión de analizadores de red, validaciones de tap y despachos.

El rediseño incorpora una bandeja de expedientes para registrar casos de campaña, reclamos y requerimientos especiales antes de asignar un analizador. Cada expediente puede vincular el punto de servicio, sus instalaciones y la bitácora de los equipos utilizados.

- Estructura y reglas de desarrollo: [NETTRACKER_CONTEXTO.md](NETTRACKER_CONTEXTO.md)
- Arquitectura propuesta del rediseño: [docs/ARQUITECTURA_REDISENO.md](docs/ARQUITECTURA_REDISENO.md)
- Probar en local: `python3 -m http.server 8000` y abrir http://localhost:8000 (no funciona abriendo `index.html` directo)
- Pruebas automáticas: `npm install` y `npm test` (ver [tests/README.md](tests/README.md))
