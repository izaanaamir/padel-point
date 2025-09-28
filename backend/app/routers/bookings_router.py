from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.db import get_session
from app.models import Booking, Court, User
from app.schemas import BookingCreate, BookingUpdate
from app.auth import get_current_user
from app.crud import booking_overlaps
from typing import List, Optional
from datetime import datetime

router = APIRouter()


@router.get("/")
def list_bookings(date: Optional[str] = None, session: Session = Depends(get_session)):
    q = select(Booking).order_by(Booking.start_time)
    if date:
        try:
            d = datetime.fromisoformat(date).date()
        except Exception:
            raise HTTPException(
                status_code=400, detail="Invalid date format, use YYYY-MM-DD"
            )
        start = datetime(d.year, d.month, d.day)
        end = start.replace(hour=23, minute=59, second=59, microsecond=999999)
        q = (
            select(Booking)
            .where(Booking.start_time >= start, Booking.start_time <= end)
            .order_by(Booking.start_time)
        )
    results = session.exec(q).all()
    return results


@router.get("/{booking_id}")
def get_booking(booking_id: int, session: Session = Depends(get_session)):
    b = session.get(Booking, booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    return b


@router.post("/")
def create_booking(
    payload: BookingCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    # validate court exists
    court = session.get(Court, payload.court_id)
    if not court:
        raise HTTPException(status_code=400, detail="Court not found")
    # validate times
    if payload.start_time >= payload.end_time:
        raise HTTPException(
            status_code=400, detail="start_time must be before end_time"
        )
    # overlap check
    if booking_overlaps(
        session, payload.court_id, payload.start_time, payload.end_time
    ):
        raise HTTPException(
            status_code=409,
            detail="Time slot overlaps with an existing booking for this court",
        )
    b = Booking(
        court_id=payload.court_id,
        customer_name=payload.customer_name,
        start_time=payload.start_time,
        end_time=payload.end_time,
        price=payload.price,
        paid=payload.paid or False,
        notes=payload.notes,
        employee_id=current_user.id,
    )
    session.add(b)
    session.commit()
    session.refresh(b)
    return b


@router.patch("/{booking_id}")
def update_booking(
    booking_id: int,
    payload: BookingUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    b = session.get(Booking, booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    # Only allow edit of price/paid/notes for now (could expand)
    if payload.price is not None:
        b.price = payload.price
    if payload.paid is not None:
        b.paid = payload.paid
    if payload.notes is not None:
        b.notes = payload.notes
    session.add(b)
    session.commit()
    session.refresh(b)
    return b


@router.delete("/{booking_id}")
def delete_booking(
    booking_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    b = session.get(Booking, booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    b.status = "deleted"
    session.add(b)
    session.commit()
    return {"ok": True}
