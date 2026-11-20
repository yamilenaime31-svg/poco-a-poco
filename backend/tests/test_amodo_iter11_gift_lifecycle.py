# AMODO iteration 11: gift kit lifecycle — cart detail, checkout share/notify, thanks, cancel revokes access, repeat/duplicate.
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
ADDR = {"recipient": "TEST_ Recibe", "phone": "5512345678", "street": "Calle Test 1", "city": "CDMX", "zip": "01000"}
THANKS = ["¡Gracias!", "Me encantó", "Me hizo el día", "Gracias por acompañarme"]
MSG = "TEST_ Para que descanses"


def H(t):
    return {"Authorization": f"Bearer {t}"}


def new_user(name, pref):
    r = requests.post(f"{BASE}/auth/register", json={"email": f"test_{uuid.uuid4().hex[:8]}@amodo.app", "password": "Demo1234",
                                                     "name": name, "preferred_name": pref, "role": "patient", "consents": True})
    assert r.status_code == 200, r.text
    d = r.json()
    return d["token"], d["user"]


def notes(tok):
    return requests.get(f"{BASE}/notifications", headers=H(tok)).json()


def clear_cart(tok):
    for i in requests.get(f"{BASE}/cart", headers=H(tok)).json()["items"]:
        requests.delete(f"{BASE}/cart/{i['id']}", headers=H(tok))


@pytest.fixture(scope="module")
def ctx():
    ptok, pat = new_user("TEST_Lucia Perez", "Lucia")
    ctok, cg = new_user("TEST_Carlos Cuida", "Carlos")
    code = requests.get(f"{BASE}/network", headers=H(ptok)).json()["invite_code"]
    r = requests.post(f"{BASE}/network/join", headers=H(ctok), json={"code": code, "relation": "Hermano"})
    assert r.status_code == 200 and r.json()["status"] == "active", r.text
    otok, other = new_user("TEST_Otro", "Otro")
    c = {"ptok": ptok, "pat": pat, "ctok": ctok, "cg": cg, "otok": otok, "other": other, "orders": [], "kits": []}
    yield c
    for oid in c["orders"]:
        requests.post(f"{BASE}/orders/{oid}/cancel", headers=H(ctok))
    clear_cart(ctok)
    for kid in c["kits"]:
        requests.delete(f"{BASE}/kits/{kid}", headers=H(ctok))


class TestGiftLifecycle:
    # cart detail shows recipient + message
    def test_cart_detail(self, ctx):
        r = requests.post(f"{BASE}/kits/g-sleep/gift", headers=H(ctx["ctok"]), json={"patient_id": ctx["pat"]["id"], "message": MSG})
        assert r.status_code == 200, r.text
        ctx["kid"] = r.json()["id"]
        ctx["kits"].append(ctx["kid"])
        cart = requests.get(f"{BASE}/cart", headers=H(ctx["ctok"])).json()
        it = next(i for i in cart["items"] if i["ref_id"] == ctx["kid"])
        assert it["gift"] is True
        assert it["detail"].startswith(f"Regalo para Lucia · «{MSG}»"), it["detail"]

    # checkout shares the gift and notifies
    def test_checkout_shares_and_notifies(self, ctx):
        o = requests.post(f"{BASE}/orders/checkout", headers=H(ctx["ctok"]), json=ADDR)
        assert o.status_code == 200, o.text
        ctx["oid"] = o.json()["id"]
        ctx["orders"].append(ctx["oid"])
        sh = requests.get(f"{BASE}/kits-shared", headers=H(ctx["ptok"])).json()
        k = next((x for x in sh if x["id"] == ctx["kid"]), None)
        assert k and k["gift"] is True and k["owner_name"] == "Carlos", sh
        assert sum(1 for n in notes(ctx["ptok"]) if n["title"] == "Carlos te envió un kit") == 1
        g = requests.get(f"{BASE}/kits/{ctx['kid']}", headers=H(ctx["ptok"])).json()
        assert g["from_name"] == "Carlos" and "· regalo" not in g["name"]

    # thanks validation
    def test_thanks_invalid_message_422(self, ctx):
        r = requests.post(f"{BASE}/kits/{ctx['kid']}/thanks", headers=H(ctx["ptok"]), json={"message": "hola"})
        assert r.status_code == 422
        r = requests.post(f"{BASE}/kits/{ctx['kid']}/thanks", headers=H(ctx["ptok"]), json={})
        assert r.status_code == 422

    def test_thanks_non_recipient_404(self, ctx):
        for tok in (ctx["otok"], ctx["ctok"]):
            r = requests.post(f"{BASE}/kits/{ctx['kid']}/thanks", headers=H(tok), json={"message": THANKS[0]})
            assert r.status_code == 404, r.text
        r = requests.post(f"{BASE}/kits/g-sleep/thanks", headers=H(ctx["ptok"]), json={"message": THANKS[0]})
        assert r.status_code == 404

    def test_thanks_ok(self, ctx):
        r = requests.post(f"{BASE}/kits/{ctx['kid']}/thanks", headers=H(ctx["ptok"]), json={"message": THANKS[2]})
        assert r.status_code == 200 and r.json() == {"ok": True, "thanks": THANKS[2]}
        n = next((x for x in notes(ctx["ctok"]) if x["title"] == "Lucia te dio las gracias"), None)
        assert n and THANKS[2] in n["body"] and n["link"] == f"/kit/{ctx['kid']}", n
        for tok in (ctx["ctok"], ctx["ptok"]):
            k = requests.get(f"{BASE}/kits/{ctx['kid']}", headers=H(tok)).json()
            assert k["thanks"]["message"] == THANKS[2]

    def test_thanks_repeat_behavior(self, ctx):
        # Informational: a second thanks is accepted and notifies again (no dedupe)
        r = requests.post(f"{BASE}/kits/{ctx['kid']}/thanks", headers=H(ctx["ptok"]), json={"message": THANKS[0]})
        cnt = sum(1 for n in notes(ctx["ctok"]) if n["title"] == "Lucia te dio las gracias")
        print(f"second thanks status={r.status_code} sender_thanks_notifs={cnt}")
        assert r.status_code in (200, 400, 409)

    # repeat order for a still-shared gift does not re-notify
    def test_repeat_no_renotify(self, ctx):
        r = requests.post(f"{BASE}/orders/{ctx['oid']}/repeat", headers=H(ctx["ctok"]))
        assert r.status_code == 200
        o = requests.post(f"{BASE}/orders/checkout", headers=H(ctx["ctok"]), json=ADDR)
        assert o.status_code == 200, o.text
        ctx["oid2"] = o.json()["id"]
        ctx["orders"].append(ctx["oid2"])
        assert sum(1 for n in notes(ctx["ptok"]) if n["title"] == "Carlos te envió un kit") == 1

    # cancel revokes access + notifies
    def test_cancel_revokes_and_notifies(self, ctx):
        r = requests.post(f"{BASE}/orders/{ctx['oid2']}/cancel", headers=H(ctx["ctok"]))
        assert r.status_code == 200, r.text
        sh = requests.get(f"{BASE}/kits-shared", headers=H(ctx["ptok"])).json()
        print(f"after cancelling the repeat order (original order still active): patient still has kit = {any(x['id'] == ctx['kid'] for x in sh)}")
        r = requests.post(f"{BASE}/orders/{ctx['oid']}/cancel", headers=H(ctx["ctok"]))
        assert r.status_code == 200, r.text
        sh = requests.get(f"{BASE}/kits-shared", headers=H(ctx["ptok"])).json()
        assert not any(x["id"] == ctx["kid"] for x in sh), sh
        assert requests.get(f"{BASE}/kits/{ctx['kid']}", headers=H(ctx["ptok"])).status_code == 404
        n = [x for x in notes(ctx["ptok"]) if x["title"] == "Un envío se canceló"]
        assert len(n) >= 1 and "Carlos" in n[0]["body"] and "· regalo" not in n[0]["body"], n
        assert requests.get(f"{BASE}/kits/{ctx['kid']}", headers=H(ctx["ctok"])).status_code == 200

    def test_thanks_after_cancel_404(self, ctx):
        r = requests.post(f"{BASE}/kits/{ctx['kid']}/thanks", headers=H(ctx["ptok"]), json={"message": THANKS[0]})
        assert r.status_code == 404

    # duplicate removes gift fields
    def test_duplicate_strips_gift(self, ctx):
        r = requests.post(f"{BASE}/kits/{ctx['kid']}/duplicate", headers=H(ctx["ctok"]))
        assert r.status_code == 200
        nid = r.json()["id"]
        ctx["kits"].append(nid)
        k = requests.get(f"{BASE}/kits/{nid}", headers=H(ctx["ctok"])).json()
        assert not k.get("gift") and not k.get("for_user_id") and not k.get("thanks"), k
        assert k["shared_with"] == [] and "_id" not in k
        print(f"duplicate keeps for_name={k.get('for_name')!r} note={k.get('note')!r}")

    def test_regift_after_cancel_notifies_again(self, ctx):
        requests.post(f"{BASE}/cart", headers=H(ctx["ctok"]), json={"type": "kit", "ref_id": ctx["kid"], "qty": 1})
        o = requests.post(f"{BASE}/orders/checkout", headers=H(ctx["ctok"]), json=ADDR)
        assert o.status_code == 200, o.text
        ctx["orders"].append(o.json()["id"])
        assert sum(1 for n in notes(ctx["ptok"]) if n["title"] == "Carlos te envió un kit") == 2
        requests.post(f"{BASE}/orders/{o.json()['id']}/cancel", headers=H(ctx["ctok"]))
