import Modal from "./Modal";

/**
 * ConfirmDialog — replaces `window.confirm()` with an accessible,
 * Headless UI-based modal that traps focus, is ESC-dismissable, and
 * matches the rest of the admin's Modal vocabulary.
 *
 * Phase 4 / Phase 5 of docs/25-admin-fees-page-redesign-plan.md.
 * Initial consumers: CustomFee.jsx (Phase 4 cleanup) and the main
 * FeesIndex.jsx (Phase 5 — deCollectFee + generateMonthlyFees).
 *
 * Props:
 *   show           — boolean, open/closed
 *   title          — string, dialog heading
 *   description    — string|null, body copy below the heading
 *   confirmLabel   — string, default "Confirm"
 *   cancelLabel    — string, default "Cancel"
 *   confirmVariant — "primary" | "danger" | "warning", default "primary"
 *                    (visual weight only; semantics unchanged)
 *   onConfirm      — () => void, fired on Confirm click
 *   onCancel       — () => void, fired on Cancel click + close
 */
export default function ConfirmDialog({
    show,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    confirmVariant = "primary",
    onConfirm,
    onCancel,
}) {
    const variantClasses = {
        primary: "bg-blue-600 hover:bg-blue-700",
        danger: "bg-red-600 hover:bg-red-700",
        warning: "bg-yellow-600 hover:bg-yellow-700",
    };
    const confirmClass = variantClasses[confirmVariant] ?? variantClasses.primary;

    return (
        <Modal show={show} onClose={onCancel} maxWidth="sm">
            <div className="px-5 py-4">
                <h2 className="text-base font-semibold text-gray-800">{title}</h2>
                {description && (
                    <p className="mt-2 text-sm text-gray-600">{description}</p>
                )}
                <div className="mt-5 flex justify-end gap-2 border-t pt-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 min-h-[40px] sm:min-h-[36px]"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 min-h-[40px] sm:min-h-[36px] ${confirmClass}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </Modal>
    );
}