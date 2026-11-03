"""Add present city/PIN and permanent address/PIN to students

The admission form has always collected these, but the students table had
no columns for them, so they were silently dropped on save.

Revision ID: d5e1f7a2b8c4
Revises: c4d2e8f1a9b3
Create Date: 2026-11-03
"""
from alembic import op
import sqlalchemy as sa


revision = 'd5e1f7a2b8c4'
down_revision = 'c4d2e8f1a9b3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('students') as batch:
        batch.add_column(sa.Column('presentCity', sa.String(length=100), nullable=True))
        batch.add_column(sa.Column('presentPin', sa.String(length=10), nullable=True))
        batch.add_column(sa.Column('permanentAddress', sa.Text(), nullable=True))
        batch.add_column(sa.Column('permanentPin', sa.String(length=10), nullable=True))


def downgrade():
    with op.batch_alter_table('students') as batch:
        batch.drop_column('permanentPin')
        batch.drop_column('permanentAddress')
        batch.drop_column('presentPin')
        batch.drop_column('presentCity')
