import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  ClassOption,
  TestOption,
  StudentOption,
  ProgressReportData,
  HistoricalPerformance
} from '../reportcardtypes';
import ReportCard from './ReportCard';
import { FileText, Printer } from 'lucide-react';
import { Alert, EmptyState, LoadingState, Spinner, ActionBar, Field } from './ui';
import { SetupIntro } from './exam-setup/shared';

// Import the reusable component

// API_BASE_URL is now handled by the api instance

const StudentReportCard: React.FC = () => {
  // ============== PRINT STYLES ==============
  React.useEffect(() => {
    // Add print-specific styles
    const style = document.createElement('style');
    style.id = 'student-report-print-styles';
    style.textContent = `
  @media print {
    @page {
      margin: 8mm;
      size: A4;
    }

    /* ── 1. Kill the Dashboard layout scrollbar (the culprit) ── */
    .flex.h-screen.overflow-hidden,
    .flex.flex-col.flex-1.overflow-y-auto,
    .flex.flex-col.flex-1.overflow-x-hidden {
      overflow: visible !important;
      height: auto !important;
    }

    /* ── 2. Reset html/body ── */
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      height: auto !important;
      width: 100% !important;
      overflow: visible !important;
      background: white !important;
    }

    /* ── 3. Kill ALL scrollbars from every element ── */
    * {
      scrollbar-width: none !important;
    }
    *::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }

    /* ── 4. Hide UI chrome ── */
    .no-print,
    aside,
    nav,
    header,
    .sidebar {
      display: none !important;
    }

    /* ── 5. Main content area ── */
    main.flex-1 {
      overflow: visible !important;
      height: auto !important;
      padding: 0 !important;
    }

    /* ── 6. Student reports wrapper ── */
    .student-reports-wrapper {
      padding: 0 !important;
      margin: 0 !important;
      overflow: visible !important;
      height: auto !important;
      width: 100% !important;
    }

    /* ── 7. Report card container ── */
    .report-card-container {
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border: 1px solid #1e3a5f !important;
      display: block !important;
      overflow: visible !important;
    }

    /* ── 8. Page breaks — NOT after last report ── */
    .report-card-container:not(:last-child) {
      page-break-after: always !important;
      break-after: page !important;
    }
    .report-card-container:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    /* ── 9. Prevent content cutting inside rows ── */
    .report-card-container table {
      page-break-inside: auto !important;
    }
    .report-card-container tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* ── 10. Hide recharts tooltip ── */
    .recharts-tooltip-wrapper {
      display: none !important;
      visibility: hidden !important;
    }

    /* ── 11. SVG / images ── */
    svg, img {
      max-width: 100% !important;
      overflow: visible !important;
      display: block !important;
    }

    /* ── 12. All reports container ── */
    .all-reports-container {
      overflow: visible !important;
      width: 100% !important;
      height: auto !important;
    }
  }
`;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById('student-report-print-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // ============== CONTEXT STATE (from localStorage like MarksEntry) ==============
  const [academicYear, setAcademicYear] = useState<string>("");
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");

  // ============== DROPDOWN OPTIONS STATE ==============
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [tests, setTests] = useState<TestOption[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);

  // ============== SELECTED VALUES STATE ==============
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedTestId, setSelectedTestId] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectAllStudents, setSelectAllStudents] = useState<boolean>(false);

  // ============== LOADING STATES ==============
  const [loadingClasses, setLoadingClasses] = useState<boolean>(false);
  const [loadingSections, setLoadingSections] = useState<boolean>(false);
  const [loadingTests, setLoadingTests] = useState<boolean>(false);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);
  const [loadingAllReports, setLoadingAllReports] = useState<boolean>(false);

  // ============== MESSAGE STATE ==============
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  // UI only: reopen the filters after a report is shown
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

  // ============== REPORT DATA STATE ==============
  const [data, setData] = useState<ProgressReportData | null>(null);
  const [allStudentsData, setAllStudentsData] = useState<ProgressReportData[]>([]);

  // ============== PRINT HANDLER ==============
  const handlePrint = () => {
    window.print();
  };

  // ============== GET ALL STUDENTS REPORTS HANDLER ==============
  const handleGetAllStudentsReports = async () => {
    if (!selectedTestId || students.length === 0) {
      setMessage({ type: 'error', text: 'Choose an exam, and a section that has students.' });
      return;
    }

    setLoadingAllReports(true);
    setMessage(null);
    const reportsData: ProgressReportData[] = [];

    try {
      // Fetch reports for all students
      for (const student of students) {
        const studentId = student.student_id || student.id;
        const response = await api.get('/report/student', {
          params: {
            student_id: studentId,
            test_id: selectedTestId,
            academic_year: academicYear,
            branch: selectedBranch,
            class_id: selectedClass,
            section: selectedSection
          }
        });
        reportsData.push(response.data);
      }

      setAllStudentsData(reportsData);
      setMessage({ type: 'success', text: `Successfully loaded ${reportsData.length} student reports! You can now print.` });

    } catch (err: any) {
      console.error('Error fetching all student reports:', err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Could not get the report cards. Please try again.' });
    } finally {
      setLoadingAllReports(false);
    }
  };

  // ============== INITIALIZATION ==============
  useEffect(() => {
    const storedYear = localStorage.getItem("academicYear") || "";
    const userStr = localStorage.getItem("user");
    let storedBranch = "All";

    if (userStr) {
      try {
        const selected = localStorage.getItem("currentBranch");
        if (selected && selected !== "All Locations") {
            storedBranch = selected;
        }
      } catch (e) {
        console.error("Error parsing user", e);
      }
    }

    setAcademicYear(storedYear);
    setSelectedBranch(storedBranch);
    setBranches([{ branch_name: storedBranch, branch_code: storedBranch }]);
  }, []);

  // ============== FETCH CLASSES ==============
  useEffect(() => {
    if (!selectedBranch) return;

    setLoadingClasses(true);
    api.get('/classes', {
      params: { branch: selectedBranch }
    })
      .then(res => {
        const classData = res.data.classes || res.data || [];
        setClasses(classData);
      })
      .catch(err => {
        console.error('Error fetching classes:', err);
        setMessage({ type: 'error', text: 'Could not load the classes. Please try again.' });
      })
      .finally(() => setLoadingClasses(false));
  }, [selectedBranch]);

  // ============== FETCH SECTIONS ==============
  useEffect(() => {
    const clsObj = classes.find(c => String(c.id) === selectedClass);
    if (!clsObj) {
      setSections([]);
      setSelectedSection('');
      return;
    }

    setLoadingSections(true);
    api.get('/sections', {
      params: { class: clsObj.class_name }
    })
      .then(res => {
        const sectionData = res.data.sections || res.data || [];
        setSections(sectionData);
      })
      .catch(err => {
        console.error('Error fetching sections:', err);
        setSections([]);
      })
      .finally(() => setLoadingSections(false));
  }, [selectedClass, classes]);

  // ============== FETCH TESTS ==============
  useEffect(() => {
    if (!selectedClass || !academicYear) {
      setTests([]);
      setSelectedTestId('');
      return;
    }

    setLoadingTests(true);
    api.get('/class-tests/list', {
      params: {
        academic_year: academicYear,
        branch: selectedBranch,
        class_id: selectedClass
      }
    })
      .then(res => {
        const testData = res.data || [];
        setTests(testData);
      })
      .catch(err => {
        console.error('Error fetching tests:', err);
        setTests([]);
      })
      .finally(() => setLoadingTests(false));
  }, [selectedClass, academicYear, selectedBranch]);

  // ============== FETCH STUDENTS ==============
  useEffect(() => {
    if (!selectedClass || !selectedSection) {
      setStudents([]);
      setSelectedStudentId('');
      return;
    }

    const clsObj = classes.find(c => String(c.id) === selectedClass);
    if (!clsObj) return;

    setLoadingStudents(true);
    api.get('/students', {
      params: {
        branch: selectedBranch,
        class: clsObj.class_name,
        section: selectedSection,
        academic_year: academicYear
      }
    })
      .then(res => {
        const studentData = res.data.students || res.data || [];
        setStudents(studentData);
      })
      .catch(err => {
        console.error('Error fetching students:', err);
        setStudents([]);
      })
      .finally(() => setLoadingStudents(false));
  }, [selectedClass, selectedSection, selectedBranch, academicYear, classes]);

  // ============== FETCH REPORT DATA ==============
  const handleGetReport = () => {
    if (!selectedStudentId || !selectedTestId) {
      setMessage({ type: 'error', text: 'Choose an exam and a student.' });
      return;
    }

    setLoadingReport(true);
    setMessage(null);
    setData(null);

    api.get('/report/student', {
      params: {
        student_id: selectedStudentId,
        test_id: selectedTestId,
        academic_year: academicYear,
        branch: selectedBranch,
        class_id: selectedClass,
        section: selectedSection
      }
    })
      .then(res => {
        setData(res.data);
        setMessage({ type: 'success', text: 'Report loaded successfully!' });
      })
      .catch(err => {
        console.error('Error fetching report:', err);
        setMessage({ type: 'error', text: err.response?.data?.error || 'Could not get the report card. Please try again.' });
      })
      .finally(() => setLoadingReport(false));
  };

  // ============== HANDLE DROPDOWN CHANGES ==============
  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBranch(e.target.value);
    setSelectedClass('');
    setSelectedSection('');
    setSelectedTestId('');
    setSelectedStudentId('');
    setData(null);
  };

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedClass(e.target.value);
    setSelectedSection('');
    setSelectedTestId('');
    setSelectedStudentId('');
    setData(null);
  };

  const handleSectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSection(e.target.value);
    setSelectedStudentId('');
    setData(null);
  };

  const handleTestChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTestId(e.target.value);
    setData(null);
  };

  const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedStudentId(e.target.value);
    setData(null);
  };

  // ============== RESET FILTERS ==============
  const handleReset = () => {
    setSelectedClass('');
    setSelectedSection('');
    setSelectedTestId('');
    setSelectedStudentId('');
    setSections([]);
    setTests([]);
    setStudents([]);
    setData(null);
    setMessage(null);
  };

  // ============== UI-ONLY HELPERS ==============
  const hasReport = !!data || allStudentsData.length > 0;
  const showFilters = !hasReport || filtersOpen;
  const className = classes.find(c => String(c.id) === selectedClass)?.class_name;
  const testName = tests.find(t => String(t.test_id) === selectedTestId)?.test_name;
  const studentObj = students.find(s => String(s.student_id || s.id) === selectedStudentId);
  const studentName = studentObj?.name || studentObj?.student_name;

  const shownLine = (() => {
    const parts: string[] = [];
    if (testName) parts.push(testName);
    if (className) parts.push(`Class ${className}${selectedSection ? `-${selectedSection}` : ''}`);
    if (allStudentsData.length > 0) parts.unshift(`${allStudentsData.length} report card${allStudentsData.length !== 1 ? 's' : ''}`);
    else if (data) parts.unshift(data.student?.studentName || studentName || "Report card");
    return parts.join(' · ');
  })();

  const whyDisabled = !selectedClass ? 'Choose a class first'
    : !selectedSection ? 'Choose a section'
    : !selectedTestId ? 'Choose an exam'
    : (!selectAllStudents && !selectedStudentId) ? 'Choose a student, or choose "Whole section"'
    : (selectAllStudents && students.length === 0) ? 'No students in this section'
    : undefined;

  const getReports = () => {
    setFiltersOpen(false);
    if (selectAllStudents) handleGetAllStudentsReports();
    else handleGetReport();
  };

  // ============== RENDER FILTER SECTION ==============
  const renderFilterSection = () => (
    <div className="card p-4 mb-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-slate-900">Whose report card?</h2>
        <button type="button" onClick={handleReset} className="btn-ghost btn-sm text-brand-700">
          Start again
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {branches.length > 1 && (
          <Field label="Branch" htmlFor="rc-branch">
            <select id="rc-branch" value={selectedBranch} onChange={handleBranchChange} className="input">
              {branches.map(b => (
                <option key={b.branch_code} value={b.branch_code}>{b.branch_name}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Class" htmlFor="rc-class">
          <select id="rc-class" value={selectedClass} onChange={handleClassChange} disabled={loadingClasses} className="input">
            <option value="">{loadingClasses ? 'Loading…' : 'Choose a class'}</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.class_name}</option>
            ))}
          </select>
        </Field>

        <Field label="Section" htmlFor="rc-section">
          <select
            id="rc-section"
            value={selectedSection}
            onChange={handleSectionChange}
            disabled={!selectedClass || loadingSections}
            className="input"
          >
            <option value="">
              {!selectedClass ? 'Choose a class first' : loadingSections ? 'Loading…' : 'Choose a section'}
            </option>
            {sections.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>

        <Field label="Exam" htmlFor="rc-test">
          <select
            id="rc-test"
            value={selectedTestId}
            onChange={handleTestChange}
            disabled={!selectedClass || loadingTests}
            className="input"
          >
            <option value="">
              {!selectedClass ? 'Choose a class first' : loadingTests ? 'Loading…' : 'Choose an exam'}
            </option>
            {tests.map(t => (
              <option key={t.test_id} value={t.test_id}>{t.test_name}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="For">
          <div role="radiogroup" aria-label="For" className="flex flex-wrap gap-2">
            {[
              { all: false, label: 'One student' },
              { all: true, label: `Whole section${students.length ? ` (${students.length})` : ''}` },
            ].map(o => (
              <button
                key={String(o.all)}
                type="button"
                role="radio"
                aria-checked={selectAllStudents === o.all}
                disabled={o.all && students.length === 0}
                onClick={() => {
                  setSelectAllStudents(o.all);
                  if (o.all) {
                    setSelectedStudentId('');
                    setData(null);
                  }
                }}
                className={`min-h-[44px] px-4 rounded-lg border text-sm font-medium disabled:opacity-50 ${selectAllStudents === o.all
                  ? 'border-brand-600 bg-brand-50 text-brand-800 ring-1 ring-brand-600'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>

        {!selectAllStudents && (
          <Field label="Student" htmlFor="rc-student">
            <div className="relative">
              <select
                id="rc-student"
                value={selectedStudentId}
                onChange={handleStudentChange}
                disabled={!selectedSection || loadingStudents}
                className="input"
              >
                <option value="">
                  {!selectedSection
                    ? 'Choose a section first'
                    : loadingStudents
                      ? 'Loading…'
                      : `Choose a student (${students.length})`}
                </option>
                {students.map(s => (
                  <option key={s.student_id || s.id} value={s.student_id || s.id}>
                    {s.roll_number ?? s.roll_no ?? '-'} - {s.name || s.student_name}
                  </option>
                ))}
              </select>
              {loadingStudents && (
                <div className="absolute right-8 top-1/2 -translate-y-1/2">
                  <Spinner size="sm" />
                </div>
              )}
            </div>
          </Field>
        )}
      </div>
    </div>
  );

  // ============== RENDER EMPTY STATE ==============
  const renderEmptyState = () => (
    <div className="card">
      <EmptyState
        title="No report card yet"
        description="Choose the class, section, exam and student above, then tap “Show report card”."
      />
    </div>
  );

  // ============== RENDER LOADING STATE ==============
  const renderLoadingState = () => (
    <div className="card">
      <LoadingState
        label={loadingAllReports ? `Getting ${students.length} report cards… This can take a little while.` : 'Getting the report card…'}
        className="py-16"
      />
    </div>
  );

  // ============== RENDER HISTORICAL PERFORMANCE ==============
  const renderHistoricalPerformance = () => {
    if (!data?.historicalPerformance || data.historicalPerformance.length <= 1) return null;

    const previousYears = data.historicalPerformance.filter(
      (hp: HistoricalPerformance) => hp.academicYear !== data.student.academicYear
    );

    if (previousYears.length === 0) return null;

    return (
      <div className="mb-8 no-print">
        <div className="card overflow-hidden">
          <div className="bg-brand-800 text-white px-4 py-2 text-sm font-semibold">
            Previous years
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {previousYears.map((yearData: HistoricalPerformance, idx: number) => (
                <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 flex justify-between items-center">
                    <span className="font-semibold text-slate-700">
                      {yearData.academicYear} - Class {yearData.class} {yearData.section}
                    </span>
                  </div>
                  <div className="p-3">
                    {yearData.tests.map((test, tIdx: number) => (
                      <div key={tIdx} className="mb-3 last:mb-0">
                        <h5 className="text-sm font-medium text-brand-700 mb-2">{test.testName}</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {test.subjects.map((subj, sIdx: number) => (
                            <div key={sIdx} className={`text-xs p-2 rounded ${subj.isAbsent ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                              <span className="font-medium">{subj.subject}</span>
                              <span className="float-right">
                                {subj.isAbsent ? 'AB' : `${subj.securedMarks}/${subj.maxMarks}`}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 text-right text-sm">
                          <span className="font-medium">Total: </span>
                          <span className="text-brand-600">
                            {test.securedMarks}/{test.totalMarks}
                            ({test.totalMarks > 0 ? Math.round((test.securedMarks / test.totalMarks) * 100) : 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============== MAIN RENDER ==============
  return (
    <div className="student-reports-wrapper">
      <div className="no-print">
        <SetupIntro
          title="Report cards"
          context={[academicYear ? `Year ${academicYear}` : null, selectedBranch && selectedBranch !== 'All' ? selectedBranch : null]}
        >
          See and print a student's report card, or the whole section's at once.
        </SetupIntro>

        {/* Filter Section (on phones it folds away once a report is shown) */}
        {showFilters ? (
          renderFilterSection()
        ) : (
          <div className="hidden md:block">{renderFilterSection()}</div>
        )}
        {!showFilters && (
          <div className="md:hidden card p-4 mb-4 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-500">Showing</p>
              <p className="font-semibold text-slate-900 break-words">{shownLine}</p>
            </div>
            <button type="button" className="btn-secondary btn-sm flex-shrink-0" onClick={() => setFiltersOpen(true)}>
              Change
            </button>
          </div>
        )}

        {/* Message Display */}
        {message && (
          <Alert tone={message.type === 'error' ? 'error' : 'success'} className="mb-4" onClose={() => setMessage(null)}>
            {message.type === 'success' && hasReport
              ? (allStudentsData.length > 0 ? `${allStudentsData.length} report cards are ready to print.` : 'Report card is ready.')
              : message.text}
          </Alert>
        )}

      </div>

      <ActionBar note={whyDisabled && (showFilters || !hasReport) ? whyDisabled : undefined} className="mt-0 mb-4">
        {showFilters && hasReport && (
          <button type="button" className="btn-secondary btn-lg md:hidden" onClick={() => setFiltersOpen(false)}>
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={getReports}
          disabled={!!whyDisabled || loadingReport || loadingAllReports}
          className={`btn-primary btn-lg ${showFilters ? '' : 'hidden md:inline-flex'}`}
        >
          <FileText className="w-5 h-5" />
          {loadingReport || loadingAllReports
            ? 'Getting…'
            : selectAllStudents ? `Show ${students.length} report cards` : 'Show report card'}
        </button>
        {hasReport && !(showFilters && filtersOpen) && (
          <button type="button" onClick={handlePrint} className="btn-success btn-lg">
            <Printer className="w-5 h-5" />
            {allStudentsData.length > 0 ? `Print all ${allStudentsData.length}` : 'Print report card'}
          </button>
        )}
        {hasReport && showFilters && filtersOpen && (
          <button type="button" onClick={handlePrint} className="btn-success btn-lg hidden md:inline-flex">
            <Printer className="w-5 h-5" />
            {allStudentsData.length > 0 ? `Print all ${allStudentsData.length}` : 'Print report card'}
          </button>
        )}
      </ActionBar>

      {/* Report Card Container */}
      {loadingReport || loadingAllReports ? (
        <div className="no-print">{renderLoadingState()}</div>
      ) : !hasReport ? (
        <div className="no-print">{renderEmptyState()}</div>
      ) : (
        <div className="all-reports-container overflow-x-auto">
          {/* Historical Performance (only for single student) */}
          {data && renderHistoricalPerformance()}

          <p className="no-print md:hidden mb-2 text-xs text-slate-500">Swipe sideways to see the whole report card.</p>

          {/* On phones the printed-size card scrolls sideways; on paper it is exactly as before */}
          <div className="min-w-[760px] md:min-w-0 print:min-w-0">
            {/* Render single student report */}
            {data && (
              <ReportCard data={data} />
            )}

            {/* Render all students reports */}
            {allStudentsData.length > 0 && allStudentsData.map((studentData, index) => (
              <ReportCard key={index} data={studentData} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default StudentReportCard;
