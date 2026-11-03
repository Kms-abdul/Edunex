import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { canWrite } from '../utils/permissions';
import { useAuth } from '../contexts/AuthContext';
import { confirmDialog } from './ui/feedback';
import { PageHeader, Alert, LoadingState, EmptyState, Field, Button } from './ui';
import { Plus, X } from 'lucide-react';

interface School {
  id: number; school_name: string; school_code: string | null;
  logo_url: string | null; address: string | null; phone: string | null;
  email: string | null; theme_color: string | null; subscription_plan: string | null;
  is_active: boolean; branch_count: number;
  branches: Array<{ id: number; branch_name: string; branch_code: string }>;
}

interface Location {
  code: string;
  name: string;
}

interface BranchForm { branch_name: string; branch_code: string; location_code: string; }

const FranchiseManagement: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const isSuperAdmin = canWrite(user, 'system.franchise.franchise-management');
  // Matches the backend guard on POST /api/branches
  const canAddBranch = isSuperAdmin || hasPermission('setup.school-setup.setup-school', 'write');

  const [activeTab, setActiveTab] = useState<'schools' | 'locations'>('schools');
  const [schools, setSchools] = useState<School[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Location form
  const [showLocForm, setShowLocForm] = useState(false);
  const [locForm, setLocForm] = useState({ name: '', code: '' });

  // School form
  const [showSchoolForm, setShowSchoolForm] = useState(false);
  const [editingSchoolId, setEditingSchoolId] = useState<number | null>(null);
  const [schoolForm, setSchoolForm] = useState({
    school_name: '', school_code: '', address: '', phone: '', email: '',
    theme_color: '#009746', subscription_plan: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Branch form
  const [activeBranchSchoolId, setActiveBranchSchoolId] = useState<number | null>(null);
  const [branchForm, setBranchForm] = useState<BranchForm>({ branch_name: '', branch_code: '', location_code: '' });
  const [savingBranch, setSavingBranch] = useState(false);

  // Use relative URLs so Vite proxy forwards /static/* to Flask (port 5001)
  const API_BASE = '';

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/schools');
      setSchools(res.data.schools || []);
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to load schools' });
    } finally { setLoading(false); }
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

  // ── School CRUD ──────────────────────────────────────────────────────────

  const openCreateSchool = () => {
    setSchoolForm({ school_name: '', school_code: '', address: '', phone: '', email: '', theme_color: '#009746', subscription_plan: '' });
    setLogoFile(null); setLogoPreview(null); setEditingSchoolId(null);
    setShowSchoolForm(true); setMsg(null);
  };

  const openEditSchool = (s: School) => {
    setSchoolForm({
      school_name: s.school_name, school_code: s.school_code || '',
      address: s.address || '', phone: s.phone || '', email: s.email || '',
      theme_color: s.theme_color || '#009746', subscription_plan: s.subscription_plan || '',
    });
    setLogoPreview(s.logo_url ? (s.logo_url.startsWith('/') ? `${API_BASE}${s.logo_url}` : s.logo_url) : null);
    setLogoFile(null); setEditingSchoolId(s.id);
    setShowSchoolForm(true); setMsg(null);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    // Revoke previous blob URL to prevent memory leak
    if (logoPreview && logoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(logoPreview);
    }
    setLogoPreview(URL.createObjectURL(f));
  };

  const handleSaveSchool = async () => {
    if (!schoolForm.school_name.trim()) { setMsg({ type: 'error', text: 'Type the school name first.' }); return; }
    setMsg(null);
    try {
      let schoolId = editingSchoolId;
      if (editingSchoolId) {
        await api.put(`/schools/${editingSchoolId}`, schoolForm);
      } else {
        const res = await api.post('/schools', schoolForm);
        schoolId = res.data.school_id;
      }
      // Upload logo if selected
      if (logoFile && schoolId) {
        const fd = new FormData();
        fd.append('logo', logoFile);
        await api.post(`/schools/${schoolId}/logo`, fd, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      }
      setMsg({ type: 'success', text: editingSchoolId ? 'School saved.' : 'School added.' });
      setShowSchoolForm(false); fetchSchools();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to save school' });
    }
  };

  const handleDeleteSchool = async (id: number, name: string) => {
    if (!await confirmDialog(`Turn off the school "${name}"? People will not be able to use it until it is turned on again.`, { confirmText: 'Turn off school', tone: 'danger' })) return;
    try {
      await api.delete(`/schools/${id}`);
      fetchSchools();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to delete school' });
    }
  };

  // ── Location CRUD ────────────────────────────────────────────────────────

  const handleSaveLocation = async () => {
    if (!locForm.name || !locForm.code) {
      setMsg({ type: 'error', text: 'Type the city name and a 3-letter short code.' });
      return;
    }
    try {
      await api.post('/org/locations', locForm);
      setMsg({ type: 'success', text: 'City added.' });
      setLocForm({ name: '', code: '' });
      setShowLocForm(false);
      fetchLocations();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to create location' });
    }
  };

  // ── Branch CRUD ──────────────────────────────────────────────────────────

  const handleSaveBranch = async (schoolId: number) => {
    if (!branchForm.branch_name.trim() || !branchForm.branch_code.trim() || !branchForm.location_code) {
      setMsg({ type: 'error', text: 'Type the branch name and code, and choose a city.' }); return;
    }
    setSavingBranch(true); setMsg(null);
    try {
      await api.post('/branches', { ...branchForm, school_id: schoolId });
      setBranchForm({ branch_name: '', branch_code: '', location_code: '' });
      setActiveBranchSchoolId(null);
      setMsg({ type: 'success', text: 'Branch added.' });
      fetchSchools();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to add branch' });
    } finally { setSavingBranch(false); }
  };

  const handleDeleteBranch = async (branchId: number) => {
    if (!await confirmDialog('Remove this branch? People will no longer be able to choose it.', { confirmText: 'Remove branch', tone: 'danger' })) return;
    try {
      await api.delete(`/branches/${branchId}`);
      fetchSchools();
    } catch (e: any) {
      setMsg({ type: 'error', text: 'Failed to remove branch' });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      {/* Page Header */}
      <PageHeader
        eyebrow="Control Panel"
        title="Franchises"
        subtitle="Your schools, their branches, and the cities they are in."
        actions={isSuperAdmin ? (
          activeTab === 'schools' ? (
            <Button onClick={openCreateSchool} icon={<Plus className="w-4 h-4" />}>Add school</Button>
          ) : (
            <Button onClick={() => { setShowLocForm(true); setMsg(null); }} icon={<Plus className="w-4 h-4" />}>Add city</Button>
          )
        ) : undefined}
      />

      <div className="segmented mb-4 w-full sm:w-auto" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'schools'}
          onClick={() => setActiveTab('schools')}
          className={`segmented-item flex-1 sm:flex-none min-h-[40px] ${activeTab === 'schools' ? 'segmented-item-active' : ''}`}
        >
          Schools and branches
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'locations'}
          onClick={() => setActiveTab('locations')}
          className={`segmented-item flex-1 sm:flex-none min-h-[40px] ${activeTab === 'locations' ? 'segmented-item-active' : ''}`}
        >
          Cities
        </button>
      </div>

      {msg && !showSchoolForm && (
        <Alert tone={msg.type} className="mb-4" onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {/* ── School Form Modal ──────────────────────────────────────────────── */}
      {showSchoolForm && (
        <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="card shadow-pop w-full sm:max-w-lg max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto rounded-b-none sm:rounded-b-xl">
            <div className="card-header sticky top-0 bg-white z-10">
              <h2 className="text-base font-semibold text-slate-900">{editingSchoolId ? 'Edit school' : 'Add a school'}</h2>
              <button type="button" onClick={() => setShowSchoolForm(false)} className="btn-icon h-11 w-11" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {msg && (
                <Alert tone={msg.type}>
                  {msg.text}
                </Alert>
              )}

              {/* Logo Upload */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 cursor-pointer hover:border-brand-400 transition-colors"
                  onClick={() => fileRef.current?.click()}>
                  {logoPreview
                    ? <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                    : <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">School logo (optional)</p>
                  <p className="text-xs text-slate-500 mb-2">A picture file: PNG, JPG or WebP</p>
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="btn-soft min-h-[44px]">
                    Choose picture
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </div>
              </div>

              {[
                { label: 'School name', key: 'school_name', type: 'text', placeholder: 'For example: Madhuri Vidyalaya', required: true, inputMode: undefined },
                { label: 'School code (optional)', key: 'school_code', type: 'text', placeholder: 'For example: MV001', inputMode: undefined },
                { label: 'Email (optional)', key: 'email', type: 'email', placeholder: 'school@example.com', inputMode: 'email' as const },
                { label: 'Phone number (optional)', key: 'phone', type: 'tel', placeholder: '+91 99999 99999', inputMode: 'tel' as const },
                { label: 'Address (optional)', key: 'address', type: 'text', placeholder: 'Full address', inputMode: undefined },
                { label: 'Plan (optional)', key: 'subscription_plan', type: 'text', placeholder: 'For example: Enterprise, Basic', inputMode: undefined },
              ].map(({ label, key, type, placeholder, required, inputMode }) => (
                <Field key={key} label={label} htmlFor={`fm-${key}`} required={required}>
                  <input id={`fm-${key}`} type={type} inputMode={inputMode} value={(schoolForm as any)[key]}
                    onChange={e => setSchoolForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="input h-11" />
                </Field>
              ))}

              <div>
                <label className="label">Colour for this school</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={schoolForm.theme_color}
                    onChange={e => setSchoolForm(f => ({ ...f, theme_color: e.target.value }))}
                    className="w-11 h-11 rounded-lg border border-slate-300 cursor-pointer" />
                  <span className="text-sm text-slate-500">{schoolForm.theme_color}</span>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white flex gap-2 p-4 border-t border-slate-200 [&>*]:flex-1">
              <Button variant="secondary" size="lg" onClick={() => setShowSchoolForm(false)}>
                Cancel
              </Button>
              <Button size="lg" onClick={handleSaveSchool} disabled={!schoolForm.school_name.trim()}>
                {editingSchoolId ? 'Save school' : 'Add school'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Location Form Modal ──────────────────────────────────────────────── */}
      {showLocForm && (
        <div className="bg-slate-900/50 backdrop-blur-[2px] fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="card shadow-pop w-full sm:max-w-sm rounded-b-none sm:rounded-b-xl">
            <div className="card-header">
              <h2 className="text-base font-semibold text-slate-900">Add a city</h2>
              <button type="button" onClick={() => setShowLocForm(false)} className="btn-icon h-11 w-11" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {msg && (
                <Alert tone={msg.type}>
                  {msg.text}
                </Alert>
              )}
              <Field label="City name" htmlFor="fm-loc-name" required>
                <input id="fm-loc-name" type="text" value={locForm.name} onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="For example: Hyderabad" className="input h-11" />
              </Field>
              <Field label="Short code" htmlFor="fm-loc-code" required hint="3 letters, for example HYD.">
                <input id="fm-loc-code" type="text" autoCapitalize="characters" value={locForm.code} onChange={e => setLocForm(f => ({ ...f, code: e.target.value.toUpperCase().slice(0, 3) }))}
                  placeholder="HYD" className="input h-11" />
              </Field>
            </div>
            <div className="flex gap-2 p-4 border-t border-slate-200 [&>*]:flex-1">
              <Button variant="secondary" size="lg" onClick={() => setShowLocForm(false)}>Cancel</Button>
              <Button size="lg" onClick={handleSaveLocation} disabled={!locForm.name || !locForm.code}>Add city</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs Content ───────────────────────────────────────────────────── */}
      {activeTab === 'locations' ? (
        <div className="card p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Cities</h2>
          <p className="text-sm text-slate-500 mt-0.5 mb-4">Each branch belongs to one of these cities.</p>
          {locations.length === 0 && <EmptyState compact title="No cities yet" description={isSuperAdmin ? 'Tap "Add city" to add one.' : undefined} />}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {locations.map(loc => (
              <div key={loc.code} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{loc.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{loc.code}</p>
                </div>
                <div className="w-8 h-8 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center text-xs font-bold">
                  {loc.code}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {loading ? (
            <LoadingState label="Loading schools..." />
          ) : schools.length === 0 ? (
            <div className="card border-dashed">
              <EmptyState
                title="No schools yet"
                description={isSuperAdmin ? 'Tap "Add school" to add your first school.' : undefined}
                icon={
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
              />
            </div>
          ) : (
            <div className="space-y-6">
              {schools.map(school => (
                <div key={school.id} className="card overflow-hidden">
                  {/* School Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="card w-14 h-14 border-2 border-brand-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {school.logo_url
                          ? <img src={school.logo_url.startsWith('/') ? `${API_BASE}${school.logo_url}` : school.logo_url} alt={school.school_name}
                            className="w-full h-full object-contain"
                            onError={(e) => { console.error("Logo failed:", e.currentTarget.src); }} />
                          : <span className="text-2xl font-bold text-brand-300">{school.school_name[0]}</span>
                        }
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">{school.school_name}</h2>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {school.school_code && (
                            <span className="badge-brand">{school.school_code}</span>
                          )}
                          <span className="text-xs text-slate-500">{school.branch_count} branch{school.branch_count !== 1 ? 'es' : ''}</span>
                          {school.subscription_plan && (
                            <span className="badge-warning">{school.subscription_plan}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => openEditSchool(school)}
                          className="btn-secondary btn-sm min-h-[40px]">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDeleteSchool(school.id, school.school_name)}
                          className="btn-ghost btn-sm min-h-[40px] text-red-600">
                          Turn off
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Branches */}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700">Branches</h3>
                      {canAddBranch && (
                      <button onClick={() => { setActiveBranchSchoolId(school.id); setBranchForm({ branch_name: '', branch_code: '', location_code: '' }); setMsg(null); }}
                        className="btn-soft btn-sm min-h-[40px]">
                        <Plus className="w-4 h-4" />
                        Add branch
                      </button>
                      )}
                    </div>

                    {/* Inline Add Branch Form */}
                    {activeBranchSchoolId === school.id && (
                      <div className="mb-4 p-4 bg-brand-50 rounded-xl border border-brand-100">
                        <p className="text-sm font-semibold text-brand-800 mb-3">Add a branch to {school.school_name}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Field label="Branch name" htmlFor={`fm-bn-${school.id}`} required>
                            <input id={`fm-bn-${school.id}`} value={branchForm.branch_name} onChange={e => setBranchForm(f => ({ ...f, branch_name: e.target.value }))}
                              placeholder="For example: Vizag" className="input h-11 w-full" />
                          </Field>
                          <Field label="Branch code" htmlFor={`fm-bc-${school.id}`} required>
                            <input id={`fm-bc-${school.id}`} value={branchForm.branch_code} onChange={e => setBranchForm(f => ({ ...f, branch_code: e.target.value }))}
                              placeholder="For example: VZG01" className="input h-11 w-full" />
                          </Field>
                          <Field label="City" htmlFor={`fm-bl-${school.id}`} required>
                            <select
                              id={`fm-bl-${school.id}`}
                              value={branchForm.location_code}
                              onChange={e => setBranchForm(f => ({ ...f, location_code: e.target.value }))}
                              className="input h-11 w-full"
                            >
                              <option value="">Choose a city</option>
                              {locations.map(loc => (
                                <option key={loc.code} value={loc.code}>{loc.name} ({loc.code})</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <div className="flex gap-2 mt-4 [&>*]:flex-1 sm:[&>*]:flex-none sm:justify-end">
                          <Button variant="secondary" onClick={() => setActiveBranchSchoolId(null)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={() => handleSaveBranch(school.id)}
                            loading={savingBranch}
                            disabled={!branchForm.branch_name.trim() || !branchForm.branch_code.trim() || !branchForm.location_code}
                          >
                            Save branch
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Branch List */}
                    {school.branches.length === 0 ? (
                      <div className="bg-slate-50 rounded-lg border border-dashed border-slate-200"><EmptyState compact title="No branches yet" className="!py-4" /></div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {school.branches.map(b => (
                          <div key={b.id} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-1 py-1.5">
                            <div>
                              <p className="font-medium text-slate-800 text-sm">{b.branch_name}</p>
                              <p className="text-xs text-slate-500 font-mono">{b.branch_code}</p>
                            </div>
                            <button type="button" onClick={() => handleDeleteBranch(b.id)}
                              className="min-h-[44px] px-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FranchiseManagement;
