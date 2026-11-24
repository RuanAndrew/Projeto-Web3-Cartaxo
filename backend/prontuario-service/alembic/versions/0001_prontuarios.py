"""cria prontuarios e versoes (registro clinico imutavel)

Revision ID: 0001
Revises:
Create Date: 2026-11-14
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "prontuarios",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("paciente_id", sa.Uuid(), nullable=False),
        sa.Column("profissional_id", sa.Uuid(), nullable=False),
        sa.Column("atendimento_id", sa.Uuid(), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_prontuarios_paciente_id", "prontuarios", ["paciente_id"])
    op.create_index("ix_prontuarios_profissional_id", "prontuarios", ["profissional_id"])

    op.create_table(
        "prontuario_versoes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("prontuario_id", sa.Uuid(), nullable=False),
        sa.Column("numero", sa.Integer(), nullable=False),
        sa.Column("anamnese", sa.Text(), server_default="", nullable=False),
        sa.Column("evolucao", sa.Text(), server_default="", nullable=False),
        sa.Column("diagnostico", sa.Text(), server_default="", nullable=False),
        sa.Column("conduta", sa.Text(), server_default="", nullable=False),
        sa.Column("autor_id", sa.Uuid(), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["prontuario_id"], ["prontuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("prontuario_id", "numero", name="uq_versao_numero"),
    )
    op.create_index("ix_prontuario_versoes_prontuario_id", "prontuario_versoes", ["prontuario_id"])

    # Defesa em profundidade: mesmo fora da API, o banco recusa editar ou apagar
    # registro clinico (obrigacao legal de guarda). Correcoes entram como nova versao.
    op.execute(
        """
        CREATE FUNCTION bloquear_alteracao_clinica() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'Registros clinicos sao imutaveis - grave uma nova versao.';
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql
        """
    )
    op.execute(
        "CREATE TRIGGER trg_prontuarios_imutavel BEFORE UPDATE OR DELETE ON prontuarios "
        "FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_clinica()"
    )
    op.execute(
        "CREATE TRIGGER trg_versoes_imutavel BEFORE UPDATE OR DELETE ON prontuario_versoes "
        "FOR EACH ROW EXECUTE FUNCTION bloquear_alteracao_clinica()"
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_versoes_imutavel ON prontuario_versoes")
    op.execute("DROP TRIGGER IF EXISTS trg_prontuarios_imutavel ON prontuarios")
    op.execute("DROP FUNCTION IF EXISTS bloquear_alteracao_clinica()")
    op.drop_index("ix_prontuario_versoes_prontuario_id", table_name="prontuario_versoes")
    op.drop_table("prontuario_versoes")
    op.drop_index("ix_prontuarios_profissional_id", table_name="prontuarios")
    op.drop_index("ix_prontuarios_paciente_id", table_name="prontuarios")
    op.drop_table("prontuarios")
