/**
 * Installable app (PWA) support.
 * - registerServiceWorker(): enables "Add to home screen" / install (production builds only)
 * - Install prompt: Chrome/Edge/Android fire `beforeinstallprompt`; we keep it so the
 *   app can offer an "Install app" button at a sensible moment.
 */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export const registerServiceWorker = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker not registered', err));
  });
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => { deferred = null; emit(); });
}

export const isInstalled = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);

export const canInstall = () => !!deferred && !isInstalled();

export const promptInstall = async () => {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  emit();
  return outcome === 'accepted';
};

export const onInstallAvailabilityChange = (fn: () => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
