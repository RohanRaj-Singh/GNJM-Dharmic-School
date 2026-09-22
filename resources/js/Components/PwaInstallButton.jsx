import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import {
  canPromptInstall,
  isStandalone,
  onInstallPromptChange,
  promptInstall,
} from "@/pwa";

const DISMISS_KEY = "gnjm_pwa_install_dismissed";

/**
 * In-app "Install app" banner for Android Chrome (and desktop Chromium).
 * Appears only after the browser fires `beforeinstallprompt` (PWA criteria met).
 * Hidden when already installed as a standalone app or after dismiss.
 */
export default function PwaInstallButton({ compact = false }) {
  const [canInstall, setCanInstall] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const stored =
      typeof localStorage !== "undefined" &&
      localStorage.getItem(DISMISS_KEY) === "1";
    setDismissed(stored);
    return onInstallPromptChange(setCanInstall);
  }, []);

  if (isStandalone() || dismissed || (!canInstall && !canPromptInstall())) {
    return null;
  }

  async function handleInstall() {
    setInstalling(true);
    try {
      const result = await promptInstall();
      if (result?.outcome === "accepted") {
        setDismissed(false);
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(DISMISS_KEY);
        }
      }
    } finally {
      setInstalling(false);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleInstall}
        disabled={installing}
        className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        title="Install app on this device"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        {installing ? "Installing…" : "Install app"}
      </button>
    );
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <Download className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="font-medium">Install GNJM School on this device</p>
        <p className="mt-0.5 text-xs text-blue-700">
          Add to your home screen for faster access in Chrome.
        </p>
        <button
          type="button"
          onClick={handleInstall}
          disabled={installing}
          className="mt-2 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {installing ? "Installing…" : "Install"}
        </button>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="rounded p-1 text-blue-600 hover:bg-blue-100"
        aria-label="Dismiss install prompt"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
