import { useEffect, useCallback, useRef, useState } from "react";

export function useUnsavedChangesWarning(enabled = true, hasChanges = false) {
  const [showConfirm, setShowConfirm] = useState(false);
  const pendingCallback = useRef(null);

  useEffect(() => {
    if (!enabled || !hasChanges) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, hasChanges]);

  const confirmNavigation = useCallback((callback) => {
    if (!hasChanges) {
      callback();
      return;
    }
    pendingCallback.current = callback;
    setShowConfirm(true);
  }, [hasChanges]);

  const handleConfirm = useCallback(() => {
    setShowConfirm(false);
    if (pendingCallback.current) {
      pendingCallback.current();
      pendingCallback.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    setShowConfirm(false);
    pendingCallback.current = null;
  }, []);

  return { showConfirm, confirmNavigation, handleConfirm, handleCancel };
}

export function UnsavedChangesModal({ isOpen, onConfirm, onCancel, title = "Unsaved Changes", message = "You have unsaved changes. Are you sure you want to leave?" }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium">Stay</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 font-medium">Leave</button>
        </div>
      </div>
    </div>
  );
}