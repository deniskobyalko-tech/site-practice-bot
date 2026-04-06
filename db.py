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
