
from alembic import command
from sqlalchemy import text


def _tabela_existe(consulta) -> bool:
    return consulta(
        """
        SELECT count(*) AS n
        FROM information_schema.tables
        WHERE table_name = 'documentos'
        AND table_schema = 'public'
        """
    )[0]["n"] == 1


def test_migration_reflete_o_modelo(engine_teste, config_alembic):
    # Verifica se todos os modelos estão sincronizados
    # com as migrations existentes.
    command.check(config_alembic)


def test_downgrade_remove_tabela_e_enums_e_upgrade_recria(
    engine_teste,
    config_alembic,
    consulta,
):
    # O engine_teste aponta exclusivamente para documentos_test.
    # Limpamos os registros deixados pelos testes de integração
    # antes de executar o downgrade.
    with engine_teste.begin() as conn:
        conn.execute(
            text("TRUNCATE TABLE public.documentos RESTART IDENTITY")
        )

    command.downgrade(config_alembic, "base")

    assert not _tabela_existe(consulta)

    enums = consulta(
        """
        SELECT typname
        FROM pg_type
        WHERE typname IN (
            'tipodocumento',
            'statusdocumento'
        )
        """
    )

    assert enums == []

    command.upgrade(config_alembic, "head")

    assert _tabela_existe(consulta)

    # Confirma que as migrations recriaram as colunas UUID.
    colunas = consulta(
        """
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'documentos'
        AND column_name IN (
            'paciente_id',
            'profissional_id',
            'excluido_por'
        )
        """
    )

    tipos = {
        coluna["column_name"]: coluna["data_type"]
        for coluna in colunas
    }

    assert tipos == {
        "paciente_id": "uuid",
        "profissional_id": "uuid",
        "excluido_por": "uuid",
    }
