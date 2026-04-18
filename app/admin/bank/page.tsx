import { ModulePage } from "../ui/module-page";

export default function AdminBankPage() {
  return (
    <ModulePage
      title="Banco de preguntas"
      description="Gestiona las preguntas por materia, grupo y momento. Este modulo refleja datos reales de Firestore."
      primaryCollection="questions"
      secondaryCollection="subjects"
    />
  );
}
