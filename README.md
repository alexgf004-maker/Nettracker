# NetTracker

PWA interna de CPT INNOVA / DELSUR para gestión de analizadores de red, validaciones de tap y despachos.

El rediseño incorpora una bandeja de expedientes para registrar casos de campaña, reclamos y requerimientos especiales antes de asignar un analizador. Cada expediente puede vincular el punto de servicio, sus instalaciones y la bitácora de los equipos utilizados.

En **Campañas** se crea un período por mes, año y área. Por ejemplo, abril y junio de 2026 son campañas distintas, con sus casos CR, DA y DF, etapa de trabajo y fecha de entrega propios. Los reclamos y requerimientos especiales permanecen como expedientes independientes.

La navegación principal sigue el trabajo de CPT: **Inicio, Campañas, Reclamos, Equipos y Operación**. Inicio muestra pendientes reales y campañas en curso; Campañas y Reclamos tienen sus propias bandejas. Instalaciones, validaciones de TAP, despachos, mapa, otros expedientes, reportes y calendario están en Operación.

- Estructura y reglas de desarrollo: [NETTRACKER_CONTEXTO.md](NETTRACKER_CONTEXTO.md)
- Arquitectura propuesta del rediseño: [docs/ARQUITECTURA_REDISENO.md](docs/ARQUITECTURA_REDISENO.md)
- Probar en local: `python3 -m http.server 8000` y abrir http://localhost:8000 (no funciona abriendo `index.html` directo)
- Pruebas automáticas: `npm install` y `npm test` (ver [tests/README.md](tests/README.md))
