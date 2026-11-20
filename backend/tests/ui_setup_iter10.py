# Iteration 10 UI setup: TEST_ patient (Plus, shared Radioterapia) + linked TEST_ caregiver; caregiver orders a gift kit (then cancels order). Prints JSON.
import json
import uuid

import requests
from test_amodo_iter10_caregiver_gift import ADDR, BASE, H


def reg(name, pref):
    email = f"test_ui10_{uuid.uuid4().hex[:6]}@amodo.app"
    d = requests.post(f"{BASE}/auth/register", json={"email": email, "password": "Demo1234", "name": name, "preferred_name": pref,
                                                     "role": "patient", "consents": True}).json()
    requests.put(f"{BASE}/me", headers=H(d["token"]), json={"onboarding_done": True})
    return email, d["token"], d["user"]


pe, pt, pu = reg("TEST_Lucia UI", "Lucia")
ce, ct, cu = reg("TEST_Carlos UI", "Carlos")
code = requests.get(f"{BASE}/network", headers=H(pt)).json()["invite_code"]
requests.post(f"{BASE}/network/join", headers=H(ct), json={"code": code, "relation": "Hermano"})
requests.post(f"{BASE}/me/plan", headers=H(pt), json={"action": "plus"})
requests.post(f"{BASE}/records/treatments", headers=H(pt), json={"name": "Radioterapia", "treatment_type": "Radioterapia", "status": "En curso", "shared_with": [cu["id"]]})
g = requests.post(f"{BASE}/kits/g-feelings/gift", headers=H(ct), json={"patient_id": pu["id"], "message": "TEST_ Con mucho cariño, Carlos"}).json()
o = requests.post(f"{BASE}/orders/checkout", headers=H(ct), json=ADDR).json()
requests.post(f"{BASE}/orders/{o['id']}/cancel", headers=H(ct))
print(json.dumps({"patient": pe, "caregiver": ce, "gift_id": g["id"], "patient_id": pu["id"]}))
