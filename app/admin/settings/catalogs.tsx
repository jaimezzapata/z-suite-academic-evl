"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Hash,
  Layers,
  Users,
} from "lucide-react";
import type { CatalogItemConfig } from "./catalogs/types";
import { CatalogsTabs } from "./catalogs/components/catalogs-tabs";
import { CollectionPanel } from "./catalogs/components/collection-panel";
import { FichasPanel } from "./catalogs/components/fichas-panel";

export function CatalogsPage() {
  const catalogs = useMemo<readonly CatalogItemConfig[]>(
    () => [
      {
        key: "subjects",
        title: "Materias",
        description: "Materias o asignaturas (por ejemplo Front 1).",
        collectionName: "subjects",
        icon: GraduationCap,
      },
      {
        key: "fichas",
        title: "Fichas (SENA)",
        description: "Fichas numéricas (7–9 dígitos) asociadas a trimestre.",
        collectionName: "fichas",
        icon: Hash,
      },
      {
        key: "sites",
        title: "Sedes",
        description: "Lugares o sedes disponibles para examenes.",
        collectionName: "sites",
        icon: Building2,
      },
      {
        key: "shifts",
        title: "Jornadas",
        description: "Jornada o turno (manana, tarde, noche).",
        collectionName: "shifts",
        icon: Layers,
      },
      {
        key: "trimesters",
        title: "Trimestres (SENA)",
        description: "Trimestres para fichas y planeación SENA.",
        collectionName: "trimesters",
        icon: CalendarDays,
      },
      {
        key: "moments",
        title: "Momentos",
        description: "Momentos de evaluacion (M1, M2, recuperacion).",
        collectionName: "moments",
        icon: ClipboardList,
      },
      {
        key: "groups",
        title: "Grupos",
        description: "Grupos o cursos (por ejemplo 10A Manana).",
        collectionName: "groups",
        icon: Users,
      },
    ],
    [],
  );

  const [activeKey, setActiveKey] = useState<CatalogItemConfig["key"]>("subjects");
  const active = catalogs.find((c) => c.key === activeKey) ?? catalogs[0];
  const ActiveIcon = active.icon;

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Catálogos</h1>
        <p className="mt-1 text-sm text-zinc-600">Datos base para segmentación de exámenes y banco.</p>
      </div>

      <CatalogsTabs catalogs={catalogs} activeKey={activeKey} onSelect={setActiveKey} />

      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-900 text-white">
                <ActiveIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-950">{active.title}</p>
                <p className="text-xs text-zinc-500">{active.description}</p>
              </div>
            </div>
          </div>
        </div>

        {active.key === "fichas" ? (
          <FichasPanel compactHeader />
        ) : (
          <CollectionPanel
            key={active.collectionName}
            title={active.title}
            description={active.description}
            collectionName={active.collectionName}
            compactHeader
          />
        )}
      </div>
    </div>
  );
}
