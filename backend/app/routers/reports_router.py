from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from app.db import get_session
from app.models import Booking, User
from app.auth import get_current_user
from datetime import datetime, date, timedelta
from collections import defaultdict
from typing import Optional
import pytz

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
        bookings = [b for b in bookings if b.status == "active"]
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
                "status": b.status,
            }
            for b in bookings
        ],
    }

@router.get("/stats")
def get_dashboard_stats(
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
):
    # Get Pakistan timezone
    pakistan_tz = pytz.timezone("Asia/Karachi")
    now_utc = datetime.utcnow().replace(tzinfo=pytz.UTC)
    now_pakistan = now_utc.astimezone(pakistan_tz)

    # Today's date range in Pakistan time
    today_start = now_pakistan.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = now_pakistan.replace(hour=23, minute=59, second=59, microsecond=999999)

    # Week range (last 7 days including today)
    week_start = today_start - timedelta(days=6)

    # Convert to UTC for database queries
    today_start_utc = today_start.astimezone(pytz.UTC).replace(tzinfo=None)
    today_end_utc = today_end.astimezone(pytz.UTC).replace(tzinfo=None)
    week_start_utc = week_start.astimezone(pytz.UTC).replace(tzinfo=None)

    # Get today's active bookings
    daily_bookings = session.exec(
        select(Booking).where(
            Booking.start_time >= today_start_utc,
            Booking.start_time <= today_end_utc,
            Booking.status == "active",
        )
    ).all()

    # Get week's active bookings
    weekly_bookings = session.exec(
        select(Booking).where(
            Booking.start_time >= week_start_utc,
            Booking.start_time <= today_end_utc,
            Booking.status == "active",
        )
    ).all()

    # Calculate stats
    daily_count = len(daily_bookings)
    weekly_count = len(weekly_bookings)

    if user.role == "admin":
        daily_revenue = sum(b.price for b in daily_bookings if b.paid)
        weekly_revenue = sum(b.price for b in weekly_bookings if b.paid)
    else:
        daily_revenue = 0
        weekly_revenue = 0

    return {
        "daily_bookings": daily_count,
        "daily_revenue": daily_revenue,
        "weekly_bookings": weekly_count,
        "weekly_revenue": weekly_revenue,
    }

