"""Add admission enquiry tables (schemes, enquiries, enquiry number sequence)

Revision ID: e7a3c9d1f2b6
Revises: d5e1f7a2b8c4
Create Date: 2026-11-14
"""
from alembic import op
import sqlalchemy as sa


revision = 'e7a3c9d1f2b6'
down_revision = 'd5e1f7a2b8c4'
branch_labels = None
depends_on = None


def _audit_columns():
    return [
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('updated_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
    ]


def upgrade():
    op.create_table(
        'admission_schemes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('school_id', sa.Integer(), sa.ForeignKey('schools.id', ondelete='SET NULL'), nullable=True),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id', ondelete='CASCADE'), nullable=False),
        sa.Column('academic_year', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('valid_from', sa.Date(), nullable=True),
        sa.Column('valid_to', sa.Date(), nullable=True),
        sa.Column('tuition_fee_type', sa.String(length=100), nullable=False),
        sa.Column('discount_type', sa.Enum('NONE', 'PERCENT', 'AMOUNT', name='scheme_discount_type'),
                  nullable=False, server_default='NONE'),
        sa.Column('discount_value', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('benefits', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        *_audit_columns(),
        sa.UniqueConstraint('branch_id', 'academic_year', 'name', name='uq_scheme_branch_year_name'),
        sa.CheckConstraint('discount_value >= 0', name='chk_scheme_discount_positive'),
        sa.CheckConstraint("discount_type <> 'PERCENT' OR discount_value <= 100", name='chk_scheme_percent_max'),
        sa.CheckConstraint('valid_from IS NULL OR valid_to IS NULL OR valid_to >= valid_from', name='chk_scheme_dates'),
    )
    op.create_index('ix_admission_schemes_school_id', 'admission_schemes', ['school_id'])
    op.create_index('idx_scheme_branch_year', 'admission_schemes', ['branch_id', 'academic_year'])

    op.create_table(
        'enquiries',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('school_id', sa.Integer(), sa.ForeignKey('schools.id', ondelete='SET NULL'), nullable=True),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('academic_year', sa.String(length=20), nullable=False),
        sa.Column('enquiry_no', sa.String(length=30), nullable=False),
        sa.Column('enquiry_date', sa.Date(), nullable=False),
        sa.Column('student_name', sa.String(length=100), nullable=False),
        sa.Column('guardian_name', sa.String(length=100), nullable=False),
        sa.Column('class_name', sa.String(length=50), nullable=False),
        sa.Column('contact', sa.String(length=10), nullable=False),
        sa.Column('aadhaar_encrypted', sa.Text(), nullable=True),
        sa.Column('aadhaar_hash', sa.String(length=64), nullable=True),
        sa.Column('aadhaar_last4', sa.String(length=4), nullable=True),
        sa.Column('status', sa.Enum('NEW', 'FOLLOW_UP', 'JOINED', 'CLOSED', name='enquiry_status'),
                  nullable=False, server_default='NEW'),
        sa.Column('next_follow_up_date', sa.Date(), nullable=True),
        sa.Column('converted_student_id', sa.Integer(),
                  sa.ForeignKey('students.student_id', ondelete='SET NULL'), nullable=True),
        sa.Column('quote_snapshot', sa.JSON(), nullable=True),
        *_audit_columns(),
        sa.UniqueConstraint('branch_id', 'enquiry_no', name='uq_enquiry_branch_no'),
        sa.UniqueConstraint('branch_id', 'academic_year', 'aadhaar_hash', name='uq_enquiry_branch_year_aadhaar'),
    )
    op.create_index('ix_enquiries_school_id', 'enquiries', ['school_id'])
    op.create_index('idx_enquiry_branch_year_date', 'enquiries', ['branch_id', 'academic_year', 'enquiry_date'])
    op.create_index('idx_enquiry_contact', 'enquiries', ['contact'])
    op.create_index('idx_enquiry_aadhaar_hash', 'enquiries', ['aadhaar_hash'])

    op.create_table(
        'enquiry_sequences',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id', ondelete='CASCADE'), nullable=False),
        sa.Column('academic_year', sa.String(length=20), nullable=False),
        sa.Column('last_no', sa.Integer(), nullable=False, server_default='0'),
        *_audit_columns(),
        sa.UniqueConstraint('branch_id', 'academic_year', name='uq_enquiry_seq_branch_year'),
        sa.CheckConstraint('last_no >= 0', name='chk_enquiry_seq_positive'),
    )


def downgrade():
    op.drop_table('enquiry_sequences')
    op.drop_index('idx_enquiry_aadhaar_hash', table_name='enquiries')
    op.drop_index('idx_enquiry_contact', table_name='enquiries')
    op.drop_index('idx_enquiry_branch_year_date', table_name='enquiries')
    op.drop_index('ix_enquiries_school_id', table_name='enquiries')
    op.drop_table('enquiries')
    op.drop_index('idx_scheme_branch_year', table_name='admission_schemes')
    op.drop_index('ix_admission_schemes_school_id', table_name='admission_schemes')
    op.drop_table('admission_schemes')
