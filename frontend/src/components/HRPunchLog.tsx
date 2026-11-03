import React, { useState, useEffect, useCallback } from 'react';
import { hr } from '../api';
import { LoadingState, EmptyState, ErrorState } from './ui';

const generateMonthOptions = () => {
  const options = [];
  const currentDate = new Date();

  for (let i = 0; i < 12; i++) {
    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const monthNameFull = d.toLocaleDateString('en-US', { month: 'long' });
    const monthNameShort = d.toLocaleDateString('en-US', { month: 'short' });

    const value = `${year}-${String(month + 1).padStart(2, '0')}`;
    const firstDayStr = `01 ${monthNameShort} ${year}`;
    const lastDayStr = `${String(lastDay.getDate()).padStart(2, '0')} ${monthNameShort} ${year}`;

    const label = `${monthNameFull}-${year}(${firstDayStr} To ${lastDayStr})`;

    const localFirstDayStr = new Date(firstDay.getTime() - (firstDay.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const localLastDayStr = new Date(lastDay.getTime() - (lastDay.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    options.push({ value, label, firstDay: localFirstDayStr, lastDay: localLastDayStr });
  }

  return options;
};

interface AttendanceRecord {
  id: number;
  employee_id: string;
  staff_name: string;
  branch_name: string;
  department: string;
  attendance_date: string;
  first_in: string | null;
  last_out: string | null;
  working_minutes: number;
  late_minutes: number;
  attendance_status: string;
  source: string;
  designation?: string;
}

const HRPunchLog: React.FC = () => {
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
    employee: '',
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

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // Helper functions for deriving table states
  const getDayOfWeek = (dateString: string) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date(dateString).getDay()];
  };

  const isWeekoff = (status: string) => status === 'WEEK_OFF' ? 'Yes' : 'No';
  const isHoliday = (status: string) => status === 'HOLIDAY' ? 'Yes' : 'No';

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Punch Log</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              try {
                setIsSyncing(true);
                await hr.processAttendanceSync();
                await fetchAttendance();
              } catch (err: any) {
                setError(err.message || 'Failed to process sync');
              } finally {
                setIsSyncing(false);
              }
            }}
            disabled={isSyncing || loading}
            className="btn-primary"
          >
            {isSyncing ? 'Processing...' : 'Process & Refresh'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="label">-Select- Month</label>
          <select value={selectedMonth} onChange={handleMonthChange} className="input">
            <option value="">-Select-</option>
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Employee Search</label>
          <input type="text" name="employee" placeholder="Name or ID..." value={filters.employee} onChange={handleFilterChange} className="input" />
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" value={filters.status} onChange={handleFilterChange} className="input">
            <option value="ALL">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="HALF_DAY">Half Day</option>
          </select>
        </div>
      </div>

      {/* Main Grid Table */}
      <div className="flex-1 card overflow-hidden flex flex-col">
        {loading ? (
          <LoadingState label="Loading attendance data…" />
        ) : error ? (
          <ErrorState title="Couldn't load attendance" message={error} onRetry={fetchAttendance} />
        ) : records.length === 0 ? (
          <EmptyState title="No attendance records" description="No attendance records found for the selected period." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap table-fixed border-collapse" style={{ minWidth: '1800px' }}>
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-300">
                <tr>
                  <th className="px-1 py-1 border border-slate-300 w-12 text-center">
                    <div className="rotate-0" style={{ writingMode: 'horizontal-tb' }}>S.No</div>
                  </th>
                  <th className="px-3 py-1 border border-slate-300 w-28 align-bottom">Employee ID</th>
                  <th className="px-3 py-1 border border-slate-300 w-40 align-bottom">Staff Name</th>
                  <th className="px-3 py-1 border border-slate-300 w-32 align-bottom">Department</th>
                  <th className="px-3 py-1 border border-slate-300 w-32 align-bottom">Designation</th>
                  <th className="px-3 py-1 border border-slate-300 w-28 align-bottom">Date</th>
                  <th className="px-3 py-1 border border-slate-300 w-24 align-bottom">Day</th>

                  <th className="px-1 py-1 border border-slate-300 w-24 text-center">
                    <div className="rotate-0" style={{ writingMode: 'horizontal-tb' }}>Punching Timings</div>
                  </th>
                  <th className="px-1 py-1 border border-slate-300 w-20 text-center">
                    <div className="rotate-0" style={{ writingMode: 'horizontal-tb' }}>In Time</div>
                  </th>
                  <th className="px-1 py-1 border border-slate-300 w-20 text-center">
                    <div className="rotate-0" style={{ writingMode: 'horizontal-tb' }}>Out Time</div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {records.map((r, idx) => {
                  const dayOfWeek = getDayOfWeek(r.attendance_date);

                  const formatTime12h = (t: string | null) => {
                    if (!t) return '';
                    const [h, m] = t.split(':');
                    const hour = parseInt(h);
                    const ampm = hour >= 12 ? 'PM' : 'AM';
                    const hour12 = hour % 12 || 12;
                    return `${hour12}:${m}${ampm}`;
                  };

                  const punches = [formatTime12h(r.first_in), formatTime12h(r.last_out)].filter(Boolean).join(' ,');

                  const dateObj = new Date(r.attendance_date);
                  const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

                  const isRowWoff = isWeekoff(r.attendance_status) === 'Yes';
                  const isRowHoliday = isHoliday(r.attendance_status) === 'Yes';
                  const rowClass = isRowWoff || isRowHoliday ? 'bg-orange-50' : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50');

                  return (
                    <tr key={r.id} className={`hover:bg-brand-50 transition-colors ${rowClass}`}>
                      <td className="px-2 py-1 border border-slate-200 text-center">{idx + 1}</td>
                      <td className="px-3 py-1 border border-slate-200 text-sm">{r.employee_id || '-'}</td>
                      <td className="px-3 py-1 border border-slate-200 text-sm font-semibold truncate max-w-[150px]" title={r.staff_name || ''}>{r.staff_name || '-'}</td>
                      <td className="px-3 py-1 border border-slate-200 text-sm truncate max-w-[120px]" title={r.department || ''}>{r.department || '-'}</td>
                      <td className="px-3 py-1 border border-slate-200 text-sm truncate max-w-[120px]" title={r.designation || ''}>{r.designation || '-'}</td>
                      <td className="px-3 py-1 border border-slate-200 text-brand-600 text-sm font-medium">{formattedDate}</td>
                      <td className="px-3 py-1 border border-slate-200 text-slate-700 text-sm">{dayOfWeek}</td>


                      <td className="px-2 py-1 border border-slate-200 text-center text-slate-700 text-[11px]">{punches}</td>
                      <td className="px-2 py-1 border border-slate-200 text-center text-slate-700 text-[11px]">{formatTime12h(r.first_in)}</td>
                      <td className="px-2 py-1 border border-slate-200 text-center text-slate-700 text-[11px]">{formatTime12h(r.last_out)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HRPunchLog;
