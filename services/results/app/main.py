import os
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Integer, String, DateTime, Float, select, desc
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./results.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
class Base(DeclarativeBase): pass
class Result(Base):
    __tablename__ = "exam_results"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    exam_id: Mapped[str] = mapped_column(String(80), index=True)
    mode: Mapped[str] = mapped_column(String(20), default="practice")
    total: Mapped[int] = mapped_column(Integer)
    correct: Mapped[int] = mapped_column(Integer)
    score_percent: Mapped[float] = mapped_column(Float)
    passed: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AWS Practice Exam — Results Service", version="1.0.0",
              description="Persists and lists practice exam results.")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:8080").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                   allow_methods=["GET", "POST"], allow_headers=["*"])

class ResultCreate(BaseModel):
    exam_id: str = Field(min_length=1, max_length=80)
    mode: str = Field(default="practice", pattern="^(practice|exam)$")
    total: int = Field(ge=1, le=30)
    correct: int = Field(ge=0, le=30)
    score_percent: float = Field(ge=0, le=100)
    passed: bool

def serialize(row):
    return {"id": row.id, "exam_id": row.exam_id, "mode": row.mode,
            "total": row.total, "correct": row.correct, "score_percent": row.score_percent,
            "passed": row.passed, "created_at": row.created_at.isoformat() if row.created_at else None}

@app.get("/health")
def health():
    try:
        with engine.connect() as conn:
            conn.exec_driver_sql("SELECT 1")
        return {"status": "ok", "service": "results-service", "database": "ok"}
    except Exception as exc:
        raise HTTPException(503, "Database unavailable") from exc

@app.post("/")
def create_result(payload: ResultCreate):
    if payload.correct > payload.total:
        raise HTTPException(422, "correct cannot exceed total")
    expected_percent = round(payload.correct / payload.total * 100, 1)
    if abs(expected_percent - payload.score_percent) > 0.2:
        raise HTTPException(422, "score_percent does not match correct/total")
    row = Result(**payload.model_dump())
    with SessionLocal() as session:
        session.add(row)
        session.commit()
        session.refresh(row)
        return serialize(row)

@app.get("/")
def list_results(limit: int = Query(default=20, ge=1, le=100)):
    with SessionLocal() as session:
        rows = session.scalars(select(Result).order_by(desc(Result.created_at), desc(Result.id)).limit(limit)).all()
        return {"count": len(rows), "results": [serialize(row) for row in rows]}
