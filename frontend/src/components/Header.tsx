import React, { useState, useEffect } from 'react';
import { ChevronDownIcon, UserIcon, LogoutIcon, MenuIcon } from './icons';
import { ChevronLeft, ChevronRight, MapPin, Building2, GitBranch, CalendarDays, Check } from 'lucide-react';
import { applyBrandTheme, DEFAULT_BRAND_COLOR } from '../theme';
import { canWrite } from '../utils/permissions';
import { Page } from '../App';
import api from '../api';
import Learnspacelogo1 from '../images/Learnspacelogo1.png';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  toggleSidebar: () => void;
  navigateTo: (page: Page) => void;
  onLogout: () => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
}



const Header: React.FC<HeaderProps> = ({ toggleSidebar, navigateTo, onLogout, goBack, goForward, canGoBack, canGoForward }) => {
  const { user: authUser, switchContext } = useAuth();
  const user = authUser || JSON.parse(localStorage.getItem('user') || '{}');

  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);

  // State for Location → School → Branch cascade
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(localStorage.getItem('currentLocation') || 'All');
  const [selectedSchool, setSelectedSchool] = useState(localStorage.getItem('currentSchool') || 'All');
  const [selectedSchoolId, setSelectedSchoolId] = useState(localStorage.getItem('currentSchoolId') || 'All');
  const [allBranchesData, setAllBranchesData] = useState<any[]>([]);

  // Dynamic Locations State
  const [locationData, setLocationData] = useState<any[]>([]);

  // 1. Set your default academic year here.
  // Next year, simply change this to '2027-2028' and it will automatically update for everyone.
  const DEFAULT_ACADEMIC_YEAR = '2026-2027';

  const [selectedYear, setSelectedYear] = useState(localStorage.getItem('academicYear') || DEFAULT_ACADEMIC_YEAR);
  const [currentBranch, setCurrentBranch] = useState(() => {
    return localStorage.getItem('currentBranch') || user.branch || 'All';
  });

  // Resolve dynamic logo and school info from AuthContext
  const API_BASE = import.meta.env.VITE_API_URL || '';
  const isAllSchools = selectedSchoolId === 'All' || selectedSchool === 'All Schools';
  const allowedSchools = user.allowed_schools || [];

  let rawLogo = user.school_logo || null;

  if (!isAllSchools) {
    const branchWithSchool = allBranchesData?.find(b => String(b.school_id) === selectedSchoolId);
    if (branchWithSchool && branchWithSchool.school_logo) {
      rawLogo = branchWithSchool.school_logo;
    } else if (allowedSchools && allowedSchools.length > 0) {
      const allowedSchool = allowedSchools.find((s: any) => String(s.school_id) === selectedSchoolId);
      if (allowedSchool && (allowedSchool.logo_url || allowedSchool.school_logo)) {
        rawLogo = allowedSchool.logo_url || allowedSchool.school_logo;
      }
    }
  }

  const schoolLogo = (isAllSchools || !rawLogo) ? Learnspacelogo1 : (rawLogo.startsWith('/static') ? rawLogo : (rawLogo.startsWith('/') ? `${API_BASE}${rawLogo}` : rawLogo));
  const schoolName = isAllSchools ? 'LearnSpace' : (selectedSchool !== 'All' ? selectedSchool : (user.school_name || 'LearnSpace'));
  const themeColor = isAllSchools ? DEFAULT_BRAND_COLOR : (user.school_theme || DEFAULT_BRAND_COLOR);

  // Publish the active school's colour to the design system (presentation only)
  useEffect(() => { applyBrandTheme(themeColor); }, [themeColor]);

  // Initialize selected location on mount
  const canManageGlobal = canWrite(user, 'system.franchise.franchise-management');
  const canManageSchool = canManageGlobal || canWrite(user, 'setup.school-setup.setup-school');

  useEffect(() => {
    if (canManageSchool) {
      // Fetch All Branches with metadata
      api.get('/branches').then(res => {
        if (res.data.branches) {
          setAllBranchesData(res.data.branches);
        }
      }).catch(err => console.error("Header branch fetch error:", err));
    }
  }, []); // Run once

  const isSuperAdmin = canManageGlobal;
  const isAdminLevel = canManageSchool;

  // ── School options: derived from allBranchesData for Admin/SuperAdmin, or user's allowed_schools ──
  const schoolOptions: { id: string; name: string }[] = [];
  const seenSchools = new Set<string>();

  if (isAdminLevel && allBranchesData.length > 0) {
    for (const b of allBranchesData) {
      if (selectedLocation !== 'All' && b.location_name !== selectedLocation) {
        continue;
      }
      const key = String(b.school_id);
      if (b.school_id && !seenSchools.has(key)) {
        seenSchools.add(key);
        schoolOptions.push({ id: key, name: b.school_name || 'Unknown School' });
      }
    }
  } else if (allowedSchools.length > 0) {
    for (const s of allowedSchools) {
      const key = String(s.school_id);
      if (!seenSchools.has(key)) {
        seenSchools.add(key);
        schoolOptions.push({ id: key, name: s.school_name });
      }
    }
  }

  // ── Branch options: filtered by location + school ──
  let branchOptions: string[] = [];

  if (isAdminLevel && allBranchesData.length > 0) {
    let filtered = allBranchesData;

    // Filter by location
    if (selectedLocation !== 'All') {
      filtered = filtered.filter(b => b.location_name === selectedLocation);
    }

    // Filter by selected school (for all admin-level roles)
    if (selectedSchoolId !== 'All') {
      filtered = filtered.filter(b => String(b.school_id) === selectedSchoolId);
    }

    branchOptions = ["All Branches", ...filtered.map(b => b.branch_name)];
  } else {
    // Non-admin level users (e.g. Franchise or Branch level users)
    let allowed = user?.allowed_branches || [];

    // Filter by selected school
    if (selectedSchoolId !== 'All') {
      allowed = allowed.filter((b: any) => String(b.school_id) === selectedSchoolId);
    }

    branchOptions = allowed.map((b: any) => b.branch_name);

    if (branchOptions.length === 0 && user?.branch) {
      branchOptions = [user.branch];
    }

    const hasMultiple = branchOptions.length > 1;
    const canViewAll = branchOptions.includes("All") || user?.branch === "All" || user?.allowed_branches?.some((b: any) => b.branch_name === "All");
    if (hasMultiple && !branchOptions.includes("All Branches") && (canViewAll || hasMultiple)) {
      branchOptions = ["All Branches", ...branchOptions.filter((b: string) => b !== 'All' && b !== 'All Branches')];
    }
  }

  const showDropdown = user && (isAdminLevel || branchOptions.length > 1);

  const branchLabel = isAllSchools ? 'All Branches' : (currentBranch !== 'All' ? currentBranch : (user.branch_name || user.branch || ''));

  const handleYearChange = (year: string) => {
    localStorage.setItem('academicYear', year);
    setSelectedYear(year);
    setYearDropdownOpen(false);
    window.location.reload();
  };

  const handleLocationChange = (loc: string) => {
    localStorage.setItem('currentLocation', loc);
    localStorage.setItem('currentSchool', 'All');
    localStorage.setItem('currentSchoolId', 'All');
    localStorage.setItem('currentBranch', 'All');
    setSelectedLocation(loc);
    setSelectedSchool('All');
    setSelectedSchoolId('All');
    setCurrentBranch('All');
    setLocationDropdownOpen(false);
    window.location.reload();
  };

  const handleSchoolChange = async (schoolId: string, schoolName: string) => {
    try {
      const sId = schoolId === 'All' ? null : Number(schoolId);

      let defaultBranchName = 'All';
      let defaultBranchId: string | null = null;

      if (sId !== null) {
        // Find branches for this school
        let schoolBranches: any[] = [];
        if (isAdminLevel && allBranchesData.length > 0) {
          schoolBranches = allBranchesData.filter(b => b.school_id === sId);
          if (selectedLocation !== 'All') {
            schoolBranches = schoolBranches.filter(b => b.location_name === selectedLocation);
          }
        } else {
          schoolBranches = (user.allowed_branches || []).filter((b: any) => b.school_id === sId);
        }

        if (schoolBranches.length > 0) {
          defaultBranchName = schoolBranches[0].branch_name;
          defaultBranchId = String(schoolBranches[0].id || schoolBranches[0].branch_id);
        }
      }

      const bId = defaultBranchId ? Number(defaultBranchId) : null;
      await switchContext(sId, bId);

      localStorage.setItem('currentSchool', schoolName);
      localStorage.setItem('currentSchoolId', schoolId);

      localStorage.setItem('currentBranch', defaultBranchName);
      if (defaultBranchId) {
        localStorage.setItem('currentBranchId', defaultBranchId);
      } else {
        localStorage.removeItem('currentBranchId');
      }

      setSelectedSchool(schoolName);
      setSelectedSchoolId(schoolId);
      setCurrentBranch(defaultBranchName);
      setSchoolDropdownOpen(false);
      window.location.reload();
    } catch (err) {
      console.error("Context school switch failed:", err);
    }
  };

  const handleBranchChange = async (branchName: string) => {
    try {
      const val = branchName === 'All Branches' ? 'All' : branchName;
      let branchId: number | null = null;
      let schoolId: number | null = null;
      let schoolName: string | null = null;

      if (val !== 'All') {
        // Look up branch ID from allowed_branches first
        const allowedFound = user.allowed_branches?.find((b: any) => b.branch_name === branchName);
        if (allowedFound) {
          branchId = allowedFound.branch_id;
          schoolId = allowedFound.school_id;
          const sFound = allowedSchools.find((s: any) => s.school_id === schoolId);
          if (sFound) schoolName = sFound.school_name;
        } else {
          const found = allBranchesData.find(b => b.branch_name === branchName);
          if (found) {
            branchId = found.id || found.branch_id;
            schoolId = found.school_id;
            schoolName = found.school_name;
          }
        }
      }

      await switchContext(null, branchId);
      localStorage.setItem('currentBranch', val);
      if (branchId) {
        localStorage.setItem('currentBranchId', String(branchId));
      } else {
        localStorage.removeItem('currentBranchId');
      }

      if (val === 'All') {
        localStorage.removeItem('currentSchoolId');
        localStorage.removeItem('currentSchool');
        setSelectedSchool('All');
        setSelectedSchoolId('All');
      } else {
        if (schoolId) {
          localStorage.setItem('currentSchoolId', String(schoolId));
        }
        if (schoolName) {
          localStorage.setItem('currentSchool', schoolName);
        }
      }

      setCurrentBranch(val);
      setBranchDropdownOpen(false);
      window.location.reload();
    } catch (err) {
      console.error("Context branch switch failed:", err);
    }
  };

  // Dynamic Academic Years
  const [academicYearOptions, setAcademicYearOptions] = useState<string[]>([]);

  useEffect(() => {
    api.get('/org/academic-years')
      .then(res => {
        const yearsList = res.data.academic_years || [];
        const availableYearNames = yearsList.map((y: any) => y.name);
        setAcademicYearOptions(availableYearNames);

        if (availableYearNames.length === 0) return;

        const currentVersion = localStorage.getItem('academicYearDefaultVersion');
        const storedYear = localStorage.getItem('academicYear');

        let targetYear = storedYear;

        // If version bump happened AND the target default year is actually available in the DB
        if (currentVersion !== DEFAULT_ACADEMIC_YEAR) {
          if (availableYearNames.includes(DEFAULT_ACADEMIC_YEAR)) {
            // Safe to upgrade
            targetYear = DEFAULT_ACADEMIC_YEAR;
            localStorage.setItem('academicYearDefaultVersion', DEFAULT_ACADEMIC_YEAR);
          }
          // If not available in DB, we don't update the version key so it tries again later
        }

        // Ensure the target year is valid
        if (!targetYear || !availableYearNames.includes(targetYear)) {
          targetYear = availableYearNames.includes(DEFAULT_ACADEMIC_YEAR)
            ? DEFAULT_ACADEMIC_YEAR
            : availableYearNames[0];
        }

        if (targetYear !== storedYear) {
          localStorage.setItem('academicYear', targetYear as string);
          setSelectedYear(targetYear as string);
        } else if (storedYear) {
          setSelectedYear(storedYear);
        }
      })
      .catch(err => console.error("Failed to load academic years in Header", err));
  }, []);

  const years = academicYearOptions.length > 0 ? academicYearOptions : [];

  // Dynamic Locations
  const [locationList, setLocationList] = useState<string[]>(['All']);

  useEffect(() => {
    if (canManageGlobal) {
      api.get('/org/locations')
        .then(res => {
          const locs = res.data.locations || [];
          setLocationData(locs);
          const names = locs.map((l: any) => l.name);
          setLocationList(['All', ...names]);
        })
        .catch(err => console.error("Failed to load locations in Header", err));
    }
  }, [user.role]);

  useEffect(() => {
    if (isAdminLevel && allBranchesData.length > 0) {
      const branchLocations = Array.from(new Set(
        allBranchesData
          .map(b => b.location_name)
          .filter(name => name && name !== 'Unknown Location')
      ));

      setLocationList(branchLocations);

      // Auto-set selectedLocation if current value is invalid or 'All'
      const currentLoc = localStorage.getItem('currentLocation');
      if (!currentLoc || currentLoc === 'All' || !branchLocations.includes(currentLoc)) {
        const defaultLoc = branchLocations[0] || 'All';
        localStorage.setItem('currentLocation', defaultLoc);
        setSelectedLocation(defaultLoc);
      }
    }
  }, [allBranchesData, user.role]);

  const displayName: string = JSON.parse(localStorage.getItem('user') || '{}').username || 'User';
  const initials = displayName
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase())
    .join('') || 'U';

  /* ── Presentational helpers ───────────────────────────────────────────── */
  const Chip: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    open: boolean;
    onToggle: () => void;
    onBlur: () => void;
    children: React.ReactNode;
    className?: string;
  }> = ({ icon, label, value, open, onToggle, onBlur, children, className }) => (
    <div className={`relative ${className || ''}`}>
      <button
        onClick={onToggle}
        onBlur={onBlur}
        className={`group flex items-center gap-2 h-9 pl-2.5 pr-2 rounded-lg border text-sm transition-colors text-brand-contrast
          ${open ? 'border-white/40 bg-white/25' : 'border-white/15 bg-white/10 hover:bg-white/20 hover:border-white/30'}`}
      >
        <span className="text-brand-contrast/70 group-hover:text-brand-contrast">{icon}</span>
        <span className="hidden lg:block text-2xs uppercase tracking-wider text-brand-contrast/60 font-semibold">{label}</span>
        <span className="font-medium max-w-[9rem] truncate">{value}</span>
        <ChevronDownIcon className={`w-3.5 h-3.5 text-brand-contrast/70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && children}
    </div>
  );

  const MenuList: React.FC<{ width?: string; children: React.ReactNode }> = ({ width = 'w-52', children }) => (
    <ul className={`menu right-0 ${width} max-h-72 overflow-auto`}>{children}</ul>
  );

  const MenuItem: React.FC<{ active?: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <li>
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); onClick(); }}
        className={`menu-item justify-between ${active ? 'menu-item-active' : ''}`}
      >
        <span className="truncate">{children}</span>
        {active && <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />}
      </a>
    </li>
  );

  return (
    <header className="sticky top-0 z-40 h-[60px] flex-shrink-0 bg-gradient-to-r from-brand-700 via-brand-600 to-brand-600 text-brand-contrast shadow-md shadow-brand-900/10">
      {/* Decorative highlight */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 right-1/3 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-20 right-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-px bg-white/15" />

      <nav className="h-full px-3 sm:px-5">
        <div className="flex items-center justify-between h-full gap-3">
          {/* Left: menu, history, school identity */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={toggleSidebar}
              className="btn-icon md:hidden text-brand-contrast/80 hover:bg-white/15 hover:text-brand-contrast"
              aria-label="Toggle navigation"
            >
              <MenuIcon className="w-5 h-5" />
            </button>

            <div className="hidden sm:flex items-center gap-0.5 mr-1">
              <button onClick={goBack} disabled={!canGoBack} className="btn-icon h-8 w-8 disabled:opacity-40 text-brand-contrast/80 hover:bg-white/15 hover:text-brand-contrast" title="Back" aria-label="Back">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={goForward} disabled={!canGoForward} className="btn-icon h-8 w-8 disabled:opacity-40 text-brand-contrast/80 hover:bg-white/15 hover:text-brand-contrast" title="Forward" aria-label="Forward">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <a
              href="#"
              onClick={() => navigateTo('dashboard')}
              className="flex items-center gap-2.5 min-w-0 rounded-lg px-1.5 py-1 hover:bg-white/10"
            >
              <img
                src={schoolLogo}
                alt={schoolName}
                className="h-9 w-auto max-w-[110px] object-contain rounded-md bg-white/95 px-1.5 py-0.5 shadow-sm"
                onError={(e) => { (e.target as HTMLImageElement).src = Learnspacelogo1; }}
              />
              <div className="hidden md:block leading-tight min-w-0">
                <p className="font-semibold text-sm text-brand-contrast truncate">{schoolName}</p>
                {branchLabel && (
                  <p className="text-xs text-brand-contrast/70 truncate">{branchLabel}</p>
                )}
              </div>
            </a>
          </div>

          {/* Right: context selectors + profile */}
          <div className="flex items-center gap-2">

            {/* Location Dropdown (Admin / SuperAdmin Only) */}
            {canManageSchool && locationList.length > 1 && (
              <Chip
                icon={<MapPin className="w-4 h-4" />}
                label="Location"
                value={selectedLocation === 'All' ? 'All Locations' : selectedLocation}
                open={locationDropdownOpen}
                onToggle={() => setLocationDropdownOpen(!locationDropdownOpen)}
                onBlur={() => setTimeout(() => setLocationDropdownOpen(false), 200)}
                className="hidden sm:block"
              >
                <MenuList>
                  {locationList.map(loc => (
                    <MenuItem key={loc} active={selectedLocation === loc} onClick={() => handleLocationChange(loc)}>
                      {loc === 'All' ? 'All Locations' : loc}
                    </MenuItem>
                  ))}
                </MenuList>
              </Chip>
            )}

            {/* School Dropdown */}
            {(isSuperAdmin || schoolOptions.length > 1) && (
              <Chip
                icon={<Building2 className="w-4 h-4" />}
                label="School"
                value={selectedSchool === 'All' ? 'All Schools' : selectedSchool}
                open={schoolDropdownOpen}
                onToggle={() => setSchoolDropdownOpen(!schoolDropdownOpen)}
                onBlur={() => setTimeout(() => setSchoolDropdownOpen(false), 200)}
                className="hidden sm:block"
              >
                <MenuList width="w-60">
                  {(isSuperAdmin || schoolOptions.length > 1) && (
                    <MenuItem active={selectedSchoolId === 'All'} onClick={() => handleSchoolChange('All', 'All')}>
                      All Schools
                    </MenuItem>
                  )}
                  {schoolOptions.map(s => (
                    <MenuItem key={s.id} active={selectedSchoolId === s.id} onClick={() => handleSchoolChange(s.id, s.name)}>
                      {s.name}
                    </MenuItem>
                  ))}
                </MenuList>
              </Chip>
            )}

            {/* Branch Dropdown */}
            {showDropdown ? (
              <Chip
                icon={<GitBranch className="w-4 h-4" />}
                label="Branch"
                value={currentBranch === 'All' ? 'All Branches' : currentBranch}
                open={branchDropdownOpen}
                onToggle={() => setBranchDropdownOpen(!branchDropdownOpen)}
                onBlur={() => setTimeout(() => setBranchDropdownOpen(false), 200)}
              >
                <MenuList>
                  {branchOptions.map((branch: string) => (
                    <MenuItem
                      key={branch}
                      active={currentBranch === (branch === 'All Branches' ? 'All' : branch)}
                      onClick={() => handleBranchChange(branch === 'All Branches' ? 'All' : branch)}
                    >
                      {branch}
                    </MenuItem>
                  ))}
                </MenuList>
              </Chip>
            ) : (
              // Single Branch Display
              <div className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg border border-white/15 bg-white/10 text-sm text-brand-contrast">
                <GitBranch className="w-4 h-4 text-brand-contrast/70" />
                <span className="font-medium">{currentBranch === 'All' ? 'All Branches' : currentBranch}</span>
              </div>
            )}

            {/* Year Dropdown */}
            <Chip
              icon={<CalendarDays className="w-4 h-4" />}
              label="Session"
              value={selectedYear}
              open={yearDropdownOpen}
              onToggle={() => setYearDropdownOpen(!yearDropdownOpen)}
              onBlur={() => setTimeout(() => setYearDropdownOpen(false), 150)}
            >
              <MenuList width="w-44">
                {years.map(year => (
                  <MenuItem key={year} active={selectedYear === year} onClick={() => handleYearChange(year)}>
                    {year}
                  </MenuItem>
                ))}
              </MenuList>
            </Chip>

            <div className="hidden sm:block h-6 w-px bg-white/20 mx-1" />

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                onBlur={() => setTimeout(() => setProfileDropdownOpen(false), 150)}
                className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-lg hover:bg-white/10 focus:outline-none"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-brand-700 text-xs font-bold ring-2 ring-white/40 shadow-sm">
                  {initials}
                </span>
                <span className="hidden md:block text-left leading-tight">
                  <span className="block text-sm font-medium text-brand-contrast max-w-[8rem] truncate">{displayName}</span>
                  {user?.role && <span className="block text-2xs text-brand-contrast/70">{user.role}</span>}
                </span>
                <ChevronDownIcon className={`w-3.5 h-3.5 text-brand-contrast/70 transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {profileDropdownOpen && (
                <ul className="menu right-0 w-52">
                  <li className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.role || 'User'}</p>
                  </li>
                  <li>
                    <a href="#" onClick={(e) => { e.preventDefault(); navigateTo('profile'); setProfileDropdownOpen(false); }} className="menu-item">
                      <UserIcon className="w-4 h-4 text-slate-400" /> Profile
                    </a>
                  </li>
                  <li>
                    <button onClick={onLogout} className="menu-item text-red-600 hover:text-red-700 hover:bg-red-50 focus:outline-none">
                      <LogoutIcon className="w-4 h-4" /> Logout
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
