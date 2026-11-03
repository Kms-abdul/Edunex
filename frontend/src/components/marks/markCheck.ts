/**
 * Live, display-only check of what a teacher is typing in a marks box.
 * It does NOT change the value: the existing blur logic in each screen still
 * rounds / clamps / clears exactly as before. This only explains problems in plain words.
 */
export const markProblem = (raw: unknown, max: number | undefined): string | null => {
    if (raw === null || raw === undefined) return null;
    const text = String(raw).trim();
    if (text === '') return null;
    const upper = text.toUpperCase();
    if (upper === 'AB' || upper === 'A') return null; // "AB" = absent (typing on a computer)
    const num = Number(text);
    if (!isFinite(num)) return 'Type a number, or mark the student absent.';
    if (num < 0) return 'Marks cannot be less than 0.';
    if (max !== undefined && max > 0 && num > max) return `Too high. The most is ${max}.`;
    return null;
};

/** True when a mark has been given (a number or absent). */
export const hasMark = (value: unknown, isAbsent?: boolean): boolean =>
    !!isAbsent || (value !== '' && value !== null && value !== undefined);
