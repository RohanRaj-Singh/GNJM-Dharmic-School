import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useBackButtonInterceptor - Hook for handling browser back button on authenticated pages
 * 
 * Features:
 * - Intercepts popstate events to show confirmation modal
 * - Prevents navigation when modal is open
 * - Works across all authenticated routes
 * - No interference with normal link navigation
 * 
 * @param {Object} options
 * @param {boolean} options.enabled - Whether the interceptor is active (default: true)
 * @param {Function} options.onBackRequest - Callback when back button is pressed
 * @param {string[]} options.publicRoutes - Routes that don't require the modal (default: ['/login', '/'])
 * @param {Function} options.getCurrentRoute - Function to get current route path
 */
export function useBackButtonInterceptor({
  enabled = true,
  onBackRequest,
  publicRoutes = ['/login', '/register', '/forgot-password', '/'],
  getCurrentRoute = () => window.location.pathname
} = {}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const isProcessingRef = useRef(false);
  const historyPositionRef = useRef(0);

  const showModal = useCallback(() => {
    if (isProcessingRef.current) return;
    
    const currentRoute = getCurrentRoute();
    
    // Don't show modal if already on a public route
    const isPublicRoute = publicRoutes.some(route => 
      currentRoute === route || currentRoute.startsWith(route + '/')
    );
    
    if (isPublicRoute) {
      return; // Let normal navigation happen
    }
    
    isProcessingRef.current = true;
    setShowConfirm(true);
    
    // Prevent back navigation by pushing state
    window.history.pushState({ backModalShown: true }, '', window.location.href);
  }, [getCurrentRoute, publicRoutes]);

  const handleConfirm = useCallback(() => {
    setShowConfirm(false);
    isProcessingRef.current = false;
    
    if (onBackRequest) {
      onBackRequest('confirm');
    }
  }, [onBackRequest]);

  const handleCancel = useCallback(() => {
    setShowConfirm(false);
    isProcessingRef.current = false;
    
    // Replace state to stay on current page
    window.history.replaceState({ backModalDismissed: true }, '', window.location.href);
  }, []);

  // Set up popstate listener
  useEffect(() => {
    if (!enabled) return;

    const handlePopState = (event) => {
      // Check if modal should be shown
      const currentRoute = getCurrentRoute();
      
      // Check if destination is a public route
      const isNavigatingToPublic = publicRoutes.some(route => {
        // We can't know the exact destination, but if we're on a protected route
        // and going back, we should show the modal
        return false; // Let the showModal function decide
      });
      
      // Show the confirmation modal
      showModal();
    };

    // Add listener with capture to intercept early
    window.addEventListener('popstate', handlePopState, { passive: false });

    // Also push initial state on mount to track position
    historyPositionRef.current = window.history.length;
    window.history.pushState({ authenticated: true }, '', window.location.href);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [enabled, getCurrentRoute, publicRoutes, showModal]);

  return {
    showConfirm,
    handleConfirm,
    handleCancel,
    // Helper to check if we should show modal for current route
    shouldShowModal: () => {
      const currentRoute = getCurrentRoute();
      return !publicRoutes.some(route => currentRoute === route);
    }
  };
}

/**
 * CrossPageLogoutModal - A logout confirmation modal that works across all authenticated pages
 * 
 * Features:
 * - Works with browser back button
 * - Focus trap within modal
 * - Keyboard support (Escape to close, Tab navigation)
 * - Accessible ARIA attributes
 * - Handles rapid back button presses
 * - State persists on cancel
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {Function} props.onConfirm - Callback when user confirms logout
 * @param {Function} props.onCancel - Callback when user cancels
 * @param {string} [props.title="Logout?"] - Modal title
 * @param {string} [props.message="Are you sure you want to logout?"] - Modal message
 * @param {string} [props.confirmLabel="Logout"] - Confirm button label
 * @param {string} [props.cancelLabel="Cancel"] - Cancel button label
 */
export default function CrossPageLogoutModal({
  isOpen,
  onConfirm,
  onCancel,
  title = "Logout?",
  message = "Are you sure you want to logout?",
  confirmLabel = "Logout",
  cancelLabel = "Cancel"
}) {
  const [error, setError] = useState(null);
  const modalRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    // Focus confirm button after render
    setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }

      // Tab for focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length > 0) {
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
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      
      // Return focus to previous element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, onCancel]);

  // Prevent back button when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePopState = (e) => {
      // Prevent navigation - push state back
      e.preventDefault();
      window.history.pushState(null, '', window.location.href);
    };

    window.addEventListener('popstate', handlePopState, { passive: false });
    
    // Push initial state to block back
    window.history.pushState({ modalActive: true }, '', window.location.href);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen]);

  const handleConfirm = async () => {
    try {
      setError(null);
      await onConfirm();
    } catch (err) {
      setError(err.message || 'Logout failed. Please try again.');
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
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      
      {/* Modal Content */}
      <div 
        ref={modalRef}
        className="relative bg-white rounded-xl p-6 max-w-sm mx-4 shadow-2xl w-full"
        onClick={(e) => e.stopPropagation()}
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
            ref={cancelButtonRef}
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

/**
 * Test Case Specification: Cross-Page Back Button Logout Modal
 * 
 * ============================================================================
 * SCENARIO
 * ============================================================================
 * A user logs in from /login and is redirected to a protected route (e.g., 
 * /admin/dashboard). When the user presses the browser back button, the app 
 * should display a logout confirmation modal instead of navigating away.
 * 
 * ============================================================================
 * ACCEPTANCE CRITERIA
 * ============================================================================
 * 
 * AC1: Modal triggers on back button from any authenticated page
 * - When user is on /admin/dashboard and presses back → Modal appears
 * - When user is on /admin/settings and presses back → Modal appears
 * - When user is on /accountant and presses back → Modal appears
 * 
 * AC2: Modal does NOT trigger on back button to public routes
 * - When user is on /login and presses back → No modal (normal navigation)
 * - When user is on /register and presses back → No modal
 * 
 * AC3: Latency requirement
 * - Modal appears within 200-300ms of back button press
 * 
 * AC4: No duplicate modals on rapid back presses
 * - Rapidly pressing back button should not show multiple modals
 * - Use debounce/lock mechanism
 * 
 * AC5: State persistence on cancel
 * - When user clicks "Stay/Cancel", user remains on current page
 * - No page reload occurs
 * - UI state is preserved (form inputs, scroll position, etc.)
 * 
 * AC6: Proper logout on confirm
 * - Session/token is cleared
 * - User is navigated to /login
 * 
 * AC7: Accessibility
 * - Focus trap within modal
 * - ARIA roles (role="dialog", aria-modal="true")
 * - Keyboard support (Escape to close, Tab navigation)
 * - Focus returns to trigger after close
 * 
 * AC8: Desktop and mobile behavior
 * - Works on Chrome, Firefox, Safari, Edge
 * - Works on iOS Safari and Android Chrome
 * 
 * AC9: Nested routes work correctly
 * - /admin/settings/profile and back → Modal appears
 * - /admin/students/123/edit and back → Modal appears
 * 
 * AC10: Direct navigation unaffected
 * - Typing URL directly → Works normally
 * - Clicking links → Works normally
 * - Only browser back button triggers modal
 * 
 * ============================================================================
 * TEST STEPS
 * ============================================================================
 * 
 * TS1: Basic back button modal test
 * - Login as admin
 * - Navigate to /admin/dashboard
 * - Press browser back button
 * - EXPECTED: Modal appears with "Logout?" message
 * - Click "Logout"
 * - EXPECTED: Redirected to /login, session cleared
 * 
 * TS2: Cancel should preserve state
 * - Login as teacher
 * - Navigate to /teacher
 * - Fill a form (if applicable)
 * - Press back button
 * - Click "Stay/Cancel"
 * - EXPECTED: Stay on /teacher, form data preserved
 * 
 * TS3: No modal on public pages
 * - Navigate to /login directly
 * - Press back button
 * - EXPECTED: Normal navigation (may go to previous site or stay)
 * 
 * TS4: Nested routes
 * - Login as admin
 * - Navigate to /admin/classes/1/sections
 * - Press back button
 * - EXPECTED: Modal appears
 * 
 * TS5: Rapid back presses
 * - Login as admin
 * - Navigate to /admin/dashboard
 * - Press back button 3 times rapidly
 * - EXPECTED: Only ONE modal appears
 * 
 * TS6: Mobile test
 * - Open app on mobile browser
 * - Login
 * - Navigate to any protected page
 * - Press back button
 * - EXPECTED: Modal appears correctly styled
 * 
 * ============================================================================
 * EDGE CASES
 * ============================================================================
 * 
 * EC1: User has no history (first page)
 * - Open app directly to /admin/dashboard (if possible)
 * - Press back button
 * - EXPECTED: Modal may or may not appear, no crash
 * 
 * EC2: BFCache (Back-Forward Cache)
 * - Navigate to /admin/dashboard
 * - Go to another page
 * - Press back (restores from BFCache)
 * - EXPECTED: Modal still works correctly
 * 
 * EC3: Session already expired
 * - Login, then session expires (timeout)
 * - Press back button
 * - EXPECTED: Redirect to /login without modal (or modal that redirects to login)
 * 
 * EC4: Network failure during logout
 * - Click logout
 * - Network error occurs
 * - EXPECTED: Error message shown, user stays logged in
 * 
 * ============================================================================
 * IMPLEMENTATION PSEUDO-CODE
 * ============================================================================
 * 
 * // Hook for handling back button
 * function useBackButtonLogoutModal() {
 *   const [showModal, setShowModal] = useState(false);
 *   const isProcessing = useRef(false);
 *   
 *   // Public routes that don't need modal
 *   const publicRoutes = ['/login', '/register', '/'];
 *   
 *   useEffect(() => {
 *     const handlePopState = (event) => {
 *       // Check if current route is protected
 *       const currentRoute = window.location.pathname;
 *       const isProtected = !publicRoutes.includes(currentRoute);
 *       
 *       if (isProtected && !isProcessing.current) {
 *         event.preventDefault();
 *         isProcessing.current = true;
 *         setShowModal(true);
 *         // Push state to prevent further back
 *         window.history.pushState(null, '', window.location.href);
 *       }
 *     };
 *     
 *     window.addEventListener('popstate', handlePopState);
 *     return () => window.removeEventListener('popstate', handlePopState);
 *   }, []);
 *   
 *   const handleConfirm = async () => {
 *     // Clear session/tokens
 *     await logoutAPI();
 *     // Navigate to login
 *     window.location.href = '/login';
 *   };
 *   
 *   const handleCancel = () => {
 *     isProcessing.current = false;
 *     setShowModal(false);
 *     // Replace state to stay on current page
 *     window.history.replaceState(null, '', window.location.href);
 *   };
 *   
 *   return { showModal, handleConfirm, handleCancel };
 * }
 * 
 * ============================================================================
 * ROUTER-SPECIFIC NOTES
 * ============================================================================
 * 
 * React Router:
 * - Use useLocation() to detect route changes
 * - Use usePrompt() from use-blocker for confirmation
 * - Or use useEffect with history.listen()
 * 
 * Vue Router:
 * - Use router.beforeEach() global guard
 * - Use $router.back() with confirmation
 * 
 * Angular:
 * - Use CanDeactivate guard
 * - Or use Location service with popstate
 * 
 * Plain History API:
 * - Add popstate event listener
 * - Use history.pushState() to block navigation
 * - Use history.replaceState() to stay on page
 * 
 * ============================================================================
 * REGRESSION TESTS
 * ============================================================================
 * 
 * RT1: Normal navigation still works
 * - Click links → Should navigate normally
 * - Type URL → Should load normally
 * 
 * RT2: Forward button unaffected
 * - Press forward → Should work normally
 * 
 * RT3: Logout from modal works
 * - Confirm logout → Session cleared, redirected to /login
 * 
 * RT4: Cancel from modal works
 * - Cancel → Stay on page, no reload
 * 
 * RT5: Multiple protected routes work
 * - Test /admin/dashboard, /admin/classes, /accountant, /teacher
 * - All should show modal on back
 */