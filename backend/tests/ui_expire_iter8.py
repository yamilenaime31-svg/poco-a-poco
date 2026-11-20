# Marks a TEST_ user's demo Plus as expired (own test data only) to check "Beneficios vencidos".
import os
import sys

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/backend/.env")
email = sys.argv[1]
assert email.startswith("test_ui8_")
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
r = db.users.update_one({"email": email}, {"$set": {"plan": {"tier": "plus", "source": "demo", "until": "2025-06-01"}}})
print("modified", r.modified_count)
