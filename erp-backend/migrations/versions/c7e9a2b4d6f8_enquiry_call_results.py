"""Enquiry dropdown lists: add 'CALL_RESULT' (extra call-again results set by the admin)

Revision ID: c7e9a2b4d6f8
Revises: b4d6f8a1c3e5
Create Date: 2026-11-17
"""
from alembic import op
import sqlalchemy as sa


revision = 'c7e9a2b4d6f8'
down_revision = 'b4d6f8a1c3e5'
branch_labels = None
depends_on = None

OLD = sa.Enum('REJECT_REASON', 'BENEFIT', name='enquiry_option_kind')
NEW = sa.Enum('REJECT_REASON', 'BENEFIT', 'CALL_RESULT', name='enquiry_option_kind')


def upgrade():
    with op.batch_alter_table('enquiry_options') as batch:
        batch.alter_column('kind', existing_type=OLD, type_=NEW, existing_nullable=False)


def downgrade():
    op.execute("DELETE FROM enquiry_options WHERE kind = 'CALL_RESULT'")
    with op.batch_alter_table('enquiry_options') as batch:
        batch.alter_column('kind', existing_type=NEW, type_=OLD, existing_nullable=False)
