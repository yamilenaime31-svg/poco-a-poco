# Creates TEST_ users for iteration 8 UI checks (free, plus demo, CONVENIO-A, CONVENIO-C, caregiver, fresh unchosen). Prints JSON of emails.
import json
import uuid

from test_amodo_iter8_shipping_plans import BASE, H
import requests


def mk(role="patient", plan=None, code=None, onboard=True):
    email = f"test_ui8_{uuid.uuid4().hex[:6]}@amodo.app"
    r = requests.post(f"{BASE}/auth/register", json={"email": email, "password": "Demo1234", "name": "TEST_ UI8", "preferred_name": "Tester",
                                                     "role": role, "consents": True})
    t = r.json()["token"]
    if plan:
        requests.post(f"{BASE}/me/plan", headers=H(t), json={"action": plan})
    if code:
        requests.post(f"{BASE}/benefits/activate", headers=H(t), json={"code": code})
    if onboard:
        requests.put(f"{BASE}/me", headers=H(t), json={"onboarding_done": True})
    return email


print(json.dumps({"free": mk(plan="free"), "plus": mk(plan="plus"), "a": mk(code="CONVENIO-A"), "c": mk(code="CONVENIO-C"),
                  "cg": mk(role="caregiver", plan="free"), "fresh": mk(onboard=False)}))
