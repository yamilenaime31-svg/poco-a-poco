# AMODO iteration 7: choose-plan onboarding, institutional codes A-D, Plus-only gates (403 for free), decimal discounts, scoped credits.
import os
import uuid
from datetime import date, timedelta

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


def H(t):
    return {"Authorization": f"Bearer {t}"}


def new_user():
    r = requests.post(f"{BASE}/auth/register", json={"email": f"test_{uuid.uuid4().hex[:8]}@amodo.app", "password": "Demo1234",
                                                     "name": "TEST_ Iter7", "preferred_name": "TEST", "role": "patient", "consents": True})
    assert r.status_code == 200, r.text
    return r.json()["token"], r.json()["user"]


def activate(t, code):
    r = requests.post(f"{BASE}/benefits/activate", headers=H(t), json={"code": code})
    assert r.status_code == 200, r.text
    return r.json()


def clear_cart(t):
    for c in requests.get(f"{BASE}/cart", headers=H(t)).json()["items"]:
        requests.delete(f"{BASE}/cart/{c['id']}", headers=H(t))


# --- registration -> choose plan
class TestChoosePlan:
    def test_register_not_chosen(self):
        t, u = new_user()
        assert not u.get("onboarding_done") and not u.get("plan_chosen")
        me = requests.get(f"{BASE}/me", headers=H(t)).json()
        assert not me.get("plan_chosen")

    def test_free_then_plus_keeps_data(self):
        t, _ = new_user()
        r = requests.post(f"{BASE}/me/plan", headers=H(t), json={"action": "free"})
        assert r.status_code == 200 and r.json()["tier"] == "free" and r.json()["name"] == "AMODO Gratis"
        assert requests.get(f"{BASE}/me", headers=H(t)).json()["plan_chosen"] is True
        k = requests.post(f"{BASE}/kits", headers=H(t), json={"name": "TEST_ keep", "size": "Chico", "items": [{"product_id": "p34"}]})
        assert k.status_code == 200
        p = requests.post(f"{BASE}/me/plan", headers=H(t), json={"action": "plus"}).json()
        assert p["tier"] == "plus" and p["source"] == "Demostración"
        requests.post(f"{BASE}/me/plan", headers=H(t), json={"action": "free"})
        kits = requests.get(f"{BASE}/kits", headers=H(t)).json()
        assert any(x["id"] == k.json()["id"] for x in kits)

    def test_demo_login_onboarded(self):
        r = requests.post(f"{BASE}/auth/login", json={"email": "demo@amodo.app", "password": "Demo1234"})
        assert r.status_code == 200 and r.json()["user"].get("onboarding_done") is True


# --- code validation messages
class TestCodes:
    def test_invalid_and_expired(self):
        t, _ = new_user()
        r = requests.post(f"{BASE}/benefits/validate", headers=H(t), json={"code": "NOEXISTE-XYZ"})
        assert r.status_code == 400 and r.json()["detail"] == "No pudimos encontrar este código. Revísalo e inténtalo nuevamente."
        r = requests.post(f"{BASE}/benefits/validate", headers=H(t), json={"code": "FUNDACION-2024"})
        assert r.status_code == 400 and r.json()["detail"] == "Este código ya no está vigente."

    @pytest.mark.parametrize("code,tier,kinds", [("CONVENIO-A", "plus", {"plus_access"}), ("CONVENIO-B", "plus", {"plus_access", "kit_discount_pct"}),
                                                 ("CONVENIO-C", "free", {"credit"}), ("CONVENIO-D", "free", {"credit"})])
    def test_codes_grant_only_configured(self, code, tier, kinds):
        t, _ = new_user()
        v = requests.post(f"{BASE}/benefits/validate", headers=H(t), json={"code": code.lower()})
        assert v.status_code == 200 and v.json()["benefits"]
        p = activate(t, code)
        assert p["tier"] == tier, p
        assert {b["kind"] for b in p["benefits"]} == kinds
        if code == "CONVENIO-D":
            b = p["benefits"][0]
            assert b["scope"] == "kits" and b["remaining"] == 299
        if code == "CONVENIO-C":
            assert p["benefits"][0]["remaining"] == 300 and not p["benefits"][0].get("scope")
        assert requests.get(f"{BASE}/me", headers=H(t)).json()["plan_chosen"] is True


# --- decimals and scoped credit
class TestPricing:
    def test_convenio_b_decimals(self):
        t, _ = new_user()
        activate(t, "CONVENIO-B")
        q = requests.post(f"{BASE}/kits/quote", headers=H(t), json={"size": "Chico", "items": [{"product_id": "p34"}]}).json()
        assert q["subtotal"] == 419
        b = q["breakdown"]
        assert b["discounts"][0]["amount"] == 41.9 and b["items_total"] == 377.1, b
        k = requests.post(f"{BASE}/kits", headers=H(t), json={"name": "TEST_ B", "size": "Chico", "items": [{"product_id": "p34"}]}).json()
        requests.post(f"{BASE}/cart", headers=H(t), json={"type": "kit", "ref_id": k["id"], "qty": 1})
        c = requests.get(f"{BASE}/checkout/quote", params={"shipping": "Estándar"}, headers=H(t)).json()
        assert c["discounts"][0]["amount"] == 41.9 and c["items_total"] == 377.1 and abs(c["total"] - 377.1) < 0.01, c  # iter8: shipping included
        clear_cart(t)

    def test_convenio_d_kits_only(self):
        t, _ = new_user()
        activate(t, "CONVENIO-D")
        requests.post(f"{BASE}/cart", headers=H(t), json={"type": "product", "ref_id": "p5", "qty": 1})
        c = requests.get(f"{BASE}/checkout/quote", headers=H(t)).json()
        assert c["credit"] == 0 and c["items_total"] == c["others"], c
        k = requests.post(f"{BASE}/kits", headers=H(t), json={"name": "TEST_ D", "size": "Chico", "items": [{"product_id": "p34"}]}).json()
        requests.post(f"{BASE}/cart", headers=H(t), json={"type": "kit", "ref_id": k["id"], "qty": 1})
        c = requests.get(f"{BASE}/checkout/quote", headers=H(t)).json()
        assert c["kits"] == 419 and c["credit"] == 299 and c["items_total"] == 419 - 299 + c["others"], c
        clear_cart(t)

    def test_convenio_c_any_items(self):
        t, _ = new_user()
        activate(t, "CONVENIO-C")
        requests.post(f"{BASE}/cart", headers=H(t), json={"type": "product", "ref_id": "p5", "qty": 1})
        c = requests.get(f"{BASE}/checkout/quote", headers=H(t)).json()
        assert c["credit"] == min(300, c["others"]) and c["credit"] > 0, c
        clear_cart(t)


# --- Plus-only gates
class TestPlusGates:
    def test_free_403(self):
        t, _ = new_user()
        requests.post(f"{BASE}/me/plan", headers=H(t), json={"action": "free"})
        assert requests.post(f"{BASE}/treatments/parse", headers=H(t), json={"text": "Quimio cada 21 días", "today": TODAY}).status_code == 403
        assert requests.put(f"{BASE}/recommendations/needs", headers=H(t), json={"needs": []}).status_code == 403
        assert requests.get(f"{BASE}/report", headers=H(t), params={"today": TODAY}).status_code == 403
        assert requests.get(f"{BASE}/recommendations/needs", headers=H(t)).json()["plus"] is False
        # essentials stay free: manual treatment plan
        d = (date.today() + timedelta(days=3)).isoformat()
        r = requests.post(f"{BASE}/treatments/plan", headers=H(t), json={"name": "TEST_ Quimio", "type": "Quimioterapia", "sessions": [{"date": d, "time": "09:00"}]})
        assert r.status_code == 200, r.text

    def test_plus_allowed(self):
        t, _ = new_user()
        requests.post(f"{BASE}/me/plan", headers=H(t), json={"action": "plus"})
        r = requests.get(f"{BASE}/report", headers=H(t), params={"today": TODAY})
        assert r.status_code == 200 and "AMODO" in r.json()["text"], r.text
        assert requests.put(f"{BASE}/recommendations/needs", headers=H(t), json={"needs": []}).status_code == 200
        r = requests.post(f"{BASE}/treatments/parse", headers=H(t), json={"text": "Quimioterapia cada 21 días desde mañana, 4 sesiones a las 9:00", "today": TODAY}, timeout=90)
        assert r.status_code in (200, 503), r.text

    def test_admin_codes_activated_by(self):
        t = requests.post(f"{BASE}/auth/login", json={"email": "demo@amodo.app", "password": "Demo1234"}).json()["token"]
        codes = requests.get(f"{BASE}/admin/codes", headers=H(t)).json()
        c = next(x for x in codes if x["code"] == "CONVENIO-D")
        assert c["benefits"]["funded_kit"] == "Chico" and "activated_by" in c and c["activations"] >= 1
