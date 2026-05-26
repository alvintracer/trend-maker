export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeKeyword(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

export function normalizeKeywordLoose(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[\[\]\(\)\{\}<>"'`~!@#$%^&*_+=|\\/.,?:;-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
