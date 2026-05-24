from app.db import Base
from sqlalchemy import Column, String, Float, UUID, DateTime, Text, text
import uuid
from datetime import datetime

class Expense(Base):
    __tablename__ = "expenses"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    amount=Column(Float, nullable=False)
    name=Column(String, nullable=False)
    # Use a quoted empty string so SQLite CREATE TABLE contains DEFAULT ''
    description=Column(Text, nullable=False, server_default=text("''"))
    type=Column(String, nullable=False)
    date=Column(DateTime, default=datetime.utcnow)