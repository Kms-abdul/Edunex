"""
Student attendance rules: ONE place used by the Attendance Register, report cards,
exports and dashboards, so every screen shows the same numbers.

Rules (agreed with the school):
- Statuses: Present, Absent, Half Day. Half Day = 0.5 present + 0.5 absent.
- Working day = not a holiday / weekly off (branch + class rules), inside the academic
  year, inside the student's own period, and not in the future (the current month only
  counts up to today).
- A student's period starts on their joining (admission) date and ends on the day they
  were made inactive. Days outside the period show "-" and are not counted; a month
  completely outside it shows "-" for the whole month.
- A working day with no mark is shown blank and still counts as a working day
  (it lowers the %, and is listed so it can be fixed).
- % = Present / Working days.

Day codes returned for screens:
  "P" present, "A" absent, "HD" half day, "" not marked (working day),
  "H" holiday / weekly off, "-" outside the student's period, "F" future day.
"""
import calendar
import re
from datetime import date, datetime, timedelta

from flask import g, has_request_context

from extensions import get_now, to_local_time
from models import Branch, ClassMaster, HolidayCalendar, OrgMaster, SchoolAcademicYear, WeeklyOffRule

STATUSES = ("Present", "Absent", "Half Day")
STATUS_CODE = {"Present": "P", "Absent": "A", "Half Day": "HD"}
# Credit each status gives (present, absent)
CREDIT = {"Present": (1.0, 0.0), "Absent": (0.0, 1.0), "Half Day": (0.5, 0.5)}
MONTH_ABBR = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
# Default when neither the school nor the year has dates saved: 1 May - 30 April
# (each school sets its own dates in Setup > School settings > School years).
DEFAULT_START_MONTH = 5


def local_today():
    return to_local_time(get_now()).date()


def normalize_status(value):
    """Accept the stored names and the short codes people type (P, A, HD, Half day...)."""
    v = re.sub(r"[\s_-]+", " ", str(value or "")).strip().lower()
    return {"p": "Present", "present": "Present", "a": "Absent", "absent": "Absent",
            "hd": "Half Day", "half": "Half Day", "half day": "Half Day", "halfday": "Half Day"}.get(v)


def fmt_num(x):
    """20.0 -> 20, 20.5 -> 20.5 (half days)."""
    return int(x) if float(x).is_integer() else round(x, 1)


# --------------------------------------------------------------------------- academic years
def _cache():
    """Small per-request cache (year dates and branch -> school are read many times per request)."""
    if has_request_context():
        if not hasattr(g, "_att_rules_cache"):
            g._att_rules_cache = {}
        return g._att_rules_cache
    return {}


def school_id_for_branch(branch_name_or_id):
    if not branch_name_or_id:
        return None
    cache = _cache()
    key = ("branch_school", branch_name_or_id)
    if key not in cache:
        if isinstance(branch_name_or_id, int):
            b = Branch.query.filter_by(id=branch_name_or_id).first()
        else:
            b = Branch.query.filter((Branch.branch_name == branch_name_or_id) |
                                    (Branch.branch_code == branch_name_or_id)).first()
        cache[key] = b.school_id if b else None
    return cache[key]


def default_year_range(code):
    """Year dates without a school setting: org_master dates, else 1 May .. 30 April."""
    row = OrgMaster.query.filter_by(master_type="ACADEMIC_YEAR", code=code).first()
    if row is not None and getattr(row, "start_date", None) and getattr(row, "end_date", None):
        return row.start_date, row.end_date
    m = re.match(r"^\s*(\d{4})", code or "")
    if not m:
        return None
    y = int(m.group(1))
    return date(y, DEFAULT_START_MONTH, 1), date(y + 1, DEFAULT_START_MONTH, 1) - timedelta(days=1)


def year_range(code, school_id=None):
    """(start, end) of an academic year for a school: the school's own dates first, else the default."""
    if not code:
        return None
    cache = _cache()
    key = ("range", code, school_id)
    if key in cache:
        return cache[key]
    rng = None
    if school_id:
        row = SchoolAcademicYear.query.filter_by(school_id=school_id, academic_year=code).first()
        if row:
            rng = (row.start_date, row.end_date)
    if rng is None:
        rng = default_year_range(code)
    cache[key] = rng
    return rng


def year_for_date(d, fallback=None, school_id=None):
    """The academic year a date belongs to for this school (so a wrong header year cannot mislabel it)."""
    rows = OrgMaster.query.filter_by(master_type="ACADEMIC_YEAR", is_active=True).all()
    for r in rows:
        rng = year_range(r.code, school_id)
        if rng and rng[0] <= d <= rng[1]:
            return r.code
    return fallback


# --------------------------------------------------------------------------- school calendar
class SchoolCalendar:
    """Holidays and weekly offs for one branch + academic year (+ class), loaded once.

    Mirrors routes.config_routes.is_weekoff_or_holiday exactly, but without one database
    query per day (a register for 40 students x 31 days would otherwise be ~1,200 queries).
    """

    def __init__(self, branch_id, academic_year, class_id=None):
        self.branch_id, self.academic_year, self.class_id = branch_id, academic_year, class_id
        wq = WeeklyOffRule.query.filter(WeeklyOffRule.branch_id == branch_id,
                                        WeeklyOffRule.academic_year == academic_year,
                                        WeeklyOffRule.active.is_(True))
        hq = HolidayCalendar.query.filter(HolidayCalendar.branch_id == branch_id,
                                          HolidayCalendar.academic_year == academic_year,
                                          HolidayCalendar.active.is_(True),
                                          # a staff-only holiday is a normal school day for students
                                          HolidayCalendar.holiday_for != "StaffOnly")
        if class_id:
            wq = wq.filter((WeeklyOffRule.class_id == class_id) | (WeeklyOffRule.class_id.is_(None)))
            hq = hq.filter((HolidayCalendar.class_id == class_id) | (HolidayCalendar.class_id.is_(None)))
        self.weekoffs = wq.all() if branch_id else []
        self.holidays = hq.all() if branch_id else []
        self._cache = {}

    def blocked(self, d):
        """Reason text if the day is a weekly off or holiday, else None."""
        if d in self._cache:
            return self._cache[d]
        reason = None
        week_of_month = (d.day - 1) // 7 + 1
        for r in self.weekoffs:
            if r.weekday == d.weekday() and (r.week_number is None or r.week_number == week_of_month):
                reason = "Weekly off"
                break
        if reason is None:
            for h in self.holidays:
                if h.start_date <= d <= h.end_date:
                    reason = f"Holiday: {h.title}" if getattr(h, "title", None) else "Holiday"
                    break
        self._cache[d] = reason
        return reason


def class_id_for(class_name):
    if not class_name:
        return None
    c = ClassMaster.query.filter((ClassMaster.class_name == class_name) |
                                 (ClassMaster.class_name == f"Class {class_name}")).first()
    return c.id if c else None


# --------------------------------------------------------------------------- student period
def student_period(student, academic_year, school_id=None):
    """(first_day, last_day) the student is counted in this academic year, or None."""
    school_id = school_id or school_id_for_branch(getattr(student, "branch", None))
    rng = year_range(academic_year, school_id)
    if not rng:
        return None
    start, end = rng
    joined = getattr(student, "admission_date", None)
    if joined and joined > start:
        start = joined
    if getattr(student, "status", None) == "Inactive" and getattr(student, "inactivated_date", None):
        left = student.inactivated_date
        left = left.date() if isinstance(left, datetime) else left
        if left < end:
            end = left
    return (start, end) if start <= end else None


# --------------------------------------------------------------------------- one month
def month_summary(student, year, month, marks, cal, academic_year, today=None):
    """
    Day codes and totals for one student and month.
    marks: {date: status} for this student (any academic_year label: read by date).
    Returns dict with days, present, absent, working, not_marked, percent; or outside=True.
    """
    today = today or local_today()
    period = student_period(student, academic_year)
    days, present, absent, working, not_marked = {}, 0.0, 0.0, 0, 0
    inside_any = False
    for day in range(1, calendar.monthrange(year, month)[1] + 1):
        d = date(year, month, day)
        key = d.isoformat()
        if not period or d < period[0] or d > period[1]:
            days[key] = "-"
            continue
        inside_any = True
        if cal.blocked(d):
            days[key] = "H"
            continue
        if d > today:
            days[key] = "F"
            continue
        working += 1
        status = marks.get(d)
        if status in CREDIT:
            p, a = CREDIT[status]
            present += p
            absent += a
            days[key] = STATUS_CODE[status]
        else:
            not_marked += 1
            days[key] = ""
    if not inside_any:
        return {"outside": True, "days": days, "present": "-", "absent": "-", "working": "-",
                "not_marked": 0, "percent": None}
    return {
        "outside": False, "days": days,
        "present": fmt_num(present), "absent": fmt_num(absent), "working": working,
        "not_marked": not_marked,
        "percent": round(present * 100 / working, 1) if working else None,
    }


def months_summary(student, months, marks, cal, academic_year, today=None):
    """Several months (report cards). Returns (monthly rows, totals) in the report-card shape."""
    rows, tp, ta, tw = [], 0.0, 0.0, 0
    for (y, m) in sorted({(int(y), int(m)) for (y, m) in months}):
        s = month_summary(student, y, m, marks, cal, academic_year, today)
        abbr = MONTH_ABBR[m]
        if s["outside"] or s["working"] == 0:
            rows.append({"month": abbr, "total": "-", "present": "-", "absent": "-"})
            continue
        rows.append({"month": abbr, "total": s["working"], "present": s["present"], "absent": s["absent"]})
        tp += float(s["present"])
        ta += float(s["absent"])
        tw += s["working"]
    return rows, {"present": fmt_num(tp), "absent": fmt_num(ta), "working": tw}
