# AMODO iteration 12: checkout quote/credits, idempotent checkout, order tracking, Plus membership + wallet,
# AI usage limits, admin memberships / profitability / catalog export-import.
import csv
import io
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


ROOT = _base()
BASE = ROOT + "/api"
INCL = ["p33", "p5", "p4", "p37"]
PREM = ["p34", "p5", "p4", "p37"]  # p34 premium, supplement 120 -> subtotal 419
ADDR = {"recipient": "TEST_ Persona", "phone": "5512345678", "street": "Calle Demo 1", "city": "CDMX", "zip": "01000", "shipping": "Estándar"}
DEFAULT_PLANS = {"plus_price": 79, "plus_kit_discount_pct": 10, "monthly_credit": 20, "ai_limit_free": 15, "ai_limit_plus": 300,
                 "ai_cost_estimate": None, "stacking": "best", "max_discount_pct": 25}


def H(t):
    return {"Authorization": f"Bearer {t}"}


def new_user():
    r = requests.post(f"{BASE}/auth/register", json={"email": f"test_{uuid.uuid4().hex[:8]}@amodo.app", "password": "Demo1234",
                                                     "name": "TEST_ Iter12", "preferred_name": "TEST", "role": "patient", "consents": True})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def add_kit(t, items=PREM):
    k = requests.post(f"{BASE}/kits", headers=H(t), json={"name": "TEST_ kit12", "size": "Chico", "items": [{"product_id": p} for p in items]})
    assert k.status_code == 200, k.text
    c = requests.post(f"{BASE}/cart", headers=H(t), json={"type": "kit", "ref_id": k.json()["id"], "qty": 1})
    assert c.status_code == 200, c.text
    return k.json()["id"]


@pytest.fixture(scope="module")
def admin_tok():
    r = requests.post(f"{BASE}/auth/login", json={"email": "demo@amodo.app", "password": "Demo1234"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def plus_user():
    t = new_user()
    r = requests.post(f"{BASE}/me/plus/activate", headers=H(t))
    assert r.status_code == 200, r.text
    return t


# ---------- quote
class TestQuote:
    def test_free_quote_no_discount(self):
        t = new_user()
        add_kit(t)
        q = requests.get(f"{BASE}/checkout/quote", headers=H(t)).json()
        assert q["kit_base"] == 299 and q["supplements"] == 120 and q["discounts"] == [] and q["shipping"] == 0 and q["total"] == 419

    def test_plus_discount_only_on_base_and_credit(self, plus_user):
        add_kit(plus_user)
        q = requests.get(f"{BASE}/checkout/quote", headers=H(plus_user)).json()
        assert q["discounts"][0]["amount"] == 29.9, q["discounts"]
        assert q["subtotal_after_discounts"] == 389.1
        assert q["credit_plus"] == 20 and q["credit_institution"] == 0 and q["total"] == 369.1 and q["shipping"] == 0
        q0 = requests.get(f"{BASE}/checkout/quote", params={"use_credit": 0}, headers=H(plus_user)).json()
        assert q0["credit"] == 0 and q0["total"] == 389.1
        q5 = requests.get(f"{BASE}/checkout/quote", params={"use_credit": 5}, headers=H(plus_user)).json()
        assert q5["credit_plus"] == 5 and q5["total"] == 384.1
        qbig = requests.get(f"{BASE}/checkout/quote", params={"use_credit": 99999}, headers=H(plus_user)).json()
        assert qbig["credit"] == 20 and qbig["total"] >= 0
        qneg = requests.get(f"{BASE}/checkout/quote", params={"use_credit": -50}, headers=H(plus_user)).json()
        assert qneg["credit"] == 0 and qneg["total"] == 389.1
        requests.delete(f"{BASE}/cart/{q['items'][0]['id']}", headers=H(plus_user))


# ---------- Plus membership & wallet
class TestPlus:
    def test_activate_idempotent_and_wallet(self):
        t = new_user()
        r1 = requests.post(f"{BASE}/me/plus/activate", headers=H(t))
        assert r1.status_code == 200 and r1.json().get("credit") == 20
        r2 = requests.post(f"{BASE}/me/plus/activate", headers=H(t))
        assert r2.status_code == 200 and r2.json().get("already") is True
        w = requests.get(f"{BASE}/wallet", headers=H(t)).json()
        assert w["plus"] == 20 and w["available"] == 20 and w["next_credit"] and w["monthly_credit"] == 20
        assert len([m for m in w["moves"] if m["source"] == "plus" and m["amount"] > 0]) == 1
        p = requests.get(f"{BASE}/me/plan", headers=H(t)).json()
        assert p["tier"] == "plus" and p.get("subscription"), p
        c = requests.post(f"{BASE}/me/plus/cancel", headers=H(t))
        assert c.status_code == 200 and c.json()["credits_kept"] == 20
        assert requests.get(f"{BASE}/me/plan", headers=H(t)).json()["tier"] == "free"
        w2 = requests.get(f"{BASE}/wallet", headers=H(t)).json()
        assert w2["plus"] == 20 and w2["next_credit"] is None
        assert requests.post(f"{BASE}/me/plus/cancel", headers=H(t)).status_code == 400
        # re-activation must not double the first credit of the same period? (new since → new credit)
        r3 = requests.post(f"{BASE}/me/plus/activate", headers=H(t)).json()
        w3 = requests.get(f"{BASE}/wallet", headers=H(t)).json()
        print("re-activate credit:", r3.get("credit"), "wallet plus:", w3["plus"])


# ---------- checkout + order lifecycle
class TestOrders:
    def test_idempotent_checkout_and_wallet_deduction(self, plus_user, admin_tok):
        add_kit(plus_user)
        rid = uuid.uuid4().hex
        body = {**ADDR, "request_id": rid, "use_credit": 20}
        o1 = requests.post(f"{BASE}/orders/checkout", headers=H(plus_user), json=body)
        assert o1.status_code == 200, o1.text
        o1 = o1.json()
        o2 = requests.post(f"{BASE}/orders/checkout", headers=H(plus_user), json=body)
        assert o2.status_code == 200 and o2.json()["id"] == o1["id"]
        assert o1["status"] == "Pedido confirmado" and o1["total"] == 369.1 and o1["credit_plus"] == 20 and o1["shipping_cost"] == 0
        tl = o1["timeline"]
        assert [s["label"] for s in tl] == ["Pedido confirmado", "En preparación", "Listo para envío", "En camino", "Entregado"]
        assert tl[0]["done"] and not any(s["done"] for s in tl[1:])
        assert len([o for o in requests.get(f"{BASE}/orders", headers=H(plus_user)).json() if o.get("request_id") == rid]) == 1
        w = requests.get(f"{BASE}/wallet", headers=H(plus_user)).json()
        assert w["plus"] == 0
        # user cancel refunds credits
        c = requests.post(f"{BASE}/orders/{o1['id']}/cancel", headers=H(plus_user))
        assert c.status_code == 200 and c.json()["status"] == "Cancelado"
        w = requests.get(f"{BASE}/wallet", headers=H(plus_user)).json()
        assert w["plus"] == 20 and any(m["source"] == "refund" for m in w["moves"])

    def test_admin_status_flow_and_cancel_block(self, admin_tok):
        t = new_user()
        add_kit(t, INCL)
        o = requests.post(f"{BASE}/orders/checkout", headers=H(t), json={**ADDR, "request_id": uuid.uuid4().hex}).json()
        for s in ["En preparación", "Listo para envío", "En camino"]:
            r = requests.post(f"{BASE}/admin/orders/{o['id']}/status", headers=H(admin_tok), json={"status": s})
            assert r.status_code == 200 and r.json()["status"] == s, r.text
        g = requests.get(f"{BASE}/orders/{o['id']}", headers=H(t)).json()
        assert [s["done"] for s in g["timeline"]] == [True, True, True, True, False] and g["cancellable"] is False
        assert requests.post(f"{BASE}/orders/{o['id']}/cancel", headers=H(t)).status_code == 400
        assert requests.post(f"{BASE}/admin/orders/{o['id']}/status", headers=H(admin_tok), json={"status": "Cancelado"}).status_code == 400
        r = requests.post(f"{BASE}/admin/orders/{o['id']}/status", headers=H(admin_tok), json={"status": "Entregado"})
        assert r.status_code == 200 and r.json()["status"] == "Entregado"
        assert requests.post(f"{BASE}/admin/orders/{o['id']}/status", headers=H(admin_tok), json={"status": "Bogus"}).status_code in (400, 422)
        # favorite + repeat
        f = requests.post(f"{BASE}/orders/{o['id']}/favorite", headers=H(t))
        assert f.status_code == 200, f.text
        rp = requests.post(f"{BASE}/orders/{o['id']}/repeat", headers=H(t))
        assert rp.status_code == 200
        cart = requests.get(f"{BASE}/cart", headers=H(t)).json()
        assert len(cart["items"]) == 1 and cart["items"][0]["type"] == "kit"
        print("favorite resp:", f.json())

    def test_checkout_validation(self):
        t = new_user()
        add_kit(t, INCL)
        r = requests.post(f"{BASE}/orders/checkout", headers=H(t), json={**ADDR, "zip": "1"})
        assert r.status_code == 422
        r = requests.post(f"{BASE}/orders/checkout", headers=H(t), json={**ADDR, "shipping": "Express"})
        assert r.status_code == 422


# ---------- AI usage limits
class TestAI:
    def test_ai_limit(self, admin_tok):
        t = new_user()
        u = requests.get(f"{BASE}/me/ai-usage", headers=H(t)).json()
        assert u["used"] == 0 and u["limit"] == 15 and u["plus"] is False
        try:
            r = requests.put(f"{BASE}/admin/settings/plans", headers=H(admin_tok), json={"value": {**DEFAULT_PLANS, "ai_limit_free": 1}})
            assert r.status_code == 200, r.text
            p1 = requests.post(f"{BASE}/treatments/parse", headers=H(t), json={"text": "Quimio cada 21 días los lunes a las 9", "today": "2026-01-12"}, timeout=90)
            assert p1.status_code in (200, 503), p1.text
            print("parse 1:", p1.status_code)
            p2 = requests.post(f"{BASE}/treatments/parse", headers=H(t), json={"text": "Quimio cada 21 días", "today": "2026-01-12"}, timeout=90)
            assert p2.status_code == 429, p2.text
            assert requests.get(f"{BASE}/me/ai-usage", headers=H(t)).json()["used"] == 1
        finally:
            r = requests.put(f"{BASE}/admin/settings/plans", headers=H(admin_tok), json={"value": DEFAULT_PLANS})
            assert r.status_code == 200


# ---------- Admin
class TestAdmin:
    def test_memberships(self, admin_tok):
        r = requests.get(f"{BASE}/admin/memberships", headers=H(admin_tok))
        assert r.status_code == 200, r.text
        d = r.json()
        assert set(d["counts"]) == {"free", "plus", "institutional"} and d["plus_price"] == 79 and "credits_pending" in d
        c = requests.post(f"{BASE}/auth/login", json={"email": "acompanante@amodo.app", "password": "Demo1234"}).json()["token"]
        assert requests.get(f"{BASE}/admin/memberships", headers=H(c)).status_code == 403

    def test_profitability(self, admin_tok):
        r = requests.get(f"{BASE}/admin/profitability", headers=H(admin_tok))
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["sizes"]) == 3 and "premium" in d and d["sizes"][0]["scenarios"]

    @pytest.mark.parametrize("fmt", ["xlsx", "csv"])
    def test_export_link_one_time(self, admin_tok, fmt):
        r = requests.post(f"{BASE}/admin/catalog/export-link", params={"format": fmt}, headers=H(admin_tok))
        assert r.status_code == 200
        path = r.json()["path"]
        d = requests.get(ROOT + path)
        assert d.status_code == 200 and len(d.content) > 500
        assert ("spreadsheetml" in d.headers["content-type"]) if fmt == "xlsx" else ("text/csv" in d.headers["content-type"])
        assert requests.get(ROOT + path).status_code == 404

    def test_import_preview_apply_prices_unchanged(self, admin_tok):
        hdr = ["SKU", "Variante", "Proveedor", "Precio del paquete al mayoreo", "Unidades por paquete", "Estado de verificación del precio",
               "Precio público actual (solo lectura)", "Suplemento actual"]
        prods = requests.get(f"{BASE}/admin/products", headers=H(admin_tok))
        assert prods.status_code == 200, prods.text
        p = next(x for x in prods.json() if x.get("tier") == "premium")
        before_price, before_sup = p["price"], p.get("supplement")
        variant = (p.get("colors") or ["Única"])[0]

        def mk(rows):
            out = io.StringIO()
            w = csv.writer(out)
            w.writerow(hdr)
            for row in rows:
                w.writerow(row)
            return out.getvalue().encode("utf-8")
        bad = mk([[p["sku"], variant, "TEST_Prov", "100", "10", "Cotizado", "1", "1"], ["NOPE-SKU", "Única", "x", "1", "1", "Cotizado", "", ""]])
        r = requests.post(f"{BASE}/admin/catalog/import", headers=H(admin_tok), files={"file": ("c.csv", bad, "text/csv")}, data={"confirm": "true"})
        assert r.status_code == 200 and r.json()["errors"] and r.json()["applied"] == 0
        good = mk([[p["sku"], variant, p.get("supplier_name") or "TEST_Prov", "100", "10", "Cotizado", "1", "1"]])
        r = requests.post(f"{BASE}/admin/catalog/import", headers=H(admin_tok), files={"file": ("c.csv", good, "text/csv")}, data={"confirm": "false"})
        assert r.status_code == 200 and r.json()["applied"] == 0 and not r.json()["errors"], r.text
        print("preview:", r.json()["changes"])
        # NOTE: we don't apply (confirm=true) on seeded data to avoid modifying it; verify prices unchanged after preview
        after = next(x for x in requests.get(f"{BASE}/admin/products", headers=H(admin_tok)).json() if x["id"] == p["id"])
        assert after["price"] == before_price and after.get("supplement") == before_sup
