"""Iteration 16: Mi proceso + PDF reports (Plus-only) backend tests."""
import os
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
assert BASE, "EXPO_PUBLIC_BACKEND_URL must be set"

TODAY = datetime.now(timezone.utc).date().isoformat()


def _demo_token(role: str) -> str:
    r = requests.post(f"{BASE}/api/auth/demo", json={"role": role}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def patient():
    return _demo_token("patient")


@pytest.fixture(scope="module")
def caregiver():
    return _demo_token("caregiver")


# ---------- Ensure demo patient is Plus for Plus-gated tests ----------
@pytest.fixture(scope="module", autouse=True)
def ensure_plus(patient):
    r = requests.post(f"{BASE}/api/me/plus/activate", headers=_h(patient), timeout=20)
    # 200 when toggled, may be already active (200). Accept 200/400.
    assert r.status_code in (200, 400), r.text
    yield
    # Leave demo Plus (per request). Do nothing on teardown.


# ---------- GET /api/process ----------
class TestProcessEndpoint:
    def test_requires_auth(self):
        r = requests.get(f"{BASE}/api/process", params={"today": TODAY, "days": 7}, timeout=20)
        assert r.status_code in (401, 403)

    def test_invalid_days_returns_422(self, patient):
        r = requests.get(f"{BASE}/api/process", params={"today": TODAY, "days": 15}, headers=_h(patient), timeout=20)
        assert r.status_code == 422, r.text

    def test_invalid_today_returns_422(self, patient):
        r = requests.get(f"{BASE}/api/process", params={"today": "bad-date", "days": 7}, headers=_h(patient), timeout=20)
        assert r.status_code == 422, r.text

    @pytest.mark.parametrize("days", [7, 30, 90])
    def test_valid_days_structure(self, patient, days):
        r = requests.get(f"{BASE}/api/process", params={"today": TODAY, "days": days}, headers=_h(patient), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        # Required keys
        for k in ("daily", "activities", "tasks", "feelings", "medications", "expenses", "weeks", "plus", "period", "start", "end"):
            assert k in d, f"Missing {k}"
        assert isinstance(d["daily"], list) and len(d["daily"]) == days
        # Each daily entry has required fields
        sample = d["daily"][0]
        for k in ("date", "moods", "note", "energy", "journal_id", "events", "doses_done", "doses_skipped", "spent", "tasks_done"):
            assert k in sample, f"Daily missing {k}"
        # activities.counts present
        assert "counts" in d["activities"]
        # tasks has done/open
        assert "done" in d["tasks"] and "open" in d["tasks"]

    def test_plus_has_compare(self, patient):
        r = requests.get(f"{BASE}/api/process", params={"today": TODAY, "days": 7}, headers=_h(patient), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["plus"] is True
        assert "compare" in d and "now" in d["compare"] and "before" in d["compare"]

    def test_non_plus_no_compare(self, caregiver):
        # caregiver is Gratis (per test_credentials.md). Just verify no compare.
        r = requests.get(f"{BASE}/api/process", params={"today": TODAY, "days": 7}, headers=_h(caregiver), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["plus"] is False
        assert "compare" not in d


# ---------- Real-data roundtrip: create a journal + event + expense for today ----------
class TestProcessReflectsRealData:
    created = []

    def _create(self, kind, payload, patient):
        r = requests.post(f"{BASE}/api/records/{kind}", headers=_h(patient), json=payload, timeout=20)
        assert r.status_code in (200, 201), f"{kind} create failed: {r.status_code} {r.text}"
        rid = r.json().get("id")
        assert rid
        self.created.append((kind, rid))
        return r.json()

    def test_roundtrip(self, patient):
        # Baseline
        r0 = requests.get(f"{BASE}/api/process", params={"today": TODAY, "days": 7}, headers=_h(patient), timeout=30).json()
        base_total_act = r0["activities"]["total"]
        base_feel_days = r0["feelings"]["days_logged"]
        base_spent = r0["expenses"]["total"]

        # Create journal (feeling)
        journal = self._create("journal", {"date": TODAY, "moods": ["En calma"], "mood_note": "TEST_PROCESS_JOURNAL"}, patient)
        # Create event today
        event = self._create("events", {"date": TODAY, "time": "10:00", "title": "TEST_PROCESS_EVENT", "type": "Consulta"}, patient)
        # Create expense today
        expense = self._create("expenses", {"date": TODAY, "amount": 123.45, "category": "TEST_cat", "status": "Pagado", "title": "TEST_PROCESS_EXP"}, patient)

        # Verify
        r1 = requests.get(f"{BASE}/api/process", params={"today": TODAY, "days": 7}, headers=_h(patient), timeout=30).json()
        today_entry = next((d for d in r1["daily"] if d["date"] == TODAY), None)
        assert today_entry is not None
        assert "En calma" in today_entry["moods"], f"mood not reflected: {today_entry['moods']}"
        assert any(e["id"] == event["id"] for e in today_entry["events"]), "event missing in daily"
        assert today_entry["spent"] >= 123.45, f"spent not reflected: {today_entry['spent']}"
        assert r1["activities"]["total"] >= base_total_act + 1
        assert r1["feelings"]["days_logged"] >= max(base_feel_days, 1)
        assert r1["expenses"]["total"] >= base_spent + 123.45 - 0.01

        # Delete and verify disappears
        for kind, rid in list(self.created):
            dr = requests.delete(f"{BASE}/api/records/{kind}/{rid}", headers=_h(patient), timeout=20)
            assert dr.status_code in (200, 204), f"delete {kind} failed: {dr.status_code}"
            self.created.remove((kind, rid))

        r2 = requests.get(f"{BASE}/api/process", params={"today": TODAY, "days": 7}, headers=_h(patient), timeout=30).json()
        today_entry2 = next((d for d in r2["daily"] if d["date"] == TODAY), None)
        assert not any(e["id"] == event["id"] for e in today_entry2["events"]), "event still present after delete"

    def teardown_method(self):
        pass


# ---------- Reports ----------
class TestReports:
    def test_non_plus_cannot_create(self, caregiver):
        r = requests.post(f"{BASE}/api/process/reports", headers=_h(caregiver), json={
            "today": TODAY, "days": 7, "sections": ["feelings"], "include_name": True
        }, timeout=20)
        assert r.status_code == 403, r.text

    def test_empty_sections_422(self, patient):
        r = requests.post(f"{BASE}/api/process/reports", headers=_h(patient), json={
            "today": TODAY, "days": 7, "sections": [], "include_name": True
        }, timeout=20)
        assert r.status_code == 422

    def test_start_after_end_422(self, patient):
        r = requests.post(f"{BASE}/api/process/reports", headers=_h(patient), json={
            "today": TODAY, "start": TODAY, "end": "2020-01-01",
            "sections": ["feelings"], "include_name": True
        }, timeout=20)
        assert r.status_code == 422

    def test_range_over_366_days_422(self, patient):
        start = (datetime.strptime(TODAY, "%Y-%m-%d") - timedelta(days=400)).date().isoformat()
        r = requests.post(f"{BASE}/api/process/reports", headers=_h(patient), json={
            "today": TODAY, "start": start, "end": TODAY,
            "sections": ["feelings"], "include_name": True
        }, timeout=20)
        assert r.status_code == 422

    def test_create_and_download(self, patient):
        r = requests.post(f"{BASE}/api/process/reports", headers=_h(patient), json={
            "today": TODAY, "days": 30,
            "sections": ["feelings", "medications", "expenses", "notes"],
            "include_name": True
        }, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "id" in body and "period" in body and "path" in body
        assert body["path"].startswith("/api/process-download/")
        # GET path with NO auth
        dl = requests.get(f"{BASE}{body['path']}", timeout=30)
        assert dl.status_code == 200
        assert dl.headers.get("content-type", "").startswith("application/pdf")
        assert dl.content.startswith(b"%PDF"), f"Not a PDF: {dl.content[:20]!r}"
        return body["id"]

    def test_list_reports_own_only(self, patient, caregiver):
        # patient creates one
        rc = requests.post(f"{BASE}/api/process/reports", headers=_h(patient), json={
            "today": TODAY, "days": 7, "sections": ["feelings"], "include_name": False
        }, timeout=30)
        assert rc.status_code == 200, rc.text
        rid = rc.json()["id"]
        lst = requests.get(f"{BASE}/api/process/reports", headers=_h(patient), timeout=20).json()
        assert any(r["id"] == rid for r in lst)
        # caregiver should not see patient's reports
        lst2 = requests.get(f"{BASE}/api/process/reports", headers=_h(caregiver), timeout=20).json()
        assert all(r["id"] != rid for r in lst2)

    def test_regenerate_link(self, patient):
        rc = requests.post(f"{BASE}/api/process/reports", headers=_h(patient), json={
            "today": TODAY, "days": 7, "sections": ["feelings"], "include_name": False
        }, timeout=30).json()
        rid = rc["id"]
        old_path = rc["path"]
        r = requests.post(f"{BASE}/api/process/reports/{rid}/link", headers=_h(patient), timeout=20)
        assert r.status_code == 200
        new_path = r.json()["path"]
        assert new_path.startswith("/api/process-download/")
        assert new_path != old_path

    def test_link_other_user_report_404(self, patient, caregiver):
        # Need a Plus caregiver? Caregiver is non-plus so will 403. Instead: create by patient and let caregiver (as different user) try.
        # But require_plus will 403 the caregiver first. Use another patient? demo patient is the only Plus user.
        # Test with Plus patient using an unknown rid -> 404.
        r = requests.post(f"{BASE}/api/process/reports/nonexistent-id-zzz/link", headers=_h(patient), timeout=20)
        assert r.status_code == 404

    def test_invalid_download_code_404(self):
        r = requests.get(f"{BASE}/api/process-download/invalid_code_zzz_123", timeout=20)
        assert r.status_code == 404

    def test_old_pdf_link_endpoint_removed(self, patient):
        r = requests.post(f"{BASE}/api/process/pdf-link", headers=_h(patient), json={"today": TODAY, "days": 7}, timeout=20)
        assert r.status_code in (404, 405), f"Old endpoint still responds: {r.status_code}"


# ---------- Privacy: caregiver doesn't see patient data via /api/process ----------
class TestPrivacy:
    def test_caregiver_gets_own_data_only(self, caregiver, patient):
        # Create a journal entry on patient account
        pc = requests.post(f"{BASE}/api/records/journal", headers=_h(patient), json={
            "date": TODAY, "moods": ["Con energía"], "mood_note": "TEST_PRIV_JOURNAL"
        }, timeout=20)
        assert pc.status_code in (200, 201)
        jid = pc.json()["id"]
        try:
            # Caregiver GET /api/process should not include patient's note
            cg = requests.get(f"{BASE}/api/process", params={"today": TODAY, "days": 7}, headers=_h(caregiver), timeout=20).json()
            all_notes = " ".join(n.get("text", "") for n in cg["feelings"]["notes"])
            assert "TEST_PRIV_JOURNAL" not in all_notes
        finally:
            requests.delete(f"{BASE}/api/records/journal/{jid}", headers=_h(patient), timeout=20)
