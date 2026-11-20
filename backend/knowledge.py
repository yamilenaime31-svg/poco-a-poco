"""Reviewable knowledge base (needs that *some* people experience during cancer treatment → everyday comfort items),
plus treatment-aware context for recommendations. General information only: never a diagnosis or a clinical recommendation."""
from datetime import date, datetime, timedelta

from fastapi import Body, Depends, HTTPException, Query

from server import api, clean, current_user, db, logger, now_iso
from planner import TREATMENT_TYPES, llm_json

REVIEWED = "2026-06"
MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def fmt_es(d: str) -> str:
    x = datetime.strptime(d, "%Y-%m-%d")
    return f"{x.day} de {MONTHS[x.month - 1]}"
CHEMO, RADIO, IMMUNO, SURG, TARGET, HORMONE = TREATMENT_TYPES[:6]
KB = [
    {"id": "nausea", "label": "Náuseas o malestar", "treatments": [CHEMO, RADIO, IMMUNO, TARGET], "tags": ["Descansar", "Silencio", "Luz tenue", "Audífonos"],
     "exclude_categories": ["Antojos y preferencias"],
     "precaution": "No sugerimos alimentos, dulces ni suplementos para las náuseas. Tu equipo médico es quien orienta sobre su manejo.",
     "sources": [{"name": "Instituto Nacional del Cáncer (NCI)", "url": "https://www.cancer.gov/about-cancer/treatment/side-effects/nausea"},
                 {"name": "American Cancer Society", "url": "https://www.cancer.org/cancer/managing-cancer/side-effects/eating-problems/nausea-and-vomiting.html"}]},
    {"id": "fatigue", "label": "Cansancio", "treatments": TREATMENT_TYPES[:6], "tags": ["Descansar", "Almohada", "descanso", "Cobija"],
     "precaution": "El cansancio tiene muchas causas; coméntalo con tu equipo si cambia o aumenta.",
     "sources": [{"name": "Instituto Nacional del Cáncer (NCI)", "url": "https://www.cancer.gov/about-cancer/treatment/side-effects/fatigue"},
                 {"name": "MedlinePlus", "url": "https://medlineplus.gov/ency/patientinstructions/000817.htm"}]},
    {"id": "cold", "label": "Sensibilidad al frío", "treatments": [CHEMO], "tags": ["Calidez", "Cobija", "Ropa suave"],
     "precaution": "Algunas quimioterapias pueden causar sensibilidad al frío; tu equipo puede orientarte sobre qué evitar.",
     "sources": [{"name": "Instituto Nacional del Cáncer (NCI)", "url": "https://www.cancer.gov/about-cancer/treatment/side-effects/nerve-problems"}]},
    {"id": "mouth", "label": "Boca seca o sensible", "treatments": [CHEMO, RADIO], "tags": ["cuidado"], "exclude_categories": ["Antojos y preferencias"],
     "precaution": "Pregunta a tu equipo qué productos de cuidado bucal son adecuados para ti.",
     "sources": [{"name": "Instituto Nacional del Cáncer (NCI)", "url": "https://www.cancer.gov/about-cancer/treatment/side-effects/mouth-throat"}]},
    {"id": "skin", "label": "Piel sensible", "treatments": [RADIO, TARGET, IMMUNO, CHEMO], "tags": ["Crema", "Ropa suave"],
     "precaution": "Durante la radioterapia, consulta antes de aplicar cualquier crema en la zona tratada.",
     "sources": [{"name": "Instituto Nacional del Cáncer (NCI)", "url": "https://www.cancer.gov/about-cancer/treatment/side-effects/skin-nail-changes"}]},
    {"id": "hair", "label": "Cambios en el cabello", "treatments": [CHEMO, RADIO], "tags": ["Gorros", "Pañuelos", "Gorro o pañoleta", "Bandas"],
     "precaution": "No todas las personas tienen cambios en el cabello; cubrirse es solo una opción más.",
     "sources": [{"name": "Instituto Nacional del Cáncer (NCI)", "url": "https://www.cancer.gov/about-cancer/treatment/side-effects/hair-loss"}]},
    {"id": "waiting", "label": "Tiempos de espera largos", "treatments": [CHEMO, IMMUNO, TARGET, RADIO], "tags": ["entretenimiento", "llevar"],
     "precaution": "", "sources": [{"name": "American Cancer Society", "url": "https://www.cancer.org/cancer/managing-cancer/treatment-types/chemotherapy/what-to-expect.html"}]},
    {"id": "visits", "label": "Muchas citas y papeles", "treatments": TREATMENT_TYPES, "tags": ["organización", "papeles", "preparación"],
     "precaution": "", "sources": [{"name": "Instituto Nacional del Cáncer (NCI)", "url": "https://www.cancer.gov/about-cancer/coping"}]},
    {"id": "recovery", "label": "Recuperación en casa", "treatments": [SURG], "tags": ["Almohada", "casa", "Descansar", "descanso"],
     "precaution": "Sigue las indicaciones de recuperación que te dio tu equipo.",
     "sources": [{"name": "Instituto Nacional del Cáncer (NCI)", "url": "https://www.cancer.gov/about-cancer/treatment/types/surgery"}]},
]
KB_BY_ID = {k["id"]: k for k in KB}


async def seed_knowledge():
    for k in KB:
        await db.knowledge.update_one({"id": k["id"]}, {"$set": {**k, "reviewed": REVIEWED}}, upsert=True)


async def user_treatments(user_id: str) -> list[str]:
    out = []
    async for t in db.records.find({"kind": "treatments", "owner_id": user_id, "status": {"$ne": "Finalizado"}}):
        tt = t.get("treatment_type") if t.get("treatment_type") in TREATMENT_TYPES else t.get("name") if t.get("name") in TREATMENT_TYPES else "Otro"
        out.append(tt)
    return out


async def context_for(user: dict, today: str) -> dict:
    from business import is_plus
    if not await is_plus(user):  # Free: recommendations use registered preferences only
        return {"needs": [], "next": None, "rest": False, "interested": set(), "interested_tags": set(), "excluded_categories": set()}
    pr = user.get("profile", {}) or {}
    needs = [KB_BY_ID[n] for n in (pr.get("declared_needs") or []) if n in KB_BY_ID]
    nxt = None
    async for e in db.records.find({"kind": "events", "owner_id": user["id"], "date": {"$gte": today, "$lte": (datetime.strptime(today, "%Y-%m-%d") + timedelta(days=21)).date().isoformat()},
                                    "type": {"$in": ["Sesión de tratamiento", "Estudio", "Cita médica"]}}).sort("date", 1).limit(1):
        nxt = e
    week_ago = (datetime.strptime(today, "%Y-%m-%d") - timedelta(days=7)).date().isoformat()
    rest = False
    async for j in db.records.find({"kind": "journal", "owner_id": user["id"], "date": {"$gte": week_ago}}):
        if {"Quiero descansar", "Cansado/a", "Con sueño"} & set(j.get("moods") or []):
            rest = True
    interested_tags: set[str] = set()
    ids = (pr.get("reco") or {}).get("interested") or []
    async for p in db.products.find({"id": {"$in": ids}}):
        interested_tags |= set(p["tags"])
    return {"needs": needs, "next": nxt, "rest": rest, "interested": set(ids), "interested_tags": interested_tags,
            "excluded_categories": {c for n in needs for c in n.get("exclude_categories", [])}}


def boost(p: dict, ctx: dict) -> tuple[int, list[dict]]:
    tags, score, det = set(p["tags"]), 0, []
    if p["category"] in ctx["excluded_categories"]:
        return -100, []
    for n in ctx["needs"]:
        if tags & set(n["tags"]):
            score += 3
            det.append({"type": "tratamiento", "text": f"Te interesa explorar opciones para «{n['label'].lower()}». Es información general, no una recomendación médica.",
                        "precaution": n.get("precaution", ""), "sources": n["sources"], "need": n["id"]})
            break
    nx = ctx["next"]
    if nx and tags & {"llevar", "entretenimiento"}:
        score += 2
        det.append({"type": "proxima", "text": f"Registraste «{nx.get('title', 'una cita')}» para el {fmt_es(nx['date'])}; es fácil de llevar."})
    if ctx["rest"] and tags & {"Descansar", "descanso", "casa"}:
        score += 2
        det.append({"type": "registro", "text": "Nos contaste que últimamente prefieres descansar."})
    if p["id"] not in ctx["interested"] and tags & ctx["interested_tags"] - {"llevar", "estilo", "entretenimiento", "comodidad", "casa"}:
        score += 1
        det.append({"type": "gustos", "text": "Se parece a algo que marcaste como «me interesa»."})
    return score, det


@api.get("/knowledge")
async def knowledge(user=Depends(current_user)):
    return [clean(k) async for k in db.knowledge.find({})]


@api.get("/recommendations/needs")
async def explorable_needs(user=Depends(current_user)):
    """Needs the person *may* want to explore, based only on treatments they registered. Nothing is assumed."""
    types = await user_treatments(user["id"])
    declared = set((user.get("profile", {}) or {}).get("declared_needs") or [])
    items = [{"id": k["id"], "label": k["label"], "selected": k["id"] in declared} for k in KB if set(k["treatments"]) & set(types)]
    asked = bool((user.get("profile", {}) or {}).get("needs_prompt_answered"))
    from business import is_plus
    return {"treatments": sorted(set(types)), "needs": items, "asked": asked, "plus": await is_plus(user)}


@api.put("/recommendations/needs")
async def set_needs(needs: list = Body(..., embed=True), user=Depends(current_user)):
    from business import is_plus
    if not await is_plus(user):
        raise HTTPException(403, "Las recomendaciones según tu tratamiento son parte de AMODO Plus.")
    clean_ids = [n for n in dict.fromkeys(needs) if n in KB_BY_ID]
    await db.users.update_one({"id": user["id"]}, {"$set": {"profile.declared_needs": clean_ids, "profile.needs_prompt_answered": True}})
    return {"needs": clean_ids}


EXPLAIN_PROMPT = """Escribes en español una explicación breve (máx. 2 frases, tono cálido y sobrio) de por qué AMODO sugiere un artículo del catálogo.
Usa SOLO los motivos dados. No afirmes que el artículo previene, trata o alivia síntomas. No inventes datos. Responde JSON: {"text":""}"""


@api.get("/recommendations/explain/{pid}")
async def explain(pid: str, today: str = Query(...), user=Depends(current_user)):
    from server import score_products
    scored, _ = await score_products(user, today)
    hit = next(((s, w, p, d) for s, w, p, d in scored if p["id"] == pid), None)
    if not hit:
        raise HTTPException(404, "No encontramos esta recomendación")
    _, why, p, details = hit
    from business import is_plus
    if not await is_plus(user):
        return {"text": why[0] if why else "Una opción general para empezar.", "reasons": why, "details": details, "price_is_demo": True, "plus": False}
    cached = await db.reco_explain.find_one({"user_id": user["id"], "product_id": pid, "day": today, "why": why})
    if cached:
        text = cached["text"]
    else:
        try:
            text = str((await llm_json(EXPLAIN_PROMPT, f"Artículo: {p['name']} ({p['category']}). Motivos: {' | '.join(why) or 'Sugerencia general para empezar.'}", "explain")).get("text") or "")[:400]
        except Exception as exc:
            logger.error("explain: %s", exc)
            text = ""
        if text:
            await db.reco_explain.insert_one({"user_id": user["id"], "product_id": pid, "day": today, "why": why, "text": text, "at": now_iso()})
    return {"text": text or (why[0] if why else "Una opción general para empezar."), "reasons": why, "details": details, "price_is_demo": True}
