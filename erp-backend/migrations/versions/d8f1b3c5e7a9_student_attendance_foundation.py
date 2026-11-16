"""Student attendance foundation: academic year dates, Half Day status

- org_master.start_date / end_date: first and last day of each academic year, so each
  attendance day is filed under the year its DATE belongs to (not the year picked in
  the header). Filled as 1 May - 30 April (same as the fee months) for existing years.
- attendance.status gains 'Half Day' (0.5 present + 0.5 absent).

Revision ID: d8f1b3c5e7a9
Revises: c7e9a2b4d6f8
Create Date: 2026-11-17
"""
import re
from datetime import date

from alembic import op
import sqlalchemy as sa


revision = 'd8f1b3c5e7a9'
down_revision = 'c7e9a2b4d6f8'
branch_labels = None
depends_on = None

OLD_STATUS = sa.Enum('Present', 'Absent', name='attendance_status')
NEW_STATUS = sa.Enum('Present', 'Absent', 'Half Day', name='attendance_status')


def upgrade():
    with op.batch_alter_table('org_master') as batch:
        batch.add_column(sa.Column('start_date', sa.Date(), nullable=True))
        batch.add_column(sa.Column('end_date', sa.Date(), nullable=True))

    conn = op.get_bind()
    org = sa.table('org_master', sa.column('id', sa.Integer), sa.column('master_type', sa.String),
                   sa.column('code', sa.String), sa.column('start_date', sa.Date), sa.column('end_date', sa.Date))
    for row in conn.execute(sa.select(org.c.id, org.c.code).where(org.c.master_type == 'ACADEMIC_YEAR')):
        m = re.match(r'^\s*(\d{4})', row.code or '')
        if not m:
            continue
        y = int(m.group(1))
        conn.execute(org.update().where(org.c.id == row.id)
                     .values(start_date=date(y, 5, 1), end_date=date(y + 1, 4, 30)))

    with op.batch_alter_table('attendance') as batch:
        batch.alter_column('status', existing_type=OLD_STATUS, type_=NEW_STATUS, existing_nullable=True)


def downgrade():
    # Half days cannot be stored any more: count them as Present
    op.execute("UPDATE attendance SET status = 'Present' WHERE status = 'Half Day'")
    with op.batch_alter_table('attendance') as batch:
        batch.alter_column('status', existing_type=NEW_STATUS, type_=OLD_STATUS, existing_nullable=True)
    with op.batch_alter_table('org_master') as batch:
        batch.drop_column('end_date')
        batch.drop_column('start_date')
