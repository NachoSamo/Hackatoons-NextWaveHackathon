# 09 — Historias de usuario y requerimientos · Centinel

> Contrato funcional antes de código. Consolida la consigna oficial, el transcript de mentores,
> `08-product-ux-gtm.md`, el demo path y las decisiones del equipo. Si un comportamiento no entra en
> este documento o en `pitch/demo-path.md`, no es P0.

## 1. Resultado que debe producir el MVP

Centinel debe demostrar que Yuno puede convertir su visibilidad transversal de merchants y
providers en una verdad operacional accionable:

```text
comparar → detectar → localizar → demostrar → recomendar
```

El sistema gana si un operador puede responder en menos de un minuto:

1. ¿La caída es real o ruido?
2. ¿Dónde está concentrada?
3. ¿Desde cuándo y cuánto cuesta?
4. ¿Qué evidencia sostiene la hipótesis?
5. ¿Quién es el likely owner?
6. ¿Qué debería hacer una persona ahora?

## 2. Usuarios y trabajos

### U1 — Payment Operations Specialist de Yuno

Usuario primario y frecuente. Supervisa tráfico de múltiples merchants y providers.

> Cuando cambia el approval rate, necesito distinguir rápido ruido de incidente, aislar el segmento
> afectado y preparar una respuesta defendible antes de que el merchant me contacte.

### U2 — Payments Lead del merchant

Usuario externo secundario. Necesita alcance, impacto y siguiente paso sobre su propio tráfico.

> Cuando mis pagos fallan, necesito saber qué parte está afectada, qué está haciendo Yuno y qué debe
> hacer mi equipo, sin interpretar códigos de cada provider.

### U3 — Ejecutivo de Yuno o del merchant

Usuario ocasional. Necesita una línea, dinero en riesgo y estado actual.

> Cuando hay un incidente, necesito entender impacto, ownership y respuesta sin abrir el análisis
> técnico.

### U4 — Juez / operador de simulación

Actor de demo. Debe poder crear un caso no ensayado dentro de combinaciones válidas.

> Quiero cambiar dimensiones y magnitud del tráfico y comprobar que el sistema reacciona sin que el
> equipo toque el teclado.

### U5 — Provider / equipo de integración

Receptor de un evidence bundle cuando el probable owner está de su lado.

> Necesito un escalamiento con ventana, muestra, códigos y controles comparables para investigar sin
> empezar otra vez desde cero.

## 3. Historias priorizadas

### P0 — Deben funcionar en la demo

#### US-01 — Entender la promesa

Como visitante de Yuno, quiero entender qué hace Centinel y ver una prueba real del producto para
decidir abrir la demo.

**Criterios de aceptación**

- Landing en inglés.
- En el primer viewport se entienden problema, resultado y CTA.
- El CTA `Watch the live incident` abre `/control-tower`.
- La preview usa la misma interfaz que la aplicación, no una ilustración falsa.

#### US-02 — Iniciar una simulación reproducible

Como presentador, quiero iniciar, pausar y reiniciar el stream desde la UI para correr la demo sin
terminal.

**Criterios de aceptación**

- Estados `READY`, `RUNNING`, `PAUSED`, `COMPLETE`.
- Controles `Start live stream`, `Pause`, `Reset`.
- Badge persistente `SIMULATION MODE`.
- Reset vuelve al fixture saludable conocido.

#### US-03 — Confiar en el silencio saludable

Como operador, quiero ver tráfico normal sin alertas para comprobar que Centinel no confunde
variación con incidente.

**Criterios de aceptación**

- Approval observado y esperado se muestran juntos.
- Se ven ventana, referencia, timezone y tamaño de muestra.
- El estado saludable dice explícitamente que no hay incidentes activos.
- Las transacciones approved/rejected pueden verse como pulso agregado; no se renderizan miles de
  filas individuales.

#### US-04 — Comparar ventanas temporales

Como operador, quiero contrastar tráfico reciente contra una referencia válida para entender si la
variación es excepcional.

**Criterios de aceptación**

- Ventana observada y ventana de referencia siempre visibles.
- Default de demo: `Last 60 seconds` contra el baseline contextual de 14 días para la misma hora UTC
  y tipo de día.
- La UI reserva `Last 2 hours`, `Same time last week`, `Previous period` y
  `Contractual threshold` para exploración e histórico.
- Cambiar la ventana actualiza métricas, chart y evidencia de forma consistente.

#### US-05 — Ver el progreso del diagnóstico

Como operador, quiero saber si una señal se está validando o diagnosticando para no interpretar una
hipótesis temprana como incidente confirmado.

**Criterios de aceptación**

- Estados visibles: `healthy → validating → diagnosing → detected`.
- Cada transición tiene timestamp.
- La interfaz no declara causa mientras está validando.

#### US-06 — Comprender un incidente con evidencia

Como operador, quiero abrir un incidente y ver la evidencia que llevó al diagnóstico para decidir si
confío y cómo escalarlo.

**Criterios de aceptación**

- Responde qué, dónde, desde cuándo, a quién afecta y cuánto se desvía.
- Muestra baseline, muestra, dimensión ganadora y controles saludables.
- Muestra hipótesis principal, alternativas, confidence y datos faltantes.
- `Why this diagnosis?` abre la vista de investigación basada en composición C.

#### US-07 — Identificar ownership y acción

Como operador, quiero ver quién probablemente puede actuar y una recomendación concreta para no
traducir el diagnóstico manualmente.

**Criterios de aceptación**

- Owners posibles: provider, merchant, Yuno integration, issuing bank, buyer/input, unknown.
- La recomendación incluye responsable, pasos y evidencia requerida.
- Retry solo aparece cuando el input y la taxonomía soft/hard lo permiten.
- `Apply (simulated)` está marcado como demo; el MVP no remedia producción.

#### US-08 — Separar incidentes simultáneos

Como operador, quiero ver causas superpuestas como incidentes independientes para no mezclar su
impacto ni su respuesta.

**Criterios de aceptación**

- Caso Brasil/provider y México/merchant aparecen separados.
- Cada incidente tiene alcance, tiempo, impacto, confidence y owner propios.
- La cola explica prioridad mediante impacto, alcance, persistencia y confianza.

#### US-09 — Admitir evidencia insuficiente

Como operador, quiero que Centinel diga cuándo no sabe para evitar escalaciones o acciones basadas en
una falsa certeza.

**Criterios de aceptación**

- Estado `INSUFFICIENT EVIDENCE` visible y no tratado como error técnico.
- Muestra hipótesis alternativas y datos faltantes.
- No habilita acción fuerte mientras la evidencia no alcance.

#### US-10 — Investigar con Centinel Copilot

Como operador, quiero hacer preguntas sobre el incidente activo y comparar ventanas sin reconstruir
manualmente el contexto en distintos dashboards.

**Criterios de aceptación**

- El Copilot se abre dentro del contexto de un incidente, no como chatbot global vacío.
- La demo incluye una comparación sugerida entre los últimos 60 s y el baseline contextual de 14 días.
- Cada respuesta cita evidence IDs, explicita ventanas, confidence, limitaciones y próxima acción.
- Puede enfocar una dimensión o ventana mediante intents de vista tipados; no modifica datos ni reglas.
- `Operations / Executive` cambia el lenguaje, no los hechos del evidence bundle.
- Si OpenAI no responde, renderiza una explicación estructurada determinística.

#### US-11 — Operar el trial by fire

Como juez, quiero inyectar una combinación no ensayada para validar que el diagnóstico generaliza.

**Criterios de aceptación**

- Superficie separada `/demo-control`.
- Inputs controlados: merchant, provider, method, country, magnitude, duration y opcionalmente code.
- No requiere JSON ni terminal.
- Solo permite combinaciones soportadas por el dataset.
- El equipo no toca teclado después de `Inject incident`.

### P1 — Debe diseñarse; puede simplificarse técnicamente

#### US-12 — Cambiar audiencia

Como operador, quiero derivar una explicación ejecutiva y una operacional del mismo evidence bundle.

- `Executive`: una línea, impacto y estado.
- `Operations`: baseline, dimensiones, códigos, confidence y acción.
- Ninguna versión introduce hechos no presentes en la evidencia.

#### US-13 — Escalar al provider

Como operador, quiero generar un evidence bundle para contactar al probable provider owner.

- Incluye ventana, muestra, request/error codes, provider text, controles y timestamps.
- La UI puede simular `Send to provider`; no envía mensajes reales en el MVP.

#### US-14 — Contrastar merchant y provider truth

Como investigador, quiero comparar ambos lados para detectar errores nuevos, códigos mal mapeados o
problemas de integración.

- Evidence ledger con `Source / Observation / Implication`.
- Distingue falta de documentación, provider outage y mapping defect de Yuno.
- Un código desconocido nunca se presenta automáticamente como hard decline.

#### US-15 — Explorar y comparar ventanas personalizadas

Como operador, quiero salir del monitoreo global y consultar un scope y dos rangos temporales
personalizados para contrastar hipótesis sin reconstruir filtros en varios dashboards.

- El Command Center distingue claramente `Live Monitoring` de `Explore`.
- `Live Monitoring` conserva el detector automático y su baseline contextual por defecto.
- `Explore` permite elegir rango observado, rango de referencia, timezone y filtros por merchant,
  provider, method y country.
- Antes de ejecutar, muestra una oración y chips con la consulta estructurada completa.
- KPIs, título, gráfico, leyenda, sample size y revenue at risk responden al mismo scope.
- Una consulta natural puede proponer esa estructura, pero el usuario confirma con `Run analysis`.

#### US-16 — Proponer criterios de alerta gobernados

Como operador, quiero describir o completar un criterio de alerta y recibir una propuesta revisable
sin alterar directamente el detector activo.

- La propuesta siempre produce un `PolicyDraft` estructurado y legible.
- Inputs explícitos y lenguaje natural son alternativas de interacción aún por decidir.
- El draft muestra métrica, scope, ventana, baseline, umbral, persistencia y severidad.
- Activarlo requiere validación, replay, aprobación humana y una nueva versión auditable.
- Esta capacidad no modifica el hot path del trial by fire.

### P2 — Roadmap / bonus

- **US-17:** reconocer un incidente parecido y mostrar resolución previa.
- **US-18:** enviar resumen a Slack/WhatsApp.
- **US-19:** auto-remediación gobernada por políticas y approval gates.

## 4. Requerimientos funcionales

| ID | Requerimiento | Prioridad | Fuente |
|---|---|---:|---|
| FR-01 | Mostrar landing y aplicación bajo la marca Centinel, en inglés | P0 | Equipo + producto |
| FR-02 | Reproducir un stream sintético controlable desde UI | P0 | Demo path + transcript |
| FR-03 | Mostrar observed/reference windows, timezone y sample size | P0 | Mentores |
| FR-04 | Detectar desvíos relevantes sin alertar por ruido normal | P0 | Consigna |
| FR-05 | Localizar por `merchant × provider × method × country`; issuer/code entran como evidencia inicial | P0 | Consigna + decisión post-mentor |
| FR-06 | Mostrar estados de detección y diagnóstico en tiempo real | P0 | UX + demo |
| FR-07 | Mostrar evidencia, confidence, alternativas y datos faltantes | P0 | Consigna + confianza |
| FR-08 | Estimar revenue at risk con supuestos visibles | P0 | Consigna |
| FR-09 | Asignar likely owner y acción recomendada | P0 | Mentores |
| FR-10 | Separar y priorizar al menos dos incidentes simultáneos | P0 | Resultado esperado |
| FR-11 | Soportar `INSUFFICIENT EVIDENCE` | P0 | Bonus estratégico |
| FR-12 | Permitir incidente sorpresa parametrizado | P0 | Trial by fire |
| FR-13 | Derivar explicación ejecutiva y operacional | P1 | Bonus |
| FR-14 | Contrastar merchant y provider evidence | P1 | Research + transcript |
| FR-15 | Renderizar fallback estructurado si OpenAI falla | P0 | Demo resilience |
| FR-16 | Guiar la investigación mediante un Copilot contextual que compara agregados y cita evidence IDs | P0 | Demo path + producto/UX |
| FR-17 | Separar `Live Monitoring` de `Explore` y permitir comparar dos rangos históricos personalizados sobre un scope explícito | P1 | Producto/UX |
| FR-18 | Traducir una consulta natural a ventanas y filtros estructurados, con confirmación antes de ejecutarla | P1 | Producto/UX |
| FR-19 | Proponer criterios de alerta como `PolicyDraft` sujeto a validación, replay y aprobación; nunca activar desde el input | P1 | Producto/IA + gobernanza |

## 5. Requerimientos no funcionales

- **NFR-01 · Reproducibilidad:** mismo fixture + mismos parámetros → mismo resultado de demo.
- **NFR-02 · Trazabilidad:** toda afirmación del LLM referencia evidence IDs.
- **NFR-03 · Honestidad:** datos sintéticos, estimaciones y simulaciones se etiquetan.
- **NFR-04 · Resiliencia:** desconexión SSE/WebSocket reintenta o cae a polling.
- **NFR-05 · Accesibilidad:** WCAG AA, teclado, foco visible, reduced motion y estados no dependientes
  solo de color.
- **NFR-06 · Rendimiento:** animación fluida; el frontend consume buckets/agregados y no intenta
  renderizar el stream completo.
- **NFR-07 · Seguridad:** sin PII en fixtures; panel del juez restringido a valores válidos.
- **NFR-08 · Responsive:** landing completa; desktop operativo; mobile limitado a triage.
- **NFR-09 · Idioma:** toda UI pública en inglés; timezone, moneda y formato siempre explícitos.
- **NFR-10 · Demo:** flujo end-to-end sin teclado del equipo luego de la inyección.

## 6. Arquitectura de pantallas

```text
/
└── Landing
    └── Watch the live incident
        └── /control-tower
            ├── Query surface — Live Monitoring / Explore
            │   ├── Observed range / Reference range / Scope
            │   └── Query assistant → structured preview → Run analysis
            ├── Command Center — composición A, responde a una sola AnalysisQuery
            ├── Investigation workspace inline — composición C
            │   ├── Centinel Copilot — compare, explain, decide
            │   └── Executive / Operations — mismo evidence bundle
            └── El gráfico y la cola conservan contexto detrás del workspace

/demo-control
└── Judge injector — superficie separada
```

## 7. Contrato de datos recibido

El modelo inicial del backend tiene tres fuentes:

- `transactions`: stream de intentos con los cuatro ejes de localización
  (`merchant_id`, `provider_id`, `payment_method`, `country`) y evidencia complementaria
  (`issuer_bank`, `decline_code`, `latency_ms`, monto, resultado y origen).
- `baseline_profile`: referencia esperada por slice, hora UTC y tipo de día. El frontend no calcula
  este baseline desde transacciones crudas: consume agregados del backend.
- `incidents`: inyección y lifecycle de cada caso, con filtros JSON, multiplicador de aprobación,
  código dominante y timestamps de finalización, detención y mitigación.

Decisiones de integración:

- Los `BIGSERIAL` viajan como `string` hacia JavaScript para no perder precisión.
- La capa adapter normaliza `snake_case` a `camelCase` y conserva los `null` con significado.
- `filters` localiza por los cuatro ejes soportados. El inyector puede además acotar `issuer_bank`
  para el preset de evidencia de Banorte; banco no pasa a ser eje del cubo.
- `mitigated_at` representa una acción simulada en el MVP, no una remediación productiva.
- El detalle expone `issuer_bank`, `decline_code` y `latency_ms` como evidencia; no los confunde con
  la dimensión raíz hasta que el diagnóstico lo sustente.

## 8. Contrato mínimo esperado del frontend

Hasta recibir el modelo definitivo del backend, el frontend consume un adapter con estas entidades:

- `StreamState`: status, clock, total attempts, observed approval, expected approval.
- `TimeComparison`: observed window, reference type/window, timezone, buckets.
- `IncidentSummary`: id, priority, status, scope, startedAt, impact, confidence, likelyOwner.
- `IncidentEvidence`: baseline, sample, winning dimensions, controls, codes, alternatives, missingData.
- `RecommendedAction`: type, owner, rationale, steps, evidenceIds, confidence, status,
  simulationOnly, reviewedBy, appliedAt y outcome.
- `CopilotResponse`: answer, audience, comparison, evidenceIds, confidence, limitations,
  suggestedQuestions, suggestedActions y viewIntent tipado.
- `AnalysisQuery`: mode, observedRange, referenceRange, timezone, filters y source
  (`controls | natural_language`).
- `AlertPolicyDraft`: metric, filters, window, baseline, threshold, persistence, severity,
  validationStatus, replayResult y approvalStatus.
- `DemoScenario`: supported dimensions, magnitude, duration and fixture seed.

La UI no importa tipos del backend directamente: un adapter normaliza nombres, nullability y estados.

## 9. Definition of Done de la primera iteración

- Landing responsive terminada y en inglés.
- Ruta `/control-tower` navegable con composición A y datos mock locales.
- `Start live stream / Pause / Reset` funcionan sobre el mock.
- Estados `READY` y `RUNNING` visibles.
- Preview de landing reutiliza el componente real del Command Center.
- No hay claims comerciales inventados.
- Build, lint y revisión visual desktop/mobile pasan.

## 10. Fuentes y trazabilidad

- Consigna oficial: Challenge 2 · The Control Tower.
- Transcript de mentores: foco en ventanas temporales, near-real-time, acciones de calidad,
  comparación cross-provider, ownership, códigos desconocidos y demo parametrizable.
- `docs/06-dominio-pagos.md`: actores, códigos y taxonomía hard/soft.
- `docs/07-decisiones-core.md`: arquitectura y decisiones técnicas.
- `docs/08-product-ux-gtm.md`: producto, usuarios, confianza, marketing y experiencia.
- `pitch/demo-path.md`: secuencia que debe funcionar frente al jurado.
