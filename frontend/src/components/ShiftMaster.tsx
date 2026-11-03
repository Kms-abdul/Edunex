import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { Alert, Badge, DataList, Field } from './ui';
import type { Column } from './ui';
import { NeedSchool, MasterTop, FormCard, EditButton, scrollToForm, plain } from './hr-setup/MasterParts';

interface Shift {
    id: number;
    shift_code: string;
    shift_name: string;
    start_time: string;
    end_time: string;
    grace_in_minutes: number;
    grace_out_minutes: number;
    status: string;
}

export const ShiftMaster: React.FC = () => {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);

    const [form, setForm] = useState({
        shift_code: '',
        shift_name: '',
        start_time: '',
        end_time: '',
        grace_in_minutes: 0,
        grace_out_minutes: 0,
        status: 'ACTIVE'
    });

    const fetchShifts = useCallback(async () => {
        const schoolId = localStorage.getItem('currentSchoolId');
        if (!schoolId || schoolId === 'all') return;
        setLoading(true);
        try {
            const res = await api.get('/hr/shifts');
            setShifts(res.data || []);
        } catch (e: any) {
            console.error('Failed to load shifts', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchShifts();
    }, [fetchShifts]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/hr/shifts/${editingId}`, form);
                setMsg({ type: 'success', text: 'Shift saved' });
            } else {
                await api.post('/hr/shifts', form);
                setMsg({ type: 'success', text: 'Shift added' });
            }
            setForm({ shift_code: '', shift_name: '', start_time: '', end_time: '', grace_in_minutes: 0, grace_out_minutes: 0, status: 'ACTIVE' });
            setEditingId(null);
            setShowForm(false);
            fetchShifts();
        } catch (e: any) {
            setMsg({ type: 'error', text: e.response?.data?.error || `Failed to ${editingId ? 'update' : 'create'} shift` });
        }
    };

    const handleEdit = (s: Shift) => {
        setEditingId(s.id);
        setForm({
            shift_code: s.shift_code,
            shift_name: s.shift_name,
            start_time: s.start_time,
            end_time: s.end_time,
            grace_in_minutes: s.grace_in_minutes || 0,
            grace_out_minutes: s.grace_out_minutes || 0,
            status: s.status || 'ACTIVE'
        });
        setMsg(null);
        setShowForm(true);
        scrollToForm('shift-form');
    };

    const blankForm = { shift_code: '', shift_name: '', start_time: '', end_time: '', grace_in_minutes: 0, grace_out_minutes: 0, status: 'ACTIVE' };
    const openAdd = () => {
        setEditingId(null);
        setForm(blankForm);
        setMsg(null);
        setShowForm(true);
        scrollToForm('shift-form');
    };
    const closeForm = () => { setEditingId(null); setForm(blankForm); setShowForm(false); };

    const currentSchoolId = localStorage.getItem('currentSchoolId');
    if (!currentSchoolId || currentSchoolId === 'all') {
        return <NeedSchool what="work timings" />;
    }

    const columns: Column<Shift>[] = [
        { key: 'shift_name', header: 'Shift', primary: true, render: s => <span className="font-medium text-slate-900">{s.shift_name}</span> },
        { key: 'timings', header: 'Timings', secondary: true, render: s => `${s.start_time} to ${s.end_time}` },
        { key: 'shift_code', header: 'Code' },
        { key: 'grace', header: 'Late / early allowed', render: s => `${s.grace_in_minutes || 0} min / ${s.grace_out_minutes || 0} min` },
        { key: 'status', header: 'Status', render: s => <Badge tone={s.status === 'ACTIVE' ? 'success' : 'danger'}>{plain(s.status)}</Badge> },
        { key: 'actions', header: '', align: 'right', hideOnMobile: true, render: s => <EditButton onClick={() => handleEdit(s)} /> },
    ];

    return (
        <div className="space-y-4">
            <MasterTop
                intro="Shifts are the work timings for staff. They are used to mark staff late or early."
                addLabel={showForm && !editingId ? undefined : 'Add shift'}
                onAdd={openAdd}
                count={shifts.length}
                countLabel={shifts.length === 1 ? 'shift' : 'shifts'}
            />

            {msg && (
                <Alert tone={msg.type} onClose={() => setMsg(null)}>
                    {msg.text}
                </Alert>
            )}

            {showForm && (
                <FormCard
                    id="shift-form"
                    title={editingId ? 'Change shift' : 'New shift'}
                    onSubmit={handleSubmit}
                    onCancel={closeForm}
                    saveLabel="Save shift"
                >
                    <Field label="Shift name" required>
                        <input type="text" required value={form.shift_name} onChange={e => setForm({...form, shift_name: e.target.value})} className="input" placeholder="e.g. Morning" />
                    </Field>
                    <Field label="Code" required hint={editingId ? 'The code cannot be changed.' : 'A short code, for example MOR.'}>
                        <input type="text" required value={form.shift_code} onChange={e => setForm({...form, shift_code: e.target.value})} disabled={!!editingId} className="input" />
                    </Field>
                    <Field label="Start time" required>
                        <input type="time" required value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} className="input" />
                    </Field>
                    <Field label="End time" required>
                        <input type="time" required value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} className="input" />
                    </Field>
                    <Field label="Late allowed (minutes)" hint="Coming in this many minutes late is still on time.">
                        <input type="number" inputMode="numeric" value={form.grace_in_minutes} onChange={e => setForm({...form, grace_in_minutes: Number(e.target.value)})} className="input" />
                    </Field>
                    <Field label="Early leave allowed (minutes)" hint="Leaving this many minutes early is still fine.">
                        <input type="number" inputMode="numeric" value={form.grace_out_minutes} onChange={e => setForm({...form, grace_out_minutes: Number(e.target.value)})} className="input" />
                    </Field>
                </FormCard>
            )}

            <DataList
                columns={columns}
                rows={shifts}
                rowKey={s => s.id}
                loading={loading}
                emptyTitle="No shifts yet"
                emptyHint={'Tap \u201cAdd shift\u201d to make the first one.'}
                mobileActions={s => <EditButton onClick={() => handleEdit(s)} />}
            />
        </div>
    );
};

export default ShiftMaster;
