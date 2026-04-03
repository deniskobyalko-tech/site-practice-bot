import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch
import aiosqlite
from db import init_db, seed_sites
from seeds import SITES
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
        tid = int(init_data.split("-")[-1])
        return tid

    with patch("api.validate_init_data", fake_validate), \
         patch("api.parse_init_data", fake_parse):
        yield


@pytest.mark.asyncio
async def test_register_student(client):
    resp = await client.post("/api/register",
        json={"name": "Иванов Иван", "group": "МДК01"},
        headers=auth_header(123))
    assert resp.status_code == 200
    assert resp.json()["name"] == "Иванов Иван"


@pytest.mark.asyncio
async def test_get_student_profile(client):
    await client.post("/api/register",
        json={"name": "Петров Пётр", "group": "МДК02"},
        headers=auth_header(456))
    resp = await client.get("/api/student", headers=auth_header(456))
    assert resp.status_code == 200
    assert resp.json()["student"]["name"] == "Петров Пётр"
    assert resp.json()["progress"]["status"] == "registered"


@pytest.mark.asyncio
async def test_submit_step(client):
    await client.post("/api/register",
        json={"name": "Test", "group": "МДК01"},
        headers=auth_header(789))
    resp = await client.post("/api/submit/1",
        json={"site": "lamoda.ru", "task": "sales"},
        headers=auth_header(789))
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_sites(client):
    resp = await client.get("/api/sites", headers=auth_header(123))
    assert resp.status_code == 200
    sites = resp.json()
    assert len(sites) > 0
    assert "category" in sites[0]


@pytest.mark.asyncio
async def test_admin_students_list(client):
    await client.post("/api/register",
        json={"name": "Admin Test", "group": "МДК01"},
        headers=auth_header(100))
    resp = await client.get("/api/admin/students", headers=auth_header(ADMIN_ID))
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_admin_forbidden_for_non_admin(client):
    resp = await client.get("/api/admin/students", headers=auth_header(123))
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_export_csv(client):
    await client.post("/api/register",
        json={"name": "CSV Test", "group": "МДК01"},
        headers=auth_header(200))
    resp = await client.get("/api/admin/export", headers=auth_header(ADMIN_ID))
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
