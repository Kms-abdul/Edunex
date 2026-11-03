import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { hr } from '../api';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { useAuth } from '../contexts/AuthContext';
import { LoadingState, EmptyState, ErrorState, DataList, Button } from './ui';
import type { Column } from './ui';
import { ArrowLeft, Download, RotateCw } from 'lucide-react';
import { generateMonthOptions, formatTime, formatDay, AttendanceStatus, AttendanceFilters, branchesOf, statusInfo } from './staff/attendanceUi';

interface AttendanceRecord {
  id: number;
  employee_id: string;
  staff_name: string;
  branch_name: string;
  department: string;
  designation?: string;
  attendance_date: string;
  first_in: string | null;
  last_out: string | null;
  working_minutes: number;
  late_minutes: number;
  attendance_status: string;
  source: string;
}

interface StaffMonthlyData {
  employee_id: string;
  staff_name: string;
  branch_name: string;
  department: string;
  designation: string;
  total_days: number;
  weekoffs: number;
  holidays: number;
  present: number;
  absent: number;
  daily_records: Record<string, AttendanceRecord>;
}

const HRAttendanceSummary: React.FC = () => {
  {/*const { user } = useAuth();
  const isManager = ['SuperAdmin', 'Admin', 'HR', 'Principal', 'Management'].includes(user?.role || '');*/}
  const { user, hasPermission } = useAuth();
  const isManager = hasPermission('hr.attendance.summary', 'write');


  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const monthOptions = React.useMemo(() => generateMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);

  // Filters state
  const [filters, setFilters] = useState({
    date_from: monthOptions[0].firstDay,
    date_to: monthOptions[0].lastDay,
    employee: isManager ? '' : (user?.username || ''),
    status: 'ALL'
  });

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedMonth(val);
    const selectedOpt = monthOptions.find(o => o.value === val);
    if (selectedOpt) {
      setFilters(prev => ({
        ...prev,
        date_from: selectedOpt.firstDay,
        date_to: selectedOpt.lastDay
      }));
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams: any = {};
      if (filters.date_from) queryParams.date_from = filters.date_from;
      if (filters.date_to) queryParams.date_to = filters.date_to;
      if (filters.employee) queryParams.employee = filters.employee;
      if (filters.status && filters.status !== 'ALL') queryParams.status = filters.status;

      const response = await hr.getStaffAttendanceSummary(queryParams);
      if (response.data) {
        setRecords(response.data as AttendanceRecord[]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch attendance data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Derive dates array
  const datesInMonth = useMemo(() => {
    const dates: string[] = [];
    const [sy, sm, sd] = filters.date_from.split('-').map(Number);
    const [ey, em, ed] = filters.date_to.split('-').map(Number);
    for (let d = new Date(sy, sm - 1, sd); d <= new Date(ey, em - 1, ed); d.setDate(d.getDate() + 1)) {
      dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return dates;
  }, [filters.date_from, filters.date_to]);

  const monthDisplayFormat = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()}-${d.toLocaleDateString('en-US', { month: 'short' })}-${String(d.getFullYear()).slice(-2)}`;
  };
  //Excel Report of Employee Punches

  const exportToExcel = () => {
    const excelData: any[] = [];

    groupedData.forEach((staff, index) => {
      const row: any = {
        Sno: index + 1,
        EmployeeID: staff.employee_id,
        EmployeeName: staff.staff_name,
        Designation: staff.designation,
      };

      datesInMonth.forEach((date) => {
        const record = staff.daily_records[date];

        if (!record) {
          row[`${monthDisplayFormat(date)} In`] = '-';
          row[`${monthDisplayFormat(date)} Out`] = '-';
          return;
        }

        const status = (record.attendance_status || '').toUpperCase();

        if (status.includes('ABSENT') || status.includes('LEAVE')) {
          row[`${monthDisplayFormat(date)} In`] = 'Absent';
          row[`${monthDisplayFormat(date)} Out`] = 'Absent';
        } else if (status === 'HALF_DAY') {
          row[`${monthDisplayFormat(date)} In`] = formatTime12h(record.first_in);
          row[`${monthDisplayFormat(date)} Out`] = '0.5 Day';
        } else {
          row[`${monthDisplayFormat(date)} In`] = formatTime12h(record.first_in);
          row[`${monthDisplayFormat(date)} Out`] = formatTime12h(record.last_out);
        }
      });

      excelData.push(row);
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Attendance Summary'
    );

    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    const file = new Blob(
      [excelBuffer],
      {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }
    );

    saveAs(
      file,
      `AttendanceSummary_${selectedMonth}.xlsx`
    );
  };
  // Group records by employee
  const groupedData = useMemo(() => {
    const map = new Map<string, StaffMonthlyData>();

    records.forEach(r => {
      if (!map.has(r.employee_id)) {
        map.set(r.employee_id, {
          employee_id: r.employee_id,
          staff_name: r.staff_name || '-',
          branch_name: r.branch_name || '-',
          department: r.department || '-',
          designation: r.designation || '-',
          total_days: datesInMonth.length,
          weekoffs: 0,
          holidays: 0,
          present: 0,
          absent: 0,
          daily_records: {}
        });
      }

      const staff = map.get(r.employee_id)!;
      staff.daily_records[r.attendance_date] = r;

      // Tally stats based on attendance_status
      const status = (r.attendance_status || '').toUpperCase();
      if (status === 'PRESENT' || status === 'HALF_DAY') staff.present++;
      else if (status === 'ABSENT' || status === 'LEAVE' || status.includes('LEAVE')) staff.absent++;
      else if (status === 'WEEKOFF' || status === 'WEEK_OFF') staff.weekoffs++;
      else if (status === 'HOLIDAY') staff.holidays++;
    });

    return Array.from(map.values());
  }, [records, datesInMonth.length]);

  const formatTime12h = (timeStr: string | null) => {
    if (!timeStr) return '-';
    const [h, m] = timeStr.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m}${ampm}`;
  };

  // Absent / leave cells are tinted, but always also carry a word (never colour alone).
  const getCellColorClass = (status: string) => {
    status = (status || '').toUpperCase();
    if (status === 'ABSENT' || status.includes('LEAVE')) return 'bg-amber-100 text-amber-900'; // marks absent or leave
    return '';
  };

  /* ---------------- presentation-only state (no effect on data or export) ---------------- */
  const [branch, setBranch] = useState('');
  const [view, setView] = useState<'cards' | 'grid'>(() => {
    try { return window.matchMedia('(min-width: 768px)').matches ? 'grid' : 'cards'; } catch { return 'cards'; }
  });
  const [openStaffId, setOpenStaffId] = useState<string | null>(null);

  const branches = useMemo(() => branchesOf(records), [records]);
  const visibleStaff = useMemo(
    () => (branch ? groupedData.filter(s => s.branch_name === branch) : groupedData),
    [groupedData, branch]
  );
  const openStaff = openStaffId ? visibleStaff.find(s => s.employee_id === openStaffId) || null : null;

  // Counts shown on the phone cards (display only; the Excel file is unchanged).
  const countsFor = (staff: StaffMonthlyData) => {
    const c = { present: 0, half: 0, absent: 0, leave: 0, late: 0, off: 0 };
    Object.values(staff.daily_records).forEach(r => {
      const st = (r.attendance_status || '').toUpperCase();
      if (st === 'PRESENT') c.present++;
      else if (st === 'HALF_DAY') c.half++;
      else if (st === 'ABSENT') c.absent++;
      else if (st.includes('LEAVE')) c.leave++;
      else if (st === 'HOLIDAY' || st === 'WEEK_OFF' || st === 'WEEKOFF') c.off++;
      if ((st === 'PRESENT' || st === 'HALF_DAY') && r.late_minutes > 0) c.late++;
    });
    return c;
  };

  const staffColumns: Column<StaffMonthlyData & { _c: ReturnType<typeof countsFor> }>[] = [
    { key: 'staff_name', header: 'Staff', primary: true },
    { key: 'designation', header: 'Designation', secondary: true, render: s => `${s.designation} · ${s.employee_id}` },
    { key: 'present', header: 'Present', align: 'center', render: s => <span className="badge-success">{s._c.present} Present</span> },
    { key: 'absent', header: 'Absent', align: 'center', render: s => <span className={s._c.absent ? 'badge-danger' : 'badge-neutral'}>{s._c.absent} Absent</span> },
    { key: 'leave', header: 'Leave', align: 'center', render: s => <span className={s._c.leave ? 'badge-warning' : 'badge-neutral'}>{s._c.leave} Leave</span> },
    { key: 'half', header: 'Half day', align: 'center', render: s => <span className="badge-neutral">{s._c.half} Half day</span> },
    { key: 'late', header: 'Late', align: 'center', render: s => <span className={s._c.late ? 'badge-warning' : 'badge-neutral'}>{s._c.late} Late</span> },
    { key: 'off', header: 'Holiday / Week off', align: 'center', hideOnMobile: true, render: s => <span className="badge-neutral">{s._c.off} Off</span> },
  ];

  const syncAndRefresh = async () => {
    try {
      setIsSyncing(true);
      await hr.processAttendanceSync();
      await fetchAttendance();
    } catch (err: any) {
      setError(err.message || 'Failed to process sync');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Attendance</h2>
          <p className="text-sm text-slate-500">Who was present, absent or on leave this month.</p>
        </div>
        <div className="grid grid-cols-1 sm:flex gap-2">
          <Button
            variant="success"
            onClick={exportToExcel}
            disabled={loading || groupedData.length === 0}
            icon={<Download className="w-4 h-4" />}
            className="min-h-[44px]"
          >
            Download Excel
          </Button>
          <Button
            onClick={syncAndRefresh}
            disabled={isSyncing || loading}
            loading={isSyncing}
            icon={<RotateCw className="w-4 h-4" />}
            className="min-h-[44px]"
          >
            {isSyncing ? 'Getting latest times…' : 'Get latest times'}
          </Button>
        </div>
      </div>

      <AttendanceFilters
        monthOptions={monthOptions}
        selectedMonth={selectedMonth}
        onMonthChange={handleMonthChange}
        branches={branches}
        branch={branch}
        onBranchChange={v => { setBranch(v); setOpenStaffId(null); }}
        employee={filters.employee}
        onFilterChange={handleFilterChange}
        employeeDisabled={!isManager}
        status={filters.status}
      />

      {branch && groupedData.length > 0 && (
        <p className="text-sm text-slate-500 mb-3">Showing {branch} only. The Excel file still has all branches.</p>
      )}

      {loading ? (
        <div className="card"><LoadingState label="Loading attendance…" /></div>
      ) : error ? (
        <div className="card"><ErrorState title="Couldn't load attendance" message={error} onRetry={fetchAttendance} /></div>
      ) : visibleStaff.length === 0 ? (
        <div className="card"><EmptyState title="No attendance found" description="Nothing was found for this month. Try another month or clear the search." /></div>
      ) : openStaff ? (
        /* ---------- One person, day by day ---------- */
        <div className="card">
          <div className="card-header flex flex-col sm:flex-row sm:items-center gap-3">
            <button type="button" className="btn-secondary min-h-[44px] self-start" onClick={() => setOpenStaffId(null)}>
              <ArrowLeft className="w-4 h-4" /> All staff
            </button>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 break-words">{openStaff.staff_name}</p>
              <p className="text-sm text-slate-500">{openStaff.designation} · {openStaff.employee_id}</p>
            </div>
          </div>
          <ul className="divide-y divide-slate-100">
            {datesInMonth.map(date => {
              const r = openStaff.daily_records[date];
              const st = (r?.attendance_status || '').toUpperCase();
              const showTimes = r && !(st === 'ABSENT' || st.includes('LEAVE') || st === 'HOLIDAY' || st === 'WEEK_OFF');
              return (
                <li key={date} className="px-4 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{formatDay(date)}</p>
                    {showTimes && (
                      <p className="text-sm text-slate-600">In {formatTime(r.first_in)} · Out {formatTime(r.last_out)}</p>
                    )}
                  </div>
                  <AttendanceStatus status={r ? r.attendance_status : null} lateMinutes={r?.late_minutes} />
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">{visibleStaff.length} staff</p>
            <div className="segmented" role="tablist" aria-label="How to show attendance">
              <button type="button" role="tab" aria-selected={view === 'cards'} onClick={() => setView('cards')}
                className={`segmented-item min-h-[40px] ${view === 'cards' ? 'segmented-item-active' : ''}`}>By person</button>
              <button type="button" role="tab" aria-selected={view === 'grid'} onClick={() => setView('grid')}
                className={`segmented-item min-h-[40px] ${view === 'grid' ? 'segmented-item-active' : ''}`}>Full month table</button>
            </div>
          </div>

          {view === 'cards' ? (
            <>
              <p className="text-sm text-slate-500 mb-2">Tap a name to see each day.</p>
              <DataList
                columns={staffColumns}
                rows={visibleStaff.map(s => ({ ...s, _c: countsFor(s) }))}
                rowKey={s => s.employee_id}
                onRowClick={s => setOpenStaffId(s.employee_id)}
              />
            </>
          ) : (
            /* ---------- Full month grid (truly a grid: scrolls sideways inside its card) ---------- */
            <div className="card overflow-hidden">
              <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
                <table className="w-full text-xs text-center whitespace-nowrap table-fixed border-collapse" style={{ minWidth: 'max-content' }}>
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-300 sticky top-0 z-10">
                    <tr>
                      <th rowSpan={2} className="px-2 py-2 border border-slate-300 w-10 bg-slate-50 md:sticky md:left-0 md:z-20 border-r-2">No.</th>
                      <th rowSpan={2} className="px-3 py-2 border border-slate-300 w-32 bg-slate-50 md:sticky md:left-[40px] md:z-20 border-r-2">Employee number</th>
                      <th rowSpan={2} className="px-3 py-2 border border-slate-300 w-48 bg-slate-50 text-left sticky left-0 md:left-[168px] z-20 border-r-2">Staff name</th>
                      <th rowSpan={2} className="px-3 py-2 border border-slate-300 w-40 bg-slate-50 text-left md:sticky md:left-[360px] md:z-20 border-r-4 md:shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)]">Designation</th>
                      {datesInMonth.map(date => (
                        <th key={date} colSpan={2} className="px-2 py-1 border border-slate-300 bg-slate-50 font-extrabold text-[11px] w-[240px] min-w-[240px]">
                          {monthDisplayFormat(date)}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {datesInMonth.map(date => (
                        <React.Fragment key={`${date}-sub`}>
                          <th className="px-2 py-2 border border-slate-300 bg-white w-[120px] min-w-[120px]">In</th>
                          <th className="px-2 py-2 border border-slate-300 bg-white w-[120px] min-w-[120px]">Out</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {visibleStaff.map((staff, index) => (
                      <tr key={staff.employee_id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-2 py-2 border border-slate-300 bg-white md:sticky md:left-0 md:z-10 border-r-2">{index + 1}</td>
                        <td className="px-3 py-2 border border-slate-300 bg-white md:sticky md:left-[40px] md:z-10 border-r-2">{staff.employee_id}</td>
                        <td className="px-3 py-2 border border-slate-300 bg-white sticky left-0 md:left-[168px] z-10 text-left font-semibold truncate max-w-[192px] border-r-2" title={staff.staff_name}>{staff.staff_name}</td>
                        <td className="px-3 py-2 border border-slate-300 bg-white md:sticky md:left-[360px] md:z-10 text-left truncate max-w-[160px] border-r-4 md:shadow-[4px_0_10px_-5px_rgba(0,0,0,0.1)]" title={staff.designation}>{staff.designation}</td>

                        {datesInMonth.map(date => {
                          const record = staff.daily_records[date];
                          if (!record) {
                            return (
                              <React.Fragment key={`${date}-empty`}>
                                <td className="px-2 py-2 border border-slate-300 text-slate-400">-</td>
                                <td className="px-2 py-2 border border-slate-300 text-slate-400">-</td>
                              </React.Fragment>
                            );
                          }

                          const status = (record.attendance_status || '').toUpperCase();
                          const colorClass = getCellColorClass(status);

                          // Absent / leave: one block spanning In and Out, in words
                          if (['ABSENT', 'LEAVE'].some(s => status.includes(s))) {
                            return (
                              <td key={`${date}-absent`} colSpan={2} className={`px-2 py-2 border border-slate-300 font-bold ${colorClass}`}>
                                {statusInfo(status).label}
                              </td>
                            );
                          }

                          if (status === 'HALF_DAY') {
                            return (
                              <React.Fragment key={`${date}-half`}>
                                <td className="px-2 py-2 border border-slate-300">{formatTime12h(record.first_in)}</td>
                                <td className={`px-2 py-2 border border-slate-300 font-bold ${getCellColorClass('ABSENT')}`}>Half day</td>
                              </React.Fragment>
                            );
                          }

                          if (status === 'HOLIDAY' || status === 'WEEK_OFF') {
                            return (
                              <td key={`${date}-off`} colSpan={2} className="px-2 py-2 border border-slate-300 text-slate-500">
                                {statusInfo(status).label}
                              </td>
                            );
                          }

                          // Regular punch data
                          return (
                            <React.Fragment key={`${date}-punch`}>
                              <td className={`px-2 py-2 border border-slate-300 ${colorClass}`}>
                                {formatTime12h(record.first_in)}{record.late_minutes > 0 && <span className="ml-1 text-amber-700 font-semibold">(Late)</span>}
                              </td>
                              <td className={`px-2 py-2 border border-slate-300 ${colorClass}`}>
                                {formatTime12h(record.last_out)}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HRAttendanceSummary;
