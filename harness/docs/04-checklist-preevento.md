# 04 — Checklist pre-evento

Todo esto se hace **antes** del sábado. Nada de esto se resuelve bien a las 22:00 con sueño.

## Infra y cuentas
- [x] Cuenta de ngrok creada y logueada (Samo)
- [ ] ngrok **probado end-to-end**: backend local expuesto + consumido desde afuera. No alcanza con instalarlo
- [ ] Cuenta de Vercel lista, deploy de prueba de un React vacío hecho
- [ ] Repo de GitHub creado, público, con el harness adentro
- [ ] Postgres local corriendo en las 4 máquinas (o decidir un Postgres gestionado)
- [ ] Definir: ¿va a haber RAG/embeddings? Si sí → pgvector desde el día 1, no migrar en caliente
- [ ] Pena: averiguar si AWS suma algo real. **Regla: solo si lo hace en <30 min sin distraer a nadie. Si pide tiempo de otros, se cancela**
- [ ] Plan B de red: **hotspot del celular configurado**. Con 40 personas deployando, la wifi del evento va a sufrir

## Materiales físicos
- [ ] Webcam + trípode
- [ ] Zapatilla / alargue, cargadores, auriculares
- [ ] Post-its y fibrones (para el kanban físico)

## Herramientas
- [ ] Herramienta de diagrama de arquitectura ya elegida y probada (excalidraw / draw.io / HTML artifact). No elegir herramienta bajo presión
- [ ] Plantilla de README en inglés lista para completar (es entregable obligatorio)

## A preguntar el sábado temprano al staff
- [ ] ¿Cuál es el límite real de créditos de la API de OpenAI? La página dice acceso gratis, **no dice ilimitado**. Muy probablemente sean créditos con tope
- [ ] ¿Cuánto dura exactamente el pitch y cuántas preguntas hace el jurado?
- [ ] ¿Se puede usar la propia laptop conectada al proyector, o hay que mandar el material antes?

## Durante el desarrollo
- [ ] Cachear respuestas del LLM mientras se debuggea. No llamar mil veces al modelo por lo mismo
- [ ] No diseñar una demo que necesite cientos de llamadas en vivo
