"""
Tests for enquiry follow-up calls, dashboard and dropdown settings (routes/enquiry_followup_routes.py).

Run from erp-backend/:   python -m pytest tests -q
"""
import datetime as dt
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from test_enquiry import _enquiry, env  # noqa: F401  (pytest fixture)

TODAY = dt.date.today()


def _call(env, eid, user="su", **body):
    return env["c"].post(f"/api/enquiry/{eid}/followups", json=body, headers=env["h"](user))


def _calls(env, user="su", **params):
    return env["c"].get("/api/enquiry/calls", query_string={"branch_id": env["ids"]["A"], **params},
                        headers=env["h"](user))


def _new(env, name):
    return _enquiry(env, student_name=name).get_json()["enquiry"]["id"]


def test_new_enquiry_is_due_tomorrow(env):
    eid = _new(env, "First Call")
    due = _calls(env).get_json()
    upcoming = _calls(env, bucket="upcoming").get_json()
    assert all(c["id"] != eid for c in due["calls"])
    row = next(c for c in upcoming["calls"] if c["id"] == eid)
    assert row["next_call_date"] == (TODAY + dt.timedelta(days=1)).isoformat() and row["status"] == "NEW"


def test_no_answer_and_call_later(env):
    eid = _new(env, "Busy Parent")
    r = _call(env, eid, outcome="NO_ANSWER")
    assert r.status_code == 201
    c = r.get_json()["call"]
    assert c["status"] == "FOLLOW_UP" and c["call_count"] == 1 and c["last_called_by"] == "su"
    assert c["next_call_date"] == (TODAY + dt.timedelta(days=1)).isoformat()

    assert _call(env, eid, outcome="CALL_LATER").status_code == 400                     # when?
    past = (TODAY - dt.timedelta(days=1)).isoformat()
    assert _call(env, eid, outcome="CALL_LATER", next_call_date=past).status_code == 400
    assert _call(env, eid, outcome="CALL_LATER", next_call_date=TODAY.isoformat(), next_call_slot="NIGHT").status_code == 400
    r = _call(env, eid, outcome="CALL_LATER", next_call_date=TODAY.isoformat(), next_call_slot="EVENING")
    assert r.status_code == 201 and "Evening" in r.get_json()["message"]
    due = _calls(env).get_json()
    row = next(x for x in due["calls"] if x["id"] == eid)
    assert row["next_call_slot"] == "EVENING" and row["last_outcome"] == "CALL_LATER"
    assert due["counts"]["today"] >= 1


def test_not_interested_needs_reason_then_reopen(env):
    eid = _new(env, "No Thanks")
    assert _call(env, eid, outcome="NOT_INTERESTED").status_code == 400
    assert _call(env, eid, outcome="NOT_INTERESTED", reason="Made up reason").status_code == 400
    assert _call(env, eid, outcome="NOT_INTERESTED", reason="Other").status_code == 400          # needs a note
    r = _call(env, eid, outcome="NOT_INTERESTED", reason="Fee too high", note="Wants 20% off")
    assert r.status_code == 201 and r.get_json()["call"]["status"] == "CLOSED"
    assert _call(env, eid, outcome="NO_ANSWER").status_code == 409                               # closed
    hist = env["c"].get(f"/api/enquiry/{eid}/followups", headers=env["h"]("su")).get_json()
    assert hist["close_reason"] == "Fee too high" and hist["can_reopen"] and not hist["can_call"]
    assert hist["history"][0]["outcome_label"] == "Not interested" and hist["history"][0]["called_by"] == "su"
    r = env["c"].post(f"/api/enquiry/{eid}/reopen", headers=env["h"]("su"))
    assert r.status_code == 200
    row = next(x for x in _calls(env).get_json()["calls"] if x["id"] == eid)
    assert row["status"] == "FOLLOW_UP" and row["next_call_date"] == TODAY.isoformat()


def test_other_reason_saves_note_as_reason(env):
    eid = _new(env, "Other Reason")
    r = _call(env, eid, outcome="NOT_INTERESTED", reason="Other", note="Moving to Dubai")
    assert r.status_code == 201
    hist = env["c"].get(f"/api/enquiry/{eid}/followups", headers=env["h"]("su")).get_json()
    assert hist["close_reason"] == "Moving to Dubai"


def test_joined_and_wrong_number(env):
    eid = _new(env, "Happy Parent")
    _call(env, eid, outcome="WILL_VISIT", next_call_date=(TODAY + dt.timedelta(days=2)).isoformat())
    r = _call(env, eid, outcome="JOINED")
    assert r.status_code == 201 and r.get_json()["call"]["status"] == "JOINED"
    eid2 = _new(env, "Wrong Number")
    assert _call(env, eid2, outcome="WRONG_NUMBER").get_json()["call"]["status"] == "CLOSED"


def test_dashboard_counts(env):
    d = env["c"].get("/api/enquiry/dashboard", query_string={"branch_id": env["ids"]["A"], "period": "month"},
                     headers=env["h"]("su")).get_json()
    t = d["tiles"]
    assert t["enquiries"] >= 5 and t["joined"] >= 1 and t["not_interested"] >= 2 and t["calls_made"] >= 6
    assert t["joined_percent"] == round(t["joined"] * 100 / t["enquiries"])
    reasons = {r["reason"]: r["count"] for r in d["reasons"]}
    assert reasons.get("Wrong number") == 1 and reasons.get("Moving to Dubai") == 1
    assert d["callers"][0]["name"] == "su" and d["callers"][0]["joined"] >= 1


def test_dropdown_settings(env):
    q = {"branch_id": env["ids"]["A"]}
    lists = env["c"].get("/api/enquiry/dropdowns", query_string=q, headers=env["h"]("su")).get_json()
    assert "Fee too high" in [o["label"] for o in lists["reject_reasons"]]
    assert "Free uniform (2 sets)" in [o["label"] for o in lists["benefits"]]
    add = lambda label: env["c"].post("/api/enquiry/dropdowns", json={**q, "kind": "REJECT_REASON", "label": label},
                                      headers=env["h"]("su"))
    r = add("Looking for CBSE board")
    assert r.status_code == 201
    assert add("looking for cbse board").status_code == 409                       # duplicate, any case
    assert add("Other").status_code == 400                                        # always there anyway
    oid = r.get_json()["option"]["id"]
    eid = _new(env, "Board Parent")
    assert _call(env, eid, outcome="NOT_INTERESTED", reason="Looking for CBSE board").status_code == 201
    # Switched off: no longer accepted
    env["c"].put(f"/api/enquiry/dropdowns/{oid}", json={**q, "is_active": False}, headers=env["h"]("su"))
    eid2 = _new(env, "Board Parent Two")
    assert _call(env, eid2, outcome="NOT_INTERESTED", reason="Looking for CBSE board").status_code == 400


def test_permissions(env):
    # The clerk has Enquiry access only: no calls, no dashboard, no settings
    assert _calls(env, user="clerk").status_code == 403
    assert env["c"].get("/api/enquiry/dashboard", query_string={"branch_id": env["ids"]["A"]},
                        headers=env["h"]("clerk")).status_code == 403
    assert env["c"].post("/api/enquiry/dropdowns", json={"branch_id": env["ids"]["A"], "kind": "BENEFIT", "label": "X X"},
                         headers=env["h"]("clerk")).status_code == 403
    eid = _new(env, "Perm Check")
    assert _call(env, eid, user="clerk", outcome="NO_ANSWER").status_code == 403
    assert env["c"].post(f"/api/enquiry/{eid}/reopen", headers=env["h"]("clerk")).status_code == 403
    # Other branch is never visible
    r = env["c"].get("/api/enquiry/calls", query_string={"branch_id": env["ids"]["B"]}, headers=env["h"]("clerk"))
    assert r.status_code == 403


def test_my_calls_filter(env):
    eid = _new(env, "Mine Only")
    _call(env, eid, outcome="CALL_LATER", next_call_date=TODAY.isoformat())
    mine = _calls(env, mine="1").get_json()
    assert any(c["id"] == eid for c in mine["calls"])


def test_custom_call_results(env):
    q = {"branch_id": env["ids"]["A"]}
    lists = env["c"].get("/api/enquiry/dropdowns", query_string=q, headers=env["h"]("su")).get_json()
    assert "Will discuss with family" in [o["label"] for o in lists["call_results"]]
    r = env["c"].post("/api/enquiry/dropdowns", json={**q, "kind": "CALL_RESULT", "label": "Wants to see the bus route"},
                      headers=env["h"]("su"))
    assert r.status_code == 201
    eid = _new(env, "Custom Result")
    when = (TODAY + dt.timedelta(days=3)).isoformat()
    ok = _call(env, eid, outcome="CALL_LATER", reason="Wants to see the bus route", next_call_date=when)
    assert ok.status_code == 201 and ok.get_json()["call"]["next_call_date"] == when
    assert _call(env, eid, outcome="CALL_LATER", reason="Not in the list", next_call_date=when).status_code == 400
    hist = env["c"].get(f"/api/enquiry/{eid}/followups", headers=env["h"]("su")).get_json()["history"]
    assert hist[0]["outcome_label"] == "Wants to see the bus route"


def test_history_has_all_events(env):
    eid = _new(env, "History Kid")
    env["c"].post(f"/api/enquiry/{eid}/printed", headers=env["h"]("su"))
    _call(env, eid, outcome="NO_ANSWER")
    h = env["c"].get(f"/api/enquiry/{eid}/followups", headers=env["h"]("su")).get_json()
    kinds = [x["kind"] for x in h["events"]]
    assert kinds[:2] == ["created", "printed"] and h["events"][0]["by"] == "su"
    assert h["details"]["student_name"] == "History Kid" and h["details"]["enquiry_no"].startswith("ENQ-")
    assert len(h["history"]) == 1 and h["application"] is None
    # Front-office users (enquiry permission, no calls permission) can see the history too
    assert env["c"].get(f"/api/enquiry/{eid}/followups", headers=env["h"]("clerk")).status_code == 200
