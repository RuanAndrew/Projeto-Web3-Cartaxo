"""Cria tabela inicial de agendamentos com UUID

Revision ID: 0001_agendamentos_uuid
Revises: 
Create Date: 2026-11-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_agendamentos_uuid"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agendamentos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("paciente_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profissional_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("data_hora", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duracao_minutos", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="agendado"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_agendamentos_id", "agendamentos", ["id"])
    op.create_index("ix_agendamentos_paciente_id", "agendamentos", ["paciente_id"])
    op.create_index("ix_agendamentos_profissional_id", "agendamentos", ["profissional_id"])
    op.create_index("ix_agendamentos_data_hora", "agendamentos", ["data_hora"])


def downgrade() -> None:
    op.drop_index("ix_agendamentos_data_hora", table_name="agendamentos")
    op.drop_index("ix_agendamentos_profissional_id", table_name="agendamentos")
    op.drop_index("ix_agendamentos_paciente_id", table_name="agendamentos")
    op.drop_index("ix_agendamentos_id", table_name="agendamentos")
    op.drop_table("agendamentos")