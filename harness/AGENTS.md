# AGENTS.md — Reglas del proyecto

Contexto para cualquier agente de código que trabaje en este repo.

## Qué es esto

Prototipo funcional para el NextWave Hackathon 2026 (Yuno × Nauta × OpenAI). Ventana real de
construcción: ~14 horas.

Hay 4 challenges posibles (2 de Yuno, 2 de Nauta), desarrollados en `docs/05-challenges.md`.
**Todavía no elegimos uno.** Cuando se elija, este archivo y el resto del harness se actualizan con
el challenge fijado, la arquitectura y los contratos de API.

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
(completar el sábado)
POST /endpoint
  request:  { ... }
  response: { ... }
```

## Propiedad del código

Cada uno es dueño de su capa y hace merge directo a `develop`. No hay code review.
- `/backend/core` → Luca (LLM, agentes, visión, lógica compleja)
- `/backend/data` → Pena (ingesta, modelos, DB, procesamiento)
- `/frontend` → Juani (Samo puede hacer wiring, Juani manda en lo visual y lo pisa si hace falta)
- Estructura, integración y comodín → Samo

## Git

- `develop` = donde se trabaja, merge directo.
- `main` = solo código entregable, lo que va a la demo.
- Sin branches por feature. Commits chicos y frecuentes.
