import api from '../../api';

export interface YearOption { code: string; name: string }
export interface BranchOption { id: number; name: string }

export interface EnquiryOptions {
  academic_years: YearOption[];
  default_year: string | null;
  branches: BranchOption[];
  current_branch_id: number | null;
  can_write: boolean;
  can_manage_schemes: boolean;
}

export type DiscountType = 'NONE' | 'PERCENT' | 'AMOUNT';
export type StudentType = 'NEW' | 'OLD';
export const studentTypeLabel = (t?: StudentType | null) => (t === 'OLD' ? 'Old student (already in school)' : 'New student');

export interface Scheme {
  id: number;
  branch_id: number;
  academic_year: string;
  name: string;
  valid_from: string | null;
  valid_to: string | null;
  tuition_fee_type: string;
  discount_type: DiscountType;
  discount_value: number;
  benefits: string;
  display_order: number;
  is_active: boolean;
}

export interface SchemeQuote {
  name: string;
  valid_from: string | null;
  valid_to: string | null;
  benefits: string[];
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number | null;
  tuition_after: number | null;
}

export interface Quote {
  class_name: string;
  academic_year: string;
  student_type?: StudentType;
  tuition_fee_type: string | null;
  tuition_fee: number | null;
  tuition_installments?: { name: string; amount: number }[];
  fee_note: string | null;
  schemes: SchemeQuote[];
}

export interface PrintData extends Quote {
  header: { school_name: string | null; logo_url: string | null; address: string | null; phone: string | null; branch_name: string };
  enquiry_no: string;
  enquiry_date: string;
  student_name: string;
  guardian_name: string;
  contact: string;
  aadhaar_masked: string | null;
}

export interface EnquiryRow {
  id: number;
  enquiry_no: string;
  enquiry_date: string;
  academic_year: string;
  branch_id: number;
  branch_name: string | null;
  student_name: string;
  guardian_name: string;
  class_name: string;
  contact: string;
  aadhaar_masked: string | null;
  status: string;
  student_type?: StudentType;
  printed_at?: string | null;
  print_count?: number;
  match?: 'aadhaar' | 'phone';
  print?: PrintData;
}

export interface CheckResult {
  same_year: EnquiryRow | null;
  enquiries: EnquiryRow[];
  students: { admission_no: string; name: string; class_name: string; branch: string; status: string; match: 'aadhaar' | 'phone' }[];
}

// Verhoeff check digit used by Aadhaar: a failure means a likely typing mistake (warning only)
const V_D = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],
  [5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const V_P = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],
  [4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
export const aadhaarLooksRight = (digits: string) => {
  let c = 0;
  digits.split('').reverse().forEach((ch, i) => { c = V_D[c][V_P[i % 8][Number(ch)]]; });
  return c === 0;
};

/** True on tablets / computers, where a printer is usually attached. */
export const isDeskScreen = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

/** Plain-words message for any failed request. */
export const errorText = (err: any): string =>
  err?.response?.data?.error || 'Could not reach the server. Check the internet and try again.';

export const errorField = (err: any): string | undefined => err?.response?.data?.field;

export const enquiryApi = {
  options: () => api.get<EnquiryOptions>('/enquiry/options').then(r => r.data),
  classes: (branchId: number) =>
    api.get<{ classes: string[] }>('/enquiry/classes', { params: { branch_id: branchId } }).then(r => r.data.classes),
  feeTypes: (branchId: number, year: string) =>
    api.get<{ fee_types: string[] }>('/enquiry/fee-types', { params: { branch_id: branchId, academic_year: year } }).then(r => r.data.fee_types),
  schemes: (branchId: number, year: string) =>
    api.get<{ schemes: Scheme[] }>('/enquiry/schemes', { params: { branch_id: branchId, academic_year: year } }).then(r => r.data.schemes),
  saveScheme: (body: Partial<Scheme>, id?: number) =>
    (id ? api.put(`/enquiry/schemes/${id}`, body) : api.post('/enquiry/schemes', body)).then(r => r.data),
  copySchemes: (branchId: number, fromYear: string, toYear: string) =>
    api.post<{ message: string; copied: number }>('/enquiry/schemes/copy', { branch_id: branchId, from_year: fromYear, to_year: toYear }).then(r => r.data),
  quote: (branchId: number, year: string, className: string, studentType: StudentType) =>
    api.get<Quote>('/enquiry/quote', { params: { branch_id: branchId, academic_year: year, class_name: className, student_type: studentType } }).then(r => r.data),
  // POST so Aadhaar never appears in a URL
  check: (branchId: number, year: string, aadhaar: string, contact: string) =>
    api.post<CheckResult>('/enquiry/check', { branch_id: branchId, academic_year: year, aadhaar, contact }).then(r => r.data),
  create: (body: Record<string, unknown>) =>
    api.post<{ message: string; enquiry: EnquiryRow }>('/enquiry', body).then(r => r.data),
  list: (params: Record<string, unknown>) =>
    api.get<{ enquiries: EnquiryRow[]; total: number; page: number; page_size: number; not_printed: number }>('/enquiry', { params }).then(r => r.data),
  markPrinted: (id: number) => api.post<{ enquiry: EnquiryRow }>(`/enquiry/${id}/printed`).then(r => r.data.enquiry),
  get: (id: number) => api.get<{ enquiry: EnquiryRow }>(`/enquiry/${id}`).then(r => r.data.enquiry),
};

export const rupees = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const niceDate = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(`${v.slice(0, 10)}T00:00:00`);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const yearLabel = (years: YearOption[], code: string) => years.find(y => y.code === code)?.name || code;

/** "Join between 1 Jun 2026 and 31 Dec 2026" / "Join before …" / "Join from …" */
export const joinWindow = (from: string | null, to: string | null) => {
  if (from && to) return `Join between ${niceDate(from)} and ${niceDate(to)}`;
  if (to) return `Join on or before ${niceDate(to)}`;
  if (from) return `Join on or after ${niceDate(from)}`;
  return '';
};

export const discountLabel = (type: DiscountType, value: number) =>
  type === 'PERCENT' ? `${value}% off tuition fee` : type === 'AMOUNT' ? `${rupees(value)} off tuition fee` : '';
