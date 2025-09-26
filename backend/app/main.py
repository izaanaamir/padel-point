from fastapi import FastAPI
from app.db import init_db
from app.routers import (
    auth_router,
    courts_router,
    bookings_router,
    reports_router,
)
from fastapi.middleware.cors import CORSMiddleware


init_db()
app = FastAPI(title="Padel Point Management System", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/auth", tags=["auth"])
app.include_router(courts_router.router, prefix="/courts", tags=["courts"])
app.include_router(bookings_router.router, prefix="/bookings", tags=["bookings"])
app.include_router(reports_router.router, prefix="/reports", tags=["reports"])
