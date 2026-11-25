# UI setup iteration 12: TEST_ patient (free) with an own kit (Chico, 1 premium) — UI adds it to cart, checks out, activates Plus.
import json
import uuid

import requests
from test_amodo_iter12_purchase_membership import BASE, H, PREM

email = f"test_ui12_{uuid.uuid4().hex[:6]}@amodo.app"
r = requests.post(f"{BASE}/auth/register", json={"email": email, "password": "Demo1234", "name": "TEST_ UI12", "preferred_name": "Tester",
                                                 "role": "patient", "consents": True})
t = r.json()["token"]
requests.post(f"{BASE}/me/plan", headers=H(t), json={"tier": "free"})
k = requests.post(f"{BASE}/kits", headers=H(t), json={"name": "TEST_ Kit UI12", "size": "Chico", "items": [{"product_id": p} for p in PREM]}).json()
json.dump({"email": email, "token": t, "kit": k["id"]}, open("/tmp/ui12.json", "w"))
print(email, k["id"])
