import { CatalogsPage } from "./catalogs";
import { DangerZone } from "./danger-zone";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <CatalogsPage />
      <DangerZone />
    </div>
  );
}
