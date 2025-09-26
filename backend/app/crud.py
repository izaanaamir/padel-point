from sqlmodel import Session, select
from app.models import Booking, Court, User
from datetime import datetime
from typing import List, Optional


def get_courts(session: Session) -> List[Court]:
    return session.exec(select(Court)).all()


def get_bookings_for_range(
    session: Session, start: datetime, end: datetime
) -> List[Booking]:
    q = select(Booking).where(Booking.start_time >= start, Booking.start_time < end)
    return session.exec(q).all()


def booking_overlaps(
    session: Session,
    court_id: int,
    start: datetime,
    end: datetime,
    exclude_booking_id: Optional[int] = None,
) -> bool:
    q = select(Booking).where(
        Booking.court_id == court_id, Booking.end_time > start, Booking.start_time < end
    )
    if exclude_booking_id:
        q = q.where(Booking.id != exclude_booking_id)
    return session.exec(q).first() is not None
