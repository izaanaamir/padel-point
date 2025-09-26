from typing import Optional
from sqlmodel import SQLModel
from datetime import datetime


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


class LoginData(SQLModel):
    username: str
    password: str


class BookingCreate(SQLModel):
    court_id: int
    customer_name: str
    start_time: datetime
    end_time: datetime
    price: float
    paid: Optional[bool] = False
    notes: Optional[str] = None


class BookingUpdate(SQLModel):
    price: Optional[float]
    paid: Optional[bool]
    notes: Optional[str]
