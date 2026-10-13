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

### Fase 2: Construcción del Design System y Biblioteca UI (`components/ui/`) `[✅ COMPLETADA]`
* **Objetivo**: Construir los bloques visuales reutilizables que sustentarán el cambio estético de toda la app.
* **Resultados implementados**:
  1. Tokens semánticos e institucionales expandidos en [app/globals.css](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/globals.css) (soporte para `--cesde`, `--sena`, `--success`, `--warning`).
  2. Biblioteca modular de componentes atómicos creada en `components/ui/`:
     - [components/ui/button.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/components/ui/button.tsx): Variantes (`primary`, `secondary`, `outline`, `ghost`, `danger`, `danger-soft`, `success`, `cesde`, `sena`), tamaños y estados de loading con spinner.
     - [components/ui/badge.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/components/ui/badge.tsx): Píldoras con variantes de estado e indicadores de punto (`dot`).
     - [components/ui/card.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/components/ui/card.tsx): `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` con soporte para elevación hover.
     - [components/ui/input.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/components/ui/input.tsx): Entradas y `Textarea` estilizadas con validación de error, iconos y focus rings modernos.
     - [components/ui/select.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/components/ui/select.tsx): Select con soporte de label, error, helperText y chevron moderno.
     - [components/ui/modal.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/components/ui/modal.tsx): Shell modal animado con `framer-motion`, backdrop blur y atajo `Esc`.
     - [components/ui/stat-card.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/components/ui/stat-card.tsx): Tarjetas de KPI para dashboards con soporte de tendencias y colores temáticos.
     - [components/ui/empty-state.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/components/ui/empty-state.tsx): Componente para listas vacías con icono e ilustración.
     - [components/ui/skeleton.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/components/ui/skeleton.tsx): Skeletons con variantes (rectangular, circular, rounded, text) y preset de tarjeta.
     - [components/ui/alert.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/components/ui/alert.tsx): Callouts semánticos de alerta (info, success, warning, danger) con iconos y acción de cierre.
     - [components/ui/tabs.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/components/ui/tabs.tsx): Sistema de navegación por pestañas con indicador animado vía `framer-motion` (`layoutId`).
     - [components/ui/table.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/components/ui/table.tsx): Primitivas de tabla (`Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`) con estilos sutiles y hover.
     - [components/ui/index.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/components/ui/index.ts): Barrel export unificado para consumo directo desde `@/components/ui`.
  3. Adopción en [app/admin/ui/admin-shell.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/admin/ui/admin-shell.tsx) para botones y layout administrativo.
  4. Verificación: `npx tsc --noEmit` completado exitosamente sin errores.

---

### Enfoque Arquitectónico: Modularización por Características (Feature-Driven Architecture)
Para evitar que el código vuelva a crecer de forma desordenada en capas monolíticas, las siguientes fases adoptan la **organización por características/módulos funcionales**:
* Cada módulo funcional encapsula sus propios subcomponentes de negocio, lógica y hooks:
  - **Módulo de Examen (`app/exam/components/` & `use-exam-session`)**: Flujo completo del estudiante.
  - **Módulo de Carga Horaria (`app/admin/workload/components/`)**: Calendario semanal, formulario modal de franjas y lista responsive.
  - **Módulo de Banco de Preguntas (`app/admin/bank/components/`)**: Tabla con filtros, editor y vista previa.
  - **Módulo de Workspaces Drive (`app/admin/drive/components/`)**: Árbol de carpetas y estado de sincronización.
* Los componentes visuales genéricos residen en `@/components/ui`.

---

### Fase 3: Modularización del Backend y Servicios de IA `[✅ COMPLETADO]`
* **Objetivo**: Extraer la lógica algorítmica y de integración de LLMs de los endpoints API.
* **Resultados implementados**:
  1. Descomposición de [app/api/admin/ai-question-batch/route.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/api/admin/ai-question-batch/route.ts): de **943 líneas a 289 líneas** (~70% de reducción).
  2. Subarquitectura creada en `lib/ai/`:
     - [lib/ai/types.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/lib/ai/types.ts): Variantes de modelo Gemini (`flash` / `pro`) y metadatos de batch.
     - [lib/ai/question-similarity.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/lib/ai/question-similarity.ts): Tokenizador bi-gram, stop words, similitud Jaccard (`getStatementJaccardSimilarity`), detección de duplicados e índice de grounding con el texto de estudio.
     - [lib/ai/question-rephraser.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/lib/ai/question-rephraser.ts): Heurísticas de reformulación gramatical didáctica en otros términos, rotación de opciones y normalización para los 6 tipos de preguntas (`single_choice`, `multiple_choice`, `open_concept`, `puzzle_order`, `puzzle_match`, `puzzle_cloze`).
     - [lib/ai/gemini-client.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/lib/ai/gemini-client.ts): Integración REST con Gemini, fallback automático de cuota (Pro ➔ Flash), autodescubrimiento dinámico de modelos de generación y extracción robusta de JSON.
  3. Verificación: `npx tsc --noEmit` completado exitosamente con 0 errores.

---

### Fase 4: Descomposición Modular y Rediseño Visual de Vistas Clave

#### 4.1 Módulo del Estudiante: `app/exam/` `[✅ COMPLETADO]`
* **Objetivo**: Modularizar y transformar el examen en una experiencia moderna, limpia, mantenible y desacoplada.
* **Resultados implementados**:
  - Reducción masiva del archivo central [app/exam/page.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/exam/page.tsx): de **3.046 líneas a 165 líneas** (~95% de reducción).
  - **Hooks especializados** en `app/exam/hooks/`:
    - [use-exam-session.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/exam/hooks/use-exam-session.ts): Orquestador reactivo de sesión que compone los hooks y servicios especializados.
    - [use-exam-fraud.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/exam/hooks/use-exam-fraud.ts): Detección activa antifraude (pestañas, clipboard, blur, atajos).
    - [use-results-review-guard.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/exam/hooks/use-results-review-guard.ts): Cuenta regresiva de 2 minutos y guardia anticopia/DevTools en resultados.
    - [use-exam-realtime.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/exam/hooks/use-exam-realtime.ts): Listeners en tiempo real con Firestore para `publishedExams` e `attempts`.
  - **Servicios de persistencia y API** en `app/exam/services/`:
    - [exam-api.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/exam/services/exam-api.ts): Cliente tipado para `access`, `start` y `submit`.
    - [exam-storage.ts](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/exam/services/exam-storage.ts): Gestión segura de autoguardado y reanudación en `localStorage`.
  - **Componentes modulares de interfaz** en `app/exam/components/`:
    - [otp-input.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/exam/components/otp-input.tsx): Entrada numérica segmentada con autofoco.
    - [step-access-code.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/exam/components/step-access-code.tsx): Validación del código de acceso.
    - [step-student-info.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/exam/components/step-student-info.tsx): Formulario guiado de registro.
    - [step-exam-rules.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/exam/components/step-exam-rules.tsx): Reglas y consentimiento.
    - [step-active-exam.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/exam/components/step-active-exam.tsx): Interfaz completa de resolución del examen.
    - [step-exam-result.tsx](file:///c:/Users/Jaime%20Zapata/Documents/PROYECTOS/z-suite-academic-evl/app/exam/components/step-exam-result.tsx): Scorecard final protegido.
  - Verificación: `npx tsc --noEmit` completado exitosamente sin errores.

#### 4.2 Módulo de Carga Horaria: `app/admin/workload/` `[✅ COMPLETADO]`
* **Objetivo**: Modularizar y convertir el calendario y la gestión docente en una suite ágil, moderna y totalmente desacoplada.
* **Transformación Visual**:
  - **Calendario Semanal**: Cuadrícula de 6:00 am a 9:30 pm en slots de 30 min con soporte para festivos colombianos, marcas de agua tecnológicas de cada materia y arrastrar y soltar fluido.
  - **Drag & Drop**: Reubicación en tiempo real de franjas horarias con feedback visual sobre el slot de destino y actualización transaccional en Firestore.
  - **Modal de Creación/Edición**: Formulario segmentado en 3 secciones (Base académica, Ubicación operativa y Agenda de carga) con resumen dinámico en tiempo real de horas académicas y jornadas semanales.
  - **Vista Nómina**: Liquidador quincenal con navegación por cortes, cálculo de horas programadas vs salario fijo SENA, desglose por asignatura e historial de colillas guardadas.
  - **Vista Lista Responsiva**: Tarjetas con badges temáticos de tecnología, institución, sede, salón y enlace a la carpeta Drive.
* **Modularización de Código**:
  - `app/admin/workload/page.tsx` reducido de **3.834 líneas a 211 líneas** (~94.5% de reducción).
  - Subarquitectura modular en `app/admin/workload/`:
    - `types.ts`: Tipos del módulo (vistas, resumen de nómina, reportes y eventos de calendario).
    - `services/workload-date-utils.ts`: Cálculo de franjas, horas académicas CESDE (45 min) vs SENA (60 min), quincenas y festivos.
    - `services/workload-service.ts`: Consultas de catálogos, sincronización Drive API y operaciones CRUD.
    - `services/workload-export-service.ts`: Motores de exportación aislados con `jspdf` y `jspdf-autotable` para PDF de calendario, CSV/PDF de horario general y PDF de colilla.
    - `hooks/use-workload-calendar.ts`: Hook reactivo especializado en calendario semanal, días, festivos y drag & drop.
    - `hooks/use-workload-payroll.ts`: Hook reactivo especializado en simulación quincenal, tarifas, histórico de colillas y cálculo de liquidación.
    - `hooks/use-workload-form.ts`: Hook reactivo especializado en modal de formulario, validación de franjas y aprovisionamiento automático de Drive.
    - `hooks/use-workload-data.ts`: Orquestador principal aligerado de 1.917 a 668 líneas.
    - `components/workload-header.tsx`: Cabecera con KPIs, alertas, tabs institucionales y toggle de vistas.
    - `components/workload-calendar-view.tsx`: Vista de cuadrícula semanal con drag & drop.
    - `components/workload-list-view.tsx`: Vista de listado en tarjetas optimizadas.
    - `components/workload-payroll-view.tsx`: Vista de liquidación y simulación de nómina.
    - `components/workload-payroll-modal.tsx`: Modal detallado de colilla guardada con tabla y descarga PDF.
    - `components/workload-form-modal.tsx`: Modal guiado para creación y edición de cargas.
    - `components/workload-filters-modal.tsx`: Modal de filtros con componentes del Design System.
  - Verificación: `npx tsc --noEmit` completado exitosamente con 0 errores.

#### 4.3 Shell Administrativo y Dashboard (`app/admin`) `[✅ COMPLETADO]`
* **Transformación Visual**:
  - **Sidebar**: Barra lateral refinada con iconos limpios, indicador de ruta activa elegante y botón para colapsar suavemente.
  - **Dashboard**: Rediseño integral con `Card`, `Badge`, `StatCard`, `Table` y `EmptyState` del Design System. Tarjetas KPI de alto contraste con iconos temáticos, gráficos Recharts responsivos, tabla/tarjetas de actividad reciente y agenda de hoy ("Hoy en agenda") con soporte de festivos y cálculo de clases en curso.
* **Modularización de Código**:
  - `app/admin/ui/dashboard-view.tsx` reducido de **1.753 líneas a ~220 líneas** como orquestador limpio.
  - `app/admin/ui/admin-shell.tsx` reducido de **476 líneas a 81 líneas**, extrayendo configuración de navegación (`admin-nav-config.ts`), barra superior (`admin-header.tsx`) y barra lateral (`admin-sidebar.tsx`).
  - Creada subarquitectura modular en `app/admin/ui/dashboard/`:
    - `types.ts`: Tipos del dashboard (`DashboardStats`, `RecentAttemptRow`, `TodayScheduleItem`, etc.).
    - `services/dashboard-queries.ts`: Consultas y agregados puros sobre Firestore.
    - `services/dashboard-schedule-utils.ts`: Cálculo de agenda del día, festivos oficiales de Colombia y estado de clases.
    - `hooks/use-dashboard-data.ts`: Hook reactivo que orquesta datos en tiempo real.
    - `components/dashboard-kpi-grid.tsx`: Grilla de 4 tarjetas KPI con la primitiva `StatCard`.
    - `components/dashboard-charts.tsx`: Gráficos interactivos de notas y actividad por día.
    - `components/dashboard-recent-activity.tsx`: Feed responsive (tarjetas en móvil, tabla semántica en desktop).
    - `components/dashboard-schedule.tsx`: Clases en vivo y agenda del día con badges institucionales (CESDE / SENA).
  - Verificación: `npx tsc --noEmit` completado exitosamente sin errores.

#### 4.4 Módulo de Plantillas de Examen (`app/admin/templates/`) `[✅ COMPLETADO]`
* **Transformación Visual**:
  - Encabezado con búsqueda rápida, alternador adaptable tabla/cards y panel de filtrado multicriterio.
  - Edición instantánea de cantidad de preguntas inline con feedback al perder foco (`onBlur`).
  - Previsualización interactiva de preguntas con navegación 1 a 1 o lista global, Markdown enriquecido, reemplazo rápido aleatorio y drawer selector directo del banco de preguntas.
* **Modularización de Código**:
  - `app/admin/templates/exam-manager.tsx` reducido de **2.603 líneas a 155 líneas** (~94% de reducción).
  - Creada subarquitectura modular en `app/admin/templates/`:
    - `types.ts`: Tipos del módulo (`TemplateFilters`, `ExamFormData`, etc.).
    - `services/exam-template-service.ts`: Lógica pura de Firestore (consultas de catálogos, eligible questions pool, transacciones batch de publicación, comprobación de intentos vinculados).
    - `hooks/use-exam-manager.ts`: Hook reactivo que gestiona estado en tiempo real, filtros, reemplazos aleatorios/manuales y CRUD.
    - `components/common.tsx`: Botones interactivos compartidos (`ActionIconButton`, `Toggle`).
    - `components/templates-header.tsx`: Cabecera de vista con búsqueda y switch de visualización.
    - `components/templates-filters.tsx`: Panel de filtros multicriterio (materia, grupo/ficha, momento, sede, jornada, estado).
    - `components/templates-table-view.tsx`: Vista de tabla de alta densidad para escritorio.
    - `components/templates-cards-view.tsx`: Vista de tarjetas adaptada a dispositivos móviles.
    - `components/template-form-modal.tsx`: Modal unificado para creación y edición de plantillas.
    - `components/template-delete-modal.tsx`: Modal de eliminación segura con verificación de intentos activos.
    - `components/template-publish-modal.tsx`: Modal interactivo de previsualización, ajuste de preguntas y publicación en Firestore.
  - Verificación: `npx tsc --noEmit` completado exitosamente con 0 errores.

#### 4.5 Módulo de Banco de Preguntas (`app/admin/bank/`) `[✅ COMPLETADO]`
* **Transformación Visual**:
  - Encabezado con selector de vista (Resumen / Tabla) y KPI total con gráfico sparkline integrado.
  - Vista Resumen con KPIs de estado (Publicadas, Borrador, Archivadas), métricas de calidad rápida de datos, gráficos Donut y BarList para distribución por tipo, dificultad, top materias y cobertura (grupos y momentos).
  - Explorador interactivo de muestra con filtros por materia/momento y paginación.
  - Vista Tabla con diseño adaptativo (tarjetas optimizadas en móvil y tabla semántica en desktop), filtros multicriterio, paginación y acciones rápidas (editar, eliminar individual y vaciado con confirmación "ELIMINAR").
* **Modularización de Código**:
  - `app/admin/bank/bank-dashboard.tsx` reducido de **2.196 líneas a 130 líneas** (~94% de reducción).
  - Creada subarquitectura modular en `app/admin/bank/`:
    - `types.ts`: Tipos del módulo (`BankViewMode`, `BankTableFilters`).
    - `services/bank-service.ts`: Servicios puros de consulta, agregaciones de conteos, formateadores y mutaciones (`fetchBankCatalogs`, `fetchBankMetricsFromFirestore`, `fetchBankSampleData`, `fetchBankTableRows`, `fetchQuestionDetails`, `saveQuestionToDb`, `deleteQuestionFromDb`, `wipeAllQuestionsApi`).
    - `hooks/use-bank-dashboard.ts`: Hook reactivo que centraliza estado de vistas, filtros, paginaciones, modales y operaciones asíncronas.
    - `components/bank-charts.tsx`: Componentes de visualización (`MiniSparkline`, `Donut`, `BarList`).
    - `components/bank-header.tsx`: Cabecera con selector de vista (Resumen / Tabla) y KPI total.
    - `components/bank-summary-view.tsx`: Vista analítica de KPIs, estado, tipos, dificultad, cobertura y muestra exploratoria paginada con copiado de ID.
    - `components/bank-table-view.tsx`: Vista de listado en tabla semántica (desktop) y tarjetas adaptativas (móvil) con filtros y paginación.
    - `components/bank-question-modal.tsx`: Modal para crear y editar preguntas (opciones, reglas abiertas, puzzles, momentos, grupos).
    - `components/bank-delete-modal.tsx`: Modal de confirmación para eliminar una pregunta individual.
    - `components/bank-wipe-modal.tsx`: Modal de confirmación para vaciado de la colección con confirmación `"ELIMINAR"`.
  - Verificación: `npx tsc --noEmit` completado exitosamente con 0 errores.

#### 4.6 Módulo de Resultados e Histórico (`app/admin/results/`) `[✅ COMPLETADO]`
* **Transformación Visual y Funcional**:
  - Cabecera con descripción y acciones de exportación rápida (CSV, Excel con estilos tipados vía ExcelJS, PDF vía jsPDF/autoTable).
  - Barra de herramientas con filtro por código numérico de 6 dígitos, búsqueda multicriterio (examen, estudiante, documento, correo, estado), selector de estado y conmutadores ("Solo con malas", "Solo con fraude").
  - Barra de selección múltiple con contador de seleccionados, exportación masiva a ZIP con PDFs individuales de intentos vía JSZip, eliminación en bloque y limpieza de selección.
  - Tabla semántica interactiva en escritorio con ordenación en dos direcciones por cualquier columna, badges de estado con tonos semánticos y acciones rápidas (ver detalle, generar PDF individual, eliminar intento).
  - Vista adaptativa en tarjetas para dispositivos móviles (<640px) con checkboxes y acceso completo a todas las acciones.
  - Modal detallado de intento con ficha del estudiante/examen, métricas clave (0-5, 0-50, malas, fraude y nivel de riesgo) y desglose en acordeón de las preguntas erradas con respuesta del estudiante y motivo.
  - Modales seguros de confirmación para eliminación individual y masiva.
* **Modularización de Código**:
  - `app/admin/results/results-manager.tsx` reducido de **1.821 líneas a 140 líneas** (~92% de reducción).
  - Creada subarquitectura modular en `app/admin/results/`:
    - `types.ts`: Tipos del módulo (`SortKey`, `SortDir`, `StatusFilter`, `WrongDetail`, `ExportFormat`).
    - `services/results-service.ts`: Lógica de calificación compartida con `@/lib/exam-grading`, helpers de formato, consultas a Firestore (`fetchResultsData`) y mutaciones de eliminación (`deleteAttemptDoc`, `deleteBulkAttemptDocs`).
    - `services/results-export-service.ts`: Motores de exportación aislados con importación dinámica de librerías pesadas (`exceljs`, `jspdf`, `jspdf-autotable`, `jszip`) para optimizar rendimiento de SSR y bundle size.
    - `hooks/use-results-manager.ts`: Hook reactivo que centraliza el estado de carga, filtros, ordenamiento cliente, paginación, selección múltiple, modales y exportaciones.
    - `components/results-header.tsx`: Cabecera y botones de exportación global.
    - `components/results-filters.tsx`: Panel de filtros, búsqueda, toggles y acciones de selección masiva.
    - `components/results-table-view.tsx`: Vista híbrida de tarjetas (móvil) y tabla semántica (escritorio) con paginación integrada.
    - `components/result-detail-modal.tsx`: Modal visor de intento con KPIs y desglose de respuestas incorrectas.
    - `components/result-delete-modal.tsx`: Modal de confirmación para eliminar un intento individual.
    - `components/result-bulk-delete-modal.tsx`: Modal de confirmación para eliminación masiva.
  - Verificación: `npx tsc --noEmit` completado exitosamente con 0 errores.

#### 4.7 Módulo de Estructuras Google Drive (`app/admin/drive/`) `[✅ COMPLETADO]`
* **Transformación Visual y Funcional**:
  - Cabecera con banner de alertas reactivas y acción directa para desplegar el modal guiado de creación.
  - Tarjetas KPI de resumen: total de estructuras registradas, semanas académicas detectadas, proporción CESDE / SENA y estructuras pendientes de revisión.
  - Selector de pestañas institucionales (CESDE / SENA) con contador de estructuras.
  - Grilla de tarjetas interactivas de estructuras con tecnología branding badges (`getSubjectTechnologyMeta`), accesos directos a carpetas de Google Drive (Clase, Privada, Pública), botón de sincronización en tiempo real y eliminación del panel.
  - Panel detallado de estructura seleccionada con información consolidada, enlaces directos a carpetas y árbol de semanas detectadas agrupadas por día de la semana (`selectedWeeksByDay`).
  - Modal guiado de creación de estructura con previsualización en vivo de chips (Sede, Jornada, Días, Horario), validación estricta y sincronización automática con Apps Script y calendario de carga horaria.
  - Modal seguro de confirmación para eliminar estructuras del panel y de la papelera de Drive.
* **Modularización de Código**:
  - `app/admin/drive/drive-dashboard.tsx` reducido de **1.670 líneas a 183 líneas** (~89% de reducción).
  - Creada subarquitectura modular en `app/admin/drive/`:
    - `types.ts`: Tipos del módulo (`WeekGroupItem`, `DriveDashboardSummary`, `CreateStructurePayload`).
    - `services/drive-service.ts`: Lógica pura de inferencia de días y fechas, resolución de nombres de carpetas (`parseFolderDate`), cálculo de IDs de estructura, helpers visuales y clientes HTTP tipados para endpoints de backend (`bootstrapDriveApi`, `validateDriveWorkspaceApi`, `deleteDriveWorkspaceApi`).
    - `hooks/use-drive-dashboard.ts`: Hook reactivo que gestiona los listeners en tiempo real de Firestore (`driveWorkspaces` y subcolección `nodes`), catálogos, estados optimistas, formularios y modales.
    - `components/drive-header.tsx`: Cabecera con título, subtítulo, botón de creación y alertas.
    - `components/drive-kpi-summary.tsx`: 4 tarjetas métricas con `formatCompactNumber`.
    - `components/drive-workspaces-list.tsx`: Pestañas por institución y grilla interactiva de tarjetas de estructura.
    - `components/drive-workspace-detail.tsx`: Panel visor de estructura y desglose de semanas por día.
    - `components/drive-create-modal.tsx`: Modal con formulario guiado por secciones (`DriveFormSection`) y chips dinámicos.
    - `components/drive-delete-modal.tsx`: Modal de confirmación para eliminación segura.
  - Verificación: `npx tsc --noEmit` completado exitosamente con 0 errores.

#### 4.8 Módulo de Monitoreo en Vivo (`app/admin/live/`) `[✅ COMPLETADO]`
* **Transformación Visual y Funcional**:
  - Cabecera con selector de vista (Tabla / Mapa / Mapa automático en móvil) y buscador en tiempo real por nombre o código de acceso.
  - Barra de acceso rápido por código numérico de 6 dígitos con teclado numérico optimizado, validación y chips de acceso directo a códigos recientes.
  - Vista Mapa: cuadrícula de tarjetas de exámenes publicados con código en gran formato tipográfico (tracking espaciado), botón de ajuste dinámico de tiempo, acceso al chat y cierre de examen con confirmación.
  - Vista Tabla: vista densa de escritorio con ordenación y acciones alineadas.
  - Cajón modal de monitoreo en tiempo real:
    - Encabezado con 6 métricas vivas: Intentos totales, en progreso, finalizados, anulados, sospechosos y promedio de avance porcentual.
    - Columna izquierda con buscador por estudiante/documento/correo y tarjetas de estado con barras de progreso animadas y alertas de fraude.
    - Columna derecha con panel de chat unidireccional (docente → estudiante), historial de mensajes, panel de fraude (pestañas, portapapeles, penalizaciones), ranking de intentos sospechosos y acción de anulación de examen con motivo registrado.
  - Modal de ajuste de tiempo en minutos con actualización reactiva en Firestore.
  - Modal de anulación de examen con justificación obligatoria.
* **Modularización de Código**:
  - `app/admin/live/live-manager.tsx` reducido de **1.226 líneas a 140 líneas** (~89% de reducción).
  - Creada subarquitectura modular en `app/admin/live/`:
    - `types.ts`: Tipos del módulo (`PublishedExamRow`, `AttemptRow`, `AttemptMetricItem`, `AttemptMetrics`).
    - `services/live-service.ts`: Cálculo puro de métricas agregadas de intento (`computeAttemptMetrics`), formateadores porcentuales y mutaciones en Firestore/API (`closeExamApi`, `updateExamTimeLimit`, `sendStudentAdminMessage`, `annulAttempt`).
    - `hooks/use-live-manager.ts`: Hook reactivo que desacopla listeners de Firestore (`publishedExams` y subcolección `attempts`), atajo de código rápido, modales y acciones.
    - `components/live-header.tsx`: Cabecera con alternador tabla/mapa y búsqueda.
    - `components/live-quick-code-bar.tsx`: Barra de salto instantáneo por código OTP de 6 dígitos con sugerencias.
    - `components/live-exams-map-view.tsx`: Vista de mapa en tarjetas de alta legibilidad con display OTP.
    - `components/live-exams-table-view.tsx`: Vista de tabla de alta densidad para escritorio.
    - `components/live-attempts-modal.tsx`: Modal/drawer de monitoreo de estudiantes en vivo con chat y métricas.
    - `components/live-annul-modal.tsx`: Modal de anulación con motivo.
#### 4.9 Módulo de Catálogos Institucionales (`app/admin/settings/`) `[✅ COMPLETADO]`
* **Transformación Visual y Funcional**:
  - Navegación segmentada por píldoras/pestañas (`CatalogsTabs`) para los 7 catálogos institucionales: Materias, Fichas (SENA), Sedes, Jornadas, Trimestres (SENA), Momentos y Grupos.
  - Indicadores con iconos dedicados y tarjeta de contexto activa.
  - Filtros reactivos por estado (Todos / Activos / Inactivos), búsqueda por texto normalizado y contadores numéricos de items.
  - Gestión estándar de catálogos (`CollectionPanel`): creación rápida con normalización de mayúsculas/minúsculas y generación de ID estable sin tildes ni caracteres especiales (`toStableId`), edición in-place, alternador de estado activo/inactivo con confirmación y copiado rápido de ID al portapapeles.
  - Gestión especializada de Fichas SENA (`FichasPanel`): validación estricta de 7 a 9 dígitos numéricos, asociación directa con el catálogo de trimestres, selección en modal de edición y prevención de duplicados.
* **Modularización de Código**:
  - `app/admin/settings/catalogs.tsx` reducido de **1.270 líneas a 108 líneas** (~91% de reducción).
  - Creada subarquitectura modular en `app/admin/settings/catalogs/`:
    - `types.ts`: Tipos del módulo (`CatalogItemConfig`, `FilterStatus`, exportaciones de `CatalogRow` y `FichaRow`).
    - `services/catalogs-service.ts`: Funciones de sanitización y estabilidad de IDs (`toStableId`, `toRow`, `toFichaRow`, `isValidFichaNumber`) y mutaciones tipadas a Firestore (`createCatalogDoc`, `updateCatalogDocName`, `toggleCatalogDocActive`, `createFichaDoc`, `updateFichaDocTrimester`, `toggleFichaDocActive`).
    - `components/modal-shell.tsx`: Contenedor accesible y estilizado para ventanas modulares de creación y edición.
    - `components/catalogs-tabs.tsx`: Selector interactivo de catálogos con iconos y resaltado activo.
    - `components/collection-panel.tsx`: Panel completo con filtros, listado en tarjetas/tabla compacta, creación y edición para colecciones generales.
    - `components/fichas-panel.tsx`: Panel especializado para fichas numéricas y relación con trimestres SENA.
  - Verificación: `npx tsc --noEmit` completado exitosamente con 0 errores.

#### 4.10 Módulo de Documentación y Generación IA (`app/admin/settings/ai-docs/`) `[✅ COMPLETADO]`
* **Transformación Visual y Funcional**:
  - Cabecera con selector de pestañas (README / Preguntas JSON) e indicador bot visual.
  - Editor de README con acciones directas: Configurar parámetros, Generar con Gemini (Flash/Pro), Vista previa formateada con `MarkdownViewer`, Copiar al portapapeles, Descarga como archivo `.md` y Limpieza rápida.
  - Generador de Batch JSON a partir de metadatos incrustados (`<!-- BATCH_METADATA_START -->` / `<!-- BATCH_METADATA_END -->`) con validación automática, visualizador de sintaxis JSON indentada, descarga como `.json` y salto guiado si falta el README.
  - Modal de configuración de README con selector de plantilla didáctica vs personalizada, modelos Gemini Flash/Pro, campos temáticos estructurados y selectores de metadatos JSON vinculados a materias, grupos y momentos.
  - Modal de confirmación de Batch JSON con resumen en tarjetas KPI de la materia, grupo, momento, preguntas, tiempo y tipos habilitados.
  - Modal visor de estudiante para vista previa de lectura y diagramas en alta fidelidad.
* **Modularización de Código**:
  - `app/admin/settings/ai-docs/page.tsx` reducido de **1.317 líneas a 152 líneas** (~88% de reducción).
  - Creada subarquitectura modular en `app/admin/settings/ai-docs/`:
    - `types.ts`: Tipos del módulo (`CatalogItem`, `ReadmeTemplateId`, `ReadmeBatchMetadata`, opciones de plantillas y tipos de pregunta).
    - `templates.ts`: Criterios extensos de plantillas didácticas y personalizadas aislados del render.
    - `services/ai-docs-service.ts`: Descarga de blobs (Markdown y JSON), extracción de metadatos embebidos y clientes HTTP tipados para `/api/admin/ai-readme` y `/api/admin/ai-question-batch`.
    - `hooks/use-ai-docs.ts`: Hook reactivo que desacopla la sincronización con `localStorage`, queries a Firestore (`subjects`, `groups`, `moments`), validaciones computadas y acciones de generación.
    - `components/modal-shell.tsx`: Contenedor animado con `framer-motion` para modales de configuración.
    - `components/ai-docs-header.tsx`: Cabecera y switch de pestañas.
    - `components/readme-panel.tsx`: Panel principal de edición de README y toolbar de acciones.
    - `components/batch-panel.tsx`: Panel de JSON con acciones y advertencias.
    - `components/readme-config-modal.tsx`: Modal con formulario completo de parámetros y metadatos.
    - `components/batch-config-modal.tsx`: Modal de confirmación con tarjetas informativas.
    - `components/readme-preview-modal.tsx`: Modal visor con renderizado Markdown.
  - Verificación: `npx tsc --noEmit` completado exitosamente con 0 errores.

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
