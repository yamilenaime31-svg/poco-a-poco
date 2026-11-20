# AMODO iteration 9: guided kits from trusted sources (NCI, ACS, MedlinePlus) + regression of templates/recommendations/cart.
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
NEEDS = ["nausea", "fatigue", "cold", "neuropathy", "mouth", "skin", "hair", "sleep", "memory", "feelings", "waiting", "visits", "recovery"]


def H(t):
    return {"Authorization": f"Bearer {t}"}


def new_user():
    r = requests.post(f"{BASE}/auth/register", json={"email": f"test_{uuid.uuid4().hex[:8]}@amodo.app", "password": "Demo1234",
                                                     "name": "TEST_ Iter9", "preferred_name": "TEST", "role": "patient", "consents": True})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def free_tok():
    return new_user()


@pytest.fixture(scope="module")
def plus_tok():
    t = new_user()
    r = requests.post(f"{BASE}/me/plan", headers=H(t), json={"action": "plus"})
    assert r.status_code == 200 and r.json()["tier"] == "plus", r.text
    r = requests.post(f"{BASE}/records/treatments", headers=H(t), json={"name": "Cirugía", "treatment_type": "Cirugía", "status": "En curso"})
    assert r.status_code == 200, r.text
    return t


# guided-kits list structure
class TestGuidedKitsList:
    def test_requires_auth(self):
        assert requests.get(f"{BASE}/guided-kits").status_code in (401, 403)

    def test_free_structure(self, free_tok):
        r = requests.get(f"{BASE}/guided-kits", headers=H(free_tok))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["plus"] is False and d["reviewed"]
        assert len(d["kits"]) == 13
        assert {k["id"] for k in d["kits"]} == {"g-" + n for n in NEEDS}
        for k in d["kits"]:
            assert k["name"] and isinstance(k["items"], list) and len(k["items"]) >= 3
            assert all(i.get("product") and i["product"].get("name") for i in k["items"]), f"missing product in {k['id']}"
            assert isinstance(k["total"], (int, float)) and k["total"] > 0
            g = k["guide"]
            assert g["label"] and len(g["tips"]) >= 1 and "precaution" in g and g["reviewed"]
            assert len(g["sources"]) >= 1 and all(s["url"].startswith("https://") and s["name"] for s in g["sources"])
            assert k["for_you"] == ""
            assert "_id" not in k

    def test_sources_trusted_domains(self, free_tok):
        d = requests.get(f"{BASE}/guided-kits", headers=H(free_tok)).json()
        for k in d["kits"]:
            for s in k["guide"]["sources"]:
                assert any(x in s["url"] for x in ("cancer.gov", "cancer.org", "medlineplus.gov")), s

    def test_plus_for_you_sorting(self, plus_tok):
        d = requests.get(f"{BASE}/guided-kits", headers=H(plus_tok)).json()
        assert d["plus"] is True
        tagged = [k for k in d["kits"] if k["for_you"]]
        assert tagged, "no for_you with Cirugía treatment"
        ids = [k["id"] for k in d["kits"]]
        assert "g-recovery" in {k["id"] for k in tagged}
        assert "g-cold" not in {k["id"] for k in tagged}  # cold is chemo-only
        # tagged go first
        first_untagged = next(i for i, k in enumerate(d["kits"]) if not k["for_you"])
        assert all(not k["for_you"] for k in d["kits"][first_untagged:]), ids

    def test_plus_declared_first(self, plus_tok):
        r = requests.put(f"{BASE}/recommendations/needs", headers=H(plus_tok), json={"needs": ["sleep"]})
        assert r.status_code == 200, r.text
        d = requests.get(f"{BASE}/guided-kits", headers=H(plus_tok)).json()
        assert d["kits"][0]["id"] == "g-sleep" and d["kits"][0]["for_you"] == "Elegiste este tema"


# guided template detail, cart and checkout
class TestGuidedKitDetailCart:
    def test_get_guided_kit(self, free_tok):
        r = requests.get(f"{BASE}/kits/g-sleep", headers=H(free_tok))
        assert r.status_code == 200, r.text
        k = r.json()
        assert k["id"] == "g-sleep" and k["template"] is True and k["guide"]["need"] == "sleep"
        assert k["context"] == "Basado en guías" and k["items"]

    def test_unknown_guided_404(self, free_tok):
        assert requests.get(f"{BASE}/kits/g-doesnotexist", headers=H(free_tok)).status_code == 404

    def test_cart_and_quote(self, free_tok):
        kit = requests.get(f"{BASE}/kits/g-memory", headers=H(free_tok)).json()
        r = requests.post(f"{BASE}/cart", headers=H(free_tok), json={"type": "kit", "ref_id": "g-memory", "qty": 1})
        assert r.status_code == 200, r.text
        items = [i for i in r.json()["items"] if i["ref_id"] == "g-memory"]
        assert len(items) == 1
        assert items[0]["name"] == kit["name"] and items[0]["price"] == kit["total"]
        q = requests.get(f"{BASE}/checkout/quote", headers=H(free_tok))
        assert q.status_code == 200, q.text
        qd = q.json()
        print("quote:", qd)
        for it in items:
            requests.put(f"{BASE}/cart/{it['id']}", headers=H(free_tok), json={"qty": 0})
        assert not [i for i in requests.get(f"{BASE}/cart", headers=H(free_tok)).json()["items"] if i["ref_id"] == "g-memory"]


# regression
class TestRegression:
    def test_template_t1(self, free_tok):
        r = requests.get(f"{BASE}/kits/t1", headers=H(free_tok))
        assert r.status_code == 200 and r.json()["id"] == "t1" and r.json()["template"] is True
        assert not r.json().get("guide")

    def test_suggested(self):
        r = requests.get(f"{BASE}/kits/suggested")
        assert r.status_code == 200 and len(r.json()) >= 1

    def test_recommendations(self, free_tok, plus_tok):
        for t in (free_tok, plus_tok):
            r = requests.get(f"{BASE}/recommendations", headers=H(t), params={"today": date.today().isoformat()})
            assert r.status_code == 200, r.text
            d = r.json()
            assert d.get("headline") and isinstance(d.get("products"), list) and isinstance(d.get("kits"), list)

    def test_demo_user_guided(self):
        r = requests.post(f"{BASE}/auth/login", json={"email": "demo@amodo.app", "password": "Demo1234"})
        assert r.status_code == 200
        d = requests.get(f"{BASE}/guided-kits", headers=H(r.json()["token"])).json()
        print("demo plus:", d["plus"], [(k["id"], k["for_you"]) for k in d["kits"]])
        assert len(d["kits"]) == 13
