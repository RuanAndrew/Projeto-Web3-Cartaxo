"""Migra os identificadores de usuários de Integer para UUID.

Revision ID: 0002
Revises: 0001
"""

from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()

    # Não permite descartar silenciosamente associações existentes.
    existem_documentos = connection.scalar(
        sa.text("SELECT EXISTS (SELECT 1 FROM documentos)")
    )

    if existem_documentos:
        raise RuntimeError(
            "A tabela documentos precisa estar vazia antes da "
            "migração dos identificadores para UUID."
        )

    # Remove os índices associados às colunas antigas.
    op.drop_index(
        "ix_documentos_paciente_id",
        table_name="documentos",
    )

    op.drop_index(
        "ix_documentos_profissional_id",
        table_name="documentos",
    )

    # Remove as colunas antigas.
    op.drop_column("documentos", "paciente_id")
    op.drop_column("documentos", "profissional_id")
    op.drop_column("documentos", "excluido_por")

    # Cria as novas colunas utilizando UUID.
    op.add_column(
        "documentos",
        sa.Column(
            "paciente_id",
            sa.Uuid(as_uuid=True),
            nullable=False,
        ),
    )

    op.add_column(
        "documentos",
        sa.Column(
            "profissional_id",
            sa.Uuid(as_uuid=True),
            nullable=False,
        ),
    )

    op.add_column(
        "documentos",
        sa.Column(
            "excluido_por",
            sa.Uuid(as_uuid=True),
            nullable=True,
        ),
    )

    # Recria os índices.
    op.create_index(
        "ix_documentos_paciente_id",
        "documentos",
        ["paciente_id"],
    )

    op.create_index(
        "ix_documentos_profissional_id",
        "documentos",
        ["profissional_id"],
    )


def downgrade() -> None:
    connection = op.get_bind()

    existem_documentos = connection.scalar(
        sa.text("SELECT EXISTS (SELECT 1 FROM documentos)")
    )

    if existem_documentos:
        raise RuntimeError(
            "Downgrade bloqueado: existem documentos associados "
            "a identificadores UUID. Faça uma migração de dados "
            "antes de retornar ao modelo Integer."
        )

    op.drop_index(
        "ix_documentos_paciente_id",
        table_name="documentos",
    )

    op.drop_index(
        "ix_documentos_profissional_id",
        table_name="documentos",
    )

    op.drop_column("documentos", "paciente_id")
    op.drop_column("documentos", "profissional_id")
    op.drop_column("documentos", "excluido_por")

    op.add_column(
        "documentos",
        sa.Column("paciente_id", sa.Integer(), nullable=False),
    )

    op.add_column(
        "documentos",
        sa.Column("profissional_id", sa.Integer(), nullable=False),
    )

    op.add_column(
        "documentos",
        sa.Column("excluido_por", sa.Integer(), nullable=True),
    )

    op.create_index(
        "ix_documentos_paciente_id",
        "documentos",
        ["paciente_id"],
    )

    op.create_index(
        "ix_documentos_profissional_id",
        "documentos",
        ["profissional_id"],
    )