"""cria tabela documentos

Revision ID: 0001
Revises:
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# Os nomes dos tipos precisam coincidir com os que o SQLAlchemy gera a partir
# das classes TipoDocumento e StatusDocumento em src/domain/models.py.
tipo_documento = sa.Enum("receita", "exame", "laudo", "anexo", name="tipodocumento")
status_documento = sa.Enum("pendente_liberacao", "liberado", name="statusdocumento")


def upgrade() -> None:
    op.create_table(
        "documentos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("paciente_id", sa.Integer(), nullable=False),
        sa.Column("profissional_id", sa.Integer(), nullable=False),
        sa.Column("atendimento_id", sa.Integer(), nullable=True),
        sa.Column("tipo", tipo_documento, nullable=False),
        sa.Column("status", status_documento, nullable=False),
        sa.Column("titulo", sa.String(length=150), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("chave_s3", sa.String(length=500), nullable=False),
        sa.Column("nome_arquivo", sa.String(length=255), nullable=False),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("tamanho_bytes", sa.BigInteger(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.Column("liberado_em", sa.DateTime(), nullable=True),
        sa.Column("excluido_em", sa.DateTime(), nullable=True),
        sa.Column("excluido_por", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chave_s3"),
    )
    op.create_index("ix_documentos_id", "documentos", ["id"])
    op.create_index("ix_documentos_paciente_id", "documentos", ["paciente_id"])
    op.create_index("ix_documentos_profissional_id", "documentos", ["profissional_id"])
    op.create_index("ix_documentos_atendimento_id", "documentos", ["atendimento_id"])


def downgrade() -> None:
    op.drop_index("ix_documentos_atendimento_id", table_name="documentos")
    op.drop_index("ix_documentos_profissional_id", table_name="documentos")
    op.drop_index("ix_documentos_paciente_id", table_name="documentos")
    op.drop_index("ix_documentos_id", table_name="documentos")
    op.drop_table("documentos")
    status_documento.drop(op.get_bind(), checkfirst=True)
    tipo_documento.drop(op.get_bind(), checkfirst=True)
