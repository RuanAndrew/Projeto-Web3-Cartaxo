"""Tabela inicial de pacientes"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_pacientes"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    sexo = sa.Enum("MASCULINO", "FEMININO", "OUTRO", "NAO_INFORMAR", name="sexo_paciente")
    sexo.create(op.get_bind(), checkfirst=True)
    op.create_table("pacientes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_account_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("nome_completo", sa.String(200), nullable=False),
        sa.Column("cpf", sa.String(11), nullable=False),
        sa.Column("data_nascimento", sa.Date(), nullable=False),
        sa.Column("sexo", sexo, nullable=False),
        sa.Column("telefone_principal", sa.String(30), nullable=False),
        sa.Column("telefone_secundario", sa.String(30)),
        sa.Column("email", sa.String(254)),
        sa.Column("endereco", postgresql.JSONB()),
        sa.Column("contato_emergencia", postgresql.JSONB()),
        sa.Column("observacoes_gerais", sa.Text()),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("cpf", name="uq_pacientes_cpf"))
    op.create_index("ix_pacientes_user_account_id", "pacientes", ["user_account_id"])
    op.create_index("ix_pacientes_nome_completo", "pacientes", ["nome_completo"])
    op.create_index("uq_pacientes_email_lower", "pacientes", [sa.text("lower(email)")], unique=True)

def downgrade():
    op.drop_table("pacientes")
    sa.Enum(name="sexo_paciente").drop(op.get_bind(), checkfirst=True)
