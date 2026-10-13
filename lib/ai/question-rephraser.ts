import {
  cleanQuestionStatement,
  isDuplicateQuestion,
} from "./question-similarity";

function toString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function generateRephrasedStatement(
  statement: string,
  variantIndex: number,
  existingStatements: string[],
): string {
  const clean = cleanQuestionStatement(statement);
  const core = clean
    .replace(/^[¿?¡!]+/, "")
    .replace(/[¿?¡!]+$/, "")
    .trim();

  let variants: string[] = [];

  if (/^(?:que\s+es|que\s+define|que\s+significa|que\s+representa)\s+/i.test(core)) {
    const subject = core.replace(/^(?:que\s+es|que\s+define|que\s+significa|que\s+representa)\s+/i, "").trim();
    variants = [
      `En el contexto de la documentación técnica, ¿cuál es el concepto o propósito principal de ${subject}?`,
      `Identifica la afirmación correcta que define a ${subject}:`,
      `Respecto a ${subject}, ¿cuál de las siguientes opciones describe con mayor precisión sus características?`,
      `¿De qué manera se define ${subject} según los fundamentos explicados en el material?`,
      `¿Cuál de las siguientes alternativas resume fielmente el rol o alcance de ${subject}?`,
    ];
  } else if (
    /^(?:cual\s+es\s+la\s+funcion\s+de|para\s+que\s+sirve|que\s+funcion\s+cumple|como\s+se\s+utiliza)\s+/i.test(core)
  ) {
    const subject = core
      .replace(
        /^(?:cual\s+es\s+la\s+funcion\s+de|para\s+que\s+sirve|que\s+funcion\s+cumple|como\s+se\s+utiliza)\s+/i,
        "",
      )
      .trim();
    variants = [
      `En un escenario práctico de aplicación, ¿cuál es la utilidad primordial de ${subject}?`,
      `¿Qué objetivo o resultado técnico se busca alcanzar al utilizar ${subject}?`,
      `Determina la responsabilidad principal o propósito de ${subject}:`,
      `Con relación a ${subject}, ¿en qué situación o con qué fin se debe emplear?`,
      `¿Cuál es el beneficio o función clave que aporta ${subject} en este entorno?`,
    ];
  } else if (
    /^(?:cual\s+de\s+las\s+siguientes|cual\s+de\s+los\s+siguientes|selecciona\s+la|identifica\s+la)\s+/i.test(core)
  ) {
    const subject = core
      .replace(
        /^(?:cual\s+de\s+las\s+siguientes|cual\s+de\s+los\s+siguientes|selecciona\s+la|identifica\s+la)\s+/i,
        "",
      )
      .trim();
    variants = [
      `Considerando lo establecido en el documento de estudio, determina la opción acertada respecto a: ${subject}:`,
      `Analiza las alternativas disponibles e identifica la correcta sobre: ${subject}:`,
      `En relación con los temas analizados, selecciona la afirmación verídica acerca de: ${subject}:`,
      `De acuerdo con los estándares expuestos, ¿qué alternativa describe apropiadamente a: ${subject}?`,
    ];
  } else {
    variants = [
      `De acuerdo con lo expuesto en el material didáctico, ¿cuál es la alternativa correcta acerca de: ${core}?`,
      `Considerando la información técnica suministrada, selecciona la opción que responde a: ${core}:`,
      `En relación con los temas explicados, identifica la respuesta acertada sobre: ${core}:`,
      `Analizando los conceptos abordados en el documento, ¿qué opción describe con veracidad: ${core}?`,
      `Con base en los lineamientos estudiados, determina la opción válida respecto a: ${core}:`,
    ];
  }

  for (let i = 0; i < variants.length; i++) {
    const candidate = variants[(variantIndex + i) % variants.length];
    if (!isDuplicateQuestion(candidate, existingStatements)) {
      return candidate;
    }
  }

  return variants[variantIndex % variants.length];
}

export function reformulateInOtherWords(
  seed: Record<string, unknown>,
  variantIndex: number,
  existingStatements: string[],
): Record<string, unknown> {
  const clone: Record<string, unknown> =
    typeof structuredClone === "function" ? structuredClone(seed) : JSON.parse(JSON.stringify(seed));

  const originalStatement = cleanQuestionStatement(toString(clone.statement, ""));
  const rephrased = generateRephrasedStatement(originalStatement, variantIndex, existingStatements);
  clone.statement = rephrased;

  const difficulties = ["easy", "medium", "hard"] as const;
  clone.difficulty = difficulties[(variantIndex + 1) % difficulties.length];

  if (Array.isArray(clone.options) && clone.options.length >= 2) {
    const opts = clone.options as Array<Record<string, unknown>>;
    const rot = (variantIndex % (opts.length - 1)) + 1;
    const rotated = [...opts.slice(rot), ...opts.slice(0, rot)];
    clone.options = rotated.map((o, idx) => ({
      ...o,
      id: String.fromCharCode(97 + idx),
      text: cleanQuestionStatement(toString(o.text, "")).trim(),
    }));
  }

  return clone;
}

export function makeId(prefix: string, seed: string): string {
  const safe = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${safe || "auto"}_${rand}`;
}

export function normalizeOptions(options: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  return options.map((opt, idx) => {
    const id = toString(opt.id, "") || alphabet[idx] || `o${idx + 1}`;
    const text = toString(opt.text, "").trim();
    const next: Record<string, unknown> = { ...opt, id, text };
    if (!("isCorrect" in next)) delete next.isCorrect;
    return next;
  });
}

export type NormalizeQuestionContext = {
  subjectId: string;
  groupId: string;
  momentId: string;
  baseId: string;
  index: number;
};

export function normalizeQuestion(
  raw: Record<string, unknown>,
  ctx: NormalizeQuestionContext,
): Record<string, unknown> {
  const type = toString(raw.type, "single_choice");
  const statement = cleanQuestionStatement(toString(raw.statement, "")).trim();
  const difficulty = toString(raw.difficulty, "medium");
  const points = toNumber(raw.points, 1);
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === "string") : undefined;

  const base: Record<string, unknown> = {
    id: `q_${ctx.baseId}_${String(ctx.index + 1).padStart(3, "0")}`,
    type,
    statement,
    subjectId: ctx.subjectId,
    groupIds: [ctx.groupId],
    momentIds: [ctx.momentId],
    difficulty,
    points,
    status: "published",
  };
  if (tags && tags.length) base.tags = tags.slice(0, 12);

  if (type === "single_choice" || type === "multiple_choice") {
    const rawOptions = Array.isArray(raw.options) ? (raw.options as Array<Record<string, unknown>>) : [];
    base.options = normalizeOptions(rawOptions)
      .map((opt) => ({
        ...opt,
        text: cleanQuestionStatement(toString(opt.text, "")).trim(),
      }))
      .filter((o) => toString(o.text, "").trim());
    if (type === "multiple_choice") base.partialCredit = raw.partialCredit === false ? false : true;
    delete (raw as Record<string, unknown>).sourceQuote;
    return base;
  }

  if (type === "open_concept") {
    const rules = (raw.answerRules as Record<string, unknown> | undefined) ?? {};
    const keywords = Array.isArray(rules.keywords) ? (rules.keywords as Array<Record<string, unknown>>) : [];
    base.answerRules = {
      maxWords: toNumber(rules.maxWords, 60),
      passThreshold: toNumber(rules.passThreshold, 0.6),
      keywords: keywords
        .map((k) => ({ term: toString(k.term, "").trim(), weight: toNumber(k.weight, 1) }))
        .filter((k) => k.term),
    };
    return base;
  }

  if (type === "puzzle_order") {
    const puzzle = (raw.puzzle as Record<string, unknown> | undefined) ?? {};
    const items = Array.isArray(puzzle.items) ? (puzzle.items as Array<Record<string, unknown>>) : [];
    base.puzzle = {
      items: items
        .map((it, idx) => ({
          id: toString(it.id, "") || `i${idx + 1}`,
          text: toString(it.text, "").trim(),
          correctPosition: toNumber(it.correctPosition, idx + 1),
        }))
        .filter((it) => it.text),
    };
    return base;
  }

  if (type === "puzzle_match") {
    const puzzle = (raw.puzzle as Record<string, unknown> | undefined) ?? {};
    const leftItems = Array.isArray(puzzle.leftItems) ? (puzzle.leftItems as Array<Record<string, unknown>>) : [];
    const rightItems = Array.isArray(puzzle.rightItems) ? (puzzle.rightItems as Array<Record<string, unknown>>) : [];
    const pairs = Array.isArray(puzzle.pairs) ? (puzzle.pairs as Array<Record<string, unknown>>) : [];
    base.puzzle = {
      leftItems: normalizeOptions(leftItems).filter((o) => toString(o.text, "").trim()),
      rightItems: normalizeOptions(rightItems).filter((o) => toString(o.text, "").trim()),
      pairs: pairs
        .map((p) => ({ leftId: toString(p.leftId, ""), rightId: toString(p.rightId, "") }))
        .filter((p) => p.leftId && p.rightId),
    };
    return base;
  }

  if (type === "puzzle_cloze") {
    const puzzle = (raw.puzzle as Record<string, unknown> | undefined) ?? {};
    const slots = Array.isArray(puzzle.slots) ? (puzzle.slots as Array<Record<string, unknown>>) : [];
    base.puzzle = {
      templateText: toString(puzzle.templateText, "").trim(),
      slots: slots
        .map((s, idx) => {
          const options = Array.isArray(s.options) ? (s.options as Array<Record<string, unknown>>) : [];
          const normalized = normalizeOptions(options).filter((o) => toString(o.text, "").trim());
          const correctOptionId = toString(s.correctOptionId, "") || toString(normalized[0]?.id, "");
          return {
            slotId: toString(s.slotId, "") || `slot_${idx + 1}`,
            options: normalized,
            correctOptionId,
          };
        })
        .filter((s) => s.options.length >= 2 && s.correctOptionId),
    };
    return base;
  }

  return { ...base, type: "single_choice", options: normalizeOptions([]) };
}
