export type NormalizeResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

function normalizeSpaces(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function isValidText(input: string) {
  return /^[\p{L}\p{M}0-9 .,'-]+$/u.test(input);
}

export function normalizeSentenceText(input: string, locale = "es-CO"): NormalizeResult {
  const spaced = normalizeSpaces(input);
  if (!spaced) return { ok: false, error: "El texto no puede estar vacio." };
  if (!isValidText(spaced)) {
    return {
      ok: false,
      error: "El texto contiene caracteres no permitidos.",
    };
  }
  return { ok: true, value: spaced.toLocaleUpperCase(locale) };
}

export function normalizePersonNamePart(input: string, locale = "es-CO"): NormalizeResult {
  const spaced = normalizeSpaces(input);
  if (!spaced) return { ok: false, error: "El campo no puede estar vacio." };
  if (!/^[\p{L}\p{M} .'-]+$/u.test(spaced)) {
    return { ok: false, error: "El nombre contiene caracteres no permitidos." };
  }
  return { ok: true, value: spaced.toLocaleUpperCase(locale) };
}

export function normalizeFullName(firstName: string, lastName: string, locale = "es-CO"): NormalizeResult {
  const first = normalizePersonNamePart(firstName, locale);
  if (!first.ok) return first;
  const last = normalizePersonNamePart(lastName, locale);
  if (!last.ok) return last;
  return { ok: true, value: `${first.value} ${last.value}` };
}
