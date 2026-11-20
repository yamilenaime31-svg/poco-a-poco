"""Reviewable knowledge base (needs that *some* people experience during cancer treatment → everyday comfort items),
plus treatment-aware context for recommendations. General information only: never a diagnosis or a clinical recommendation."""
from datetime import date, datetime, timedelta

from fastapi import Body, Depends, HTTPException, Query

from server import api, clean, current_user, db, display_name, logger, now_iso
from planner import TREATMENT_TYPES, llm_json

REVIEWED = "2026-06"
MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def fmt_es(d: str) -> str:
    x = datetime.strptime(d, "%Y-%m-%d")
    return f"{x.day} de {MONTHS[x.month - 1]}"
CHEMO, RADIO, IMMUNO, SURG, TARGET, HORMONE = TREATMENT_TYPES[:6]
NCI_ES = "Instituto Nacional del Cáncer (NCI, en español)"
NCI = "Instituto Nacional del Cáncer (NCI)"
ACS = "American Cancer Society"
ES = "https://www.cancer.gov/espanol/cancer/tratamiento/efectos-secundarios/"
# Each need: general tips paraphrased from the cited public sources, the catalogue items that fit them (comfort only, never treatment),
# and a precaution. Reviewed by the AMODO team; it is general information, never a diagnosis or clinical recommendation.
KB = [
    {"id": "nausea", "label": "Náuseas o malestar", "treatments": [CHEMO, RADIO, IMMUNO, TARGET], "tags": ["Descansar", "Silencio", "Luz tenue", "Audífonos"],
     "exclude_categories": ["Antojos y preferencias"], "kit": ["p2", "p4", "p12", "p1"], "kit_name": "Días de malestar",
     "tips": ["Descansar en un lugar tranquilo y con poca luz puede ayudar a algunas personas.", "Hay quienes prefieren evitar olores fuertes; por eso solo incluimos artículos sin aroma.",
              "Distraerse con música o una serie es una opción que el NCI menciona."],
     "precaution": "No sugerimos alimentos, dulces ni suplementos para las náuseas. Tu equipo médico es quien orienta sobre su manejo.",
     "sources": [{"name": NCI_ES, "url": ES + "nauseas-vomitos"},
                 {"name": ACS, "url": "https://www.cancer.org/cancer/managing-cancer/side-effects/eating-problems/nausea-and-vomiting.html"}]},
    {"id": "fatigue", "label": "Cansancio", "treatments": TREATMENT_TYPES[:6], "tags": ["Descansar", "Almohada", "descanso", "Cobija"],
     "kit": ["p1", "p2", "p4", "p5"], "kit_name": "Para recargar energía",
     "tips": ["Planear ratos de descanso a lo largo del día y siestas cortas.", "Anotar a qué hora del día tienes más energía para organizar tus actividades.",
              "Pedir ayuda con tareas de casa o traslados cuando lo necesites."],
     "precaution": "El cansancio tiene muchas causas; coméntalo con tu equipo si cambia o aumenta.",
     "sources": [{"name": NCI_ES, "url": ES + "fatiga"}, {"name": "MedlinePlus", "url": "https://medlineplus.gov/ency/patientinstructions/000817.htm"}]},
    {"id": "cold", "label": "Sensibilidad al frío", "treatments": [CHEMO], "tags": ["Calidez", "Cobija", "Ropa suave"],
     "kit": ["p1", "p3", "p32", "p20"], "kit_name": "Calidez a la mano",
     "tips": ["Con algunas quimioterapias se recomienda abrigar manos y pies y evitar tocar cosas muy frías.", "Llevar bebidas tibias en un termo puede ser práctico; pregunta a tu equipo si debes evitar las frías."],
     "precaution": "Algunas quimioterapias pueden causar sensibilidad al frío; tu equipo puede orientarte sobre qué evitar.",
     "sources": [{"name": NCI_ES, "url": ES + "problemas-nervios"}]},
    {"id": "neuropathy", "label": "Hormigueo en manos o pies", "treatments": [CHEMO, TARGET], "tags": ["Calidez", "Ropa suave"],
     "kit": ["p3", "p1", "p15"], "kit_name": "Cuidar manos y pies",
     "tips": ["El NCI sugiere proteger los pies con calcetines y calzado que sujete bien, y cuidar el riesgo de resbalones.", "Mantener manos y pies abrigados si el frío te molesta.",
              "Avisar a tu equipo si notas hormigueo, adormecimiento o cambios al caminar."],
     "precaution": "El hormigueo o adormecimiento debe comentarse con tu equipo médico; los artículos solo aportan comodidad.",
     "sources": [{"name": NCI_ES, "url": ES + "problemas-nervios"}, {"name": NCI, "url": "https://www.cancer.gov/about-cancer/treatment/side-effects/nerve-problems"}]},
    {"id": "mouth", "label": "Boca seca o sensible", "treatments": [CHEMO, RADIO], "tags": ["cuidado"], "exclude_categories": ["Antojos y preferencias"],
     "kit": ["p19", "p17", "p20"], "kit_name": "Cuidado suave de la boca",
     "tips": ["Usar un cepillo de dientes de cerdas suaves.", "Tener agua a la mano para dar sorbos durante el día.", "Mantener los labios hidratados."],
     "precaution": "Pregunta a tu equipo qué productos de cuidado bucal son adecuados para ti.",
     "sources": [{"name": NCI_ES, "url": ES + "boca-garganta"}]},
    {"id": "skin", "label": "Piel sensible", "treatments": [RADIO, TARGET, IMMUNO, CHEMO], "tags": ["Crema", "Ropa suave"],
     "kit": ["p18", "p17", "p1"], "kit_name": "Piel cómoda",
     "tips": ["Preferir telas suaves y ropa holgada.", "Elegir productos sin fragancia.", "Proteger la piel del sol según te indique tu equipo."],
     "precaution": "Durante la radioterapia, consulta antes de aplicar cualquier crema en la zona tratada.",
     "sources": [{"name": NCI_ES, "url": ES + "cambios-piel-unas"}]},
    {"id": "hair", "label": "Cambios en el cabello", "treatments": [CHEMO, RADIO], "tags": ["Gorros", "Pañuelos", "Gorro o pañoleta", "Bandas"],
     "kit": ["p15", "p16", "p32", "p25"], "kit_name": "Opciones para cubrirte (si quieres)",
     "tips": ["Gorros y pañuelos suaves pueden proteger el cuero cabelludo del sol y del frío.", "Algunas personas prefieren no cubrirse: cualquier opción es válida."],
     "precaution": "No todas las personas tienen cambios en el cabello; cubrirse es solo una opción más.",
     "sources": [{"name": NCI_ES, "url": ES + "caida-pelo"}]},
    {"id": "sleep", "label": "Dificultad para dormir", "treatments": TREATMENT_TYPES[:6], "tags": ["Luz tenue", "Silencio", "Descansar"],
     "kit": ["p4", "p12", "p2", "p1"], "kit_name": "Noches más tranquilas",
     "tips": ["Mantener el cuarto oscuro, silencioso y cómodo.", "Tener horarios regulares para dormir y despertar.", "Relajarte antes de dormir con música tranquila o lectura."],
     "precaution": "Si dormir mal se vuelve frecuente, coméntalo con tu equipo médico.",
     "sources": [{"name": NCI, "url": "https://www.cancer.gov/about-cancer/treatment/side-effects/sleep-problems"}]},
    {"id": "memory", "label": "Olvidos o dificultad para concentrarte", "treatments": [CHEMO, RADIO, HORMONE], "tags": ["organización", "Escribir"],
     "kit": ["p5", "p6", "p7", "p31"], "kit_name": "Todo en su lugar",
     "tips": ["Usar una libreta o agenda para anotar citas, preguntas y pendientes.", "Guardar los papeles importantes siempre en el mismo lugar.", "Hacer una cosa a la vez y pedir que te repitan lo importante."],
     "precaution": "Usa el pastillero solo según las indicaciones de tu equipo médico.",
     "sources": [{"name": NCI_ES, "url": ES + "memoria"}]},
    {"id": "feelings", "label": "Estrés o preocupación", "treatments": TREATMENT_TYPES, "tags": ["Escribir", "Dibujar", "Tejer", "Escuchar música"],
     "kit": ["p31", "p10", "p11", "p12", "p5"], "kit_name": "Un rato para ti",
     "tips": ["Escribir lo que sientes o lo que te preocupa puede ayudar a ordenar ideas.", "Actividades creativas o relajantes, como dibujar, tejer o escuchar música.",
              "Hablar con alguien de confianza o pedir apoyo a tu equipo."],
     "precaution": "Si la preocupación o la tristeza no te dejan, pide apoyo a tu equipo; hay profesionales que pueden acompañarte.",
     "sources": [{"name": NCI_ES, "url": "https://www.cancer.gov/espanol/cancer/sobrellevar/sentimientos"}]},
    {"id": "waiting", "label": "Tiempos de espera largos", "treatments": [CHEMO, IMMUNO, TARGET, RADIO], "tags": ["entretenimiento", "llevar"],
     "kit": ["p8", "p9", "p12", "p14", "p20"], "kit_name": "Para la sala de espera",
     "tips": ["Las sesiones pueden durar varias horas: llevar algo para entretenerte y ropa cómoda.", "Una bolsa con lo esencial facilita los traslados."],
     "precaution": "", "sources": [{"name": ACS, "url": "https://www.cancer.org/cancer/managing-cancer/treatment-types/chemotherapy/what-to-expect.html"}]},
    {"id": "visits", "label": "Muchas citas y papeles", "treatments": TREATMENT_TYPES, "tags": ["organización", "papeles", "preparación"],
     "kit": ["p6", "p5", "p8", "p7"], "kit_name": "Citas organizadas",
     "tips": ["Llevar tus preguntas anotadas a cada cita.", "Tener en una carpeta estudios, recetas y datos de contacto de tu equipo."],
     "precaution": "", "sources": [{"name": NCI_ES, "url": "https://www.cancer.gov/espanol/cancer/sobrellevar"}]},
    {"id": "recovery", "label": "Recuperación en casa", "treatments": [SURG], "tags": ["Almohada", "casa", "Descansar", "descanso"],
     "kit": ["p2", "p1", "p4", "p14"], "kit_name": "Recuperarte con calma",
     "tips": ["Preparar un espacio cómodo en casa antes de la cirugía.", "Tener a la mano lo que vas a usar para moverte menos los primeros días."],
     "precaution": "Sigue las indicaciones de recuperación que te dio tu equipo.",
     "sources": [{"name": NCI, "url": "https://www.cancer.gov/about-cancer/treatment/types/surgery"}]},
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


def guided_template(kid: str):
    """Kit template built from a knowledge-base guide: id `g-<need>`."""
    k = KB_BY_ID.get(kid[2:]) if kid.startswith("g-") else None
    if not k:
        return None
    n = len(k["kit"])
    return {"id": kid, "name": k["kit_name"], "context": "Basado en guías", "size": "Pequeño" if n <= 4 else "Mediano", "items": k["kit"],
            "description": k["tips"][0], "guide": {"need": k["id"], "label": k["label"], "tips": k["tips"], "precaution": k["precaution"], "sources": k["sources"], "reviewed": REVIEWED}}


async def caregiver_context(user: dict) -> tuple[set, dict]:
    """Treatment types the linked patients chose to share with this caregiver (privacy: only records in shared_with)."""
    from planner import TREATMENT_TYPES as TT
    types: dict[str, str] = {}
    plus_any = False
    from business import is_plus
    async for link in db.links.find({"caregiver_id": user["id"], "status": "active"}):
        p = await db.users.find_one({"id": link["patient_id"]})
        if not p:
            continue
        plus_any = plus_any or await is_plus(p)
        name = (display_name(p) or "").split(" ")[0]
        async for t in db.records.find({"kind": "treatments", "owner_id": p["id"], "shared_with": user["id"], "status": {"$ne": "Finalizado"}}):
            tt = t.get("treatment_type") if t.get("treatment_type") in TT else t.get("name") if t.get("name") in TT else None
            if tt:
                types.setdefault(tt, name)
    return plus_any, types


@api.get("/guided-kits")
async def guided_kits(user=Depends(current_user)):
    """Every guide is open to everyone (general information). With Plus, the ones related to registered treatments/needs go first.
    Caregivers see first the ones related to treatments their patient shared with them."""
    from business import is_plus
    from server import kit_view
    plus = await is_plus(user)
    declared: set = set()
    names: dict[str, str] = {}
    pat_plus, names = await caregiver_context(user)  # anyone who accompanies someone sees their shared treatments first
    if not (plus or pat_plus):
        names = {}
    if plus:
        names.update({t: "" for t in await user_treatments(user["id"])})
        declared = set((user.get("profile", {}) or {}).get("declared_needs") or [])
    plus = plus or pat_plus
    out = []
    for k in KB:
        t = guided_template("g-" + k["id"])
        kv = await kit_view({**t, "template": True, "items": [{"product_id": x, "options": {}} for x in t["items"]]})
        hit = next((names[x] for x in k["treatments"] if x in names), None)
        for_you = "Tema elegido" if k["id"] in declared else ("Para tu tratamiento" if hit == "" else f"Para {hit}" if hit else "")
        out.append({**kv, "for_you": for_you, "chosen": k["id"] in declared})
    out.sort(key=lambda x: (not x["chosen"], not x["for_you"]))
    return {"plus": plus, "reviewed": REVIEWED, "kits": out}


@api.post("/kits/{kid}/gift")
async def gift_kit(kid: str, patient_id: str = Body(..., embed=True), message: str = Body("", embed=True), user=Depends(current_user)):
    """A caregiver turns a suggested kit into a gift for a linked patient, with a personal message, and adds it to their cart."""
    from server import find_template, kit_view, uid
    t = find_template(kid)
    if not t:
        raise HTTPException(404, "Kit no encontrado")
    if not await db.links.find_one({"caregiver_id": user["id"], "patient_id": patient_id, "status": "active"}):
        raise HTTPException(403, "Solo puedes regalar kits a personas que acompañas")
    p = await db.users.find_one({"id": patient_id})
    kit = {"id": uid(), "owner_id": user["id"], "created_at": now_iso(), "updated_at": now_iso(), "name": f"{t['name']} · regalo", "context": t.get("context", ""),
           "size": t["size"], "categories": [], "items": [{"product_id": x, "options": {}} for x in t["items"]], "for_name": display_name(p) if p else "",
           "for_user_id": patient_id, "note": message.strip()[:300], "gift": True, "guide": t.get("guide"), "shared_with": []}
    await db.kits.insert_one(kit)
    await db.cart.insert_one({"id": uid(), "user_id": user["id"], "type": "kit", "ref_id": kit["id"], "qty": 1, "options": {}})
    return {"id": kit["id"], "kit": await kit_view(kit)}
