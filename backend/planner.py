"""AMODO connected planning: treatment assistant + series, unified agenda, pending list, medication doses,
reminders (in-app + device), treatment-aware knowledge base and recommendation explanations.
Imported at the bottom of server.py so it can register routes on the shared `api` router."""
import asyncio
import json
import os
import re
from contextlib import suppress
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import Body, Depends, HTTPException, Query
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

from server import (api, clean, current_user, db, display_name, logger, notify, notify_shared, now_iso, resolve_owner, uid,
                    valid_share, _date_or_empty, _time_or_empty, DAYS_ES)
from storage import get_object

TREATMENT_TYPES = ["Quimioterapia", "Radioterapia", "Inmunoterapia", "Cirugía", "Terapia dirigida", "Terapia hormonal", "Otro"]


async def llm_json(system: str, text: str, session: str) -> dict:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"{session}-{uid()}", system_message=system).with_model("openai", "gpt-5.4")
    out = await chat.send_message(UserMessage(text=text))
    m = re.search(r"\{.*\}", out or "", re.S)
    return json.loads(m.group(0)) if m else {}


# ---------------------------------------------------------------- treatment assistant + series
TREAT_PROMPT = """Organizas SOLO la información de tratamiento que la persona escribe. Responde ÚNICAMENTE JSON válido:
{"name":"","treatment_type":"Quimioterapia|Radioterapia|Inmunoterapia|Cirugía|Terapia dirigida|Terapia hormonal|Otro","start_date":"YYYY-MM-DD o vacío","time":"HH:MM o vacío","interval_days":null,"weekdays":[],"sessions_count":null,"location":"","notes":"","questions":[]}
Reglas estrictas: NUNCA inventes ni sugieras frecuencia, número de sesiones, dosis, duración ni fechas. Si algo no se dijo, déjalo vacío/null.
"cada 21 días" -> interval_days 21; "cada semana" -> 7; "de lunes a viernes" -> weekdays [0,1,2,3,4] (0=lunes) e interval_days null.
Si falta la fecha de inicio, la frecuencia o el número de sesiones, agrega en "questions" UNA pregunta breve por dato faltante (ej. "¿Cada cuánto tiempo serán las sesiones?").
"name": cómo la persona llama a su tratamiento (ej. "Quimioterapia"). Convierte fechas relativas con el calendario dado."""


def build_sessions(start: str, interval: Optional[int], weekdays: list, count: Optional[int], time: str) -> list[dict]:
    if not start or not count:
        return []
    d = datetime.strptime(start, "%Y-%m-%d").date()
    out: list[dict] = []
    count = max(1, min(int(count), 60))
    if weekdays:
        wd = {int(x) for x in weekdays if str(x).isdigit() and 0 <= int(x) <= 6}
        while len(out) < count and wd:
            if d.weekday() in wd:
                out.append({"date": d.isoformat(), "time": time})
            d += timedelta(days=1)
        return out
    if not interval:
        return [{"date": d.isoformat(), "time": time}] if count == 1 else []
    for i in range(count):
        out.append({"date": (d + timedelta(days=int(interval) * i)).isoformat(), "time": time})
    return out


@api.post("/treatments/parse")
async def treatment_parse(text: str = Body(..., embed=True), today: str = Body(..., embed=True), user=Depends(current_user)):
    from membership import use_ai
    text = text.strip()[:2000]
    if len(text) < 3:
        raise HTTPException(422, "Escribe un poco más para poder ayudarte")
    await use_ai(user)
    base = datetime.strptime(_date_or_empty(today) or date.today().isoformat(), "%Y-%m-%d")
    cal = ", ".join(f"{DAYS_ES[(base + timedelta(days=i)).weekday()]} {(base + timedelta(days=i)).date().isoformat()}" for i in range(60))
    try:
        data = await llm_json(TREAT_PROMPT, f"Hoy es {cal.split(',')[0]}. Calendario: {cal}.\nTexto: {text}", "treat")
    except Exception as exc:
        logger.error("treatment_parse: %s", exc)
        from membership import refund_ai
        await refund_ai(user)
        raise HTTPException(503, "No pudimos interpretar el texto ahora. Intenta de nuevo en un momento.")

    def num(v):
        try:
            return int(v) if v not in (None, "") and int(v) > 0 else None
        except (TypeError, ValueError):
            return None
    t = data.get("treatment_type") if data.get("treatment_type") in TREATMENT_TYPES else "Otro"
    plan = {"name": str(data.get("name") or t)[:80], "treatment_type": t, "start_date": _date_or_empty(data.get("start_date")), "time": _time_or_empty(data.get("time")),
            "interval_days": num(data.get("interval_days")), "weekdays": [int(x) for x in (data.get("weekdays") or []) if str(x).isdigit()][:7],
            "sessions_count": num(data.get("sessions_count")), "location": str(data.get("location") or "")[:120], "notes": str(data.get("notes") or "")[:400],
            "questions": [str(q)[:140] for q in (data.get("questions") or [])][:4]}
    plan["sessions"] = build_sessions(plan["start_date"], plan["interval_days"], plan["weekdays"], plan["sessions_count"], plan["time"])
    return plan


@api.post("/treatments/plan")
async def treatment_commit(body: dict = Body(...), user=Depends(current_user)):
    """Saves one treatment + one agenda event per confirmed session, linked by treatment_id/series_id (no duplicates)."""
    sessions = [s for s in (body.get("sessions") or []) if _date_or_empty(s.get("date"))]
    name = str(body.get("name") or "").strip()[:80]
    if not name:
        raise HTTPException(422, "Escribe el nombre del tratamiento")
    shared = await valid_share(user["id"], body.get("shared_with"))
    tid, sid = uid(), uid()
    freq = f"Cada {body['interval_days']} días" if body.get("interval_days") else ("Días: " + ", ".join(DAYS_ES[int(d)] for d in body.get("weekdays") or []) if body.get("weekdays") else "")
    sessions.sort(key=lambda s: s["date"])
    await db.records.insert_one({"id": tid, "kind": "treatments", "owner_id": user["id"], "created_by": user["id"], "created_at": now_iso(), "shared_with": shared,
                                 "name": name, "treatment_type": body.get("treatment_type") if body.get("treatment_type") in TREATMENT_TYPES else "Otro",
                                 "status": "Por comenzar" if sessions and sessions[0]["date"] > date.today().isoformat() else "En curso",
                                 "date": sessions[0]["date"] if sessions else "", "frequency": freq, "cycles_total": len(sessions) or None,
                                 "center": str(body.get("location") or "")[:120], "notes": str(body.get("notes") or "")[:400], "series_id": sid, "source": "asistente"})
    for i, s in enumerate(sessions):
        await db.records.insert_one({"id": uid(), "kind": "events", "owner_id": user["id"], "created_by": user["id"], "created_at": now_iso(), "shared_with": shared,
                                     "title": f"{name} · sesión {i + 1}", "type": "Sesión de tratamiento", "date": s["date"], "time": _time_or_empty(s.get("time")),
                                     "location": str(body.get("location") or "")[:120], "treatment_id": tid, "series_id": sid, "series_index": i + 1, "history": []})
    if shared:
        await notify_shared(user, shared, f"Tratamiento: {name}")
    return {"treatment_id": tid, "series_id": sid, "sessions": len(sessions)}


@api.put("/series/{sid}")
async def update_series(sid: str, event_id: str = Body(..., embed=True), scope: str = Body("one", embed=True), changes: dict = Body(..., embed=True), user=Depends(current_user)):
    ev = await db.records.find_one({"id": event_id, "kind": "events", "series_id": sid})
    if not ev:
        raise HTTPException(404, "Evento no encontrado")
    await resolve_owner(user, ev["owner_id"], "events", write=True)
    allowed = {k: v for k, v in changes.items() if k in ("title", "date", "time", "location", "notes", "type", "shared_with")}
    if "shared_with" in allowed:
        allowed["shared_with"] = await valid_share(ev["owner_id"], allowed["shared_with"]) if ev["owner_id"] == user["id"] else ev.get("shared_with", [])
    q = {"kind": "events", "series_id": sid}
    if scope == "one":
        q["id"] = event_id
    elif scope == "following":
        q["series_index"] = {"$gte": ev.get("series_index", 0)}
    shift = None
    if "date" in allowed and _date_or_empty(allowed["date"]) and scope != "one":
        shift = (datetime.strptime(allowed["date"], "%Y-%m-%d") - datetime.strptime(ev["date"], "%Y-%m-%d")).days
    n = 0
    async for r in db.records.find(q):
        s = {k: v for k, v in allowed.items() if k != "date" and not (k == "title" and r["id"] != event_id)}
        if "date" in allowed:
            s["date"] = allowed["date"] if r["id"] == event_id else (datetime.strptime(r["date"], "%Y-%m-%d") + timedelta(days=shift)).date().isoformat() if shift else r["date"]
        old = {k: r.get(k) for k in s}
        if old == s:
            continue
        s["updated_at"] = now_iso()
        await db.records.update_one({"id": r["id"]}, {"$set": s, "$push": {"history": {"at": now_iso(), "by": display_name(user), "scope": scope, "before": old}}})
        n += 1
    return {"updated": n}


# ---------------------------------------------------------------- unified agenda
EVENT_CAT = {"Cita médica": "appointments", "Sesión de tratamiento": "treatments", "Estudio": "studies"}


def parse_times(med: dict) -> list[str]:
    raw = med.get("times") or med.get("schedule") or ""
    raw = ", ".join(raw) if isinstance(raw, list) else str(raw)
    return sorted({_time_or_empty(f"{int(h):02d}:{m}") for h, m in re.findall(r"(\d{1,2}):(\d{2})", raw)} - {""})


async def visible(kind: str, owner: str, user: dict, extra: dict) -> list[dict]:
    q = {"kind": kind, "owner_id": owner, **extra}
    if owner != user["id"]:
        q["shared_with"] = user["id"]
    return [r async for r in db.records.find(q)]


async def agenda_items(user: dict, owner: str, start: str, end: str) -> list[dict]:
    rng = {"date": {"$gte": start, "$lte": end}}
    out: list[dict] = []
    for e in await visible("events", owner, user, rng):
        out.append({"key": f"ev-{e['id']}", "source": "events", "id": e["id"], "title": e.get("title", ""), "date": e["date"], "time": e.get("time", ""),
                    "category": EVENT_CAT.get(e.get("type"), "personal"), "type": e.get("type", ""), "location": e.get("location", ""),
                    "series_id": e.get("series_id"), "shared": bool(e.get("shared_with"))})
    for t in await visible("transfers", owner, user, rng):
        out.append({"key": f"tr-{t['id']}", "source": "transfers", "id": t["id"], "title": t.get("title", ""), "date": t["date"], "time": t.get("time", ""),
                    "category": "transfers", "type": "Traslado", "confirmed": bool(t.get("confirmed")), "driver": t.get("driver", ""), "shared": bool(t.get("shared_with"))})
    for t in await visible("tasks", owner, user, rng):
        out.append({"key": f"tk-{t['id']}", "source": "tasks", "id": t["id"], "title": t.get("title", ""), "date": t["date"], "time": t.get("time", ""),
                    "category": "tasks", "type": "Pendiente", "done": bool(t.get("done")), "shared": bool(t.get("shared_with")), "exact": bool(t.get("expense_id") and t.get("time"))})
    for x in await visible("expenses", owner, user, {**rng, "status": {"$ne": "Pagado"}}):
        out.append({"key": f"ex-{x['id']}", "source": "expenses", "id": x["id"], "title": x.get("title", ""), "date": x["date"], "time": "",
                    "category": "payments", "type": "Pago pendiente", "amount": x.get("amount"), "shared": bool(x.get("shared_with"))})
    meds = await visible("medications", owner, user, {})
    if meds:
        doses = {(d["med_id"], d["date"], d["time"]): d["status"] async for d in db.doses.find({"owner_id": owner, "date": {"$gte": start, "$lte": end}})}
        d0, d1 = datetime.strptime(start, "%Y-%m-%d").date(), datetime.strptime(end, "%Y-%m-%d").date()
        for m in meds:
            times = parse_times(m)
            if not times or m.get("active") is False:
                continue
            ms = _date_or_empty(m.get("start_date")) or m["created_at"][:10]
            me = _date_or_empty(m.get("end_date")) or "9999-12-31"
            day = max(d0, datetime.strptime(ms, "%Y-%m-%d").date())
            while day <= d1 and day.isoformat() <= me:
                for tm in times:
                    ds = day.isoformat()
                    out.append({"key": f"md-{m['id']}-{ds}-{tm}", "source": "doses", "id": m["id"], "title": m.get("name", ""), "date": ds, "time": tm,
                                "category": "medications", "type": "Medicamento", "dose": m.get("dose", ""), "status": doses.get((m["id"], ds, tm), "pendiente"),
                                "shared": bool(m.get("shared_with"))})
                day += timedelta(days=1)
    out.sort(key=lambda i: f"{i['date']} {i['time'] or '99'}")
    return out


@api.get("/agenda")
async def agenda(start: str = Query(...), end: str = Query(...), owner_id: Optional[str] = None, user=Depends(current_user)):
    if not (_date_or_empty(start) and _date_or_empty(end)) or end < start:
        raise HTTPException(422, "Rango de fechas no válido")
    if (datetime.strptime(end, "%Y-%m-%d") - datetime.strptime(start, "%Y-%m-%d")).days > 120:
        raise HTTPException(422, "Rango demasiado amplio")
    owner = await resolve_owner(user, owner_id, "events")
    return await agenda_items(user, owner, start, end)


@api.post("/doses")
async def set_dose(med_id: str = Body(..., embed=True), date_: str = Body(..., alias="date", embed=True), time: str = Body(..., embed=True),
                   status: str = Body(..., embed=True), user=Depends(current_user)):
    """Dose status is only what the person records explicitly: realizado / omitido / pendiente."""
    if status not in ("realizado", "omitido", "pendiente") or not _date_or_empty(date_) or not _time_or_empty(time):
        raise HTTPException(422, "Datos no válidos")
    m = await db.records.find_one({"id": med_id, "kind": "medications"})
    if not m:
        raise HTTPException(404, "Medicamento no encontrado")
    await resolve_owner(user, m["owner_id"], "medications", write=True)
    if m["owner_id"] != user["id"] and user["id"] not in (m.get("shared_with") or []):
        raise HTTPException(403, "No tienes permiso")
    await db.doses.update_one({"med_id": med_id, "date": date_, "time": time}, {"$set": {"owner_id": m["owner_id"], "status": status, "by": user["id"], "at": now_iso()}}, upsert=True)
    return {"ok": True}


@api.get("/pending")
async def pending(today: str = Query(...), owner_id: Optional[str] = None, user=Depends(current_user)):
    """Unified actions list: tasks, today's scheduled medication, transfers to confirm, pending payments. Appointments stay in Agenda."""
    if not _date_or_empty(today):
        raise HTTPException(422, "Fecha no válida")
    owner = await resolve_owner(user, owner_id, "tasks")
    out = []
    for t in await visible("tasks", owner, user, {}):
        out.append({"key": f"tk-{t['id']}", "source": "tasks", "id": t["id"], "title": t.get("title", ""), "date": t.get("date", ""), "done": bool(t.get("done")),
                    "detail": t.get("assignee_name", ""), "shared": bool(t.get("shared_with"))})
    for t in await visible("transfers", owner, user, {"date": {"$gte": (datetime.strptime(today, "%Y-%m-%d") - timedelta(days=7)).date().isoformat()}}):
        out.append({"key": f"tr-{t['id']}", "source": "transfers", "id": t["id"], "title": f"Confirmar traslado: {t.get('title', '')}", "date": t["date"], "time": t.get("time", ""),
                    "done": bool(t.get("confirmed")), "detail": t.get("driver", ""), "shared": bool(t.get("shared_with"))})
    for x in await visible("expenses", owner, user, {}):
        if x.get("status") in ("Pendiente", "Pagado"):
            out.append({"key": f"ex-{x['id']}", "source": "expenses", "id": x["id"], "title": f"Pago: {x.get('title', '')}", "date": x.get("date", ""),
                        "done": x.get("status") == "Pagado", "amount": x.get("amount"), "shared": bool(x.get("shared_with"))})
    for d in await agenda_items(user, owner, today, today):
        if d["source"] == "doses":
            out.append({"key": d["key"], "source": "doses", "id": d["id"], "title": d["title"], "date": d["date"], "time": d["time"],
                        "done": d["status"] != "pendiente", "status": d["status"], "detail": d.get("dose", ""), "shared": d["shared"]})
    out.sort(key=lambda i: f"{i.get('date') or '9999'} {i.get('time') or '99'}")
    return out


# ---------------------------------------------------------------- reminders (in-app + device schedule)
CATS = ["medications", "treatments", "appointments", "studies", "transfers", "tasks", "payments", "personal"]
CAT_LABEL = {"medications": "medicamento programado", "treatments": "sesión de tratamiento", "appointments": "consulta", "studies": "estudio",
             "transfers": "traslado", "tasks": "pendiente", "payments": "pago pendiente", "personal": "actividad"}
DEFAULT_NOTIF = {"enabled": True, "cats": {c: True for c in CATS}, "leads": [60, 1440], "quiet": {"start": "22:00", "end": "07:00"}, "discreet": True}


def notif_prefs(user: dict) -> dict:
    p = {**DEFAULT_NOTIF, **((user.get("settings") or {}).get("notif") or {})}
    p["cats"] = {**DEFAULT_NOTIF["cats"], **(p.get("cats") or {})}
    return p


def in_quiet(local: datetime, quiet: dict) -> bool:
    s, e = quiet.get("start"), quiet.get("end")
    if not s or not e or s == e:
        return False
    hm = local.strftime("%H:%M")
    return (s <= hm or hm < e) if s > e else (s <= hm < e)


def reminder_text(it: dict, lead: int, local_when: datetime, discreet: bool) -> tuple[str, str]:
    if discreet:
        return "AMODO", "Tienes un recordatorio. Abre AMODO para verlo."
    label, hour = CAT_LABEL[it["category"]], f" a las {it['time']}" if it.get("time") else ""
    if it["category"] == "medications":
        return "Medicamento programado", f"Es momento de revisar tu medicamento programado: {it['title']}."
    if it["category"] == "transfers" and not it.get("confirmed") and lead >= 720:
        return "Traslado por confirmar", f"Tu traslado de mañana sigue pendiente de confirmar: {it['title']}."
    when = "Mañana tienes" if lead >= 720 else "Hoy tienes" if lead >= 60 else "Es momento:" if it.get("exact") else "Pronto:"
    return it["title"], f"{when} {label}{hour}: {it['title']}."


async def compute_reminders(user: dict, days: int = 7) -> list[dict]:
    p = notif_prefs(user)
    if not p["enabled"]:
        return []
    off = int((user.get("settings") or {}).get("tz_offset", 0))  # minutes ahead of UTC
    now_local = datetime.now(timezone.utc) + timedelta(minutes=off)
    items = await agenda_items(user, user["id"], now_local.date().isoformat(), (now_local + timedelta(days=days)).date().isoformat())
    out = []
    for it in items:
        if not p["cats"].get(it["category"], True) or it.get("done") or it.get("status") in ("realizado", "omitido"):
            continue
        at = datetime.strptime(f"{it['date']} {it['time'] or '09:00'}", "%Y-%m-%d %H:%M")
        leads = [0] if it["category"] == "medications" else sorted({int(x) for x in p["leads"] if 0 <= int(x) <= 10080} | ({0} if it.get("exact") else set()))
        for lead in leads:
            fire_local = at - timedelta(minutes=lead)
            if in_quiet(fire_local, p["quiet"]) and it["category"] != "medications":
                continue
            if fire_local <= now_local.replace(tzinfo=None):
                continue
            title, body = reminder_text(it, lead, at, p["discreet"])
            out.append({"key": f"{it['key']}-{lead}-{it['date']}{it['time']}", "fire_at": (fire_local - timedelta(minutes=off)).replace(tzinfo=timezone.utc).isoformat(),
                        "title": title, "body": body, "category": it["category"], "link": "/(tabs)/agenda"})
    out.sort(key=lambda r: r["fire_at"])
    return out[:60]


@api.get("/reminders")
async def reminders(user=Depends(current_user)):
    return {"prefs": notif_prefs(user), "items": await compute_reminders(user)}


async def reminder_loop():
    """Every minute: turn due reminders into in-app notifications, once per key (unique index prevents duplicates)."""
    await db.reminders_sent.create_index("key", unique=True)
    while True:
        try:
            now = datetime.now(timezone.utc)
            from finance import weekly_prepare
            async for u in db.users.find({"demo_now": {"$exists": False}}):  # demo accounts live on a fixed date: no live reminders
                await weekly_prepare(u, now)
                for r in await compute_reminders(u, days=1):
                    if datetime.fromisoformat(r["fire_at"]) <= now + timedelta(seconds=60):
                        try:
                            await db.reminders_sent.insert_one({"key": f"{u['id']}-{r['key']}", "at": now_iso()})
                        except Exception:
                            continue
                        await notify(u["id"], r["title"], r["body"], f"reminder-{r['category']}", r["link"])
        except Exception as exc:
            logger.error("reminder_loop: %s", exc)
        await asyncio.sleep(60)


# ---------------------------------------------------------------- product media (public illustrations)
_media_cache: dict[str, tuple[bytes, str]] = {}


async def warm_media():
    async for p in db.products.find({"image": {"$regex": "^/api/media/"}}):
        path = p["image"][len("/api/media/"):]
        with suppress(Exception):
            _media_cache[path] = await run_in_threadpool(get_object, path)


@api.get("/media/{path:path}")
async def media(path: str):
    if ".." in path:
        raise HTTPException(404, "No encontrado")
    if path.startswith("amodo/style/"):  # personal inspiration boards: unguessable id, not listed anywhere public
        if not await db.style_images.find_one({"path": path, "deleted_at": None}):
            raise HTTPException(404, "No encontrado")
        data, ctype = await run_in_threadpool(get_object, path)
        return Response(content=data, media_type=ctype, headers={"Cache-Control": "private, max-age=86400"})
    if not path.startswith("amodo/products/"):
        raise HTTPException(404, "No encontrado")
    if path not in _media_cache:
        if not await db.products.find_one({"image": f"/api/media/{path}"}):
            raise HTTPException(404, "No encontrado")
        _media_cache[path] = await run_in_threadpool(get_object, path)
    data, ctype = _media_cache[path]
    return Response(content=data, media_type=ctype, headers={"Cache-Control": "public, max-age=604800"})
