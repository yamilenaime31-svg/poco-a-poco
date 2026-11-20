# Creates a TEST_ Plus user with a Quimioterapia treatment for iteration 9 guided-kits UI checks. Prints the email.
import uuid

import requests
from test_amodo_iter9_guided_kits import BASE, H

email = f"test_ui9_{uuid.uuid4().hex[:6]}@amodo.app"
t = requests.post(f"{BASE}/auth/register", json={"email": email, "password": "Demo1234", "name": "TEST_ UI9", "preferred_name": "Tester",
                                                 "role": "patient", "consents": True}).json()["token"]
requests.post(f"{BASE}/me/plan", headers=H(t), json={"action": "plus"})
requests.put(f"{BASE}/me", headers=H(t), json={"onboarding_done": True})
requests.post(f"{BASE}/records/treatments", headers=H(t), json={"name": "Quimioterapia", "treatment_type": "Quimioterapia", "status": "En curso"})
requests.put(f"{BASE}/recommendations/needs", headers=H(t), json={"needs": ["sleep"]})
print(email)
