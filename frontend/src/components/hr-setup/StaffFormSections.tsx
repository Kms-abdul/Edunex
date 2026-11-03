import React from 'react';
import { Field } from '../ui';

/**
 * Field groups shared by "Add staff" (CreateStaffWizard) and "Change staff details"
 * (UpdateStaffDetails). They only render inputs; the parent owns the state and saving.
 * `set(patch)` must merge the patch into the parent's form.
 */

export interface Option { id: number; label: string; [key: string]: any }

type Setter = (patch: Record<string, any>) => void;

export const FormGroup: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
    <section>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
);

/* ---------------------------------------------------------------- Personal */
export const PersonalFields: React.FC<{ form: any; set: Setter }> = ({ form, set }) => (
    <div className="space-y-6">
        <FormGroup title="About the person">
            <Field label="First name" required htmlFor="st-first">
                <input id="st-first" type="text" className="input uppercase" autoComplete="off"
                    value={form.first_name} onChange={e => set({ first_name: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Middle name (optional)" htmlFor="st-middle">
                <input id="st-middle" type="text" className="input uppercase" autoComplete="off"
                    value={form.middle_name} onChange={e => set({ middle_name: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Last name (optional)" htmlFor="st-last">
                <input id="st-last" type="text" className="input uppercase" autoComplete="off"
                    value={form.last_name} onChange={e => set({ last_name: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Gender" required>
                <div className="segmented w-full" role="radiogroup" aria-label="Gender">
                    {[{ v: 'MALE', l: 'Male' }, { v: 'FEMALE', l: 'Female' }].map(g => (
                        <button
                            key={g.v}
                            type="button"
                            role="radio"
                            aria-checked={form.gender === g.v}
                            onClick={() => set({ gender: g.v })}
                            className={`segmented-item flex-1 min-h-[40px] ${form.gender === g.v ? 'segmented-item-active' : ''}`}
                        >
                            {g.l}
                        </button>
                    ))}
                </div>
            </Field>
            <Field label="Date of birth (optional)" htmlFor="st-dob">
                <input id="st-dob" type="date" className="input"
                    value={form.date_of_birth} onChange={e => set({ date_of_birth: e.target.value })} />
            </Field>
        </FormGroup>

        <FormGroup title="Contact and address">
            <Field label="Mobile number" htmlFor="st-mobile">
                <input id="st-mobile" type="tel" inputMode="tel" className="input"
                    value={form.mobile} onChange={e => set({ mobile: e.target.value })} />
            </Field>
            <Field label="Email (optional)" htmlFor="st-email">
                <input id="st-email" type="email" inputMode="email" className="input"
                    value={form.email} onChange={e => set({ email: e.target.value })} />
            </Field>
            <Field label="Address (optional)" htmlFor="st-address" className="sm:col-span-2">
                <input id="st-address" type="text" className="input"
                    value={form.address} onChange={e => set({ address: e.target.value })} />
            </Field>
            <Field label="City (optional)" htmlFor="st-city">
                <input id="st-city" type="text" className="input"
                    value={form.city} onChange={e => set({ city: e.target.value })} />
            </Field>
            <Field label="State (optional)" htmlFor="st-state">
                <input id="st-state" type="text" className="input"
                    value={form.state} onChange={e => set({ state: e.target.value })} />
            </Field>
        </FormGroup>
    </div>
);

/* -------------------------------------------------------------- Employment */
export const EmploymentFields: React.FC<{
    form: any;
    set: Setter;
    branches: Array<{ branch_id: number; branch_name: string }>;
    branchLocked?: boolean;
    departments: Option[];
    designations: Option[];
    categories: Option[];
    statuses: Option[];
    shifts: Option[];
    managers: Option[];
}> = ({ form, set, branches, branchLocked, departments, designations, categories, statuses, shifts, managers }) => (
    <div className="space-y-6">
        <FormGroup title="Where and when">
            <Field label="Branch" required hint={branchLocked ? 'The branch cannot be changed here.' : undefined}>
                <select className={`input ${branchLocked ? 'bg-slate-100' : ''}`} disabled={branchLocked}
                    value={form.branch_id} onChange={e => set({ branch_id: e.target.value })}>
                    <option value="">Choose a branch</option>
                    {branches.map(b => <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>)}
                </select>
            </Field>
            <Field label="Joining date" required>
                <input type="date" className="input"
                    value={form.joining_date} onChange={e => set({ joining_date: e.target.value })} />
            </Field>
            <Field label="Type of job" required>
                <select className="input"
                    value={form.employment_type} onChange={e => set({ employment_type: e.target.value })}>
                    <option value="PERMANENT">Permanent</option>
                    <option value="CONTRACT">Contract</option>
                    <option value="PROBATION">Probation</option>
                    <option value="INTERN">Intern</option>
                </select>
            </Field>
            <Field label="Work status" required>
                <select className="input"
                    value={form.staff_status_id} onChange={e => set({ staff_status_id: e.target.value })}>
                    <option value="">Choose a status</option>
                    {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
            </Field>
        </FormGroup>

        <FormGroup title="Job">
            <Field label="Department" required>
                <select className="input"
                    value={form.department_id} onChange={e => set({ department_id: e.target.value })}>
                    <option value="">Choose a department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
            </Field>
            <Field label="Job title" required hint={!form.department_id ? 'Choose a department first.' : undefined}>
                <select className="input" disabled={!form.department_id}
                    value={form.designation_id} onChange={e => set({ designation_id: e.target.value })}>
                    <option value="">Choose a job title</option>
                    {designations.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
            </Field>
            <Field label="Staff type" required>
                <select className="input"
                    value={form.staff_category_id} onChange={e => set({ staff_category_id: e.target.value })}>
                    <option value="">Choose a staff type</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
            </Field>
            <Field label="Shift (optional)">
                <select className="input"
                    value={form.default_shift_id} onChange={e => set({ default_shift_id: e.target.value })}>
                    <option value="">Choose a shift</option>
                    {shifts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
            </Field>
            <Field label="Reports to (optional)" className="sm:col-span-2">
                <select className="input"
                    value={form.reporting_manager_id} onChange={e => set({ reporting_manager_id: e.target.value })}>
                    <option value="">Choose a manager</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
            </Field>
        </FormGroup>
    </div>
);

/* ------------------------------------------------------------ Bank and tax */
export const BankFields: React.FC<{ bankForm: any; set: Setter }> = ({ bankForm, set }) => (
    <div className="space-y-6">
        <FormGroup title="Bank account" hint="Salary is paid into this account. You can add it later.">
            <Field label="Account number">
                <input type="text" inputMode="numeric" className="input" autoComplete="off"
                    value={bankForm.account_number} onChange={e => set({ account_number: e.target.value })} />
            </Field>
            <Field label="IFSC code" hint="11 letters and numbers, printed on the cheque book.">
                <input type="text" className="input uppercase" autoComplete="off"
                    value={bankForm.ifsc_code} onChange={e => set({ ifsc_code: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Bank name" className="sm:col-span-2">
                <input type="text" className="input"
                    value={bankForm.bank_name} onChange={e => set({ bank_name: e.target.value })} />
            </Field>
        </FormGroup>
        <FormGroup title="Tax and PF numbers">
            <Field label="PAN number">
                <input type="text" className="input uppercase" autoComplete="off"
                    value={bankForm.pan_number} onChange={e => set({ pan_number: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Aadhaar number">
                <input type="text" inputMode="numeric" className="input" autoComplete="off"
                    value={bankForm.aadhaar_number} onChange={e => set({ aadhaar_number: e.target.value })} />
            </Field>
            <Field label="UAN / PF number">
                <input type="text" className="input" autoComplete="off"
                    value={bankForm.pf_number} onChange={e => set({ pf_number: e.target.value })} />
            </Field>
        </FormGroup>
    </div>
);

/* ------------------------------------------------------------------ Salary */
export const SalaryFields: React.FC<{ salaryForm: any; set: Setter }> = ({ salaryForm, set }) => (
    <FormGroup title="Monthly salary" hint="You can leave this empty and add it later.">
        <Field label="Basic salary (₹)">
            <input type="number" inputMode="decimal" className="input"
                value={salaryForm.basic_salary} onChange={e => set({ basic_salary: e.target.value })} />
        </Field>
        <Field label="Gross salary, total (₹)">
            <input type="number" inputMode="decimal" className="input"
                value={salaryForm.gross_salary} onChange={e => set({ gross_salary: e.target.value })} />
        </Field>
        <Field label="Salary starts from">
            <input type="date" className="input"
                value={salaryForm.effective_from} onChange={e => set({ effective_from: e.target.value })} />
        </Field>
    </FormGroup>
);

/** One row of the review list: "Label ........ value". */
export const ReviewRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
        <dt className="text-sm text-slate-500">{label}</dt>
        <dd className="text-sm font-medium text-slate-900 text-right break-words min-w-0">
            {value === undefined || value === null || value === '' ? <span className="text-slate-400">—</span> : value}
        </dd>
    </div>
);

/** Label of the chosen option (or empty). */
export const labelOf = (list: Option[], id: string | number) => list.find(o => String(o.id) === String(id))?.label || '';
