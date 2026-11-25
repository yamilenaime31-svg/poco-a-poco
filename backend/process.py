"""Mi proceso: wellbeing and activity history with chart-ready aggregates and a downloadable PDF summary.
Only the person's own records; descriptive counts, never an interpretation of health."""
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Body, Depends, HTTPException, Query
from fastapi.responses import Response

from knowledge import MONTHS, fmt_es
from planner import EVENT_CAT
from server import _date_or_empty, api, current_user, db, display_name

CAT_LABEL = {"appointments": "Consultas", "treatments": "Sesiones de tratamiento", "studies": "Estudios", "personal": "Actividades y otros"}
SECTIONS = ("feelings", "activities", "medications", "expenses")


def _top(counts: dict, n: int = 10) -> list[dict]:
    return [{"label": k, "value": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])[:n]]


async def process_data(user: dict, today: str, days: int) -> dict:
    end = datetime.strptime(today, "%Y-%m-%d").date()
    start = end - timedelta(days=days - 1)
    s, e = start.isoformat(), end.isoformat()
    rng = {"$gte": s, "$lte": e}
    weeks = []
    w0 = start
    while w0 <= end:
        w1 = min(w0 + timedelta(days=6), end)
        weeks.append({"start": w0.isoformat(), "end": w1.isoformat(), "label": f"{w0.day} {MONTHS[w0.month - 1][:3]}", "feel_days": 0, "activities": 0, "doses_done": 0, "spent": 0})
        w0 = w1 + timedelta(days=1)

    def week_of(d: str):
        return next((w for w in weeks if w["start"] <= d <= w["end"]), None)

    moods: dict[str, int] = {}
    energy: dict[str, int] = {}
    feel_days, notes = 0, []
    async for j in db.records.find({"kind": "journal", "owner_id": user["id"], "date": rng}).sort("date", 1):
        ms = j.get("moods") or ([j["mood"]] if j.get("mood") else [])
        if ms or j.get("energy"):
            feel_days += 1
            week_of(j["date"])["feel_days"] += 1
        for m in ms:
            moods[m] = moods.get(m, 0) + 1
        if j.get("energy") and j["energy"] != "Prefiero no decir":
            energy[j["energy"]] = energy.get(j["energy"], 0) + 1
        if j.get("mood_note") or j.get("note"):
            notes.append({"date": j["date"], "text": (j.get("mood_note") or j.get("note"))[:240]})
    signals: dict[str, int] = {}
    async for sg in db.signals.find({"patient_id": user["id"], "created_at": {"$gte": s, "$lte": e + "T99"}}):
        signals[sg["label"]] = signals.get(sg["label"], 0) + 1

    cats: dict[str, int] = {}
    events = []
    async for ev in db.records.find({"kind": "events", "owner_id": user["id"], "date": rng}).sort("date", 1):
        c = CAT_LABEL[EVENT_CAT.get(ev.get("type"), "personal")]
        cats[c] = cats.get(c, 0) + 1
        week_of(ev["date"])["activities"] += 1
        events.append({"date": ev["date"], "time": ev.get("time", ""), "title": ev.get("title", ""), "type": ev.get("type") or "Otro"})
    treatments = []
    async for t in db.records.find({"kind": "treatments", "owner_id": user["id"]}):
        n = await db.records.count_documents({"kind": "events", "treatment_id": t["id"], "date": rng})
        treatments.append({"name": t.get("name", ""), "status": t.get("status", ""), "sessions": n,
                           "cycle": f"{t['cycle_current']} de {t['cycles_total']}" if t.get("cycle_current") and t.get("cycles_total") else ""})

    med_names = {m["id"]: m.get("name", "") async for m in db.records.find({"kind": "medications", "owner_id": user["id"]})}
    dose = {"realizado": 0, "omitido": 0}
    by_med: dict[str, dict] = {}
    async for d in db.doses.find({"owner_id": user["id"], "date": rng}):
        if d.get("status") in dose and d["med_id"] in med_names:
            dose[d["status"]] += 1
            by_med.setdefault(med_names[d["med_id"]], {"realizado": 0, "omitido": 0})[d["status"]] += 1
            if d["status"] == "realizado":
                week_of(d["date"])["doses_done"] += 1

    by_cat: dict[str, float] = {}
    paid = pending = 0.0
    async for x in db.records.find({"kind": "expenses", "owner_id": user["id"]}):
        d = _date_or_empty(x.get("date")) or x["created_at"][:10]
        try:
            amt = float(x.get("amount") or 0)
        except (TypeError, ValueError):
            amt = 0
        if not (s <= d <= e) or amt <= 0:
            continue
        by_cat[x.get("category") or "Otro"] = by_cat.get(x.get("category") or "Otro", 0) + amt
        week_of(d)["spent"] += amt
        if x.get("status") == "Pagado":
            paid += amt
        else:
            pending += amt
    for w in weeks:
        w["spent"] = round(w["spent"], 2)
    return {"start": s, "end": e, "days": days, "period": f"Del {fmt_es(s)} al {fmt_es(e)} de {end.year}", "weeks": weeks,
            "feelings": {"days_logged": feel_days, "moods": _top(moods), "energy": _top(energy), "signals": _top(signals, 6), "notes": notes[-5:]},
            "activities": {"total": len(events), "by_category": _top(cats), "treatments": treatments, "events": events[-40:]},
            "medications": {"done": dose["realizado"], "skipped": dose["omitido"], "by_med": [{"name": k, **v} for k, v in sorted(by_med.items())]},
            "expenses": {"total": round(paid + pending, 2), "paid": round(paid, 2), "pending": round(pending, 2), "by_category": [{"label": k, "value": round(v, 2)} for k, v in sorted(by_cat.items(), key=lambda x: -x[1])]},
            "empty": not (feel_days or events or dose["realizado"] or dose["omitido"] or by_cat or signals),
            "note": "Este resumen describe lo que tú registraste. No es una valoración médica."}


def _days(days: int) -> int:
    if days not in (7, 30, 90):
        raise HTTPException(422, "Periodo no válido")
    return days


@api.get("/process")
async def process(today: str = Query(...), days: int = 30, user=Depends(current_user)):
    if not _date_or_empty(today):
        raise HTTPException(422, "Fecha no válida")
    return await process_data(user, today, _days(days))


# ---------------------------------------------------------------- PDF
def _t(v) -> str:
    s = str(v if v is not None else "")
    for a, b in (("—", "-"), ("–", "-"), ("…", "..."), ("“", '"'), ("”", '"'), ("‘", "'"), ("’", "'"), ("•", "·")):
        s = s.replace(a, b)
    return s.encode("latin-1", "replace").decode("latin-1")


def _money(v: float) -> str:
    return f"${v:,.2f}".replace(".00", "") + " MXN"


def build_pdf(name: str, d: dict, sections: list[str]) -> bytes:
    from fpdf import FPDF
    ink, muted, sage, sand = (41, 45, 43), (106, 109, 105), (183, 198, 184), (231, 224, 214)

    class Doc(FPDF):
        def footer(self):
            self.set_y(-14)
            self.set_font("Helvetica", size=8)
            self.set_text_color(*muted)
            self.cell(0, 6, _t(f"Generado por ti desde AMODO · No sustituye las indicaciones de tu equipo médico · Página {self.page_no()}"), align="C")

    pdf = Doc(format="A4")
    pdf.set_auto_page_break(True, margin=18)
    pdf.set_margins(18, 18, 18)
    pdf.add_page()
    width = pdf.w - 36

    def line(text, size=10, bold=False, color=ink, h=5.5):
        pdf.set_font("Helvetica", "B" if bold else "", size)
        pdf.set_text_color(*color)
        pdf.set_x(18)
        pdf.multi_cell(width, h, _t(text), new_x="LMARGIN", new_y="NEXT")

    def section(title):
        if pdf.get_y() > 240:
            pdf.add_page()
        pdf.ln(5)
        line(title.upper(), 9, True, muted)
        pdf.set_draw_color(*sand)
        pdf.line(18, pdf.get_y() + 1, 18 + width, pdf.get_y() + 1)
        pdf.ln(3)

    def bars(rows, fmt=str):
        top = max((r["value"] for r in rows), default=0) or 1
        for r in rows:
            if pdf.get_y() > 270:
                pdf.add_page()
            y = pdf.get_y()
            pdf.set_font("Helvetica", "", 9.5)
            pdf.set_text_color(*ink)
            pdf.set_xy(18, y)
            pdf.cell(62, 6, _t(r["label"])[:38])
            pdf.set_fill_color(*sage)
            pdf.rect(82, y + 1.2, max(1.5, 68 * r["value"] / top), 3.6, style="F")
            pdf.set_xy(154, y)
            pdf.cell(width - 136, 6, _t(fmt(r["value"])), align="R", new_x="LMARGIN", new_y="NEXT")

    line("amodo", 20, True)
    line("Mi proceso · resumen personal", 13, True)
    line(f"{name} · {d['period']}", 10, color=muted)
    line(d["note"], 9, color=muted)

    if "feelings" in sections:
        f = d["feelings"]
        section("Cómo me he sentido")
        line(f"Registré cómo me sentía {f['days_logged']} de {d['days']} días.")
        if f["moods"]:
            pdf.ln(1)
            bars(f["moods"], lambda v: f"{v} día{'s' if v != 1 else ''}")
        if f["energy"]:
            pdf.ln(2)
            line("Energía", 9, True, muted)
            bars(f["energy"], lambda v: f"{v} día{'s' if v != 1 else ''}")
        if f["signals"]:
            pdf.ln(2)
            line("Señales que envié a mi red", 9, True, muted)
            bars(f["signals"], lambda v: f"{v} vez" if v == 1 else f"{v} veces")
        for n in f["notes"]:
            line(f"{fmt_es(n['date'])}: {n['text']}", 9, color=muted, h=4.8)
        if not (f["moods"] or f["energy"] or f["signals"]):
            line("Sin registros de bienestar en este periodo.", 9, color=muted)

    if "activities" in sections:
        a = d["activities"]
        section("Citas y tratamientos")
        line(f"{a['total']} actividad{'es' if a['total'] != 1 else ''} en la agenda durante el periodo.")
        if a["by_category"]:
            pdf.ln(1)
            bars(a["by_category"])
        for t in a["treatments"]:
            line(f"{t['name']} · {t['status'] or 'sin estado'}{' · ciclo ' + t['cycle'] if t['cycle'] else ''} · {t['sessions']} sesión(es) en el periodo", 9.5)
        if a["events"]:
            pdf.ln(2)
            line("Detalle", 9, True, muted)
            for ev in a["events"]:
                line(f"{fmt_es(ev['date'])}{' · ' + ev['time'] if ev['time'] else ''} · {ev['title']} ({ev['type']})", 9, h=4.8)

    if "medications" in sections:
        m = d["medications"]
        section("Medicamentos (lo que marqué)")
        if m["done"] or m["skipped"]:
            line(f"Tomas marcadas como realizadas: {m['done']} · omitidas: {m['skipped']}.")
            for x in m["by_med"]:
                line(f"{x['name']}: {x['realizado']} realizadas, {x['omitido']} omitidas", 9.5)
        else:
            line("Sin tomas marcadas en este periodo.", 9, color=muted)
        line("Solo cuenta lo que marqué de forma explícita; lo no marcado no significa que no se tomó.", 8.5, color=muted)

    if "expenses" in sections:
        x = d["expenses"]
        section("Gastos")
        if x["by_category"]:
            line(f"Total registrado: {_money(x['total'])} · pagado: {_money(x['paid'])} · pendiente: {_money(x['pending'])}.")
            pdf.ln(1)
            bars(x["by_category"], _money)
        else:
            line("Sin gastos registrados en este periodo.", 9, color=muted)

    active = [w for w in d["weeks"] if w["feel_days"] or w["activities"] or w["doses_done"] or w["spent"]]
    if active:
        section("Semana a semana")
        for w in d["weeks"]:
            parts = [f"{w['feel_days']} día(s) con registro de bienestar" if "feelings" in sections else "", f"{w['activities']} actividad(es)" if "activities" in sections else "",
                     f"{w['doses_done']} toma(s) realizadas" if "medications" in sections else "", _money(w["spent"]) if "expenses" in sections else ""]
            line(f"Semana del {fmt_es(w['start'])}: " + " · ".join(p for p in parts if p), 9, h=4.8)
    return bytes(pdf.output())


@api.post("/process/pdf-link")
async def process_pdf_link(today: str = Body(..., embed=True), days: int = Body(30, embed=True), sections: list = Body(list(SECTIONS), embed=True), user=Depends(current_user)):
    """Single-use, short-lived link so the phone's browser can download the PDF without exposing the session token."""
    if not _date_or_empty(today):
        raise HTTPException(422, "Fecha no válida")
    sections = [s for s in sections if s in SECTIONS] or list(SECTIONS)
    code = secrets.token_urlsafe(24)
    await db.process_links.insert_one({"code": code, "user_id": user["id"], "today": today, "days": _days(days), "sections": sections,
                                       "expires": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()})
    return {"path": f"/api/process-download/{code}"}


@api.get("/process-download/{code}")
async def process_download(code: str):
    link = await db.process_links.find_one_and_update({"code": code, "used": {"$ne": True}}, {"$set": {"used": True}})
    if not link or link["expires"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(404, "Este enlace ya no está disponible. Genera el resumen de nuevo desde AMODO.")
    user = await db.users.find_one({"id": link["user_id"]})
    if not user:
        raise HTTPException(404, "No encontrado")
    data = build_pdf(display_name(user), await process_data(user, link["today"], link["days"]), link["sections"])
    return Response(data, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="amodo-mi-proceso-{link["today"]}.pdf"', "Cache-Control": "no-store"})
