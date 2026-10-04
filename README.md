# NetTracker

PWA interna de CPT INNOVA / DELSUR para gestión de analizadores de red, validaciones de tap y despachos.

El rediseño incorpora una bandeja de expedientes para registrar casos de campaña, reclamos y requerimientos especiales antes de asignar un analizador. Cada expediente puede vincular el punto de servicio, sus instalaciones y la bitácora de los equipos utilizados.

En **Campañas** se crea un período por mes, año y área. Por ejemplo, abril y junio de 2026 son campañas distintas, con sus casos CR, DA y DF, etapa de trabajo y fecha de entrega propios. Los reclamos y requerimientos especiales permanecen como expedientes independientes.

Dentro de cada campaña, **Importar listado Excel** acepta el listado preparado (`Listado`) o los archivos oficiales (`DetaSorteoCPT`) de CR, DA y DF juntos. Muestra una vista previa, vincula perturbaciones al contrato de un CR del período y deja fuera las filas de otra área o con conflictos. Al confirmar, crea solo los expedientes nuevos, asocia los existentes compatibles y conserva sus datos operativos. El Excel original no se guarda en la base de datos.

**Precampaña** reúne los casos por NC para preparar una visita por punto. Muestra faltantes del listado, descarga un Excel por caso, presenta el mapa de puntos y descarga un KML para entregarlo al contratista. También abre hojas de inspección y cartas borrador para imprimir o guardar como PDF. La fecha, firmante, contratista y contacto de las cartas se revisan antes de generarlas; la app nunca añade una firma. El seguimiento guarda cuándo se solicitó la firma, cuándo se entregaron los documentos y el enlace a las hojas y fotos recibidas. Inicio recuerda la recepción estimada unos diez días después de entregarlos al contratista.

La navegación principal sigue el trabajo de CPT: **Inicio, Campañas, Reclamos, Equipos y Operación**. Inicio muestra pendientes reales y campañas en curso; Campañas y Reclamos tienen sus propias bandejas. Instalaciones, validaciones de TAP, despachos, mapa, otros expedientes, reportes y calendario están en Operación.

- Estructura y reglas de desarrollo: [NETTRACKER_CONTEXTO.md](NETTRACKER_CONTEXTO.md)
- Arquitectura propuesta del rediseño: [docs/ARQUITECTURA_REDISENO.md](docs/ARQUITECTURA_REDISENO.md)
- Probar en local: `python3 -m http.server 8000` y abrir http://localhost:8000 (no funciona abriendo `index.html` directo)
- Pruebas automáticas: `npm install` y `npm test` (ver [tests/README.md](tests/README.md))
- Verificar reglas de importación sin navegador: `npm run test:import`
- Verificar agrupación y plazo orientativo de precampaña: `npm run test:pre-campaign`
