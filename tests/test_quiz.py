import json
import pytest
import pytest_asyncio
import aiosqlite
from db import init_db, create_student, save_quiz_submission, get_quiz_submission, get_quiz_submissions_all


@pytest_asyncio.fixture
async def db_conn():
    conn = await aiosqlite.connect(":memory:")
    await init_db(conn)
    yield conn
    await conn.close()


@pytest.mark.asyncio
async def test_save_and_get_quiz_submission(db_conn):
    sid = await create_student(db_conn, telegram_id=100, name="Test", group_name="МДК01")
    answers = {"q1": "Сессии (визиты)", "q2": "CTR"}
    await save_quiz_submission(db_conn, sid, answers, score=1)

    result = await get_quiz_submission(db_conn, sid)
    assert result is not None
    assert result["score"] == 1
    assert json.loads(result["answers"])["q1"] == "Сессии (визиты)"


@pytest.mark.asyncio
async def test_duplicate_quiz_submission_raises(db_conn):
    sid = await create_student(db_conn, telegram_id=101, name="Test2", group_name="МДК01")
    await save_quiz_submission(db_conn, sid, {"q1": "a"}, score=0)
    with pytest.raises(Exception):
        await save_quiz_submission(db_conn, sid, {"q1": "b"}, score=1)


@pytest.mark.asyncio
async def test_get_quiz_submissions_all(db_conn):
    sid1 = await create_student(db_conn, telegram_id=200, name="A", group_name="МДК01")
    sid2 = await create_student(db_conn, telegram_id=201, name="B", group_name="МДК02")
    await save_quiz_submission(db_conn, sid1, {"q1": "x"}, score=5)
    await save_quiz_submission(db_conn, sid2, {"q1": "y"}, score=8)

    all_subs = await get_quiz_submissions_all(db_conn)
    assert len(all_subs) == 2

    filtered = await get_quiz_submissions_all(db_conn, group="МДК01")
    assert len(filtered) == 1
    assert filtered[0]["name"] == "A"


@pytest.mark.asyncio
async def test_get_nonexistent_quiz_submission(db_conn):
    result = await get_quiz_submission(db_conn, 999)
    assert result is None
