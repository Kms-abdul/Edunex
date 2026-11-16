from flask import Blueprint, jsonify, request
from extensions import db, get_today, get_now, to_local_time
from models import WeeklyOffRule, HolidayCalendar, Branch, ClassMaster
from helpers import token_required, require_academic_year, get_default_location, get_user_allowed_branches
from datetime import datetime, date
from sqlalchemy import and_, or_

bp = Blueprint('config_routes', __name__)


# ----------------------------------------------------------
# WEEKDAY HELPERS
# ----------------------------------------------------------
WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
WEEK_LABELS = {None: "Every", 1: "First", 2: "Second", 3: "Third", 4: "Fourth", 5: "Fifth"}


def weekoff_to_dict(rule):
    day_name = WEEKDAY_NAMES[rule.weekday] if 0 <= rule.weekday <= 6 else str(rule.weekday)
    week_label = WEEK_LABELS.get(rule.week_number, f"Week-{rule.week_number}")
    title = f"{week_label} – {day_name}" if rule.week_number else f"All – {day_name}"

    branch = Branch.query.get(rule.branch_id)
    branch_name = branch.branch_name if branch else str(rule.branch_id)

    return {
        "id": rule.id,
        "branch_id": rule.branch_id,
        "branch_name": branch_name,
        "class_id": rule.class_id,
        "weekday": rule.weekday,
        "weekday_name": day_name,
        "week_number": rule.week_number,
        "week_label": week_label,
        "title": title,
        "academic_year": rule.academic_year,
        "active": rule.active,
        "created_at": to_local_time(rule.created_at).isoformat() if rule.created_at else None,
        "updated_at": to_local_time(rule.updated_at).isoformat() if rule.updated_at else None,
        "created_by": rule.created_by,
        "updated_by": rule.updated_by
    }


def holiday_to_dict(h):
    branch = Branch.query.get(h.branch_id)
    branch_name = branch.branch_name if branch else str(h.branch_id)

    return {
        "id": h.id,
        "branch_id": h.branch_id,
        "branch_name": branch_name,
        "class_id": h.class_id,
        "title": h.title,
        "start_date": h.start_date.isoformat() if h.start_date else None,
        "end_date": h.end_date.isoformat() if h.end_date else None,
        "holiday_for": h.holiday_for,
        "description": h.description,
        "display_order": h.display_order,
        "academic_year": h.academic_year,
        "active": h.active,
        "created_at": to_local_time(h.created_at).isoformat() if h.created_at else None,
        "updated_at": to_local_time(h.updated_at).isoformat() if h.updated_at else None,
        "created_by": h.created_by,
        "updated_by": h.updated_by
    }


# ----------------------------------------------------------
# WEEKOFF CRUD
# ----------------------------------------------------------

@bp.route("/api/config/weekoff", methods=["GET"])
@token_required
def get_weekoffs(current_user):
    try:
        h_year, err, code = require_academic_year()
        if err:
            return err, code

        h_branch = request.headers.get("X-Branch") or "Main"
        allowed = get_user_allowed_branches(current_user)

        query = WeeklyOffRule.query.filter_by(academic_year=h_year, active=True)

        # Filter by branch – resolve name to ID
        if h_branch and h_branch not in ("All", "All Branches"):
            branch = Branch.query.filter_by(branch_name=h_branch).first()
            if branch:
                if not allowed['is_unlimited'] and branch.branch_name not in allowed['names']:
                    query = query.filter(WeeklyOffRule.branch_id.in_(list(allowed['ids'])))
                else:
                    query = query.filter_by(branch_id=branch.id)
            else:
                if not allowed['is_unlimited']:
                    query = query.filter(WeeklyOffRule.branch_id.in_(list(allowed['ids'])))
        else:
            if not allowed['is_unlimited']:
                query = query.filter(WeeklyOffRule.branch_id.in_(list(allowed['ids'])))

        rules = query.order_by(WeeklyOffRule.weekday).all()
        return jsonify([weekoff_to_dict(r) for r in rules]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/config/weekoff", methods=["POST"])
@token_required
def create_weekoff(current_user):
    try:
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({"error": "Invalid or missing JSON in request body"}), 400
        h_year, err, code = require_academic_year()
        if err:
            return err, code

        weekday = data.get("weekday")  # 0-6
        week_number = data.get("week_number")  # null/1-5
        branch_id = data.get("branch_id")

        if weekday is None or branch_id is None:
            return jsonify({"error": "weekday and branch_id are required"}), 400

        # Check permissions
        allowed = get_user_allowed_branches(current_user)
        if not allowed['is_unlimited'] and branch_id not in allowed['ids']:
             return jsonify({"error": "Unauthorized branch access"}), 403

        if not (0 <= weekday <= 6):
            return jsonify({"error": "weekday must be 0-6"}), 400

        if week_number is not None and not (1 <= week_number <= 5):
            return jsonify({"error": "week_number must be 1-5 or null"}), 400

        # Check duplicate (include class_id in the filter)
        class_id = data.get("class_id")
        existing = WeeklyOffRule.query.filter_by(
            branch_id=branch_id,
            class_id=class_id,
            weekday=weekday,
            week_number=week_number,
            academic_year=h_year,
            active=True
        ).first()

        if existing:
            return jsonify({"error": "This weekoff rule already exists"}), 409

        rule = WeeklyOffRule(
            branch_id=branch_id,
            class_id=class_id,
            weekday=weekday,
            week_number=week_number,
            academic_year=h_year,
            active=True,
            created_at=get_now()
        )
        db.session.add(rule)
        db.session.commit()

        return jsonify({"message": "Weekoff rule created", "rule": weekoff_to_dict(rule)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@bp.route("/api/config/weekoff/<int:id>", methods=["DELETE"])
@token_required
def delete_weekoff(current_user, id):
    try:
        rule = WeeklyOffRule.query.get(id)
        if not rule:
            return jsonify({"error": "Rule not found"}), 404

        # Check permissions
        allowed = get_user_allowed_branches(current_user)
        if not allowed['is_unlimited'] and rule.branch_id not in allowed['ids']:
             return jsonify({"error": "Unauthorized branch access"}), 403

        db.session.delete(rule)
        db.session.commit()
        return jsonify({"message": "Weekoff rule deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------------------------------------------------
# HOLIDAY CRUD
# ----------------------------------------------------------

@bp.route("/api/config/holiday", methods=["GET"])
@token_required
def get_holidays(current_user):
    try:
        h_year, err, code = require_academic_year()
        if err:
            return err, code

        h_branch = request.headers.get("X-Branch") or "Main"
        allowed = get_user_allowed_branches(current_user)

        query = HolidayCalendar.query.filter_by(academic_year=h_year, active=True)

        if h_branch and h_branch not in ("All", "All Branches"):
            branch = Branch.query.filter_by(branch_name=h_branch).first()
            if branch:
                if not allowed['is_unlimited'] and branch.branch_name not in allowed['names']:
                    query = query.filter(HolidayCalendar.branch_id.in_(list(allowed['ids'])))
                else:
                    query = query.filter_by(branch_id=branch.id)
            else:
                if not allowed['is_unlimited']:
                    query = query.filter(HolidayCalendar.branch_id.in_(list(allowed['ids'])))
        else:
            if not allowed['is_unlimited']:
                query = query.filter(HolidayCalendar.branch_id.in_(list(allowed['ids'])))

        holidays = query.order_by(HolidayCalendar.display_order, HolidayCalendar.start_date).all()
        return jsonify([holiday_to_dict(h) for h in holidays]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/config/holiday", methods=["POST"])
@token_required
def create_holiday(current_user):
    try:
        data = request.json
        h_year, err, code = require_academic_year()
        if err:
            return err, code

        title = data.get("title")
        start_date = data.get("start_date")
        end_date = data.get("end_date")
        branch_id = data.get("branch_id")

        if not all([title, start_date, end_date, branch_id]):
            return jsonify({"error": "title, start_date, end_date, branch_id are required"}), 400

        # Check permissions
        allowed = get_user_allowed_branches(current_user)
        if not allowed['is_unlimited'] and branch_id not in allowed['ids']:
             return jsonify({"error": "Unauthorized branch access"}), 403

        try:
            s_date = datetime.strptime(start_date, "%Y-%m-%d").date()
            e_date = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

        if e_date < s_date:
            return jsonify({"error": "end_date cannot be before start_date"}), 400

        holiday = HolidayCalendar(
            branch_id=branch_id,
            class_id=data.get("class_id"),
            title=title,
            start_date=s_date,
            end_date=e_date,
            holiday_for=data.get("holiday_for", "All"),
            description=data.get("description"),
            display_order=data.get("display_order"),
            academic_year=h_year,
            active=True,
            created_at=get_now()
        )
        db.session.add(holiday)
        db.session.commit()

        return jsonify({"message": "Holiday created", "holiday": holiday_to_dict(holiday)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@bp.route("/api/config/holiday/<int:id>", methods=["PUT"])
@token_required
def update_holiday(current_user, id):
    try:
        holiday = HolidayCalendar.query.get(id)
        if not holiday:
            return jsonify({"error": "Holiday not found"}), 404

        # Check permissions
        allowed = get_user_allowed_branches(current_user)
        if not allowed['is_unlimited'] and holiday.branch_id not in allowed['ids']:
             return jsonify({"error": "Unauthorized branch access"}), 403

        data = request.json

        if "title" in data:
            holiday.title = data["title"]
        
        # Parse and validate dates with try/except for each field
        try:
            if "start_date" in data:
                holiday.start_date = datetime.strptime(data["start_date"], "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Invalid start_date format. Use YYYY-MM-DD"}), 400
        
        try:
            if "end_date" in data:
                holiday.end_date = datetime.strptime(data["end_date"], "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Invalid end_date format. Use YYYY-MM-DD"}), 400
        
        # Validate date range: end_date >= start_date
        # Use provided values if available, otherwise use existing values
        start = holiday.start_date
        end = holiday.end_date
        if end < start:
            return jsonify({"error": "end_date cannot be before start_date"}), 400
        
        if "holiday_for" in data:
            holiday.holiday_for = data["holiday_for"]
        if "description" in data:
            holiday.description = data["description"]
        if "display_order" in data:
            holiday.display_order = data["display_order"]

        db.session.commit()
        return jsonify({"message": "Holiday updated", "holiday": holiday_to_dict(holiday)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


@bp.route("/api/config/holiday/<int:id>", methods=["DELETE"])
@token_required
def delete_holiday(current_user, id):
    try:
        holiday = HolidayCalendar.query.get(id)
        if not holiday:
            return jsonify({"error": "Holiday not found"}), 404

        # Check permissions
        allowed = get_user_allowed_branches(current_user)
        if not allowed['is_unlimited'] and holiday.branch_id not in allowed['ids']:
             return jsonify({"error": "Unauthorized branch access"}), 403

        db.session.delete(holiday)
        db.session.commit()
        return jsonify({"message": "Holiday deleted"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------------------------------------------------
# CHECK DATE UTILITY
# ----------------------------------------------------------

@bp.route("/api/config/check-date", methods=["POST"])
@token_required
def check_date(current_user):
    """
    Check if a given date is a weekoff or holiday.
    Body: { "date": "YYYY-MM-DD", "branch_id": int, "class_name": str (optional) }
    Or:   { "date": "YYYY-MM-DD", "branch_name": str, "class_name": str (optional) }
    Returns: { "is_weekoff": bool, "is_holiday": bool, "reason": str }
    """
    try:
        data = request.json
        h_year, err, code = require_academic_year()
        if err:
            return err, code

        check_date_str = data.get("date")
        branch_id = data.get("branch_id")
        branch_name = data.get("branch_name")
        class_name = data.get("class_name")

        if not check_date_str:
            return jsonify({"error": "date is required"}), 400

        # Resolve branch
        if not branch_id and branch_name and branch_name not in ("All", "All Branches"):
            branch_obj = Branch.query.filter_by(branch_name=branch_name).first()
            if branch_obj:
                branch_id = branch_obj.id
        if not branch_id:
            # Try from header
            h_branch = request.headers.get("X-Branch")
            if h_branch and h_branch not in ("All", "All Branches"):
                branch_obj = Branch.query.filter_by(branch_name=h_branch).first()
                if branch_obj:
                    branch_id = branch_obj.id

        if not branch_id:
            if branch_name in ("All", "All Branches") or request.headers.get("X-Branch") in ("All", "All Branches"):
                return jsonify({"is_weekoff": False, "is_holiday": False, "reason": ""}), 200
            return jsonify({"error": "branch_id or branch_name is required"}), 400

        # Check permissions
        allowed = get_user_allowed_branches(current_user)
        if not allowed['is_unlimited'] and branch_id not in allowed['ids']:
             return jsonify({"error": "Unauthorized branch access"}), 403

        # Resolve class
        class_id = None
        if class_name:
            cls = ClassMaster.query.filter_by(class_name=class_name).first()
            if cls:
                class_id = cls.id

        try:
            d = datetime.strptime(check_date_str, "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Invalid date format"}), 400

        result = is_weekoff_or_holiday(d, branch_id, h_year, class_id=class_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/config/check-month", methods=["POST"])
@token_required
def check_month(current_user):
    """
    Check all dates in a month for weekoffs/holidays.
    Body: { "month": 1-12, "year": int, "branch_name": str, "class_name": str (optional) }
    Returns: { "blocked_dates": { "YYYY-MM-DD": "reason", ... } }
    """
    try:
        data = request.json
        h_year, err, code = require_academic_year()
        if err:
            return err, code

        month = data.get("month")
        year = data.get("year")
        branch_name = data.get("branch_name")
        class_name = data.get("class_name")

        if not month or not year:
            return jsonify({"error": "month and year are required"}), 400

        # Resolve branch
        branch_id = None
        if branch_name and branch_name not in ("All", "All Branches"):
            branch_obj = Branch.query.filter_by(branch_name=branch_name).first()
            if branch_obj:
                branch_id = branch_obj.id
        if not branch_id:
            h_branch = request.headers.get("X-Branch")
            if h_branch and h_branch not in ("All", "All Branches"):
                branch_obj = Branch.query.filter_by(branch_name=h_branch).first()
                if branch_obj:
                    branch_id = branch_obj.id

        if not branch_id:
            if branch_name in ("All", "All Branches") or request.headers.get("X-Branch") in ("All", "All Branches"):
                return jsonify({"blocked_dates": {}}), 200
            return jsonify({"error": "branch_name is required"}), 400

        # Check permissions
        allowed = get_user_allowed_branches(current_user)
        if not allowed['is_unlimited'] and branch_id not in allowed['ids']:
             return jsonify({"error": "Unauthorized branch access"}), 403

        # Resolve class
        class_id = None
        if class_name:
            cls = ClassMaster.query.filter_by(class_name=class_name).first()
            if cls:
                class_id = cls.id

        import calendar
        days_in_month = calendar.monthrange(year, month)[1]
        blocked_dates = {}

        for day in range(1, days_in_month + 1):
            d = date(year, month, day)
            result = is_weekoff_or_holiday(d, branch_id, h_year, class_id=class_id)
            if result["is_weekoff"] or result["is_holiday"]:
                blocked_dates[d.isoformat()] = result["reason"]

        return jsonify({"blocked_dates": blocked_dates}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def is_weekoff_or_holiday(check_date, branch_id, academic_year, class_id=None):
    """
    Utility function to check if a date is a weekoff or holiday.
    If class_id is provided, matches rules for that specific class OR rules with class_id=NULL (All Classes).
    Returns dict: { is_weekoff, is_holiday, reason }
    """
    # Check weekoff
    weekday = check_date.weekday()  # 0=Monday ... 6=Sunday

    # Calculate which week of month (1-5)
    day = check_date.day
    week_of_month = (day - 1) // 7 + 1

    weekoff_query = WeeklyOffRule.query.filter(
        WeeklyOffRule.branch_id == branch_id,
        WeeklyOffRule.weekday == weekday,
        WeeklyOffRule.academic_year == academic_year,
        WeeklyOffRule.active == True
    )
    # Filter by class: match specific class OR class_id IS NULL (All Classes)
    if class_id:
        weekoff_query = weekoff_query.filter(
            or_(WeeklyOffRule.class_id == class_id, WeeklyOffRule.class_id == None)
        )

    weekoff_rules = weekoff_query.all()

    is_weekoff = False
    weekoff_reason = ""
    for rule in weekoff_rules:
        if rule.week_number is None:
            # "Every" rule
            is_weekoff = True
            weekoff_reason = f"Weekly off: Every {WEEKDAY_NAMES[weekday]}"
            break
        elif rule.week_number == week_of_month:
            is_weekoff = True
            weekoff_reason = f"Weekly off: {WEEK_LABELS[rule.week_number]} {WEEKDAY_NAMES[weekday]}"
            break

    # Check holiday
    holiday_query = HolidayCalendar.query.filter(
        HolidayCalendar.branch_id == branch_id,
        # Student attendance: a staff-only holiday is a normal school day for students
        HolidayCalendar.holiday_for != "StaffOnly",
        HolidayCalendar.start_date <= check_date,
        HolidayCalendar.end_date >= check_date,
        HolidayCalendar.academic_year == academic_year,
        HolidayCalendar.active == True
    )
    # Filter by class: match specific class OR class_id IS NULL (All Classes)
    if class_id:
        holiday_query = holiday_query.filter(
            or_(HolidayCalendar.class_id == class_id, HolidayCalendar.class_id == None)
        )

    holidays = holiday_query.all()

    is_holiday = len(holidays) > 0
    holiday_reason = ""
    if is_holiday:
        holiday_reason = f"Holiday: {holidays[0].title}"

    reason = weekoff_reason or holiday_reason or ""

    return {
        "is_weekoff": is_weekoff,
        "is_holiday": is_holiday,
        "reason": reason
    }


# ======================================================================
# SCHOOL YEARS: each school's own start and end date for each academic year
# ======================================================================
PERM_CONFIG = "setup.school-setup.configuration"


def _allowed_school_ids(user):
    from helpers import get_user_allowed_schools
    allowed = get_user_allowed_schools(user)
    return None if allowed["is_unlimited"] else set(allowed["ids"] or [])


def _resolve_school(user, raw):
    """The school whose years are shown / changed; must be one the user may use."""
    from flask import g
    from models import School
    school_id = None
    if raw not in (None, "", "all", "All"):
        try:
            school_id = int(raw)
        except (TypeError, ValueError):
            school_id = None
    school_id = school_id or getattr(g, "school_id", None) or getattr(user, "school_id", None) \
        or getattr(user, "default_school_id", None)
    allowed = _allowed_school_ids(user)
    if not school_id:
        # No school chosen (e.g. "All schools"): start with the first school this user can manage
        q = School.query.filter_by(is_active=True)
        if allowed is not None:
            q = q.filter(School.id.in_(list(allowed) or [-1]))
        first = q.order_by(School.school_name).first()
        school_id = first.id if first else None
    school = School.query.filter_by(id=school_id).first() if school_id else None
    if not school or (allowed is not None and school.id not in allowed):
        return None
    return school


def _years_payload(school):
    from models import OrgMaster, SchoolAcademicYear
    from services.student_attendance import default_year_range
    own = {r.academic_year: r for r in SchoolAcademicYear.query.filter_by(school_id=school.id).all()}
    out = []
    for y in OrgMaster.query.filter_by(master_type="ACADEMIC_YEAR", is_active=True).order_by(OrgMaster.code.desc()).all():
        row = own.get(y.code)
        d_start, d_end = default_year_range(y.code) or (None, None)
        out.append({
            "code": y.code, "name": y.display_name or y.code,
            "start_date": (row.start_date if row else d_start).isoformat() if (row or d_start) else None,
            "end_date": (row.end_date if row else d_end).isoformat() if (row or d_end) else None,
            "is_custom": bool(row),
            "default_start": d_start.isoformat() if d_start else None,
            "default_end": d_end.isoformat() if d_end else None,
        })
    return out


@bp.route("/api/config/academic-years", methods=["GET"])
@token_required
def list_school_years(current_user):
    from helpers import has_permission
    from models import School
    if not has_permission(current_user, PERM_CONFIG, "read"):
        return jsonify({"error": "You do not have access to this. Ask your school admin."}), 403
    allowed = _allowed_school_ids(current_user)
    q = School.query.filter_by(is_active=True)
    if allowed is not None:
        q = q.filter(School.id.in_(list(allowed)))
    school = _resolve_school(current_user, request.args.get("school_id"))
    return jsonify({
        "schools": [{"id": s.id, "name": s.school_name} for s in q.order_by(School.school_name).all()],
        "school_id": school.id if school else None,
        "years": _years_payload(school) if school else [],
        "can_edit": has_permission(current_user, PERM_CONFIG, "write"),
    })


def _relabel_attendance(school_id):
    """After a school's year dates change, file each attendance day under the year its date now belongs to."""
    from models import Attendance, Branch, OrgMaster, Student
    from services.student_attendance import year_range
    branches = [b.branch_name for b in Branch.query.filter_by(school_id=school_id).all()]
    if not branches:
        return 0
    student_ids = [sid for (sid,) in db.session.query(Student.student_id).filter(Student.branch.in_(branches)).all()]
    if not student_ids:
        return 0
    fixed = 0
    for y in OrgMaster.query.filter_by(master_type="ACADEMIC_YEAR", is_active=True).all():
        rng = year_range(y.code, school_id)
        if not rng:
            continue
        for i in range(0, len(student_ids), 500):
            fixed += Attendance.query.filter(
                Attendance.student_id.in_(student_ids[i:i + 500]),
                Attendance.date >= rng[0], Attendance.date <= rng[1],
                or_(Attendance.academic_year.is_(None), Attendance.academic_year != y.code),
            ).update({Attendance.academic_year: y.code}, synchronize_session=False)
    return fixed


@bp.route("/api/config/academic-years/<path:code>", methods=["PUT", "DELETE"])
@token_required
def save_school_year(current_user, code):
    """PUT: set this school's dates for the year. DELETE: go back to the default dates."""
    from flask import g
    from helpers import has_permission
    from models import OrgMaster, SchoolAcademicYear
    from services.student_attendance import year_range
    if not has_permission(current_user, PERM_CONFIG, "write"):
        return jsonify({"error": "You do not have access to change this. Ask your school admin."}), 403
    data = request.get_json(silent=True) or {}
    school = _resolve_school(current_user, data.get("school_id") or request.args.get("school_id"))
    if not school:
        return jsonify({"error": "Please choose a school."}), 400
    if not OrgMaster.query.filter_by(master_type="ACADEMIC_YEAR", code=code).first():
        return jsonify({"error": "This school year was not found."}), 404
    row = SchoolAcademicYear.query.filter_by(school_id=school.id, academic_year=code).first()

    if request.method == "DELETE":
        if row:
            db.session.delete(row)
            db.session.flush()
    else:
        try:
            start = datetime.strptime(str(data.get("start_date"))[:10], "%Y-%m-%d").date()
            end = datetime.strptime(str(data.get("end_date"))[:10], "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Please choose the first and the last day of the year."}), 400
        days = (end - start).days
        if days <= 0:
            return jsonify({"error": "The last day must be after the first day."}), 400
        if not 180 <= days <= 400:
            return jsonify({"error": "A school year should be between 6 and 13 months long. Please check the dates."}), 400
        # Must not overlap this school's other years (a day can only belong to one year)
        for other in OrgMaster.query.filter_by(master_type="ACADEMIC_YEAR", is_active=True).all():
            if other.code == code:
                continue
            rng = year_range(other.code, school.id)
            if rng and start <= rng[1] and end >= rng[0]:
                return jsonify({"error": f"These dates overlap {other.display_name or other.code} "
                                         f"({rng[0].strftime('%d %b %Y')} - {rng[1].strftime('%d %b %Y')}). "
                                         "Change that year first."}), 409
        if row is None:
            row = SchoolAcademicYear(school_id=school.id, academic_year=code, created_by=current_user.user_id)
            db.session.add(row)
        row.start_date, row.end_date = start, end
        row.updated_by = current_user.user_id
        db.session.flush()
    if hasattr(g, "_att_rules_cache"):
        g._att_rules_cache = {}
    fixed = _relabel_attendance(school.id)
    db.session.commit()
    msg = "Saved." if request.method == "PUT" else "Back to the default dates."
    if fixed:
        msg += f" {fixed} attendance day{'s' if fixed != 1 else ''} moved to the right school year."
    return jsonify({"message": msg, "years": _years_payload(school), "relabelled": fixed})


@bp.route("/api/config/academic-years/pattern", methods=["POST"])
@token_required
def set_school_year_pattern(current_user):
    """Most schools start every year on the same day (e.g. 1 June): set all years at once.
    Year '2026-2027' then runs 1 Jun 2026 - 31 May 2027, and so on."""
    import re as _re
    from datetime import timedelta
    from flask import g
    from helpers import has_permission
    from models import OrgMaster, SchoolAcademicYear
    if not has_permission(current_user, PERM_CONFIG, "write"):
        return jsonify({"error": "You do not have access to change this. Ask your school admin."}), 403
    data = request.get_json(silent=True) or {}
    school = _resolve_school(current_user, data.get("school_id"))
    if not school:
        return jsonify({"error": "Please choose a school."}), 400
    try:
        month, day = int(data.get("start_month")), int(data.get("start_day") or 1)
        if not 1 <= month <= 12 or not 1 <= day <= 28:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "Please choose the month and a day between 1 and 28."}), 400
    count = 0
    for y in OrgMaster.query.filter_by(master_type="ACADEMIC_YEAR", is_active=True).all():
        m = _re.match(r"^\s*(\d{4})", y.code or "")
        if not m:
            continue
        first = int(m.group(1))
        start = date(first, month, day)
        end = date(first + 1, month, day) - timedelta(days=1)
        row = SchoolAcademicYear.query.filter_by(school_id=school.id, academic_year=y.code).first()
        if row is None:
            row = SchoolAcademicYear(school_id=school.id, academic_year=y.code, created_by=current_user.user_id)
            db.session.add(row)
        row.start_date, row.end_date = start, end
        row.updated_by = current_user.user_id
        count += 1
    db.session.flush()
    if hasattr(g, "_att_rules_cache"):
        g._att_rules_cache = {}
    fixed = _relabel_attendance(school.id)
    db.session.commit()
    msg = f"{count} school year{'s' if count != 1 else ''} updated."
    if fixed:
        msg += f" {fixed} attendance day{'s' if fixed != 1 else ''} moved to the right school year."
    return jsonify({"message": msg, "years": _years_payload(school), "relabelled": fixed})
