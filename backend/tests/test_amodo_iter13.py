"""Iteration 13 backend tests: next-week (Plus gate + prepare), checklists (CRUD/share/toggle/reuse/soft-delete),
process (aggregates + PDF link one-shot), style (Plus gate + PUT prefs + proposals + Gemini image + delete)."""
import os
import time
from datetime import date, timedelta

import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


def _token(role):
    r = requests.post(f"{BASE}/api/auth/demo", json={"role": role}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _h(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def patient():
    return _token("patient")


@pytest.fixture(scope="module")
def caregiver():
    return _token("caregiver")


@pytest.fixture(scope="module")
def today():
    return date.today().isoformat()


# ---------------------------------------------------------------- next-week
class TestNextWeek:
    def test_caregiver_gratis_403(self, caregiver, today):
        r = requests.get(f"{BASE}/api/next-week?today={today}", headers=_h(caregiver))
        assert r.status_code == 403, r.text

    def test_patient_plus_200_shape(self, patient, today):
        r = requests.get(f"{BASE}/api/next-week?today={today}", headers=_h(patient))
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["days"]) == 7
        assert d["start"] == today
        for k in ("visits", "transfers", "tasks", "doses"):
            assert k in d["summary"]
        assert isinstance(d["prepare"], list)

    def test_bad_date_422(self, patient):
        r = requests.get(f"{BASE}/api/next-week?today=bad", headers=_h(patient))
        assert r.status_code == 422

    def test_prepare_suggests_checklist_and_transfer(self, patient, today):
        """Create a visit today with no transfer / no checklist and expect prepare entries."""
        ev = requests.post(f"{BASE}/api/records/events", headers=_h(patient), json={
            "title": "TEST_iter13_cita", "type": "Cita médica", "date": today, "time": "10:00"}).json()
        try:
            d = requests.get(f"{BASE}/api/next-week?today={today}", headers=_h(patient)).json()
            keys = [p["key"] for p in d["prepare"]]
            assert f"tr-{ev['id']}" in keys, f"expected transfer suggestion, got {keys}"
            cl_entry = next((p for p in d["prepare"] if p["key"] == f"cl-{ev['id']}"), None)
            assert cl_entry and cl_entry.get("create_for") == ev["id"]

            # create the checklist with 2 items -> prepare entry switches to "Te falta/n N cosas"
            c = requests.post(f"{BASE}/api/checklists", headers=_h(patient), json={
                "event_id": ev["id"], "title": "TEST_cl", "items": ["a", "b"]}).json()
            d2 = requests.get(f"{BASE}/api/next-week?today={today}", headers=_h(patient)).json()
            entry = next(p for p in d2["prepare"] if p["key"] == f"cl-{ev['id']}")
            assert "cosa" in entry["title"].lower()
            assert entry["link"]["pathname"] == f"/checklist/{c['id']}"
            requests.delete(f"{BASE}/api/checklists/{c['id']}", headers=_h(patient))
        finally:
            requests.delete(f"{BASE}/api/records/events/{ev['id']}", headers=_h(patient))


# ---------------------------------------------------------------- checklists
class TestChecklists:
    def test_templates(self, patient):
        r = requests.get(f"{BASE}/api/checklists/templates", headers=_h(patient))
        assert r.status_code == 200
        ids = [t["id"] for t in r.json()["templates"]]
        assert {"cita", "sesion", "estudio", "hospitalizacion", "blanco"}.issubset(ids)

    def test_full_lifecycle(self, patient, caregiver):
        # Find linked caregiver id via /api/network
        net = requests.get(f"{BASE}/api/network", headers=_h(patient)).json()
        links = net.get("as_patient") or []
        cg = next((x for x in links if "acompanante" in (x.get("caregiver_email", "") or "").lower() and x.get("status") == "active"), None)
        assert cg, f"no linked caregiver found in network response: {net}"
        cg_id = cg["caregiver_id"]

        # Create
        c = requests.post(f"{BASE}/api/checklists", headers=_h(patient), json={
            "template": "cita", "title": "TEST_iter13_lista", "shared_with": [cg_id]}).json()
        cid = c["id"]
        assert c["mine"] is True
        assert c["total"] > 0
        assert cg_id in c["shared_with"]

        try:
            # Caregiver can GET and toggle
            gc = requests.get(f"{BASE}/api/checklists/{cid}", headers=_h(caregiver))
            assert gc.status_code == 200, gc.text
            caregiver_view = gc.json()
            assert caregiver_view["mine"] is False
            first_item = caregiver_view["items"][0]
            tog = requests.post(f"{BASE}/api/checklists/{cid}/toggle", headers=_h(caregiver),
                                json={"item_id": first_item["id"], "done": True})
            assert tog.status_code == 200
            toggled = tog.json()
            toggled_item = next(i for i in toggled["items"] if i["id"] == first_item["id"])
            assert toggled_item["done"] is True
            assert toggled_item["done_by"]  # name set

            # Caregiver cannot PUT / DELETE
            r = requests.put(f"{BASE}/api/checklists/{cid}", headers=_h(caregiver), json={"title": "X"})
            assert r.status_code == 403
            r = requests.delete(f"{BASE}/api/checklists/{cid}", headers=_h(caregiver))
            assert r.status_code == 403

            # PUT items preserves done state by id
            new_items = toggled["items"] + [{"text": "nuevo punto TEST"}]
            r = requests.put(f"{BASE}/api/checklists/{cid}", headers=_h(patient), json={"items": new_items})
            assert r.status_code == 200
            after = r.json()
            assert any(i["id"] == first_item["id"] and i["done"] for i in after["items"])
            assert after["total"] == len(toggled["items"]) + 1

            # Notification to caregiver
            notes = requests.get(f"{BASE}/api/notifications", headers=_h(caregiver)).json()
            items = notes.get("items", notes) if isinstance(notes, dict) else notes
            assert any(f"/checklist/{cid}" == (n.get("link") or "") for n in items), "caregiver did not receive /checklist link notification"

            # Reuse by caregiver -> unchecked copy owned by caregiver
            copy = requests.post(f"{BASE}/api/checklists/{cid}/reuse", headers=_h(caregiver), json={}).json()
            assert copy["mine"] is True
            assert copy["done"] == 0 and copy["total"] == after["total"]
            requests.delete(f"{BASE}/api/checklists/{copy['id']}", headers=_h(caregiver))

            # Un-share removes caregiver access
            r = requests.put(f"{BASE}/api/checklists/{cid}", headers=_h(patient), json={"shared_with": []})
            assert r.status_code == 200
            gc2 = requests.get(f"{BASE}/api/checklists/{cid}", headers=_h(caregiver))
            assert gc2.status_code == 403

            # Non-shared user -> 403 (fresh random user)
            reg = requests.post(f"{BASE}/api/auth/register", json={
                "email": f"test_iter13_{int(time.time())}@amodo.app", "password": "Demo1234", "name": "TEST stranger", "role": "patient"})
            if reg.status_code == 200:
                other = reg.json()["token"]
                r = requests.get(f"{BASE}/api/checklists/{cid}", headers=_h(other))
                assert r.status_code == 403

            # Soft delete
            r = requests.delete(f"{BASE}/api/checklists/{cid}", headers=_h(patient))
            assert r.status_code == 200
            r = requests.get(f"{BASE}/api/checklists/{cid}", headers=_h(patient))
            assert r.status_code == 404
            all_lists = requests.get(f"{BASE}/api/checklists", headers=_h(patient)).json()
            assert not any(x["id"] == cid for x in all_lists["mine"])
        finally:
            requests.delete(f"{BASE}/api/checklists/{cid}", headers=_h(patient))


# ---------------------------------------------------------------- process
class TestProcess:
    @pytest.mark.parametrize("d", [7, 30, 90])
    def test_valid_periods(self, patient, today, d):
        r = requests.get(f"{BASE}/api/process?today={today}&days={d}", headers=_h(patient))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["days"] == d
        for k in ("feelings", "activities", "medications", "expenses", "weeks"):
            assert k in data

    def test_invalid_period_422(self, patient, today):
        r = requests.get(f"{BASE}/api/process?today={today}&days=14", headers=_h(patient))
        assert r.status_code == 422

    def test_invalid_date_422(self, patient):
        r = requests.get(f"{BASE}/api/process?today=xx&days=30", headers=_h(patient))
        assert r.status_code == 422

    def test_pdf_link_one_shot(self, patient, today):
        # Create notes with accents+emoji to exercise encoder
        j = requests.post(f"{BASE}/api/records/journal", headers=_h(patient), json={
            "date": today, "mood": "Tranquila", "mood_note": "TEST_iter13 acentúacíón ñ 😊 café",
            "energy": "Suave"})
        jid = j.json().get("id") if j.status_code in (200, 201) else None
        try:
            r = requests.post(f"{BASE}/api/process/pdf-link", headers=_h(patient), json={
                "today": today, "days": 30, "sections": ["feelings", "activities", "medications", "expenses"]})
            assert r.status_code == 200, r.text
            path = r.json()["path"]
            assert path.startswith("/api/process-download/")
            url = f"{BASE}{path}"
            # First GET works, no auth header needed
            g1 = requests.get(url)
            assert g1.status_code == 200
            assert g1.headers.get("content-type", "").startswith("application/pdf")
            assert g1.content[:4] == b"%PDF"
            # Second GET 404 (one-shot)
            g2 = requests.get(url)
            assert g2.status_code == 404
        finally:
            if jid:
                requests.delete(f"{BASE}/api/records/journal/{jid}", headers=_h(patient))


# ---------------------------------------------------------------- style
class TestStyle:
    def test_caregiver_gratis_403(self, caregiver):
        r = requests.get(f"{BASE}/api/style", headers=_h(caregiver))
        assert r.status_code == 403

    def test_get_options(self, patient):
        r = requests.get(f"{BASE}/api/style", headers=_h(patient))
        assert r.status_code == 200
        d = r.json()
        for k in ("colors", "textures", "accessories", "styles"):
            assert k in d["options"]

    def test_put_prefs_and_proposals(self, patient):
        r = requests.put(f"{BASE}/api/style", headers=_h(patient), json={
            "colors": ["Salvia", "Arena"], "textures": ["Algodón"],
            "accessories": ["Pañuelos"], "styles": ["Minimalista"]})
        assert r.status_code == 200
        d = r.json()
        assert d["prefs"]["colors"] == ["Salvia", "Arena"]
        assert isinstance(d["proposals"], list)
        if d["proposals"]:
            assert "why" in d["proposals"][0]
            assert isinstance(d["proposals"][0]["why"], list)

    def test_inspiration_requires_prefs(self, patient):
        # Clear prefs first
        requests.put(f"{BASE}/api/style", headers=_h(patient), json={
            "colors": [], "textures": [], "accessories": [], "styles": []})
        r = requests.post(f"{BASE}/api/style/inspiration", headers=_h(patient), json={})
        assert r.status_code == 422

    def test_inspiration_generate_and_delete(self, patient):
        # Set prefs
        requests.put(f"{BASE}/api/style", headers=_h(patient), json={
            "colors": ["Salvia"], "textures": ["Algodón"],
            "accessories": ["Pañuelos"], "styles": ["Minimalista"]})
        r = requests.post(f"{BASE}/api/style/inspiration", headers=_h(patient), json={}, timeout=60)
        assert r.status_code == 200, f"inspiration failed: {r.status_code} {r.text[:300]}"
        img = r.json()
        assert img["image"].startswith("/api/media/amodo/style/")
        iid = img["id"]
        # Media is reachable
        g = requests.get(f"{BASE}{img['image']}")
        assert g.status_code == 200
        assert g.headers.get("content-type", "").startswith("image/jpeg")
        # Delete -> media 404
        d = requests.delete(f"{BASE}/api/style/inspiration/{iid}", headers=_h(patient))
        assert d.status_code == 200
        g2 = requests.get(f"{BASE}{img['image']}")
        assert g2.status_code == 404
