import os
from datetime import datetime
from urllib.parse import urlparse

import pymysql
from fastapi import FastAPI
from pydantic import BaseModel


app = FastAPI()
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://root:hassan0121@mysql:3306/todo",
)
TABLE_NAME = "todo_data"


def normalize_datetime_text(value: str | None) -> str | None:
    if isinstance(value, str) and len(value) >= 19:
        return value[:19].replace("T", " ")
    if isinstance(value, str) and len(value) >= 16:
        return f"{value[:16].replace('T', ' ')}:00"
    if isinstance(value, str) and len(value) == 10:
        return f"{value} 00:00:00"
    return value


def parse_database_url() -> dict[str, str | int]:
    parsed = urlparse(DATABASE_URL)
    if parsed.scheme != "mysql+pymysql":
        raise ValueError(f"Unsupported DATABASE_URL scheme: {parsed.scheme}")
    return {
        "host": parsed.hostname or "mysql",
        "port": parsed.port or 3306,
        "user": parsed.username or "root",
        "password": parsed.password or "",
        "database": (parsed.path or "/todo").lstrip("/") or "todo",
        "charset": "utf8mb4",
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": False,
    }


def get_connection():
    return pymysql.connect(**parse_database_url())


def init_db() -> None:
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
                    id VARCHAR(64) PRIMARY KEY,
                    title TEXT NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    priority VARCHAR(32) NOT NULL,
                    created_at DATETIME NOT NULL,
                    completed_at DATETIME NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
            )
        conn.commit()


class Task(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    created_at: str
    completed_at: str | None = None


@app.on_event("startup")
def on_startup() -> None:
    init_db()


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
                FROM {TABLE_NAME}
                ORDER BY created_at, id
                """
            )
            return cursor.fetchall()


@app.post("/api/tasks")
def save_tasks(tasks: list[Task]):
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(f"DELETE FROM {TABLE_NAME}")
            for task in tasks:
                cursor.execute(
                    f"""
                    INSERT INTO {TABLE_NAME} (
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
