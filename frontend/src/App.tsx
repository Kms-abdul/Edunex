import React, { Suspense, lazy } from "react";
import Login from "./components/Login";
import { LoadingState } from "./components/ui/States";

// The signed-in shell is code-split so the login screen loads fast.
const Dashboard = lazy(() => import("./components/Dashboard"));
import { AuthProvider, useAuth } from "./contexts/AuthContext";

export type Page =
  | "dashboard"
  | "profile"
  | "fee"
  | "fee-type"
  | "class-fee-structure"
  | "assign-special-fee"
  | "fee-installments"
  | "take-fee"
  | "administration"
  | "academic"
  | "academics"
  | "timetable"
  | "online-class"
  | "setup"
  | "classes-management"
  | "student-attendance"
  | "student-administration"
  | "concession-master"
  | "student-concession"
  | "update-student-fee-structure"
  | "update-rebate-date"
  | "delete-fee-receipt"
  | "staffsupport"
  | "create-student"
  | "import-student-data"
  | "fee-reports"
  | "attendance-report"
  | "configuration"
  | "document-administration"
  | "student-document-management"
  | "document-management"
  | "user-management"
  | "role-permissions"
  | "franchise-management"
  | "school-management"
  | "control-panel"
  | "petty-cash"
  | "petty-cash-report"
  | "deleted-receipts"
  | "fee-concession-report"
  | "adjust-fee-report"
  | 'sms-center'
  | 'fund-allocation'
  | 'month-wise-ledger'
  | 'petty-cash-approval'
  | 'hr-management'
  | 'hr-departments'
  | 'hr-designations'
  | 'hr-shifts'
  | 'hr-staff-master'
  | 'hr-staff-categories'
  | 'hr-staff-statuses'
  | 'hr-staff-document-types'
  | 'hr-biometric-devices'
  | 'hr-biometric-mapping'
  | 'hr-attendance-summary'
  | 'hr-punch-log'
  | 'hr-staff-directory'
  | 'hr-staff-profile-list'
  | 'hr-staff-update-list'
  | 'staff-profile'
  | 'reconciliation-dashboard'
  | 'remittance-approvals'
  | 'remittance-deposit';

// Inner component that can access AuthContext
const AppInner: React.FC = () => {
  const { isAuthenticated, user, setUser, clearUser } = useAuth();
  // Determine the default landing page
  const defaultPage: Page = ['SuperAdmin', 'Admin', 'HR'].includes(user?.role || '') ? 'dashboard' : 'staff-profile';

  const handleLoginSuccess = (user: any) => {
    setUser(user);
  };

  const handleLogout = () => {
    clearUser();
  };

  return (
    <>
      {isAuthenticated ? (
        <Suspense fallback={<LoadingState label="Loading…" className="min-h-screen" />}>
          <Dashboard onLogout={handleLogout} initialPage={defaultPage} />
        </Suspense>
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
};

export default App;
