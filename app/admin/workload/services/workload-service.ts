import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { firebaseAuth, firestore } from "@/lib/firebase/client";
import type { CatalogItem, TeachingLoadRow, PayrollStatementItem } from "../types";
import {
  toCatalogItem,
  sortByName,
  toString,
  makeTeachingLoadWorkspaceId,
  roundHours,
} from "./workload-date-utils";

export async function fetchWorkloadCatalogs(): Promise<{
  subjects: CatalogItem[];
  groups: CatalogItem[];
  fichas: CatalogItem[];
  sites: CatalogItem[];
  shifts: CatalogItem[];
}> {
  const [subjectsSnap, groupsSnap, fichasSnap, sitesSnap, shiftsSnap] = await Promise.all([
    getDocs(query(collection(firestore, "subjects"), orderBy("name"))),
    getDocs(query(collection(firestore, "groups"), orderBy("name"))),
    getDocs(query(collection(firestore, "fichas"), orderBy("number"))),
    getDocs(query(collection(firestore, "sites"), orderBy("name"))),
    getDocs(query(collection(firestore, "shifts"), orderBy("name"))),
  ]);

  return {
    subjects: sortByName(subjectsSnap.docs.map((d) => toCatalogItem(d.id, d.data() as Record<string, unknown>))),
    groups: sortByName(groupsSnap.docs.map((d) => toCatalogItem(d.id, d.data() as Record<string, unknown>))),
    fichas: sortByName(
      fichasSnap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        const number = toString(data.number, d.id);
        return { id: d.id, name: number };
      }),
    ),
    sites: sortByName(sitesSnap.docs.map((d) => toCatalogItem(d.id, d.data() as Record<string, unknown>))),
    shifts: sortByName(shiftsSnap.docs.map((d) => toCatalogItem(d.id, d.data() as Record<string, unknown>))),
  };
}

export async function createOrLinkDriveForTeachingLoad(args: {
  loadId: string;
  institution: "CESDE" | "SENA";
  cesdeGroupType: "REGULAR" | "EMPRESARIAL";
  period: string;
  subjectId: string;
  audienceId: string;
  siteName: string;
  shiftName: string;
  startDate: string;
  endDate: string;
  dayOfWeek1: string;
  dayOfWeek2: string;
  startTime: string;
  endTime: string;
  day2StartTime: string;
  day2EndTime: string;
}): Promise<{ workspaceId: string; publicFolderUrl: string; message: string }> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error("La carga se guardó, pero no hay sesión activa para crear la estructura de Drive.");
  }

  const token = await user.getIdToken();
  const workspaceId = makeTeachingLoadWorkspaceId(args.loadId);
  const response = await fetch("/api/admin/drive/bootstrap", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({
      workspaceId,
      sourceTeachingLoadId: args.loadId,
      institution: args.institution,
      cesdeGroupType: args.cesdeGroupType,
      subjectId: args.subjectId,
      groupId: args.audienceId,
      period: args.period,
      campus: args.siteName,
      jornada: args.shiftName,
      dayOfWeek1: args.dayOfWeek1,
      dayOfWeek2: args.dayOfWeek2,
      startDate: args.startDate,
      endDate: args.endDate,
      startTime: args.startTime,
      endTime: args.endTime,
      day2StartTime: args.day2StartTime,
      day2EndTime: args.day2EndTime,
    }),
  });

  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (response.ok) {
    const drive = (data?.drive as Record<string, unknown> | undefined) ?? {};
    return {
      workspaceId,
      publicFolderUrl: typeof drive.publicFolderUrl === "string" ? drive.publicFolderUrl : "",
      message: typeof data?.message === "string" ? data.message : "Estructura de Drive creada correctamente.",
    };
  }

  if (response.status === 409) {
    return {
      workspaceId,
      publicFolderUrl: "",
      message: "La estructura de Drive ya existía y quedó vinculada a la carga.",
    };
  }

  throw new Error(typeof data?.error === "string" ? data.error : `No fue posible crear Drive (HTTP ${response.status}).`);
}

export async function deleteTeachingLoadApi(teachingLoadId: string): Promise<{ deletedWorkspace: boolean }> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error("Debes iniciar sesión como admin para eliminar la carga horaria.");
  }

  const token = await user.getIdToken(true);
  const response = await fetch("/api/admin/workload/delete", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ teachingLoadId }),
  });
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new Error(typeof data?.error === "string" ? data.error : "No fue posible eliminar la carga horaria.");
  }

  return { deletedWorkspace: data?.deletedWorkspace === true };
}

export async function savePayrollStatementToDb(args: {
  rangeStart: string;
  rangeEnd: string;
  hourlyRate: number;
  items: PayrollStatementItem[];
}): Promise<string> {
  const actor = firebaseAuth.currentUser;
  const statementRef = doc(collection(firestore, "payrollStatements"));
  const createdByName = actor?.displayName || actor?.email || "Administrador";
  const createdByEmail = actor?.email || "";
  const totalHours = roundHours(args.items.reduce((sum, item) => sum + item.academicHours, 0));
  const totalValue = roundHours(args.items.reduce((sum, item) => sum + item.estimatedValue, 0));

  await setDoc(statementRef, {
    id: statementRef.id,
    source: "workload-payroll",
    institution: "CESDE",
    rangeStart: args.rangeStart,
    rangeEnd: args.rangeEnd,
    hourlyRate: args.hourlyRate,
    totalHours,
    totalValue,
    itemCount: args.items.length,
    items: args.items,
    createdByName,
    createdByEmail,
    createdAt: serverTimestamp(),
  });

  return statementRef.id;
}

export async function deletePayrollStatementFromDb(statementId: string): Promise<void> {
  await deleteDoc(doc(firestore, "payrollStatements", statementId));
}
