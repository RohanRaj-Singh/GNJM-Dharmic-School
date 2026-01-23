import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function SidebarGroup({ label, children, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="space-y-1">
            {/* Group Header */}
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded"
            >
                <span>{label}</span>
                {open ? (
                    <ChevronDown size={16} />
                ) : (
                    <ChevronRight size={16} />
                )}
            </button>

            {/* Group Links */}
            {open && (
                <div className="ml-3 space-y-1 border-l pl-2">
                    {children}
                </div>
            )}
        </div>
    );
}
