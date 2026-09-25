from pydantic import BaseModel
from datetime import date, datetime

class ExpenseSchema(BaseModel):
    amount: float
    type: str
    name: str
    description: str = ""
    date: datetime | None = None


class SanctionedAmountSchema(BaseModel):
    amount: float
    sanction_date: date | None = None