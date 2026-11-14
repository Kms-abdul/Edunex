"""
Admission enquiry API (front-office "Enquiry" module, step 1).

Permissions (see permission_catalog.py):
  administration.enquiry.enquiry  read  = see enquiries, fee preview, earlier-visit check
                                  write = save a new enquiry
  administration.enquiry.schemes  read  = see schemes, write = add / change / copy schemes

Every route works on ONE branch, which must be inside the user's allowed branches.
Aadhaar travels only in POST bodies, is stored encrypted + as a keyed fingerprint,
and is only ever returned masked (last 4 digits).
"""
import hashlib
import hmac
import os
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from flask import Blueprint, current_app, g, jsonify, request
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError

from crypto_utils import encrypt_secret
from enquiry_models import AdmissionScheme, Enquiry, EnquirySequence
from extensions import db, get_now, get_today, limiter
from helpers import generate_installments, get_user_allowed_branches, has_permission, token_required
from models import (Branch, ClassDisplayOrder, ClassFeeStructure, ClassMaster, ClassSection,
                    FeeType, OrgMaster, School, Student)

bp = Blueprint("enquiry_routes", __name__)

PERM_ENQUIRY = "administration.enquiry.enquiry"
PERM_SCHEMES = "administration.enquiry.schemes"
PAGE_SIZE = 20


# --------------------------------------------------------------------------- errors
class UserError(Exception):
    """A problem the user can fix; the message is shown as-is."""

    def __init__(self, message, status=400, **extra):
        super().__init__(message)
        self.message = message
        self.status = status
        self.extra = extra


@bp.errorhandler(UserError)
def _user_error(e):
    return jsonify({"error": e.message, **e.extra}), e.status


def _forbidden():
    return jsonify({"error": "You do not have access to this. Ask your school admin."}), 403


# --------------------------------------------------------------------------- input checks
_NAME_RE = re.compile(r"[^\W\d_]+(?:[ .'\-]+[^\W\d_]+)*\.?")

# Verhoeff tables (Aadhaar check digit) — catches most typing mistakes
_V_D = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
        [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
        [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
        [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]]
_V_P = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
        [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
        [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]]


def _verhoeff_ok(num: str) -> bool:
    c = 0
    for i, ch in enumerate(reversed(num)):
        c = _V_D[c][_V_P[i % 8][int(ch)]]
    return c == 0


def clean_name(value, label):
    v = re.sub(r"\s+", " ", str(value or "")).strip()
    if len(v) < 2:
        raise UserError(f"Please type the {label}.", field=label)
    if len(v) > 100 or not _NAME_RE.fullmatch(v):
        raise UserError(f"The {label} can only have letters, spaces and dots.", field=label)
    return v


def clean_phone(value, required=True):
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if not digits and not required:
        return None
    if not re.fullmatch(r"[6-9]\d{9}", digits):
        raise UserError("Please type a 10-digit mobile number.", field="contact")
    return digits


def clean_aadhaar(value):
    """12 digits, not starting with 0 or 1. A failed check digit is only a warning
    (shown on the form): the front desk must be able to save what the parent gives."""
    digits = re.sub(r"\D", "", str(value or ""))
    if not digits:
        return None
    if len(digits) != 12:
        raise UserError("Aadhaar has 12 digits. Please check the number, or leave it empty.", field="aadhaar")
    if digits[0] in "01":
        raise UserError("An Aadhaar number never starts with 0 or 1. Please check the number.", field="aadhaar")
    return digits


def aadhaar_fingerprint(digits):
    """Keyed hash so the same Aadhaar can be found without decrypting anything."""
    key = os.environ.get("FERNET_KEY") or current_app.config["SECRET_KEY"]
    return hmac.new(key.encode(), f"aadhaar:{digits}".encode(), hashlib.sha256).hexdigest()


def mask_aadhaar(last4):
    return f"XXXX XXXX {last4}" if last4 else None


def parse_date(value, label):
    if value in (None, ""):
        return None
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except ValueError:
        raise UserError(f"Please choose a correct {label}.")


def _money(v):
    return float(round(Decimal(v or 0), 2))


# --------------------------------------------------------------------------- scope
def resolve_branch(user, raw=None):
    """The one branch this request works on; must be one the user may use."""
    raw = raw if raw not in (None, "", "All", "all") else None
    branch_id = None
    if raw is not None:
        try:
            branch_id = int(raw)
        except (TypeError, ValueError):
            raise UserError("Please choose a branch.")
    else:
        branch_id = getattr(g, "branch_id", None)
    if not branch_id:
        raise UserError("Please choose a branch first.", code="choose_branch")
    branch = Branch.query.filter_by(id=branch_id, is_active=True).first()
    allowed = get_user_allowed_branches(user)
    if not branch or (not allowed["is_unlimited"] and branch.id not in (allowed["ids"] or set())):
        raise UserError("You do not have access to this branch.", status=403)
    return branch


def active_years():
    rows = OrgMaster.query.filter_by(master_type="ACADEMIC_YEAR", is_active=True).order_by(OrgMaster.code.desc()).all()
    return [{"code": r.code, "name": r.display_name or r.code} for r in rows]


def resolve_year(raw):
    year = str(raw or "").strip()
    if not year or year not in {y["code"] for y in active_years()}:
        raise UserError("Please choose the academic year.", field="academic_year")
    return year


def branch_classes(branch):
    """Classes that have sections in this branch (any year), in the branch's display order."""
    rows = (db.session.query(ClassMaster.class_name, func.min(ClassDisplayOrder.display_order))
            .join(ClassSection, ClassSection.class_id == ClassMaster.id)
            .outerjoin(ClassDisplayOrder, (ClassDisplayOrder.class_id == ClassMaster.id)
                       & (ClassDisplayOrder.branch_id == branch.id))
            .filter(ClassSection.branch_id == branch.id)
            .group_by(ClassMaster.class_name)
            .all())
    rows.sort(key=lambda r: (r[1] if r[1] is not None else 10_000, r[0]))
    return [r[0] for r in rows]


# --------------------------------------------------------------------------- fee quote
def tuition_rows(branch, year, class_name, fee_type_name):
    """Class fee rows of the tuition fee type: this branch's rows, else school-wide ('All') rows."""
    if not fee_type_name:
        return []
    base = (ClassFeeStructure.query.join(FeeType, FeeType.id == ClassFeeStructure.feetypeid)
            .filter(ClassFeeStructure.clazz == class_name,
                    ClassFeeStructure.academic_year == year,
                    func.lower(FeeType.feetype) == fee_type_name.strip().lower()))
    for level in (branch.branch_name, "All"):
        rows = base.filter(ClassFeeStructure.branch == level).all()
        if rows:
            return rows
    return []


def tuition_fee(branch, year, class_name, fee_type_name):
    rows = tuition_rows(branch, year, class_name, fee_type_name)
    return sum((Decimal(r.totalamount or 0) for r in rows), Decimal("0")) if rows else None


def tuition_installments(rows):
    """Installment split exactly as the Fees module shows it (same helper, same titles)."""
    out = []
    for fs in rows:
        for inst in generate_installments(fs):
            out.append({"name": inst["month"], "amount": _money(inst["amount"])})
    return out


def scheme_discount(scheme, fee):
    if fee is None or scheme.discount_type == "NONE":
        return None
    value = Decimal(scheme.discount_value or 0)
    off = fee * value / Decimal(100) if scheme.discount_type == "PERCENT" else value
    return min(off, fee).quantize(Decimal("0.01"))


def offer_schemes(branch, year, on_date):
    """Active schemes still open on this date (expired ones are not offered)."""
    q = AdmissionScheme.query.filter(AdmissionScheme.branch_id == branch.id,
                                     AdmissionScheme.academic_year == year,
                                     AdmissionScheme.is_active.is_(True),
                                     or_(AdmissionScheme.valid_to.is_(None), AdmissionScheme.valid_to >= on_date))
    return q.order_by(AdmissionScheme.display_order, AdmissionScheme.id).all()


def build_quote(branch, year, class_name, on_date):
    schemes = offer_schemes(branch, year, on_date)
    fee_type = schemes[0].tuition_fee_type if schemes else None
    if not fee_type:  # no scheme yet: fall back to a fee type called "...tuition..."
        ft = (FeeType.query.filter(FeeType.academic_year == year,
                                   FeeType.feetype.ilike("%tuition%"),
                                   or_(FeeType.branch == branch.branch_name, FeeType.branch == "All"))
              .order_by(FeeType.id).first())
        fee_type = ft.feetype if ft else None
    rows = tuition_rows(branch, year, class_name, fee_type)
    fee = sum((Decimal(r.totalamount or 0) for r in rows), Decimal("0")) if rows else None

    out = []
    for s in schemes:
        s_fee = fee if s.tuition_fee_type.strip().lower() == (fee_type or "").strip().lower() \
            else tuition_fee(branch, year, class_name, s.tuition_fee_type)
        off = scheme_discount(s, s_fee)
        out.append({
            "name": s.name,
            "valid_from": s.valid_from.isoformat() if s.valid_from else None,
            "valid_to": s.valid_to.isoformat() if s.valid_to else None,
            "benefits": [ln.strip() for ln in (s.benefits or "").splitlines() if ln.strip()],
            "discount_type": s.discount_type,
            "discount_value": _money(s.discount_value),
            "discount_amount": _money(off) if off is not None else None,
            "tuition_after": _money(s_fee - off) if off is not None and s_fee is not None else None,
        })
    return {
        "class_name": class_name,
        "academic_year": year,
        "tuition_fee_type": fee_type,
        "tuition_fee": _money(fee) if fee is not None else None,
        "tuition_installments": tuition_installments(rows),
        "fee_note": None if fee is not None else f"Tuition fee for {year} is not set yet.",
        "schemes": out,
    }


def print_header(branch):
    school = db.session.get(School, branch.school_id) if branch.school_id else None
    return {
        "school_name": school.school_name if school else None,
        "logo_url": school.logo_url if school else None,
        "address": school.address if school else None,
        "phone": school.phone if school else None,
        "branch_name": branch.branch_name,
    }


# --------------------------------------------------------------------------- serializers
def scheme_dict(s):
    return {
        "id": s.id, "branch_id": s.branch_id, "academic_year": s.academic_year, "name": s.name,
        "valid_from": s.valid_from.isoformat() if s.valid_from else None,
        "valid_to": s.valid_to.isoformat() if s.valid_to else None,
        "tuition_fee_type": s.tuition_fee_type, "discount_type": s.discount_type,
        "discount_value": _money(s.discount_value), "benefits": s.benefits or "",
        "display_order": s.display_order, "is_active": bool(s.is_active),
    }


def enquiry_dict(e, full=False):
    d = {
        "id": e.id, "enquiry_no": e.enquiry_no, "enquiry_date": e.enquiry_date.isoformat(),
        "academic_year": e.academic_year, "branch_id": e.branch_id,
        "branch_name": e.branch.branch_name if e.branch else None,
        "student_name": e.student_name, "guardian_name": e.guardian_name,
        "class_name": e.class_name, "contact": e.contact,
        "aadhaar_masked": mask_aadhaar(e.aadhaar_last4), "status": e.status,
        "printed_at": e.printed_at.isoformat() if e.printed_at else None,
        "print_count": e.print_count or 0,
    }
    if full:
        d["print"] = e.quote_snapshot
    return d


# --------------------------------------------------------------------------- options
@bp.route("/api/enquiry/options", methods=["GET"])
@token_required
def enquiry_options(current_user):
    if not (has_permission(current_user, PERM_ENQUIRY, "read") or has_permission(current_user, PERM_SCHEMES, "read")):
        return _forbidden()
    allowed = get_user_allowed_branches(current_user)
    q = Branch.query.filter_by(is_active=True)
    if not allowed["is_unlimited"]:
        q = q.filter(Branch.id.in_(list(allowed["ids"] or [])))
    years = active_years()
    return jsonify({
        "academic_years": years,
        # Newest active year: in January that is next session; after it starts, the current one
        "default_year": years[0]["code"] if years else None,
        "branches": [{"id": b.id, "name": b.branch_name} for b in q.order_by(Branch.branch_name).all()],
        "current_branch_id": getattr(g, "branch_id", None),
        "can_write": has_permission(current_user, PERM_ENQUIRY, "write"),
        "can_manage_schemes": has_permission(current_user, PERM_SCHEMES, "write"),
    })


@bp.route("/api/enquiry/classes", methods=["GET"])
@token_required
def enquiry_classes(current_user):
    if not (has_permission(current_user, PERM_ENQUIRY, "read") or has_permission(current_user, PERM_SCHEMES, "read")):
        return _forbidden()
    branch = resolve_branch(current_user, request.args.get("branch_id"))
    return jsonify({"classes": branch_classes(branch)})


@bp.route("/api/enquiry/fee-types", methods=["GET"])
@token_required
def enquiry_fee_types(current_user):
    if not has_permission(current_user, PERM_SCHEMES, "read"):
        return _forbidden()
    branch = resolve_branch(current_user, request.args.get("branch_id"))
    year = resolve_year(request.args.get("academic_year"))
    rows = (FeeType.query.filter(FeeType.academic_year == year,
                                 or_(FeeType.branch == branch.branch_name, FeeType.branch == "All"))
            .order_by(FeeType.feetype).all())
    names = sorted({r.feetype for r in rows if r.feetype}, key=str.lower)
    return jsonify({"fee_types": names})


# --------------------------------------------------------------------------- schemes
def _scheme_from_body(data, scheme, branch, year):
    scheme.name = re.sub(r"\s+", " ", str(data.get("name") or "")).strip()
    if not 2 <= len(scheme.name) <= 100:
        raise UserError("Please type a scheme name (for example: Admission Scheme 1).", field="name")
    scheme.valid_from = parse_date(data.get("valid_from"), "start date")
    scheme.valid_to = parse_date(data.get("valid_to"), "end date")
    if scheme.valid_from and scheme.valid_to and scheme.valid_to < scheme.valid_from:
        raise UserError("The end date must be on or after the start date.", field="valid_to")
    scheme.tuition_fee_type = str(data.get("tuition_fee_type") or "").strip()
    if not scheme.tuition_fee_type:
        raise UserError("Please choose which fee is the tuition fee.", field="tuition_fee_type")
    exists = FeeType.query.filter(FeeType.academic_year == year,
                                  func.lower(FeeType.feetype) == scheme.tuition_fee_type.lower(),
                                  or_(FeeType.branch == branch.branch_name, FeeType.branch == "All")).first()
    if not exists:
        raise UserError(f"The fee '{scheme.tuition_fee_type}' is not set up for {year} in this branch.",
                        field="tuition_fee_type")
    scheme.discount_type = data.get("discount_type") or "NONE"
    if scheme.discount_type not in ("NONE", "PERCENT", "AMOUNT"):
        raise UserError("Please choose the discount type.", field="discount_type")
    try:
        value = Decimal(str(data.get("discount_value") or 0))
    except InvalidOperation:
        raise UserError("Please type the discount as a number.", field="discount_value")
    if scheme.discount_type == "NONE":
        value = Decimal(0)
    if value < 0 or (scheme.discount_type == "PERCENT" and value > 100):
        raise UserError("The discount must be between 0 and 100%." if scheme.discount_type == "PERCENT"
                        else "The discount cannot be less than 0.", field="discount_value")
    if scheme.discount_type != "NONE" and value == 0:
        raise UserError("Please type the discount, or choose 'No tuition discount'.", field="discount_value")
    scheme.discount_value = value
    benefits = str(data.get("benefits") or "").replace("\r\n", "\n").strip()
    if len(benefits) > 2000:
        raise UserError("The benefits text is too long (2000 letters at most).", field="benefits")
    scheme.benefits = benefits or None
    try:
        scheme.display_order = int(data.get("display_order") or 0)
    except (TypeError, ValueError):
        scheme.display_order = 0
    scheme.is_active = bool(data.get("is_active", True))


def _save_scheme(scheme):
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise UserError("A scheme with this name already exists for this branch and year.", status=409, field="name")


@bp.route("/api/enquiry/schemes", methods=["GET"])
@token_required
def list_schemes(current_user):
    if not (has_permission(current_user, PERM_SCHEMES, "read") or has_permission(current_user, PERM_ENQUIRY, "read")):
        return _forbidden()
    branch = resolve_branch(current_user, request.args.get("branch_id"))
    year = resolve_year(request.args.get("academic_year"))
    rows = (AdmissionScheme.query.filter_by(branch_id=branch.id, academic_year=year)
            .order_by(AdmissionScheme.display_order, AdmissionScheme.id).all())
    return jsonify({"schemes": [scheme_dict(s) for s in rows]})


@bp.route("/api/enquiry/schemes", methods=["POST"])
@token_required
def create_scheme(current_user):
    if not has_permission(current_user, PERM_SCHEMES, "write"):
        return _forbidden()
    data = request.get_json(silent=True) or {}
    branch = resolve_branch(current_user, data.get("branch_id"))
    year = resolve_year(data.get("academic_year"))
    scheme = AdmissionScheme(branch_id=branch.id, school_id=branch.school_id, academic_year=year,
                             created_by=current_user.user_id)
    _scheme_from_body(data, scheme, branch, year)
    db.session.add(scheme)
    _save_scheme(scheme)
    return jsonify({"message": "Scheme saved.", "scheme": scheme_dict(scheme)}), 201


@bp.route("/api/enquiry/schemes/<int:scheme_id>", methods=["PUT"])
@token_required
def update_scheme(current_user, scheme_id):
    if not has_permission(current_user, PERM_SCHEMES, "write"):
        return _forbidden()
    scheme = db.session.get(AdmissionScheme, scheme_id)
    if not scheme:
        raise UserError("This scheme was not found. Refresh the page.", status=404)
    branch = resolve_branch(current_user, scheme.branch_id)  # ownership check
    data = request.get_json(silent=True) or {}
    _scheme_from_body(data, scheme, branch, scheme.academic_year)
    scheme.updated_by = current_user.user_id
    _save_scheme(scheme)
    return jsonify({"message": "Scheme saved.", "scheme": scheme_dict(scheme)})


@bp.route("/api/enquiry/schemes/copy", methods=["POST"])
@token_required
def copy_schemes(current_user):
    """Copy a branch's schemes from one year to another; names that already exist are skipped."""
    if not has_permission(current_user, PERM_SCHEMES, "write"):
        return _forbidden()
    data = request.get_json(silent=True) or {}
    branch = resolve_branch(current_user, data.get("branch_id"))
    from_year = resolve_year(data.get("from_year"))
    to_year = resolve_year(data.get("to_year"))
    if from_year == to_year:
        raise UserError("Choose two different years.")
    existing = {s.name.lower() for s in AdmissionScheme.query.filter_by(branch_id=branch.id, academic_year=to_year)}
    copied = 0
    for s in AdmissionScheme.query.filter_by(branch_id=branch.id, academic_year=from_year).all():
        if s.name.lower() in existing:
            continue
        db.session.add(AdmissionScheme(
            branch_id=branch.id, school_id=branch.school_id, academic_year=to_year, name=s.name,
            # Dates belong to the old year; the admin sets new ones
            valid_from=None, valid_to=None, tuition_fee_type=s.tuition_fee_type,
            discount_type=s.discount_type, discount_value=s.discount_value, benefits=s.benefits,
            display_order=s.display_order, is_active=False, created_by=current_user.user_id))
        copied += 1
    db.session.commit()
    msg = (f"{copied} scheme{'s' if copied != 1 else ''} copied. They are switched off: set the dates, then switch them on."
           if copied else "Nothing to copy: no new schemes in that year.")
    return jsonify({"message": msg, "copied": copied})


# --------------------------------------------------------------------------- enquiries
@bp.route("/api/enquiry/quote", methods=["GET"])
@token_required
def enquiry_quote(current_user):
    if not has_permission(current_user, PERM_ENQUIRY, "read"):
        return _forbidden()
    branch = resolve_branch(current_user, request.args.get("branch_id"))
    year = resolve_year(request.args.get("academic_year"))
    class_name = str(request.args.get("class_name") or "").strip()
    if class_name not in branch_classes(branch):
        raise UserError("Please choose the class.", field="class_name")
    return jsonify(build_quote(branch, year, class_name, get_today()))


def find_earlier_visits(user, branch, year, aadhaar=None, contact=None):
    """Earlier enquiries (any year, the user's branches) and existing students with the same Aadhaar or phone."""
    allowed = get_user_allowed_branches(user)
    found = {"same_year": None, "enquiries": [], "students": []}

    conds = []
    if aadhaar:
        conds.append(Enquiry.aadhaar_hash == aadhaar_fingerprint(aadhaar))
    if contact:
        conds.append(Enquiry.contact == contact)
    if conds:
        q = Enquiry.query.filter(or_(*conds))
        if not allowed["is_unlimited"]:
            q = q.filter(Enquiry.branch_id.in_(list(allowed["ids"] or [])))
        for e in q.order_by(Enquiry.enquiry_date.desc(), Enquiry.id.desc()).limit(10).all():
            by_aadhaar = bool(aadhaar) and e.aadhaar_hash == aadhaar_fingerprint(aadhaar)
            item = {**enquiry_dict(e), "match": "aadhaar" if by_aadhaar else "phone"}
            found["enquiries"].append(item)
            if by_aadhaar and e.branch_id == branch.id and e.academic_year == year and not found["same_year"]:
                found["same_year"] = item

    sconds = []
    if aadhaar:
        sconds.append(func.replace(func.replace(Student.Adharcardno, " ", ""), "-", "") == aadhaar)
    if contact:
        sconds += [Student.phone == contact, Student.FatherPhone == contact, Student.SmsNo == contact]
    if sconds:
        q = Student.query.filter(or_(*sconds))
        if not allowed["is_unlimited"]:
            q = q.filter(Student.branch.in_(list(allowed["names"] or [])))
        for s in q.limit(10).all():
            same_aadhaar = bool(aadhaar) and re.sub(r"\D", "", s.Adharcardno or "") == aadhaar
            found["students"].append({
                "admission_no": s.admission_no,
                "name": " ".join(p for p in [s.first_name, s.last_name] if p).strip(),
                "class_name": s.clazz, "branch": s.branch, "status": s.status,
                "match": "aadhaar" if same_aadhaar else "phone",
            })
    return found


@bp.route("/api/enquiry/check", methods=["POST"])
@token_required
@limiter.limit("60 per minute")
def enquiry_check(current_user):
    if not has_permission(current_user, PERM_ENQUIRY, "read"):
        return _forbidden()
    data = request.get_json(silent=True) or {}
    branch = resolve_branch(current_user, data.get("branch_id"))
    year = resolve_year(data.get("academic_year"))
    try:
        aadhaar = clean_aadhaar(data.get("aadhaar"))
    except UserError:
        aadhaar = None  # half-typed number: nothing to check yet
    try:
        contact = clean_phone(data.get("contact"), required=False)
    except UserError:
        contact = None
    return jsonify(find_earlier_visits(current_user, branch, year, aadhaar, contact))


def next_enquiry_no(branch, year):
    """Locked counter per branch + year, safe when two people save at the same moment."""
    seq = (EnquirySequence.query.filter_by(branch_id=branch.id, academic_year=year)
           .with_for_update().first())
    if not seq:
        seq = EnquirySequence(branch_id=branch.id, academic_year=year, last_no=0)
        db.session.add(seq)
        try:
            db.session.flush()
        except IntegrityError:  # another request created it first
            db.session.rollback()
            seq = (EnquirySequence.query.filter_by(branch_id=branch.id, academic_year=year)
                   .with_for_update().first())
    seq.last_no = (seq.last_no or 0) + 1
    prefix = year[:4] if year[:4].isdigit() else re.sub(r"\W", "", year)[:6]
    return f"ENQ-{prefix}-{seq.last_no:04d}"


@bp.route("/api/enquiry", methods=["POST"])
@token_required
def create_enquiry(current_user):
    if not has_permission(current_user, PERM_ENQUIRY, "write"):
        return _forbidden()
    data = request.get_json(silent=True) or {}
    branch = resolve_branch(current_user, data.get("branch_id"))
    year = resolve_year(data.get("academic_year"))
    student_name = clean_name(data.get("student_name"), "student name")
    guardian_name = clean_name(data.get("guardian_name"), "guardian name")
    class_name = str(data.get("class_name") or "").strip()
    if class_name not in branch_classes(branch):
        raise UserError("Please choose the class.", field="class_name")
    contact = clean_phone(data.get("contact"))
    aadhaar = clean_aadhaar(data.get("aadhaar"))
    fp = aadhaar_fingerprint(aadhaar) if aadhaar else None

    if fp:
        dup = Enquiry.query.filter_by(branch_id=branch.id, academic_year=year, aadhaar_hash=fp).first()
        if dup:
            raise UserError(f"This child already has an enquiry for {year} ({dup.enquiry_no}). Open it instead.",
                            status=409, existing_id=dup.id, existing_no=dup.enquiry_no)

    today = get_today()
    quote = build_quote(branch, year, class_name, today)
    enquiry = Enquiry(
        branch_id=branch.id, school_id=branch.school_id, academic_year=year,
        enquiry_no=next_enquiry_no(branch, year), enquiry_date=today,
        student_name=student_name, guardian_name=guardian_name, class_name=class_name, contact=contact,
        aadhaar_encrypted=encrypt_secret(aadhaar) if aadhaar else None,
        aadhaar_hash=fp, aadhaar_last4=aadhaar[-4:] if aadhaar else None,
        status="NEW", created_by=current_user.user_id,
    )
    enquiry.quote_snapshot = {
        "header": print_header(branch),
        "enquiry_no": enquiry.enquiry_no, "enquiry_date": today.isoformat(),
        "student_name": student_name, "guardian_name": guardian_name,
        "contact": contact, "aadhaar_masked": mask_aadhaar(enquiry.aadhaar_last4),
        **quote,
    }
    db.session.add(enquiry)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        current_app.logger.warning("Enquiry save conflict for branch %s year %s", branch.id, year)
        raise UserError("This child was just saved by someone else. Search the list before adding again.", status=409)
    return jsonify({"message": f"Enquiry {enquiry.enquiry_no} saved.", "enquiry": enquiry_dict(enquiry, full=True)}), 201


@bp.route("/api/enquiry", methods=["GET"])
@token_required
def list_enquiries(current_user):
    if not has_permission(current_user, PERM_ENQUIRY, "read"):
        return _forbidden()
    branch = resolve_branch(current_user, request.args.get("branch_id"))
    # Year is optional ("To print" shows every year)
    year = resolve_year(request.args.get("academic_year")) if request.args.get("academic_year") else None
    q = Enquiry.query.filter(Enquiry.branch_id == branch.id)
    if year:
        q = q.filter(Enquiry.academic_year == year)
    printed = request.args.get("printed")
    if printed == "no":
        q = q.filter(Enquiry.printed_at.is_(None))
    elif printed == "yes":
        q = q.filter(Enquiry.printed_at.isnot(None))
    text = str(request.args.get("q") or "").strip()[:60]
    if text:
        like = f"%{text}%"
        conds = [Enquiry.student_name.ilike(like), Enquiry.guardian_name.ilike(like),
                 Enquiry.enquiry_no.ilike(like), Enquiry.contact.ilike(like)]
        digits = re.sub(r"\D", "", text)
        if len(digits) == 12:
            conds.append(Enquiry.aadhaar_hash == aadhaar_fingerprint(digits))
        q = q.filter(or_(*conds))
    d_from = parse_date(request.args.get("from"), "from date")
    d_to = parse_date(request.args.get("to"), "to date")
    if d_from:
        q = q.filter(Enquiry.enquiry_date >= d_from)
    if d_to:
        q = q.filter(Enquiry.enquiry_date <= d_to)
    if request.args.get("class_name"):
        q = q.filter(Enquiry.class_name == request.args.get("class_name"))
    try:
        page = max(1, int(request.args.get("page") or 1))
    except ValueError:
        page = 1
    total = q.count()
    rows = q.order_by(Enquiry.enquiry_date.desc(), Enquiry.id.desc()).offset((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).all()
    not_printed = Enquiry.query.filter(Enquiry.branch_id == branch.id, Enquiry.printed_at.is_(None)).count()
    return jsonify({"enquiries": [enquiry_dict(e) for e in rows], "total": total, "page": page,
                    "page_size": PAGE_SIZE, "not_printed": not_printed})


@bp.route("/api/enquiry/<int:enquiry_id>", methods=["GET"])
@token_required
def get_enquiry(current_user, enquiry_id):
    if not has_permission(current_user, PERM_ENQUIRY, "read"):
        return _forbidden()
    e = db.session.get(Enquiry, enquiry_id)
    if not e:
        raise UserError("This enquiry was not found.", status=404)
    resolve_branch(current_user, e.branch_id)  # ownership check
    return jsonify({"enquiry": enquiry_dict(e, full=True)})


@bp.route("/api/enquiry/<int:enquiry_id>/printed", methods=["POST"])
@token_required
def mark_printed(current_user, enquiry_id):
    """Called after the user confirms the paper came out of the printer."""
    if not has_permission(current_user, PERM_ENQUIRY, "read"):
        return _forbidden()
    e = db.session.get(Enquiry, enquiry_id)
    if not e:
        raise UserError("This enquiry was not found.", status=404)
    resolve_branch(current_user, e.branch_id)  # ownership check
    e.printed_at = get_now()
    e.printed_by = current_user.user_id
    e.print_count = (e.print_count or 0) + 1
    e.updated_by = current_user.user_id
    db.session.commit()
    return jsonify({"message": "Marked as printed.", "enquiry": enquiry_dict(e)})
