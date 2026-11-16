"""
Edit and cancel an enquiry (routes/enquiry_routes.py: PUT /api/enquiry/<id>, POST /api/enquiry/<id>/cancel).

Run from erp-backend/:   python -m pytest tests -q
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from test_enquiry import _enquiry, aadhaar, env  # noqa: F401  (pytest fixture)


def _body(**over):
    d = {"student_name": "Edit Kid", "guardian_name": "Edit Parent", "class_name": "5", "contact": "9848011111",
         "student_type": "NEW"}
    d.update(over)
    return d


def _put(env, eid, user="su", **body):
    return env["c"].put(f"/api/enquiry/{eid}", json=body, headers=env["h"](user))


def _history(env, eid, user="su"):
    return env["c"].get(f"/api/enquiry/{eid}/followups", headers=env["h"](user)).get_json()


def test_edit_keeps_history_and_asks_for_reprint(env):
    eid = _enquiry(env, **_body()).get_json()["enquiry"]["id"]
    assert _put(env, eid, **_body()).status_code == 400                       # nothing changed
    env["c"].post(f"/api/enquiry/{eid}/printed", headers=env["h"]("su"))
    r = _put(env, eid, user="clerk", **_body(contact="9848011112", student_name="Edit Kidd"))
    assert r.status_code == 200, r.get_json()
    e = r.get_json()["enquiry"]
    assert e["contact"] == "9848011112" and e["needs_reprint"] and e["print"]["contact"] == "9848011112"
    assert e["print"]["student_name"] == "Edit Kidd"
    h = _history(env, eid)
    ev = next(x for x in h["events"] if x["kind"] == "edited")
    assert "Mobile 9848011111 → 9848011112" in ev["text"] and ev["by"] == "clerk"
    assert h["details"]["needs_reprint"] and h["can_edit"] and h["can_cancel"]
    # Printing again clears "print again"
    env["c"].post(f"/api/enquiry/{eid}/printed", headers=env["h"]("su"))
    assert not _history(env, eid)["details"]["needs_reprint"]


def test_edit_aadhaar_add_replace_remove(env):
    eid = _enquiry(env, **_body(student_name="Aadhaar Kid", contact="9848022222")).get_json()["enquiry"]["id"]
    other = _enquiry(env, **_body(student_name="Other Kid", contact="9848033333",
                                  aadhaar=aadhaar("71234567890"))).get_json()["enquiry"]
    base = _body(student_name="Aadhaar Kid", contact="9848022222")
    dup = _put(env, eid, **base, aadhaar=aadhaar("71234567890"))
    assert dup.status_code == 409 and dup.get_json()["existing_no"] == other["enquiry_no"]
    ok = _put(env, eid, **base, aadhaar=aadhaar("72345678901"))
    assert ok.status_code == 200 and ok.get_json()["enquiry"]["aadhaar_masked"].endswith(aadhaar("72345678901")[-4:])
    assert _put(env, eid, **base).status_code == 400                           # no "aadhaar" key = keep it
    gone = _put(env, eid, **base, aadhaar="")
    assert gone.status_code == 200 and gone.get_json()["enquiry"]["aadhaar_masked"] is None
    ev = [x["text"] for x in _history(env, eid)["events"] if x["kind"] == "edited"]
    assert any("Removed" in t for t in ev) and not any(aadhaar("72345678901") in t for t in ev)  # never in full


def test_fee_change_updates_quote(env):
    eid = _enquiry(env, **_body(student_name="Class Kid", contact="9848044444")).get_json()["enquiry"]["id"]
    assert _put(env, eid, **_body(student_name="Class Kid", contact="9848044444", class_name="99")).status_code == 400
    r = _put(env, eid, **_body(student_name="Class Kid", contact="9848044444", student_type="OLD"))
    assert r.status_code == 200 and "fee is updated" in r.get_json()["message"]
    assert r.get_json()["enquiry"]["print"]["student_type"] == "OLD"
    ev = next(x for x in _history(env, eid)["events"] if x["kind"] == "edited")
    assert "Fees for New student → Old student" in ev["text"]


def test_cancel_and_restore(env):
    a = aadhaar("73456789012")
    eid = _enquiry(env, **_body(student_name="Cancel Kid", contact="9848055555", aadhaar=a)).get_json()["enquiry"]["id"]
    c = env["c"]
    assert c.post(f"/api/enquiry/{eid}/cancel", json={"reason": "Bad"}, headers=env["h"]("su")).status_code == 400
    assert c.post(f"/api/enquiry/{eid}/cancel", json={"reason": "Other"}, headers=env["h"]("su")).status_code == 400
    assert c.post(f"/api/enquiry/{eid}/cancel", json={"reason": "Duplicate enquiry"},
                  headers=env["h"]("nobody")).status_code == 403
    r = c.post(f"/api/enquiry/{eid}/cancel", json={"reason": "Duplicate enquiry"}, headers=env["h"]("clerk"))
    assert r.status_code == 200 and r.get_json()["enquiry"]["status"] == "CANCELLED"

    q = {"branch_id": env["ids"]["A"]}
    calls = c.get("/api/enquiry/calls", query_string={**q, "bucket": "upcoming"}, headers=env["h"]("su")).get_json()
    assert all(x["id"] != eid for x in calls["calls"])                          # out of the calls
    lst = c.get("/api/enquiry", query_string={**q, "status": "CANCELLED"}, headers=env["h"]("su")).get_json()
    assert any(x["id"] == eid for x in lst["enquiries"])                       # still in the list
    assert _put(env, eid, **_body(student_name="Cancel Kid", contact="9848055556")).status_code == 409
    assert c.post(f"/api/enquiry/{eid}/followups", json={"outcome": "NO_ANSWER"}, headers=env["h"]("su")).status_code == 409
    h = _history(env, eid)
    assert h["can_reopen"] and not h["can_edit"] and any(x["kind"] == "cancelled" for x in h["events"])

    # The same child can now be entered correctly...
    again = _enquiry(env, **_body(student_name="Cancel Kid", contact="9848055555", aadhaar=a))
    assert again.status_code == 201
    # ...so restoring the cancelled one is refused (it would be a duplicate)
    assert c.post(f"/api/enquiry/{eid}/reopen", headers=env["h"]("su")).status_code == 409


def test_restore_and_dashboard_skip_cancelled(env):
    c, q = env["c"], {"branch_id": env["ids"]["A"], "period": "month"}
    before = c.get("/api/enquiry/dashboard", query_string=q, headers=env["h"]("su")).get_json()["tiles"]["enquiries"]
    eid = _enquiry(env, **_body(student_name="Restore Kid", contact="9848066666",
                                aadhaar=aadhaar("74567890123"))).get_json()["enquiry"]["id"]
    c.post(f"/api/enquiry/{eid}/cancel", json={"reason": "Other", "note": "Test entry"}, headers=env["h"]("su"))
    after = c.get("/api/enquiry/dashboard", query_string=q, headers=env["h"]("su")).get_json()["tiles"]["enquiries"]
    assert after == before
    assert c.post(f"/api/enquiry/{eid}/reopen", headers=env["h"]("clerk")).status_code == 403   # admin only
    r = c.post(f"/api/enquiry/{eid}/reopen", headers=env["h"]("su"))
    assert r.status_code == 200 and "Restored" in r.get_json()["message"]
    h = _history(env, eid)
    assert h["enquiry"]["status"] == "FOLLOW_UP" and [x["kind"] for x in h["events"]][-2:] == ["cancelled", "restored"]
    # The Aadhaar blocks duplicates again after restore
    dup = _enquiry(env, **_body(student_name="Restore Kid", contact="9848066666", aadhaar=aadhaar("74567890123")))
    assert dup.status_code == 409


def test_admitted_enquiry_cannot_be_changed(env):
    from extensions import db
    from enquiry_models import Enquiry
    from models import Student
    eid = _enquiry(env, **_body(student_name="Done Kid", contact="9848077777")).get_json()["enquiry"]["id"]
    with env["app"].app_context():
        st = Student(first_name="Done", last_name="Kid", admission_no="ADM-EDIT-1", branch="Alpha", clazz="5",
                     status="Active")
        db.session.add(st)
        db.session.flush()
        db.session.get(Enquiry, eid).converted_student_id = st.student_id
        db.session.commit()
    assert _put(env, eid, **_body(student_name="Done Kid", contact="9848077778")).status_code == 409
    assert env["c"].post(f"/api/enquiry/{eid}/cancel", json={"reason": "Entered by mistake"},
                         headers=env["h"]("su")).status_code == 409
    h = _history(env, eid)
    assert not h["can_edit"] and not h["can_cancel"]
