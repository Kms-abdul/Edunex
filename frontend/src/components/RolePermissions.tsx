import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api';
import { PageHeader, Alert, LoadingState, Field, ActionBar, Button } from './ui';
interface Permission {
  id: number;
  dashboard: string;
  module: string;
  component: string;
  code: string;
  description?: string;
}
interface Role {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  is_system: boolean;
}
interface RolePermission {
  permission_id: number;
  can_read: boolean;
  can_write: boolean;
  can_append: boolean;
  can_delete: boolean;
}
const NEW_ROLE_VALUE = 'new';
const emptyPermission = (permissionId: number): RolePermission => ({
  permission_id: permissionId,
  can_read: false,
  can_write: false,
  can_append: false,
  can_delete: false,
});
const RolePermissions: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRoleValue, setSelectedRoleValue] = useState<string>('');
  const [matrix, setMatrix] = useState<Record<number, RolePermission>>({});
  const [roleForm, setRoleForm] = useState({ name: '', description: '', is_active: true });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectedRoleId = selectedRoleValue && selectedRoleValue !== NEW_ROLE_VALUE ? Number(selectedRoleValue) : null;
  const selectedRole = roles.find(role => role.id === selectedRoleId);
  const isNewRole = selectedRoleValue === NEW_ROLE_VALUE;
  const groupedPermissions = useMemo(() => {
    return permissions.reduce<Record<string, { dashboard: string; rows: Permission[] }>>((acc, permission) => {
      const key = permission.dashboard || 'Other';
      if (!acc[key]) {
        acc[key] = { dashboard: permission.dashboard || 'Other', rows: [] };
      }
      acc[key].rows.push(permission);
      return acc;
    }, {});
  }, [permissions]);
  const resetMatrix = useCallback((mode: 'empty' | 'full' = 'empty') => {
    const next: Record<number, RolePermission> = {};
    permissions.forEach(permission => {
      next[permission.id] = {
        permission_id: permission.id,
        can_read: mode === 'full',
        can_write: mode === 'full',
        can_append: mode === 'full',
        can_delete: mode === 'full',
      };
    });
    setMatrix(next);
  }, [permissions]);
  const fetchBaseData = useCallback(async () => {
    setLoading(true);
    try {
      const [roleRes, permissionRes] = await Promise.all([
        api.get('/rbac/roles'),
        api.get('/rbac/permissions'),
      ]);
      const loadedRoles: Role[] = roleRes.data.roles || [];
      setRoles(loadedRoles);
      setPermissions(permissionRes.data.permissions || []);
      if (!selectedRoleValue && loadedRoles.length > 0) {
        setSelectedRoleValue(String(loadedRoles[0].id));
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load role permissions' });
    } finally {
      setLoading(false);
    }
  }, [selectedRoleValue]);
  const fetchRolePermissions = useCallback(async (roleId: number) => {
    try {
      const res = await api.get(`/rbac/roles/${roleId}`);
      const rows: RolePermission[] = res.data.role?.permissions || [];
      const next: Record<number, RolePermission> = {};
      permissions.forEach(permission => {
        next[permission.id] = emptyPermission(permission.id);
      });
      rows.forEach(row => {
        next[row.permission_id] = row;
      });
      setMatrix(next);
      setRoleForm({
        name: res.data.role.name || '',
        description: res.data.role.description || '',
        is_active: Boolean(res.data.role.is_active),
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to load selected role' });
    }
  }, [permissions]);
  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData]);
  useEffect(() => {
    if (selectedRoleId && permissions.length > 0) {
      fetchRolePermissions(selectedRoleId);
    }
    if (isNewRole && permissions.length > 0) {
      setRoleForm({ name: '', description: '', is_active: true });
      resetMatrix('empty');
    }
  }, [selectedRoleId, isNewRole, permissions.length, fetchRolePermissions, resetMatrix]);
  const handleRoleChange = (value: string) => {
    setSelectedRoleValue(value);
    setMessage(null);
    if (value === NEW_ROLE_VALUE) {
      setRoleForm({ name: '', description: '', is_active: true });
      resetMatrix('empty');
    }
  };
  const togglePermission = (permissionId: number, checked: boolean) => {
    setMatrix(prev => ({
      ...prev,
      [permissionId]: {
        permission_id: permissionId,
        can_read: checked,
        can_write: checked,
        can_append: checked,
        can_delete: checked,
      }
    }));
  };
  const toggleGroup = (rows: Permission[], checked: boolean) => {
    setMatrix(prev => {
      const next = { ...prev };
      rows.forEach(permission => {
        next[permission.id] = {
          permission_id: permission.id,
          can_read: checked,
          can_write: checked,
          can_append: checked,
          can_delete: checked,
        };
      });
      return next;
    });
  };
  const isPermissionChecked = (permissionId: number) => {
    const row = matrix[permissionId];
    return row ? (row.can_read || row.can_write || row.can_append || row.can_delete) : false;
  };
  const isGroupChecked = (rows: Permission[]) => {
    return rows.length > 0 && rows.every(p => isPermissionChecked(p.id));
  };
  const saveRole = async () => {
    if (!roleForm.name.trim()) {
      setMessage({ type: 'error', text: 'Type a role name first.' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        ...roleForm,
        permissions: permissions.map(permission => {
          const isChecked = isPermissionChecked(permission.id);
          return {
            permission_id: permission.id,
            can_read: isChecked,
            can_write: isChecked,
            can_append: isChecked,
            can_delete: isChecked,
          };
        }),
      };

      if (selectedRoleId) {
        await api.put(`/rbac/roles/${selectedRoleId}`, payload);
        setMessage({ type: 'success', text: 'Role saved' });
        await fetchRolePermissions(selectedRoleId);
      } else {
        const res = await api.post('/rbac/roles', payload);
        const newRoleId = res.data?.role?.id;
        if (newRoleId) {
          setSelectedRoleValue(String(newRoleId));
        }
        setMessage({ type: 'success', text: 'Role created' });
      }
      await fetchBaseData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Could not save the role. Please try again.' });
    } finally {
      setSaving(false);
    }
  };
  const allowedCount = permissions.filter(p => isPermissionChecked(p.id)).length;
  const checkboxClass = 'w-5 h-5 flex-shrink-0 text-brand-600 rounded border-slate-300 focus:ring-brand-500 focus:ring-2';
  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6 max-w-6xl mx-auto">
      <PageHeader
        eyebrow="Control Panel"
        title="Roles and access"
        subtitle="Choose a role, tick what people with that role can open, then save."
      />
      {message && (
        <Alert tone={message.type} className="mb-4" onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* Step 1: which role */}
      <div className="card mb-4">
        <div className="card-body p-4 sm:p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-3">1. Choose a role</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Role" htmlFor="rp-role">
              <select
                id="rp-role"
                value={selectedRoleValue}
                onChange={event => handleRoleChange(event.target.value)}
                className="input w-full h-11"
              >
                {roles.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
                <option value={NEW_ROLE_VALUE}>+ Add a new role</option>
              </select>
            </Field>
            <Field
              label="Role name"
              htmlFor="rp-name"
              required
              hint={selectedRole?.is_system ? 'Built-in role. The name cannot be changed.' : undefined}
            >
              <input
                id="rp-name"
                value={roleForm.name}
                onChange={event => setRoleForm(form => ({ ...form, name: event.target.value }))}
                disabled={Boolean(selectedRole?.is_system)}
                placeholder="For example: Cashier"
                className="input w-full h-11"
              />
            </Field>
            <Field label="Name shown to people (optional)" htmlFor="rp-desc">
              <input
                id="rp-desc"
                value={roleForm.description}
                onChange={event => setRoleForm(form => ({ ...form, description: event.target.value }))}
                placeholder="For example: Fee counter staff"
                className="input w-full h-11"
              />
            </Field>
          </div>
          <label className="mt-4 inline-flex items-center gap-3 min-h-[44px] text-sm text-slate-800 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={roleForm.is_active}
              onChange={event => setRoleForm(form => ({ ...form, is_active: event.target.checked }))}
              disabled={selectedRole?.name === 'SuperAdmin'}
              className={checkboxClass}
            />
            Role is turned on (people with this role can sign in)
          </label>
        </div>
      </div>

      {/* Step 2: what this role can open (permission grid) */}
      <div className="card">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">2. What can this role open?</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {allowedCount} of {permissions.length} screens allowed. Tick a section name to allow all screens in it.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => resetMatrix('full')} className="btn-secondary btn-sm min-h-[40px]">
              Tick all
            </button>
            <button type="button" onClick={() => resetMatrix('empty')} className="btn-secondary btn-sm min-h-[40px]">
              Clear all
            </button>
          </div>
        </div>
        <div className="p-3 sm:p-5">
          {loading ? (
            <LoadingState label="Loading screens…" />
          ) : (
            <div className="space-y-5">
              {Object.values(groupedPermissions).map(group => {
                const groupAllowed = group.rows.filter(p => isPermissionChecked(p.id)).length;
                return (
                  <section key={group.dashboard} className="rounded-xl border border-slate-200">
                    <label className="flex items-center gap-3 min-h-[48px] px-3 sm:px-4 bg-slate-50 rounded-t-xl border-b border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        className={checkboxClass}
                        checked={isGroupChecked(group.rows)}
                        onChange={(e) => toggleGroup(group.rows, e.target.checked)}
                      />
                      <span className="flex-1 min-w-0 text-[15px] font-semibold text-slate-900">{group.dashboard}</span>
                      <span className="text-xs text-slate-500 whitespace-nowrap">{groupAllowed} of {group.rows.length}</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-2 p-1.5 sm:p-2">
                      {group.rows.map(permission => (
                        <label
                          key={permission.id}
                          className="flex items-center gap-3 min-h-[44px] px-2 rounded-lg text-sm text-slate-800 cursor-pointer active:bg-slate-100 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            className={checkboxClass}
                            checked={isPermissionChecked(permission.id)}
                            onChange={(e) => togglePermission(permission.id, e.target.checked)}
                          />
                          <span className="leading-snug">{permission.component}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ActionBar note={!roleForm.name.trim() ? 'Type a role name first.' : `${allowedCount} screens allowed for this role.`}>
        <Button onClick={saveRole} loading={saving} size="lg">
          {saving ? 'Saving…' : selectedRoleId ? 'Save role' : 'Create role'}
        </Button>
      </ActionBar>
    </div>
  );
};
export default RolePermissions;
