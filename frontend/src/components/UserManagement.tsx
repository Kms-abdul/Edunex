import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { canWrite } from '../utils/permissions';
import { useAuth } from '../contexts/AuthContext';
import { confirmDialog } from './ui/feedback';
import { PageHeader, Alert, Badge, Button, Field, Steps, DataList } from './ui';
import type { Column } from './ui';
import { Plus, X } from 'lucide-react';

interface SchoolOption { id: number; school_name: string; }
interface BranchOption { id: number; branch_name: string; branch_code: string; school_id: number | null; }
interface UserRow {
  user_id: number;
  username: string;
  useremail: string;
  role: string;
  role_id: number | null;
  role_name?: string;
  is_active: boolean;
  school_id: number | null;
  school_name: string | null;
  branch_id: number | null;
  branch_name: string | null;
  branch_ids?: number[];
}
interface RoleOption { id: number; name: string; is_active: boolean; }

const ROLES = ['SuperAdmin', 'Admin', 'User'];

const ROLE_COLORS: Record<string, string> = {
  SuperAdmin: 'badge-brand',
  Admin: 'badge-brand',
  User: 'badge-success',
};

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const canManageUsersGlobal = canWrite(currentUser, 'system.franchise.franchise-management');
  // If they can manage franchise, they act like a SuperAdmin in the UI context (see all schools)
  const isGlobalManager = canManageUsersGlobal;

  // Data
  const [users, setUsers] = useState<UserRow[]>([]);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'roles' | 'schools' | 'branches'>('basic');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<{
    username: string;
    password: string;
    useremail: string;
    role: string;
    role_id: string;
    school_id: string;
    school_ids: number[];
    branch_id: string;
    branch_ids: number[];
  }>({
    username: '',
    password: '',
    useremail: '',
    role: 'User',
    role_id: '',
    school_id: '',
    school_ids: [],
    branch_id: '',
    branch_ids: [],
  });

  // Filter state
  const [filterSchool, setFilterSchool] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load users' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchools = useCallback(async () => {
    try {
      const res = await api.get('/schools');
      setSchools(res.data.schools || []);
    } catch { /* silent */ }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get('/branches');
      setBranches(res.data.branches || []);
    } catch { /* silent */ }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await api.get('/rbac/roles');
      setRoles(res.data.roles || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchSchools();
    fetchBranches();
    fetchRoles();
  }, [fetchUsers, fetchSchools, fetchBranches, fetchRoles]);

  useEffect(() => {
    if (!form.role_id && roles.length > 0) {
      const match = roles.find(r => r.name === form.role);
      if (match) setForm(f => ({ ...f, role_id: String(match.id) }));
    }
  }, [roles, form.role, form.role_id]);

  // ── Filtered branches (by selected school in form) ─────────────────────────
  const filteredBranches = form.school_ids && form.school_ids.length > 0
    ? branches.filter(b => b.school_id !== null && form.school_ids.includes(b.school_id))
    : form.school_id
    ? branches.filter(b => String(b.school_id) === form.school_id)
    : branches;

  // ── Form Helpers ───────────────────────────────────────────────────────────

  const resetForm = () => {
    const userRole = roles.find(r => r.name === 'User');
    setForm({ username: '', password: '', useremail: '', role: 'User', role_id: userRole ? String(userRole.id) : '', school_id: '', school_ids: [], branch_id: '', branch_ids: [] });
    setEditingId(null);
    setActiveTab('basic');
    setShowForm(false);
    setMessage(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (u: any) => {
    setForm({
      username: u.username,
      password: '',
      useremail: u.useremail || '',
      role: u.role,
      role_id: u.role_id ? String(u.role_id) : '',
      school_id: u.school_id ? String(u.school_id) : '',
      school_ids: u.school_ids || [],
      branch_id: u.branch_id ? String(u.branch_id) : '',
      branch_ids: u.branch_ids || [],
    });
    setEditingId(u.user_id);
    setActiveTab('basic');
    setShowForm(true);
    setMessage(null);
  };

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.username) { setMessage({ type: 'error', text: 'Type a username first.' }); return; }
    if (!editingId && !form.password) { setMessage({ type: 'error', text: 'Type a password for the new user.' }); return; }
    if (!form.useremail) { setMessage({ type: 'error', text: 'Type an email address first.' }); return; }

    setMessage(null);
    try {
      if (editingId) {
        // Update existing user
        const payload: any = {
          role: form.role,
          role_id: form.role_id ? Number(form.role_id) : null,
          useremail: form.useremail,
          branch_id: form.branch_id ? Number(form.branch_id) : null,
          branch_ids: form.branch_ids,
        };
        if (isGlobalManager) {
          payload.school_id = form.school_id ? Number(form.school_id) : null;
          payload.school_ids = form.school_ids;
        }
        await api.put(`/users/${editingId}`, payload);
        setMessage({ type: 'success', text: 'User saved' });
      } else {
        // Create new user
        const payload: any = {
          username: form.username,
          password: form.password,
          useremail: form.useremail,
          role: form.role,
          role_id: form.role_id ? Number(form.role_id) : undefined,
          branch_id: form.branch_id ? Number(form.branch_id) : undefined,
          school_id: form.school_id ? Number(form.school_id) : undefined,
          school_ids: form.school_ids,
          branch_ids: form.branch_ids,
        };
        await api.post('/users/add', payload);
        setMessage({ type: 'success', text: 'User created. They can now sign in.' });
      }
      fetchUsers();
      const userRole = roles.find(r => r.name === 'User');
      setForm({ username: '', password: '', useremail: '', role: 'User', role_id: userRole ? String(userRole.id) : '', school_id: '', school_ids: [], branch_id: '', branch_ids: [] });
      setEditingId(null);
      setShowForm(false);
      // Don't clear message here so success banner shows
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save user' });
    }
  };

  // ── Deactivate / Reactivate ──────────────────────────────────────────────────

  const handleToggleActive = async (u: UserRow) => {
    const action = u.is_active ? 'deactivate' : 'reactivate';
    const ok = await confirmDialog(
      u.is_active
        ? `Turn off the login for "${u.username}"? They will not be able to sign in until you turn it back on.`
        : `Turn the login for "${u.username}" back on?`,
      { confirmText: u.is_active ? 'Turn off' : 'Turn on', tone: u.is_active ? 'danger' : 'default' },
    );
    if (!ok) return;
    try {
      if (u.is_active) {
        await api.delete(`/users/${u.user_id}`);
      } else {
        await api.put(`/users/${u.user_id}`, { is_active: true });
      }
      fetchUsers();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || `Failed to ${action} user` });
    }
  };

  // ── Display Filtering ────────────────────────────────────────────────────────

  const displayedUsers = users.filter(u => {
    if (filterSchool && String(u.school_id) !== filterSchool) return false;
    if (filterRole && u.role !== filterRole) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return u.username.toLowerCase().includes(q) || (u.useremail || '').toLowerCase().includes(q);
    }
    return true;
  });

  // ── Steps for the add / edit form ─────────────────────────────────────────
  type TabKey = 'basic' | 'roles' | 'schools' | 'branches';
  const stepKeys: TabKey[] = ['basic', 'roles', ...(isGlobalManager ? ['schools' as TabKey] : []), 'branches'];
  const stepLabels = stepKeys.map(k => ({ basic: 'Login details', roles: 'Choose a role', schools: 'Which schools?', branches: 'Which branches?' }[k]));
  const stepIndex = Math.max(0, stepKeys.indexOf(activeTab));
  const isLastStep = stepIndex === stepKeys.length - 1;
  const basicMissing = !form.username ? 'Type a username first.'
    : !form.useremail ? 'Type an email address first.'
    : (!editingId && !form.password) ? 'Type a password first.'
    : '';
  const stepNote = stepIndex === 0 ? basicMissing : '';
  const goNext = () => { if (!isLastStep) setActiveTab(stepKeys[stepIndex + 1]); };
  const goBack = () => { if (stepIndex > 0) setActiveTab(stepKeys[stepIndex - 1]); else resetForm(); };

  const userColumns: Column<UserRow>[] = [
    {
      key: 'user', header: 'User', primary: true,
      render: u => (
        <div className={!u.is_active ? 'opacity-60' : ''}>
          <div className="font-semibold text-slate-900">{u.username}</div>
          <div className="text-xs text-slate-500 font-normal break-all">{u.useremail}</div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: u => <span className={ROLE_COLORS[u.role] || 'badge-neutral'}>{u.role}</span> },
    ...(isGlobalManager ? [{ key: 'school', header: 'School', render: (u: UserRow) => u.school_name || '—' }] : []),
    { key: 'branch', header: 'Branch', render: u => u.branch_name || '—' },
    {
      key: 'status', header: 'Status', align: 'center',
      render: u => <Badge tone={u.is_active ? 'success' : 'danger'}>{u.is_active ? 'On' : 'Off'}</Badge>,
    },
    {
      key: 'actions', header: 'Actions', align: 'right', hideOnMobile: true,
      render: u => rowActions(u),
    },
  ];

  function rowActions(u: UserRow) {
    return (
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => openEdit(u)} className="btn-secondary btn-sm min-h-[40px]">
          Edit
        </button>
        {u.user_id !== currentUser?.user_id && (
          <button
            type="button"
            onClick={() => handleToggleActive(u)}
            className={`btn-sm min-h-[40px] ${u.is_active ? 'btn-ghost text-red-600' : 'btn-soft'}`}
          >
            {u.is_active ? 'Turn off' : 'Turn on'}
          </button>
        )}
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      {/* Header */}
      <PageHeader
        eyebrow="Control Panel"
        title="Users"
        subtitle={isGlobalManager
          ? 'People who can sign in to KampusOps, in all schools. Add a user, change their role, or turn their login off.'
          : 'People who can sign in to KampusOps in your school. Add a user, change their role, or turn their login off.'}
        actions={
          <Button onClick={openCreate} icon={<Plus className="w-4 h-4" />}>
            Add user
          </Button>
        }
      />

      {/* Global Message */}
      {message && !showForm && (
        <Alert tone={message.type} className="mb-4" onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* ── Create / Edit Form (step by step) ───────────────────────────────── */}
      {showForm && (
        <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="card shadow-pop w-full sm:max-w-md max-h-[100dvh] sm:max-h-[90vh] flex flex-col rounded-b-none sm:rounded-b-xl overflow-hidden">
            <div className="card-header">
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? `Edit ${form.username}` : 'Add a new user'}
              </h2>
              <button type="button" onClick={resetForm} className="btn-icon h-11 w-11" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <Steps
                steps={stepLabels}
                current={stepIndex}
                onJump={i => setActiveTab(stepKeys[i])}
              />

              {message && (
                <Alert tone={message.type}>
                  {message.text}
                </Alert>
              )}

              {/* STEP: LOGIN DETAILS */}
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  {!editingId ? (
                    <Field label="Username" htmlFor="um-username" required hint="The name this person types to sign in.">
                      <input
                        type="text"
                        value={form.username}
                        onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                        className="input h-11"
                        placeholder="For example: vizag_admin"
                        id="um-username"
                        autoComplete="off"
                        autoCapitalize="none"
                      />
                    </Field>
                  ) : (
                    <Field label="Username" hint="The username cannot be changed.">
                      <div className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 font-semibold">
                        {form.username}
                      </div>
                    </Field>
                  )}

                  <Field label="Email" htmlFor="um-email" required>
                    <input
                      type="email"
                      inputMode="email"
                      value={form.useremail}
                      onChange={e => setForm(f => ({ ...f, useremail: e.target.value }))}
                      className="input h-11"
                      placeholder="name@school.com"
                      id="um-email"
                      autoComplete="off"
                    />
                  </Field>

                  {!editingId && (
                    <Field label="Password" htmlFor="um-password" required hint="Use at least 8 characters. Share it with the person privately.">
                      <input
                        type="password"
                        value={form.password}
                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                        className="input h-11"
                        placeholder="At least 8 characters"
                        id="um-password"
                        autoComplete="new-password"
                      />
                    </Field>
                  )}
                </div>
              )}

              {/* STEP: ROLE */}
              {activeTab === 'roles' && (
                <Field label="Role" htmlFor="um-role" required hint="The role decides which screens this person can open.">
                  <select
                    value={form.role_id || (roles.find(r => r.name === form.role)?.id ?? form.role)}
                    onChange={e => {
                      const selected = roles.find(r => String(r.id) === e.target.value);
                      setForm(f => ({
                        ...f,
                        role_id: selected ? String(selected.id) : '',
                        role: selected ? selected.name : e.target.value,
                      }));
                    }}
                    className="input h-11"
                    id="um-role"
                  >
                    {roles.length > 0 ? (
                      <>
                        {roles
                          .filter(r => r.is_active && (canWrite(currentUser, 'system.roles.role-permissions') || r.name !== 'SuperAdmin'))
                          .map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        {!roles.some(r => r.id === Number(form.role_id) || r.name === form.role) && form.role && (
                          <option value={form.role_id || form.role}>{form.role}</option>
                        )}
                      </>
                    ) : (
                      ROLES.filter(r => canWrite(currentUser, 'system.roles.role-permissions') || r !== 'SuperAdmin').map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))
                    )}
                  </select>
                </Field>
              )}

              {/* STEP: SCHOOLS */}
              {activeTab === 'schools' && isGlobalManager && (
                <div className="space-y-4">
                  <Field label="Main school" htmlFor="um-school">
                    <select
                      value={form.school_id}
                      onChange={e => setForm(f => ({ ...f, school_id: e.target.value }))}
                      className="input h-11"
                      id="um-school"
                    >
                      <option value="">Choose a school</option>
                      {schools.map(s => (
                        <option key={s.id} value={s.id}>{s.school_name}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Schools this user can open" hint="Tick every school this person works with.">
                    <div className="grid grid-cols-1 gap-1 p-2 bg-slate-50 border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                      {schools.length === 0 ? (
                        <span className="text-slate-500 text-sm p-2">No schools yet</span>
                      ) : (
                        schools.map(s => {
                          const isChecked = form.school_ids.includes(s.id);
                          return (
                            <label key={s.id} className="flex items-center gap-3 min-h-[44px] text-sm text-slate-800 hover:bg-slate-100 active:bg-slate-100 px-2 rounded cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setForm(f => {
                                    const newSchoolIds = f.school_ids.includes(s.id)
                                      ? f.school_ids.filter(id => id !== s.id)
                                      : [...f.school_ids, s.id];
                                    return {
                                      ...f,
                                      school_ids: newSchoolIds,
                                      // Auto-set primary if empty
                                      school_id: f.school_id ? f.school_id : (newSchoolIds.length > 0 ? String(newSchoolIds[0]) : '')
                                    };
                                  });
                                }}
                                className="h-5 w-5 text-brand-600 focus:ring-brand-500 border-slate-300 rounded"
                              />
                              <span className="font-medium text-slate-900">{s.school_name}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </Field>
                </div>
              )}

              {/* STEP: BRANCHES */}
              {activeTab === 'branches' && (
                <Field label="Branches this user can open" hint="Tick every branch this person works in.">
                  <div className="grid grid-cols-1 gap-1 p-2 bg-slate-50 border border-slate-200 rounded-lg max-h-72 overflow-y-auto">
                    {filteredBranches.length === 0 ? (
                      <span className="text-slate-500 text-sm p-2">No branches for the chosen school(s)</span>
                    ) : (
                      filteredBranches.map(b => {
                        const isChecked = form.branch_ids.includes(b.id);
                        return (
                          <label key={b.id} className="flex items-center gap-3 min-h-[44px] text-sm text-slate-800 hover:bg-slate-100 active:bg-slate-100 px-2 py-1 rounded cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setForm(f => {
                                  const newBranchIds = f.branch_ids.includes(b.id)
                                    ? f.branch_ids.filter(id => id !== b.id)
                                    : [...f.branch_ids, b.id];
                                  return {
                                    ...f,
                                    branch_ids: newBranchIds,
                                    branch_id: newBranchIds.length > 0 ? String(newBranchIds[0]) : '',
                                  };
                                });
                              }}
                              className="h-5 w-5 text-brand-600 focus:ring-brand-500 border-slate-300 rounded"
                            />
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900">{b.branch_name}</span>
                              <span className="text-slate-500 text-xs">{b.branch_code}</span>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </Field>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
              {stepNote && <p className="mb-2 text-sm text-slate-600">{stepNote}</p>}
              <div className="flex gap-2 [&>*]:flex-1">
                <Button variant="secondary" size="lg" onClick={goBack}>
                  {stepIndex === 0 ? 'Cancel' : 'Back'}
                </Button>
                {isLastStep ? (
                  <Button size="lg" onClick={handleSave} id="um-save-btn">
                    {editingId ? 'Save changes' : 'Create user'}
                  </Button>
                ) : (
                  <Button size="lg" onClick={goNext} disabled={!!stepNote}>
                    Next
                  </Button>
                )}
              </div>
              {editingId && !isLastStep && (
                <button type="button" onClick={handleSave} className="mt-2 w-full min-h-[44px] text-sm font-medium text-brand-700">
                  Save changes now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="card p-4 mb-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3">
        <input
          type="search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by username or email"
          className="input h-11"
          id="um-search"
          aria-label="Search users"
        />
        {isGlobalManager && (
          <select
            value={filterSchool}
            onChange={e => setFilterSchool(e.target.value)}
            className="input h-11 sm:w-auto"
            aria-label="Filter by school"
          >
            <option value="">All schools</option>
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.school_name}</option>
            ))}
          </select>
        )}
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="input h-11 sm:w-auto"
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          {roles.length > 0
            ? roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)
            : ROLES.map(r => <option key={r} value={r}>{r}</option>)
          }
        </select>
      </div>

      {/* ── Users list (table on desktop, cards on phones) ───────────────────── */}
      <DataList
        columns={userColumns}
        rows={displayedUsers}
        rowKey={u => u.user_id}
        loading={loading}
        emptyTitle="No users found"
        emptyHint={searchQuery || filterRole || filterSchool ? 'Try a different search or filter.' : 'Tap "Add user" to add the first one.'}
        mobileActions={u => rowActions(u)}
      />
      {!loading && (
        <p className="mt-3 text-sm text-slate-500">
          Showing {displayedUsers.length} of {users.length} users
        </p>
      )}
    </div>
  );
};

export default UserManagement;
