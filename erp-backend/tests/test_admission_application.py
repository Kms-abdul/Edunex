"""
Online admission form after "Admission confirmed" (routes/admission_application_routes.py).

Run from erp-backend/:   python -m pytest tests -q
File storage is replaced by an in-memory dict, so nothing is written to disk.
"""
import datetime as dt
import io
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_enquiry import _enquiry, aadhaar, env  # noqa: F401  (pytest fixture)

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 200
PHOTO = "data:image/jpeg;base64," + "A" * 400


@pytest.fixture(autouse=True)
def memory_storage(monkeypatch):
    import services.storage_service as st
    store = {}

    def upload(stream, filename, folder=""):
        key = f"{folder}/{filename}".strip("/")
        stream.seek(0)
        store[key] = stream.read()
        return key

    monkeypatch.setattr(st, "upload_file_to_storage", upload)
    monkeypatch.setattr(st, "get_file_stream", lambda key: io.BytesIO(store[key]))
    monkeypatch.setattr(st, "generate_student_document_key", lambda sid, t, f: f"students/{sid}/aadhaar.png")
    return store


def _joined_enquiry(env, name, contact):
    eid = _enquiry(env, student_name=name, contact=contact).get_json()["enquiry"]["id"]
    r = env["c"].post(f"/api/enquiry/{eid}/followups", json={"outcome": "JOINED"}, headers=env["h"]("su"))
    assert r.status_code == 201
    return eid


def _send(env, eid):
    return env["c"].post(f"/api/enquiry/{eid}/application", headers=env["h"]("su"))


def _form(**over):
    d = {"first_name": "Ravi", "last_name": "Kumar", "gender": "Male", "dob": "2018-05-12",
         "Adharcardno": aadhaar("56789012345"), "Fatherfirstname": "Suresh", "FatherPhone": "9848012345",
         "Motherfirstname": "Lakshmi", "phone": "9848012345", "address": "Road 4, Hyderabad",
         "presentPin": "500008", "photo": PHOTO}
    d.update(over)
    return d


def test_full_journey(env, memory_storage):
    c, h = env["c"], env["h"]("su")
    eid = _enquiry(env, student_name="Ravi Kumar", contact="9848012345").get_json()["enquiry"]["id"]
    assert _send(env, eid).status_code == 409                      # not confirmed yet
    c.post(f"/api/enquiry/{eid}/followups", json={"outcome": "JOINED"}, headers=h)
    r = _send(env, eid)
    assert r.status_code == 200
    sent = r.get_json()
    token = sent["token"]
    assert "{link}" in sent["text"] and "Ravi Kumar" in sent["text"] and sent["form_path"].endswith(token)

    info = c.get(f"/api/public/apply/{token}").get_json()
    assert info["state"] == "open" and info["school_name"] == "Test School"
    assert "9848012345" not in str(info)                             # nothing personal before the check

    bad = c.post(f"/api/public/apply/{token}/verify", json={"mobile": "9000000000"})
    assert bad.status_code == 403 and "tries left" in bad.get_json()["error"]
    ok = c.post(f"/api/public/apply/{token}/verify", json={"mobile": "+91 98480 12345"})
    assert ok.status_code == 200
    session = ok.get_json()["session"]
    assert ok.get_json()["form"]["data"]["first_name"] == "Ravi"       # pre-filled from the enquiry
    ph = {"X-Apply-Session": session}

    assert c.put(f"/api/public/apply/{token}", json={"data": _form()}).status_code == 401     # no session
    draft = c.put(f"/api/public/apply/{token}", json={"data": _form(Adharcardno="5678")}, headers=ph)
    assert draft.status_code == 200                                   # half-typed Aadhaar is just not kept yet

    assert c.post(f"/api/public/apply/{token}/submit", json={"data": _form()}, headers=ph).status_code == 400  # no doc
    fake = c.post(f"/api/public/apply/{token}/aadhaar-doc", data={"file": (io.BytesIO(b"hello"), "a.png")},
                  headers=ph, content_type="multipart/form-data")
    assert fake.status_code == 400                                    # not really a picture / PDF
    up = c.post(f"/api/public/apply/{token}/aadhaar-doc", data={"file": (io.BytesIO(PNG), "a.png")},
                headers=ph, content_type="multipart/form-data")
    assert up.status_code == 200
    assert c.post(f"/api/public/apply/{token}/submit", json={"data": _form(Motherfirstname="")}, headers=ph).status_code == 400
    sub = c.post(f"/api/public/apply/{token}/submit", json={"data": _form()}, headers=ph)
    assert sub.status_code == 200, sub.get_json()
    assert c.post(f"/api/public/apply/{token}/submit", json={"data": _form()}, headers=ph).status_code == 409

    # The parent's session can never be used for staff APIs
    staff_with_parent = c.get("/api/enquiry/applications", query_string={"branch_id": env["ids"]["A"]},
                              headers={"Authorization": f"Bearer {session}", "X-Branch-ID": str(env["ids"]["A"])})
    assert staff_with_parent.status_code == 401

    lst = c.get("/api/enquiry/applications", query_string={"branch_id": env["ids"]["A"]}, headers=h).get_json()
    app_row = next(a for a in lst["applications"] if a["enquiry_id"] == eid)
    assert app_row["status"] == "SUBMITTED" and app_row["has_aadhaar_doc"] and lst["counts"]["SUBMITTED"] >= 1
    full = c.get(f"/api/enquiry/applications/{app_row['id']}", headers=h).get_json()["application"]
    assert full["data"]["Motherfirstname"] == "Lakshmi" and full["data"]["photo"] == PHOTO
    doc = c.get(f"/api/enquiry/applications/{app_row['id']}/aadhaar-doc", headers=h)
    assert doc.status_code == 200 and doc.data == PNG

    # Office saves the filled-in Add Student form -> student exists -> link it
    from extensions import db
    from models import Student, StudentDocument
    from enquiry_models import Enquiry
    with env["app"].app_context():
        st = Student(first_name="Ravi", last_name="Kumar", admission_no="ADM-NEW-1", branch="Alpha", clazz="5",
                     status="Active")
        db.session.add(st)
        db.session.commit()
        sid = st.student_id
    adm = c.post(f"/api/enquiry/applications/{app_row['id']}/admit", json={"student_id": sid}, headers=h)
    assert adm.status_code == 200 and "Aadhaar copy added" in adm.get_json()["message"]
    with env["app"].app_context():
        assert db.session.get(Enquiry, eid).converted_student_id == sid
        assert StudentDocument.query.filter_by(student_id=sid).count() == 1
    assert _send(env, eid).status_code == 409                         # already admitted
    assert c.get(f"/api/public/apply/{token}").get_json()["state"] == "done"


def test_resend_replaces_link_and_expiry(env):
    c = env["c"]
    eid = _joined_enquiry(env, "Expire Kid", "9000022222")
    old = _send(env, eid).get_json()["token"]
    new = _send(env, eid).get_json()["token"]
    assert c.get(f"/api/public/apply/{old}").status_code == 404           # old link stops working
    assert c.get(f"/api/public/apply/{new}").get_json()["state"] == "open"
    from extensions import db
    from enquiry_models import AdmissionApplication
    with env["app"].app_context():
        a = AdmissionApplication.query.filter_by(enquiry_id=eid).one()
        a.expires_at = dt.datetime.utcnow() - dt.timedelta(minutes=1)
        db.session.commit()
    assert c.get(f"/api/public/apply/{new}").get_json()["state"] == "expired"
    assert c.post(f"/api/public/apply/{new}/verify", json={"mobile": "9000022222"}).status_code == 410


def test_wrong_mobile_locks_after_ten_tries(env):
    c = env["c"]
    eid = _joined_enquiry(env, "Lock Kid", "9000033333")
    token = _send(env, eid).get_json()["token"]
    for _ in range(10):
        c.post(f"/api/public/apply/{token}/verify", json={"mobile": "9111111111"})
    r = c.post(f"/api/public/apply/{token}/verify", json={"mobile": "9000033333"})
    assert r.status_code == 423                                             # even the right number now waits for a resend


def test_existing_student_aadhaar_is_refused(env):
    c = env["c"]
    eid = _joined_enquiry(env, "Twin Kid", "9000044444")
    token = _send(env, eid).get_json()["token"]
    session = c.post(f"/api/public/apply/{token}/verify", json={"mobile": "9000044444"}).get_json()["session"]
    ph = {"X-Apply-Session": session}
    c.post(f"/api/public/apply/{token}/aadhaar-doc", data={"file": (io.BytesIO(PNG), "a.png")}, headers=ph,
           content_type="multipart/form-data")
    r = c.post(f"/api/public/apply/{token}/submit",
               json={"data": _form(Adharcardno=aadhaar("98765432109"), phone="9000044444")}, headers=ph)
    assert r.status_code == 400 and "already in the school" in r.get_json()["error"]


def test_permissions(env):
    eid = _joined_enquiry(env, "Perm Kid", "9000055555")
    assert env["c"].post(f"/api/enquiry/{eid}/application", headers=env["h"]("nobody")).status_code == 403
    assert env["c"].get("/api/enquiry/applications", query_string={"branch_id": env["ids"]["A"]},
                        headers=env["h"]("nobody")).status_code == 403
