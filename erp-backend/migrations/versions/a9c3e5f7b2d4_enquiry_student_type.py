"""Enquiry: new / old student fee choice

Class fees have two lists ("fees for new students" and the regular fees for
old students); the enquiry records which one its quote used.

Revision ID: a9c3e5f7b2d4
Revises: f2b8d4e6a1c3
Create Date: 2026-11-15
"""
from alembic import op
import sqlalchemy as sa


revision = 'a9c3e5f7b2d4'
down_revision = 'f2b8d4e6a1c3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('enquiries') as batch:
        batch.add_column(sa.Column('student_type', sa.Enum('NEW', 'OLD', name='enquiry_student_type'),
                                   nullable=False, server_default='NEW'))


def downgrade():
    with op.batch_alter_table('enquiries') as batch:
        batch.drop_column('student_type')
