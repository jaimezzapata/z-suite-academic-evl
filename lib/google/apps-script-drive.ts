type AppsScriptCreatePayload = {
  rootFolderId: string;
  institution: string;
  year: number;
  periodCode: string;
  subjectName: string;
  cohortCode: string;
  cesdeGroupType?: string;
  dayOfWeek1: string;
  dayOfWeek2?: string;
  jornada: string;
  sede: string;
  startDate: string;
  endDate?: string;
};

type AppsScriptStructurePayload = {
  publicFolderId: string;
};

type AppsScriptDeletePayload = {
  groupFolderId?: string;
  publicFolderId?: string;
};

type AppsScriptFolder = {
  folderId: string;
  folderUrl: string;
  folderName: string;
};

type AppsScriptWeek = {
  weekNumber: number | null;
  folderName: string;
  folderId: string;
  folderUrl: string;
};

type AppsScriptBaseResponse = {
  status: string;
  message?: string;
};

type AppsScriptCreateResponse = AppsScriptBaseResponse & {
  publicFolderId?: string;
  publicFolderUrl?: string;
};

type AppsScriptStructureResponse = AppsScriptBaseResponse & {
  classFolder?: AppsScriptFolder;
  publicFolder?: AppsScriptFolder;
  privateFolder?: AppsScriptFolder | null;
  weeks?: AppsScriptWeek[];
};

type AppsScriptDeleteResponse = AppsScriptBaseResponse & {
  trashedFolderId?: string;
  trashedFolderName?: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Falta ${name}.`);
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function callAppsScript<TResponse extends AppsScriptBaseResponse>(
  payload: Record<string, unknown>,
): Promise<TResponse> {
  const baseUrl = requiredEnv("GOOGLE_APPS_SCRIPT_DRIVE_URL");
  const response = await fetch(baseUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error("La respuesta del Apps Script no es JSON válido.");
  }

  if (!isRecord(data)) {
    throw new Error("La respuesta del Apps Script no tiene el formato esperado.");
  }

  if (!response.ok) {
    const message = typeof data.message === "string" ? data.message : `Apps Script respondió HTTP ${response.status}.`;
    throw new Error(message);
  }

  if (typeof data.status !== "string") {
    throw new Error("La respuesta del Apps Script no incluye el estado.");
  }

  if (data.status !== "success") {
    const message = typeof data.message === "string" ? data.message : "El Apps Script devolvió un error.";
    throw new Error(message);
  }

  return data as TResponse;
}

export function getAppsScriptDriveRootFolderId() {
  return requiredEnv("GOOGLE_DRIVE_ROOT_FOLDER_ID");
}

export async function createAppsScriptDriveStructure(data: AppsScriptCreatePayload) {
  const response = await callAppsScript<AppsScriptCreateResponse>({ data });
  if (!response.publicFolderId || !response.publicFolderUrl) {
    throw new Error("El Apps Script no devolvió la carpeta pública creada.");
  }
  return {
    publicFolderId: response.publicFolderId,
    publicFolderUrl: response.publicFolderUrl,
    message: typeof response.message === "string" ? response.message : "Estructura creada correctamente.",
  };
}

export async function getAppsScriptDriveStructure(data: AppsScriptStructurePayload) {
  const response = await callAppsScript<AppsScriptStructureResponse>({
    action: "getStructure",
    data,
  });

  if (!response.classFolder || !response.publicFolder || !Array.isArray(response.weeks)) {
    throw new Error("El Apps Script no devolvió una estructura válida.");
  }

  return {
    classFolder: response.classFolder,
    publicFolder: response.publicFolder,
    privateFolder: response.privateFolder ?? null,
    weeks: response.weeks,
    message: typeof response.message === "string" ? response.message : "",
  };
}

export async function trashAppsScriptDriveStructure(data: AppsScriptDeletePayload) {
  const response = await callAppsScript<AppsScriptDeleteResponse>({
    action: "deleteStructure",
    data,
  });

  return {
    trashedFolderId: typeof response.trashedFolderId === "string" ? response.trashedFolderId : "",
    trashedFolderName: typeof response.trashedFolderName === "string" ? response.trashedFolderName : "",
    message: typeof response.message === "string" ? response.message : "Estructura enviada a la papelera.",
  };
}
