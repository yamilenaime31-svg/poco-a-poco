"""Identidad y estilo (Plus): the person picks colours, textures and accessories and gets visual proposals:
catalogue items that match, plus an optional AI inspiration board (illustrative only, built from the style choices alone)."""
import asyncio
import base64
import io
import logging
import os

from fastapi import Body, Depends, HTTPException

from business import public_product, require_plus
from server import DISLIKE_TAGS, api, clean, db, now_iso, uid
from storage import APP_NAME, put_object

logger = logging.getLogger(__name__)
# hex = swatch shown in the app; catalog = variant names used by catalogue products.
COLORS = [
    {"id": "Arena", "hex": "#D9CDB8", "catalog": ["Arena", "Mantequilla"], "en": "warm sand beige"},
    {"id": "Salvia", "hex": "#A9BBAA", "catalog": ["Salvia"], "en": "muted sage green"},
    {"id": "Lavanda", "hex": "#C4BBD6", "catalog": ["Lavanda"], "en": "greyish lavender"},
    {"id": "Durazno", "hex": "#E8C4AE", "catalog": ["Durazno"], "en": "soft peach"},
    {"id": "Terracota", "hex": "#B9765A", "catalog": ["Durazno", "Castaño"], "en": "terracotta"},
    {"id": "Azul profundo", "hex": "#3F5068", "catalog": [], "en": "deep muted navy blue"},
    {"id": "Gris", "hex": "#9A9C9A", "catalog": ["Gris", "Plateado"], "en": "soft grey"},
    {"id": "Negro", "hex": "#2B2B2B", "catalog": ["Negro"], "en": "black"},
    {"id": "Dorado", "hex": "#C9A961", "catalog": ["Dorado", "Carey"], "en": "soft gold"},
]
TEXTURES = [
    {"id": "Algodón", "match": ["algodón"], "en": "soft cotton"},
    {"id": "Seda", "match": ["seda"], "en": "smooth silk"},
    {"id": "Punto suave", "match": ["punto", "tejido"], "en": "fine soft knit"},
    {"id": "Tejido grueso", "match": ["tejido grueso", "grueso"], "en": "chunky knit"},
    {"id": "Sin costuras", "match": ["sin costuras"], "en": "seamless jersey"},
    {"id": "Ligero", "match": ["liger"], "en": "lightweight airy fabric"},
]
ACCESSORIES = [
    {"id": "Pañuelos", "en": "a folded head scarf"}, {"id": "Gorros", "en": "a soft beanie"}, {"id": "Bandas", "en": "a fabric headband"},
    {"id": "Pelucas", "en": "a wig on a stand"}, {"id": "Accesorios para el cabello", "en": "hair clips"}, {"id": "Aretes", "en": "small earrings"},
    {"id": "Lentes", "en": "eyeglasses"}, {"id": "Arreglo personal", "en": "a pocket mirror and a comb"},
]
STYLES = {"Minimalista": "minimalist", "Clásico": "classic", "Divertido": "playful", "Deportivo": "sporty", "Artesanal": "handcrafted artisanal", "Colorido": "colourful", "Elegante": "elegant"}
MAX_IMAGES = 8


def _prefs(user: dict) -> dict:
    s = (user.get("profile") or {}).get("style") or {}
    ident = (user.get("profile") or {}).get("identity") or {}
    return {"colors": [c for c in s.get("colors") or [] if any(x["id"] == c for x in COLORS)],
            "textures": [t for t in s.get("textures") or [] if any(x["id"] == t for x in TEXTURES)],
            "accessories": [a for a in (s.get("accessories") if "accessories" in s else ident.get("accessories")) or [] if any(x["id"] == a for x in ACCESSORIES)],
            "styles": [x for x in (s.get("styles") if "styles" in s else ident.get("styles")) or [] if x in STYLES]}


async def proposals(user: dict, prefs: dict) -> list[dict]:
    ident = (user.get("profile") or {}).get("identity") or {}
    tastes = (user.get("profile") or {}).get("tastes") or {}
    excluded = {DISLIKE_TAGS.get(x, x.lower()) for x in (tastes.get("dislikes") or []) + (ident.get("avoid") or [])}
    wanted = {c["id"]: set(c["catalog"]) for c in COLORS if c["id"] in prefs["colors"]}
    out = []
    async for p in db.products.find({"status": {"$ne": "inactivo"}}):
        tags = set(p.get("tags") or [])
        if tags & excluded:
            continue
        text = f"{p['name']} {p.get('description', '')}".lower()
        acc = [a for a in prefs["accessories"] if a in tags]
        tex = [t["id"] for t in TEXTURES if t["id"] in prefs["textures"] and any(m in text for m in t["match"])]
        col = [(cid, v) for cid, names in wanted.items() for v in (p.get("colors") or []) if v in names]
        is_style = p["category"] == "Identidad y estilo"
        if not acc and not (is_style and (tex or col)) and not (tex and col):
            continue
        why = ([f"Elegiste {acc[0].lower()}"] if acc else []) + ([f"Viene en {col[0][1].lower()}, cercano a tu {col[0][0].lower()}" if col[0][1] != col[0][0] else f"Viene en {col[0][1].lower()}"] if col else []) \
            + ([f"Textura: {tex[0].lower()}"] if tex else [])
        out.append((3 * len(acc) + 2 * bool(col) + 2 * len(tex) + is_style, {**public_product(clean(p)), "why": why, "variant": col[0][1] if col else None}))
    out.sort(key=lambda x: -x[0])
    return [p for _, p in out[:8]]


@api.get("/style")
async def get_style(user=Depends(require_plus)):
    prefs = _prefs(user)
    images = [clean(i) async for i in db.style_images.find({"user_id": user["id"], "deleted_at": None}).sort("created_at", -1).limit(MAX_IMAGES)]
    chosen = any(prefs.values())
    return {"options": {"colors": [{"id": c["id"], "hex": c["hex"]} for c in COLORS], "textures": [t["id"] for t in TEXTURES],
                        "accessories": [a["id"] for a in ACCESSORIES], "styles": list(STYLES)},
            "prefs": prefs, "proposals": await proposals(user, prefs) if chosen else [], "images": images, "max_images": MAX_IMAGES,
            "note": "Las imágenes de inspiración se crean con IA solo a partir de tus elecciones de estilo. Son ilustrativas: no muestran productos reales del catálogo."}


@api.put("/style")
async def save_style(body: dict = Body(...), user=Depends(require_plus)):
    raw = {k: [str(x) for x in body.get(k) or [] if isinstance(x, str)][:12] for k in ("colors", "textures", "accessories", "styles")}
    await db.users.update_one({"id": user["id"]}, {"$set": {"profile.style": raw}})
    return await get_style(await db.users.find_one({"id": user["id"]}))


async def _generate(prompt: str, session: str) -> bytes:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=session, system_message="You create calm editorial style mood boards.")
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    _, imgs = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    from PIL import Image
    im = Image.open(io.BytesIO(base64.b64decode(imgs[0]["data"]))).convert("RGB")
    im.thumbnail((896, 896))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=84)
    return buf.getvalue()


@api.post("/style/inspiration")
async def create_inspiration(user=Depends(require_plus)):
    """Counts as one assistant interaction. Only the style choices are sent to the image model: no name, no health data."""
    from membership import refund_ai, use_ai
    prefs = _prefs(user)
    if not (prefs["colors"] or prefs["textures"] or prefs["accessories"]):
        raise HTTPException(422, "Elige al menos un color, una textura o un accesorio para crear tu inspiración.")
    colors = ", ".join(c["en"] for c in COLORS if c["id"] in prefs["colors"]) or "calm neutral tones"
    textures = ", ".join(t["en"] for t in TEXTURES if t["id"] in prefs["textures"]) or "soft natural fabrics"
    objects = ", ".join(a["en"] for a in ACCESSORIES if a["id"] in prefs["accessories"]) or "fabric swatches and small personal accessories"
    mood = ", ".join(STYLES[s] for s in prefs["styles"]) or "calm, refined"
    prompt = (f"Editorial flat-lay style mood board photographed from above on a warm ivory surface: {objects}, arranged with fabric swatches. "
              f"Colour palette: {colors}. Textures: {textures}. Overall style: {mood}. Soft natural daylight, gentle shadows, generous empty space, "
              "unbranded generic objects, no people, no faces, no hands, no text, no logos, no labels.")
    await use_ai(user)
    try:
        data = await _generate(prompt, f"style-{uid()}")
        iid = uid()
        res = await asyncio.to_thread(put_object, f"{APP_NAME}/style/{iid}.jpg", data, "image/jpeg")
    except Exception as exc:
        logger.error("style inspiration: %s", exc)
        await refund_ai(user)
        raise HTTPException(503, "No pudimos crear la imagen ahora. Intenta de nuevo en un momento.")
    doc = {"id": iid, "user_id": user["id"], "path": res["path"], "image": f"/api/media/{res['path']}", "prefs": prefs, "created_at": now_iso()}
    await db.style_images.insert_one(doc)
    old = [i["id"] async for i in db.style_images.find({"user_id": user["id"], "deleted_at": None}).sort("created_at", -1).skip(MAX_IMAGES)]
    if old:
        await db.style_images.update_many({"id": {"$in": old}}, {"$set": {"deleted_at": now_iso()}})
    return clean(doc)


@api.delete("/style/inspiration/{iid}")
async def delete_inspiration(iid: str, user=Depends(require_plus)):
    await db.style_images.update_one({"id": iid, "user_id": user["id"]}, {"$set": {"deleted_at": now_iso()}})  # soft delete
    return {"ok": True}
