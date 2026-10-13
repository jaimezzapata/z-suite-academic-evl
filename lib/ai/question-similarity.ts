import type { ReadmeGroundingIndex } from "./types";

export function normalizeForGrounding(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/```[a-z0-9_-]*\s*/gi, " ")
    .replace(/```/g, " ")
    .replace(/[#>*_`~\-|!\\\[\](){}]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanQuestionStatement(statement: string): string {
  if (!statement) return "";
  return statement
    .replace(/\s*\(reformulaci[oó]n\s*\d*\)/gi, "")
    .replace(/\s*\(variante\s*\d*\)/gi, "")
    .replace(/\s*\(versi[oó]n\s*\d*\)/gi, "")
    .replace(/\s*\(pregunta\s+repetida\s*\d*\)/gi, "")
    .replace(/\s*\(duplicad[oa]\s*\d*\)/gi, "")
    .replace(/^(?:reformulaci[oó]n\s*\d*[:.-]\s*)+/gi, "")
    .replace(/^(?:variante\s*\d*[:.-]\s*)+/gi, "")
    .trim();
}

export function normalizeStatementForComparison(statement: string): string {
  return normalizeForGrounding(cleanQuestionStatement(statement));
}

const STOP_WORDS = new Set([
  "que", "los", "las", "del", "una", "unos", "unas", "por", "para", "pero", "sino", "como", "este", "esta", "estos", "estas",
  "esto", "aquel", "aquella", "aquellos", "aquellas", "hace", "hacia", "tambien", "tampoco", "entre", "durante", "sobre",
  "todo", "todos", "toda", "todas", "cual", "cuales", "donde", "cuando", "cuanto", "cuanta", "otros", "otra", "ante",
  "desde", "hasta", "contra", "sin", "mientras", "despues", "antes", "aunque", "entonces", "luego", "ahora", "mismo",
  "misma", "ellos", "ellas", "nosotros", "vosotros", "usted", "tienen", "tiene", "hayan", "hayas", "ser", "estar",
  "sido", "siendo", "aqui", "alli", "cerca", "lejos", "parte", "muy", "mas", "menos", "poco", "mucho",
  "tan", "casi", "solo", "nada", "algo", "nunca", "siempre",
]);

export function tokenize(text: string, minLen = 3): Set<string> {
  const norm = normalizeForGrounding(text);
  return new Set(
    norm
      .split(/\s+/)
      .filter((w) => w.length >= minLen && !STOP_WORDS.has(w)),
  );
}

export function getStatementJaccardSimilarity(str1: string, str2: string): number {
  const t1 = tokenize(str1, 2);
  const t2 = tokenize(str2, 2);
  if (t1.size === 0 && t2.size === 0) return 1;
  if (t1.size === 0 || t2.size === 0) return 0;
  let intersection = 0;
  t1.forEach((t) => {
    if (t2.has(t)) intersection++;
  });
  const union = new Set([...t1, ...t2]).size;
  return union > 0 ? intersection / union : 0;
}

export function isDuplicateQuestion(candidateStatement: string, existingStatements: string[]): boolean {
  const normCandidate = normalizeStatementForComparison(candidateStatement);
  if (!normCandidate) return true;
  for (const existing of existingStatements) {
    const normExisting = normalizeStatementForComparison(existing);
    if (normCandidate === normExisting) return true;
    const similarity = getStatementJaccardSimilarity(candidateStatement, existing);
    if (similarity >= 0.85) return true;
  }
  return false;
}

export function buildReadmeGroundingIndex(markdown: string): ReadmeGroundingIndex {
  const normalized = normalizeForGrounding(markdown);
  return { normalizedFull: normalized, tokenSet: tokenize(markdown, 3) };
}

export function overlapRatio(text: string, index: ReadmeGroundingIndex): number {
  const tokens = tokenize(text, 3);
  if (tokens.size === 0) return 0;
  let matched = 0;
  tokens.forEach((t) => {
    if (
      index.tokenSet.has(t) ||
      index.normalizedFull.includes(` ${t} `) ||
      index.normalizedFull.startsWith(t + " ") ||
      index.normalizedFull.endsWith(" " + t)
    ) {
      matched += 1;
    }
  });
  return matched / tokens.size;
}

export function validateQuestionGrounding(
  q: Record<string, unknown>,
  index: ReadmeGroundingIndex,
): { ok: boolean; reason?: string } {
  const type = typeof q.type === "string" ? q.type : "";
  const statement = cleanQuestionStatement(typeof q.statement === "string" ? q.statement : "");
  if (!statement) return { ok: false, reason: "statement vacío" };

  const statementTokens = tokenize(statement, 3);
  const statementOverlap = overlapRatio(statement, index);
  const significantHits = [...statementTokens].filter(
    (t) => index.tokenSet.has(t) || index.normalizedFull.includes(` ${t} `),
  ).length;

  if (significantHits < 2 && statementOverlap < 0.2) {
    return {
      ok: false,
      reason: `statement tiene pocos términos del README (hits: ${significantHits}, overlap: ${Math.round(
        statementOverlap * 100,
      )}%)`,
    };
  }

  if (type === "single_choice" || type === "multiple_choice") {
    const opts = Array.isArray(q.options) ? (q.options as Array<Record<string, unknown>>) : [];
    if (!opts.length) return { ok: false, reason: "sin opciones" };
    const validOpts = opts.filter((o) => (typeof o?.text === "string" ? o.text.trim().length > 0 : false));
    if (validOpts.length < 2) return { ok: false, reason: "menos de 2 opciones válidas" };
    const correctOptions = validOpts.filter(
      (o) => o && typeof o === "object" && (o as { isCorrect?: unknown }).isCorrect === true,
    );
    if (correctOptions.length === 0) return { ok: false, reason: "ninguna opción marcada como correcta" };
  }

  if (type === "open_concept") {
    const rules = (q.answerRules as Record<string, unknown> | undefined) ?? {};
    const kws = Array.isArray(rules.keywords) ? (rules.keywords as Array<Record<string, unknown>>) : [];
    const validKeywords = kws.filter((kw) => {
      const term = typeof kw?.term === "string" ? kw.term.trim() : "";
      return term && index.normalizedFull.includes(normalizeForGrounding(term));
    });
    if (kws.length > 0 && validKeywords.length === 0) {
      return { ok: false, reason: "ningún keyword aparece en el README" };
    }
  }

  return { ok: true };
}
