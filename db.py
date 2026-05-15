import json
from datetime import datetime, timezone
import aiosqlite
import os

SCHEMA = """
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL,
    group_name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id),
    step INTEGER NOT NULL CHECK(step IN (1, 2, 3)),
    answers TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    UNIQUE(student_id, step)
);

CREATE TABLE IF NOT EXISTS web_tokens (
    token TEXT PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quiz_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id),
    answers TEXT NOT NULL,
    score REAL NOT NULL,
    submitted_at TEXT NOT NULL,
    UNIQUE(student_id)
);

CREATE TABLE IF NOT EXISTS express_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id),
    topic TEXT NOT NULL,
    step INTEGER NOT NULL CHECK(step IN (1, 2, 3)),
    answers TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    UNIQUE(student_id, step)
);
"""


async def init_db(conn: aiosqlite.Connection):
    conn.row_factory = aiosqlite.Row
    await conn.executescript(SCHEMA)
    await conn.commit()


async def get_connection(db_path: str) -> aiosqlite.Connection:
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    conn = await aiosqlite.connect(db_path)
    await init_db(conn)
    return conn


# --- Students ---

async def create_student(conn, telegram_id: int, name: str, group_name: str) -> int:
    existing = await get_student_by_telegram_id(conn, telegram_id)
    if existing:
        return existing["id"]
    now = datetime.now(timezone.utc).isoformat()
    cursor = await conn.execute(
        "INSERT INTO students (telegram_id, name, group_name, created_at) VALUES (?, ?, ?, ?)",
        (telegram_id, name, group_name, now),
    )
    await conn.commit()
    return cursor.lastrowid


async def get_student_by_telegram_id(conn, telegram_id: int):
    cursor = await conn.execute(
        "SELECT * FROM students WHERE telegram_id = ?", (telegram_id,)
    )
    row = await cursor.fetchone()
    return dict(row) if row else None


async def get_all_students(conn, group: str = None):
    if group:
        cursor = await conn.execute(
            "SELECT * FROM students WHERE group_name = ? ORDER BY name", (group,)
        )
    else:
        cursor = await conn.execute("SELECT * FROM students ORDER BY name")
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


# --- Submissions ---

async def save_submission(conn, student_id: int, step: int, answers: dict) -> int:
    now = datetime.now(timezone.utc).isoformat()
    cursor = await conn.execute(
        """INSERT INTO submissions (student_id, step, answers, submitted_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(student_id, step) DO UPDATE SET answers=excluded.answers, submitted_at=excluded.submitted_at""",
        (student_id, step, json.dumps(answers, ensure_ascii=False), now),
    )
    await conn.commit()
    return cursor.lastrowid


async def get_submissions(conn, student_id: int):
    cursor = await conn.execute(
        "SELECT * FROM submissions WHERE student_id = ? ORDER BY step", (student_id,)
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def get_student_progress(conn, student_id: int) -> dict:
    subs = await get_submissions(conn, student_id)
    completed_steps = [s["step"] for s in subs]
    status = "submitted" if len(completed_steps) == 3 else f"step_{max(completed_steps)}" if completed_steps else "registered"
    return {"completed_steps": completed_steps, "status": status, "submissions": subs}


# --- Web tokens ---

async def create_web_token(conn, student_id: int) -> str:
    import secrets
    token = secrets.token_hex(32)
    await conn.execute("INSERT INTO web_tokens (token, student_id) VALUES (?, ?)", (token, student_id))
    await conn.commit()
    return token


async def get_student_by_web_token(conn, token: str):
    cursor = await conn.execute(
        "SELECT s.* FROM students s JOIN web_tokens wt ON s.id = wt.student_id WHERE wt.token = ?",
        (token,),
    )
    row = await cursor.fetchone()
    return dict(row) if row else None


async def delete_web_tokens(conn, student_id: int):
    await conn.execute("DELETE FROM web_tokens WHERE student_id = ?", (student_id,))
    await conn.commit()


# --- Sites ---

async def get_sites(conn):
    cursor = await conn.execute("SELECT * FROM sites ORDER BY category, name")
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


# --- Settings ---

async def get_setting(conn, key: str, default: str = "") -> str:
    cursor = await conn.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = await cursor.fetchone()
    return row["value"] if row else default


async def set_setting(conn, key: str, value: str) -> None:
    await conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )
    await conn.commit()


async def is_paused(conn) -> bool:
    return (await get_setting(conn, "paused", "false")) == "true"


async def set_paused(conn, paused: bool) -> None:
    await set_setting(conn, "paused", "true" if paused else "false")


async def get_whitelist(conn) -> list[int]:
    raw = await get_setting(conn, "whitelist", "")
    if not raw:
        return []
    return [int(x.strip()) for x in raw.split(",") if x.strip()]


async def add_to_whitelist(conn, telegram_id: int) -> None:
    current = await get_whitelist(conn)
    if telegram_id not in current:
        current.append(telegram_id)
    await set_setting(conn, "whitelist", ",".join(str(x) for x in current))


# --- Sites ---

async def seed_sites(conn, sites_data: list[dict]):
    cursor = await conn.execute("SELECT COUNT(*) as cnt FROM sites")
    row = await cursor.fetchone()
    if row["cnt"] > 0:
        return
    for site in sites_data:
        await conn.execute(
            "INSERT INTO sites (category, name, url) VALUES (?, ?, ?)",
            (site["category"], site["name"], site["url"]),
        )
    await conn.commit()


# --- Quiz ---

async def save_quiz_submission(conn, student_id: int, answers: dict, score: float) -> int:
    now = datetime.now(timezone.utc).isoformat()
    cursor = await conn.execute(
        "INSERT INTO quiz_submissions (student_id, answers, score, submitted_at) VALUES (?, ?, ?, ?)",
        (student_id, json.dumps(answers, ensure_ascii=False), score, now),
    )
    await conn.commit()
    return cursor.lastrowid


async def get_quiz_submission(conn, student_id: int):
    cursor = await conn.execute(
        "SELECT * FROM quiz_submissions WHERE student_id = ?", (student_id,)
    )
    row = await cursor.fetchone()
    return dict(row) if row else None


async def get_quiz_submissions_all(conn, group: str = None):
    if group:
        cursor = await conn.execute(
            """SELECT qs.*, s.name, s.group_name FROM quiz_submissions qs
               JOIN students s ON qs.student_id = s.id
               WHERE s.group_name = ? ORDER BY s.name""",
            (group,),
        )
    else:
        cursor = await conn.execute(
            """SELECT qs.*, s.name, s.group_name FROM quiz_submissions qs
               JOIN students s ON qs.student_id = s.id ORDER BY s.name"""
        )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def delete_quiz_submission(conn, student_id: int):
    await conn.execute("DELETE FROM quiz_submissions WHERE student_id = ?", (student_id,))
    await conn.commit()


# --- Express practice ("Практика на пару") ---

async def get_express_topic(conn, student_id: int) -> str | None:
    """Topic the student has locked in by saving at least one step. None if not started."""
    cursor = await conn.execute(
        "SELECT topic FROM express_submissions WHERE student_id = ? LIMIT 1",
        (student_id,),
    )
    row = await cursor.fetchone()
    return row["topic"] if row else None


async def save_express_submission(
    conn, student_id: int, topic: str, step: int, answers: dict
) -> int:
    now = datetime.now(timezone.utc).isoformat()
    cursor = await conn.execute(
        """INSERT INTO express_submissions (student_id, topic, step, answers, submitted_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(student_id, step) DO UPDATE
             SET answers=excluded.answers, submitted_at=excluded.submitted_at""",
        (student_id, topic, step, json.dumps(answers, ensure_ascii=False), now),
    )
    await conn.commit()
    return cursor.lastrowid


async def get_express_submissions(conn, student_id: int) -> list[dict]:
    cursor = await conn.execute(
        "SELECT * FROM express_submissions WHERE student_id = ? ORDER BY step",
        (student_id,),
    )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def get_express_progress(conn, student_id: int) -> dict:
    """Status across all 3 steps + locked topic (if any).

    status values:
      not_started        — no rows
      step_1 / step_2    — partially complete
      submitted          — all 3 steps saved (UI shows lock screen)
    """
    subs = await get_express_submissions(conn, student_id)
    if not subs:
        return {
            "topic": None,
            "completed_steps": [],
            "status": "not_started",
            "submissions": [],
        }
    completed = [s["step"] for s in subs]
    status = "submitted" if len(completed) == 3 else f"step_{max(completed)}"
    return {
        "topic": subs[0]["topic"],
        "completed_steps": completed,
        "status": status,
        "submissions": subs,
    }


async def get_express_submissions_all(conn, group: str | None = None) -> list[dict]:
    """Aggregated view for admin tab: one row per student who started express practice."""
    base = """
        SELECT es.student_id,
               s.name, s.group_name,
               MIN(es.topic) AS topic,
               COUNT(es.step) AS steps_done,
               MAX(es.submitted_at) AS last_submitted_at
        FROM express_submissions es
        JOIN students s ON s.id = es.student_id
    """
    if group:
        cursor = await conn.execute(
            base + " WHERE s.group_name = ? GROUP BY es.student_id ORDER BY s.name",
            (group,),
        )
    else:
        cursor = await conn.execute(
            base + " GROUP BY es.student_id ORDER BY s.name"
        )
    rows = await cursor.fetchall()
    return [dict(r) for r in rows]


async def delete_express_submissions(conn, student_id: int) -> None:
    await conn.execute(
        "DELETE FROM express_submissions WHERE student_id = ?", (student_id,)
    )
    await conn.commit()
