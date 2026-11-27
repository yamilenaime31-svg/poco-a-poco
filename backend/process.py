"""Mi proceso: wellbeing and activity history with chart-ready aggregates and a downloadable PDF summary.
Only the person's own records; descriptive counts, never an interpretation of health."""
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Body, Depends, HTTPException, Query
from fastapi.responses import Response

from knowledge import MONTHS, fmt_es
from planner import EVENT_CAT
from business import is_plus, require_plus
from server import _date_or_empty, api, clean, current_user, db, display_name, now_iso, uid

CAT_LABEL = {"appointments": "Consultas", "treatments": "Sesiones de tratamiento", "studies": "Estudios", "personal": "Actividades y otros"}
SECTIONS = ("feelings", "appointments", "treatments", "medications", "activities", "expenses", "finance", "notes")
CAT_SECTION = {"appointments": "appointments", "studies": "appointments", "treatments": "treatments", "personal": "activities"}


def _top(counts: dict, n: int = 10) -> list[dict]:
    return [{"label": k, "value": v} for k, v in sorted(counts.items(), key=lambda x: -x[1])[:n]]


async def process_data(user: dict, today: str, days: int, start_s: str = "", end_s: str = "") -> dict:
    end = datetime.strptime(end_s or today, "%Y-%m-%d").date()
    start = datetime.strptime(start_s, "%Y-%m-%d").date() if start_s else end - timedelta(days=days - 1)
    days = (end - start).days + 1
    daily = {(start + timedelta(days=n)).isoformat(): {"date": (start + timedelta(days=n)).isoformat(), "moods": [], "energy": "", "note": "", "journal_id": None, "events": [], "doses_done": 0, "doses_skipped": 0, "spent": 0, "tasks_done": 0} for n in range(days)}
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
        dd = daily[j["date"]]
        dd.update(moods=dd["moods"] + [m for m in ms if m not in dd["moods"]], energy=j.get("energy") or dd["energy"], note=(j.get("mood_note") or j.get("note") or dd["note"])[:240], journal_id=j["id"])
    signals: dict[str, int] = {}
    async for sg in db.signals.find({"patient_id": user["id"], "created_at": {"$gte": s, "$lte": e + "T99"}}):
        signals[sg["label"]] = signals.get(sg["label"], 0) + 1

    cats: dict[str, int] = {}
    counts: dict[str, int] = {}
    events = []
    async for ev in db.records.find({"kind": "events", "owner_id": user["id"], "date": rng}).sort("date", 1):
        c = CAT_LABEL[EVENT_CAT.get(ev.get("type"), "personal")]
        cats[c] = cats.get(c, 0) + 1
        week_of(ev["date"])["activities"] += 1
        key = EVENT_CAT.get(ev.get("type"), "personal")
        counts[CAT_SECTION[key]] = counts.get(CAT_SECTION[key], 0) + 1
        # "programada" = still ahead; "registrada" = its date already passed (AMODO does not know if it took place).
        item = {"id": ev["id"], "date": ev["date"], "time": ev.get("time", ""), "title": ev.get("title", ""), "type": ev.get("type") or "Otro", "section": CAT_SECTION[key],
                "status": "cancelada" if ev.get("status") == "Cancelado" else "programada" if ev["date"] > today else "registrada"}
        events.append(item)
        daily[ev["date"]]["events"].append(item)
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
            daily[d["date"]]["doses_done" if d["status"] == "realizado" else "doses_skipped"] += 1
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
        daily[d]["spent"] = round(daily[d]["spent"] + amt, 2)
        if x.get("status") == "Pagado":
            paid += amt
        else:
            pending += amt
    tasks_done = tasks_open = 0
    async for tk in db.records.find({"kind": "tasks", "owner_id": user["id"]}):
        d = _date_or_empty(tk.get("date")) or (tk.get("updated_at") or tk["created_at"])[:10]
        if s <= d <= e:
            if tk.get("done"):
                tasks_done += 1
                daily[d]["tasks_done"] += 1
            else:
                tasks_open += 1
    for w in weeks:
        w["spent"] = round(w["spent"], 2)
    return {"start": s, "end": e, "days": days, "period": f"Del {fmt_es(s)} al {fmt_es(e)} de {end.year}", "weeks": weeks,
            "feelings": {"days_logged": feel_days, "moods": _top(moods), "energy": _top(energy), "signals": _top(signals, 6), "notes": notes[-12:]},
            "activities": {"total": len(events), "by_category": _top(cats), "treatments": treatments, "events": events[-60:], "counts": counts},
            "daily": list(daily.values()), "tasks": {"done": tasks_done, "open": tasks_open},
            "medications": {"done": dose["realizado"], "skipped": dose["omitido"], "by_med": [{"name": k, **v} for k, v in sorted(by_med.items())]},
            "expenses": {"total": round(paid + pending, 2), "paid": round(paid, 2), "pending": round(pending, 2), "by_category": [{"label": k, "value": round(v, 2)} for k, v in sorted(by_cat.items(), key=lambda x: -x[1])]},
            "empty": not (feel_days or events or dose["realizado"] or dose["omitido"] or by_cat or signals),
            "note": "Este resumen describe lo que tú registraste. No es una valoración médica."}


def _days(days: int) -> int:
    if days not in (7, 30, 90):
        raise HTTPException(422, "Periodo no válido")
    return days


def _totals(d: dict) -> dict:
    return {"feel_days": d["feelings"]["days_logged"], "activities": d["activities"]["total"], "doses_done": d["medications"]["done"], "spent": d["expenses"]["total"]}


@api.get("/process/shared")
async def process_shared(today: str = Query(...), days: int = 30, user=Depends(current_user)):
    """For companions: their own accompaniment activity, and, kept apart, what each linked person shared with them in the period.
    Only items shared with this companion are counted; nothing emotional or medical is merged with the companion's own records."""
    if not _date_or_empty(today):
        raise HTTPException(422, "Fecha no válida")
    end = datetime.strptime(today, "%Y-%m-%d").date()
    start = (end - timedelta(days=_days(days) - 1)).isoformat()
    rng = {"$gte": start, "$lte": today}
    me = user["id"]
    mine = {"done": await db.records.count_documents({"kind": "tasks", "assignee_id": me, "owner_id": {"$ne": me}, "done": True}),
            "open": await db.records.count_documents({"kind": "tasks", "assignee_id": me, "owner_id": {"$ne": me}, "done": {"$ne": True}}),
            "transfers": await db.records.count_documents({"kind": "transfers", "date": rng, "$or": [{"driver_id": me}, {"assignee_id": me}]}),
            "accompanied": await db.records.count_documents({"kind": "events", "date": rng, "shared_with": me, "owner_id": {"$ne": me}})}
    labels = {"events": "citas y actividades", "treatments": "tratamientos", "medications": "medicamentos", "tasks": "pendientes", "transfers": "traslados", "journal": "notas de bienestar"}
    people = []
    async for link in db.links.find({"caregiver_id": me, "status": "active"}):
        p = await db.users.find_one({"id": link["patient_id"]}) or {}
        counts, recent = [], []
        for kind, label in labels.items():
            q = {"kind": kind, "owner_id": link["patient_id"], "shared_with": me, **({"date": rng} if kind in ("events", "transfers", "journal") else {})}
            n = await db.records.count_documents(q)
            if n:
                counts.append({"kind": kind, "label": label, "n": n})
        async for e in db.records.find({"kind": "events", "owner_id": link["patient_id"], "shared_with": me, "date": rng}).sort("date", -1).limit(5):
            recent.append({"id": e["id"], "title": e.get("title", ""), "date": e.get("date", ""), "type": e.get("type", "")})
        people.append({"patient_id": link["patient_id"], "name": p.get("preferred_name") or p.get("name") or "", "counts": counts, "recent": recent})
    return {"mine": mine, "people": people}


@api.get("/process")
async def process(today: str = Query(...), days: int = 30, user=Depends(current_user)):
    """Everyone sees their own records. Plus adds the comparison with the previous period (descriptive only)."""
    if not _date_or_empty(today):
        raise HTTPException(422, "Fecha no válida")
    d = await process_data(user, today, _days(days))
    d["plus"] = await is_plus(user)
    from finance import compact
    d["finance"] = await compact(user["id"], today)
    if d["plus"]:
        prev_end = (datetime.strptime(d["start"], "%Y-%m-%d").date() - timedelta(days=1)).isoformat()
        d["compare"] = {"now": _totals(d), "before": _totals(await process_data(user, today, days, end_s=prev_end))}
    return d


# ---------------------------------------------------------------- PDF
def _t(v) -> str:
    s = str(v if v is not None else "")
    for a, b in (("—", "-"), ("–", "-"), ("…", "..."), ("“", '"'), ("”", '"'), ("‘", "'"), ("’", "'"), ("•", "·")):
        s = s.replace(a, b)
    return s.encode("latin-1", "replace").decode("latin-1")


def _money(v: float) -> str:
    return f"${v:,.2f}".replace(".00", "") + " MXN"


def build_pdf(name: str, d: dict, sections: list[str]) -> bytes:
    acts = [x for x in ("appointments", "treatments", "activities") if x in sections]
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
    line("Mi proceso · resumen personal de registros", 13, True)
    line(f"{name + ' · ' if name else ''}{d['period']} · generado el {fmt_es(datetime.now(timezone.utc).date().isoformat())}", 10, color=muted)
    line(d["note"], 9, color=muted)

    if "feelings" in sections:
        f = d["feelings"]
        section("Cómo me he sentido")
        line(f"Registré cómo me sentía {f['days_logged']} de {d['days']} días.")
        # Wellbeing calendar: one cell per day, filled when something was registered that day.
        if len(d["daily"]) <= 92:
            pdf.ln(2)
            x0, y0 = 18, pdf.get_y()
            off = datetime.strptime(d["start"], "%Y-%m-%d").weekday()
            for n, day in enumerate(d["daily"]):
                col, row = (n + off) % 7, (n + off) // 7
                on = bool(day["moods"] or day["energy"])
                pdf.set_fill_color(*(sage if on else sand))
                pdf.rect(x0 + col * 8, y0 + row * 6.2, 7, 5.2, style="F")
                pdf.set_font("Helvetica", "", 6.5)
                pdf.set_text_color(*(ink if on else muted))
                pdf.set_xy(x0 + col * 8, y0 + row * 6.2)
                pdf.cell(7, 5.2, day["date"][8:], align="C")
            rows = (len(d["daily"]) + off + 6) // 7
            pdf.set_xy(80, y0)
            pdf.set_font("Helvetica", "", 8.5)
            pdf.set_text_color(*muted)
            pdf.multi_cell(width - 62, 4.6, _t("Calendario de bienestar (lunes a domingo). Verde: día con registro. Arena: día sin registro; no significa ausencia de síntomas ni de actividades."))
            pdf.set_y(max(pdf.get_y(), y0 + rows * 6.2) + 2)
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
        if not (f["moods"] or f["energy"] or f["signals"]):
            line("Sin registros de bienestar en este periodo.", 9, color=muted)

    if acts:
        a = d["activities"]
        evs = [ev for ev in a["events"] if ev["section"] in acts]
        names = {"appointments": "Citas y estudios", "treatments": "Tratamientos", "activities": "Actividades"}
        section(" · ".join(names[x] for x in acts))
        line(f"{len(evs)} registro{'s' if len(evs) != 1 else ''} en la agenda durante el periodo.")
        rows = [{"label": names[x], "value": sum(1 for ev in evs if ev["section"] == x)} for x in acts]
        if any(r["value"] for r in rows):
            pdf.ln(1)
            bars(rows)
        for t in (a["treatments"] if "treatments" in acts else []):
            line(f"{t['name']} · {t['status'] or 'sin estado'}{' · ciclo ' + t['cycle'] if t['cycle'] else ''} · {t['sessions']} sesión(es) en el periodo", 9.5)
        if evs:
            pdf.ln(2)
            line("Detalle", 9, True, muted)
            for ev in evs:
                line(f"{fmt_es(ev['date'])}{' · ' + ev['time'] if ev['time'] else ''} · {ev['title']} ({ev['type']}) · {ev['status']}", 9, h=4.8)

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

    if "finance" in sections and d.get("finance"):
        fin = d["finance"]
        t = fin["totals"]
        section("Pagos, coberturas y reembolsos")
        if fin["count"]:
            line("Importes reales (registrados por mí)", 9.5, True)
            bars([{"label": l, "value": t[k]} for k, l in FIN_ROWS if t[k] > 0 or k in ("total", "net")], _money)
            if t["has_estimate"]:
                pdf.ln(1)
                line("Estimaciones (no garantizadas)", 9.5, True)
                line(f"Reembolsos autorizados aún por recibir: {_money(t['pending_receive'])} · gasto final estimado: {_money(t['estimated_final'])}.", 9.5)
            if fin["claims"]:
                pdf.ln(1)
                line("Trámites de reembolso", 9.5, True)
                for c in fin["claims"]:
                    line(f"{c['title']}: {c['status']} · solicitado {_money(c['requested'])} · autorizado {_money(c['authorized'])} · recibido {_money(c['received'])}", 9, h=4.8)
        else:
            line("Sin gastos registrados en este periodo.", 9, color=muted)
        line("Lo solicitado o autorizado no se resta hasta recibirlo. No es un estado de cuenta ni un dictamen de cobertura.", 8.5, color=muted)

    if "notes" in sections:
        section("Notas personales")
        for n in d["feelings"]["notes"]:
            line(f"{fmt_es(n['date'])}: {n['text']}", 9.5, h=5)
        if not d["feelings"]["notes"]:
            line("Sin notas en este periodo.", 9, color=muted)

    active = [w for w in d["weeks"] if w["feel_days"] or w["activities"] or w["doses_done"] or w["spent"]]
    if active:
        section("Semana a semana")
        for w in d["weeks"]:
            parts = [f"{w['feel_days']} día(s) con registro de bienestar" if "feelings" in sections else "", f"{w['activities']} actividad(es)" if acts else "",
                     f"{w['doses_done']} toma(s) realizadas" if "medications" in sections else "", _money(w["spent"]) if "expenses" in sections else ""]
            line(f"Semana del {fmt_es(w['start'])}: " + " · ".join(p for p in parts if p), 9, h=4.8)
    return bytes(pdf.output())


async def _link(report: dict) -> str:
    code = secrets.token_urlsafe(24)
    await db.process_links.insert_one({"code": code, "user_id": report["user_id"], "report_id": report["id"], "expires": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()})
    return f"/api/process-download/{code}"


@api.get("/process/reports")
async def list_reports(user=Depends(current_user)):
    return [clean(r) async for r in db.process_reports.find({"user_id": user["id"]}).sort("created_at", -1).limit(20)]


FIN_ROWS = [("total", "Costo total registrado"), ("paid_own", "Pagado por mí o mi red"), ("direct", "Pago directo de terceros"), ("pending_pay", "Pendiente de pago"),
            ("requested", "Reembolso solicitado"), ("authorized", "Reembolso autorizado"), ("received", "Reembolso recibido"), ("supports", "Apoyos recibidos"), ("net", "Desembolso neto actual")]


async def report_data(user: dict, r: dict) -> dict:
    d = await process_data(user, r["today"], 30, r["start"], r["end"])
    if "finance" in r["sections"]:
        from finance import period_finance
        d["finance"] = await period_finance(user["id"], r["start"], r["end"])
    return d


def preview_blocks(d: dict, sections: list[str]) -> list[dict]:
    """What the PDF will say, section by section, so the person can check it before generating."""
    f, a, m, x, c = d["feelings"], d["activities"], d["medications"], d["expenses"], d["activities"]["counts"]
    out = {
        "feelings": ("Cómo me he sentido", [f"Registro en {f['days_logged']} de {d['days']} días"] + ([f"Más frecuente: {', '.join(i['label'] for i in f['moods'][:3])}"] if f["moods"] else [])),
        "appointments": ("Citas médicas", [f"{c.get('appointments', 0)} cita(s) y estudio(s)"]),
        "treatments": ("Tratamientos", [f"{c.get('treatments', 0)} sesión(es)"] + [t if isinstance(t, str) else str(t.get("name", "")) for t in a["treatments"][:4]]),
        "medications": ("Medicamentos", [f"{m['done']} toma(s) realizadas, {m['skipped']} omitidas"] + [f"{i['name']}: {i['realizado']} realizadas" for i in m["by_med"][:4]]),
        "activities": ("Actividades", [f"{c.get('activities', 0)} actividad(es)"]),
        "expenses": ("Gastos", [f"Total registrado {_money(x['total'])} · pagado {_money(x['paid'])} · pendiente {_money(x['pending'])}"] + [f"{i['label']}: {_money(i['value'])}" for i in x["by_category"][:5]]),
        "notes": ("Notas personales", [f"{len(f['notes'])} nota(s)"] + [n["text"][:70] for n in f["notes"][:2]]),
    }
    if d.get("finance"):
        t, fin = d["finance"]["totals"], d["finance"]
        lines = [f"{l}: {_money(t[k])}" for k, l in FIN_ROWS if t[k] > 0 or k in ("total", "net")] if fin["count"] else ["Sin gastos registrados en este periodo"]
        if t["has_estimate"]:
            lines.append(f"Estimado, no garantizado: por recibir {_money(t['pending_receive'])} · gasto final {_money(t['estimated_final'])}")
        lines += [f"{c_['title']}: {c_['status']}" for c_ in fin["claims"][:6]]
        out["finance"] = ("Pagos, coberturas y reembolsos", lines)
    return [{"k": k, "title": out[k][0], "lines": [l for l in out[k][1] if l]} for k in SECTIONS if k in sections and k in out]


def _report_params(body: dict) -> dict:
    today, start, end = (_date_or_empty(body.get(k)) for k in ("today", "start", "end"))
    if not today:
        raise HTTPException(422, "Fecha no válida")
    if start and end:
        if start > end or (datetime.strptime(end, "%Y-%m-%d") - datetime.strptime(start, "%Y-%m-%d")).days > 366:
            raise HTTPException(422, "Elige un rango de hasta un año, con inicio antes del final.")
    else:
        end = today
        start = (datetime.strptime(today, "%Y-%m-%d").date() - timedelta(days=_days(int(body.get("days") or 30)) - 1)).isoformat()
    sections = [x for x in (body.get("sections") or []) if x in SECTIONS]
    if not sections:
        raise HTTPException(422, "Elige al menos una categoría para tu reporte.")
    return {"today": today, "start": start, "end": end, "sections": sections, "period": f"Del {fmt_es(start)} al {fmt_es(end)} de {end[:4]}"}


@api.get("/process/report-preview")
async def report_preview(today: str, days: int = 30, start: str = "", end: str = "", sections: str = "", user=Depends(require_plus)):
    r = _report_params({"today": today, "days": days, "start": start, "end": end, "sections": sections.split(",")})
    return {"period": r["period"], "blocks": preview_blocks(await report_data(user, r), r["sections"])}


@api.post("/process/reports")
async def create_report(body: dict = Body(...), user=Depends(require_plus)):
    """Plus: a personal PDF summary with the period and categories the person chose. Nothing is shared automatically."""
    p = _report_params(body)
    today, start, end, sections = p["today"], p["start"], p["end"], p["sections"]
    r = {"id": uid(), "user_id": user["id"], "today": today, "start": start, "end": end, "sections": sections, "include_name": bool(body.get("include_name", True)),
         "period": f"Del {fmt_es(start)} al {fmt_es(end)} de {end[:4]}", "created_at": now_iso()}
    await db.process_reports.insert_one(r)
    return {**clean(r), "path": await _link(r)}


@api.post("/process/reports/{rid}/link")
async def report_link(rid: str, user=Depends(require_plus)):
    r = await db.process_reports.find_one({"id": rid, "user_id": user["id"]})
    if not r:
        raise HTTPException(404, "No encontramos ese reporte")
    return {"path": await _link(r)}


@api.get("/process-download/{code}")
async def process_download(code: str):
    link = await db.process_links.find_one({"code": code})
    if not link or not link.get("report_id") or link["expires"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(404, "Este enlace ya no está disponible. Genera el enlace de nuevo desde AMODO.")
    user = await db.users.find_one({"id": link["user_id"]})
    r = await db.process_reports.find_one({"id": link["report_id"]})
    if not user or not r or not await is_plus(user):
        raise HTTPException(404, "No encontrado")
    data = build_pdf(display_name(user) if r["include_name"] else "", await report_data(user, r), r["sections"])
    return Response(data, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="amodo-mi-proceso-{r["end"]}.pdf"', "Cache-Control": "no-store"})
