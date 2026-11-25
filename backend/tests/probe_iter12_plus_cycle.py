# Probe: activate/cancel Plus cycle repeatedly — are monthly credits granted more than once per month?
import uuid
import requests
from test_amodo_iter12_purchase_membership import BASE, H, new_user

t = new_user()
for i in range(3):
    requests.post(f"{BASE}/me/plus/activate", headers=H(t))
    requests.post(f"{BASE}/me/plus/cancel", headers=H(t))
w = requests.get(f"{BASE}/wallet", headers=H(t)).json()
print("after 3 activate/cancel cycles plus balance:", w["plus"], "earned:", w["earned"])
# concurrent activation double-tap
import concurrent.futures as cf
t2 = new_user()
with cf.ThreadPoolExecutor(4) as ex:
    rs = list(ex.map(lambda _: requests.post(f"{BASE}/me/plus/activate", headers=H(t2)).status_code, range(4)))
print("concurrent activate statuses", rs, "plus:", requests.get(f"{BASE}/wallet", headers=H(t2)).json()["plus"])
# concurrent checkout same request_id
from test_amodo_iter12_purchase_membership import add_kit, ADDR, INCL
t3 = new_user()
add_kit(t3, INCL)
rid = uuid.uuid4().hex
with cf.ThreadPoolExecutor(3) as ex:
    rs = list(ex.map(lambda _: requests.post(f"{BASE}/orders/checkout", headers=H(t3), json={**ADDR, "request_id": rid}), range(3)))
print("concurrent checkout:", [(r.status_code, r.json().get("id", "")[:8], r.json().get("status")) for r in rs])
print("orders count:", len(requests.get(f"{BASE}/orders", headers=H(t3)).json()))
for o in requests.get(f"{BASE}/orders", headers=H(t3)).json():
    requests.post(f"{BASE}/orders/{o['id']}/cancel", headers=H(t3))
