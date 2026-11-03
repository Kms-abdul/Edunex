import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { canWrite } from '../utils/permissions';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Alert, LoadingState, EmptyState } from './ui';

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
      setMsg({ type: 'error', text: 'School name is required' });
      return;
    }
    try {
      if (editingSchoolId) {
        await api.put(`/schools/${editingSchoolId}`, schoolForm);
      } else {
        await api.post('/schools', schoolForm);
      }
      setMsg({ type: 'success', text: editingSchoolId ? 'School updated successfully!' : 'School created successfully!' });
      setShowSchoolForm(false);
      fetchSchools();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to save school' });
    }
  };

  const handleSaveBranch = async () => {
    if (!branchForm.branch_name.trim() || !branchForm.branch_code.trim() || !branchForm.location_code) {
      setMsg({ type: 'error', text: 'All branch fields are required' });
      return;
    }
    try {
      await api.post(`/schools/${activeBranchSchoolId}/branches`, branchForm);
      setMsg({ type: 'success', text: 'Branch added successfully!' });
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
        title="School Management"
        subtitle={isGlobalManager ? 'Full administration of all schools and branches' : 'Manage your assigned schools and branches'}
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
            Create School
          </button>
        )}
      />

      {/* Messages */}
      {msg && (
        <Alert tone={msg.type} className="mb-6" onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {/* Loading state */}
      {loading ? (
        <LoadingState label="Loading schools & branches..." />
      ) : schools.length === 0 ? (
        <div className="card">
          <EmptyState title="No schools found" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {schools.map(school => (
            <div key={school.id} className="card overflow-hidden flex flex-col">
              {/* School Info Block */}
              <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: school.theme_color || '#4f46e5' }}>
                    {school.school_name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{school.school_name}</h2>
                    <span className="badge-neutral mt-1">
                      Code: {school.school_code || 'N/A'}
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
                      className="btn-ghost btn-sm"
                      title="Edit School"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>

              {/* School Details */}
              <div className="px-5 py-4 bg-slate-50 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-slate-100 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-500">Phone:</span> {school.phone || 'N/A'}
                </div>
                <div>
                  <span className="font-semibold text-slate-500">Email:</span> {school.email || 'N/A'}
                </div>
                <div className="sm:col-span-2">
                  <span className="font-semibold text-slate-500">Address:</span> {school.address || 'N/A'}
                </div>
              </div>

              {/* Branches Block */}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800">Branches ({school.branches.length})</h3>
                  {canManageSchools && (
                    <button
                      onClick={() => {
                        setActiveBranchSchoolId(school.id);
                        setBranchForm({ branch_name: '', branch_code: '', location_code: '' });
                        setMsg(null);
                      }}
                      className="text-xs text-brand-600 hover:text-brand-800 font-medium hover:underline"
                    >
                      + Add Branch
                    </button>
                  )}
                </div>

                <div className="space-y-3 flex-1">
                  {school.branches.length === 0 ? (
                    <EmptyState compact title="No branches assigned/created." />
                  ) : (
                    school.branches.map(branch => (
                      <div key={branch.id} className="card flex items-center justify-between p-3 hover:border-slate-300 transition-colors">
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card shadow-pop w-full max-w-lg overflow-hidden">
            <div className="card-header">
              <h2 className="text-base font-semibold text-slate-900">{editingSchoolId ? 'Edit School Details' : 'Create New School'}</h2>
              <button onClick={() => setShowSchoolForm(false)} className="btn-icon" aria-label="Close">✕</button>
            </div>
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="label">School Name</label>
                <input
                  type="text"
                  value={schoolForm.school_name}
                  onChange={e => setSchoolForm(f => ({ ...f, school_name: e.target.value }))}
                  className="input"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">School Code</label>
                  <input
                    type="text"
                    value={schoolForm.school_code}
                    onChange={e => setSchoolForm(f => ({ ...f, school_code: e.target.value }))}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Subscription Plan</label>
                  <input
                    type="text"
                    value={schoolForm.subscription_plan}
                    onChange={e => setSchoolForm(f => ({ ...f, subscription_plan: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="label">Theme Color</label>
                <input
                  type="color"
                  value={schoolForm.theme_color}
                  onChange={e => setSchoolForm(f => ({ ...f, theme_color: e.target.value }))}
                  className="w-12 h-10 border border-slate-200 rounded-xl cursor-pointer"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={schoolForm.email}
                  onChange={e => setSchoolForm(f => ({ ...f, email: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  type="text"
                  value={schoolForm.phone}
                  onChange={e => setSchoolForm(f => ({ ...f, phone: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Address</label>
                <textarea
                  value={schoolForm.address}
                  onChange={e => setSchoolForm(f => ({ ...f, address: e.target.value }))}
                  className="input h-20"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={handleSaveSchool} className="btn-primary flex-1">
                Save School
              </button>
              <button onClick={() => setShowSchoolForm(false)} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch Form Dialog */}
      {activeBranchSchoolId !== null && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card shadow-pop w-full max-w-md overflow-hidden">
            <div className="card-header">
              <h2 className="text-base font-semibold text-slate-900">Add New Branch</h2>
              <button onClick={() => setActiveBranchSchoolId(null)} className="btn-icon" aria-label="Close">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Branch Name</label>
                <input
                  type="text"
                  placeholder="e.g. Hyderabad Branch"
                  value={branchForm.branch_name}
                  onChange={e => setBranchForm(f => ({ ...f, branch_name: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Branch Code</label>
                <input
                  type="text"
                  placeholder="e.g. HYD"
                  value={branchForm.branch_code}
                  onChange={e => setBranchForm(f => ({ ...f, branch_code: e.target.value }))}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Location Code</label>
                <select
                  value={branchForm.location_code}
                  onChange={e => setBranchForm(f => ({ ...f, location_code: e.target.value }))}
                  className="input"
                >
                  <option value="">-- Select Location --</option>
                  {locations.map(loc => (
                    <option key={loc.code} value={loc.code}>{loc.name} ({loc.code})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={handleSaveBranch} className="btn-primary flex-1">
                Save Branch
              </button>
              <button onClick={() => setActiveBranchSchoolId(null)} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchoolManagement;
