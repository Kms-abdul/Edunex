/**
 * Page intents: lets a shortcut open a page directly on a specific step/view,
 * e.g. Home → "Add a new student" opens Students on the add-student form.
 *
 *   openWithIntent(navigateTo, 'student-administration', 'addStudent');
 *   const view = consumeIntent('student-administration'); // in that page, on mount
 *
 * Stored in sessionStorage and consumed once, so a normal visit is unaffected.
 */
import type { Page } from '../App';

const KEY = 'edunex.intent';

export const setIntent = (page: Page, view: string) => {
  try { sessionStorage.setItem(KEY, JSON.stringify({ page, view, at: Date.now() })); } catch { /* ignore */ }
};

/** Returns the requested view for this page (once), or null. Intents expire after 30s. */
export const consumeIntent = (page: Page): string | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.page !== page) return null;
    sessionStorage.removeItem(KEY);
    return Date.now() - (data.at || 0) < 30_000 ? data.view : null;
  } catch {
    return null;
  }
};

export const openWithIntent = (navigateTo: (p: Page) => void, page: Page, view?: string) => {
  if (view) setIntent(page, view);
  navigateTo(page);
};
