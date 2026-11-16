"""Enquiry edit + cancel

- enquiries.status gains 'CANCELLED' (entered by mistake / duplicate; kept, never deleted)
- enquiries.needs_reprint: details changed after the paper was printed
- enquiry_changes: who edited / cancelled / restored an enquiry, and what changed

Revision ID: a1c3e5f7b9d2
Revises: f4b6d8e0a2c3
Create Date: 2026-11-16
"""
from alembic import op
import sqlalchemy as sa


revision = 'a1c3e5f7b9d2'
down_revision = 'f4b6d8e0a2c3'
branch_labels = None
depends_on = None

OLD_STATUS = sa.Enum('NEW', 'FOLLOW_UP', 'JOINED', 'CLOSED', name='enquiry_status')
NEW_STATUS = sa.Enum('NEW', 'FOLLOW_UP', 'JOINED', 'CLOSED', 'CANCELLED', name='enquiry_status')


def upgrade():
    with op.batch_alter_table('enquiries') as batch:
        batch.alter_column('status', existing_type=OLD_STATUS, type_=NEW_STATUS, existing_nullable=False)
        batch.add_column(sa.Column('needs_reprint', sa.Boolean(), nullable=False, server_default=sa.false()))

    op.create_table(
        'enquiry_changes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('school_id', sa.Integer(), sa.ForeignKey('schools.id', ondelete='SET NULL'), nullable=True),
        sa.Column('branch_id', sa.Integer(), sa.ForeignKey('branches.id', ondelete='CASCADE'), nullable=False),
        sa.Column('enquiry_id', sa.Integer(), sa.ForeignKey('enquiries.id', ondelete='CASCADE'), nullable=False),
        sa.Column('changed_at', sa.DateTime(), nullable=False),
        sa.Column('changed_by', sa.Integer(), sa.ForeignKey('users.user_id', ondelete='SET NULL'), nullable=True),
        sa.Column('kind', sa.Enum('EDITED', 'CANCELLED', 'RESTORED', name='enquiry_change_kind'), nullable=False),
        sa.Column('changes', sa.JSON(), nullable=True),
        sa.Column('reason', sa.String(length=150), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.Column('updated_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_enquiry_change_enquiry', 'enquiry_changes', ['enquiry_id', 'changed_at'])


def downgrade():
    op.drop_index('idx_enquiry_change_enquiry', table_name='enquiry_changes')
    op.drop_table('enquiry_changes')
    # Cancelled enquiries cannot be stored any more: keep them as closed
    op.execute("UPDATE enquiries SET status = 'CLOSED' WHERE status = 'CANCELLED'")
    with op.batch_alter_table('enquiries') as batch:
        batch.drop_column('needs_reprint')
        batch.alter_column('status', existing_type=NEW_STATUS, type_=OLD_STATUS, existing_nullable=False)
