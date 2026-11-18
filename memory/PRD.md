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
