import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from src.core.config import settings
from src.infrastructure.database import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def _url_escapada() -> str:
    return settings.database_url.replace("%", "%%")


def run_migrations_offline() -> None:
    context.configure(
        url=_url_escapada(),
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def _rodar_migrations(conexao) -> None:
    context.configure(
        connection=conexao,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:

    config.set_main_option("sqlalchemy.url", _url_escapada())
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async def rodar() -> None:
        async with connectable.connect() as conexao:
            await conexao.run_sync(_rodar_migrations)
        await connectable.dispose()

    asyncio.run(rodar())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
