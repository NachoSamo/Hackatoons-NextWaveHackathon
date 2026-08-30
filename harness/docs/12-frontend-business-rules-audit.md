# 12 — Auditoría de reglas de negocio vs. frontend

> Corte realizado el 30/08. Cruza consigna, producto/UX, historias de usuario, gobernanza y contratos
> reales de `backend/core`, `backend/data` y `backend/explain`. El backend fue inspeccionado en modo
> read-only. `✅` visible y verificable · `🟡` parcial · `⛔` requiere contrato/backend · `P1` fuera del
> hot path.

## Resultado ejecutivo

La experiencia principal ya cubre el relato obligatorio `watch → validate → diagnose → explain →
recommend`, pero la limpieza había eliminado una parte P0: comparar el incidente activo contra una
referencia y ejecutar más de una consulta sin perder contexto.

Se reincorpora como `ComparisonWorkspace`, no como otro dashboard:

- ventanas móviles `60 s / 5 min / 15 min / 1 h / 2 h`;
- baseline contextual o segunda ventana móvil;
- scope por `merchant × provider × payment_method × country`;
- consulta natural que propone controles visibles antes de ejecutar;
- historial de varias consultas durante la sesión;
- observed, reference, delta pp, muestra y revenue at risk estimado;
- fuente explícita: cubos agregados de `/api/cube`, nunca transacciones crudas enviadas al LLM.

No se muestran selectores de fechas arbitrarias: el backend actual acepta `window_s`, pero no
`from/to` ni una ventana histórica anclada. Fingir esos controles rompería el contrato de confianza.

## Matriz de cobertura

| Regla de negocio / demo | Fuente real | Estado UI | Observación |
|---|---|---:|---|
| Silencio saludable antes de alertar | `EngineConfig`, US-03 | ✅ | Estado explícito, stream controlable y cola vacía. |
| Estados `validating → diagnosing → detected` | `IncidentStatus`, US-05 | 🟡 | La progresión es visible, pero faltan timestamps por transición. |
| Comparar observed contra baseline contextual | `get_cube(window_s)`, US-04/10 | ✅ | Ejecuta sobre agregados reales y conserva UTC, scope y muestra. |
| Ejecutar varias consultas temporales | US-10 + pedido de demo | ✅ | Historial local de sesión; cada resultado mantiene su pregunta estructurada. |
| Rangos históricos exactos `from/to` | US-15 | ⛔ P1 | Requiere endpoint histórico; no está en el contrato actual. |
| Localizar por cuatro ejes | `DIMENSIONS`, FR-05 | ✅ | Scope visible y prefill desde el incidente. Issuer/code siguen como evidencia. |
| Hipótesis principal, alternativas y datos faltantes | `Diagnosis`, FR-07 | ✅ | Se exponen en el workspace; antes las alternativas no se renderizaban. |
| Evidencia con IDs trazables | NFR-02, US-10 | ⛔ | `Diagnosis.evidence` devuelve strings, no evidence IDs estructurados. |
| Confidence y Wilson/sample | classifier + US-06/09 | 🟡 | Confidence y evidencia textual visibles; Wilson/sample no tienen campos propios en `Diagnosis`. |
| Revenue at risk como estimación | `CostEstimate`, gobernanza §1 | ✅ | Se etiqueta estimate y se muestran supuestos en Comparison; nunca reconciled revenue. |
| Likely owner + acción humana | `RecommendedAction`, US-07 | ✅ | Owner, rationale, parámetros, impacto esperado y reevaluación visibles. |
| No remediación automática | challenge + `simulation_only` | ✅ | La UI comunica recommendation only; no mueve dinero. |
| Retry según hard/soft decline | classifier metadata + reglas `.md` | 🟡 | El backend gobierna la acción; falta una etiqueta humana hard/soft en evidencia. |
| Prioridad explicable | `score_incidents` | ✅ | Se ven impacto, alcance, persistencia, confidence y criticidad merchant. |
| Dos incidentes simultáneos separados | core residualization + US-08 | ✅ | La cola soporta múltiples resultados y scroll propio. |
| Evidencia insuficiente | weak fixture + US-09 | ✅ | Preset visible; no muestra costo ni acción fuerte y lista evidencia faltante. |
| Operations / Executive | `Diagnosis.operations/executive` | ✅ | Cambia lenguaje, no hechos. |
| Fallback sin OpenAI | templates + `llm_used` | 🟡 | Funciona en backend; la UI no etiqueta si el wording vino de LLM o template. |
| Judge injection sólo con combinaciones válidas | `/api/inject/options`, US-11 | 🟡 | Hay controles, pero aún están hardcodeados y no consumen `inject/options`. |
| Métricas globales sincronizadas con stream real | `/api/overview` | 🟡 | Comparison usa backend; los KPIs principales todavía usan valores de demo. |
| Memoria de incidentes repetidos | bonus / Remember | P1 | No implementado. |
| Evidence bundle para provider | US-13/14 | P1 | No implementado como export/handoff. |
| PolicyDraft gobernado | gobernanza §2 | P1 | Correctamente fuera del pitch; no debe volver al hot path. |

## Próximos gaps, en orden

### P0 antes del ensayo final

1. Alimentar KPIs principales con `/api/overview` o el stream real; eliminar valores hardcodeados.
2. Poblar Judge mode desde `/api/inject/options` para impedir combinaciones inválidas.
3. Mostrar timestamps de cada transición del lifecycle.
4. Si el contrato se amplía, transportar `evidence_ids`, baseline/sample estructurados y origen
   `LLM/template` hasta la UI.

### P1 / Q&A

1. Endpoint histórico con `observed_from/to`, `reference_from/to`, timezone y scope.
2. Incident memory con precedente, diferencias y resolución anterior.
3. Evidence bundle exportable para provider/merchant.
4. PolicyDraft con replay, aprobación y versionado.

## Regla de alcance

La comparación P0 vive en una ventana secundaria accesible desde Command Center y desde el
incidente. No reemplaza Live Monitoring, no modifica el detector y no activa alertas. La UI agrega
cubos del backend para presentar métricas; el Copilot sólo explica el evidence bundle.
