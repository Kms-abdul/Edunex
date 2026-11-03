import React from 'react';
import { Phone } from 'lucide-react';
import { Alert, EmptyState, LoadingState } from '../ui';
import { CardField, ExportButtons, FilterCard, Pager, ResultsBar, SelectField, StatGrid, StatTile } from './ReportKit';

/**
 * Screen for "who still owes fees" style reports (Due, Late fee due).
 * Display only: the parent owns fetching, filtering, totals and downloads.
 */
const DueReportView: React.FC<{
    idPrefix: string;
    summaryLine: string;
    listTitle: string;
    classList: string[];
    sections: string[];
    selectedClass: string;
    onClassChange: (v: string) => void;
    selectedSection: string;
    onSectionChange: (v: string) => void;
    searchTerm: string;
    onSearchChange: (v: string) => void;
    onApply: () => void;
    loading: boolean;
    error: string;
    filteredData: any[];
    totalFee: number;
    totalDue: number;
    currentPage: number;
    onPageChange: (p: number) => void;
    rowsPerPage: number;
    onExcel: () => void;
    onPdf: () => void;
}> = ({
    idPrefix, summaryLine, listTitle, classList, sections, selectedClass, onClassChange, selectedSection, onSectionChange,
    searchTerm, onSearchChange, onApply, loading, error, filteredData, totalFee, totalDue, currentPage, onPageChange,
    rowsPerPage, onExcel, onPdf,
}) => {
    const pageRows = filteredData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    const admNo = (s: any) => s.admission_no || s.adm_no || s.admissionNo || '-';
    const father = (s: any) => s.father_name || s.father || s.parent_name || '-';
    const paid = (s: any) => (s.paid_amount || (s.total_fee - s.due_amount));

    return (
        <div className="space-y-4">
            <FilterCard summary={summaryLine} hasResults={!loading && !error} onApply={onApply} applying={loading}>
                <SelectField id={`${idPrefix}-class`} label="Class" value={selectedClass} onChange={onClassChange} options={classList.map(c => ({ value: c, label: c === 'All' ? 'All classes' : c }))} />
                <SelectField id={`${idPrefix}-section`} label="Section" value={selectedSection} onChange={onSectionChange} options={sections.map(s => ({ value: s, label: s === 'All' ? 'All sections' : s }))} />
                <div className="sm:col-span-2">
                    <label htmlFor={`${idPrefix}-search`} className="block text-sm font-medium text-slate-800 mb-1.5">Find a student (optional)</label>
                    <input
                        id={`${idPrefix}-search`}
                        type="search"
                        placeholder="Name, admission number or phone"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="input min-h-[44px]"
                    />
                </div>
            </FilterCard>

            {loading && <LoadingState />}
            {error && <Alert tone="error" title="Could not load the report">{error}</Alert>}

            <StatGrid>
                <StatTile label="Students who owe fees" value={String(filteredData.length)} />
                <StatTile label="Still to collect" value={totalDue} money tone="bad" />
                <StatTile label="Total fee" value={totalFee} money />
                <StatTile label="Average owed per student" value={`₹${(filteredData.length ? Math.round(totalDue / filteredData.length) : 0).toLocaleString('en-IN')}`} />
            </StatGrid>

            <ResultsBar title={listTitle} count={filteredData.length}>
                <ExportButtons onExcel={onExcel} onPdf={onPdf} disabled={!filteredData.length} />
            </ResultsBar>

            <div className="card overflow-hidden">
                {filteredData.length === 0 ? (
                    <EmptyState compact icon={<span className="text-xl">🎉</span>} title="No students with pending dues!" />
                ) : (
                    <>
                        {/* Phone: cards */}
                        <ul className="md:hidden divide-y divide-slate-100">
                            {pageRows.map((s, idx) => (
                                <li key={s.student_id || idx} className="px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[15px] font-semibold text-slate-900 break-words">{s.name}</p>
                                            <p className="text-sm text-slate-500">{s.class} {s.section} · Adm {admNo(s)}</p>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-xs text-slate-500">Owes</p>
                                            <p className="text-base font-bold text-red-600 whitespace-nowrap">₹{s.due_amount?.toLocaleString('en-IN')}</p>
                                        </div>
                                    </div>
                                    <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                                        <CardField label="Father">{father(s)}</CardField>
                                        <CardField label="Total fee">₹{s.total_fee?.toLocaleString('en-IN')}</CardField>
                                        <CardField label="Paid"><span className="text-emerald-700">₹{paid(s)?.toLocaleString('en-IN')}</span></CardField>
                                    </dl>
                                    {s.father_mobile && (
                                        <a href={`tel:${s.father_mobile}`} className="btn-soft btn-sm w-full min-h-[44px] mt-3">
                                            <Phone className="w-4 h-4" /> Call {s.father_mobile}
                                        </a>
                                    )}
                                </li>
                            ))}
                            <li className="px-4 py-3 bg-slate-50 text-sm flex flex-wrap justify-between gap-2 font-semibold">
                                <span>Total</span>
                                <span className="text-red-600">Owed ₹{totalDue.toLocaleString('en-IN')}</span>
                            </li>
                        </ul>

                        {/* Wide screens: table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-50 text-xs font-medium text-slate-600 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left">No.</th>
                                        <th className="px-4 py-3 text-left">Student</th>
                                        <th className="px-4 py-3 text-left">Admission no.</th>
                                        <th className="px-4 py-3 text-left">Class</th>
                                        <th className="px-4 py-3 text-left">Father</th>
                                        <th className="px-4 py-3 text-left">Phone</th>
                                        <th className="px-4 py-3 text-right">Total fee</th>
                                        <th className="px-4 py-3 text-right">Paid</th>
                                        <th className="px-4 py-3 text-right">Still owed</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pageRows.map((s, idx) => (
                                        <tr key={s.student_id || idx} className="hover:bg-slate-50 h-[45px]">
                                            <td className="px-4 py-3 text-slate-500">{((currentPage - 1) * rowsPerPage) + idx + 1}</td>
                                            <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                                            <td className="px-4 py-3 text-brand-600">{admNo(s)}</td>
                                            <td className="px-4 py-3">{s.class} {s.section}</td>
                                            <td className="px-4 py-3 text-slate-600">{father(s)}</td>
                                            <td className="px-4 py-3">
                                                <a href={`tel:${s.father_mobile}`} className="text-brand-600 hover:underline">{s.father_mobile}</a>
                                            </td>
                                            <td className="px-4 py-3 text-right">₹{s.total_fee?.toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-right text-emerald-600">₹{paid(s)?.toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-right font-bold text-red-600">₹{s.due_amount?.toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                    {Array.from({ length: rowsPerPage - pageRows.length }).map((_, i) => (
                                        <tr key={`empty-${i}`} className="h-[45px]"><td colSpan={9}>&nbsp;</td></tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 font-semibold border-t-2 border-slate-200">
                                    <tr>
                                        <td colSpan={6} className="px-4 py-3 text-right">Total:</td>
                                        <td className="px-4 py-3 text-right">₹{totalFee.toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-3 text-right text-emerald-600">₹{(totalFee - totalDue).toLocaleString('en-IN')}</td>
                                        <td className="px-4 py-3 text-right text-red-600">₹{totalDue.toLocaleString('en-IN')}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </>
                )}
                <Pager
                    currentPage={currentPage}
                    totalPages={Math.ceil(filteredData.length / rowsPerPage)}
                    onPageChange={onPageChange}
                    totalRecords={filteredData.length}
                    perPage={rowsPerPage}
                />
            </div>

            {/* Owed by class */}
            {filteredData.length > 0 && (
                <div className="card p-4">
                    <h4 className="text-base font-semibold mb-3 text-slate-900">Still owed, by class</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {Object.entries(
                            filteredData.reduce((acc: any, s) => {
                                const key = `${s.class} ${s.section || ''}`;
                                acc[key] = (acc[key] || 0) + (s.due_amount || 0);
                                return acc;
                            }, {})
                        ).map(([cls, amt]: any) => (
                            <div key={cls} className="rounded-xl border border-slate-200 p-3 min-w-0">
                                <p className="text-xs text-slate-500 font-medium mb-1 break-words">{cls}</p>
                                <p className="font-bold text-red-600 text-base sm:text-lg break-words">₹{Number(amt).toLocaleString('en-IN')}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DueReportView;
