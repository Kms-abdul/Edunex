"""Each school's own academic year dates (Setup > School settings > School years)

Revision ID: e2a4c6b8d0f1
Revises: d8f1b3c5e7a9
Create Date: 2026-11-17
"""
from alembic import op
import sqlalchemy as sa


revision = 'e2a4c6b8d0f1'
down_revision = 'd8f1b3c5e7a9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'school_academic_years',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('school_id', sa.Integer(), sa.ForeignKey('schools.id', ondelete='CASCADE'), nullable=False),
        sa.Column('academic_year', sa.String(length=20), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('updated_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.UniqueConstraint('school_id', 'academic_year', name='uq_school_academic_year'),
        sa.CheckConstraint('end_date > start_date', name='chk_school_academic_year_dates'),
    )


def downgrade():
    op.drop_table('school_academic_years')
