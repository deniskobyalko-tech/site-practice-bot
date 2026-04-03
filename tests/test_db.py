import json
import pytest
import pytest_asyncio
import aiosqlite
from db import (
    init_db, create_student, get_student_by_telegram_id, get_all_students,
    save_submission, get_submissions, get_student_progress,
)


@pytest_asyncio.fixture
async def db_conn():
    conn = await aiosqlite.connect(":memory:")
    await init_db(conn)
    yield conn
    await conn.close()


@pytest.mark.asyncio
async def test_create_and_get_student(db_conn):
    student_id = await create_student(db_conn, telegram_id=123456, name="Иванов Иван", group_name="МДК01")
    assert student_id is not None

    student = await get_student_by_telegram_id(db_conn, 123456)
    assert student["name"] == "Иванов Иван"
    assert student["group_name"] == "МДК01"


@pytest.mark.asyncio
async def test_duplicate_student_returns_existing(db_conn):
    id1 = await create_student(db_conn, telegram_id=123456, name="Иванов Иван", group_name="МДК01")
    id2 = await create_student(db_conn, telegram_id=123456, name="Иванов Иван", group_name="МДК01")
    assert id1 == id2


@pytest.mark.asyncio
async def test_get_all_students(db_conn):
    await create_student(db_conn, telegram_id=1, name="Student A", group_name="МДК01")
    await create_student(db_conn, telegram_id=2, name="Student B", group_name="МДК02")

    all_students = await get_all_students(db_conn)
    assert len(all_students) == 2

    filtered = await get_all_students(db_conn, group="МДК01")
    assert len(filtered) == 1
    assert filtered[0]["name"] == "Student A"


@pytest.mark.asyncio
async def test_save_and_get_submissions(db_conn):
    sid = await create_student(db_conn, telegram_id=100, name="Test", group_name="МДК01")
    await save_submission(db_conn, sid, step=1, answers={"site": "lamoda.ru", "task": "sales"})

    subs = await get_submissions(db_conn, sid)
    assert len(subs) == 1
    assert subs[0]["step"] == 1


@pytest.mark.asyncio
async def test_upsert_submission(db_conn):
    sid = await create_student(db_conn, telegram_id=101, name="Test2", group_name="МДК02")
    await save_submission(db_conn, sid, step=1, answers={"v": 1})
    await save_submission(db_conn, sid, step=1, answers={"v": 2})

    subs = await get_submissions(db_conn, sid)
    assert len(subs) == 1
    assert json.loads(subs[0]["answers"])["v"] == 2


@pytest.mark.asyncio
async def test_student_progress(db_conn):
    sid = await create_student(db_conn, telegram_id=102, name="Test3", group_name="МДК03")

    progress = await get_student_progress(db_conn, sid)
    assert progress["status"] == "registered"

    await save_submission(db_conn, sid, step=1, answers={})
    await save_submission(db_conn, sid, step=2, answers={})
    progress = await get_student_progress(db_conn, sid)
    assert progress["status"] == "step_2"

    await save_submission(db_conn, sid, step=3, answers={})
    progress = await get_student_progress(db_conn, sid)
    assert progress["status"] == "submitted"
