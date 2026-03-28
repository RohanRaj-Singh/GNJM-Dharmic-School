import { useState, useEffect, useRef, useCallback } from "react";

/**
 * LogoutModal - A standalone, accessible modal component
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {Function} props.onConfirm - Callback when user confirms
 * @param {Function} props.onCancel - Callback when user cancels
 * @param {string} [props.title="Logout?"] - Modal title
 * @param {string} [props.message="Are you sure you want to logout?"] - Modal message
 * @param {string} [props.confirmLabel="Logout"] - Confirm button label
 * @param {string} [props.cancelLabel="Cancel"] - Cancel button label
 * @param {React.Ref} [props.closeButtonRef] - Ref to return focus to after closing
 * @param {boolean} [props.preventBackButton=true] - Prevent back button when modal is open
 */
export default function LogoutModal({
  isOpen,
  onConfirm,
  onCancel,
  title = "Logout?",
  message = "Are you sure you want to logout?",
  confirmLabel = "Logout",
  cancelLabel = "Cancel",
  closeButtonRef,
  preventBackButton = true
}) {
  const [error, setError] = useState(null);
  const modalRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const previousActiveElement = useRef(null);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      onCancel();
    }
    
    if (e.key === "Tab") {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements && focusableElements.length > 0) {
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }, [onCancel]);

  // Prevent back button navigation when modal is open
  useEffect(() => {
    if (!isOpen || !preventBackButton) return;

    const handlePopState = (e) => {
      // Prevent the back navigation - push state back
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
    };

    window.addEventListener('popstate', handlePopState, { passive: false });
    
    // Also push state initially when modal opens to prevent back
    window.history.pushState({ modalOpen: true }, '', window.location.href);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, preventBackButton]);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement;
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleKeyDown);
      
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
    } else {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      } else if (closeButtonRef?.current) {
        closeButtonRef.current.focus();
      }
    }

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown, closeButtonRef]);

  const handleConfirm = async () => {
    try {
      setError(null);
      await onConfirm();
    } catch (err) {
      setError(err.message || "Logout failed. Please try again.");
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-modal-title"
      aria-describedby="logout-modal-description"
      onClick={handleBackdropClick}
    >
      <div className="absolute inset-0 bg-black/50" />
      
      <div 
        ref={modalRef}
        className="relative bg-white rounded-xl p-6 max-w-sm mx-4 shadow-2xl w-full"
      >
        <h3 
          id="logout-modal-title" 
          className="text-lg font-semibold text-gray-900 mb-2"
        >
          {title}
        </h3>
        
        <p 
          id="logout-modal-description" 
          className="text-gray-600 mb-4"
        >
          {message}
        </p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}
        
        <div className="flex gap-3">
          <button
            ref={confirmButtonRef}
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}