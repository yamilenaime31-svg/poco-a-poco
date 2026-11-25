"""AMODO business model (prototype): wholesale catalog with internal costs, kit sizes with included/premium items,
inventory with reservations, Free/Plus plans, institutional codes, checkout breakdown and an admin API.
All commercial figures are illustrative demo values editable from admin; payments are never processed."""
import random
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Body, Depends, HTTPException

from server import api, cart_view, clean, display_name, current_user, db, notify, now_iso, products_map, uid

INTERNAL = ("unit_cost", "prep_cost", "supplier_id", "min_order", "ref_price", "stock_reserved")
DEFAULT_SIZES = [
    {"id": "Chico", "label": "Kit chico", "max": 4, "base": 299, "text": "4 artículos"},
    {"id": "Mediano", "label": "Kit mediano", "max": 6, "base": 499, "text": "6 artículos"},
    {"id": "Grande", "label": "Kit grande", "max": 10, "base": 799, "text": "Hasta 10 artículos"},
]
SIZE_ALIAS = {"Pequeño": "Chico"}
DEFAULT_COSTS = {"packaging": 20, "assembly": 12, "labels": 0, "protection": 0, "storage": 0, "logistics": 0, "shipping": 85, "incidents": 8,
                 "payment_fee_pct": 3.5, "tax_pct": 16, "min_margin_pct": 30}
DEFAULT_PLANS = {"plus_price": 79, "plus_kit_discount_pct": 10, "monthly_credit": 20, "ai_limit_free": 15, "ai_limit_plus": 300, "ai_cost_estimate": None,
                 "stacking": "best", "max_discount_pct": 25,
                 "shipping": {"Estándar": 0, "Recoger en punto AMODO": 0}}  # shipping is included in kit prices
# New illustrative items for the "kit chico" example (included vs premium).
EXTRA = [
    ("p33", "Pañuelo básico de algodón", "Identidad y estilo", "Pañuelos", 189, ["Pañuelos", "Gorro o pañoleta", "estilo"], "Algodón ligero, fácil de anudar.", "incluido", 0, 30),
    ("p34", "Pañuelo de seda premium", "Identidad y estilo", "Pañuelos", 420, ["Pañuelos", "Gorro o pañoleta", "estilo"], "Seda suave con caída ligera.", "premium", 120, 140),
    ("p35", "Set de dibujo especial", "Entretenimiento", "", 320, ["Dibujar", "entretenimiento", "personal"], "Acuarelas, pinceles y papel grueso.", "premium", 65, 95),
    ("p36", "Antifaz premium de seda", "Comodidad", "", 290, ["Descansar", "Luz tenue", "descanso", "llevar"], "Seda con relleno suave y banda ajustable.", "premium", 80, 85),
    ("p37", "Bolsa organizadora", "Organización", "", 179, ["organización", "llevar", "preparación"], "Bolsa con compartimentos para lo esencial.", "incluido", 0, 32),
    ("p38", "Organizador premium de viaje", "Organización", "", 390, ["organización", "llevar", "preparación", "papeles"], "Organizador acolchado con bolsillos y asa.", "premium", 90, 110),
]
PREMIUM = {"p1": (120, 110), "p11": (60, 90), "p26": (1400, 650), "p12": (40, 75)}
SUPPLIERS = [
    {"id": "s1", "name": "Textiles Demo S.A.", "contact": "ventas@textiles-demo.mx · 55 0000 0001", "lead_days": 10, "terms": "50% anticipo, 50% contra entrega",
     "notes": "Datos de demostración, sin cotización real."},
    {"id": "s2", "name": "Papelería Mayorista Demo", "contact": "contacto@papeleria-demo.mx · 55 0000 0002", "lead_days": 7, "terms": "Pago a 15 días",
     "notes": "Datos de demostración, sin cotización real."},
    {"id": "s3", "name": "Cuidado Personal Demo", "contact": "pedidos@cuidado-demo.mx · 55 0000 0003", "lead_days": 12, "terms": "Pago anticipado",
     "notes": "Datos de demostración, sin cotización real."},
]
SUPPLIER_BY_CAT = {"Comodidad": "s1", "Identidad y estilo": "s1", "Entretenimiento": "s2", "Organización": "s2", "Detalles": "s2",
                   "Cuidado personal": "s3", "Antojos y preferencias": "s3"}
ORDER_FLOW = ["Pedido confirmado", "En preparación", "Listo para envío", "En camino", "Entregado"]
ORDER_STATUSES = ORDER_FLOW + ["Cancelado"]
LEGACY_STATUS = {"Borrador": "Pedido confirmado", "Pendiente de confirmación": "Pedido confirmado", "Confirmado": "Pedido confirmado", "Enviado": "En camino"}
USER_CANCELLABLE = ("Pedido confirmado", "En preparación")


def now() -> datetime:
    return datetime.now(timezone.utc)


async def setting(key: str, default: dict) -> dict:
    s = await db.biz_settings.find_one({"id": key})
    return {**default, **((s or {}).get("value") or {})}


async def get_sizes() -> dict:
    s = await db.biz_settings.find_one({"id": "sizes"})
    return {x["id"]: x for x in ((s or {}).get("value") or DEFAULT_SIZES)}


def norm_size(size: Optional[str]) -> str:
    return SIZE_ALIAS.get(size or "", size or "Mediano")


def public_product(p: dict) -> dict:
    p = clean(p)
    for k in INTERNAL:
        p.pop(k, None)
    p["available"] = p.get("status", "activo") == "activo" and p.get("stock", 0) > 0
    p.pop("stock", None)
    return p


async def seed_business():
    for pid, name, cat, sub, price, tags, desc, tier, sup, cost in EXTRA:
        await db.products.update_one({"id": pid}, {"$setOnInsert": {"id": pid, "name": name, "category": cat, "subcategory": sub, "price": price, "tags": tags,
                                                                    "colors": [], "personalize_text": False, "description": desc, "image": None,
                                                                    "tier": tier, "supplement": sup, "unit_cost": cost}}, upsert=True)
    async for p in db.products.find({"sku": {"$exists": False}}):
        sup, cost = PREMIUM.get(p["id"], (0, None))
        await db.products.update_one({"id": p["id"]}, {"$set": {
            "sku": f"AM-{p['id'].upper()}", "tier": p.get("tier") or ("premium" if sup else "incluido"), "supplement": p.get("supplement", sup),
            "unit_cost": p.get("unit_cost") or cost or round(p["price"] * 0.2), "prep_cost": 3, "min_order": 24, "ref_price": None,
            "supplier_id": SUPPLIER_BY_CAT.get(p["category"], "s2"), "stock": 0 if p["id"] == "p13" else 40, "stock_reserved": 0,
            "sizes": ["Chico", "Mediano", "Grande"], "status": "agotado" if p["id"] == "p13" else "activo"}})
        await db.inventory.insert_one({"id": uid(), "product_id": p["id"], "type": "entrada", "qty": 0 if p["id"] == "p13" else 40,
                                       "note": "Inventario inicial (simulado)", "simulated": True, "at": now_iso()})
    for s in SUPPLIERS:
        await db.suppliers.update_one({"id": s["id"]}, {"$setOnInsert": {**s, "demo": True}}, upsert=True)
    if not await db.codes.find_one({}):
        y = now().year
        await db.codes.insert_many([
            {"id": uid(), "code": "HOSPITAL-DEMO", "institution": "Hospital de demostración", "institution_type": "Hospital",
             "benefits": {"plus_months": 3, "kit_discount_pct": 15, "credit": 150}, "valid_from": f"{y}-01-01", "valid_until": f"{y + 1}-12-31",
             "max_uses": 100, "uses": 0, "budget": 15000, "budget_used": 0, "status": "activo", "demo": True,
             "conditions": "Beneficios de ejemplo; no representan un convenio existente. El crédito aplica a artículos y kits, no al envío."},
            {"id": uid(), "code": "FUNDACION-2024", "institution": "Fundación de demostración", "institution_type": "Fundación",
             "benefits": {"plus_months": 1, "kit_discount_pct": 10, "credit": 0}, "valid_from": "2024-01-01", "valid_until": "2024-12-31",
             "max_uses": 50, "uses": 0, "budget": 5000, "budget_used": 0, "status": "activo", "demo": True, "conditions": "Código vencido de ejemplo."},
        ])
    y = now().year
    for code, inst, typ, ben in [("CONVENIO-A", "Hospital de ejemplo A", "Hospital", {"plus_months": 3}),
                                 ("CONVENIO-B", "Clínica de ejemplo B", "Clínica", {"plus_months": 6, "kit_discount_pct": 10}),
                                 ("CONVENIO-C", "Fundación de ejemplo C", "Fundación", {"credit": 300}),
                                 ("CONVENIO-D", "Aseguradora de ejemplo D", "Aseguradora", {"funded_kit": "Chico"})]:
        await db.codes.update_one({"code": code}, {"$setOnInsert": {"id": uid(), "code": code, "institution": inst, "institution_type": typ,
                                   "benefits": {"plus_months": 0, "kit_discount_pct": 0, "credit": 0, "funded_kit": None, **ben}, "valid_from": f"{y}-01-01",
                                   "valid_until": f"{y + 1}-12-31", "max_uses": 200, "uses": 0, "budget": None, "budget_used": 0, "status": "activo", "demo": True,
                                   "conditions": "Convenio de ejemplo para el prototipo; no representa un acuerdo real."}}, upsert=True)
    async for o in db.orders.find({"$or": [{"status": {"$in": list(LEGACY_STATUS)}}, {"history.status": {"$in": list(LEGACY_STATUS)}}]}):
        hist, seen = [], set()
        for h in o.get("history", []):
            s = LEGACY_STATUS.get(h["status"], h["status"])
            if s not in seen:
                seen.add(s)
                hist.append({**h, "status": s})
        await db.orders.update_one({"id": o["id"]}, {"$set": {"status": LEGACY_STATUS.get(o["status"], o["status"]), "history": hist,
                                                             "shipped": o.get("shipped") or o["status"] in ("Enviado", "Entregado")}})
    from membership import ensure_indexes
    await ensure_indexes()
    if not await db.users.find_one({"is_admin": True}):
        await db.users.update_one({"email": "demo@amodo.app"}, {"$set": {"is_admin": True}})


# ---------------------------------------------------------------- plans & benefits
async def is_plus(user: dict) -> bool:
    return (await plan_view(user))["tier"] == "plus"


async def require_plus(user=Depends(current_user)):
    """Plus-only conveniences (never safety info or essential reminders)."""
    if not await is_plus(user):
        raise HTTPException(403, "Esta herramienta es parte de AMODO Plus.")
    return user
async def active_benefits(user_id: str) -> list[dict]:
    today = now().date().isoformat()
    return [clean(b) async for b in db.benefits.find({"user_id": user_id, "until": {"$gte": today}, "status": "activo"})]


async def plan_view(user: dict) -> dict:
    from membership import accrue_plus
    user = {**user, "plan": await accrue_plus(user)}
    today = now().date().isoformat()
    bens = await active_benefits(user["id"])
    p = user.get("plan") or {}
    demo_plus = p.get("tier") == "plus" and (p.get("until") or "") >= today
    inst_plus = next((b for b in bens if b["kind"] == "plus_access"), None)
    tier = "plus" if demo_plus or inst_plus else "free"
    source = "Institucional" if inst_plus and not demo_plus else "Demostración" if demo_plus else ""
    until = max([x for x in [p.get("until") if demo_plus else None, inst_plus["until"] if inst_plus else None] if x], default=None)
    history = [clean(h) async for h in db.benefit_history.find({"user_id": user["id"]}).sort("at", -1).limit(30)]
    expired = [clean(b) async for b in db.benefits.find({"user_id": user["id"], "until": {"$lt": today}}).sort("until", -1).limit(20)]
    if p.get("tier") == "plus" and not demo_plus and p.get("until"):
        expired.insert(0, {"id": "plus-demo", "kind": "plus_demo", "institution": "", "until": p["until"]})
    institution = (inst_plus or next(iter(bens), None) or {}).get("institution") or ""
    access = "institutional" if bens and (inst_plus or not demo_plus) else "plus" if demo_plus else "free"
    return {"tier": tier, "access": access, "name": "AMODO Plus" if tier == "plus" else "AMODO Gratis", "source": source, "until": until,
            "subscription": {k: p.get(k) for k in ("since", "price", "monthly_credit", "kit_discount_pct", "status")} if demo_plus else None,
            "institution": institution, "plus_by_institution": bool(inst_plus) and not demo_plus,
            "benefits": bens, "expired": expired, "history": history, "prices": await setting("plans", DEFAULT_PLANS)}


@api.get("/me/plan")
async def my_plan(user=Depends(current_user)):
    return await plan_view(user)


@api.post("/me/plan")
async def change_plan(action: str = Body(..., embed=True), user=Depends(current_user)):
    """Demo only: Plus activates without any charge and can be cancelled any time."""
    from membership import activate_plus, cancel_plus
    if action == "plus":
        await activate_plus(user)
    elif action == "free":
        if (user.get("plan") or {}).get("tier") == "plus":
            await cancel_plus(user)
        await db.users.update_one({"id": user["id"]}, {"$set": {"plan_chosen": True}})
    else:
        raise HTTPException(422, "Opción no válida")
    return await plan_view(await db.users.find_one({"id": user["id"]}))


def code_problem(c: Optional[dict], today: str) -> Optional[str]:
    if not c:
        return "No pudimos encontrar este código. Revísalo e inténtalo nuevamente."
    if c.get("status") != "activo":
        return "Este código ya no está activo."
    if today < c.get("valid_from", "") or today > c.get("valid_until", "9999"):
        return "Este código ya no está vigente."
    if c.get("uses", 0) >= c.get("max_uses", 0):
        return "Este código alcanzó su límite de usos."
    if c.get("budget") is not None and c.get("budget_used", 0) + (c["benefits"].get("credit") or 0) > c["budget"]:
        return "El presupuesto de este código se agotó."
    return None


def describe(b: dict) -> list[str]:
    out = []
    if b.get("plus_months"):
        out.append(f"Acceso Plus por {b['plus_months']} {'mes' if b['plus_months'] == 1 else 'meses'}")
    if b.get("kit_discount_pct"):
        out.append(f"{b['kit_discount_pct']}% de descuento en kits")
    if b.get("credit"):
        out.append(f"Un crédito de ${b['credit']} para artículos")
    if b.get("funded_kit"):
        out.append(f"Un {b['funded_kit'].lower()} financiado por la institución" if b["funded_kit"] != "Chico" else "Un kit chico financiado por la institución")
    if not out:
        out.append("Acceso a AMODO Gratis acompañado por tu institución")
    return out


@api.post("/benefits/validate")
async def validate_code(code: str = Body(..., embed=True), user=Depends(current_user)):
    c = await db.codes.find_one({"code": code.strip().upper()})
    err = code_problem(c, now().date().isoformat())
    if not err and await db.code_activations.find_one({"code_id": c["id"], "user_id": user["id"]}):
        err = "Ya activaste este código en tu cuenta."
    if err:
        raise HTTPException(400, err)
    return {"institution": c["institution"], "institution_type": c["institution_type"], "benefits": describe(c["benefits"]), "conditions": c.get("conditions", ""),
            "valid_until": c["valid_until"], "privacy": "La institución no recibe tu información médica ni tus registros."}


@api.post("/benefits/activate")
async def activate_code(code: str = Body(..., embed=True), user=Depends(current_user)):
    c = await db.codes.find_one({"code": code.strip().upper()})
    today = now().date()
    err = code_problem(c, today.isoformat())
    if err:
        raise HTTPException(400, err)
    try:
        await db.code_activations.insert_one({"id": uid(), "code_id": c["id"], "user_id": user["id"], "at": now_iso()})  # unique (code_id,user_id)
    except Exception:
        raise HTTPException(400, "Ya activaste este código en tu cuenta.")
    # Atomic usage increment guards the limit under concurrency.
    res = await db.codes.update_one({"id": c["id"], "uses": {"$lt": c["max_uses"]}}, {"$inc": {"uses": 1, "budget_used": c["benefits"].get("credit") or 0}})
    if not res.modified_count:
        await db.code_activations.delete_one({"code_id": c["id"], "user_id": user["id"]})
        raise HTTPException(400, "Este código alcanzó su límite de usos.")
    b, base = c["benefits"], {"user_id": user["id"], "code_id": c["id"], "institution": c["institution"], "status": "activo", "created_at": now_iso()}
    until = c["valid_until"]
    docs = []
    if b.get("plus_months"):
        docs.append({**base, "id": uid(), "kind": "plus_access", "value": b["plus_months"], "until": (today + timedelta(days=30 * b["plus_months"])).isoformat()})
    if b.get("kit_discount_pct"):
        docs.append({**base, "id": uid(), "kind": "kit_discount_pct", "value": b["kit_discount_pct"], "until": until})
    if b.get("credit"):
        docs.append({**base, "id": uid(), "kind": "credit", "value": b["credit"], "remaining": b["credit"], "until": until})
    if b.get("funded_kit"):
        s = (await get_sizes()).get(b["funded_kit"]) or (await get_sizes())["Chico"]
        docs.append({**base, "id": uid(), "kind": "credit", "scope": "kits", "label": f"{s['label']} financiado", "value": s["base"], "remaining": s["base"], "until": until})
    if docs:
        await db.benefits.insert_many(docs)
    await db.users.update_one({"id": user["id"]}, {"$set": {"plan_chosen": True}})
    await db.benefit_history.insert_one({"id": uid(), "user_id": user["id"], "at": now_iso(), "text": f"Activaste el código de {c['institution']}: {', '.join(describe(b))}."})
    return await plan_view(user)


# ---------------------------------------------------------------- pricing
async def price_kit(size: str, items: list[dict], pm: Optional[dict] = None) -> dict:
    sizes = await get_sizes()
    size = norm_size(size)
    s = sizes.get(size) or sizes["Mediano"]
    pm = pm or await products_map([i["product_id"] for i in items])
    lines = []
    for i in items:
        p = pm.get(i["product_id"])
        if not p:
            continue
        sup = p.get("supplement", 0) if p.get("tier") == "premium" else 0
        lines.append({"product_id": p["id"], "name": p["name"], "category": p["category"], "tier": p.get("tier", "incluido"), "supplement": sup,
                      "available": p.get("status", "activo") == "activo" and p.get("stock", 0) - p.get("stock_reserved", 0) > 0})
    supp = sum(line["supplement"] for line in lines)
    return {"size": size, "size_label": s["label"], "capacity": s["max"], "count": len(lines), "remaining": max(0, s["max"] - len(lines)),
            "base": s["base"], "supplements": supp, "subtotal": s["base"] + supp, "lines": lines, "unavailable": [x["name"] for x in lines if not x["available"]]}


async def breakdown(user: dict, kit_base: float, kit_supp: float, other_subtotal: float, use_credit=None) -> dict:
    """Order: base price → discounts (on kit base prices only, never on premium supplements) → credits chosen by the person.
    Shipping is always included. The total is never negative."""
    from membership import plus_balance
    cfg = await setting("plans", DEFAULT_PLANS)
    plan = await plan_view(user)
    pcts = []
    if plan["tier"] == "plus":
        pct_plus = (plan.get("subscription") or {}).get("kit_discount_pct") or cfg["plus_kit_discount_pct"]
        if pct_plus:
            pcts.append(("Descuento AMODO Plus", pct_plus, 0))
    for bn in plan["benefits"]:
        if bn["kind"] == "kit_discount_pct":
            pcts.append((f"Descuento de {bn['institution']}", bn["value"], 1))
    discounts = []
    if pcts and kit_base:
        if cfg["stacking"] == "sum":
            pct = min(cfg["max_discount_pct"], sum(p for _, p, _ in pcts))
            label = " + ".join(lbl for lbl, _, _ in pcts)
        else:  # "best": only the single best discount applies, never duplicated
            label, pct, _ = max(pcts, key=lambda x: (x[1], x[2]))  # on a tie, credit the institution
        discounts.append({"label": f"{label} ({pct}%)", "pct": pct, "amount": round(kit_base * pct / 100, 2)})
    disc = sum(d["amount"] for d in discounts)
    kit_left = max(0, kit_base + kit_supp - disc)
    goods = round(max(0, kit_base + kit_supp + other_subtotal - disc), 2)
    inst = [bn for bn in plan["benefits"] if bn["kind"] == "credit"]
    inst_kits = min(sum(bn.get("remaining", 0) for bn in inst if bn.get("scope") == "kits"), kit_left)  # funded kits apply to kits only
    inst_any = min(sum(bn.get("remaining", 0) for bn in inst if bn.get("scope") != "kits"), goods - inst_kits)
    plus_av = await plus_balance(user["id"])
    max_credit = round(min(goods, inst_kits + inst_any + plus_av), 2)
    want = max_credit if use_credit is None else max(0.0, min(float(use_credit), max_credit))
    use_inst = round(min(want, inst_kits + inst_any), 2)  # institutional credit first (it has an expiry date)
    use_plus = round(min(want - use_inst, plus_av), 2)
    credit = round(use_inst + use_plus, 2)
    total = round(max(0, goods - credit), 2)
    rule = "Se aplica solo el mayor descuento disponible; no se combinan." if cfg["stacking"] == "best" else f"Los descuentos se suman hasta un máximo de {cfg['max_discount_pct']}%."
    return {"kits": round(kit_base + kit_supp, 2), "kit_base": kit_base, "supplements": kit_supp, "others": other_subtotal, "discounts": discounts,
            "subtotal_after_discounts": goods, "credit_available": round(sum(bn.get("remaining", 0) for bn in inst) + plus_av, 2), "credit_max": max_credit,
            "credit": credit, "credit_institution": use_inst, "credit_plus": use_plus, "items_total": total, "shipping": 0, "shipping_included": True, "total": total,
            "plan": plan["name"], "rule": rule + " Los descuentos aplican al precio base de los kits, no a los suplementos premium.",
            "tax_note": "Precios provisionales con IVA incluido.", "demo": True}


@api.get("/kit-sizes")
async def kit_sizes():
    return list((await get_sizes()).values())


@api.post("/kits/quote")
async def kit_quote(size: str = Body(..., embed=True), items: list = Body(..., embed=True), user=Depends(current_user)):
    q = await price_kit(size, [i for i in items if isinstance(i, dict) and i.get("product_id")])
    if q["count"] > q["capacity"]:
        raise HTTPException(422, f"Este tamaño admite {q['capacity']} artículos")
    return {**q, "breakdown": await breakdown(user, q["base"], q["supplements"], 0)}


@api.get("/checkout/quote")
async def checkout_quote(shipping: str = "Estándar", use_credit: Optional[float] = None, user=Depends(current_user)):
    cart = await cart_view(user["id"])
    kits = [i for i in cart["items"] if i["type"] == "kit"]
    base = sum((i.get("base") or 0) * i["qty"] for i in kits)
    supp = sum(i["subtotal"] for i in kits) - base
    q = await breakdown(user, base, supp, cart["subtotal"] - base - supp, use_credit)
    return {**q, "items": cart["items"]}


async def order_lines_stock(cart: dict) -> dict[str, int]:
    need: dict[str, int] = {}
    for i in cart["items"]:
        if i["type"] == "product":
            need[i["ref_id"]] = need.get(i["ref_id"], 0) + i["qty"]
        else:
            for pid in i.get("product_ids", []):
                need[pid] = need.get(pid, 0) + i["qty"]
    return need


async def place_order(user: dict, address: dict, shipping: str, use_credit=None, request_id: Optional[str] = None) -> dict:
    """Creates a demo order: no payment is processed. Stock is reserved (not discounted) until it ships; cancelling releases it."""
    if request_id:
        prev = await db.orders.find_one({"user_id": user["id"], "request_id": request_id})
        if prev:
            return prev  # the same confirmation tapped twice never creates a second order
    cart = await cart_view(user["id"])
    if not cart["items"]:
        raise HTTPException(400, "Tu carrito está vacío")
    need = await order_lines_stock(cart)
    pm = await products_map(list(need))
    short = [pm[p]["name"] for p, q in need.items() if p in pm and (pm[p].get("status", "activo") != "activo" or pm[p].get("stock", 0) - pm[p].get("stock_reserved", 0) < q)]
    if short:
        raise HTTPException(409, f"Sin inventario suficiente: {', '.join(short)}. Cambia esos artículos para continuar.")
    q = await checkout_quote(shipping, use_credit, user)
    order_id = uid()
    try:
        await db.orders.insert_one({"id": order_id, "user_id": user["id"], "request_id": request_id, "status": "_placing", "created_at": now_iso()})
    except Exception:
        prev = await db.orders.find_one({"user_id": user["id"], "request_id": request_id})
        if prev:
            return prev
        raise
    for p, n in need.items():
        await db.products.update_one({"id": p}, {"$inc": {"stock_reserved": n}})
        await db.inventory.insert_one({"id": uid(), "product_id": p, "type": "reserva", "qty": n, "note": "Reserva por pedido (simulado)", "simulated": True, "at": now_iso()})
    left = q["credit_institution"]
    async for b in db.benefits.find({"user_id": user["id"], "kind": "credit", "status": "activo", "remaining": {"$gt": 0}}).sort("scope", -1):
        if left <= 0:
            break
        use = min(left, b["remaining"])
        await db.benefits.update_one({"id": b["id"]}, {"$inc": {"remaining": -use}})
        left -= use
    if q["credit_plus"]:
        await db.credit_moves.insert_one({"id": uid(), "user_id": user["id"], "source": "plus", "amount": -q["credit_plus"], "order_id": order_id, "at": now_iso(),
                                          "text": "Créditos usados en un pedido"})
    order = {"id": order_id, "user_id": user["id"], "request_id": request_id, "number": f"AM-{random.randint(10000, 99999)}", "status": "Pedido confirmado",
             "items": [{k: i.get(k) for k in ("type", "ref_id", "name", "detail", "qty", "price", "subtotal", "options", "product_ids")} for i in cart["items"]],
             "subtotal": cart["subtotal"], "kit_base": q["kit_base"], "supplements": q["supplements"], "discounts": q["discounts"], "credit": q["credit"],
             "credit_institution": q["credit_institution"], "credit_plus": q["credit_plus"], "plan": q["plan"], "shipping_cost": 0, "total": q["total"],
             "reserved": need, "address": address, "payment": {"method": "Demostración", "status": "No procesado — pedido de demostración sin cargo"},
             "history": [{"status": "Pedido confirmado", "at": now_iso()}], "created_at": now_iso(), "demo": True}
    await db.orders.replace_one({"id": order_id}, order)
    await db.cart.delete_many({"user_id": user["id"]})
    if q["credit"]:
        await db.benefit_history.insert_one({"id": uid(), "user_id": user["id"], "at": now_iso(), "text": f"Usaste ${q['credit']} de crédito en el pedido {order['number']}."})
    await notify(user["id"], "Pedido registrado", f"Tu pedido de demostración {order['number']} está confirmado.", "order", f"/order/{order['id']}")
    for i in cart["items"]:
        k = await db.kits.find_one({"id": i["ref_id"], "gift": True}) if i["type"] == "kit" else None
        if k and k.get("for_user_id") and k["for_user_id"] not in (k.get("shared_with") or []):
            await db.kits.update_one({"id": k["id"]}, {"$addToSet": {"shared_with": k["for_user_id"]}})
            msg = f"«{k['note']}»" if k.get("note") else "Va en camino."
            await notify(k["for_user_id"], f"{display_name(user)} te envió un kit", f"{k['name'].replace(' · regalo', '')}. {msg}", "order", f"/kit/{k['id']}")
    return order


async def set_order_status(o: dict, status: str):
    if status not in ORDER_STATUSES:
        raise HTTPException(422, "Estado no válido")
    prev = o.get("status")
    if prev in ("Cancelado", "Entregado"):
        raise HTTPException(400, "Este pedido ya está cerrado")
    if status == prev:
        raise HTTPException(400, "El pedido ya está en ese estado")
    if status != "Cancelado" and prev in ORDER_FLOW and ORDER_FLOW.index(status) < ORDER_FLOW.index(prev):
        raise HTTPException(400, "El seguimiento solo avanza: no se puede regresar a un estado anterior")
    if status == "Cancelado" and o.get("shipped"):
        raise HTTPException(400, "Este pedido ya salió y no se puede cancelar")
    ship_now = status in ("En camino", "Entregado") and not o.get("shipped")
    for p, n in (o.get("reserved") or {}).items():
        if status == "Cancelado":
            await db.products.update_one({"id": p}, {"$inc": {"stock_reserved": -n}})
            await db.inventory.insert_one({"id": uid(), "product_id": p, "type": "liberación", "qty": n, "note": f"Pedido {o['number']} cancelado (simulado)", "simulated": True, "at": now_iso()})
        if ship_now:
            await db.products.update_one({"id": p}, {"$inc": {"stock_reserved": -n, "stock": -n}})
            await db.inventory.insert_one({"id": uid(), "product_id": p, "type": "salida", "qty": n, "note": f"Pedido {o['number']} en camino (simulado)", "simulated": True, "at": now_iso()})
    if status == "Cancelado" and o.get("credit_plus"):
        await db.credit_moves.insert_one({"id": uid(), "user_id": o["user_id"], "source": "refund", "amount": o["credit_plus"], "order_id": o["id"], "at": now_iso(),
                                          "text": f"Devolución de créditos por cancelar el pedido {o['number']}"})
    inst_used = o.get("credit_institution", o.get("credit") if "credit_plus" not in o else 0)
    if status == "Cancelado" and inst_used:
        # Refund the institutional credit used by this order (to the most recent active credit benefit).
        b = await db.benefits.find_one({"user_id": o["user_id"], "kind": "credit"}, sort=[("created_at", -1)])
        if b:
            await db.benefits.update_one({"id": b["id"]}, {"$inc": {"remaining": min(inst_used, b["value"] - b.get("remaining", 0))}})
            await db.benefit_history.insert_one({"id": uid(), "user_id": o["user_id"], "at": now_iso(), "text": f"Se devolvieron ${inst_used} de crédito institucional por cancelar el pedido {o['number']}."})
    if status == "Cancelado":
        for i in o.get("items", []):
            k = await db.kits.find_one({"id": i["ref_id"], "gift": True}) if i["type"] == "kit" else None
            other = await db.orders.find_one({"id": {"$ne": o["id"]}, "items.ref_id": i["ref_id"], "status": {"$nin": ["Cancelado"]}}) if k else None
            if k and not other and k.get("for_user_id") in (k.get("shared_with") or []):
                await db.kits.update_one({"id": k["id"]}, {"$pull": {"shared_with": k["for_user_id"]}})
                sender = await db.users.find_one({"id": o["user_id"]})
                await notify(k["for_user_id"], "Un envío se canceló", f"El kit «{k['name'].replace(' · regalo', '')}» que te preparó {display_name(sender) if sender else 'alguien de tu red'} ya no se enviará.", "order", "/notifications")
    await db.orders.update_one({"id": o["id"]}, {"$set": {"status": status, "cancelled": status == "Cancelado", "shipped": bool(o.get("shipped") or ship_now)},
                                                 "$push": {"history": {"status": status, "at": now_iso()}}})
    await notify(o["user_id"], "Tu pedido cambió de estado", f"{o['number']}: {status}.", "order", f"/order/{o['id']}")


@api.post("/orders/{oid}/repeat")
async def repeat_order(oid: str, user=Depends(current_user)):
    o = await db.orders.find_one({"id": oid, "user_id": user["id"]})
    if not o:
        raise HTTPException(404, "Pedido no encontrado")
    for i in o["items"]:
        await db.cart.insert_one({"id": uid(), "user_id": user["id"], "type": i["type"], "ref_id": i["ref_id"], "qty": i["qty"], "options": i.get("options") or {}})
    return {"ok": True}


@api.post("/orders/{oid}/favorite")
async def favorite_order(oid: str, user=Depends(current_user)):
    """Saves the kits of an order in «Mis kits» as favourites (own kits are marked; suggested kits are copied)."""
    from server import find_template
    o = await db.orders.find_one({"id": oid, "user_id": user["id"]})
    if not o:
        raise HTTPException(404, "Pedido no encontrado")
    saved = []
    for i in o["items"]:
        if i["type"] != "kit":
            continue
        k = await db.kits.find_one({"id": i["ref_id"], "owner_id": user["id"]})
        if k:
            await db.kits.update_one({"id": k["id"]}, {"$set": {"favorite": True}})
            saved.append(k["id"])
        elif (t := find_template(i["ref_id"])):
            exists = await db.kits.find_one({"owner_id": user["id"], "from_template": t["id"], "favorite": True})
            if exists:
                saved.append(exists["id"])
                continue
            nk = {"id": uid(), "owner_id": user["id"], "name": t["name"], "context": t.get("context", ""), "size": t["size"], "categories": [],
                  "items": [{"product_id": x, "options": {}} for x in t["items"]], "favorite": True, "from_template": t["id"], "shared_with": [],
                  "created_at": now_iso(), "updated_at": now_iso()}
            await db.kits.insert_one(nk)
            saved.append(nk["id"])
    await db.orders.update_one({"id": oid}, {"$set": {"favorite": True}})
    return {"saved": saved}


@api.post("/kits/{kid}/duplicate")
async def duplicate_kit(kid: str, user=Depends(current_user)):
    k = await db.kits.find_one({"id": kid, "owner_id": user["id"]})
    if not k:
        raise HTTPException(404, "Kit no encontrado")
    new = {**{x: v for x, v in clean(k).items() if x not in ("gift", "for_user_id", "thanks", "for_name", "note", "guide")}, "id": uid(), "name": f"{k['name']} (copia)", "created_at": now_iso(), "updated_at": now_iso(), "shared_with": []}
    await db.kits.insert_one(new)
    return {"id": new["id"]}


# ---------------------------------------------------------------- admin
async def admin_user(user=Depends(current_user)):
    if not user.get("is_admin"):
        raise HTTPException(403, "Solo administración")
    return user


def cost_of(p: dict) -> float:
    return (p.get("unit_cost") or 0) + (p.get("prep_cost") or 0)


def kit_costing(price: float, item_costs: list[float], c: dict, discount: float = 0) -> dict:
    fixed = c["packaging"] + c["assembly"] + c["labels"] + c["protection"] + c["storage"] + c["logistics"] + c.get("shipping", 0) + c["incidents"]
    items = sum(item_costs)
    direct = items + fixed
    net_price = price - discount
    prelim = net_price - direct
    fee = net_price * c["payment_fee_pct"] / 100
    tax = net_price - net_price / (1 + c["tax_pct"] / 100)
    after = net_price - direct - fee - tax
    pct = lambda v: round(v / net_price * 100, 1) if net_price else 0  # noqa: E731
    return {"price": price, "discount": discount, "net_price": net_price, "items_cost": round(items, 2), "fixed_costs": fixed, "direct_cost": round(direct, 2),
            "gross_margin": round(prelim, 2), "gross_margin_pct": pct(prelim), "payment_fee": round(fee, 2), "tax": round(tax, 2),
            "margin_after_fees_taxes": round(after, 2), "margin_after_pct": pct(after), "viable": pct(prelim) >= c["min_margin_pct"]}


@api.get("/admin/overview")
async def admin_overview(admin=Depends(admin_user)):
    c, sizes = await setting("costs", DEFAULT_COSTS), await get_sizes()
    prods = [clean(p) async for p in db.products.find({})]
    included = sorted([p for p in prods if p.get("tier") != "premium" and p.get("status") == "activo"], key=cost_of, reverse=True)
    alerts = []
    for s in sizes.values():
        worst = included[: s["max"]]
        k = kit_costing(s["base"], [cost_of(p) for p in worst], c)
        if not k["viable"]:
            top = worst[0] if worst else None
            alerts.append({"size": s["label"], "margin_pct": k["gross_margin_pct"],
                           "text": f"La combinación incluida más costosa de {s['label'].lower()} deja {k['gross_margin_pct']}% de margen (mínimo {c['min_margin_pct']}%)."
                                   + (f" Revisa la clasificación de «{top['name']}» (costo ${cost_of(top):.0f}) o configura un suplemento." if top else "")})
    for p in prods:
        if p.get("tier") == "premium" and p.get("supplement", 0) < cost_of(p) - 35:
            alerts.append({"size": "", "text": f"«{p['name']}» es premium y su suplemento (${p.get('supplement', 0)}) no cubre la diferencia de costo frente a un artículo promedio."})
    orders = [o async for o in db.orders.find({})]
    return {"products": len(prods), "out_of_stock": sum(1 for p in prods if p.get("stock", 0) - p.get("stock_reserved", 0) <= 0 or p.get("status") != "activo"),
            "inventory_value": round(sum(cost_of(p) * p.get("stock", 0) for p in prods), 2), "orders": len(orders),
            "orders_open": sum(1 for o in orders if o.get("status") not in ("Entregado", "Cancelado")),
            "revenue_demo": sum(o.get("total") or 0 for o in orders if o.get("status") != "Cancelado"),
            "codes_active": await db.codes.count_documents({"status": "activo"}), "activations": await db.code_activations.count_documents({}),
            "alerts": alerts, "sizes": list(sizes.values()), "costs": c, "plans": await setting("plans", DEFAULT_PLANS)}


@api.get("/admin/products")
async def admin_products(admin=Depends(admin_user)):
    return [clean(p) async for p in db.products.find({}).sort("id", 1)]


@api.put("/admin/products/{pid}")
async def admin_update_product(pid: str, body: dict = Body(...), admin=Depends(admin_user)):
    allowed = {"name": str, "category": str, "description": str, "supplier_id": str, "unit_cost": float, "min_order": int, "prep_cost": float,
               "ref_price": float, "tier": str, "supplement": int, "sizes": list, "status": str, "price": int, "sku": str}
    s = {}
    for k, t in allowed.items():
        if k in body:
            v = body[k]
            try:
                s[k] = None if v in ("", None) and k == "ref_price" else (v if t in (list, str) else t(v))
            except (TypeError, ValueError):
                raise HTTPException(422, f"Valor no válido en {k}")
    if s.get("tier") not in (None, "incluido", "premium") or s.get("status") not in (None, "activo", "agotado", "descontinuado"):
        raise HTTPException(422, "Clasificación o estado no válido")
    if any(s.get(k, 0) is not None and s.get(k, 0) < 0 for k in ("unit_cost", "prep_cost", "supplement", "price")):
        raise HTTPException(422, "Los importes no pueden ser negativos")
    await db.products.update_one({"id": pid}, {"$set": s})
    return clean(await db.products.find_one({"id": pid}))


@api.get("/admin/inventory")
async def admin_inventory(admin=Depends(admin_user)):
    return [clean(m) async for m in db.inventory.find({}).sort("at", -1).limit(150)]


@api.post("/admin/inventory")
async def admin_move(product_id: str = Body(..., embed=True), type: str = Body(..., embed=True), qty: int = Body(..., embed=True),
                     note: str = Body("", embed=True), admin=Depends(admin_user)):
    if type not in ("entrada", "salida", "ajuste") or (type != "ajuste" and qty <= 0):
        raise HTTPException(422, "Movimiento no válido")
    p = await db.products.find_one({"id": product_id})
    if not p:
        raise HTTPException(404, "Artículo no encontrado")
    delta = qty if type == "entrada" else -qty if type == "salida" else qty
    if p.get("stock", 0) + delta < p.get("stock_reserved", 0):
        raise HTTPException(400, "No puedes dejar menos existencias que las reservadas por pedidos")
    await db.products.update_one({"id": product_id}, {"$inc": {"stock": delta}})
    stock = p.get("stock", 0) + delta
    if p.get("status") in ("activo", "agotado"):
        await db.products.update_one({"id": product_id}, {"$set": {"status": "activo" if stock - p.get("stock_reserved", 0) > 0 else "agotado"}})
    await db.inventory.insert_one({"id": uid(), "product_id": product_id, "type": type, "qty": delta, "note": note or "Movimiento manual (simulado)", "simulated": True, "at": now_iso()})
    return {"stock": stock}


@api.get("/admin/suppliers")
async def admin_suppliers(admin=Depends(admin_user)):
    out = []
    async for s in db.suppliers.find({}):
        items = [{"id": p["id"], "name": p["name"], "unit_cost": p.get("unit_cost"), "min_order": p.get("min_order")} async for p in db.products.find({"supplier_id": s["id"]})]
        out.append({**clean(s), "items": items})
    return out


@api.post("/admin/suppliers")
async def admin_save_supplier(body: dict = Body(...), admin=Depends(admin_user)):
    s = {k: str(body.get(k, ""))[:300] for k in ("name", "contact", "terms", "notes")}
    if not s["name"].strip():
        raise HTTPException(422, "Escribe el nombre del proveedor")
    s["lead_days"] = int(body.get("lead_days") or 0)
    sid = body.get("id") or uid()
    await db.suppliers.update_one({"id": sid}, {"$set": {**s, "id": sid}, "$setOnInsert": {"demo": True}}, upsert=True)
    return {"id": sid}


@api.post("/admin/costing")
async def admin_costing(size: str = Body(..., embed=True), item_costs: list = Body(None, embed=True), product_ids: list = Body(None, embed=True),
                        discount: float = Body(0, embed=True), admin=Depends(admin_user)):
    c, sizes = await setting("costs", DEFAULT_COSTS), await get_sizes()
    s = sizes.get(norm_size(size))
    if not s:
        raise HTTPException(422, "Tamaño no válido")
    supp = 0
    if product_ids:
        pm = await products_map(product_ids)
        item_costs = [cost_of(pm[p]) for p in product_ids if p in pm]
        supp = sum(pm[p].get("supplement", 0) for p in product_ids if p in pm and pm[p].get("tier") == "premium")
    costs = [float(x) for x in (item_costs or [])][: s["max"]]
    return {"size": s, "supplements": supp, **kit_costing(s["base"] + supp, costs, c, float(discount or 0))}


@api.put("/admin/settings/{key}")
async def admin_settings(key: str, value=Body(..., embed=True), admin=Depends(admin_user)):
    if key == "sizes":
        if not isinstance(value, list) or {v.get("id") for v in value} != {"Chico", "Mediano", "Grande"}:
            raise HTTPException(422, "Se requieren los tres tamaños")
        value = [{**d, "max": int(v["max"]), "base": int(v["base"])} for v in value for d in DEFAULT_SIZES if d["id"] == v["id"]]
    elif key in ("costs", "plans"):
        base = DEFAULT_COSTS if key == "costs" else DEFAULT_PLANS
        value = {k: value.get(k, base[k]) for k in base}
    else:
        raise HTTPException(404, "Ajuste no encontrado")
    await db.biz_settings.update_one({"id": key}, {"$set": {"value": value}}, upsert=True)
    return {"ok": True, "value": value}


@api.get("/admin/codes")
async def admin_codes(admin=Depends(admin_user)):
    out = []
    async for c in db.codes.find({}).sort("valid_until", -1):
        ids = [a["user_id"] async for a in db.code_activations.find({"code_id": c["id"]})]
        names = [u.get("name", "") async for u in db.users.find({"id": {"$in": ids}})]
        out.append({**clean(c), "activations": len(ids), "activated_by": names[:20]})
    return out


@api.post("/admin/codes")
async def admin_save_code(body: dict = Body(...), admin=Depends(admin_user)):
    code = str(body.get("code", "")).strip().upper()
    if not code or not body.get("institution"):
        raise HTTPException(422, "Escribe el código y la institución")
    b = body.get("benefits") or {}
    doc = {"code": code, "institution": str(body["institution"])[:120], "institution_type": body.get("institution_type") or "Hospital",
           "benefits": {"plus_months": int(b.get("plus_months") or 0), "kit_discount_pct": min(100, int(b.get("kit_discount_pct") or 0)), "credit": int(b.get("credit") or 0),
                        "funded_kit": b.get("funded_kit") if b.get("funded_kit") in ("Chico", "Mediano", "Grande") else None},
           "valid_from": body.get("valid_from") or now().date().isoformat(), "valid_until": body.get("valid_until") or (now() + timedelta(days=365)).date().isoformat(),
           "max_uses": int(body.get("max_uses") or 1), "budget": int(body["budget"]) if body.get("budget") not in (None, "") else None,
           "status": body.get("status") if body.get("status") in ("activo", "pausado") else "activo", "conditions": str(body.get("conditions", ""))[:400]}
    existing = await db.codes.find_one({"code": code})
    if existing and existing["id"] != body.get("id"):
        raise HTTPException(409, "Ese código ya existe")
    cid = body.get("id") or uid()
    await db.codes.update_one({"id": cid}, {"$set": {**doc, "id": cid}, "$setOnInsert": {"uses": 0, "budget_used": 0, "demo": True}}, upsert=True)
    return {"id": cid}


@api.get("/admin/orders")
async def admin_orders(admin=Depends(admin_user)):
    return [clean(o) async for o in db.orders.find({}).sort("created_at", -1).limit(100)]


@api.post("/admin/orders/{oid}/status")
async def admin_order_status(oid: str, status: str = Body(..., embed=True), admin=Depends(admin_user)):
    o = await db.orders.find_one({"id": oid})
    if not o:
        raise HTTPException(404, "Pedido no encontrado")
    await set_order_status(o, status)
    return clean(await db.orders.find_one({"id": oid}))


@api.get("/report")
async def report(today: str, user=Depends(require_plus)):
    """Plus: exportable personal summary (next 30 days). Only the person's own data."""
    from planner import agenda_items
    end = (datetime.strptime(today, "%Y-%m-%d") + timedelta(days=30)).date().isoformat()
    items = [i for i in await agenda_items(user, user["id"], today, end) if i["source"] != "doses"]
    meds = [m async for m in db.records.find({"kind": "medications", "owner_id": user["id"], "active": {"$ne": False}})]
    from knowledge import fmt_es
    lines = [f"AMODO · Resumen personal (del {fmt_es(today)} al {fmt_es(end)})", "", "AGENDA"]
    lines += [f"- {fmt_es(i['date'])}{' · ' + i['time'] if i['time'] else ''} · {i['title']} ({i['type']})" for i in items] or ["- Sin eventos"]
    lines += ["", "MEDICAMENTOS REGISTRADOS"] + ([f"- {m.get('name', '')} {m.get('dose', '')} · {m.get('times') or m.get('schedule') or ''}" for m in meds] or ["- Ninguno"])
    lines += ["", "Generado por ti desde AMODO. No sustituye las indicaciones de tu equipo médico."]
    return {"text": "\n".join(lines), "count": len(items)}


THANKS = ["¡Gracias!", "Me encantó", "Me hizo el día", "Gracias por acompañarme"]


@api.post("/kits/{kid}/thanks")
async def thank_gift(kid: str, message: str = Body(..., embed=True), user=Depends(current_user)):
    """The person who received a gift kit sends a quick thank-you to whoever sent it."""
    if message not in THANKS:
        raise HTTPException(422, "Mensaje no válido")
    k = await db.kits.find_one({"id": kid, "gift": True, "for_user_id": user["id"], "shared_with": user["id"]})
    if not k:
        raise HTTPException(404, "Kit no encontrado")
    if k.get("thanks"):
        raise HTTPException(409, "Ya enviaste tu agradecimiento")
    await db.kits.update_one({"id": kid}, {"$set": {"thanks": {"message": message, "at": now_iso()}}})
    await notify(k["owner_id"], f"{display_name(user)} te dio las gracias", f"«{message}» · por el kit {k['name'].replace(' · regalo', '')}", "network", f"/kit/{kid}")
    return {"ok": True, "thanks": message}
