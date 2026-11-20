# Iteration 11 UI setup: linked TEST_ patient/caregiver; caregiver orders a gift (active order) and leaves a 2nd gift in cart. Prints JSON.
import json
import uuid

import requests
from test_amodo_iter11_gift_lifecycle import ADDR, BASE, H


def reg(name, pref):
    email = f"test_ui11_{uuid.uuid4().hex[:6]}@amodo.app"
    d = requests.post(f"{BASE}/auth/register", json={"email": email, "password": "Demo1234", "name": name, "preferred_name": pref,
                                                     "role": "patient", "consents": True}).json()
    requests.put(f"{BASE}/me", headers=H(d["token"]), json={"onboarding_done": True})
    return email, d["token"], d["user"]


pe, pt, pu = reg("TEST_Lucia UI", "Lucia")
ce, ct, cu = reg("TEST_Carlos UI", "Carlos")
code = requests.get(f"{BASE}/network", headers=H(pt)).json()["invite_code"]
requests.post(f"{BASE}/network/join", headers=H(ct), json={"code": code, "relation": "Hermano"})
g = requests.post(f"{BASE}/kits/g-feelings/gift", headers=H(ct), json={"patient_id": pu["id"], "message": "TEST_ Con mucho cariño, Carlos"}).json()
o = requests.post(f"{BASE}/orders/checkout", headers=H(ct), json=ADDR).json()
g2 = requests.post(f"{BASE}/kits/g-sleep/gift", headers=H(ct), json={"patient_id": pu["id"], "message": "TEST_ Descansa"}).json()
print(json.dumps({"patient": pe, "caregiver": ce, "gift_id": g["id"], "gift2_id": g2["id"], "order_id": o["id"], "ctok": ct, "ptok": pt}))
