from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)

def test_health():
    assert client.get("/health").json()["status"] == "ok"

def test_create_and_list_result():
    payload = {"exam_id":"test-123", "mode":"practice", "total":10, "correct":8,
               "score_percent":80.0, "passed":True}
    created = client.post("/", json=payload)
    assert created.status_code == 200
    assert created.json()["score_percent"] == 80.0
    listed = client.get("/?limit=5")
    assert listed.status_code == 200
    assert listed.json()["count"] >= 1

def test_invalid_score_rejected():
    payload = {"exam_id":"test-124", "mode":"exam", "total":10, "correct":8,
               "score_percent":30.0, "passed":True}
    assert client.post("/", json=payload).status_code == 422
