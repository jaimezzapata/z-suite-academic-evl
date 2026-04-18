import { ModulePage } from "../ui/module-page";
import { JsonImporter } from "./json-importer";

export default function AdminBankPage() {
  return (
    <div className="space-y-6">
      <ModulePage
        title="Banco de preguntas"
        description="Gestiona las preguntas por materia, grupo y momento. Este modulo refleja datos reales de Firestore."
        primaryCollection="questions"
        secondaryCollection="subjects"
      />
      <JsonImporter />
    </div>
  );
}
