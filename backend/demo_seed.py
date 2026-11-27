"""Fully populated demonstration profile (Sofía Méndez + her support network), all fictitious.
Reference date: Friday 27 Nov 2026, Mexico City. Everything is created as normal, editable records so charts, reports and
recommendations are computed from data. `reset` only touches these demo accounts."""
import asyncio
import os
from datetime import date, datetime, timedelta, timezone

from fastapi import Depends, HTTPException
from fpdf import FPDF

import business
from finance import _expense
from server import DEFAULT_PERMS, FLOW, api, clean, create_user, current_user, db, hash_pw, make_token, uid
from storage import APP_NAME, put_object

SET = "sofia"
REF = date(2026, 11, 27)
DEMO_NOW = "2026-11-28T01:00:00+00:00"  # 27 Nov, 19:00 in Mexico City
PEOPLE = {  # key: email, name, preferred, role, relation
    "sofia": ("sofia.demo@amodo.app", "Sofía Méndez", "Sofía", "patient", ""),
    "diego": ("diego.demo@amodo.app", "Diego Méndez", "Diego", "caregiver", "Pareja"),
    "laura": ("laura.demo@amodo.app", "Laura Hernández", "Laura", "caregiver", "Hermano/a"),
    "mariana": ("mariana.demo@amodo.app", "Mariana Torres", "Mariana", "caregiver", "Amistad"),
}
HOSP, LAB = "Hospital de demostración", "Laboratorio de demostración"
SIM = "Horario simulado para la demostración. No es una indicación médica."


def d(month: int, day: int) -> str:
    return date(2026, month, day).isoformat()


def ts(day: str, hm: str = "12:00") -> str:
    """Mexico City wall time (UTC-6) as an ISO timestamp."""
    return (datetime.fromisoformat(f"{day}T{hm}:00") + timedelta(hours=6)).replace(tzinfo=timezone.utc).isoformat()


def demo_pdf(title: str, lines: list[str]) -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(190, 60, 60)
    pdf.cell(0, 14, "DEMOSTRACIÓN - SIN VALIDEZ", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(40, 40, 40)
    pdf.set_font("Helvetica", "B", 14)
    pdf.cell(0, 10, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    for line in lines + ["", "Documento ilustrativo creado para el prototipo AMODO.", "No es un comprobante fiscal, médico ni de seguros. Datos ficticios."]:
        pdf.cell(0, 7, line, new_x="LMARGIN", new_y="NEXT")
    return bytes(pdf.output())


async def wipe(ids: list[str]):
    async for o in db.orders.find({"user_id": {"$in": ids}, "shipped": {"$ne": True}, "cancelled": {"$ne": True}}):
        for pid, q in (o.get("reserved") or {}).items():
            await db.products.update_one({"id": pid}, {"$inc": {"stock_reserved": -q}})
    inn = {"$in": ids}
    for coll, key in [("records", "owner_id"), ("doses", "owner_id"), ("signals", "patient_id"), ("checklists", "owner_id"), ("kits", "owner_id"), ("cart", "user_id"), ("favorites", "user_id"),
                      ("orders", "user_id"), ("credit_moves", "user_id"), ("subscriptions", "user_id"), ("benefit_history", "user_id"), ("ai_usage", "user_id"), ("notifications", "user_id"),
                      ("links", "patient_id"), ("links", "caregiver_id"), ("coverages", "owner_id"), ("finance_docs", "owner_id"), ("finance_log", "owner_id"), ("finance_links", "user_id"),
                      ("finance_shares", "owner_id"), ("finance_categories", "owner_id"), ("process_reports", "user_id"), ("process_links", "user_id"), ("plus_marks", "user_id"),
                      ("reco_explain", "user_id"), ("style_images", "user_id"), ("invites", "patient_id"), ("benefits", "user_id")]:
        await db[coll].delete_many({key: inn})


async def seed(password: str | None = None) -> dict:
    """Creates the accounts if missing (password required then) and rebuilds all their data."""
    u: dict[str, dict] = {}
    for k, (email, name, pref, role, _rel) in PEOPLE.items():
        user = await db.users.find_one({"email": email})
        if not user:
            if not password:
                raise RuntimeError("password required to create demo accounts")
            user = await create_user(email, password, name, pref, role, True)
        elif password:
            await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_pw(password)}})
        u[k] = user
    ids = {k: v["id"] for k, v in u.items()}
    S, D, L, M = ids["sofia"], ids["diego"], ids["laura"], ids["mariana"]
    await wipe(list(ids.values()))
    base_settings = {"text_scale": 1, "reduce_motion": False, "notif_agenda": True, "notif_signals": True, "notif_orders": True, "tz_offset": -360}
    common = {"demo_set": SET, "demo_clock": REF.isoformat(), "demo_now": DEMO_NOW, "onboarding_done": True, "plan_chosen": True, "is_admin": False}
    custom = [{"type": f"c-{i}", "label": t} for i, t in enumerate(["Necesito descansar", "Prefiero no hablar ahora", "Necesito ayuda para moverme", "Quiero estar sola un rato", "Tengo frío", "¿Puedes traerme mis cosas?"])]
    share = {**DEFAULT_PERMS}
    await db.users.update_one({"id": S}, {"$unset": {"plan": ""}, "$set": {
        **common, "name": "Sofía Méndez", "preferred_name": "Sofía", "role": "patient", "roles": ["patient"], "created_at": ts(d(8, 27), "10:15"),
        "settings": {**base_settings, "custom_signals": custom, "signal_favorites": ["c-0", "c-1", "compania", "c-2", "c-3", "c-4", "c-5"],
                     "style": {"colors": ["Salvia", "Lavanda", "Arena"], "textures": ["Algodón", "Punto suave", "Ligero"], "accessories": ["Pañuelos", "Aretes", "Lentes"], "styles": ["Minimalista", "Clásico"]}},
        "profile": {
            "about": {"age": 43, "city": "Ciudad de México, México", "occupation": "Diseñadora gráfica independiente", "family": "Casada, madre de dos hijos"},
            "treatment": {"types": ["Quimioterapia"], "flags": [], "status": "En curso", "center": HOSP, "frequency": "Cada 21 días (fechas ilustrativas)"},
            "tastes": {"activities": ["Leer", "Escuchar música", "Tejer", "Dibujar", "Ver películas o series", "Escribir", "Caminar", "Pasar tiempo con mi familia"],
                       "objects": ["Audífonos", "Libro", "Cobija", "Cuaderno", "Gorro o pañoleta"], "comfort": ["Ropa suave", "Música", "Calidez", "Silencio", "Compañía"],
                       "colors": ["Verdes", "Lavanda", "Azules", "Neutros"], "styles": ["Minimalista", "Clásico"], "dislikes": ["Aromas fuertes", "Texturas ásperas"]},
            "identity": {"explore": "Sí", "accessories": ["Pañuelos", "Aretes", "Lentes"], "styles": ["Minimalista", "Clásico"], "comfort": ["Telas suaves", "Ligero", "Fácil de poner"], "avoid": ["Aromas fuertes"]},
            "kit_prefs": {"budget": 0},
            "needs": {"support": ["Traslados", "Comidas", "Trámites", "Compañía en citas", "Organizar papeles"], "ask": ["Señales rápidas", "Mensajes"], "note": "Me gusta conservar mi independencia y pedir ayuda cuando la necesito."},
            "privacy": {"share": share},
            "avatar": {"skin": "#F1C9A0", "face": "Ovalado", "eyes": "Tranquilos", "brows": "Suaves", "mouth": "Sonrisa", "hair": "Corto", "hairColor": "#5A3825", "headwear": "Ninguno", "headColor": "#D4C2F4",
                       "glasses": "Redondos", "accessory": "Aretes", "clothes": "Cuello redondo", "clothColor": "#A8DDB5", "bg": "#F0E8FD", "bgShape": "Pétalo"},
            "reco": {"topics": ["feelings", "rest"]}}}})
    care = {
        "diego": ({"who": "Mi pareja", "mode": "Soy su acompañante principal", "duties": ["Acompañar a tratamientos", "Coordinar traslados", "Organizar citas", "Administrar gastos", "Organizar documentos", "Dar seguimiento a seguros y reembolsos"],
                   "hard": ["Coordinar mis actividades personales", "Realizar trámites", "Encontrar tiempo para mí"], "organize": ["Calendarios", "Recordatorios", "Resúmenes semanales", "Tareas compartidas"],
                   "at_hand": ["Próximas citas", "Traslados", "Gastos", "Seguros y reembolsos", "Señales rápidas del paciente"], "availability": {"when": ["Por las mañanas", "Fines de semana"], "slots": [{"days": ["Jue"], "date": "", "start": "07:00", "end": "15:00"}]},
                   "goals": ["Tener mayor claridad sobre los pendientes", "Distribuir responsabilidades", "Encontrar tiempo para descansar"], "interests": ["Caminar o hacer ejercicio", "Cocinar", "Ver películas o series"]},
                  {"skin": "#E0AC69", "face": "Cuadrado", "eyes": "Sonrientes", "brows": "Rectas", "mouth": "Sonrisa", "hair": "Corto", "hairColor": "#2B2B2B", "headwear": "Ninguno", "headColor": "#B9DDF7", "glasses": "Sin lentes",
                   "accessory": "Vello facial", "clothes": "Cuello V", "clothColor": "#AFCBF0", "bg": "#E6F3FD", "bgShape": "Nube"}),
        "laura": ({"who": "Mi hermano/a", "mode": "Comparto responsabilidades con otras personas", "duties": ["Preparar alimentos", "Preparar objetos para el hospital", "Brindar compañía y apoyo emocional"], "hard": ["Coordinar mis actividades personales"],
                   "organize": ["Listas de pendientes", "Listas de preparación"], "at_hand": ["Pendientes", "Necesidades del paciente"], "availability": {"when": ["Por las tardes", "Fines de semana"], "slots": []},
                   "goals": ["Tener una mejor organización"], "interests": ["Manualidades o arte", "Cocinar"]},
                  {"skin": "#F1C9A0", "face": "Redondo", "eyes": "Abiertos", "brows": "Arqueadas", "mouth": "Sonrisa", "hair": "Melena", "hairColor": "#5A3825", "headwear": "Ninguno", "headColor": "#FFC5AB", "glasses": "Sin lentes",
                   "accessory": "Aretes", "clothes": "Sudadera", "clothColor": "#FFC5AB", "bg": "#FFE9DF", "bgShape": "Destello"}),
        "mariana": ({"who": "Un amigo/a", "mode": "Acompaño en determinados días o actividades", "duties": ["Brindar compañía y apoyo emocional", "Realizar compras"], "hard": [], "organize": ["Recordatorios"],
                     "at_hand": ["Señales rápidas del paciente"], "availability": {"when": ["Fines de semana"], "slots": []}, "goals": ["Comunicarme mejor con la persona que acompaño"], "interests": ["Leer", "Ver a mis amistades"]},
                    {"skin": "#C68642", "face": "Ovalado", "eyes": "Sonrientes", "brows": "Suaves", "mouth": "Abierta", "hair": "Rizado", "hairColor": "#2B2B2B", "headwear": "Ninguno", "headColor": "#FFE49B", "glasses": "Cuadrados",
                     "accessory": "Collar", "clothes": "Cuello redondo", "clothColor": "#F3DA83", "bg": "#FFF4CF", "bgShape": "Arco"}),
    }
    for k, (cg, avatar) in care.items():
        email, name, pref, role, _ = PEOPLE[k]
        await db.users.update_one({"id": ids[k]}, {"$unset": {"plan": ""}, "$set": {**common, "name": name, "preferred_name": pref, "role": "caregiver", "roles": ["caregiver"], "settings": base_settings,
                                                                                     "created_at": ts(d(8, 30) if k == "diego" else d(9, 6)), "profile": {"caregiver": cg, "avatar": avatar}}})

    # ---------------------------------------------------------------- network and permissions (different for each person)
    perms = {"diego": ({**DEFAULT_PERMS, "events": True, "tasks": True, "transfers": True, "expenses": True, "treatments": True, "medications": True, "journal": False, "edit": True, "signals": True, "preferences": True},
                       {"view": True, "add": True, "edit": False, "coverages": True, "docs": True, "attach": True, "claims": True, "reports": False}),
             "laura": ({**DEFAULT_PERMS, "events": True, "tasks": True, "transfers": False, "expenses": False, "treatments": False, "medications": False, "journal": False, "edit": True, "signals": True, "preferences": True}, {}),
             "mariana": ({**DEFAULT_PERMS, "events": True, "tasks": True, "transfers": False, "expenses": False, "treatments": False, "medications": False, "journal": False, "edit": False, "signals": True, "preferences": False}, {})}
    for k, (p, fin) in perms.items():
        await db.links.insert_one({"id": uid(), "patient_id": S, "caregiver_id": ids[k], "caregiver_email": PEOPLE[k][0], "relation": PEOPLE[k][4], "status": "active", "permissions": p, "finance": fin,
                                   "created_at": ts(d(8, 30) if k == "diego" else d(9, 6))})

    recs: list[dict] = []

    def rec(kind: str, owner: str = S, created: str = "", share: tuple = (), **data) -> dict:
        r = {"id": uid(), "kind": kind, "owner_id": owner, "created_by": owner, "created_at": created or ts(data.get("date") or data.get("start_date") or d(8, 27), "07:00"), "shared_with": [ids[x] for x in share], **data}
        recs.append(r)
        return r

    # ---------------------------------------------------------------- treatment and its sessions
    tr = rec("treatments", name="Quimioterapia intravenosa ambulatoria", treatment_type="Quimioterapia", status="En curso", date=d(9, 10), frequency="Cada 21 días · fechas ilustrativas", cycle_current="4", cycles_total="6",
             next_session=d(12, 3), center=HOSP, share=("diego",), created=ts(d(8, 28), "18:00"),
             notes="Cuatro de seis ciclos realizados. Ciclo 5 programado para el 3 de diciembre; ciclo 6 el 24 de diciembre, sujeto a confirmación. "
                   "Hay una consulta pendiente para revisar los siguientes pasos; todavía no hay otros tratamientos programados. Fechas de demostración: no representan un protocolo médico.")
    cycles = [(d(9, 10), "Primer ciclo. Diego me acompañó; llevé mi cobija y audífonos."), (d(10, 1), "Segundo ciclo. Preferí descansar y escuchar música al volver."),
              (d(10, 22), "Tercer ciclo. Laura preparó la comida de la semana."), (d(11, 12), "Cuarto ciclo. Llevé mi kit para el hospital; me sentí acompañada."),
              (d(12, 3), "Programado. Salimos a las 07:30 con Diego."), (d(12, 24), "Programado, sujeto a confirmación del equipo médico.")]
    sess = {}
    for i, (day, note) in enumerate(cycles, 1):
        sess[i] = rec("events", title=f"Sesión de quimioterapia, ciclo {i} de 6", type="Sesión de tratamiento", date=day, time="09:00", location=HOSP, notes=note, treatment_id=tr["id"], series_id=f"demo-{tr['id'][:8]}",
                      series_index=i, history=[], share=("diego",), created=ts(d(8, 28), "18:00"))

    # ---------------------------------------------------------------- agenda: history and future
    C, E, P, O = "Cita médica", "Estudio", "Actividad personal", "Otro"
    events = [
        (d(8, 28), "10:00", "Consulta inicial de oncología", C, HOSP, "Primera consulta. Anoté mis dudas en la libreta.", ("diego",)),
        (d(9, 1), "08:00", "Estudios previos al tratamiento", E, LAB, "", ("diego",)), (d(9, 3), "09:30", "Estudio de imagen previo", E, HOSP, "", ("diego",)),
        (d(9, 5), "11:00", "Caminata con Diego y los niños", P, "Parque", "", ()), (d(9, 7), "09:00", "Colocación de acceso venoso", O, HOSP, "Evento histórico ficticio de la demostración.", ("diego",)),
        (d(9, 9), "08:00", "Análisis de sangre previo al ciclo 1", E, LAB, "", ("diego",)), (d(9, 11), "16:00", "Descanso en casa", P, "Casa", "Periodo personal de descanso.", ()),
        (d(9, 15), "12:00", "Consulta de nutrición", C, "Consultorio de demostración", "", ()), (d(9, 18), "17:00", "Tarde de tejido con Laura", P, "Casa", "", ("laura",)),
        (d(9, 22), "11:00", "Consulta de seguimiento", C, HOSP, "", ("diego",)), (d(9, 25), "10:00", "Entrega de proyecto de diseño", P, "Estudio en casa", "", ()),
        (d(9, 29), "08:00", "Análisis de sangre previo al ciclo 2", E, LAB, "", ("diego", "laura")), (d(10, 2), "16:00", "Descanso en casa", P, "Casa", "Periodo personal de descanso.", ()),
        (d(10, 6), "12:30", "Llamada con la aseguradora", O, "", "Aclaré dudas sobre documentos.", ("diego",)), (d(10, 8), "18:00", "Película en familia", P, "Casa", "", ()),
        (d(10, 13), "11:00", "Consulta de seguimiento", C, HOSP, "", ("diego",)), (d(10, 15), "12:00", "Consulta de nutrición", C, "Consultorio de demostración", "", ()),
        (d(10, 17), "11:00", "Visita de Mariana", P, "Casa", "", ("mariana",)), (d(10, 20), "08:00", "Análisis de sangre previo al ciclo 3", E, LAB, "", ("diego", "laura")),
        (d(10, 23), "16:00", "Descanso en casa", P, "Casa", "Periodo personal de descanso.", ()), (d(10, 26), "10:00", "Festival escolar de los niños", P, "Escuela", "", ()),
        (d(10, 30), "11:00", "Consulta de seguimiento", C, HOSP, "", ("diego",)), (d(11, 2), "18:00", "Cena familiar", P, "Casa", "", ()),
        (d(11, 3), "10:00", "Consulta de oncología", C, HOSP, "", ("diego",)), (d(11, 6), "09:00", "Estudio de control", E, HOSP, "", ("diego",)),
        (d(11, 7), "11:00", "Taller de dibujo en línea", P, "Casa", "", ()), (d(11, 10), "08:00", "Estudios de laboratorio previos al ciclo 4", E, LAB, "", ("diego", "laura")),
        (d(11, 13), "16:00", "Descanso en casa", P, "Casa", "Periodo personal de descanso.", ()), (d(11, 14), "17:00", "Tarde de música en casa", P, "Casa", "", ()),
        (d(11, 17), "12:00", "Consulta de nutrición", C, "Consultorio de demostración", "", ()), (d(11, 19), "17:00", "Tejer con Laura", P, "Casa", "", ("laura",)),
        (d(11, 20), "10:00", "Consulta de apoyo psicológico", C, "Consultorio de demostración", "", ()), (d(11, 22), "13:00", "Comida familiar de domingo", P, "Casa", "", ("laura",)),
        (d(11, 24), "11:00", "Consulta de seguimiento", C, HOSP, "", ("diego",)), (d(11, 25), "08:30", "Estudios complementarios", E, HOSP, "", ("diego",)),
        (d(11, 26), "17:00", "Café con Mariana", P, "Cafetería del barrio", "", ("mariana",)),
        # today
        (d(11, 27), "12:30", "Llamada con el área administrativa del hospital", O, "", "Preguntar por la factura del ciclo 4.", ("diego",)), (d(11, 27), "16:00", "Tiempo personal para leer", P, "Casa", "", ()),
        # next week
        (d(11, 30), "08:00", "Análisis de sangre", E, LAB, "Previo al ciclo 5.", ("diego",)), (d(12, 1), "11:00", "Consulta de seguimiento con oncología", C, HOSP, "", ("diego",)),
        (d(12, 2), "12:00", "Consulta de nutrición", C, "Consultorio de demostración", "", ()), (d(12, 3), "16:00", "Tiempo reservado para descansar en casa", P, "Casa", "", ()),
        (d(12, 4), "14:00", "Comida organizada por Laura", P, "Casa", "", ("laura",)), (d(12, 5), "11:00", "Tiempo personal para leer o tejer", P, "Casa", "", ()),
        # rest of December
        (d(12, 8), "11:00", "Consulta de seguimiento", C, HOSP, "", ("diego",)), (d(12, 9), "17:00", "Revisión de documentación del seguro", O, "Casa", "", ("diego",)),
        (d(12, 10), "12:00", "Consulta de nutrición", C, "Consultorio de demostración", "", ()), (d(12, 12), "11:00", "Posada escolar de los niños", P, "Escuela", "", ()),
        (d(12, 14), "10:00", "Consulta de apoyo psicológico", C, "Consultorio de demostración", "", ()), (d(12, 19), "13:00", "Comida familiar", P, "Casa", "", ("laura", "mariana")),
        (d(12, 21), "08:00", "Análisis de sangre previo al ciclo 6", E, LAB, "", ("diego",)),
        (d(12, 22), "11:00", "Consulta para revisar los siguientes pasos", C, HOSP, "Pendiente de confirmar. Aún no hay otros tratamientos programados ni autorizados.", ("diego",)),
        (d(12, 27), "11:00", "Tiempo personal para dibujar", P, "Casa", "", ()),
    ]
    ev = {}
    for day, tm, title, typ, loc, notes, sh in events:
        ev[(day, title)] = rec("events", title=title, type=typ, date=day, time=tm, location=loc, notes=notes, share=sh)

    # ---------------------------------------------------------------- transfers
    for day, tm, title, o, dest, mode, driver, conf, notes, eid in [
        (d(9, 10), "07:30", "Ida a sesión, ciclo 1", "Casa", HOSP, "Acompañante lleva", "Diego", True, "", sess[1]["id"]), (d(9, 10), "14:30", "Regreso de sesión, ciclo 1", HOSP, "Casa", "Acompañante lleva", "Diego", True, "", sess[1]["id"]),
        (d(9, 29), "07:20", "Casa a laboratorio", "Casa", LAB, "Taxi o app", "Laura", True, "Costo registrado en Gastos: $180.", ""), (d(10, 1), "07:30", "Ida a sesión, ciclo 2", "Casa", HOSP, "Acompañante lleva", "Diego", True, "", sess[2]["id"]),
        (d(10, 15), "11:15", "Traslado a consulta de nutrición", "Casa", "Consultorio de demostración", "Auto propio", "Sofía", True, "", ""), (d(10, 22), "07:30", "Ida a sesión, ciclo 3", "Casa", HOSP, "Acompañante lleva", "Diego", True, "", sess[3]["id"]),
        (d(11, 10), "07:15", "Casa a laboratorio", "Casa", LAB, "Taxi o app", "Laura", True, "Costo registrado en Gastos: $220.", ""), (d(11, 12), "07:30", "Ida a sesión, ciclo 4", "Casa", HOSP, "Acompañante lleva", "Diego", True, "", sess[4]["id"]),
        (d(11, 12), "14:45", "Regreso de sesión, ciclo 4", HOSP, "Casa", "Taxi o app", "Diego", True, "Costo registrado en Gastos: $280.", sess[4]["id"]), (d(11, 25), "07:45", "Traslado al hospital", "Casa", HOSP, "Taxi o app", "Diego", True, "Costo registrado en Gastos: $240.", ""),
        (d(11, 26), "10:00", "Recogida de documentos", "Casa", HOSP, "Acompañante lleva", "Diego", True, "", ""),
        (d(11, 30), "07:20", "Casa a laboratorio", "Casa", LAB, "Acompañante lleva", "Laura", False, "Por confirmar con Laura.", ""),
        (d(12, 3), "07:30", "Traslado al hospital con Diego", "Casa", HOSP, "Acompañante lleva", "Diego", True, "Automóvil particular. Vinculado con la sesión de las 09:00 (ciclo 5).", sess[5]["id"]),
        (d(12, 3), "14:30", "Regreso a casa", HOSP, "Casa", "Acompañante lleva", "Diego", True, "", sess[5]["id"]), (d(12, 24), "07:30", "Traslado al hospital, ciclo 6", "Casa", HOSP, "Acompañante lleva", "Diego", False, "Sujeto a confirmación de la sesión.", sess[6]["id"]),
    ]:
        rec("transfers", title=title, date=day, time=tm, origin=o, destination=dest, mode=mode, driver=driver, confirmed=conf, notes=notes, event_id=eid, share=("diego",) + (("laura",) if driver == "Laura" else ()))

    # ---------------------------------------------------------------- tasks
    def task(title, day, who="", done=False, tm="", notes=""):
        k = {"Diego": "diego", "Laura": "laura", "Mariana": "mariana"}.get(who)
        return rec("tasks", title=title, date=day, time=tm, done=done, notes=notes, assignee_id=ids[k] if k else None, share=(k,) if k else (), **({"updated_at": ts(day, "19:00")} if done else {}))

    task("Desayuno y rutina personal", d(11, 27), done=True, tm="08:30")
    task("Revisar resultados de estudios registrados", d(11, 27), done=True, tm="10:00")
    task("Revisar documentación pendiente del seguro", d(11, 27), tm="18:00")
    task("Registro opcional de bienestar", d(11, 27), tm="20:00")
    task("Revisar documentos para reembolso", d(11, 30), tm="17:00")
    task("Preparar preguntas para oncología", d(12, 1), tm="18:00")
    task("Preparar kit para el hospital", d(12, 2), tm="19:00", notes="Estado: en preparación. Incluye documentos para el tratamiento.")
    task("Registro de bienestar", d(12, 4), tm="10:00")
    task("Organizar la próxima semana", d(12, 6), tm="18:00")
    task("Solicitar resultados de laboratorio", d(11, 23), done=True)
    task("Recoger documentación del hospital", d(11, 25), "Diego", True)
    task("Organizar comida del viernes", d(12, 4), "Laura", notes="Estado: en preparación.")
    task("Confirmar traslado del próximo ciclo", d(11, 26), "Diego", True)
    task("Revisar factura para reembolso", d(11, 30), "Diego")
    task("Descargar estudios recientes", d(11, 28))
    task("Organizar visita del fin de semana", d(12, 5), "Mariana", notes="Estado: por confirmar.")
    task("Recoger un documento administrativo", d(12, 1), notes="Sin asignar todavía.")
    for title, day, who, done in [
        ("Agendar estudios previos", d(8, 29), "", True), ("Comprar libreta para citas", d(9, 2), "Mariana", True), ("Avisar a clientes sobre mis tiempos", d(9, 4), "", True), ("Preparar maleta para ciclo 1", d(9, 9), "Laura", True),
        ("Organizar carpeta de documentos", d(9, 14), "Diego", True), ("Pedir cita de nutrición", d(9, 12), "", True), ("Comprar pañuelos de colores", d(9, 20), "Mariana", True), ("Enviar factura al seguro (ciclo 1)", d(9, 24), "Diego", True),
        ("Preparar comidas de la semana", d(10, 2), "Laura", True), ("Renovar receta en farmacia", d(10, 5), "", False), ("Llevar a los niños a la escuela", d(10, 22), "Laura", True), ("Enviar factura al seguro (ciclo 2)", d(10, 9), "Diego", True),
        ("Ordenar estudio de trabajo", d(10, 18), "", False), ("Agendar apoyo psicológico", d(10, 28), "", True), ("Confirmar análisis del 10 de noviembre", d(11, 5), "", True), ("Enviar factura al seguro (ciclo 3)", d(11, 4), "Diego", True),
        ("Comprar estambre lila", d(11, 8), "Mariana", True), ("Preparar kit para ciclo 4", d(11, 11), "", True), ("Preparar comidas de la semana", d(11, 13), "Laura", True), ("Pedir factura del ciclo 4", d(11, 16), "Diego", True),
        ("Actualizar lista de medicamentos registrados", d(11, 18), "", True), ("Anotar dudas para nutrición", d(11, 16), "", True), ("Reprogramar entrega de proyecto", d(11, 20), "", True), ("Devolver libros a la biblioteca", d(11, 21), "Mariana", False),
        ("Ordenar comprobantes de noviembre", d(11, 22), "", False), ("Comprar té para las tardes", d(11, 15), "Laura", True),
    ]:
        task(title, day, who, done)

    # ---------------------------------------------------------------- medications (simulated schedules) and marked doses
    usual = rec("medications", name="Medicamento de uso habitual", dose="Según la indicación original", times=["08:00"], schedule="", start_date=d(9, 1), prescribed_by="Equipo médico (demostración)", notes=SIM, share=("diego",))
    support = rec("medications", name="Medicamento de apoyo indicado por el equipo médico", dose="Según la indicación original", times=["21:00"], schedule="", start_date=d(10, 1), prescribed_by="Equipo médico (demostración)", notes=SIM, share=("diego",))
    nausea = rec("medications", name="Medicamento de apoyo para náuseas", dose="Según la indicación original", times=["08:00", "20:00"], schedule="", start_date=d(11, 12), end_date=d(11, 15), prescribed_by="Equipo médico (demostración)",
                 notes=f"Registro histórico del ciclo 4. {SIM}", share=("diego",))
    rec("medications", name="Medicamento de apoyo para náuseas (ciclo 3)", dose="Según la indicación original", times=["08:00", "20:00"], schedule="", start_date=d(10, 22), end_date=d(10, 25), prescribed_by="Equipo médico (demostración)",
        notes=f"Registro histórico. {SIM}")
    rec("medications", name="Medicamento de uso condicionado a indicaciones profesionales", dose="", schedule="", prescribed_by="", created=ts(d(11, 24), "13:00"),
        notes="Pendiente de completar: falta confirmar días, horarios e indicación original con el equipo médico.")
    doses = []
    for n in range(90):
        day = (REF - timedelta(days=n)).isoformat()
        if day >= d(9, 1) and n % 5 != 3:  # some days are simply not marked
            doses.append((usual["id"], day, "08:00"))
        if day >= d(10, 1) and n % 3 != 1 and n > 0:
            doses.append((support["id"], day, "21:00"))
    doses += [(nausea["id"], d(11, dd), t) for dd, t in [(12, "20:00"), (13, "08:00"), (13, "20:00"), (14, "08:00"), (15, "08:00"), (15, "20:00")]]
    await db.doses.insert_many([{"med_id": m, "date": day, "time": t, "owner_id": S, "status": "realizado", "by": S, "at": ts(day, t)} for m, day, t in doses])

    # ---------------------------------------------------------------- wellbeing journal: 55 days in 90, 23 of them in the last 30
    post = {d(9, 10), d(9, 11), d(9, 12), d(10, 1), d(10, 2), d(10, 3), d(10, 22), d(10, 23), d(10, 24), d(11, 12), d(11, 13), d(11, 14)}
    sets = [["En calma"], ["Con energía", "Motivada"], ["Cansado/a"], ["En calma", "Acompañada"], ["Preocupado/a"], ["Con energía"], ["Cansado/a", "Con frío"], ["En calma", "Con energía"], ["Sensible"], ["Motivada"],
            ["Con sueño", "Dificultad para dormir"], ["En calma"], ["Con energía", "Acompañada"], ["Poco apetito"], ["En calma", "Motivada"]]
    after = [["Cansado/a", "Con ganas de descansar"], ["Con náuseas", "Sensible a olores"], ["Cansado/a", "Poco apetito", "Acompañada"]]
    notes = {d(9, 5): "Caminamos un rato en familia y me sentí con buen ánimo.", d(9, 11): "Después del tratamiento preferí descansar y escuchar música.", d(9, 18): "Estuve un rato tejiendo con mi hermana.",
             d(9, 25): "Hoy tuve bastante energía y pude trabajar un rato.", d(10, 1): "Me sentí acompañada porque Diego estuvo conmigo.", d(10, 8): "Vimos una película los cuatro. Fue una buena tarde.",
             d(10, 17): "Mariana vino a verme y nos reímos mucho.", d(10, 24): "Hoy tuve poco apetito y quiero comentarlo en mi próxima consulta.", d(11, 2): "Me gustó volver a usar mis pañuelos de colores.",
             d(11, 7): "Dibujé toda la mañana. Se me pasó el tiempo.", d(11, 13): "Día de descanso. Música bajita y mi cobija.", d(11, 19): "Estuve un rato tejiendo con mi hermana.",
             d(11, 23): "Hoy tuve bastante energía y pude trabajar un rato.", d(11, 26): "Me tranquilizó tener organizados los documentos del siguiente ciclo.",
             d(11, 27): "Un poco cansada pero tranquila. Con ganas de escuchar música."}
    skip_recent = {2, 6, 9, 15, 19, 23, 27}  # days ago without any entry
    logged = [n for n in range(30) if n not in skip_recent] + [n for n in range(30, 90) if (n * 7) % 15 < 8]
    logged = logged[:23] + [n for n in logged[23:] if (REF - timedelta(days=n)).isoformat() not in notes][:32 - sum(1 for x in notes if x < d(10, 29))] + [n for n in range(30, 90) if (REF - timedelta(days=n)).isoformat() in notes]
    for n in sorted(set(logged)):
        day = (REF - timedelta(days=n)).isoformat()
        moods = ["Cansado/a", "En calma", "Con frío", "Con ganas de escuchar música"] if n == 0 else after[n % 3] if day in post else sets[n % len(sets)]
        rec("journal", date=day, moods=moods, mood=moods[0], mood_note=notes.get(day, ""), energy="Con energía" if "Con energía" in moods else "Cansancio" if "Cansado/a" in moods else "Normal", created=ts(day, "20:10"), updated_at=ts(day, "20:10"))

    # ---------------------------------------------------------------- coverage, expenses, claims and demo documents
    cov = {"id": uid(), "owner_id": S, "created_at": ts(d(8, 31)), "deleted_at": None, "type": "Seguro de Gastos Médicos Mayores", "name": "Cobertura Demo Integral", "archived": False, "updated_at": ts(d(11, 20)), "updated_by": "Sofía",
           "data": {"insurer": "Aseguradora Demo (ficticia)", "plan": "Cobertura Demo Integral", "policy_number": "DEMO-2026-001", "insured": "Sofía Méndez", "holder": "Diego Méndez", "valid_from": d(1, 1), "valid_until": d(12, 31),
                    "policy_type": "Familiar", "deductible": "$15,000 MXN (ilustrativo)", "coinsurance": "10% (ilustrativo)", "currency": "MXN", "conditions": "Datos de demostración. AMODO no calcula prestaciones a partir de estos valores.",
                    "agent": "Agente de demostración", "phone": "Centro de atención ficticio", "refund_contact": "Área de reembolsos (demostración)", "network": HOSP}}
    await db.coverages.insert_one(cov)
    await db.coverages.insert_one({"id": uid(), "owner_id": S, "created_at": ts(d(9, 2)), "deleted_at": None, "type": "Atención particular con recursos propios", "name": "Recursos propios y apoyo familiar", "archived": False,
                                   "updated_at": ts(d(9, 2)), "updated_by": "Sofía", "data": {"notes": "Para traslados, alimentación y cuidado personal."}})
    sofia = {**u["sofia"], "preferred_name": "Sofía", "name": "Sofía Méndez"}
    src = [{"coverage_id": cov["id"], "label": "Cobertura Demo Integral", "mode": "Pago mío con solicitud de reembolso"}]
    docs: list[tuple[dict, str, str]] = []

    def claim(status, requested, authorized=0, deposits=(), filed="", expected="", checklist=(), notes="", steps=()):
        return {"coverage_id": cov["id"], "policy": "DEMO-2026-001", "claim_no": "SIN-DEMO-0427", "folio": "", "method": "Reembolso", "owner_name": "Sofía Méndez", "notes": notes, "filed_date": filed, "expected_date": expected,
                "requested": requested, "authorized": authorized, "deposits": [{"amount": a, "date": day, "method": "Transferencia"} for a, day in deposits], "status": status,
                "checklist": [{"label": lbl, "status": st} for lbl, st in checklist], "_steps": steps}

    def expense(title, day, amount, cat, by="Sofía", method="Tarjeta", paid=True, cl=None, notes="", due="", eid="", doc=""):
        body = {"title": title, "date": day, "amount": amount, "category": cat, "paid_by": by, "notes": notes, "due_date": due, "event_id": eid, "provider": HOSP if cat in ("Tratamientos", "Consultas médicas", "Estudios de imagen") else "",
                "payments": [{"amount": amount, "date": day, "method": method, "by": by, "source": "own"}] if paid else [], "sources": src if cl else [], **({"claim": {k: v for k, v in cl.items() if k != "_steps"}} if cl else {})}
        e = {"id": uid(), "kind": "expenses", "owner_id": S, "created_by": S, "created_by_name": "Sofía", "created_at": ts(day, "19:30"), "currency": "MXN", "payments": [], "shared_with": [D], **_expense(body, None, sofia)}
        if cl:
            e["claim"]["history"] = [{"status": st, "date": sd, "by": "Sofía", "at": ts(sd)} for st, sd in cl["_steps"]]
        recs.append(e)
        if doc:
            docs.append((e, doc, f"{doc} · {title}"))
        return e

    full = [("Factura", "Entregado"), ("Informe médico", "Entregado"), ("Formato de reembolso", "Entregado"), ("Estado de cuenta", "Entregado")]
    T, CM, MED, LABC, TRAS = "Tratamientos", "Consultas médicas", "Medicamentos", "Estudios de laboratorio", "Traslados"
    NOEL = "No elegible para reembolso."
    # September and October
    expense("Consulta inicial de oncología", d(8, 28), 1500, CM, cl=claim("Trámite cerrado", 1500, 0, (), d(9, 2), "", full, "Aplicado al deducible (dato ilustrativo).", [("Solicitud presentada", d(9, 2)), ("Trámite cerrado", d(9, 18))]), doc="Factura")
    expense("Estudios previos al tratamiento", d(9, 1), 3200, LABC, cl=claim("Trámite cerrado", 3200, 0, (), d(9, 4), "", full, "Aplicado al deducible (dato ilustrativo).", [("Solicitud presentada", d(9, 4)), ("Trámite cerrado", d(9, 18))]))
    expense("Estudio de imagen previo", d(9, 3), 4800, "Estudios de imagen", by="Diego")
    expense("Colocación de acceso venoso", d(9, 7), 9500, "Material médico", by="Diego", method="Transferencia")
    expense("Sesión de tratamiento, ciclo 1", d(9, 10), 18500, T, eid=sess[1]["id"], cl=claim("Reembolso recibido", 18500, 9000, [(9000, d(10, 5))], d(9, 14), "", full, "Parte aplicada al deducible (dato ilustrativo).",
            [("Solicitud presentada", d(9, 14)), ("En revisión", d(9, 20)), ("Autorizado parcialmente", d(9, 30)), ("Reembolso recibido", d(10, 5))]), doc="Factura")
    expense("Estacionamiento", d(9, 10), 100, "Estacionamiento", by="Diego", method="Efectivo", notes=NOEL)
    expense("Medicamentos de apoyo", d(9, 11), 720, MED)
    expense("Consulta de nutrición", d(9, 15), 850, CM)
    expense("Taxi a laboratorio", d(9, 29), 180, TRAS, by="Laura", method="Efectivo", notes=NOEL)
    expense("Análisis de sangre", d(9, 29), 1850, LABC)
    expense("Sesión de tratamiento, ciclo 2", d(10, 1), 18500, T, eid=sess[2]["id"], cl=claim("Reembolso recibido", 18500, 14000, [(14000, d(10, 26))], d(10, 5), "", full, "", [("Solicitud presentada", d(10, 5)), ("En revisión", d(10, 12)), ("Autorizado", d(10, 20)), ("Reembolso recibido", d(10, 26))]))
    expense("Estacionamiento", d(10, 1), 100, "Estacionamiento", by="Diego", method="Efectivo", notes=NOEL)
    expense("Medicamentos de apoyo", d(10, 2), 760, MED)
    expense("Consulta de seguimiento", d(10, 13), 1500, CM)
    expense("Consulta de nutrición", d(10, 15), 850, CM)
    expense("Análisis de sangre", d(10, 20), 1850, LABC)
    expense("Sesión de tratamiento, ciclo 3", d(10, 22), 18500, T, eid=sess[3]["id"], cl=claim("Reembolso recibido", 18500, 14000, [(8000, d(11, 9)), (6000, d(11, 18))], d(10, 26), "", full, "Recibido en dos depósitos.",
            [("Solicitud presentada", d(10, 26)), ("En revisión", d(11, 2)), ("Autorizado", d(11, 6)), ("Reembolso recibido parcialmente", d(11, 9)), ("Reembolso recibido", d(11, 18))]))
    expense("Estacionamiento", d(10, 22), 100, "Estacionamiento", by="Diego", method="Efectivo", notes=NOEL)
    expense("Productos de cuidado personal", d(10, 27), 380, "Cuidado personal", notes=NOEL)
    # November (the 13 movements of the brief: $28,720)
    expense("Consulta de oncología", d(11, 3), 1500, CM, eid=ev[(d(11, 3), "Consulta de oncología")]["id"], cl=claim("Documentación incompleta", 1500, 0, (), "", "", [("Factura", "Disponible"), ("Informe médico", "Pendiente"), ("Formato de reembolso", "Pendiente")],
            "Falta el informe médico.", [("Pendiente de preparar", d(11, 4)), ("Documentación incompleta", d(11, 20))]), doc="Factura")
    expense("Estudios de laboratorio", d(11, 10), 1850, LABC, cl=claim("Reembolso recibido parcialmente", 1850, 1200, [(1200, d(11, 24))], d(11, 12), "", full, "Reembolso parcial recibido.",
            [("Solicitud presentada", d(11, 12)), ("Autorizado parcialmente", d(11, 20)), ("Reembolso recibido parcialmente", d(11, 24))]), doc="Factura")
    expense("Traslado de ida", d(11, 10), 220, TRAS, by="Laura", method="Efectivo", notes=NOEL)
    expense("Medicamentos de apoyo", d(11, 11), 780, MED, cl=claim("Solicitud presentada", 780, 0, (), d(11, 16), d(12, 14), [("Factura", "Entregado"), ("Receta", "Entregado")], "Solicitud enviada en modo demostración: no se presentó ante ninguna aseguradora.",
            [("Listo para presentar", d(11, 13)), ("Solicitud presentada", d(11, 16))]), doc="Receta")
    expense("Sesión de tratamiento, ciclo 4", d(11, 12), 18500, T, eid=sess[4]["id"], cl=claim("En revisión", 14000, 0, (), d(11, 16), d(12, 10), full, "Reembolso de $14,000 en revisión.", [("Solicitud presentada", d(11, 16)), ("En revisión", d(11, 23))]), doc="Factura")
    expense("Estacionamiento", d(11, 12), 100, "Estacionamiento", by="Diego", method="Efectivo", notes=NOEL)
    expense("Traslado de regreso", d(11, 12), 280, TRAS, by="Diego", method="Efectivo", notes=NOEL)
    expense("Consulta de nutrición", d(11, 17), 850, CM)
    expense("Productos de cuidado personal", d(11, 19), 450, "Cuidado personal", notes=NOEL)
    expense("Consulta de apoyo psicológico", d(11, 20), 900, "Apoyo psicológico")
    expense("Medicamentos registrados", d(11, 23), 650, MED)
    expense("Estudios complementarios", d(11, 25), 2400, "Estudios de imagen", by="Diego", doc="Estudio")
    expense("Traslado al hospital", d(11, 25), 240, TRAS, by="Diego", method="Efectivo", notes=NOEL)
    # pending payments
    expense("Análisis de sangre previo al ciclo 5", d(11, 30), 1850, LABC, paid=False, due=d(11, 30))
    expense("Consulta de seguimiento con oncología", d(12, 1), 1500, CM, paid=False, due=d(12, 1))
    expense("Sesión de tratamiento, ciclo 5", d(12, 3), 18500, T, paid=False, due=d(12, 3), eid=sess[5]["id"], cl=claim("Pendiente de preparar", 0, 0, (), "", "", [("Factura", "Pendiente"), ("Informe médico", "Pendiente"), ("Formato de reembolso", "Disponible")], "", [("Pendiente de preparar", d(11, 26))]))

    # ---------------------------------------------------------------- kits, orders (real pricing rules), favourites and cart
    async def kit(name, size, context, cats, items, note="", created=d(9, 12)):
        k = {"id": uid(), "owner_id": S, "created_at": ts(created), "updated_at": ts(created), "name": name, "context": context, "size": size, "categories": cats, "items": [{"product_id": p, "options": {}} for p in items],
             "for_name": "", "for_user_id": None, "note": note, "shared_with": [L]}
        await db.kits.insert_one(k)
        return k

    k_home = await kit("Mi kit para descansar en casa", "Chico", "Casa", ["Comodidad", "Antojos y preferencias"], ["p21", "p24", "p3", "p2"], "Descanso y comodidad.", d(9, 12))
    k_me = await kit("Un ratito para mí", "Mediano", "Casa", ["Identidad y estilo", "Entretenimiento"], ["p33", "p10", "p11", "p31", "p14", "p29"], "Identidad, actividades creativas y entretenimiento.", d(10, 12))
    k_hosp = await kit("Mi kit para el hospital", "Mediano", "Hospital", ["Comodidad", "Entretenimiento", "Organización"], ["p1", "p4", "p12", "p5", "p3", "p37"], "Comodidad, entretenimiento y organización.", d(11, 18))
    k_next = await kit("Mi próximo tratamiento", "Grande", "Durante el tratamiento", ["Comodidad", "Identidad y estilo", "Organización"], ["p1", "p34", "p14", "p20", "p6", "p17", "p9"],
                       "En proceso de personalización: todavía puedo cambiar artículos.", d(11, 25))
    address = {"recipient": "Sofía Méndez", "phone": "5500000000", "street": "Calle de demostración 27", "city": "Ciudad de México", "zip": "00000", "notes": "Dirección ficticia", "gift_note": "", "shipping": "Estándar"}
    plan = {"tier": "plus", "source": "demo", "since": "2026-09-28T00:30:00+00:00", "until": d(12, 27), "status": "activa", "price": 79, "monthly_credit": 20, "kit_discount_pct": 10}
    orders = []
    for k, day, steps in [(k_home, d(9, 15), 5), (k_me, d(10, 14), 5), (k_hosp, d(11, 21), 4)]:
        if day > d(9, 27):
            await db.users.update_one({"id": S}, {"$set": {"plan": plan}})
        await db.cart.delete_many({"user_id": S})
        await db.cart.insert_one({"id": uid(), "user_id": S, "type": "kit", "ref_id": k["id"], "qty": 1, "options": {}})
        o = await business.place_order(await db.users.find_one({"id": S}), address, "Estándar", 0, f"demo-{day}")
        for st in FLOW[1:steps]:
            await business.set_order_status(await db.orders.find_one({"id": o["id"]}), st)
        o = await db.orders.find_one({"id": o["id"]})
        hist = [{**h, "at": ts((date.fromisoformat(day) + timedelta(days=i * 2)).isoformat(), "11:00")} for i, h in enumerate(o["history"])]
        await db.orders.update_one({"id": o["id"]}, {"$set": {"created_at": ts(day, "11:00"), "history": hist, "number": f"AM-DEMO-{day[5:7]}{day[8:]}", "demo": True}})
        orders.append(await db.orders.find_one({"id": o["id"]}))
        expense(f"Kit AMODO: {k['name']}", day, o["total"], "Kits AMODO", notes=f"Pedido {orders[-1]['number']} (demostración, sin cargo real). {NOEL}")
    await db.users.update_one({"id": S}, {"$set": {"plan": plan}})
    await db.cart.delete_many({"user_id": S})
    await db.cart.insert_one({"id": uid(), "user_id": S, "type": "kit", "ref_id": k_next["id"], "qty": 1, "options": {}})
    await db.favorites.insert_many([{"user_id": S, "product_id": p, "created_at": ts(d(10, 3 + i))} for i, p in enumerate(["p33", "p34", "p14", "p11", "p31", "p1", "p12", "p29"])])
    await db.credit_moves.delete_many({"user_id": S})  # accrual ran while pricing the orders; keep only the three dated deposits
    await db.credit_moves.insert_many([{"id": uid(), "key": f"plus:{S}:2026-{m:02d}", "user_id": S, "source": "plus", "amount": 20, "at": ts(day, "09:00"), "text": f"Crédito mensual AMODO Plus ({name})"}
                                       for m, day, name in [(9, d(9, 27), "septiembre"), (10, d(10, 27), "octubre"), (11, d(11, 27), "noviembre")]])
    await db.subscriptions.insert_one({"id": uid(), "user_id": S, "action": "activada", "price": 79, "at": ts(d(9, 27), "18:30"), "demo": True})
    await db.benefit_history.insert_one({"id": uid(), "user_id": S, "at": ts(d(9, 27), "18:30"), "text": "Activaste AMODO Plus ($79 al mes, demostración sin cargo)."})
    await db.ai_usage.insert_many([{"user_id": S, "month": m, "count": c, "plus": True} for m, c in [("2026-09", 6), ("2026-10", 14), ("2026-11", 11)]])
    await db.plus_marks.insert_many([{"user_id": S, "key": k, "at": ts(d(11, 20))} for k in ("next_week", "style", "cashflow", "doc_ai")])
    await db.process_reports.insert_many([{"id": uid(), "user_id": S, "today": day, "start": start, "end": day, "sections": secs, "include_name": True, "period": per, "created_at": ts(day, "18:00")} for day, start, secs, per in [
        (d(11, 2), d(10, 4), ["feelings", "appointments", "treatments"], "Del 4 de octubre al 2 de noviembre de 2026"), (d(11, 16), d(10, 18), ["feelings", "medications", "notes"], "Del 18 de octubre al 16 de noviembre de 2026"),
        (d(11, 24), d(10, 26), ["feelings", "appointments", "treatments", "expenses", "finance"], "Del 26 de octubre al 24 de noviembre de 2026")]])

    # ---------------------------------------------------------------- write records, then documents that point to them
    await db.records.insert_many(recs)
    for e, cat, name in docs:
        did = uid()
        res = await asyncio.to_thread(put_object, f"{APP_NAME}/private/{S}/{did}.pdf", demo_pdf(name, [f"Concepto: {e['title']}", f"Fecha: {e['date']}", f"Importe ilustrativo: ${e['amount']:,.0f} MXN", "Folio: DEMO-0000"]), "application/pdf")
        await db.finance_docs.insert_one({"id": did, "owner_id": S, "ref_type": "expense", "ref_id": e["id"], "category": cat if cat in ("Factura", "Receta") else "Otros documentos", "name": f"DEMO {cat} - {e['title']}.pdf"[:120],
                                          "mime": "application/pdf", "size": 1, "path": res["path"], "created_by": "Sofía", "created_at": ts(e["date"], "20:00"), "deleted_at": None})
    did = uid()
    res = await asyncio.to_thread(put_object, f"{APP_NAME}/private/{S}/{did}.pdf", demo_pdf("Carátula de póliza (ilustrativa)", ["Cobertura Demo Integral", "Identificador: DEMO-2026-001", "Vigencia: enero a diciembre de 2026"]), "application/pdf")
    await db.finance_docs.insert_one({"id": did, "owner_id": S, "ref_type": "coverage", "ref_id": cov["id"], "category": "Póliza", "name": "DEMO Carátula de póliza.pdf", "mime": "application/pdf", "size": 1, "path": res["path"],
                                      "created_by": "Sofía", "created_at": ts(d(8, 31)), "deleted_at": None})

    # ---------------------------------------------------------------- preparation lists linked to agenda
    def items(rows):
        return [{"id": uid()[:8], "text": t, "done": bool(by), "done_by": by or None} for t, by in rows]

    await db.checklists.insert_many([
        {"id": uid(), "owner_id": S, "title": "Para mi próximo tratamiento", "kind": "tratamiento", "event_id": sess[5]["id"], "date": "", "shared_with": [D, L], "created_at": ts(d(11, 24)), "items": items([
            ("Identificación", "Sofía"), ("Credencial del servicio médico", "Sofía"), ("Estudios recientes", ""), ("Lista de medicamentos registrados", "Sofía"), ("Preguntas para mi equipo médico", ""), ("Teléfono y cargador", "Sofía"),
            ("Kit personal", ""), ("Confirmar acompañante", "Diego"), ("Confirmar traslado", "Diego"), ("Revisar indicaciones originales del hospital", "")])},
        {"id": uid(), "owner_id": S, "title": "Para mi consulta de seguimiento", "kind": "cita", "event_id": ev[(d(12, 1), "Consulta de seguimiento con oncología")]["id"], "date": "", "shared_with": [D], "created_at": ts(d(11, 25)), "items": items([
            ("Identificación", "Sofía"), ("Resultados de laboratorio", ""), ("Lista de medicamentos registrados", "Sofía"), ("Preguntas anotadas", ""), ("Notas de cómo me he sentido", "Sofía"), ("Confirmar quién me acompaña", "Diego"),
            ("Libreta y pluma", ""), ("Estudios complementarios", "")])},
        {"id": uid(), "owner_id": S, "title": "Documentos para reembolso", "kind": "blanco", "event_id": None, "date": d(11, 30), "shared_with": [D], "created_at": ts(d(11, 20)), "items": items([
            ("Factura de la consulta", "Diego"), ("Factura del tratamiento", "Diego"), ("Formato de reembolso", "Sofía"), ("Informe médico", ""), ("Estado de cuenta", ""), ("Copia de identificación", "")])},
        {"id": uid(), "owner_id": S, "title": "Para descansar en casa", "kind": "blanco", "event_id": ev[(d(12, 3), "Tiempo reservado para descansar en casa")]["id"], "date": "", "shared_with": [L], "created_at": ts(d(11, 13)), "items": items([
            ("Cobija a la mano", "Sofía"), ("Lista de música", "Sofía"), ("Té y agua cerca", "Laura"), ("Comida ligera preparada", "Laura"), ("Teléfono cargado", "Sofía")])}])

    # ---------------------------------------------------------------- quick signals: history, some answered by Diego
    def sig(day, hm, typ, label, status, msg="", resp=()):
        return {"id": uid(), "patient_id": S, "patient_name": "Sofía", "type": typ, "label": label, "message": msg, "urgency": "Cuando puedas" if status != "enviada" else "Hoy", "status": status, "recipients": 3, "created_at": ts(day, hm),
                "responses": [{"by": ids[k], "name": PEOPLE[k][2], "text": t, "at": ts(day, f"{hm[:3]}{min(59, int(hm[3:]) + 12):02d}")} for k, t in resp]}

    await db.signals.insert_many([
        sig(d(9, 10), "13:20", "c-0", "Necesito descansar", "resuelta", "", [("diego", "Entendido, aquí estoy")]), sig(d(9, 12), "18:05", "compania", "Necesito compañía", "resuelta", "", [("laura", "Voy para allá")]),
        sig(d(9, 26), "11:40", "c-5", "¿Puedes traerme mis cosas?", "resuelta", "Mi libreta y los audífonos.", [("diego", "Lo resuelvo hoy")]), sig(d(10, 1), "15:10", "c-4", "Tengo frío", "resuelta", "", [("diego", "Voy para allá")]),
        sig(d(10, 3), "10:30", "c-1", "Prefiero no hablar ahora", "resuelta", "", [("mariana", "Entendido, aquí estoy")]), sig(d(10, 17), "17:45", "c-3", "Quiero estar sola un rato", "resuelta"),
        sig(d(10, 22), "14:00", "c-2", "Necesito ayuda para moverme", "resuelta", "", [("diego", "Voy para allá")]), sig(d(10, 24), "19:20", "compania", "Necesito compañía", "resuelta", "", [("laura", "Te llamo en un momento")]),
        sig(d(11, 12), "13:30", "c-4", "Tengo frío", "resuelta", "", [("diego", "Voy para allá")]), sig(d(11, 13), "12:15", "c-0", "Necesito descansar", "atendida", "", [("diego", "Entendido, aquí estoy")]),
        sig(d(11, 21), "18:40", "compania", "Necesito compañía", "atendida", "¿Vemos una película?", [("mariana", "Voy para allá")]), sig(d(11, 27), "13:10", "c-5", "¿Puedes traerme mis cosas?", "enviada", "La carpeta azul del seguro, por favor.")])

    # ---------------------------------------------------------------- Diego's own space
    for day, tm, title in [(d(11, 27), "09:00", "Junta de trabajo"), (d(11, 28), "08:00", "Salir a correr"), (d(12, 2), "17:00", "Llevar a los niños a natación"), (d(12, 5), "10:00", "Desayuno con mi hermano")]:
        await db.records.insert_one({"id": uid(), "kind": "events", "owner_id": D, "created_by": D, "created_at": ts(d(11, 20)), "shared_with": [], "title": title, "type": "Actividad personal", "date": day, "time": tm, "location": "", "notes": ""})
    for title, day in [("Cargar gasolina antes del jueves", d(12, 2)), ("Pedir permiso en el trabajo para el 3 de diciembre", d(11, 30))]:
        await db.records.insert_one({"id": uid(), "kind": "tasks", "owner_id": D, "created_by": D, "created_at": ts(d(11, 25)), "shared_with": [], "title": title, "date": day, "done": False, "notes": ""})
    for n, moods, note in [(0, ["En calma"], "Hoy pude organizar los papeles con calma."), (2, ["Cansado/a"], ""), (5, ["Preocupado/a", "En calma"], "Me ayudó salir a correr."), (9, ["Con energía"], "")]:
        day = (REF - timedelta(days=n)).isoformat()
        await db.records.insert_one({"id": uid(), "kind": "journal", "owner_id": D, "created_by": D, "created_at": ts(day, "21:00"), "shared_with": [], "date": day, "moods": moods, "mood": moods[0], "mood_note": note})

    # ---------------------------------------------------------------- in-app notifications (nothing is sent outside AMODO)
    def note(user, day, hm, title, body, kind, link, read):
        return {"id": uid(), "user_id": user, "title": title, "body": body, "kind": kind, "link": link, "read": read, "created_at": ts(day, hm)}

    await db.notifications.delete_many({"user_id": {"$in": list(ids.values())}})
    await db.notifications.insert_many([
        note(S, d(11, 27), "09:00", "Recibiste tus $20 de créditos Plus", "Ya tienes $60 disponibles para tus kits.", "credit", "/credits", False),
        note(S, d(11, 27), "08:10", "Tienes un análisis de sangre programado para el lunes", "30 de noviembre, 08:00 · Laboratorio de demostración.", "agenda", "/(tabs)/agenda", False),
        note(S, d(11, 26), "19:05", "Diego confirmó tu próximo traslado", "Jueves 3 de diciembre, salida 07:30.", "transfer", "/records/transfers", False),
        note(S, d(11, 26), "12:00", "Tienes una lista de preparación sin terminar", "Para mi próximo tratamiento: 6 de 10 puntos listos.", "checklist", "/checklists", False),
        note(S, d(11, 25), "18:20", "Laura completó un pendiente compartido", "Comprar té para las tardes.", "task", "/records/tasks", True),
        note(S, d(11, 25), "10:00", "Tu pedido se encuentra en camino", f"Pedido {orders[2]['number']} · Mi kit para el hospital.", "order", f"/order/{orders[2]['id']}", True),
        note(S, d(11, 24), "09:00", "Se acerca tu próxima consulta", "Consulta de seguimiento con oncología: martes 1 de diciembre, 11:00.", "agenda", "/(tabs)/agenda", True),
        note(S, d(11, 23), "17:30", "Tienes documentación pendiente de organizar", "Consulta de oncología: falta el informe médico para el reembolso.", "finance", "/finances", True),
        note(S, d(11, 21), "18:55", "Mariana respondió", "Voy para allá", "signal", "/signals", True),
        note(D, d(11, 27), "13:10", "Sofía: ¿Puedes traerme mis cosas?", "La carpeta azul del seguro, por favor.", "signal", "/signals", False),
        note(D, d(11, 26), "09:00", "Sofía te asignó un pendiente", "Revisar factura para reembolso · 30 de noviembre.", "task", "/records/tasks?assigned=me", False),
        note(D, d(11, 25), "20:00", "Sofía compartió una lista contigo", "Documentos para reembolso.", "checklist", "/checklists", True),
        note(D, d(11, 13), "12:15", "Sofía: Necesito descansar", "", "signal", "/signals", True),
        note(L, d(11, 26), "09:00", "Sofía te asignó un pendiente", "Organizar comida del viernes.", "task", "/records/tasks?assigned=me", False),
        note(M, d(11, 26), "09:00", "Sofía te asignó un pendiente", "Organizar visita del fin de semana.", "task", "/records/tasks?assigned=me", False)])
    return {"ids": ids, "records": len(recs)}


# ---------------------------------------------------------------- presenter tools (only for accounts of this demo set)
async def demo_user(user=Depends(current_user)):
    if user.get("demo_set") != SET:
        raise HTTPException(403, "Solo disponible en las cuentas de demostración.")
    return user


@api.get("/demo/people")
async def demo_people(user=Depends(demo_user)):
    out = []
    for k, (email, name, _pref, role, rel) in PEOPLE.items():
        p = await db.users.find_one({"email": email})
        if p:
            out.append({"key": k, "name": name, "role": role, "relation": rel or "Paciente", "current": p["id"] == user["id"], "avatar": (p.get("profile") or {}).get("avatar")})
    return {"people": out, "date": REF.isoformat()}


@api.post("/demo/switch/{key}")
async def demo_switch(key: str, user=Depends(demo_user)):
    if key not in PEOPLE:
        raise HTTPException(404, "Cuenta no encontrada")
    p = await db.users.find_one({"email": PEOPLE[key][0]})
    return {"token": make_token(p["id"]), "user": clean(p)}


@api.post("/demo/reset")
async def demo_reset(user=Depends(demo_user)):
    """Rebuilds the original demo scenario. Only the four demo accounts are touched."""
    r = await seed()
    return {"ok": True, "records": r["records"], "user": clean(await db.users.find_one({"id": user["id"]}))}


async def ensure_demo():
    pw = os.environ.get("DEMO_ACCESS_PASSWORD")
    if pw and not await db.users.find_one({"email": PEOPLE["sofia"][0]}):
        await seed(pw)
