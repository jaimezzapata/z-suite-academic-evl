import { google } from "googleapis";
import { Readable } from "node:stream";

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
};

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Falta ${name}.`);
  return value.trim();
}

function parseServiceAccountJson(raw: string): ServiceAccountJson {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON no es JSON válido.");
  }
  if (!json || typeof json !== "object") throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON inválido.");
  const obj = json as Record<string, unknown>;
  const client_email = typeof obj.client_email === "string" ? obj.client_email : "";
  const private_key = typeof obj.private_key === "string" ? obj.private_key : "";
  if (!client_email || !private_key) throw new Error("Service account inválido (client_email/private_key).");
  return { client_email, private_key: private_key.replace(/\\n/g, "\n") };
}

export function getDriveRootFolderId() {
  const value = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
  return value && value.trim() ? value.trim() : null;
}

export function getDriveClient() {
  const saRaw = requiredEnv("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON");
  const sa = parseServiceAccountJson(saRaw);
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

export function getOAuthDriveClient(refreshToken: string) {
  const clientId = requiredEnv("GOOGLE_DRIVE_OAUTH_CLIENT_ID");
  const clientSecret = requiredEnv("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET");
  const redirectUri = requiredEnv("GOOGLE_DRIVE_OAUTH_REDIRECT_URI");
  const auth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth });
}

export async function createDriveFolder({
  name,
  parentId,
  drive,
}: {
  name: string;
  parentId?: string | null;
  drive?: ReturnType<typeof google.drive>;
}) {
  const client = drive ?? getDriveClient();
  const res = await client.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id, name, webViewLink",
  });
  const id = res.data.id ?? "";
  const webViewLink = res.data.webViewLink ?? "";
  if (!id) throw new Error("No fue posible crear la carpeta en Drive.");
  return { id, webViewLink, name: res.data.name ?? name };
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function ensureDriveFolder({
  name,
  parentId,
  drive,
}: {
  name: string;
  parentId: string;
  drive: ReturnType<typeof google.drive>;
}) {
  const q = [
    `name='${escapeDriveQueryValue(name)}'`,
    `'${parentId}' in parents`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
  ].join(" and ");

  const listed = await drive.files.list({
    q,
    fields: "files(id,name,webViewLink)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const found = listed.data.files?.[0];
  if (found?.id) {
    return {
      id: found.id,
      name: found.name ?? name,
      webViewLink: found.webViewLink ?? "",
      reused: true,
    };
  }

  const created = await createDriveFolder({ name, parentId, drive });
  return { ...created, reused: false };
}

export async function uploadDriveFile({
  name,
  parentId,
  mimeType,
  bytes,
  drive,
}: {
  name: string;
  parentId: string;
  mimeType: string;
  bytes: Uint8Array;
  drive?: ReturnType<typeof google.drive>;
}) {
  const client = drive ?? getDriveClient();
  const body = Readable.from(Buffer.from(bytes));
  const res = await client.files.create({
    requestBody: { name, parents: [parentId] },
    media: { mimeType, body },
    fields: "id, name, mimeType, size, webViewLink, webContentLink",
  });
  const id = res.data.id ?? "";
  if (!id) throw new Error("No fue posible subir el archivo a Drive.");
  return {
    id,
    name: res.data.name ?? name,
    mimeType: res.data.mimeType ?? mimeType,
    size: res.data.size ? Number(res.data.size) : null,
    webViewLink: res.data.webViewLink ?? "",
    webContentLink: res.data.webContentLink ?? "",
  };
}
