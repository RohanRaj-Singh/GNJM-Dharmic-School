/**
 * PWA registration + Android Chrome install prompt helpers.
 *
 * Chrome requires: valid manifest, 192+512 icons, start_url, display
 * standalone, HTTPS (or localhost), and a service worker with a fetch
 * handler before it fires `beforeinstallprompt` / shows "Install app".
 */

let deferredPrompt = null;
const listeners = new Set();

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function canPromptInstall() {
  return Boolean(deferredPrompt) && !isStandalone();
}

export function onInstallPromptChange(cb) {
  listeners.add(cb);
  cb(canPromptInstall());
  return () => listeners.delete(cb);
}

function emit() {
  const can = canPromptInstall();
  listeners.forEach((cb) => cb(can));
}

export async function promptInstall() {
  if (!deferredPrompt) return { outcome: 'unavailable' };
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  emit();
  return choice;
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Only register on secure contexts (production HTTPS / localhost).
  if (!window.isSecureContext) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    // Prevent the mini-infobar so our in-app button owns the UX.
    event.preventDefault();
    deferredPrompt = event;
    emit();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    emit();
  });
}
