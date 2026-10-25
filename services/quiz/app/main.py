import json, os, random
from pathlib import Path
from typing import Literal
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="AWS Practice Exam — Quiz Service", version="1.0.0",
              description="Question bank, exam generation and answer grading.")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:8080").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False,
                   allow_methods=["GET", "POST"], allow_headers=["*"])
BANK_PATH = Path(__file__).with_name("question_bank.json")
with BANK_PATH.open(encoding="utf-8") as f:
    BANK = json.load(f)
BY_ID = {q["id"]: q for q in BANK}
DOMAINS = {"cloud-technology", "security", "billing"}

class ExamRequest(BaseModel):
    limit: int = Field(default=20, ge=1, le=30)
    domain: str | None = None
    mode: Literal["practice", "exam"] = "practice"
    shuffle: bool = True

class Answer(BaseModel):
    question_id: str
    selected_index: int = Field(ge=0, le=10)

class GradeRequest(BaseModel):
    answers: list[Answer] = Field(min_length=1, max_length=30)

def public_question(q):
    return {k: q[k] for k in ("id", "question", "options", "domain")}

@app.get("/health")
def health():
    return {"status": "ok", "service": "quiz-service", "question_count": len(BANK)}

@app.get("/questions")
def questions(limit: int = Query(default=30, ge=1, le=30), domain: str | None = None):
    selected = BANK
    if domain:
        if domain not in DOMAINS:
            raise HTTPException(400, f"Unknown domain. Choose one of: {', '.join(sorted(DOMAINS))}")
        selected = [q for q in BANK if q["domain"] == domain]
    return {"count": min(limit, len(selected)), "total_available": len(selected),
            "questions": [public_question(q) for q in selected[:limit]]}

@app.post("/exams")
def create_exam(payload: ExamRequest):
    selected = [q for q in BANK if not payload.domain or q["domain"] == payload.domain]
    if payload.domain and payload.domain not in DOMAINS:
        raise HTTPException(400, "Unknown domain")
    if not selected:
        raise HTTPException(404, "No questions available for selected domain")
    if payload.shuffle:
        selected = random.sample(selected, k=min(payload.limit, len(selected)))
    else:
        selected = selected[:payload.limit]
    return {"exam_id": f"practice-{random.randrange(100000, 999999)}",
            "mode": payload.mode, "question_count": len(selected),
            "time_limit_minutes": 90 if payload.mode == "exam" else None,
            "questions": [public_question(q) for q in selected]}

@app.post("/grade")
def grade(payload: GradeRequest):
    seen = set()
    results = []
    correct_count = 0
    for answer in payload.answers:
        if answer.question_id in seen:
            raise HTTPException(422, f"Duplicate answer for {answer.question_id}")
        seen.add(answer.question_id)
        q = BY_ID.get(answer.question_id)
        if not q:
            raise HTTPException(422, f"Unknown question id: {answer.question_id}")
        if answer.selected_index >= len(q["options"]):
            raise HTTPException(422, f"Invalid option for {answer.question_id}")
        is_correct = answer.selected_index == q["correct_index"]
        correct_count += int(is_correct)
        results.append({"question_id": q["id"], "selected_index": answer.selected_index,
                        "correct_index": q["correct_index"], "is_correct": is_correct,
                        "explanation": q["explanation"], "correct_answer": q["options"][q["correct_index"]]})
    total = len(results)
    return {"total": total, "correct": correct_count, "incorrect": total-correct_count,
            "score_percent": round(correct_count / total * 100, 1),
            "passed": correct_count / total >= 0.70, "results": results}
