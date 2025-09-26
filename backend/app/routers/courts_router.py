from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.db import get_session
from app.models import Court
from app.auth import require_admin

router = APIRouter()


@router.get("/")
def list_courts(session: Session = Depends(get_session)):
    return session.exec(select(Court)).all()


@router.post("/")
def create_court(
    court: Court, session: Session = Depends(get_session), _admin=Depends(require_admin)
):
    session.add(court)
    session.commit()
    session.refresh(court)
    return court


@router.patch("/{court_id}")
def update_court(
    court_id: int,
    court: Court,
    session: Session = Depends(get_session),
    _admin=Depends(require_admin),
):
    existing = session.get(Court, court_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Court not found")
    for k, v in court.dict(exclude_unset=True).items():
        setattr(existing, k, v)
    session.add(existing)
    session.commit()
    session.refresh(existing)
    return existing


@router.delete("/{court_id}")
def delete_court(
    court_id: int,
    session: Session = Depends(get_session),
    _admin=Depends(require_admin),
):
    existing = session.get(Court, court_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Court not found")
    session.delete(existing)
    session.commit()
    return {"ok": True}
