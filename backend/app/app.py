from contextlib import asynccontextmanager
import csv
import io
import re
from datetime import date, datetime
from typing import Any

from uuid import UUID

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import create_db_and_tables, get_async_session
from app.models import Expense
from app.schemas import ExpenseSchema

try:
    import pandas as pd
except ImportError:  # pandas is expected but handled gracefully if missing
    pd = None

HEADER_ALIASES = {
    "amount": {"amount", "amt"},
    "description": {"description", "desc"},
    "type": {"type", "category"},
    "name": {"name", "payee", "vendor"},
    "date": {"date", "transaction date", "transaction_date"},
}

REQUIRED_FIELDS = {"amount", "type", "name"}


def normalize_header_name(header: Any) -> str | None:
    if header is None:
        return None
    # remove potential BOM and normalize
    key = str(header).strip().lstrip("\ufeff").lower()
    for normalized, aliases in HEADER_ALIASES.items():
        if key in aliases:
            return normalized
    return None


def normalize_row(raw_row: dict[str, Any]) -> dict[str, Any]:
    normalized = {}
    for key, value in raw_row.items():
        field_name = normalize_header_name(key)
        if field_name:
            normalized[field_name] = value
    return normalized


def normalize_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed if trimmed else None
    if pd is not None and pd.isna(value):
        return None
    return value


def normalize_date_string(value: str) -> str:
    return re.sub(r"\b(\d+)(st|nd|rd|th)\b", r"\1", value, flags=re.IGNORECASE)


def parse_amount(value: Any) -> float:
    normalized_value = normalize_value(value)
    if normalized_value is None:
        raise ValueError("amount is required")
    try:
        return float(normalized_value)
    except (TypeError, ValueError):
        raise ValueError("amount must be numeric")


def parse_date(value: Any) -> datetime | None:
    normalized_value = normalize_value(value)
    if normalized_value is None:
        return None
    if isinstance(normalized_value, datetime):
        return normalized_value
    if isinstance(normalized_value, date):
        return datetime.combine(normalized_value, datetime.min.time())
    if hasattr(normalized_value, "to_pydatetime"):
        try:
            return normalized_value.to_pydatetime()
        except Exception:
            pass
    if hasattr(normalized_value, "timestamp") and not isinstance(normalized_value, str):
        try:
            return datetime.fromtimestamp(float(normalized_value))
        except Exception:
            pass
    if isinstance(normalized_value, str):
        stripped = normalize_date_string(normalized_value.strip())
        formats = (
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%d-%m-%Y",
            "%m-%d-%Y",
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%d %B %Y",
            "%d %b %Y",
            "%d %B, %Y",
            "%d %b, %Y",
            "%B %d %Y",
            "%b %d %Y",
        )
        for fmt in formats:
            try:
                return datetime.strptime(stripped, fmt)
            except ValueError:
                continue
        if pd is not None:
            try:
                parsed = pd.to_datetime(stripped, errors="raise")
                return parsed.to_pydatetime() if hasattr(parsed, "to_pydatetime") else datetime(parsed.year, parsed.month, parsed.day)
            except Exception:
                pass
        try:
            return datetime.fromisoformat(stripped)
        except ValueError:
            pass
    raise ValueError("date format must be YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY, DD/MM/YYYY, DD-MM-YYYY, ISO, or other recognized date string")


def parse_expense_row(raw_row: dict[str, Any], row_index: int) -> Expense:
    row = normalize_row(raw_row)

    if not row:
        raise ValueError(f"row {row_index}: no recognized columns")

    amount = parse_amount(row.get("amount"))
    description = normalize_value(row.get("description")) or ""
    expense_type = normalize_value(row.get("type"))
    name = normalize_value(row.get("name"))
    date = parse_date(row.get("date"))

    missing = [field for field in REQUIRED_FIELDS if normalize_value(row.get(field)) is None]
    if missing:
        raise ValueError(f"row {row_index}: missing required fields: {', '.join(missing)}")

    expense = Expense(amount=amount, description=description, type=expense_type, name=name)
    if date is not None:
        expense.date = date
    return expense


def parse_excel_rows(data: bytes) -> list[dict[str, Any]]:
    if pd is None:
        raise RuntimeError("pandas is required for Excel file upload")

    df = pd.read_excel(io.BytesIO(data))
    df = df.rename(columns=lambda name: normalize_header_name(name) or str(name))
    rows: list[dict[str, Any]] = []
    for _, series in df.iterrows():
        rows.append({field: series.get(field) for field in HEADER_ALIASES})
    return rows


def parse_csv_rows(data: bytes) -> list[dict[str, Any]]:
    # use utf-8-sig to remove BOM if present in CSV files exported by Excel
    text = data.decode("utf-8-sig")
    reader = csv.DictReader(text.splitlines())
    return [normalize_row(row) for row in reader]

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_and_tables()
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "https://constructionexpensetracker.vercel.app",],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/expenses")
async def create_expense(
    expense: ExpenseSchema,
    session: AsyncSession = Depends(get_async_session),
):
    new_expense = Expense(
        amount=expense.amount,
        description=expense.description,
        type=expense.type,
        name=expense.name,
    )
    if expense.date is not None:
        new_expense.date = expense.date
    session.add(new_expense)
    await session.commit()
    await session.refresh(new_expense)
    return new_expense


@app.get("/expenses")
async def get_expenses(session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Expense))
    expenses = [row[0] for row in result.all()]

    return [
        {
            "id": str(expense.id),
            "amount": expense.amount,
            "description": expense.description,
            "type": expense.type,
            "name": expense.name,
            "date": expense.date.isoformat() if expense.date is not None else None,
        }
        for i, expense in reversed(list(enumerate(expenses)))
    ]


@app.post("/upload")
async def upload_file(file: UploadFile = File(...), session: AsyncSession = Depends(get_async_session)):
    content = await file.read()
    await file.close()

    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    filename = (file.filename or "").lower()
    if filename.endswith((".xls", ".xlsx")):
        rows = parse_excel_rows(content)
    else:
        rows = parse_csv_rows(content)

    if not rows:
        raise HTTPException(status_code=400, detail="Uploaded file contains no data rows")

    expenses: list[Expense] = []
    errors: list[str] = []
    for index, row in enumerate(rows, start=1):
        try:
            expenses.append(parse_expense_row(row, index))
        except ValueError as exc:
            errors.append(str(exc))

    if errors:
        raise HTTPException(status_code=422, detail=errors)

    await session.execute(delete(Expense))
    session.add_all(expenses)
    await session.commit()
    return {"inserted": len(expenses)}

@app.delete("/expenses/{id}")
async def delete_expense(id: UUID, session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Expense).where(Expense.id == id))
    expense = result.scalars().first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    await session.execute(delete(Expense).where(Expense.id == id))
    await session.commit()
    return {"deleted": str(id)}

@app.put("/expenses/{id}")
async def update_expense(id: UUID, expense: ExpenseSchema, session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Expense).where(Expense.id == id))
    existing = result.scalars().first()
    if not existing:
        raise HTTPException(status_code=404, detail="Expense not found")

    existing.amount = expense.amount
    existing.description = expense.description
    existing.type = expense.type
    existing.name = expense.name
    existing.date = expense.date

    session.add(existing)
    await session.commit()
    await session.refresh(existing)
    return existing