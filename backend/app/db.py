from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import inspect, text
from collections.abc import AsyncGenerator
from dotenv import load_dotenv
import os

load_dotenv()

class Base(DeclarativeBase):
    pass


DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL and DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("sslmode=", "ssl=", 1)
print("DATABASE_URL =", DATABASE_URL)
engine = create_async_engine(DATABASE_URL)
database_session = async_sessionmaker(engine, expire_on_commit=False)

async def create_db_and_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        columns = await conn.run_sync(
            lambda sync_conn: {column["name"] for column in inspect(sync_conn).get_columns("sanctioned_amounts")}
        )
        if "sanction_date" not in columns:
            await conn.execute(text("ALTER TABLE sanctioned_amounts ADD COLUMN sanction_date DATE"))

async def get_async_session() -> AsyncGenerator[async_sessionmaker, None]:
    async with database_session() as session:
        yield session