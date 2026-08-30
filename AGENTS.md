# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Qué es este repo

Prototipo para el **NextWave Hackathon 2026** (Yuno × Nauta, sponsor OpenAI), Buenos Aires, 29–30 agosto 2026.
Ventana real de construcción ≈ 14 horas. Hoy `backend/` y `frontend/` están vacíos: el código se escribe durante el evento.

**Challenge elegido: C2 · The Control Tower (Yuno)** — monitoreo de pagos en vivo + diagnóstico de causa raíz.

**Antes de picar código, leer en este orden:** `harness/HARNESS.md` (mapa de todo) → `harness/AGENTS.md` (reglas y contratos de API) → `harness/docs/06-dominio-pagos.md` (el dominio) → `harness/docs/07-decisiones-core.md` (enfoque técnico + decisiones) → `harness/docs/08-product-ux-gtm.md` (producto + UX) → `harness/pitch/demo-path.md` (qué tiene que funcionar).

## Stack

- **Backend:** Python + FastAPI + Uvicorn, gestión con pip. Vive en `backend/`. `uvicorn main:app --reload`.
- **Frontend:** TypeScript + React + Tailwind, HTTP con axios. Vive en `frontend/`. `npm install && npm run dev`.
- **DB:** PostgreSQL (pgvector desde el día 1 si hay RAG/embeddings). MongoDB solo si el caso lo pide.
- **LLM:** API de OpenAI.
- **Deploy:** frontend en Vercel · backend local expuesto con ngrok.

No hay `requirements.txt` ni `package.json` todavía; se crean al arrancar cada capa.

## Cómo escribir código acá (esto anula los defaults habituales)

1. **El único objetivo es que el demo path corra en vivo sin crashear.** Ver `harness/pitch/demo-path.md`.
2. **Nada de tests, CI ni abstracciones prematuras.** No suman puntos y no hay tiempo. No escribir `test_*.py`.
3. **Si algo se puede hardcodear y se ve igual en la demo, se hardcodea** — y se anota en `harness/docs/decision-log.md`.
4. **try/except amplio con fallback visible.** Nunca una pantalla en blanco si algo falla en vivo.
5. Todo paso que use la cámara/webcam necesita un botón equivalente de subir archivo que haga lo mismo. El demo path debe funcionar **sin** hardware.

## Propiedad del código y git

- Merge directo a `develop`, sin branches por feature, sin code review. `main` = solo lo entregable.
- Dueños por carpeta: `backend/core` → Luca (LLM/agentes/visión) · `backend/data` → Pena (ingesta/DB/modelos) · `frontend` → Juani · estructura e integración → Samo.
- **Los contratos de API se definen en `harness/AGENTS.md` y no se cambian sin avisar al equipo.** La mayoría de los bugs de las 23:00 son forma de JSON (`shipment_id` vs `id`), no lógica.

## Idioma y entregables

- **Docs internos (`harness/docs/`) en español.** La organización exige que los **entregables en inglés**: `README.md`, `harness/docs/arquitectura.md`, `harness/pitch/`.
- El diagrama de arquitectura es un artifact HTML dentro de `harness/docs/arquitectura.md` y es entregable evaluado directamente por el jurado.
- **Toda decisión core se escribe en `harness/docs/decision-log.md` con hora y motivo.** El repo es la fuente de verdad, no el chat del equipo.

## Norte de producto (para no desviarse)

Patrón que buscan los briefs de Yuno y Nauta: *datos fragmentados multi-fuente → capa de IA que unifica, explica y **actúa** → interfaz simple y accionable (a veces conversacional), no otro dashboard.* La IA tiene que ser el motor de la decisión, anticipar en vez de reportar, y explicar su porqué.

## Importante
Cada vez que se toma una decisión o se hace un cambio en el código, se debe actualizar el `harness/docs/decision-log.md`y artifact html 'harness/docs/arquitectura.html' con la hora y el motivo.

