import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Load variables from .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set in .env")

# THE FIX: Add pool_pre_ping and pool_recycle for Neon/Serverless DBs
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,      # Tests the connection before using it (fixes the crash)
    pool_recycle=300,        # Recycles connections every 5 minutes
    pool_size=5,             # Maximum number of permanent connections
    max_overflow=10          # Maximum number of temporary connections
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()