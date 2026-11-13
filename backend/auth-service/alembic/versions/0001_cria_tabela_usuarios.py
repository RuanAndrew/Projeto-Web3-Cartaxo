from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

perfil = sa.Enum(
    "PACIENTE", "PROFISSIONAL", "ATENDENTE", "ADMIN",
    native_enum=False, create_constraint=True, length=12, name="perfil_usuario",
)
status = sa.Enum("ATIVO", "INATIVO", native_enum=False, create_constraint=True, length=7, name="status_usuario")


def upgrade() -> None:
    op.create_table(
        "usuarios",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("nome", sa.String(length=150), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("cpf", sa.String(length=11), nullable=True),
        sa.Column("senha_hash", sa.String(length=255), nullable=False),
        sa.Column("perfil", perfil, nullable=False),
        sa.Column("status", status, server_default="ATIVO", nullable=False),
        sa.Column("permissao_especial", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("inativado_em", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_usuarios_email", "usuarios", ["email"], unique=True)
    op.create_index("ix_usuarios_cpf", "usuarios", ["cpf"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_usuarios_cpf", table_name="usuarios")
    op.drop_index("ix_usuarios_email", table_name="usuarios")
    op.drop_table("usuarios")
