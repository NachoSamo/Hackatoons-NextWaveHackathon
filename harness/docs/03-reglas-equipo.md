# 03 — Roles y reglas de equipo

Equipo full técnico. Los roles no son cárceles: son el default para que nadie espere a nadie.

---

## Roles

### Samo — PM + fullstack comodín + harness
Gestiona tiempos y checkpoints. Modulariza el repo y define la estructura para que git sea aburrido.
Programa (fullstack, va donde haga falta) y mantiene la coherencia entre capas. Mantiene el harness:
5 min cada 2 horas actualizando `decision-log.md`. **No es revisor de código** — cada uno gestiona el suyo.

### Luca — capa técnica compleja
Dueño del núcleo: LLM, agentes, computer vision, automatizaciones. Ataca el **spike de riesgo** en las
primeras horas. Co-diseña la arquitectura con Samo. Cero frontend. Puede responder preguntas técnicas
del jurado.

### Pena — datos + backend + venta
Capa de datos: ingesta, modelado, DB, procesamiento, preparación de datasets. Su trabajo es el que
**más sobrevive a un pivote de la Y**, por eso puede arrancar temprano sin miedo al rework.
Candidato fuerte para pitchear (inglés fluido + mérito comprobado presentando).

### Juani — product/BA + embajador con mentores + frontend + dirección del pitch
Tiene entregables duros por bloque horario (abajo), no un rol difuso.

---

## Timeline de Juani (bloques con entregable)

| Bloque | Tarea | Entregable |
|---|---|---|
| 14:00–17:00 | Rondas con mentores y gente de Yuno/Nauta | `mentor-feedback.md` con ≥3 conversaciones documentadas + 1 recomendación concreta |
| 17:00–19:00 | Marca + wireframe | Nombre, colores, logo en `/brand` + mockup del demo path |
| 19:00–21:00 | Frontend | Pantallas del demo path conectadas a la API con axios |
| 21:00–01:00 | **Pitch** | Guión escrito en `pitch/script.md` (NO se deja para el domingo) |
| Domingo | Refinamiento visual + dirección de ensayos | Pitch pulido |

---

## Reglas para el feedback de mentores

El riesgo: Juani vuelve a las 16:00 con "el mentor dijo que esto está mal" y desmotiva a tres personas
que ya construyeron algo. Se maneja así:

1. **Front-loadear.** Las conversaciones que pueden cambiar arquitectura van entre 14:00 y 17:00, con
   la Y en una frase y antes de que exista código que defender. El feedback caro es el que llega tarde.
2. **Feedback freeze a las 18:00.** Después, ningún feedback toca arquitectura ni alcance. Solo puede
   cambiar **cómo lo contamos en el pitch**. Esto no es pérdida: buena parte del feedback de mentores
   es sobre framing y narrativa, y ese es gratis de incorporar y valiosísimo.
   → Juani lo sabe explícito: *"después de las 18:00 tu output es munición para el pitch, no cambios de producto"*.
3. **Juani reporta datos, no veredictos.** No dice "está mal". Escribe: quién, qué dijo textual, qué
   implicaría. **Samo decide si se acciona.** Esa separación entre reportar y decidir es la que evita
   que el equipo se desmoralice cada vez que vuelve una ronda.

Por qué esto importa: las personas de Yuno y Nauta que están en la sala escribieron el brief y van a
juzgar. Extraerles qué consideran una buena solución **antes** de construirla es una ventaja enorme, y
evita alinearnos con nuestra propia idea del problema en vez de con el real.

---

## Hardware y tecnologías "disruptivas"

**Regla:** el hardware entra solo si es **el core de la solución**, no como adorno. Si el brief no lo
pide y la solución no lo necesita, no va.

- **Descartados:** blockchain (Yuno no lo menciona en ningún lado; un jurado fintech ya vio 200 pitches
  de "blockchain para pagos" y lo lee como que no entendimos el problema), robótica, tablet.
- **Aprobado — webcam + trípode (Luca):** cámara apuntando a un **documento de papel** sobre la mesa →
  captura en vivo → el LLM lo estructura → un agente decide y actúa. Eso no es truco de feria: es
  literalmente el dolor que Nauta describe. La diferencia de impacto entre "subo un PDF" y "agarro un
  papel de la mesa y en 3 segundos está estructurado y accionado en pantalla" es enorme.
- **Lo que NO hacer:** YOLO trackeando cosas en vivo porque sí. Ningún importador tiene una cámara
  mirando containers en su oficina. El jurado lo lee como truco.

> **REGLA NO NEGOCIABLE: el demo path tiene que funcionar SIN el hardware.**
> La cámara es el modo "wow", pero tiene que existir un botón de subir archivo que haga exactamente
> lo mismo. Si la webcam falla en vivo (luz, driver, permisos del browser), seguimos sin que se note.

---

## Git

- Todo a `develop`, merge directo. `main` = código entregable / demo.
- Sin branches por feature, sin code review. En 24h el code review es un lujo que no tenemos.
- Cada uno dueño de su carpeta (ver `AGENTS.md`).
- **Los contratos de API se definen en las primeras 2 horas y se escriben en `AGENTS.md`.** La mayoría
  de los conflictos de las 23:00 no son de git: son "el front esperaba `shipment_id` y el back manda `id`".

---

## Pitch

- **Se decide por desempeño, no por deseo.** El sábado a la noche, cuando el MVP esté cerca, cada uno
  hace el pitch completo una vez y el equipo vota.
- **Máximo 2 personas en el escenario.** Tres en 3 minutos = transiciones perdidas y narrativa rota.
- Juani dirige y arma el guión, suba o no al escenario.
- Mínimo 4 ensayos completos con cronómetro el domingo por la mañana.
