import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import uuid
import json
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from database import engine, Base, get_db, SessionLocal
from models import DocumentMeta, DocumentEmbedding, ChatMessage, Reminder, Notification, RoutineCompletion, User
import rag_engine
import llm_client

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Personal AI Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SCHEDULER SETUP ---
scheduler = BackgroundScheduler()


def check_reminders():
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        due_reminders = db.query(Reminder).filter(
            Reminder.reminder_time <= now,
            Reminder.is_sent == False
        ).all()

        for r in due_reminders:
            print(f"REMINDER DUE: {r.user_name} ({r.email}) - {r.task} at {r.reminder_time}")
            r.is_sent = True
        db.commit()
    except Exception as e:
        print(f"Scheduler error: {e}")
        db.rollback()
    finally:
        db.close()


def generate_daily_briefing():
    print("Generating Daily Briefings...")
    db = SessionLocal()
    try:
        users = db.query(User).all()
        now = datetime.utcnow()
        end_of_day = now.replace(hour=23, minute=59, second=59)

        for user in users:
            if not user.system_prompt:
                continue

            todays_reminders = db.query(Reminder).filter(
                or_(
                    Reminder.email == user.email,
                    Reminder.user_name == user.name
                ),
                Reminder.reminder_time >= now,
                Reminder.reminder_time <= end_of_day,
                Reminder.is_sent == False
            ).order_by(Reminder.reminder_time.asc()).all()

            if not todays_reminders:
                message = "You have no specific reminders set for today. Have a great day!"
            else:
                tasks = [f"- {r.task} at {r.reminder_time.strftime('%I:%M %p')} UTC" for r in todays_reminders]
                message = "Here is your schedule for today:\n\n" + "\n".join(tasks)

            new_notification = Notification(
                id=str(uuid.uuid4()),
                user_name=user.name,
                email=user.email,
                title="Good Morning! Here is your Daily Briefing",
                message=message,
                is_read=False
            )
            db.add(new_notification)
        db.commit()
        print("Daily Briefings generated.")
    except Exception as e:
        print(f"Error generating briefing: {e}")
        db.rollback()
    finally:
        db.close()


scheduler.add_job(check_reminders, IntervalTrigger(minutes=1))
scheduler.add_job(generate_daily_briefing, CronTrigger(hour=7, minute=0))
scheduler.start()


@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()


@app.on_event("startup")
def warmup_llm():
    if os.getenv("LLM_PROVIDER", "ollama").lower() != "ollama":
        print("Cloud LLM provider active; skipping local Ollama warmup.")
        return
    try:
        import ollama
        print("Warming up Ollama (llama3.2:3b)...")
        ollama.chat(
            model="llama3.2:3b",
            messages=[{"role": "user", "content": "hi"}],
            options={"keep_alive": "30m"}
        )
        print("Ollama is ready.")
    except Exception as e:
        print(f"Ollama warmup failed: {e}")


# --- HEALTH CHECK ENDPOINT ---
@app.get("/health")
def health_check():
    return {"status": "ok"}


# --- REQUEST MODELS ---
class UserSyncRequest(BaseModel):
    email: str
    name: str


class UserGoalRequest(BaseModel):
    email: str
    primary_goal: str


class QueryRequest(BaseModel):
    question: str
    session_id: str | None = None
    history: list = []
    persona: str = "default"
    user_email: str = ""
    timezone: str = "UTC"


class NoteRequest(BaseModel):
    doc_id: str
    text: str
    user_email: str | None = None


class SaveMessageRequest(BaseModel):
    session_id: str
    role: str
    content: str
    user_email: str | None = None


# --- HELPER FUNCTIONS ---
def build_assistant_system_prompt(user_name: str, primary_goal: str) -> str:
    return (
        f"You are Life Assistant, an intelligent, collaborative personal AI for {user_name}. "
        f"Primary focus/goal: '{primary_goal}'.\n"
        "CAPABILITIES & BEHAVIOR:\n"
        "1. Personal Organization & Reminders: You ARE connected to a live backend system that extracts and saves reminders from chat. "
        "When a user asks to be reminded of something, respond naturally (e.g., 'Done! I will remind you...') without claiming you cannot set reminders.\n"
        "2. Broad Everyday & Technical Help: Beyond routines, schedules, and personal memory, you can answer general everyday questions, "
        "draft messages/documents, explain concepts, brainstorm, and write or debug code cleanly.\n"
        "3. Proportional Depth & Clarity: Answer simple questions directly in the opening sentence without filler. "
        "Use clear headings, bullet points, or well-commented code blocks when explaining multi-step plans or technical solutions.\n"
        "4. Honesty: Do not fabricate real-time live web facts or current events when you do not have live search results."
    )


def extract_and_save_reminder(
    user_name: str,
    text: str,
    user_email: str | None = None,
    user_timezone: str = "UTC"
):
    try:
        tz = ZoneInfo(user_timezone)
    except Exception:
        tz = ZoneInfo("UTC")
        user_timezone = "UTC"

    now_utc = datetime.now(timezone.utc)
    now_local = now_utc.astimezone(tz)

    prompt = f"""You are a reminder extraction engine.
Read the user's message and determine if they are asking for a reminder.
Current user local time ({user_timezone}): {now_local.strftime('%Y-%m-%dT%H:%M:%S')}
Current day: {now_local.strftime('%A')}
Rules:
- If the message contains a reminder request (e.g., "remind me to...", "don't let me forget..."), extract:
  - "task": a short description of what to remember
  - "datetime": the exact date and time in ISO format (YYYY-MM-DDTHH:MM:SS) in the user's local timezone ({user_timezone}).
- If the user only says "today" or "tonight", use today's local date.
- If the user says "tomorrow", use tomorrow's local date.
- If the message is NOT a reminder, return {{"task": null, "datetime": null}}.
Respond ONLY with valid JSON, no explanation, no markdown.
User message: "{text}"
JSON:"""

    try:
        content = llm_client.chat_completion(
            [{"role": "user", "content": prompt}],
            json_mode=True
        )
        parsed = json.loads(content)

        if not parsed.get("task") or not parsed.get("datetime"):
            return None

        local_dt = datetime.fromisoformat(parsed["datetime"])
        if local_dt.tzinfo is None:
            local_dt = local_dt.replace(tzinfo=tz)

        reminder_time_utc = local_dt.astimezone(timezone.utc).replace(tzinfo=None)

        if reminder_time_utc < now_utc.replace(tzinfo=None):
            return None

        db = SessionLocal()
        try:
            new_reminder = Reminder(
                id=str(uuid.uuid4()),
                user_name=user_name,
                email=user_email or None,
                task=parsed["task"],
                reminder_time=reminder_time_utc,
                is_sent=False
            )
            db.add(new_reminder)
            db.commit()
            return local_dt
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    except Exception as e:
        print(f"Reminder extraction failed: {e}")
        return None


def _user_filter(model, user_email: str | None, user_name: str | None):
    conditions = []
    if user_email and hasattr(model, "email"):
        conditions.append(model.email == user_email)
    if user_email and hasattr(model, "user_email"):
        conditions.append(model.user_email == user_email)
    if user_name and hasattr(model, "user_name"):
        conditions.append(model.user_name == user_name)
    if not conditions:
        return None
    return or_(*conditions)


# --- AUTH ENDPOINTS ---
@app.post("/api/auth/sync")
def sync_user(data: UserSyncRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user:
        user = User(email=data.email, name=data.name)
        db.add(user)
        db.commit()
        db.refresh(user)
    elif data.name and user.name != data.name:
        user.name = data.name
        db.commit()
        db.refresh(user)

    return {
        "status": "success",
        "has_goal": bool(user.primary_goal),
        "primary_goal": user.primary_goal,
        "name": user.name,
    }


@app.post("/api/auth/goal")
def set_user_goal(data: UserGoalRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if user:
        user.primary_goal = data.primary_goal
        user.system_prompt = build_assistant_system_prompt(user.name, data.primary_goal)
        db.commit()
        return {"status": "success", "primary_goal": user.primary_goal}
    raise HTTPException(status_code=404, detail="User not found")


# --- MEMORY & UPLOAD ENDPOINTS ---
@app.get("/api/notes")
def get_notes(
    user_email: str | None = Query(default=None),
    db: Session = Depends(get_db)
):
    query = db.query(DocumentMeta)
    if user_email:
        query = query.filter(DocumentMeta.user_email == user_email)
    docs = query.order_by(DocumentMeta.uploaded_at.desc()).all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "content_snippet": d.content_snippet,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
        }
        for d in docs
    ]


@app.delete("/api/notes/{doc_id}")
def delete_note(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentMeta).filter(DocumentMeta.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Memory item not found")

    db.query(DocumentEmbedding).filter(DocumentEmbedding.id == doc_id).delete()
    db.delete(doc)
    db.commit()
    return {"status": "success"}


@app.post("/api/notes")
def add_note(note: NoteRequest, db: Session = Depends(get_db)):
    rag_engine.store_vector(note.doc_id, note.text, user_email=note.user_email)
    doc_entry = DocumentMeta(
        id=note.doc_id,
        user_email=note.user_email,
        filename="Manual Note",
        content_snippet=note.text[:200]
    )
    db.add(doc_entry)
    db.commit()
    return {"status": "success", "id": note.doc_id}


@app.post("/api/upload")
async def upload_document(
    file: UploadFile = File(...),
    user_email: str | None = Form(default=None),
    db: Session = Depends(get_db)
):
    contents = await file.read()
    text = contents.decode("utf-8")
    doc_id = f"doc_{file.filename}_{int(datetime.utcnow().timestamp())}"

    rag_engine.store_vector(doc_id, text, user_email=user_email)
    doc_entry = DocumentMeta(
        id=doc_id,
        user_email=user_email,
        filename=file.filename,
        content_snippet=text[:200]
    )
    db.add(doc_entry)
    db.commit()

    return {"status": "success", "filename": file.filename, "id": doc_id}


# --- CHAT HISTORY ENDPOINTS ---
@app.get("/api/chats")
def get_chat_sessions(
    user_email: str | None = Query(default=None),
    db: Session = Depends(get_db)
):
    try:
        base_query = db.query(
            ChatMessage.session_id,
            func.max(ChatMessage.created_at).label("last_active")
        )
        if user_email:
            base_query = base_query.filter(ChatMessage.user_email == user_email)

        sessions = (
            base_query
            .group_by(ChatMessage.session_id)
            .order_by(func.max(ChatMessage.created_at).desc())
            .all()
        )

        output = []
        for s in sessions:
            first_msg = (
                db.query(ChatMessage)
                .filter(ChatMessage.session_id == s.session_id)
                .order_by(ChatMessage.created_at.asc())
                .first()
            )
            title = (first_msg.title if first_msg and first_msg.title else None) or f"Chat {s.session_id[:6]}"
            output.append({
                "session_id": s.session_id,
                "created_at": s.last_active,
                "title": title
            })
        return output
    except Exception as e:
        print(f"Database error in /api/chats: {e}")
        return []


@app.get("/api/chats/{session_id}")
def get_session_messages(
    session_id: str,
    user_email: str | None = Query(default=None),
    db: Session = Depends(get_db)
):
    query = db.query(ChatMessage).filter(ChatMessage.session_id == session_id)
    if user_email:
        query = query.filter(or_(ChatMessage.user_email == user_email, ChatMessage.user_email.is_(None)))
    messages = query.order_by(ChatMessage.created_at.asc()).all()
    return [{"role": m.role, "content": m.content} for m in messages]


@app.post("/api/chats/message")
def save_message(data: SaveMessageRequest, db: Session = Depends(get_db)):
    msg = ChatMessage(
        id=str(uuid.uuid4()),
        session_id=data.session_id,
        user_email=data.user_email,
        role=data.role,
        content=data.content
    )
    db.add(msg)
    db.commit()
    return {"status": "success"}


# --- REMINDERS & NOTIFICATIONS ENDPOINTS ---
@app.get("/api/reminders/due")
def get_due_reminders(
    user_name: str | None = Query(default=None),
    user_email: str | None = Query(default=None),
    db: Session = Depends(get_db)
):
    five_mins_ago = datetime.utcnow() - timedelta(minutes=5)
    now = datetime.utcnow()

    query = db.query(Reminder).filter(
        Reminder.reminder_time >= five_mins_ago,
        Reminder.reminder_time <= now,
        Reminder.is_sent == False
    )
    flt = _user_filter(Reminder, user_email, user_name)
    if flt is not None:
        query = query.filter(flt)

    reminders = query.all()
    for r in reminders:
        r.is_sent = True
    db.commit()

    return [{"id": r.id, "task": r.task, "time": r.reminder_time.isoformat() + "Z"} for r in reminders]


@app.get("/api/reminders")
def get_all_reminders(
    user_name: str | None = Query(default=None),
    user_email: str | None = Query(default=None),
    db: Session = Depends(get_db)
):
    time_threshold = datetime.utcnow() - timedelta(minutes=5)
    query = db.query(Reminder).filter(Reminder.reminder_time >= time_threshold)

    flt = _user_filter(Reminder, user_email, user_name)
    if flt is not None:
        query = query.filter(flt)

    reminders = query.order_by(Reminder.reminder_time.asc()).all()

    return [
        {
            "id": r.id,
            "task": r.task,
            "time": r.reminder_time.isoformat() + "Z",
            "is_sent": r.is_sent
        } for r in reminders
    ]


@app.delete("/api/reminders/{reminder_id}")
def delete_reminder(reminder_id: str, db: Session = Depends(get_db)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    db.delete(reminder)
    db.commit()
    return {"status": "success"}


@app.post("/api/reminders/{reminder_id}/complete")
def complete_reminder(reminder_id: str, db: Session = Depends(get_db)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    existing = db.query(RoutineCompletion).filter(RoutineCompletion.reminder_id == reminder_id).first()
    if existing:
        return {"status": "already_completed"}

    completion = RoutineCompletion(
        id=str(uuid.uuid4()),
        reminder_id=reminder.id,
        user_name=reminder.user_name,
        email=reminder.email,
        task=reminder.task
    )
    db.add(completion)
    db.commit()
    return {"status": "success"}


@app.get("/api/notifications")
def get_notifications(
    user_name: str | None = Query(default=None),
    user_email: str | None = Query(default=None),
    db: Session = Depends(get_db)
):
    query = db.query(Notification).filter(Notification.is_read == False)
    flt = _user_filter(Notification, user_email, user_name)
    if flt is not None:
        query = query.filter(flt)

    notifications = query.order_by(Notification.created_at.desc()).limit(5).all()

    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "created_at": n.created_at.isoformat() + "Z"
        } for n in notifications
    ]


@app.post("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: str, db: Session = Depends(get_db)):
    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"status": "success"}


@app.post("/api/test-briefing")
def test_briefing():
    generate_daily_briefing()
    return {"status": "Briefing generated"}


# --- STREAMING CHAT ENDPOINT ---
@app.post("/api/chat")
def chat(request: QueryRequest, db: Session = Depends(get_db)):
    try:
        is_new_session = not request.session_id
        session_id = request.session_id or str(uuid.uuid4())

        user = db.query(User).filter(User.email == request.user_email).first() if request.user_email else None
        user_name = user.name if user else "User"
        recent_history = request.history[-12:] if request.history else []

        def event_generator():
            full_answer = ""
            try:
                for token in rag_engine.stream_chat_response(
                    request.question,
                    recent_history,
                    request.persona,
                    request.user_email
                ):
                    full_answer += token
                    yield f"data: {json.dumps({'token': token})}\n\n"

                reminder_note = ""
                try:
                    local_reminder_time = extract_and_save_reminder(
                        user_name,
                        request.question,
                        user_email=request.user_email or None,
                        user_timezone=request.timezone or "UTC"
                    )
                    if local_reminder_time:
                        reminder_note = f"\n\n*(I've set a reminder for {local_reminder_time.strftime('%A, %b %d at %I:%M %p')}.)*"
                        yield f"data: {json.dumps({'token': reminder_note})}\n\n"
                except Exception as e:
                    print(f"Reminder extraction failed: {e}")

                session_title = None
                if is_new_session:
                    try:
                        title_content = llm_client.chat_completion([
                            {"role": "system", "content": "Generate a concise, 3 to 5-word title. No quotes, markdown, or punctuation."},
                            {"role": "user", "content": request.question}
                        ])
                        session_title = title_content.strip().strip('"')
                    except Exception:
                        session_title = request.question[:30] + "..."

                db_session = SessionLocal()
                try:
                    db_session.add(ChatMessage(
                        id=str(uuid.uuid4()),
                        session_id=session_id,
                        user_email=request.user_email or None,
                        role="user",
                        content=request.question,
                        title=session_title
                    ))
                    db_session.add(ChatMessage(
                        id=str(uuid.uuid4()),
                        session_id=session_id,
                        user_email=request.user_email or None,
                        role="assistant",
                        content=full_answer + reminder_note
                    ))
                    db_session.commit()
                except Exception as e:
                    print(f"DB Save Error: {e}")
                    db_session.rollback()
                finally:
                    db_session.close()

                yield f"data: {json.dumps({'session_id': session_id})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"

            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))