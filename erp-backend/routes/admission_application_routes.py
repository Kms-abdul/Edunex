"""
Online admission form (enquiry step 3).

Staff side (login needed):
  POST /api/enquiry/<id>/application          make / resend the parent's link (enquiry must be Joined)
  GET  /api/enquiry/applications               list for a branch
  GET  /api/enquiry/applications/<id>          one application (to open it as a filled-in Add Student form)
  GET  /api/enquiry/applications/<id>/aadhaar-doc   the uploaded Aadhaar copy
  POST /api/enquiry/applications/<id>/admit    link the student created from it (status -> Admitted)

Parent side (NO login; only through the private link):
  GET  /api/public/apply/<token>               school name / status (no personal data)
  POST /api/public/apply/<token>/verify        confirm the mobile number -> short session
  PUT  /api/public/apply/<token>               save the form (draft)
  POST /api/public/apply/<token>/aadhaar-doc   upload the Aadhaar copy (photo or PDF, 5 MB)
  POST /api/public/apply/<token>/submit        send it to the school

Security: the link is a long random code; only its SHA-256 is stored. It works for one enquiry,
for 3 days, and only after the parent types the enquiry's mobile number (10 wrong tries lock it).
The parent's session token cannot be used for any staff API.
"""
import hashlib
import io
import re
import secrets
from datetime import datetime, timedelta

import jwt
from flask import Blueprint, current_app, jsonify, request, send_file

from enquiry_models import AdmissionApplication, Enquiry
from extensions import db, get_now, limiter
from helpers import has_permission, token_required
from models import Branch, DocumentType, School, Student, StudentDocument
from routes.enquiry_routes import (PERM_ENQUIRY, PERM_FOLLOWUP, UserError, clean_aadhaar, clean_name, clean_phone,
                                   parse_date, resolve_branch)

bp = Blueprint("admission_application_routes", __name__)

LINK_DAYS = 3
MAX_CHECKS = 10
PERM_CREATE_STUDENT = "administration.student.create-student"
MAX_DOC_BYTES = 5 * 1024 * 1024
MAX_PHOTO_CHARS = 1_500_000  # ~1 MB JPEG as base64 (the form shrinks photos to ~100 KB)

FORM_MESSAGE = ("Thank you for choosing {school}!\n"
                "Please fill {student}'s admission form here:\n{link}\n\n"
                "The link works till {till}. Open it with this mobile number.")

# Fields the parent may fill (everything else, e.g. class, section, admission number, is for the office)
TEXT_FIELDS = {"first_name": "student's first name", "StudentMiddleName": "student's middle name",
               "last_name": "student's last name", "Fatherfirstname": "father's name",
               "FatherLastName": "father's last name", "Motherfirstname": "mother's name",
               "Motherlastname": "mother's last name"}
PHONE_FIELDS = ("FatherPhone", "SecondaryPhone", "phone")
REQUIRED = ("first_name", "last_name", "gender", "dob", "Adharcardno", "Fatherfirstname", "FatherPhone",
            "Motherfirstname", "phone")
LABELS = {"first_name": "the student's first name", "last_name": "the student's last name", "gender": "boy or girl",
          "dob": "the date of birth", "Adharcardno": "the student's Aadhaar number",
          "Fatherfirstname": "the father's name", "FatherPhone": "the father's phone number",
          "Motherfirstname": "the mother's name", "phone": "the main phone number"}


@bp.errorhandler(UserError)
def _user_error(e):
    return jsonify({"error": e.message, **e.extra}), e.status


def _hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def _now():
    return get_now().replace(tzinfo=None)


def _school_header(branch):
    school = db.session.get(School, branch.school_id) if branch and branch.school_id else None
    return {"school_name": school.school_name if school else None,
            "logo_url": school.logo_url if school else None,
            "branch_name": branch.branch_name if branch else None}


# --------------------------------------------------------------------------- staff: make / resend the link
@bp.route("/api/enquiry/<int:enquiry_id>/application", methods=["POST"])
@token_required
def send_application(current_user, enquiry_id):
    if not (has_permission(current_user, PERM_FOLLOWUP, "write") or has_permission(current_user, PERM_ENQUIRY, "write")):
        return jsonify({"error": "You do not have access to this. Ask your school admin."}), 403
    e = db.session.get(Enquiry, enquiry_id)
    if not e:
        raise UserError("This enquiry was not found.", status=404)
    branch = resolve_branch(current_user, e.branch_id)
    if e.status != "JOINED":
        raise UserError("Mark the call as 'Admission confirmed' first.", status=409)
    app_row = AdmissionApplication.query.filter_by(enquiry_id=e.id).first()
    if app_row and app_row.status == "ADMITTED":
        raise UserError("This student is already admitted.", status=409)

    token = secrets.token_urlsafe(32)
    expires = _now() + timedelta(days=LINK_DAYS)
    if app_row is None:
        app_row = AdmissionApplication(enquiry_id=e.id, branch_id=e.branch_id, school_id=e.school_id,
                                       created_by=current_user.user_id, send_count=1,
                                       data={"first_name": e.student_name.split(" ")[0],
                                             "last_name": " ".join(e.student_name.split(" ")[1:]),
                                             "Fatherfirstname": e.guardian_name, "phone": e.contact,
                                             "FatherPhone": e.contact})
        db.session.add(app_row)
    else:
        app_row.send_count = (app_row.send_count or 0) + 1
        app_row.updated_by = current_user.user_id
    # A new link replaces the old one (the old link stops working)
    app_row.token_hash, app_row.expires_at, app_row.failed_checks = _hash(token), expires, 0
    if app_row.status == "CANCELLED":
        app_row.status = "SENT"
    db.session.commit()

    header = _school_header(branch)
    till = expires.strftime("%d %b")
    return jsonify({
        "message": "Link ready. Send it on WhatsApp.",
        "application_id": app_row.id,
        "token": token,
        "form_path": f"#/apply/{token}",
        "expires_at": expires.isoformat(),
        "parent_phone": e.contact,
        # {link} is filled in by the screen with the address the app is opened at
        "text": FORM_MESSAGE.format(school=header["school_name"] or "our school", student=e.student_name,
                                    link="{link}", till=till),
        "status": app_row.status,
    })


# --------------------------------------------------------------------------- staff: list / view / admit
def _app_dict(a, full=False):
    e = a.enquiry
    d = {
        "id": a.id, "enquiry_id": a.enquiry_id, "status": a.status,
        "student_name": " ".join(p for p in [(a.data or {}).get("first_name"), (a.data or {}).get("last_name")] if p)
        or (e.student_name if e else ""),
        "guardian_name": e.guardian_name if e else None, "class_name": e.class_name if e else None,
        "academic_year": e.academic_year if e else None, "contact": e.contact if e else None,
        "enquiry_no": e.enquiry_no if e else None,
        "expires_at": a.expires_at.isoformat() if a.expires_at else None,
        "expired": bool(a.expires_at and a.expires_at < _now() and a.status == "SENT"),
        "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
        "opened_at": a.opened_at.isoformat() if a.opened_at else None,
        "student_id": a.student_id, "has_aadhaar_doc": bool(a.aadhaar_doc_key), "send_count": a.send_count,
    }
    if full:
        d["data"] = a.data or {}
        d["branch_name"] = a.enquiry.branch.branch_name if a.enquiry and a.enquiry.branch else None
        d["aadhaar_doc_name"] = a.aadhaar_doc_name
    return d


def _can_view(user):
    return any(has_permission(user, p, "read") for p in (PERM_ENQUIRY, PERM_FOLLOWUP, PERM_CREATE_STUDENT))


@bp.route("/api/enquiry/applications", methods=["GET"])
@token_required
def list_applications(current_user):
    if not _can_view(current_user):
        return jsonify({"error": "You do not have access to this. Ask your school admin."}), 403
    branch = resolve_branch(current_user, request.args.get("branch_id"))
    q = AdmissionApplication.query.filter_by(branch_id=branch.id)
    status = request.args.get("status")
    if status in ("SENT", "SUBMITTED", "ADMITTED", "CANCELLED"):
        q = q.filter(AdmissionApplication.status == status)
    rows = q.order_by(AdmissionApplication.updated_at.desc()).limit(300).all()
    counts = dict(db.session.query(AdmissionApplication.status, db.func.count(AdmissionApplication.id))
                  .filter_by(branch_id=branch.id).group_by(AdmissionApplication.status).all())
    return jsonify({"applications": [_app_dict(a) for a in rows], "counts": counts})


def _get_app_for_staff(current_user, app_id):
    a = db.session.get(AdmissionApplication, app_id)
    if not a:
        raise UserError("This application was not found.", status=404)
    resolve_branch(current_user, a.branch_id)  # ownership check
    return a


@bp.route("/api/enquiry/applications/<int:app_id>", methods=["GET"])
@token_required
def get_application(current_user, app_id):
    if not _can_view(current_user):
        return jsonify({"error": "You do not have access to this. Ask your school admin."}), 403
    return jsonify({"application": _app_dict(_get_app_for_staff(current_user, app_id), full=True)})


@bp.route("/api/enquiry/applications/<int:app_id>/aadhaar-doc", methods=["GET"])
@token_required
def get_application_doc(current_user, app_id):
    if not _can_view(current_user):
        return jsonify({"error": "You do not have access to this. Ask your school admin."}), 403
    a = _get_app_for_staff(current_user, app_id)
    if not a.aadhaar_doc_key:
        raise UserError("No Aadhaar copy was uploaded.", status=404)
    from services.storage_service import get_file_stream
    return send_file(get_file_stream(a.aadhaar_doc_key), mimetype=a.aadhaar_doc_mime or "application/octet-stream",
                     download_name=a.aadhaar_doc_name or "aadhaar", as_attachment=False)


def _aadhaar_doc_type():
    t = DocumentType.query.filter(db.or_(DocumentType.code.ilike("%aadha%"), DocumentType.name.ilike("%aadha%"))).first()
    if not t:
        t = DocumentType(code="AADHAAR", name="Aadhaar card", description="Added from the online admission form",
                         is_active=True)
        db.session.add(t)
        db.session.flush()
    return t


@bp.route("/api/enquiry/applications/<int:app_id>/admit", methods=["POST"])
@token_required
def admit_application(current_user, app_id):
    """Called right after the office saves the filled-in Add Student form."""
    if not has_permission(current_user, PERM_CREATE_STUDENT, "write"):
        return jsonify({"error": "You do not have access to add students."}), 403
    a = _get_app_for_staff(current_user, app_id)
    student_id = (request.get_json(silent=True) or {}).get("student_id")
    student = db.session.get(Student, int(student_id)) if str(student_id or "").isdigit() else None
    if not student:
        raise UserError("The new student was not found.", status=404)
    if a.status == "ADMITTED" and a.student_id != student.student_id:
        raise UserError("This application is already linked to another student.", status=409)
    a.status, a.student_id = "ADMITTED", student.student_id
    a.admitted_at, a.admitted_by = _now(), current_user.user_id
    if a.enquiry:
        a.enquiry.converted_student_id = student.student_id
        a.enquiry.status = "JOINED"
    doc_note = None
    if a.aadhaar_doc_key and not StudentDocument.query.filter_by(student_id=student.student_id).join(DocumentType) \
            .filter(db.or_(DocumentType.code.ilike("%aadha%"), DocumentType.name.ilike("%aadha%"))).first():
        try:
            from services.storage_service import (generate_student_document_key, get_file_stream,
                                                  upload_file_to_storage)
            dtype = _aadhaar_doc_type()
            data = get_file_stream(a.aadhaar_doc_key).read()
            key = generate_student_document_key(student.student_id, dtype.name, a.aadhaar_doc_name or "aadhaar")
            folder, _, fname = key.rpartition("/")
            upload_file_to_storage(io.BytesIO(data), fname, folder=folder)
            db.session.add(StudentDocument(student_id=student.student_id, document_type_id=dtype.id,
                                           file_name=a.aadhaar_doc_name, file_path=key, file_size=len(data),
                                           mime_type=a.aadhaar_doc_mime, school_id=a.school_id,
                                           branch_id=a.branch_id, created_by=current_user.user_id))
            doc_note = "Aadhaar copy added to the student's documents."
        except Exception as ex:  # the admission itself must not fail because of the file copy
            current_app.logger.warning("Could not copy Aadhaar document for application %s: %s", a.id, ex)
            doc_note = "The Aadhaar copy could not be copied; add it from the student's documents."
    db.session.commit()
    return jsonify({"message": "Admission completed." + (f" {doc_note}" if doc_note else ""), "doc_note": doc_note})


# --------------------------------------------------------------------------- parent side (public)
def _app_by_token(token):
    if not token or len(token) > 100:
        raise UserError("This link is not correct. Ask the school to send it again.", status=404)
    a = AdmissionApplication.query.filter_by(token_hash=_hash(token)).first()
    if not a:
        raise UserError("This link is not correct or has been replaced. Ask the school to send it again.", status=404)
    return a


def _check_open(a):
    if a.status in ("ADMITTED",):
        raise UserError("This admission is already completed. Thank you!", status=409, state="done")
    if a.status == "CANCELLED":
        raise UserError("This link was cancelled by the school.", status=410, state="cancelled")
    if a.expires_at < _now() and a.status == "SENT":
        raise UserError("This link has expired. Please ask the school to send it again.", status=410, state="expired")
    if (a.failed_checks or 0) >= MAX_CHECKS:
        raise UserError("Too many wrong tries. Please ask the school to send the link again.", status=423, state="locked")


def _session_token(a):
    return jwt.encode({"typ": "apply", "aid": a.id, "exp": datetime.utcnow() + timedelta(hours=2)},
                      current_app.config["SECRET_KEY"], algorithm="HS256")


def _require_session(a):
    raw = request.headers.get("X-Apply-Session") or ""
    try:
        data = jwt.decode(raw, current_app.config["SECRET_KEY"], algorithms=["HS256"])
    except jwt.PyJWTError:
        raise UserError("Please enter your mobile number again.", status=401, state="verify")
    if data.get("typ") != "apply" or data.get("aid") != a.id:
        raise UserError("Please enter your mobile number again.", status=401, state="verify")


def _public_view(a):
    e = a.enquiry
    branch = db.session.get(Branch, a.branch_id)
    return {**_school_header(branch), "status": a.status,
            "class_name": e.class_name if e else None, "academic_year": e.academic_year if e else None,
            "expires_at": a.expires_at.isoformat(), "data": a.data or {},
            "aadhaar_doc_name": a.aadhaar_doc_name}


@bp.route("/api/public/apply/<token>", methods=["GET"])
@limiter.limit("30 per minute")
def public_info(token):
    """Before the mobile check: only the school name and whether the link still works."""
    a = _app_by_token(token)
    branch = db.session.get(Branch, a.branch_id)
    state = "open"
    try:
        _check_open(a)
    except UserError as ex:
        state = ex.extra.get("state", "closed")
    if a.status == "SUBMITTED" and state == "open":
        state = "submitted"
    return jsonify({**_school_header(branch), "state": state})


@bp.route("/api/public/apply/<token>/verify", methods=["POST"])
@limiter.limit("10 per minute")
def public_verify(token):
    a = _app_by_token(token)
    _check_open(a)
    mobile = re.sub(r"\D", "", str((request.get_json(silent=True) or {}).get("mobile") or ""))[-10:]
    if not a.enquiry or mobile != a.enquiry.contact:
        a.failed_checks = (a.failed_checks or 0) + 1
        db.session.commit()
        left = max(0, MAX_CHECKS - a.failed_checks)
        raise UserError(f"This is not the mobile number we have. {left} tries left.", status=403, field="mobile")
    if not a.opened_at:
        a.opened_at = _now()
    a.failed_checks = 0
    db.session.commit()
    return jsonify({"session": _session_token(a), "form": _public_view(a)})


def _clean_form(raw, final=False):
    """Only the parent's fields, each checked on the server.
    Draft (final=False): a field that is not valid yet (half-typed) is simply left out.
    Submit (final=True): every value must be valid and every required one present."""
    raw = raw if isinstance(raw, dict) else {}
    out = {}

    def take(field, fn):
        v = raw.get(field)
        if v is None or str(v).strip() == "":
            return
        try:
            out[field] = fn(v)
        except UserError:
            if final:
                raise

    for f, label in TEXT_FIELDS.items():
        take(f, lambda v, label=label: clean_name(str(v).strip(), label))
    for f in PHONE_FIELDS:
        take(f, clean_phone)

    def gender(v):
        if v not in ("Male", "Female"):
            raise UserError("Please choose boy or girl.", field="gender")
        return v
    take("gender", gender)

    def dob(v):
        d = parse_date(v, "date of birth")
        today = _now().date()
        if d > today or d < today.replace(year=today.year - 25):
            raise UserError("Please check the date of birth.", field="dob")
        return d.isoformat()
    take("dob", dob)
    take("Adharcardno", clean_aadhaar)
    for f, n in (("address", 300), ("presentCity", 100), ("FatherEmail", 120), ("BloodGroup", 10)):
        take(f, lambda v, n=n: str(v).strip()[:n])

    def pin(v):
        p = re.sub(r"\D", "", str(v))
        if not re.fullmatch(r"[1-9]\d{5}", p):
            raise UserError("The PIN code has 6 digits.", field="presentPin")
        return p
    take("presentPin", pin)

    def photo(v):
        if not isinstance(v, str) or not re.match(r"^data:image/(jpeg|png|webp);base64,", v) or len(v) > MAX_PHOTO_CHARS:
            raise UserError("Please choose the photo again.", field="photo")
        return v
    take("photo", photo)

    if final:
        for f in REQUIRED:
            if not out.get(f):
                raise UserError(f"Please fill {LABELS[f]}.", field=f)
    return out


@bp.route("/api/public/apply/<token>", methods=["PUT"])
@limiter.limit("60 per minute")
def public_save(token):
    a = _app_by_token(token)
    _check_open(a)
    _require_session(a)
    if a.status != "SENT":
        raise UserError("The form is already sent to the school.", status=409, state="submitted")
    a.data = _clean_form((request.get_json(silent=True) or {}).get("data"))
    db.session.commit()
    return jsonify({"message": "Saved. You can come back and finish later."})


_DOC_TYPES = {b"%PDF": ("application/pdf", ".pdf"), b"\xff\xd8\xff": ("image/jpeg", ".jpg"),
              b"\x89PNG": ("image/png", ".png")}


@bp.route("/api/public/apply/<token>/aadhaar-doc", methods=["POST"])
@limiter.limit("20 per minute")
def public_upload_doc(token):
    a = _app_by_token(token)
    _check_open(a)
    _require_session(a)
    if a.status != "SENT":
        raise UserError("The form is already sent to the school.", status=409, state="submitted")
    f = request.files.get("file")
    if not f:
        raise UserError("Please choose the Aadhaar photo or PDF.", field="aadhaar_doc")
    data = f.read(MAX_DOC_BYTES + 1)
    if len(data) > MAX_DOC_BYTES:
        raise UserError("The file is too big (5 MB at most). Take a photo instead.", field="aadhaar_doc")
    kind = next((v for sig, v in _DOC_TYPES.items() if data.startswith(sig)), None)
    if not kind:
        raise UserError("Please upload a photo (JPG / PNG) or a PDF.", field="aadhaar_doc")
    from services.storage_service import upload_file_to_storage
    fname = f"aadhaar_{secrets.token_hex(6)}{kind[1]}"
    a.aadhaar_doc_key = upload_file_to_storage(io.BytesIO(data), fname, folder=f"admission_applications/{a.id}")
    a.aadhaar_doc_name, a.aadhaar_doc_mime = f"aadhaar{kind[1]}", kind[0]
    db.session.commit()
    return jsonify({"message": "Aadhaar copy uploaded.", "aadhaar_doc_name": a.aadhaar_doc_name})


@bp.route("/api/public/apply/<token>/submit", methods=["POST"])
@limiter.limit("10 per minute")
def public_submit(token):
    a = _app_by_token(token)
    _check_open(a)
    _require_session(a)
    if a.status != "SENT":
        raise UserError("The form is already sent to the school. Thank you!", status=409, state="submitted")
    data = _clean_form((request.get_json(silent=True) or {}).get("data"), final=True)
    if not a.aadhaar_doc_key:
        raise UserError("Please upload the Aadhaar copy.", field="aadhaar_doc")
    digits = data["Adharcardno"]
    if Student.query.filter(db.func.replace(db.func.replace(Student.Adharcardno, " ", ""), "-", "") == digits).first():
        raise UserError("A student with this Aadhaar number is already in the school. Please call the school office.",
                        field="Adharcardno")
    a.data, a.status, a.submitted_at = data, "SUBMITTED", _now()
    db.session.commit()
    return jsonify({"message": "Thank you! The form is sent to the school. They will call you with the admission number."})
