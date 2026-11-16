"""
Student attendance rules (services/student_attendance.py) + register / save / report-card wiring.

Run from erp-backend/:   python -m pytest tests -q
"""
import datetime as dt
import os
import sys

import pytest

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND)
D = dt.date
YEAR = "2026-2027"


@pytest.fixture(scope="module")
def env(tmp_path_factory):
    os.environ["TEST_DATABASE_URL"] = f"sqlite:///{tmp_path_factory.mktemp('att') / 'att.db'}"
    from cryptography.fernet import Fernet
    os.environ.setdefault("FERNET_KEY", Fernet.generate_key().decode())
    from sqlalchemy import BigInteger
    from sqlalchemy.ext.compiler import compiles

    @compiles(BigInteger, "sqlite")
    def _bigint(t, c, **k):
        return "INTEGER"

    import jwt
    import sqlalchemy as sa
    from app import create_app
    from extensions import db, limiter
    from models import (Attendance, Branch, ClassMaster, ClassSection, HolidayCalendar, OrgMaster, School,
                        Student, StudentAcademicRecord, User, WeeklyOffRule)

    app = create_app()
    app.config.update(TESTING=True)
    limiter.enabled = False
    with app.app_context():
        db.drop_all()
        db.create_all()
        sch = School(school_name="S")
        db.session.add(sch); db.session.flush()
        br = Branch(branch_code="T", branch_name="Tolichowki", school_id=sch.id)
        db.session.add(br); db.session.flush()
        db.session.add(OrgMaster(master_type="ACADEMIC_YEAR", code="2025-2026", display_name="2025-2026", is_active=True))
        db.session.add(OrgMaster(master_type="ACADEMIC_YEAR", code=YEAR, display_name=YEAR, is_active=True))
        c3 = ClassMaster(class_name="3")
        db.session.add(c3); db.session.flush()
        db.session.add(ClassSection(class_id=c3.id, branch_id=br.id, academic_year=YEAR, section_name="A", student_strength=40))
        # Every Sunday off; 10 June holiday for all; 17 June holiday for STAFF only (a school day for students)
        db.session.add(WeeklyOffRule(branch_id=br.id, weekday=6, week_number=None, academic_year=YEAR, active=True))
        db.session.add(HolidayCalendar(branch_id=br.id, title="Eid", start_date=D(2026, 6, 10), end_date=D(2026, 6, 10),
                                       holiday_for="All", academic_year=YEAR, active=True))
        db.session.add(HolidayCalendar(branch_id=br.id, title="Staff training", start_date=D(2026, 6, 17),
                                       end_date=D(2026, 6, 17), holiday_for="StaffOnly", academic_year=YEAR, active=True))
        old = Student(first_name="Old", last_name="Kid", admission_no="A1", branch="Tolichowki", clazz="3",
                      section="A", status="Active", admission_date=D(2024, 6, 1))
        new = Student(first_name="New", last_name="Kid", admission_no="A2", branch="Tolichowki", clazz="3",
                      section="A", status="Active", admission_date=D(2026, 7, 15))
        left = Student(first_name="Left", last_name="Kid", admission_no="A3", branch="Tolichowki", clazz="3",
                       section="A", status="Inactive", admission_date=D(2024, 6, 1),
                       inactivated_date=dt.datetime(2026, 9, 10, 10, 0))
        db.session.add_all([old, new, left]); db.session.flush()
        for st in (old, new, left):
            db.session.add(StudentAcademicRecord(student_id=st.student_id, academic_year=YEAR, class_name="3", section="A"))
        su = User(username="su", password="x", role="SuperAdmin")
        db.session.add(su)
        for obj in list(db.session.new):
            for col in obj.__table__.columns:
                if col.primary_key or col.nullable or col.default is not None or col.server_default is not None:
                    continue
                attr = [k for k, v in obj.__mapper__.columns.items() if v is col][0]
                if getattr(obj, attr) is None:
                    t = col.type
                    setattr(obj, attr, 0 if isinstance(t, (sa.Integer, sa.Numeric)) else
                            D(2026, 1, 1) if isinstance(t, sa.Date) else t.enums[0] if isinstance(t, sa.Enum) else "x")
        db.session.commit()
        ids = {"old": old.student_id, "new": new.student_id, "left": left.student_id, "branch": br.id,
               "class": c3.id, "su": su.user_id}
    tok = jwt.encode({"user_id": ids["su"], "exp": dt.datetime.utcnow() + dt.timedelta(hours=1)},
                     app.config["SECRET_KEY"], algorithm="HS256")
    headers = {"Authorization": f"Bearer {tok}", "X-Academic-Year": YEAR, "X-Branch": "Tolichowki"}
    return {"app": app, "c": app.test_client(), "ids": ids, "h": headers, "db": db, "Attendance": Attendance}


def _rules():
    from services import student_attendance as r
    return r


def _student(env, key):
    from models import Student
    return env["db"].session.get(Student, env["ids"][key])


def test_year_dates(env):
    r = _rules()
    with env["app"].app_context():
        assert r.year_range(YEAR) == (D(2026, 5, 1), D(2027, 4, 30))
        assert r.year_for_date(D(2026, 6, 10)) == YEAR
        assert r.year_for_date(D(2026, 4, 30)) == "2025-2026"


def test_calendar_matches_old_holiday_check(env):
    r = _rules()
    from routes.config_routes import is_weekoff_or_holiday
    with env["app"].app_context():
        cal = r.SchoolCalendar(env["ids"]["branch"], YEAR, env["ids"]["class"])
        d = D(2026, 6, 1)
        while d <= D(2026, 7, 31):
            old = is_weekoff_or_holiday(d, env["ids"]["branch"], YEAR, class_id=env["ids"]["class"])
            assert bool(cal.blocked(d)) == bool(old["is_weekoff"] or old["is_holiday"]), d
            d += dt.timedelta(days=1)
        assert cal.blocked(D(2026, 6, 17)) is None          # staff-only holiday: school day for students
        assert cal.blocked(D(2026, 6, 10)).startswith("Holiday")


def test_month_rules_half_day_unmarked_future(env):
    r = _rules()
    with env["app"].app_context():
        st = _student(env, "old")
        cal = r.SchoolCalendar(env["ids"]["branch"], YEAR, env["ids"]["class"])
        # June 2026: 30 days - 4 Sundays - 1 holiday = 25 working days
        work = [D(2026, 6, x) for x in range(1, 31) if D(2026, 6, x).weekday() != 6 and x != 10]
        marks = {}
        for i, d in enumerate(work):
            marks[d] = "Present" if i < 20 else "Absent" if i < 22 else "Half Day" if i < 24 else None
        marks = {d: s for d, s in marks.items() if s}
        s = r.month_summary(st, 2026, 6, marks, cal, YEAR, today=D(2026, 11, 1))
        assert s["working"] == 25 and s["present"] == 21 and s["absent"] == 3 and s["not_marked"] == 1
        assert s["percent"] == 84.0
        assert s["days"]["2026-06-10"] == "H" and s["days"]["2026-06-17"] in ("P", "A", "HD", "")
        assert list(s["days"].values()).count("") == 1                     # unmarked shows blank
        # Same month seen on 15 June: only days up to today count
        s2 = r.month_summary(st, 2026, 6, marks, cal, YEAR, today=D(2026, 6, 15))
        assert s2["days"]["2026-06-16"] == "F" and s2["working"] == len([d for d in work if d <= D(2026, 6, 15)])


def test_joining_and_leaving_dates(env):
    r = _rules()
    with env["app"].app_context():
        cal = r.SchoolCalendar(env["ids"]["branch"], YEAR, env["ids"]["class"])
        new = _student(env, "new")
        june = r.month_summary(new, 2026, 6, {}, cal, YEAR, today=D(2026, 11, 1))
        assert june["outside"] and set(june["days"].values()) == {"-"}      # joined 15 July: June is "-"
        july = r.month_summary(new, 2026, 7, {D(2026, 7, 15): "Present"}, cal, YEAR, today=D(2026, 11, 1))
        assert all(july["days"][f"2026-07-{x:02d}"] == "-" for x in range(1, 15))
        july_working = len([x for x in range(15, 32) if D(2026, 7, x).weekday() != 6])
        assert july["working"] == july_working and july["present"] == 1
        left = _student(env, "left")
        sept = r.month_summary(left, 2026, 9, {}, cal, YEAR, today=D(2026, 11, 1))
        assert sept["days"]["2026-09-11"] == "-" and sept["days"]["2026-09-09"] in ("", "H")
        oct_ = r.month_summary(left, 2026, 10, {}, cal, YEAR, today=D(2026, 11, 1))
        assert oct_["outside"]


def test_save_half_day_year_from_date_and_joining_block(env):
    h = {**env["h"], "X-Academic-Year": YEAR}
    body = {"attendance": [
        {"student_id": env["ids"]["old"], "date": "2026-06-11", "status": "HD"},
        {"student_id": env["ids"]["old"], "date": "2026-06-12", "status": "Present"},
        {"student_id": env["ids"]["new"], "date": "2026-07-14", "status": "Present"},   # before joining: skipped
        {"student_id": env["ids"]["old"], "date": "2026-06-14", "status": "Present"},   # Sunday: skipped
        {"student_id": env["ids"]["old"], "date": "2026-06-17", "status": "Absent"},    # staff-only holiday: allowed
    ]}
    r = env["c"].post("/api/attendance", json=body, headers=h)
    assert r.status_code == 200, r.get_json()
    st = r.get_json()["stats"]
    assert st["added"] == 3 and st["skipped"] == 2
    with env["app"].app_context():
        A = env["Attendance"]
        hd = A.query.filter_by(student_id=env["ids"]["old"], date=D(2026, 6, 11)).one()
        assert hd.status == "Half Day" and hd.academic_year == YEAR
        assert A.query.filter_by(student_id=env["ids"]["new"]).count() == 0


def test_register_api_uses_rules(env):
    q = {"class": "3", "section": "A", "month": 6, "year": 2026, "branch": "Tolichowki"}
    d = env["c"].get("/api/attendance", query_string=q, headers=env["h"]).get_json()
    reg = {int(k): v for k, v in d["register"].items()}
    old = reg[env["ids"]["old"]]
    assert old["days"]["2026-06-11"] == "HD" and old["days"]["2026-06-10"] == "H" and old["present"] == 1.5
    assert d["blocked_reasons"]["2026-06-10"].startswith("Holiday")
    assert reg[env["ids"]["new"]]["outside"] is True                       # not joined in June
    assert env["ids"]["left"] in reg                                        # left in Sept: still listed for June
    q_oct = {**q, "month": 10}
    d_oct = env["c"].get("/api/attendance", query_string=q_oct, headers=env["h"]).get_json()
    assert env["ids"]["left"] not in {int(k) for k in d_oct["register"]}    # left before October


def test_report_card_helper_uses_rules(env):
    from routes.report_card_routes import _attendance_like_register
    with env["app"].app_context():
        monthly, p, a, t = _attendance_like_register(None, env["ids"]["old"], [(2026, 6)], env["ids"]["branch"], YEAR,
                                                     class_id=str(env["ids"]["class"]))
        assert monthly[0]["month"] == "Jun" and p == 1.5 and a == 1.5 and t == 25
        monthly_new, *_ = _attendance_like_register(None, env["ids"]["new"], [(2026, 6), (2026, 7)],
                                                    env["ids"]["branch"], YEAR)
        assert monthly_new[0]["total"] == "-" and monthly_new[1]["total"] != "-"


def test_school_years_setting(env):
    """Each school sets its own year: 2026-2027 runs 1 June - 31 May for this school."""
    r = _rules()
    from models import School
    with env["app"].app_context():
        school_id = School.query.first().id
    h = env["h"]
    lst = env["c"].get("/api/config/academic-years", query_string={"school_id": school_id}, headers=h).get_json()
    y = next(x for x in lst["years"] if x["code"] == YEAR)
    assert y["start_date"] == "2026-05-01" and not y["is_custom"]
    # Single year change that clashes with next year's default dates is refused...
    bad = env["c"].put(f"/api/config/academic-years/{YEAR}", json={"school_id": school_id, "start_date": "2026-03-01",
                                                                    "end_date": "2026-02-01"}, headers=h)
    assert bad.status_code == 400
    clash = env["c"].put("/api/config/academic-years/2025-2026", json={"school_id": school_id, "start_date": "2025-06-01",
                                                                       "end_date": "2026-05-31"}, headers=h)
    assert clash.status_code == 409
    # ... the "same start every year" setting does all years at once
    ok = env["c"].post("/api/config/academic-years/pattern", json={"school_id": school_id, "start_month": 6, "start_day": 1},
                       headers=h)
    assert ok.status_code == 200, ok.get_json()
    years = {x["code"]: x for x in ok.get_json()["years"]}
    assert years[YEAR]["start_date"] == "2026-06-01" and years[YEAR]["end_date"] == "2027-05-31" and years[YEAR]["is_custom"]
    with env["app"].app_context():
        assert r.year_range(YEAR, school_id) == (D(2026, 6, 1), D(2027, 5, 31))
        assert r.year_for_date(D(2026, 5, 20), school_id=school_id) == "2025-2026"   # May now belongs to last year
        assert r.year_range(YEAR) == (D(2026, 5, 1), D(2027, 4, 30))                  # other schools keep the default
        from models import Student
        old = env["db"].session.get(Student, env["ids"]["old"])
        assert r.student_period(old, YEAR)[0] == D(2026, 6, 1)
    # Back to the default for one year
    back = env["c"].delete(f"/api/config/academic-years/{YEAR}", query_string={"school_id": school_id}, headers=h)
    assert back.status_code == 200
    assert next(x for x in back.get_json()["years"] if x["code"] == YEAR)["is_custom"] is False


def test_school_years_without_school_selected(env):
    """'All schools' selected (no school in the request): the first school is used, not an empty page."""
    d = env["c"].get("/api/config/academic-years", headers=env["h"]).get_json()
    assert d["school_id"] and len(d["years"]) >= 2


def test_setup_your_school_access_controls_school_settings(env):
    """Whoever has 'Set up your school' access can change school years and holidays; others cannot."""
    import jwt
    from models import Permission, Role, RolePermission, School, User
    from routes.rbac_routes import _sync_permission_catalog
    db = env["db"]
    with env["app"].app_context():
        _sync_permission_catalog()
        perm = Permission.query.filter_by(code="setup.school-setup.setup-school").one()
        setup_role, plain_role = Role(name="Setup person", is_active=True), Role(name="Teacher", is_active=True)
        db.session.add_all([setup_role, plain_role]); db.session.flush()
        db.session.add(RolePermission(role_id=setup_role.id, permission_id=perm.id, can_read=True, can_write=True))
        school_id = School.query.first().id
        setup_user = User(username="setupper", password="x", role="Setup person", role_id=setup_role.id, school_id=school_id,
                          branch_id=env["ids"]["branch"], default_branch_id=env["ids"]["branch"])
        teacher = User(username="teacher1", password="x", role="Teacher", role_id=plain_role.id, school_id=school_id)
        db.session.add_all([setup_user, teacher]); db.session.commit()
        tokens = {u.username: jwt.encode({"user_id": u.user_id, "exp": dt.datetime.utcnow() + dt.timedelta(hours=1)},
                                         env["app"].config["SECRET_KEY"], algorithm="HS256") for u in (setup_user, teacher)}
    hdr = lambda name: {**env["h"], "Authorization": f"Bearer {tokens[name]}"}
    body = {"school_id": school_id, "start_month": 6, "start_day": 1}
    assert env["c"].post("/api/config/academic-years/pattern", json=body, headers=hdr("setupper")).status_code == 200
    assert env["c"].post("/api/config/academic-years/pattern", json=body, headers=hdr("teacher1")).status_code == 403
    assert env["c"].get("/api/config/academic-years", headers=hdr("setupper")).get_json()["can_edit"] is True
    holiday = {"branch_id": env["ids"]["branch"], "title": "Founders Day", "start_date": "2026-08-20",
               "end_date": "2026-08-20", "holiday_for": "All"}
    assert env["c"].post("/api/config/holiday", json=holiday, headers=hdr("teacher1")).status_code == 403
    assert env["c"].post("/api/config/weekoff", json={"branch_id": env["ids"]["branch"], "weekday": 5},
                         headers=hdr("teacher1")).status_code == 403
    assert env["c"].post("/api/config/holiday", json=holiday, headers=hdr("setupper")).status_code in (200, 201)


def test_fees_dashboard_loads_with_school_year_dates(env):
    """The Home/Fees dashboard orders months by the school's own year start (it must keep loading)."""
    from models import School
    with env["app"].app_context():
        sid = School.query.first().id
    for extra in ({}, {"X-School-ID": str(sid)}, {"X-Branch": "All"}):
        r = env["c"].get("/api/dashboard/fees", headers={**env["h"], **extra})
        assert r.status_code == 200, (extra, r.get_data(as_text=True)[:200])
        assert r.get_json()["last_year"] == "2025-2026"
