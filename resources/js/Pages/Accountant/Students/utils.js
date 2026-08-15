import { division, isKirtan } from "@/utils/divisionType";

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function classMatchesFilter(schoolClass, classFilter) {
  // "all" is the no-filter sentinel — every class matches.
  const filter = String(classFilter ?? "").trim().toLowerCase();
  if (filter === "" || filter === "all") return true;

  return division(schoolClass?.type, schoolClass?.name, schoolClass?.division) === filter;
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
      classMatchesFilter(enrollment?.school_class, classFilter)
    );
  });
}

export function getEnrollmentBadges(enrollments = []) {
  return enrollments.map((enrollment) => {
    const schoolClassName = enrollment?.school_class?.name ?? "Class";
    const sectionName = enrollment?.section?.name ?? "Section";

    return {
      id: enrollment?.id ?? `${schoolClassName}-${sectionName}`,
      label: `${schoolClassName} - ${sectionName}`,
      isKirtan: isKirtan(
        enrollment?.school_class?.type,
        enrollment?.school_class?.name
      ),
    };
  });
}
