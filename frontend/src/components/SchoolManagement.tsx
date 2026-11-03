import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { canWrite } from '../utils/permissions';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Alert, LoadingState, EmptyState, Field, Button } from './ui';
import { Plus, X } from 'lucide-react';

interface Branch {
  id: number;
  branch_name: string;
  branch_code: string;
}

interface School {
  id: number;
  school_name: string;
  school_code: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  theme_color: string | null;
  subscription_plan: string | null;
  is_active: boolean;
  branch_count: number;
  branches: Branch[];
}

interface Location {
  code: string;
  name: string;
}

const SchoolManagement: React.FC = () => {
  const { user } = useAuth();
  // Use PBAC instead of Admin role check for actions
  const canManageSchools = canWrite(user, 'setup.school-setup.setup-school');
  const isGlobalManager = canWrite(user, 'system.franchise.franchise-management');

  const [schools, setSchools] = useState<School[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // School modal/form states
  const [showSchoolForm, setShowSchoolForm] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState<number | null>(null);
  const [schoolForm, setSchoolForm] = useState({
    school_name: '',
    school_code: '',
    address: '',
    phone: '',
    email: '',
    theme_color: '#4f46e5',
    subscription_plan: 'Standard',
  });

  // Branch form states
  const [activeBranchSchoolId, setActiveBranchSchoolId] = useState<number | null>(null);
  const [branchForm, setBranchForm] = useState({
    branch_name: '',
    branch_code: '',
    location_code: '',
  });

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/schools');
      setSchools(res.data.schools || []);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to load schools' });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const res = await api.get('/org/locations');
      setLocations(res.data.locations || []);
    } catch (e: any) {
      console.error('Failed to load locations:', e);
    }
  }, []);

  useEffect(() => {
    fetchSchools();
    fetchLocations();
  }, [fetchSchools, fetchLocations]);

  const handleSaveSchool = async () => {
    if (!schoolForm.school_name.trim()) {
      setMsg({ type: 'error', text: 'Type the school name first.' });
      return;
    }
    try {
      if (editingSchoolId) {
        await api.put(`/schools/${editingSchoolId}`, schoolForm);
      } else {
        await api.post('/schools', schoolForm);
      }
      setMsg({ type: 'success', text: editingSchoolId ? 'School saved.' : 'School added.' });
      setShowSchoolForm(false);
      fetchSchools();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to save school' });
    }
  };

  const handleSaveBranch = async () => {
    if (!branchForm.branch_name.trim() || !branchForm.branch_code.trim() || !branchForm.location_code) {
      setMsg({ type: 'error', text: 'Type the branch name and code, and choose a city.' });
      return;
    }
    try {
      // Same endpoint as Franchise Management (POST /api/branches with school_id)
      await api.post("/branches", { ...branchForm, school_id: activeBranchSchoolId });
      setMsg({ type: 'success', text: 'Branch added.' });
      setActiveBranchSchoolId(null);
      setBranchForm({ branch_name: '', branch_code: '', location_code: '' });
      fetchSchools();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to add branch' });
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      {/* Header */}
      <PageHeader
        eyebrow="Control Panel"
        title="Schools"
        subtitle={isGlobalManager ? 'All schools and their branches. Edit school details or add a branch.' : 'Your schools and their branches. Edit school details or add a branch.'}
        actions={canManageSchools && (
          <button
            onClick={() => {
              setSchoolForm({ school_name: '', school_code: '', address: '', phone: '', email: '', theme_color: '#4f46e5', subscription_plan: 'Standard' });
              setEditingSchoolId(null);
              setShowSchoolForm(true);
              setMsg(null);
            }}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            Add school
          </button>
        )}
      />

      {/* Messages */}
      {msg && !showSchoolForm && activeBranchSchoolId === null && (
        <Alert tone={msg.type} className="mb-6" onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {/* Loading state */}
      {loading ? (
        <LoadingState label="Loading schools…" />
      ) : schools.length === 0 ? (
        <div className="card">
          <EmptyState title="No schools yet" description={canManageSchools ? 'Tap "Add school" to add one.' : undefined} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {schools.map(school => (
            <div key={school.id} className="card overflow-hidden flex flex-col">
              {/* School Info Block */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: school.theme_color || '#4f46e5' }}>
                    {school.school_name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 break-words">{school.school_name}</h2>
                    <span className="badge-neutral mt-1">
                      Code: {school.school_code || '—'}
                    </span>
                  </div>
                </div>
                {canManageSchools && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setSchoolForm({
                          school_name: school.school_name,
                          school_code: school.school_code || '',
                          address: school.address || '',
                          phone: school.phone || '',
                          email: school.email || '',
                          theme_color: school.theme_color || '#4f46e5',
                          subscription_plan: school.subscription_plan || 'Standard',
                        });
                        setEditingSchoolId(school.id);
                        setShowSchoolForm(true);
                        setMsg(null);
                      }}
                      className="btn-secondary btn-sm min-h-[40px]"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>

              {/* School Details */}
              <div className="px-4 sm:px-5 py-4 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 gap-3 border-b border-slate-100 text-sm text-slate-700">
                <div className="min-w-0 break-words">
                  <span className="block text-xs text-slate-500">Phone number</span> {school.phone || '—'}
                </div>
                <div className="min-w-0 break-all">
                  <span className="block text-xs text-slate-500">Email</span> {school.email || '—'}
                </div>
                <div className="sm:col-span-2 min-w-0 break-words">
                  <span className="block text-xs text-slate-500">Address</span> {school.address || '—'}
                </div>
              </div>

              {/* Branches Block */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800">Branches ({school.branches.length})</h3>
                  {canManageSchools && (
                    <button
                      onClick={() => {
                        setActiveBranchSchoolId(school.id);
                        setBranchForm({ branch_name: '', branch_code: '', location_code: '' });
                        setMsg(null);
                      }}
                      className="btn-soft btn-sm min-h-[40px]"
                    >
                      <Plus className="w-4 h-4" /> Add branch
                    </button>
                  )}
                </div>

                <div className="space-y-3 flex-1">
                  {school.branches.length === 0 ? (
                    <EmptyState compact title="No branches yet" />
                  ) : (
                    school.branches.map(branch => (
                      <div key={branch.id} className="card flex items-center justify-between p-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                            {branch.branch_name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-medium text-slate-900 text-sm block">{branch.branch_name}</span>
                            <span className="text-xs text-slate-500">Code: {branch.branch_code}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* School Form Dialog */}
      {showSchoolForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="card shadow-pop w-full sm:max-w-lg overflow-hidden rounded-b-none sm:rounded-b-xl max-h-[100dvh] flex flex-col">
            <div className="card-header">
              <h2 className="text-base font-semibold text-slate-900">{editingSchoolId ? 'Edit school' : 'Add a school'}</h2>
              <button type="button" onClick={() => setShowSchoolForm(false)} className="btn-icon h-11 w-11" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 flex-1 overflow-y-auto sm:max-h-[75vh]">
              {msg && <Alert tone={msg.type}>{msg.text}</Alert>}
              <Field label="School name" htmlFor="sm-name" required>
                <input
                  id="sm-name"
                  type="text"
                  value={schoolForm.school_name}
                  onChange={e => setSchoolForm(f => ({ ...f, school_name: e.target.value }))}
                  className="input h-11"
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="School code (optional)" htmlFor="sm-code">
                  <input
                    id="sm-code"
                    type="text"
                    value={schoolForm.school_code}
                    onChange={e => setSchoolForm(f => ({ ...f, school_code: e.target.value }))}
                    className="input h-11"
                  />
                </Field>
                <Field label="Plan" htmlFor="sm-plan">
                  <input
                    id="sm-plan"
                    type="text"
                    value={schoolForm.subscription_plan}
                    onChange={e => setSchoolForm(f => ({ ...f, subscription_plan: e.target.value }))}
                    className="input h-11"
                  />
                </Field>
              </div>
              <Field label="Colour for this school" htmlFor="sm-color">
                <input
                  id="sm-color"
                  type="color"
                  value={schoolForm.theme_color}
                  onChange={e => setSchoolForm(f => ({ ...f, theme_color: e.target.value }))}
                  className="w-14 h-11 border border-slate-200 rounded-xl cursor-pointer"
                />
              </Field>
              <Field label="Email (optional)" htmlFor="sm-email">
                <input
                  id="sm-email"
                  type="email"
                  inputMode="email"
                  value={schoolForm.email}
                  onChange={e => setSchoolForm(f => ({ ...f, email: e.target.value }))}
                  className="input h-11"
                />
              </Field>
              <Field label="Phone number (optional)" htmlFor="sm-phone">
                <input
                  id="sm-phone"
                  type="tel"
                  inputMode="tel"
                  value={schoolForm.phone}
                  onChange={e => setSchoolForm(f => ({ ...f, phone: e.target.value }))}
                  className="input h-11"
                />
              </Field>
              <Field label="Address (optional)" htmlFor="sm-address">
                <textarea
                  id="sm-address"
                  value={schoolForm.address}
                  onChange={e => setSchoolForm(f => ({ ...f, address: e.target.value }))}
                  className="input h-20"
                />
              </Field>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 flex gap-2 [&>*]:flex-1">
              <Button variant="secondary" size="lg" onClick={() => setShowSchoolForm(false)}>
                Cancel
              </Button>
              <Button size="lg" onClick={handleSaveSchool} disabled={!schoolForm.school_name.trim()}>
                Save school
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Form Dialog */}
      {activeBranchSchoolId !== null && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="card shadow-pop w-full sm:max-w-md overflow-hidden rounded-b-none sm:rounded-b-xl">
            <div className="card-header">
              <h2 className="text-base font-semibold text-slate-900">
                Add a branch{schools.find(sc => sc.id === activeBranchSchoolId) ? ` to ${schools.find(sc => sc.id === activeBranchSchoolId)!.school_name}` : ''}
              </h2>
              <button type="button" onClick={() => setActiveBranchSchoolId(null)} className="btn-icon h-11 w-11" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {msg && <Alert tone={msg.type}>{msg.text}</Alert>}
              <Field label="Branch name" htmlFor="sm-bname" required>
                <input
                  id="sm-bname"
                  type="text"
                  placeholder="For example: Hyderabad Branch"
                  value={branchForm.branch_name}
                  onChange={e => setBranchForm(f => ({ ...f, branch_name: e.target.value }))}
                  className="input h-11"
                />
              </Field>
              <Field label="Branch code" htmlFor="sm-bcode" required hint="A short code, for example HYD.">
                <input
                  id="sm-bcode"
                  type="text"
                  placeholder="HYD"
                  value={branchForm.branch_code}
                  onChange={e => setBranchForm(f => ({ ...f, branch_code: e.target.value }))}
                  className="input h-11"
                />
              </Field>
              <Field label="City" htmlFor="sm-bloc" required>
                <select
                  id="sm-bloc"
                  value={branchForm.location_code}
                  onChange={e => setBranchForm(f => ({ ...f, location_code: e.target.value }))}
                  className="input h-11"
                >
                  <option value="">Choose a city</option>
                  {locations.map(loc => (
                    <option key={loc.code} value={loc.code}>{loc.name} ({loc.code})</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 flex gap-2 [&>*]:flex-1">
              <Button variant="secondary" size="lg" onClick={() => setActiveBranchSchoolId(null)}>
                Cancel
              </Button>
              <Button
                size="lg"
                onClick={handleSaveBranch}
                disabled={!branchForm.branch_name.trim() || !branchForm.branch_code.trim() || !branchForm.location_code}
              >
                Save branch
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolManagement;
