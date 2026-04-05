export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function classMatchesFilter(type, classFilter) {
  const normalizedType = normalizeText(type).toLowerCase();

  if (!normalizedType) {
    return true;
  }

  return normalizedType === classFilter || normalizedType.includes(classFilter);
}

export function buildStudentRows(students = [], { search, classFilter }) {
  const term = normalizeText(search).toLowerCase();

  return students.filter((student) => {
    const matchesSearch =
      !term ||
      normalizeText(student?.name).toLowerCase().includes(term) ||
      normalizeText(student?.father_name).toLowerCase().includes(term);

    if (!matchesSearch) {
      return false;
    }

    const enrollments = student?.enrollments ?? [];

    return enrollments.some((enrollment) =>
      classMatchesFilter(enrollment?.school_class?.type, classFilter)
    );
  });
}

export function getEnrollmentBadges(enrollments = []) {
  return enrollments.map((enrollment) => {
    const schoolClassName = enrollment?.school_class?.name ?? "Class";
    const sectionName = enrollment?.section?.name ?? "Section";
    const type = normalizeText(enrollment?.school_class?.type).toLowerCase();

    return {
      id: enrollment?.id ?? `${schoolClassName}-${sectionName}`,
      label: `${schoolClassName} - ${sectionName}`,
      isKirtan: type.includes("kirtan"),
    };
  });
}
