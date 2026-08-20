# MAKUCO.md

This file provides guidance for Makuco agents. Project is in pre-implementation stage — services/backend and services/frontend exist but are empty.

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
- Detailed codebase docs: `.makuco/codebase/` (stack, architecture, concerns, conventions, integrations, structure, testing)
