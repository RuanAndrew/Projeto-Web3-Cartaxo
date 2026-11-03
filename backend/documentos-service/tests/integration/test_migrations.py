from alembic import command


def _tabela_existe(consulta) -> bool:
    return consulta(
        "SELECT count(*) AS n FROM information_schema.tables WHERE table_name = 'documentos'"
    )[0]["n"] == 1


def test_migration_reflete_o_modelo(engine_teste, config_alembic):
    # Falha (CommandError) se o modelo tiver mudado sem uma migration nova.
    command.check(config_alembic)


def test_downgrade_remove_tabela_e_enums_e_upgrade_recria(engine_teste, config_alembic, consulta):
    command.downgrade(config_alembic, "base")

    assert not _tabela_existe(consulta)
    enums = consulta(
        "SELECT typname FROM pg_type WHERE typname IN ('tipodocumento', 'statusdocumento')"
    )
    assert enums == []

    command.upgrade(config_alembic, "head")
    assert _tabela_existe(consulta)
