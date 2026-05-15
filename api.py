import csv
import io
import json
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
import aiosqlite
from auth import validate_init_data, parse_init_data
from db import (
    create_student, get_student_by_telegram_id, get_all_students,
    save_submission, get_student_progress, get_submissions, get_sites, seed_sites,
    create_web_token, get_student_by_web_token, delete_web_tokens,
    is_paused, get_whitelist,
    save_quiz_submission, get_quiz_submission, get_quiz_submissions_all, delete_quiz_submission,
    get_campaign_scenario, save_campaign_submission, get_campaign_submissions,
    get_campaign_progress, get_campaign_submissions_all, delete_campaign_submissions,
)
from quiz_data import get_shuffled_questions, score_answers
from campaign_data import build_dashboard, SCENARIOS as CAMPAIGN_SCENARIOS
from config import GROUPS


class RegisterRequest(BaseModel):
    name: str
    group: str


def create_app(conn: aiosqlite.Connection, bot_token: str, admin_telegram_id: int) -> FastAPI:
    app = FastAPI()

    async def get_user_id(request: Request) -> tuple[int, str]:
        """Returns (telegram_id, auth_type). auth_type is 'tma' or 'web'."""
        auth = request.headers.get("Authorization", "")
        if auth.startswith("tma "):
            init_data = auth[4:]
            if not validate_init_data(init_data, bot_token):
                raise HTTPException(401, "Invalid initData")
            return parse_init_data(init_data), "tma"
        if auth.startswith("Bearer "):
            token = auth[7:]
            student = await get_student_by_web_token(conn, token)
            if not student:
                raise HTTPException(401, "Invalid token")
            return student["telegram_id"], "web"
        raise HTTPException(401, "Missing authorization")

    def require_admin(telegram_id: int):
        if telegram_id != admin_telegram_id:
            raise HTTPException(403, "Admin access required")

    @app.get("/api/status")
    async def get_status():
        paused = await is_paused(conn)
        whitelist = await get_whitelist(conn) if paused else []
        return {"paused": paused, "whitelist": whitelist}

    @app.post("/api/web-register")
    async def web_register(req: RegisterRequest):
        """Register via web (no Telegram). Returns a Bearer token."""
        if req.group not in GROUPS:
            raise HTTPException(400, f"Invalid group. Must be one of: {GROUPS}")
        if not req.name.strip():
            raise HTTPException(400, "Name is required")
        import random
        fake_tg_id = -random.randint(100000, 999999999)
        student_id = await create_student(conn, fake_tg_id, req.name.strip(), req.group)
        token = await create_web_token(conn, student_id)
        student = await get_student_by_telegram_id(conn, fake_tg_id)
        return {"student": student, "token": token}

    @app.post("/api/register")
    async def register(req: RegisterRequest, request: Request):
        telegram_id = (await get_user_id(request))[0]
        if req.group not in GROUPS:
            raise HTTPException(400, f"Invalid group. Must be one of: {GROUPS}")
        if not req.name.strip():
            raise HTTPException(400, "Name is required")
        await create_student(conn, telegram_id, req.name.strip(), req.group)
        student = await get_student_by_telegram_id(conn, telegram_id)
        return student

    @app.get("/api/student")
    async def get_student(request: Request):
        telegram_id = (await get_user_id(request))[0]
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found. Register first.")
        progress = await get_student_progress(conn, student["id"])
        return {"student": student, "progress": progress, "is_admin": telegram_id == admin_telegram_id}

    @app.post("/api/submit/{step}")
    async def submit_step(step: int, request: Request):
        if step not in (1, 2, 3):
            raise HTTPException(400, "Step must be 1, 2, or 3")
        telegram_id = (await get_user_id(request))[0]
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found")
        body = await request.json()
        await save_submission(conn, student["id"], step, body)
        progress = await get_student_progress(conn, student["id"])
        return {"ok": True, "progress": progress}

    @app.get("/api/sites")
    async def list_sites(request: Request):
        (await get_user_id(request))[0]
        sites = await get_sites(conn)
        return sites

    @app.get("/api/admin/students")
    async def admin_students(request: Request, group: str = None):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        students = await get_all_students(conn, group=group)
        result = []
        for s in students:
            progress = await get_student_progress(conn, s["id"])
            result.append({**s, "status": progress["status"]})
        return result

    @app.get("/api/admin/student/{student_id}")
    async def admin_student_detail(student_id: int, request: Request):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        subs = await get_submissions(conn, student_id)
        return [
            {**s, "answers": json.loads(s["answers"])} for s in subs
        ]

    @app.get("/api/admin/export")
    async def admin_export(request: Request, group: str = None):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        students = await get_all_students(conn, group=group)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Name", "Group", "Status", "Step 1", "Step 2", "Step 3"])

        for s in students:
            progress = await get_student_progress(conn, s["id"])
            subs_by_step = {sub["step"]: sub["answers"] for sub in progress["submissions"]}
            writer.writerow([
                s["name"], s["group_name"], progress["status"],
                subs_by_step.get(1, ""), subs_by_step.get(2, ""), subs_by_step.get(3, ""),
            ])

        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=practice_results.csv"},
        )

    @app.post("/api/reset")
    async def reset_submissions(request: Request):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found")
        await conn.execute("DELETE FROM quiz_submissions WHERE student_id = ?", (student["id"],))
        await conn.execute("DELETE FROM submissions WHERE student_id = ?", (student["id"],))
        await conn.execute("DELETE FROM students WHERE id = ?", (student["id"],))
        await conn.commit()
        return {"ok": True}

    @app.post("/api/admin/reset/{student_id}")
    async def admin_reset_student(student_id: int, request: Request):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        await conn.execute("DELETE FROM quiz_submissions WHERE student_id = ?", (student_id,))
        await conn.execute("DELETE FROM submissions WHERE student_id = ?", (student_id,))
        await conn.execute("DELETE FROM web_tokens WHERE student_id = ?", (student_id,))
        await conn.execute("DELETE FROM students WHERE id = ?", (student_id,))
        await conn.commit()
        return {"ok": True}

    # --- Quiz ---

    @app.get("/api/quiz/questions")
    async def quiz_questions(request: Request):
        telegram_id = (await get_user_id(request))[0]
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found. Register first.")
        return get_shuffled_questions()

    @app.post("/api/quiz/submit")
    async def quiz_submit(request: Request):
        telegram_id = (await get_user_id(request))[0]
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found")
        existing = await get_quiz_submission(conn, student["id"])
        if existing:
            return JSONResponse(
                status_code=409,
                content={"error": "already_submitted", "score": existing["score"]},
            )
        body = await request.json()
        answers = body.get("answers", {})
        score, _ = score_answers(answers)
        await save_quiz_submission(conn, student["id"], answers, score)
        return {"ok": True, "score": score, "total": 5}

    @app.get("/api/quiz/result")
    async def quiz_result(request: Request):
        telegram_id = (await get_user_id(request))[0]
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found")
        sub = await get_quiz_submission(conn, student["id"])
        if not sub:
            return {"submitted": False}
        return {"submitted": True, "score": sub["score"], "total": 5}

    @app.get("/api/admin/quiz/students")
    async def admin_quiz_students(request: Request, group: str = None):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        return await get_quiz_submissions_all(conn, group=group)

    @app.get("/api/admin/quiz/student/{student_id}")
    async def admin_quiz_student_detail(student_id: int, request: Request):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        sub = await get_quiz_submission(conn, student_id)
        if not sub:
            raise HTTPException(404, "No quiz submission")
        _, details = score_answers(json.loads(sub["answers"]))
        return {"score": sub["score"], "total": 5, "submitted_at": sub["submitted_at"], "details": details}

    @app.get("/api/admin/quiz/export")
    async def admin_quiz_export(request: Request, group: str = None):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        subs = await get_quiz_submissions_all(conn, group=group)
        output = io.StringIO()
        writer = csv.writer(output)
        from quiz_data import QUIZ_QUESTIONS
        q_headers = [f"Q{i+1}" for i in range(len(QUIZ_QUESTIONS))]
        writer.writerow(["Name", "Group", "Score"] + q_headers)
        for s in subs:
            answers = json.loads(s["answers"])
            row = [s["name"], s["group_name"], s["score"]]
            for q in QUIZ_QUESTIONS:
                row.append(answers.get(q["id"], ""))
            writer.writerow(row)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=quiz_results.csv"},
        )

    @app.post("/api/admin/quiz/reset/{student_id}")
    async def admin_quiz_reset(student_id: int, request: Request):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        await delete_quiz_submission(conn, student_id)
        return {"ok": True}

    # ============ Campaign (Practice #2) ============

    @app.get("/api/campaign/dashboard")
    async def campaign_dashboard(request: Request):
        """Return student's fixed scenario dashboard (deterministic)."""
        telegram_id = (await get_user_id(request))[0]
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found")
        scenario = await get_campaign_scenario(conn, student["id"])
        if not scenario:
            # Fallback: assign on demand
            import itertools
            scenarios = list(CAMPAIGN_SCENARIOS.keys())
            scenario = scenarios[student["id"] % len(scenarios)]
            await conn.execute("UPDATE students SET campaign_scenario=? WHERE id=?", (scenario, student["id"]))
            await conn.commit()
        dashboard = build_dashboard(scenario, student["id"])
        return dashboard

    @app.get("/api/campaign/progress")
    async def campaign_progress(request: Request):
        telegram_id = (await get_user_id(request))[0]
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found")
        progress = await get_campaign_progress(conn, student["id"])
        return progress

    @app.post("/api/campaign/submit/{step}")
    async def campaign_submit(step: int, request: Request):
        if step not in (1, 2, 3):
            raise HTTPException(400, "Invalid step")
        telegram_id = (await get_user_id(request))[0]
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found")
        scenario = await get_campaign_scenario(conn, student["id"])
        if not scenario:
            raise HTTPException(400, "Scenario not assigned")
        body = await request.json()
        answers = body.get("answers", {})
        await save_campaign_submission(conn, student["id"], step, scenario, answers)
        return {"ok": True, "step": step}

    @app.get("/api/admin/campaign/students")
    async def admin_campaign_students(request: Request, group: str = None):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        return await get_campaign_submissions_all(conn, group=group)

    @app.get("/api/admin/campaign/student/{student_id}")
    async def admin_campaign_student_detail(student_id: int, request: Request):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        subs = await get_campaign_submissions(conn, student_id)
        scenario = await get_campaign_scenario(conn, student_id)
        return {"scenario": scenario, "submissions": subs}

    @app.post("/api/admin/campaign/reset/{student_id}")
    async def admin_campaign_reset(student_id: int, request: Request):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        await delete_campaign_submissions(conn, student_id)
        return {"ok": True}

    # Store bot instance for notifications
    app.state.bot = None

    @app.post("/api/notify-completion")
    async def notify_completion(request: Request):
        telegram_id = (await get_user_id(request))[0]
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found")
        if app.state.bot:
            try:
                await app.state.bot.send_message(
                    chat_id=telegram_id,
                    text=f"Практика сдана! Все 3 шага выполнены.\n\nСтудент: {student['name']}\nГруппа: {student['group_name']}",
                )
            except Exception:
                pass
        return {"ok": True}

    return app
