# AMODO backend regression tests: auth, me, records+permissions, network, signals, notifications, shop, home/history
import os
import uuid
from datetime import date
import pytest
import requests


def _base():
    url = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
    return url.rstrip("/")


BASE = _base() + "/api"
TODAY = date.today().isoformat()


def login(email, pw="Demo1234"):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def patient():
    d = login("demo@amodo.app")
    return d["token"], d["user"]


@pytest.fixture(scope="module")
def caregiver():
    d = login("acompanante@amodo.app")
    return d["token"], d["user"]


@pytest.fixture(scope="module")
def new_user():
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{BASE}/auth/register", json={"email": email, "password": "Test12345", "name": "TEST_User", "consents": True})
    assert r.status_code == 200, r.text
    d = r.json()
    return d["token"], d["user"], email


# ---- auth
class TestAuth:
    def test_register_validation(self):
        r = requests.post(f"{BASE}/auth/register", json={"email": "x@y.com", "password": "Test12345", "name": "a", "consents": False})
        assert r.status_code == 422
        r = requests.post(f"{BASE}/auth/register", json={"email": "demo@amodo.app", "password": "Test12345", "name": "a", "consents": True})
        assert r.status_code == 409

    def test_login_bad(self):
        r = requests.post(f"{BASE}/auth/login", json={"email": "demo@amodo.app", "password": "wrong"})
        assert r.status_code == 401

    def test_demo(self):
        for role, email in (("patient", "demo@amodo.app"), ("caregiver", "acompanante@amodo.app")):
            r = requests.post(f"{BASE}/auth/demo", json={"role": role})
            assert r.status_code == 200 and r.json()["user"]["email"] == email
            assert "password_hash" not in r.json()["user"] and "_id" not in r.json()["user"]

    def test_forgot_reset(self, new_user):
        _, _, email = new_user
        r = requests.post(f"{BASE}/auth/forgot", json={"email": email})
        code = r.json()["demo_code"]
        assert requests.post(f"{BASE}/auth/reset", json={"email": email, "code": "000000x", "new_password": "NewPass123"}).status_code == 400
        r = requests.post(f"{BASE}/auth/reset", json={"email": email, "code": code, "new_password": "NewPass123"})
        assert r.status_code == 200
        login(email, "NewPass123")

    def test_me_and_role_switch(self, new_user):
        tok, _, _ = new_user
        assert requests.get(f"{BASE}/me").status_code in (401, 403)
        r = requests.put(f"{BASE}/me", headers=H(tok), json={"role": "caregiver", "settings": {"text_scale": 1.2}, "preferred_name": "TEST_Pref"})
        d = r.json()
        assert d["role"] == "caregiver" and set(d["roles"]) == {"patient", "caregiver"} and d["settings"]["text_scale"] == 1.2
        assert d["settings"]["notif_agenda"] is True  # other settings preserved
        r = requests.put(f"{BASE}/me", headers=H(tok), json={"role": "patient"})
        assert requests.get(f"{BASE}/me", headers=H(tok)).json()["role"] == "patient"


# ---- records
class TestRecords:
    @pytest.mark.parametrize("kind", ["events", "treatments", "medications", "tasks", "transfers", "expenses", "journal"])
    def test_crud(self, patient, kind):
        tok, _ = patient
        r = requests.post(f"{BASE}/records/{kind}", headers=H(tok), json={"title": f"TEST_{kind}", "date": TODAY, "owner_id": "hack"})
        assert r.status_code == 403  # foreign owner without link
        r = requests.post(f"{BASE}/records/{kind}", headers=H(tok), json={"title": f"TEST_{kind}", "date": TODAY, "id": "x", "created_by": "y"})
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["id"] != "x" and rec["created_by"] != "y" and rec["kind"] == kind
        assert any(x["id"] == rec["id"] for x in requests.get(f"{BASE}/records/{kind}", headers=H(tok)).json())
        r = requests.put(f"{BASE}/records/{kind}/{rec['id']}", headers=H(tok), json={"title": "TEST_upd"})
        assert requests.get(f"{BASE}/records/{kind}/{rec['id']}", headers=H(tok)).json()["title"] == "TEST_upd"
        assert requests.delete(f"{BASE}/records/{kind}/{rec['id']}", headers=H(tok)).status_code == 200
        assert requests.get(f"{BASE}/records/{kind}/{rec['id']}", headers=H(tok)).status_code == 404

    def test_unknown_kind(self, patient):
        assert requests.get(f"{BASE}/records/foo", headers=H(patient[0])).status_code == 404

    def test_caregiver_permissions(self, patient, caregiver):
        ptok, pu = patient
        ctok, cu = caregiver
        net = requests.get(f"{BASE}/network", headers=H(ptok)).json()
        link = next(l for l in net["as_patient"] if l.get("caregiver_id") == cu["id"] and l["status"] == "active")
        orig = dict(link["permissions"])
        try:
            requests.put(f"{BASE}/network/{link['id']}/permissions", headers=H(ptok), json={"events": True, "expenses": False, "edit": True})
            r = requests.get(f"{BASE}/records/events", headers=H(ctok), params={"owner_id": pu["id"]})
            assert r.status_code == 200
            # iteration 2: section perms replaced by per-item shared_with -> list returns 200, filtered to shared items only
            rx = requests.get(f"{BASE}/records/expenses", headers=H(ctok), params={"owner_id": pu["id"]})
            assert rx.status_code == 200 and all(cu["id"] in (x.get("shared_with") or []) for x in rx.json())
            r = requests.post(f"{BASE}/records/events", headers=H(ctok), json={"title": "TEST_cg_event", "date": TODAY, "owner_id": pu["id"]})
            assert r.status_code == 200 and r.json()["owner_id"] == pu["id"]
            eid = r.json()["id"]
            # caregiver cannot edit without edit perm
            requests.put(f"{BASE}/network/{link['id']}/permissions", headers=H(ctok), json={"edit": False})  # should be 403
            requests.put(f"{BASE}/network/{link['id']}/permissions", headers=H(ptok), json={"edit": False})
            assert requests.put(f"{BASE}/records/events/{eid}", headers=H(ctok), json={"title": "x"}).status_code == 403
            assert requests.delete(f"{BASE}/records/events/{eid}", headers=H(ptok)).status_code == 200
            # task assignment
            r = requests.post(f"{BASE}/records/tasks", headers=H(ptok), json={"title": "TEST_task_assigned", "assignee_id": cu["id"]})
            tid = r.json()["id"]
            mine = requests.get(f"{BASE}/records/tasks", headers=H(ctok), params={"assigned": "me"}).json()
            assert any(t["id"] == tid and t.get("owner_name") for t in mine)
            assert requests.put(f"{BASE}/records/tasks/{tid}", headers=H(ctok), json={"done": True}).status_code == 200
            requests.delete(f"{BASE}/records/tasks/{tid}", headers=H(ptok))
        finally:
            requests.put(f"{BASE}/network/{link['id']}/permissions", headers=H(ptok), json=orig)

    def test_perm_update_only_patient(self, patient, caregiver):
        net = requests.get(f"{BASE}/network", headers=H(patient[0])).json()
        link = next(l for l in net["as_patient"] if l.get("caregiver_id") == caregiver[1]["id"])
        assert requests.put(f"{BASE}/network/{link['id']}/permissions", headers=H(caregiver[0]), json={"edit": True}).status_code == 403


# ---- network
class TestNetwork:
    def test_join_by_code_and_delete(self, patient, new_user):
        ptok, pu = patient
        ntok, nu, _ = new_user
        code = requests.get(f"{BASE}/network", headers=H(ptok)).json()["invite_code"]
        assert requests.post(f"{BASE}/network/join", headers=H(ntok), json={"code": "ZZZZZZ"}).status_code == 404
        r = requests.post(f"{BASE}/network/join", headers=H(ntok), json={"code": code.lower(), "relation": "TEST"})
        assert r.status_code == 200 and r.json()["status"] == "active" and r.json()["patient_name"]
        lid = r.json()["id"]
        assert any(l["id"] == lid for l in requests.get(f"{BASE}/network", headers=H(ntok)).json()["as_caregiver"])
        assert requests.delete(f"{BASE}/network/{lid}", headers=H(ntok)).status_code == 200
        assert not any(l["id"] == lid for l in requests.get(f"{BASE}/network", headers=H(ptok)).json()["as_patient"])

    def test_request_by_email_accept(self, patient, new_user):
        ptok, pu = patient
        ntok, nu, _ = new_user
        r = requests.post(f"{BASE}/network/request", headers=H(ntok), json={"email": "demo@amodo.app"})
        assert r.status_code == 200 and r.json()["status"] == "pending_patient"
        lid = r.json()["id"]
        assert requests.post(f"{BASE}/network/request", headers=H(ntok), json={"email": "demo@amodo.app"}).status_code == 409
        assert requests.post(f"{BASE}/network/{lid}/accept", headers=H(ntok)).status_code == 403
        r = requests.post(f"{BASE}/network/{lid}/accept", headers=H(ptok))
        assert r.json()["status"] == "active"
        requests.delete(f"{BASE}/network/{lid}", headers=H(ptok))

    def test_invite_accept(self, new_user, caregiver):
        ntok, nu, _ = new_user
        ctok, cu = caregiver
        r = requests.post(f"{BASE}/network/invite", headers=H(ntok), json={"email": "acompanante@amodo.app", "name": "TEST"})
        assert r.status_code == 200 and r.json()["status"] == "pending_caregiver"
        lid = r.json()["id"]
        r = requests.post(f"{BASE}/network/{lid}/accept", headers=H(ctok))
        assert r.status_code == 200 and r.json()["status"] == "active"
        assert requests.delete(f"{BASE}/network/{lid}", headers=H(ctok)).status_code == 200


# ---- signals + notifications
class TestSignals:
    def test_signal_flow(self, patient, caregiver):
        ptok, _ = patient
        ctok, _ = caregiver
        r = requests.post(f"{BASE}/signals", headers=H(ptok), json={"type": "TEST", "label": "TEST_Necesito compañía", "message": "TEST"})
        assert r.status_code == 200 and r.json()["recipients"] >= 1
        sid = r.json()["id"]
        assert any(s["id"] == sid for s in requests.get(f"{BASE}/signals", headers=H(ptok)).json())
        assert any(s["id"] == sid for s in requests.get(f"{BASE}/signals", headers=H(ctok), params={"box": "received"}).json())
        notifs = requests.get(f"{BASE}/notifications", headers=H(ctok)).json()
        assert any("TEST_Necesito" in n["title"] for n in notifs)
        r = requests.post(f"{BASE}/signals/{sid}/respond", headers=H(ctok), json={"text": "TEST voy"})
        assert r.json()["status"] == "atendida" and r.json()["responses"][-1]["text"] == "TEST voy"
        assert requests.post(f"{BASE}/signals/{sid}/close", headers=H(ctok)).status_code == 404
        assert requests.post(f"{BASE}/signals/{sid}/close", headers=H(ptok)).status_code == 200
        assert requests.post(f"{BASE}/notifications/read-all", headers=H(ctok)).status_code == 200

    def test_respond_not_in_network(self, patient, new_user):
        sid = requests.get(f"{BASE}/signals", headers=H(patient[0])).json()[0]["id"]
        assert requests.post(f"{BASE}/signals/{sid}/respond", headers=H(new_user[0]), json={"text": "x"}).status_code == 403


# ---- shop
class TestShop:
    def test_products_filters(self):
        allp = requests.get(f"{BASE}/products").json()
        assert len(allp) > 5 and all("price" in p for p in allp)
        cat = allp[0]["category"]
        f = requests.get(f"{BASE}/products", params={"category": cat}).json()
        assert f and all(p["category"] == cat for p in f)
        assert requests.get(f"{BASE}/products/nope").status_code == 404

    def test_favorites(self, new_user):
        tok = new_user[0]
        assert requests.post(f"{BASE}/favorites/p1", headers=H(tok)).json()["favorite"] is True
        assert [p["id"] for p in requests.get(f"{BASE}/favorites", headers=H(tok)).json()] == ["p1"]
        assert requests.post(f"{BASE}/favorites/p1", headers=H(tok)).json()["favorite"] is False

    def test_kits_and_size(self, new_user):
        tok = new_user[0]
        sug = requests.get(f"{BASE}/kits/suggested").json()
        assert sug and sug[0]["total"] > sug[0]["base_price"]
        too_many = [{"product_id": f"p{i}"} for i in range(1, 6)]
        assert requests.post(f"{BASE}/kits", headers=H(tok), json={"size": "Pequeño", "items": too_many}).status_code == 422
        assert requests.post(f"{BASE}/kits", headers=H(tok), json={"size": "Gigante"}).status_code == 422
        r = requests.post(f"{BASE}/kits", headers=H(tok), json={"name": "TEST_kit", "size": "Pequeño", "items": too_many[:3]})
        kit = r.json()
        assert kit["total"] == 149 + sum(i["product"]["price"] for i in kit["items"])
        r = requests.put(f"{BASE}/kits/{kit['id']}", headers=H(tok), json={"name": "TEST_kit2", "size": "Mediano", "items": too_many})
        assert requests.get(f"{BASE}/kits/{kit['id']}", headers=H(tok)).json()["name"] == "TEST_kit2"
        assert requests.get(f"{BASE}/kits/t1", headers=H(tok)).status_code == 200
        pytest.kit_id = kit["id"]

    def test_cart_checkout_orders(self, new_user):
        tok = new_user[0]
        requests.post(f"{BASE}/cart", headers=H(tok), json={"type": "kit", "ref_id": pytest.kit_id})
        c = requests.post(f"{BASE}/cart", headers=H(tok), json={"type": "product", "ref_id": "p1", "qty": 2, "options": {"text": "Hola"}}).json()
        assert c["count"] == 3
        pid_item = next(i for i in c["items"] if i["type"] == "product")
        c = requests.put(f"{BASE}/cart/{pid_item['id']}", headers=H(tok), json={"qty": 1}).json()
        assert c["count"] == 2
        bad = {"recipient": "", "phone": "1", "street": "a", "city": "b", "zip": "1"}
        assert requests.post(f"{BASE}/orders/checkout", headers=H(tok), json=bad).status_code == 422
        addr = {"recipient": "TEST R", "phone": "5551234567", "street": "Calle 1", "city": "CDMX", "zip": "01000", "shipping": "Express"}
        r = requests.post(f"{BASE}/orders/checkout", headers=H(tok), json=addr)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["total"] == c["subtotal"] + 179 and o["status"] == "Confirmado" and "simulado" in o["payment"]["status"]
        assert requests.get(f"{BASE}/cart", headers=H(tok)).json()["count"] == 0
        assert requests.post(f"{BASE}/orders/checkout", headers=H(tok), json=addr).status_code == 400
        assert requests.get(f"{BASE}/orders/{o['id']}", headers=H(tok)).json()["number"] == o["number"]
        assert requests.post(f"{BASE}/orders/{o['id']}/cancel", headers=H(tok)).json()["status"] == "Cancelado"
        hist = requests.get(f"{BASE}/history", headers=H(tok)).json()
        assert any(h["kind"] == "order" for h in (hist if isinstance(hist, list) else hist.get("items", [])))
        requests.delete(f"{BASE}/kits/{pytest.kit_id}", headers=H(tok))

    def test_cart_invalid(self, new_user):
        tok = new_user[0]
        assert requests.post(f"{BASE}/cart", headers=H(tok), json={"type": "x", "ref_id": "p1"}).status_code == 422
        r = requests.post(f"{BASE}/cart", headers=H(tok), json={"type": "product", "ref_id": "p1", "qty": "abc"})
        assert r.status_code in (400, 422), f"non-numeric qty gives {r.status_code}"


# ---- home
class TestHome:
    def test_home_patient(self, patient):
        d = requests.get(f"{BASE}/home", headers=H(patient[0]), params={"today": TODAY}).json()
        assert d["role"] == "patient" and "today_events" in d and d["network_count"] >= 1

    def test_home_caregiver(self, caregiver):
        d = requests.get(f"{BASE}/home", headers=H(caregiver[0]), params={"today": TODAY}).json()
        assert d["role"] == "caregiver" and len(d["patients"]) >= 1
