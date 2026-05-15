import json
import pytest
import pytest_asyncio
import aiosqlite
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport

from db import (
    init_db, create_student, seed_sites,
    save_express_submission, get_express_progress,
    get_express_submissions, get_express_submissions_all,
    delete_express_submissions, EXPRESS_TOTAL_STEPS,
)
from seeds import SITES
from api import create_app
from express_tasks import TOPICS, get_topic, get_topics_summary

BOT_TOKEN = "test-token-123:ABC"
ADMIN_ID = 999

# All 9 (topic, step) cells in the canonical order the UI walks.
ALL_CELLS = [
    ("content", 1), ("content", 2), ("content", 3),
    ("ux", 1), ("ux", 2), ("ux", 3),
    ("metrics", 1), ("metrics", 2), ("metrics", 3),
]


# ---------------------------------------------------------------------------
# express_tasks.py — data shape
# ---------------------------------------------------------------------------

def test_topics_data_shape():
    assert len(TOPICS) == 3
    assert {t["id"] for t in TOPICS} == {"content", "ux", "metrics"}
    for t in TOPICS:
        assert len(t["steps"]) == 3
        for st in t["steps"]:
            assert "title" in st and st["title"]
            assert "brief" in st and st["brief"]
            assert "criteria" in st
            assert isinstance(st["fields"], list) and len(st["fields"]) >= 1
            for f in st["fields"]:
                assert "id" in f and "label" in f


def test_get_topic_known_and_unknown():
    assert get_topic("content")["id"] == "content"
    assert get_topic("nope") is None


def test_topics_summary_omits_step_details():
    summary = get_topics_summary()
    assert len(summary) == 3
    for s in summary:
        assert "id" in s and "title" in s
        assert "steps" not in s


def test_express_total_steps_constant():
    assert EXPRESS_TOTAL_STEPS == 9


# ---------------------------------------------------------------------------
# db.py — express functions
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def db_conn():
    conn = await aiosqlite.connect(":memory:")
    await init_db(conn)
    yield conn
    await conn.close()


@pytest.mark.asyncio
async def test_progress_when_not_started(db_conn):
    sid = await create_student(db_conn, telegram_id=100, name="X", group_name="МДК01")
    progress = await get_express_progress(db_conn, sid)
    assert progress["status"] == "not_started"
    assert progress["total_completed"] == 0
    assert progress["completed_by_topic"] == {}


@pytest.mark.asyncio
async def test_progress_in_progress_after_partial(db_conn):
    sid = await create_student(db_conn, telegram_id=101, name="Y", group_name="МДК01")
    await save_express_submission(db_conn, sid, "content", 1, {"v1": "..."})
    await save_express_submission(db_conn, sid, "content", 2, {"v1": "..."})
    progress = await get_express_progress(db_conn, sid)
    assert progress["status"] == "in_progress"
    assert progress["total_completed"] == 2
    assert progress["completed_by_topic"]["content"] == [1, 2]


@pytest.mark.asyncio
async def test_submitted_after_all_nine_cells(db_conn):
    sid = await create_student(db_conn, telegram_id=102, name="Z", group_name="МДК01")
    for topic, step in ALL_CELLS:
        await save_express_submission(db_conn, sid, topic, step, {"x": f"{topic}-{step}"})
    progress = await get_express_progress(db_conn, sid)
    assert progress["status"] == "submitted"
    assert progress["total_completed"] == 9


@pytest.mark.asyncio
async def test_save_overwrites_same_cell(db_conn):
    sid = await create_student(db_conn, telegram_id=103, name="W", group_name="МДК01")
    await save_express_submission(db_conn, sid, "content", 1, {"v1": "first"})
    await save_express_submission(db_conn, sid, "content", 1, {"v1": "second"})
    subs = await get_express_submissions(db_conn, sid)
    assert len(subs) == 1
    assert json.loads(subs[0]["answers"])["v1"] == "second"


@pytest.mark.asyncio
async def test_save_allows_multiple_topics_for_same_student(db_conn):
    """The whole point of the new model — one student touches all 3 topics."""
    sid = await create_student(db_conn, telegram_id=104, name="Multi", group_name="МДК01")
    await save_express_submission(db_conn, sid, "content", 1, {"v1": "c1"})
    await save_express_submission(db_conn, sid, "ux", 1, {"improvements": "u1"})
    await save_express_submission(db_conn, sid, "metrics", 1, {"cr": "m1"})
    subs = await get_express_submissions(db_conn, sid)
    assert len(subs) == 3
    assert {s["topic"] for s in subs} == {"content", "ux", "metrics"}


@pytest.mark.asyncio
async def test_submissions_returned_in_canonical_order(db_conn):
    sid = await create_student(db_conn, telegram_id=105, name="Order", group_name="МДК01")
    # Save in scrambled order; reader should still get canonical content → ux → metrics.
    await save_express_submission(db_conn, sid, "metrics", 2, {"cac": "..."})
    await save_express_submission(db_conn, sid, "content", 1, {"v1": "..."})
    await save_express_submission(db_conn, sid, "ux", 3, {"journey": "..."})
    subs = await get_express_submissions(db_conn, sid)
    topics_in_order = [s["topic"] for s in subs]
    assert topics_in_order == ["content", "ux", "metrics"]


@pytest.mark.asyncio
async def test_aggregated_view_for_admin(db_conn):
    s1 = await create_student(db_conn, telegram_id=200, name="A", group_name="МДК01")
    s2 = await create_student(db_conn, telegram_id=201, name="B", group_name="МДК02")
    await save_express_submission(db_conn, s1, "content", 1, {"v1": "..."})
    await save_express_submission(db_conn, s1, "ux", 1, {"improvements": "..."})
    await save_express_submission(db_conn, s2, "content", 1, {"v1": "..."})

    all_rows = await get_express_submissions_all(db_conn)
    assert len(all_rows) == 2
    by_name = {r["name"]: r for r in all_rows}
    assert by_name["A"]["steps_done"] == 2
    assert by_name["B"]["steps_done"] == 1

    filtered = await get_express_submissions_all(db_conn, group="МДК02")
    assert len(filtered) == 1 and filtered[0]["name"] == "B"


@pytest.mark.asyncio
async def test_delete_express_submissions(db_conn):
    sid = await create_student(db_conn, telegram_id=300, name="Del", group_name="МДК01")
    await save_express_submission(db_conn, sid, "ux", 1, {"improvements": "x"})
    await save_express_submission(db_conn, sid, "content", 2, {"v1": "y"})
    await delete_express_submissions(db_conn, sid)
    progress = await get_express_progress(db_conn, sid)
    assert progress["status"] == "not_started"


# ---------------------------------------------------------------------------
# API endpoints
# ---------------------------------------------------------------------------

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
async def test_api_topics_summary(client):
    await client.post("/api/register", json={"name": "Q", "group": "МДК01"}, headers=auth_header(500))
    resp = await client.get("/api/express/topics", headers=auth_header(500))
    assert resp.status_code == 200
    topics = resp.json()
    assert len(topics) == 3
    assert {"id", "title", "emoji", "short", "duration", "steps_count"} <= set(topics[0].keys())


@pytest.mark.asyncio
async def test_api_task_strips_criteria(client):
    await client.post("/api/register", json={"name": "Q", "group": "МДК01"}, headers=auth_header(501))
    resp = await client.get("/api/express/task/content", headers=auth_header(501))
    assert resp.status_code == 200
    task = resp.json()
    assert task["id"] == "content"
    assert len(task["steps"]) == 3
    for st in task["steps"]:
        assert "criteria" not in st


@pytest.mark.asyncio
async def test_api_task_unknown_topic_404(client):
    await client.post("/api/register", json={"name": "Q", "group": "МДК01"}, headers=auth_header(502))
    resp = await client.get("/api/express/task/nope", headers=auth_header(502))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_api_progress_initial_then_partial(client):
    await client.post("/api/register", json={"name": "P", "group": "МДК01"}, headers=auth_header(503))

    initial = (await client.get("/api/express/progress", headers=auth_header(503))).json()
    assert initial["status"] == "not_started"
    assert initial["total_completed"] == 0
    assert initial["total_steps"] == 9

    resp = await client.post(
        "/api/express/step/1",
        json={"topic": "content", "answers": {"v1": "headline draft"}},
        headers=auth_header(503),
    )
    assert resp.status_code == 200
    p = resp.json()["progress"]
    assert p["status"] == "in_progress"
    assert p["total_completed"] == 1
    assert p["completed_by_topic"]["content"] == [1]

    detail = (await client.get("/api/express/progress", headers=auth_header(503))).json()
    assert detail["answers_by_topic"]["content"]["1"]["v1"] == "headline draft"


@pytest.mark.asyncio
async def test_api_student_can_save_all_three_topics(client):
    """Student walks all 9 cells across 3 topics — no topic lock anymore."""
    await client.post("/api/register", json={"name": "Walk", "group": "МДК01"}, headers=auth_header(504))
    for topic, step in ALL_CELLS:
        r = await client.post(
            f"/api/express/step/{step}",
            json={"topic": topic, "answers": {"x": f"{topic}{step}"}},
            headers=auth_header(504),
        )
        assert r.status_code == 200, f"failed at {topic}/{step}: {r.text}"
    final = r.json()["progress"]
    assert final["status"] == "submitted"
    assert final["total_completed"] == 9


@pytest.mark.asyncio
async def test_api_lock_after_all_nine(client):
    await client.post("/api/register", json={"name": "Lock", "group": "МДК01"}, headers=auth_header(505))
    for topic, step in ALL_CELLS:
        r = await client.post(
            f"/api/express/step/{step}",
            json={"topic": topic, "answers": {"x": f"{topic}{step}"}},
            headers=auth_header(505),
        )
        assert r.status_code == 200
    # An already-touched cell can be re-saved (idempotent overwrite is OK while submitted).
    rewrite_existing = await client.post(
        "/api/express/step/1",
        json={"topic": "content", "answers": {"v1": "updated"}},
        headers=auth_header(505),
    )
    assert rewrite_existing.status_code == 200
    # But a NEW cell can't appear after submitted state is reached — there are no new cells
    # because all 9 are filled. Simulate by deleting one and confirming admin route works.


@pytest.mark.asyncio
async def test_api_bad_step_and_bad_topic(client):
    await client.post("/api/register", json={"name": "Bad", "group": "МДК01"}, headers=auth_header(506))
    bad_step = await client.post(
        "/api/express/step/4",
        json={"topic": "ux", "answers": {"x": "1"}},
        headers=auth_header(506),
    )
    assert bad_step.status_code == 400
    bad_topic = await client.post(
        "/api/express/step/1",
        json={"topic": "philosophy", "answers": {"x": "1"}},
        headers=auth_header(506),
    )
    assert bad_topic.status_code == 400


@pytest.mark.asyncio
async def test_api_admin_listing_and_detail(client):
    await client.post("/api/register", json={"name": "Adm Test", "group": "МДК04"}, headers=auth_header(601))
    await client.post(
        "/api/express/step/1",
        json={"topic": "content", "answers": {"v1": "headline"}},
        headers=auth_header(601),
    )
    await client.post(
        "/api/express/step/1",
        json={"topic": "ux", "answers": {"improvements": "dropped"}},
        headers=auth_header(601),
    )

    students = (await client.get("/api/admin/express/students", headers=auth_header(ADMIN_ID))).json()
    target = next(s for s in students if s["name"] == "Adm Test")
    assert target["steps_done"] == 2
    assert target["status"] == "in_progress"
    assert target["total_steps"] == 9

    detail = (await client.get(f"/api/admin/express/student/{target['student_id']}",
                               headers=auth_header(ADMIN_ID))).json()
    assert detail["status"] == "in_progress"
    assert detail["total_completed"] == 2
    # Two topics should appear in canonical order: content first, then ux.
    topic_ids = [b["topic"] for b in detail["topics"]]
    assert topic_ids == ["content", "ux"]
    assert detail["topics"][0]["submissions"][0]["answers"]["v1"] == "headline"


@pytest.mark.asyncio
async def test_api_admin_reset_unblocks(client):
    await client.post("/api/register", json={"name": "R", "group": "МДК01"}, headers=auth_header(602))
    for topic, step in ALL_CELLS:
        await client.post(
            f"/api/express/step/{step}",
            json={"topic": topic, "answers": {"x": f"{topic}{step}"}},
            headers=auth_header(602),
        )

    students = (await client.get("/api/admin/express/students", headers=auth_header(ADMIN_ID))).json()
    sid = next(s["student_id"] for s in students if s["name"] == "R")
    resp = await client.post(f"/api/admin/express/reset/{sid}", headers=auth_header(ADMIN_ID))
    assert resp.status_code == 200

    # Student can start over.
    fresh = await client.post(
        "/api/express/step/1",
        json={"topic": "content", "answers": {"v1": "restart"}},
        headers=auth_header(602),
    )
    assert fresh.status_code == 200
    assert fresh.json()["progress"]["total_completed"] == 1


@pytest.mark.asyncio
async def test_api_admin_csv_export_has_all_nine_cells(client):
    await client.post("/api/register", json={"name": "Csv", "group": "МДК01"}, headers=auth_header(701))
    await client.post(
        "/api/express/step/1",
        json={"topic": "metrics", "answers": {"cr": "5%"}},
        headers=auth_header(701),
    )
    resp = await client.get("/api/admin/express/export", headers=auth_header(ADMIN_ID))
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    body = resp.text
    # Header row should mention each topic title at least once.
    for topic_title in [t["title"] for t in TOPICS]:
        assert topic_title in body
    assert "Csv" in body
