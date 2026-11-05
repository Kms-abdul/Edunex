import React, { useState, useEffect } from 'react';
import { Page } from '../App';
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import api from '../api';
import { notify, confirmDialog } from './ui/feedback';
import { EmptyState, Alert, ActionBar, Button, DataList, Field } from './ui';
import type { Column } from './ui';
import { consumeIntent } from '../utils/intent';
import DailyAttendance from './attendance/DailyAttendance';
import MonthFilters from './attendance/MonthFilters';
import { getNormalizedBranch, prettyDate, statusBadge, statusLabel } from './attendance/shared';

interface StudentAttendanceProps {
    navigateTo: (page: Page) => void;
    defaultTab?: AttendanceTab;
}

type AttendanceTab = 'take' | 'today' | 'register' | 'absent-report';

/** Key for the letters used in the monthly grids. */
const StatusLegend: React.FC<{ extra?: React.ReactNode }> = ({ extra }) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1"><span className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 font-semibold flex items-center justify-center">P</span> Present</span>
        <span className="inline-flex items-center gap-1"><span className="w-5 h-5 rounded bg-red-100 text-red-800 font-semibold flex items-center justify-center">A</span> Absent</span>
        <span className="inline-flex items-center gap-1"><span className="w-5 h-5 rounded bg-amber-100 text-amber-800 font-semibold flex items-center justify-center">L</span> Leave</span>
        <span className="inline-flex items-center gap-1"><span className="w-5 h-5 rounded bg-gray-200 text-gray-600 font-semibold flex items-center justify-center">H</span> Holiday / week off</span>
        <span className="inline-flex items-center gap-1"><span className="w-5 h-5 rounded bg-gray-50 text-gray-400 font-semibold flex items-center justify-center">-</span> Not marked</span>
        {extra}
    </div>
);

const RegisterViewTab: React.FC = () => {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [classOptions, setClassOptions] = useState<{ id: number, class_name: string }[]>([]);
    const [sectionOptions, setSectionOptions] = useState<string[]>([]);
    const [reportData, setReportData] = useState<any>(null);
    const [blockedDates, setBlockedDates] = useState<{ [date: string]: string }>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/classes')
            .then(res => setClassOptions(res.data.classes || []))
            .catch(err => console.error("Failed to load classes", err));
    }, []);

    useEffect(() => {
        if (!selectedClass) {
            setSectionOptions([]);
            setSelectedSection('');
            return;
        }

        const branch = getNormalizedBranch();
        const academicYear = localStorage.getItem('academicYear') || '';
        api.get('/sections', {
            params: {
                class: selectedClass,
                branch,
                academic_year: academicYear,
            }
        })
            .then(res => setSectionOptions(res.data.sections || []))
            .catch(err => {
                console.error("Failed to load sections", err);
                setSectionOptions([]);
            });
    }, [selectedClass]);

    const handleGetReport = async () => {
        if (!selectedClass) {
            notify("Choose a class first");
            return;
        }
        setLoading(true);
        try {
            const globalBranch = getNormalizedBranch();
            const branchParam = globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;
            const res = await api.get('/attendance', {
                params: {
                    class: selectedClass,
                    section: selectedSection,
                    month: selectedMonth,
                    year: selectedYear,
                    branch: branchParam
                }
            });
            setReportData(res.data);

            // Fetch blocked dates for this month
            try {
                const blockRes = await api.post('/config/check-month', {
                    month: selectedMonth,
                    year: selectedYear,
                    branch_name: branchParam,
                    class_name: selectedClass,
                });
                setBlockedDates(blockRes.data?.blocked_dates || {});
            } catch (blockErr) {
                console.error('Failed to fetch blocked dates:', blockErr);
                setBlockedDates({});
            }
        } catch (error) {
            console.error("Error fetching report:", error);
            notify("Failed to fetch report");
        } finally {
            setLoading(false);
        }
    };

    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Present': return 'bg-emerald-100 text-emerald-800';
            case 'Absent': return 'bg-red-100 text-red-800';
            case 'Leave': return 'bg-amber-100 text-amber-800';
            case 'Holiday': return 'bg-gray-100 text-gray-800';
            case 'Sunday': return 'bg-pink-100 text-pink-800';
            case 'Weekoff': return 'bg-blue-100 text-blue-800';
            default: return '';
        }
    };

    const getStatusShort = (status: string) => {
        return status ? status.charAt(0) : '-';
    };
    const handleExportExcel = () => {
        if (!reportData) return;

        const sheetData: any[] = [];

        // ---- Header Row ----
        const headerRow = [
            "Student Name",
            "Admission No",
            "Roll No",
            ...daysArray.map(d => d.toString()),
            "Present",
            "Absent",
            "Total Working Days",
            "Attendance %"
        ];

        sheetData.push(headerRow);

        // ---- Student Rows ----
        reportData.students.forEach((student: any) => {
            const attendanceMap = reportData.attendance[student.student_id] || {};

            let presentCount = 0;
            let absentCount = 0;

            const dayValues = daysArray.map(d => {
                const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

                // Check if date is blocked
                if (blockedDates[dateStr]) {
                    return "H";
                }

                const status = attendanceMap[dateStr];

                if (status === "Present") {
                    presentCount++;
                    return "P";
                }
                if (status === "Absent") {
                    absentCount++;
                    return "A";
                }
                return "-";
            });

            // Filter blocked dates to only include those in the current month
            const blockedDatesInMonth = Object.keys(blockedDates).filter(dateStr => {
                const dateParts = dateStr.split('-');
                const dateYear = parseInt(dateParts[0], 10);
                const dateMonth = parseInt(dateParts[1], 10);
                return dateYear === selectedYear && dateMonth === selectedMonth;
            }).length;

            const workingDays = daysInMonth - blockedDatesInMonth;
            const percentage = workingDays > 0
                ? ((presentCount / workingDays) * 100).toFixed(1)
                : "0.0";

            sheetData.push([
                student.name,
                student.admNo,
                student.rollNo || "",
                ...dayValues,
                presentCount,
                absentCount,
                workingDays,
                `${percentage}%`
            ]);
        });

        // ---- Create Workbook ----
        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Register");

        // ---- Export ----
        const excelBuffer = XLSX.write(workbook, {
            bookType: "xlsx",
            type: "array"
        });

        const blob = new Blob(
            [excelBuffer],
            { type: "application/octet-stream" }
        );

        saveAs(
            blob,
            `Attendance_${selectedClass}_${selectedMonth}_${selectedYear}.xlsx`
        );
    };

    return (
        <div className="space-y-4">
            <div className="card">
                <div className="card-body space-y-4">
                    <p className="text-sm text-slate-600">See who came on each day of a month.</p>
                    <MonthFilters
                        idPrefix="reg"
                        classOptions={classOptions}
                        sectionOptions={sectionOptions}
                        selectedClass={selectedClass}
                        setSelectedClass={setSelectedClass}
                        selectedSection={selectedSection}
                        setSelectedSection={setSelectedSection}
                        selectedMonth={selectedMonth}
                        setSelectedMonth={setSelectedMonth}
                        selectedYear={selectedYear}
                        setSelectedYear={setSelectedYear}
                        loading={loading}
                        onSubmit={handleGetReport}
                        submitLabel="Show register"
                    />
                </div>
            </div>

            {reportData && (reportData.students || []).length === 0 && (
                <div className="card"><EmptyState compact title="No students found" description="There are no students in this class and section." /></div>
            )}
            {reportData && (reportData.students || []).length > 0 && (
                <div className="card overflow-hidden">
                    <div className="card-body flex flex-wrap items-center justify-between gap-3">
                        <StatusLegend />
                        <button onClick={handleExportExcel} disabled={!reportData} className="btn-secondary btn-sm min-h-[40px]">
                            Download Excel
                        </button>
                    </div>
                    <p className="px-4 pb-2 text-xs text-slate-500 md:hidden">Swipe the table sideways to see all days.</p>
                        <div className="overflow-x-auto border-t border-slate-200">
                            <table className="min-w-full divide-y divide-gray-200 text-xs">
                                <thead className="">
                                    <tr>
                                        <th className="px-2 py-2 text-left sticky left-0 z-10 w-36 sm:w-48 bg-slate-50">Student</th>
                                        <th className="px-2 py-2 text-center border-1 border-gray-100">Roll no.</th>
                                        {daysArray.map(d => {
                                            const date = new Date(selectedYear, selectedMonth - 1, d);
                                            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                                            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                            const isBlocked = !!blockedDates[dateStr];
                                            return (
                                                <th key={d} className={`px-1 py-2 text-center w-8 border-l border-gray-100 ${isBlocked ? 'bg-gray-300 text-gray-600' : 'text-gray-500'}`}
                                                    title={isBlocked ? blockedDates[dateStr] : undefined}
                                                >
                                                    <div className="flex flex-col items-center justify-center leading-tight">
                                                        <span>{d}</span>
                                                        <span className="text-[10px] font-normal">{isBlocked ? 'H' : dayName}</span>
                                                    </div>

                                                </th>

                                            );
                                        })}
                                        <th className="px-2 py-2 text-center bg-blue-50 border-l border-blue-100">Present</th>
                                        <th className="px-2 py-2 text-center bg-blue-50">Absent</th>
                                        <th className="px-2 py-2 text-center bg-blue-50">Working days</th>
                                        <th className="px-2 py-2 text-center bg-blue-50">Attendance %</th>
                                    </tr>

                                </thead>

                                <tbody className="bg-white divide-y divide-gray-200">
                                    {reportData.students.map((student: any) => {
                                        const studentAttendance = reportData.attendance[student.student_id] || {};

                                        // Calculate Stats
                                        let presentCount = 0;
                                        let absentCount = 0;

                                        daysArray.forEach(d => {
                                            const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                            if (blockedDates[dateStr]) return; // Skip blocked dates
                                            const status = studentAttendance[dateStr];
                                            if (status === 'Present') presentCount++;
                                            if (status === 'Absent') absentCount++;
                                        });

                                        const blockedCount = Object.keys(blockedDates).filter(dateStr => {
                                            const [year, month] = dateStr.split('-').map(Number);
                                            return year === selectedYear && month === selectedMonth;
                                        }).length;
                                        const workingDays = daysInMonth - blockedCount;
                                        const percentage = workingDays > 0 ? ((presentCount / workingDays) * 100).toFixed(1) : '0.0';

                                        return (
                                            <tr key={student.student_id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-2 py-1 font-medium text-gray-900 sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[8rem] max-w-[10rem] sm:max-w-none">
                                                    <div className="break-words">{student.name}</div>
                                                    <div className="text-[10px] text-gray-500">{student.admNo}</div>
                                                </td>
                                                <td className="px-2 py-1 text-center font-medium text-gray-700 bg-white border-l border-gray-100">
                                                    {student.rollNo || "-"}
                                                </td>

                                                {daysArray.map(d => {
                                                    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                    const isBlocked = !!blockedDates[dateStr];

                                                    if (isBlocked) {
                                                        return (
                                                            <td key={d} className="px-1 py-1 text-center border-l border-gray-100 bg-gray-200 text-gray-500"
                                                                title={blockedDates[dateStr]}
                                                            >
                                                                H
                                                            </td>
                                                        );
                                                    }

                                                    const status = studentAttendance[dateStr];
                                                    return (
                                                        <td key={d} className={`px-1 py-1 text-center border-l border-gray-100 ${getStatusColor(status)}`}>
                                                            {getStatusShort(status)}
                                                        </td>
                                                    );
                                                })}

                                                <td className="px-2 py-1 text-center font-bold text-green-700 bg-blue-50 border-l border-blue-100">{presentCount}</td>
                                                <td className="px-2 py-1 text-center font-bold text-red-700 bg-blue-50">{absentCount}</td>
                                                <td className="px-2 py-1 text-center font-semibold text-gray-700 bg-blue-50">{workingDays}</td>
                                                <td className="px-2 py-1 text-center font-bold text-blue-700 bg-blue-50">{percentage}%</td>

                                            </tr>

                                        );

                                    })}

                                </tbody>
                            </table>
                        </div>
                </div>
            )}
        </div>
    );
};

const MonthlyAttendanceEntryTab: React.FC = () => {
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [classOptions, setClassOptions] = useState<{ id: number, class_name: string }[]>([]);
    const [sectionOptions, setSectionOptions] = useState<string[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [attendanceData, setAttendanceData] = useState<{ [key: string]: string }>({});
    const [originalData, setOriginalData] = useState<{ [key: string]: string }>({});
    const [blockedDates, setBlockedDates] = useState<{ [date: string]: string }>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/classes')
            .then(res => setClassOptions(res.data.classes || []))
            .catch(err => console.error("Failed to load classes", err));
    }, []);

    useEffect(() => {
        if (!selectedClass) {
            setSectionOptions([]);
            setSelectedSection('');
            return;
        }

        const branch = getNormalizedBranch();
        const academicYear = localStorage.getItem('academicYear') || '';
        api.get('/sections', {
            params: {
                class: selectedClass,
                branch,
                academic_year: academicYear,
            }
        })
            .then(res => setSectionOptions(res.data.sections || []))
            .catch(err => {
                console.error("Failed to load sections", err);
                setSectionOptions([]);
            });
    }, [selectedClass]);

    const handleGetStudents = async () => {
        if (!selectedClass) {
            notify("Choose a class first");
            return;
        }
        setLoading(true);
        try {
            const globalBranch = getNormalizedBranch();
            const branchParam = globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;
            const res = await api.get('/attendance', {
                params: {
                    class: selectedClass,
                    section: selectedSection,
                    month: selectedMonth,
                    year: selectedYear,
                    branch: branchParam
                }
            });

            setStudents(res.data.students || []);

            // Flatten attendance data for easier editing: "studentId-date" -> status
            const flatAttendance: { [key: string]: string } = {};
            const fetchedAttendance = res.data.attendance || {};

            Object.keys(fetchedAttendance).forEach(studentId => {
                const dates = fetchedAttendance[studentId];
                Object.keys(dates).forEach(date => {
                    flatAttendance[`${studentId}_${date}`] = dates[date];
                });
            });

            setAttendanceData(flatAttendance);
            setOriginalData({ ...flatAttendance }); // Deep copy for comparison

            // Fetch blocked dates for this month
            try {
                const blockRes = await api.post('/config/check-month', {
                    month: selectedMonth,
                    year: selectedYear,
                    branch_name: branchParam,
                    class_name: selectedClass,
                });
                setBlockedDates(blockRes.data?.blocked_dates || {});
            } catch (blockErr) {
                console.error('Failed to fetch blocked dates:', blockErr);
                setBlockedDates({});
            }

        } catch (error) {
            console.error("Error fetching data:", error);
            notify("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    };

    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    const toggleStatus = (studentId: number, day: number) => {
        const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        // Block toggling on holiday/weekoff dates
        if (blockedDates[dateStr]) {
            notify(`Cannot mark attendance: ${blockedDates[dateStr]}`);
            return;
        }

        const key = `${studentId}_${dateStr}`;
        const currentStatus = attendanceData[key];

        // STRICT Toggle: Present <-> Absent only (per user request)
        let newStatus = 'Present';
        if (currentStatus === 'Present') newStatus = 'Absent';
        else if (currentStatus === 'Absent') newStatus = 'Present';
        else newStatus = 'Present'; // Fallback for any other status to Present

        setAttendanceData(prev => ({
            ...prev,
            [key]: newStatus
        }));
    };

    const handleReset = async () => {
        if (await confirmDialog("Undo all changes you have not saved yet?")) {
            setAttendanceData({ ...originalData });
        }
    };

    const handleDownloadTemplate = async () => {
        if (!selectedClass) return notify("Choose a class first");

        try {
            const globalBranch = getNormalizedBranch();
            const branchParam = globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;
            const academicYear = localStorage.getItem('academicYear') || '';

            // We can download directly using window.open but that might lack Auth headers
            // Better to use axios with blob response type
            const res = await api.get('/attendance/template', {
                params: {
                    class: selectedClass,
                    section: selectedSection,
                    month: selectedMonth,
                    year: selectedYear,
                    branch: branchParam,
                    academic_year: academicYear
                },
                responseType: 'blob'
            });

            // Create blob link to download
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Attendance_Template_${selectedClass}_${selectedMonth}_${selectedYear}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();

        } catch (error) {
            console.error("Download failed", error);
            notify("Failed to download template");
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('month', selectedMonth.toString());
        formData.append('year', selectedYear.toString());

        setLoading(true);
        try {
            await api.post('/attendance/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            notify("Upload Successful!");
            handleGetStudents(); // Refresh data
        } catch (error: any) {
            console.error("Upload failed", error);
            notify(`Upload failed: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
            // Reset input
            e.target.value = '';
        }
    };

    // Excel template download / upload is not wired into the UI yet (see the commented-out
    // buttons below). Kept intentionally; referenced here so the build stays clean.
    void handleDownloadTemplate;
    void handleUpload;

    const handleSave = async () => {
        if (saving || Object.keys(attendanceData).length === 0) return;
        setSaving(true);
        try {
            // Transform flat map back to API payload
            // We need to send ALL data or just changes? 
            // The API supports a list of {student_id, date, status}
            // We will send all non-empty entries to be safe/simple

            const attendanceList = Object.entries(attendanceData)
                .filter(([key, status]) => {
                    // Only include if status CHANGED from original
                    return status !== originalData[key];
                })
                .map(([key, status]) => {
                    // Key format: "123_2023-10-01"
                    const parts = key.split('_');
                    if (parts.length !== 2) return null; // Should not happen

                    const sId = parts[0];
                    const dStr = parts[1];

                    return {
                        student_id: parseInt(sId),
                        date: dStr,
                        status: status
                    };
                })
                .filter(item => item !== null);

            // Fallback: If attendanceList is empty, do nothing
            if (attendanceList.length === 0) {
                notify("No changes allowed to save.");
                setSaving(false);
                return;
            }

            // Use the date from the first item as a default fallback date 
            // to satisfy backend checks if they are strict or running old code
            const sampleDate = attendanceList[0]?.date || new Date().toLocaleDateString('en-CA') /* local YYYY-MM-DD, not UTC */;

            const res = await api.post('/attendance', {
                date: sampleDate, // Added global date as fallback
                attendance: attendanceList
            });

            if (res.data && res.data.stats) {
                let msg = `Attendance saved! Added: ${res.data.stats.added}, Updated: ${res.data.stats.updated}, Skipped: ${res.data.stats.skipped}`;
                if (res.data.stats.skipped > 0 && res.data.stats.skip_details) {
                    msg += `\nReasons: ${res.data.stats.skip_details.join(", ")}`;
                }
                notify(msg);
            } else {
                notify("Monthly attendance saved successfully!");
            }

            handleGetStudents(); // Refresh data

        } catch (error: any) {
            console.error("Error saving attendance:", error);
            if (error.response && error.response.data) {
                notify(`Failed to save attendance: ${JSON.stringify(error.response.data)}`);
            } else {
                notify(`Failed to save attendance: ${error.message}`);
            }
        } finally {
            setSaving(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Present': return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200';
            case 'Absent': return 'bg-red-100 text-red-800 hover:bg-red-200';
            case 'Leave': return 'bg-amber-100 text-amber-800 hover:bg-amber-200';
            case 'Holiday': return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
            case 'Sunday': return 'bg-pink-100 text-pink-800 hover:bg-pink-200';
            default: return 'bg-gray-50 text-gray-400 hover:bg-gray-200';
        }
    };

    const changedCount = Object.entries(attendanceData).filter(([key, status]) => status !== originalData[key]).length;
    const allStudentsLocked = students.length > 0 && students.every((s: any) => s.is_locked);

    return (
        <div className="space-y-4">
            <div className="card">
                <div className="card-body space-y-4">
                    <p className="text-sm text-slate-600">Fill or fix attendance for a whole month at once.</p>
                    <MonthFilters
                        idPrefix="entry"
                        classOptions={classOptions}
                        sectionOptions={sectionOptions}
                        selectedClass={selectedClass}
                        setSelectedClass={setSelectedClass}
                        selectedSection={selectedSection}
                        setSelectedSection={setSelectedSection}
                        selectedMonth={selectedMonth}
                        setSelectedMonth={setSelectedMonth}
                        selectedYear={selectedYear}
                        setSelectedYear={setSelectedYear}
                        loading={loading}
                        onSubmit={handleGetStudents}
                        submitLabel="Show students"
                    />
                    {/*
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={handleDownloadTemplate}
                            disabled={loading || students.length === 0}
                            className="btn-secondary btn-sm"
                        >
                            <span>Download Template</span>
                        </button>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleUpload}
                                className="hidden"
                                id="excel-upload"
                                disabled={loading}
                            />
                            <label
                                htmlFor="excel-upload"
                                className={`cursor-pointer bg-blue-100 text-blue-700 border border-blue-300 px-3 py-1.5 rounded-md hover:bg-blue-200 text-sm flex items-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <span>Upload Excel</span>
                            </label>
                        </div>
                    </div>
                    */}
                </div>
            </div>

            {students.length > 0 && (
                <>
                    {allStudentsLocked && (
                        <Alert tone="warning" title="These students are locked">
                            All students here have moved to a new class, so this month can't be changed.
                        </Alert>
                    )}
                    <div className="card overflow-hidden">
                        <div className="card-body space-y-2">
                            <p className="text-sm font-medium text-slate-800">Tap a box to switch between Present (P) and Absent (A).</p>
                            <StatusLegend />
                        </div>
                        <p className="px-4 pb-2 text-xs text-slate-500 md:hidden">Swipe the table sideways to see all days.</p>
                        <div className="overflow-auto border-t border-slate-200 max-h-[70vh]">
                                <table className="min-w-full divide-y divide-gray-200 text-xs relative">
                                    <thead className="sticky top-0 z-20 bg-slate-50">
                                        <tr>
                                            <th className="hidden sm:table-cell px-2 py-2 text-center sm:sticky left-0 z-30 w-16 bg-slate-50 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">Roll no.</th>
                                            <th className="hidden sm:table-cell px-2 py-2 text-center sm:sticky left-16 z-30 w-24 bg-slate-50 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">Adm. no.</th>
                                            <th className="px-2 py-2 text-left sticky left-0 sm:left-40 z-30 w-32 sm:w-48 bg-slate-50 shadow-[1px_0_0_0_rgba(0,0,0,0.1)]">Student</th>
                                            {daysArray.map(d => {
                                                const date = new Date(selectedYear, selectedMonth - 1, d);
                                                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                                                const isSunday = date.getDay() === 0;
                                                return (
                                                    <th key={d} className={`px-1 py-1 text-center w-9 border-l border-gray-100 ${isSunday ? 'bg-red-50 text-red-600' : 'text-gray-500'}`}>
                                                        <div className="flex flex-col items-center justify-center leading-tight">
                                                            <span>{d}</span>
                                                            <span className="text-[10px] font-normal">{dayName}</span>
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {students.map((student: any) => (
                                            <tr key={student.student_id} className="hover:bg-gray-50">
                                                <td className="hidden sm:table-cell px-2 py-1 text-center whitespace-nowrap text-gray-700 sm:sticky left-0 bg-white z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                    {student.rollNo || "-"}
                                                </td>
                                                <td className="hidden sm:table-cell px-2 py-1 text-center whitespace-nowrap text-gray-500 sm:sticky left-16 bg-white z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                    {student.admNo}
                                                </td>
                                                <td className="px-2 py-1 font-medium text-gray-900 sticky left-0 sm:left-40 bg-white z-10 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[8rem] max-w-[9rem] sm:max-w-none">
                                                    <div className="break-words leading-snug">{student.name}</div>
                                                    <div className="sm:hidden text-[10px] text-gray-500">Roll {student.rollNo || '-'}</div>
                                                    {student.is_locked && <div className="text-[10px] text-gray-500">Locked</div>}
                                                </td>
                                                {daysArray.map(d => {
                                                    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                    const isBlocked = !!blockedDates[dateStr];
                                                    const status = attendanceData[`${student.student_id}_${dateStr}`];

                                                    if (isBlocked) {
                                                        return (
                                                            <td
                                                                key={d}
                                                                title={blockedDates[dateStr]}
                                                                className="px-1 py-1 text-center border-l border-gray-100 bg-gray-200 text-gray-500 cursor-not-allowed"
                                                            >
                                                                H
                                                            </td>
                                                        );
                                                    }

                                                    return (
                                                        <td
                                                            key={d}
                                                            onClick={() => toggleStatus(student.student_id, d)}
                                                            title={`${student.name}, ${d}: ${statusLabel(status)}`}
                                                            className={`px-1 py-1 h-10 min-w-[2.25rem] text-center text-sm font-semibold border-l border-gray-100 cursor-pointer select-none ${getStatusColor(status)}`}
                                                        >
                                                            {status ? status.charAt(0) : '-'}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                        </div>
                    </div>

                    <ActionBar note={changedCount > 0 ? `${changedCount} ${changedCount === 1 ? 'change' : 'changes'} not saved yet` : 'No changes yet'}>
                        <Button
                            variant="secondary"
                            onClick={handleReset}
                            disabled={loading || saving || Object.keys(attendanceData).length === 0}
                        >
                            Undo changes
                        </Button>
                        <Button
                            variant="success"
                            onClick={handleSave}
                            disabled={loading || saving || students.every((s: any) => s.is_locked)}
                            loading={saving}
                        >
                            {saving ? "Saving..." : `Save changes${changedCount > 0 ? ` (${changedCount})` : ''}`}
                        </Button>
                    </ActionBar>
                </>
            )}
        </div>
    );
};

const RegisterView: React.FC = () => {
    const [subTab, setSubTab] = useState<'view' | 'entry'>('view');

    return (
        <div className="space-y-4">
            {/* Sub Tabs */}
            <div>
                <div className="segmented w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => setSubTab('view')}
                        className={`segmented-item flex-1 sm:flex-none min-h-[40px] ${subTab === 'view' ? 'segmented-item-active' : ''}`}
                    >
                        See register
                    </button>
                    <button
                        type="button"
                        onClick={() => setSubTab('entry')}
                        className={`segmented-item flex-1 sm:flex-none min-h-[40px] ${subTab === 'entry' ? 'segmented-item-active' : ''}`}
                    >
                        Edit a month
                    </button>
                </div>
            </div>

            {subTab === 'view' ? <RegisterViewTab /> : <MonthlyAttendanceEntryTab />}
        </div>
    );
};
const AbsentReport: React.FC = () => {
    const [reportType, setReportType] = useState<'today' | 'student'>('today');
    const [searchedDay, setSearchedDay] = useState(false);
    const [date, setDate] = useState(new Date().toLocaleDateString('en-CA') /* local YYYY-MM-DD, not UTC */);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSection, setSelectedSection] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [classOptions, setClassOptions] = useState<{ id: number, class_name: string }[]>([]);
    const [sectionOptions, setSectionOptions] = useState<string[]>([]);
    // const [smsSelected, setSmsSelected] = useState<Set<number>>(new Set());
    // const [sendingSms, setSendingSms] = useState(false);
    // const [smsResult, setSmsResult] = useState<{sent:number;failed:number;skipped:number}|null>(null);

    // const toggleSmsSelect = (id: number) => {
    //     setSmsSelected(prev => {
    //         const next = new Set(prev);
    //         next.has(id) ? next.delete(id) : next.add(id);
    //         return next;
    //     });
    // };

    // const toggleSelectAll = (checked: boolean) => {
    //     setSmsSelected(checked ? new Set(results.map((r: any) => r.student_id)) : new Set());
    // };

    // const handleSendSms = async () => {
    //     if (smsSelected.size === 0) return;
    //     if (!await confirmDialog(`Send SMS to parents of ${smsSelected.size} student(s)?`)) return;
    //     setSendingSms(true);
    //     setSmsResult(null);
    //     try {
    //         const res = await api.post('/attendance/send-sms', {
    //             date: date,
    //             student_ids: Array.from(smsSelected)
    //         });
    //         setSmsResult(res.data);
    //         setSmsSelected(new Set());
    //     } catch (err: any) {
    //         notify(`SMS error: ${err.response?.data?.error || err.message}`);
    //     } finally {
    //         setSendingSms(false);
    //     }
    // };

    useEffect(() => {
        api.get('/classes')
            .then(res => setClassOptions(res.data.classes || []))
            .catch(err => console.error("Failed to load classes", err));
    }, []);
    useEffect(() => {
        if (!selectedClass) {
            setSectionOptions([]);
            setSelectedSection('');
            return;
        }

        const branch = getNormalizedBranch();
        const academicYear = localStorage.getItem('academicYear') || '';
        api.get('/sections', {
            params: {
                class: selectedClass,
                branch,
                academic_year: academicYear,
            }
        })
            .then(res => setSectionOptions(res.data.sections || []))
            .catch(err => {
                console.error("Failed to load sections", err);
                setSectionOptions([]);
            });
    }, [selectedClass]);

    const handleSearchStudent = async () => {
        if (!searchQuery) {
            notify("Please enter a search term");
            return;
        }
        setLoading(true);
        try {
            const globalBranch = getNormalizedBranch();
            const branchParam = globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;
            const res = await api.get('/students', { params: { search: searchQuery, branch: branchParam } });
            const students = res.data.students || [];
            if (students.length === 0) {
                notify("No students found");
                setSearchResults([]);
            } else if (students.length === 1) {
                setSearchResults([]);
                handleSelectStudent(students[0]);
            } else {
                setSearchResults(students);
                setSelectedStudent(null);
            }
        } catch (error) {
            console.error("Error searching students:", error);
            notify("Failed to search students");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectStudent = (student: any) => {
        setSelectedStudent(student);
        setSearchResults([]);
        fetchStudentReport(student.student_id);
    };

    const fetchStudentReport = async (studentId: number) => {
        setLoading(true);
        try {
            const res = await api.get('/attendance', { params: { student_id: studentId } });
            const attendanceData = res.data.attendance || {};
            const records: any[] = [];
            if (attendanceData[studentId]) {
                Object.entries(attendanceData[studentId]).forEach(([d, status]) => {
                    records.push({ date: d, status: status });
                });
            }
            records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setResults(records);
        } catch (error) {
            console.error("Error fetching report:", error);
            notify("Failed to fetch report");
        } finally {
            setLoading(false);
        }
    };

    const handleGetTodayReport = async () => {
        setLoading(true);
        setResults([]);
        try {
            const globalBranch = getNormalizedBranch();
            const branchParam = globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;
            const params: any = { date: date, branch: branchParam };
            if (selectedClass) params.class = selectedClass;

            const res = await api.get('/attendance', { params });
            const students = res.data.students || [];
            const attendance = res.data.attendance || {};

            const absentStudents = students.filter((s: any) => {
                const status = attendance[s.student_id];
                return status === 'Absent' || status === 'Leave';
            }).map((s: any) => ({
                ...s,
                status: attendance[s.student_id]
            }));

            setResults(absentStudents);
            // setSmsSelected(new Set());
            // setSmsResult(null);
        } catch (error) {
            console.error("Error fetching report:", error);
            notify("Failed to fetch report");
        } finally {
            setLoading(false);
        }
    };

    const handleGetClassStudents = async () => {
        if (!selectedClass) {
            notify("Choose a class first");
            return;
        }
        setLoading(true);
        try {
            const globalBranch = getNormalizedBranch();
            const branchParam = globalBranch === "All Branches" || globalBranch === "All" ? "All" : globalBranch;
            const params: any = { class: selectedClass, branch: branchParam };
            if (selectedSection) params.section = selectedSection;
            const res = await api.get('/students', { params });
            setSearchResults(res.data.students || []);
            setSelectedStudent(null);
        } catch (e) {
            console.error(e);
            notify("Error fetching students");
        } finally {
            setLoading(false);
        }
    };

    const absentColumns: Column<any>[] = [
        { key: 'name', header: 'Name', primary: true, render: r => <span className="font-medium">{r.name}</span> },
        { key: 'class', header: 'Class', secondary: true, render: r => `Class ${r.class ?? '—'}${r.rollNo ? ` · Roll ${r.rollNo}` : ''}` },
        { key: 'admNo', header: 'Admission no.' },
        { key: 'father', header: 'Father' },
        { key: 'phone', header: 'Phone', render: r => (r.smsNo || r.fatherMobile)
            ? <a href={`tel:${r.smsNo || r.fatherMobile}`} className="text-brand-700 underline-offset-2 hover:underline">{r.smsNo || r.fatherMobile}</a>
            : '—' },
        { key: 'status', header: 'Status', render: r => <span className={r.status === 'Absent' ? 'badge-danger' : 'badge-warning'}>{statusLabel(r.status)}</span> },
    ];

    const historyColumns: Column<any>[] = [
        { key: 'date', header: 'Date', primary: true, render: r => prettyDate(r.date) },
        { key: 'status', header: 'Status', render: r => <span className={statusBadge(r.status)}>{statusLabel(r.status)}</span> },
    ];

    const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
        <div className="flex justify-between gap-3 border-b border-gray-100 py-1.5">
            <span className="text-gray-600">{label}</span>
            <span className="font-medium text-gray-900 text-right break-words min-w-0">{value}</span>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="segmented w-full sm:w-auto">
                <button
                    type="button"
                    onClick={() => { setReportType('today'); setResults([]); setSelectedStudent(null); setSearchedDay(false); }}
                    className={`segmented-item flex-1 sm:flex-none min-h-[40px] ${reportType === 'today' ? 'segmented-item-active' : ''}`}
                >
                    Absent on a day
                </button>
                <button
                    type="button"
                    onClick={() => { setReportType('student'); setResults([]); }}
                    className={`segmented-item flex-1 sm:flex-none min-h-[40px] ${reportType === 'student' ? 'segmented-item-active' : ''}`}
                >
                    One student
                </button>
            </div>

            {reportType === 'today' ? (
                <div className="card">
                    <div className="card-body space-y-4">
                        <p className="text-sm text-slate-600">See which students were absent or on leave.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                            <Field label="Date" htmlFor="abs-date">
                                <input id="abs-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
                            </Field>
                            <Field label="Class (optional)" htmlFor="abs-class">
                                <select id="abs-class" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="input">
                                    <option value="">All classes</option>
                                    {classOptions.map(c => <option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                                </select>
                            </Field>
                            <Button onClick={() => { setSearchedDay(true); handleGetTodayReport(); }} loading={loading} className="min-h-[44px]">
                                Show absent students
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="card-body space-y-4">
                        <p className="text-sm text-slate-600">Find a student to see every day they were present or absent.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                            <Field label="Class" htmlFor="stu-class">
                                <select
                                    id="stu-class"
                                    value={selectedClass}
                                    onChange={e => setSelectedClass(e.target.value)}
                                    className="input"
                                >
                                    <option value="">Choose a class</option>
                                    {classOptions.map(c => <option key={c.id} value={c.class_name}>{c.class_name}</option>)}
                                </select>
                            </Field>
                            <Field label="Section (optional)" htmlFor="stu-section">
                                <select
                                    id="stu-section"
                                    value={selectedSection}
                                    onChange={e => setSelectedSection(e.target.value)}
                                    className="input"
                                >
                                    <option value="">All sections</option>
                                    {sectionOptions.map(section => <option key={section} value={section}>{section}</option>)}
                                </select>
                            </Field>
                            <Button variant="secondary" onClick={handleGetClassStudents} disabled={loading} className="min-h-[44px]">
                                Show students
                            </Button>
                        </div>

                        <div className="relative flex items-center py-1">
                            <div className="flex-grow border-t border-gray-200"></div>
                            <span className="flex-shrink-0 mx-3 text-slate-500 text-sm">or search</span>
                            <div className="flex-grow border-t border-gray-200"></div>
                        </div>

                        <Field label="Name, admission number or phone" htmlFor="stu-search">
                            <div className="flex gap-2">
                                <input
                                    id="stu-search"
                                    type="search"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="e.g. Ayesha or 1023"
                                    className="input flex-1 min-w-0"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchStudent()}
                                />
                                <Button onClick={handleSearchStudent} disabled={loading} className="min-h-[44px] flex-shrink-0">
                                    Find
                                </Button>
                            </div>
                        </Field>

                        {searchResults.length > 0 && (
                            <div>
                                <p className="text-sm font-medium text-slate-800 mb-2">Tap a student</p>
                                <ul className="border border-slate-200 rounded-xl max-h-72 overflow-y-auto divide-y divide-slate-100 bg-white">
                                    {searchResults.map(s => (
                                        <li key={s.student_id}>
                                            <button
                                                type="button"
                                                onClick={() => handleSelectStudent(s)}
                                                className="w-full text-left px-3 py-2.5 min-h-[44px] hover:bg-brand-50 active:bg-brand-50 text-sm"
                                            >
                                                <span className="font-semibold text-slate-900">{s.first_name} {s.last_name}</span>
                                                <span className="block text-slate-500">Adm. no. {s.admission_no} · Class {s.class}{s.section ? ` · Section ${s.section}` : ''}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {reportType === 'student' && selectedStudent && (
                <div className="card overflow-hidden">
                    <div className="card-header bg-brand-50 border-brand-100">
                        <h3 className="text-base font-semibold text-brand-800">Student</h3>
                        <button type="button" onClick={() => setSelectedStudent(null)} className="btn-ghost btn-sm">
                            Choose another student
                        </button>
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Photo & Basic Info */}
                        <div className="md:col-span-1 flex flex-col items-center text-center">
                            <div className="w-24 h-24 bg-gray-200 rounded-full mb-3 flex items-center justify-center overflow-hidden border-2 border-white shadow-md">
                                {selectedStudent.photo ? (
                                    <img src={selectedStudent.photo} alt={selectedStudent.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-3xl text-gray-400">👤</span>
                                )}
                            </div>
                            <h2 className="text-lg font-semibold text-slate-900 break-words">{selectedStudent.name}</h2>
                            <p className="text-sm text-gray-500">{selectedStudent.admNo}</p>
                            <span className="badge-success mt-2">
                                Active
                            </span>
                        </div>

                        {/* Detailed Info */}
                        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            <div>
                                <h4 className="font-semibold text-slate-700 mb-1">School details</h4>
                                <InfoRow label="Class and section" value={`${selectedStudent.class} - ${selectedStudent.section || 'N/A'}`} />
                                <InfoRow label="Roll number" value={selectedStudent.rollNo || '-'} />
                                <InfoRow label="Joined on" value={selectedStudent.admission_date || '-'} />
                            </div>

                            <div>
                                <h4 className="font-semibold text-slate-700 mb-1">Personal details</h4>
                                <InfoRow label="Father's name" value={selectedStudent.father || '-'} />
                                <InfoRow label="Mobile" value={selectedStudent.smsNo || selectedStudent.fatherMobile || '-'} />
                                <InfoRow label="Date of birth" value={selectedStudent.dob || '-'} />
                            </div>

                            <div className="sm:col-span-2 mt-2">
                                <h4 className="font-semibold text-slate-700 mb-1">Address</h4>
                                <p className="text-gray-700 bg-gray-50 p-2 rounded border border-gray-100 break-words">
                                    {selectedStudent.address || 'No address provided'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Attendance Stats */}
                    {results.length > 0 && (
                        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                            <div className="card p-2">
                                <div className="text-xs text-gray-600 font-semibold">Days marked</div>
                                <div className="text-xl font-bold text-gray-800">{results.length}</div>
                            </div>
                            <div className="card p-2">
                                <div className="text-xs text-emerald-700 font-semibold">Present</div>
                                <div className="text-xl font-bold text-emerald-700">{results.filter(r => r.status === 'Present').length}</div>
                            </div>
                            <div className="card p-2">
                                <div className="text-xs text-red-700 font-semibold">Absent</div>
                                <div className="text-xl font-bold text-red-700">{results.filter(r => r.status === 'Absent').length}</div>
                            </div>
                            <div className="card p-2">
                                <div className="text-xs text-amber-700 font-semibold">Leave</div>
                                <div className="text-xl font-bold text-amber-700">{results.filter(r => r.status === 'Leave').length}</div>
                            </div>
                            <div className="card p-2 col-span-2 sm:col-span-1">
                                <div className="text-xs text-brand-700 font-semibold">Present %</div>
                                <div className="text-xl font-bold text-brand-700">
                                    {results.length > 0
                                        ? Math.round((results.filter(r => r.status === 'Present').length / results.length) * 100)
                                        : 0}%
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Sending SMS to parents of absent students was switched off earlier (see commented code above). */}
            {results.length > 0 ? (
                <div>
                    <p className="text-sm font-semibold text-slate-800 mb-2">
                        {reportType === 'today'
                            ? `${results.length} ${results.length === 1 ? 'student' : 'students'} absent or on leave`
                            : 'Day by day'}
                    </p>
                    <DataList
                        columns={reportType === 'today' ? absentColumns : historyColumns}
                        rows={results}
                        rowKey={(_, idx) => idx}
                    />
                </div>
            ) : (
                !loading && ((reportType === 'today' && searchedDay) || (reportType === 'student' && selectedStudent)) && <div className="card"><EmptyState compact title="No records found" /></div>
            )}
        </div>
    );
};

const VIEWS: { id: AttendanceTab; label: string }[] = [
    { id: 'take', label: 'Daily' },
    { id: 'register', label: 'Monthly' },
    { id: 'absent-report', label: 'Absent list' },
];

const StudentAttendance: React.FC<StudentAttendanceProps> = ({ navigateTo, defaultTab = 'take' }) => {
    const [activeTab, setActiveTab] = useState<AttendanceTab>(() => {
        // A shortcut may open this page on a specific view, e.g. 'register' or 'absent-report'.
        const intent = consumeIntent('student-attendance');
        return intent && ['take', 'today', 'register', 'absent-report'].includes(intent) ? intent as AttendanceTab : defaultTab;
    });

    const renderContent = () => {
        switch (activeTab) {
            case 'take':
                return <DailyAttendance navigateTo={navigateTo} />;
            case 'register':
                return <RegisterView />;
            case 'absent-report':
                return <AbsentReport />;
            case 'today':
                return <EmptyState title="Today's Report Coming Soon" />;
            default:
                return <DailyAttendance navigateTo={navigateTo} />;
        }
    };

    return (
        <div className="min-h-full bg-surface-muted">
            <div className="w-full max-w-[1600px] mx-auto px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h1 className="text-xl font-semibold text-slate-900">Student attendance</h1>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => navigateTo?.('student-administration')}>
                        Student list
                    </button>
                </div>
                <div className="segmented w-full sm:w-auto mb-5" role="tablist" aria-label="Attendance views">
                    {VIEWS.map(v => (
                        <button
                            key={v.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === v.id}
                            onClick={() => setActiveTab(v.id)}
                            className={`segmented-item flex-1 sm:flex-none min-h-[40px] ${activeTab === v.id ? 'segmented-item-active' : ''}`}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
                {renderContent()}
            </div>
        </div>
    );
};

export default StudentAttendance;
