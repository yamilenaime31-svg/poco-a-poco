"""AMODO membership model (prototype): Plus subscription (simulated, no charges), monthly Plus credits ledger,
AI usage limits per plan and the admin membership dashboard. All amounts are configurable demo values."""
from datetime import datetime, timedelta, timezone

from fastapi import Body, Depends, HTTPException

from server import api, clean, current_user, db, now_iso, uid

PERIOD_DAYS = 30


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def ensure_indexes():
    await db.credit_moves.create_index("key", unique=True, sparse=True)
    await db.credit_moves.create_index([("user_id", 1), ("at", -1)])
    await db.ai_usage.create_index([("user_id", 1), ("month", 1)], unique=True)
    await db.orders.create_index([("user_id", 1), ("request_id", 1)], unique=True, partialFilterExpression={"request_id": {"$type": "string"}})


async def accrue_plus(user: dict) -> dict:
    """Grants the monthly Plus credit once per confirmed 30-day period (idempotent: unique key per period) and
    rolls the simulated renewal date forward while the subscription stays active."""
    p = user.get("plan") or {}
    if p.get("tier") != "plus" or p.get("source") != "demo" or not p.get("since"):
        return p
    since = datetime.fromisoformat(p["since"])
    periods = int((_now() - since).days // PERIOD_DAYS) + 1
    amount = p.get("monthly_credit", 20)
    for i in range(periods):
        start = (since + timedelta(days=PERIOD_DAYS * i)).date().isoformat()
        key = f"plus:{user['id']}:{start[:7]}"  # one credit per user per calendar month, even if Plus is cancelled and re-activated
        await db.credit_moves.update_one({"key": key}, {"$setOnInsert": {
            "id": uid(), "key": key, "user_id": user["id"], "source": "plus", "amount": amount, "at": now_iso(),
            "text": f"Crédito mensual AMODO Plus (periodo desde {start})"}}, upsert=True)
    until = (since + timedelta(days=PERIOD_DAYS * periods)).date().isoformat()
    if p.get("until") != until:
        p = {**p, "until": until}
        await db.users.update_one({"id": user["id"]}, {"$set": {"plan.until": until}})
    return p


async def plus_balance(user_id: str) -> float:
    r = await db.credit_moves.aggregate([{"$match": {"user_id": user_id}}, {"$group": {"_id": None, "s": {"$sum": "$amount"}}}]).to_list(1)
    return round(r[0]["s"], 2) if r else 0


async def wallet_view(user: dict) -> dict:
    from business import active_benefits
    await accrue_plus(user)
    plus = await plus_balance(user["id"])
    inst = [b for b in await active_benefits(user["id"]) if b["kind"] == "credit"]
    moves = [clean(m) async for m in db.credit_moves.find({"user_id": user["id"]}).sort("at", -1).limit(60)]
    earned = sum(m["amount"] for m in moves if m["amount"] > 0 and m.get("source") == "plus")
    used = -sum(m["amount"] for m in moves if m["amount"] < 0)
    p = (await db.users.find_one({"id": user["id"]})).get("plan") or {}
    active = p.get("tier") == "plus" and p.get("source") == "demo"
    return {"available": round(plus + sum(b.get("remaining", 0) for b in inst), 2), "plus": plus,
            "institution": [{"institution": b["institution"], "label": b.get("label") or "Crédito institucional", "remaining": b.get("remaining", 0),
                             "value": b["value"], "until": b["until"], "kits_only": b.get("scope") == "kits"} for b in inst],
            "earned": earned, "used": used, "moves": moves, "next_credit": p.get("until") if active else None,
            "monthly_credit": p.get("monthly_credit") if active else None,
            "rules": ["Se pueden usar en kits y en suplementos premium.", "No caducan mientras tengas tu cuenta.", "No se pueden cambiar por efectivo ni transferir.",
                      "Si cancelas Plus, conservas los créditos que ya recibiste."]}


@api.get("/wallet")
async def wallet(user=Depends(current_user)):
    return await wallet_view(user)


@api.post("/me/plus/activate")
async def activate_plus(user=Depends(current_user)):
    """Simulated subscription: no payment data, no charge. Price and credit are frozen at activation (changes are not retroactive)."""
    from business import DEFAULT_PLANS, setting, plan_view
    p = user.get("plan") or {}
    if p.get("tier") == "plus" and p.get("source") == "demo":
        return {"plan": await plan_view(user), "already": True}
    cfg = await setting("plans", DEFAULT_PLANS)
    since = now_iso()
    plan = {"tier": "plus", "source": "demo", "since": since, "until": (_now() + timedelta(days=PERIOD_DAYS)).date().isoformat(), "status": "activa",
            "price": cfg["plus_price"], "monthly_credit": cfg["monthly_credit"], "kit_discount_pct": cfg["plus_kit_discount_pct"]}
    await db.users.update_one({"id": user["id"]}, {"$set": {"plan": plan, "plan_chosen": True}})
    await db.subscriptions.insert_one({"id": uid(), "user_id": user["id"], "action": "activada", "price": cfg["plus_price"], "at": since, "demo": True})
    await db.benefit_history.insert_one({"id": uid(), "user_id": user["id"], "at": since, "text": f"Activaste AMODO Plus (${cfg['plus_price']} al mes, demostración sin cargo)."})
    u = await db.users.find_one({"id": user["id"]})
    await accrue_plus(u)
    return {"plan": await plan_view(await db.users.find_one({"id": user["id"]})), "credit": cfg["monthly_credit"]}


@api.post("/me/plus/cancel")
async def cancel_plus(user=Depends(current_user)):
    from business import plan_view
    p = user.get("plan") or {}
    if p.get("tier") != "plus":
        raise HTTPException(400, "No tienes AMODO Plus activo")
    await db.users.update_one({"id": user["id"]}, {"$set": {"plan": {"tier": "free", "cancelled_at": now_iso(), "previous": p}}})
    await db.subscriptions.insert_one({"id": uid(), "user_id": user["id"], "action": "cancelada", "price": p.get("price"), "at": now_iso(), "demo": True})
    await db.benefit_history.insert_one({"id": uid(), "user_id": user["id"], "at": now_iso(), "text": "Cancelaste AMODO Plus. Conservas tu información y tus créditos."})
    return {"plan": await plan_view(await db.users.find_one({"id": user["id"]})), "credits_kept": await plus_balance(user["id"])}


# ---------------------------------------------------------------- AI usage limits
def _month() -> str:
    return _now().strftime("%Y-%m")


async def ai_usage(user: dict) -> dict:
    from business import DEFAULT_PLANS, is_plus, setting
    cfg = await setting("plans", DEFAULT_PLANS)
    plus = await is_plus(user)
    limit = cfg["ai_limit_plus"] if plus else cfg["ai_limit_free"]
    u = await db.ai_usage.find_one({"user_id": user["id"], "month": _month()})
    used = (u or {}).get("count", 0)
    return {"used": used, "limit": limit, "left": max(0, limit - used), "plus": plus, "month": _month()}


async def use_ai(user: dict):
    """Counts one assistant interaction. Over the limit, the manual forms keep working; only the assistant pauses."""
    u = await ai_usage(user)
    if u["left"] <= 0:
        raise HTTPException(429, f"Usaste tus {u['limit']} interacciones con el asistente de este mes. Puedes seguir registrando todo de forma manual."
                                 + ("" if u["plus"] else " Con AMODO Plus tienes más interacciones."))
    await db.ai_usage.update_one({"user_id": user["id"], "month": u["month"]}, {"$inc": {"count": 1}, "$set": {"plus": u["plus"]}}, upsert=True)


async def refund_ai(user: dict):
    """A failed assistant call does not use up the monthly allowance."""
    await db.ai_usage.update_one({"user_id": user["id"], "month": _month(), "count": {"$gt": 0}}, {"$inc": {"count": -1}})


@api.get("/me/ai-usage")
async def my_ai_usage(user=Depends(current_user)):
    return await ai_usage(user)


# ---------------------------------------------------------------- admin
@api.get("/admin/memberships")
async def admin_memberships(user=Depends(current_user)):
    from business import DEFAULT_PLANS, admin_user, plan_view, setting
    await admin_user(user)
    cfg = await setting("plans", DEFAULT_PLANS)
    counts = {"free": 0, "plus": 0, "institutional": 0}
    async for u in db.users.find({"is_admin": {"$ne": True}}):
        pv = await plan_view(u)
        counts["institutional" if pv["plus_by_institution"] or (pv["access"] == "institutional") else pv["tier"]] += 1
    subs = [s async for s in db.subscriptions.find({})]
    active = await db.users.count_documents({"plan.tier": "plus", "plan.source": "demo"})
    agg = lambda match: db.credit_moves.aggregate([{"$match": match}, {"$group": {"_id": None, "s": {"$sum": "$amount"}}}]).to_list(1)  # noqa: E731
    granted = (await agg({"source": "plus", "amount": {"$gt": 0}}) or [{"s": 0}])[0]["s"]
    used = -((await agg({"amount": {"$lt": 0}}) or [{"s": 0}])[0]["s"])
    refunds = (await agg({"source": "refund"}) or [{"s": 0}])[0]["s"]
    orders = [o async for o in db.orders.find({"status": {"$ne": "Cancelado"}})]
    periods = await db.credit_moves.count_documents({"source": "plus", "amount": {"$gt": 0}})
    ai = [clean(a) async for a in db.ai_usage.find({"month": _month()}).sort("count", -1).limit(20)]
    names = {u["id"]: u.get("name", "") async for u in db.users.find({"id": {"$in": [a["user_id"] for a in ai]}})}
    ai_calls = sum(a["count"] for a in ai)
    est = cfg.get("ai_cost_estimate")
    return {"counts": counts, "active_subscriptions": active, "cancelled": sum(1 for s in subs if s["action"] == "cancelada"),
            "plus_price": cfg["plus_price"], "credits_granted": granted, "credits_used": round(used - refunds, 2), "credits_pending": round(granted + refunds - used, 2),
            "discounts_applied": round(sum(d["amount"] for o in orders for d in o.get("discounts", [])), 2),
            "revenue_memberships_demo": round(sum(s.get("price") or 0 for s in subs if s["action"] == "activada") + 0, 2), "plus_periods": periods,
            "revenue_kits_demo": round(sum(o.get("total") or 0 for o in orders), 2),
            "ai_month_calls": ai_calls, "ai_cost_estimate_per_call": est, "ai_cost_month": round(ai_calls * est, 2) if est else None,
            "ai_by_user": [{"name": names.get(a["user_id"], ""), "count": a["count"], "plus": a.get("plus", False)} for a in ai],
            "limits": {"free": cfg["ai_limit_free"], "plus": cfg["ai_limit_plus"]},
            "history": [clean(s) for s in sorted(subs, key=lambda s: s["at"], reverse=True)[:30]],
            "note": "Cifras de demostración: no hay cobros reales. El costo de IA solo se calcula si administración captura un costo estimado por interacción."}


async def mark_used(user: dict, key: str):
    """Remembers that the person has tried a Plus tool at least once (only the fact, no content)."""
    await db.plus_marks.update_one({"user_id": user["id"], "key": key}, {"$setOnInsert": {"at": now_iso()}}, upsert=True)


PLUS_TOOLS = [  # key, title, why, where it opens
    ("next_week", "Mi próxima semana", "Tus próximos siete días y lo que conviene preparar.", "/next-week"),
    ("style", "Identidad y estilo", "Propuestas del catálogo con tus colores y texturas.", "/style"),
    ("process_report", "Reporte de Mi proceso", "Un PDF con el periodo y las secciones que elijas.", "/process-report"),
    ("finance_report", "Reportes de gastos", "Reporte financiero, de reembolsos o expediente en PDF.", "/finances"),
    ("cashflow", "Flujo de efectivo estimado", "En Gastos: lo que viene por pagar y recuperar, mes a mes.", "/finances"),
    ("doc_ai", "Lectura de documentos con IA", "Adjunta un comprobante a un gasto y la IA te propone los datos.", "/finances"),
    ("kit_discount", "Descuento Plus en kits", "Se aplica solo al pagar un kit.", "/kit-builder"),
]


@api.get("/me/plus-usage")
async def plus_usage(user=Depends(current_user)):
    """What the membership gave this calendar month, counted only from what really happened in the account."""
    from business import plan_view
    plan = await plan_view(user)
    if plan["tier"] != "plus":
        raise HTTPException(403, "Esta herramienta es parte de AMODO Plus.")
    month = _month()
    me = {"user_id": user["id"]}
    this = {"$regex": f"^{month}"}
    reports = await db.process_reports.count_documents({**me, "created_at": this})
    fin_reports = await db.finance_links.count_documents({**me, "report": {"$exists": True}, "expires": this})
    received = used = 0.0
    async for m in db.credit_moves.find({**me, "source": "plus", "at": this}):
        if m["amount"] > 0:
            received += m["amount"]
        else:
            used -= m["amount"]
    saved, orders = 0.0, 0
    async for o in db.orders.find({**me, "created_at": this, "status": {"$ne": "Cancelado"}}):
        s = sum(d["amount"] for d in o.get("discounts") or [] if "Plus" in d.get("label", ""))
        if s:
            saved, orders = saved + s, orders + 1
    ai = await db.ai_usage.find_one({**me, "month": month}) or {}
    images = await db.style_images.count_documents({**me, "created_at": this})
    marks = {m["key"] async for m in db.plus_marks.find(me)}
    tried = {
        "next_week": "next_week" in marks,
        "style": "style" in marks or bool(await db.style_images.find_one(me)),
        "process_report": bool(await db.process_reports.find_one(me)),
        "finance_report": bool(await db.finance_links.find_one({**me, "report": {"$exists": True}})),
        "cashflow": "cashflow" in marks,
        "doc_ai": "doc_ai" in marks,
        "kit_discount": bool(await db.orders.find_one({**me, "status": {"$ne": "Cancelado"}, "discounts.label": {"$regex": "Plus"}})),
    }
    unused = [{"key": k, "title": t, "why": w, "href": h} for k, t, w, h in PLUS_TOOLS if not tried[k]]
    return {"month": month, "unused": unused, "tools": len(PLUS_TOOLS), "reports": reports + fin_reports, "credits_received": round(received, 2), "credits_used": round(used, 2), "kit_savings": round(saved, 2), "kit_orders": orders,
            "ai": ai.get("count", 0), "inspirations": images, "value": round(received + saved, 2),
            "price": (plan.get("subscription") or {}).get("price") or plan["prices"]["plus_price"], "by_institution": bool(plan.get("plus_by_institution"))}
