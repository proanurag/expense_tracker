from pydantic import BaseModel

class ExpenseSchema(BaseModel):
    description: str = ""
    amount: float
    type: str
    name: str