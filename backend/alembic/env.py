from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.core.models import Base

config = context.config
config.set_main_option("sqlalchemy.url", settings.direct_database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The models: `alembic check` (and `revision --autogenerate`) compare them with the database, so a model change
# without its migration is caught here, not in production (fresh databases use create_all and never notice).
target_metadata = Base.metadata

# Expression indexes written by hand in their migration (public.unaccent…): Alembic cannot compare an expression.
HAND_WRITTEN_INDEXES = {"ix_medicaments_normalized_name"}


def include_object(obj, name, type_, reflected, compare_to) -> bool:
    return not (type_ == "index" and name in HAND_WRITTEN_INDEXES)


def run_migrations_offline() -> None:
    context.configure(
        url=settings.direct_database_url,
        target_metadata=target_metadata,
        include_object=include_object,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, include_object=include_object)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
