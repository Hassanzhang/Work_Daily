from fastapi import FastAPI
from pydantic import BaseModel
import os
import sqlite3


app = FastAPI()
DB_DIR = "/app/data"
DB_PATH = os.path.join(DB_DIR, "todo.db")

os.makedirs(DB_DIR, exist_ok=True)


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                status TEXT NOT NULL,
                priority TEXT NOT NULL,
                created_at TEXT NOT NULL,
                created_stamp INTEGER,
                completed_at TEXT,
                completed_stamp INTEGER
            )
            """
        )
        existing_columns = {
            row[1] for row in conn.execute("PRAGMA table_info(tasks)").fetchall()
        }
        column_migrations = {
            "created_stamp": "ALTER TABLE tasks ADD COLUMN created_stamp INTEGER",
            "completed_at": "ALTER TABLE tasks ADD COLUMN completed_at TEXT",
            "completed_stamp": "ALTER TABLE tasks ADD COLUMN completed_stamp INTEGER",
        }
        for column_name, statement in column_migrations.items():
            if column_name not in existing_columns:
                conn.execute(statement)
        conn.commit()


init_db()


class Task(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    created_at: str
    created_stamp: int | None = None
    completed_at: str | None = None
    completed_stamp: int | None = None


@app.get("/api/tasks")
def get_tasks():
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                id,
                title,
                status,
                priority,
                created_at,
                created_stamp,
                completed_at,
                completed_stamp
            FROM tasks
            ORDER BY COALESCE(created_stamp, 0), id
            """
        )
        return [dict(row) for row in cursor.fetchall()]


@app.post("/api/tasks")
def save_tasks(tasks: list[Task]):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM tasks")
        for task in tasks:
            conn.execute(
                """
                INSERT INTO tasks (
                    id,
                    title,
                    status,
                    priority,
                    created_at,
                    created_stamp,
                    completed_at,
                    completed_stamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    task.id,
                    task.title,
                    task.status,
                    task.priority,
                    task.created_at,
                    task.created_stamp,
                    task.completed_at,
                    task.completed_stamp,
                ),
            )
        conn.commit()
    return {"success": True}
