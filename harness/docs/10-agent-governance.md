# 10 — Gobernanza del agente · Centinel

## 1. Qué significan las métricas

### Delta

`delta_pp = approval_observed − approval_expected`

Ejemplo: `84.8% − 86.1% = −1.3 pp`. Son **puntos porcentuales**, no una caída relativa de 1,3%.
Un delta negativo pequeño puede ser variación normal; el detector decide usando muestra,
persistencia, baseline y reglas, no el signo aislado.

### Revenue at risk

Estimación horaria, no dinero conciliado:

`usd_per_hour = affected_attempts × (expected_rate − observed_rate) × avg_ticket`, normalizado a una
hora. Siempre debe mostrar ventana, muestra, ticket promedio y etiqueta `estimated`.

## 2. Entrada en lenguaje natural para políticas

El LLM no modifica directamente CUSUM, baseline ni alertas. Traduce intención humana a un borrador
estructurado:

```text
operador escribe intención
→ LLM propone PolicyDraft
→ validador revisa campos/rangos
→ replay muestra alertas que habría creado o suprimido
→ humano aprueba
→ se publica una PolicyVersion auditable
```

Ejemplo: “Alertame si PIX Brasil cae más de 8 pp durante 90 segundos y afecta más de USD 5k/h”.

```json
{
  "scope": { "payment_method": "pix", "country": "BR" },
  "approval_delta_pp_lte": -8,
  "min_duration_s": 90,
  "min_revenue_at_risk_usd_h": 5000
}
```

Estados: `DRAFT → VALIDATED → TESTED → APPROVED → ACTIVE → SUPERSEDED/REVOKED`.

Para la hackathon es P2: puede mostrarse como concepto, pero no entra al hot path del trial by fire.

## 3. Lifecycle de diagnóstico

1. El motor guarda un `EvidenceSnapshot` inmutable: ventana, baseline, muestra, slice, controles,
   códigos, bancos y cálculo económico.
2. El localizador genera un `DiagnosisCandidate`: hipótesis, alternativas, confidence y datos
   faltantes.
3. El agente produce `DiagnosisExplanation` para Operations o Executive, citando evidence IDs.
4. Una persona acepta, descarta o pide más evidencia. Nunca se reescribe el snapshot original.
5. La decisión y su motivo quedan en el flight/decision log operacional.

Estados: `VALIDATING → DIAGNOSING → DETECTED / INSUFFICIENT_EVIDENCE → RESOLVED / DISMISSED`.

## 4. Lifecycle de recomendación

Una `RecommendedAction` guarda:

- `owner`, `type`, `steps` y `rationale`;
- `evidence_ids` que la justifican;
- `confidence`, riesgos y condiciones de aplicación;
- `simulation_only`, estado y timestamps;
- quién la aprobó/descartó y resultado observado.

Estados: `PROPOSED → REVIEWED → APPROVED / REJECTED → APPLIED → MONITORING → EFFECTIVE / INEFFECTIVE`.

El MVP sólo ejecuta `Apply action (simulated)`. Producción requeriría permisos por rol, doble
aprobación para acciones sensibles, idempotency key, rollback y audit trail.

## 5. Memoria y mejora

El agente no “aprende” cambiando reglas solo. Al cerrar el incidente se registra:

- diagnóstico aceptado o corregido;
- acción aplicada y resultado;
- tiempo de detección, decisión y recuperación;
- falsos positivos/negativos y comentario humano.

Eso alimenta búsqueda de precedentes y propuestas futuras. Toda modificación de política vuelve al
flujo de draft, replay y aprobación.
