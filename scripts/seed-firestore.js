/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const args = {
    serviceAccount: null,
    projectId: null,
    adminUid: null,
    adminEmail: null,
    input: path.join(process.cwd(), "docs", "question-bank.example.json"),
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === "--help") {
      args.help = true;
      continue;
    }
    if (key === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (!val || val.startsWith("--")) {
      throw new Error(`Falta valor para ${key}`);
    }
    if (key === "--serviceAccount") args.serviceAccount = val;
    else if (key === "--projectId") args.projectId = val;
    else if (key === "--adminUid") args.adminUid = val;
    else if (key === "--adminEmail") args.adminEmail = val;
    else if (key === "--input") args.input = val;
    else throw new Error(`Argumento desconocido: ${key}`);
    i += 1;
  }

  return args;
}

function printHelp() {
  console.log(`
Seed Firestore (admins + catalog + questions + examTemplates)

Requisitos:
- Descargar un Service Account JSON (Firebase Console -> Project settings -> Service accounts).
- NO lo subas al repo.

Uso:
  npm run seed:firestore -- --serviceAccount <ruta.json> --projectId <id> --adminUid <uid> --adminEmail <correo> [--input <archivo.json>] [--dry-run]

Ejemplo:
  npm run seed:firestore -- --serviceAccount ./.secrets/service-account.json --projectId z-suite-academic-evl --adminUid ivtJjphL6dddmf8K75eUVhuCf0F3 --adminEmail zapata...@gmail.com
`);
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

async function createIfMissing(ref, data, dryRun) {
  const snap = await ref.get();
  if (snap.exists) return { created: false };
  if (!dryRun) await ref.set(data, { merge: false });
  return { created: true };
}

async function upsert(ref, data, dryRun) {
  if (!dryRun) await ref.set(data, { merge: true });
  return { upserted: true };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.serviceAccount || !args.projectId || !args.adminUid || !args.adminEmail) {
    printHelp();
    throw new Error("Faltan parametros requeridos.");
  }

  const admin = require("firebase-admin");

  const serviceAccountPath = path.isAbsolute(args.serviceAccount)
    ? args.serviceAccount
    : path.join(process.cwd(), args.serviceAccount);

  const sa = readJson(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: args.projectId,
  });

  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const inputPath = path.isAbsolute(args.input) ? args.input : path.join(process.cwd(), args.input);
  const payload = readJson(inputPath);

  console.log("== Seed Firestore ==");
  console.log("ProjectId:", args.projectId);
  console.log("Input:", inputPath);
  console.log("DryRun:", args.dryRun);

  const adminRef = db.collection("admins").doc(args.adminUid);
  const adminRes = await upsert(
    adminRef,
    { email: args.adminEmail, enabled: true, createdAt: now },
    args.dryRun,
  );
  console.log("admins/{uid}:", adminRes);

  const catalog = payload.catalog || {};
  const groups = Array.isArray(catalog.groups) ? catalog.groups : [];
  const subjects = Array.isArray(catalog.subjects) ? catalog.subjects : [];
  const moments = Array.isArray(catalog.moments) ? catalog.moments : [];

  for (const g of groups) {
    await upsert(db.collection("groups").doc(g.id), { ...g, updatedAt: now }, args.dryRun);
  }
  for (const s of subjects) {
    await upsert(db.collection("subjects").doc(s.id), { ...s, updatedAt: now }, args.dryRun);
  }
  for (const m of moments) {
    await upsert(db.collection("moments").doc(m.id), { ...m, updatedAt: now }, args.dryRun);
  }
  console.log("catalog:", { groups: groups.length, subjects: subjects.length, moments: moments.length });

  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  const examTemplates = Array.isArray(payload.examTemplates) ? payload.examTemplates : [];

  let createdQuestions = 0;
  let skippedQuestions = 0;
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    if (!q?.id) continue;
    const res = await createIfMissing(
      db.collection("questions").doc(q.id),
      { ...q, createdAt: now, updatedAt: now },
      args.dryRun,
    );
    if (res.created) createdQuestions += 1;
    else skippedQuestions += 1;
  }
  console.log("questions:", { total: questions.length, created: createdQuestions, skipped: skippedQuestions });

  let createdTemplates = 0;
  let skippedTemplates = 0;
  for (let i = 0; i < examTemplates.length; i += 1) {
    const t = examTemplates[i];
    if (!t?.id) continue;
    const res = await createIfMissing(
      db.collection("examTemplates").doc(t.id),
      { ...t, createdAt: now, updatedAt: now },
      args.dryRun,
    );
    if (res.created) createdTemplates += 1;
    else skippedTemplates += 1;
  }
  console.log("examTemplates:", {
    total: examTemplates.length,
    created: createdTemplates,
    skipped: skippedTemplates,
  });

  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
