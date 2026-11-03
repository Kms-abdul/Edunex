/** Helpers shared by the student attendance screens. */

export const getNormalizedBranch = (): string => {
    const b = localStorage.getItem('currentBranch') || 'All';
    if (b === 'All Locations' || b === 'All Branches' || b === 'All') {
        return 'All';
    }
    return b;
};

/** Plain-words label for a stored status code (the code itself is never changed). */
export const statusLabel = (status?: string): string => {
    switch (status) {
        case 'Present': return 'Present';
        case 'Absent': return 'Absent';
        case 'Leave': return 'On leave';
        case 'Late': return 'Late';
        case 'Holiday': return 'Holiday';
        case 'Sunday': return 'Sunday';
        case 'Weekoff': return 'Week off';
        default: return status || 'Not marked';
    }
};

/** Badge class for a status code. */
export const statusBadge = (status?: string): string => {
    switch (status) {
        case 'Present': return 'badge-success';
        case 'Absent': return 'badge-danger';
        case 'Leave':
        case 'Late': return 'badge-warning';
        default: return 'badge-neutral';
    }
};

/** Formats a yyyy-mm-dd date as e.g. "Tue, 3 Nov 2026" (local time, no timezone shift). */
export const prettyDate = (iso: string): string => {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

const LAST_CLASS_KEY = 'edunex.attendance.lastClass';

/** Last class/section a user took attendance for on this device. */
export const readLastClass = (): { className: string; section: string } | null => {
    try {
        const raw = localStorage.getItem(LAST_CLASS_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (!data || typeof data.className !== 'string' || !data.className) return null;
        return { className: data.className, section: typeof data.section === 'string' ? data.section : '' };
    } catch {
        return null;
    }
};

export const saveLastClass = (className: string, section: string) => {
    try { localStorage.setItem(LAST_CLASS_KEY, JSON.stringify({ className, section })); } catch { /* ignore */ }
};
