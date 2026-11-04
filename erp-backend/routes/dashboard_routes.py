"""
School overview for the Home dashboard.

GET /api/dashboard/overview
  Headers: X-Academic-Year (required), X-Branch (optional; "All" = every branch the user may see)

Returns one JSON document with the sections the user is allowed to see:
  students, attendance (today), fees, staff (today), upcoming (holidays, birthdays).
Sections the user has no permission for are returned as null.
Uses the same branch rules as the fee reports (routes.report_routes).
"""
from collections import OrderedDict, defaultdict
from datetime import date, timedelta

from flask import Blueprint, jsonify, request
from sqlalchemy import func, extract, or_

from extensions import db
from helpers import token_required, has_permission, get_user_allowed_branches
from models import (Student, StudentFee, FeePayment, Attendance, StaffMaster,
                    AttendanceHead, HolidayCalendar, Branch)

bp = Blueprint("dashboard_routes", __name__)


def _can(user, *codes):
    return any(has_permission(user, c, "read") for c in codes)


def _branch_scope(current_user):
    """Return (branch_names or None for 'no filter', branch_ids or None)."""
    req = request.headers.get("X-Branch") or request.args.get("branch")
    if req in ("All", "AllBranches", "All Branches", ""):
        req = None
    allowed = get_user_allowed_branches(current_user)
    if allowed["is_unlimited"]:
        names = [req] if req else None
    else:
        allowed_names = set(allowed["names"] or [])
        names = [req] if req and req in allowed_names else sorted(allowed_names)
    ids = None
    if names is not None:
        ids = [b.id for b in Branch.query.filter(Branch.branch_name.in_(names)).all()]
    return names, ids


def _money(v):
    return float(round(v or 0, 2))


def _name(first, last):
    return " ".join(p for p in [first, last] if p).strip() or "—"


@bp.route("/api/dashboard/overview", methods=["GET"])
@token_required
def dashboard_overview(current_user):
    year = request.headers.get("X-Academic-Year")
    if not year:
        return jsonify({"error": "Academic Year header is required"}), 400

    try:
        names, branch_ids = _branch_scope(current_user)
        today = date.today()
        month_start = today.replace(day=1)
        all_access = _can(current_user, "home.dashboard.main")

        def student_scope(q):
            q = q.filter(Student.status == "Active")
            if names is not None:
                q = q.filter(Student.branch.in_(names))
            return q

        out = {
            "as_of": today.isoformat(),
            "academic_year": year,
            "branch": names[0] if names and len(names) == 1 else "All branches",
            "students": None, "attendance": None, "fees": None, "staff": None, "upcoming": None,
        }

        # ------------------------------------------------------------ students
        total_students = student_scope(db.session.query(func.count(Student.student_id))).scalar() or 0
        if all_access or _can(current_user, "administration.students.management",
                               "administration.student.student-administration"):
            gender_rows = student_scope(
                db.session.query(func.lower(Student.gender), func.count(Student.student_id))
            ).group_by(func.lower(Student.gender)).all()
            genders = {(g or "").strip(): c for g, c in gender_rows}
            class_rows = student_scope(
                db.session.query(Student.clazz, func.count(Student.student_id))
            ).group_by(Student.clazz).all()
            new_this_month = student_scope(
                db.session.query(func.count(Student.student_id))
            ).filter(Student.admission_date >= month_start).scalar() or 0
            out["students"] = {
                "total": total_students,
                "boys": genders.get("male", 0) + genders.get("boy", 0) + genders.get("m", 0),
                "girls": genders.get("female", 0) + genders.get("girl", 0) + genders.get("f", 0),
                "new_this_month": new_this_month,
                "by_class": [{"class": c or "No class", "count": n} for c, n in class_rows],
            }

        # ---------------------------------------------------------- attendance
        if all_access or _can(current_user, "attendance.attendance.student-attendance"):
            att_q = db.session.query(Attendance.status, func.count(Attendance.id)) \
                .join(Student, Student.student_id == Attendance.student_id) \
                .filter(Attendance.date == today)
            att_q = student_scope(att_q)
            counts = defaultdict(int)
            for status, n in att_q.group_by(Attendance.status).all():
                key = (status or "").strip().lower()
                key = {"p": "present", "a": "absent", "l": "leave"}.get(key, key)
                counts[key] += n
            marked = sum(counts.values())
            present = counts.get("present", 0)
            out["attendance"] = {
                "date": today.isoformat(),
                "total_students": total_students,
                "marked": marked,
                "not_marked": max(0, total_students - marked),
                "present": present,
                "absent": counts.get("absent", 0),
                "leave": counts.get("leave", 0),
                "percent_present": round(present * 100 / marked, 1) if marked else None,
            }

        # ---------------------------------------------------------------- fees
        if all_access or _can(current_user, "fees.collections.receipt-entry", "fees.fee.fee-reports",
                               "fees.fee.take-fee"):
            def pay_scope(q):
                q = q.filter(FeePayment.status == "A")
                if names is not None:
                    q = q.filter(FeePayment.branch.in_(names))
                return q

            def collected(since=None, until=None, session_only=False):
                q = pay_scope(db.session.query(func.coalesce(func.sum(FeePayment.amount_paid), 0)))
                if since:
                    q = q.filter(FeePayment.payment_date >= since)
                if until:
                    q = q.filter(FeePayment.payment_date <= until)
                if session_only:
                    q = q.filter(FeePayment.academic_year == year)
                return _money(q.scalar())

            receipts_today = pay_scope(
                db.session.query(func.count(func.distinct(FeePayment.receipt_no)))
            ).filter(FeePayment.payment_date == today).scalar() or 0

            mode_rows = pay_scope(
                db.session.query(FeePayment.payment_mode, func.coalesce(func.sum(FeePayment.amount_paid), 0))
            ).filter(FeePayment.payment_date == today).group_by(FeePayment.payment_mode).all()

            week_start = today - timedelta(days=6)
            day_rows = pay_scope(
                db.session.query(FeePayment.payment_date, func.coalesce(func.sum(FeePayment.amount_paid), 0))
            ).filter(FeePayment.payment_date >= week_start).group_by(FeePayment.payment_date).all()
            by_day = {d: _money(v) for d, v in day_rows}
            last_7_days = [{"date": (week_start + timedelta(days=i)).isoformat(),
                            "amount": by_day.get(week_start + timedelta(days=i), 0.0)} for i in range(7)]

            due_base = db.session.query(StudentFee) \
                .join(Student, Student.student_id == StudentFee.student_id) \
                .filter(StudentFee.is_active == True, StudentFee.academic_year == year,  # noqa: E712
                        StudentFee.due_amount > 0)
            due_base = student_scope(due_base)
            total_due = _money(due_base.with_entities(func.coalesce(func.sum(StudentFee.due_amount), 0)).scalar())
            overdue_q = due_base.filter(StudentFee.due_date != None, StudentFee.due_date < today)  # noqa: E711
            overdue_amount = _money(overdue_q.with_entities(func.coalesce(func.sum(StudentFee.due_amount), 0)).scalar())
            overdue_students = overdue_q.with_entities(func.count(func.distinct(StudentFee.student_id))).scalar() or 0

            # Latest receipts (one line per receipt)
            recent_rows = pay_scope(
                db.session.query(FeePayment.receipt_no, FeePayment.student_id, FeePayment.payment_mode,
                                 FeePayment.payment_date, FeePayment.class_name, FeePayment.section,
                                 func.coalesce(func.sum(FeePayment.amount_paid), 0).label("amount"),
                                 func.max(FeePayment.id).label("last_id"))
            ).group_by(FeePayment.receipt_no, FeePayment.student_id, FeePayment.payment_mode,
                       FeePayment.payment_date, FeePayment.class_name, FeePayment.section) \
             .order_by(func.max(FeePayment.id).desc()).limit(6).all()
            sids = {r.student_id for r in recent_rows}
            student_names = {s.student_id: _name(s.first_name, s.last_name)
                             for s in Student.query.filter(Student.student_id.in_(sids)).all()} if sids else {}

            out["fees"] = {
                "collected_today": collected(since=today, until=today),
                "receipts_today": receipts_today,
                "collected_this_month": collected(since=month_start, until=today),
                "collected_this_session": collected(session_only=True),
                "total_due": total_due,
                "overdue_amount": overdue_amount,
                "overdue_students": overdue_students,
                "today_by_mode": [{"mode": m or "Other", "amount": _money(a)} for m, a in mode_rows],
                "last_7_days": last_7_days,
                "recent_receipts": [{
                    "receipt_no": r.receipt_no,
                    "student": student_names.get(r.student_id, "—"),
                    "class": " ".join(p for p in [r.class_name, r.section] if p),
                    "amount": _money(r.amount),
                    "mode": r.payment_mode,
                    "date": r.payment_date.isoformat() if r.payment_date else None,
                } for r in recent_rows],
            }

        # --------------------------------------------------------------- staff
        if all_access or _can(current_user, "hr.hr.hr-management", "hr.attendance.summary"):
            staff_q = StaffMaster.query.filter(
                or_(StaffMaster.employment_status == None,  # noqa: E711
                    func.upper(StaffMaster.employment_status) == "ACTIVE"))
            if branch_ids is not None:
                staff_q = staff_q.filter(StaffMaster.branch_id.in_(branch_ids or [-1]))
            staff_ids = [s.id for s in staff_q.with_entities(StaffMaster.id).all()]
            status_counts = defaultdict(int)
            late = 0
            if staff_ids:
                for st, late_min in db.session.query(AttendanceHead.attendance_status, AttendanceHead.late_minutes) \
                        .filter(AttendanceHead.attendance_date == today,
                                AttendanceHead.staff_id.in_(staff_ids)).all():
                    status_counts[st] += 1
                    if (late_min or 0) > 0 and st in ("PRESENT", "HALF_DAY"):
                        late += 1
            present = status_counts.get("PRESENT", 0) + status_counts.get("HALF_DAY", 0)
            recorded = sum(status_counts.values())
            out["staff"] = {
                "total": len(staff_ids),
                "present": present,
                "late": late,
                "on_leave": status_counts.get("LEAVE", 0),
                "absent": status_counts.get("ABSENT", 0),
                "not_recorded": max(0, len(staff_ids) - recorded),
            }

        # ------------------------------------------------------------ upcoming
        hol_q = HolidayCalendar.query.filter(
            HolidayCalendar.active == True,  # noqa: E712
            HolidayCalendar.end_date >= today,
            HolidayCalendar.start_date <= today + timedelta(days=45))
        if branch_ids is not None:
            hol_q = hol_q.filter(or_(HolidayCalendar.branch_id == None,  # noqa: E711
                                     HolidayCalendar.branch_id.in_(branch_ids or [-1])))
        seen = OrderedDict()
        for h in hol_q.order_by(HolidayCalendar.start_date).limit(20).all():
            key = (h.title, h.start_date, h.end_date)
            if key not in seen:
                seen[key] = {"title": h.title, "start": h.start_date.isoformat(), "end": h.end_date.isoformat()}

        bday_students = student_scope(Student.query).filter(
            extract("month", Student.dob) == today.month, extract("day", Student.dob) == today.day
        ).limit(20).all()
        out["upcoming"] = {
            "holidays": list(seen.values())[:5],
            "birthdays_today": [
                {"name": _name(s.first_name, s.last_name), "class": " ".join(p for p in [s.clazz, s.section] if p)}
                for s in bday_students
            ],
        }

        return jsonify(out), 200
    except Exception as e:  # keep the home page usable even if one query fails
        db.session.rollback()
        print(f"[ERROR] dashboard overview failed: {e}")
        return jsonify({"error": "Could not load the school overview"}), 500
