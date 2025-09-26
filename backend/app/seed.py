from app.db import engine, init_db, get_session
from sqlmodel import Session, select
from app.models import User, Court
from app.auth import get_password_hash


def run():
    init_db()
    with Session(engine) as session:
        existing = session.exec(
            select(User).where(User.username == "employee1")
        ).first()
        if not existing:
            u = User(
                username="employee1",
                password_hash=get_password_hash("employeepass"),
                role="employee",
                full_name="Employee One",
            )
            session.add(u)
        existing = session.exec(select(User).where(User.username == "admin1")).first()
        if not existing:
            a = User(
                username="admin1",
                password_hash=get_password_hash("adminpass"),
                role="admin",
                full_name="Admin One",
            )
            session.add(a)
        if not session.exec(select(Court).where(Court.name == "Court 1")).first():
            session.add(Court(name="Court 1"))
        if not session.exec(select(Court).where(Court.name == "Court 2")).first():
            session.add(Court(name="Court 2"))
        session.commit()
    print("Seed complete: users (employee1/admin1) and 2 courts created.")


if __name__ == "__main__":
    run()
