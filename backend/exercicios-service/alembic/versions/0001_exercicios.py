"""cria exercicios, prescricoes e registros de realizacao

Revision ID: 0001
Revises:
Create Date: 2026-11-21
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "exercicios",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("nome", sa.String(length=100), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=False),
        sa.Column("link_video", sa.String(length=255), nullable=True),
        sa.Column("criado_por", sa.Uuid(), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "prescricoes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("paciente_id", sa.Uuid(), nullable=False),
        sa.Column("profissional_id", sa.Uuid(), nullable=False),
        sa.Column("exercicio_id", sa.Uuid(), nullable=False),
        sa.Column("frequencia", sa.String(length=100), nullable=False),
        sa.Column("ativa", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["exercicio_id"], ["exercicios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_prescricoes_paciente_id", "prescricoes", ["paciente_id"])
    op.create_index("ix_prescricoes_profissional_id", "prescricoes", ["profissional_id"])

    op.create_table(
        "registros_realizacao",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("prescricao_id", sa.Uuid(), nullable=False),
        sa.Column("nivel_dor", sa.Integer(), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("realizado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "nivel_dor IS NULL OR (nivel_dor >= 0 AND nivel_dor <= 10)",
            name="ck_registro_nivel_dor",
        ),
        sa.ForeignKeyConstraint(["prescricao_id"], ["prescricoes.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_registros_realizacao_prescricao_id", "registros_realizacao", ["prescricao_id"])


def downgrade() -> None:
    op.drop_index("ix_registros_realizacao_prescricao_id", table_name="registros_realizacao")
    op.drop_table("registros_realizacao")
    op.drop_index("ix_prescricoes_profissional_id", table_name="prescricoes")
    op.drop_index("ix_prescricoes_paciente_id", table_name="prescricoes")
    op.drop_table("prescricoes")
    op.drop_table("exercicios")
