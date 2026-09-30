# InnovateX

InnovateX is an AI-powered Startup Procurement & Solution Intelligence Platform prototype for SIH 2026.

## Core workflow

Challenge identification → Startup discovery → Eligibility screening → AI evaluation → Expert evaluation → Shortlist → Collaboration detection → Solution evolution → Pilot → KPI evidence → Independent validation → Procurement readiness → Milestone/payment tracking → Human procurement decision → Scale-up.

## Intelligence engine

The project includes an explainable local intelligence engine for:

- solution scoring across relevance, innovation, feasibility, impact, scalability and cost efficiency
- similarity and complementary-capability detection
- eligibility checks
- risk assessment
- recommendation support
- explanation generation
- structured Ask IX retrieval

No external AI API key is required for the core application. An optional locally hosted LLM (for example Ollama or LM Studio) can enhance natural-language responses when configured through `.env`.

The local scoring engine is a deterministic/explainable intelligence layer; it should not be described as a trained generative model unless a real local model is configured.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000`.

## Demo accounts

- Startup: `startup@innovatex.demo` / `demo123`
- Organisation: `org@innovatex.demo` / `demo123`
- Expert: `expert@innovatex.demo` / `demo123`
- Admin: `admin@innovatex.demo` / `demo123`

## Prototype-only elements

Procurement readiness, independent validation, milestone/payment tracking, templates and scale-up are demonstration workflows. They do not execute real government procurement, payments, certifications or legal agreements.

Recognised startup databases and government e-marketplaces are represented as integration-ready future connections unless a real integration is explicitly implemented.
