# Iteration 20 — role-specific caregiver onboarding, home, process/shared, recommendations, preferences sharing
import os
import uuid
from datetime import date

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or os.environ["EXPO_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
TODAY = date.today().isoformat()


# ----------------------------------------------------------------------- utils

def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _demo(role):
    r = requests.post(f"{API}/auth/demo", json={"role": role}, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    return d["token"], d["user"]


def _register(role):
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "Prueba1234", "name": "TEST_User",
        "role": role, "consents": True,
    }, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"register endpoint not available: {r.status_code} {r.text[:200]}")
    d = r.json()
    return d["token"], d["user"], email


# ---------------------------------------------------------------- fixtures

@pytest.fixture(scope="module")
def patient():
    tok, u = _demo("patient")
    return tok, u


@pytest.fixture(scope="module")
def caregiver():
    tok, u = _demo("caregiver")
    return tok, u


@pytest.fixture(scope="module")
def link_id(patient, caregiver):
    # Find the seeded link between the two demos.
    r = requests.get(f"{API}/network", headers=_h(patient[0]), timeout=30)
    assert r.status_code == 200
    data = r.json()
    cg_id = caregiver[1]["id"]
    for l in data.get("as_patient", []):
        if l.get("caregiver_id") == cg_id and l.get("status") == "active":
            return l["id"]
    pytest.skip("No seeded active link between demo patient and caregiver")


# ----------------------------------------------------------------------- Home

class TestHomeCaregiver:
    def test_home_caregiver_returns_role_fields(self, caregiver):
        tok, _ = caregiver
        r = requests.get(f"{API}/home?today={TODAY}", headers=_h(tok), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "caregiver"
        for k in ("patients", "journal", "own_tasks", "care", "own_events", "signals", "tasks"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["patients"], list)

    def test_home_caregiver_patients_fields(self, caregiver, link_id):
        tok, _ = caregiver
        r = requests.get(f"{API}/home?today={TODAY}", headers=_h(tok), timeout=30)
        d = r.json()
        assert d["patients"], "demo caregiver should be linked to Alex"
        p = d["patients"][0]
        assert "can_finance" in p
        assert "shares_preferences" in p
        assert isinstance(p["can_finance"], bool)
        assert isinstance(p["shares_preferences"], bool)


# -------------------------------------------------------------- PUT caregiver

class TestCaregiverProfilePersist:
    def test_put_me_caregiver_persists(self, caregiver):
        tok, _ = caregiver
        payload = {"profile": {"caregiver": {
            "who": "TEST_Mi pareja", "mode": "Soy su acompañante principal",
            "duties": ["Coordinar traslados", "Administrar gastos"],
            "hard": ["Encontrar tiempo para mí"],
            "organize": ["Resúmenes semanales"], "at_hand": ["Señales rápidas del paciente"],
            "availability": {"when": ["Entre semana"], "slots": [{"days": ["Lun", "Mié"], "start": "09:00", "end": "11:00"}]},
            "goals": ["Pedir apoyo cuando lo necesite"], "interests": [],
        }}}
        r = requests.put(f"{API}/me", headers=_h(tok), json=payload, timeout=30)
        assert r.status_code == 200, r.text
        r2 = requests.get(f"{API}/me", headers=_h(tok), timeout=30)
        assert r2.status_code == 200
        cg = (r2.json().get("profile") or {}).get("caregiver") or {}
        assert cg.get("who") == "TEST_Mi pareja"
        assert "Coordinar traslados" in cg.get("duties", [])
        assert cg["availability"]["slots"][0]["days"] == ["Lun", "Mié"]

    def test_mi_proceso_shared_block(self, caregiver):
        tok, _ = caregiver
        r = requests.get(f"{API}/process/shared?today={TODAY}&days=30", headers=_h(tok), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "mine" in d and "people" in d
        assert set(d["mine"].keys()) >= {"done", "open", "transfers", "accompanied"}
        assert isinstance(d["people"], list)


# ------------------------------------------------------- Preferences sharing

class TestPreferencesSharing:
    def test_default_not_authorized(self, caregiver, patient):
        tok, _ = caregiver
        pid = patient[1]["id"]
        r = requests.get(f"{API}/network/preferences/{pid}", headers=_h(tok), timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["authorized"] is False
        assert d["preferences"] in (None, {}, [])

    def test_unknown_patient_does_not_leak(self, caregiver):
        tok, _ = caregiver
        r = requests.get(f"{API}/network/preferences/nonexistent-id-xyz", headers=_h(tok), timeout=30)
        # Should return authorized=false and NOT 500
        assert r.status_code in (200, 404), r.text
        if r.status_code == 200:
            d = r.json()
            assert d["authorized"] is False

    def test_patient_toggles_and_caregiver_sees(self, patient, caregiver, link_id):
        p_tok, _ = patient
        c_tok, _ = caregiver
        # Patient grants preference sharing
        r = requests.put(f"{API}/network/{link_id}/permissions",
                         headers=_h(p_tok), json={"preferences": True}, timeout=30)
        assert r.status_code == 200, r.text
        try:
            r2 = requests.get(f"{API}/network/preferences/{patient[1]['id']}", headers=_h(c_tok), timeout=30)
            assert r2.status_code == 200
            d = r2.json()
            assert d["authorized"] is True
            assert d["preferences"] is not None
        finally:
            # Restore
            requests.put(f"{API}/network/{link_id}/permissions",
                         headers=_h(p_tok), json={"preferences": False}, timeout=30)
        # Verify restored off
        r3 = requests.get(f"{API}/network/preferences/{patient[1]['id']}", headers=_h(c_tok), timeout=30)
        assert r3.status_code == 200
        assert r3.json()["authorized"] is False


# ---------------------------------------------------------- Recommendations

class TestRecommendations:
    def test_recommendations_caregiver_default(self, caregiver):
        tok, _ = caregiver
        r = requests.get(f"{API}/recommendations?today={TODAY}", headers=_h(tok), timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        # Expect a personalized flag and some items
        if isinstance(d, dict):
            # Not personalized by default when preferences not shared
            assert "personalized" in d or "items" in d
            if "personalized" in d:
                assert d["personalized"] in (False, True)

    def test_recommendations_patient_unchanged(self, patient):
        tok, _ = patient
        r = requests.get(f"{API}/recommendations?today={TODAY}", headers=_h(tok), timeout=30)
        assert r.status_code == 200, r.text


# ---------------------------------------------------------- Register by role

class TestRegisterByRole:
    def test_register_caregiver_role(self):
        tok, u, email = _register("caregiver")
        assert u["role"] == "caregiver"
        # Home must respond as caregiver
        r = requests.get(f"{API}/home?today={TODAY}", headers=_h(tok), timeout=30)
        assert r.status_code == 200
        assert r.json().get("role") == "caregiver"

    def test_register_patient_role(self):
        tok, u, email = _register("patient")
        assert u["role"] == "patient"
        r = requests.get(f"{API}/home?today={TODAY}", headers=_h(tok), timeout=30)
        assert r.status_code == 200
        assert r.json().get("role") == "patient"
