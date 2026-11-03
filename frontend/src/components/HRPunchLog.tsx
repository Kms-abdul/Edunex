import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { hr } from '../api';
import { ErrorState, DataList, Button } from './ui';
import type { Column } from './ui';
import { RotateCw } from 'lucide-react';
import { generateMonthOptions, formatTime, formatDay, AttendanceStatus, AttendanceFilters, branchesOf } from './staff/attendanceUi';

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
  // Branch is filtered on the loaded rows only (the server call is unchanged).
  const [branch, setBranch] = useState('');

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

  const processAndRefresh = async () => {
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

  const branches = useMemo(() => branchesOf(records), [records]);
  type Row = AttendanceRecord & { _n: number };
  const visible: Row[] = useMemo(
    () => (branch ? records.filter(r => r.branch_name === branch) : records).map((r, i) => ({ ...r, _n: i + 1 })),
    [records, branch]
  );

  const columns: Column<Row>[] = [
    { key: 'sno', header: 'No.', hideOnMobile: true, render: r => r._n },
    { key: 'staff_name', header: 'Staff', primary: true, render: r => r.staff_name || '-' },
    { key: 'date', header: 'Date', secondary: true, render: r => formatDay(r.attendance_date) },
    { key: 'employee_id', header: 'Employee number', hideOnMobile: true, render: r => r.employee_id || '-' },
    { key: 'department', header: 'Department', hideOnMobile: true, render: r => r.department || '-' },
    { key: 'designation', header: 'Designation', hideOnMobile: true, render: r => r.designation || '-' },
    { key: 'in', header: 'In', render: r => formatTime(r.first_in) },
    { key: 'out', header: 'Out', render: r => formatTime(r.last_out) },
    { key: 'status', header: 'Status', render: r => <AttendanceStatus status={r.attendance_status} lateMinutes={r.late_minutes} /> },
  ];

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">In / out times</h2>
          <p className="text-sm text-slate-500">When each staff member came in and went out, day by day.</p>
        </div>
        <Button
          onClick={processAndRefresh}
          disabled={isSyncing || loading}
          loading={isSyncing}
          icon={<RotateCw className="w-4 h-4" />}
          className="min-h-[44px]"
        >
          {isSyncing ? 'Getting latest times…' : 'Get latest times'}
        </Button>
      </div>

      <AttendanceFilters
        monthOptions={monthOptions}
        selectedMonth={selectedMonth}
        onMonthChange={handleMonthChange}
        branches={branches}
        branch={branch}
        onBranchChange={setBranch}
        employee={filters.employee}
        onFilterChange={handleFilterChange}
        status={filters.status}
      />

      {error && !loading ? (
        <div className="card">
          <ErrorState title="Couldn't load in / out times" message={error} onRetry={fetchAttendance} />
        </div>
      ) : (
        <>
          {!loading && visible.length > 0 && (
            <p className="text-sm text-slate-500 mb-2">{visible.length} {visible.length === 1 ? 'entry' : 'entries'}</p>
          )}
          <DataList
            columns={columns}
            rows={visible}
            rowKey={r => r.id}
            loading={loading}
            emptyTitle="No in / out times"
            emptyHint="Nothing was found for this month. Try another month or clear the search."
          />
        </>
      )}
    </div>
  );
};

export default HRPunchLog;
