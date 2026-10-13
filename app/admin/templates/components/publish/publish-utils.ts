export function getQuestionTypeLabel(type?: string) {
  switch (type) {
    case "single_choice":
      return "Selección única";
    case "multiple_choice":
      return "Selección múltiple";
    case "open_concept":
    case "open_text":
      return "Abierta";
    case "puzzle_order":
      return "Ordenar";
    case "puzzle_match":
      return "Emparejar";
    case "puzzle_cloze":
    case "puzzle_blank":
      return "Completar";
    case "true_false":
      return "Verdadero / Falso";
    default:
      return type || "Pregunta";
  }
}

export function getDifficultyBadge(diff?: string) {
  switch (diff?.toLowerCase()) {
    case "easy":
    case "fácil":
    case "facil":
      return { label: "Fácil", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "medium":
    case "media":
      return { label: "Media", cls: "bg-amber-50 text-amber-700 border-amber-200" };
    case "hard":
    case "difícil":
    case "dificil":
      return { label: "Difícil", cls: "bg-rose-50 text-rose-700 border-rose-200" };
    default:
      return { label: diff || "General", cls: "bg-zinc-50 text-zinc-700 border-zinc-200" };
  }
}
