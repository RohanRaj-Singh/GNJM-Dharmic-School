  function reloadData() {
  setLoading(true);
  setUiReady(false);

  Promise.all([
    fetch("/admin/students/data").then((r) => r.json()),
    fetch("/admin/classes/options").then((r) => r.json()),
  ])
    .then(([students, classes]) => {
      const normalized = students.map((s) => ({
        ...s,
        enrollments: (s.enrollments || []).map((e) => ({
          id: e.id ?? crypto.randomUUID(), // stable key
          class_id: String(e.class_id ?? ""),
          section_id: String(e.section_id ?? ""),
          student_type: e.student_type ?? "paid",
        })),
      }));

      setData(normalized);
      setClasses(classes);
    })
    .catch((err) => {
      console.error("Failed to load students:", err);
      toast.error("Failed to load students");
    })
    .finally(() => {
      setLoading(false);   // ✅ THIS WAS MISSING
    });
}

  useEffect(() => {
    reloadData();
  }, []);
