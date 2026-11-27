"""Preparation tools: editable/shareable/reusable checklists (every plan) and "Mi próxima semana" (Plus).
Checklists are practical reminders only; medical preparation instructions always come from the care team."""
from datetime import datetime, timedelta

from fastapi import Body, Depends, HTTPException, Query

from business import require_plus
from knowledge import fmt_es
from planner import agenda_items
from server import DAYS_ES, _date_or_empty, active_link, api, clean, current_user, db, display_name, notify, now_iso, uid, valid_share

CARE_NOTE = "Las indicaciones de preparación (ayuno, medicamentos, horarios) te las da tu equipo médico. Anótalas aquí tal como te las dieron."
TEMPLATES = [
    {"id": "cita", "label": "Cita médica", "icon": "stethoscope", "title": "Para mi cita", "items": [
        "Identificación oficial", "Carnet, póliza o credencial del servicio de salud", "Estudios y resultados recientes", "Lista de medicamentos que tomo",
        "Preguntas que quiero hacer", "Libreta o notas del teléfono para apuntar", "Agua y algo ligero para la espera", "Confirmar quién me acompaña y cómo llego"]},
    {"id": "sesion", "label": "Sesión de tratamiento", "icon": "armchair", "title": "Para mi sesión", "items": [
        "Identificación y carnet", "Orden o programación de la sesión", "Ropa cómoda y una capa extra por si hace frío", "Agua y un refrigerio que me caiga bien",
        "Audífonos, libro o algo para distraerme", "Cargador del teléfono", "Indicaciones que me dio mi equipo médico para este día", "Confirmar traslado de ida y de regreso"]},
    {"id": "estudio", "label": "Estudio", "icon": "microscope", "title": "Para mi estudio", "items": [
        "Orden o solicitud del estudio", "Identificación oficial", "Estudios anteriores para comparar", "Indicaciones de preparación que me dieron (anotarlas aquí)",
        "Ropa fácil de quitar y poner", "Preguntar cuándo y cómo se entregan los resultados", "Confirmar horario y traslado"]},
    {"id": "hospitalizacion", "label": "Hospitalización", "icon": "bed", "title": "Para mi hospitalización", "items": [
        "Identificación, carnet o póliza", "Orden de internamiento y documentos que pidió el hospital", "Lista de medicamentos que tomo", "Contactos de emergencia anotados",
        "Pijama o ropa cómoda y pantuflas", "Artículos de higiene personal", "Cargador largo y audífonos", "Algo que me haga sentir en casa (cobija, foto, libro)",
        "Dejar organizado quién cuida la casa, mascotas o familia", "Avisar a mis acompañantes los horarios de visita"]},
    {"id": "blanco", "label": "Empezar en blanco", "icon": "pencil", "title": "Mi lista", "items": []},
]
EVENT_TEMPLATE = {"Cita médica": "cita", "Sesión de tratamiento": "sesion", "Estudio": "estudio"}


def _items(raw, prev: dict | None = None) -> list[dict]:
    out = []
    for it in (raw or [])[:80]:
        text = (it if isinstance(it, str) else (it or {}).get("text") or "").strip()[:200]
        if not text:
            continue
        old = (prev or {}).get(it.get("id")) if isinstance(it, dict) else None
        done = bool(it.get("done")) if isinstance(it, dict) and "done" in it else bool((old or {}).get("done"))
        out.append({"id": (old or {}).get("id") or uid()[:8], "text": text, "done": done, "done_by": (old or {}).get("done_by") if done else None})
    return out


async def _event(owner_id: str, event_id) -> dict | None:
    return await db.records.find_one({"id": event_id, "kind": "events", "owner_id": owner_id}) if event_id else None


async def _view(c: dict, user: dict, names: dict | None = None) -> dict:
    c = clean(c)
    mine = c["owner_id"] == user["id"]
    if not mine:
        names = names if names is not None else {}
        if c["owner_id"] not in names:
            o = await db.users.find_one({"id": c["owner_id"]})
            names[c["owner_id"]] = display_name(o) if o else ""
        c["owner_name"] = names[c["owner_id"]]
    ev = await _event(c["owner_id"], c.get("event_id"))
    if ev and (mine or user["id"] in (ev.get("shared_with") or [])):
        c["event"] = {"id": ev["id"], "title": ev.get("title", ""), "date": ev.get("date", ""), "time": ev.get("time", "")}
        c["date"] = ev.get("date") or c.get("date", "")
    done = sum(1 for i in c["items"] if i["done"])
    return {**c, "mine": mine, "done": done, "total": len(c["items"]), "note": CARE_NOTE}


async def _load(cid: str, user: dict, owner_only=False) -> dict:
    c = await db.checklists.find_one({"id": cid, "deleted_at": None})
    if not c:
        raise HTTPException(404, "No encontramos esta lista")
    if c["owner_id"] != user["id"]:
        if owner_only:
            raise HTTPException(403, "Solo quien creó la lista puede cambiarla")
        if user["id"] not in (c.get("shared_with") or []) or not await active_link(c["owner_id"], user["id"]):
            raise HTTPException(403, "Esta lista no se compartió contigo")
    return c


@api.get("/checklists/templates")
async def checklist_templates(user=Depends(current_user)):
    return {"templates": TEMPLATES, "note": CARE_NOTE}


@api.get("/checklists")
async def list_checklists(user=Depends(current_user)):
    mine = [await _view(c, user) async for c in db.checklists.find({"owner_id": user["id"], "deleted_at": None}).sort("created_at", -1).limit(200)]
    owners = [link["patient_id"] async for link in db.links.find({"caregiver_id": user["id"], "status": "active"})]
    names: dict = {}
    shared = [await _view(c, user, names) async for c in db.checklists.find({"owner_id": {"$in": owners}, "shared_with": user["id"], "deleted_at": None}).sort("created_at", -1).limit(200)]
    return {"mine": mine, "shared": shared}


@api.post("/checklists")
async def create_checklist(body: dict = Body(...), user=Depends(current_user)):
    ev = await _event(user["id"], body.get("event_id"))
    if body.get("event_id") and not ev:
        raise HTTPException(404, "No encontramos esa cita en tu agenda")
    tpl = next((t for t in TEMPLATES if t["id"] == (body.get("template") or (EVENT_TEMPLATE.get(ev.get("type")) if ev else None))), None)
    title = (body.get("title") or "").strip()[:80] or (f"Para {ev['title']}" if ev and ev.get("title") else (tpl or {}).get("title") or "Mi lista")
    c = {"id": uid(), "owner_id": user["id"], "title": title, "kind": (tpl or {}).get("id", "blanco"), "event_id": ev["id"] if ev else None,
         "date": "" if ev else _date_or_empty(body.get("date")), "items": _items(body.get("items") if body.get("items") is not None else (tpl or {}).get("items")),
         "shared_with": await valid_share(user["id"], body.get("shared_with")), "created_at": now_iso()}
    await db.checklists.insert_one(c)
    for cid in c["shared_with"]:
        await notify(cid, f"{display_name(user)} compartió una lista contigo", c["title"], "records", f"/checklist/{c['id']}")
    return await _view(c, user)


@api.get("/checklists/{cid}")
async def get_checklist(cid: str, user=Depends(current_user)):
    return await _view(await _load(cid, user), user)


@api.put("/checklists/{cid}")
async def update_checklist(cid: str, body: dict = Body(...), user=Depends(current_user)):
    c = await _load(cid, user, owner_only=True)
    s: dict = {}
    if "title" in body:
        s["title"] = (body["title"] or "").strip()[:80] or c["title"]
    if "items" in body:
        s["items"] = _items(body["items"], {i["id"]: i for i in c["items"]})
    if "date" in body and not c.get("event_id"):
        s["date"] = _date_or_empty(body["date"])
    if "event_id" in body:
        ev = await _event(user["id"], body["event_id"])
        if body["event_id"] and not ev:
            raise HTTPException(404, "No encontramos esa cita en tu agenda")
        s["event_id"] = ev["id"] if ev else None
    if "shared_with" in body:
        s["shared_with"] = await valid_share(user["id"], body["shared_with"])
        for pid in set(s["shared_with"]) - set(c.get("shared_with") or []):
            await notify(pid, f"{display_name(user)} compartió una lista contigo", s.get("title") or c["title"], "records", f"/checklist/{cid}")
    if s:
        await db.checklists.update_one({"id": cid}, {"$set": s})
    return await _view(await db.checklists.find_one({"id": cid}), user)


@api.post("/checklists/{cid}/toggle")
async def toggle_item(cid: str, item_id: str = Body(..., embed=True), done: bool = Body(..., embed=True), user=Depends(current_user)):
    """The owner and the people the list is shared with can mark what is ready."""
    c = await _load(cid, user)
    r = await db.checklists.update_one({"id": cid, "items.id": item_id}, {"$set": {"items.$.done": done, "items.$.done_by": display_name(user) if done else None}})
    if not r.matched_count:
        raise HTTPException(404, "Ese punto ya no está en la lista")
    c = await db.checklists.find_one({"id": cid})
    if done and c["owner_id"] != user["id"] and all(i["done"] for i in c["items"]):
        await notify(c["owner_id"], "Tu lista está completa", f"{display_name(user)} marcó lo último de «{c['title']}»", "records", f"/checklist/{cid}")
    return await _view(c, user)


@api.post("/checklists/{cid}/reuse")
async def reuse_checklist(cid: str, body: dict = Body({}), user=Depends(current_user)):
    """Copies a list (own or shared with me) into my space with everything unchecked, optionally for another appointment."""
    c = await _load(cid, user)
    ev = await _event(user["id"], body.get("event_id"))
    n = {"id": uid(), "owner_id": user["id"], "title": c["title"], "kind": c.get("kind", "blanco"), "event_id": ev["id"] if ev else None,
         "date": "" if ev else _date_or_empty(body.get("date")), "items": [{"id": uid()[:8], "text": i["text"], "done": False, "done_by": None} for i in c["items"]],
         "shared_with": [], "created_at": now_iso()}
    await db.checklists.insert_one(n)
    return await _view(n, user)


@api.delete("/checklists/{cid}")
async def delete_checklist(cid: str, user=Depends(current_user)):
    await _load(cid, user, owner_only=True)
    await db.checklists.update_one({"id": cid}, {"$set": {"deleted_at": now_iso()}})  # soft delete
    return {"ok": True}


# ---------------------------------------------------------------- Mi próxima semana (Plus)
VISIT = ("appointments", "treatments", "studies")


@api.get("/next-week")
async def next_week(today: str = Query(...), user=Depends(require_plus)):
    """Next seven days at a glance plus what can be prepared. Only uses what the person registered; nothing is assumed or diagnosed."""
    if not _date_or_empty(today):
        raise HTTPException(422, "Fecha no válida")
    from membership import mark_used
    await mark_used(user, "next_week")
    d0 = datetime.strptime(today, "%Y-%m-%d").date()
    end = (d0 + timedelta(days=6)).isoformat()
    items = await agenda_items(user, user["id"], today, end)
    lists = {c["event_id"]: c async for c in db.checklists.find({"owner_id": user["id"], "event_id": {"$ne": None}, "deleted_at": None})}
    days = []
    for n in range(7):
        ds = (d0 + timedelta(days=n)).isoformat()
        day = [i for i in items if i["date"] == ds]
        days.append({"date": ds, "weekday": "Hoy" if n == 0 else "Mañana" if n == 1 else DAYS_ES[(d0 + timedelta(days=n)).weekday()].capitalize(),
                     "items": [i for i in day if i["source"] != "doses"], "doses": sum(1 for i in day if i["source"] == "doses")})
    prepare = []
    transfer_days = {i["date"] for i in items if i["source"] == "transfers"}
    for i in items:
        when = f"{fmt_es(i['date'])}{' · ' + i['time'] if i['time'] else ''}"
        if i["source"] == "events" and i["category"] in VISIT:
            if i["date"] not in transfer_days:
                prepare.append({"key": f"tr-{i['id']}", "icon": "car", "title": f"Organiza cómo llegar a «{i['title']}»", "text": f"{when}. Aún no hay un traslado registrado para ese día.",
                                "action": "Agregar traslado", "link": {"pathname": "/record-form", "params": {"kind": "transfers", "date": i["date"], "title": f"Ida a {i['title']}"[:60]}}})
            c = lists.get(i["id"])
            left = sum(1 for x in c["items"] if not x["done"]) if c else 0
            if not c:
                prepare.append({"key": f"cl-{i['id']}", "icon": "list-checks", "title": f"Arma tu lista para «{i['title']}»", "text": f"{when}. Parte de una lista sugerida y ajústala a tu modo.",
                                "action": "Crear lista", "create_for": i["id"]})
            elif left:
                prepare.append({"key": f"cl-{i['id']}", "icon": "list-checks", "title": f"Te falta{'n' if left > 1 else ''} {left} cosa{'s' if left > 1 else ''} de «{c['title']}»", "text": when,
                                "action": "Ver lista", "link": {"pathname": f"/checklist/{c['id']}"}})
        elif i["source"] == "transfers" and not i.get("confirmed"):
            prepare.append({"key": i["key"], "icon": "car", "title": f"Confirma el traslado «{i['title']}»", "text": f"{when}{' · ' + i['driver'] if i.get('driver') else ''}",
                            "action": "Revisar", "link": {"pathname": "/record-form", "params": {"kind": "transfers", "id": i["id"]}}})
        elif i["source"] == "expenses":
            prepare.append({"key": i["key"], "icon": "wallet", "title": f"Pago pendiente: {i['title']}", "text": f"{when}{' · $' + format(i['amount'], ',.0f') + ' MXN' if isinstance(i.get('amount'), (int, float)) else ''}",
                            "action": "Revisar", "link": {"pathname": "/record-form", "params": {"kind": "expenses", "id": i["id"]}}})
        elif i["source"] == "tasks" and not i.get("done"):
            prepare.append({"key": i["key"], "icon": "circle-check", "title": i["title"], "text": f"Pendiente para el {when}",
                            "action": "Revisar", "link": {"pathname": "/record-form", "params": {"kind": "tasks", "id": i["id"]}}})
    if any(i["category"] == "treatments" and i["source"] == "events" for i in items):
        prepare.append({"key": "kit", "icon": "package", "title": "Revisa lo que quieres llevar a tu sesión", "text": "Tus kits y los sugeridos según guías confiables están en Kits.",
                        "action": "Ver mis kits", "link": {"pathname": "/(tabs)/mykits"}})
    visits = [i for i in items if i["source"] == "events" and i["category"] in VISIT]
    return {"start": today, "end": end, "days": days, "prepare": prepare,
            "summary": {"visits": len(visits), "transfers": sum(1 for i in items if i["source"] == "transfers"),
                        "tasks": sum(1 for i in items if i["source"] == "tasks" and not i.get("done")), "doses": sum(d["doses"] for d in days)},
            "note": "AMODO solo organiza lo que tú registraste. No sustituye las indicaciones de tu equipo médico."}
