# ARQUITECTURA (ENTREGABLE — versión final en INGLÉS)

> El diagrama de arquitectura es entregable obligatorio. El jurado lo evalúa directamente:
> la profundidad técnica no es un detalle de ejecución, es un entregable formal.

## Diagrama
Se encontrará en un artifact HTML. Este archivo (entregable) debe estar en inglés y se completa
cuando cierren las decisiones core.

**Borrador de trabajo (español, con decisiones abiertas):** `arquitectura.html` en esta carpeta ·
artifact: https://claude.ai/code/artifact/00acbfd4-203c-4d91-99d6-e07fd0f209da

Pipeline de 5 capas: Generador → Motor determinístico (detector → localizador) → Agente RAG →
Playbook + templates → Entrega (dashboard + canal). Regla: lo determinístico calcula, la IA entiende.

## Capas (son mutables dependiendo la solución que elijamos)
| Capa | Qué hace | Tech | Responsable |
|---|---|---|---|
| Ingesta | | | Pena |
| Datos | | Postgres | Pena |
| Núcleo IA | | OpenAI API | Luca |
| API | | FastAPI | Samo |
| Frontend | | React + Tailwind | Juani |

## Decisiones técnicas y por qué
*(20 segundos por capa en el pitch salen de acá)*

## Qué haríamos con más tiempo
*(sirve para el cierre del pitch)*
