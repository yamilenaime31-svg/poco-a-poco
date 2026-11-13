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

## Backlog
- P1: Real email delivery for password reset & invitations (Resend)
- P1: Product photo uploads (object storage) + admin catalog editing
- P1: Real payments (Stripe/Mercado Pago) when ready
- P2: Native date/time pickers, calendar month view
- P2: Split server.py into modules; stricter request models
- P2: Placeholders on network inputs
