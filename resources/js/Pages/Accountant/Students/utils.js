import { division, divisionMeta } from "@/utils/divisionType";

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

    // Resolve the division via the 3-arg resolver (honors the explicit
    // classes.division seam — see class-rename-bucket-lock). Then pull
    // presentation classes from divisionMeta() so a third+ division badge
    // inherits the deterministic palette with no JSX change here.
    const divisionKey = division(
      enrollment?.school_class?.type,
      enrollment?.school_class?.name,
      enrollment?.school_class?.division
    );
    const meta = divisionMeta(divisionKey);

    return {
      id: enrollment?.id ?? `${schoolClassName}-${sectionName}`,
      label: `${schoolClassName} - ${sectionName}`,
      divisionKey,
      pillBg: meta.pillBg,
      pillText: meta.pillText,
    };
  });
}
