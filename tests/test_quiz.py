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


# --- API Tests ---

from httpx import AsyncClient, ASGITransport
from unittest.mock import patch
from seeds import SITES
from db import seed_sites
from api import create_app

BOT_TOKEN = "test-token-123:ABC"
ADMIN_ID = 999


@pytest_asyncio.fixture
async def app():
    conn = await aiosqlite.connect(":memory:")
    await init_db(conn)
    await seed_sites(conn, SITES)
    application = create_app(conn, bot_token=BOT_TOKEN, admin_telegram_id=ADMIN_ID)
    yield application
    await conn.close()


@pytest_asyncio.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def auth_header(telegram_id: int):
    return {"Authorization": f"tma test-data-for-{telegram_id}"}


@pytest.fixture(autouse=True)
def mock_auth():
    def fake_validate(init_data, token):
        return True
    def fake_parse(init_data):
        return int(init_data.split("-")[-1])
    with patch("api.validate_init_data", fake_validate), \
         patch("api.parse_init_data", fake_parse):
        yield


@pytest.mark.asyncio
async def test_quiz_questions_returns_10(client):
    await client.post("/api/register", json={"name": "Test", "group": "МДК01"}, headers=auth_header(500))
    resp = await client.get("/api/quiz/questions", headers=auth_header(500))
    assert resp.status_code == 200
    qs = resp.json()
    assert len(qs) == 10
    # No correct answers in response
    for q in qs:
        assert "correct" not in q
        assert "id" in q
        assert "text" in q
        assert len(q["options"]) == 4


@pytest.mark.asyncio
async def test_quiz_submit_and_result(client):
    await client.post("/api/register", json={"name": "Quiz Student", "group": "МДК01"}, headers=auth_header(501))
    answers = {"q1": "Сессии (визиты)", "q2": "wrong", "q3": "wrong"}
    resp = await client.post("/api/quiz/submit", json={"answers": answers}, headers=auth_header(501))
    assert resp.status_code == 200
    assert resp.json()["score"] == 1

    # Check result endpoint
    resp = await client.get("/api/quiz/result", headers=auth_header(501))
    assert resp.status_code == 200
    assert resp.json()["score"] == 1
    assert "details" not in resp.json()


@pytest.mark.asyncio
async def test_quiz_duplicate_submit_returns_409(client):
    await client.post("/api/register", json={"name": "Dup", "group": "МДК01"}, headers=auth_header(502))
    answers = {"q1": "Сессии (визиты)"}
    await client.post("/api/quiz/submit", json={"answers": answers}, headers=auth_header(502))
    resp = await client.post("/api/quiz/submit", json={"answers": answers}, headers=auth_header(502))
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_quiz_admin_students(client):
    await client.post("/api/register", json={"name": "Admin Quiz", "group": "МДК01"}, headers=auth_header(503))
    await client.post("/api/quiz/submit", json={"answers": {"q1": "Сессии (визиты)"}}, headers=auth_header(503))
    resp = await client.get("/api/admin/quiz/students", headers=auth_header(ADMIN_ID))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_quiz_admin_detail(client):
    await client.post("/api/register", json={"name": "Detail", "group": "МДК04"}, headers=auth_header(504))
    await client.post("/api/quiz/submit", json={"answers": {"q1": "Сессии (визиты)"}}, headers=auth_header(504))
    # Get student id — filter by unique group to avoid cross-test interference
    students = (await client.get("/api/admin/quiz/students?group=МДК04", headers=auth_header(ADMIN_ID))).json()
    sid = next(s["student_id"] for s in students if s["name"] == "Detail")
    resp = await client.get(f"/api/admin/quiz/student/{sid}", headers=auth_header(ADMIN_ID))
    assert resp.status_code == 200
    data = resp.json()
    assert "details" in data
    assert data["score"] == 1


@pytest.mark.asyncio
async def test_quiz_admin_reset(client):
    await client.post("/api/register", json={"name": "Reset", "group": "МДК01"}, headers=auth_header(505))
    await client.post("/api/quiz/submit", json={"answers": {"q1": "x"}}, headers=auth_header(505))
    students = (await client.get("/api/admin/quiz/students", headers=auth_header(ADMIN_ID))).json()
    sid = next(s["student_id"] for s in students if s["name"] == "Reset")
    resp = await client.post(f"/api/admin/quiz/reset/{sid}", headers=auth_header(ADMIN_ID))
    assert resp.status_code == 200
    # Should be able to submit again
    resp = await client.post("/api/quiz/submit", json={"answers": {"q1": "y"}}, headers=auth_header(505))
    assert resp.status_code == 200
