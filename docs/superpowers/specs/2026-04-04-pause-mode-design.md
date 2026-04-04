# Pause Mode — Design Spec

## Problem
Instructor needs to block new students from starting the practice while allowing existing students to finish their work and view answers.

## Behavior

| State | New user (not registered) | Registered user |
|-------|--------------------------|-----------------|
| Paused | "Время на сдачу практики закончено" | Normal flow (finish steps, view answers) |
| Active | Normal flow | Normal flow |

## Implementation

### 1. DB: `settings` table
```sql
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```
Key: `paused`, values: `"true"` / `"false"`.

### 2. Bot commands (admin only)
- `/pause` — sets `paused=true`, replies with confirmation
- `/resume` — sets `paused=false`, replies with confirmation

### 3. API endpoint
`GET /api/status` — no auth required, returns `{"paused": true/false}`.

### 4. Frontend (Mini App + Web)
On page load, fetch `/api/status`. If `paused=true`:
- Try to load student profile (`/api/student`)
- If 404 (not registered) — show blocking screen "Время на сдачу практики закончено"
- If student exists — proceed normally

### Data safety
- No existing tables modified
- No DELETE/UPDATE on student data
- Only INSERT into new `settings` table
