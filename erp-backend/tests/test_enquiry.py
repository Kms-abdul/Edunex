"""
Tests for the admission enquiry module (routes/enquiry_routes.py).

Run from erp-backend/:   python -m pytest tests/test_enquiry.py -q
Uses a throwaway SQLite file (TEST_DATABASE_URL); the real database is never touched.
"""
import datetime as dt
import os
import sys

import pytest

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)


def aadhaar(prefix):
    """Build a 12-digit Aadhaar with a correct Verhoeff check digit."""
    from routes.enquiry_routes import _V_D, _V_P
    inv = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]
    base = str(prefix)[:11].ljust(11, "1")
    c = 0
    for i, ch in enumerate(reversed(base)):
        c = _V_D[c][_V_P[(i + 1) % 8][int(ch)]]
    return base + str(inv[c])


@pytest.fixture(scope="module")
def env(tmp_path_factory):
    db_file = tmp_path_factory.mktemp("db") / "enquiry_test.db"
    os.environ["TEST_DATABASE_URL"] = f"sqlite:///{db_file}"
    from cryptography.fernet import Fernet
    os.environ.setdefault("FERNET_KEY", Fernet.generate_key().decode())

    # SQLite cannot autoincrement BIGINT primary keys; MySQL is unaffected
    from sqlalchemy import BigInteger
    from sqlalchemy.ext.compiler import compiles

    @compiles(BigInteger, "sqlite")
    def _bigint(t, c, **k):
        return "INTEGER"

    import jwt
    import sqlalchemy as sa
    from app import create_app
    from extensions import db
    from models import (Branch, ClassFeeStructure, ClassMaster, ClassSection, FeeType, OrgMaster, Permission,
                        Role, RolePermission, School, Student, User)
    from routes.rbac_routes import _sync_permission_catalog

    app = create_app()
    app.config.update(TESTING=True, RATELIMIT_ENABLED=False)
    from extensions import limiter
    limiter.enabled = False

    with app.app_context():
        db.drop_all()
        db.create_all()
        _sync_permission_catalog()

        school = School(school_name="Test School", address="1 Road", phone="040111")
        db.session.add(school)
        db.session.flush()
        A = Branch(branch_code="A", branch_name="Alpha", school_id=school.id)
        B = Branch(branch_code="B", branch_name="Beta", school_id=school.id)
        db.session.add_all([A, B])
        db.session.flush()
        for code in ("2026-2027", "2027-2028"):
            db.session.add(OrgMaster(master_type="ACADEMIC_YEAR", code=code, display_name=code, is_active=True))
        c5 = ClassMaster(class_name="5")
        db.session.add(c5)
        db.session.flush()
        db.session.add_all([
            ClassSection(class_id=c5.id, branch_id=A.id, academic_year="2026-2027", section_name="A", student_strength=40),
            ClassSection(class_id=c5.id, branch_id=B.id, academic_year="2026-2027", section_name="A", student_strength=40),
        ])
        ft = FeeType(feetype="Tuition Fee", branch="Alpha", branch_id=A.id, academic_year="2027-2028", school_id=school.id)
        db.session.add(ft)
        db.session.flush()
        db.session.add(ClassFeeStructure(clazz="5", feetypeid=ft.id, academicyear="2027-2028", academic_year="2027-2028",
                                         totalamount=40000, monthly_amount=4000, installments_count=10, branch="Alpha", branch_id=A.id, school_id=school.id))
        db.session.add(Student(first_name="Old", last_name="Kid", admission_no="ADM1", clazz="5", branch="Alpha",
                               status="Active", Adharcardno=aadhaar("98765432109"), phone="9000000001"))

        role = Role(name="FrontOffice", is_active=True)
        db.session.add(role)
        db.session.flush()
        perm = Permission.query.filter_by(code="administration.enquiry.enquiry").one()
        db.session.add(RolePermission(role_id=role.id, permission_id=perm.id, can_read=True, can_write=True))
        su = User(username="su", password="x", role="SuperAdmin")
        clerk = User(username="clerk", password="x", role="FrontOffice", role_id=role.id,
                     school_id=school.id, branch_id=A.id, default_branch_id=A.id)
        nobody_role = Role(name="NoAccess", is_active=True)
        db.session.add(nobody_role)
        db.session.flush()
        nobody = User(username="nobody", password="x", role="NoAccess", role_id=nobody_role.id,
                      school_id=school.id, branch_id=A.id, default_branch_id=A.id)
        db.session.add_all([su, clerk, nobody])

        # Fill NOT NULL columns the test does not care about
        for obj in list(db.session.new):
            for col in obj.__table__.columns:
                if col.primary_key or col.nullable or col.default is not None or col.server_default is not None:
                    continue
                attr = [k for k, v in obj.__mapper__.columns.items() if v is col][0]
                if getattr(obj, attr) is None:
                    t = col.type
                    setattr(obj, attr, 0 if isinstance(t, (sa.Integer, sa.Numeric)) else
                            dt.date.today() if isinstance(t, sa.Date) else
                            t.enums[0] if isinstance(t, sa.Enum) else "x")
        db.session.commit()
        ids = {"A": A.id, "B": B.id, "su": su.user_id, "clerk": clerk.user_id, "nobody": nobody.user_id}

    def headers(user_key, branch_key="A"):
        tok = jwt.encode({"user_id": ids[user_key], "exp": dt.datetime.utcnow() + dt.timedelta(hours=1)},
                         app.config["SECRET_KEY"], algorithm="HS256")
        return {"Authorization": f"Bearer {tok}", "X-Branch-ID": str(ids[branch_key])}

    return {"app": app, "c": app.test_client(), "ids": ids, "h": headers}


def _scheme(env, **kw):
    body = {"branch_id": env["ids"]["A"], "academic_year": "2027-2028", "name": "Admission Scheme 1",
            "valid_to": "2027-01-01", "tuition_fee_type": "Tuition Fee", "discount_type": "PERCENT",
            "discount_value": 10, "benefits": "Free uniform\nBooks 20% off\n"}
    body.update(kw)
    return env["c"].post("/api/enquiry/schemes", json=body, headers=env["h"]("su"))


def _enquiry(env, user="su", **kw):
    body = {"branch_id": env["ids"]["A"], "academic_year": "2027-2028", "student_name": "Ravi Kumar",
            "guardian_name": "Suresh Kumar", "class_name": "5", "contact": "+91 98480 12345"}
    body.update(kw)
    return env["c"].post("/api/enquiry", json=body, headers=env["h"](user))


def test_scheme_rules(env):
    assert _scheme(env, discount_value=120).status_code == 400            # % above 100
    assert _scheme(env, tuition_fee_type="Bus Fee").status_code == 400    # fee not set up
    assert _scheme(env, valid_from="2027-02-01", valid_to="2027-01-01").status_code == 400
    r = _scheme(env)
    assert r.status_code == 201, r.get_json()
    assert _scheme(env).status_code == 409                                # same name again
    assert _scheme(env, name="Admission Scheme 2", valid_to=None, discount_type="AMOUNT",
                   discount_value=5000, benefits="Free books").status_code == 201


def test_quote_shows_tuition_and_schemes(env):
    r = env["c"].get("/api/enquiry/quote", query_string={"branch_id": env["ids"]["A"], "academic_year": "2027-2028",
                                                         "class_name": "5"}, headers=env["h"]("su"))
    d = r.get_json()
    assert r.status_code == 200 and d["tuition_fee"] == 40000
    s1, s2 = d["schemes"]
    assert s1["benefits"] == ["Free uniform", "Books 20% off"]
    assert s1["discount_amount"] == 4000 and s1["tuition_after"] == 36000
    assert s2["discount_amount"] == 5000 and s2["tuition_after"] == 35000
    inst = d["tuition_installments"]
    assert len(inst) == 10 and sum(i["amount"] for i in inst) == 40000


def test_create_enquiry_numbers_and_snapshot(env):
    a1 = aadhaar("23456789012")
    r = _enquiry(env, aadhaar=a1)
    d = r.get_json()
    assert r.status_code == 201, d
    e = d["enquiry"]
    assert e["enquiry_no"] == "ENQ-2027-0001"
    assert e["contact"] == "9848012345"
    assert e["aadhaar_masked"] == f"XXXX XXXX {a1[-4:]}"
    assert a1 not in r.get_data(as_text=True)                             # never returned in full
    assert e["print"]["tuition_fee"] == 40000 and len(e["print"]["schemes"]) == 2
    assert e["print"]["header"]["school_name"] == "Test School"
    assert _enquiry(env, student_name="Anu Kumar").get_json()["enquiry"]["enquiry_no"] == "ENQ-2027-0002"


def test_duplicate_aadhaar_same_branch_year_rejected(env):
    a2 = aadhaar("34567890123")
    assert _enquiry(env, aadhaar=a2).status_code == 201
    r = _enquiry(env, aadhaar=a2)
    assert r.status_code == 409 and r.get_json()["existing_no"]
    assert _enquiry(env, aadhaar=a2, academic_year="2026-2027").status_code == 201   # other year is fine


def test_input_validation(env):
    assert _enquiry(env, aadhaar="123412341234").status_code == 400      # never starts with 1
    assert _enquiry(env, aadhaar="2345 6789").status_code == 400         # not 12 digits
    # A failed check digit is only a warning on the form; it must still save
    assert _enquiry(env, student_name="Check Digit", aadhaar="444698587555").status_code == 201
    assert _enquiry(env, contact="12345").status_code == 400
    assert _enquiry(env, student_name="R2D2").status_code == 400
    assert _enquiry(env, class_name="99").status_code == 400
    assert _enquiry(env, academic_year="1999-2000").status_code == 400


def test_check_finds_earlier_visits_and_students(env):
    a3 = aadhaar("45678901234")
    _enquiry(env, aadhaar=a3, contact="9000011111")
    r = env["c"].post("/api/enquiry/check", json={"branch_id": env["ids"]["A"], "academic_year": "2027-2028",
                                                  "aadhaar": a3}, headers=env["h"]("su"))
    d = r.get_json()
    assert d["same_year"] and d["same_year"]["match"] == "aadhaar"
    r = env["c"].post("/api/enquiry/check", json={"branch_id": env["ids"]["A"], "academic_year": "2027-2028",
                                                  "aadhaar": aadhaar("98765432109")}, headers=env["h"]("su"))
    assert r.get_json()["students"][0]["admission_no"] == "ADM1"


def test_reprint_uses_snapshot(env):
    e = _enquiry(env, student_name="Snap Shot").get_json()["enquiry"]
    sid = env["c"].get("/api/enquiry/schemes", query_string={"branch_id": env["ids"]["A"], "academic_year": "2027-2028"},
                       headers=env["h"]("su")).get_json()["schemes"][0]
    body = {**sid, "discount_value": 50}
    assert env["c"].put(f"/api/enquiry/schemes/{sid['id']}", json=body, headers=env["h"]("su")).status_code == 200
    again = env["c"].get(f"/api/enquiry/{e['id']}", headers=env["h"]("su")).get_json()["enquiry"]
    assert again["print"]["schemes"][0]["discount_amount"] == 4000      # still 10% as printed


def test_access_control(env):
    ok = env["c"].get("/api/enquiry", query_string={"branch_id": env["ids"]["A"], "academic_year": "2027-2028"},
                      headers=env["h"]("clerk"))
    assert ok.status_code == 200 and ok.get_json()["total"] >= 1
    other = env["c"].get("/api/enquiry", query_string={"branch_id": env["ids"]["B"], "academic_year": "2027-2028"},
                         headers=env["h"]("clerk"))
    assert other.status_code == 403                                      # not the clerk's branch
    assert _enquiry(env, user="nobody").status_code == 403
    assert _scheme(env, name="Scheme X").status_code == 201                      # superadmin may
    r = env["c"].post("/api/enquiry/schemes", json={"branch_id": env["ids"]["A"]}, headers=env["h"]("clerk"))
    assert r.status_code == 403                                           # clerk has no scheme permission


def test_copy_schemes_to_next_year(env):
    r = env["c"].post("/api/enquiry/schemes/copy", json={"branch_id": env["ids"]["A"], "from_year": "2027-2028",
                                                         "to_year": "2026-2027"}, headers=env["h"]("su"))
    assert r.status_code == 200 and r.get_json()["copied"] >= 2
    again = env["c"].post("/api/enquiry/schemes/copy", json={"branch_id": env["ids"]["A"], "from_year": "2027-2028",
                                                             "to_year": "2026-2027"}, headers=env["h"]("su"))
    assert again.get_json()["copied"] == 0                                # no duplicates


def test_print_tracking(env):
    e = _enquiry(env, student_name="Phone Entry").get_json()["enquiry"]
    assert e["printed_at"] is None and e["print_count"] == 0
    q = {"branch_id": env["ids"]["A"], "printed": "no"}
    before = env["c"].get("/api/enquiry", query_string=q, headers=env["h"]("clerk")).get_json()
    assert any(r["id"] == e["id"] for r in before["enquiries"]) and before["not_printed"] >= 1
    r = env["c"].post(f"/api/enquiry/{e['id']}/printed", headers=env["h"]("clerk"))
    assert r.status_code == 200 and r.get_json()["enquiry"]["print_count"] == 1
    after = env["c"].get("/api/enquiry", query_string=q, headers=env["h"]("clerk")).get_json()
    assert all(r["id"] != e["id"] for r in after["enquiries"]) and after["not_printed"] == before["not_printed"] - 1
    assert env["c"].post(f"/api/enquiry/{e['id']}/printed", headers=env["h"]("nobody")).status_code == 403
