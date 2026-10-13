"use client";

import { Modal, Button, Select, Input } from "@/components/ui";
import type { CatalogItem, WorkloadFilters, InstitutionTab } from "../types";

interface WorkloadFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  tab: InstitutionTab;
  filters: WorkloadFilters;
  subjects: CatalogItem[];
  filterAudienceOptions: { id: string; name: string }[];
  sites: CatalogItem[];
  shifts: CatalogItem[];
  classroomOptions: string[];
  onUpdateFilter: <K extends keyof WorkloadFilters>(key: K, value: WorkloadFilters[K]) => void;
  onResetFilters: () => void;
}

export function WorkloadFiltersModal({
  isOpen,
  onClose,
  tab,
  filters,
  subjects,
  filterAudienceOptions,
  sites,
  shifts,
  classroomOptions,
  onUpdateFilter,
  onResetFilters,
}: WorkloadFiltersModalProps) {
  const audienceLabel = tab === "ALL" ? "Grupo / Ficha" : tab === "SENA" ? "Ficha" : "Grupo";
  const audiencePlaceholder =
    tab === "ALL" ? "Todos los grupos y fichas" : tab === "SENA" ? "Todas las fichas" : "Todos los grupos";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Filtros de carga horaria"
      description="Refina los registros visibles en calendario, lista y simulación de nómina."
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onResetFilters}>
            Limpiar filtros
          </Button>
          <Button variant="primary" size="sm" onClick={onClose}>
            Aplicar y cerrar
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Materia"
          value={filters.subjectId}
          onChange={(e) => onUpdateFilter("subjectId", e.target.value)}
        >
          <option value="">Todas las materias</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </Select>

        <Select
          label={audienceLabel}
          value={filters.audienceId}
          onChange={(e) => onUpdateFilter("audienceId", e.target.value)}
        >
          <option value="">{audiencePlaceholder}</option>
          {filterAudienceOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </Select>

        <Select
          label="Sede"
          value={filters.siteId}
          onChange={(e) => onUpdateFilter("siteId", e.target.value)}
        >
          <option value="">Todas las sedes</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </Select>

        <Select
          label="Jornada"
          value={filters.shiftId}
          onChange={(e) => onUpdateFilter("shiftId", e.target.value)}
        >
          <option value="">Todas las jornadas</option>
          {shifts.map((shift) => (
            <option key={shift.id} value={shift.id}>
              {shift.name}
            </option>
          ))}
        </Select>

        <Select
          label="Salón"
          value={filters.classroom}
          onChange={(e) => onUpdateFilter("classroom", e.target.value)}
        >
          <option value="">Todos los salones</option>
          {classroomOptions.map((classroom) => (
            <option key={classroom} value={classroom}>
              {classroom}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            label="Fecha desde"
            value={filters.dateFrom}
            onChange={(e) => onUpdateFilter("dateFrom", e.target.value)}
          />
          <Input
            type="date"
            label="Fecha hasta"
            value={filters.dateTo}
            onChange={(e) => onUpdateFilter("dateTo", e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
