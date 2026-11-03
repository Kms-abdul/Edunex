import React, { useEffect, useState, useCallback } from "react";
import { CalendarClock, Trash2, Plus, Copy, Printer, CalendarDays, Users, LayoutGrid, Eye } from "lucide-react";
import api from "../api";
import { useAuth } from "../contexts/AuthContext";
import { PageHeader, LoadingState, EmptyState, Alert, ActionBar, Field, Badge, notify } from "./ui";
import { consumeIntent } from "../utils/intent";
import { ChoiceList, GridCard, BackBar, Dialog } from "./school-setup";

/* =========================================================================
   Timetable Module — single-file implementation
   Sub-views (all in this file, per request):
     - Subject Teacher Assignment  (master: subject -> teacher per section)
     - Timetable Builder           (day-wise periods/breaks per section)
     - View Timetable              (read-only weekly grid)
     - My Timetable                (teacher's own schedule)
   ========================================================================= */

const DAYS: { code: string; label: string }[] = [
  { code: "MON", label: "Monday" },
  { code: "TUE", label: "Tuesday" },
  { code: "WED", label: "Wednesday" },
  { code: "THU", label: "Thursday" },
  { code: "FRI", label: "Friday" },
  { code: "SAT", label: "Saturday" },
];

const SLOT_TYPES = ["PERIOD", "BREAK", "LUNCH", "ASSEMBLY"] as const;
type SlotType = typeof SLOT_TYPES[number];
/** Plain names shown to people (the stored values stay the same) */
const SLOT_LABELS: Record<string, string> = { PERIOD: "Period", BREAK: "Break", LUNCH: "Lunch", ASSEMBLY: "Assembly" };
const slotLabel = (t: string) => SLOT_LABELS[t] || t;

/** DAYS with today first, e.g. on Wednesday: Wed, Thu, Fri, Sat, Mon, Tue. Sunday starts on Monday. */
function daysFromToday(): { code: string; label: string; isToday: boolean }[] {
  const js = new Date().getDay(); // 0 = Sunday
  const todayIdx = js === 0 ? -1 : js - 1;
  const start = todayIdx < 0 ? 0 : todayIdx;
  return [...DAYS.slice(start), ...DAYS.slice(0, start)].map((d) => ({ ...d, isToday: DAYS.indexOf(d) === todayIdx }));
}

function formatTime12h(t: string): string {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${suffix}`;
}

interface Option { id: number | string; name: string; }
interface BranchOption extends Option { branch_name: string; }
interface SubjectOption { id: number; subject_name: string; }
interface TeacherOption { id: number; name: string; designation?: string | null; }

interface SlotRow {
  id?: number;
  slot_order: number;
  slot_type: SlotType;
  label: string;
  start_time: string; // "HH:MM"
  end_time: string;
  subject_id: number | null;
  teacher_id: number | null;
  room: string;
}

/* -------------------------------------------------------------------------
   Small shared UI bits
   ------------------------------------------------------------------------- */

/** Branch / Class / Section / School year selector shared across sub-views */
const ContextBar: React.FC<{
  branches: BranchOption[]; classes: Option[]; sections: Option[]; academicYears: Option[];
  branchId: string; classId: string; sectionId: string; yearId: string;
  onBranch: (v: string) => void; onClass: (v: string) => void; onSection: (v: string) => void; onYear: (v: string) => void;
  showSection?: boolean;
}> = ({ branches, classes, sections, academicYears, branchId, classId, sectionId, yearId, onBranch, onClass, onSection, onYear, showSection = true }) => {
  const cls = "input";
  return (
    <div className="card p-4 mb-4">
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${showSection ? "lg:grid-cols-4" : "lg:grid-cols-3"} gap-3`}>
        <Field label="Branch">
          <select className={cls} value={branchId} onChange={(e) => onBranch(e.target.value)}>
            <option value="">Choose branch</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.branch_name}</option>)}
          </select>
        </Field>
        <Field label="Class">
          <select className={cls} value={classId} onChange={(e) => onClass(e.target.value)}>
            <option value="">Choose class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {showSection && (
          <Field label="Section">
            <select className={cls} value={sectionId} onChange={(e) => onSection(e.target.value)} disabled={!classId}>
              <option value="">{classId ? "Choose section" : "Choose a class first"}</option>
              {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="School year">
          <select className={cls} value={yearId} onChange={(e) => onYear(e.target.value)}>
            <option value="">Choose year</option>
            {academicYears.map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
          </select>
        </Field>
      </div>
    </div>
  );
};

/** What is still missing before a class timetable can be shown, in plain words. */
const missingChoice = (ctx: { branchId: string; classId: string; sectionId: string; yearName: string }) =>
  !ctx.branchId ? "Choose a branch first."
    : !ctx.classId ? "Choose a class first."
    : !ctx.sectionId ? "Choose a section first."
    : !ctx.yearName ? "Choose a school year first."
    : "";

/** Shared hook: loads Branches / Classes / Academic Years, and Sections/Subjects/Teachers dependently */
function useTimetableContext() {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [academicYears, setAcademicYears] = useState<Option[]>([]);
  const [sections, setSections] = useState<Option[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  const [branchId, setBranchId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [yearName, setYearName] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const storedBranch = localStorage.getItem("currentBranchId") || "";
        const storedYear = localStorage.getItem("academicYear") || "";

        const [resBranches, resClasses, resYears] = await Promise.all([
          api.get("/branches"),
          api.get("/classes"),
          api.get("/org/academic-years"),
        ]);

        const branchList = (resBranches.data.branches || []).map((b: any) => ({
          id: b.id, name: b.branch_name, branch_name: b.branch_name,
        }));
        setBranches(branchList);

        const classList = resClasses.data.classes || resClasses.data || [];
        setClasses(classList.map((c: any) => ({ id: c.id, name: c.class_name })));

        const yearList = resYears.data.academic_years || resYears.data || [];
        setAcademicYears(yearList.map((y: any) => ({ id: y.id, name: y.name })));

        if (storedBranch && branchList.some((b: any) => String(b.id) === String(storedBranch))) {
          setBranchId(String(storedBranch));
        } else if (branchList.length) {
          setBranchId(String(branchList[0].id));
        }

        if (storedYear && yearList.some((y: any) => y.name === storedYear)) {
          setYearName(storedYear);
        } else if (yearList.length) {
          setYearName(yearList[0].name);
        }
      } catch (e) {
        console.error("Timetable: failed to load base context", e);
      }
    })();
  }, []);

  // Sections depend on class + branch + year
  useEffect(() => {
    setSectionId("");
    setSections([]);
    if (!classId || !branchId || !yearName) return;
    api.get("/timetable/lookups/sections", { params: { class_id: classId, branch_id: branchId, academic_year: yearName } })
      .then((res) => setSections((res.data.sections || []).map((s: any) => ({ id: s.id, name: s.section_name }))))
      .catch((e) => console.error(e));
  }, [classId, branchId, yearName]);

  // Subjects depend on class + branch + year
  useEffect(() => {
    setSubjects([]);
    if (!classId || !branchId || !yearName) return;
    api.get("/timetable/lookups/subjects", { params: { class_id: classId, branch_id: branchId, academic_year: yearName } })
      .then((res) => setSubjects(res.data.subjects || []))
      .catch((e) => console.error(e));
  }, [classId, branchId, yearName]);

  // Teachers depend on branch only
  useEffect(() => {
    setTeachers([]);
    if (!branchId) return;
    api.get("/timetable/lookups/teachers", { params: { branch_id: branchId } })
      .then((res) => setTeachers(res.data.teachers || []))
      .catch((e) => console.error(e));
  }, [branchId]);

  return {
    branches, classes, academicYears, sections, subjects, teachers,
    branchId, setBranchId, classId, setClassId, sectionId, setSectionId, yearName, setYearName,
  };
}

/* -------------------------------------------------------------------------
   Sub-view: Subject -> Teacher Assignment
   ------------------------------------------------------------------------- */

const SubjectTeacherAssignmentView: React.FC<{ canWrite: boolean }> = ({ canWrite }) => {
  const ctx = useTimetableContext();
  const [rows, setRows] = useState<{ subject_id: number; subject_name: string; teacher_id: number | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ready = ctx.branchId && ctx.classId && ctx.sectionId && ctx.yearName;

  const load = useCallback(async () => {
    if (!ready) { setRows([]); return; }
    setLoading(true);
    try {
      const res = await api.get("/timetable/subject-teacher", {
        params: { class_id: ctx.classId, section_id: ctx.sectionId, branch_id: ctx.branchId, academic_year: ctx.yearName },
      });
      setRows(res.data.assignments || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [ready, ctx.classId, ctx.sectionId, ctx.branchId, ctx.yearName]);

  useEffect(() => { load(); }, [load]);

  const updateTeacher = (subjectId: number, teacherId: number | null) => {
    setRows((prev) => prev.map((r) => (r.subject_id === subjectId ? { ...r, teacher_id: teacherId } : r)));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.post("/timetable/subject-teacher", {
        class_id: ctx.classId, section_id: ctx.sectionId, branch_id: ctx.branchId, academic_year: ctx.yearName,
        assignments: rows.map((r) => ({ subject_id: r.subject_id, teacher_id: r.teacher_id })),
      });
      setMessage("Saved.");
      notify.success("Teachers saved.");
      load();
    } catch (e: any) {
      setMessage(e?.response?.data?.error || "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const unassigned = rows.filter((r) => !r.teacher_id).length;

  return (
    <div>
      <ContextBar
        branches={ctx.branches} classes={ctx.classes} sections={ctx.sections} academicYears={ctx.academicYears}
        branchId={ctx.branchId} classId={ctx.classId} sectionId={ctx.sectionId} yearId={ctx.yearName}
        onBranch={ctx.setBranchId} onClass={ctx.setClassId} onSection={ctx.setSectionId} onYear={ctx.setYearName}
      />

      {!ready && <EmptyState title={missingChoice(ctx)} description="Then you will see each subject and can choose who teaches it." />}

      {ready && (
        <>
          {loading ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <EmptyState title="This class has no subjects yet." description="Add subjects to this class first, then come back here." />
          ) : (
            <ul className="card divide-y divide-slate-100">
              {rows.map((r) => (
                <li key={r.subject_id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="sm:w-1/3 min-w-0">
                    <div className="text-[15px] font-semibold text-slate-900">{r.subject_name}</div>
                    {!r.teacher_id && <div className="text-sm text-amber-600">No teacher yet</div>}
                  </div>
                  <select
                    className="input sm:max-w-sm"
                    aria-label={`Teacher for ${r.subject_name}`}
                    value={r.teacher_id ?? ""}
                    disabled={!canWrite}
                    onChange={(e) => updateTeacher(r.subject_id, e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">No teacher</option>
                    {ctx.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.designation ? ` (${t.designation})` : ""}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          )}

          {message && message !== "Saved." && <Alert tone="error" className="mt-3" onClose={() => setMessage(null)}>{message}</Alert>}

          {canWrite && rows.length > 0 && (
            <ActionBar note={unassigned > 0 ? `${unassigned} subject${unassigned === 1 ? "" : "s"} still ${unassigned === 1 ? "has" : "have"} no teacher.` : "Every subject has a teacher."}>
              <button onClick={save} disabled={saving} className="btn-primary btn-lg">
                {saving ? "Saving…" : "Save teachers"}
              </button>
            </ActionBar>
          )}
        </>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------
   Sub-view: Timetable Builder (day-wise periods & breaks)
   ------------------------------------------------------------------------- */

const emptySlot = (order: number): SlotRow => ({
  slot_order: order, slot_type: "PERIOD", label: "", start_time: "", end_time: "",
  subject_id: null, teacher_id: null, room: "",
});

const TimetableBuilderView: React.FC<{ canWrite: boolean }> = ({ canWrite }) => {
  const ctx = useTimetableContext();
  const [day, setDay] = useState("MON");
  const [isWorkingDay, setIsWorkingDay] = useState(true);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [subjectTeacherMap, setSubjectTeacherMap] = useState<Record<number, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [copyTargets, setCopyTargets] = useState<Set<string>>(new Set());
  const [coverage, setCoverage] = useState<{class_id:number; class_name:string; section_id:number; section_name:string; has_structure:boolean}[]>([]);
  const [copySectionTargets, setCopySectionTargets] = useState<Set<string>>(new Set());
  const [showDaysPanel, setShowDaysPanel] = useState(false);
  const [showSectionsPanel, setShowSectionsPanel] = useState(false);

  const ready = ctx.branchId && ctx.classId && ctx.sectionId && ctx.yearName;

  const loadDay = useCallback(async () => {
    if (!ready) { setSlots([]); return; }
    setLoading(true);
    setConflicts([]);
    try {
      const res = await api.get("/timetable/day-structure", {
        params: { class_id: ctx.classId, section_id: ctx.sectionId, branch_id: ctx.branchId, academic_year: ctx.yearName, day_of_week: day },
      });
      setIsWorkingDay(res.data.is_working_day ?? true);
      setSlots((res.data.slots || []).map((s: any) => ({
        id: s.id, slot_order: s.slot_order, slot_type: s.slot_type, label: s.label || "",
        start_time: s.start_time || "", end_time: s.end_time || "",
        subject_id: s.subject_id, teacher_id: s.teacher_id, room: s.room || "",
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [ready, ctx.classId, ctx.sectionId, ctx.branchId, ctx.yearName, day]);

  useEffect(() => { loadDay(); }, [loadDay]);

  // Load the subject->teacher master so period rows can auto-fill the teacher
  useEffect(() => {
    if (!ready) { setSubjectTeacherMap({}); return; }
    api.get("/timetable/subject-teacher", {
      params: { class_id: ctx.classId, section_id: ctx.sectionId, branch_id: ctx.branchId, academic_year: ctx.yearName },
    }).then((res) => {
      const map: Record<number, number | null> = {};
      (res.data.assignments || []).forEach((a: any) => { map[a.subject_id] = a.teacher_id; });
      setSubjectTeacherMap(map);
    }).catch((e) => console.error(e));
  }, [ready, ctx.classId, ctx.sectionId, ctx.branchId, ctx.yearName]);

  const addSlot = () => setSlots((prev) => [...prev, emptySlot(prev.length + 1)]);

  const removeSlot = (idx: number) =>
    setSlots((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, slot_order: i + 1 })));

  const updateSlot = (idx: number, patch: Partial<SlotRow>) =>
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const onSubjectChange = (idx: number, subjectId: number | null) => {
    const autoTeacher = subjectId ? (subjectTeacherMap[subjectId] ?? null) : null;
    updateSlot(idx, { subject_id: subjectId, teacher_id: autoTeacher });
  };

  const save = async (force = false) => {
    setSaving(true);
    setMessage(null);
    setConflicts([]);
    try {
      await api.post("/timetable/day-structure", {
        class_id: ctx.classId, section_id: ctx.sectionId, branch_id: ctx.branchId, academic_year: ctx.yearName,
        day_of_week: day, is_working_day: isWorkingDay, force,
        slots: slots.map((s) => ({
          slot_order: s.slot_order, slot_type: s.slot_type, label: s.label,
          start_time: s.start_time, end_time: s.end_time,
          subject_id: s.slot_type === "PERIOD" ? s.subject_id : null,
          teacher_id: s.slot_type === "PERIOD" ? s.teacher_id : null,
          room: s.room,
        })),
      });
      setMessage("Day saved.");
      notify.success(`${DAYS.find((d) => d.code === day)?.label ?? "Day"} saved.`);
      loadDay();
    } catch (e: any) {
      if (e?.response?.status === 409) {
        setConflicts(e.response.data.conflicts || ["A teacher is already busy at this time."]);
      } else {
        setMessage(e?.response?.data?.error || "Failed to save.");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleCopyTarget = (dow: string) => {
    setCopyTargets((prev) => {
      const next = new Set(prev);
      next.has(dow) ? next.delete(dow) : next.add(dow);
      return next;
    });
  };

  const loadCoverage = async () => {
  try {
    const res = await api.get("/timetable/day-structure/coverage", {
      params: { branch_id: ctx.branchId, academic_year: ctx.yearName },
    });
    setCoverage(res.data.items || []);
  } catch {
    setCoverage([]);
  }
};

  const openDaysPanel = () => {
    setShowSectionsPanel(false);
    setShowDaysPanel((v) => !v);
  };

  const openSectionsPanel = () => {
    setShowDaysPanel(false);
    setShowSectionsPanel((v) => {
      const next = !v;
      if (next) loadCoverage();
      return next;
    });
  };

  const copyToOtherDays = async () => {
    if (copyTargets.size === 0) return;
    try {
      await api.post("/timetable/day-structure/copy", {
        source: { class_id: ctx.classId, section_id: ctx.sectionId, branch_id: ctx.branchId, academic_year: ctx.yearName, day_of_week: day },
        targets: Array.from(copyTargets).map((dow) => ({ day_of_week: dow })),
        overwrite: false,
      });
      setMessage(`Copied to ${copyTargets.size} day(s).`);
      setCopyTargets(new Set());
      setShowDaysPanel(false);
      loadDay();
    } catch (e: any) {
      setMessage(e?.response?.data?.error || "Copy failed.");
    }
  };

  const copyToOtherSections = async () => {
    if (copySectionTargets.size === 0) return;
    const targets = Array.from(copySectionTargets).map((key) => {
      const [classId, sectionId] = key.split(":");
      return { class_id: Number(classId), section_id: Number(sectionId) };
    });
    try {
      const res = await api.post("/timetable/day-structure/copy-week", {
        source: { class_id: ctx.classId, section_id: ctx.sectionId, branch_id: ctx.branchId, academic_year: ctx.yearName },
        targets,
      });
      const { copied, skipped } = res.data;
      setMessage(`Copied full week to ${copied.length} class/section(s).${skipped.length ? ` Skipped ${skipped.length} (already had data).` : ""}`);
      setCopySectionTargets(new Set());
      setShowSectionsPanel(false);
    } catch (e: any) {
      setMessage(e?.response?.data?.error || "Copy failed.");
    }
  };

  const dayLabel = DAYS.find((d) => d.code === day)?.label ?? day;
  const cellInput = "input min-h-[44px] md:min-h-0 md:py-1.5 px-2";

  return (
    <div>
      <ContextBar
        branches={ctx.branches} classes={ctx.classes} sections={ctx.sections} academicYears={ctx.academicYears}
        branchId={ctx.branchId} classId={ctx.classId} sectionId={ctx.sectionId} yearId={ctx.yearName}
        onBranch={ctx.setBranchId} onClass={ctx.setClassId} onSection={ctx.setSectionId} onYear={ctx.setYearName}
      />

      {!ready && <EmptyState title={missingChoice(ctx)} description="Then you can set the periods and breaks for each day." />}

      {ready && (
        <>
          {/* Day tabs: scroll sideways on phones */}
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto mb-4">
            <div className="segmented">
              {DAYS.map((d) => (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => setDay(d.code)}
                  aria-pressed={day === d.code}
                  className={`segmented-item min-h-[40px] whitespace-nowrap ${day === d.code ? "segmented-item-active" : ""}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-between mb-3">
            <label className="flex items-center gap-2.5 text-sm text-slate-800 min-h-[44px]">
              <input type="checkbox" className="w-5 h-5 accent-brand-600" checked={isWorkingDay} disabled={!canWrite}
                onChange={(e) => setIsWorkingDay(e.target.checked)} />
              School is open on {dayLabel}
            </label>

            {canWrite && (
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
                <button type="button" onClick={openDaysPanel} className="btn-secondary btn-sm">
                  <Copy size={14} /> Copy to other days
                </button>
                <button type="button" onClick={openSectionsPanel} className="btn-secondary btn-sm">
                  <Copy size={14} /> Copy to other classes
                </button>
              </div>
            )}
          </div>

          {showDaysPanel && (
            <Dialog
              title={`Copy ${dayLabel} to other days`}
              subtitle={`The periods of ${dayLabel} will be copied to the days you tick.`}
              onClose={() => setShowDaysPanel(false)}
              footer={<>
                <button type="button" onClick={() => setShowDaysPanel(false)} className="btn-secondary">Back</button>
                <button type="button" onClick={copyToOtherDays} disabled={copyTargets.size === 0} className="btn-primary">
                  {copyTargets.size === 0 ? "Tick a day" : `Copy to ${copyTargets.size} day${copyTargets.size === 1 ? "" : "s"}`}
                </button>
              </>}
            >
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {DAYS.filter((d) => d.code !== day).map((d) => (
                  <label key={d.code} className="flex items-center gap-3 px-4 min-h-[48px] text-[15px] text-slate-800">
                    <input type="checkbox" className="w-5 h-5 accent-brand-600" checked={copyTargets.has(d.code)} onChange={() => toggleCopyTarget(d.code)} />
                    {d.label}
                  </label>
                ))}
              </div>
            </Dialog>
          )}

          {showSectionsPanel && (
            <Dialog
              title="Copy this week to other classes"
              subtitle="Copies the times and periods of every day built so far. Subjects and teachers are not copied."
              onClose={() => setShowSectionsPanel(false)}
              footer={<>
                <button type="button" onClick={() => setShowSectionsPanel(false)} className="btn-secondary">Back</button>
                <button type="button" onClick={copyToOtherSections} disabled={copySectionTargets.size === 0} className="btn-primary">
                  {copySectionTargets.size === 0 ? "Tick a class" : `Copy to ${copySectionTargets.size} class${copySectionTargets.size === 1 ? "" : "es"}`}
                </button>
              </>}
            >
              {coverage.filter((c) => !c.has_structure).length === 0 ? (
                <EmptyState compact title="Every class already has a timetable." />
              ) : (
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {coverage.filter((c) => !c.has_structure).map((c) => {
                    const key = `${c.class_id}:${c.section_id}`;
                    return (
                      <label key={key} className="flex items-center gap-3 px-4 min-h-[48px] text-[15px] text-slate-800">
                        <input type="checkbox" className="w-5 h-5 accent-brand-600" checked={copySectionTargets.has(key)}
                          onChange={() => setCopySectionTargets((prev) => {
                            const next = new Set(prev);
                            next.has(key) ? next.delete(key) : next.add(key);
                            return next;
                          })} />
                        Class {c.class_name} - {c.section_name}
                      </label>
                    );
                  })}
                </div>
              )}
            </Dialog>
          )}

          {!isWorkingDay && (
            <Alert tone="info">School is closed on {dayLabel}. Tick “School is open on {dayLabel}” to see and add periods.</Alert>
          )}

          {isWorkingDay && (
            <GridCard>
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-2 text-left w-12">No.</th>
                    <th className="px-2 py-2 text-left w-28">Type</th>
                    <th className="px-2 py-2 text-left w-32">Name</th>
                    <th className="px-2 py-2 text-left w-28">Starts</th>
                    <th className="px-2 py-2 text-left w-28">Ends</th>
                    <th className="px-2 py-2 text-left">Subject</th>
                    <th className="px-2 py-2 text-left">Teacher</th>
                    <th className="px-2 py-2 text-left w-24">Room</th>
                    {canWrite && <th className="px-2 py-2 w-12"><span className="sr-only">Remove</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={9}><LoadingState /></td></tr>}
                  {!loading && slots.length === 0 && (
                    <tr><td colSpan={9}><EmptyState compact title={`No periods for ${dayLabel} yet.`} description={canWrite ? "Tap “Add a period” to start." : undefined} /></td></tr>
                  )}
                  {slots.map((s, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-2 py-1.5 text-slate-500">{s.slot_order}</td>
                      <td className="px-2 py-1.5">
                        <select className={cellInput} value={s.slot_type} disabled={!canWrite}
                          onChange={(e) => updateSlot(idx, { slot_type: e.target.value as SlotType, subject_id: null, teacher_id: null })}>
                          {SLOT_TYPES.map((t) => <option key={t} value={t}>{slotLabel(t)}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input className={cellInput} value={s.label} disabled={!canWrite}
                          placeholder={s.slot_type === "PERIOD" ? `Period ${s.slot_order}` : slotLabel(s.slot_type)}
                          onChange={(e) => updateSlot(idx, { label: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="time" lang="en-GB" className={cellInput} value={s.start_time} disabled={!canWrite}
                          onChange={(e) => updateSlot(idx, { start_time: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="time" lang="en-GB" className={cellInput} value={s.end_time} disabled={!canWrite}
                          onChange={(e) => updateSlot(idx, { end_time: e.target.value })} />
                      </td>
                      <td className="px-2 py-1.5">
                        {s.slot_type === "PERIOD" ? (
                          <select className={cellInput} value={s.subject_id ?? ""} disabled={!canWrite}
                            onChange={(e) => onSubjectChange(idx, e.target.value ? Number(e.target.value) : null)}>
                            <option value="">Choose subject</option>
                            {ctx.subjects.map((sub) => <option key={sub.id} value={sub.id}>{sub.subject_name}</option>)}
                          </select>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {s.slot_type === "PERIOD" ? (
                          <span className="text-sm text-slate-700">
                            {s.teacher_id
                              ? (ctx.teachers.find((t) => t.id === s.teacher_id)?.name ?? "Unknown teacher")
                              : <span className="text-amber-600">No teacher yet</span>}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        <input className={cellInput} value={s.room} disabled={!canWrite}
                          onChange={(e) => updateSlot(idx, { room: e.target.value })} />
                      </td>
                      {canWrite && (
                        <td className="px-2 py-1.5 text-center">
                          <button type="button" onClick={() => removeSlot(idx)} aria-label={`Remove row ${s.slot_order}`} className="btn-icon text-red-500 hover:bg-red-50 hover:text-red-700">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </GridCard>
          )}

          {isWorkingDay && !loading && slots.length > 0 && (
            <p className="mt-2 text-sm text-slate-500">The teacher is filled in from “Choose teachers for subjects”.</p>
          )}

          {conflicts.length > 0 && (
            <Alert tone="error" title="A teacher is busy at the same time in another class:" className="mt-3">
              <ul className="list-disc pl-5">
                {conflicts.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
              <button type="button" onClick={() => save(true)} className="btn-secondary btn-sm mt-2">Save anyway</button>
            </Alert>
          )}

          {message && <Alert tone={/fail|error|could not/i.test(message) ? "error" : "success"} className="mt-3" onClose={() => setMessage(null)}>{message}</Alert>}

          {canWrite && isWorkingDay && (
            <ActionBar>
              <button type="button" onClick={addSlot} className="btn-secondary btn-lg">
                <Plus size={16} /> Add a period
              </button>
              <button type="button" onClick={() => save(false)} disabled={saving} className="btn-primary btn-lg">
                {saving ? "Saving…" : `Save ${dayLabel}`}
              </button>
            </ActionBar>
          )}
        </>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------
   Sub-view: View Timetable (read-only weekly grid)
   ------------------------------------------------------------------------- */

const ViewTimetableView: React.FC = () => {
  const ctx = useTimetableContext();
  const [days, setDays] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  const ready = ctx.branchId && ctx.classId && ctx.sectionId && ctx.yearName;

  useEffect(() => {
    if (!ready) { setDays({}); return; }
    setLoading(true);
    api.get("/timetable/class-timetable", {
      params: { class_id: ctx.classId, section_id: ctx.sectionId, branch_id: ctx.branchId, academic_year: ctx.yearName },
    }).then((res) => setDays(res.data.days || {}))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [ready, ctx.classId, ctx.sectionId, ctx.branchId, ctx.yearName]);

  const maxRows = Math.max(0, ...DAYS.map((d) => days[d.code]?.slots?.length || 0));
  const rowIndexes = Array.from({ length: maxRows }, (_, i) => i);

  const className = ctx.classes.find((c) => String(c.id) === String(ctx.classId))?.name || "";
  const sectionName = ctx.sections.find((s) => String(s.id) === String(ctx.sectionId))?.name || "";
  const branchName = ctx.branches.find((b) => String(b.id) === String(ctx.branchId))?.branch_name || "";

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #timetable-print-area, #timetable-print-area * { visibility: visible; }
          #timetable-print-area { position: absolute; top: 0; left: 0; width: 100%; }
          @page { size: landscape; margin: 10mm; }
        }
      `}</style>

      <ContextBar
        branches={ctx.branches} classes={ctx.classes} sections={ctx.sections} academicYears={ctx.academicYears}
        branchId={ctx.branchId} classId={ctx.classId} sectionId={ctx.sectionId} yearId={ctx.yearName}
        onBranch={ctx.setBranchId} onClass={ctx.setClassId} onSection={ctx.setSectionId} onYear={ctx.setYearName}
      />

      {!ready && <EmptyState title={missingChoice(ctx)} description="Then the week's timetable for that class is shown here." />}
      {loading && <LoadingState label="Loading timetable…" />}

      {ready && !loading && maxRows === 0 && (
        <EmptyState title="This class has no timetable yet." description="It can be made in “Build a class timetable”." />
      )}

      {ready && !loading && maxRows > 0 && (
        <div id="timetable-print-area">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{branchName}</span> · Class {className} - {sectionName} · {ctx.yearName}
            </div>
            <button onClick={() => window.print()} className="btn-secondary btn-sm print:hidden">
              <Printer size={14} /> Print
            </button>
          </div>

          <GridCard>
            <table className="w-full text-xs border-collapse min-w-[700px]">
              <thead>
                <tr className="">
                  <th className="px-2 py-2 text-left w-10 border">#</th>
                  {DAYS.map((d) => (
                    <th key={d.code} className="px-2 py-2 text-left border">
                      {d.label}
                      {days[d.code] && !days[d.code].is_working_day && (
                        <span className="block text-[11px] font-normal text-gray-400">School closed</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowIndexes.map((rowIdx) => (
                  <tr key={rowIdx} className="border-t">
                    <td className="px-2 py-1 border text-center text-gray-400">{rowIdx + 1}</td>
                    {DAYS.map((d) => {
                      const dayData = days[d.code];
                      const s = dayData?.is_working_day ? dayData?.slots?.[rowIdx] : null;
                      if (!s) {
                        return <td key={d.code} className="px-2 py-1 border text-gray-300">—</td>;
                      }
                      return (
                        <td key={d.code} className={`px-2 py-1 border align-top ${s.slot_type !== "PERIOD" ? "bg-yellow-50" : ""}`}>
                          <div className="text-[11px] text-gray-500">{formatTime12h(s.start_time)} - {formatTime12h(s.end_time)}</div>
                          {s.slot_type === "PERIOD" ? (
                            <>
                              <div className="font-medium text-sm">{s.subject_name || "—"}</div>
                              <div className="text-gray-500">{s.teacher_name || "No teacher"}{s.room ? ` · ${s.room}` : ""}</div>
                            </>
                          ) : (
                            <div className="font-medium text-sm">{slotLabel(s.slot_type)}{s.label ? ` · ${s.label}` : ""}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </GridCard>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------
   Sub-view: My Timetable (teacher's own schedule)
   ------------------------------------------------------------------------- */

const MyTimetableView: React.FC = () => {
  const [academicYears, setAcademicYears] = useState<Option[]>([]);
  const [yearName, setYearName] = useState("");
  const [schedule, setSchedule] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const storedYear = localStorage.getItem("academicYear") || "";
      const res = await api.get("/org/academic-years");
      const list = res.data.academic_years || res.data || [];
      setAcademicYears(list.map((y: any) => ({ id: y.id, name: y.name })));
      setYearName(storedYear || (list[0]?.name ?? ""));
    })();
  }, []);

  useEffect(() => {
    if (!yearName) return;
    setLoading(true);
    setError(null);
    api.get("/timetable/teacher-timetable/me", { params: { academic_year: yearName } })
      .then((res) => setSchedule(res.data.schedule || {}))
      .catch((e) => setError(e?.response?.data?.error || "Could not load your timetable."))
      .finally(() => setLoading(false));
  }, [yearName]);

  const orderedDays = daysFromToday();

  return (
    <div>
      <div className="mb-4 sm:max-w-xs">
        <Field label="School year" htmlFor="my-tt-year">
          <select id="my-tt-year" className="input" value={yearName} onChange={(e) => setYearName(e.target.value)}>
            {academicYears.map((y) => <option key={y.id} value={y.name}>{y.name}</option>)}
          </select>
        </Field>
      </div>

      {loading && <LoadingState label="Loading your timetable…" />}
      {error && <Alert tone="error">{error}</Alert>}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {orderedDays.map((d) => {
            const periods = schedule[d.code] || [];
            return (
              <section key={d.code} className={`card overflow-hidden ${d.isToday ? "ring-2 ring-brand-500/40 border-brand-300" : ""}`}>
                <div className={`flex items-center justify-between gap-2 px-4 py-2.5 border-b ${d.isToday ? "bg-brand-50 border-brand-100" : "bg-slate-50 border-slate-200"}`}>
                  <h3 className="font-semibold text-[15px] text-slate-900">{d.label}</h3>
                  <div className="flex items-center gap-2">
                    {d.isToday && <Badge tone="brand">Today</Badge>}
                    <span className="text-sm text-slate-500">{periods.length} {periods.length === 1 ? "period" : "periods"}</span>
                  </div>
                </div>
                {periods.length === 0 && (
                  <div className="px-4 py-4 text-sm text-slate-500">No classes on this day.</div>
                )}
                <ul className="divide-y divide-slate-100">
                  {periods.map((p, i) => (
                    <li key={i} className="px-4 py-3 flex gap-3">
                      <div className="w-20 flex-shrink-0 text-sm text-slate-500 leading-tight">
                        <div className="font-medium text-slate-800">{formatTime12h(p.start_time)}</div>
                        <div>to {formatTime12h(p.end_time)}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-slate-900">{p.subject_name}</div>
                        <div className="text-sm text-slate-600">Class {p.class_name} {p.section_name}{p.room ? ` · Room ${p.room}` : ""}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------
   Main entry: Timetable
   ------------------------------------------------------------------------- */

type TimetableView = "HOME" | "SUBJECT_TEACHER" | "BUILDER" | "VIEW" | "MY_TIMETABLE";

const INTENT_VIEWS: Record<string, TimetableView> = {
  my: "MY_TIMETABLE", "my-timetable": "MY_TIMETABLE", view: "VIEW", builder: "BUILDER", build: "BUILDER",
  "subject-teacher": "SUBJECT_TEACHER", teachers: "SUBJECT_TEACHER",
};

const Timetable: React.FC = () => {
  const { hasPermission } = useAuth();
  const [view, setView] = useState<TimetableView>("HOME");

  const canSubjectTeacher = hasPermission("academics.timetable.subject-teacher-assignment", "read");
  const canSubjectTeacherWrite = hasPermission("academics.timetable.subject-teacher-assignment", "write");
  const canBuilder = hasPermission("academics.timetable.class-timetable", "read") || hasPermission("academics.timetable.period-structure", "read");
  const canBuilderWrite = hasPermission("academics.timetable.period-structure", "write");
  const canView = hasPermission("academics.timetable.view-timetable", "read");
  const canMyTimetable = hasPermission("academics.timetable.teacher-timetable", "read");

  const allowed: Record<TimetableView, boolean> = {
    HOME: true, SUBJECT_TEACHER: canSubjectTeacher, BUILDER: canBuilder, VIEW: canView, MY_TIMETABLE: canMyTimetable,
  };

  const items = [
    ...(canMyTimetable ? [{ key: "MY_TIMETABLE" as TimetableView, title: "My timetable", hint: "Your classes for each day of the week", icon: <CalendarDays className="w-5 h-5" /> }] : []),
    ...(canView ? [{ key: "VIEW" as TimetableView, title: "See a class timetable", hint: "The week's periods for one class, ready to print", icon: <Eye className="w-5 h-5" /> }] : []),
    ...(canBuilder ? [{ key: "BUILDER" as TimetableView, title: "Build a class timetable", hint: "Set periods, breaks and times for each day", icon: <LayoutGrid className="w-5 h-5" /> }] : []),
    ...(canSubjectTeacher ? [{ key: "SUBJECT_TEACHER" as TimetableView, title: "Choose teachers for subjects", hint: "Who teaches each subject in a class", icon: <Users className="w-5 h-5" /> }] : []),
  ];

  // Open straight on a view when asked (e.g. from Home), or when there is only one thing to do.
  useEffect(() => {
    const intent = consumeIntent("timetable");
    const wanted = intent ? INTENT_VIEWS[intent] : undefined;
    if (wanted && allowed[wanted]) { setView(wanted); return; }
    if (items.length === 1) setView(items[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const titleFor = (v: TimetableView) => ({
    HOME: "Timetable", SUBJECT_TEACHER: "Choose teachers for subjects", BUILDER: "Build a class timetable",
    VIEW: "See a class timetable", MY_TIMETABLE: "My timetable",
  }[v]);

  const hintFor = (v: TimetableView) => ({
    HOME: "",
    SUBJECT_TEACHER: "Choose a class and section, then pick the teacher for each subject.",
    BUILDER: "Choose a class and section, pick a day, then add its periods and breaks.",
    VIEW: "Choose a class and section to see its week.",
    MY_TIMETABLE: "Today is shown first.",
  }[v]);

  return (
    <div className="min-h-full bg-surface-muted p-4 sm:p-6">
      {view === "HOME" ? (
        <>
          <PageHeader
            eyebrow="Academics"
            title="Timetable"
            subtitle="What do you want to do?"
            icon={<CalendarClock className="w-6 h-6" />}
          />
          {items.length > 0 ? (
            <ChoiceList choices={items.map((it) => ({ ...it, onClick: () => setView(it.key) }))} />
          ) : (
            <EmptyState title="You don't have access to the timetable." description="Ask your school admin to give you access." />
          )}
        </>
      ) : (
        <>
          <BackBar
            label={items.length > 1 ? "Timetable" : "Back"}
            title={titleFor(view)}
            hint={hintFor(view)}
            onBack={() => setView("HOME")}
          />
          {view === "SUBJECT_TEACHER" && <SubjectTeacherAssignmentView canWrite={canSubjectTeacherWrite} />}
          {view === "BUILDER" && <TimetableBuilderView canWrite={canBuilderWrite} />}
          {view === "VIEW" && <ViewTimetableView />}
          {view === "MY_TIMETABLE" && <MyTimetableView />}
        </>
      )}
    </div>
  );
};

export default Timetable;
