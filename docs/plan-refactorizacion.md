# Plan Integral de Refactorización y Rediseño Visual — Z-Suite Academic Eval

Este documento establece la estrategia, prioridades y pasos técnicos para refactorizar la base de código y **modernizar visualmente (UI/UX)** la plataforma **Z-Suite Academic Eval**. 

El objetivo combina dos frentes simultáneos:
1. **Calidad de Código y Arquitectura**: Reducir deuda técnica, modularizar componentes gigantes ("God Components"), centralizar tipos y desacoplar la lógica de negocio y de acceso a datos de la capa de presentación.
2. **Rediseño Visual Premium (UI/UX)**: Elevar la interfaz a un estándar moderno de alto nivel (estilo plataformas SaaS contemporáneas como Linear, Vercel o Raycast), con un sistema de diseño consistente, microinteracciones, transiciones fluidas con Framer Motion y una experiencia de usuario clara e intuitiva tanto en escritorio como en móvil.

---

## 1. Estado Actual y Diagnóstico Técnico

### 1.1 Métricas de Complejidad y Tamaño
La base de código compila correctamente bajo TypeScript (`tsc --noEmit` exitoso), pero presenta una concentración extrema de responsabilidades en pocos archivos:

| Archivo | Líneas | Tamaño | Responsabilidades Actuales Mezcladas |
| :--- | :---: | :---: | :--- |
| `app/admin/workload/page.tsx` | ~3.960 | 173 KB | UI de carga horaria, calendario interactivo semanal, drag & drop, cálculos de nómina/horas CESDE/SENA, sincronización con Drive, exportación PDF/Excel. |
| `app/exam/page.tsx` | ~3.050 | 144 KB | Flujo completo de 5 pasos del estudiante (`code` -> `student` -> `rules` -> `exam` -> `result`), antifraude, timers, renderizado de tipos de preguntas, sincronización Firestore. |
| `app/admin/templates/exam-manager.tsx` | ~2.645 | 120 KB | Creación/edición de plantillas, asignación de preguntas, publicación de exámenes, vista previa. |
| `app/admin/bank/bank-dashboard.tsx` | ~2.255 | 102 KB | Dashboard del banco de preguntas, filtros avanzados, modales de edición, importación por lotes. |
| `app/admin/results/results-manager.tsx` | ~1.855 | 82 KB | Métricas de exámenes, listas de intentos, calificaciones, detalle por estudiante. |
| `app/admin/drive/drive-dashboard.tsx` | ~1.712 | 82 KB | Gestión de carpetas Google Drive, sincronización de workspaces, árbol jerárquico. |
| `app/admin/ui/dashboard-view.tsx` | ~1.753 | 75 KB | Dashboard administrativo principal, métricas globales, widgets de resumen. |
| `app/admin/settings/ai-docs/page.tsx` | ~1.317 | 57 KB | Generación asistida por IA de documentación académica, configuración de prompts. |
| `app/admin/groups/page.tsx` | ~1.271 | 55 KB | Administración de grupos, fichas y matrículas. |
| `app/admin/live/live-manager.tsx` | ~1.226 | 54 KB | Monitoreo en tiempo real de exámenes activos. |
| `app/admin/settings/catalogs.tsx` | ~1.282 | 52 KB | Catálogos institucionales (materias, sedes, jornadas, momentos). |
| `app/api/admin/ai-question-batch/route.ts` | ~943 | 41 KB | Algoritmos Jaccard de similitud, heurísticas NLP de reformulación, llamadas a Gemini, escritura en Firestore. |

### 1.2 Principales Puntos de Deuda Técnica
1. **Ausencia de un directorio centralizado de tipos (`types/`)**: Tipos como `CatalogItem`, `BankData`, `PublishedExam`, `SnapshotQuestion` y `WorkloadBlock` se declaran repetidamente en múltiples archivos con divergencias leves.
2. **Acoplamiento Directo UI ↔ Firestore**: Páginas completas ejecutan directamente `onSnapshot`, `getDocs`, `updateDoc` y `setDoc`, sin capas de servicio ni custom hooks que aíslen la persistencia.
3. **Controladores API saturados de lógica de dominio**: Rutas backend concentran validaciones, algoritmos de texto, llamadas a LLMs y transacciones de base de datos en un solo bloque.
4. **Estado excesivo y re-renders innecesarios**: Componentes con más de 25-30 variables de `useState` sin modularizar ni estructurar en reducers (`useReducer`) o contextos específicos.

### 1.3 Diagnóstico de Experiencia Visual y UI (Oportunidades de Mejora)
1. **Estilo visual básico en componentes clave**: Clases de Tailwind utilitarias repetidas en línea con sombras planas y bordes estándar, sin jerarquía de elevación moderna.
2. **Sobrecarga de información en vistas densas**: Tablas y formularios extensos que generan fatiga visual en pantallas de administración.
3. **Falta de feedback y microinteracciones**: Estados de carga basados en spinners básicos, transiciones abruptas al cambiar de pestañas o pasos de examen y falta de estados vacíos (empty states) atractivos.
4. **Experiencia del Estudiante (`/exam`) mejorable**: La interfaz de examen necesita un aspecto más limpio y libre de distracciones ("focus mode"), con tipografía optimizada para lectura prolongada y fragmentos de código.

---

## 2. Lineamientos del Rediseño Visual (Design System & UI/UX)

El rediseño visual se basará en los siguientes pilares estéticos y funcionales:

### 2.1 Sistema de Diseño y Tokens Visuales
* **Paleta de Colores Armoniosa**:
  * Fondos en capas sutiles (`bg-slate-50/50` / dark tokens elegantes).
  * Acentos de color semánticos refinados (violeta/índigo para navegación principal, esmeralda para aprobados/éxito, ámbar para advertencias de tiempo/antifraude, coral/rojo para alertas).
  * Distinción visual institucional de alto contraste:
    * **CESDE**: Acento visual y badges distintivos.
    * **SENA**: Acento visual propio y badges de ficha.
* **Tipografía y Legibilidad**:
  * Jerarquía clara con tipografías sans-serif modernas (`Inter` o `Geist`).
  * Estilizado de bloques de código en preguntas con resaltado de sintaxis consistente y contraste optimizado.
* **Profundidad y Elevación**:
  * Tarjetas con bordes ultra-delgados sutiles (`border-slate-200/80` o `border-white/10`) y sombras ambientales difusas en lugar de sombras pesadas.
  * Efectos sutiles de glassmorphism (`backdrop-blur-md`) en barras de navegación, headers fijos y modales.
* **Microinteracciones y Animación**:
  * Uso de `framer-motion` (ya incluido en el proyecto) para transiciones de pantalla, modales flotantes, acordeones y tabs.
  * Skeletons animados con shimmer para cargas de datos en lugar de bloqueos con spinners simples.

### 2.2 Componentes UI Reutilizables (UI Kit)
Construir una biblioteca modular en `components/ui/`:
* `Button`: Variantes `primary`, `secondary`, `outline`, `ghost`, `danger`, con estados de loading animados integrados.
* `Card`: Contenedor estándar con header, body, footer y soporte para estados interactivos (hover lift).
* `Modal` / `Drawer`: Shell animado con backdrop desenfocado, cierre con `Esc` y animación de entrada/salida fluida.
* `Badge`: Indicadores de estado con estilo píldora (`active`, `pending`, `danger`, `cesde`, `sena`).
* `Input` & `Select`: Campos de formulario con focus rings suaves y validación visual de errores integrada.
* `EmptyState`: Componente para estados sin datos con iconos temáticos y llamadas a la acción claras.
* `StatCard`: Tarjetas de KPI para dashboards con indicador de tendencia, icono contextual y sparkline.

---

## 3. Arquitectura Objetivo

```
z-suite-academic-evl/
├── types/                           # [FASE 1] Tipos de dominio centralizados
│   ├── catalog.ts
│   ├── exam.ts
│   ├── bank.ts
│   ├── workload.ts
│   └── drive.ts
├── components/                      # [FASE 2] Sistema de Diseño y UI Kit
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       ├── modal.tsx
│       ├── badge.tsx
│       ├── input.tsx
│       ├── stat-card.tsx
│       ├── empty-state.tsx
│       └── skeleton.tsx
├── lib/
│   ├── ai/                          # [FASE 3] Servicios modulares de IA
│   │   ├── gemini-client.ts
│   │   ├── question-similarity.ts
│   │   └── question-rephraser.ts
│   ├── hooks/                       # [FASE 5] Custom hooks reutilizables
│   │   ├── use-exam-session.ts
│   │   ├── use-workload-realtime.ts
│   │   └── use-catalog-data.ts
│   ├── services/                    # [FASE 5] Acceso desacoplado a Firestore / Drive
│   │   ├── exam-service.ts
│   │   ├── bank-service.ts
│   │   └── workload-service.ts
│   └── exam-grading.ts              # Reglas puras de calificación
├── app/
│   ├── exam/                        # [FASE 4] Descomposición y Rediseño del Examen
│   │   ├── components/
│   │   │   ├── otp-input.tsx
│   │   │   ├── step-access-code.tsx
│   │   │   ├── step-student-info.tsx
│   │   │   ├── step-exam-rules.tsx
│   │   │   ├── step-active-exam.tsx
│   │   │   └── step-exam-result.tsx
│   │   └── page.tsx                 # Orquestador liviano (< 200 líneas)
│   ├── admin/
│   │   ├── ui/                      # Rediseño del Shell Admin y Navegación
│   │   │   ├── admin-shell.tsx
│   │   │   ├── admin-sidebar.tsx
│   │   │   └── dashboard-view.tsx
│   │   ├── workload/                # [FASE 4] Descomposición y Rediseño Calendario
│   │   │   ├── components/
│   │   │   │   ├── workload-calendar.tsx
│   │   │   │   ├── workload-list.tsx
│   │   │   │   └── workload-form-modal.tsx
│   │   │   └── page.tsx
│   │   └── ...
```

---

## 4. Hoja de Ruta por Fases (Código + Visual)

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Ruta de Ejecución por Fases                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
[Fase 1: Tipos Centralizados]                     [Fase 2: Design System & UI Kit]
- types/catalog.ts, exam.ts, etc.                 - Button, Card, Modal, Badge, etc.
- Base tipada sólida y consistente                - Tokens visuales en globals.css
    │                                                               │
    └───────────────────────────────┬───────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
[Fase 3: Backend & Servicios IA]                  [Fase 4: Rediseño & Modularización]
- Modularizar ai-question-batch                   - Rediseñar y dividir app/exam
- Servicios puros en lib/ai/                      - Rediseñar y dividir workload
                                                  - Modernizar Shell y Dashboard
                                    │
                                    ▼
                     [Fase 5: Hooks, Servicios & Tests]
                     - useExamSession, useWorkload
                     - Tests de grading y horas CESDE/SENA
```

### Fase 1: Centralización del Modelo de Dominio y Tipos `[✅ COMPLETADA]`
* **Objetivo**: Establecer una única fuente de verdad para los tipos de datos de la plataforma antes de tocar vistas.
* **Resultados implementados**:
  1. Directorio `types/` creado y estructurado con tipado estricto:
     - [types/catalog.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/types/catalog.ts): `CatalogItem`, `CatalogRow`, `FichaRow`, `InstitutionType`, `CesdeGroupType`, etc.
     - [types/bank.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/types/bank.ts): `QuestionOption`, `AnswerRules`, `BankDashboardStats`, `QuestionTableRow`, `EditQuestion`.
     - [types/exam.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/types/exam.ts): `PublishedExam`, `SnapshotQuestion`, `ExamTemplateRow`, `ResultRow`, `ExamStep`.
     - [types/workload.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/types/workload.ts): `TeachingLoadRow`, `TeachingLoadForm`, `PayrollStatementItem`, `PayrollStatementRow`, `CalendarEventItem`.
     - [types/drive.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/types/drive.ts): `DriveWorkspaceRow`, `DriveNodeRow`.
     - [types/index.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/types/index.ts): Barrel export para importación global vía `@/types`.
  2. Migración de declaraciones redundantes completada en:
     - [app/admin/settings/catalogs.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/admin/settings/catalogs.tsx)
     - [app/admin/groups/page.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/admin/groups/page.tsx)
     - [app/exam/page.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/exam/page.tsx)
     - [app/admin/templates/exam-manager.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/admin/templates/exam-manager.tsx)
     - [app/admin/bank/bank-dashboard.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/admin/bank/bank-dashboard.tsx)
     - [app/admin/results/results-manager.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/admin/results/results-manager.tsx)
     - [app/admin/drive/drive-dashboard.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/admin/drive/drive-dashboard.tsx)
     - [app/admin/workload/page.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/admin/workload/page.tsx)
  3. Verificación: `npx tsc --noEmit` completado exitosamente sin ningún error.

---

### Fase 2: Construcción del Design System y Biblioteca UI (`components/ui/`)
* **Objetivo**: Construir los bloques visuales reutilizables que sustentarán el cambio estético de toda la app.
* **Acciones**:
  1. Refinar variables de diseño y tokens en `app/globals.css` (sombras suaves, radios de borde consistentes, gradientes discretos).
  2. Implementar componentes atómicos con TypeScript estricto y Tailwind:
     - `button.tsx`: Con variantes estilizadas y soporte para animaciones de carga.
     - `card.tsx`: Con estructura limpia (`CardHeader`, `CardTitle`, `CardContent`, `CardFooter`).
     - `badge.tsx`: Con estilos para estados (activo, cerrado, pendiente) y marcas (CESDE / SENA).
     - `modal.tsx`: Con animación fluida vía `framer-motion` y scroll interno bloqueado.
     - `stat-card.tsx`: Para métricas del dashboard con soporte de iconos e indicadores.
     - `empty-state.tsx`: Para listas o tablas sin resultados.
* **Criterio de éxito**: Catálogo de componentes listo para consumo sin depender de clases ad-hoc repetidas.

---

### Fase 3: Modularización del Backend y Servicios de IA
* **Objetivo**: Extraer la lógica algorítmica y de integración de LLMs de los endpoints API.
* **Acciones**:
  1. Refactorizar `app/api/admin/ai-question-batch/route.ts` (943 líneas):
     - Mover la lógica de tokens y similitud Jaccard a `lib/ai/question-similarity.ts`.
     - Mover las heurísticas de variación gramatical a `lib/ai/question-rephraser.ts`.
     - Centralizar llamadas al SDK de Gemini, reintentos de modelos `flash`/`pro` y parsing estructurado en `lib/ai/gemini-client.ts`.
  2. Dejar la ruta como un controlador HTTP ligero de validación y respuesta (< 150 líneas).
  3. Replicar el patrón para `app/api/admin/ai-readme/route.ts` y las rutas de Drive.
* **Criterio de éxito**: Endpoints con responsabilidad única de orquestación HTTP y código de dominio testeable independientemente.

---

### Fase 4: Descomposición Modular y Rediseño Visual de Vistas Clave

#### 4.1 Módulo del Estudiante: `app/exam/page.tsx` (3.046 líneas)
* **Objetivo**: Modularizar y transformar el examen en una experiencia moderna, limpia y libre de distracciones.
* **Transformación Visual**:
  - **Focus Mode**: Fondo oscuro o gris neutro atenuado, eliminando menús o distracciones exteriores.
  - **Header de Examen**: Barra de progreso animada en tiempo real y reloj temporizador estilizado con alerta cromática suave en los últimos 5 minutos.
  - **Visualizador de Preguntas**: Renderizado tipográfico impecable de enunciados Markdown, bloques de código estilizados y opciones interactivas con estados de hover y selección claros.
  - **Resultados**: Pantalla final tipo scorecard con resumen de nota, gráfico de aciertos/fallos y desglose ordenado.
* **Modularización de Código**:
  - Extraer en `app/exam/components/`: `otp-input.tsx`, `step-access-code.tsx`, `step-student-info.tsx`, `step-exam-rules.tsx`, `step-active-exam.tsx`, `step-exam-result.tsx`.
  - Extraer `useExamSession.ts` para aislar la máquina de estados, timers y antifraude.

#### 4.2 Módulo de Carga Horaria: `app/admin/workload/page.tsx` (3.963 líneas)
* **Objetivo**: Modularizar y convertir el calendario en una herramienta visual ágil similar a Notion Calendar.
* **Transformación Visual**:
  - **Calendario Semanal**: Cuadrícula limpia con líneas sutiles, bloques horarios diferenciados con colores suaves según institución (CESDE vs SENA), etiquetas de aula y grupo legibles.
  - **Drag & Drop**: Feedback visual al arrastrar bloques (resaltado de celda objetivo y animación al soltar).
  - **Modal de Creación/Edición**: Formulario dividido en secciones claras con badges visuales para selección rápida de sedes y jornadas.
  - **Mobile Responsive**: Lista de tarjetas compactas con filtros rápidos por día de la semana.
* **Modularización de Código**:
  - Extraer `workload-calendar.tsx`, `workload-list.tsx`, `workload-form-modal.tsx`.
  - Consolidar cálculos horarios en helpers puros reutilizables.

#### 4.3 Shell Administrativo y Dashboard (`app/admin`)
* **Transformación Visual**:
  - **Sidebar**: Barra lateral refinada con iconos limpios, indicador de ruta activa elegante y botón para colapsar suavemente.
  - **Dashboard**: Rediseño de las KPI cards con gradientes sutiles, gráficos de Recharts con tooltips personalizados y feed de "Hoy en agenda" moderno.
* **Modularización de Código**:
  - Descomponer `admin-shell.tsx` y `dashboard-view.tsx` (1.753 líneas) en widgets de métricas independientes.

#### 4.4 Módulo de Plantillas y Banco de Preguntas
* **Transformación Visual**:
  - Filtros avanzados estilo "pills" interactivos.
  - Vista previa de preguntas con drawer lateral animado en lugar de modales intrusivos.
* **Modularización de Código**:
  - Descomponer `exam-manager.tsx` (2.645 líneas) y `bank-dashboard.tsx` (2.255 líneas).

---

### Fase 5: Capa de Servicios, Hooks y Pruebas Unitarias
* **Objetivo**: Completar el desacoplamiento de Firestore y blindar la aplicación contra regresiones.
* **Acciones**:
  1. Crear hooks reactivos: `usePublishedExams()`, `useBankQuestions()`, `useWorkloadData()`.
  2. Centralizar escrituras transaccionales en funciones de servicio (`lib/services/`).
  3. Configurar tests automáticos para las reglas más sensibles:
     - Cálculo de horas académicas (CESDE 45 min vs SENA 60 min).
     - Algoritmo de calificación y antifraude en `lib/exam-grading.ts`.
     - Deduplicación y similitud de preguntas con IA.

---

## 5. Guía de Ejecución y Reglas de Seguridad

* **Principio de No Regresión Funcional**: Ningún cambio visual ni de arquitectura debe alterar las reglas de negocio existentes ni romper integraciones con Firebase o Google Apps Script.
* **Validación Continua de Tipos**: Ejecutar `npx tsc --noEmit` en cada paso para asegurar integridad total del tipado.
* **Compatibilidad Móvil Obligatoria**: Todo componente rediseñado debe respetar la regla existente de la app: no usar tablas comprimidas en pantallas pequeñas, sino alternar a vistas tipo tarjeta o lista optimizada.
* **Flujo Git**: Realizar ramas atómicas por fase (ej. `refactor/phase-1-types`, `feat/phase-2-ui-kit`, `refactor/phase-3-exam-redesign`).
