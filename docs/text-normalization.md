# Estandarizacion de texto

Todo texto que se guarda en Firestore se normaliza para mantener consistencia visual y evitar registros raros:

- Se eliminan espacios al inicio y al final.
- Se colapsan espacios multiples a uno solo.
- Se validan caracteres permitidos (incluye tildes y caracteres especiales comunes).
- Se guarda en formato tipo oracion: primera letra en mayuscula, resto en minuscula (con reglas para tokens como `M1` o `10A`).

## Funciones

Archivo: `lib/text/normalize.ts`

- `normalizeSentenceText(texto)`: valida y normaliza textos de catalogos/examenes.
- `normalizePersonNamePart(texto)`: valida y normaliza nombre o apellido con inicial en mayuscula.
- `normalizeFullName(nombre, apellido)`: combina nombre + apellido normalizados.

## Uso actual

- Catalogos (sedes, jornadas, momentos, grupos): al crear y al guardar cambios.
- Examenes: al crear/editar examenes, y al crear sedes/jornadas desde el modal.
