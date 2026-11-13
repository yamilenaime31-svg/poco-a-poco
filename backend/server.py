import asyncio
import hashlib
import logging
import os
import random
import secrets
import uuid
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, FastAPI, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, IndexModel
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
JWT_SECRET = os.environ['JWT_SECRET']
logger = logging.getLogger("amodo")

INDEXES: dict[str, list[IndexModel]] = {
    "users": [IndexModel([("email", ASCENDING)], name="email", unique=True),
              IndexModel([("id", ASCENDING)], name="id", unique=True),
              IndexModel([("invite_code", ASCENDING)], name="invite_code")],
    "records": [IndexModel([("owner_id", ASCENDING), ("kind", ASCENDING)], name="owner_kind"),
                IndexModel([("id", ASCENDING)], name="id", unique=True),
                IndexModel([("assignee_id", ASCENDING)], name="assignee")],
    "links": [IndexModel([("patient_id", ASCENDING)], name="patient"),
              IndexModel([("caregiver_id", ASCENDING)], name="caregiver"),
              IndexModel([("caregiver_email", ASCENDING)], name="caregiver_email")],
    "signals": [IndexModel([("patient_id", ASCENDING), ("created_at", DESCENDING)], name="patient_created")],
    "notifications": [IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created")],
    "products": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("category", ASCENDING)], name="category")],
    "kits": [IndexModel([("owner_id", ASCENDING)], name="owner")],
    "cart": [IndexModel([("user_id", ASCENDING)], name="user")],
    "orders": [IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created")],
    "favorites": [IndexModel([("user_id", ASCENDING), ("product_id", ASCENDING)], name="user_product", unique=True)],
    "resets": [IndexModel([("email", ASCENDING)], name="email")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


app = FastAPI()


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------- helpers
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def uid() -> str:
    return str(uuid.uuid4())


def clean(doc: Optional[dict]) -> Optional[dict]:
    if doc is None:
        return None
    doc = dict(doc)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def check_pw(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except ValueError:
        return False


def make_token(user_id: str) -> str:
    t = datetime.now(timezone.utc)
    return jwt.encode({"sub": user_id, "iat": t, "exp": t + timedelta(days=7), "type": "access"}, JWT_SECRET, algorithm="HS256")


def new_code() -> str:
    return "".join(random.choices("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", k=6))


async def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    if not creds:
        raise HTTPException(401, "Inicia sesión para continuar")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"], options={"require": ["sub", "exp"]})
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Tu sesión expiró. Inicia sesión de nuevo")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(401, "Usuario no encontrado")
    return user


async def notify(user_id: Optional[str], title: str, body: str, kind: str = "general", link: str = ""):
    if not user_id:
        return
    await db.notifications.insert_one({"id": uid(), "user_id": user_id, "title": title, "body": body,
                                       "kind": kind, "link": link, "read": False, "created_at": now_iso()})


def display_name(u: dict) -> str:
    return u.get("preferred_name") or u.get("name") or "Alguien"


# ---------------------------------------------------------------- auth
class RegisterIn(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    preferred_name: str = ""
    role: str = "patient"
    consents: bool = False


class LoginIn(BaseModel):
    email: str
    password: str


def norm_email(e: str) -> str:
    e = e.strip().lower()
    if "@" not in e or "." not in e.split("@")[-1]:
        raise HTTPException(422, "Escribe un correo válido")
    return e


async def create_user(email: str, password: str, name: str, preferred: str, role: str, onboarding_done=False) -> dict:
    user = {"id": uid(), "email": email, "password_hash": hash_pw(password), "name": name.strip(),
            "preferred_name": (preferred or name).strip(), "role": role, "roles": [role],
            "invite_code": new_code(), "onboarding_done": onboarding_done, "profile": {},
            "settings": {"text_scale": 1, "reduce_motion": False, "notif_agenda": True, "notif_signals": True, "notif_orders": True},
            "created_at": now_iso()}
    await db.users.insert_one(user)
    return user


@api.post("/auth/register")
async def register(body: RegisterIn):
    email = norm_email(body.email)
    if body.role not in ("patient", "caregiver"):
        raise HTTPException(422, "Rol no válido")
    if not body.consents:
        raise HTTPException(422, "Necesitamos tu consentimiento para continuar")
    if await db.users.find_one({"email": email}):
        raise HTTPException(409, "Ya existe una cuenta con este correo")
    user = await create_user(email, body.password, body.name, body.preferred_name, body.role)
    return {"token": make_token(user["id"]), "user": clean(user)}


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.strip().lower()})
    if not user or not check_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Correo o contraseña incorrectos")
    return {"token": make_token(user["id"]), "user": clean(user)}


@api.post("/auth/demo")
async def demo_login(role: str = Body("patient", embed=True)):
    email = "acompanante@amodo.app" if role == "caregiver" else "demo@amodo.app"
    user = await db.users.find_one({"email": email})
    if not user:
        await seed_demo()
        user = await db.users.find_one({"email": email})
    return {"token": make_token(user["id"]), "user": clean(user)}


@api.post("/auth/forgot")
async def forgot(email: str = Body(..., embed=True)):
    e = email.strip().lower()
    code = f"{secrets.randbelow(1000000):06d}"
    if await db.users.find_one({"email": e}):
        await db.resets.delete_many({"email": e})
        await db.resets.insert_one({"email": e, "code_hash": hashlib.sha256(code.encode()).hexdigest(),
                                    "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()})
    # No email provider yet: the code is returned so the flow can be completed in the demo.
    return {"message": "Si el correo está registrado, te enviamos un código.", "demo_code": code}


class ResetIn(BaseModel):
    email: str
    code: str
    new_password: str = Field(min_length=8, max_length=128)


@api.post("/auth/reset")
async def reset(body: ResetIn):
    e = body.email.strip().lower()
    rec = await db.resets.find_one({"email": e, "code_hash": hashlib.sha256(body.code.strip().encode()).hexdigest()})
    if not rec or rec["expires_at"] < now_iso():
        raise HTTPException(400, "El código no es válido o ya expiró")
    await db.users.update_one({"email": e}, {"$set": {"password_hash": hash_pw(body.new_password)}})
    await db.resets.delete_many({"email": e})
    return {"message": "Contraseña actualizada"}


@api.get("/me")
async def me(user=Depends(current_user)):
    return clean(user)


@api.put("/me")
async def update_me(body: dict = Body(...), user=Depends(current_user)):
    s: dict[str, Any] = {}
    for k in ("name", "preferred_name", "onboarding_done"):
        if k in body:
            s[k] = body[k]
    if body.get("role") in ("patient", "caregiver"):
        s["role"] = body["role"]
        s["roles"] = sorted(set(user.get("roles", [])) | {body["role"]})
    for group in ("profile", "settings"):
        if isinstance(body.get(group), dict):
            for k, v in body[group].items():
                s[f"{group}.{k}"] = v
    if s:
        await db.users.update_one({"id": user["id"]}, {"$set": s})
    return clean(await db.users.find_one({"id": user["id"]}))


# ---------------------------------------------------------------- network / permissions
DEFAULT_PERMS = {"events": True, "tasks": True, "transfers": True, "expenses": False,
                 "treatments": False, "medications": False, "journal": False, "edit": True, "signals": True}
KINDS = {"events", "treatments", "medications", "tasks", "transfers", "expenses", "journal"}


def perms_for(patient: dict) -> dict:
    return {**DEFAULT_PERMS, **(patient.get("profile", {}).get("privacy", {}).get("share", {}) or {})}


async def active_link(patient_id: str, caregiver_id: str) -> Optional[dict]:
    return await db.links.find_one({"patient_id": patient_id, "caregiver_id": caregiver_id, "status": "active"})


async def resolve_owner(me: dict, owner_id: Optional[str], kind: str, write=False) -> str:
    if not owner_id or owner_id == me["id"]:
        return me["id"]
    link = await active_link(owner_id, me["id"])
    if not link or not link["permissions"].get(kind):
        raise HTTPException(403, "No tienes permiso para ver esta información")
    if write and not link["permissions"].get("edit"):
        raise HTTPException(403, "Esta persona no te ha dado permiso para editar")
    return owner_id


async def enrich_link(link: dict) -> dict:
    link = clean(link)
    p = await db.users.find_one({"id": link["patient_id"]})
    c = await db.users.find_one({"id": link["caregiver_id"]}) if link.get("caregiver_id") else None
    link["patient_name"] = display_name(p) if p else ""
    link["caregiver_name"] = display_name(c) if c else (link.get("caregiver_name") or link.get("caregiver_email"))
    return link


@api.get("/network")
async def network(user=Depends(current_user)):
    as_patient = [await enrich_link(link) async for link in db.links.find({"patient_id": user["id"]})]
    as_caregiver = [await enrich_link(link) async for link in db.links.find(
        {"$or": [{"caregiver_id": user["id"]}, {"caregiver_email": user["email"]}], "patient_id": {"$ne": user["id"]}})]
    return {"invite_code": user.get("invite_code"), "as_patient": as_patient, "as_caregiver": as_caregiver}


@api.post("/network/join")
async def join_by_code(code: str = Body(..., embed=True), relation: str = Body("", embed=True), user=Depends(current_user)):
    patient = await db.users.find_one({"invite_code": code.strip().upper()})
    if not patient:
        raise HTTPException(404, "No encontramos ese código. Revísalo con la persona que te lo compartió")
    if patient["id"] == user["id"]:
        raise HTTPException(400, "Este es tu propio código")
    existing = await db.links.find_one({"patient_id": patient["id"], "caregiver_id": user["id"]})
    if existing:
        await db.links.update_one({"id": existing["id"]}, {"$set": {"status": "active"}})
        return await enrich_link(await db.links.find_one({"id": existing["id"]}))
    link = {"id": uid(), "patient_id": patient["id"], "caregiver_id": user["id"], "caregiver_email": user["email"],
            "relation": relation, "status": "active", "permissions": perms_for(patient), "created_at": now_iso()}
    await db.links.insert_one(link)
    await notify(patient["id"], "Nueva persona en tu red", f"{display_name(user)} se unió con tu código.", "network", "/network")
    return await enrich_link(link)


@api.post("/network/request")
async def request_by_email(email: str = Body(..., embed=True), relation: str = Body("", embed=True), user=Depends(current_user)):
    patient = await db.users.find_one({"email": email.strip().lower()})
    if not patient:
        raise HTTPException(404, "No encontramos una cuenta con ese correo")
    if patient["id"] == user["id"]:
        raise HTTPException(400, "No puedes enviarte una solicitud a ti")
    if await db.links.find_one({"patient_id": patient["id"], "caregiver_id": user["id"], "status": {"$in": ["active", "pending_patient"]}}):
        raise HTTPException(409, "Ya existe una solicitud o vínculo con esta persona")
    link = {"id": uid(), "patient_id": patient["id"], "caregiver_id": user["id"], "caregiver_email": user["email"],
            "relation": relation, "status": "pending_patient", "permissions": perms_for(patient), "created_at": now_iso()}
    await db.links.insert_one(link)
    await notify(patient["id"], "Solicitud de acompañamiento", f"{display_name(user)} quiere acompañarte. Tú decides.", "network", "/network")
    return await enrich_link(link)


@api.post("/network/invite")
async def invite(email: str = Body(..., embed=True), name: str = Body("", embed=True), relation: str = Body("", embed=True), user=Depends(current_user)):
    e = norm_email(email)
    if e == user["email"]:
        raise HTTPException(400, "Escribe el correo de otra persona")
    if await db.links.find_one({"patient_id": user["id"], "caregiver_email": e}):
        raise HTTPException(409, "Ya invitaste a esta persona")
    cg = await db.users.find_one({"email": e})
    link = {"id": uid(), "patient_id": user["id"], "caregiver_id": cg["id"] if cg else None, "caregiver_email": e,
            "caregiver_name": name, "relation": relation, "status": "pending_caregiver", "permissions": perms_for(user), "created_at": now_iso()}
    await db.links.insert_one(link)
    if cg:
        await notify(cg["id"], "Invitación a acompañar", f"{display_name(user)} te invitó a su red de apoyo.", "network", "/network")
    return await enrich_link(link)


async def get_link(link_id: str) -> dict:
    link = await db.links.find_one({"id": link_id})
    if not link:
        raise HTTPException(404, "Vínculo no encontrado")
    return link


@api.post("/network/{link_id}/accept")
async def accept_link(link_id: str, user=Depends(current_user)):
    link = await get_link(link_id)
    if link["status"] == "pending_patient" and link["patient_id"] == user["id"]:
        await db.links.update_one({"id": link_id}, {"$set": {"status": "active"}})
        await notify(link["caregiver_id"], "Solicitud aceptada", f"{display_name(user)} aceptó tu acompañamiento.", "network", "/network")
    elif link["status"] == "pending_caregiver" and (link.get("caregiver_id") == user["id"] or link.get("caregiver_email") == user["email"]):
        await db.links.update_one({"id": link_id}, {"$set": {"status": "active", "caregiver_id": user["id"]}})
        await notify(link["patient_id"], "Invitación aceptada", f"{display_name(user)} ya forma parte de tu red.", "network", "/network")
    else:
        raise HTTPException(403, "No puedes aceptar este vínculo")
    return await enrich_link(await db.links.find_one({"id": link_id}))


@api.delete("/network/{link_id}")
async def remove_link(link_id: str, user=Depends(current_user)):
    link = await get_link(link_id)
    if user["id"] not in (link["patient_id"], link.get("caregiver_id")) and link.get("caregiver_email") != user["email"]:
        raise HTTPException(403, "No puedes modificar este vínculo")
    await db.links.delete_one({"id": link_id})
    return {"ok": True}


@api.put("/network/{link_id}/permissions")
async def update_perms(link_id: str, body: dict = Body(...), user=Depends(current_user)):
    link = await get_link(link_id)
    if link["patient_id"] != user["id"]:
        raise HTTPException(403, "Solo la persona acompañada decide los permisos")
    perms = {**link["permissions"], **{k: bool(v) for k, v in body.items() if k in DEFAULT_PERMS}}
    await db.links.update_one({"id": link_id}, {"$set": {"permissions": perms}})
    return await enrich_link(await db.links.find_one({"id": link_id}))


# ---------------------------------------------------------------- records
def sort_key(r: dict) -> str:
    return f"{r.get('date') or '9999'} {r.get('time') or ''}"


@api.get("/records/{kind}")
async def list_records(kind: str, owner_id: Optional[str] = None, assigned: Optional[str] = None, user=Depends(current_user)):
    if kind not in KINDS:
        raise HTTPException(404, "Sección no encontrada")
    if assigned == "me":
        q = {"kind": kind, "assignee_id": user["id"]}
    else:
        q = {"kind": kind, "owner_id": await resolve_owner(user, owner_id, kind)}
    items = [clean(r) async for r in db.records.find(q).limit(500)]
    if kind in ("events", "transfers", "tasks"):
        items.sort(key=sort_key)
    else:
        items.sort(key=lambda r: r.get("date") or r.get("created_at", ""), reverse=True)
    if assigned == "me":
        names = {}
        for r in items:
            if r["owner_id"] not in names:
                o = await db.users.find_one({"id": r["owner_id"]})
                names[r["owner_id"]] = display_name(o) if o else ""
            r["owner_name"] = names[r["owner_id"]]
    return items


async def load_record(kind: str, rid: str, user: dict, write=False) -> dict:
    rec = await db.records.find_one({"id": rid, "kind": kind})
    if not rec:
        raise HTTPException(404, "No encontramos este registro")
    if rec["owner_id"] != user["id"]:
        if not (kind == "tasks" and rec.get("assignee_id") == user["id"]):
            await resolve_owner(user, rec["owner_id"], kind, write)
    return rec


async def check_assignee(assignee_id: Optional[str], owner_id: str, user: dict):
    """Assignee must be the owner, the caller, or someone in the owner's active network."""
    if not assignee_id or assignee_id in (owner_id, user["id"]):
        return
    ok = await db.links.find_one({"status": "active", "$or": [{"patient_id": owner_id, "caregiver_id": assignee_id},
                                                              {"patient_id": assignee_id, "caregiver_id": owner_id}]})
    if not ok:
        raise HTTPException(422, "Solo puedes asignar pendientes a personas de la red")


@api.get("/records/{kind}/{rid}")
async def get_record(kind: str, rid: str, user=Depends(current_user)):
    return clean(await load_record(kind, rid, user))


PROTECTED = {"id", "_id", "kind", "owner_id", "created_by", "created_at"}


@api.post("/records/{kind}")
async def create_record(kind: str, body: dict = Body(...), user=Depends(current_user)):
    if kind not in KINDS:
        raise HTTPException(404, "Sección no encontrada")
    owner = await resolve_owner(user, body.get("owner_id"), kind, write=True)
    rec = {k: v for k, v in body.items() if k not in PROTECTED}
    rec.update({"id": uid(), "kind": kind, "owner_id": owner, "created_by": user["id"], "created_at": now_iso()})
    if kind == "tasks":
        rec.setdefault("done", False)
        await check_assignee(rec.get("assignee_id"), owner, user)
    await db.records.insert_one(rec)
    if owner != user["id"]:
        await notify(owner, "Nuevo en tu espacio", f"{display_name(user)} agregó: {rec.get('title') or rec.get('name') or 'un registro'}", "records")
    if kind == "tasks" and rec.get("assignee_id") and rec["assignee_id"] != user["id"]:
        await notify(rec["assignee_id"], "Te asignaron un pendiente", rec.get("title", ""), "tasks", "/records/tasks?assigned=me")
    return clean(rec)


@api.put("/records/{kind}/{rid}")
async def update_record(kind: str, rid: str, body: dict = Body(...), user=Depends(current_user)):
    rec = await load_record(kind, rid, user, write=True)
    s = {k: v for k, v in body.items() if k not in PROTECTED}
    if kind == "tasks" and "assignee_id" in s:
        await check_assignee(s["assignee_id"], rec["owner_id"], user)
    s["updated_at"] = now_iso()
    await db.records.update_one({"id": rid}, {"$set": s})
    if kind == "tasks" and s.get("done") and rec["owner_id"] != user["id"]:
        await notify(rec["owner_id"], "Pendiente resuelto", f"{display_name(user)} completó: {rec.get('title', '')}", "tasks")
    return clean(await db.records.find_one({"id": rid}))


@api.delete("/records/{kind}/{rid}")
async def delete_record(kind: str, rid: str, user=Depends(current_user)):
    await load_record(kind, rid, user, write=True)
    await db.records.delete_one({"id": rid})
    return {"ok": True}


# ---------------------------------------------------------------- signals
class SignalIn(BaseModel):
    type: str
    label: str
    message: str = ""
    urgency: str = "Cuando puedas"


@api.post("/signals")
async def send_signal(body: SignalIn, user=Depends(current_user)):
    links = [link async for link in db.links.find({"patient_id": user["id"], "status": "active"})]
    sig = {"id": uid(), "patient_id": user["id"], "patient_name": display_name(user), **body.model_dump(),
           "status": "enviada", "responses": [], "recipients": len(links), "created_at": now_iso()}
    await db.signals.insert_one(sig)
    for link in links:
        if link.get("permissions", {}).get("signals", True):
            await notify(link["caregiver_id"], f"{display_name(user)}: {body.label}", body.message or body.urgency, "signal", "/signals")
    return clean(sig)


@api.get("/signals")
async def list_signals(box: str = "sent", user=Depends(current_user)):
    if box == "received":
        pids = [link["patient_id"] async for link in db.links.find({"caregiver_id": user["id"], "status": "active"})]
        q = {"patient_id": {"$in": pids}}
    else:
        q = {"patient_id": user["id"]}
    return [clean(s) async for s in db.signals.find(q).sort("created_at", -1).limit(100)]


@api.post("/signals/{sid}/respond")
async def respond_signal(sid: str, text: str = Body(..., embed=True), user=Depends(current_user)):
    sig = await db.signals.find_one({"id": sid})
    if not sig:
        raise HTTPException(404, "Señal no encontrada")
    if not await active_link(sig["patient_id"], user["id"]):
        raise HTTPException(403, "No formas parte de la red de esta persona")
    resp = {"by": user["id"], "name": display_name(user), "text": text, "at": now_iso()}
    await db.signals.update_one({"id": sid}, {"$push": {"responses": resp}, "$set": {"status": "atendida"}})
    await notify(sig["patient_id"], f"{display_name(user)} respondió", text, "signal", "/signals")
    return clean(await db.signals.find_one({"id": sid}))


@api.post("/signals/{sid}/close")
async def close_signal(sid: str, user=Depends(current_user)):
    res = await db.signals.update_one({"id": sid, "patient_id": user["id"]}, {"$set": {"status": "resuelta"}})
    if not res.matched_count:
        raise HTTPException(404, "Señal no encontrada")
    return {"ok": True}


# ---------------------------------------------------------------- notifications
@api.get("/notifications")
async def notifications(user=Depends(current_user)):
    return [clean(n) async for n in db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).limit(100)]


@api.post("/notifications/read-all")
async def read_all(user=Depends(current_user)):
    await db.notifications.update_many({"user_id": user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ---------------------------------------------------------------- catalog
P = [
    ("p1", "Cobija de punto suave", "Comodidad", 489, ["descanso", "comodidad"], ["Arena", "Salvia", "Lavanda", "Gris"], True, "Cobija ligera de algodón tejido, ideal para salas frías o descanso en casa."),
    ("p2", "Almohada de viaje", "Comodidad", 329, ["descanso", "traslados"], ["Arena", "Gris", "Salvia"], False, "Soporte cervical con funda lavable para traslados largos o sesiones."),
    ("p3", "Calcetines antiderrapantes", "Comodidad", 149, ["comodidad"], ["Arena", "Coral", "Gris"], False, "Calcetines tibios con suela antiderrapante."),
    ("p4", "Antifaz de algodón", "Comodidad", 179, ["descanso"], ["Salvia", "Lavanda", "Negro"], True, "Para descansar con luz, en casa o en el hospital."),
    ("p5", "Libreta de notas AMODO", "Organización", 199, ["escribir", "organización", "dibujo"], ["Salvia", "Lavanda", "Coral"], True, "Libreta de tapa suave para preguntas, ideas o lo que quieras anotar."),
    ("p6", "Organizador de documentos", "Organización", 259, ["organización"], ["Arena", "Gris"], True, "Carpeta con separadores para estudios, citas y papeles importantes."),
    ("p7", "Pastillero semanal", "Organización", 169, ["organización"], ["Salvia", "Gris"], False, "Organizador por días. Úsalo siguiendo siempre las indicaciones de tu equipo médico."),
    ("p8", "Bolsa tote amodo", "Organización", 349, ["traslados", "organización"], ["Arena", "Negro", "Salvia"], True, "Bolsa amplia para llevar tus cosas a cada cita."),
    ("p9", "Libro de crucigramas", "Entretenimiento", 159, ["juegos", "lectura"], [], False, "Pasatiempos para ratos de espera."),
    ("p10", "Set de lápices de color", "Entretenimiento", 219, ["dibujo"], [], False, "24 colores con estuche de tela."),
    ("p11", "Kit para tejer principiante", "Entretenimiento", 389, ["tejer"], ["Salvia", "Coral", "Lavanda"], False, "Agujas, estambre suave y una guía sencilla."),
    ("p12", "Audífonos con cable", "Entretenimiento", 299, ["música", "cine"], ["Negro", "Arena"], False, "Audífonos ligeros para música, series o silencio."),
    ("p13", "Baraja de cartas ilustrada", "Entretenimiento", 129, ["juegos"], [], False, "Para jugar solo o acompañado."),
    ("p14", "Novela de bolsillo (selección)", "Entretenimiento", 239, ["lectura"], [], False, "Elegimos una novela según los géneros que te gustan."),
    ("p15", "Gorro de algodón", "Apariencia e identidad", 249, ["apariencia", "comodidad"], ["Arena", "Gris", "Salvia", "Negro"], False, "Gorro suave sin costuras internas."),
    ("p16", "Pañoleta estampada", "Apariencia e identidad", 289, ["apariencia"], ["Salvia", "Lavanda", "Coral", "Tierra"], False, "Tela ligera y transpirable, varios estampados."),
    ("p17", "Bálsamo labial sin aroma", "Cuidado personal", 99, ["cuidado"], [], False, "Hidratación sencilla, fórmula sin fragancia."),
    ("p18", "Crema de manos sin fragancia", "Cuidado personal", 179, ["cuidado"], [], False, "Textura ligera, pensada para piel sensible."),
    ("p19", "Cepillo de dientes suave", "Cuidado personal", 89, ["cuidado"], ["Salvia", "Lavanda"], False, "Cerdas extra suaves."),
    ("p20", "Termo de acero 500 ml", "Hidratación y snacks", 329, ["hidratación", "traslados"], ["Salvia", "Arena", "Negro", "Coral"], True, "Mantiene tus bebidas frías o calientes."),
    ("p21", "Caja de tés suaves", "Hidratación y snacks", 189, ["hidratación"], [], False, "Infusiones de manzanilla, menta y jengibre."),
    ("p22", "Snacks surtidos", "Hidratación y snacks", 159, ["snacks"], [], False, "Galletas, frutos secos y paletas de sabores neutros."),
    ("p23", "Tarjeta escrita a mano", "Detalles", 59, ["regalo"], [], True, "Escribe un mensaje y lo incluimos en el kit."),
    ("p24", "Vela de soya sin aroma", "Detalles", 199, ["descanso", "regalo"], ["Arena", "Salvia"], False, "Luz cálida para tu espacio."),
]


async def seed_products():
    for pid, name, cat, price, tags, colors, txt, desc in P:
        await db.products.update_one({"id": pid}, {"$set": {"id": pid, "name": name, "category": cat, "price": price, "tags": tags,
                                                             "colors": colors, "personalize_text": txt, "description": desc, "image": None}}, upsert=True)


SIZES = {"Pequeño": {"max": 4, "base": 149}, "Mediano": {"max": 7, "base": 219}, "Grande": {"max": 10, "base": 289}}
TEMPLATES = [
    {"id": "t1", "name": "Para la sala de tratamiento", "context": "Sesión de tratamiento", "size": "Mediano",
     "items": ["p1", "p12", "p20", "p9", "p17", "p3"], "description": "Calidez, hidratación y algo para pasar el tiempo."},
    {"id": "t2", "name": "Descanso en casa", "context": "Descanso en casa", "size": "Pequeño",
     "items": ["p4", "p24", "p21", "p18"], "description": "Para días tranquilos y sin prisa."},
    {"id": "t3", "name": "Hospitalización", "context": "Hospitalización", "size": "Grande",
     "items": ["p2", "p3", "p4", "p5", "p8", "p12", "p17", "p19", "p20", "p14"], "description": "Lo práctico y lo propio, para estancias más largas."},
    {"id": "t4", "name": "Un detalle para alguien", "context": "Regalo para alguien", "size": "Pequeño",
     "items": ["p23", "p1", "p21", "p13"], "description": "Para acompañar a distancia."},
]


@api.get("/products")
async def products(category: Optional[str] = None, q: Optional[str] = None):
    query: dict[str, Any] = {}
    if category:
        query["category"] = category
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    return [clean(p) async for p in db.products.find(query).sort("id", 1)]


@api.get("/products/{pid}")
async def product(pid: str):
    p = await db.products.find_one({"id": pid})
    if not p:
        raise HTTPException(404, "Producto no encontrado")
    return clean(p)


async def products_map(ids: list[str]) -> dict:
    return {p["id"]: clean(p) async for p in db.products.find({"id": {"$in": list(set(ids))}})}


async def kit_view(kit: dict) -> dict:
    kit = clean(kit)
    pm = await products_map([i["product_id"] for i in kit.get("items", [])])
    kit["items"] = [{**i, "product": pm.get(i["product_id"])} for i in kit.get("items", []) if pm.get(i["product_id"])]
    base = SIZES.get(kit.get("size"), SIZES["Mediano"])["base"]
    kit["base_price"] = base
    kit["total"] = base + sum(i["product"]["price"] for i in kit["items"])
    return kit


@api.get("/kits/suggested")
async def suggested_kits():
    return [await kit_view({**t, "template": True, "items": [{"product_id": x, "options": {}} for x in t["items"]]}) for t in TEMPLATES]


@api.get("/suggestions")
async def suggestions(user=Depends(current_user)):
    tastes = user.get("profile", {}).get("tastes", {}) or {}
    liked = " ".join(str(x) for v in tastes.values() if isinstance(v, list) for x in v).lower()
    dislikes = " ".join(tastes.get("dislikes", []) or []).lower()
    tag_words = {"lectura": "leer", "música": "música", "dibujo": "dibuj", "tejer": "tej", "juegos": "jug", "cine": "pel",
                 "descanso": "descans", "escribir": "escrib", "hidratación": "agua", "comodidad": "suave", "apariencia": "gorro"}
    scored = []
    async for p in db.products.find({}):
        score = sum(1 for t in p["tags"] if tag_words.get(t, t) in liked)
        if "aroma" in dislikes and "aroma" in p["description"].lower() and "sin aroma" not in p["description"].lower():
            continue
        scored.append((score, p))
    scored.sort(key=lambda x: -x[0])
    return {"products": [clean(p) for s, p in scored[:8]], "based_on": bool(liked)}


@api.get("/kits")
async def my_kits(user=Depends(current_user)):
    return [await kit_view(k) async for k in db.kits.find({"owner_id": user["id"]}).sort("updated_at", -1)]


@api.get("/kits/{kid}")
async def get_kit(kid: str, user=Depends(current_user)):
    t = next((t for t in TEMPLATES if t["id"] == kid), None)
    if t:
        return await kit_view({**t, "template": True, "items": [{"product_id": x, "options": {}} for x in t["items"]]})
    k = await db.kits.find_one({"id": kid, "owner_id": user["id"]})
    if not k:
        raise HTTPException(404, "Kit no encontrado")
    return await kit_view(k)


def kit_fields(body: dict) -> dict:
    size = body.get("size") or "Mediano"
    if size not in SIZES:
        raise HTTPException(422, "Tamaño no válido")
    items = body.get("items") or []
    if not isinstance(items, list) or any(not isinstance(i, dict) or not i.get("product_id") for i in items):
        raise HTTPException(422, "Artículos del kit no válidos")
    if len(items) > SIZES[size]["max"]:
        raise HTTPException(422, f"El tamaño {size} admite hasta {SIZES[size]['max']} artículos")
    return {"name": (body.get("name") or "Mi kit").strip(), "context": body.get("context", ""), "size": size,
            "categories": body.get("categories", []), "items": [{"product_id": i["product_id"], "options": i.get("options", {})} for i in items],
            "for_name": body.get("for_name", ""), "for_user_id": body.get("for_user_id"), "note": body.get("note", ""), "updated_at": now_iso()}


@api.post("/kits")
async def create_kit(body: dict = Body(...), user=Depends(current_user)):
    kit = {"id": uid(), "owner_id": user["id"], "created_at": now_iso(), **kit_fields(body)}
    await db.kits.insert_one(kit)
    return await kit_view(kit)


@api.put("/kits/{kid}")
async def update_kit(kid: str, body: dict = Body(...), user=Depends(current_user)):
    res = await db.kits.update_one({"id": kid, "owner_id": user["id"]}, {"$set": kit_fields(body)})
    if not res.matched_count:
        raise HTTPException(404, "Kit no encontrado")
    return await kit_view(await db.kits.find_one({"id": kid}))


@api.delete("/kits/{kid}")
async def delete_kit(kid: str, user=Depends(current_user)):
    await db.kits.delete_one({"id": kid, "owner_id": user["id"]})
    return {"ok": True}


@api.get("/favorites")
async def favorites(user=Depends(current_user)):
    ids = [f["product_id"] async for f in db.favorites.find({"user_id": user["id"]})]
    pm = await products_map(ids)
    return [pm[i] for i in ids if i in pm]


@api.post("/favorites/{pid}")
async def toggle_fav(pid: str, user=Depends(current_user)):
    if await db.favorites.find_one({"user_id": user["id"], "product_id": pid}):
        await db.favorites.delete_one({"user_id": user["id"], "product_id": pid})
        return {"favorite": False}
    await db.favorites.insert_one({"user_id": user["id"], "product_id": pid, "created_at": now_iso()})
    return {"favorite": True}


# ---------------------------------------------------------------- cart & orders
async def cart_view(user_id: str) -> dict:
    items = []
    async for c in db.cart.find({"user_id": user_id}):
        c = clean(c)
        if c["type"] == "kit":
            k = await db.kits.find_one({"id": c["ref_id"], "owner_id": user_id})
            if not k:
                t = next((t for t in TEMPLATES if t["id"] == c["ref_id"]), None)
                k = {**t, "items": [{"product_id": x, "options": {}} for x in t["items"]]} if t else None
            if not k:
                continue
            kv = await kit_view(k)
            c.update({"name": kv["name"], "price": kv["total"], "detail": f"Kit {kv['size'].lower()} · {len(kv['items'])} artículos", "category": "Kit"})
        else:
            p = await db.products.find_one({"id": c["ref_id"]})
            if not p:
                continue
            opts = c.get("options") or {}
            c.update({"name": p["name"], "price": p["price"], "category": p["category"],
                      "detail": " · ".join(x for x in [opts.get("color"), f"“{opts['text']}”" if opts.get("text") else None] if x)})
        c["subtotal"] = c["price"] * c["qty"]
        items.append(c)
    subtotal = sum(i["subtotal"] for i in items)
    return {"items": items, "subtotal": subtotal, "count": sum(i["qty"] for i in items)}


@api.get("/cart")
async def get_cart(user=Depends(current_user)):
    return await cart_view(user["id"])


@api.post("/cart")
async def add_cart(body: dict = Body(...), user=Depends(current_user)):
    if body.get("type") not in ("product", "kit") or not body.get("ref_id"):
        raise HTTPException(422, "Artículo no válido")
    try:
        qty = max(1, int(body.get("qty", 1)))
    except (TypeError, ValueError):
        raise HTTPException(422, "Cantidad no válida")
    await db.cart.insert_one({"id": uid(), "user_id": user["id"], "type": body["type"], "ref_id": str(body["ref_id"]),
                              "qty": qty, "options": body.get("options") if isinstance(body.get("options"), dict) else {}})
    return await cart_view(user["id"])


@api.put("/cart/{cid}")
async def update_cart(cid: str, qty: int = Body(..., embed=True), user=Depends(current_user)):
    if qty < 1:
        await db.cart.delete_one({"id": cid, "user_id": user["id"]})
    else:
        await db.cart.update_one({"id": cid, "user_id": user["id"]}, {"$set": {"qty": qty}})
    return await cart_view(user["id"])


@api.delete("/cart/{cid}")
async def delete_cart(cid: str, user=Depends(current_user)):
    await db.cart.delete_one({"id": cid, "user_id": user["id"]})
    return await cart_view(user["id"])


SHIPPING = {"Estándar": 99, "Express": 179, "Recoger en punto AMODO": 0}
STEPS = ["Confirmado", "Preparando tu kit", "En camino", "Entregado"]


def order_view(o: dict) -> dict:
    o = clean(o)
    mins = (datetime.now(timezone.utc) - datetime.fromisoformat(o["created_at"])).total_seconds() / 60
    idx = 0 if o.get("cancelled") else min(3, int(mins // 3))
    o["status"] = "Cancelado" if o.get("cancelled") else STEPS[idx]
    o["timeline"] = [{"label": s, "done": i <= idx and not o.get("cancelled")} for i, s in enumerate(STEPS)]
    o["active"] = idx < 3 and not o.get("cancelled")
    return o


class CheckoutIn(BaseModel):
    recipient: str = Field(min_length=1)
    phone: str = Field(min_length=7)
    street: str = Field(min_length=3)
    city: str = Field(min_length=2)
    zip: str = Field(min_length=4)
    notes: str = ""
    gift_note: str = ""
    shipping: str = "Estándar"


@api.post("/orders/checkout")
async def checkout(body: CheckoutIn, user=Depends(current_user)):
    cart = await cart_view(user["id"])
    if not cart["items"]:
        raise HTTPException(400, "Tu carrito está vacío")
    ship = SHIPPING.get(body.shipping, 99)
    order = {"id": uid(), "user_id": user["id"], "number": f"AM-{random.randint(10000, 99999)}",
             "items": [{k: i[k] for k in ("type", "ref_id", "name", "detail", "qty", "price", "subtotal", "options")} for i in cart["items"]],
             "subtotal": cart["subtotal"], "shipping_cost": ship, "total": cart["subtotal"] + ship,
             "address": body.model_dump(), "payment": {"method": "Pago simulado", "status": "Aprobado (simulado, sin cargo real)"},
             "created_at": now_iso()}
    await db.orders.insert_one(order)
    await db.cart.delete_many({"user_id": user["id"]})
    await notify(user["id"], "Pedido confirmado", f"Tu pedido {order['number']} está confirmado.", "order", f"/order/{order['id']}")
    return order_view(order)


@api.get("/orders")
async def orders(user=Depends(current_user)):
    return [order_view(o) async for o in db.orders.find({"user_id": user["id"]}).sort("created_at", -1)]


@api.get("/orders/{oid}")
async def get_order(oid: str, user=Depends(current_user)):
    o = await db.orders.find_one({"id": oid, "user_id": user["id"]})
    if not o:
        raise HTTPException(404, "Pedido no encontrado")
    return order_view(o)


@api.post("/orders/{oid}/cancel")
async def cancel_order(oid: str, user=Depends(current_user)):
    o = await db.orders.find_one({"id": oid, "user_id": user["id"]})
    if not o:
        raise HTTPException(404, "Pedido no encontrado")
    if order_view(o)["status"] in ("En camino", "Entregado"):
        raise HTTPException(400, "Este pedido ya salió y no se puede cancelar")
    await db.orders.update_one({"id": oid}, {"$set": {"cancelled": True}})
    return order_view(await db.orders.find_one({"id": oid}))


# ---------------------------------------------------------------- home & history
@api.get("/home")
async def home(today: str = Query(...), user=Depends(current_user)):
    unread = await db.notifications.count_documents({"user_id": user["id"], "read": False})
    cart = await db.cart.count_documents({"user_id": user["id"]})
    if user.get("role") == "caregiver":
        links = [await enrich_link(link) async for link in db.links.find({"caregiver_id": user["id"], "status": "active"})]
        pids = [link["patient_id"] for link in links]
        signals = [clean(s) async for s in db.signals.find({"patient_id": {"$in": pids}, "status": "enviada"}).sort("created_at", -1).limit(10)]
        tasks = [clean(t) async for t in db.records.find({"kind": "tasks", "assignee_id": user["id"], "done": False}).limit(10)]
        shared = []
        for link in links:
            if link["permissions"].get("events"):
                async for e in db.records.find({"kind": "events", "owner_id": link["patient_id"], "date": {"$gte": today}}):
                    shared.append({**clean(e), "owner_name": link["patient_name"]})
        shared.sort(key=sort_key)
        own = [clean(e) async for e in db.records.find({"kind": "events", "owner_id": user["id"], "date": {"$gte": today}})]
        own.sort(key=sort_key)
        return {"role": "caregiver", "patients": links, "signals": signals, "tasks": tasks, "shared_events": shared[:8],
                "own_events": own[:5], "unread": unread, "cart": cart}
    events = [clean(e) async for e in db.records.find({"kind": "events", "owner_id": user["id"], "date": {"$gte": today}})]
    events.sort(key=sort_key)
    tasks = [clean(t) async for t in db.records.find({"kind": "tasks", "owner_id": user["id"], "done": False})]
    tasks.sort(key=sort_key)
    meds = [clean(m) async for m in db.records.find({"kind": "medications", "owner_id": user["id"]})]
    transfers = [clean(t) async for t in db.records.find({"kind": "transfers", "owner_id": user["id"], "date": today})]
    journal = await db.records.find_one({"kind": "journal", "owner_id": user["id"], "date": today})
    network_count = await db.links.count_documents({"patient_id": user["id"], "status": "active"})
    open_signals = [clean(s) async for s in db.signals.find({"patient_id": user["id"], "status": {"$ne": "resuelta"}}).sort("created_at", -1).limit(3)]
    return {"role": "patient", "today_events": [e for e in events if e.get("date") == today], "upcoming": [e for e in events if e.get("date") != today][:5],
            "tasks": tasks[:6], "medications": meds, "transfers_today": transfers, "journal": clean(journal),
            "network_count": network_count, "signals": open_signals, "unread": unread, "cart": cart}


@api.get("/history")
async def history(user=Depends(current_user)):
    out = []
    today = datetime.now(timezone.utc).date().isoformat()
    async for r in db.records.find({"owner_id": user["id"], "kind": {"$in": ["events", "journal"]}}):
        if r["kind"] == "events" and (r.get("date") or "9999") > today:
            continue
        out.append({"id": r["id"], "kind": r["kind"], "title": r.get("title") or "Registro del día", "subtitle": r.get("note") or r.get("type") or r.get("energy") or "", "date": r.get("date") or r["created_at"][:10]})
    async for s in db.signals.find({"patient_id": user["id"]}):
        out.append({"id": s["id"], "kind": "signal", "title": s["label"], "subtitle": s.get("status", ""), "date": s["created_at"][:10]})
    async for o in db.orders.find({"user_id": user["id"]}):
        out.append({"id": o["id"], "kind": "order", "title": f"Pedido {o['number']}", "subtitle": f"{len(o['items'])} artículo(s)", "date": o["created_at"][:10]})
    out.sort(key=lambda x: x["date"], reverse=True)
    return out


# ---------------------------------------------------------------- demo seed
async def seed_demo():
    if await db.users.find_one({"email": "demo@amodo.app"}):
        return
    p = await create_user("demo@amodo.app", "Demo1234", "Alex Rivera", "Alex", "patient", True)
    c = await create_user("acompanante@amodo.app", "Demo1234", "Sam Rivera", "Sam", "caregiver", True)
    await db.users.update_one({"id": p["id"]}, {"$set": {"profile": {
        "treatment": {"types": ["Quimioterapia"], "status": "En curso", "center": "Centro Médico Norte", "frequency": "Cada 21 días"},
        "tastes": {"activities": ["Leer", "Escuchar música", "Ver películas o series"], "colors": ["Verdes", "Neutros"], "dislikes": ["Aromas fuertes"]},
        "needs": {"support": ["Traslados", "Comidas"]}}}})
    await db.links.insert_one({"id": uid(), "patient_id": p["id"], "caregiver_id": c["id"], "caregiver_email": c["email"], "relation": "Hermano/a",
                               "status": "active", "permissions": dict(DEFAULT_PERMS), "created_at": now_iso()})
    d = datetime.now(timezone.utc).date()
    day = lambda n: (d + timedelta(days=n)).isoformat()  # noqa: E731
    recs = [
        ("events", {"title": "Sesión de tratamiento", "type": "Sesión de tratamiento", "date": day(0), "time": "10:00", "location": "Centro Médico Norte, piso 3"}),
        ("events", {"title": "Consulta de seguimiento", "type": "Cita médica", "date": day(3), "time": "12:30", "location": "Consultorio 214"}),
        ("events", {"title": "Café con Lu", "type": "Actividad personal", "date": day(5), "time": "17:00", "location": "Casa"}),
        ("events", {"title": "Estudios de laboratorio", "type": "Estudio", "date": day(-4), "time": "08:00", "location": "Laboratorio central"}),
        ("treatments", {"name": "Quimioterapia", "status": "En curso", "date": day(-40), "frequency": "Cada 21 días", "cycle_current": "3", "cycles_total": "6", "next_session": day(0), "center": "Centro Médico Norte"}),
        ("medications", {"name": "Medicamento indicado A", "dose": "Según indicación", "schedule": "Mañana y noche", "prescribed_by": "Equipo de oncología"}),
        ("tasks", {"title": "Recoger resultados", "date": day(1), "assignee_id": c["id"], "done": False}),
        ("tasks", {"title": "Llevar documentos al seguro", "date": day(2), "done": False}),
        ("transfers", {"title": "Ida a sesión", "date": day(0), "time": "09:15", "origin": "Casa", "destination": "Centro Médico Norte", "mode": "Acompañante lleva", "driver": "Sam"}),
        ("expenses", {"title": "Estacionamiento hospital", "amount": 120, "category": "Transporte", "date": day(-4), "paid_by": "Sam", "status": "Pagado", "shared": True}),
        ("expenses", {"title": "Consulta de seguimiento", "amount": 900, "category": "Consultas", "date": day(3), "paid_by": "Alex", "status": "Pendiente", "shared": True}),
    ]
    for kind, data in recs:
        await db.records.insert_one({"id": uid(), "kind": kind, "owner_id": p["id"], "created_by": p["id"], "created_at": now_iso(), **data})
    await db.records.insert_one({"id": uid(), "kind": "events", "owner_id": c["id"], "created_by": c["id"], "created_at": now_iso(),
                                 "title": "Junta de trabajo", "type": "Actividad personal", "date": day(1), "time": "09:00"})
    await db.signals.insert_one({"id": uid(), "patient_id": p["id"], "patient_name": "Alex", "type": "comida", "label": "Algo de comer",
                                 "message": "¿Puedes traer algo ligero al salir de la sesión?", "urgency": "Hoy", "status": "enviada",
                                 "responses": [], "recipients": 1, "created_at": now_iso()})


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=False, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("startup")
async def startup():
    app.state.index_task = asyncio.create_task(ensure_indexes())
    await seed_products()
    await seed_demo()


@app.on_event("shutdown")
async def shutdown_db_client():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
