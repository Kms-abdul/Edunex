"""
Admission enquiry follow-up calls (step 2) + enquiry dashboard + dropdown settings.

Permissions:
  administration.enquiry.followup   read = see the calls list and call history, write = record a call
  administration.enquiry.dashboard  read = see the enquiry dashboard
  administration.enquiry.schemes    write = edit the dropdown lists (Settings) and reopen closed enquiries

The caller is always the logged-in user. Every route works on one branch the user may use.
"""
import os
import re
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from flask import Blueprint, jsonify, request
from sqlalchemy import case, func, or_

from enquiry_models import CALL_SLOTS, FOLLOWUP_OUTCOMES, Enquiry, EnquiryFollowUp, EnquiryOption
from extensions import db, get_now, to_local_time
from helpers import has_permission, token_required
from models import User
from routes.enquiry_routes import PERM_ENQUIRY, PERM_SCHEMES, UserError, parse_date, resolve_branch

bp = Blueprint("enquiry_followup_routes", __name__)

PERM_FOLLOWUP = "administration.enquiry.followup"
PERM_DASHBOARD = "administration.enquiry.dashboard"

OPEN_STATUSES = ("NEW", "FOLLOW_UP")
CLOSING_OUTCOMES = ("NOT_INTERESTED", "WRONG_NUMBER")
OUTCOME_LABELS = {
    "CALL_LATER": "Call me later", "NO_ANSWER": "Not answered", "WILL_VISIT": "Will visit school",
    "JOINED": "Admission confirmed", "NOT_INTERESTED": "Not interested", "WRONG_NUMBER": "Wrong number",
}
DEFAULT_OPTIONS = {
    "REJECT_REASON": ["Fee too high", "Too far / no transport", "Joined another school",
                      "Will join next year", "Not happy with facilities"],
    "BENEFIT": ["Free uniform (2 sets)", "Books at 20% discount", "No admission fee",
                "Free school bag", "Free transport for 1 month"],
}
# "Not interested" can always use this, with the details in the note
OTHER_REASON = "Other"


@bp.errorhandler(UserError)
def _user_error(e):
    return jsonify({"error": e.message, **e.extra}), e.status


def _forbidden():
    return jsonify({"error": "You do not have access to this. Ask your school admin."}), 403


def local_today():
    return to_local_time(get_now()).date()


def local_day_bounds_utc(start, end):
    """[start 00:00, end+1 00:00) in the school's time zone, as naive UTC datetimes (how they are stored)."""
    tz = ZoneInfo(os.environ.get("APP_TIMEZONE", "UTC"))
    utc = ZoneInfo("UTC")
    lo = datetime.combine(start, time.min, tzinfo=tz).astimezone(utc).replace(tzinfo=None)
    hi = datetime.combine(end + timedelta(days=1), time.min, tzinfo=tz).astimezone(utc).replace(tzinfo=None)
    return lo, hi


def _iso_local(dt):
    return to_local_time(dt).isoformat() if dt else None


def _user_names(ids):
    ids = {i for i in ids if i}
    if not ids:
        return {}
    return {u.user_id: u.username for u in User.query.filter(User.user_id.in_(ids)).all()}


# --------------------------------------------------------------------------- dropdown lists
def ensure_default_options(school_id):
    """First use for a school: fill the lists with common choices the admin can change."""
    if EnquiryOption.query.filter_by(school_id=school_id).first():
        return
    for kind, labels in DEFAULT_OPTIONS.items():
        for i, label in enumerate(labels):
            db.session.add(EnquiryOption(school_id=school_id, kind=kind, label=label, display_order=i))
    try:
        db.session.commit()
    except Exception:  # another request seeded at the same moment
        db.session.rollback()


def option_labels(school_id, kind):
    ensure_default_options(school_id)
    rows = (EnquiryOption.query.filter_by(school_id=school_id, kind=kind, is_active=True)
            .order_by(EnquiryOption.display_order, EnquiryOption.id).all())
    return [r.label for r in rows]


def option_dict(o):
    return {"id": o.id, "kind": o.kind, "label": o.label, "display_order": o.display_order, "is_active": bool(o.is_active)}


@bp.route("/api/enquiry/dropdowns", methods=["GET"])
@token_required
def list_dropdowns(current_user):
    if not any(has_permission(current_user, p, "read") for p in (PERM_ENQUIRY, PERM_SCHEMES, PERM_FOLLOWUP)):
        return _forbidden()
    branch = resolve_branch(current_user, request.args.get("branch_id"))
    ensure_default_options(branch.school_id)
    show_all = request.args.get("all") == "1" and has_permission(current_user, PERM_SCHEMES, "write")
    q = EnquiryOption.query.filter_by(school_id=branch.school_id)
    if not show_all:
        q = q.filter_by(is_active=True)
    rows = q.order_by(EnquiryOption.kind, EnquiryOption.display_order, EnquiryOption.id).all()
    return jsonify({
        "reject_reasons": [option_dict(o) for o in rows if o.kind == "REJECT_REASON"],
        "benefits": [option_dict(o) for o in rows if o.kind == "BENEFIT"],
    })


def _clean_label(value):
    label = re.sub(r"\s+", " ", str(value or "")).strip()
    if not 2 <= len(label) <= 150:
        raise UserError("Please type the text (2 to 150 letters).", field="label")
    if label.lower() == OTHER_REASON.lower():
        raise UserError('"Other" is always available. Please type a different reason.', field="label")
    return label


@bp.route("/api/enquiry/dropdowns", methods=["POST"])
@token_required
def add_dropdown(current_user):
    if not has_permission(current_user, PERM_SCHEMES, "write"):
        return _forbidden()
    data = request.get_json(silent=True) or {}
    branch = resolve_branch(current_user, data.get("branch_id"))
    kind = data.get("kind")
    if kind not in ("REJECT_REASON", "BENEFIT"):
        raise UserError("Please choose which list to add to.")
    label = _clean_label(data.get("label"))
    ensure_default_options(branch.school_id)
    existing = EnquiryOption.query.filter(EnquiryOption.school_id == branch.school_id, EnquiryOption.kind == kind,
                                          func.lower(EnquiryOption.label) == label.lower()).first()
    if existing:
        if existing.is_active:
            raise UserError("This is already in the list.", status=409, field="label")
        existing.is_active = True  # switched off earlier: switch it back on
        existing.updated_by = current_user.user_id
        db.session.commit()
        return jsonify({"message": "Added back to the list.", "option": option_dict(existing)})
    last = (db.session.query(func.max(EnquiryOption.display_order))
            .filter_by(school_id=branch.school_id, kind=kind).scalar()) or 0
    o = EnquiryOption(school_id=branch.school_id, kind=kind, label=label, display_order=last + 1,
                      created_by=current_user.user_id)
    db.session.add(o)
    db.session.commit()
    return jsonify({"message": "Added to the list.", "option": option_dict(o)}), 201


@bp.route("/api/enquiry/dropdowns/<int:option_id>", methods=["PUT"])
@token_required
def update_dropdown(current_user, option_id):
    if not has_permission(current_user, PERM_SCHEMES, "write"):
        return _forbidden()
    o = db.session.get(EnquiryOption, option_id)
    data = request.get_json(silent=True) or {}
    branch = resolve_branch(current_user, data.get("branch_id"))
    if not o or o.school_id != branch.school_id:
        raise UserError("This item was not found. Refresh the page.", status=404)
    if "label" in data:
        label = _clean_label(data.get("label"))
        clash = EnquiryOption.query.filter(EnquiryOption.school_id == o.school_id, EnquiryOption.kind == o.kind,
                                           func.lower(EnquiryOption.label) == label.lower(),
                                           EnquiryOption.id != o.id).first()
        if clash:
            raise UserError("This is already in the list.", status=409, field="label")
        o.label = label
    if "is_active" in data:
        o.is_active = bool(data.get("is_active"))
    o.updated_by = current_user.user_id
    db.session.commit()
    return jsonify({"message": "Saved.", "option": option_dict(o)})


# --------------------------------------------------------------------------- calls list
def call_row(e, names):
    return {
        "id": e.id, "enquiry_no": e.enquiry_no, "enquiry_date": e.enquiry_date.isoformat(),
        "academic_year": e.academic_year, "student_name": e.student_name, "guardian_name": e.guardian_name,
        "class_name": e.class_name, "contact": e.contact, "status": e.status,
        "next_call_date": e.next_follow_up_date.isoformat() if e.next_follow_up_date else None,
        "next_call_slot": e.next_call_slot,
        "last_outcome": e.last_outcome, "last_outcome_label": OUTCOME_LABELS.get(e.last_outcome),
        "last_call_at": _iso_local(e.last_call_at), "last_called_by": names.get(e.last_called_by),
        "call_count": e.call_count or 0,
    }


@bp.route("/api/enquiry/calls", methods=["GET"])
@token_required
def calls_list(current_user):
    """Open enquiries to call. bucket=due: overdue + today. bucket=upcoming: the next 7 days."""
    if not has_permission(current_user, PERM_FOLLOWUP, "read"):
        return _forbidden()
    branch = resolve_branch(current_user, request.args.get("branch_id"))
    today = local_today()
    base = Enquiry.query.filter(Enquiry.branch_id == branch.id, Enquiry.status.in_(OPEN_STATUSES),
                                Enquiry.next_follow_up_date.isnot(None))
    if request.args.get("mine") == "1":
        # "My calls": parents I spoke to last, or new enquiries I took myself
        base = base.filter(or_(Enquiry.last_called_by == current_user.user_id,
                               (Enquiry.last_called_by.is_(None)) & (Enquiry.created_by == current_user.user_id)))
    week_end = today + timedelta(days=7)
    counts = {
        "overdue": base.filter(Enquiry.next_follow_up_date < today).count(),
        "today": base.filter(Enquiry.next_follow_up_date == today).count(),
        "upcoming": base.filter(Enquiry.next_follow_up_date > today, Enquiry.next_follow_up_date <= week_end).count(),
    }
    if request.args.get("bucket") == "upcoming":
        q = base.filter(Enquiry.next_follow_up_date > today, Enquiry.next_follow_up_date <= week_end)
    else:
        q = base.filter(Enquiry.next_follow_up_date <= today)
    slot_order = {"MORNING": 0, "AFTERNOON": 1, "EVENING": 2}
    rows = q.order_by(Enquiry.next_follow_up_date, Enquiry.id).limit(300).all()
    rows.sort(key=lambda e: (e.next_follow_up_date, slot_order.get(e.next_call_slot, 3), e.id))
    names = _user_names(e.last_called_by for e in rows)
    return jsonify({"today": today.isoformat(), "counts": counts, "calls": [call_row(e, names) for e in rows]})


# --------------------------------------------------------------------------- record a call
def _clean_next(data, today, required):
    d = parse_date(data.get("next_call_date"), "date")
    slot = data.get("next_call_slot") or None
    if slot is not None and slot not in CALL_SLOTS:
        raise UserError("Please choose Morning, Afternoon or Evening.", field="next_call_slot")
    if required and not d:
        raise UserError("Please choose when to call again.", field="next_call_date")
    if d and d < today:
        raise UserError("The date cannot be in the past.", field="next_call_date")
    if d and d > today + timedelta(days=366):
        raise UserError("Please choose a date within one year.", field="next_call_date")
    return d, slot


@bp.route("/api/enquiry/<int:enquiry_id>/followups", methods=["POST"])
@token_required
def record_call(current_user, enquiry_id):
    if not has_permission(current_user, PERM_FOLLOWUP, "write"):
        return _forbidden()
    e = Enquiry.query.filter_by(id=enquiry_id).with_for_update().first()
    if not e:
        raise UserError("This enquiry was not found.", status=404)
    resolve_branch(current_user, e.branch_id)  # ownership check
    if e.status not in OPEN_STATUSES:
        raise UserError("This enquiry is closed. Ask the admin to reopen it if the parent called back.", status=409)

    data = request.get_json(silent=True) or {}
    outcome = data.get("outcome")
    if outcome not in FOLLOWUP_OUTCOMES:
        raise UserError("Please choose how the call went.", field="outcome")
    today = local_today()
    note = str(data.get("note") or "").strip()[:1000] or None
    reason = None
    next_date, slot = None, None

    if outcome in ("CALL_LATER", "WILL_VISIT"):
        next_date, slot = _clean_next(data, today, required=True)
    elif outcome == "NO_ANSWER":
        next_date, slot = _clean_next(data, today, required=False)
        next_date = next_date or today + timedelta(days=1)
    elif outcome == "NOT_INTERESTED":
        reason = re.sub(r"\s+", " ", str(data.get("reason") or "")).strip()
        allowed = option_labels(e.school_id, "REJECT_REASON") + [OTHER_REASON]
        if reason not in allowed:
            raise UserError("Please choose the reason.", field="reason")
        if reason == OTHER_REASON and not note:
            raise UserError("Please write the reason in the note.", field="note")
    elif outcome == "WRONG_NUMBER":
        reason = "Wrong number"

    now = get_now()
    db.session.add(EnquiryFollowUp(
        school_id=e.school_id, branch_id=e.branch_id, enquiry_id=e.id, called_at=now,
        called_by=current_user.user_id, outcome=outcome, reason=reason, note=note,
        next_call_date=next_date, next_call_slot=slot, created_by=current_user.user_id,
    ))
    e.call_count = (e.call_count or 0) + 1
    e.last_call_at = now
    e.last_called_by = current_user.user_id
    e.last_outcome = outcome
    e.updated_by = current_user.user_id
    if outcome == "JOINED":
        e.status, e.next_follow_up_date, e.next_call_slot = "JOINED", None, None
        e.closed_at, e.close_reason = now, None
    elif outcome in CLOSING_OUTCOMES:
        e.status, e.next_follow_up_date, e.next_call_slot = "CLOSED", None, None
        e.closed_at = now
        e.close_reason = note if reason == OTHER_REASON else reason
    else:
        e.status, e.next_follow_up_date, e.next_call_slot = "FOLLOW_UP", next_date, slot
    db.session.commit()

    messages = {
        "JOINED": "Admission confirmed. Well done!",
        "NOT_INTERESTED": "Saved. The enquiry is closed.",
        "WRONG_NUMBER": "Saved. The enquiry is closed.",
    }
    msg = messages.get(outcome) or f"Saved. Next call on {next_date.strftime('%d %b')}" + (f" ({slot.title()})" if slot else "") + "."
    return jsonify({"message": msg, "call": call_row(e, _user_names([e.last_called_by]))}), 201


@bp.route("/api/enquiry/<int:enquiry_id>/followups", methods=["GET"])
@token_required
def call_history(current_user, enquiry_id):
    if not (has_permission(current_user, PERM_FOLLOWUP, "read") or has_permission(current_user, PERM_ENQUIRY, "read")):
        return _forbidden()
    e = db.session.get(Enquiry, enquiry_id)
    if not e:
        raise UserError("This enquiry was not found.", status=404)
    resolve_branch(current_user, e.branch_id)
    rows = (EnquiryFollowUp.query.filter_by(enquiry_id=e.id)
            .order_by(EnquiryFollowUp.called_at.desc(), EnquiryFollowUp.id.desc()).all())
    names = _user_names(r.called_by for r in rows)
    return jsonify({
        "enquiry": call_row(e, _user_names([e.last_called_by])),
        "close_reason": e.close_reason,
        "can_call": has_permission(current_user, PERM_FOLLOWUP, "write") and e.status in OPEN_STATUSES,
        "can_reopen": has_permission(current_user, PERM_SCHEMES, "write") and e.status not in OPEN_STATUSES,
        "history": [{
            "id": r.id, "called_at": _iso_local(r.called_at), "called_by": names.get(r.called_by),
            "outcome": r.outcome, "outcome_label": OUTCOME_LABELS.get(r.outcome), "reason": r.reason, "note": r.note,
            "next_call_date": r.next_call_date.isoformat() if r.next_call_date else None,
            "next_call_slot": r.next_call_slot,
        } for r in rows],
    })


@bp.route("/api/enquiry/<int:enquiry_id>/reopen", methods=["POST"])
@token_required
def reopen_enquiry(current_user, enquiry_id):
    """Admin only: the parent came back after saying no (or Joined was tapped by mistake)."""
    if not has_permission(current_user, PERM_SCHEMES, "write"):
        return _forbidden()
    e = Enquiry.query.filter_by(id=enquiry_id).with_for_update().first()
    if not e:
        raise UserError("This enquiry was not found.", status=404)
    resolve_branch(current_user, e.branch_id)
    if e.status in OPEN_STATUSES:
        raise UserError("This enquiry is already open.", status=409)
    e.status, e.next_follow_up_date, e.next_call_slot = "FOLLOW_UP", local_today(), None
    e.closed_at = e.close_reason = None
    e.updated_by = current_user.user_id
    db.session.commit()
    return jsonify({"message": "Reopened. It is in today's calls."})


# --------------------------------------------------------------------------- dashboard
def _period(today):
    p = request.args.get("period") or "month"
    if p == "today":
        return today, today
    if p == "week":
        return today - timedelta(days=today.weekday()), today
    if p == "year":
        start = parse_date(request.args.get("from"), "from date")
        return (start or date(today.year if today.month >= 4 else today.year - 1, 4, 1)), today
    if p == "custom":
        start = parse_date(request.args.get("from"), "from date")
        end = parse_date(request.args.get("to"), "to date")
        if not start or not end or end < start:
            raise UserError("Please choose a correct date range.")
        return start, end
    return today.replace(day=1), today


@bp.route("/api/enquiry/dashboard", methods=["GET"])
@token_required
def enquiry_dashboard(current_user):
    if not has_permission(current_user, PERM_DASHBOARD, "read"):
        return _forbidden()
    branch = resolve_branch(current_user, request.args.get("branch_id"))
    today = local_today()
    start, end = _period(today)
    received = Enquiry.query.filter(Enquiry.branch_id == branch.id,
                                    Enquiry.enquiry_date >= start, Enquiry.enquiry_date <= end)
    total = received.count()
    joined = received.filter(Enquiry.status == "JOINED").count()
    by_status = dict(db.session.query(Enquiry.status, func.count(Enquiry.id))
                     .filter(Enquiry.branch_id == branch.id, Enquiry.enquiry_date >= start, Enquiry.enquiry_date <= end)
                     .group_by(Enquiry.status).all())
    visits = received.filter(Enquiry.status == "FOLLOW_UP", Enquiry.last_outcome == "WILL_VISIT").count()

    open_q = Enquiry.query.filter(Enquiry.branch_id == branch.id, Enquiry.status.in_(OPEN_STATUSES))
    reasons = (db.session.query(Enquiry.close_reason, func.count(Enquiry.id))
               .filter(Enquiry.branch_id == branch.id, Enquiry.status == "CLOSED",
                       Enquiry.enquiry_date >= start, Enquiry.enquiry_date <= end)
               .group_by(Enquiry.close_reason).order_by(func.count(Enquiry.id).desc()).all())

    # Calls made in the period: times are stored in UTC, so turn the local days into UTC limits
    start_dt, end_dt = local_day_bounds_utc(start, end)
    callers = (db.session.query(EnquiryFollowUp.called_by, func.count(EnquiryFollowUp.id),
                                func.sum(case((EnquiryFollowUp.outcome == "JOINED", 1), else_=0)))
               .filter(EnquiryFollowUp.branch_id == branch.id,
                       EnquiryFollowUp.called_at >= start_dt, EnquiryFollowUp.called_at < end_dt)
               .group_by(EnquiryFollowUp.called_by).all())
    names = _user_names(c[0] for c in callers)
    calls_made = sum(c[1] for c in callers)

    return jsonify({
        "from": start.isoformat(), "to": end.isoformat(), "today": today.isoformat(),
        "tiles": {
            "enquiries": total,
            "called": received.filter(Enquiry.call_count > 0).count(),
            "not_called": by_status.get("NEW", 0),
            "in_follow_up": by_status.get("FOLLOW_UP", 0),
            "visits_planned": visits,
            "joined": joined,
            "not_interested": by_status.get("CLOSED", 0),
            "joined_percent": round(joined * 100 / total) if total else 0,
            "calls_made": calls_made,
            # Work waiting right now, whatever the period
            "to_call_today": open_q.filter(Enquiry.next_follow_up_date == today).count(),
            "overdue": open_q.filter(Enquiry.next_follow_up_date < today).count(),
        },
        "reasons": [{"reason": r or "Not given", "count": c} for r, c in reasons],
        "callers": sorted(({"name": names.get(uid) or "Unknown", "calls": int(n), "joined": int(j or 0)}
                           for uid, n, j in callers), key=lambda x: -x["calls"]),
    })
