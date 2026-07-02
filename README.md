# Z-Suite Academic Eval

Panel académico para gestión de banco de preguntas, exámenes, documentación, Drive académico y carga horaria por institución.

## Resumen

Este proyecto centraliza la operación académica y administrativa de dos contextos institucionales:

- CESDE
- SENA

La aplicación permite:

- administrar catálogos base como materias, grupos, fichas, sedes, jornadas y momentos;
- construir y publicar exámenes desde plantillas;
- gestionar banco de preguntas;
- generar y compartir documentación académica;
- crear y consultar estructuras de carpetas en Google Drive vía Google Apps Script;
- registrar carga horaria con vista de listado y calendario semanal;
- visualizar métricas reales en el dashboard administrativo.

## Stack

- Next.js 16.2.4
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4
- Firebase Auth
- Cloud Firestore
- Firebase Admin SDK
- Google Apps Script para operaciones de Drive

## Módulos Principales

### Dashboard

- Muestra métricas reales de banco, grupos, fichas, sedes, jornadas, carga horaria, horas académicas y workspaces de Drive.
- En móvil convierte tablas densas a cards cuando aplica.

### Banco

- Gestiona preguntas y lotes de importación.
- Se apoya en el formato documentado en `docs/question-bank-format.md`.

### Exámenes

- Administra plantillas de examen y publicación.
- En responsive fuerza vista por cards en lugar de tabla.

### Documentación

- Centraliza publicaciones por materia.
- Conserva tabla en desktop y cards en móvil.

### Drive

- Ya no depende del flujo visual principal de OAuth de Google para operar carpetas.
- Usa endpoints internos `/api/admin/drive/...` que delegan en Google Apps Script.
- Las acciones principales son:
  - crear estructura;
  - consultar/sincronizar estructura;
  - quitar del panel.

### Carga horaria

- Registra franjas por institución, sede, jornada, grupo o ficha, aula, fechas y horas.
- Calcula horas académicas con regla diferenciada:
  - CESDE: 45 minutos por hora académica;
  - SENA: 60 minutos por hora.
- Incluye vista calendario semanal y vista de registros.
- En móvil oculta el calendario y usa solo listado/cards.
- Al guardar una carga, crea o vincula automáticamente su workspace de Drive.

### Catálogos

- Administra materias, grupos, fichas, sedes, jornadas, momentos y trimestres.
- Los IDs internos quedaron ocultos en los catálogos generales.
- `Fichas` conserva el número visible porque es un dato funcional.

## Estado Actual

### Autenticación

- El acceso operativo actual del panel es por correo y contraseña.
- La autenticación con Google permanece oculta en la UI del login admin.
- La autorización administrativa depende de que el `uid` autenticado exista en la colección `admins`.

### Drive

- La integración principal de Drive usa Google Apps Script.
- El backend requiere credenciales válidas de Firebase Admin para validar admins antes de operar.
- Si `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` está mal formateada o inválida, pueden fallar rutas admin con errores `UNAUTHENTICATED`.

### Responsive

- Las vistas densas del admin usan fallback a cards o listados en móvil.
- El calendario de `Carga horaria` solo se muestra en desktop.
- No se deben mantener tablas comprimidas ni grids complejos en celular.

### UX

- No se deben usar `alert`, `confirm` ni `prompt` del navegador.
- El proyecto usa feedback propio con toasts y confirmaciones internas.

## Arquitectura Funcional

### Flujo de autenticación

1. El usuario inicia sesión con Firebase Auth.
2. La app valida el estado autenticado.
3. Luego verifica que el usuario exista en `admins/{uid}`.
4. Solo entonces habilita el panel administrativo.

### Flujo de carga horaria y Drive

1. Se registra una carga en `teachingLoads`.
2. Se calcula el período académico a partir de la fecha de inicio:
   - `01`: enero a junio;
   - `02`: julio a diciembre.
3. El frontend llama a `/api/admin/drive/bootstrap`.
4. El backend valida admin con Firebase Admin.
5. El backend llama al Google Apps Script configurado.
6. Se almacena el estado del workspace vinculado a la carga.

### Flujo de documentación y banco

- La generación de preguntas debe partir del README/documentación como fuente de verdad.
- El banco y los exámenes consumen datos persistidos en Firestore, no artefactos temporales de UI.

## Colecciones Principales de Firestore

- `admins`
- `subjects`
- `groups`
- `fichas`
- `sites`
- `shifts`
- `moments`
- `trimesters`
- `questions`
- `examTemplates`
- `publishedExams`
- `studyDocs`
- `teachingLoads`
- `driveWorkspaces`

## Variables de Entorno Críticas

Crea un archivo `.env.local` con las variables necesarias.

### Firebase cliente

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Firebase Admin

```env
FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON=
```

Importante:

- Debe contener el JSON completo en una sola línea.
- La aplicación hace `JSON.parse(...)` directo sobre esa variable.
- Si se pega multilinea, el backend admin falla.

### Drive por Apps Script

```env
GOOGLE_APPS_SCRIPT_DRIVE_URL=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
```

## Scripts Disponibles

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run seed:firestore
```

Notas:

- `npm run dev` usa `next dev --webpack`.
- `npm run build` usa `next build --webpack`.
- Se adoptó Webpack para evitar problemas observados con Turbopack en rutas API del proyecto.

## Desarrollo Local

1. Instala dependencias:

```bash
npm install
```

2. Configura `.env.local` con Firebase y Drive.

3. Inicia el entorno:

```bash
npm run dev
```

4. Abre:

```txt
http://localhost:3000
```

## Convenciones Importantes

- Todo input que persista datos de formularios debe normalizarse a mayúsculas antes de guardar cuando aplique al flujo de negocio.
- Las vistas administrativas deben priorizar layouts compactos, limpios y sin scroll vertical interno en contenedores principales.
- El scroll vertical debe ser de la página completa, especialmente en `Carga horaria`.
- En móvil, usar cards/listados en lugar de tablas complejas.
- En catálogos generales, los IDs internos son transparentes para el usuario y no deben mostrarse en tabla.

## Estructura Relevante del Proyecto

```txt
app/
  admin/
    bank/
    documentation/
    drive/
    groups/
    live/
    results/
    settings/
    templates/
    ui/
    workload/
  api/
    admin/
      docs/
      drive/
lib/
  firebase/
  google/
docs/
question-batches/
```

## Archivos Clave

- `app/admin/workload/page.tsx`: módulo de carga horaria, listado y calendario.
- `app/admin/drive/drive-dashboard.tsx`: panel de estructuras Drive.
- `app/admin/templates/exam-manager.tsx`: gestión de plantillas de examen.
- `app/admin/ui/dashboard-view.tsx`: dashboard con métricas reales.
- `app/admin/settings/catalogs.tsx`: catálogos base.
- `lib/firebase/client.ts`: inicialización Firebase cliente.
- `lib/firebase/admin.ts`: inicialización Firebase Admin.
- `lib/google/apps-script-drive.ts`: cliente para Google Apps Script.

## Documentación Interna Relacionada

- `docs/question-bank-format.md`
- `docs/firestore-bootstrap.md`
- `docs/text-normalization.md`
- `question-batches/README.md`

## Pendientes Conocidos

- El login con Google no está retirado a nivel técnico, pero sí oculto en la interfaz.
- La estabilidad de los endpoints admin en Vercel depende de que `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` esté correctamente configurada.
- Queda espacio para seguir unificando feedback global en algunos módulos secundarios.

## Cierre

Este README documenta el estado operativo actual del proyecto para retomarlo más adelante sin depender del contexto conversacional.
