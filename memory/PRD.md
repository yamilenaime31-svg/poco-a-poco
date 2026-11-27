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

## Iteration 13 (Jun 2026) — Próxima semana, Identidad y estilo, Mi proceso, Listas
- Mi próxima semana (Plus, /next-week, GET /api/next-week): 7 días con agenda, resumen (citas, traslados, pendientes, tomas) y "Puedes preparar" (traslado faltante, lista por crear/pendiente, traslado por confirmar, pagos, pendientes, kit para sesión). Solo usa lo registrado.
- Listas de preparación (todos, /checklists, /checklist/[id], backend/preparation.py): plantillas cita/sesión/estudio/hospitalización/en blanco; editar puntos y nombre; ligar a cita (event_id); compartir con acompañantes vinculados (ven y marcan, no editan; notificación); "Usar de nuevo" (copia sin marcar); borrado suave (deleted_at).
- Mi proceso (todos, /process, backend/process.py): periodos 7/30/90 días; ánimo, energía, señales, actividades por categoría, tratamientos, tomas realizadas/omitidas, gastos; barras por semana; PDF (fpdf2) con enlace de un solo uso POST /api/process/pdf-link → /api/process-download/{code} (5 min).
- Identidad y estilo (Plus, /style, backend/style.py): colores (muestras), texturas, accesorios, estilos en profile.style; propuestas del catálogo con motivo; imagen de inspiración con IA (Gemini image, solo elecciones de estilo, cuenta como interacción de IA, máx. 8, guardada en object storage amodo/style/<uuid>.jpg servida por /api/media).
- Accesos: Organiza → También; Perfil; Inicio (tile Próxima semana); plus-welcome; Inicio de acompañante (Listas de preparación).
- Pendiente de fase 2: disponibilidad/coordinación de acompañantes, análisis avanzado de gastos, notas de voz/fotos en asistente, "Me interesa / Ya lo tengo".

## Iteration 14 (Jun 2026)
- Listas compartidas en Inicio: src/components/shared-lists.tsx (sección "Listas compartidas contigo") en CaregiverHome (filtrada por persona elegida) y en PatientHome (solo si hay), porque la cuenta demo de acompañante puede abrir el Inicio de paciente.
- Análisis de gastos: /expense-analysis (cálculo en cliente sobre /records/expenses[?owner_id]): barras mes a mes pagado/pendiente (últimos 6), filtro por mes, diferencia vs mes anterior, quién pagó (monto y %), quién pagó mes a mes, categorías. Acceso: fila "Ver análisis" en Gastos.
- Lista desde la cita: fila en /event/[id] que crea (POST /checklists {event_id}) o abre la lista ligada; acompañante solo abre si se la compartieron.
- Solo verificado con capturas propias (sin testing agent).

## Iteration 15 (Jun 2026) — Rediseño integral (dirección artística + sistema de diseño)
- Tokens (src/theme.ts): marfil #F7F6F2, blanco, tinta #25282A; pasteles con presencia lavender/sage/coral(durazno)/sky/butter/mauve con variantes Soft y Deep; radios 12/16/20; margen lateral 20. Fuentes: Plus Jakarta Sans (títulos, botones) + DM Sans (texto). Sin mayúsculas en etiquetas.
- Sistema gráfico original (src/art.tsx, react-native-svg): Shape (formas orgánicas), MoodFigure (8 figuras forma+expresión), Spot (ilustraciones por herramienta), Company (composición para héroes/estados vacíos), KitBox (contenedor chico/mediano/grande), Slots (espacios del kit).
- UI base (src/ui.tsx): botones píldora, chips con selección en tinta + check, tarjetas sin borde, Section con título grande, Row con icono en bloque pastel, Empty con ilustración, contexto OnTint (texto secundario en tinta sobre pastel), tintOf → {bg, soft, accent}.
- Navegación: barra propia en tinta con píldora clara y etiquetas visibles (app/(tabs)/_layout.tsx); ya no usa NativeTabs.
- Inicio: saludo display, tarjeta Mi día lavanda con ilustración y estado vacío neutral, estados (En calma, Con energía, Cansado/a, Con sueño, Sensible, Preocupado/a, Con molestias, Con dolor) con animación breve y movimiento reducido, señales en retícula 2 columnas sin truncar, bento "A tu modo".
- Agenda: segmento en tinta, hoy en lavanda, tarjetas grandes por categoría para visitas y compactas para lo demás. Organiza: módulo IA en tinta + retículas con ilustraciones. Kits: héroe durazno, tamaños con KitBox, espacios que se llenan, etiquetas Incluido/Premium. Perfil: héroe mantequilla, plan Plus lavanda. Landing/bienvenida/planes/Plus/confirmación de pedido con el mismo lenguaje.
- Sin cambios en lógica, API ni datos.

## Iteration 16 (Jun 2026)
- Avisos (src/toast.tsx): ahora salen abajo, sobre la barra inferior/pie (bottom inset + 96).
- Avatar (src/components/avatar.tsx): cabello + Ondulado, Afro, Flequillo, Coleta, Trenzas; 4 colores de cabello; Boina y Sombrero; lentes De sol; Collar y Flor; más colores de ropa/accesorio; fondos con la paleta nueva y "Forma de fondo" (Liso, Pétalo, Nube, Destello, Arco). Valores previos intactos.
- Registros (/records/[kind]): héroe de color con ilustración y conteo, filas como tarjetas. Red de apoyo: tarjetas con ilustración. Administración: métricas en color y enlaces como tarjetas.
- Verificado solo con capturas propias.

## Iteration 17 (Jun 2026) — Selectores y movimiento
- src/pickers.tsx: DateField/DateSheet (mini calendario L–D, flechas, encabezado → meses/año con ±5/±10 años, Hoy/Mañana, Sin fecha, Confirmar/Cancelar), TimeField/TimeSheet (ruedas hora/minuto/AM-PM con ajuste al valor, flechas y toque como alternativa, 12 h/24 h guardado en settings.time_24h), TimesField (varios horarios editables/eliminables). Formatos guardados sin cambio: YYYY-MM-DD y HH:MM. src/form.tsx reexporta.
- Aplicado en record-form (date/time/times para todos los tipos), onboarding, organize-review, treatment-assistant (inicio, hora y cada sesión), admin/codes.
- src/motion.tsx: useMotionAllowed (dispositivo + settings.reduce_motion), useAmbient (además pantalla enfocada y app activa), Ambient (bucles 3–6 s), Pop (respuesta breve).
- src/art.tsx: LiveMood + MOOD_MOTION (movimiento propio por estado; seleccionados en bucle, el resto dos ciclos al entrar), Company animada por piezas con parpadeo, Slots con relleno animado, KitClosing (cierre de caja en confirmación de pedido). Señal enviada: marca de confirmación en el módulo solo tras éxito real.
- Perfil → Configuración → Accesibilidad: "Desactivar animaciones de las ilustraciones" (settings.reduce_motion).
- Las horas en listas (agenda, detalle) siguen mostrándose en 24 h.

## Iteration 18 (Jun 2026) — Mi proceso integrado e interactivo
- Inicio: sección "Mi proceso" (src/components/process-preview.tsx) tras Señales rápidas: periodos 7/30/90, días con figuras de estado (src/components/process-parts.tsx: WellbeingDays, DaySheet), 3 módulos y, con Plus, tarjeta "Tu proceso, en un reporte".
- /process rediseñado como dashboard: periodos, filtros por categoría, bento de indicadores, calendario de bienestar, distribución de estados (toca → días), comparación con periodo anterior (solo Plus, backend), línea del tiempo con estado programada/registrada/cancelada, medicamentos, gastos, notas, estado vacío compacto. Sin pie fijo.
- /process-report (Plus): periodo 7/30/90 o fechas con mini calendario, categorías (feelings, appointments, treatments, medications, activities, expenses, notes), incluir nombre, vista previa, generar, descargar, compartir enlace (15 min), reportes anteriores.
- Backend process.py: GET /process añade daily, counts, tasks, plus, compare (Plus). POST/GET /process/reports y POST /process/reports/{id}/link requieren Plus (403 si no); /process-download/{code}. Se retiró POST /process/pdf-link (el PDF ahora es beneficio Plus, por decisión explícita del usuario). PDF con calendario de bienestar y secciones elegidas.

## Iteration 19 (Jun 2026) — Cobertura médica, finanzas y reembolsos
- backend/finance.py. Gastos siguen en db.records kind=expenses (campos nuevos: payments[{amount,date,method,by,source own|direct}], supports[], sources[{coverage_id,label,mode}], insurance{}, claim{status,history[],deposits[],checklist[],requested,authorized,rejected,...}, discount, provider, treatment_id). `status` Pagado/Pendiente se sincroniza para agenda y pantallas previas. Gastos antiguos "Pagado" = pago propio total. Eliminación suave (kind → expenses_deleted).
- calc(): paid_own, direct, pending_pay, requested, authorized, received, pending_receive (estimado), supports, net = pagos propios − reembolsos recibidos − apoyos; estimated_final. Lo solicitado/autorizado nunca se resta.
- Coberturas: db.coverages (type, name, data{} según tipo, archived). Documentos: db.finance_docs en almacenamiento privado amodo/private/<owner>/…, se abren con enlace temporal de 5 min (/api/finance-file/{code}); borrado suave. Bitácora db.finance_log.
- Permisos por acompañante en link.finance {view, add, edit, coverages, docs, attach, claims, reports}; por defecto nada. /records/expenses de otra persona también exige link.finance.view/edit.
- Plus: POST /finance/docs/{id}/extract (consentimiento obligatorio; imagen → modelo con visión, PDF → texto con pypdf), POST /finance/reports (financial, treatment, claims, claim, dossier ZIP) → /api/finance-download/{code}.
- GET /process añade `finance` (compact) cuando hay gastos.
- Frontend: /coverage (lista + formulario por tipo), /finances (tablero, filtros, permisos, reportes), /expense-form (secciones plegables), src/finance/shared.tsx (Fold, Docs). /records/expenses y /record-form?kind=expenses redirigen. Accesos en Perfil y Organiza. Recordatorios = pendiente prellenado en /record-form?kind=tasks.
- No hecho: cifrado propio de archivos (se usa el del almacenamiento), categorías personalizadas persistentes, agrupación visual por siniestro, proyección de flujo de efectivo, comparación entre periodos financiera, tiempos de resolución.

## Iteration 20 (Jun 2026) — Siniestros, flujo de efectivo, categorías propias, recordatorios de trámites
- Por siniestro: src/finance/claims.tsx agrupa gastos por claim.claim_no en /finances (resumen, filtro, PDF Plus type=claim con claim_no). En el gasto se sugieren siniestros ya usados.
- Flujo de efectivo (Plus): GET /api/finance/cashflow?today= → months[6], overdue, later, undated, in_review. Usa expense.due_date (nuevo, "Fecha límite de pago") y claim.expected_date. src/finance/cashflow.tsx. No Plus → 403 / tarjeta hacia /plus.
- Categorías propias: db.finance_categories (se guardan al guardar el gasto); /finance/expenses devuelve `categories`; DELETE /api/finance/categories?name=.
- Recordatorios: src/finance/reminders.tsx en el gasto; son tasks con expense_id + date + time (campo time añadido a KINDS.tasks). planner: tasks con expense_id y hora avisan también a la hora exacta (lead 0), respetando horas de silencio.
- Autoprobado con script y capturas; sin pasada del testing agent.

## Iteration 21 (Jun 2026) — Finanzas en reporte de Mi proceso + resumen semanal para acompañante
- process.py: sección "finance" (Pagos, coberturas y reembolsos) en SECTIONS y en el PDF; GET /api/process/report-preview (Plus) devuelve blocks[{k,title,lines}] = vista previa real por sección, también para fechas personalizadas. La sección finance no viene marcada por defecto.
- finance.py: week_summary (pagos pendientes con fecha ≤ hoy+6 o pasada, trámites en ATTENTION o con resolución estimada en la semana, recordatorios ligados a gastos); GET /finance/week-summary, POST/GET/DELETE /finance/shares (copia fija para un acompañante vinculado, con o sin importes, notificación con enlace /finance-summary?id=). No cambia link.finance.
- Frontend: src/finance/week-share.tsx (hoja en /finances "Compartir semana", ReceivedSummaries en Inicio de acompañante), app/finance-summary.tsx.
- Autoprobado con script y capturas; sin testing agent.

## Iteration 22 (Jun 2026) — Resumen semanal automático + "yo me encargo"
- settings.finance_weekly {day 0-6 (lun=0) | null, caregiver_id, include_amounts}. finance.weekly_prepare (llamado desde planner.reminder_loop): ese día desde las 9:00 hora local (tz_offset) avisa al paciente con enlace /finances?week=1; una vez por día (reminders_sent), no avisa si no hay pendientes, nunca envía solo.
- POST /api/finance/shares/{sid}/take {kind payments|claims, item_id, take} solo el acompañante receptor; marca row.taken {name, at}, avisa al paciente, no registra pagos. Filas del resumen llevan id del gasto.
- UI: selector de día en la hoja "Compartir semana"; botones "Yo me encargo" en /finance-summary; el paciente abre sus resúmenes enviados y ve quién se encarga.
- Autoprobado con script y capturas; sin testing agent.

## Iteration 23 — Etiqueta "Plus" visible en cada beneficio
- PlusTag (src/components/plus-gate.tsx): píldora "✦ Plus" + frase breve de por qué vale la pena; se muestra también con Plus activo. PlusGate acepta `why`.
- Colocada en: Mi próxima semana, Identidad y estilo, Reporte personal, reportes de Mi proceso (pantalla, tarjeta en Mi proceso e Inicio), comparativo de Mi proceso, sugerencias según tratamiento y explicación ampliada, guías, asistente de tratamiento, créditos mensuales, checkout (descuento y créditos Plus), Gastos (reportes, flujo de efectivo, PDF de siniestro, lectura con IA). Perfil y Organiza muestran "Plus · …" bajo el acceso.

## Iteration 24 — Invitación a la red: QR siempre visible, copiar y WhatsApp
- src/components/invite-share.tsx: InviteCard (QR de la invitación activa; si no hay, crea una; código seleccionable) + InviteActions (copiar código, copiar mensaje, WhatsApp vía wa.me, compartir). Usado en /network (paciente) y /link.

## Iteration 25 — Resumen de mi Plus en Perfil
- GET /api/me/plus-usage (membership.py, solo Plus → 403 si no): mes calendario UTC; reports (process_reports + reportes financieros vía finance_links), credits_received/used (credit_moves source=plus), kit_savings/kit_orders (descuentos con "Plus" en pedidos no cancelados), ai, inspirations, value, price.
- src/components/plus-usage.tsx bajo PlanCard en Perfil (solo con Plus).

## Iteration 26 — Beneficios Plus sin usar
- membership.py: db.plus_marks (mark_used) + PLUS_TOOLS; /me/plus-usage devuelve `unused` [{key,title,why,href}] y `tools`. Marcas: next_week y style al abrir, cashflow cuando muestra datos propios, doc_ai al leer un documento; reportes y descuento en kits se detectan por datos existentes.
- plus-usage.tsx: sección "Aún por descubrir" con acceso directo.

## Iteration 27 — Onboarding y experiencia separados por rol (paciente / acompañante)
- app/onboarding.tsx: wrapper por rol. Paciente: pasos treatment, tastes, kitprefs (nuevo: colores/estilos/no me gusta), identity, needs, companions, privacy, done; back interno sin perder respuestas; "n de N".
- src/onboarding/caregiver.tsx + caregiver-data.ts + options.tsx (OptionCards con icono/tick y AddOwn con botón Agregar; MultiChoice ya no depende de Enter). Pasos: welcome, relation, duties, hard, organize, at_hand, availability (when + slots días/fecha/hora), wellbeing, link (QR / enlace o código / después), done. Se guarda en profile.caregiver {who, mode, duties[], hard[], organize[], at_hand[], availability{when[],slots[]}, goals[], interests[]}. Edición: /onboarding?edit=1&step=<paso>.
- Inicio acompañante (caregiver-home.tsx): "Para ti" (MoodCard propio, agenda y pendientes propios, Mi día, Mi proceso) y "Lo que acompañas" (señales, tareas asignadas, agenda compartida; orden según at_hand), accesos ordenados según duties; sin vínculo usa herramientas personales; tarjeta "Completar mi perfil de acompañante" si falta profile.caregiver (cuentas antiguas).
- /home (caregiver) añade journal, own_tasks, care, can_finance y shares_preferences por paciente.
- Permiso nuevo link.permissions.preferences (default False; SHARE_KEYS). GET /api/network/preferences/{patient_id}. /recommendations y /recommendations/explain para acompañante: gustos del paciente solo si autorizó; si no, ideas generales (nunca los gustos del acompañante). kit-builder muestra lo compartido o aviso de selección manual.
- GET /api/process/shared: recuento propio de acompañamiento + por persona lo compartido (sección aparte en /process). Perfil con grupos distintos por rol. Textos de Gratis/Plus por rol (freeFeatures/plusFeatures/plusBenefits/plusTagline) sin tocar precios. Organiza oculta Tratamientos/Medicamentos al acompañante.
