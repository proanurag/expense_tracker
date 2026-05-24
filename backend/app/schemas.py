from pydantic import BaseModel
from datetime import datetime

class ExpenseSchema(BaseModel):
    amount: float
    type: str
    name: str
    description: str = ""
    date: datetime | None = None