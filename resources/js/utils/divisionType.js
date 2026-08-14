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

/* =====================================================================
   Division presentation metadata (Stage B).
   Legacy divisions keep their fixed title + color; any third+ division
   (a division key the resolver returns) gets a deterministic generated
   title and a stable hash-picked color from a palette — never a hardcoded
   third-class color.
   ===================================================================== */

const LEGACY_META = {
  gurmukhi: {
    title: "Gurmukhi",
    text: "text-blue-700",
    bg: "bg-blue-50",
    bgHover: "hover:bg-blue-100",
    accent: "text-blue-600",
  },
  kirtan: {
    title: "Kirtan",
    text: "text-purple-700",
    bg: "bg-purple-50",
    bgHover: "hover:bg-purple-100",
    accent: "text-purple-600",
  },
};

// Palette for generated divisions — full class strings so Tailwind keeps them.
const PALETTE = [
  { text: "text-emerald-700", bg: "bg-emerald-50", bgHover: "hover:bg-emerald-100", accent: "text-emerald-600" },
  { text: "text-orange-700", bg: "bg-orange-50", bgHover: "hover:bg-orange-100", accent: "text-orange-600" },
  { text: "text-teal-700", bg: "bg-teal-50", bgHover: "hover:bg-teal-100", accent: "text-teal-600" },
  { text: "text-rose-700", bg: "bg-rose-50", bgHover: "hover:bg-rose-100", accent: "text-rose-600" },
  { text: "text-indigo-700", bg: "bg-indigo-50", bgHover: "hover:bg-indigo-100", accent: "text-indigo-600" },
];

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function stableHash(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Presentation metadata for a division key: a human title plus Tailwind color
 * classes (heading text, header background, hover background, accent text).
 * Gurmukhi/Kirtan keep their legacy colors; any other key gets a deterministic
 * palette color and a title-cased label.
 */
export function divisionMeta(divisionKey) {
  const key = String(divisionKey ?? "").trim().toLowerCase();
  if (LEGACY_META[key]) return LEGACY_META[key];

  const palette = PALETTE[stableHash(key) % PALETTE.length];
  return {
    title: key === "" ? "Class" : titleCase(key),
    ...palette,
  };
}
