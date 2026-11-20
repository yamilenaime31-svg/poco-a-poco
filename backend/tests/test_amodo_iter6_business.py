# AMODO iteration 6: business model (kit sizes/pricing, plans, institutional codes, checkout breakdown, stock reservation, admin API)
import os
import uuid
import pytest
import requests


def _base():
    url = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("EXPO_BACKEND_URL=") or line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
    return url.rstrip("/")


BASE = _base() + "/api"
ADDR = {"recipient": "TEST_ Persona", "phone": "5512345678", "street": "Calle Demo 1", "city": "CDMX", "zip": "01000", "shipping": "Estándar"}
S = {}


def H(t):
    return {"Authorization": f"Bearer {t}"}


def login(email):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": "Demo1234"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin():
    return login("demo@amodo.app")


@pytest.fixture(scope="module")
def care():
    return login("acompanante@amodo.app")


@pytest.fixture(scope="module")
def fresh():
    email = f"test_{uuid.uuid4().hex[:8]}@amodo.app"
    r = requests.post(f"{BASE}/auth/register", json={"email": email, "password": "Demo1234", "name": "TEST_ Paciente", "preferred_name": "TEST",
                                                     "role": "patient", "consents": True})
    assert r.status_code == 200, r.text
    S["email"] = email
    return r.json()["token"]


def prod(admin, pid):
    return next(p for p in requests.get(f"{BASE}/admin/products", headers=H(admin)).json() if p["id"] == pid)


# --- catalog / kit sizes / quotes
class TestCatalogPricing:
    def test_kit_sizes(self):
        r = requests.get(f"{BASE}/kit-sizes")
        assert r.status_code == 200
        m = {s["id"]: (s["max"], s["base"]) for s in r.json()}
        assert m == {"Chico": (4, 299), "Mediano": (6, 499), "Grande": (10, 799)}

    def test_public_products_hide_internal(self):
        ps = requests.get(f"{BASE}/products").json()
        assert len(ps) > 30
        for p in ps:
            for k in ("unit_cost", "prep_cost", "supplier_id", "min_order", "ref_price", "stock", "stock_reserved"):
                assert k not in p, (p["id"], k)
            assert "tier" in p and "supplement" in p and "available" in p
        p13 = next(p for p in ps if p["id"] == "p13")
        assert p13["available"] is False
        one = requests.get(f"{BASE}/products/p34").json()
        assert "unit_cost" not in one and one["tier"] == "premium" and one["supplement"] == 120

    @pytest.mark.parametrize("ids,total", [(["p33", "p5", "p4", "p37"], 299), (["p34", "p5", "p4", "p37"], 419), (["p34", "p35", "p4", "p38"], 574)])
    def test_quote_examples(self, fresh, ids, total):
        r = requests.post(f"{BASE}/kits/quote", headers=H(fresh), json={"size": "Chico", "items": [{"product_id": i} for i in ids]})
        assert r.status_code == 200, r.text
        assert r.json()["subtotal"] == total

    def test_quote_capacity_422(self, fresh):
        r = requests.post(f"{BASE}/kits/quote", headers=H(fresh), json={"size": "Chico", "items": [{"product_id": i} for i in ["p33", "p5", "p4", "p37", "p34"]]})
        assert r.status_code == 422

    def test_create_kit_capacity_422(self, fresh):
        r = requests.post(f"{BASE}/kits", headers=H(fresh), json={"name": "TEST_ kit", "size": "Chico", "items": [{"product_id": i} for i in ["p33", "p5", "p4", "p37", "p34"]]})
        assert r.status_code == 422


# --- plans & codes (fresh user)
class TestPlansCodes:
    def test_validate(self, fresh):
        r = requests.post(f"{BASE}/benefits/validate", headers=H(fresh), json={"code": "hospital-demo"})
        assert r.status_code == 200, r.text
        assert r.json()["institution"]
        r = requests.post(f"{BASE}/benefits/validate", headers=H(fresh), json={"code": "FUNDACION-2024"})
        assert r.status_code == 400 and "vigente" in r.json()["detail"]  # iter7 message

    def test_activate_once(self, fresh):
        r = requests.post(f"{BASE}/benefits/activate", headers=H(fresh), json={"code": "HOSPITAL-DEMO"})
        assert r.status_code == 200, r.text
        r2 = requests.post(f"{BASE}/benefits/activate", headers=H(fresh), json={"code": "HOSPITAL-DEMO"})
        assert r2.status_code == 400
        p = requests.get(f"{BASE}/me/plan", headers=H(fresh)).json()
        assert p["tier"] == "plus" and p["source"] == "Institucional"
        kinds = {b["kind"]: b for b in p["benefits"]}
        assert kinds["kit_discount_pct"]["value"] == 15 and kinds["credit"]["remaining"] == 150

    def test_demo_plus_free(self, fresh):
        r = requests.post(f"{BASE}/me/plan", headers=H(fresh), json={"action": "plus"})
        assert r.status_code == 200 and r.json()["tier"] == "plus"
        assert requests.post(f"{BASE}/me/plan", headers=H(fresh), json={"action": "bogus"}).status_code == 422


# --- checkout, reservation, admin status transitions
class TestCheckout:
    def test_quote_and_checkout(self, fresh, admin):
        k = requests.post(f"{BASE}/kits", headers=H(fresh), json={"name": "TEST_ kit C", "size": "Chico", "items": [{"product_id": i} for i in ["p34", "p35", "p4", "p38"]]})
        assert k.status_code == 200, k.text
        assert k.json()["total"] == 574
        S["kit"] = k.json()["id"]
        requests.post(f"{BASE}/cart", headers=H(fresh), json={"type": "kit", "ref_id": S["kit"], "qty": 1})
        q = requests.get(f"{BASE}/checkout/quote", params={"shipping": "Estándar"}, headers=H(fresh)).json()
        assert q["kits"] == 574 and len(q["discounts"]) == 1 and q["discounts"][0]["amount"] == 86.1, q  # iter7 decimals
        assert q["credit"] == 150 and q["shipping"] == 0 and abs(q["total"] - (574 - 86.1 - 150)) < 0.01  # iter8: shipping included
        before = {p: prod(admin, p).get("stock_reserved", 0) for p in ["p34", "p35", "p4", "p38"]}
        o = requests.post(f"{BASE}/orders/checkout", headers=H(fresh), json=ADDR)
        assert o.status_code == 200, o.text
        o = o.json()
        S["order1"] = o["id"]
        assert o["status"] == "Pendiente de confirmación" and abs(o["total"] - 337.9) < 0.01 and o["credit"] == 150
        for p, n in before.items():
            assert prod(admin, p)["stock_reserved"] == n + 1
        p = requests.get(f"{BASE}/me/plan", headers=H(fresh)).json()
        assert next(b for b in p["benefits"] if b["kind"] == "credit")["remaining"] == 0

    def test_agotado_409(self, fresh):
        requests.post(f"{BASE}/cart", headers=H(fresh), json={"type": "product", "ref_id": "p13", "qty": 1})
        r = requests.post(f"{BASE}/orders/checkout", headers=H(fresh), json=ADDR)
        assert r.status_code == 409, r.text
        for c in requests.get(f"{BASE}/cart", headers=H(fresh)).json()["items"]:
            requests.delete(f"{BASE}/cart/{c['id']}", headers=H(fresh))

    def test_total_never_negative_big_credit(self, fresh, admin):
        code = f"TEST-{uuid.uuid4().hex[:6].upper()}"
        r = requests.post(f"{BASE}/admin/codes", headers=H(admin), json={"code": code, "institution": "TEST_ Inst", "benefits": {"credit": 5000}, "max_uses": 1, "budget": 5000})
        assert r.status_code == 200, r.text
        S["code"] = (r.json()["id"], code)
        assert requests.post(f"{BASE}/benefits/activate", headers=H(fresh), json={"code": code}).status_code == 200
        requests.post(f"{BASE}/cart", headers=H(fresh), json={"type": "product", "ref_id": "p5", "qty": 1})
        q = requests.get(f"{BASE}/checkout/quote", params={"shipping": "Estándar"}, headers=H(fresh)).json()
        assert q["items_total"] == 0 and q["total"] == 0, q  # iter8: shipping included
        o = requests.post(f"{BASE}/orders/checkout", headers=H(fresh), json=ADDR).json()
        S["order2"] = o["id"]
        assert o["total"] == 0

    def test_admin_enviado_and_cancel(self, admin, fresh):
        b = prod(admin, "p34")
        r = requests.post(f"{BASE}/admin/orders/{S['order1']}/status", headers=H(admin), json={"status": "Enviado"})
        assert r.status_code == 200 and r.json()["status"] == "Enviado"
        a = prod(admin, "p34")
        assert a["stock"] == b["stock"] - 1 and a["stock_reserved"] == b["stock_reserved"] - 1
        b5 = prod(admin, "p5")
        r = requests.post(f"{BASE}/orders/{S['order2']}/cancel", headers=H(fresh))
        assert r.status_code == 200 and r.json()["status"] == "Cancelado"
        assert prod(admin, "p5")["stock_reserved"] == b5["stock_reserved"] - 1
        assert requests.post(f"{BASE}/admin/orders/{S['order2']}/status", headers=H(admin), json={"status": "Confirmado"}).status_code == 400
        # restore shipped stock
        for p in ["p34", "p35", "p4", "p38"]:
            assert requests.post(f"{BASE}/admin/inventory", headers=H(admin), json={"product_id": p, "type": "entrada", "qty": 1, "note": "TEST_ restore"}).status_code == 200
        requests.post(f"{BASE}/admin/codes", headers=H(admin), json={"id": S["code"][0], "code": S["code"][1], "institution": "TEST_ Inst", "status": "pausado", "max_uses": 1})
        requests.delete(f"{BASE}/kits/{S['kit']}", headers=H(fresh))


# --- admin
class TestAdmin:
    @pytest.mark.parametrize("m,path", [("get", "/admin/overview"), ("get", "/admin/products"), ("get", "/admin/suppliers"), ("get", "/admin/codes"), ("get", "/admin/orders"),
                                        ("post", "/admin/costing"), ("put", "/admin/settings/sizes"), ("put", "/admin/products/p33"), ("post", "/admin/inventory")])
    def test_caregiver_403(self, care, m, path):
        r = getattr(requests, m)(f"{BASE}{path}", headers=H(care), json={"size": "Chico", "value": [], "product_id": "p33", "type": "entrada", "qty": 1})
        assert r.status_code == 403, (path, r.status_code)

    def test_overview(self, admin):
        r = requests.get(f"{BASE}/admin/overview", headers=H(admin))
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["alerts"], list) and d["products"] > 30
        S["costs"], S["plans"], S["sizes"] = d["costs"], d["plans"], d["sizes"]
        assert d["plans"]["stacking"] == "best"

    def test_costing(self, admin):
        r = requests.post(f"{BASE}/admin/costing", headers=H(admin), json={"size": "Chico", "item_costs": [35, 35, 35, 35]}).json()
        assert r["direct_cost"] == 265 and r["gross_margin"] == 34 and r["gross_margin_pct"] == 11.4  # iter8: +85 shipping in fixed costs

    def test_product_update_and_restore(self, admin):
        orig = prod(admin, "p33")
        r = requests.put(f"{BASE}/admin/products/p33", headers=H(admin), json={"description": "TEST_ desc", "unit_cost": 31})
        assert r.status_code == 200 and r.json()["description"] == "TEST_ desc"
        assert requests.get(f"{BASE}/products/p33").json()["description"] == "TEST_ desc"
        assert requests.put(f"{BASE}/admin/products/p33", headers=H(admin), json={"tier": "gold"}).status_code == 422
        requests.put(f"{BASE}/admin/products/p33", headers=H(admin), json={"description": orig["description"], "unit_cost": orig["unit_cost"]})
        assert prod(admin, "p33")["description"] == orig["description"]

    def test_inventory_types(self, admin):
        b = prod(admin, "p33")["stock"]
        for t, q in (("entrada", 2), ("salida", 1), ("ajuste", -1)):
            r = requests.post(f"{BASE}/admin/inventory", headers=H(admin), json={"product_id": "p33", "type": t, "qty": q, "note": "TEST_"})
            assert r.status_code == 200, r.text
        assert prod(admin, "p33")["stock"] == b
        assert requests.post(f"{BASE}/admin/inventory", headers=H(admin), json={"product_id": "p33", "type": "salida", "qty": 0}).status_code == 422

    def test_suppliers(self, admin):
        r = requests.get(f"{BASE}/admin/suppliers", headers=H(admin)).json()
        assert len(r) >= 3 and all("items" in s for s in r)

    def test_settings_roundtrip(self, admin):
        for key in ("sizes", "costs", "plans"):
            r = requests.put(f"{BASE}/admin/settings/{key}", headers=H(admin), json={"value": S[key]})
            assert r.status_code == 200, (key, r.text)
        assert requests.put(f"{BASE}/admin/settings/sizes", headers=H(admin), json={"value": [{"id": "Chico", "max": 4, "base": 299}]}).status_code == 422
        m = {s["id"]: s["base"] for s in requests.get(f"{BASE}/kit-sizes").json()}
        assert m == {"Chico": 299, "Mediano": 499, "Grande": 799}
