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
)
from config import GROUPS


class RegisterRequest(BaseModel):
    name: str
    group: str


def create_app(conn: aiosqlite.Connection, bot_token: str, admin_telegram_id: int) -> FastAPI:
    app = FastAPI()

    def get_telegram_id(request: Request) -> int:
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("tma "):
            raise HTTPException(401, "Missing authorization")
        init_data = auth[4:]
        if not validate_init_data(init_data, bot_token):
            raise HTTPException(401, "Invalid initData")
        return parse_init_data(init_data)

    def require_admin(telegram_id: int):
        if telegram_id != admin_telegram_id:
            raise HTTPException(403, "Admin access required")

    @app.post("/api/register")
    async def register(req: RegisterRequest, request: Request):
        telegram_id = get_telegram_id(request)
        if req.group not in GROUPS:
            raise HTTPException(400, f"Invalid group. Must be one of: {GROUPS}")
        if not req.name.strip():
            raise HTTPException(400, "Name is required")
        await create_student(conn, telegram_id, req.name.strip(), req.group)
        student = await get_student_by_telegram_id(conn, telegram_id)
        return student

    @app.get("/api/student")
    async def get_student(request: Request):
        telegram_id = get_telegram_id(request)
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found. Register first.")
        progress = await get_student_progress(conn, student["id"])
        return {"student": student, "progress": progress}

    @app.post("/api/submit/{step}")
    async def submit_step(step: int, request: Request):
        if step not in (1, 2, 3):
            raise HTTPException(400, "Step must be 1, 2, or 3")
        telegram_id = get_telegram_id(request)
        student = await get_student_by_telegram_id(conn, telegram_id)
        if not student:
            raise HTTPException(404, "Student not found")
        body = await request.json()
        await save_submission(conn, student["id"], step, body)
        progress = await get_student_progress(conn, student["id"])
        return {"ok": True, "progress": progress}

    @app.get("/api/sites")
    async def list_sites(request: Request):
        get_telegram_id(request)
        sites = await get_sites(conn)
        return sites

    @app.get("/api/admin/students")
    async def admin_students(request: Request, group: str = None):
        telegram_id = get_telegram_id(request)
        require_admin(telegram_id)
        students = await get_all_students(conn, group=group)
        result = []
        for s in students:
            progress = await get_student_progress(conn, s["id"])
            result.append({**s, "status": progress["status"]})
        return result

    @app.get("/api/admin/student/{student_id}")
    async def admin_student_detail(student_id: int, request: Request):
        telegram_id = get_telegram_id(request)
        require_admin(telegram_id)
        subs = await get_submissions(conn, student_id)
        return [
            {**s, "answers": json.loads(s["answers"])} for s in subs
        ]

    @app.get("/api/admin/export")
    async def admin_export(request: Request, group: str = None):
        telegram_id = get_telegram_id(request)
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

    # Store bot instance for notifications
    app.state.bot = None

    @app.post("/api/notify-completion")
    async def notify_completion(request: Request):
        telegram_id = get_telegram_id(request)
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
