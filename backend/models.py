from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey
from datetime import datetime
from pgvector.sqlalchemy import Vector
from database import Base


class DocumentMeta(Base):
    __tablename__ = "documents"
    id = Column(String, primary_key=True)
    user_email = Column(String, nullable=True, index=True)
    filename = Column(String, nullable=False)
    content_snippet = Column(Text, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


class ChatMessage(Base):
    __tablename__ = "chat_history"
    id = Column(String, primary_key=True)
    session_id = Column(String, index=True, nullable=False)
    user_email = Column(String, nullable=True, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    title = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Reminder(Base):
    __tablename__ = "reminders"
    id = Column(String, primary_key=True)
    user_name = Column(String, nullable=False, index=True)
    email = Column(String, nullable=True, index=True)
    task = Column(String, nullable=False)
    reminder_time = Column(DateTime, nullable=False, index=True)
    is_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class DocumentEmbedding(Base):
    __tablename__ = "document_embeddings"
    id = Column(String, primary_key=True)
    user_email = Column(String, nullable=True, index=True)
    content = Column(Text, nullable=False)
    embedding = Column(Vector(768), nullable=False)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True)
    user_name = Column(String, nullable=False, index=True)
    email = Column(String, nullable=True, index=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class RoutineCompletion(Base):
    __tablename__ = "routine_completions"
    id = Column(String, primary_key=True)
    reminder_id = Column(String, ForeignKey("reminders.id", ondelete="SET NULL"), nullable=True)
    user_name = Column(String, nullable=False, index=True)
    email = Column(String, nullable=True, index=True)
    task = Column(String, nullable=False)
    completed_at = Column(DateTime, default=datetime.utcnow)


class User(Base):
    __tablename__ = "users"
    email = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    primary_goal = Column(String, nullable=True)
    system_prompt = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)