export const MOCK_STUDENTS = [
  { id: 1, name: "Amardeep Singh", fatherName: "Gurpreet Singh", status: "active", studentType: "paid", outstandings: 1200 },
  { id: 2, name: "Balwinder Kaur", fatherName: "Jaswant Singh", status: "active", studentType: "paid", outstandings: 0 },
  { id: 3, name: "Gurleen Kaur", fatherName: "Harjeet Singh", status: "active", studentType: "free", outstandings: 0 },
  { id: 4, name: "Harpreet Singh", fatherName: "Sukhdev Singh", status: "active", studentType: "paid", outstandings: 2400 },
  { id: 5, name: "Jagjeet Singh", fatherName: "Mohinder Singh", status: "active", studentType: "paid", outstandings: 600 },
  { id: 6, name: "Kulwinder Kaur", fatherName: "Dalbir Singh", status: "active", studentType: "paid", outstandings: 0 },
  { id: 7, name: "Manpreet Singh", fatherName: "Amarjit Singh", status: "active", studentType: "free", outstandings: 0 },
  { id: 8, name: "Navjot Kaur", fatherName: "Ranbir Singh", status: "active", studentType: "paid", outstandings: 1800 },
  { id: 9, name: "Simranjit Singh", fatherName: "Kuldeep Singh", status: "active", studentType: "paid", outstandings: 300 },
  { id: 10, name: "Rajveer Kaur", fatherName: "Manjit Singh", status: "active", studentType: "free", outstandings: 0 },
  { id: 11, name: "Harmandeep Singh", fatherName: "Sukhwinder Singh", status: "active", studentType: "paid", outstandings: 900 },
  { id: 12, name: "Gagandeep Kaur", fatherName: "Jasvir Singh", status: "active", studentType: "paid", outstandings: 0 },
  { id: 13, name: "Jaspal Singh", fatherName: "Dalbir Singh", status: "inactive", studentType: "paid", outstandings: 1500 },
  { id: 14, name: "Kuldeep Kaur", fatherName: "Mohinder Singh", status: "active", studentType: "free", outstandings: 0 },
  { id: 15, name: "Mandeep Singh", fatherName: "Harpreet Singh", status: "active", studentType: "paid", outstandings: 450 },
];

export const MOCK_CLASSES = [
  { id: 1, name: "Gurmukhi Class 1", type: "gurmukhi", nextClassId: 2 },
  { id: 2, name: "Gurmukhi Class 2", type: "gurmukhi", nextClassId: 3 },
  { id: 3, name: "Gurmukhi Class 3", type: "gurmukhi", nextClassId: null },
  { id: 4, name: "Kirtan (Tabla Basic)", type: "kirtan", nextClassId: 5 },
  { id: 5, name: "Kirtan (Tabla Advanced)", type: "kirtan", nextClassId: null },
  { id: 6, name: "Kirtan (Dil Rubab)", type: "kirtan", nextClassId: null },
];

export const MOCK_SECTIONS = {
  1: [{ id: 101, name: "Pehli" }, { id: 102, name: "Doosri" }],
  2: [{ id: 201, name: "Pehli" }, { id: 202, name: "Doosri" }],
  3: [{ id: 301, name: "Pehli" }, { id: 302, name: "Doosri" }],
  4: [{ id: 401, name: "Tabla" }, { id: 402, name: "Dil Rubab" }],
  5: [{ id: 501, name: "Tabla" }],
  6: [{ id: 601, name: "Dil Rubab" }],
};

export const MOCK_ENROLLMENTS = {
  1: [
    { classId: 1, sectionId: 101, className: "Gurmukhi Class 1", sectionName: "Pehli", startedAt: "2025-04-01", outcome: null },
    { classId: 4, sectionId: 401, className: "Kirtan (Tabla Basic)", sectionName: "Tabla", startedAt: "2025-04-01", outcome: null },
  ],
  2: [
    { classId: 2, sectionId: 201, className: "Gurmukhi Class 2", sectionName: "Pehli", startedAt: "2025-04-01", outcome: null },
  ],
  3: [
    { classId: 1, sectionId: 102, className: "Gurmukhi Class 1", sectionName: "Doosri", startedAt: "2025-09-01", outcome: null },
    { classId: 4, sectionId: 402, className: "Kirtan (Tabla Basic)", sectionName: "Dil Rubab", startedAt: "2025-09-01", outcome: null },
  ],
  4: [
    { classId: 1, sectionId: 101, className: "Gurmukhi Class 1", sectionName: "Pehli", startedAt: "2025-04-01", outcome: null },
  ],
  5: [
    { classId: 3, sectionId: 301, className: "Gurmukhi Class 3", sectionName: "Pehli", startedAt: "2024-04-01", outcome: null },
  ],
  6: [
    { classId: 2, sectionId: 202, className: "Gurmukhi Class 2", sectionName: "Doosri", startedAt: "2025-04-01", outcome: null },
  ],
  7: [
    { classId: 1, sectionId: 102, className: "Gurmukhi Class 1", sectionName: "Doosri", startedAt: "2025-04-01", outcome: null },
  ],
  8: [
    { classId: 2, sectionId: 201, className: "Gurmukhi Class 2", sectionName: "Pehli", startedAt: "2024-04-01", outcome: null },
  ],
  9: [
    { classId: 3, sectionId: 302, className: "Gurmukhi Class 3", sectionName: "Doosri", startedAt: "2025-04-01", outcome: null },
  ],
  10: [
    { classId: 1, sectionId: 101, className: "Gurmukhi Class 1", sectionName: "Pehli", startedAt: "2025-09-01", outcome: null },
  ],
  11: [
    { classId: 5, sectionId: 501, className: "Kirtan (Tabla Advanced)", sectionName: "Tabla", startedAt: "2025-04-01", outcome: null },
  ],
  12: [
    { classId: 1, sectionId: 102, className: "Gurmukhi Class 1", sectionName: "Doosri", startedAt: "2025-04-01", outcome: null },
    { classId: 4, sectionId: 401, className: "Kirtan (Tabla Basic)", sectionName: "Tabla", startedAt: "2025-04-01", outcome: null },
  ],
  13: [
    { classId: 2, sectionId: 202, className: "Gurmukhi Class 2", sectionName: "Doosri", startedAt: "2024-04-01", outcome: null },
  ],
  14: [
    { classId: 1, sectionId: 101, className: "Gurmukhi Class 1", sectionName: "Pehli", startedAt: "2025-04-01", outcome: null },
  ],
  15: [
    { classId: 3, sectionId: 301, className: "Gurmukhi Class 3", sectionName: "Pehli", startedAt: "2024-04-01", outcome: null },
  ],
};

export function resolveNextClass(currentClassId) {
  const cls = MOCK_CLASSES.find((c) => c.id === currentClassId);
  if (!cls || cls.nextClassId === null) return null;
  return MOCK_CLASSES.find((c) => c.id === cls.nextClassId) || null;
}

export function resolveNextClassForEnrollments(enrollments) {
  const gurmukhi = enrollments.find((e) => {
    const cls = MOCK_CLASSES.find((c) => c.id === e.classId);
    return cls && cls.type === "gurmukhi";
  });
  const kirtan = enrollments.find((e) => {
    const cls = MOCK_CLASSES.find((c) => c.id === e.classId);
    return cls && cls.type === "kirtan";
  });
  const results = [];
  if (gurmukhi) {
    const next = resolveNextClass(gurmukhi.classId);
    if (next) results.push({ enrollment: gurmukhi, nextClass: next });
  }
  if (kirtan) {
    const next = resolveNextClass(kirtan.classId);
    if (next) results.push({ enrollment: kirtan, nextClass: next });
  }
  return results;
}

export const MOCK_HISTORY = {
  5: [
    { classId: 2, sectionId: 201, className: "Gurmukhi Class 2", sectionName: "Pehli", startedAt: "2023-04-01", transferredAt: "2024-03-31", outcome: "promoted" },
  ],
  8: [
    { classId: 1, sectionId: 102, className: "Gurmukhi Class 1", sectionName: "Doosri", startedAt: "2023-04-01", transferredAt: "2024-03-31", outcome: "promoted" },
  ],
  15: [
    { classId: 2, sectionId: 202, className: "Gurmukhi Class 2", sectionName: "Doosri", startedAt: "2023-04-01", transferredAt: "2024-03-31", outcome: "promoted" },
    { classId: 1, sectionId: 101, className: "Gurmukhi Class 1", sectionName: "Pehli", startedAt: "2022-04-01", transferredAt: "2023-03-31", outcome: "promoted" },
  ],
};
