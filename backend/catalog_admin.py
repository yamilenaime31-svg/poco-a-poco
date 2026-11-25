"""Admin catalog tools (prototype): full export (CSV / Excel) with acquisition-cost fields, import of researched costs
with a preview step, and kit profitability across item combinations. Public prices are never changed by an import."""
import csv
import io
import random
import statistics
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from server import api, clean, db

COLUMNS = [
    ("sku", "SKU"), ("name", "Nombre del artículo"), ("category", "Categoría"), ("variant", "Variante"), ("material", "Material"),
    ("presentation", "Dimensiones o presentación"), ("supplier_name", "Proveedor"), ("supplier_url", "Enlace del proveedor"),
    ("min_order", "Cantidad mínima de compra"), ("pack_price", "Precio del paquete al mayoreo"), ("units_per_pack", "Unidades por paquete"),
    ("unit_cost", "Costo unitario"), ("supplier_shipping", "Costo de transporte del proveedor (por paquete)"), ("tax_pct", "Impuestos aplicables (%)"),
    ("final_unit_cost", "Costo unitario final de adquisición"), ("stock", "Inventario"), ("tier", "Clasificación (incluido/premium)"),
    ("supplement", "Suplemento actual"), ("sizes", "Tamaños de kit compatibles"), ("cost_updated_at", "Fecha de actualización"),
    ("price_status", "Estado de verificación del precio"), ("price", "Precio público actual (solo lectura)"),
]
EDITABLE = {"material", "presentation", "supplier_name", "supplier_url", "min_order", "pack_price", "units_per_pack", "unit_cost",
            "supplier_shipping", "tax_pct", "final_unit_cost", "price_status"}
NUMERIC = {"min_order", "pack_price", "units_per_pack", "unit_cost", "supplier_shipping", "tax_pct", "final_unit_cost"}
STATUSES = ("Provisional", "Cotizado", "Verificado")


async def _admin(user):
    if not user.get("is_admin"):
        raise HTTPException(403, "Solo administración")
    return user


def _user_dep():
    from server import current_user
    return current_user


def variants_of(p: dict) -> list[str]:
    v = p.get("colors") or []
    return v or ["Única"]


def row_for(p: dict, variant: str) -> dict:
    vc = (p.get("variant_costs") or {}).get(variant) or {}
    r = {}
    for k, _ in COLUMNS:
        if k == "variant":
            r[k] = variant
        elif k == "sizes":
            r[k] = ", ".join(p.get("sizes") or [])
        elif k == "price_status":
            r[k] = vc.get(k) or p.get("price_status") or "Provisional"
        elif k == "unit_cost":
            r[k] = vc.get(k, p.get("acq_unit_cost"))  # researched cost only; the internal demo estimate is never exported as real
        else:
            r[k] = vc.get(k, p.get(k))
        if r[k] is None:
            r[k] = ""
    return r


async def catalog_rows() -> list[dict]:
    rows = []
    async for p in db.products.find({"status": {"$ne": "descontinuado"}}).sort("id", 1):
        for v in variants_of(p):
            rows.append(row_for(p, v))
    return rows


@api.get("/admin/catalog/export")
async def export_catalog(format: str = "csv", user=Depends(_user_dep())):
    await _admin(user)
    rows = await catalog_rows()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    if format == "xlsx":
        from openpyxl import Workbook
        from openpyxl.styles import Font
        wb = Workbook()
        ws = wb.active
        ws.title = "Catálogo AMODO"
        ws.append([h for _, h in COLUMNS])
        for c in ws[1]:
            c.font = Font(bold=True)
        for r in rows:
            ws.append([r[k] for k, _ in COLUMNS])
        notes = wb.create_sheet("Instrucciones")
        for line in ["Captura los costos investigados en las columnas de proveedor y costos. Una fila por variante.",
                     "Los precios públicos y suplementos NO se modifican al importar; se revisan y confirman en administración.",
                     f"Estado de verificación permitido: {', '.join(STATUSES)}. Todos los precios actuales son provisionales.",
                     "Si dejas vacío el costo unitario final, se calcula: (precio del paquete + transporte) / unidades × (1 + impuestos)."]:
            notes.append([line])
        buf = io.BytesIO()
        wb.save(buf)
        return Response(buf.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        headers={"Content-Disposition": f'attachment; filename="amodo-catalogo-{stamp}.xlsx"'})
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow([h for _, h in COLUMNS])
    for r in rows:
        w.writerow([r[k] for k, _ in COLUMNS])
    return Response(("\ufeff" + out.getvalue()).encode("utf-8"), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="amodo-catalogo-{stamp}.csv"'})


def _num(v) -> Optional[float]:
    if v in (None, ""):
        return None
    try:
        return float(str(v).replace("$", "").replace(",", "").strip())
    except ValueError:
        raise ValueError(f"«{v}» no es un número")


def parse_file(name: str, data: bytes) -> list[dict]:
    head = {h: k for k, h in COLUMNS}
    if name.lower().endswith(".xlsx"):
        from openpyxl import load_workbook
        ws = load_workbook(io.BytesIO(data), read_only=True, data_only=True).worksheets[0]
        it = ws.iter_rows(values_only=True)
        hdr = [head.get(str(h or "").strip(), str(h or "").strip()) for h in next(it)]
        return [dict(zip(hdr, r)) for r in it if any(c not in (None, "") for c in r)]
    text = data.decode("utf-8-sig", errors="replace")
    rd = csv.reader(io.StringIO(text))
    hdr = [head.get(h.strip(), h.strip()) for h in next(rd)]
    return [dict(zip(hdr, r)) for r in rd if any(c.strip() for c in r)]


@api.post("/admin/catalog/import")
async def import_catalog(file: UploadFile = File(...), confirm: str = Form("false"), user=Depends(_user_dep())):
    """Step 1 (confirm=false): preview of the changes and row errors. Step 2 (confirm=true): saves acquisition costs only."""
    await _admin(user)
    data = await file.read()
    if len(data) > 5_000_000:
        raise HTTPException(413, "El archivo es demasiado grande")
    try:
        rows = parse_file(file.filename or "", data)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(422, f"No pudimos leer el archivo: {e}")
    if rows and "sku" not in rows[0]:
        raise HTTPException(422, "El archivo debe tener la columna SKU. Usa la plantilla exportada.")
    prods = {p["sku"]: p async for p in db.products.find({})}
    changes, errors, updates = [], [], {}
    for n, r in enumerate(rows, start=2):
        sku = str(r.get("sku") or "").strip()
        p = prods.get(sku)
        if not p:
            errors.append({"row": n, "error": f"SKU «{sku}» no existe en el catálogo"})
            continue
        try:
            vals = {}
            for k in EDITABLE:
                if k not in r:
                    continue
                v = r[k]
                v = _num(v) if k in NUMERIC else ("" if v is None else str(v).strip())
                if k in NUMERIC and v is not None and v < 0:
                    raise ValueError(f"{k} no puede ser negativo")
                vals[k] = v
            if vals.get("price_status") and vals["price_status"] not in STATUSES:
                raise ValueError(f"Estado de verificación no válido: {vals['price_status']}")
            pack, units, ship, tax = vals.get("pack_price"), vals.get("units_per_pack"), vals.get("supplier_shipping") or 0, vals.get("tax_pct") or 0
            if vals.get("unit_cost") is None and pack is not None and units:
                vals["unit_cost"] = round(pack / units, 2)
            if vals.get("final_unit_cost") is None and pack is not None and units:
                vals["final_unit_cost"] = round((pack + ship) / units * (1 + tax / 100), 2)
        except ValueError as e:
            errors.append({"row": n, "error": f"{sku}: {e}"})
            continue
        variant = str(r.get("variant") or "Única").strip() or "Única"
        cur = row_for(p, variant)
        diff = {k: v for k, v in vals.items() if v not in (None, "") and str(v) != str(cur.get(k, ""))}
        if diff:
            changes.append({"sku": sku, "name": p["name"], "variant": variant, "fields": {k: {"old": cur.get(k, ""), "new": v} for k, v in diff.items()}})
            updates.setdefault(p["id"], {})[variant] = diff
    applied = 0
    if confirm == "true" and not errors:
        stamp = datetime.now(timezone.utc).date().isoformat()
        for pid, per_var in updates.items():
            p = next(x for x in prods.values() if x["id"] == pid)
            vc = dict(p.get("variant_costs") or {})
            for v, d in per_var.items():
                vc[v] = {**vc.get(v, {}), **d, "cost_updated_at": stamp}
            first = next(iter(per_var.values()))
            top = {k: v for k, v in first.items() if k in ("material", "presentation", "supplier_name", "supplier_url", "min_order", "pack_price",
                                                           "units_per_pack", "supplier_shipping", "tax_pct", "final_unit_cost", "price_status")}
            s = {**top, "variant_costs": vc, "cost_updated_at": stamp}
            costs = [x.get("final_unit_cost") for x in vc.values() if x.get("final_unit_cost") is not None]
            if costs:
                s["unit_cost"] = max(costs)  # costing uses the most expensive variant (conservative); public price untouched
                s["acq_unit_cost"] = max(x.get("unit_cost") or 0 for x in vc.values()) or None
                s["cost_source"] = "importado"
            await db.products.update_one({"id": pid}, {"$set": s})
            applied += 1
    return {"rows": len(rows), "changes": changes, "errors": errors, "applied": applied, "confirmed": confirm == "true" and not errors,
            "note": "Los precios públicos y suplementos no se modifican. Revísalos en Artículos y confírmalos manualmente."}


# ---------------------------------------------------------------- profitability
@api.get("/admin/profitability")
async def profitability(plus_discount: bool = True, user=Depends(_user_dep())):
    from business import DEFAULT_COSTS, DEFAULT_PLANS, cost_of, get_sizes, kit_costing, setting
    await _admin(user)
    c, sizes, plans = await setting("costs", DEFAULT_COSTS), await get_sizes(), await setting("plans", DEFAULT_PLANS)
    prods = [clean(p) async for p in db.products.find({"status": "activo"})]
    inc = [p for p in prods if p.get("tier") != "premium"]
    prem = [p for p in prods if p.get("tier") == "premium"]
    rng = random.Random(7)
    out = []
    for s in sizes.values():
        n = min(s["max"], len(inc))
        eligible = [p for p in inc if s["id"] in (p.get("sizes") or ["Chico", "Mediano", "Grande"])]
        by_cost = sorted(eligible, key=cost_of)
        samples = sorted(sum(cost_of(p) for p in rng.sample(eligible, n)) for _ in range(500)) if len(eligible) >= n else []
        disc = round(s["base"] * plans["plus_kit_discount_pct"] / 100, 2) if plus_discount else 0
        scen = {}
        for label, items in [("Combinación más económica", by_cost[:n]), ("Combinación de mayor costo permitida", by_cost[-n:])]:
            scen[label] = {**kit_costing(s["base"], [cost_of(p) for p in items], c, disc), "items": [p["name"] for p in items]}
        if samples:
            for label, v in [("Mediana de 500 combinaciones", statistics.median(samples)), ("Percentil 90", samples[int(len(samples) * 0.9)])]:
                scen[label] = kit_costing(s["base"], [v], c, disc)
        out.append({"size": s, "provisional_price": True, "plus_discount": disc, "scenarios": scen})
    avg_inc = statistics.mean(cost_of(p) for p in inc) if inc else 0
    premium = [{"name": p["name"], "cost": round(cost_of(p), 2), "extra_cost": round(cost_of(p) - avg_inc, 2), "supplement": p.get("supplement", 0),
                "supplement_margin": round(p.get("supplement", 0) - (cost_of(p) - avg_inc), 2),
                "supplement_margin_pct": round((p.get("supplement", 0) - (cost_of(p) - avg_inc)) / p["supplement"] * 100, 1) if p.get("supplement") else None,
                "cost_source": p.get("cost_source") or "estimado de demostración"} for p in prem]
    researched = sum(1 for p in prods if p.get("cost_source") == "importado")
    return {"sizes": out, "premium": premium, "costs": c, "researched": researched, "total_items": len(prods),
            "note": f"Precios de $299, $499 y $799 MXN provisionales. {researched} de {len(prods)} artículos tienen costo investigado; el resto usa estimados de demostración. Envío incluido para el cliente (se considera como costo interno)."}


@api.post("/admin/catalog/export-link")
async def export_link(format: str = "xlsx", user=Depends(_user_dep())):
    """One-time link valid for 5 minutes, so the file can be opened by the browser or the phone without exposing the session."""
    import secrets
    from datetime import timedelta
    await _admin(user)
    code = secrets.token_urlsafe(24)
    await db.download_links.insert_one({"code": code, "format": "xlsx" if format == "xlsx" else "csv",
                                        "expires": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()})
    return {"path": f"/api/catalog-download/{code}"}


@api.get("/catalog-download/{code}")
async def catalog_download(code: str):
    link = await db.download_links.find_one_and_delete({"code": code})
    if not link or link["expires"] < datetime.now(timezone.utc).isoformat():
        raise HTTPException(404, "El enlace venció. Genera uno nuevo desde administración.")
    return await export_catalog(link["format"], {"is_admin": True})
