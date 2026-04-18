import { ModulePage } from "../ui/module-page";

export default function AdminResultsPage() {
  return (
    <ModulePage
      title="Resultados"
      description="Consulta envios finalizados, notas y trazabilidad de evaluaciones por examen."
      primaryCollection="attempts"
      secondaryCollection="groups"
    />
  );
}
