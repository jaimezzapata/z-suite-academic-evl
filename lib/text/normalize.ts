export type NormalizeResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

function normalizeSpaces(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function isValidText(input: string) {
  return /^[\p{L}\p{M}0-9 .,'-]+$/u.test(input);
}

function toTitleToken(token: string, locale: string) {
  if (!token) return token;
  const lower = token.toLocaleLowerCase(locale);
  return lower[0]?.toLocaleUpperCase(locale) + lower.slice(1);
}

function normalizeTokenSmart(token: string, locale: string) {
  if (!token) return token;

  if (/^[A-Z]{2,6}$/.test(token)) return token;
  if (/^m\d+$/i.test(token)) return `M${token.slice(1)}`;
  if (/^\d+[A-Za-z]$/.test(token)) return token.slice(0, -1) + token.slice(-1).toUpperCase();
  if (/^\d+$/.test(token)) return token;

  return token.toLocaleLowerCase(locale);
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

  const tokens = spaced.split(" ");
  const normalizedTokens = tokens.map((t) => normalizeTokenSmart(t, locale));

  const firstToken = normalizedTokens[0] ?? "";
  const restTokens = normalizedTokens.slice(1).map((t) => t.toLocaleLowerCase(locale));
  const sentence = [toTitleToken(firstToken, locale), ...restTokens].join(" ");
  return { ok: true, value: sentence };
}

export function normalizePersonNamePart(input: string, locale = "es-CO"): NormalizeResult {
  const spaced = normalizeSpaces(input);
  if (!spaced) return { ok: false, error: "El campo no puede estar vacio." };
  if (!/^[\p{L}\p{M} .'-]+$/u.test(spaced)) {
    return { ok: false, error: "El nombre contiene caracteres no permitidos." };
  }

  const parts = spaced
    .split(" ")
    .filter(Boolean)
    .map((p) => toTitleToken(p, locale));

  return { ok: true, value: parts.join(" ") };
}

export function normalizeFullName(firstName: string, lastName: string, locale = "es-CO"): NormalizeResult {
  const first = normalizePersonNamePart(firstName, locale);
  if (!first.ok) return first;
  const last = normalizePersonNamePart(lastName, locale);
  if (!last.ok) return last;
  return { ok: true, value: `${first.value} ${last.value}` };
}

