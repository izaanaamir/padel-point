from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.db import get_session
from app.models import Booking, User
from app.auth import get_current_user
from datetime import datetime, date, timedelta
from collections import defaultdict
from typing import Optional

router = APIRouter()


@router.get("/report")
def generate_report(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),  # This should be modified to return user info instead of raising 403
):
    try:
        s = datetime.fromisoformat(start_date).date()
        e = datetime.fromisoformat(end_date).date()
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format, use YYYY-MM-DD"
        )

    if s > e:
        raise HTTPException(
            status_code=400, detail="start_date cannot be after end_date"
        )

    start_dt = datetime(s.year, s.month, s.day)
    end_dt = datetime(e.year, e.month, e.day, 23, 59, 59)

    # 📊 Query bookings in range
    q = select(Booking).where(
        Booking.start_time >= start_dt, Booking.start_time <= end_dt
    )
    bookings = session.exec(q).all()

    if not user.role == "admin":
        return {
            "start_date": start_date,
            "end_date": end_date,
            "bookings_count": len(bookings),
            "total_revenue": 0,
            "paid_amount": 0,
            "unpaid_amount": 0,
            "per_day": {},
            "per_court": {},
            "bookings": [],
        }

    # Full admin response
    total = sum(b.price for b in bookings)
    paid = sum(b.price for b in bookings if b.paid)
    unpaid = total - paid

    per_day = defaultdict(lambda: {"count": 0, "revenue": 0.0})
    per_court = defaultdict(lambda: {"count": 0, "revenue": 0.0})

    for b in bookings:
        day_key = b.start_time.date().isoformat()
        per_day[day_key]["count"] += 1
        per_day[day_key]["revenue"] += b.price

        per_court[b.court_id]["count"] += 1
        per_court[b.court_id]["revenue"] += b.price

    return {
        "start_date": s.isoformat(),
        "end_date": e.isoformat(),
        "bookings_count": len(bookings),
        "total_revenue": total,
        "paid_amount": paid,
        "unpaid_amount": unpaid,
        "per_day": dict(per_day),
        "per_court": dict(per_court),
        "bookings": [
            {
                "id": b.id,
                "court_id": b.court_id,
                "start_time": b.start_time.isoformat(),
                "end_time": b.end_time.isoformat(),
                "price": b.price,
                "paid": b.paid,
            }
            for b in bookings
        ],
    }
