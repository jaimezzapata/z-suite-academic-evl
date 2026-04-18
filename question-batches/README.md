## Banco de preguntas (cargas por lotes)

Este proyecto carga preguntas y plantillas desde archivos **JSON** en modo incremental (**append_only**).

### Estructura recomendada

- `question-batches/subject/<subjectId>/`
  - `YYYY-MM-DD.<subjectId>.<groupId>.<momentId>.batch-###.json`
- `question-batches/templates/`
  - `batch.template.json` (plantilla para duplicar)

Ejemplo:

- `question-batches/subject/frontend_1/2026-04-18.frontend_1.manana_10a.m1.batch-001.json`

### Reglas de datos

- **Nunca reemplazar**: siempre agregar nuevas preguntas (append only).
- **IDs únicos**:
  - Preguntas: `q_<...>` (ej: `q_front_000123`)
  - Plantillas: `exam_<...>`
  - Catálogos: `frontend_1`, `m1`, `manana_10a`, etc.
- **Segmentación**:
  - Cada pregunta debe tener `subjectId` y normalmente `groupIds` + `momentIds`.
  - Si una pregunta aplica a varios grupos/momentos, añade varios IDs.
- **Estado**:
  - Para que una pregunta sea seleccionable al publicar: `status: "published"`.

### Tamaño de lote recomendado

- Lotes de **300 a 1500** preguntas por archivo suelen ser un punto sano.
- Si necesitas “muy grande”, crea múltiples lotes por materia y por momento.

### Cómo importar un lote

Usa el seed (append_only) indicando el archivo:

```bash
npm run seed:firestore -- --serviceAccount ./.secrets/service-account.json --projectId <tu_proyecto> --adminUid <uid> --adminEmail <correo> --input ./question-batches/subject/<subjectId>/<archivo.json>
```

Modo seguro (simulación):

```bash
npm run seed:firestore -- --serviceAccount ./.secrets/service-account.json --projectId <tu_proyecto> --adminUid <uid> --adminEmail <correo> --input ./question-batches/subject/<subjectId>/<archivo.json> --dry-run
```

### Convenciones prácticas

- Mantén `batch.batchId` único por archivo (por fecha + consecutivo).
- Mantén un `notes` breve con lo que contiene el lote.
- Si corriges errores de redacción, crea un lote nuevo (no edites el histórico ya cargado).

