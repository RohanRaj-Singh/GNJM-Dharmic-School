import { Head } from "@inertiajs/react";
import { router } from "@inertiajs/react";
import { usePage } from "@inertiajs/react";
import { useState, useEffect, useRef } from "react";
import TabSessionTimeout from "@/Components/TabSessionTimeout";

const PROTECTED_HISTORY_KEY = "gnjm.protected.history";

/**
 * SimpleLayout - Layout for teacher/accountant mobile views
 */
export default function SimpleLayout({
  title,
  children,
  hasUnsavedChanges = false,
  showLeavePageDialog = true,
  alwaysConfirmLeave = false,
  onLogout,
  backRoute = null,
  homeRoute = null
}) {
  const { auth } = usePage().props;
  const todayLabel = new Date().toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingNav, setPendingNav] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const sentinelActiveRef = useRef(false);

  const showNavConfirm = pendingNav !== null;
  const shouldConfirmLeave = showLeavePageDialog && (alwaysConfirmLeave || hasUnsavedChanges);
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";
  const role = auth?.user?.role ?? null;

  const resolvedHomeRoute = (() => {
    if (homeRoute) return homeRoute;
    if (role === "teacher") return "/teacher";
    if (role === "accountant") return "/accountant";
    if (role === "admin") return "/admin/dashboard";
    return "/";
  })();

  const readProtectedHistory = () => {
    try {
      const raw = window.sessionStorage.getItem(PROTECTED_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeProtectedHistory = (stack) => {
    window.sessionStorage.setItem(PROTECTED_HISTORY_KEY, JSON.stringify(stack));
  };

  const ensureCurrentPathTracked = () => {
    if (!currentPath) return [];
    const stack = readProtectedHistory();
    if (stack[stack.length - 1] !== currentPath) {
      const nextStack = [...stack, currentPath];
      writeProtectedHistory(nextStack);
      return nextStack;
    }
    return stack;
  };

  const goToPreviousProtectedPage = () => {
    const stack = readProtectedHistory();
    if (stack.length <= 1) return false;
    const nextStack = stack.slice(0, -1);
    const previousPath = nextStack[nextStack.length - 1];
    writeProtectedHistory(nextStack);
    router.visit(previousPath);
    return true;
  };

  const navigateToBackRoute = () => {
    if (backRoute) {
      router.visit(backRoute);
      return true;
    }
    return false;
  };

  const navigateToHome = () => {
    router.visit(resolvedHomeRoute);
  };

  const navigateBackFromStack = () => {
    if (goToPreviousProtectedPage()) return true;
    if (navigateToBackRoute()) return true;
    return false;
  };

  const handleBack = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (showNavConfirm || isNavigating) return;
    if (shouldConfirmLeave) {
      setPendingNav({ type: 'back' });
    } else {
      if (!navigateBackFromStack()) {
        handleLogoutClick(e);
      }
    }
  };

  const handleHome = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (showNavConfirm || isNavigating) return;
    if (shouldConfirmLeave) {
      setPendingNav({ type: 'home' });
    } else {
      navigateToHome();
    }
  };

  const handleConfirmNav = () => {
    const nextNav = pendingNav;
    setIsNavigating(true);
    setShowLeaveDialog(false);
    setPendingNav(null);
    setTimeout(() => {
      if (nextNav?.type === 'back') {
        if (!navigateBackFromStack()) {
          handleLogoutClick();
        }
      } else if (nextNav?.type === 'home') {
        navigateToHome();
      }
      setIsNavigating(false);
    }, 50);
  };

  const handleCancelNav = () => {
    setShowLeaveDialog(false);
    setPendingNav(null);
    setIsNavigating(false);
  };

  // Handle logout click - show inline confirmation instead of modal
  const handleLogoutClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setShowLogoutConfirm(true);
  };

  // Actually perform logout
  const handleLogout = () => {
    window.sessionStorage.removeItem(PROTECTED_HISTORY_KEY);
    if (onLogout) {
      onLogout();
    } else {
      router.post("/logout", {}, {
        replace: true,
        preserveScroll: false,
        onSuccess: () => {
          window.location.replace("/");
        },
      });
    }
  };

  // Cancel logout without focus changes
  const handleCancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  // History management
  useEffect(() => {
    ensureCurrentPathTracked();
    const handlePopState = () => {
      const stack = readProtectedHistory();
      if (stack.length > 1) {
        const nextStack = stack.slice(0, -1);
        writeProtectedHistory(nextStack);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentPath]);

  useEffect(() => {
    if (pendingNav && showLeavePageDialog) {
      setShowLeaveDialog(true);
    }
  }, [pendingNav, showLeavePageDialog]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Head title={title}></Head>
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 relative flex items-center">
          {/* Logout button - direct, no focus-stealing */}
          {showLogoutConfirm ? (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-2 py-1 rounded-lg text-sm font-medium"
              >
                Confirm
              </button>
              <button
                onClick={handleCancelLogout}
                className="bg-gray-200 text-gray-700 px-2 py-1 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogoutClick}
              className="bg-red-100 text-red-600 px-2 py-1 rounded-lg text-sm"
              aria-label="Logout"
            >
              Logout
            </button>
          )}
          <div className="absolute inset-x-0 text-center pointer-events-none">
            <h1 className="text-base font-semibold text-gray-800">
              {title ?? "GNJM"} · {todayLabel}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 pb-24">
        {children}
      </main>

      {/* Unsaved Changes Dialog - inline, no modal */}
      {showLeaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={handleCancelNav} />
          <div className="relative bg-white rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Leave Page?</h3>
            <p className="text-gray-600 mb-6">You have unsaved changes. Are you sure you want to leave?</p>
            <div className="flex gap-3">
              <button 
                onClick={handleCancelNav} 
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
              >
                Stay
              </button>
              <button 
                onClick={handleConfirmNav} 
                className="flex-1 px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 font-medium"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-md">
        <div className="max-w-md mx-auto flex justify-around py-3">
          <button onClick={handleBack} className="flex flex-col items-center text-gray-700">
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 border text-xl">
              ←
            </div>
            <span className="text-xs mt-1">Back</span>
          </button>
          <button onClick={handleHome} className="flex flex-col items-center text-gray-700">
            <div className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 border text-xl">
              🏠
            </div>
            <span className="text-xs mt-1">Home</span>
          </button>
        </div>
      </div>

      <TabSessionTimeout />
    </div>
  );
}

/**
 * UnsavedChangesDialog - Modal for unsaved changes warning
 */
export function UnsavedChangesDialog({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  title = "Leave Page?", 
  message = "You have unsaved changes. Are you sure you want to leave?"
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel} 
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
          >
            Stay
          </button>
          <button 
            onClick={onConfirm} 
            className="flex-1 px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 font-medium"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * LogoutConfirmationDialog - Modal for logout confirmation
 */
export function LogoutConfirmationDialog({ isOpen, onConfirm, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Logout?</h3>
        <p className="text-gray-600 mb-6">Are you sure you want to logout?</p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel} 
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            className="flex-1 px-4 py-2 text-white bg-red-500 rounded-lg hover:bg-red-600 font-medium"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
