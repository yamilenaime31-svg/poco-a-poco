"""Cobertura médica, gastos, pagos, reembolsos y documentos. A personal organiser: AMODO is not connected to insurers or
institutions, never files claims and never computes definitive coverage. Amounts are only what the person registered."""
import asyncio
import base64
import io
import logging
import secrets
import zipfile
from datetime import datetime, timedelta, timezone

from fastapi import Body, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from business import is_plus, require_plus
from knowledge import fmt_es
from server import _date_or_empty, active_link, api, clean, current_user, db, display_name, now_iso, uid
from storage import APP_NAME, get_object, put_object

logger = logging.getLogger(__name__)
PERMS = ("view", "add", "edit", "coverages", "docs", "attach", "claims", "reports")
CLAIM_STATES = ["Pendiente de preparar", "Documentación incompleta", "Listo para presentar", "Solicitud presentada", "En revisión", "Información adicional solicitada",
                "Autorizado", "Autorizado parcialmente", "Rechazado", "Reembolso recibido parcialmente", "Reembolso recibido", "Trámite cerrado"]
ATTENTION = {"Pendiente de preparar", "Documentación incompleta", "Listo para presentar", "Información adicional solicitada"}
DOC_STATES = ("Pendiente", "Disponible", "Entregado", "Requiere corrección", "No aplica")
MAX_FILE = 12 * 1024 * 1024
MIMES = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "text/xml": "xml", "application/xml": "xml"}


def num(v) -> float:
    try:
        return max(0.0, round(float(v or 0), 2))
    except (TypeError, ValueError):
        return 0.0


async def access(user: dict, owner_id: str | None, perm: str) -> str:
    """Owner can do everything. A companion needs an active link AND the specific permission the patient switched on."""
    if not owner_id or owner_id == user["id"]:
        return user["id"]
    link = await active_link(owner_id, user["id"])
    if not link or not (link.get("finance") or {}).get(perm):
        raise HTTPException(403, "Esta persona no te ha dado permiso para esto")
    return owner_id


async def log(user: dict, owner_id: str, action: str, ref: str, detail: str = ""):
    await db.finance_log.insert_one({"id": uid(), "owner_id": owner_id, "by": user["id"], "by_name": display_name(user), "action": action, "ref": ref, "detail": detail[:120], "at": now_iso()})


def calc(e: dict) -> dict:
    """Derived amounts for one expense. A requested or authorised refund is never subtracted until it is received."""
    total = num(e.get("amount"))
    pays = e.get("payments")
    if pays is None:  # records created before this module: "Pagado" = paid in full with own resources
        pays = [{"amount": total, "source": "own", "date": e.get("date", ""), "by": e.get("paid_by", "")}] if e.get("status") == "Pagado" else []
    own = round(sum(num(p.get("amount")) for p in pays if p.get("source") != "direct"), 2)
    direct = round(sum(num(p.get("amount")) for p in pays if p.get("source") == "direct"), 2)
    c = e.get("claim") or {}
    received = round(sum(num(d.get("amount")) for d in c.get("deposits") or []), 2)
    authorized = num(c.get("authorized"))
    open_claim = bool(c) and c.get("status") not in ("Rechazado", "Trámite cerrado")
    supports = round(sum(num(s.get("amount")) for s in e.get("supports") or []), 2)
    return {"total": total, "paid_own": own, "direct": direct, "pending_pay": max(0.0, round(total - num(e.get("discount")) - own - direct, 2)),
            "requested": num(c.get("requested")), "authorized": authorized, "rejected": num(c.get("rejected")), "received": received,
            "pending_receive": max(0.0, round(authorized - received, 2)) if open_claim else 0.0, "supports": supports,
            "net": round(own - received - supports, 2), "has_claim": bool(c), "claim_status": c.get("status", ""), "payments": pays}


def totals(items: list[dict]) -> dict:
    keys = ("total", "paid_own", "direct", "pending_pay", "requested", "authorized", "received", "pending_receive", "supports", "net")
    t = {k: round(sum(i["calc"][k] for i in items), 2) for k in keys}
    # Estimate only: what is still to pay minus what was authorised and not yet received. Never a guaranteed figure.
    t["estimated_final"] = round(t["net"] + t["pending_pay"] - t["pending_receive"], 2)
    t["has_estimate"] = bool(t["pending_pay"] or t["pending_receive"])
    return t


async def expenses_of(owner_id: str) -> list[dict]:
    out = [clean(r) async for r in db.records.find({"kind": "expenses", "owner_id": owner_id}).limit(1000)]
    for e in out:
        e["calc"] = calc(e)
        e["when"] = _date_or_empty(e.get("date")) or e["created_at"][:10]
    return sorted(out, key=lambda e: e["when"], reverse=True)


# ---------------------------------------------------------------- permissions
@api.get("/finance/access")
async def my_access(owner_id: str | None = None, user=Depends(current_user)):
    if not owner_id or owner_id == user["id"]:
        return {"owner": True, **{p: True for p in PERMS}, "plus": await is_plus(user)}
    link = await active_link(owner_id, user["id"])
    f = (link or {}).get("finance") or {}
    return {"owner": False, **{p: bool(f.get(p)) for p in PERMS}, "plus": await is_plus(user)}


@api.get("/finance/permissions")
async def list_permissions(user=Depends(current_user)):
    out = []
    async for link in db.links.find({"patient_id": user["id"], "status": "active"}):
        c = await db.users.find_one({"id": link["caregiver_id"]})
        out.append({"caregiver_id": link["caregiver_id"], "name": display_name(c) if c else "", "perms": {p: bool((link.get("finance") or {}).get(p)) for p in PERMS}})
    return out


@api.put("/finance/permissions/{caregiver_id}")
async def set_permissions(caregiver_id: str, perms: dict = Body(..., embed=True), user=Depends(current_user)):
    """Only the patient decides. Linking an account never grants access to money or documents by itself."""
    clean_perms = {p: bool(perms.get(p)) for p in PERMS}
    if any(clean_perms[p] for p in PERMS if p != "view"):
        clean_perms["view"] = True
    r = await db.links.update_one({"patient_id": user["id"], "caregiver_id": caregiver_id, "status": "active"}, {"$set": {"finance": clean_perms}})
    if not r.matched_count:
        raise HTTPException(404, "Esta persona no está en tu red")
    await log(user, user["id"], "permisos", caregiver_id, ", ".join(p for p, v in clean_perms.items() if v) or "sin acceso")
    return clean_perms


# ---------------------------------------------------------------- coverages
@api.get("/coverages")
async def list_coverages(owner_id: str | None = None, user=Depends(current_user)):
    owner = await access(user, owner_id, "coverages")
    return [clean(c) async for c in db.coverages.find({"owner_id": owner, "deleted_at": None}).sort("created_at", 1)]


@api.post("/coverages")
async def save_coverage(body: dict = Body(...), user=Depends(current_user)):
    if not (body.get("type") or "").strip():
        raise HTTPException(422, "Elige el tipo de cobertura")
    doc = {"type": body["type"][:60], "name": (body.get("name") or body["type"]).strip()[:80], "data": {k[:40]: str(v)[:600] for k, v in (body.get("data") or {}).items() if str(v).strip()},
           "archived": bool(body.get("archived")), "updated_at": now_iso(), "updated_by": display_name(user)}
    if body.get("id"):
        r = await db.coverages.update_one({"id": body["id"], "owner_id": user["id"]}, {"$set": doc})
        if not r.matched_count:
            raise HTTPException(404, "No encontramos esta cobertura")
        cid = body["id"]
    else:
        cid = uid()
        await db.coverages.insert_one({"id": cid, "owner_id": user["id"], "created_at": now_iso(), "deleted_at": None, **doc})
    await log(user, user["id"], "cobertura", cid, doc["name"])
    return clean(await db.coverages.find_one({"id": cid}))


@api.delete("/coverages/{cid}")
async def delete_coverage(cid: str, user=Depends(current_user)):
    await db.coverages.update_one({"id": cid, "owner_id": user["id"]}, {"$set": {"deleted_at": now_iso()}})
    return {"ok": True}


# ---------------------------------------------------------------- expenses
def _rows(raw, keys: tuple, limit=40) -> list[dict]:
    out = []
    for r in (raw or [])[:limit]:
        if isinstance(r, dict):
            out.append({"id": r.get("id") or uid()[:8], **{k: (num(r.get(k)) if k == "amount" else str(r.get(k) or "")[:120]) for k in keys}})
    return out


def _expense(body: dict, prev: dict | None, user: dict) -> dict:
    s: dict = {}
    for k in ("title", "category", "description", "provider", "treatment_id", "event_id", "spent_by", "notes", "currency", "paid_by"):
        if k in body:
            s[k] = str(body[k] or "")[:300]
    if "title" in s and not s["title"].strip():
        raise HTTPException(422, "Escribe el concepto del gasto")
    for k in ("amount", "discount"):
        if k in body:
            s[k] = num(body[k])
    if "date" in body:
        s["date"] = _date_or_empty(body["date"])
    if "payments" in body:
        s["payments"] = [p for p in _rows(body["payments"], ("amount", "date", "method", "by", "source", "coverage_id")) if p["amount"] > 0]
    if "supports" in body:
        s["supports"] = [p for p in _rows(body["supports"], ("amount", "date", "from")) if p["amount"] > 0]
    if "sources" in body:
        s["sources"] = _rows(body["sources"], ("coverage_id", "label", "mode"), 8)
    if "insurance" in body:
        s["insurance"] = {k: num(v) for k, v in (body["insurance"] or {}).items() if k in ("deductible", "deductible_accum", "coinsurance", "covered", "not_covered", "out_of_coverage", "other") and str(v).strip() != ""}
    if "claim" in body:
        c = body["claim"]
        if not c:
            s["claim"] = None
        else:
            old = (prev or {}).get("claim") or {}
            new = {k: str(c.get(k) or "")[:300] for k in ("coverage_id", "policy", "claim_no", "folio", "method", "owner_name", "reject_reason", "notes")}
            new.update({k: _date_or_empty(c.get(k)) for k in ("filed_date", "expected_date", "authorized_date")})
            new.update({k: num(c.get(k)) for k in ("requested", "authorized", "rejected")})
            new["deposits"] = [d for d in _rows(c.get("deposits"), ("amount", "date", "method")) if d["amount"] > 0]
            new["checklist"] = [{"id": i.get("id") or uid()[:8], "label": str(i.get("label") or "")[:120], "status": i.get("status") if i.get("status") in DOC_STATES else "Pendiente"}
                                for i in (c.get("checklist") or [])[:40] if isinstance(i, dict) and str(i.get("label") or "").strip()]
            new["status"] = c.get("status") if c.get("status") in CLAIM_STATES else old.get("status") or CLAIM_STATES[0]
            new["history"] = list(old.get("history") or [])
            if new["status"] != old.get("status"):  # manual change only: AMODO is not connected to the insurer
                new["history"].append({"status": new["status"], "date": _date_or_empty(c.get("status_date")) or now_iso()[:10], "by": display_name(user), "at": now_iso()})
            s["claim"] = new
    merged = {**(prev or {}), **s}
    c = calc(merged)
    s["status"] = "Pagado" if c["total"] > 0 and c["pending_pay"] == 0 else "Pendiente"  # keeps agenda / older screens in sync
    return s


@api.get("/finance/expenses")
async def finance_expenses(owner_id: str | None = None, user=Depends(current_user)):
    owner = await access(user, owner_id, "view")
    items = await expenses_of(owner)
    return {"items": items, "totals": totals(items), "claim_states": CLAIM_STATES, "doc_states": DOC_STATES,
            "note": "AMODO solo organiza lo que registras. No está conectado con aseguradoras ni instituciones y no calcula coberturas definitivas."}


@api.get("/finance/expenses/{eid}")
async def finance_expense(eid: str, user=Depends(current_user)):
    e = await db.records.find_one({"id": eid, "kind": "expenses"})
    if not e:
        raise HTTPException(404, "No encontramos este gasto")
    await access(user, e["owner_id"], "view")
    e = clean(e)
    e["calc"] = calc(e)
    e["log"] = [clean(x) async for x in db.finance_log.find({"ref": eid}).sort("at", -1).limit(15)]
    return e


@api.post("/finance/expenses")
async def create_expense(body: dict = Body(...), user=Depends(current_user)):
    owner = await access(user, body.get("owner_id"), "add")
    if "claim" in body and body["claim"] and owner != user["id"]:
        await access(user, owner, "claims")
    rec = {"id": uid(), "kind": "expenses", "owner_id": owner, "created_by": user["id"], "created_by_name": display_name(user), "created_at": now_iso(), "currency": "MXN", "payments": [],
           **_expense({"title": body.get("title", ""), **body}, None, user)}
    await db.records.insert_one(rec)
    await log(user, owner, "gasto creado", rec["id"], rec["title"])
    return clean(rec)


@api.put("/finance/expenses/{eid}")
async def update_expense(eid: str, body: dict = Body(...), user=Depends(current_user)):
    e = await db.records.find_one({"id": eid, "kind": "expenses"})
    if not e:
        raise HTTPException(404, "No encontramos este gasto")
    await access(user, e["owner_id"], "edit")
    if "claim" in body and e["owner_id"] != user["id"]:
        await access(user, e["owner_id"], "claims")
    s = _expense(body, e, user)
    s.update(updated_at=now_iso(), updated_by=display_name(user))
    await db.records.update_one({"id": eid}, {"$set": s})
    await log(user, e["owner_id"], "gasto editado", eid, ", ".join(k for k in body if k != "owner_id"))
    return await finance_expense(eid, user)


@api.delete("/finance/expenses/{eid}")
async def remove_expense(eid: str, user=Depends(current_user)):
    e = await db.records.find_one({"id": eid, "kind": "expenses"})
    if not e:
        raise HTTPException(404, "No encontramos este gasto")
    await access(user, e["owner_id"], "edit")
    await db.records.update_one({"id": eid}, {"$set": {"kind": "expenses_deleted", "deleted_at": now_iso()}})  # soft delete
    await log(user, e["owner_id"], "gasto eliminado", eid, e.get("title", ""))
    return {"ok": True}


# ---------------------------------------------------------------- documents (private storage, temporary links)
async def _ref_owner(ref_type: str, ref_id: str) -> str:
    doc = await (db.coverages.find_one({"id": ref_id}) if ref_type == "coverage" else db.records.find_one({"id": ref_id, "kind": "expenses"}))
    if not doc:
        raise HTTPException(404, "No encontramos el registro")
    return doc["owner_id"]


@api.get("/finance/docs")
async def list_docs(ref_id: str, ref_type: str = "expense", user=Depends(current_user)):
    await access(user, await _ref_owner(ref_type, ref_id), "docs")
    return [{k: v for k, v in clean(d).items() if k != "path"} async for d in db.finance_docs.find({"ref_id": ref_id, "deleted_at": None}).sort("created_at", 1)]


@api.post("/finance/docs")
async def upload_doc(file: UploadFile = File(...), ref_id: str = Form(...), ref_type: str = Form("expense"), category: str = Form("Otros documentos"), user=Depends(current_user)):
    owner = await access(user, await _ref_owner(ref_type, ref_id), "attach")
    ext = MIMES.get((file.content_type or "").split(";")[0])
    if not ext:
        raise HTTPException(422, "Formato no admitido. Usa PDF, imagen (JPG, PNG) o XML.")
    data = await file.read()
    if len(data) > MAX_FILE:
        raise HTTPException(422, "El archivo supera 12 MB.")
    did = uid()
    res = await asyncio.to_thread(put_object, f"{APP_NAME}/private/{owner}/{did}.{ext}", data, file.content_type)
    doc = {"id": did, "owner_id": owner, "ref_type": ref_type, "ref_id": ref_id, "category": category[:60], "name": (file.filename or f"documento.{ext}")[:120], "mime": file.content_type,
           "size": len(data), "path": res["path"], "created_by": display_name(user), "created_at": now_iso(), "deleted_at": None}
    await db.finance_docs.insert_one(doc)
    await log(user, owner, "documento adjuntado", ref_id, doc["name"])
    return {k: v for k, v in clean(doc).items() if k != "path"}


async def _doc(did: str, user: dict, perm="docs") -> dict:
    d = await db.finance_docs.find_one({"id": did, "deleted_at": None})
    if not d:
        raise HTTPException(404, "No encontramos este documento")
    await access(user, d["owner_id"], perm)
    return d


@api.post("/finance/docs/{did}/link")
async def doc_link(did: str, user=Depends(current_user)):
    d = await _doc(did, user)
    code = secrets.token_urlsafe(24)
    await db.finance_links.insert_one({"code": code, "doc_id": did, "expires": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()})
    await log(user, d["owner_id"], "documento consultado", d["ref_id"], d["name"])
    return {"path": f"/api/finance-file/{code}"}


@api.delete("/finance/docs/{did}")
async def delete_doc(did: str, user=Depends(current_user)):
    d = await _doc(did, user, "attach")
    await db.finance_docs.update_one({"id": did}, {"$set": {"deleted_at": now_iso()}})
    await log(user, d["owner_id"], "documento eliminado", d["ref_id"], d["name"])
    return {"ok": True}


async def _link(code: str) -> dict:
    link = await db.finance_links.find_one({"code": code})
    if not link or link["expires"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(404, "Este enlace ya no está disponible. Ábrelo de nuevo desde AMODO.")
    return link


@api.get("/finance-file/{code}")
async def finance_file(code: str):
    link = await _link(code)
    d = await db.finance_docs.find_one({"id": link.get("doc_id"), "deleted_at": None})
    if not d:
        raise HTTPException(404, "No encontrado")
    data, _ = await asyncio.to_thread(get_object, d["path"])
    return Response(data, media_type=d["mime"], headers={"Content-Disposition": f'inline; filename="{d["name"]}"', "Cache-Control": "no-store"})


# ---------------------------------------------------------------- Plus: AI reading of a document the person chose
PROMPTS = {
    "receipt": 'Lee este comprobante o factura. Responde SOLO JSON: {"provider":"","date":"YYYY-MM-DD","amount":null,"currency":"","title":"","folio":"","category":""}. '
               '"title" = concepto breve. "category" solo si es evidente. Si un dato NO aparece en el documento, déjalo vacío o null. Nunca inventes.',
    "policy": 'Lee este documento de cobertura o póliza. Responde SOLO JSON: {"insurer":"","plan":"","policy_number":"","insured":"","holder":"","valid_from":"YYYY-MM-DD","valid_until":"YYYY-MM-DD",'
              '"sum_insured":"","deductible":"","coinsurance":"","coinsurance_cap":"","currency":"","phone":"","conditions":"","sources":{"campo":"página o fragmento textual breve donde aparece"}}. '
              'Copia solo lo que aparezca de forma explícita; si no aparece, deja vacío. No interpretes coberturas ni des asesoría.',
}


@api.post("/finance/docs/{did}/extract")
async def extract_doc(did: str, kind: str = Body("receipt", embed=True), consent: bool = Body(False, embed=True), user=Depends(require_plus)):
    """Plus. Sends this one document to an AI model only after explicit consent; the result is a draft the person confirms or corrects."""
    import json
    import re
    from emergentintegrations.llm.chat import ImageContent, LlmChat, UserMessage
    from membership import refund_ai, use_ai
    from planner import llm_json
    import os
    if not consent:
        raise HTTPException(422, "Necesitamos tu autorización para leer este documento con IA.")
    d = await _doc(did, user)
    if kind not in PROMPTS or d["mime"] not in ("application/pdf", "image/jpeg", "image/png", "image/webp"):
        raise HTTPException(422, "Este tipo de archivo no se puede leer con IA. Usa PDF o imagen.")
    data, _ = await asyncio.to_thread(get_object, d["path"])
    await use_ai(user)
    try:
        if d["mime"] == "application/pdf":
            from pypdf import PdfReader
            pages = PdfReader(io.BytesIO(data)).pages[:12]
            text = "\n".join(f"[Página {i + 1}]\n{(p.extract_text() or '')[:5000]}" for i, p in enumerate(pages))
            if len(text.strip()) < 40:
                raise ValueError("pdf sin texto")
            out = await llm_json(PROMPTS[kind], text[:40000], "finance")
        else:
            chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"finance-{uid()}", system_message=PROMPTS[kind]).with_model("openai", "gpt-5.4")
            raw = await chat.send_message(UserMessage(text="Documento adjunto.", file_contents=[ImageContent(image_base64=base64.b64encode(data).decode())]))
            m = re.search(r"\{.*\}", raw or "", re.S)
            out = json.loads(m.group(0)) if m else {}
    except Exception as exc:
        logger.error("finance extract: %s", exc)
        await refund_ai(user)
        raise HTTPException(503, "No pudimos leer el documento ahora. Puedes capturar los datos a mano.")
    return {"fields": {k: v for k, v in out.items() if v not in ("", None, {}, [])}, "note": "Borrador creado con IA a partir del documento. Revisa cada dato antes de guardarlo."}


# ---------------------------------------------------------------- Plus: financial reports and claim dossiers
REPORTS = {"financial": "Reporte financiero", "claims": "Reporte de reembolsos", "treatment": "Gastos por tratamiento", "claim": "Resumen de un siniestro", "dossier": "Expediente de documentación"}


def _m(v: float) -> str:
    return f"${v:,.2f}".replace(".00", "") + " MXN"


def _mask(v: str, hide: bool) -> str:
    return ("•••" + v[-3:] if len(v) > 3 else "•••") if hide and v else v


async def _scope(owner: str, p: dict) -> list[dict]:
    items = await expenses_of(owner)
    if p.get("expense_ids"):
        items = [e for e in items if e["id"] in p["expense_ids"]]
    if p.get("start") and p.get("end"):
        items = [e for e in items if p["start"] <= e["when"] <= p["end"]]
    if p.get("categories"):
        items = [e for e in items if (e.get("category") or "Otros gastos") in p["categories"]]
    if p.get("coverage_id"):
        items = [e for e in items if any(s.get("coverage_id") == p["coverage_id"] for s in e.get("sources") or []) or (e.get("claim") or {}).get("coverage_id") == p["coverage_id"]]
    if p.get("claim_no"):
        items = [e for e in items if (e.get("claim") or {}).get("claim_no") == p["claim_no"]]
    if p["type"] in ("claims", "claim", "dossier") and not p.get("expense_ids"):
        items = [e for e in items if e["calc"]["has_claim"]]
    return items


def finance_pdf(title: str, name: str, items: list[dict], p: dict, docs: dict | None = None) -> bytes:
    from process import _t
    from fpdf import FPDF
    ink, muted, sand, sage = (37, 40, 42), (92, 96, 99), (230, 226, 215), (185, 214, 174)
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(True, margin=16)
    pdf.set_margins(16, 16, 16)
    pdf.add_page()
    w = pdf.w - 32

    def line(text, size=10, bold=False, color=ink, h=5.2):
        pdf.set_font("Helvetica", "B" if bold else "", size)
        pdf.set_text_color(*color)
        pdf.set_x(16)
        pdf.multi_cell(w, h, _t(text), new_x="LMARGIN", new_y="NEXT")

    def head(text):
        pdf.ln(4)
        line(text, 11, True)
        pdf.set_draw_color(*sand)
        pdf.line(16, pdf.get_y() + 1, 16 + w, pdf.get_y() + 1)
        pdf.ln(3)

    line("amodo", 20, True)
    line(title, 13, True)
    period = f"Del {fmt_es(p['start'])} al {fmt_es(p['end'])} de {p['end'][:4]}" if p.get("start") and p.get("end") else "Todos los registros"
    line(f"{name + ' · ' if name else ''}{period} · generado el {fmt_es(now_iso()[:10])}", 9.5, color=muted)
    line("Resumen personal de registros. No es un estado de cuenta, un dictamen ni un documento oficial. Los importes son los que la persona registró.", 8.5, color=muted)
    t = totals(items)
    head("Importes reales (registrados)")
    rows = [("Costo total registrado", t["total"]), ("Pagado por mí o mi red", t["paid_own"]), ("Pago directo de aseguradora o institución", t["direct"]), ("Pendiente de pago", t["pending_pay"]),
            ("Reembolso solicitado", t["requested"]), ("Reembolso autorizado", t["authorized"]), ("Reembolso recibido", t["received"]), ("Apoyos recibidos", t["supports"]), ("Desembolso neto actual", t["net"])]
    top = max(1.0, *(v for _, v in rows))
    for label, v in rows:
        y = pdf.get_y()
        pdf.set_font("Helvetica", "", 9.5)
        pdf.set_text_color(*ink)
        pdf.set_xy(16, y)
        pdf.cell(74, 6, _t(label))
        pdf.set_fill_color(*sage)
        pdf.rect(92, y + 1.3, max(1.2, 58 * max(v, 0) / top), 3.4, style="F")
        pdf.set_xy(152, y)
        pdf.cell(w - 136, 6, _t(_m(v)), align="R", new_x="LMARGIN", new_y="NEXT")
    if t["has_estimate"]:
        head("Estimaciones (no garantizadas)")
        line(f"Reembolsos autorizados aún por recibir: {_m(t['pending_receive'])}")
        line(f"Gasto final estimado: {_m(t['estimated_final'])} (desembolso neto + pagos pendientes - reembolsos autorizados por recibir).")
    if p["type"] in ("financial", "treatment"):
        key = (lambda e: p["treatments"].get(e.get("treatment_id") or "", "Sin tratamiento asociado")) if p["type"] == "treatment" else (lambda e: e.get("category") or "Otros gastos")
        groups: dict[str, float] = {}
        for e in items:
            groups[key(e)] = groups.get(key(e), 0) + e["calc"]["total"]
        head("Por tratamiento" if p["type"] == "treatment" else "Por categoría")
        for k, v in sorted(groups.items(), key=lambda x: -x[1]):
            line(f"{k}: {_m(v)}", 9.5)
    head("Movimientos")
    for e in items:
        c, cl = e["calc"], e.get("claim") or {}
        line(f"{fmt_es(e['when'])} · {e.get('title', '')} · {_m(c['total'])}", 9.5, True)
        line(f"{e.get('category') or 'Otros gastos'}{' · ' + e['provider'] if e.get('provider') else ''} · pagado {_m(c['paid_own'])} · pago directo {_m(c['direct'])} · pendiente {_m(c['pending_pay'])}", 8.8, color=muted, h=4.6)
        if cl:
            ids = " · ".join(x for x in (f"siniestro {_mask(cl.get('claim_no', ''), p.get('hide_sensitive'))}" if cl.get("claim_no") else "", f"folio {_mask(cl.get('folio', ''), p.get('hide_sensitive'))}" if cl.get("folio") else "") if x)
            line(f"Reembolso: {cl.get('status')}{' · ' + ids if ids else ''} · solicitado {_m(c['requested'])} · autorizado {_m(c['authorized'])} · recibido {_m(c['received'])}", 8.8, color=muted, h=4.6)
            for h_ in cl.get("history") or []:
                line(f"   {fmt_es(h_['date'])}: {h_['status']}", 8.5, color=muted, h=4.4)
            if p["type"] == "dossier":
                for i in cl.get("checklist") or []:
                    line(f"   [{i['status']}] {i['label']}", 8.8, h=4.6)
                missing = [i["label"] for i in cl.get("checklist") or [] if i["status"] in ("Pendiente", "Requiere corrección")]
                if missing:
                    line(f"   Falta según tu lista: {', '.join(missing)}", 8.8, True, h=4.6)
        for d in (docs or {}).get(e["id"], []):
            line(f"   Documento: {d['category']} - {d['name']}", 8.5, color=muted, h=4.4)
    if not items:
        line("Sin movimientos con estos filtros.", 9.5, color=muted)
    return bytes(pdf.output())


@api.post("/finance/reports")
async def finance_report(body: dict = Body(...), user=Depends(require_plus)):
    """Plus. Builds a PDF (or a ZIP dossier with the attached documents). Nothing is sent to insurers or anyone else."""
    owner = await access(user, body.get("owner_id"), "reports")
    if body.get("type") not in REPORTS:
        raise HTTPException(422, "Tipo de reporte no válido")
    p = {"type": body["type"], "owner_id": owner, "start": _date_or_empty(body.get("start")), "end": _date_or_empty(body.get("end")), "coverage_id": body.get("coverage_id") or "",
         "categories": [str(c) for c in body.get("categories") or []][:40], "expense_ids": [str(i) for i in body.get("expense_ids") or []][:200], "claim_no": str(body.get("claim_no") or ""),
         "hide_sensitive": bool(body.get("hide_sensitive")), "include_name": bool(body.get("include_name", True))}
    items = await _scope(owner, p)
    code = secrets.token_urlsafe(24)
    await db.finance_links.insert_one({"code": code, "report": p, "user_id": user["id"], "expires": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()})
    await log(user, owner, "reporte generado", p["type"], REPORTS[p["type"]])
    return {"path": f"/api/finance-download/{code}", "title": REPORTS[p["type"]], "count": len(items), "totals": totals(items)}


@api.get("/finance-download/{code}")
async def finance_download(code: str):
    link = await _link(code)
    p = link.get("report")
    user = await db.users.find_one({"id": link.get("user_id")})
    if not p or not user or not await is_plus(user):
        raise HTTPException(404, "No encontrado")
    owner = await db.users.find_one({"id": p["owner_id"]})
    items = await _scope(p["owner_id"], p)
    p["treatments"] = {t["id"]: t.get("name", "") async for t in db.records.find({"kind": "treatments", "owner_id": p["owner_id"]})}
    docs: dict[str, list] = {}
    async for d in db.finance_docs.find({"ref_id": {"$in": [e["id"] for e in items]}, "deleted_at": None}):
        docs.setdefault(d["ref_id"], []).append(d)
    pdf = finance_pdf(REPORTS[p["type"]], display_name(owner) if p["include_name"] else "", items, p, docs)
    if p["type"] != "dossier":
        return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="amodo-{p["type"]}.pdf"', "Cache-Control": "no-store"})
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("00-resumen.pdf", pdf)
        for n, e in enumerate(items, 1):
            for d in docs.get(e["id"], []):
                data, _ = await asyncio.to_thread(get_object, d["path"])
                z.writestr(f"{n:02d}-{e.get('title', 'gasto')[:30]}/{d['category'][:30]}-{d['name']}".replace("..", "."), data)
    return Response(buf.getvalue(), media_type="application/zip", headers={"Content-Disposition": 'attachment; filename="amodo-expediente.zip"', "Cache-Control": "no-store"})


async def compact(owner_id: str, today: str) -> dict | None:
    """Small financial summary for Mi proceso / Inicio. None when there is nothing relevant to show."""
    items = await expenses_of(owner_id)
    if not items:
        return None
    return {"totals": totals(items), "recent": [{"id": e["id"], "title": e.get("title", ""), "when": e["when"], "total": e["calc"]["total"]} for e in items[:3]],
            "attention": [{"id": e["id"], "title": e.get("title", ""), "status": e["calc"]["claim_status"]} for e in items if e["calc"]["claim_status"] in ATTENTION][:4],
            "to_pay": [{"id": e["id"], "title": e.get("title", ""), "when": e["when"], "amount": e["calc"]["pending_pay"]} for e in sorted(items, key=lambda e: e["when"]) if e["calc"]["pending_pay"] > 0][:3]}
