"""
Admission enquiry models (front-office "Enquiry" module, step 1).

- AdmissionScheme : offers for a branch + academic year (e.g. "join before 1 Jan"),
                    with an optional tuition-fee discount and free-text benefits
                    (uniform, books, ...) that are printed as written.
- Enquiry         : one visit by a parent. Aadhaar is stored encrypted, with a keyed
                    fingerprint for duplicate lookup and the last 4 digits for display.
- EnquirySequence : running enquiry number per branch + academic year.
"""
from extensions import db
from models import AuditMixin


class AdmissionScheme(db.Model, AuditMixin):
    __tablename__ = "admission_schemes"
    __audit_module__ = "ADMISSION"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    school_id = db.Column(db.Integer, db.ForeignKey("schools.id", ondelete="SET NULL"), nullable=True, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id", ondelete="CASCADE"), nullable=False)
    academic_year = db.Column(db.String(20), nullable=False)

    name = db.Column(db.String(100), nullable=False)
    # Joining window the offer applies to (both optional: open-ended)
    valid_from = db.Column(db.Date, nullable=True)
    valid_to = db.Column(db.Date, nullable=True)
    # Fee types are created per branch + year, so the scheme keeps the NAME;
    # this survives "copy schemes to next year".
    tuition_fee_type = db.Column(db.String(100), nullable=False)
    discount_type = db.Column(db.Enum("NONE", "PERCENT", "AMOUNT", name="scheme_discount_type"),
                              nullable=False, default="NONE")
    discount_value = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    # One benefit per line; printed exactly as typed
    benefits = db.Column(db.Text, nullable=True)
    display_order = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    __table_args__ = (
        db.UniqueConstraint("branch_id", "academic_year", "name", name="uq_scheme_branch_year_name"),
        db.CheckConstraint("discount_value >= 0", name="chk_scheme_discount_positive"),
        db.CheckConstraint("discount_type <> 'PERCENT' OR discount_value <= 100", name="chk_scheme_percent_max"),
        db.CheckConstraint("valid_from IS NULL OR valid_to IS NULL OR valid_to >= valid_from", name="chk_scheme_dates"),
        db.Index("idx_scheme_branch_year", "branch_id", "academic_year"),
    )


class Enquiry(db.Model, AuditMixin):
    __tablename__ = "enquiries"
    __audit_module__ = "ADMISSION"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    school_id = db.Column(db.Integer, db.ForeignKey("schools.id", ondelete="SET NULL"), nullable=True, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id", ondelete="RESTRICT"), nullable=False)
    academic_year = db.Column(db.String(20), nullable=False)

    enquiry_no = db.Column(db.String(30), nullable=False)
    enquiry_date = db.Column(db.Date, nullable=False)

    student_name = db.Column(db.String(100), nullable=False)
    guardian_name = db.Column(db.String(100), nullable=False)
    class_name = db.Column(db.String(50), nullable=False)
    contact = db.Column(db.String(10), nullable=False)
    # Which fee list the quote used: "fees for new students" or the regular (old student) fees
    student_type = db.Column(db.Enum("NEW", "OLD", name="enquiry_student_type"), nullable=False,
                             default="NEW", server_default="NEW")

    # Aadhaar (optional): never stored or returned in plain text
    aadhaar_encrypted = db.Column(db.Text, nullable=True)
    aadhaar_hash = db.Column(db.String(64), nullable=True)
    aadhaar_last4 = db.Column(db.String(4), nullable=True)

    status = db.Column(db.Enum("NEW", "FOLLOW_UP", "JOINED", "CLOSED", name="enquiry_status"),
                       nullable=False, default="NEW")
    # Used by step 2 (follow-ups) and step 3 (convert to admission)
    next_follow_up_date = db.Column(db.Date, nullable=True)
    converted_student_id = db.Column(db.Integer, db.ForeignKey("students.student_id", ondelete="SET NULL"), nullable=True)

    # Exactly what was printed (fee + schemes), so a reprint matches the parent's copy
    quote_snapshot = db.Column(db.JSON, nullable=True)

    # Print tracking: enquiries taken on a phone are printed later at the office
    printed_at = db.Column(db.DateTime, nullable=True)
    printed_by = db.Column(db.Integer, db.ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    print_count = db.Column(db.Integer, nullable=False, default=0, server_default="0")

    branch = db.relationship("Branch", foreign_keys=[branch_id])

    __table_args__ = (
        db.UniqueConstraint("branch_id", "enquiry_no", name="uq_enquiry_branch_no"),
        # Same child cannot be entered twice for the same branch + year (NULLs allowed)
        db.UniqueConstraint("branch_id", "academic_year", "aadhaar_hash", name="uq_enquiry_branch_year_aadhaar"),
        db.Index("idx_enquiry_branch_year_date", "branch_id", "academic_year", "enquiry_date"),
        db.Index("idx_enquiry_contact", "contact"),
        db.Index("idx_enquiry_aadhaar_hash", "aadhaar_hash"),
        db.Index("idx_enquiry_branch_printed", "branch_id", "printed_at"),
    )


class EnquirySequence(db.Model, AuditMixin):
    __tablename__ = "enquiry_sequences"
    __audit_module__ = "ADMISSION"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id", ondelete="CASCADE"), nullable=False)
    academic_year = db.Column(db.String(20), nullable=False)
    last_no = db.Column(db.Integer, nullable=False, default=0)

    __table_args__ = (
        db.UniqueConstraint("branch_id", "academic_year", name="uq_enquiry_seq_branch_year"),
        db.CheckConstraint("last_no >= 0", name="chk_enquiry_seq_positive"),
    )
