# AGENTS.md — Reglas del proyecto

Contexto para cualquier agente de código que trabaje en este repo.

## Qué es esto

Prototipo funcional para el NextWave Hackathon 2026 (Yuno × Nauta × OpenAI). Ventana real de
construcción: ~14 horas.

**Challenge elegido: C2 · The Control Tower (Yuno)** — monitoreo de pagos en vivo + diagnóstico de
causa raíz. Dominio en `docs/06-dominio-pagos.md`, enfoque técnico y decisiones en
`docs/07-decisiones-core.md`, y producto/UX en `docs/08-product-ux-gtm.md`. Los 4 briefs y por qué se
eligió C2: `docs/05-challenges.md`.
Los contratos de API (abajo) se completan cuando se cierren las decisiones core.

## Stack

- **Backend:** Python + FastAPI + Uvicorn. Gestión con pip.
- **Frontend:** TypeScript + React + Tailwind. Llamadas HTTP con axios.
- **DB relacional:** PostgreSQL. Si hace falta embeddings/RAG → pgvector desde el día 1.
- **DB no relacional (solo si el caso lo pide):** MongoDB.
- **LLM:** API de OpenAI.
- **Deploy:** frontend en Vercel · backend local expuesto con ngrok (o Railway/Render si es simple).

## Prioridades al escribir código

1. Que funcione el **demo path** (ver `pitch/demo-path.md`).
2. Preferir la solución simple y legible a la elegante.
3. Nada de tests unitarios, CI, ni abstracciones prematuras. No hay tiempo y no suman puntos.
4. Si algo se puede hardcodear y se ve igual en la demo, se hardcodea. Anotarlo en el decision-log.
5. Manejar errores de forma que **la demo nunca crashee en vivo**: try/except amplio, fallback visible,
   nunca una pantalla en blanco.

## Contratos de API

Definidos en las primeras 2 horas y documentados acá abajo. **No cambiar un contrato sin avisar
al equipo** — la mayoría de los bugs de las 23:00 son de forma de JSON, no de lógica.

```
POST /api/agent/explain
  request: EngineOutput  |  { "fixture": "dual_incident" }   (nombre corto o "engine_output_*")
  response: { diagnoses: Diagnosis[], prioritized: ScoredIncident[] }   (nunca 500; error va en el body)

GET /api/incidents/{id}/diagnosis
  response: { diagnosis: Diagnosis | null, error?: string }

GET /api/stream
  SSE data: { ts, observed_rate, expected_rate, tx_count }

GET /api/overview?window_s=60
  response: { window_s, stream, attempts, approved, observed_rate, expected_rate,
              active_incidents: Incident[], replay_error, copy_error, simulation_only: true }

GET /api/cube?window_s=60
  response: { window_s, leaves: Leaf[] }

GET /api/evidence?window_s=60&provider_id=adyen&country=BR
  response: { window_s, filters, decline_codes: { before, after }, issuers, series,
              sample_size, wilson_ci }

GET /api/inject/options
  response: { filter_fields, merchants, providers, countries, methods_by_country,
              issuers_by_country, decline_codes, magnitude, presets, simulation_only: true }

POST /api/inject
  request: { filters, magnitude, decline_code, duration_s?, label? }
        | { preset_id: "provider_br" | "issuer_mx" | "weak_signal" }
  response: { incident_id, incident: Incident }

POST /api/inject/{id}/stop
  response: { incident_id, incident: Incident }

GET /api/incidents/active
  response: { incidents: Incident[] }

POST /api/actions/apply
  request: { incident_id }
  response: { incident_id, incident: Incident, simulation_only: true, message }

POST /api/demo/reset
  response: { reset: true, deleted_live_transactions: int | null,
              persistence_error: string | null, active_incidents: [], simulation_only: true }
```

`EngineOutput` = `{ incidents: IncidentEvidence[] }` (lista → soporta 2 incidentes simultáneos).
Cada incidente tiene `incident_id`, `detected_at`, `estimated_start`, `slice` (`merchant_id`,
`provider_id`, `payment_method`, `country`, todos `str | null` = sub-cubo parcial),
`diagnosis_category` (lo clasifica el motor de Luca, determinístico), `diagnosis_status`
(`supported` | `insufficient_evidence` | `unclassified`; la capa explain tolera los aliases legacy
`insufficient` / `ambiguous`), `confidence_score` / `confidence_level`,
`baseline_rate` / `observed_rate`, `sample_size`, `wilson_ci`, `estimated_lost_approvals`
(`{ value, window_seconds }`), `decline_shift[]`, `issuer_evidence[]`, `reason_codes[]`, `alternatives[]`.

`Diagnosis` repite incidente + slice + categoría/estado/confianza y agrega: `headline` (**determinístico**:
plata + slice), `executive` / `operations` / `alternatives` (LLM, con fallback Jinja), `evidence[]`
(determinístico), `missing_data[]`, `cost` (`money_lost` de Pena, o fallback), `recommended_action`
(del catálogo, `simulation_only: true`), `llm_used`. Cuando `diagnosis_status != supported` →
acción `monitor_for_evidence`, `cost: null`, `missing_data` poblado.

`Leaf` siempre separa `attempts` de `approved` y conserva `fc_attempts`, `fc_approved` y
`amount_usd_sum`. `Incident` contiene `incident_id`, `filters`, `magnitude`,
`current_multiplier`, `decline_code`, `label`, `started_at`, `duration_s`, `status`, `active`,
`stopped_at`, `mitigated_at` y `simulation_only`. Los filtros válidos son cualquier subconjunto de
`merchant_id`, `provider_id`, `payment_method`, `country` e `issuer_bank`; los valores permitidos
se obtienen exclusivamente desde `/api/inject/options`.

## Propiedad del código

Cada uno es dueño de su capa y hace merge directo a `develop`. No hay code review.
- `/backend/core` → Luca (CUSUM, localizador y clasificación determinística)
- `/backend/data` → Pena (ingesta, modelos, DB, procesamiento)
- `/backend/explain` y `backend/main.py` → Samo (explicación, playbook, contratos y API)
- `/frontend` → Juani (Samo puede hacer wiring, Juani manda en lo visual y lo pisa si hace falta)
- Estructura, integración y comodín → Samo

## Git

- `develop` = donde se trabaja, merge directo.
- `main` = solo código entregable, lo que va a la demo.
- Sin branches por feature. Commits chicos y frecuentes.
