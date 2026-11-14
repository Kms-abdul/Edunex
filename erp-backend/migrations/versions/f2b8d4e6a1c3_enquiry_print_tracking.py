"""Enquiry print tracking (printed_at, printed_by, print_count)

Enquiries taken on a phone are printed later at the office; these columns
let the "To print" list show which slips are still waiting.

Revision ID: f2b8d4e6a1c3
Revises: e7a3c9d1f2b6
Create Date: 2026-11-15
"""
from alembic import op
import sqlalchemy as sa


revision = 'f2b8d4e6a1c3'
down_revision = 'e7a3c9d1f2b6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('enquiries') as batch:
        batch.add_column(sa.Column('printed_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('printed_by', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('print_count', sa.Integer(), nullable=False, server_default='0'))
        batch.create_foreign_key('fk_enquiries_printed_by_users', 'users', ['printed_by'], ['user_id'], ondelete='SET NULL')
        batch.create_index('idx_enquiry_branch_printed', ['branch_id', 'printed_at'])


def downgrade():
    with op.batch_alter_table('enquiries') as batch:
        batch.drop_index('idx_enquiry_branch_printed')
        batch.drop_constraint('fk_enquiries_printed_by_users', type_='foreignkey')
        batch.drop_column('print_count')
        batch.drop_column('printed_by')
        batch.drop_column('printed_at')
