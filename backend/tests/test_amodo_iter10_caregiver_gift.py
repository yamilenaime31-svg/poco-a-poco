# AMODO iteration 10: caregiver-aware guided kits ("Para <paciente>"), gift kit with message, gift notification on checkout + regression.
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
RADIO_NEEDS = {"nausea", "fatigue", "mouth", "skin", "hair", "sleep", "memory", "feelings", "waiting", "visits"}  # KB entries listing Radioterapia


def H(t):
    return {"Authorization": f"Bearer {t}"}


def new_user(name, pref):
    r = requests.post(f"{BASE}/auth/register", json={"email": f"test_{uuid.uuid4().hex[:8]}@amodo.app", "password": "Demo1234",
                                                     "name": name, "preferred_name": pref, "role": "patient", "consents": True})
    assert r.status_code == 200, r.text
    d = r.json()
    return d["token"], d["user"]


def kits(tok):
    r = requests.get(f"{BASE}/guided-kits", headers=H(tok))
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def ctx():
    ptok, pat = new_user("TEST_Lucia Perez", "Lucia")
    ctok, cg = new_user("TEST_Carlos Cuida", "Carlos")
    code = requests.get(f"{BASE}/network", headers=H(ptok)).json()["invite_code"]
    r = requests.post(f"{BASE}/network/join", headers=H(ctok), json={"code": code, "relation": "Hermano"})
    assert r.status_code == 200 and r.json()["status"] == "active", r.text
    # Shared Radioterapia, unshared Cirugía
    r1 = requests.post(f"{BASE}/records/treatments", headers=H(ptok), json={"name": "Radioterapia", "treatment_type": "Radioterapia", "status": "En curso", "shared_with": [cg["id"]]})
    r2 = requests.post(f"{BASE}/records/treatments", headers=H(ptok), json={"name": "Cirugía", "treatment_type": "Cirugía", "status": "En curso", "shared_with": []})
    assert r1.status_code == 200 and r2.status_code == 200
    assert cg["id"] in r1.json()["shared_with"]
    otok, other = new_user("TEST_Otro", "Otro")
    return {"ptok": ptok, "pat": pat, "ctok": ctok, "cg": cg, "otok": otok, "other": other, "orders": []}


# caregiver context for guided kits
class TestCaregiverGuidedKits:
    def test_both_free_no_for_you(self, ctx):
        d = kits(ctx["ctok"])
        assert d["plus"] is False
        assert all(k["for_you"] == "" for k in d["kits"]), [k["for_you"] for k in d["kits"]]

    def test_patient_plus_caregiver_sees_para_name_first(self, ctx):
        assert requests.post(f"{BASE}/me/plan", headers=H(ctx["ptok"]), json={"action": "plus"}).json()["tier"] == "plus"
        d = kits(ctx["ctok"])
        assert d["plus"] is True
        tagged = [k for k in d["kits"] if k["for_you"]]
        assert {k["id"][2:] for k in tagged} == RADIO_NEEDS, [k["id"] for k in tagged]
        assert all(k["for_you"] == "Para Lucia" for k in tagged)
        # sorted first
        n = len(tagged)
        assert all(k["for_you"] for k in d["kits"][:n]) and not any(k["for_you"] for k in d["kits"][n:])

    def test_unshared_treatment_not_used(self, ctx):
        d = kits(ctx["ctok"])
        by = {k["id"]: k for k in d["kits"]}
        assert by["g-recovery"]["for_you"] == "", "Cirugía (unshared) must not tag g-recovery"
        assert by["g-cold"]["for_you"] == ""  # Quimioterapia-only guide

    def test_patient_own_plus_view(self, ctx):
        d = kits(ctx["ptok"])
        by = {k["id"]: k for k in d["kits"]}
        assert by["g-recovery"]["for_you"] == "Para tu tratamiento"
        assert by["g-sleep"]["for_you"] == "Para tu tratamiento"

    def test_caregiver_plus_patient_free(self, ctx):
        requests.post(f"{BASE}/me/plan", headers=H(ctx["ptok"]), json={"action": "free"})
        requests.post(f"{BASE}/me/plan", headers=H(ctx["ctok"]), json={"action": "plus"})
        d = kits(ctx["ctok"])
        assert d["plus"] is True
        assert {k["id"][2:] for k in d["kits"] if k["for_you"] == "Para Lucia"} == RADIO_NEEDS
        requests.post(f"{BASE}/me/plan", headers=H(ctx["ctok"]), json={"action": "free"})

    def test_stranger_sees_nothing(self, ctx):
        d = kits(ctx["otok"])
        assert all(k["for_you"] == "" for k in d["kits"])

    def test_declared_need_tema_elegido_first(self, ctx):
        requests.post(f"{BASE}/me/plan", headers=H(ctx["otok"]), json={"action": "plus"})
        r = requests.put(f"{BASE}/recommendations/needs", headers=H(ctx["otok"]), json={"needs": ["memory"]})
        assert r.status_code == 200
        d = kits(ctx["otok"])
        assert d["kits"][0]["id"] == "g-memory" and d["kits"][0]["for_you"] == "Tema elegido"
        requests.post(f"{BASE}/me/plan", headers=H(ctx["otok"]), json={"action": "free"})


# gift kit
class TestGiftKit:
    def test_gift_non_template_404(self, ctx):
        r = requests.post(f"{BASE}/kits/nonexistent-xyz/gift", headers=H(ctx["ctok"]), json={"patient_id": ctx["pat"]["id"], "message": "hola"})
        assert r.status_code == 404

    def test_gift_unlinked_403(self, ctx):
        r = requests.post(f"{BASE}/kits/g-sleep/gift", headers=H(ctx["otok"]), json={"patient_id": ctx["pat"]["id"], "message": "hola"})
        assert r.status_code == 403

    def test_gift_missing_patient_422(self, ctx):
        r = requests.post(f"{BASE}/kits/g-sleep/gift", headers=H(ctx["ctok"]), json={"message": "hola"})
        assert r.status_code == 422

    def test_gift_full_flow(self, ctx):
        msg = "TEST_ Para que descanses mejor"
        r = requests.post(f"{BASE}/kits/g-sleep/gift", headers=H(ctx["ctok"]), json={"patient_id": ctx["pat"]["id"], "message": msg})
        assert r.status_code == 200, r.text
        kid = r.json()["id"]
        kit = r.json()["kit"]
        assert kit["gift"] is True and kit["for_user_id"] == ctx["pat"]["id"] and kit["note"] == msg
        assert kit["owner_id"] == ctx["cg"]["id"] and "_id" not in kit
        assert kit["guide"]["need"] == "sleep"
        # patient cannot see before checkout
        assert requests.get(f"{BASE}/kits/{kid}", headers=H(ctx["ptok"])).status_code == 404
        cart = requests.get(f"{BASE}/cart", headers=H(ctx["ctok"])).json()
        assert any(i["ref_id"] == kid for i in cart["items"]), cart
        o = requests.post(f"{BASE}/orders/checkout", headers=H(ctx["ctok"]), json=ADDR)
        assert o.status_code == 200, o.text
        ctx["orders"].append(o.json()["id"])
        notes = requests.get(f"{BASE}/notifications", headers=H(ctx["ptok"])).json()
        n = next((x for x in notes if "te envió un kit" in x.get("title", "")), None)
        assert n, notes
        assert n["title"] == "Carlos te envió un kit"
        assert msg in n["body"] and n["link"] == f"/kit/{kid}", n
        g = requests.get(f"{BASE}/kits/{kid}", headers=H(ctx["ptok"]))
        assert g.status_code == 200 and g.json()["note"] == msg
        ctx["gift_id"] = kid
        # patient cannot delete caregiver's gift kit
        requests.delete(f"{BASE}/kits/{kid}", headers=H(ctx["ptok"]))
        assert requests.get(f"{BASE}/kits/{kid}", headers=H(ctx["ctok"])).status_code == 200

    def test_gift_message_truncated(self, ctx):
        r = requests.post(f"{BASE}/kits/t1/gift", headers=H(ctx["ctok"]), json={"patient_id": ctx["pat"]["id"], "message": "x" * 500})
        assert r.status_code == 200, r.text
        assert len(r.json()["kit"]["note"]) == 300
        # cleanup cart
        cart = requests.get(f"{BASE}/cart", headers=H(ctx["ctok"])).json()
        for i in cart["items"]:
            requests.delete(f"{BASE}/cart/{i['id']}", headers=H(ctx["ctok"]))

    def test_cancel_orders(self, ctx):
        for oid in ctx["orders"]:
            r = requests.post(f"{BASE}/orders/{oid}/cancel", headers=H(ctx["ctok"]))
            assert r.status_code == 200, r.text


# regression
class TestRegression:
    def test_template_t1(self, ctx):
        r = requests.get(f"{BASE}/kits/t1", headers=H(ctx["ctok"]))
        assert r.status_code == 200 and r.json()["template"] is True

    def test_guided_template(self, ctx):
        r = requests.get(f"{BASE}/kits/g-sleep", headers=H(ctx["ctok"]))
        assert r.status_code == 200 and r.json()["guide"]["need"] == "sleep"

    def test_demo_caregiver_guided_kits(self):
        r = requests.post(f"{BASE}/auth/login", json={"email": "acompanante@amodo.app", "password": "Demo1234"})
        assert r.status_code == 200
        d = kits(r.json()["token"])
        assert len(d["kits"]) == 13
