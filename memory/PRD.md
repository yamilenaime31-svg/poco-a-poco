# AMODO — PRD

## Original problem statement
Mobile-first app "AMODO" (Spanish): physical-digital companion system for people in oncology treatments (any treatment type) and their caregivers. Tagline "A tu manera, poco a poco." Patient + Acompañante modes, organization (agenda, treatments, medications registered, tasks, transfers, expenses), quick signals, support network with permissions, personalization (treatment, tastes, needs), kits builder, catalog, favorites, cart, checkout, orders tracking, notifications, settings/accessibility/privacy, help. Not a medical tool. Palette #F5F5F2 / #FFFFFF / #252525 / #737373 / sage #9CB8A3 / lavender #C6BBD8 / coral #DEA79C.

## User choices
- Payment: simulated (no real charge)
- Currency: MXN
- Linking: invite code AND email request/invite
- Product photos: user uploads later (placeholders now)

## Architecture
- Backend: FastAPI + MongoDB (`/app/backend/server.py`), JWT (bcrypt, 7-day), generic `/api/records/{kind}` for events/treatments/medications/tasks/transfers/expenses/journal with caregiver permission checks; network links, signals, notifications, products (24 seeded), kits (+4 templates), favorites, cart, orders (status advances every 3 min), home, history. Demo users seeded.
- Frontend: Expo Router. Tabs: Inicio / Agenda / Kits / Perfil (NativeTabs on iOS 26+). Screens: landing, info/[page], welcome, login, register, forgot, onboarding (edit mode via params), day, event/[id], records/[kind], record-form, signals, network, notifications, settings, history, catalog, product/[id], kit-builder, kit/[id], favorites, cart, checkout, orders, order/[id].
- Fonts: Plus Jakarta Sans + DM Sans (local TTF), Lucide icons.

## Implemented (2026-06)
- All flows above end-to-end; tested by testing agent (iteration 1: backend 27/27 after fixes, frontend flows pass; role-switch crash fixed).

## Iteration 2 (2026-11)
- Warm cream palette (#FFF9F0 + pastel green/lavender/peach/butter/sky), radii 20–28, soft shadows
- 5 tabs: Inicio, Agenda, Kits (mykits), Organiza, Perfil (me)
- Customizable inclusive SVG avatar (/avatar), shown in Home header, Profile, network cards
- Home redesign: Mi día card, mood chips, circular favorite signals (customizable, confirm before send), Próximo, Pendientes, Organiza grid, Mi kit
- Organiza: "¿Qué hay de nuevo?" real AI (gpt-5.4 via Emergent key) → editable review → confirm → saved to right sections (transfer linked to event); nothing saved without confirmation
- Per-item privacy: records & kits `shared_with`, private by default, enforced server-side; "Compartir con…" control in forms, kit builder and review
- QR/link invitations (48h, single-use, cancelable, confirmation screen), scan with camera permission flow, manual code
- "Identidad y estilo" category + 8 new products; onboarding identity step (explore, accessories, styles, comfort, avoid, budget)
- Explainable recommendations engine (/api/recommendations) with dismiss / already-own / reset; reorder section; shared kits for caregivers
- Testing iteration 2: 36 backend tests pass; frontend flows pass; custom signal fix, 4xx no-retry, invite reuse applied after

## Backlog
- P1: Use a personal photo instead of avatar (needs object storage)
- P1: Real email delivery (Resend), real payments
- P2: Kit PUT partial update safety, varied reasons for suggested kits, split server.py
- P2: Product photo uploads

## Iteration 3 (2026-11) — UX/UI refinement
- Desaturated palette (cream #FAF6F0, surfaces #FFFEFC, soft pastels), radii 12/16/22, tighter typography & section spacing
- Shared compact 2-col TileGrid (src/components/tile-grid.tsx) for Home/Organiza/Kits categories/Caregiver actions; auto-stacks icon above label when tiles < 150px
- Home: compact Mi día card; MoodCard (10 feelings, multi-select, Ver más, custom note, editable, saved in journal moods[]/mood_note); smaller signals with 3-line labels
- Mis kits: compact "Armar nuevo kit", 3 equal quick tiles, 2x3 category grid
- Avatar editor: icon category tabs + illustrated mini-avatar thumbnails (zoomed crops) that update preview live
- Testing iteration 3: 20/21 passed; tile overflow at 360–375px fixed after

## Iteration 4 (2026-11) — Identidad madura + ecosistema conectado
- Inter across UI (logo keeps Plus Jakarta Sans 800 via fonts.logo); palette reduced to cream/white/sage with lavender/peach accents; neutral tiles; web focus ring in sage
- Treatments: "Otro" → custom name (stored as name, treatment_type kept); multiple concurrent treatments
- AI treatment assistant (/treatment-assistant, POST /api/treatments/parse → editable sessions → POST /api/treatments/plan creates treatment + linked events with series_id); never invents frequency, asks for missing data
- Series edit scope (PUT /api/series/{id}: one/following/all, history[]) from record-form
- Unified agenda GET /api/agenda (events, transfers, tasks, pending expenses, medication doses expanded from `times`); Agenda tab month/week/day/list + add sheet + dose sheet
- Doses POST /api/doses (realizado/omitido/pendiente, explicit only); unified /pending screen + GET /api/pending with filters
- Reminders: GET /api/reminders (prefs settings.notif: enabled, cats, leads, quiet, discreet; tz via settings.tz_offset); backend loop → in-app notifications (dedupe via reminders_sent unique key); device local notifications via expo-notifications (cancel-all + reschedule on every change/foreground). Web: in-app only.
- Knowledge base (backend/knowledge.py, db.knowledge, NCI/ACS/MedlinePlus sources, reviewed 2026-06); needs asked never assumed (GET/PUT /api/recommendations/needs); boost() context: declared needs, next appointment, recent "rest" moods, "Me interesa"; exclusions (nausea/mouth → no food items); explain endpoint with LLM (cached) + sources sheet
- Catalog search + visible chip bar; 32 AI illustrations (Gemini Nano Banana) in object storage served at /api/media/amodo/products/*; prices labelled "precio de ejemplo"
- Backlog: series delete scope, show series history in event detail, native-tabs import deprecation

## Iteration 6 — Modelo de negocio (backend/business.py)
- Wholesale-only catalog: products have sku, tier incluido/premium, supplement, unit_cost, prep_cost, min_order, ref_price, supplier_id, stock, stock_reserved, sizes, status (internal fields stripped by public_product)
- Sizes in biz_settings (Chico 4/$299, Mediano 6/$499, Grande 10/$799; alias Pequeño→Chico); kit price = base + premium supplements (kit_view/price_kit); example items p33–p38
- Kit builder 5 steps (para quién, tamaño, momento, artículos con etiquetas INCLUIDO/PREMIUM/NO DISPONIBLE, resumen "Tu kit, a tu manera" via POST /api/kits/quote); save without buying; continue → cart
- Plans: GET/POST /api/me/plan (Gratis / Plus demo 30 días sin cargo); institutional codes POST /api/benefits/validate|activate (server validation, expiry, usage limit atomic, unique activation, budget, history)
- Checkout: GET /api/checkout/quote (best-discount or sum-with-cap rule, credit, shipping, no negatives); orders status flow Pendiente de confirmación→Confirmado→En preparación→Enviado→Entregado/Cancelado; stock reserved on order, discounted when shipped, released on cancel; repeat order, duplicate kit
- Admin (demo@amodo.app is_admin): /admin overview+alerts, products edit, inventory moves, costing simulator (POST /api/admin/costing), suppliers (demo), codes, orders status, settings (sizes, costs, plans)

## Iteration 9 (Jun 2026) — Kits según guías confiables
- knowledge.py: 13 temas (añadidos hormigueo, sueño, memoria/concentración, estrés) con consejos generales parafraseados, precauciones y fuentes (NCI español/inglés, ACS, MedlinePlus); cada tema tiene un kit curado (id `g-<tema>`).
- GET /api/guided-kits (todos los usuarios; con Plus se priorizan por tratamiento registrado / temas elegidos). Kits `g-*` funcionan en /kits/{id}, carrito y checkout (server.find_template).
- Frontend: sección "Según guías confiables" en Mis kits, pantalla /guides, caja de guía y fuentes en detalle de kit (src/components/guide-info.tsx).

## Iteration 10 (Jun 2026) — Acompañantes y regalos
- /api/guided-kits prioriza para acompañantes (por vínculos activos, no por rol) los temas del tratamiento que el paciente compartió con ellos ("Para <nombre>"); requiere Plus del acompañante o del paciente.
- POST /api/kits/{kid}/gift {patient_id, message}: kit regalo (gift:true) al carrito; al pagar, se comparte con el paciente y se le notifica con el mensaje. El paciente ve "Kit recibido" + "Mensaje de <nombre>".
- Tarjetas de guía: fotos en una fila (máx. 4 + "+N"), etiquetas cortas.

## Iteration 11 (Jun 2026) — Regalos: cancelación, carrito y agradecimiento
- Al cancelar un pedido con kit regalo: se quita el kit al paciente (shared_with) y se le avisa. Re-pedir no vuelve a notificar si ya lo tenía. Duplicar quita datos de regalo.
- Carrito: detalle "Regalo para X · «mensaje»".
- POST /api/kits/{kid}/thanks {message ∈ 4 frases}: el paciente agradece; notifica al remitente; kit.thanks visible para ambos.
- Mis kits: sección "Regalos y compartidos" para cualquier usuario.
- Iter 11 fixes: cancel keeps access if another active order has the gift; thanks once (409); duplicate strips for_name/note/guide.

## Iteration 12 (Jun 2026) — Rediseño visual, compra simulada completa, costos y membresías
- Diseño: paleta marfil/arena/salvia/lavanda/carbón, Manrope (títulos) + Inter (texto), logotipo PJS intacto; radios moderados; botones primarios carbón; tarjetas planas con borde fino. Inicio compacto (Mi día con próxima actividad/pendientes/agenda/+, señales neutras, ánimo compacto multi-selección, accesos a Organiza y Kits).
- Catálogo: imágenes ilustrativas tipo foto por artículo (gen_product_images.py FORCE=1, *-v2.jpg) etiquetadas "Imagen ilustrativa"; tarjeta con categoría, Incluido/Premium, descripción, variantes, disponibilidad, suplemento.
- Compra: checkout con resumen (imágenes, base, suplementos, descuentos, créditos elegibles: máximo/monto/guardar, envío incluido, total), "Confirmar pedido" + nota demo, request_id idempotente (índice único). Pantalla /order-confirmed. Estados: Pedido confirmado → En preparación → Listo para envío → En camino → Entregado (+Cancelado); timeline con fechas solo de estados registrados; admin cambia estados; Volver a pedir; Guardar como favorito (POST /orders/{id}/favorite).
- Membresías (membership.py): Plus $79 simulado (/me/plus/activate, /me/plus/cancel), precio/crédito/descuento congelados al activar; crédito mensual $20 idempotente por periodo (credit_moves.key único); billetera /wallet y pantalla /credits (Plus vs institucional); descuento 10% solo sobre base de kits; límites de IA por plan (ai_usage; Gratis 15/mes, Plus 300/mes) en /treatments/parse y /organize/parse (asistente ya no bloqueado para Gratis); /plus y /plus-welcome; choose-plan con nuevo texto; admin /admin/memberships.
- Admin catálogo (catalog_admin.py): export CSV/XLSX por variante (enlace de un solo uso /admin/catalog/export-link → /api/catalog-download/{code}), import con vista previa y confirmación (no toca precios públicos ni suplementos), /admin/profitability (más económica, mediana y p90 de 500 combinaciones, mayor costo permitida, suplementos premium). Ajustes de planes con confirmación.
- PENDIENTE (fase 2 del pedido de membresías): Mi próxima semana, checklists inteligentes, disponibilidad/coordinación de acompañantes, Mi identidad y estilo, Mi proceso (gráficas + PDF), análisis avanzado de gastos, notas de voz/fotos en asistente, recomendaciones con "Me interesa / Ya lo tengo".
- Iter 12 fixes: Plus credit key per user+calendar month (no re-activation farming); order tracking only moves forward (admin UI shows only next states); failed AI calls are refunded from the monthly count.
