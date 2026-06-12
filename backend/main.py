import time
from datetime import date, datetime

import pymysql
from fastapi import FastAPI
from pydantic import BaseModel

from db import MYSQL_DATABASE, MYSQL_HOST, MYSQL_PORT, MYSQL_USER, get_connection

app = FastAPI()
TASKS_TABLE = "todo_data"
MEMBERSHIPS_TABLE = "todo_vip"
LEGACY_MEMBERSHIPS_TABLE = "membership_data"


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute("SHOW TABLES LIKE %s", (table_name,))
    return cursor.fetchone() is not None


def table_row_count(cursor, table_name: str) -> int:
    cursor.execute(f"SELECT COUNT(*) AS count FROM {table_name}")
    row = cursor.fetchone() or {}
    return int(row.get("count", 0))


def normalize_datetime_text(value: str | None) -> str | None:
    if not value:
        return None
    if len(value) >= 19:
        return value[:19].replace("T", " ")
    if len(value) >= 16:
        return f"{value[:16].replace('T', ' ')}:00"
    if len(value) == 10:
        return f"{value} 00:00:00"
    return value


def normalize_date_text(value: str | None) -> str | None:
    if not value:
        return None
    return value[:10]


def init_db() -> None:
    with get_connection() as conn:
        with conn.cursor() as cursor:
            ensure_tasks_table(cursor)
            ensure_memberships_table(cursor)
            if (
                MEMBERSHIPS_TABLE != LEGACY_MEMBERSHIPS_TABLE
                and table_exists(cursor, LEGACY_MEMBERSHIPS_TABLE)
                and table_row_count(cursor, MEMBERSHIPS_TABLE) == 0
                and table_row_count(cursor, LEGACY_MEMBERSHIPS_TABLE) > 0
            ):
                cursor.execute(
                    f"""
                    INSERT INTO {MEMBERSHIPS_TABLE} (
                        id,
                        name,
                        start_date,
                        end_date,
                        price,
                        note
                    )
                    SELECT
                        id,
                        name,
                        start_date,
                        end_date,
                        price,
                        note
                    FROM {LEGACY_MEMBERSHIPS_TABLE}
                    """
                )
        conn.commit()


def ensure_tasks_table(cursor) -> None:
    cursor.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {TASKS_TABLE} (
            id VARCHAR(64) PRIMARY KEY,
            title TEXT NOT NULL,
            status VARCHAR(32) NOT NULL,
            priority VARCHAR(32) NOT NULL,
            created_at DATETIME NOT NULL,
            completed_at DATETIME NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )


def ensure_memberships_table(cursor) -> None:
    cursor.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {MEMBERSHIPS_TABLE} (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            price VARCHAR(64) NULL,
            note TEXT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )


class Task(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    created_at: str
    completed_at: str | None = None


class Membership(BaseModel):
    id: str
    name: str
    start_date: str
    end_date: str
    price: str | None = None
    note: str | None = None


@app.on_event("startup")
def on_startup() -> None:
    last_error = None
    for _ in range(60):
        try:
            init_db()
            return
        except pymysql.MySQLError as error:
            last_error = error
            time.sleep(1)
    if last_error:
        raise last_error


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/db-health")
def db_health():
    result = {
        "ok": False,
        "host": MYSQL_HOST,
        "port": MYSQL_PORT,
        "user": MYSQL_USER,
        "database": MYSQL_DATABASE,
        "tables": {},
    }
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1 AS ok")
                cursor.fetchone()
                for table_name in (TASKS_TABLE, MEMBERSHIPS_TABLE, LEGACY_MEMBERSHIPS_TABLE):
                    exists = table_exists(cursor, table_name)
                    count = table_row_count(cursor, table_name) if exists else 0
                    result["tables"][table_name] = {"exists": exists, "count": count}
        result["ok"] = True
    except Exception as error:
        result["error"] = str(error)
    return result


@app.get("/api/tasks")
def get_tasks():
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT
                    id,
                    title,
                    status,
                    priority,
                    DATE_FORMAT(created_at, '%%Y-%%m-%%d %%H:%%i:%%s') AS created_at,
                    CASE
                        WHEN completed_at IS NULL THEN NULL
                        ELSE DATE_FORMAT(completed_at, '%%Y-%%m-%%d %%H:%%i:%%s')
                    END AS completed_at
                FROM {TASKS_TABLE}
                ORDER BY created_at, id
                """
            )
            return cursor.fetchall()


@app.post("/api/tasks")
def save_tasks(tasks: list[Task]):
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(f"DELETE FROM {TASKS_TABLE}")
            for task in tasks:
                cursor.execute(
                    f"""
                    INSERT INTO {TASKS_TABLE} (
                        id,
                        title,
                        status,
                        priority,
                        created_at,
                        completed_at
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        task.id,
                        task.title,
                        task.status,
                        task.priority,
                        normalize_datetime_text(task.created_at),
                        normalize_datetime_text(task.completed_at),
                    ),
                )
        conn.commit()
    return {"success": True}


def compute_membership_view(member: dict) -> dict:
    today = date.today()
    start_date = (
        member["start_date"]
        if isinstance(member["start_date"], date)
        else datetime.strptime(str(member["start_date"])[:10], "%Y-%m-%d").date()
    )
    end_date = (
        member["end_date"]
        if isinstance(member["end_date"], date)
        else datetime.strptime(str(member["end_date"])[:10], "%Y-%m-%d").date()
    )

    if today > end_date:
        status = "expired"
    elif (end_date - today).days <= 3:
        status = "expiring"
    else:
        status = "active"

    total_days = max((end_date - start_date).days, 1)
    elapsed_days = min(max((today - start_date).days, 0), total_days)
    progress_percent = round((elapsed_days / total_days) * 100)
    days_remaining = (end_date - today).days

    return {
        "id": member["id"],
        "name": member["name"],
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "price": member["price"] or "",
        "note": member["note"] or "",
        "status": status,
        "days_remaining": days_remaining,
        "progress_percent": progress_percent,
    }


@app.get("/api/memberships")
def get_memberships():
    with get_connection() as conn:
        with conn.cursor() as cursor:
            ensure_memberships_table(cursor)
            cursor.execute(
                f"""
                SELECT
                    id,
                    name,
                    start_date,
                    end_date,
                    price,
                    note
                FROM {MEMBERSHIPS_TABLE}
                ORDER BY end_date, id
                """
            )
            rows = cursor.fetchall()
        conn.commit()
    return [compute_membership_view(row) for row in rows]


@app.post("/api/memberships")
def save_memberships(memberships: list[Membership]):
    with get_connection() as conn:
        with conn.cursor() as cursor:
            ensure_memberships_table(cursor)
            cursor.execute(f"DELETE FROM {MEMBERSHIPS_TABLE}")
            for membership in memberships:
                cursor.execute(
                    f"""
                    INSERT INTO {MEMBERSHIPS_TABLE} (
                        id,
                        name,
                        start_date,
                        end_date,
                        price,
                        note
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        membership.id,
                        membership.name,
                        normalize_date_text(membership.start_date),
                        normalize_date_text(membership.end_date),
                        membership.price,
                        membership.note,
                    ),
                )
        conn.commit()
    return {"success": True}
