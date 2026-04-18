# Formato JSON del Banco de Preguntas

Este formato permite:

- Cargar lotes incrementales sin reemplazar datos (`importMode: append_only`).
- Separar preguntas por materia, grupo y momento de evaluacion.
- Definir plantillas de examen con cantidad configurable (por ejemplo 40-50).
- Soportar preguntas de seleccion unica, multiple, abiertas y puzzle.

## Reglas clave de segmentacion

- Cada pregunta declara `subjectId`, `groupIds` y `momentIds`.
- Una plantilla de examen (`examTemplates`) define un solo `subjectId`, `groupId` y `momentId`.
- Al construir un examen, solo se seleccionan preguntas que cumplan los 3 filtros al mismo tiempo.
- Esto evita mezclar, por ejemplo, preguntas de `m3` en `m1` o de `db_1` en `frontend_1`.

## Campos obligatorios por pregunta

- Base: `id`, `type`, `statement`, `subjectId`, `groupIds`, `momentIds`, `difficulty`, `points`, `status`.
- `single_choice` y `multiple_choice`: `options`.
- `open_concept`: `answerRules.maxWords`, `answerRules.keywords`, `answerRules.passThreshold`.
- Puzzle:
- `puzzle_order`: `puzzle.items`.
- `puzzle_match`: `puzzle.leftItems`, `puzzle.rightItems`, `puzzle.pairs`.
- `puzzle_cloze`: `puzzle.templateText`, `puzzle.slots`.

## Campos obligatorios por plantilla de examen

- `id`, `name`, `subjectId`, `groupId`, `momentId`.
- `questionCount` (ajustable).
- `timeLimitMinutes`.
- `allowedQuestionTypes`.
- `accessCode` (6 digitos generado o fijo).
- `resultPolicy` (mostrar nota, ocultar respuestas).
- `gradingScale` (`0_5`, `0_50` o `both`).
- `studentRequiredFields` (`fullName`, `documentId`, `email`).

## Archivos creados

- `docs/question-bank.schema.json`: contrato formal para validar JSON.
- `docs/question-bank.example.json`: ejemplo real de carga.
