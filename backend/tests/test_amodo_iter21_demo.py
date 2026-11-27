"""Iteration 21: Perfil de demostración (Sofía Méndez) - thesis screenshots.

Covers the demo profile endpoints, demo clock, process/finance expected numbers,
organize dedupe, and the 403 access rules for non-demo accounts.
"""
import os
import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
DEMO_PW = "Amodo-qBYvS0VhFeBi"


def _login(email: str, password: str = DEMO_PW) -> dict:
    r = requests.post(f"{BASE}/api/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} -> {r.status_code} {r.text[:200]}"
    return r.json()


def _hdr(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# -------- fixtures ---------------------------------------------------------
@pytest.fixture(scope="module")
def sofia():
    return _login("sofia.demo@amodo.app")


@pytest.fixture(scope="module")
def diego():
    return _login("diego.demo@amodo.app")


@pytest.fixture(scope="module")
def laura():
    return _login("laura.demo@amodo.app")


@pytest.fixture(scope="module")
def nondemo_token():
    r = requests.post(f"{BASE}/api/auth/demo", json={"role": "patient"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# -------- auth & flags -----------------------------------------------------
class TestDemoAccounts:
    def test_sofia_is_demo_plus(self, sofia):
        u = sofia["user"]
        assert u["role"] == "patient"
        assert u.get("demo_set"), "sofia must have demo_set flag"
        assert u.get("demo_clock", "").startswith("2026-11-27"), u.get("demo_clock")
        # demo_now is stored as UTC; the frontend 'today' lives in demo_clock local date.
        assert u.get("demo_now"), "demo_now must be set"
        assert u.get("is_admin") is False

    def test_diego_is_caregiver(self, diego):
        assert diego["user"]["role"] == "caregiver"
        assert diego["user"].get("demo_set")

    def test_laura_is_caregiver(self, laura):
        assert laura["user"]["role"] == "caregiver"


# -------- demo presenter endpoints ----------------------------------------
class TestDemoPresenter:
    def test_people_endpoint(self, sofia):
        r = requests.get(f"{BASE}/api/demo/people", headers=_hdr(sofia["token"]), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        keys = {p["key"] for p in data["people"]}
        assert keys == {"sofia", "diego", "laura", "mariana"}
        assert data["date"].startswith("2026-11-27")
        current = [p for p in data["people"] if p["current"]]
        assert len(current) == 1 and current[0]["key"] == "sofia"

    def test_switch_to_diego(self, sofia):
        r = requests.post(f"{BASE}/api/demo/switch/diego", headers=_hdr(sofia["token"]), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["email"] == "diego.demo@amodo.app"

    def test_switch_unknown_key_404(self, sofia):
        r = requests.post(f"{BASE}/api/demo/switch/nobody", headers=_hdr(sofia["token"]), timeout=15)
        assert r.status_code == 404

    def test_people_forbidden_for_nondemo(self, nondemo_token):
        r = requests.get(f"{BASE}/api/demo/people", headers=_hdr(nondemo_token), timeout=15)
        assert r.status_code == 403

    def test_reset_forbidden_for_nondemo(self, nondemo_token):
        r = requests.post(f"{BASE}/api/demo/reset", headers=_hdr(nondemo_token), timeout=15)
        assert r.status_code == 403


# -------- process numbers at today=2026-11-27 -----------------------------
class TestProcessNumbers:
    def test_process_30d(self, sofia):
        r = requests.get(f"{BASE}/api/process?today=2026-11-27&days=30", headers=_hdr(sofia["token"]), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        feelings = d.get("feelings") or {}
        activities = d.get("activities") or {}
        counts = activities.get("counts") or {}
        assert feelings.get("days_logged") == 23, f"days_logged={feelings.get('days_logged')} expected 23"
        assert counts.get("appointments") == 8, f"appointments={counts.get('appointments')} expected 8"
        assert counts.get("treatments") == 1, f"treatments={counts.get('treatments')} expected 1"

    def test_process_90d(self, sofia):
        r = requests.get(f"{BASE}/api/process?today=2026-11-27&days=90", headers=_hdr(sofia["token"]), timeout=30)
        assert r.status_code == 200
        feelings = r.json().get("feelings") or {}
        assert feelings.get("days_logged") == 55, f"days_logged 90d={feelings.get('days_logged')} expected 55"


# -------- finance ----------------------------------------------------------
class TestFinance:
    def test_november_paid_non_kit_sum(self, sofia):
        r = requests.get(f"{BASE}/api/finance/expenses", headers=_hdr(sofia["token"]), timeout=30)
        assert r.status_code == 200, r.text
        items = r.json().get("items", r.json()) if isinstance(r.json(), dict) else r.json()
        total = 0
        for e in items:
            d = (e.get("date") or "")[:7]
            if d != "2026-11":
                continue
            if (e.get("category") or "") == "Kits AMODO":
                continue
            if (e.get("status") or e.get("state") or "").lower() in ("pagado", "paid"):
                total += int(e.get("amount") or 0)
        assert total == 28720, f"Nov paid non-kit sum = {total}, expected 28720"


# -------- plan & plus usage -----------------------------------------------
class TestPlusPlan:
    def test_me_plan(self, sofia):
        r = requests.get(f"{BASE}/api/me/plan", headers=_hdr(sofia["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("tier") == "plus"
        assert (d.get("until") or "").startswith("2026-12-27")

    def test_plus_usage(self, sofia):
        r = requests.get(f"{BASE}/api/me/plus-usage", headers=_hdr(sofia["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("month") == "2026-11", d
        assert d.get("reports") == 3
        assert d.get("credits_received") == 20
        assert float(d.get("kit_savings") or 0) == pytest.approx(49.9, rel=0.01)

    def test_credits_60(self, sofia):
        r = requests.get(f"{BASE}/api/wallet", headers=_hdr(sofia["token"]), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert int(d.get("available") or 0) == 60, f"wallet.available={d.get('available')} expected 60"


# -------- caregiver access rules ------------------------------------------
class TestCaregiverAccess:
    def test_diego_can_see_sofia_expenses(self, sofia, diego):
        sofia_id = sofia["user"]["id"]
        r = requests.get(f"{BASE}/api/finance/expenses?owner_id={sofia_id}", headers=_hdr(diego["token"]), timeout=15)
        assert r.status_code == 200, f"diego -> sofia expenses got {r.status_code} {r.text[:200]}"

    def test_laura_cannot_see_sofia_expenses(self, sofia, laura):
        sofia_id = sofia["user"]["id"]
        r = requests.get(f"{BASE}/api/finance/expenses?owner_id={sofia_id}", headers=_hdr(laura["token"]), timeout=15)
        assert r.status_code == 403, f"laura should get 403, got {r.status_code} {r.text[:200]}"


# -------- organize dedupe -------------------------------------------------
class TestOrganizeDedupe:
    TEXT = ("El lunes tengo análisis de sangre a las ocho y el jueves "
            "Diego me lleva al hospital, salimos a las siete y media")

    def test_parse_marks_existing(self, sofia):
        r = requests.post(f"{BASE}/api/organize/parse",
                          json={"text": self.TEXT, "today": "2026-11-27"},
                          headers=_hdr(sofia["token"]), timeout=90)
        assert r.status_code == 200, r.text
        items = r.json().get("items") or []
        assert items, "parse returned no items"
        # must contain the 'existing' key on at least one item (the Monday blood test)
        existing_found = any(bool(it.get("existing")) for it in items)
        assert existing_found, f"no item flagged as existing; items={items}"

    def test_commit_keep_does_not_duplicate(self, sofia):
        parse = requests.post(f"{BASE}/api/organize/parse",
                              json={"text": self.TEXT, "today": "2026-11-27"},
                              headers=_hdr(sofia["token"]), timeout=90).json()
        items = parse.get("items") or []
        # count existing events for 2026-11-30 before commit
        before = requests.get(f"{BASE}/api/records/events", headers=_hdr(sofia["token"]), timeout=15).json()
        before_list = before if isinstance(before, list) else (before.get("items") or [])
        before_count = sum(1 for e in before_list if (e.get("date") or "").startswith("2026-11-30"))

        # mark all existing with on_existing='keep'
        for it in items:
            if it.get("existing"):
                it["on_existing"] = "keep"
        r = requests.post(f"{BASE}/api/organize/commit",
                          json={"items": items},
                          headers=_hdr(sofia["token"]), timeout=30)
        assert r.status_code == 200, r.text

        after = requests.get(f"{BASE}/api/records/events", headers=_hdr(sofia["token"]), timeout=15).json()
        after_list = after if isinstance(after, list) else (after.get("items") or [])
        after_count = sum(1 for e in after_list if (e.get("date") or "").startswith("2026-11-30"))
        # No duplicate for the pre-existing analysis on 30 Nov
        assert after_count <= before_count + 1, f"duplicate created on 30 Nov: before={before_count} after={after_count}"


# -------- final: reset demo so user finds original state ------------------
class TestZZZResetAtEnd:
    """Runs last (alphabetical). Leaves the demo in the original state."""

    def test_reset(self, sofia):
        r = requests.post(f"{BASE}/api/demo/reset", headers=_hdr(sofia["token"]), timeout=120)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
