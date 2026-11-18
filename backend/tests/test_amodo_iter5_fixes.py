# AMODO iteration 5: retest of iteration-4 fixes (pending validation, treatment type persistence, reco explain reasons)
import os
import re
import uuid
from datetime import date, timedelta
import pytest
import requests


def _base():
    url = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("EXPO_PUBLIC_BACKEND_URL=") or line.startswith("EXPO_BACKEND_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
    return url.rstrip("/")


BASE = _base() + "/api"
T = date.today().isoformat()


def H(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def tok():
    r = requests.post(f"{BASE}/auth/login", json={"email": "demo@amodo.app", "password": "Demo1234"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


# Pending: invalid today -> 422
class TestPendingValidation:
    def test_pending_invalid_today_422(self, tok):
        r = requests.get(f"{BASE}/pending", params={"today": "xx"}, headers=H(tok))
        assert r.status_code == 422, r.text

    def test_pending_valid_today_200(self, tok):
        r = requests.get(f"{BASE}/pending", params={"today": T}, headers=H(tok))
        assert r.status_code == 200
        assert isinstance(r.json(), (list, dict))


# Treatments: custom name + type persists via PUT (as record-form sends it)
class TestTreatmentTypePersist:
    def test_custom_name_with_type_persists(self, tok):
        name = f"TEST_Radio_{uuid.uuid4().hex[:5]}"
        start = (date.today() + timedelta(days=3)).isoformat()
        r = requests.post(f"{BASE}/treatments/plan", headers=H(tok), json={
            "name": name, "treatment_type": "Radioterapia", "start_date": start, "time": "09:00",
            "interval_days": 7, "weekdays": [], "sessions_count": 1, "location": "", "notes": "",
            "sessions": [{"date": start, "time": "09:00"}], "shared_with": []})
        assert r.status_code == 200, r.text
        body = r.json()
        tid = body.get("treatment_id") or (body.get("treatment") or {}).get("id")
        assert tid, body
        try:
            g = requests.get(f"{BASE}/records/treatments/{tid}", headers=H(tok)).json()
            assert g["treatment_type"] == "Radioterapia" and g["name"] == name
            # Same body record-form sends when editing (type chip Radioterapia + custom name)
            u = requests.put(f"{BASE}/records/treatments/{tid}", headers=H(tok), json={"name": name, "treatment_type": "Radioterapia", "notes": "edit"})
            assert u.status_code == 200, u.text
            g = requests.get(f"{BASE}/records/treatments/{tid}", headers=H(tok)).json()
            assert g["treatment_type"] == "Radioterapia" and g["name"] == name and g.get("notes") == "edit"
        finally:
            evs = requests.get(f"{BASE}/records/events", headers=H(tok)).json()
            for e in evs if isinstance(evs, list) else []:
                if e.get("treatment_id") == tid:
                    requests.delete(f"{BASE}/records/events/{e['id']}", headers=H(tok))
            requests.delete(f"{BASE}/records/treatments/{tid}", headers=H(tok))


# Recommendations: next-appointment reason once, friendly date, correct type label
class TestRecoReasons:
    def test_explain_reasons(self, tok):
        r = requests.get(f"{BASE}/recommendations", params={"today": T}, headers=H(tok))
        assert r.status_code == 200, r.text
        data = r.json()
        items = data.get("items") or data.get("products") or (data if isinstance(data, list) else [])
        assert items, data
        for p in items[:8]:
            reasons = p.get("reasons") or []
            prox = [x for x in reasons if "llevar" in x]
            assert len(prox) <= 1, reasons
            for x in reasons:
                assert not re.search(r"\d{4}-\d{2}-\d{2}", x), x
            for d in p.get("reason_details") or []:
                if "Registraste" in d["text"]:
                    assert d["type"] == "proxima", d

    def test_needs_no_otro_shape(self, tok):
        r = requests.get(f"{BASE}/recommendations/needs", headers=H(tok))
        assert r.status_code == 200
        assert {"treatments", "needs", "asked"} <= set(r.json())
