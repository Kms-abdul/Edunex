"""Online admission form sent to parents after "Admission confirmed"

Revision ID: f4b6d8e0a2c3
Revises: e2a4c6b8d0f1
Create Date: 2026-11-18
"""
from alembic import op
import sqlalchemy as sa


revision = 'f4b6d8e0a2c3'
down_revision = 'e2a4c6b8d0f1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'admission_applications',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('school_id', sa.Integer(), sa.ForeignKey('schools.id', ondelete='SET NULL'), nullable=True),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id', ondelete='CASCADE'), nullable=False),
        sa.Column('enquiry_id', sa.Integer(), sa.ForeignKey('enquiries.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('send_count', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('failed_checks', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.Enum('SENT', 'SUBMITTED', 'ADMITTED', 'CANCELLED', name='admission_application_status'),
                  nullable=False, server_default='SENT'),
        sa.Column('opened_at', sa.DateTime(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('data', sa.JSON(), nullable=True),
        sa.Column('aadhaar_doc_key', sa.String(length=500), nullable=True),
        sa.Column('aadhaar_doc_name', sa.String(length=255), nullable=True),
        sa.Column('aadhaar_doc_mime', sa.String(length=100), nullable=True),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.student_id', ondelete='SET NULL'), nullable=True),
        sa.Column('admitted_at', sa.DateTime(), nullable=True),
        sa.Column('admitted_by', sa.Integer(), sa.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('updated_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.UniqueConstraint('enquiry_id', name='uq_admission_application_enquiry'),
        sa.UniqueConstraint('token_hash', name='uq_admission_application_token'),
    )
    op.create_index('idx_application_branch_status', 'admission_applications', ['branch_id', 'status'])


def downgrade():
    op.drop_index('idx_application_branch_status', table_name='admission_applications')
    op.drop_table('admission_applications')
