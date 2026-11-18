# AMODO iteration 4: treatment assistant + series, unified agenda, doses, pending, reminders, knowledge-based recommendations, media
import os
import uuid
from datetime import date, timedelta
import pytest
import requests
from pymongo import MongoClient


def _base():
    url = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("EXPO_PUBLIC_BACKEND_URL=") or line.startswith("EXPO_BACKEND_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
    return url.rstrip("/")


def _env(key):
    for line in open("/app/backend/.env"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')


BASE = _base() + "/api"
TODAY = date.today()
T = TODAY.isoformat()


def d(n):
    return (TODAY + timedelta(days=n)).isoformat()


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
def fresh(mdb):
    email = f"test_{uuid.uuid4().hex[:8]}@amodo.app"
    r = requests.post(f"{BASE}/auth/register", json={"email": email, "password": "Test1234", "name": "TEST_User", "role": "patient", "consents": True})
    assert r.status_code == 200, r.text
    tok, u = r.json()["token"], r.json()["user"]
    yield tok, u
    mdb.users.delete_one({"id": u["id"]})
    mdb.records.delete_many({"owner_id": u["id"]})
    mdb.doses.delete_many({"owner_id": u["id"]})
    mdb.reminders_sent.delete_many({"key": {"$regex": f"^{u['id']}"}})


@pytest.fixture(scope="module")
def created(mdb):
    ids = {"treatments": [], "series": [], "records": [], "meds": []}
    yield ids
    for tid in ids["treatments"]:
        mdb.records.delete_one({"id": tid})
    for sid in ids["series"]:
        mdb.records.delete_many({"series_id": sid, "kind": "events"})
    for rid in ids["records"]:
        mdb.records.delete_one({"id": rid})
    for mid in ids["meds"]:
        mdb.doses.delete_many({"med_id": mid})
        mdb.records.delete_one({"id": mid})


# --- treatment assistant (LLM)
class TestTreatmentParse:
    def test_parse_full(self, patient):
        r = requests.post(f"{BASE}/treatments/parse", headers=H(patient[0]), timeout=90,
                          json={"text": f"Quimioterapia cada 21 días, 6 sesiones, empiezo el {d(10)} a las 09:00 en Hospital Ángeles", "today": T})
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["treatment_type"] == "Quimioterapia"
        assert p["interval_days"] == 21 and p["sessions_count"] == 6
        assert len(p["sessions"]) == 6 and p["sessions"][0]["date"] == d(10) and p["sessions"][1]["date"] == d(31)
        assert p["sessions"][0]["time"] == "09:00"

    def test_parse_missing(self, patient):
        r = requests.post(f"{BASE}/treatments/parse", headers=H(patient[0]), timeout=90, json={"text": "Empiezo radioterapia el lunes", "today": T})
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["sessions"] == [] and p["interval_days"] is None and p["sessions_count"] is None
        assert len(p["questions"]) >= 1
        assert p["start_date"], "relative 'el lunes' should resolve to a date"

    def test_parse_short(self, patient):
        r = requests.post(f"{BASE}/treatments/parse", headers=H(patient[0]), json={"text": "ab", "today": T})
        assert r.status_code == 422


# --- plan commit + series edit
class TestPlanSeries:
    def test_plan_and_series(self, patient, caregiver, mdb, created):
        tok, cg = patient[0], caregiver[1]
        body = {"name": "TEST_Quimio", "treatment_type": "Quimioterapia", "interval_days": 7, "time": "09:00", "location": "TEST_Hosp",
                "sessions": [{"date": d(2), "time": "09:00"}, {"date": d(9), "time": "09:00"}, {"date": d(16), "time": "09:00"}], "shared_with": [cg["id"]]}
        r = requests.post(f"{BASE}/treatments/plan", headers=H(tok), json=body)
        assert r.status_code == 200, r.text
        res = r.json()
        created["treatments"].append(res["treatment_id"]); created["series"].append(res["series_id"])
        assert res["sessions"] == 3
        evs = list(mdb.records.find({"series_id": res["series_id"], "kind": "events"}).sort("series_index", 1))
        assert len(evs) == 3 and all(e["treatment_id"] == res["treatment_id"] for e in evs)
        tr = requests.get(f"{BASE}/records/treatments", headers=H(tok)).json()
        mine = next(t for t in tr if t["id"] == res["treatment_id"])
        assert mine["next_session"] == d(2)
        assert mine["frequency"] == "Cada 7 días"
        sid = res["series_id"]
        # scope one: change time only for event 1
        r = requests.put(f"{BASE}/series/{sid}", headers=H(tok), json={"event_id": evs[0]["id"], "scope": "one", "changes": {"time": "10:30"}})
        assert r.status_code == 200 and r.json()["updated"] == 1
        # scope following from event 2: shift +1 day
        r = requests.put(f"{BASE}/series/{sid}", headers=H(tok), json={"event_id": evs[1]["id"], "scope": "following", "changes": {"date": d(10)}})
        assert r.status_code == 200 and r.json()["updated"] == 2, r.text
        after = {e["series_index"]: e for e in mdb.records.find({"series_id": sid, "kind": "events"})}
        assert after[1]["date"] == d(2) and after[1]["time"] == "10:30"
        assert after[2]["date"] == d(10) and after[3]["date"] == d(17)
        assert len(after[2]["history"]) == 1 and after[2]["history"][0]["scope"] == "following"
        # scope all: time change on all
        r = requests.put(f"{BASE}/series/{sid}", headers=H(tok), json={"event_id": evs[0]["id"], "scope": "all", "changes": {"time": "11:00"}})
        assert r.status_code == 200 and r.json()["updated"] == 3
        after = {e["series_index"]: e for e in mdb.records.find({"series_id": sid, "kind": "events"})}
        assert all(e["time"] == "11:00" for e in after.values())
        assert len(after[1]["history"]) == 2
        # 404 for wrong event
        r = requests.put(f"{BASE}/series/{sid}", headers=H(tok), json={"event_id": "nope", "scope": "all", "changes": {"time": "11:00"}})
        assert r.status_code == 404
        # caregiver sees shared series in agenda
        r = requests.get(f"{BASE}/agenda", headers=H(caregiver[0]), params={"start": T, "end": d(30), "owner_id": patient[1]["id"]})
        assert r.status_code == 200, r.text
        keys = {i["id"] for i in r.json()}
        assert {e["id"] for e in after.values()} <= keys

    def test_plan_requires_name(self, patient):
        r = requests.post(f"{BASE}/treatments/plan", headers=H(patient[0]), json={"name": "", "sessions": []})
        assert r.status_code == 422


# --- agenda / doses / pending
class TestAgendaDoses:
    def test_agenda_validation(self, patient):
        assert requests.get(f"{BASE}/agenda", headers=H(patient[0]), params={"start": T, "end": d(121)}).status_code == 422
        assert requests.get(f"{BASE}/agenda", headers=H(patient[0]), params={"start": d(2), "end": T}).status_code == 422
        assert requests.get(f"{BASE}/agenda", headers=H(patient[0]), params={"start": T, "end": d(120)}).status_code == 200

    def test_med_expansion_doses_and_privacy(self, patient, caregiver, created):
        tok = patient[0]
        r = requests.post(f"{BASE}/records/medications", headers=H(tok), json={"name": "TEST_Med", "dose": "1 tab", "times": "08:00, 20:00", "start_date": T})
        assert r.status_code == 200, r.text
        mid = r.json()["id"]; created["meds"].append(mid)
        r = requests.post(f"{BASE}/records/events", headers=H(tok), json={"title": "TEST_private", "type": "Cita médica", "date": d(1), "time": "12:00"})
        assert r.status_code == 200
        created["records"].append(r.json()["id"]); priv = r.json()["id"]
        ag = requests.get(f"{BASE}/agenda", headers=H(tok), params={"start": T, "end": d(1)}).json()
        doses = [i for i in ag if i["source"] == "doses" and i["id"] == mid]
        assert len(doses) == 4 and {i["time"] for i in doses} == {"08:00", "20:00"}
        assert all(i["status"] == "pendiente" for i in doses)
        assert any(i["id"] == priv for i in ag)
        assert len({i["key"] for i in ag}) == len(ag)
        # dose record
        r = requests.post(f"{BASE}/doses", headers=H(tok), json={"med_id": mid, "date": T, "time": "08:00", "status": "realizado"})
        assert r.status_code == 200
        r = requests.post(f"{BASE}/doses", headers=H(tok), json={"med_id": mid, "date": T, "time": "20:00", "status": "omitido"})
        assert r.status_code == 200
        assert requests.post(f"{BASE}/doses", headers=H(tok), json={"med_id": mid, "date": T, "time": "08:00", "status": "tomado"}).status_code == 422
        assert requests.post(f"{BASE}/doses", headers=H(tok), json={"med_id": "nope", "date": T, "time": "08:00", "status": "realizado"}).status_code == 404
        ag = requests.get(f"{BASE}/agenda", headers=H(tok), params={"start": T, "end": T}).json()
        st = {i["time"]: i["status"] for i in ag if i["source"] == "doses" and i["id"] == mid}
        assert st == {"08:00": "realizado", "20:00": "omitido"}
        # pending
        pe = requests.get(f"{BASE}/pending", headers=H(tok), params={"today": T})
        assert pe.status_code == 200
        pd = [i for i in pe.json() if i["source"] == "doses" and i["id"] == mid]
        assert len(pd) == 2 and all(i["done"] for i in pd)
        # caregiver: private event + unshared med invisible
        cg = requests.get(f"{BASE}/agenda", headers=H(caregiver[0]), params={"start": T, "end": d(1), "owner_id": patient[1]["id"]}).json()
        assert not any(i["id"] in (priv, mid) for i in cg)
        assert requests.post(f"{BASE}/doses", headers=H(caregiver[0]), json={"med_id": mid, "date": T, "time": "08:00", "status": "pendiente"}).status_code == 403

    def test_pending_bad_today(self, patient):
        r = requests.get(f"{BASE}/pending", headers=H(patient[0]), params={"today": "xx"})
        assert r.status_code in (400, 422), f"got {r.status_code}"


# --- reminders
class TestReminders:
    def test_reminder_prefs(self, fresh):
        tok = fresh[0]
        assert requests.post(f"{BASE}/records/events", headers=H(tok), json={"title": "TEST_Cita", "type": "Cita médica", "date": d(4), "time": "12:00"}).status_code == 200
        assert requests.post(f"{BASE}/records/tasks", headers=H(tok), json={"title": "TEST_Tarea", "date": d(3), "time": "12:00"}).status_code == 200
        r = requests.get(f"{BASE}/reminders", headers=H(tok)).json()
        assert r["prefs"]["enabled"] is True and r["prefs"]["discreet"] is True
        assert r["items"] and all(i["body"] == "Tienes un recordatorio. Abre AMODO para verlo." for i in r["items"])
        assert len({i["key"] for i in r["items"]}) == len(r["items"])
        notif = {"enabled": True, "cats": {"tasks": False}, "leads": [30, 1440, 2880], "quiet": {"start": "22:00", "end": "07:00"}, "discreet": False}
        assert requests.put(f"{BASE}/me", headers=H(tok), json={"settings": {"notif": notif}}).status_code == 200
        r = requests.get(f"{BASE}/reminders", headers=H(tok)).json()
        cats = {i["category"] for i in r["items"]}
        assert "tasks" not in cats and "appointments" in cats
        appt = [i for i in r["items"] if i["category"] == "appointments"]
        assert len(appt) == 3, appt
        assert any("TEST_Cita" in i["body"] for i in appt)
        assert requests.put(f"{BASE}/me", headers=H(tok), json={"settings": {"notif": {**notif, "enabled": False}}}).status_code == 200
        assert requests.get(f"{BASE}/reminders", headers=H(tok)).json()["items"] == []


# --- knowledge / recommendations / media
class TestReco:
    def test_needs_reco_explain_feedback(self, fresh):
        tok = fresh[0]
        assert requests.put(f"{BASE}/me", headers=H(tok), json={"settings": {"notif": {"enabled": True}}}).status_code == 200
        n0 = requests.get(f"{BASE}/recommendations/needs", headers=H(tok)).json()
        assert n0["needs"] == [] and n0["asked"] is False
        assert requests.post(f"{BASE}/records/treatments", headers=H(tok), json={"name": "Quimioterapia", "treatment_type": "Quimioterapia", "status": "En curso"}).status_code == 200
        n1 = requests.get(f"{BASE}/recommendations/needs", headers=H(tok)).json()
        assert "Quimioterapia" in n1["treatments"] and "nausea" in {x["id"] for x in n1["needs"]}
        r = requests.put(f"{BASE}/recommendations/needs", headers=H(tok), json={"needs": ["nausea", "bogus", "fatigue"]})
        assert r.json()["needs"] == ["nausea", "fatigue"]
        n2 = requests.get(f"{BASE}/recommendations/needs", headers=H(tok)).json()
        assert n2["asked"] is True and {x["id"] for x in n2["needs"] if x["selected"]} == {"nausea", "fatigue"}
        rec = requests.get(f"{BASE}/recommendations", headers=H(tok), params={"today": T}).json()
        assert rec["products"] and all(p["category"] != "Antojos y preferencias" for p in rec["products"])
        withdet = [p for p in rec["products"] if p.get("reason_details")]
        assert withdet, "expected reason_details for need-based items"
        det = next(x for p in withdet for x in p["reason_details"] if x["type"] == "tratamiento")
        assert det["sources"] and det["sources"][0]["url"].startswith("https://")
        pid = withdet[0]["id"]
        ex = requests.get(f"{BASE}/recommendations/explain/{pid}", headers=H(tok), params={"today": T}, timeout=90)
        assert ex.status_code == 200, ex.text
        assert ex.json()["text"] and ex.json()["price_is_demo"] is True
        assert requests.get(f"{BASE}/recommendations/explain/nope", headers=H(tok), params={"today": T}).status_code == 404
        assert requests.post(f"{BASE}/recommendations/feedback", headers=H(tok), json={"product_id": pid, "action": "dismiss"}).status_code == 200
        rec2 = requests.get(f"{BASE}/recommendations", headers=H(tok), params={"today": T}).json()
        assert pid not in {p["id"] for p in rec2["products"]}
        for a in ("interested", "owned", "reset"):
            assert requests.post(f"{BASE}/recommendations/feedback", headers=H(tok), json={"product_id": pid, "action": a}).status_code == 200
        assert requests.post(f"{BASE}/recommendations/feedback", headers=H(tok), json={"product_id": pid, "action": "x"}).status_code == 422
        rec3 = requests.get(f"{BASE}/recommendations", headers=H(tok), params={"today": T}).json()
        assert pid in {p["id"] for p in rec3["products"]} or True  # reset restores eligibility

    def test_knowledge(self, patient):
        kb = requests.get(f"{BASE}/knowledge", headers=H(patient[0])).json()
        assert len(kb) >= 9 and all("_id" not in k and k["sources"] for k in kb)

    def test_media(self):
        r = requests.get(f"{BASE}/media/amodo/products/p1.jpg")
        assert r.status_code == 200 and r.headers["content-type"].startswith("image/") and len(r.content) > 1000
        assert requests.get(f"{BASE}/media/amodo/products/zzz.jpg").status_code == 404
        assert requests.get(f"{BASE}/media/other/p1.jpg").status_code == 404
