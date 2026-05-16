import csv
import io
import json
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
import aiosqlite
from auth import validate_init_data, parse_init_data
from db import (
    create_student, get_student_by_telegram_id, get_all_students,
    save_submission, get_student_progress, get_submissions, get_sites, seed_sites,
    create_web_token, get_student_by_web_token, delete_web_tokens,
    is_paused, get_whitelist,
    is_express_closed,
    save_quiz_submission, get_quiz_submission, get_quiz_submissions_all, delete_quiz_submission,
    save_express_submission, get_express_submissions,
    get_express_progress, get_express_submissions_all, delete_express_submissions,
    EXPRESS_TOTAL_STEPS,
    get_campaign_scenario, save_campaign_submission, get_campaign_submissions,
    get_campaign_progress, get_campaign_submissions_all, delete_campaign_submissions,
    save_exam_submission, get_exam_submission, get_exam_submissions_all, delete_exam_submission,
)
from quiz_data import get_shuffled_questions, score_answers
from express_tasks import TOPICS, TOPIC_IDS, get_topic, get_topics_summary
from campaign_data import build_dashboard, SCENARIOS as CAMPAIGN_SCENARIOS
from config import GROUPS


class RegisterRequest(BaseModel):
    name: str
    group: str


def create_app(conn: aiosqlite.Connection, bot_token: str, admin_telegram_id: int) -> FastAPI:
    app = FastAPI()

    # Static exam page lives on GitHub Pages (deniskobyalko-tech.github.io).
    # Allow it to hit our API; same domain (alarm-trusty-ru.ru) is unaffected.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://deniskobyalko-tech.github.io",
            "https://alarm-trusty-ru.ru",
        ],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

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
        # Lock submissions once all 3 steps are done — prevents winners from overwriting graded work.
        progress = await get_student_progress(conn, student["id"])
        if progress["status"] == "submitted" and telegram_id != admin_telegram_id:
            raise HTTPException(409, "Practice already submitted")
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
        await conn.execute("DELETE FROM express_submissions WHERE student_id = ?", (student["id"],))
        await conn.execute("DELETE FROM campaign_submissions WHERE student_id = ?", (student["id"],))
        await conn.execute("DELETE FROM exam_submissions WHERE student_id = ?", (student["id"],))
        await conn.execute("DELETE FROM quiz_submissions WHERE student_id = ?", (student["id"],))
        await conn.execute("DELETE FROM submissions WHERE student_id = ?", (student["id"],))
        await conn.execute("DELETE FROM students WHERE id = ?", (student["id"],))
        await conn.commit()
        return {"ok": True}

    @app.post("/api/admin/reset/{student_id}")
    async def admin_reset_student(student_id: int, request: Request):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        await conn.execute("DELETE FROM express_submissions WHERE student_id = ?", (student_id,))
        await conn.execute("DELETE FROM campaign_submissions WHERE student_id = ?", (student_id,))
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

    # --- Express practice ("Практика на пару 16.05") ---
    # Sequential flow: every student walks all 3 topics in fixed order
    # (content → ux → metrics), 3 steps each, 9 in total.

    @app.get("/api/express/topics")
    async def express_topics(request: Request):
        (await get_user_id(request))[0]
        return get_topics_summary()

    @app.get("/api/express/task/{topic}")
    async def express_task(topic: str, request: Request):
        (await get_user_id(request))[0]
        t = get_topic(topic)
        if not t:
            raise HTTPException(404, "Unknown topic")
        # Strip 'criteria' from response — that's for the grader, not the student.
        return {
            "id": t["id"],
            "title": t["title"],
            "emoji": t["emoji"],
            "duration": t["duration"],
            "steps": [
                {
                    "id": st["id"],
                    "title": st["title"],
                    "brief": st["brief"],
                    "fields": st["fields"],
                }
                for st in t["steps"]
            ],
        }

    @app.get("/api/express/progress")
    async def express_progress(request: Request):
        telegram_id = (await get_user_id(request))[0]
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found. Register first.")
        progress = await get_express_progress(conn, student["id"])
        answers_by_topic: dict[str, dict[int, dict]] = {}
        for s in progress["submissions"]:
            answers_by_topic.setdefault(s["topic"], {})[s["step"]] = json.loads(s["answers"])
        return {
            "status": progress["status"],
            "total_completed": progress["total_completed"],
            "total_steps": progress["total_steps"],
            "completed_by_topic": progress["completed_by_topic"],
            "answers_by_topic": answers_by_topic,
        }

    @app.post("/api/express/step/{step}")
    async def express_save_step(step: int, request: Request):
        if step not in (1, 2, 3):
            raise HTTPException(400, "Step must be 1, 2, or 3")
        telegram_id = (await get_user_id(request))[0]
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found. Register first.")

        body = await request.json()
        topic = body.get("topic")
        answers = body.get("answers", {})
        if topic not in TOPIC_IDS:
            raise HTTPException(400, "Unknown topic")
        if not isinstance(answers, dict):
            raise HTTPException(400, "Answers must be an object")

        progress = await get_express_progress(conn, student["id"])

        # Hard close: admin can shut the whole practice down via /close_express.
        if (await is_express_closed(conn)) and telegram_id != admin_telegram_id:
            raise HTTPException(409, "Express practice is closed")

        # Lock once all 9 cells are filled (admin still allowed to overwrite).
        already_done = step in progress["completed_by_topic"].get(topic, [])
        if (
            progress["status"] == "submitted"
            and not already_done
            and telegram_id != admin_telegram_id
        ):
            raise HTTPException(409, "Express practice already submitted")

        await save_express_submission(conn, student["id"], topic, step, answers)
        updated = await get_express_progress(conn, student["id"])
        return {
            "ok": True,
            "progress": {
                "status": updated["status"],
                "total_completed": updated["total_completed"],
                "total_steps": updated["total_steps"],
                "completed_by_topic": updated["completed_by_topic"],
            },
        }

    @app.get("/api/admin/express/students")
    async def admin_express_students(request: Request, group: str | None = None):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        rows = await get_express_submissions_all(conn, group=group)
        for r in rows:
            r["status"] = (
                "submitted" if r["steps_done"] >= EXPRESS_TOTAL_STEPS else "in_progress"
            )
            r["total_steps"] = EXPRESS_TOTAL_STEPS
        return rows

    @app.get("/api/admin/express/student/{student_id}")
    async def admin_express_student_detail(student_id: int, request: Request):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        progress = await get_express_progress(conn, student_id)
        if not progress["submissions"]:
            raise HTTPException(404, "No express submissions for this student")

        # Group submissions by topic, preserving canonical TOPICS order.
        subs_by_topic: dict[str, dict[int, dict]] = {}
        for s in progress["submissions"]:
            subs_by_topic.setdefault(s["topic"], {})[s["step"]] = s

        topics_block = []
        for t in TOPICS:
            if t["id"] not in subs_by_topic:
                continue
            steps_meta = {st["id"]: st for st in t["steps"]}
            topics_block.append({
                "topic": t["id"],
                "topic_title": t["title"],
                "emoji": t["emoji"],
                "submissions": [
                    {
                        "step": step_num,
                        "step_title": steps_meta.get(step_num, {}).get("title", ""),
                        "criteria": steps_meta.get(step_num, {}).get("criteria", ""),
                        "brief": steps_meta.get(step_num, {}).get("brief", ""),
                        "fields": steps_meta.get(step_num, {}).get("fields", []),
                        "answers": json.loads(s["answers"]),
                        "submitted_at": s["submitted_at"],
                    }
                    for step_num, s in sorted(subs_by_topic[t["id"]].items())
                ],
            })

        return {
            "status": progress["status"],
            "total_completed": progress["total_completed"],
            "total_steps": progress["total_steps"],
            "topics": topics_block,
        }

    @app.post("/api/admin/express/reset/{student_id}")
    async def admin_express_reset(student_id: int, request: Request):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        await delete_express_submissions(conn, student_id)
        return {"ok": True}

    @app.get("/api/admin/express/export")
    async def admin_express_export(request: Request, group: str | None = None):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        rows = await get_express_submissions_all(conn, group=group)
        output = io.StringIO()
        writer = csv.writer(output)
        header = ["Name", "Group", "Steps done", "Status"]
        cell_keys = []
        for t in TOPICS:
            for st in t["steps"]:
                header.append(f"{t['title']} — шаг {st['id']}")
                cell_keys.append((t["id"], st["id"]))
        writer.writerow(header)
        for r in rows:
            subs = await get_express_submissions(conn, r["student_id"])
            cells = {(s["topic"], s["step"]): s["answers"] for s in subs}
            row = [
                r["name"],
                r["group_name"],
                r["steps_done"],
                "submitted" if r["steps_done"] >= EXPRESS_TOTAL_STEPS else "in_progress",
            ]
            for key in cell_keys:
                row.append(cells.get(key, ""))
            writer.writerow(row)
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=express_results.csv"},
        )

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

    # ============ Exam (Создание и поддержка сайта, 2026-05-16) ============

    @app.post("/api/exam/submit")
    async def exam_submit(request: Request):
        telegram_id = (await get_user_id(request))[0]
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found. Register first.")

        body = await request.json()
        if not isinstance(body, dict):
            raise HTTPException(400, "Body must be a JSON object")

        mcq_answers = body.get("mcq_answers") or {}
        mcq_score = int(body.get("mcq_score") or 0)
        mcq_total = int(body.get("mcq_total") or 0)
        open_picked = body.get("open_picked") or []
        open_answers = body.get("open_answers") or {}

        if not isinstance(mcq_answers, dict) or not isinstance(open_answers, dict):
            raise HTTPException(400, "mcq_answers and open_answers must be objects")
        if not isinstance(open_picked, list):
            raise HTTPException(400, "open_picked must be a list")

        await save_exam_submission(
            conn,
            student["id"],
            mcq_answers,
            mcq_score,
            mcq_total,
            open_picked,
            open_answers,
        )

        # Best-effort telegram notification to the teacher.
        if app.state.bot is not None:
            try:
                preview_lines = [
                    "🎓 Экзамен сдан",
                    f"Студент: {student['name']} ({student['group_name']})",
                    f"Часть 1: {mcq_score}/{mcq_total}",
                    f"Часть 2 — выбраны вопросы №{', №'.join(str(i + 1) for i in open_picked) if open_picked else '—'}",
                    "",
                    "Смотри детали в админ Mini App → вкладка «Экзамен».",
                ]
                await app.state.bot.send_message(
                    chat_id=admin_telegram_id,
                    text="\n".join(preview_lines),
                )
            except Exception:
                pass

        return {"ok": True, "score": mcq_score, "total": mcq_total}

    @app.get("/api/exam/result")
    async def exam_result(request: Request):
        telegram_id = (await get_user_id(request))[0]
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found")
        sub = await get_exam_submission(conn, student["id"])
        if not sub:
            return {"submitted": False}
        return {
            "submitted": True,
            "score": sub["mcq_score"],
            "total": sub["mcq_total"],
            "submitted_at": sub["submitted_at"],
        }

    @app.get("/api/admin/exam/students")
    async def admin_exam_students(request: Request, group: str | None = None):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        return await get_exam_submissions_all(conn, group=group)

    @app.get("/api/admin/exam/student/{student_id}")
    async def admin_exam_student_detail(student_id: int, request: Request):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        sub = await get_exam_submission(conn, student_id)
        if not sub:
            raise HTTPException(404, "No exam submission")
        return {
            "score": sub["mcq_score"],
            "total": sub["mcq_total"],
            "submitted_at": sub["submitted_at"],
            "mcq_answers": json.loads(sub["mcq_answers"]),
            "open_picked": json.loads(sub["open_picked"]),
            "open_answers": json.loads(sub["open_answers"]),
        }

    @app.post("/api/admin/exam/reset/{student_id}")
    async def admin_exam_reset(student_id: int, request: Request):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        await delete_exam_submission(conn, student_id)
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
