# AMODO iteration 8: shipping included in kit prices, plan access view (free/plus/institutional), admin shipping cost & alerts.
import os
import uuid

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
INCL = ["p33", "p5", "p4", "p37"]
PREM = ["p34", "p5", "p4", "p37"]
ADDR = {"recipient": "TEST_ Persona", "phone": "5512345678", "street": "Calle Demo 1", "city": "CDMX", "zip": "01000", "shipping": "Estándar"}


def H(t):
    return {"Authorization": f"Bearer {t}"}


def new_user(role="patient"):
    r = requests.post(f"{BASE}/auth/register", json={"email": f"test_{uuid.uuid4().hex[:8]}@amodo.app", "password": "Demo1234",
                                                     "name": "TEST_ Iter8", "preferred_name": "TEST", "role": role, "consents": True})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def login(email):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": "Demo1234"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def quote(t, ids, size="Chico"):
    r = requests.post(f"{BASE}/kits/quote", headers=H(t), json={"size": size, "items": [{"product_id": p} for p in ids]})
    assert r.status_code == 200, r.text
    return r.json()


def activate(t, code):
    r = requests.post(f"{BASE}/benefits/activate", headers=H(t), json={"code": code})
    assert r.status_code == 200, r.text
    return r.json()


# --- shipping included: free user quotes + order
class TestShippingIncluded:
    def test_free_chico_included(self):
        t = new_user()
        q = quote(t, INCL)
        b = q["breakdown"]
        assert q["subtotal"] == 299 and b["total"] == 299 and b["shipping"] == 0 and b["shipping_included"] is True and b["discounts"] == []

    def test_free_chico_premium(self):
        t = new_user()
        q = quote(t, PREM)
        assert q["subtotal"] == 419 and q["breakdown"]["total"] == 419 and q["breakdown"]["shipping"] == 0

    @pytest.mark.parametrize("ship", ["Estándar", "Recoger en punto AMODO", "Express"])
    def test_checkout_quote_shipping_zero(self, ship):
        t = new_user()
        q = requests.get(f"{BASE}/checkout/quote", params={"shipping": ship}, headers=H(t)).json()
        assert q["shipping"] == 0 and q["shipping_included"] is True

    def test_order_total_equals_items(self):
        t = new_user()
        k = requests.post(f"{BASE}/kits", headers=H(t), json={"name": "TEST_ kit8", "size": "Chico", "items": [{"product_id": p} for p in PREM]})
        assert k.status_code == 200, k.text
        c = requests.post(f"{BASE}/cart", headers=H(t), json={"type": "kit", "ref_id": k.json()["id"], "qty": 1})
        assert c.status_code == 200, c.text
        q = requests.get(f"{BASE}/checkout/quote", params={"shipping": "Estándar"}, headers=H(t)).json()
        assert q["total"] == 419 and q["items_total"] == 419 and q["shipping"] == 0
        o = requests.post(f"{BASE}/orders/checkout", headers=H(t), json=ADDR)
        assert o.status_code == 200, o.text
        o = o.json()
        assert o["total"] == 419 and o.get("shipping_cost", 0) == 0
        got = requests.get(f"{BASE}/orders/{o['id']}", headers=H(t))
        assert got.status_code == 200 and got.json()["total"] == 419
        requests.post(f"{BASE}/orders/{o['id']}/cancel", headers=H(t))  # release reserved stock

    def test_backend_rejects_4_digit_zip(self):
        t = new_user()
        k = requests.post(f"{BASE}/kits", headers=H(t), json={"name": "TEST_ zip", "size": "Chico", "items": [{"product_id": p} for p in INCL]}).json()
        requests.post(f"{BASE}/cart", headers=H(t), json={"type": "kit", "ref_id": k["id"], "qty": 1})
        r = requests.post(f"{BASE}/orders/checkout", headers=H(t), json={**ADDR, "zip": "1234"})
        if r.status_code == 200:
            requests.post(f"{BASE}/orders/{r.json()['id']}/cancel", headers=H(t))
        assert r.status_code == 422, f"backend accepted 4-digit zip: {r.status_code}"


# --- plans: plus demo discount, institutional access
class TestPlanAccess:
    def test_free_plan_view(self):
        t = new_user()
        p = requests.get(f"{BASE}/me/plan", headers=H(t)).json()
        assert p["access"] == "free" and p["tier"] == "free" and p["name"] == "AMODO Gratis"
        assert p["benefits"] == [] and p["expired"] == [] and p["institution"] == "" and p["plus_by_institution"] is False

    def test_plus_demo_discount(self):
        t = new_user()
        p = requests.post(f"{BASE}/me/plan", headers=H(t), json={"action": "plus"}).json()
        assert p["access"] == "plus" and p["tier"] == "plus" and p["until"]
        b = quote(t, INCL)["breakdown"]
        assert b["discounts"][0]["amount"] == 29.9 and b["total"] == 269.1 and b["shipping"] == 0

    def test_convenio_a(self):
        t = new_user()
        p = activate(t, "CONVENIO-A")
        assert p["access"] == "institutional" and p["plus_by_institution"] is True and p["tier"] == "plus"
        assert p["institution"] == "Hospital de ejemplo A"

    def test_convenio_c(self):
        t = new_user()
        p = activate(t, "CONVENIO-C")
        assert p["access"] == "institutional" and p["plus_by_institution"] is False and p["tier"] == "free"
        assert p["institution"] == "Fundación de ejemplo C"
        assert sum(b.get("remaining", 0) for b in p["benefits"] if b["kind"] == "credit") == 300

    def test_caregiver_plan(self):
        t = login("acompanante@amodo.app")
        r = requests.get(f"{BASE}/me/plan", headers=H(t))
        assert r.status_code == 200 and r.json()["access"] in ("free", "plus", "institutional")


# --- admin: shipping cost in fixed costs, alerts
class TestAdminShippingCost:
    def test_default_shipping_and_costing(self):
        a = login("demo@amodo.app")
        ov = requests.get(f"{BASE}/admin/overview", headers=H(a)).json()
        c = ov["costs"]
        assert "shipping" in c
        k = requests.post(f"{BASE}/admin/costing", headers=H(a), json={"size": "Chico", "item_costs": [10, 10, 10, 10]}).json()
        exp = sum(c[x] for x in ("packaging", "assembly", "labels", "protection", "storage", "logistics", "shipping", "incidents"))
        assert k["fixed_costs"] == exp

    def test_save_shipping_and_alerts_then_restore(self):
        a = login("demo@amodo.app")
        orig = requests.get(f"{BASE}/admin/overview", headers=H(a)).json()["costs"]
        try:
            r = requests.put(f"{BASE}/admin/settings/costs", headers=H(a), json={"value": {**orig, "shipping": orig["shipping"] + 15}})
            assert r.status_code == 200 and r.json()["value"]["shipping"] == orig["shipping"] + 15
            ov = requests.get(f"{BASE}/admin/overview", headers=H(a)).json()
            assert ov["costs"]["shipping"] == orig["shipping"] + 15
            k = requests.post(f"{BASE}/admin/costing", headers=H(a), json={"size": "Chico", "item_costs": [10, 10, 10, 10]}).json()
            assert k["fixed_costs"] == sum(ov["costs"][x] for x in ("packaging", "assembly", "labels", "protection", "storage", "logistics", "shipping", "incidents"))
            requests.put(f"{BASE}/admin/settings/costs", headers=H(a), json={"value": {**orig, "min_margin_pct": 95}})
            ov = requests.get(f"{BASE}/admin/overview", headers=H(a)).json()
            assert any(x["size"] for x in ov["alerts"]), ov["alerts"]
        finally:
            assert requests.put(f"{BASE}/admin/settings/costs", headers=H(a), json={"value": orig}).status_code == 200

    def test_caregiver_admin_403(self):
        t = login("acompanante@amodo.app")
        assert requests.put(f"{BASE}/admin/settings/costs", headers=H(t), json={"value": {}}).status_code == 403
