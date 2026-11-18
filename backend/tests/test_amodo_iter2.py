# AMODO iteration 2: per-item sharing, invites (QR/link), organize AI parse/commit, recommendations, reorder
import os
import uuid
from datetime import date, datetime, timedelta, timezone
import pytest
import requests
from pymongo import MongoClient


def _base():
    url = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
    return url.rstrip("/")


def _env(key):
    for line in open("/app/backend/.env"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')


BASE = _base() + "/api"
TODAY = date.today().isoformat()


def H(t):
    return {"Authorization": f"Bearer {t}"}


def login(email, pw="Demo1234"):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return r.json()["token"], r.json()["user"]


@pytest.fixture(scope="module")
def patient():
    return login("demo@amodo.app")


@pytest.fixture(scope="module")
def caregiver():
    return login("acompanante@amodo.app")


@pytest.fixture(scope="module")
def mdb():
    c = MongoClient(_env("MONGO_URL"))
    yield c[_env("DB_NAME")]
    c.close()


@pytest.fixture(scope="module")
def fresh_user(mdb):
    email = f"test_{uuid.uuid4().hex[:8]}@amodo.app"
    r = requests.post(f"{BASE}/auth/register", json={"email": email, "password": "Test1234", "name": "TEST_User", "role": "patient", "consents": True})
    assert r.status_code == 200, r.text
    tok, u = r.json()["token"], r.json()["user"]
    yield tok, u
    mdb.users.delete_one({"id": u["id"]})
    mdb.links.delete_many({"$or": [{"patient_id": u["id"]}, {"caregiver_id": u["id"]}]})
    mdb.invites.delete_many({"patient_id": u["id"]})
    mdb.records.delete_many({"owner_id": u["id"]})


# --- per-item sharing
class TestSharing:
    def test_private_then_shared(self, patient, caregiver):
        (pt, pu), (ct, cu) = patient, caregiver
        r = requests.post(f"{BASE}/records/events", headers=H(pt), json={"title": "TEST_private_evt", "date": TODAY})
        assert r.status_code == 200 and r.json()["shared_with"] == []
        rid = r.json()["id"]
        try:
            lst = requests.get(f"{BASE}/records/events", headers=H(ct), params={"owner_id": pu["id"]}).json()
            assert rid not in [x["id"] for x in lst]
            assert requests.get(f"{BASE}/records/events/{rid}", headers=H(ct)).status_code == 403
            home = requests.get(f"{BASE}/home", headers=H(ct), params={"today": TODAY}).text
            assert "TEST_private_evt" not in home
            r = requests.put(f"{BASE}/records/events/{rid}", headers=H(pt), json={"shared_with": [cu["id"], "bogus-id"]})
            assert r.status_code == 200 and r.json()["shared_with"] == [cu["id"]]
            assert requests.get(f"{BASE}/records/events/{rid}", headers=H(ct)).status_code == 200
            lst = requests.get(f"{BASE}/records/events", headers=H(ct), params={"owner_id": pu["id"]}).json()
            assert rid in [x["id"] for x in lst]
        finally:
            requests.delete(f"{BASE}/records/events/{rid}", headers=H(pt))

    def test_shared_with_rejects_non_caregiver(self, patient, fresh_user):
        (pt, _), (_, fu) = patient, fresh_user
        r = requests.post(f"{BASE}/records/tasks", headers=H(pt), json={"title": "TEST_share_bad", "shared_with": [fu["id"]]})
        assert r.status_code == 200 and r.json()["shared_with"] == []
        requests.delete(f"{BASE}/records/tasks/{r.json()['id']}", headers=H(pt))


# --- invites
class TestInvites:
    def test_invite_lifecycle(self, fresh_user, caregiver, mdb):
        (ft, fu), (ct, cu) = fresh_user, caregiver
        r = requests.post(f"{BASE}/invites", headers=H(ft))
        assert r.status_code == 200
        tok = r.json()["token"]
        assert tok in [i["token"] for i in requests.get(f"{BASE}/invites", headers=H(ft)).json()]
        pv = requests.get(f"{BASE}/invites/{tok}", headers=H(ct))
        assert pv.status_code == 200 and pv.json()["own"] is False and pv.json()["patient_name"]
        assert requests.get(f"{BASE}/invites/{tok}", headers=H(ft)).json()["own"] is True
        assert requests.post(f"{BASE}/invites/{tok}/accept", headers=H(ft), json={}).status_code == 400
        a = requests.post(f"{BASE}/invites/{tok}/accept", headers=H(ct), json={"relation": "Amigo/a"})
        assert a.status_code == 200, a.text
        assert mdb.links.find_one({"patient_id": fu["id"], "caregiver_id": cu["id"], "status": "active"})
        # single use
        assert requests.post(f"{BASE}/invites/{tok}/accept", headers=H(ct), json={}).status_code == 410
        assert requests.get(f"{BASE}/invites/{tok}", headers=H(ct)).status_code == 410
        # now caregiver is valid share target for fresh_user
        r = requests.post(f"{BASE}/records/events", headers=H(ft), json={"title": "TEST_fu_evt", "shared_with": [cu["id"]]})
        assert r.json()["shared_with"] == [cu["id"]]

    def test_cancel_and_expired(self, fresh_user, caregiver, mdb):
        (ft, fu), (ct, _) = fresh_user, caregiver
        tok = requests.post(f"{BASE}/invites", headers=H(ft)).json()["token"]
        assert requests.delete(f"{BASE}/invites/{tok}", headers=H(ft)).status_code == 200
        assert tok not in [i["token"] for i in requests.get(f"{BASE}/invites", headers=H(ft)).json()]
        assert requests.post(f"{BASE}/invites/{tok}/accept", headers=H(ct), json={}).status_code == 410
        tok2 = requests.post(f"{BASE}/invites", headers=H(ft)).json()["token"]
        mdb.invites.update_one({"token": tok2}, {"$set": {"expires_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()}})
        assert requests.get(f"{BASE}/invites/{tok2}", headers=H(ct)).status_code == 410
        assert requests.post(f"{BASE}/invites/{tok2}/accept", headers=H(ct), json={}).status_code == 410
        assert requests.get(f"{BASE}/invites/nonexistent-token", headers=H(ct)).status_code == 410


# --- organize AI
class TestOrganize:
    TEXT = "El jueves tengo consulta a las 10, mi mamá me va a llevar, tengo que comprar unas cosas para mi kit y también recordar pagar el estacionamiento"

    def test_parse_and_commit(self, fresh_user, mdb):
        ft, fu = fresh_user
        r = requests.post(f"{BASE}/organize/parse", headers=H(ft), json={"text": self.TEXT, "today": TODAY}, timeout=90)
        assert r.status_code == 200, r.text
        items = r.json()["items"]
        print("PARSED:", items)
        cats = [i["category"] for i in items]
        assert len(items) >= 3 and "event" in cats
        ev = next(i for i in items if i["category"] == "event")
        assert ev["time"] == "10:00"
        assert datetime.strptime(ev["date"], "%Y-%m-%d").weekday() == 3
        # commit all except last
        sent = items[:-1]
        c = requests.post(f"{BASE}/organize/commit", headers=H(ft), json={"items": sent, "shared_with": []})
        assert c.status_code == 200 and c.json()["total"] == len(sent)
        saved = list(mdb.records.find({"owner_id": fu["id"], "source": "organiza"}))
        assert len(saved) == len(sent)
        assert items[-1]["title"] not in [s.get("title") or s.get("name") for s in saved]
        tr = [s for s in saved if s["kind"] == "transfers"]
        evs = {s["id"] for s in saved if s["kind"] == "events"}
        if tr and tr[0].get("linked_event_id"):
            assert tr[0]["linked_event_id"] in evs

    def test_commit_empty_and_short(self, fresh_user):
        ft, _ = fresh_user
        assert requests.post(f"{BASE}/organize/commit", headers=H(ft), json={"items": []}).status_code == 422
        assert requests.post(f"{BASE}/organize/commit", headers=H(ft), json={"items": [{"category": "bogus", "title": "x"}]}).status_code == 422
        assert requests.post(f"{BASE}/organize/parse", headers=H(ft), json={"text": "a", "today": TODAY}).status_code == 422


# --- recommendations
class TestRecommendations:
    def test_identity_hidden_then_shown_and_dismiss(self, fresh_user):
        ft, _ = fresh_user
        r = requests.get(f"{BASE}/recommendations", headers=H(ft), params={"today": TODAY})
        assert r.status_code == 200
        assert all(p["category"] != "Identidad y estilo" for p in r.json()["products"])
        requests.put(f"{BASE}/me", headers=H(ft), json={"profile": {"tastes": {"activities": ["Leer"]}, "identity": {"explore": "Sí", "accessories": ["Pañuelos"]}}})
        d = requests.get(f"{BASE}/recommendations", headers=H(ft), params={"today": TODAY}).json()
        print("RECO:", [(p["id"], p["category"], p["reasons"]) for p in d["products"]])
        assert d["personalized"] is True and all(p["reasons"] for p in d["products"])
        assert any(p["category"] == "Identidad y estilo" for p in d["products"])
        pid = d["products"][0]["id"]
        assert requests.post(f"{BASE}/recommendations/feedback", headers=H(ft), json={"product_id": pid, "action": "dismiss"}).status_code == 200
        d2 = requests.get(f"{BASE}/recommendations", headers=H(ft), params={"today": TODAY}).json()
        assert pid not in [p["id"] for p in d2["products"]]
        assert requests.post(f"{BASE}/recommendations/feedback", headers=H(ft), json={"product_id": pid, "action": "bad"}).status_code == 422
        requests.post(f"{BASE}/recommendations/feedback", headers=H(ft), json={"product_id": pid, "action": "reset"})
        d3 = requests.get(f"{BASE}/recommendations", headers=H(ft), params={"today": TODAY}).json()
        assert pid in [p["id"] for p in d3["products"]]

    def test_identity_products_and_reorder(self, patient):
        pt, _ = patient
        prods = requests.get(f"{BASE}/products", headers=H(pt)).json()
        ids = {p["id"] for p in prods if p["category"] == "Identidad y estilo"}
        assert {f"p{i}" for i in range(25, 33) if i != 31} <= ids
        r = requests.get(f"{BASE}/reorder", headers=H(pt))
        assert r.status_code == 200 and isinstance(r.json(), list)

    def test_kits_shared_caregiver(self, caregiver):
        ct, _ = caregiver
        r = requests.get(f"{BASE}/kits-shared", headers=H(ct))
        assert r.status_code == 200 and isinstance(r.json(), list)
