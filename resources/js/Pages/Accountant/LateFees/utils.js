export function normalizeText(value) {
  return String(value ?? "").trim();
}

// "all" sentinel — applies to the class/section filter IDs.
export const ALL_FILTER = "all";

export function hasActiveFilters({ classFilter, sectionFilter, search }) {
  return (
    classFilter !== ALL_FILTER ||
    sectionFilter !== ALL_FILTER ||
    normalizeText(search) !== ""
  );
}

// Build the class filter list keyed by class ID (collision-safe). Display
// label is still the class name. See
// docs/architecture/14-Accountant-Teacher-UI-UX-Audit.md §2.4.
export function buildClassOptions(items = []) {
  const byId = new Map();
  for (const item of items) {
    const id = item?.class_id;
    const name = normalizeText(item?.class);
    if (id == null || name === "") continue;
    if (!byId.has(id)) byId.set(id, { id, name });
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export function buildSectionOptions(items = [], classFilter) {
  const source =
    classFilter === ALL_FILTER
      ? items
      : items.filter((item) => String(item?.class_id) === String(classFilter));

  const byId = new Map();
  for (const item of source) {
    const id = item?.section_id;
    const name = normalizeText(item?.section);
    if (id == null || name === "") continue;
    if (!byId.has(id)) byId.set(id, { id, name });
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export function applyFilters(items = [], { classFilter, sectionFilter, search }) {
  const term = normalizeText(search).toLowerCase();

  return items.filter((item) => {
    const clsId = item?.class_id;
    const secId = item?.section_id;
    const clsName = normalizeText(item?.class);
    const secName = normalizeText(item?.section);
    const student = normalizeText(item?.student).toLowerCase();

    if (classFilter !== ALL_FILTER && String(clsId) !== String(classFilter)) {
      return false;
    }
    if (sectionFilter !== ALL_FILTER && String(secId) !== String(sectionFilter)) {
      return false;
    }

    if (!term) return true;

    return (
      student.includes(term) ||
      clsName.toLowerCase().includes(term) ||
      secName.toLowerCase().includes(term)
    );
  });
}

export function getFilteredTotal(items = []) {
  return items.reduce((sum, item) => sum + Number(item?.amount ?? 0), 0);
}

export function dedupeFeesByMonth(fees = []) {
  return Object.values(
    fees.reduce((acc, fee) => {
      const monthKey = normalizeText(fee?.month) || "__unknown__";
      const currentAmount = Number(fee?.amount ?? 0);
      const existingAmount = Number(acc[monthKey]?.amount ?? 0);

      if (!acc[monthKey] || currentAmount >= existingAmount) {
        acc[monthKey] = fee;
      }

      return acc;
    }, {})
  );
}

export function groupFeesByStudent(items = []) {
  return items.reduce((acc, item) => {
    const key = `${item?.student_id ?? "unknown"}-${normalizeText(item?.section)}`;

    if (!acc[key]) {
      acc[key] = {
        student_id: item?.student_id,
        student: normalizeText(item?.student) || "Unknown Student",
        father_name: normalizeText(item?.father_name) || "",
        class: normalizeText(item?.class) || "-",
        section: normalizeText(item?.section) || "-",
        fees: [],
      };
    }

    acc[key].fees.push({
      month: normalizeText(item?.month) || "-",
      amount: Number(item?.amount ?? 0),
    });

    return acc;
  }, {});
}
