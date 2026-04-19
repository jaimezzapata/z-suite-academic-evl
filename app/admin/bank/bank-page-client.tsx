"use client";

import { useMemo, useState } from "react";
import { BankDashboard } from "./bank-dashboard";
import { JsonImporter } from "./json-importer";

type TabKey = "overview" | "import";

export function BankPageClient() {
  const [tab, setTab] = useState<TabKey>("overview");

  const tabs = useMemo(
    () =>
      [
        { key: "overview" as const, label: "Resumen" },
        { key: "import" as const, label: "Importar" },
      ] satisfies { key: TabKey; label: string }[],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`h-10 rounded-xl px-4 text-sm font-semibold transition ${
                tab === t.key ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
              }`}
              aria-pressed={tab === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" ? <BankDashboard /> : <JsonImporter />}
    </div>
  );
}

