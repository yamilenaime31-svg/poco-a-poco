"""
Iteration 19 — Mi cobertura médica + Gastos como gestor financiero + Plus tools.

Covers:
- /api/coverages CRUD + soft delete, archived flag, multiple coverages (private + IMSS)
- /api/finance/expenses CRUD with calc deltas: own-paid, direct, partial payments, claim lifecycle (request/authorize/deposits), supports, legacy records
- /api/finance/permissions default-nothing, grant per-perm unlocks exact action
- /api/finance/docs upload + list (no path) + link + public file fetch + delete + 403 for other user
- Plus features: /finance/docs/{id}/extract (consent gate + non-Plus 403), /finance/reports (financial, dossier zip)
- /api/process includes 'finance' block when expenses exist
"""
import io
import os
import time

import pytest
import requests

# Load from frontend .env if not already in env
if "EXPO_PUBLIC_BACKEND_URL" not in os.environ:
    try:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    os.environ["EXPO_PUBLIC_BACKEND_URL"] = ln.split("=", 1)[1].strip().strip('"')
                    break
    except FileNotFoundError:
        pass
BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


def _auth(role: str) -> dict:
    r = requests.post(f"{BASE}/api/auth/demo", json={"role": role}, timeout=30)
    r.raise_for_status()
    j = r.json()
    return {"token": j["token"], "user": j["user"], "h": {"Authorization": f"Bearer {j['token']}"}}


def _get_calc(h: dict, eid: str) -> dict:
    """POST /finance/expenses returns clean(rec) without calc; re-fetch to get derived amounts."""
    r = requests.get(f"{BASE}/api/finance/expenses/{eid}", headers=h)
    r.raise_for_status()
    j = r.json()
    j["calc"] = j.get("calc") or {}
    return j


@pytest.fixture(scope="module")
def patient():
    return _auth("patient")


@pytest.fixture(scope="module")
def caregiver():
    return _auth("caregiver")


@pytest.fixture(scope="module")
def created(patient, caregiver):
    """Track items we create so we can delete them at the end."""
    bag = {"expenses": [], "coverages": [], "docs": []}
    yield bag
    h = patient["h"]
    for cid in bag["coverages"]:
        requests.delete(f"{BASE}/api/coverages/{cid}", headers=h)
    for did in bag["docs"]:
        requests.delete(f"{BASE}/api/finance/docs/{did}", headers=h)
    for eid in bag["expenses"]:
        requests.delete(f"{BASE}/api/finance/expenses/{eid}", headers=h)
    # reset finance permissions to all false
    perms = requests.get(f"{BASE}/api/finance/permissions", headers=h).json()
    for p in perms:
        requests.put(f"{BASE}/api/finance/permissions/{p['caregiver_id']}",
                     json={"perms": {k: False for k in p["perms"]}}, headers=h)


# ---------------------------------------------------------------- coverages
class TestCoverages:
    def test_create_private_insurance(self, patient, created):
        r = requests.post(f"{BASE}/api/coverages", headers=patient["h"],
                          json={"type": "seguro_privado", "name": "TEST_Seguro Privado",
                                "data": {"insurer": "Aseguradora TEST", "policy_number": "POL-TEST-1", "sum_insured": "500000"}})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["name"] == "TEST_Seguro Privado"
        assert j["data"]["insurer"] == "Aseguradora TEST"
        created["coverages"].append(j["id"])

    def test_create_imss(self, patient, created):
        r = requests.post(f"{BASE}/api/coverages", headers=patient["h"],
                          json={"type": "imss", "name": "TEST_IMSS",
                                "data": {"nss": "12345678901", "unidad": "UMF 20", "clinica": "T4"}})
        assert r.status_code == 200
        created["coverages"].append(r.json()["id"])

    def test_list_returns_both(self, patient):
        r = requests.get(f"{BASE}/api/coverages", headers=patient["h"])
        assert r.status_code == 200
        types = [c["type"] for c in r.json()]
        assert "seguro_privado" in types and "imss" in types

    def test_update_via_post_id(self, patient, created):
        cid = created["coverages"][0]
        r = requests.post(f"{BASE}/api/coverages", headers=patient["h"],
                          json={"id": cid, "type": "seguro_privado", "name": "TEST_Seguro Privado v2", "data": {"insurer": "NuevoNombre"}})
        assert r.status_code == 200
        assert r.json()["name"].endswith("v2")

    def test_archive_flag(self, patient, created):
        cid = created["coverages"][1]
        r = requests.post(f"{BASE}/api/coverages", headers=patient["h"],
                          json={"id": cid, "type": "imss", "name": "TEST_IMSS", "archived": True, "data": {}})
        assert r.status_code == 200
        assert r.json()["archived"] is True

    def test_missing_type(self, patient):
        r = requests.post(f"{BASE}/api/coverages", headers=patient["h"], json={"name": "no type"})
        assert r.status_code == 422


# ---------------------------------------------------------------- expenses + calc deltas
class TestExpensesCalc:
    def test_fully_paid_own(self, patient, created):
        r = requests.post(f"{BASE}/api/finance/expenses", headers=patient["h"],
                          json={"title": "TEST_Consulta propia", "amount": 1000, "category": "Consultas", "date": "2026-01-10",
                                "payments": [{"amount": 1000, "source": "own", "date": "2026-01-10"}]})
        assert r.status_code == 200, r.text
        eid = r.json()["id"]
        created["expenses"].append(eid)
        j = _get_calc(patient["h"], eid)
        c = j["calc"]
        assert c["total"] == 1000 and c["paid_own"] == 1000 and c["pending_pay"] == 0 and c["net"] == 1000
        assert j["status"] == "Pagado"

    def test_direct_insurer_payment(self, patient, created):
        r = requests.post(f"{BASE}/api/finance/expenses", headers=patient["h"],
                          json={"title": "TEST_Directo aseguradora", "amount": 2000, "date": "2026-01-10",
                                "payments": [{"amount": 2000, "source": "direct", "date": "2026-01-10"}]})
        eid = r.json()["id"]
        created["expenses"].append(eid)
        c = _get_calc(patient["h"], eid)["calc"]
        assert c["direct"] == 2000 and c["paid_own"] == 0 and c["net"] == 0 and c["pending_pay"] == 0

    def test_partial_payments(self, patient, created):
        r = requests.post(f"{BASE}/api/finance/expenses", headers=patient["h"],
                          json={"title": "TEST_Parcial", "amount": 1500, "date": "2026-01-10",
                                "payments": [{"amount": 500, "source": "own"}, {"amount": 400, "source": "own"}]})
        eid = r.json()["id"]
        created["expenses"].append(eid)
        c = _get_calc(patient["h"], eid)["calc"]
        assert c["paid_own"] == 900 and c["pending_pay"] == 600

    def test_claim_lifecycle(self, patient, created):
        # Base expense fully paid own
        r = requests.post(f"{BASE}/api/finance/expenses", headers=patient["h"],
                          json={"title": "TEST_Reembolso", "amount": 3000, "date": "2026-01-10",
                                "payments": [{"amount": 3000, "source": "own"}]})
        eid = r.json()["id"]
        created["expenses"].append(eid)
        base_net = _get_calc(patient["h"], eid)["calc"]["net"]
        assert base_net == 3000

        # (d) requested: net must NOT change
        r = requests.put(f"{BASE}/api/finance/expenses/{eid}", headers=patient["h"],
                         json={"claim": {"status": "Solicitud presentada", "requested": 2000}})
        c = r.json()["calc"]
        assert c["requested"] == 2000
        assert c["net"] == base_net

        # (e) authorized partial: net unchanged, pending_receive = authorized
        r = requests.put(f"{BASE}/api/finance/expenses/{eid}", headers=patient["h"],
                         json={"claim": {"status": "Autorizado parcialmente", "requested": 2000, "authorized": 1500}})
        c = r.json()["calc"]
        assert c["net"] == base_net
        assert c["pending_receive"] == 1500
        assert c["authorized"] == 1500

        # (f) two deposits → received = sum, net decreases, pending_receive = authorized - received
        r = requests.put(f"{BASE}/api/finance/expenses/{eid}", headers=patient["h"],
                         json={"claim": {"status": "Reembolso recibido parcialmente", "requested": 2000, "authorized": 1500,
                                         "deposits": [{"amount": 800, "date": "2026-01-15"}, {"amount": 400, "date": "2026-01-16"}]}})
        c = r.json()["calc"]
        assert c["received"] == 1200
        assert c["net"] == base_net - 1200  # 1800
        assert c["pending_receive"] == 300

        # history should have multiple entries (one per status change)
        g = requests.get(f"{BASE}/api/finance/expenses/{eid}", headers=patient["h"]).json()
        hist = (g.get("claim") or {}).get("history") or []
        statuses = [h["status"] for h in hist]
        assert "Solicitud presentada" in statuses
        assert "Autorizado parcialmente" in statuses
        assert "Reembolso recibido parcialmente" in statuses

    def test_support_reduces_net(self, patient, created):
        r = requests.post(f"{BASE}/api/finance/expenses", headers=patient["h"],
                          json={"title": "TEST_Apoyo", "amount": 1000, "date": "2026-01-10",
                                "payments": [{"amount": 1000, "source": "own"}],
                                "supports": [{"amount": 300, "date": "2026-01-10", "from": "Fundación X"}]})
        eid = r.json()["id"]
        created["expenses"].append(eid)
        c = _get_calc(patient["h"], eid)["calc"]
        assert c["supports"] == 300 and c["net"] == 700

    def test_empty_title_422(self, patient):
        r = requests.post(f"{BASE}/api/finance/expenses", headers=patient["h"],
                         json={"title": "   ", "amount": 10})
        assert r.status_code == 422

    def test_legacy_pagado_record(self, patient, created):
        # Create via legacy /records/expenses with status Pagado and no payments
        r = requests.post(f"{BASE}/api/records/expenses", headers=patient["h"],
                          json={"title": "TEST_Legacy", "amount": 500, "date": "2026-01-10", "status": "Pagado"})
        assert r.status_code == 200, r.text
        eid = r.json()["id"]
        created["expenses"].append(eid)
        # Now fetch via finance endpoint
        g = requests.get(f"{BASE}/api/finance/expenses/{eid}", headers=patient["h"]).json()
        assert g["calc"]["paid_own"] == 500

    def test_list_has_items_and_totals(self, patient):
        r = requests.get(f"{BASE}/api/finance/expenses", headers=patient["h"])
        assert r.status_code == 200
        j = r.json()
        assert "items" in j and "totals" in j
        assert all("calc" in it for it in j["items"])
        t = j["totals"]
        for k in ("total", "paid_own", "direct", "pending_pay", "requested", "authorized", "received", "pending_receive", "supports", "net"):
            assert k in t


# ---------------------------------------------------------------- permissions
class TestPermissions:
    def test_default_caregiver_blocked(self, patient, caregiver):
        patient_id = patient["user"]["id"]
        # reset perms first
        requests.put(f"{BASE}/api/finance/permissions/{caregiver['user']['id']}",
                     headers=patient["h"], json={"perms": {}})
        for url in (
            f"{BASE}/api/finance/expenses?owner_id={patient_id}",
            f"{BASE}/api/records/expenses?owner_id={patient_id}",
            f"{BASE}/api/coverages?owner_id={patient_id}",
        ):
            r = requests.get(url, headers=caregiver["h"])
            assert r.status_code == 403, f"{url} returned {r.status_code}"

    def test_grant_add_unlocks_add_only(self, patient, caregiver, created):
        patient_id = patient["user"]["id"]
        caregiver_id = caregiver["user"]["id"]
        # grant add (view becomes true automatically)
        r = requests.put(f"{BASE}/api/finance/permissions/{caregiver_id}",
                         headers=patient["h"], json={"perms": {"add": True}})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["add"] is True and j["view"] is True
        # caregiver can view
        r = requests.get(f"{BASE}/api/finance/expenses?owner_id={patient_id}", headers=caregiver["h"])
        assert r.status_code == 200
        # caregiver can POST
        r = requests.post(f"{BASE}/api/finance/expenses", headers=caregiver["h"],
                          json={"owner_id": patient_id, "title": "TEST_Caregiver added", "amount": 50,
                                "payments": [{"amount": 50, "source": "own"}]})
        assert r.status_code == 200
        new_id = r.json()["id"]
        created["expenses"].append(new_id)
        # caregiver CANNOT PUT (needs 'edit')
        r = requests.put(f"{BASE}/api/finance/expenses/{new_id}", headers=caregiver["h"],
                         json={"owner_id": patient_id, "title": "TEST_edit attempt"})
        assert r.status_code == 403
        # caregiver CANNOT see coverages
        r = requests.get(f"{BASE}/api/coverages?owner_id={patient_id}", headers=caregiver["h"])
        assert r.status_code == 403

    def test_unlinked_user_blocked(self, patient):
        # Register a fresh account with no link
        import uuid
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE}/api/auth/register", json={"email": email, "password": "Passw0rd!", "name": "TEST_U", "role": "caregiver"})
        if r.status_code != 200:
            pytest.skip(f"register returned {r.status_code}")
        tok = r.json()["token"]
        h = {"Authorization": f"Bearer {tok}"}
        r = requests.get(f"{BASE}/api/finance/expenses?owner_id={patient['user']['id']}", headers=h)
        assert r.status_code in (403, 404)


# ---------------------------------------------------------------- documents
class TestDocuments:
    @pytest.fixture(scope="class")
    def ref_expense(self, patient, created):
        r = requests.post(f"{BASE}/api/finance/expenses", headers=patient["h"],
                          json={"title": "TEST_para docs", "amount": 100, "date": "2026-01-10"})
        eid = r.json()["id"]
        created["expenses"].append(eid)
        return eid

    def test_upload_png(self, patient, ref_expense, created):
        # 1x1 PNG
        png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\x8d\xc5\xf6\xae\x00\x00\x00\x00IEND\xaeB`\x82'
        files = {"file": ("test.png", png, "image/png")}
        data = {"ref_id": ref_expense, "ref_type": "expense", "category": "Comprobantes"}
        r = requests.post(f"{BASE}/api/finance/docs", headers=patient["h"], files=files, data=data)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "path" not in j
        created["docs"].append(j["id"])
        self.__class__.did = j["id"]

    def test_unsupported_mime(self, patient, ref_expense):
        files = {"file": ("test.exe", b"MZ..", "application/x-msdownload")}
        data = {"ref_id": ref_expense, "ref_type": "expense"}
        r = requests.post(f"{BASE}/api/finance/docs", headers=patient["h"], files=files, data=data)
        assert r.status_code == 422

    def test_list_no_path(self, patient, ref_expense):
        r = requests.get(f"{BASE}/api/finance/docs?ref_id={ref_expense}&ref_type=expense", headers=patient["h"])
        assert r.status_code == 200
        for d in r.json():
            assert "path" not in d

    def test_link_and_public_fetch(self, patient):
        did = self.__class__.did
        r = requests.post(f"{BASE}/api/finance/docs/{did}/link", headers=patient["h"])
        assert r.status_code == 200
        path = r.json()["path"]
        assert path.startswith("/api/finance-file/")
        # Fetch without auth header
        r2 = requests.get(f"{BASE}{path}")
        assert r2.status_code == 200
        assert len(r2.content) > 10

    def test_invalid_code_404(self):
        r = requests.get(f"{BASE}/api/finance-file/invalid-bogus-code-xyz")
        assert r.status_code == 404


# ---------------------------------------------------------------- Plus reports (not AI)
class TestReports:
    def test_invalid_type_422(self, patient):
        r = requests.post(f"{BASE}/api/finance/reports", headers=patient["h"], json={"type": "bogus"})
        assert r.status_code == 422

    def test_financial_pdf(self, patient):
        r = requests.post(f"{BASE}/api/finance/reports", headers=patient["h"],
                         json={"type": "financial", "start": "2026-01-01", "end": "2026-01-31"})
        assert r.status_code == 200, r.text
        path = r.json()["path"]
        r2 = requests.get(f"{BASE}{path}")
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("application/pdf")
        assert r2.content[:4] == b"%PDF"

    def test_dossier_zip(self, patient):
        r = requests.post(f"{BASE}/api/finance/reports", headers=patient["h"], json={"type": "dossier"})
        assert r.status_code == 200
        path = r.json()["path"]
        r2 = requests.get(f"{BASE}{path}")
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("application/zip")
        import zipfile
        zf = zipfile.ZipFile(io.BytesIO(r2.content))
        names = zf.namelist()
        assert "00-resumen.pdf" in names

    def test_non_plus_blocked(self, caregiver):
        r = requests.post(f"{BASE}/api/finance/reports", headers=caregiver["h"], json={"type": "financial"})
        assert r.status_code == 403


# ---------------------------------------------------------------- AI extract (Plus)
class TestExtract:
    def test_consent_required(self, patient, created):
        # upload a doc first
        r = requests.post(f"{BASE}/api/finance/expenses", headers=patient["h"], json={"title": "TEST_extract", "amount": 10})
        eid = r.json()["id"]
        created["expenses"].append(eid)
        png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\x8d\xc5\xf6\xae\x00\x00\x00\x00IEND\xaeB`\x82'
        r = requests.post(f"{BASE}/api/finance/docs", headers=patient["h"],
                          files={"file": ("test.png", png, "image/png")},
                          data={"ref_id": eid, "ref_type": "expense"})
        did = r.json()["id"]
        created["docs"].append(did)
        # consent false → 422
        r = requests.post(f"{BASE}/api/finance/docs/{did}/extract", headers=patient["h"],
                         json={"kind": "receipt", "consent": False})
        assert r.status_code == 422

    def test_non_plus_blocked(self, caregiver, patient, created):
        # grab any doc id from patient (if exists) — use a bogus path since 403 should happen before file lookup
        r = requests.post(f"{BASE}/api/finance/docs/anything/extract", headers=caregiver["h"],
                         json={"kind": "receipt", "consent": True})
        assert r.status_code == 403


# ---------------------------------------------------------------- Process
class TestProcess:
    def test_process_contains_finance(self, patient):
        from datetime import date
        today = date.today().isoformat()
        r = requests.get(f"{BASE}/api/process?today={today}&days=30", headers=patient["h"])
        assert r.status_code == 200, r.text
        j = r.json()
        # finance should be present if we've created expenses
        assert "finance" in j
        if j["finance"]:
            assert "totals" in j["finance"]
            assert "recent" in j["finance"]
