/**
 * Imperative feedback API — styled replacements for window.alert / window.confirm.
 *
 *   notify('Saved');                  // tone inferred from the message
 *   notify.success('Student created');
 *   notify.error('Failed to save');
 *   if (!(await confirmDialog('Delete this receipt?', { tone: 'danger' }))) return;
 *
 * Rendering is done by <FeedbackHost /> (mounted once in index.tsx), so these
 * functions can be called from anywhere — components, callbacks, helpers.
 */

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  title?: string;
  duration: number;
}

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  /** 'danger' renders a red confirm button; inferred from the message when omitted. */
  tone?: 'danger' | 'warning' | 'default';
}

export interface ConfirmRequest extends ConfirmOptions {
  id: number;
  message: string;
  resolve: (ok: boolean) => void;
}

type Listener = () => void;

let toasts: ToastItem[] = [];
let confirms: ConfirmRequest[] = [];
let seq = 0;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach(l => l());

export const feedbackStore = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  getToasts: () => toasts,
  getConfirms: () => confirms,
  dismissToast(id: number) {
    toasts = toasts.filter(t => t.id !== id);
    emit();
  },
  settleConfirm(id: number, ok: boolean) {
    const req = confirms.find(c => c.id === id);
    confirms = confirms.filter(c => c.id !== id);
    emit();
    req?.resolve(ok);
  },
};

const toText = (message: unknown): string => {
  if (message == null) return '';
  if (typeof message === 'string') return message;
  if (message instanceof Error) return message.message;
  try { return JSON.stringify(message); } catch { return String(message); }
};

/** Best-effort tone detection so existing alert() messages map to the right colour. */
export const inferTone = (message: string): ToastTone => {
  const m = message.toLowerCase();
  if (/(fail|error|unable|cannot|can't|could not|couldn't|invalid|denied|not allowed|unauthori[sz]ed|forbidden|went wrong|exceed)/.test(m)) return 'error';
  if (/(success|saved|created|updated|deleted|removed|added|uploaded|assigned|approved|completed|sent|copied|done|generated|restored|promoted|submitted)/.test(m)) return 'success';
  if (/(please|select|required|enter|must|missing|no .* (found|selected)|choose|at least|already|warning|only )/.test(m)) return 'warning';
  return 'info';
};

const push = (tone: ToastTone | undefined, message: unknown, title?: string) => {
  const text = toText(message);
  const resolved = tone ?? inferTone(text);
  const duration = resolved === 'error' ? 6500 : resolved === 'warning' ? 5000 : 3500;
  const item: ToastItem = { id: ++seq, tone: resolved, message: text, title, duration };
  toasts = [...toasts.slice(-4), item];
  emit();
  return item.id;
};

type Notify = ((message: unknown, title?: string) => number) & {
  success: (message: unknown, title?: string) => number;
  error: (message: unknown, title?: string) => number;
  warning: (message: unknown, title?: string) => number;
  info: (message: unknown, title?: string) => number;
};

export const notify: Notify = Object.assign(
  (message: unknown, title?: string) => push(undefined, message, title),
  {
    success: (message: unknown, title?: string) => push('success', message, title),
    error: (message: unknown, title?: string) => push('error', message, title),
    warning: (message: unknown, title?: string) => push('warning', message, title),
    info: (message: unknown, title?: string) => push('info', message, title),
  },
);

/** Styled, promise-based replacement for window.confirm(). Resolves true on confirm. */
export const confirmDialog = (message: string, options: ConfirmOptions = {}): Promise<boolean> =>
  new Promise(resolve => {
    const tone = options.tone ?? (/(delete|remove|inactive|discard|cancel|revoke|reset|zero out|overwrit|deactivat|disable|reject)/i.test(message) ? 'danger' : 'default');
    confirms = [...confirms, { id: ++seq, message, ...options, tone, resolve }];
    emit();
  });
