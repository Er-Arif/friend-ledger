"""add_user_upi_id

Revision ID: cd6ff882a510
Revises: a0d76c6e47f9
Create Date: 2026-09-22 15:52:56.137578

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'cd6ff882a510'
down_revision: str | Sequence[str] | None = 'a0d76c6e47f9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('upi_id', sa.String(length=128), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'upi_id')

