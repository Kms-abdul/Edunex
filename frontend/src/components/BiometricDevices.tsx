import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { Alert, Badge, DataList, Field } from './ui';
import type { Column } from './ui';
import { NeedSchool, MasterTop, FormCard, EditButton, scrollToForm, plain } from './hr-setup/MasterParts';

const blankForm = {
    device_code: '', device_name: '', device_model: '', manufacturer: '', serial_number: '',
    ip_address: '', port: 5005, communication_type: 'TCP', communication_password: '',
    sync_mode: 'AUTO', sync_interval_minutes: 5, timezone: 'Asia/Kolkata', status: 'ACTIVE'
};

interface BiometricDevice {
    id: number;
    device_code: string;
    device_name: string;
    device_model: string;
    manufacturer: string;
    serial_number: string;
    ip_address: string;
    port: number;
    communication_type: string;
    communication_password?: string;
    sync_mode: string;
    sync_interval_minutes: number;
    timezone: string;
    status: string;
    last_seen: string | null;
    last_punch: string | null;
    firmware_version: string | null;
    sync_status: string | null;
    last_successful_sync: string | null;
    pending_punches: number | null;
}

export const BiometricDevices: React.FC = () => {
    const [devices, setDevices] = useState<BiometricDevice[]>([]);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const currentSchoolId = localStorage.getItem('currentSchoolId');
    const branchId = localStorage.getItem('currentBranchId');

    const [form, setForm] = useState({
        device_code: '',
        device_name: '',
        device_model: '',
        manufacturer: '',
        serial_number: '',
        ip_address: '',
        port: 5005,
        communication_type: 'TCP',
        communication_password: '',
        sync_mode: 'AUTO',
        sync_interval_minutes: 5,
        timezone: 'Asia/Kolkata',
        status: 'ACTIVE'
    });

    const fetchDevices = useCallback(async () => {
        if (!currentSchoolId || currentSchoolId === 'all') return;
        setLoading(true);
        try {
            const res = await api.get(`/biometric/devices?branch_id=${branchId || 'all'}`);
            setDevices(res.data || []);
        } catch (e: any) {
            console.error('Failed to load devices', e);
        } finally {
            setLoading(false);
        }
    }, [currentSchoolId, branchId]);

    useEffect(() => {
        fetchDevices();
    }, [fetchDevices]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await api.put(`/biometric/devices/${editingId}`, form);
                setMsg({ type: 'success', text: 'Machine saved' });
            } else {
                await api.post('/biometric/devices', { ...form, branch_id: branchId });
                setMsg({ type: 'success', text: 'Machine added' });
            }
            setForm({
                device_code: '', device_name: '', device_model: '', manufacturer: '', serial_number: '',
                ip_address: '', port: 5005, communication_type: 'TCP', communication_password: '',
                sync_mode: 'AUTO', sync_interval_minutes: 5, timezone: 'Asia/Kolkata', status: 'ACTIVE'
            });
            setEditingId(null);
            setShowForm(false);
            fetchDevices();
        } catch (e: any) {
            setMsg({ type: 'error', text: e.response?.data?.error || `Failed to ${editingId ? 'update' : 'create'} device` });
        }
    };

    const handleEdit = (d: BiometricDevice) => {
        setEditingId(d.id);
        setForm({
            device_code: d.device_code,
            device_name: d.device_name,
            device_model: d.device_model || '',
            manufacturer: d.manufacturer || '',
            serial_number: d.serial_number || '',
            ip_address: d.ip_address || '',
            port: d.port || 5005,
            communication_type: d.communication_type || 'TCP',
            communication_password: d.communication_password || '',
            sync_mode: d.sync_mode || 'AUTO',
            sync_interval_minutes: d.sync_interval_minutes || 5,
            timezone: d.timezone || 'Asia/Kolkata',
            status: d.status || 'ACTIVE'
        });
        setMsg(null);
        setShowForm(true);
        scrollToForm('device-form');
    };

    const openAdd = () => {
        setEditingId(null);
        setForm(blankForm);
        setMsg(null);
        setShowForm(true);
        scrollToForm('device-form');
    };
    const closeForm = () => { setEditingId(null); setForm(blankForm); setShowForm(false); };

    if (!currentSchoolId || currentSchoolId === 'all') {
        return <NeedSchool what="attendance machines" />;
    }

    const columns: Column<BiometricDevice>[] = [
        { key: 'device_name', header: 'Machine', primary: true, render: d => <span className="font-medium text-slate-900">{d.device_name}</span> },
        { key: 'device_code', header: 'Code', secondary: true, render: d => <>{d.device_code}{d.serial_number ? ` · Serial no. ${d.serial_number}` : ''}</> },
        { key: 'network', header: 'Network', render: d => <><div>{d.ip_address}:{d.port}</div><div className="text-xs text-slate-500">{d.communication_type}</div></> },
        { key: 'sync', header: 'Sync', render: d => <><div>{plain(d.sync_mode)} (every {d.sync_interval_minutes} min)</div><div className="text-xs text-slate-500">Last: {d.last_successful_sync || 'Never'}</div></> },
        { key: 'health', header: 'Last seen', render: d => <><div className="text-xs">{d.last_seen || '-'}</div><div className="text-xs text-slate-500">Waiting punches: {d.pending_punches || 0}</div></> },
        { key: 'status', header: 'Status', render: d => <Badge tone={d.status === 'ACTIVE' ? 'success' : 'danger'}>{plain(d.status)}</Badge> },
        { key: 'actions', header: '', align: 'right', hideOnMobile: true, render: d => <EditButton onClick={() => handleEdit(d)} /> },
    ];

    return (
        <div className="space-y-4">
            <MasterTop
                intro="Fingerprint / face attendance machines at this branch. Staff punches come from these machines."
                addLabel={showForm && !editingId ? undefined : 'Add machine'}
                onAdd={openAdd}
                count={devices.length}
                countLabel={devices.length === 1 ? 'machine' : 'machines'}
            />

            {msg && (
                <Alert tone={msg.type} onClose={() => setMsg(null)}>
                    {msg.text}
                </Alert>
            )}

            {showForm && (
                <FormCard
                    id="device-form"
                    title={editingId ? 'Change machine' : 'New machine'}
                    onSubmit={handleSubmit}
                    onCancel={closeForm}
                    saveLabel="Save machine"
                >
                    <Field label="Machine name" required>
                        <input type="text" value={form.device_name} onChange={e => setForm({...form, device_name: e.target.value})} required className="input" placeholder="e.g. Main gate" />
                    </Field>
                    <Field label="Machine code" required hint={editingId ? 'The code cannot be changed.' : undefined}>
                        <input type="text" value={form.device_code} onChange={e => setForm({...form, device_code: e.target.value})} required className="input" disabled={!!editingId} />
                    </Field>
                    <Field label="Serial number (optional)">
                        <input type="text" value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} className="input" />
                    </Field>
                    <Field label="Status">
                        <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="input">
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="MAINTENANCE">Under repair</option>
                        </select>
                    </Field>

                    <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                        <p className="text-sm font-semibold text-slate-900">Connection settings</p>
                        <p className="text-xs text-slate-500">Ask the person who set up the machine if you are not sure.</p>
                    </div>
                    <Field label="How it connects">
                        <select value={form.communication_type} onChange={e => setForm({...form, communication_type: e.target.value})} className="input">
                            <option value="TCP">TCP/IP (Listener)</option>
                            <option value="HTTP">HTTP/API (Push)</option>
                            <option value="ADMS">ADMS</option>
                            <option value="SDK">SDK/Polling</option>
                        </select>
                    </Field>
                    <Field label="IP address">
                        <input type="text" inputMode="decimal" value={form.ip_address} onChange={e => setForm({...form, ip_address: e.target.value})} className="input" placeholder="e.g. 192.168.1.20" />
                    </Field>
                    <Field label="Port">
                        <input type="number" inputMode="numeric" value={form.port} onChange={e => setForm({...form, port: parseInt(e.target.value)})} className="input" />
                    </Field>
                    <Field label="Machine password (optional)">
                        <input type="text" value={form.communication_password} onChange={e => setForm({...form, communication_password: e.target.value})} className="input" />
                    </Field>
                    <Field label="Sync">
                        <select value={form.sync_mode} onChange={e => setForm({...form, sync_mode: e.target.value})} className="input">
                            <option value="AUTO">Automatic</option>
                            <option value="MANUAL">By hand</option>
                        </select>
                    </Field>
                    <Field label="Sync every (minutes)">
                        <input type="number" inputMode="numeric" value={form.sync_interval_minutes} onChange={e => setForm({...form, sync_interval_minutes: parseInt(e.target.value)})} className="input" />
                    </Field>
                </FormCard>
            )}

            <DataList
                columns={columns}
                rows={devices}
                rowKey={d => d.id}
                loading={loading}
                emptyTitle="No machines yet"
                emptyHint={'Tap \u201cAdd machine\u201d to add your first attendance machine.'}
                mobileActions={d => <EditButton onClick={() => handleEdit(d)} />}
            />
        </div>
    );
};
