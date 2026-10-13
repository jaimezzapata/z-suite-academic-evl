import type { CatalogItemConfig } from "../types";

export function CatalogsTabs({
  catalogs,
  activeKey,
  onSelect,
}: {
  catalogs: readonly CatalogItemConfig[];
  activeKey: CatalogItemConfig["key"];
  onSelect: (key: CatalogItemConfig["key"]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {catalogs.map((c) => {
        const selected = c.key === activeKey;
        const Icon = c.icon;
        return (
          <button
            key={c.key}
            type="button"
            onClick={() => onSelect(c.key)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
              selected
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <div className={`grid h-7 w-7 place-items-center rounded-lg ${selected ? "bg-white/10" : "bg-zinc-100"}`}>
              <Icon className={`h-4 w-4 ${selected ? "text-white" : "text-zinc-700"}`} />
            </div>
            {c.title}
          </button>
        );
      })}
    </div>
  );
}
