import React, { Suspense, lazy, useEffect, useState } from 'react';
import { LoadingState } from './ui/States';
import Header from './Header';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import BottomNav from './shell/BottomNav';
import FinancialLayout from './FinancialLayout';
import HRLayout from './HRLayout';
import { useNavigationHistory } from '../hooks/useNavigationHistory';
import { Page } from '../App';
import { setIntent } from '../utils/intent';

// Pages are code-split: each module downloads only when it is first opened.
const Profile = lazy(() => import('./Profile'));
const Fee = lazy(() => import('./Fee'));
const FeeType = lazy(() => import('./FeeType'));
const ClassFeeStructure = lazy(() => import('./ClassFeeStructure'));
const AssignSpecialFee = lazy(() => import('./AssignSpecialFee'));
const FeeInstallments = lazy(() => import('./FeeInstallments'));
const TakeFee = lazy(() => import('./TakeFee'));
const Administration = lazy(() => import('./Administration'));
const SetupSchool = lazy(() => import('./SetupSchool'));
const ClassesManagement = lazy(() => import('./ClassesManagement'));
const AcademicManagement = lazy(() => import('./AcademicManagement'));
const Academics = lazy(() => import('./Academics'));
const Timetable = lazy(() => import('./Timetable'));
const OnlineClass = lazy(() => import('./OnlineClass'));
const StudentAttendance = lazy(() => import('./StudentAttendance'));
const StudentAdministration = lazy(() => import('./StudentAdministration'));
const ConcessionMaster = lazy(() => import('./ConcessionMaster'));
const StudentConcession = lazy(() => import('./StudentConcession'));
const UpdateStudentFeeStructure = lazy(() => import('./UpdateStudentFeeStructure'));
const UpdateRebateDate = lazy(() => import('./UpdateRebateDate'));
const DeleteFeeReceipt = lazy(() => import('./DeleteFeeReceipt'));
const FeeReports = lazy(() => import('./FeeReports'));
const DeletedReceiptsReport = lazy(() => import('./DeletedReceiptsReport'));
const FeeConcessionReport = lazy(() => import('./FeeConcessionReport'));
const AdjustFeeReport = lazy(() => import('./AdjustFeeReport'));
const Configuration = lazy(() => import('./Configuration'));
const DocumentManagement = lazy(() => import('./DocumentManagement'));
const UserManagement = lazy(() => import('./UserManagement'));
const FranchiseManagement = lazy(() => import('./FranchiseManagement'));
const RolePermissions = lazy(() => import('./RolePermissions'));
const ControlPanel = lazy(() => import('./ControlPanel'));
const SchoolManagement = lazy(() => import('./SchoolManagement'));
const HRAttendanceSummary = lazy(() => import('./HRAttendanceSummary'));
const StaffSupport = lazy(() => import('./StaffSupport'));
const PettyCash = lazy(() => import('./PettyCash'));
const PettyCashReport = lazy(() => import('./PettyCashReport'));
const FundAllocation = lazy(() => import('./FundAllocation'));
const MonthWiseLedger = lazy(() => import('./MonthWiseLedger'));
const PettyCashApproval = lazy(() => import('./PettyCashApproval'));
const SmsCenter = lazy(() => import('./SmsCenter'));
const HRManagement = lazy(() => import('./HRManagement'));
const ReconciliationDashboard = lazy(() => import('./ReconciliationDashboard'));
const RemittanceApprovals = lazy(() => import('./RemittanceApprovals'));
const RemittanceDeposit = lazy(() => import('./RemittanceDeposit'));
const DepartmentMaster = lazy(() => import('./DepartmentMaster'));
const DesignationMaster = lazy(() => import('./DesignationMaster'));
const ShiftMaster = lazy(() => import('./ShiftMaster'));
const StaffMaster = lazy(() => import('./StaffMaster'));
const StaffDirectory = lazy(() => import('./StaffDirectory'));
const StaffCategoryMaster = lazy(() => import('./StaffCategoryMaster').then(m => ({ default: m.StaffCategoryMaster })));
const StaffStatusMaster = lazy(() => import('./StaffStatusMaster').then(m => ({ default: m.StaffStatusMaster })));
const StaffDocumentTypeMaster = lazy(() => import('./hr/StaffDocumentTypeMaster').then(m => ({ default: m.StaffDocumentTypeMaster })));
const StaffProfile = lazy(() => import('./StaffProfile'));
const BiometricDevices = lazy(() => import('./BiometricDevices').then(m => ({ default: m.BiometricDevices })));
const HRPunchLog = lazy(() => import('./HRPunchLog'));

const hrPages = [
  'hr-management', 'hr-departments', 'hr-designations', 'hr-shifts', 'hr-staff-master', 'hr-staff-directory',
  'hr-staff-categories', 'hr-staff-statuses', 'hr-staff-document-types',
  'hr-biometric-devices', 'hr-biometric-mapping', 'hr-attendance-summary', 'hr-punch-log',
  'hr-staff-profile-list', 'hr-staff-update-list', 'staff-profile'
];

const financialPages = [
  'fee', 'fee-type', 'class-fee-structure', 'assign-special-fee',
  'fee-installments', 'take-fee', 'concession-master', 'student-concession',
  'update-student-fee-structure', 'update-rebate-date', 'delete-fee-receipt', 'fee-reports',
  'deleted-receipts', 'fee-concession-report', 'adjust-fee-report',
  'petty-cash', 'petty-cash-report', 'fund-allocation', 'month-wise-ledger', 'petty-cash-approval',
  'reconciliation-dashboard', 'remittance-approvals', 'remittance-deposit'
];

interface DashboardProps {
  onLogout: () => void;
  initialPage?: Page;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout, initialPage }) => {
  // Sidebar starts open on desktop and collapsed on small screens (presentation only)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 768));
  const {
    currentPage,
    navigateTo,
    goBack,
    goForward,
    canGoBack,
    canGoForward
  } = useNavigationHistory(initialPage || 'dashboard');

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Old page names that never had their own screen: send people to where that job lives now
  useEffect(() => {
    const moved: Partial<Record<Page, [Page, string?]>> = {
      'create-student': ['student-administration', 'addStudent'],
      'import-student-data': ['student-administration', 'import'],
      'attendance-report': ['student-attendance', 'absent-report'],
      'document-administration': ['document-management'],
      'student-document-management': ['document-management'],
    };
    const target = moved[currentPage];
    if (target) {
      if (target[1]) setIntent(target[0], target[1]);
      window.location.replace(`#${target[0]}`);
    }
  }, [currentPage]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-muted">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} navigateTo={navigateTo} currentPage={currentPage} />
      <div className="flex flex-col flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        <Header
          toggleSidebar={toggleSidebar}
          navigateTo={navigateTo}
          onLogout={onLogout}
          goBack={goBack}
          goForward={goForward}
          canGoBack={canGoBack}
          canGoForward={canGoForward}
        />
        {/* Bottom padding leaves room for the phone tab bar */}
        <main className="flex-1 min-h-0 pb-24 md:pb-0">
          <Suspense fallback={<LoadingState label="Loading page…" className="py-24" />}>
          {currentPage === 'dashboard' && <MainContent navigateTo={navigateTo} />}
          {currentPage === 'profile' && <Profile />}
          {financialPages.includes(currentPage) ? (
            <FinancialLayout currentPage={currentPage} navigateTo={navigateTo}>
              <Suspense fallback={<LoadingState label="Loading page…" className="py-24" />}>
              {currentPage === 'fee' && <Fee navigateTo={navigateTo} />}
              {currentPage === 'fee-type' && <FeeType />}
              {currentPage === 'class-fee-structure' && <ClassFeeStructure />}
              {currentPage === 'assign-special-fee' && <AssignSpecialFee navigateTo={navigateTo} />}
              {currentPage === 'fee-installments' && <FeeInstallments />}
              {currentPage === 'take-fee' && <TakeFee navigateTo={navigateTo} />}
              {currentPage === 'concession-master' && <ConcessionMaster />}
              {currentPage === 'student-concession' && <StudentConcession />}
              {currentPage === 'update-student-fee-structure' && <UpdateStudentFeeStructure />}
              {currentPage === 'update-rebate-date' && <UpdateRebateDate />}
              {currentPage === 'delete-fee-receipt' && <DeleteFeeReceipt />}
              {currentPage === 'fee-reports' && <FeeReports />}
              {currentPage === 'deleted-receipts' && <DeletedReceiptsReport />}
              {currentPage === 'fee-concession-report' && <FeeConcessionReport />}
              {currentPage === 'adjust-fee-report' && <AdjustFeeReport />}
              {currentPage === 'petty-cash' && <PettyCash />}
              {currentPage === 'petty-cash-report' && <PettyCashReport />}
              {currentPage === 'fund-allocation' && <FundAllocation />}
              {currentPage === 'month-wise-ledger' && <MonthWiseLedger />}
              {currentPage === 'petty-cash-approval' && <PettyCashApproval />}
              {currentPage === 'reconciliation-dashboard' && <ReconciliationDashboard />}
              {currentPage === 'remittance-approvals' && <RemittanceApprovals />}
              {currentPage === 'remittance-deposit' && <RemittanceDeposit />}
              </Suspense>
            </FinancialLayout>
          ) : hrPages.includes(currentPage) ? (
            <HRLayout currentPage={currentPage} navigateTo={navigateTo}>
              <Suspense fallback={<LoadingState label="Loading page…" className="py-24" />}>
              {currentPage === 'hr-management' && <HRManagement navigateTo={navigateTo} />}
              {currentPage === 'hr-departments' && <DepartmentMaster />}
              {currentPage === 'hr-designations' && <DesignationMaster />}
              {currentPage === 'hr-shifts' && <ShiftMaster />}
              {currentPage === 'hr-staff-master' && <StaffMaster mode="master" />}
              {currentPage === 'hr-staff-profile-list' && <StaffMaster mode="profile" />}
              {currentPage === 'hr-staff-update-list' && <StaffMaster mode="update" />}
              {currentPage === 'hr-staff-directory' && <StaffDirectory />}
              {currentPage === 'hr-staff-categories' && <StaffCategoryMaster />}
              {currentPage === 'hr-staff-statuses' && <StaffStatusMaster />}
              {currentPage === 'hr-staff-document-types' && <StaffDocumentTypeMaster />}
              {currentPage === 'hr-biometric-devices' && <BiometricDevices />}
              {currentPage === 'hr-biometric-mapping' && <div className="card p-10 text-center text-slate-500">Staff Biometric Mapping (Coming Soon)</div>}
              {currentPage === 'hr-attendance-summary' && <HRAttendanceSummary />}
              {currentPage === 'hr-punch-log' && <HRPunchLog />}
              {currentPage === 'staff-profile' && <StaffProfile navigateTo={navigateTo} />}
              </Suspense>
            </HRLayout>
          ) : (
            <>
              {currentPage === 'administration' && <Administration navigateTo={navigateTo} />}
              {currentPage === 'academic' && <AcademicManagement navigateTo={navigateTo} />}
              {currentPage === 'academics' && <Academics />}
              {currentPage === 'timetable' && <Timetable />}
              {currentPage === 'online-class' && <OnlineClass />}
              {currentPage === 'setup' && <SetupSchool navigateTo={navigateTo} />}
              {currentPage === 'classes-management' && <ClassesManagement navigateTo={navigateTo} />}
              {currentPage === 'student-attendance' && <StudentAttendance navigateTo={navigateTo} />}
              {currentPage === 'student-administration' && <StudentAdministration navigateTo={navigateTo} />}
              {currentPage === 'configuration' && <Configuration navigateTo={navigateTo} />}
              {currentPage === 'document-management' && <DocumentManagement />}
              {currentPage === 'user-management' && <UserManagement />}
              {currentPage === 'role-permissions' && <RolePermissions />}
              {currentPage === 'franchise-management' && <FranchiseManagement />}
              {currentPage === 'school-management' && <SchoolManagement />}
              {currentPage === 'control-panel' && <ControlPanel navigateTo={navigateTo} />}
              {currentPage === 'staffsupport' && <StaffSupport />}
              {currentPage === 'sms-center' && <SmsCenter navigateTo={navigateTo} />}
            </>
          )}

          </Suspense>
        </main>
      </div>
      <BottomNav currentPage={currentPage} navigateTo={navigateTo} openMenu={() => setIsSidebarOpen(true)} />
    </div>
  );
};

export default Dashboard;
