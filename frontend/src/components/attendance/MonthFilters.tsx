import React from 'react';
import { Field, Button } from '../ui';

interface MonthFiltersProps {
    classOptions: { id: number, class_name: string }[];
    sectionOptions: string[];
    selectedClass: string;
    setSelectedClass: (v: string) => void;
    selectedSection: string;
    setSelectedSection: (v: string) => void;
    selectedMonth: number;
    setSelectedMonth: (v: number) => void;
    selectedYear: number;
    setSelectedYear: (v: number) => void;
    loading: boolean;
    onSubmit: () => void;
    submitLabel: string;
    idPrefix: string;
}

/** Class / section / month / year picker used by the monthly register screens. */
const MonthFilters: React.FC<MonthFiltersProps> = ({
    classOptions, sectionOptions, selectedClass, setSelectedClass, selectedSection, setSelectedSection,
    selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, loading, onSubmit, submitLabel, idPrefix,
}) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        <Field label="Class" htmlFor={`${idPrefix}-class`}>
            <select id={`${idPrefix}-class`} value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="input">
                <option value="">Choose a class</option>
                {classOptions.map(c => <option key={c.id} value={c.class_name}>{c.class_name}</option>)}
            </select>
        </Field>
        <Field label="Section (optional)" htmlFor={`${idPrefix}-section`}>
            <select id={`${idPrefix}-section`} value={selectedSection} onChange={e => setSelectedSection(e.target.value)} className="input">
                <option value="">All sections</option>
                {sectionOptions.map(section => <option key={section} value={section}>{section}</option>)}
            </select>
        </Field>
        <Field label="Month" htmlFor={`${idPrefix}-month`}>
            <select id={`${idPrefix}-month`} value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="input">
                {Array.from({ length: 12 }, (_, i) => i + 1)
                    .filter(m => {
                        const now = new Date();
                        if (selectedYear > now.getFullYear()) return false;
                        if (selectedYear === now.getFullYear() && m > (now.getMonth() + 1)) return false;
                        return true;
                    })
                    .map(m => (
                        <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                    ))}
            </select>
        </Field>
        <Field label="Year" htmlFor={`${idPrefix}-year`}>
            <input
                id={`${idPrefix}-year`}
                type="number"
                inputMode="numeric"
                value={selectedYear}
                max={new Date().getFullYear()}
                onChange={e => setSelectedYear(parseInt(e.target.value))}
                className="input"
            />
        </Field>
        <Button onClick={onSubmit} loading={loading} className="min-h-[44px]" title={!selectedClass ? 'Choose a class first' : undefined}>
            {submitLabel}
        </Button>
    </div>
);

export default MonthFilters;
