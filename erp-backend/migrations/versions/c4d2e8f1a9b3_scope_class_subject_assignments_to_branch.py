"""Scope class-subject assignments to their own branch

Older code saved class-subject assignments with location_name hard-coded to
'Hyderabad' and without the branch's own branch_id (the session's header
branch was stamped instead, or nothing). Because tenant scoping treats rows
with a NULL / wrong branch_id as shared, a change made in one branch could
show up in other branches of the same location.

This data migration re-derives branch_id, school_id and location_name for
every row from its branch name, and removes duplicates that become identical
once the branch is correct (the oldest row is kept).

Revision ID: c4d2e8f1a9b3
Revises: b7023a69ca45
Create Date: 2026-11-03
"""
from alembic import op
import sqlalchemy as sa


revision = 'c4d2e8f1a9b3'
down_revision = 'b7023a69ca45'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    branches = conn.execute(sa.text(
        "SELECT id, branch_name, school_id, location_code FROM branches"
    )).mappings().all()
    locations = {
        r["code"]: r["display_name"]
        for r in conn.execute(sa.text(
            "SELECT code, display_name FROM org_master WHERE master_type = 'LOCATION'"
        )).mappings().all()
    }

    by_name = {}
    for b in branches:
        by_name.setdefault(b["branch_name"], []).append(b)

    rows = conn.execute(sa.text(
        "SELECT id, class_id, subject_id, academic_year, branch, branch_id, school_id, location_name "
        "FROM classsubjectassignment ORDER BY id"
    )).mappings().all()

    def target_branch(row):
        candidates = by_name.get(row["branch"] or "", [])
        if len(candidates) > 1 and row["school_id"] is not None:
            candidates = [b for b in candidates if b["school_id"] == row["school_id"]]
        return candidates[0] if len(candidates) == 1 else None

    # Rows whose branch can't be resolved are left untouched; reserve their keys first.
    seen = set()
    resolvable = []
    for row in rows:
        b = target_branch(row)
        if b is None:
            seen.add((row["class_id"], row["subject_id"], row["academic_year"], row["location_name"], row["branch_id"]))
        else:
            resolvable.append((row, b))

    to_delete = []
    updates = []
    for row, b in resolvable:
        location_name = locations.get(b["location_code"]) or b["location_code"] or row["location_name"] or "Default"
        key = (row["class_id"], row["subject_id"], row["academic_year"], location_name, b["id"])
        if key in seen:
            to_delete.append(row["id"])
            continue
        seen.add(key)

        if (row["branch_id"], row["school_id"], row["location_name"]) != (b["id"], b["school_id"], location_name):
            updates.append({
                "id": row["id"],
                "branch_id": b["id"],
                "school_id": b["school_id"],
                "location_name": location_name,
            })

    # Delete duplicates first so the unique constraint holds while updating.
    for row_id in to_delete:
        conn.execute(sa.text("DELETE FROM classsubjectassignment WHERE id = :id"), {"id": row_id})
    # Two phases so rows swapping keys never collide on the unique constraint mid-way.
    for u in updates:
        conn.execute(sa.text(
            "UPDATE classsubjectassignment SET location_name = :tmp WHERE id = :id"
        ), {"id": u["id"], "tmp": f"__tmp_{u['id']}"})
    for u in updates:
        conn.execute(sa.text(
            "UPDATE classsubjectassignment "
            "SET branch_id = :branch_id, school_id = :school_id, location_name = :location_name "
            "WHERE id = :id"
        ), u)

    print(f"[migration] class-subject assignments: {len(updates)} repaired, {len(to_delete)} duplicates removed")


def downgrade():
    # Data repair only; the previous (incorrect) values cannot be restored.
    pass
