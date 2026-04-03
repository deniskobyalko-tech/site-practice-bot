import csv
import io
import json
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import aiosqlite
from auth import validate_init_data, parse_init_data
from db import (
    create_student, get_student_by_telegram_id, get_all_students,
    save_submission, get_student_progress, get_submissions, get_sites, seed_sites,
    create_web_token, get_student_by_web_token, delete_web_tokens,
)
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
        await conn.execute("DELETE FROM submissions WHERE student_id = ?", (student["id"],))
        await conn.execute("DELETE FROM students WHERE id = ?", (student["id"],))
        await conn.commit()
        return {"ok": True}

    @app.post("/api/admin/reset/{student_id}")
    async def admin_reset_student(student_id: int, request: Request):
        telegram_id = (await get_user_id(request))[0]
        require_admin(telegram_id)
        await conn.execute("DELETE FROM submissions WHERE student_id = ?", (student_id,))
        await conn.execute("DELETE FROM web_tokens WHERE student_id = ?", (student_id,))
        await conn.execute("DELETE FROM students WHERE id = ?", (student_id,))
        await conn.commit()
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
