export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function hasActiveFilters({ classFilter, sectionFilter, search }) {
  return (
    classFilter !== "all" ||
    sectionFilter !== "all" ||
    normalizeText(search) !== ""
  );
}

export function buildClassOptions(items = []) {
  return Array.from(
    new Set(items.map((item) => normalizeText(item?.class)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

export function buildSectionOptions(items = [], classFilter) {
  const source =
    classFilter === "all"
      ? items
      : items.filter((item) => normalizeText(item?.class) === classFilter);

  return Array.from(
    new Set(source.map((item) => normalizeText(item?.section)).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

export function applyFilters(items = [], { classFilter, sectionFilter, search }) {
  const term = normalizeText(search).toLowerCase();

  return items.filter((item) => {
    const cls = normalizeText(item?.class);
    const sec = normalizeText(item?.section);
    const student = normalizeText(item?.student).toLowerCase();

    if (classFilter !== "all" && cls !== classFilter) return false;
    if (sectionFilter !== "all" && sec !== sectionFilter) return false;

    if (!term) return true;

    return (
      student.includes(term) ||
      cls.toLowerCase().includes(term) ||
      sec.toLowerCase().includes(term)
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
