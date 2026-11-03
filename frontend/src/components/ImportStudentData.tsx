import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet } from 'lucide-react';
import api from '../api';
import { DownloadIcon } from './icons';
import { notify } from './ui/feedback';
import { Alert, Steps, ActionBar, Button, LoadingState } from './ui';
import { JobPage, JobIntro, ChoiceSummary, DoneCard, studentsCount } from './student-jobs/common';

interface ImportStudentDataProps {
    onImportSuccess: () => void;
}

const STEPS = ['Get the template', 'Choose your file', 'Check and import', 'Done'];

/** Columns the school must fill (from the import rules below). */
const REQUIRED_COLUMNS: { key: string; label: string }[] = [
    { key: 'first_name', label: 'Student first name' },
    { key: 'Fatherfirstname', label: 'Father first name' },
    { key: 'section', label: 'Section' },
];

/** Columns shown in the preview, when the file has them. */
const PREVIEW_COLUMNS: { key: string; label: string }[] = [
    { key: 'admission_no', label: 'Admission number' },
    { key: 'first_name', label: 'First name' },
    { key: 'last_name', label: 'Last name' },
    { key: 'class', label: 'Class' },
    { key: 'section', label: 'Section' },
    { key: 'Fatherfirstname', label: 'Father' },
];

const MAX_ROWS = 2000;

interface FilePreview {
    rows: Record<string, any>[];
    columns: string[];
    problems: string[];
}

interface UploadResult {
    ok: boolean;
    message: string;
    errors: string[];
    totalErrors?: number;
}

const isBlank = (v: any) => v === undefined || v === null || `${v}`.trim() === '';

/** Read the chosen file in the browser only to show a preview. The real import is done by the server. */
const readPreview = async (file: File): Promise<FilePreview> => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = (XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }) as Record<string, any>[])
        .filter(r => Object.values(r).some(v => !isBlank(v)));
    const columns = rows.length ? Object.keys(rows[0]) : [];

    const problems: string[] = [];
    if (rows.length > MAX_ROWS) problems.push(`The file has ${rows.length} rows. Only ${MAX_ROWS} can be imported at a time. Split it into smaller files.`);
    REQUIRED_COLUMNS.forEach(col => {
        if (!columns.includes(col.key)) {
            problems.push(`Column "${col.key}" (${col.label}) is missing. Use the template without changing the column names.`);
            return;
        }
        const missing = rows.map((r, i) => (isBlank(r[col.key]) ? i + 2 : 0)).filter(Boolean);
        if (missing.length) {
            const list = missing.slice(0, 5).join(', ') + (missing.length > 5 ? ` and ${missing.length - 5} more` : '');
            problems.push(`${col.label} is empty in row ${list}.`);
        }
    });
    return { rows, columns, problems };
};

const ImportStudentData: React.FC<ImportStudentDataProps> = ({ onImportSuccess }) => {
    const [step, setStep] = useState(0);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<FilePreview | null>(null);
    const [reading, setReading] = useState(false);
    const [readError, setReadError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<UploadResult | null>(null);
    const [downloading, setDownloading] = useState(false);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            setSelectedFile(file);
            setResult(null);
            setPreview(null);
            setReadError('');
            setReading(true);
            try {
                setPreview(await readPreview(file));
            } catch {
                setReadError('We could not read this file here, but you can still try to import it.');
            } finally {
                setReading(false);
            }
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setResult({ ok: false, message: 'Choose a file first.', errors: [] });
            return;
        }
        const formData = new FormData();
        formData.append('file', selectedFile);

        setUploading(true);
        setResult(null);
        try {
            const response = await api.post('/students/upload_csv', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const data = response.data;
            setResult({ ok: true, message: data.message || 'Import finished.', errors: data.errors || [], totalErrors: data.total_errors });
            notify.success(data.message || 'Students imported');
            setStep(3);
        } catch (error: any) {
            console.error("Upload error:", error);
            if (error.response) {
                console.error("Backend response data:", error.response.data);
                const data = error.response.data || {};
                if (data.errors && data.errors.length > 0) {
                    setResult({ ok: false, message: 'Nothing was imported. Fix these rows in your file and try again.', errors: data.errors, totalErrors: data.total_errors });
                } else {
                    setResult({ ok: false, message: data.error || data.message || 'The import did not work. Check the file and try again.', errors: [] });
                }
            } else if (error.request) {
                setResult({ ok: false, message: 'No reply from the server. Check your internet and try again.', errors: [] });
            } else {
                setResult({ ok: false, message: error.message, errors: [] });
            }
        } finally {
            setUploading(false);
        }
    };

    const handleDownloadTemplate = async () => {
        setDownloading(true);
        try {
            const response = await api.get('/students/template', {
                responseType: 'blob', // Important for binary data
            });

            // Create a link to download the blob
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'student_import_template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Error downloading template:", error);
            notify.error("Could not download the template. Try again.");
        } finally {
            setDownloading(false);
        }
    };

    const instructions = [
        "Do not change the columns of the template.",
        `Up to ${MAX_ROWS} students in one file.`,
        "Make a separate file for each class.",
        "Student first name, father first name and section must be filled.",
        "Format mobile number and Aadhaar number cells as text (Format cells → Text).",
        "Write dates as DD/MM/YYYY (you can use / or - or .).",
        "Status: 0 = new student, 1 = promoted student.",
        "Gender: 1 = male, 2 = female, 3 = other.",
        "Student type: 1 = day scholar, 2 = hosteller. Left empty means day scholar.",
    ];

    const errorList = (r: UploadResult) => r.errors.length > 0 && (
        <ul className="mt-1 list-disc pl-4 space-y-0.5">
            {r.errors.map((e, i) => <li key={i}>{e}</li>)}
            {r.totalErrors && r.totalErrors > r.errors.length ? <li>…and {r.totalErrors - r.errors.length} more</li> : null}
        </ul>
    );

    /* ------------------------------------------------------------ Step 1: template */
    if (step === 0) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={0} />
                <JobIntro>Add many students at once from an Excel file. First get the template and fill it in.</JobIntro>
                <div className="card">
                    <div className="card-body space-y-4">
                        <Button variant="secondary" onClick={handleDownloadTemplate} loading={downloading} icon={<DownloadIcon className="w-5 h-5" />} className="w-full sm:w-auto min-h-[44px]">
                            Download Excel template
                        </Button>
                        <div>
                            <p className="font-semibold text-slate-900">How to fill it</p>
                            <ol className="mt-2 list-decimal pl-5 space-y-1.5 text-sm text-slate-700">
                                {instructions.map((inst, index) => <li key={index}>{inst}</li>)}
                            </ol>
                        </div>
                    </div>
                </div>
                <ActionBar>
                    <Button size="lg" onClick={() => setStep(1)}>I have my file ready</Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Done */
    if (step === 3 && result?.ok) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={3} />
                <DoneCard title="Import finished">
                    <p>{result.message}</p>
                </DoneCard>
                {result.errors.length > 0 && (
                    <Alert tone="warning" title="Some rows were not imported">
                        {errorList(result)}
                    </Alert>
                )}
                <ActionBar>
                    <Button variant="secondary" size="lg" onClick={() => { setSelectedFile(null); setPreview(null); setResult(null); setStep(1); }}>
                        Import another file
                    </Button>
                    <Button size="lg" onClick={onImportSuccess}>See all students</Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Step 2: choose file */
    if (step === 1) {
        return (
            <JobPage>
                <Steps steps={STEPS} current={1} onJump={i => setStep(i)} />
                <div className="card">
                    <div className="card-body">
                        <label
                            htmlFor="import-file"
                            className="flex flex-col items-center justify-center w-full px-4 py-8 border-2 border-slate-300 border-dashed rounded-xl bg-slate-50 hover:bg-brand-50 hover:border-brand-400 cursor-pointer transition-colors text-center"
                        >
                            <FileSpreadsheet className="w-10 h-10 text-slate-400 mb-2" />
                            {selectedFile ? (
                                <>
                                    <span className="font-medium text-brand-700 break-all">{selectedFile.name}</span>
                                    <span className="text-sm text-slate-500 mt-1">Tap to choose a different file</span>
                                </>
                            ) : (
                                <>
                                    <span className="font-medium text-brand-700">Choose the filled Excel file</span>
                                    <span className="text-sm text-slate-500 mt-1">.xlsx, .xls or .csv</span>
                                </>
                            )}
                            <input id="import-file" type="file" className="sr-only" onChange={handleFileChange} accept=".csv, .xlsx, .xls" />
                        </label>
                    </div>
                </div>
                {reading && <LoadingState label="Reading your file…" />}
                {readError && <Alert tone="warning">{readError}</Alert>}
                <ActionBar note={!selectedFile ? 'Choose a file first' : undefined}>
                    <Button variant="secondary" size="lg" onClick={() => setStep(0)}>Back</Button>
                    <Button size="lg" disabled={!selectedFile || reading} onClick={() => setStep(2)}>Next</Button>
                </ActionBar>
            </JobPage>
        );
    }

    /* ------------------------------------------------------------ Step 3: check + import */
    const shownColumns = preview ? PREVIEW_COLUMNS.filter(c => preview.columns.includes(c.key)) : [];
    const rowCount = preview?.rows.length ?? 0;
    return (
        <JobPage>
            <Steps steps={STEPS} current={2} onJump={i => setStep(i)} />
            <ChoiceSummary
                title={selectedFile?.name || '—'}
                detail={preview ? `${studentsCount(rowCount)} found in the file` : 'File chosen'}
                changeLabel="Change file"
                onChange={() => setStep(1)}
            />

            {preview && preview.problems.length > 0 && (
                <Alert tone="warning" title="Please check your file">
                    <ul className="list-disc pl-4 space-y-0.5">
                        {preview.problems.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                </Alert>
            )}

            {preview && rowCount > 0 && shownColumns.length > 0 && (
                <div className="card overflow-hidden">
                    <div className="card-header py-2.5">
                        <span className="font-semibold text-slate-900">First {Math.min(5, rowCount)} of {rowCount}</span>
                    </div>
                    <ul className="md:hidden divide-y divide-slate-100">
                        {preview.rows.slice(0, 5).map((r, i) => (
                            <li key={i} className="px-4 py-2.5 text-sm">
                                <p className="font-medium text-slate-900">{[r.first_name, r.last_name].filter(Boolean).join(' ') || '(no name)'}</p>
                                <p className="text-slate-500">
                                    {[r.admission_no && `Adm. ${r.admission_no}`, (r.class || r.section) && `Class ${[r.class, r.section].filter(Boolean).join('-')}`, r.Fatherfirstname && `Father: ${r.Fatherfirstname}`].filter(Boolean).join(' · ')}
                                </p>
                            </li>
                        ))}
                    </ul>
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr>{shownColumns.map(c => <th key={c.key} className="px-4 py-2 text-left">{c.label}</th>)}</tr>
                            </thead>
                            <tbody>
                                {preview.rows.slice(0, 5).map((r, i) => (
                                    <tr key={i} className="border-t border-slate-100">
                                        {shownColumns.map(c => <td key={c.key} className="px-4 py-2">{`${r[c.key] ?? ''}` || '—'}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {preview && rowCount === 0 && <Alert tone="warning">This file looks empty. Check that you saved your data in it.</Alert>}

            {result && !result.ok && (
                <Alert tone="error" title="Import did not work">
                    <p>{result.message}</p>
                    {errorList(result)}
                </Alert>
            )}

            <ActionBar note="Nothing is saved until you tap Import.">
                <Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button>
                <Button size="lg" onClick={handleUpload} disabled={!selectedFile} loading={uploading}>
                    {preview && rowCount > 0 ? `Import ${studentsCount(rowCount)}` : 'Import file'}
                </Button>
            </ActionBar>
        </JobPage>
    );
};

export default ImportStudentData;
