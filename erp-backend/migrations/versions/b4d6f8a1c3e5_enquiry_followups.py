"""Enquiry follow-up calls, dropdown lists and call summary on enquiries

Revision ID: b4d6f8a1c3e5
Revises: a9c3e5f7b2d4
Create Date: 2026-11-16
"""
from alembic import op
import sqlalchemy as sa


revision = 'b4d6f8a1c3e5'
down_revision = 'a9c3e5f7b2d4'
branch_labels = None
depends_on = None

OUTCOMES = ('CALL_LATER', 'NO_ANSWER', 'WILL_VISIT', 'JOINED', 'NOT_INTERESTED', 'WRONG_NUMBER')
SLOTS = ('MORNING', 'AFTERNOON', 'EVENING')


def _audit_columns():
    return [
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('updated_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
    ]


def upgrade():
    with op.batch_alter_table('enquiries') as batch:
        batch.add_column(sa.Column('next_call_slot', sa.Enum(*SLOTS, name='enquiry_call_slot'), nullable=True))
        batch.add_column(sa.Column('last_call_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('last_called_by', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('last_outcome', sa.String(length=20), nullable=True))
        batch.add_column(sa.Column('call_count', sa.Integer(), nullable=False, server_default='0'))
        batch.add_column(sa.Column('close_reason', sa.String(length=150), nullable=True))
        batch.add_column(sa.Column('closed_at', sa.DateTime(), nullable=True))
        batch.create_foreign_key('fk_enquiries_last_called_by_users', 'users', ['last_called_by'], ['user_id'],
                                 ondelete='SET NULL')
        batch.create_index('idx_enquiry_branch_status_next', ['branch_id', 'status', 'next_follow_up_date'])

    # Enquiries taken before follow-ups existed: due for a first call straight away
    op.execute("UPDATE enquiries SET next_follow_up_date = enquiry_date "
               "WHERE status = 'NEW' AND next_follow_up_date IS NULL")

    op.create_table(
        'enquiry_followups',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('school_id', sa.Integer(), sa.ForeignKey('schools.id', ondelete='SET NULL'), nullable=True),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id', ondelete='CASCADE'), nullable=False),
        sa.Column('enquiry_id', sa.Integer(), sa.ForeignKey('enquiries.id', ondelete='CASCADE'), nullable=False),
        sa.Column('called_at', sa.DateTime(), nullable=False),
        sa.Column('called_by', sa.Integer(), sa.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True),
        sa.Column('outcome', sa.Enum(*OUTCOMES, name='enquiry_followup_outcome'), nullable=False),
        sa.Column('reason', sa.String(length=150), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('next_call_date', sa.Date(), nullable=True),
        sa.Column('next_call_slot', sa.Enum(*SLOTS, name='enquiry_followup_slot'), nullable=True),
        *_audit_columns(),
    )
    op.create_index('idx_followup_enquiry', 'enquiry_followups', ['enquiry_id', 'called_at'])
    op.create_index('idx_followup_branch_called', 'enquiry_followups', ['branch_id', 'called_at'])

    op.create_table(
        'enquiry_options',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('school_id', sa.Integer(), sa.ForeignKey('schools.id', ondelete='CASCADE'), nullable=True),
        sa.Column('kind', sa.Enum('REJECT_REASON', 'BENEFIT', name='enquiry_option_kind'), nullable=False),
        sa.Column('label', sa.String(length=150), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        *_audit_columns(),
        sa.UniqueConstraint('school_id', 'kind', 'label', name='uq_enquiry_option_label'),
    )


def downgrade():
    op.drop_table('enquiry_options')
    op.drop_index('idx_followup_branch_called', table_name='enquiry_followups')
    op.drop_index('idx_followup_enquiry', table_name='enquiry_followups')
    op.drop_table('enquiry_followups')
    with op.batch_alter_table('enquiries') as batch:
        batch.drop_index('idx_enquiry_branch_status_next')
        batch.drop_constraint('fk_enquiries_last_called_by_users', type_='foreignkey')
        batch.drop_column('closed_at')
        batch.drop_column('close_reason')
        batch.drop_column('call_count')
        batch.drop_column('last_outcome')
        batch.drop_column('last_called_by')
        batch.drop_column('last_call_at')
        batch.drop_column('next_call_slot')
