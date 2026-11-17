"""Adiciona modalidade e link_teleconsulta em agendamentos

Revision ID: 0002_teleconsulta
Revises: 0001_agendamentos_uuid
Create Date: 2026-11-17
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_teleconsulta"
down_revision = "0001_agendamentos_uuid"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "agendamentos",
        sa.Column(
            "modalidade",
            sa.String(length=20),
            nullable=False,
            server_default="presencial",
        ),
    )
    op.add_column(
        "agendamentos",
        sa.Column("link_teleconsulta", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("agendamentos", "link_teleconsulta")
    op.drop_column("agendamentos", "modalidade")