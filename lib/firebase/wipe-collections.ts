export const ALL_WIPE_COLLECTIONS = [
  "attempts",
  "attemptLocks",
  "examTemplates",
  "publishedExams",
  "questions",
  "studyDocs",
  "subjects",
  "groups",
  "fichas",
  "sites",
  "shifts",
  "moments",
  "trimesters",
  "teachingLoads",
  "driveWorkspaces",
  "driveFiles",
  "driveMeta",
  "driveOauthTokens",
  "driveOauthStates",
] as const;

export type WipeCollectionName = (typeof ALL_WIPE_COLLECTIONS)[number];

export type WipeCollectionItem = {
  name: WipeCollectionName;
  label: string;
  description: string;
  tone: "neutral" | "danger";
};

export const WIPE_COLLECTION_ITEMS: WipeCollectionItem[] = [
  { name: "attempts", label: "Intentos", description: "Resultados e intentos de examenes", tone: "danger" },
  { name: "attemptLocks", label: "Bloqueos de intentos", description: "Locks por correo y documento para controlar acceso", tone: "danger" },
  { name: "publishedExams", label: "Examenes publicados", description: "Publicaciones, codigos y snapshots de examen", tone: "danger" },
  { name: "examTemplates", label: "Plantillas de examen", description: "Estructura y configuracion de examenes", tone: "danger" },
  { name: "questions", label: "Banco de preguntas", description: "Preguntas y sus metadatos", tone: "danger" },
  { name: "studyDocs", label: "Documentacion", description: "Cuadernillos y capitulos con subcolecciones", tone: "danger" },
  { name: "subjects", label: "Materias", description: "Catalogo de materias", tone: "neutral" },
  { name: "groups", label: "Grupos (CESDE)", description: "Catalogo de grupos", tone: "neutral" },
  { name: "fichas", label: "Fichas (SENA)", description: "Catalogo de fichas de 7 a 9 digitos", tone: "neutral" },
  { name: "sites", label: "Sedes", description: "Catalogo de sedes", tone: "neutral" },
  { name: "shifts", label: "Jornadas", description: "Catalogo de jornadas", tone: "neutral" },
  { name: "moments", label: "Momentos", description: "Catalogo de momentos", tone: "neutral" },
  { name: "trimesters", label: "Trimestres (SENA)", description: "Catalogo de trimestres", tone: "neutral" },
  { name: "teachingLoads", label: "Carga horaria", description: "Registros de agenda academica por institucion", tone: "danger" },
  { name: "driveWorkspaces", label: "Workspaces de Drive", description: "Espacios enlazados con la estructura academica", tone: "danger" },
  { name: "driveFiles", label: "Archivos de Drive", description: "Indice global de archivos sincronizados", tone: "danger" },
  { name: "driveMeta", label: "Metadatos de Drive", description: "Estadisticas y metadatos operativos de Drive", tone: "danger" },
  { name: "driveOauthTokens", label: "Tokens OAuth Drive", description: "Tokens guardados para integraciones legacy de Drive", tone: "danger" },
  { name: "driveOauthStates", label: "Estados OAuth Drive", description: "Estados temporales del flujo OAuth de Drive", tone: "danger" },
];
