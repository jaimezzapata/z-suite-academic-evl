# Mejoras de la Aplicacion

Este documento recopila mejoras recomendadas sobre funcionalidades ya existentes. No plantea nuevos modulos, sino refinamientos para hacer la aplicacion mas robusta, clara y mantenible.

## Prioridad Alta

### 1. Manejo de errores y estados

- Unificar mensajes de error entre UI, backend y Apps Script.
- Mostrar con mas precision si un fallo vino de Drive, Firestore, validacion, permisos o configuracion.
- Mejorar los estados de carga en acciones criticas: crear, editar, validar, sincronizar, exportar y eliminar.
- Evitar estados ambiguos donde la UI parezca completada pero el proceso siga corriendo.

### 2. Consistencia entre UI, Firestore y Drive

- Asegurar que toda accion importante refleje claramente su estado en las tres capas.
- Mejorar la trazabilidad de sincronizacion de estructuras en Drive.
- Mostrar fecha de ultima validacion o sincronizacion cuando aplique.
- Hacer mas claros los mensajes cuando una accion se completa en Firestore pero falla en Drive, o viceversa.

### 3. Validaciones preventivas

- Mostrar errores de formulario antes de enviar al backend.
- Validar mejor fechas, dias, horas y duplicados antes de ejecutar procesos.
- Reforzar confirmaciones de acciones destructivas con mensajes mas explicitos.

### 4. Robustez de reglas de negocio criticas

- Reforzar pruebas y revisiones para:
- SENA con 1 o 2 dias.
- Dias con horarios distintos.
- CESDE regular.
- CESDE empresarial.
- Nomina por quincena.
- Sincronizacion de estructura Drive.

## Prioridad Media

### 5. Pulido del calendario

- Mejorar el feedback visual al mover bloques con drag and drop.
- Resaltar mejor la celda destino antes de soltar.
- Mostrar con mas claridad cuando un bloque se superpone con otro.
- Afinar la lectura de bloques pequenos o muy largos.
- Mantener una leyenda visual mas consistente por institucion o tipo de carga.

### 6. Exportaciones y reportes

- Hacer mas consistente la informacion entre pantalla, PDF y CSV.
- Mejorar los encabezados y jerarquia visual de los reportes.
- Incluir nombres de archivo mas utiles segun periodo, semana o institucion.
- Hacer que los PDF se parezcan aun mas a la visualizacion real del calendario cuando aplique.

### 7. Dashboard

- Mejorar la jerarquia visual para que la informacion mas importante resalte primero.
- Hacer mas limpia y legible la seccion "Hoy en agenda".
- Mantener consistencia total entre metricas del dashboard y sesiones reales del horario.
- Reducir ruido visual en tarjetas y paneles densos.

### 8. Persistencia de contexto

- Recordar mejor la vista actual del usuario.
- Mantener filtros, pestañas y semana activa al navegar o recargar.
- Evitar que el usuario tenga que reubicarse manualmente despues de acciones comunes.

## Prioridad Tecnica

### 9. Refactor de logica compartida

- Seguir centralizando reglas de negocio en helpers reutilizables.
- Reducir duplicacion entre Drive, Carga horaria, Dashboard y Reportes.
- Separar mejor calculos complejos de los componentes visuales.
- Fortalecer tipado para reducir casos ambiguos provenientes de Firestore.

### 10. Componentes grandes

- Dividir archivos muy largos en componentes o utilidades pequenas.
- Mejorar legibilidad de archivos con muchas responsabilidades.
- Hacer mas simple mantener y depurar vistas complejas.

### 11. Observabilidad y depuracion

- Mejorar logs en backend para errores reales de integracion.
- Registrar mejor errores de Apps Script y operaciones con Drive.
- Preparar una base de monitoreo para produccion si la app sigue creciendo.

## Calidad y estabilidad

### 12. Pruebas de regresion

- Crear una checklist corta de pruebas manuales para cada despliegue.
- Cubrir con pruebas dirigidas las reglas mas delicadas del sistema.
- Verificar de forma recurrente los flujos:
- Crear estructura desde Drive.
- Crear carga horaria.
- Ver calendario.
- Exportar PDF o CSV.
- Eliminar y enviar a papelera.
- Crear estructuras empresariales.

### 13. Seguridad y operacion

- Revisar que solo los roles admin puedan ejecutar acciones destructivas.
- Confirmar que variables de entorno y credenciales no tengan permisos innecesarios.
- Mejorar el comportamiento ante timeouts, respuestas incompletas o caidas parciales de servicios externos.

## Recomendacion de orden

Orden sugerido para futuras iteraciones:

1. Manejo de errores y estados.
2. Consistencia entre UI, Firestore y Drive.
3. Validaciones preventivas.
4. Pulido del calendario y reportes.
5. Refactor de logica compartida.
6. Pruebas de regresion y observabilidad.

## Nota final

La aplicacion ya tiene una base funcional bastante completa. Las mejoras recomendadas apuntan a hacerla mas estable, mas clara para el usuario y mas facil de mantener, sin cambiar su alcance funcional actual.
