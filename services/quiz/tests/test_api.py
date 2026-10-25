from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)

def test_health_and_questions():
    assert client.get("/health").json()["status"] == "ok"
    response = client.get("/questions?limit=5")
    assert response.status_code == 200
    assert response.json()["count"] == 5
    assert "correct_index" not in response.json()["questions"][0]

def test_grade_correct_answer():
    q = client.get("/questions?limit=1").json()["questions"][0]
    # Question 1 answer is known from the original bank; API never exposes key through GET.
    response = client.post("/grade", json={"answers": [{"question_id": "aws-001", "selected_index": 0}]})
    assert response.status_code == 200
    assert response.json()["correct"] == 1

def test_invalid_domain():
    assert client.get("/questions?domain=not-a-domain").status_code == 400

def test_exam_generation():
    response = client.post("/exams", json={"limit": 10, "mode": "exam"})
    assert response.status_code == 200
    assert response.json()["question_count"] == 10
    assert response.json()["time_limit_minutes"] == 90
