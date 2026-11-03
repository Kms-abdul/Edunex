import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, Alert, Field, Button } from './ui';

const Profile: React.FC = () => {
    // Username State
    const [username, setUsername] = useState('');
    const [originalUsername, setOriginalUsername] = useState('');
    const [usernameLoading, setUsernameLoading] = useState(false);
    const [usernameStatus, setUsernameStatus] = useState<{ type: 'success' | 'error' | '', msg: string }>({ type: '', msg: '' });

    // Password State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error' | '', msg: string }>({ type: '', msg: '' });

    // Add User State
    const [newUserUsername, setNewUserUsername] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserRole, setNewUserRole] = useState('User');
    const [newUserLocation, setNewUserLocation] = useState('');

    // Multi-Branch State
    const [availableBranches, setAvailableBranches] = useState<any[]>([]);
    const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
    const [locationData, setLocationData] = useState<any[]>([]);

    const [addUserStatus, setAddUserStatus] = useState<{ type: 'success' | 'error' | '', msg: string }>({ type: '', msg: '' });
    const [addUserLoading, setAddUserLoading] = useState(false);
    const [isBranchLocked, setIsBranchLocked] = useState(false);

    const { hasPermission } = useAuth();
    const canManageUsers = hasPermission('system.users.user-management', 'write');

    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const globalBranch = localStorage.getItem('currentBranch');

        // Set current user data
        if (user) {
            setUsername(user.username || '');
            setOriginalUsername(user.username || '');
        }

        // Fetch Branches & Locations
        const fetchData = async () => {
            try {
                const [branchRes, locRes] = await Promise.all([
                    api.get('/branches'),
                    api.get('/org/locations')
                ]);
                setAvailableBranches(branchRes.data.branches || []);
                setLocationData(locRes.data.locations || []);
            } catch (err) {
                console.error("Failed to fetch branches/locations", err);
            }
        };
        fetchData();

        // Fetch current user profile from API
        const fetchUserProfile = async () => {
            try {
                const response = await api.get('/users/profile');
                const userData = response.data.user || response.data;
                setUsername(userData.username || '');
                setOriginalUsername(userData.username || '');
            } catch (err) {
                console.error("Failed to fetch user profile", err);
            }
        };
        fetchUserProfile();

        // Branch locking logic
        if (canManageUsers) {
            if (globalBranch && globalBranch !== 'All') {
                setSelectedBranches([globalBranch]);
            } else {
                setIsBranchLocked(false);
            }
        } else {
            if (user.branch) {
                setSelectedBranches([user.branch]);
                setIsBranchLocked(true);
            }
        }
    }, []);

    // Auto-update location when specific branch is selected
    useEffect(() => {
        if (selectedBranches.includes('All')) {
            setNewUserLocation('All');
            return;
        }

        if (selectedBranches.length === 1 && locationData.length > 0) {
            const b = availableBranches.find(br =>
                br.branch_code?.toLowerCase() === selectedBranches[0].toLowerCase() ||
                br.branch_name?.toLowerCase() === selectedBranches[0].toLowerCase()
            );

            if (b) {
                const code = (b.location_code || '').toUpperCase();
                const matchedLoc = locationData.find((l: any) => l.code?.toUpperCase() === code);
                if (matchedLoc) {
                    setNewUserLocation(matchedLoc.name);
                }
            }
        } else if (selectedBranches.length === 0) {
            setNewUserLocation('');
        } else if (selectedBranches.length > 1) {
            setNewUserLocation('Multiple');
        }
    }, [selectedBranches, availableBranches, locationData]);

    // ==================== USERNAME HANDLERS ====================
    const handleSaveUsername = async () => {
        if (!username.trim()) {
            setUsernameStatus({ type: 'error', msg: 'Username cannot be empty' });
            return;
        }

        if (username.trim() === originalUsername) {
            setUsernameStatus({ type: 'error', msg: 'Username has not changed' });
            return;
        }

        setUsernameLoading(true);
        setUsernameStatus({ type: '', msg: '' });

        try {
            await api.put('/users/update-username', {
                username: username.trim()
            });

            // Update localStorage with new username
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            user.username = username.trim();
            localStorage.setItem('user', JSON.stringify(user));

            setOriginalUsername(username.trim());
            setUsernameStatus({ type: 'success', msg: 'Username saved.' });

        } catch (error: any) {
            const errMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to update username';
            setUsernameStatus({ type: 'error', msg: errMsg });
        } finally {
            setUsernameLoading(false);
        }
    };

    const handleCancelUsername = () => {
        setUsername(originalUsername);
        setUsernameStatus({ type: '', msg: '' });
    };

    // ==================== PASSWORD HANDLERS ====================
    const handleSavePassword = async () => {
        if (!currentPassword) {
            setPasswordStatus({ type: 'error', msg: 'Type your current password first.' });
            return;
        }

        if (!newPassword) {
            setPasswordStatus({ type: 'error', msg: 'Type a new password.' });
            return;
        }

        if (newPassword.length < 8) {
            setPasswordStatus({ type: 'error', msg: 'The password needs at least 8 characters.' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordStatus({ type: 'error', msg: 'The two new passwords are not the same. Type them again.' });
            return;
        }

        setPasswordLoading(true);
        setPasswordStatus({ type: '', msg: '' });

        try {
            await api.put('/users/update-password', {
                currentPassword,
                newPassword: newPassword
            });

            setPasswordStatus({ type: 'success', msg: 'Password changed. Use the new password next time you sign in.' });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

        } catch (error: any) {
            const errMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to update password';
            setPasswordStatus({ type: 'error', msg: errMsg });
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleCancelPassword = () => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordStatus({ type: '', msg: '' });
    };

    // ==================== BRANCH TOGGLE HANDLER ====================
    const handleBranchToggle = (branchCode: string) => {
        if (isBranchLocked) return;

        if (branchCode === 'All') {
            if (selectedBranches.includes('All')) {
                setSelectedBranches([]);
            } else {
                setSelectedBranches(['All']);
            }
            return;
        }

        let newSelection = selectedBranches.filter(b => b !== 'All');
        if (selectedBranches.includes(branchCode)) {
            newSelection = newSelection.filter(b => b !== branchCode);
        } else {
            newSelection.push(branchCode);
        }
        setSelectedBranches(newSelection);
    };

    // ==================== ADD USER HANDLER ====================
    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddUserStatus({ type: '', msg: '' });

        // Validation
        if (!newUserUsername.trim()) {
            setAddUserStatus({ type: 'error', msg: 'Type a username first.' });
            return;
        }

        if (!newUserPassword) {
            setAddUserStatus({ type: 'error', msg: 'Type a password first.' });
            return;
        }

        if (newUserPassword.length < 8) {
            setAddUserStatus({ type: 'error', msg: 'The password needs at least 8 characters.' });
            return;
        }

        if (!newUserEmail.trim()) {
            setAddUserStatus({ type: 'error', msg: 'Type an email address first.' });
            return;
        }

        if (selectedBranches.length === 0) {
            setAddUserStatus({ type: 'error', msg: 'Tick at least one branch.' });
            return;
        }

        setAddUserLoading(true);

        const payload = {
            username: newUserUsername.trim(),
            password: newUserPassword,
            useremail: newUserEmail.trim(),
            branches: selectedBranches,
            branch: selectedBranches[0] || 'North',
            location: newUserLocation,
            role: newUserRole
        };

        console.log("Creating user with payload:", payload);

        try {
            await api.post('/users/add', payload);
            setAddUserStatus({ type: 'success', msg: 'User created. They can now sign in.' });

            // Reset form
            setNewUserUsername('');
            setNewUserPassword('');
            setNewUserEmail('');
            setSelectedBranches([]);
            setNewUserRole('User');
            setNewUserLocation('');

        } catch (error: any) {
            const errMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to create user';
            setAddUserStatus({ type: 'error', msg: errMsg });
        } finally {
            setAddUserLoading(false);
        }
    };

    const handleResetAddUserForm = () => {
        setNewUserUsername('');
        setNewUserPassword('');
        setNewUserEmail('');
        setSelectedBranches([]);
        setNewUserRole('User');
        setNewUserLocation('');
        setAddUserStatus({ type: '', msg: '' });
    };

    const [showAddUser, setShowAddUser] = useState(false);

    const passwordNote = !currentPassword ? 'Type your current password first.'
        : !newPassword ? 'Type a new password.'
        : newPassword.length < 8 ? 'New password needs at least 8 characters.'
        : newPassword !== confirmPassword ? 'Type the new password again so both match.'
        : '';

    const sectionTitle = 'text-base font-semibold text-slate-900';

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
            <PageHeader
                eyebrow="My account"
                title="Username and password"
                subtitle="See your username and change your password."
            />

            {/* ==================== USERNAME (read only) ==================== */}
            <form onSubmit={(e) => e.preventDefault()} className="card">
                <div className="card-body p-4 sm:p-5 space-y-4">
                    <h2 className={sectionTitle}>Your username</h2>

                    {usernameStatus.msg && (
                        <Alert tone={usernameStatus.type === 'success' ? 'success' : 'error'}>
                            {usernameStatus.msg}
                        </Alert>
                    )}

                    <Field label="Username" htmlFor="txtuserName" hint="This is the name you type to sign in. Ask your admin if it needs to change.">
                        <input
                            type="text"
                            id="txtuserName"
                            name="txtuserName"
                            maxLength={100}
                            value={username}
                            disabled={true}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                setUsernameStatus({ type: '', msg: '' });
                            }}
                            autoComplete="username"
                            className="input h-11"
                        />
                    </Field>

                    {username !== originalUsername && (
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button onClick={handleSaveUsername} loading={usernameLoading} disabled={username === originalUsername}>
                                Save username
                            </Button>
                            <Button variant="secondary" onClick={handleCancelUsername} disabled={usernameLoading}>
                                Cancel
                            </Button>
                        </div>
                    )}
                </div>
            </form>

            {/* ==================== CHANGE PASSWORD ==================== */}
            <form onSubmit={(e) => { e.preventDefault(); if (!passwordNote) handleSavePassword(); }} className="card">
                <div className="card-body p-4 sm:p-5 space-y-4">
                    <div>
                        <h2 className={sectionTitle}>Change your password</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Type your current password, then your new password two times.</p>
                    </div>

                    {passwordStatus.msg && (
                        <Alert tone={passwordStatus.type === 'success' ? 'success' : 'error'}>
                            {passwordStatus.msg}
                        </Alert>
                    )}

                    {/* Hidden username helps password managers save the new password */}
                    <input type="text" name="username" value={originalUsername} autoComplete="username" readOnly hidden />

                    <Field label="Current password" htmlFor="txtCurrentPassword" required>
                        <input
                            type="password"
                            id="txtCurrentPassword"
                            name="txtCurrentPassword"
                            maxLength={99}
                            value={currentPassword}
                            onChange={(e) => {
                                setCurrentPassword(e.target.value);
                                setPasswordStatus({ type: '', msg: '' });
                            }}
                            disabled={passwordLoading}
                            placeholder="Your password now"
                            autoComplete="current-password"
                            className="input h-11"
                        />
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="New password" htmlFor="txtNewPassword" required hint="At least 8 characters.">
                            <input
                                type="password"
                                id="txtNewPassword"
                                name="txtNewPassword"
                                maxLength={99}
                                value={newPassword}
                                onChange={(e) => {
                                    setNewPassword(e.target.value);
                                    setPasswordStatus({ type: '', msg: '' });
                                }}
                                disabled={passwordLoading}
                                placeholder="New password"
                                autoComplete="new-password"
                                className="input h-11"
                            />
                        </Field>
                        <Field label="New password again" htmlFor="txtConfirmPassword" required>
                            <input
                                type="password"
                                id="txtConfirmPassword"
                                name="txtConfirmPassword"
                                maxLength={99}
                                value={confirmPassword}
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    setPasswordStatus({ type: '', msg: '' });
                                }}
                                disabled={passwordLoading}
                                placeholder="Same new password"
                                autoComplete="new-password"
                                className="input h-11"
                            />
                        </Field>
                    </div>

                    {(currentPassword || newPassword || confirmPassword) && passwordNote && (
                        <p className="text-sm text-slate-600">{passwordNote}</p>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <Button
                            variant="secondary"
                            onClick={handleCancelPassword}
                            disabled={passwordLoading || (!currentPassword && !newPassword && !confirmPassword)}
                        >
                            Clear
                        </Button>
                        <Button
                            type="submit"
                            size="lg"
                            loading={passwordLoading}
                            disabled={!!passwordNote}
                        >
                            Change password
                        </Button>
                    </div>
                </div>
            </form>

            {/* ==================== ADD USER SECTION (ADMIN ONLY) ==================== */}
            {canManageUsers && (
                <div className="card">
                    <div className="card-body p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className={sectionTitle}>Add a new user</h2>
                                <p className="text-sm text-slate-500 mt-0.5">Give a staff member their own login.</p>
                            </div>
                            {!showAddUser && (
                                <Button variant="secondary" onClick={() => setShowAddUser(true)}>
                                    Add a user
                                </Button>
                            )}
                        </div>

                        {showAddUser && (
                            <form onSubmit={handleAddUser} className="mt-4 space-y-4">
                                {addUserStatus.msg && (
                                    <Alert tone={addUserStatus.type === 'success' ? 'success' : 'error'}>
                                        {addUserStatus.msg}
                                    </Alert>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Username" htmlFor="newUserName" required>
                                        <input
                                            type="text"
                                            id="newUserName"
                                            value={newUserUsername}
                                            onChange={(e) => {
                                                setNewUserUsername(e.target.value);
                                                setAddUserStatus({ type: '', msg: '' });
                                            }}
                                            disabled={addUserLoading}
                                            className="input h-11"
                                            placeholder="Name they will sign in with"
                                            autoComplete="off"
                                            autoCapitalize="none"
                                        />
                                    </Field>

                                    <Field label="Password" htmlFor="newUserPassword" required hint="At least 8 characters.">
                                        <input
                                            type="password"
                                            id="newUserPassword"
                                            value={newUserPassword}
                                            onChange={(e) => {
                                                setNewUserPassword(e.target.value);
                                                setAddUserStatus({ type: '', msg: '' });
                                            }}
                                            disabled={addUserLoading}
                                            className="input h-11"
                                            placeholder="Their first password"
                                            autoComplete="new-password"
                                        />
                                    </Field>

                                    <Field label="Email" htmlFor="newUserEmail" required>
                                        <input
                                            type="email"
                                            inputMode="email"
                                            id="newUserEmail"
                                            value={newUserEmail}
                                            onChange={(e) => {
                                                setNewUserEmail(e.target.value);
                                                setAddUserStatus({ type: '', msg: '' });
                                            }}
                                            disabled={addUserLoading}
                                            className="input h-11"
                                            placeholder="name@school.com"
                                            autoComplete="off"
                                        />
                                    </Field>

                                    <Field label="Role" htmlFor="newUserRole">
                                        <select
                                            id="newUserRole"
                                            value={newUserRole}
                                            onChange={(e) => setNewUserRole(e.target.value)}
                                            disabled={addUserLoading}
                                            className="input h-11"
                                        >
                                            <option value="User">User</option>
                                            <option value="Admin">Admin</option>
                                        </select>
                                    </Field>
                                </div>

                                <Field
                                    label="Branches they can open"
                                    required
                                    hint={`Chosen: ${selectedBranches.length === 0 ? 'none' : selectedBranches.join(', ')}`}
                                >
                                    <div className="rounded-lg border border-slate-200 p-1.5 max-h-60 overflow-y-auto">
                                        <label htmlFor="branch-all" className="flex items-center gap-3 min-h-[44px] px-2 hover:bg-slate-50 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                id="branch-all"
                                                checked={selectedBranches.includes('All')}
                                                onChange={() => handleBranchToggle('All')}
                                                disabled={addUserLoading || isBranchLocked}
                                                className="h-5 w-5 text-brand-600 focus:ring-brand-500 border-slate-300 rounded"
                                            />
                                            <span className="text-sm font-medium text-slate-800">All branches</span>
                                        </label>

                                        <hr className="my-1 border-slate-100" />

                                        {availableBranches.map((b) => (
                                            <label key={b.branch_code} htmlFor={`branch-${b.branch_code}`} className="flex items-center gap-3 min-h-[44px] px-2 hover:bg-slate-50 rounded cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    id={`branch-${b.branch_code}`}
                                                    checked={selectedBranches.includes(b.branch_code)}
                                                    onChange={() => handleBranchToggle(b.branch_code)}
                                                    disabled={addUserLoading || isBranchLocked || selectedBranches.includes('All')}
                                                    className="h-5 w-5 text-brand-600 focus:ring-brand-500 border-slate-300 rounded"
                                                />
                                                <span className="text-sm text-slate-800">{b.branch_name}</span>
                                            </label>
                                        ))}

                                        {availableBranches.length === 0 && (
                                            <p className="text-sm text-slate-500 p-2">No branches yet</p>
                                        )}
                                    </div>
                                </Field>

                                <Field label="Location" htmlFor="newUserLocation" hint="Filled in for you from the branch.">
                                    <input
                                        type="text"
                                        id="newUserLocation"
                                        value={newUserLocation}
                                        onChange={(e) => setNewUserLocation(e.target.value)}
                                        disabled={addUserLoading}
                                        className="input h-11"
                                        placeholder="Filled in from the branch"
                                        readOnly
                                    />
                                </Field>

                                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                    <Button
                                        variant="secondary"
                                        onClick={() => { handleResetAddUserForm(); setShowAddUser(false); }}
                                        disabled={addUserLoading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" size="lg" loading={addUserLoading}>
                                        Create user
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Profile;
