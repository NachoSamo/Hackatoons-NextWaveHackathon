# HARNESS — NextWave Hackathon 2026

Punto de entrada del contexto del proyecto. Si sos un humano o un agente y no sabés por dónde
empezar, leé este archivo primero.

**Equipo:** Samo · Juani · Luca · Pena
**Sede:** Buenos Aires · 29–30 agosto 2026
**Organizan:** Yuno (pagos) × Nauta (logística) · Sponsor: OpenAI

---

## Mapa de archivos

| Archivo | Qué contiene | Cuándo se lee |
|---|---|---|
| `AGENTS.md` | Reglas del proyecto para agentes de código | Siempre, antes de picar código |
| `docs/00-dominios.md` | Qué hacen Yuno y Nauta, dolores reales, qué challenge ataca cada dolor | Antes del kickoff |
| `docs/05-challenges.md` | Los 4 briefs desarrollados + análisis de selección. **Elegido: C2 · The Control Tower** | Registro; el análisis ya está hecho |
| `docs/06-dominio-pagos.md` | Dominio de pagos en profundidad: circuito, actores, decline codes, dimensiones. Vocabulario + defensa técnica | Antes de codear C2 |
| `docs/07-decisiones-core.md` | Disparador de las decisiones técnicas core de C2 + resumen del research | Reunión de arranque |
| `docs/08-product-ux-gtm.md` | Cliente, problema, propuesta de valor, UX, venta, guía para mentores y storyboard C2 | Juani + definición de producto |
| `docs/09-plan-datos.md` | Plan de datos, generador, cubo y endpoints de la demo | Pena + integración |
| `docs/10-user-stories-requirements.md` | Historias de usuario, requerimientos, estados y trazabilidad del MVP de Centinel | Antes de tocar frontend/backend |
| `docs/11-agent-governance.md` | Cómo se versionan políticas, diagnósticos, recomendaciones y feedback humano | Producto + agente + frontend |
| `docs/01-kickoff.md` | Dinámica exacta de las primeras 2 horas | Sábado 12:30 |
| `docs/02-timeline.md` | Presupuesto de horas, checkpoints, reglas de recorte | Todo el evento (Samo lo gestiona) |
| `docs/03-reglas-equipo.md` | Roles, feedback de mentores, git, hardware | Antes del kickoff |
| `docs/04-checklist-preevento.md` | Qué dejar listo/instalado/impreso ANTES del sábado | Esta semana |
| `docs/decision-log.md` | Toda decisión con hora y motivo | Se escribe durante el evento |
| `docs/mentor-feedback.md` | Lo que traen los mentores (datos, no veredictos) | Juani lo llena |
| `docs/arquitectura.md` | Diagrama + descripción técnica (ENTREGABLE, inglés) | Se llena el sábado |
| `docs/arquitectura.html` | Borrador de la arquitectura de C2, capa por capa, con decisiones abiertas | Ahora — alinear al equipo |
| `pitch/demo-path.md` | Los N pasos exactos que se muestran en el pitch | Se congela antes de codear |
| `pitch/script-demo.md` | Guión del pitch de 7 minutos: 2 de producto + 5 de demo | Juani, sábado post-cena |
| `../README.md` | Entregable público en la raíz de GitHub — **EN INGLÉS** | Se arma desde el día 1 |

---

## Reglas del harness

1. **Todo lo que se decide, se escribe.** Si no está en el repo, no existe.
2. **Samo mantiene el harness.** 5 minutos cada 2 horas actualizando `decision-log.md`. No es un trabajo full time.
3. **El repo es la fuente de verdad, no la conversación.** Los agentes leen esto, no leen el chat del equipo.
4. **Docs internos en español. Entregables (README, arquitectura, pitch) en inglés** — la organización lo exige.
5. **Cada vez que alguien tome decisiones importantes lo escribe en el decision-log.md, es clave que todos mantengamos el harness**
6. **El proyecto se entrega con un video de maximo 3 minutos, no mas.**
7. **Antes de editar decisiones, traer `develop`; al terminar, actualizar el harness, commitear y pushear.** Si hay cambios locales, preservarlos y rebasar sin pisar trabajo del equipo.
