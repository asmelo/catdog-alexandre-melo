# MAKUCO.md

This file provides guidance for Makuco agents. **MODULE-001 (authentication) and MODULE-002 (pet catalog) are both delivered end to end** — all three features of MODULE-002 (species, animals, public showcase) are complete, tested and committed. MODULES 003 and 004 (customer orders, order management and their status flow) are **not specified yet**: no spec, no task, no Prisma model.

## What is CatDog?

CatDog is a pet adoption/sale platform that centralizes the display of available animals and organizes customer orders. It replaces the manual WhatsApp-based process with a navigable catalog and an admin panel for order tracking. Two user roles: `admin` (store manager) and `cliente` (interested customer).

Uses TypeScript + Node.js (backend: Express, Prisma, Supabase) and React + Vite + Tailwind CSS (frontend). Monolithic layered architecture — single repository with backend and frontend services.

## Tech Stack

- TypeScript 5.x + Node.js 20 LTS
- Backend: Express 4.x, Prisma 5.x (ORM), Supabase (PostgreSQL)
- Frontend: React 18.x, Vite 5.x, Tailwind CSS 3.x
- Tests: Jest 29.x
- CI/CD: GitHub Actions | Hosting: Render or Railway | Containers: Docker

## Architecture

- Entry point: `services/backend/src/index.ts` — Express server initialization
- Domains: `services/backend/src/domains/` — business logic per domain (auth, pets, orders...)
- Frontend: `services/frontend/src/` — pages, components, contexts
- Path alias `~/` maps to `src/` (tsconfig.json)
- Monolith in layers — no microservices, no async messaging

## Code Rules

- **Do NOT** use `any` type — always precise TypeScript typing
- Project language is Portuguese (BR) — prompts, error messages, and documentation in Portuguese
- No paid UI libraries or services
- No NoSQL databases — Supabase (PostgreSQL) only
- Passwords never stored in plain text

## Design System

Identity: purple (`#7c3aed`) and orange (`#e05a1e`), font Nunito, paw print background motif. Reference UI in `.makuco/resources/reference.html`.

## Key Patterns

- Authentication: email + password, roles (`admin`, `cliente`), access token + refresh token (rotation required — never reuse the same refresh token)
- Role-based redirect and layout after login
- Email confirmation on registration (styled template matching `.makuco/resources/reference.html`)
- Admin area: protected, `admin` role only
- Public catalog: no authentication required
- **The showcase (`/animais`) is the only route outside every guard.** Public by product decision: visitor, `cliente` and `admin` see the same screen, and the session changes only the header. Read the comment at the top of `catalog.routes.ts` and the one in `app-routes.tsx` before "fixing" the missing `authenticate` — adding it would silently switch the whole feature off.
- **Two normalized name columns coexist on `animals`, and they are not interchangeable.** `name_normalized` is lowercase but **keeps accents** and serves the admin alphabetical ordering (ICU locale); `name_search` strips accents and serves the showcase search. Merging them breaks one of the two features without breaking any of its tests.
- **The public projection is a closed key set.** `toPublicAnimal` enumerates every key by hand, and a test compares `Object.keys` by equality. Never `...row`, never a generic copy helper: the mapper is the only thing between the database and an anonymous visitor.
- Detailed codebase docs: `.makuco/codebase/` (stack, architecture, concerns, conventions, integrations, structure, testing)
- **Known technical debt: `.makuco/codebase/technical-debt.md`** — read it BEFORE modelling a foreign key or
  accepting a rule verified only by a test double. It records paid debts (kept as history, so they are not
  re-incurred), open ones, and debts registered in advance — notably DT-02: the Pedidos module's link to
  `Animal` must be born `onDelete: Restrict`, never `Cascade` nor `SetNull`, and verified against real data.
