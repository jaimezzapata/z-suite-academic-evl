import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { firestore } from "@/lib/firebase/client";
import type { CatalogRow, FichaRow } from "../types";

export function toStableId(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function toRow(id: string, data: Record<string, unknown>): CatalogRow {
  const name = typeof data.name === "string" && data.name.trim() ? data.name : id;
  const active = typeof data.active === "boolean" ? data.active : true;
  return { id, name, active };
}

export function toFichaRow(id: string, data: Record<string, unknown>): FichaRow {
  const number = typeof data.number === "string" && data.number.trim() ? data.number.trim() : id;
  const active = typeof data.active === "boolean" ? data.active : true;
  const trimesterId = typeof data.trimesterId === "string" ? data.trimesterId : "";
  return { id, number, trimesterId, active };
}

export function isValidFichaNumber(value: string): boolean {
  const v = value.trim();
  if (!/^\d+$/.test(v)) return false;
  return v.length >= 7 && v.length <= 9;
}

export async function createCatalogDoc(collectionName: string, id: string, name: string) {
  await setDoc(doc(collection(firestore, collectionName), id), {
    id,
    name,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateCatalogDocName(collectionName: string, id: string, name: string) {
  await updateDoc(doc(firestore, collectionName, id), {
    name,
    updatedAt: serverTimestamp(),
  });
}

export async function toggleCatalogDocActive(collectionName: string, id: string, active: boolean) {
  await updateDoc(doc(firestore, collectionName, id), {
    active,
    updatedAt: serverTimestamp(),
  });
}

export async function createFichaDoc(id: string, number: string, trimesterId: string) {
  await setDoc(doc(collection(firestore, "fichas"), id), {
    id,
    number,
    trimesterId,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateFichaDocTrimester(id: string, trimesterId: string) {
  await updateDoc(doc(firestore, "fichas", id), {
    trimesterId,
    updatedAt: serverTimestamp(),
  });
}

export async function toggleFichaDocActive(id: string, active: boolean) {
  await updateDoc(doc(firestore, "fichas", id), {
    active,
    updatedAt: serverTimestamp(),
  });
}
