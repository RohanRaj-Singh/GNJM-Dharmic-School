/**
 * Front-end twin of app\Support\DivisionTypeResolver (Sprint 1.3).
 *
 * Single source of truth for "which curriculum division does this class
 * belong to?" on the client. It mirrors the server rule exactly so the
 * attendance day-rule UI and the backend redirects can never disagree.
 *
 * Resolution order (all comparisons lowercase + trimmed):
 *  0. explicit division (non-empty)   -> returned verbatim   [Stage A2 seam]
 *  1. type contains 'kirtan'          -> "kirtan"
 *  2. type contains 'gurmukhi'        -> "gurmukhi"
 *  3. name (non-empty) contains 'kirtan' -> "kirtan"
 *  4. otherwise                       -> "gurmukhi"
 *
 * The explicit division (the nullable classes.division value) wins over every
 * inference rule — the seam that lets a third+ class escape the Gurmukhi
 * bucket. NULL/blank falls through to the unchanged legacy logic.
 *
 * The name fallback is intentionally kirtan-only: it exists so legacy rows
 * with a NULL/blank type but a Kirtan class name still honour the Sunday
 * day-rule. A Gurmukhi *name* never matches; unknown types collapse to the
 * default (gurmukhi).
 */
export function division(classType, className = null, explicitDivision = null) {
  const explicit = String(explicitDivision ?? "").trim().toLowerCase();
  if (explicit !== "") return explicit;

  const type = String(classType ?? "").trim().toLowerCase();
  const name = String(className ?? "").trim().toLowerCase();

  if (type.includes("kirtan")) return "kirtan";
  if (type.includes("gurmukhi")) return "gurmukhi";
  if (name !== "" && name.includes("kirtan")) return "kirtan";
  return "gurmukhi";
}

export function isKirtan(classType, className = null, explicitDivision = null) {
  return division(classType, className, explicitDivision) === "kirtan";
}

export function isGurmukhi(classType, className = null, explicitDivision = null) {
  return division(classType, className, explicitDivision) === "gurmukhi";
}
