/** Small display helpers shared by the petty cash, ledger and cash deposit screens. */

/** ₹1,23,456.5 style, Indian grouping, at most 2 decimals. */
export const rupees = (n: number | string | null | undefined) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** ₹1,23,456.50 style, always 2 decimals (for ledgers and totals). */
export const rupees2 = (n: number | string | null | undefined) =>
  `₹${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-03" -> "3 Nov" (adds the year when it is not this year). Falls back to the input. */
export const shortDate = (value?: string | null) => {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (month < 0 || month > 11) return value;
  const sameYear = year === new Date().getFullYear();
  return `${day} ${MONTHS[month]}${sameYear ? '' : ` ${year}`}`;
};

/** Today as YYYY-MM-DD (same value the old forms used). */
export const todayIso = () => new Date().toISOString().split('T')[0];
