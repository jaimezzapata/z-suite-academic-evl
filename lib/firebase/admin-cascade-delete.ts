import type { Firestore, Query } from "firebase-admin/firestore";

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

async function deleteCollection(ref: FirebaseFirestore.CollectionReference, batchSize = 400) {
  while (true) {
    const snap = await ref.limit(batchSize).get();
    if (snap.empty) return;
    const batch = ref.firestore.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }
}

async function deleteByQuery(queryRef: Query, batchSize = 400) {
  while (true) {
    const snap = await queryRef.limit(batchSize).get();
    if (snap.empty) return;
    const batch = snap.docs[0]!.ref.firestore.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  }
}

async function findTeachingLoadIdByWorkspace(adminDb: Firestore, workspaceId: string) {
  const workspaceSnap = await adminDb.collection("driveWorkspaces").doc(workspaceId).get();
  const fromWorkspace = toString(workspaceSnap.data()?.sourceTeachingLoadId, "").trim();
  if (fromWorkspace) return fromWorkspace;

  const linkedSnap = await adminDb
    .collection("teachingLoads")
    .where("driveWorkspaceId", "==", workspaceId)
    .limit(1)
    .get();

  return linkedSnap.empty ? "" : linkedSnap.docs[0]!.id;
}

async function findWorkspaceIdByTeachingLoad(adminDb: Firestore, teachingLoadId: string) {
  const teachingLoadSnap = await adminDb.collection("teachingLoads").doc(teachingLoadId).get();
  const fromTeachingLoad = toString(teachingLoadSnap.data()?.driveWorkspaceId, "").trim();
  if (fromTeachingLoad) return fromTeachingLoad;

  const workspaceSnap = await adminDb
    .collection("driveWorkspaces")
    .where("sourceTeachingLoadId", "==", teachingLoadId)
    .limit(1)
    .get();

  return workspaceSnap.empty ? "" : workspaceSnap.docs[0]!.id;
}

export async function deleteDriveWorkspaceRecord(adminDb: Firestore, workspaceId: string) {
  const wsRef = adminDb.collection("driveWorkspaces").doc(workspaceId);
  const wsSnap = await wsRef.get();
  if (!wsSnap.exists) {
    return { existed: false };
  }

  await deleteCollection(wsRef.collection("nodes"), 400);
  await deleteCollection(wsRef.collection("files"), 400);
  await wsRef.delete();
  await deleteByQuery(adminDb.collection("driveFiles").where("workspaceId", "==", workspaceId), 400);

  return { existed: true };
}

export async function deleteTeachingLoadRecord(adminDb: Firestore, teachingLoadId: string) {
  const loadRef = adminDb.collection("teachingLoads").doc(teachingLoadId);
  const loadSnap = await loadRef.get();
  if (!loadSnap.exists) {
    return { existed: false };
  }

  await loadRef.delete();
  return { existed: true };
}

export async function deleteWorkspaceCascade(adminDb: Firestore, workspaceId: string) {
  const teachingLoadId = await findTeachingLoadIdByWorkspace(adminDb, workspaceId);
  const deletedTeachingLoad = teachingLoadId ? await deleteTeachingLoadRecord(adminDb, teachingLoadId) : { existed: false };
  const deletedWorkspace = await deleteDriveWorkspaceRecord(adminDb, workspaceId);

  return {
    workspaceId,
    teachingLoadId,
    deletedWorkspace: deletedWorkspace.existed,
    deletedTeachingLoad: deletedTeachingLoad.existed,
  };
}

export async function deleteTeachingLoadCascade(adminDb: Firestore, teachingLoadId: string) {
  const workspaceId = await findWorkspaceIdByTeachingLoad(adminDb, teachingLoadId);
  const deletedTeachingLoad = await deleteTeachingLoadRecord(adminDb, teachingLoadId);
  const deletedWorkspace = workspaceId ? await deleteDriveWorkspaceRecord(adminDb, workspaceId) : { existed: false };

  return {
    teachingLoadId,
    workspaceId,
    deletedTeachingLoad: deletedTeachingLoad.existed,
    deletedWorkspace: deletedWorkspace.existed,
  };
}
