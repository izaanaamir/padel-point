from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    password_hash: str
    role: str = "employee"  # 'employee' or 'admin'
    full_name: Optional[str] = None
    bookings: List["Booking"] = Relationship(back_populates="employee")


class Court(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    description: Optional[str] = None
    bookings: List["Booking"] = Relationship(back_populates="court")


class Booking(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    court_id: int = Field(foreign_key="court.id")
    customer_name: str
    start_time: datetime
    end_time: datetime
    price: float
    paid: bool = False
    employee_id: Optional[int] = Field(default=None, foreign_key="user.id")
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    receipt_path: Optional[str] = None
    status: str = Field(default="active")

    court: Optional[Court] = Relationship(back_populates="bookings")
    employee: Optional[User] = Relationship(back_populates="bookings")
