import { useState, useEffect, useCallback, useRef } from "react";
import { router } from "@inertiajs/react";
import toast from "react-hot-toast";
import Modal from "@/Components/Modal";
import EditorBasicInfo from "./EditorBasicInfo";
import EditorEnrollments from "./EditorEnrollments";

const safeUUID = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function emptyStudent() {
  return {
    id: null,
    name: "",
    father_name: "",
    father_phone: "",
    mother_phone: "",
    status: "active",
    enrollments: [],
  };
}

export default function StudentEditorModal({
  isOpen,
  onClose,
  student,
  classes,
  onSaved,
}) {
  const isCreate = !student?.id;
  const initialData = useRef(null);

  /* ----------------------------------------
   | Form state
   ---------------------------------------- */
  const [formData, setFormData] = useState(emptyStudent());
  const [sectionsCache, setSectionsCache] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  /* ----------------------------------------
   | Reset form when modal opens
   ---------------------------------------- */
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setValidationErrors({});
    setIsSaving(false);

    if (student?.id) {
      const data = {
        id: student.id,
        name: student.name || "",
        father_name: student.father_name || "",
        father_phone: student.father_phone || "",
        mother_phone: student.mother_phone || "",
        status: student.status || "active",
        enrollments: (student.enrollments || []).map((e) => ({
          id: e.id ?? safeUUID(),
          class_id: String(e.class_id || ""),
          section_id: String(e.section_id || ""),
          student_type: e.student_type || "paid",
          status: e.status || "active",
        })),
      };
      initialData.current = data;
      setFormData(data);
    } else {
      initialData.current = emptyStudent();
      setFormData(emptyStudent());
    }
    setSectionsCache({});
  }, [isOpen, student]);

  /* ----------------------------------------
   | Handlers
   ---------------------------------------- */
  const handleBasicInfoChange = useCallback((key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setValidationErrors((prev) => ({ ...prev, [key]: null }));
  }, []);

  const handleStatusChange = useCallback((newStatus) => {
    setFormData((prev) => ({
      ...prev,
      status: newStatus,
      enrollments: prev.enrollments.map((e) => ({
        ...e,
        status: newStatus,
      })),
    }));
  }, []);

  const handleEnrollmentChange = useCallback((enrollmentId, key, value) => {
    setFormData((prev) => ({
      ...prev,
      enrollments: prev.enrollments.map((e) =>
        String(e.id) === String(enrollmentId)
          ? { ...e, [key]: value }
          : e
      ),
    }));
  }, []);

  const handleRemoveEnrollment = useCallback((enrollmentId) => {
    setFormData((prev) => ({
      ...prev,
      enrollments: prev.enrollments.filter(
        (e) => String(e.id) !== String(enrollmentId)
      ),
    }));
  }, []);

  const handleAddEnrollment = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      enrollments: [
        ...prev.enrollments,
        {
          id: safeUUID(),
          class_id: "",
          section_id: "",
          student_type: "paid",
          status: "active",
        },
      ],
    }));
  }, []);

  const loadSections = useCallback((classId) => {
    const key = String(classId);
    if (!classId || sectionsCache[key]) return;

    fetch(`/admin/sections/options?class_id=${classId}`)
      .then((r) => r.json())
      .then((sections) =>
        setSectionsCache((prev) => ({ ...prev, [key]: sections }))
      )
      .catch(() => {});
  }, [sectionsCache]);

  /* ----------------------------------------
   | Validation
   ---------------------------------------- */
  function validate() {
    const errors = {};

    if (!formData.name?.trim()) {
      errors.name = "Student name is required";
    }

    if (!formData.enrollments?.length) {
      errors.enrollments = "At least one enrollment is required";
    }

    const seen = new Set();
    for (const e of formData.enrollments || []) {
      if (!e.class_id || !e.section_id) {
        errors.enrollments = "Each enrollment needs a class and section";
        break;
      }
      const key = `${e.class_id}-${e.section_id}`;
      if (seen.has(key)) {
        errors.enrollments = "Duplicate class + section enrollment";
        break;
      }
      seen.add(key);
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /* ----------------------------------------
   | Save
   ---------------------------------------- */
  function handleSave() {
    if (isSaving) return;
    if (!validate()) return;

    setIsSaving(true);
    setError(null);

    const payload = {
      students: [
        {
          id: formData.id,
          name: formData.name,
          father_name: formData.father_name,
          father_phone: formData.father_phone,
          mother_phone: formData.mother_phone,
          status: formData.status,
          enrollments: formData.enrollments.map((e) => ({
            id: typeof e.id === "number" ? e.id : null,
            class_id: e.class_id,
            section_id: e.section_id,
            student_type: e.student_type,
            status: e.status,
          })),
        },
      ],
    };

    router.post("/admin/students/bulk-update", payload, {
      preserveScroll: true,
      onSuccess: () => {
        toast.success(isCreate ? "Student created" : "Student updated");
        setIsSaving(false);
        onSaved?.();
        onClose();
      },
      onError: (errs) => {
        setIsSaving(false);
        if (typeof errs === "string") {
          setError(errs);
        } else if (errs?.message) {
          setError(errs.message);
        } else {
          setError("Failed to save. Please check the form and try again.");
        }
      },
    });
  }

  /* ----------------------------------------
   | Render
   ---------------------------------------- */
  return (
    <Modal show={isOpen} onClose={onClose} maxWidth="2xl">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">
            {isCreate ? "Add New Student" : "Edit Student"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="mb-6">
          <EditorBasicInfo
            data={{
              name: formData.name,
              father_name: formData.father_name,
              father_phone: formData.father_phone,
              mother_phone: formData.mother_phone,
            }}
            onChange={handleBasicInfoChange}
          />
          {validationErrors.name && (
            <p className="mt-1 text-xs text-red-500">{validationErrors.name}</p>
          )}
        </div>

        {/* Separator */}
        <hr className="my-6" />

        {/* Enrollments */}
        <div className="mb-6">
          <EditorEnrollments
            enrollments={formData.enrollments}
            classes={classes}
            sectionsCache={sectionsCache}
            loadSections={loadSections}
            onChange={handleEnrollmentChange}
            onRemove={handleRemoveEnrollment}
            onAdd={handleAddEnrollment}
          />
          {validationErrors.enrollments && (
            <p className="mt-1 text-xs text-red-500">
              {validationErrors.enrollments}
            </p>
          )}
        </div>

        {/* Separator */}
        <hr className="my-6" />

        {/* Status */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-700 mb-2">Status</h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleStatusChange("active")}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                formData.status === "active"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange("inactive")}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                formData.status === "inactive"
                  ? "bg-amber-500 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              Inactive
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {formData.status === "inactive"
              ? "Inactive students are excluded from attendance, fees, and reports. All enrollments will be marked inactive."
              : "Active students appear in attendance, fees, and all reports."}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
